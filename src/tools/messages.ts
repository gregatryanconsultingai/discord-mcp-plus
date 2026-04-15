import type { TextBasedChannel } from 'discord.js'
import type { ToolDef } from '../registry.js'

export const getMessages: ToolDef = {
  name: 'get_messages',
  description: 'Fetch recent messages from a Discord channel. Example: "Show me the last 20 messages in #general"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The channel ID to fetch messages from' },
      limit: { type: 'number', description: 'Number of messages to fetch (1-100, default: 50)' },
    },
    required: ['channelId'],
  },
  kind: 'read',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not a text channel')
    const msgs = await channel.messages.fetch({ limit: (args['limit'] as number | undefined) ?? 50 })
    return msgs.map(m => ({
      id: m.id,
      author: { id: m.author.id, username: m.author.username },
      content: m.content,
      timestamp: m.createdAt.toISOString(),
      editedAt: m.editedAt?.toISOString() ?? null,
    }))
  },
}

export const sendMessage: ToolDef = {
  name: 'send_message',
  description: 'Send a message to a Discord channel. Example: "Send \'hello\' to #general"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The channel ID to send to' },
      content: { type: 'string', description: 'The message content' },
    },
    required: ['channelId', 'content'],
  },
  kind: 'write',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not a text channel')
    const msg = await (channel as any).send(args['content'] as string)
    return { id: msg.id, content: msg.content, timestamp: msg.createdAt.toISOString() }
  },
}

export const editMessage: ToolDef = {
  name: 'edit_message',
  description: 'Edit a message previously sent by the bot. Example: "Edit message 123 in #general to say \'updated\'"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The channel ID' },
      messageId: { type: 'string', description: 'The message ID to edit' },
      content: { type: 'string', description: 'The new message content' },
    },
    required: ['channelId', 'messageId', 'content'],
  },
  kind: 'write',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not a text channel')
    const msg = await channel.messages.fetch(args['messageId'] as string)
    const edited = await msg.edit(args['content'] as string)
    return { id: edited.id, content: edited.content, editedAt: edited.editedAt?.toISOString() ?? null }
  },
}

export const deleteMessage: ToolDef = {
  name: 'delete_message',
  description: 'Delete a message from a Discord channel. Example: "Delete message 123 in #general"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The channel ID' },
      messageId: { type: 'string', description: 'The message ID to delete' },
    },
    required: ['channelId', 'messageId'],
  },
  kind: 'destructive',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not a text channel')
    const msg = await channel.messages.fetch(args['messageId'] as string)
    await msg.delete()
    return { success: true, deletedId: args['messageId'] }
  },
}
