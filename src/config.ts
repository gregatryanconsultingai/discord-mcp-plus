export interface Config {
  token: string
  guildId: string | undefined
  readonly: boolean
  toolsAllow: Set<string> | null   // null = no allowlist (all tools visible)
  toolsDeny: Set<string>           // empty = no denylist
  channelsAllow: Set<string> | null // null = no channel restriction
  dryRun: boolean
  auditLog: string | false         // 'stderr', file path, or false (disabled)
  transport: 'stdio'
}

function parseBoolean(val: string | undefined, defaultVal: boolean): boolean {
  if (val === undefined) return defaultVal
  return val.toLowerCase() === 'true'
}

function parseSet(val: string | undefined): Set<string> | null {
  if (!val || val.trim() === '') return null
  return new Set(val.split(',').map(s => s.trim()).filter(Boolean))
}

function parseAuditLog(val: string | undefined): string | false {
  if (val === undefined) return 'stderr'
  if (val === 'off') return false
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
    toolsDeny: parseSet(env['DISCORD_MCP_TOOLS_DENY']) ?? new Set(),
    channelsAllow: parseSet(env['DISCORD_MCP_CHANNELS']),
    dryRun: parseBoolean(env['DISCORD_MCP_DRY_RUN'], false),
    auditLog: parseAuditLog(env['DISCORD_MCP_AUDIT_LOG']),
    transport: 'stdio',
  }
}
