import 'dotenv/config'
import { appendFile } from 'node:fs/promises'
import { loadConfig } from './config.js'
import { loginClient, getClient } from './discord-client.js'
import { ToolRegistry, type AuditSink } from './registry.js'
import { startServer } from './server.js'

// v0.1 tools
import { getServerInfo, listBotPermissions } from './tools/server-info.js'

// v0.2 tools
import { getMessages, sendMessage, editMessage, deleteMessage, searchMessages } from './tools/messages.js'
import { listChannels, getChannel, createChannel, deleteChannel } from './tools/channels.js'
import { listMembers, getMember, listRoles, addRole, removeRole, kickMember, banMember } from './tools/members.js'
import { listGuilds, getGuild } from './tools/guilds.js'
import { listThreads, createThread, getThreadMessages, archiveThread, addThreadMember, removeThreadMember } from './tools/threads.js'
import { sendDm, getDmHistory } from './tools/dms.js'
import { listForumPosts, createForumPost, readForumPost } from './tools/forums.js'
import { sendMessageWithAttachment, getAttachmentContent } from './tools/attachments.js'
import { initEventDispatcher, waitForMessage } from './tools/events.js'

function createAuditSink(auditLog: string | false): AuditSink | undefined {
  if (auditLog === false) return undefined
  if (auditLog === 'stderr') return (line) => { process.stderr.write(line) }
  return async (line) => { await appendFile(auditLog, line) }
}

async function main(): Promise<void> {
  const config = loadConfig()

  await loginClient(config.token)
  const client = getClient()
  initEventDispatcher(client)

  const registry = new ToolRegistry(config, createAuditSink(config.auditLog))

  // v0.1 tools
  registry.register(getServerInfo)
  registry.register(listBotPermissions)

  // v0.2 tools — messages
  registry.register(getMessages)
  registry.register(sendMessage)
  registry.register(editMessage)
  registry.register(deleteMessage)

  // v0.2 tools — channels
  registry.register(listChannels)
  registry.register(getChannel)
  registry.register(createChannel)
  registry.register(deleteChannel)

  // v0.2 tools — members & roles
  registry.register(listMembers)
  registry.register(getMember)
  registry.register(listRoles)
  registry.register(addRole)
  registry.register(removeRole)
  registry.register(kickMember)
  registry.register(banMember)

  // v0.2 tools — guilds
  registry.register(listGuilds)
  registry.register(getGuild)

  // v0.2 tools — threads
  registry.register(listThreads)
  registry.register(createThread)
  registry.register(getThreadMessages)

  // v0.2 tools — DMs
  registry.register(sendDm)
  registry.register(getDmHistory)

  // v0.3 tools — thread management
  registry.register(archiveThread)
  registry.register(addThreadMember)
  registry.register(removeThreadMember)

  // v0.3 tools — forums
  registry.register(listForumPosts)
  registry.register(createForumPost)
  registry.register(readForumPost)

  // v0.3 tools — attachments
  registry.register(sendMessageWithAttachment)
  registry.register(getAttachmentContent)

  // v0.4 tools — search & events
  registry.register(searchMessages)
  registry.register(waitForMessage)

  await startServer(registry, client, config)
}

main().catch(err => {
  console.error('[discord-mcp-plus] Fatal error:', err)
  process.exit(1)
})
