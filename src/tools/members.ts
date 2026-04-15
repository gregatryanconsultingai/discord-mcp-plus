import type { ToolDef } from '../registry.js'

export const listMembers: ToolDef = {
  name: 'list_members',
  description: 'List members in a Discord server. Example: "Who are the members of this server?"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.' },
      limit: { type: 'number', description: 'Number of members to fetch (default: 100, max: 1000)' },
    },
  },
  kind: 'read',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')
    const guild = await client.guilds.fetch(guildId)
    const members = await guild.members.list({ limit: (args['limit'] as number | undefined) ?? 100 })
    return members.map(m => ({
      id: m.id,
      username: m.user.username,
      displayName: m.displayName,
      roles: m.roles.cache.map(r => ({ id: r.id, name: r.name })),
      joinedAt: m.joinedAt?.toISOString() ?? null,
      bot: m.user.bot,
    }))
  },
}

export const getMember: ToolDef = {
  name: 'get_member',
  description: 'Get information about a specific server member. Example: "What roles does user 123 have?"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.' },
      userId: { type: 'string', description: 'The user ID' },
    },
    required: ['userId'],
  },
  kind: 'read',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')
    const guild = await client.guilds.fetch(guildId)
    const member = await guild.members.fetch(args['userId'] as string)
    return {
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
      roles: member.roles.cache.map(r => ({ id: r.id, name: r.name })),
      joinedAt: member.joinedAt?.toISOString() ?? null,
      bot: member.user.bot,
    }
  },
}

export const listRoles: ToolDef = {
  name: 'list_roles',
  description: 'List all roles in a Discord server. Example: "What roles exist in this server?"',
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
    const roles = await guild.roles.fetch()
    return roles.map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position,
      managed: r.managed,
    }))
  },
}

export const addRole: ToolDef = {
  name: 'add_role',
  description: 'Assign a role to a server member. Example: "Give user 123 the Moderator role"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.' },
      userId: { type: 'string', description: 'The user ID' },
      roleId: { type: 'string', description: 'The role ID to assign' },
    },
    required: ['userId', 'roleId'],
  },
  kind: 'write',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')
    const guild = await client.guilds.fetch(guildId)
    const member = await guild.members.fetch(args['userId'] as string)
    await member.roles.add(args['roleId'] as string)
    return { success: true, userId: args['userId'], roleId: args['roleId'] }
  },
}

export const removeRole: ToolDef = {
  name: 'remove_role',
  description: 'Remove a role from a server member. Example: "Remove the Moderator role from user 123"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.' },
      userId: { type: 'string', description: 'The user ID' },
      roleId: { type: 'string', description: 'The role ID to remove' },
    },
    required: ['userId', 'roleId'],
  },
  kind: 'write',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')
    const guild = await client.guilds.fetch(guildId)
    const member = await guild.members.fetch(args['userId'] as string)
    await member.roles.remove(args['roleId'] as string)
    return { success: true, userId: args['userId'], roleId: args['roleId'] }
  },
}

export const kickMember: ToolDef = {
  name: 'kick_member',
  description: 'Kick a member from the Discord server. Example: "Kick user 123 for spamming"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.' },
      userId: { type: 'string', description: 'The user ID to kick' },
      reason: { type: 'string', description: 'Reason for the kick (optional)' },
    },
    required: ['userId'],
  },
  kind: 'destructive',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')
    const guild = await client.guilds.fetch(guildId)
    await guild.members.kick(args['userId'] as string, args['reason'] as string | undefined)
    return { success: true, kickedId: args['userId'] }
  },
}

export const banMember: ToolDef = {
  name: 'ban_member',
  description: 'Ban a member from the Discord server. Example: "Ban user 123 for violating rules"',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'Server ID. Uses DISCORD_GUILD_ID env var as default if not provided.' },
      userId: { type: 'string', description: 'The user ID to ban' },
      reason: { type: 'string', description: 'Reason for the ban (optional)' },
    },
    required: ['userId'],
  },
  kind: 'destructive',
  handler: async (args, config, client) => {
    const guildId = (args['guildId'] as string | undefined) ?? config.guildId
    if (!guildId) throw new Error('guildId is required (or set DISCORD_GUILD_ID env var)')
    const guild = await client.guilds.fetch(guildId)
    await guild.members.ban(args['userId'] as string, { reason: args['reason'] as string | undefined })
    return { success: true, bannedId: args['userId'] }
  },
}
