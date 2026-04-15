import type { TextBasedChannel } from 'discord.js'
import type { ToolDef } from '../registry.js'

export const sendMessageWithAttachment: ToolDef = {
  name: 'send_message_with_attachment',
  description: 'Send a message with a file attachment. Accepts a URL (bot will re-upload) or base64-encoded content. Example: "Send this image to #general"',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'The channel ID to send to' },
      content: { type: 'string', description: 'Optional message text to accompany the file' },
      url: { type: 'string', description: 'URL of the file to attach (mutually exclusive with base64)' },
      base64: { type: 'string', description: 'Base64-encoded file content (mutually exclusive with url)' },
      filename: { type: 'string', description: 'Filename for the attachment (required when using base64)' },
    },
    required: ['channelId'],
  },
  kind: 'write',
  handler: async (args, _config, client) => {
    const channel = await client.channels.fetch(args['channelId'] as string)
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not a text channel')

    const url = args['url'] as string | undefined
    const base64 = args['base64'] as string | undefined
    const filename = (args['filename'] as string | undefined) ?? 'attachment'
    const content = args['content'] as string | undefined

    if (!url && !base64) throw new Error('Either url or base64 must be provided')

    const file = base64
      ? { attachment: Buffer.from(base64, 'base64'), name: filename }
      : url!

    const msg = await (channel as any).send({
      content,
      files: [file],
    })

    return {
      id: msg.id,
      timestamp: msg.createdAt.toISOString(),
      attachments: msg.attachments.map((a: any) => ({
        id: a.id,
        url: a.url,
        filename: a.name,
        size: a.size,
      })),
    }
  },
}

export const getAttachmentContent: ToolDef = {
  name: 'get_attachment_content',
  description: 'Download an attachment and return its content as base64. Images are returned vision-ready with a data URI. Example: "Get the content of the image attached to message 123"',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: "The attachment URL (from a message's attachments list)" },
    },
    required: ['url'],
  },
  kind: 'read',
  handler: async (args, _config, _client) => {
    const url = args['url'] as string
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch attachment: ${response.status} ${response.statusText}`)

    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
    const isImage = contentType.startsWith('image/')

    return {
      url,
      contentType,
      size: buffer.byteLength,
      base64,
      dataUri: isImage ? `data:${contentType};base64,${base64}` : null,
    }
  },
}
