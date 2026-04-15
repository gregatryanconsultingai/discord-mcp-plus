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
  transport: 'stdio'
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

  return {
    token,
    guildId: env['DISCORD_GUILD_ID'] || undefined,
    readonly: parseBoolean(env['DISCORD_MCP_READONLY'], false),
    toolsAllow: parseSet(env['DISCORD_MCP_TOOLS']),
    toolsDeny: parseSet(env['DISCORD_MCP_TOOLS_DENY']) ?? new Set(), // never null — empty means no denylist
    channelsAllow: parseSet(env['DISCORD_MCP_CHANNELS']),
    dryRun: parseBoolean(env['DISCORD_MCP_DRY_RUN'], false),
    auditLog: parseAuditLog(env['DISCORD_MCP_AUDIT_LOG']),
    confirmationToken: env['DISCORD_MCP_CONFIRM_TOKEN'] || false,
    transport: 'stdio', // only 'stdio' supported in v0.1; reserved for HTTP transport in v1.0
  }
}
