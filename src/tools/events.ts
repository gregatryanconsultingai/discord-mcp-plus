import crypto from 'node:crypto'
import type { Client } from 'discord.js'
import type { ToolDef } from '../registry.js'

interface IncomingMessage {
  id: string
  channelId: string
  author: { id: string; username: string }
  content: string
  createdAt: Date
}

type WaitResult =
  | { timedOut: false; message: { id: string; channelId: string; author: { id: string; username: string }; content: string; timestamp: string } }
  | { timedOut: true; message: null }

type Waiter = {
  resolve: (result: WaitResult) => void
  channelId: string
  userId?: string
  pattern?: RegExp
  timeoutHandle: ReturnType<typeof setTimeout>
}

const waiters = new Map<string, Waiter>()

function dispatch(msg: IncomingMessage): void {
  for (const [id, waiter] of waiters) {
    if (waiter.channelId !== msg.channelId) continue
    if (waiter.userId && waiter.userId !== msg.author.id) continue
    if (waiter.pattern && !waiter.pattern.test(msg.content)) continue
    clearTimeout(waiter.timeoutHandle)
    waiters.delete(id)
    waiter.resolve({
      timedOut: false,
      message: {
        id: msg.id,
        channelId: msg.channelId,
        author: { id: msg.author.id, username: msg.author.username },
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
      },
    })
    break
  }
}

export function initEventDispatcher(client: Client): void {
  client.on('messageCreate', (msg) => dispatch(msg))
}

// Exported for testing — bypasses the Discord client event system
export function _dispatchForTest(msg: IncomingMessage): void {
  dispatch(msg)
}

export const waitForMessage: ToolDef = {
  name: 'wait_for_message',
  description: 'Wait for a message matching filters to arrive in a channel. Returns the message or { timedOut: true } if none arrives in time. Example: "Wait for a reply from user 123 in #general"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The channel ID to listen in' },
      userId: { type: 'string', description: 'Only match messages from this user ID' },
      pattern: { type: 'string', description: 'Regular expression — only match messages whose content matches' },
      timeout: { type: 'number', description: 'Seconds to wait before giving up (default: 30, max: 300)' },
    },
    required: ['channelId'],
  },
  kind: 'read',
  handler: async (args, _config, _client) => {
    const channelId = args['channelId'] as string
    const userId = args['userId'] as string | undefined
    const patternStr = args['pattern'] as string | undefined
    const timeoutSecs = Math.min((args['timeout'] as number | undefined) ?? 30, 300)

    // Throws immediately for invalid regex — before registering the waiter
    const pattern = patternStr !== undefined ? new RegExp(patternStr) : undefined

    return new Promise<WaitResult>((resolve) => {
      const id = crypto.randomUUID()
      const timeoutHandle = setTimeout(() => {
        waiters.delete(id)
        resolve({ timedOut: true, message: null })
      }, timeoutSecs * 1000)

      waiters.set(id, { resolve, channelId, userId, pattern, timeoutHandle })
    })
  },
}
