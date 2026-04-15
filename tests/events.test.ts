import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitForMessage, _dispatchForTest, _clearWaitersForTest } from '../src/tools/events.js'
import type { Client } from 'discord.js'
import type { IncomingMessage } from '../src/tools/events.js'

const mockClient = {} as Client
const mockConfig = {} as any

function makeMsg(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    id: '1',
    channelId: 'ch1',
    author: { id: 'u1', username: 'alice' },
    content: 'hello',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('waitForMessage', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    _clearWaitersForTest()
    vi.useRealTimers()
  })

  it('resolves with message when matching message arrives', async () => {
    const promise = waitForMessage.handler({ channelId: 'ch1' }, mockConfig, mockClient) as Promise<any>
    _dispatchForTest(makeMsg())
    const result = await promise
    expect(result.timedOut).toBe(false)
    expect(result.message.id).toBe('1')
    expect(result.message.channelId).toBe('ch1')
    expect(result.message.author.username).toBe('alice')
    expect(result.message.content).toBe('hello')
    expect(result.message.timestamp).toBe('2024-01-01T00:00:00.000Z')
  })

  it('does not resolve for a message in a different channel', async () => {
    const promise = waitForMessage.handler({ channelId: 'ch1' }, mockConfig, mockClient) as Promise<any>
    _dispatchForTest(makeMsg({ channelId: 'ch2' }))
    vi.advanceTimersByTime(31000)
    const result = await promise
    expect(result.timedOut).toBe(true)
  })

  it('filters by userId — ignores non-matching user, resolves on match', async () => {
    const promise = waitForMessage.handler({ channelId: 'ch1', userId: 'u2' }, mockConfig, mockClient) as Promise<any>
    _dispatchForTest(makeMsg({ author: { id: 'u1', username: 'alice' } }))
    _dispatchForTest(makeMsg({ id: '2', author: { id: 'u2', username: 'bob' } }))
    const result = await promise
    expect(result.timedOut).toBe(false)
    expect(result.message.id).toBe('2')
  })

  it('filters by pattern — ignores non-matching content, resolves on match', async () => {
    const promise = waitForMessage.handler({ channelId: 'ch1', pattern: '^ping$' }, mockConfig, mockClient) as Promise<any>
    _dispatchForTest(makeMsg({ content: 'not a ping' }))
    _dispatchForTest(makeMsg({ id: '2', content: 'ping' }))
    const result = await promise
    expect(result.timedOut).toBe(false)
    expect(result.message.id).toBe('2')
  })

  it('throws immediately for invalid regex pattern', async () => {
    await expect(
      waitForMessage.handler({ channelId: 'ch1', pattern: '[invalid' }, mockConfig, mockClient)
    ).rejects.toThrow()
  })

  it('returns timedOut:true after timeout expires', async () => {
    const promise = waitForMessage.handler({ channelId: 'ch1', timeout: 10 }, mockConfig, mockClient) as Promise<any>
    vi.advanceTimersByTime(10001)
    const result = await promise
    expect(result.timedOut).toBe(true)
    expect(result.message).toBeNull()
  })

  it('caps timeout at 300 seconds regardless of input', async () => {
    const promise = waitForMessage.handler({ channelId: 'ch1', timeout: 999 }, mockConfig, mockClient) as Promise<any>
    vi.advanceTimersByTime(300001)
    const result = await promise
    expect(result.timedOut).toBe(true)
  })

  it('first matching waiter gets the message; second remains pending until timeout', async () => {
    const p1 = waitForMessage.handler({ channelId: 'ch1' }, mockConfig, mockClient) as Promise<any>
    const p2 = waitForMessage.handler({ channelId: 'ch1' }, mockConfig, mockClient) as Promise<any>
    _dispatchForTest(makeMsg())
    const r1 = await p1
    expect(r1.timedOut).toBe(false)
    vi.advanceTimersByTime(31000)
    const r2 = await p2
    expect(r2.timedOut).toBe(true)
  })
})
