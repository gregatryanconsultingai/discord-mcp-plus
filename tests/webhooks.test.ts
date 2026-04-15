import { describe, it, expect, vi } from 'vitest'
import type { Config } from '../src/config.js'

// vi.mock is hoisted above imports by vitest — WebhookClient is mocked before webhooks.ts loads
vi.mock('discord.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('discord.js')>()
  return {
    ...actual,
    WebhookClient: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({ id: 'msg789', channel_id: 'chan123' }),
      destroy: vi.fn(),
    })),
  }
})

import { createWebhook, listWebhooks, deleteWebhook, sendWebhookMessage } from '../src/tools/webhooks.js'

const baseConfig: Config = {
  token: 'tok',
  guildId: 'guild1',
  readonly: false,
  toolsAllow: null,
  toolsDeny: new Set(),
  channelsAllow: null,
  dryRun: false,
  auditLog: false,
  confirmationToken: false,
  transport: 'stdio',
  httpPort: 3000,
  httpToken: false,
}

const mockWebhookData = {
  id: 'wh1',
  name: 'MyWebhook',
  url: 'https://discord.com/api/webhooks/wh1/token',
  channelId: 'chan1',
  type: 1,
}

function makeClient(overrides: {
  channelCreateWebhook?: ReturnType<typeof vi.fn>
  channelFetchWebhooks?: ReturnType<typeof vi.fn>
  guildFetchWebhooks?: ReturnType<typeof vi.fn>
  fetchWebhook?: ReturnType<typeof vi.fn>
} = {}) {
  return {
    channels: {
      fetch: vi.fn().mockResolvedValue({
        createWebhook: overrides.channelCreateWebhook ?? vi.fn().mockResolvedValue(mockWebhookData),
        fetchWebhooks: overrides.channelFetchWebhooks ?? vi.fn().mockResolvedValue(
          new Map([['wh1', mockWebhookData]])
        ),
      }),
    },
    guilds: {
      fetch: vi.fn().mockResolvedValue({
        fetchWebhooks: overrides.guildFetchWebhooks ?? vi.fn().mockResolvedValue(
          new Map([['wh1', mockWebhookData]])
        ),
      }),
    },
    fetchWebhook: overrides.fetchWebhook ?? vi.fn().mockResolvedValue({
      id: 'wh1',
      delete: vi.fn().mockResolvedValue(undefined),
    }),
  } as any
}

describe('create_webhook', () => {
  it('calls channel.createWebhook and returns correct shape', async () => {
    const client = makeClient()
    const result = await createWebhook.handler(
      { channelId: 'chan1', name: 'MyWebhook' },
      baseConfig,
      client
    ) as any
    expect(client.channels.fetch).toHaveBeenCalledWith('chan1')
    expect(result).toEqual({
      id: 'wh1',
      name: 'MyWebhook',
      url: mockWebhookData.url,
      channelId: 'chan1',
    })
  })
})

describe('list_webhooks', () => {
  it('uses channel.fetchWebhooks when channelId is provided', async () => {
    const client = makeClient()
    const result = await listWebhooks.handler({ channelId: 'chan1' }, baseConfig, client) as any
    expect(client.channels.fetch).toHaveBeenCalledWith('chan1')
    expect(result.webhooks).toHaveLength(1)
    expect(result.webhooks[0].id).toBe('wh1')
    expect(result.webhooks[0].type).toBe('incoming')
  })

  it('uses guild.fetchWebhooks when no channelId is provided', async () => {
    const client = makeClient()
    const result = await listWebhooks.handler({}, baseConfig, client) as any
    expect(client.guilds.fetch).toHaveBeenCalledWith('guild1')
    expect(result.webhooks).toHaveLength(1)
  })

  it('throws when no channelId and no guildId available', async () => {
    const client = makeClient()
    const configNoGuild = { ...baseConfig, guildId: undefined }
    await expect(
      listWebhooks.handler({}, configNoGuild, client)
    ).rejects.toThrow('guildId')
  })
})

describe('delete_webhook', () => {
  it('fetches webhook by ID then calls delete()', async () => {
    const deleteSpy = vi.fn().mockResolvedValue(undefined)
    const client = makeClient({
      fetchWebhook: vi.fn().mockResolvedValue({ id: 'wh1', delete: deleteSpy }),
    })
    const result = await deleteWebhook.handler({ webhookId: 'wh1' }, baseConfig, client) as any
    expect(client.fetchWebhook).toHaveBeenCalledWith('wh1')
    expect(deleteSpy).toHaveBeenCalled()
    expect(result).toEqual({ success: true, deletedId: 'wh1' })
  })
})

describe('send_webhook_message', () => {
  it('constructs WebhookClient with URL and calls send()', async () => {
    const { WebhookClient } = await import('discord.js')
    const client = makeClient()
    const result = await sendWebhookMessage.handler(
      { webhookUrl: 'https://discord.com/api/webhooks/123/token', content: 'Hello!' },
      baseConfig,
      client
    ) as any
    expect(WebhookClient).toHaveBeenCalledWith({ url: 'https://discord.com/api/webhooks/123/token' })
    expect(result.messageId).toBe('msg789')
  })

  it('forwards username and avatarUrl to webhookClient.send()', async () => {
    const { WebhookClient } = await import('discord.js')
    // Reset call tracking from previous test
    vi.mocked(WebhookClient).mockClear()
    const sendSpy = vi.fn().mockResolvedValue({ id: 'msg999', channel_id: 'chan456' })
    vi.mocked(WebhookClient).mockImplementationOnce(() => ({ send: sendSpy, destroy: vi.fn() }) as any)

    const client = makeClient()
    await sendWebhookMessage.handler(
      {
        webhookUrl: 'https://discord.com/api/webhooks/123/token',
        content: 'Hello!',
        username: 'BotOverride',
        avatarUrl: 'https://example.com/avatar.png',
      },
      baseConfig,
      client
    )
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'BotOverride', avatarURL: 'https://example.com/avatar.png' })
    )
  })
})
