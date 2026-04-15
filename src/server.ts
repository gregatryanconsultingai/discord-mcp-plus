import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Client } from 'discord.js'
import type { Config } from './config.js'
import type { ToolRegistry } from './registry.js'

export function createMcpServer(registry: ToolRegistry, client: Client): Server {
  const server = new Server(
    { name: 'discord-mcp-plus', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.listVisible().map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    try {
      const result = await registry.call(name, (args ?? {}) as Record<string, unknown>, client)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    } catch (error) {
      console.error(`[discord-mcp-plus] Tool error [${name}]:`, error)
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      }
    }
  })

  return server
}

export function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: Config,
  transport: StreamableHTTPServerTransport
): void {
  const authHeader = req.headers['authorization']
  if (!authHeader || authHeader !== `Bearer ${config.httpToken}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  if (req.url !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not Found' }))
    return
  }

  transport.handleRequest(req, res).catch((err: unknown) => {
    console.error('[discord-mcp-plus] Transport error:', err)
    if (!res.headersSent) {
      res.writeHead(500)
      res.end()
    }
  })
}

export async function startServer(registry: ToolRegistry, client: Client, config: Config): Promise<void> {
  if (config.transport === 'http') {
    const mcpServer = createMcpServer(registry, client)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() })
    await mcpServer.connect(transport)
    const httpServer = createServer((req, res) => handleHttpRequest(req, res, config, transport))
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject)
      httpServer.listen(config.httpPort, () => resolve())
    })
    console.error(`[discord-mcp-plus] HTTP transport listening on port ${config.httpPort}`)
    return
  }

  // stdio (default)
  const server = createMcpServer(registry, client)
  const stdioTransport = new StdioServerTransport()
  await server.connect(stdioTransport)
}
