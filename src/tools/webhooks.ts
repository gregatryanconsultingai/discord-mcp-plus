import { WebhookClient } from 'discord.js'
import type { Config } from '../config.js'
import type { ToolDef } from '../registry.js'

export const createWebhook: ToolDef = {
  name: 'create_webhook',
  description: 'Create a webhook in a text channel.',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'Channel to create the webhook in' },
      name: { type: 'string', description: 'Display name of the webhook' },
      avatarUrl: { type: 'string', description: 'URL of avatar image for the webhook (optional)' },
    },
    required: ['channelId', 'name'],
  },
  kind: 'write',
  async handler(args, _config, client) {
    const { channelId, name, avatarUrl } = args as { channelId: string; name: string; avatarUrl?: string }
    const channel = await client.channels.fetch(channelId) as any
    if (!channel) throw new Error(`Channel ${channelId} not found`)
    const webhook = await channel.createWebhook({ name, avatar: avatarUrl })
    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      channelId: webhook.channelId,
    }
  },
}

export const listWebhooks: ToolDef = {
  name: 'list_webhooks',
  description: 'List webhooks for a channel (if channelId provided) or the entire guild. Falls back to DISCORD_GUILD_ID config when guildId arg is omitted.',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'Channel to list webhooks for (optional — omit to list all guild webhooks)' },
      guildId: { type: 'string', description: 'Guild to list webhooks for (optional — falls back to DISCORD_GUILD_ID)' },
    },
    required: [],
  },
  kind: 'read',
  async handler(args, config, client) {
    const { channelId, guildId } = args as { channelId?: string; guildId?: string }
    const typeLabels: Record<number, string> = { 1: 'incoming', 2: 'channel_follower', 3: 'application' }

    let webhooks: Map<string, any>

    if (channelId) {
      const channel = await client.channels.fetch(channelId) as any
      if (!channel) throw new Error(`Channel ${channelId} not found`)
      webhooks = await channel.fetchWebhooks()
    } else {
      const resolvedGuildId = guildId || config.guildId
      if (!resolvedGuildId) {
        throw new Error('guildId is required when channelId is not provided — set DISCORD_GUILD_ID or pass guildId arg')
      }
      const guild = await client.guilds.fetch(resolvedGuildId)
      webhooks = await (guild as any).fetchWebhooks()
    }

    return {
      webhooks: [...webhooks.values()].map((w: any) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        channelId: w.channelId,
        type: typeLabels[w.type] ?? String(w.type),
      })),
    }
  },
}

export const deleteWebhook: ToolDef = {
  name: 'delete_webhook',
  description: 'Delete a webhook by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      webhookId: { type: 'string', description: 'ID of the webhook to delete' },
    },
    required: ['webhookId'],
  },
  kind: 'destructive',
  async handler(args, _config, client) {
    const { webhookId } = args as { webhookId: string }
    const webhook = await client.fetchWebhook(webhookId)
    await webhook.delete()
    return { success: true, deletedId: webhookId }
  },
}

export const sendWebhookMessage: ToolDef = {
  name: 'send_webhook_message',
  description: 'Send a message via a webhook URL. No bot token required — the URL is self-contained. Supports username and avatar overrides for CI/CD-style notifications.',
  inputSchema: {
    type: 'object',
    properties: {
      webhookUrl: { type: 'string', description: 'Full webhook URL including token' },
      content: { type: 'string', description: 'Message text to send' },
      username: { type: 'string', description: 'Override display name for this message (optional)' },
      avatarUrl: { type: 'string', description: 'Override avatar URL for this message (optional)' },
    },
    required: ['webhookUrl', 'content'],
  },
  kind: 'write',
  async handler(args, _config, _client) {
    const { webhookUrl, content, username, avatarUrl } = args as {
      webhookUrl: string; content: string; username?: string; avatarUrl?: string
    }
    const webhookClient = new WebhookClient({ url: webhookUrl })
    const msg = await webhookClient.send({ content, username, avatarURL: avatarUrl })
    return { messageId: msg.id, channelId: (msg as any).channel_id }
  },
}
