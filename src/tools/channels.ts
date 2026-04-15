import { ChannelType, GuildChannel } from 'discord.js'
import type { ToolDef } from '../registry.js'

const channelTypeMap: Record<string, ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildCategory> = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
}

export const listChannels: ToolDef = {
  name: 'list_channels',
  description: 'List all channels in a Discord server. Example: "What channels exist in this server?"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.' },
    },
  },
  kind: 'read',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')
    const guild = await client.guilds.fetch(guildId)
    const channels = await guild.channels.fetch()
    return channels
      .filter(c => c !== null)
      .map(c => ({
        id: c!.id,
        name: c!.name,
        type: c!.type,
        parentId: (c as GuildChannel).parentId ?? null,
      }))
  },
}

export const getChannel: ToolDef = {
  name: 'get_channel',
  description: 'Get information about a Discord channel. Example: "What type of channel is #general?"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The channel ID' },
    },
    required: ['channelId'],
  },
  kind: 'read',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel) throw new Error('Channel not found')
    return {
      id: channel.id,
      name: 'name' in channel ? (channel.name as string) : null,
      type: channel.type,
    }
  },
}

export const createChannel: ToolDef = {
  name: 'create_channel',
  description: 'Create a new channel in a Discord server. Example: "Create a text channel called #announcements"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.' },
      name: { type: 'string', description: 'The channel name' },
      type: { type: 'string', enum: ['text', 'voice', 'category'], description: 'Channel type (default: text)' },
    },
    required: ['name'],
  },
  kind: 'write',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')
    const guild = await client.guilds.fetch(guildId)
    const type = channelTypeMap[(args['type'] as string | undefined) ?? 'text'] ?? ChannelType.GuildText
    const channel = await guild.channels.create({ name: args['name'] as string, type })
    return { id: channel.id, name: channel.name, type: channel.type }
  },
}

export const deleteChannel: ToolDef = {
  name: 'delete_channel',
  description: 'Delete a Discord channel. Example: "Delete the #old-announcements channel"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The channel ID to delete' },
    },
    required: ['channelId'],
  },
  kind: 'destructive',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel) throw new Error('Channel not found')
    await (channel as GuildChannel).delete()
    return { success: true, deletedId: args['channelId'] }
  },
}
