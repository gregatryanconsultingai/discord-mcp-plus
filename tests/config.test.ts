import { describe, it, expect } from 'vitest'
import { loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('throws when DISCORD_TOKEN is missing', () => {
    expect(() => loadConfig({})).toThrow('DISCORD_TOKEN is required')
  })

  it('applies all defaults when only token is set', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok' })
    expect(config.token).toBe('tok')
    expect(config.guildId).toBeUndefined()
    expect(config.readonly).toBe(false)
    expect(config.toolsAllow).toBeNull()
    expect(config.toolsDeny).toEqual(new Set())
    expect(config.channelsAllow).toBeNull()
    expect(config.dryRun).toBe(false)
    expect(config.auditLog).toBe('stderr')
    expect(config.transport).toBe('stdio')
  })

  it('parses DISCORD_MCP_READONLY=true', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_READONLY: 'true' })
    expect(config.readonly).toBe(true)
  })

  it('parses DISCORD_MCP_READONLY=TRUE (case insensitive)', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_READONLY: 'TRUE' })
    expect(config.readonly).toBe(true)
  })

  it('treats non-true values as false for booleans', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_READONLY: 'yes' })
    expect(config.readonly).toBe(false)
  })

  it('parses comma-separated tool allowlist, trimming whitespace', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_TOOLS: 'foo,bar, baz' })
    expect(config.toolsAllow).toEqual(new Set(['foo', 'bar', 'baz']))
  })

  it('returns null toolsAllow for empty string', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_TOOLS: '' })
    expect(config.toolsAllow).toBeNull()
  })

  it('parses tool denylist', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_TOOLS_DENY: 'delete_channel,ban_member' })
    expect(config.toolsDeny).toEqual(new Set(['delete_channel', 'ban_member']))
  })

  it('returns empty Set toolsDeny when not set', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok' })
    expect(config.toolsDeny).toEqual(new Set())
  })

  it('parses channel allowlist', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_CHANNELS: '111,222' })
    expect(config.channelsAllow).toEqual(new Set(['111', '222']))
  })

  it('sets auditLog to false when DISCORD_MCP_AUDIT_LOG=off', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_AUDIT_LOG: 'off' })
    expect(config.auditLog).toBe(false)
  })

  it('sets auditLog to file path when path specified', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_AUDIT_LOG: '/var/log/discord-mcp.log' })
    expect(config.auditLog).toBe('/var/log/discord-mcp.log')
  })

  it('sets auditLog to stderr when DISCORD_MCP_AUDIT_LOG=stderr', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_AUDIT_LOG: 'stderr' })
    expect(config.auditLog).toBe('stderr')
  })

  it('uses DISCORD_GUILD_ID when set', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_GUILD_ID: 'guild123' })
    expect(config.guildId).toBe('guild123')
  })

  it('returns null toolsAllow when all entries are whitespace', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_TOOLS: ', , ,' })
    expect(config.toolsAllow).toBeNull()
  })

  it('treats empty string DISCORD_MCP_READONLY as false', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_READONLY: '' })
    expect(config.readonly).toBe(false)
  })

  it('treats empty string DISCORD_GUILD_ID as undefined', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_GUILD_ID: '' })
    expect(config.guildId).toBeUndefined()
  })
})

describe('confirmationToken', () => {
  it('parses DISCORD_MCP_CONFIRM_TOKEN when set', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_CONFIRM_TOKEN: 'mysecret' })
    expect(config.confirmationToken).toBe('mysecret')
  })

  it('defaults confirmationToken to false when not set', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok' })
    expect(config.confirmationToken).toBe(false)
  })
})

describe('http transport config', () => {
  it('transport defaults to stdio when DISCORD_MCP_TRANSPORT is not set', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok' })
    expect(config.transport).toBe('stdio')
  })

  it('parses DISCORD_MCP_TRANSPORT=http', () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'tok',
      DISCORD_MCP_TRANSPORT: 'http',
      DISCORD_MCP_HTTP_TOKEN: 'secret',
    })
    expect(config.transport).toBe('http')
  })

  it('httpPort defaults to 3000; custom value parses correctly', () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'tok',
      DISCORD_MCP_TRANSPORT: 'http',
      DISCORD_MCP_HTTP_TOKEN: 'secret',
      DISCORD_MCP_HTTP_PORT: '8080',
    })
    expect(config.httpPort).toBe(8080)

    const defaultConfig = loadConfig({
      DISCORD_TOKEN: 'tok',
      DISCORD_MCP_TRANSPORT: 'http',
      DISCORD_MCP_HTTP_TOKEN: 'secret',
    })
    expect(defaultConfig.httpPort).toBe(3000)
  })

  it('throws when transport=http and DISCORD_MCP_HTTP_TOKEN is not set', () => {
    expect(() =>
      loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_MCP_TRANSPORT: 'http' })
    ).toThrow('DISCORD_MCP_HTTP_TOKEN is required')
  })
})
