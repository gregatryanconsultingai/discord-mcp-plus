import type { TextBasedChannel } from 'discord.js'
import type { ToolDef } from '../registry.js'

export const getMessages: ToolDef = {
  name: 'get_messages',
  description: 'Fetch recent messages from a Discord channel. Supports cursor-based pagination via before/after message IDs. Example: "Show me the last 20 messages in #general"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The channel ID to fetch messages from' },
      limit: { type: 'number', description: 'Number of messages to fetch (1-100, default: 50)' },
      before: { type: 'string', description: 'Fetch messages before this message ID (cursor for backwards pagination)' },
      after: { type: 'string', description: 'Fetch messages after this message ID (cursor for forwards pagination)' },
    },
    required: ['channelId'],
  },
  kind: 'read',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not a text channel')
    const msgs = await channel.messages.fetch({
      limit: (args['limit'] as number | undefined) ?? 50,
      before: args['before'] as string | undefined,
      after: args['after'] as string | undefined,
    })
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

export const searchMessages: ToolDef = {
  name: 'search_messages',
  description: 'Search messages in a Discord guild using Discord\'s native search. Example: "Find messages containing \'deploy failed\' in #alerts"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'The guild ID to search in (falls back to GUILD_ID config)' },
      content: { type: 'string', description: 'Text to search for' },
      channelId: { type: 'string', description: 'Restrict results to this channel ID' },
      authorId: { type: 'string', description: 'Restrict results to messages from this user ID' },
      limit: { type: 'number', description: 'Number of results to return (default: 25, max: 25)' },
    },
    required: [],
  },
  kind: 'read',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required: provide it as an argument or set GUILD_ID in config')

    const query: Record<string, string> = {}
    if (args['content']) query['content'] = args['content'] as string
    if (args['channelId']) query['channel_id'] = args['channelId'] as string
    if (args['authorId']) query['author_id'] = args['authorId'] as string
    query['limit'] = String(Math.min((args['limit'] as number | undefined) ?? 25, 25))

    const result = await client.rest.get(`/guilds/${guildId}/messages/search`, { query } as any) as {
      total_results: number
      messages: Array<Array<{
        id: string
        channel_id: string
        author: { id: string; username: string }
        content: string
        timestamp: string
      }>>
    }

    return {
      totalResults: result.total_results,
      messages: result.messages.map(hit => {
        const msg = hit[0]!
        return {
          id: msg.id,
          channelId: msg.channel_id,
          author: { id: msg.author.id, username: msg.author.username },
          content: msg.content,
          timestamp: msg.timestamp,
        }
      }),
    }
  },
}
