import type { Client } from 'discord.js'
import type { Config } from './config.js'

export type ToolKind = 'read' | 'write' | 'destructive'

export interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  kind: ToolKind
  handler: (args: Record<string, unknown>, config: Config, client: Client) => Promise<unknown>
}

export type AuditSink = (line: string) => void | Promise<void>

export class ToolRegistry {
  private tools = new Map<string, ToolDef>()

  constructor(
    private config: Config,
    private auditSink?: AuditSink
  ) {}

  register(tool: ToolDef): void {
    this.tools.set(tool.name, tool)
  }

  listVisible(): ToolDef[] {
    return Array.from(this.tools.values())
      .filter(t => this.isVisible(t))
      .map(t => this.withConfirmTokenSchema(t))
  }

  private withConfirmTokenSchema(tool: ToolDef): ToolDef {
    if (!this.config.confirmationToken || tool.kind !== 'destructive') return tool
    const schema = tool.inputSchema as { type: string; properties: Record<string, unknown>; required?: string[] }
    return {
      ...tool,
      inputSchema: {
        ...schema,
        properties: {
          ...schema.properties,
          confirmToken: {
            type: 'string',
            description: 'Confirmation token required for destructive actions (set via DISCORD_MCP_CONFIRM_TOKEN)',
          },
        },
      },
    }
  }

  private isVisible(tool: ToolDef): boolean {
    if (this.config.readonly && (tool.kind === 'write' || tool.kind === 'destructive')) {
      return false
    }
    if (this.config.toolsDeny.has(tool.name)) return false
    if (this.config.toolsAllow !== null && !this.config.toolsAllow.has(tool.name)) return false
    return true
  }

  async call(
    name: string,
    args: Record<string, unknown>,
    client: Client
  ): Promise<unknown> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    if (!this.isVisible(tool)) throw new Error(`Tool not available: ${name}`)

    // Channel allowlist: enforced only when `channelId` is present in args.
    // Tools without a channelId (e.g. guild-scoped tools) are not subject to
    // channel restrictions. This is intentional — the channel allowlist is
    // designed to scope write access to specific channels, not to block
    // guild-level operations.
    if (tool.kind !== 'read' && this.config.channelsAllow !== null) {
      const channelId = args['channelId'] as string | undefined
      if (channelId && !this.config.channelsAllow.has(channelId)) {
        throw new Error(`Channel ${channelId} is not in the allowed channel list`)
      }
    }

    // Dry-run: intercept write/destructive tools and return a simulated response.
    // Read tools always execute regardless of dryRun (no side effects).
    if (this.config.dryRun && tool.kind !== 'read') {
      return { dryRun: true, tool: name, args, note: 'Dry run mode — action was not executed' }
    }

    const start = Date.now()
    let result: unknown

    try {
      // Confirmation token: required for destructive tools when configured.
      // The check lives inside the try/catch so failures are captured by the audit log.
      if (this.config.confirmationToken && tool.kind === 'destructive') {
        const provided = args['confirmToken'] as string | undefined
        if (provided !== this.config.confirmationToken) {
          throw new Error('Destructive action requires a valid confirmToken')
        }
      }

      result = await tool.handler(args, this.config, client)
    } catch (err) {
      // Audit ALL failures regardless of kind — error observability matters even for reads.
      await this.writeAudit(tool, args, Date.now() - start, 'error', err instanceof Error ? err.message : String(err))
      throw err
    }

    if (tool.kind !== 'read') {
      await this.writeAudit(tool, args, Date.now() - start, 'ok')
    }

    return result
  }

  private async writeAudit(
    tool: ToolDef,
    args: Record<string, unknown>,
    durationMs: number,
    result: 'ok' | 'error',
    error?: string
  ): Promise<void> {
    if (!this.auditSink) return

    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      tool: tool.name,
      kind: tool.kind,
      args,
      durationMs,
      result,
    }
    if (error) entry['error'] = error

    try {
      await this.auditSink(JSON.stringify(entry) + '\n')
    } catch (err) {
      console.error('Audit log write failed:', err)
    }
  }
}
