import { describe, it, expect, vi } from 'vitest'
import type { Config } from '../src/config.js'
import { addReaction, removeReaction, removeUserReaction, removeAllReactions, getReactions } from '../src/tools/reactions.js'

const baseConfig: Config = {
  token: 'tok',
  guildId: undefined,
  readonly: false,
  toolsAllow: null,
  toolsDeny: new Set(),
  channelsAllow: null,
  dryRun: false,
  auditLog: false,
  confirmationToken: false,
  transport: 'stdio',
}

function makeClient(opts: {
  react?: () => Promise<unknown>
  resolve?: (emoji: string) => unknown
  removeAll?: () => Promise<unknown>
} = {}) {
  const react = opts.react ?? vi.fn().mockResolvedValue(undefined)
  const resolve = opts.resolve ?? vi.fn().mockReturnValue(null)
  const removeAll = opts.removeAll ?? vi.fn().mockResolvedValue(undefined)
  return {
    channels: {
      fetch: vi.fn().mockResolvedValue({
        isTextBased: () => true,
        messages: {
          fetch: vi.fn().mockResolvedValue({
            id: 'msg123',
            react,
            reactions: { resolve, removeAll },
          }),
        },
      }),
    },
  } as any
}

describe('add_reaction', () => {
  it('calls message.react and returns correct shape', async () => {
    const reactSpy = vi.fn().mockResolvedValue(undefined)
    const client = makeClient({ react: reactSpy })
    const result = await addReaction.handler(
      { channelId: 'ch1', messageId: 'msg123', emoji: '👍' },
      baseConfig,
      client
    )
    expect(reactSpy).toHaveBeenCalledWith('👍')
    expect(result).toEqual({ success: true, emoji: '👍', messageId: 'msg123' })
  })
})

describe('remove_reaction', () => {
  it('calls reaction.users.remove() with no userId', async () => {
    const removeSpy = vi.fn().mockResolvedValue(undefined)
    const client = makeClient({
      resolve: vi.fn().mockReturnValue({ users: { remove: removeSpy } }),
    })
    const result = await removeReaction.handler(
      { channelId: 'ch1', messageId: 'msg123', emoji: '👍' },
      baseConfig,
      client
    )
    expect(removeSpy).toHaveBeenCalledWith()
    expect(result).toEqual({ success: true })
  })
})

describe('remove_user_reaction', () => {
  it('calls reaction.users.remove(userId)', async () => {
    const removeSpy = vi.fn().mockResolvedValue(undefined)
    const client = makeClient({
      resolve: vi.fn().mockReturnValue({ users: { remove: removeSpy } }),
    })
    const result = await removeUserReaction.handler(
      { channelId: 'ch1', messageId: 'msg123', emoji: '👍', userId: 'user456' },
      baseConfig,
      client
    )
    expect(removeSpy).toHaveBeenCalledWith('user456')
    expect(result).toEqual({ success: true })
  })
})

describe('remove_all_reactions', () => {
  it('calls message.reactions.removeAll() and returns correct shape', async () => {
    const removeAllSpy = vi.fn().mockResolvedValue(undefined)
    const client = makeClient({ removeAll: removeAllSpy })
    const result = await removeAllReactions.handler(
      { channelId: 'ch1', messageId: 'msg123' },
      baseConfig,
      client
    )
    expect(removeAllSpy).toHaveBeenCalled()
    expect(result).toEqual({ success: true, messageId: 'msg123' })
  })
})

describe('get_reactions', () => {
  it('fetches users and returns mapped shape', async () => {
    const mockUsers = new Map([
      ['user1', { id: 'user1', username: 'alice' }],
      ['user2', { id: 'user2', username: 'bob' }],
    ])
    const fetchSpy = vi.fn().mockResolvedValue(mockUsers)
    const client = makeClient({
      resolve: vi.fn().mockReturnValue({ count: 2, users: { fetch: fetchSpy } }),
    })
    const result = await getReactions.handler(
      { channelId: 'ch1', messageId: 'msg123', emoji: '👍' },
      baseConfig,
      client
    ) as any
    expect(fetchSpy).toHaveBeenCalledWith({ limit: 100 })
    expect(result.emoji).toBe('👍')
    expect(result.count).toBe(2)
    expect(result.users).toEqual([
      { id: 'user1', username: 'alice' },
      { id: 'user2', username: 'bob' },
    ])
  })

  it('throws when emoji has no reactions on the message', async () => {
    const client = makeClient({ resolve: vi.fn().mockReturnValue(null) })
    await expect(
      getReactions.handler(
        { channelId: 'ch1', messageId: 'msg123', emoji: '🚀' },
        baseConfig,
        client
      )
    ).rejects.toThrow('🚀')
  })
})
