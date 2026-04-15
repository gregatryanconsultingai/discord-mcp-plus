import type { ToolDef } from '../registry.js'

export const listGuilds: ToolDef = {
  name: 'list_guilds',
  description: 'List all Discord servers the bot is in. Example: "What servers is the bot in?"',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  kind: 'read',
  handler: async (_args, _config, client) => {
    const guilds = await client.guilds.fetch()
    return guilds.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL() ?? null,
    }))
  },
}

export const getGuild: ToolDef = {
  name: 'get_guild',
  description: 'Get detailed information about a Discord server. Example: "Tell me about this server"',
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
    return {
      id: guild.id,
      name: guild.name,
      description: guild.description,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      createdAt: guild.createdAt.toISOString(),
      icon: guild.iconURL() ?? null,
      premiumTier: guild.premiumTier,
    }
  },
}
