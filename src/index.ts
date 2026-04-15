import 'dotenv/config'
import { appendFile } from 'node:fs/promises'
import { loadConfig } from './config.js'
import { loginClient, getClient } from './discord-client.js'
import { ToolRegistry, type AuditSink } from './registry.js'
import { startServer } from './server.js'
import { getServerInfo, listBotPermissions } from './tools/server-info.js'

function createAuditSink(auditLog: string | false): AuditSink | undefined {
  if (auditLog === false) return undefined
  if (auditLog === 'stderr') return (line) => { process.stderr.write(line) }
  return async (line) => { await appendFile(auditLog, line) }
}

async function main(): Promise<void> {
  const config = loadConfig()

  await loginClient(config.token)
  const client = getClient()

  const registry = new ToolRegistry(config, createAuditSink(config.auditLog))

  registry.register(getServerInfo)
  registry.register(listBotPermissions)

  await startServer(registry, client)
}

main().catch(err => {
  console.error('[discord-mcp-plus] Fatal error:', err)
  process.exit(1)
})
