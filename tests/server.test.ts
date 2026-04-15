import { describe, it, expect, vi } from 'vitest'
import { handleHttpRequest } from '../src/server.js'
import type { Config } from '../src/config.js'

const httpConfig: Config = {
  token: 'tok',
  guildId: 'guild1',
  readonly: false,
  toolsAllow: null,
  toolsDeny: new Set(),
  channelsAllow: null,
  dryRun: false,
  auditLog: false,
  confirmationToken: false,
  transport: 'http',
  httpPort: 3000,
  httpToken: 'secret123',
}

function makeReq(headers: Record<string, string>, url: string) {
  return { headers, url } as any
}

function makeRes() {
  return { writeHead: vi.fn(), end: vi.fn(), headersSent: false } as any
}

function makeTransport() {
  return { handleRequest: vi.fn().mockResolvedValue(undefined) } as any
}

describe('handleHttpRequest', () => {
  it('returns 401 when Authorization header is missing', () => {
    const req = makeReq({}, '/mcp')
    const res = makeRes()
    const transport = makeTransport()

    handleHttpRequest(req, res, httpConfig, transport)

    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
    expect(transport.handleRequest).not.toHaveBeenCalled()
  })

  it('returns 401 when bearer token is wrong', () => {
    const req = makeReq({ authorization: 'Bearer wrongtoken' }, '/mcp')
    const res = makeRes()
    const transport = makeTransport()

    handleHttpRequest(req, res, httpConfig, transport)

    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
    expect(transport.handleRequest).not.toHaveBeenCalled()
  })

  it('delegates to transport.handleRequest when auth is valid and path is /mcp', () => {
    const req = makeReq({ authorization: 'Bearer secret123' }, '/mcp')
    const res = makeRes()
    const transport = makeTransport()

    handleHttpRequest(req, res, httpConfig, transport)

    expect(transport.handleRequest).toHaveBeenCalledWith(req, res)
  })

  it('returns 404 when path is not /mcp', () => {
    const req = makeReq({ authorization: 'Bearer secret123' }, '/other')
    const res = makeRes()
    const transport = makeTransport()

    handleHttpRequest(req, res, httpConfig, transport)

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object))
    expect(transport.handleRequest).not.toHaveBeenCalled()
  })
})
