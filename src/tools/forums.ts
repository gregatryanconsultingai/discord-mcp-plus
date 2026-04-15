import { ChannelType } from 'discord.js'
import type { ToolDef } from '../registry.js'

export const listForumPosts: ToolDef = {
  name: 'list_forum_posts',
  description: 'List active posts in a Discord forum channel. Example: "What posts are in the #feedback forum?"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The forum channel ID' },
    },
    required: ['channelId'],
  },
  kind: 'read',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel || channel.type !== ChannelType.GuildForum) {
      throw new Error('Channel not found or not a forum channel')
    }
    const result = await channel.threads.fetchActive()
    return result.threads.map(t => ({
      id: t.id,
      name: t.name,
      messageCount: t.messageCount,
      createdAt: t.createdAt?.toISOString() ?? null,
      archived: t.archived,
      tags: t.appliedTags,
    }))
  },
}

export const createForumPost: ToolDef = {
  name: 'create_forum_post',
  description: 'Create a new post in a Discord forum channel. Example: "Create a forum post titled \'Bug Report\' in #feedback"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The forum channel ID' },
      name: { type: 'string', description: 'The post title' },
      content: { type: 'string', description: 'The initial message content of the post' },
    },
    required: ['channelId', 'name', 'content'],
  },
  kind: 'write',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel || channel.type !== ChannelType.GuildForum) {
      throw new Error('Channel not found or not a forum channel')
    }
    const thread = await channel.threads.create({
      name: args['name'] as string,
      message: { content: args['content'] as string },
    })
    return {
      id: thread.id,
      name: thread.name,
      createdAt: thread.createdAt?.toISOString() ?? null,
    }
  },
}

export const readForumPost: ToolDef = {
  name: 'read_forum_post',
  description: 'Read messages from a Discord forum post. Example: "Show me the messages in forum post 123"',
  inputSchema: {
    type: 'object',
    properties: {
      postId: { type: 'string', description: 'The forum post (thread) ID' },
      limit: { type: 'number', description: 'Number of messages to fetch (default: 50)' },
    },
    required: ['postId'],
  },
  kind: 'read',
  handler: async (args, _config, client) => {
    const thread = await client.channels.fetch(args['postId'] as string)
    if (!thread || !thread.isThread()) throw new Error('Forum post not found')
    const msgs = await thread.messages.fetch({ limit: (args['limit'] as number | undefined) ?? 50 })
    return {
      id: thread.id,
      name: thread.name,
      messages: msgs.map(m => ({
        id: m.id,
        author: { id: m.author.id, username: m.author.username },
        content: m.content,
        timestamp: m.createdAt.toISOString(),
        attachments: m.attachments.map(a => ({
          id: a.id,
          url: a.url,
          filename: a.name,
          size: a.size,
          contentType: a.contentType ?? null,
        })),
      })),
    }
  },
}
