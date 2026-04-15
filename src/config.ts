export interface Config {
  token: string
  guildId: string | undefined
  readonly: boolean
  toolsAllow: Set<string> | null   // null = no allowlist (all tools visible)
  toolsDeny: Set<string>           // empty = no denylist
  channelsAllow: Set<string> | null // null = no channel restriction
  dryRun: boolean
  auditLog: string | false         // 'stderr', file path, or false (disabled)
  confirmationToken: string | false // false = feature disabled
  transport: 'stdio' | 'http'
  httpPort: number                 // default 3000; only meaningful when transport='http'
  httpToken: string | false        // false = disabled (stdio mode); required string in http mode
}

function parseBoolean(val: string | undefined, defaultVal: boolean): boolean {
  if (val === undefined) return defaultVal
  return val.toLowerCase() === 'true'
}

function parseSet(val: string | undefined): Set<string> | null {
  if (!val || val.trim() === '') return null
  const items = val.split(',').map(s => s.trim()).filter(Boolean)
  if (items.length === 0) return null
  return new Set(items)
}

function parseAuditLog(val: string | undefined): string | false {
  if (val === undefined) return 'stderr'
  if (val === 'off') return false
  // Any other value ('stderr' or a file path) is passed through as-is.
  // The audit writer is responsible for handling the value at runtime.
  return val
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const token = env['DISCORD_TOKEN']
  if (!token) throw new Error('DISCORD_TOKEN is required')

  const transport = (env['DISCORD_MCP_TRANSPORT'] ?? 'stdio') as 'stdio' | 'http'
  if (transport !== 'stdio' && transport !== 'http') {
    throw new Error("DISCORD_MCP_TRANSPORT must be 'stdio' or 'http'")
  }
  const httpToken = env['DISCORD_MCP_HTTP_TOKEN'] || false
  if (transport === 'http' && !httpToken) {
    throw new Error('DISCORD_MCP_HTTP_TOKEN is required when DISCORD_MCP_TRANSPORT=http')
  }
  const httpPort = parseInt(env['DISCORD_MCP_HTTP_PORT'] ?? '3000', 10)

  return {
    token,
    guildId: env['DISCORD_GUILD_ID'] || undefined,
    readonly: parseBoolean(env['DISCORD_MCP_READONLY'], false),
    toolsAllow: parseSet(env['DISCORD_MCP_TOOLS']),
    toolsDeny: parseSet(env['DISCORD_MCP_TOOLS_DENY']) ?? new Set(),
    channelsAllow: parseSet(env['DISCORD_MCP_CHANNELS']),
    dryRun: parseBoolean(env['DISCORD_MCP_DRY_RUN'], false),
    auditLog: parseAuditLog(env['DISCORD_MCP_AUDIT_LOG']),
    confirmationToken: env['DISCORD_MCP_CONFIRM_TOKEN'] || false,
    transport,
    httpPort,
    httpToken,
  }
}
