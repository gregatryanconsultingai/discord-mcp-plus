import type { Client } from 'discord.js'
import type { Config } from '../config.js'
import type { ToolDef } from '../registry.js'

async function fetchMessage(client: Client, channelId: string, messageId: string) {
  const channel = await client.channels.fetch(channelId)
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Channel ${channelId} not found or is not a text channel`)
  }
  return channel.messages.fetch(messageId)
}

// discord.js caches reactions by emoji ID (custom emoji) or Unicode character (standard emoji).
// When emoji is passed as name:id (e.g. party_blob:123456789), extract the ID for cache lookup.
function resolveEmoji(emoji: string): string {
  const colonIdx = emoji.lastIndexOf(':')
  return colonIdx !== -1 ? emoji.slice(colonIdx + 1) : emoji
}

export const addReaction: ToolDef = {
  name: 'add_reaction',
  description: 'Add an emoji reaction to a message. Accepts Unicode emoji (👍) or custom guild emoji as name:id (party_blob:123456789).',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'Channel containing the message' },
      messageId: { type: 'string', description: 'ID of the message to react to' },
      emoji: { type: 'string', description: 'Emoji to react with — Unicode (👍) or custom name:id (party_blob:123456789)' },
    },
    required: ['channelId', 'messageId', 'emoji'],
  },
  kind: 'write',
  async handler(args, _config, client) {
    const { channelId, messageId, emoji } = args as { channelId: string; messageId: string; emoji: string }
    const message = await fetchMessage(client, channelId, messageId)
    await message.react(emoji)
    return { success: true, emoji, messageId }
  },
}

export const removeReaction: ToolDef = {
  name: 'remove_reaction',
  description: "Remove the bot's own reaction from a message.",
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'Channel containing the message' },
      messageId: { type: 'string', description: 'ID of the message' },
      emoji: { type: 'string', description: 'Emoji to remove' },
    },
    required: ['channelId', 'messageId', 'emoji'],
  },
  kind: 'write',
  async handler(args, _config, client) {
    const { channelId, messageId, emoji } = args as { channelId: string; messageId: string; emoji: string }
    const message = await fetchMessage(client, channelId, messageId)
    const reaction = message.reactions.resolve(resolveEmoji(emoji))
    if (!reaction) throw new Error(`No reaction found for emoji: ${emoji}`)
    await reaction.users.remove()
    return { success: true }
  },
}

export const removeUserReaction: ToolDef = {
  name: 'remove_user_reaction',
  description: "Remove a specific user's reaction from a message. Requires MANAGE_MESSAGES permission.",
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'Channel containing the message' },
      messageId: { type: 'string', description: 'ID of the message' },
      emoji: { type: 'string', description: 'Emoji to remove' },
      userId: { type: 'string', description: "ID of the user whose reaction to remove" },
    },
    required: ['channelId', 'messageId', 'emoji', 'userId'],
  },
  kind: 'destructive',
  async handler(args, _config, client) {
    const { channelId, messageId, emoji, userId } = args as {
      channelId: string; messageId: string; emoji: string; userId: string
    }
    const message = await fetchMessage(client, channelId, messageId)
    const reaction = message.reactions.resolve(resolveEmoji(emoji))
    if (!reaction) throw new Error(`No reaction found for emoji: ${emoji}`)
    await reaction.users.remove(userId)
    return { success: true }
  },
}

export const removeAllReactions: ToolDef = {
  name: 'remove_all_reactions',
  description: 'Remove all reactions from a message. Requires MANAGE_MESSAGES permission.',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'Channel containing the message' },
      messageId: { type: 'string', description: 'ID of the message to clear reactions from' },
    },
    required: ['channelId', 'messageId'],
  },
  kind: 'destructive',
  async handler(args, _config, client) {
    const { channelId, messageId } = args as { channelId: string; messageId: string }
    const message = await fetchMessage(client, channelId, messageId)
    await message.reactions.removeAll()
    return { success: true, messageId }
  },
}

export const getReactions: ToolDef = {
  name: 'get_reactions',
  description: 'List users who reacted to a message with a specific emoji.',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'Channel containing the message' },
      messageId: { type: 'string', description: 'ID of the message' },
      emoji: { type: 'string', description: 'Emoji to get reactions for' },
      limit: { type: 'number', description: 'Max users to return (default 100, max 100)' },
    },
    required: ['channelId', 'messageId', 'emoji'],
  },
  kind: 'read',
  async handler(args, _config, client) {
    const { channelId, messageId, emoji, limit = 100 } = args as {
      channelId: string; messageId: string; emoji: string; limit?: number
    }
    const message = await fetchMessage(client, channelId, messageId)
    const reaction = message.reactions.resolve(resolveEmoji(emoji))
    if (!reaction) throw new Error(`No reactions found for emoji: ${emoji} on message ${messageId}`)
    const users = await reaction.users.fetch({ limit: Math.min(limit, 100) })
    return {
      emoji,
      count: reaction.count,
      users: [...users.values()].map((u: any) => ({ id: u.id, username: u.username })),
    }
  },
}
