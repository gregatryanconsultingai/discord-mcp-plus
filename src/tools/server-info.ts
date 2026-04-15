import { GuildChannel } from 'discord.js'
import type { ToolDef } from '../registry.js'

export const getServerInfo: ToolDef = {
  name: 'get_server_info',
  description: 'Get metadata about a Discord server: name, member count, channel count, features, creation date. Example: "What server info do you have?"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: {
        type: 'string',
        description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.',
      },
    },
  },
  kind: 'read',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')

    const guild = await client.guilds.fetch(guildId)
    const channels = await guild.channels.fetch()

    return {
      id: guild.id,
      name: guild.name,
      description: guild.description ?? null,
      memberCount: guild.memberCount,
      channelCount: channels.size,
      createdAt: guild.createdAt.toISOString(),
      premiumTier: guild.premiumTier,
      features: guild.features,
    }
  },
}

export const listBotPermissions: ToolDef = {
  name: 'list_bot_permissions',
  description: 'List what permissions the bot has in the server or a specific channel. Useful for agents to self-check before attempting operations. Example: "What can the bot do in #general?"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: {
        type: 'string',
        description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.',
      },
      channelId: {
        type: 'string',
        description: 'Channel ID. When provided, returns effective permissions in that channel (including overrides).',
      },
    },
  },
  kind: 'read',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')

    const guild = await client.guilds.fetch(guildId)
    const me = guild.members.me ?? await guild.members.fetchMe()

    if (args['channelId']) {
      const channel = await client.channels.fetch(args['channelId'] as string)
      if (!channel || !(channel instanceof GuildChannel)) {
        throw new Error('Channel not found or not a guild channel')
      }
      const perms = channel.permissionsFor(me)
      if (!perms) throw new Error('Could not compute channel permissions')
      return {
        scope: 'channel',
        channelId: args['channelId'],
        permissions: perms.toArray(),
      }
    }

    const allPermNames = Object.keys(me.permissions.serialize())
    return {
      scope: 'guild',
      permissions: me.permissions.toArray(),
      missing: allPermNames.filter(p => !me.permissions.has(p as Parameters<typeof me.permissions.has>[0])),
    }
  },
}
