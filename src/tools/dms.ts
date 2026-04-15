import type { ToolDef } from '../registry.js'

export const sendDm: ToolDef = {
  name: 'send_dm',
  description: 'Send a direct message to a Discord user. Example: "DM user 123 to say hello"',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'The user ID to DM' },
      content: { type: 'string', description: 'The message content' },
    },
    required: ['userId', 'content'],
  },
  kind: 'write',
  handler: async (args, _config, client) => {
    const user = await client.users.fetch(args['userId'] as string)
    const dm = await user.createDM()
    const msg = await dm.send(args['content'] as string)
    return { id: msg.id, content: msg.content, timestamp: msg.createdAt.toISOString() }
  },
}

export const getDmHistory: ToolDef = {
  name: 'get_dm_history',
  description: 'Fetch DM history with a Discord user. Only returns messages the bot has been part of. Example: "Show my DM history with user 123"',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'The user ID' },
      limit: { type: 'number', description: 'Number of messages to fetch (default: 50)' },
    },
    required: ['userId'],
  },
  kind: 'read',
  handler: async (args, _config, client) => {
    const user = await client.users.fetch(args['userId'] as string)
    const dm = await user.createDM()
    const msgs = await dm.messages.fetch({ limit: (args['limit'] as number | undefined) ?? 50 })
    return msgs.map(m => ({
      id: m.id,
      author: { id: m.author.id, username: m.author.username },
      content: m.content,
      timestamp: m.createdAt.toISOString(),
    }))
  },
}
