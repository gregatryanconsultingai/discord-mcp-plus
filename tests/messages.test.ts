import { describe, it, expect, vi } from 'vitest'
import { getMessages } from '../src/tools/messages.js'
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
