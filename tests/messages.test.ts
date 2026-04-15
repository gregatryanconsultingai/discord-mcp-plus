import { describe, it, expect, vi } from 'vitest'
import { getMessages, searchMessages } from '../src/tools/messages.js'
import type { Client } from 'discord.js'

function makePaginationClient(fetchSpy: ReturnType<typeof vi.fn>) {
  return {
    channels: {
      fetch: vi.fn().mockResolvedValue({
        isTextBased: () => true,
        messages: { fetch: fetchSpy },
      }),
    },
  } as unknown as Client
}

describe('getMessages pagination', () => {
  it('passes before param to messages.fetch', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ map: () => [] })
    const client = makePaginationClient(fetchSpy)
    await getMessages.handler({ channelId: '111', before: '999' }, {} as any, client)
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ before: '999' }))
  })

  it('passes after param to messages.fetch', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ map: () => [] })
    const client = makePaginationClient(fetchSpy)
    await getMessages.handler({ channelId: '111', after: '222' }, {} as any, client)
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ after: '222' }))
  })

  it('omits before/after when not provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ map: () => [] })
    const client = makePaginationClient(fetchSpy)
    await getMessages.handler({ channelId: '111' }, {} as any, client)
    const callArg = fetchSpy.mock.calls[0]![0]
    expect(callArg.before).toBeUndefined()
    expect(callArg.after).toBeUndefined()
  })
})

describe('searchMessages', () => {
  it('calls REST search endpoint and maps response correctly', async () => {
    const getSpy = vi.fn().mockResolvedValue({
      total_results: 1,
      messages: [[{
        id: '100',
        channel_id: '200',
        author: { id: '300', username: 'alice' },
        content: 'hello world',
        timestamp: '2024-01-01T00:00:00.000Z',
      }]],
    })
    const client = { rest: { get: getSpy } } as unknown as Client

    const result = await searchMessages.handler(
      { guildId: '999', content: 'hello' },
      {} as any,
      client,
    ) as any

    expect(getSpy).toHaveBeenCalledWith(
      '/guilds/999/messages/search',
      expect.objectContaining({ query: expect.objectContaining({ content: 'hello' }) }),
    )
    expect(result.totalResults).toBe(1)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].id).toBe('100')
    expect(result.messages[0].channelId).toBe('200')
    expect(result.messages[0].author.username).toBe('alice')
    expect(result.messages[0].content).toBe('hello world')
  })

  it('uses config.guildId when guildId arg is absent', async () => {
    const getSpy = vi.fn().mockResolvedValue({ total_results: 0, messages: [] })
    const client = { rest: { get: getSpy } } as unknown as Client
    await searchMessages.handler({ content: 'test' }, { guildId: 'cfg-guild' } as any, client)
    expect(getSpy).toHaveBeenCalledWith('/guilds/cfg-guild/messages/search', expect.anything())
  })

  it('throws when no guildId is available', async () => {
    const client = { rest: { get: vi.fn() } } as unknown as Client
    await expect(
      searchMessages.handler({}, {} as any, client)
    ).rejects.toThrow('guildId is required')
  })

  it('includes optional channelId and authorId in query', async () => {
    const getSpy = vi.fn().mockResolvedValue({ total_results: 0, messages: [] })
    const client = { rest: { get: getSpy } } as unknown as Client
    await searchMessages.handler(
      { guildId: '999', channelId: '111', authorId: '222' },
      {} as any,
      client,
    )
    expect(getSpy).toHaveBeenCalledWith(
      '/guilds/999/messages/search',
      expect.objectContaining({
        query: expect.objectContaining({ channel_id: '111', author_id: '222' }),
      }),
    )
  })
})
