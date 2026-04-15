import { TextChannel } from 'discord.js'
import type { ToolDef } from '../registry.js'

export const listThreads: ToolDef = {
  name: 'list_threads',
  description: 'List active threads in a Discord text channel. Example: "What threads are open in #general?"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The parent channel ID' },
    },
    required: ['channelId'],
  },
  kind: 'read',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    // Note: excludes NewsChannel (announcement channels) which also support threads — v0.2 limitation
    if (!channel || !(channel instanceof TextChannel)) throw new Error('Channel not found or not a text channel')
    const result = await channel.threads.fetchActive()
    return result.threads.map(t => ({
      id: t.id,
      name: t.name,
      messageCount: t.messageCount,
      memberCount: t.memberCount,
      createdAt: t.createdAt?.toISOString() ?? null,
      archived: t.archived,
    }))
  },
}

export const createThread: ToolDef = {
  name: 'create_thread',
  description: 'Create a new thread in a Discord channel. Example: "Start a thread called \'Release Notes\' on message 123"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The parent channel ID' },
      name: { type: 'string', description: 'The thread name' },
      messageId: { type: 'string', description: 'Optional message ID to start the thread from' },
    },
    required: ['channelId', 'name'],
  },
  kind: 'write',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    // Note: excludes NewsChannel (announcement channels) which also support threads — v0.2 limitation
    if (!channel || !(channel instanceof TextChannel)) throw new Error('Channel not found or not a text channel')
    let thread
    if (args['messageId']) {
      const msg = await channel.messages.fetch(args['messageId'] as string)
      thread = await msg.startThread({ name: args['name'] as string })
    } else {
      thread = await channel.threads.create({ name: args['name'] as string })
    }
    return { id: thread.id, name: thread.name, createdAt: thread.createdAt?.toISOString() ?? null }
  },
}

export const getThreadMessages: ToolDef = {
  name: 'get_thread_messages',
  description: 'Get messages from a Discord thread. Example: "Show me the messages in thread 123"',
  inputSchema: {
    type: 'object',
    properties: {
      threadId: { type: 'string', description: 'The thread ID' },
      limit: { type: 'number', description: 'Number of messages to fetch (default: 50)' },
    },
    required: ['threadId'],
  },
  kind: 'read',
  handler: async (args, _config, client) => {
    const thread = await client.channels.fetch(args['threadId'] as string)
    if (!thread || !thread.isThread()) throw new Error('Thread not found')
    const msgs = await thread.messages.fetch({ limit: (args['limit'] as number | undefined) ?? 50 })
    return msgs.map(m => ({
      id: m.id,
      author: { id: m.author.id, username: m.author.username },
      content: m.content,
      timestamp: m.createdAt.toISOString(),
    }))
  },
}
