import { describe, it, expect, vi } from 'vitest'
import { ToolRegistry } from '../src/registry.js'
import type { Config } from '../src/config.js'
import type { ToolDef } from '../src/registry.js'
import type { Client } from 'discord.js'

const baseConfig: Config = {
  token: 'tok',
  guildId: undefined,
  readonly: false,
  toolsAllow: null,
  toolsDeny: new Set(),
  channelsAllow: null,
  dryRun: false,
  auditLog: false,
  transport: 'stdio',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockClient = {} as Client

function makeTool(name: string, kind: ToolDef['kind']): ToolDef {
  return {
    name,
    description: `Test tool ${name}`,
    inputSchema: { type: 'object', properties: {} },
    kind,
    handler: async () => ({ ok: true }),
  }
}

describe('ToolRegistry.listVisible', () => {
  it('returns all tools when no restrictions', () => {
    const registry = new ToolRegistry(baseConfig)
    registry.register(makeTool('read_thing', 'read'))
    registry.register(makeTool('write_thing', 'write'))
    registry.register(makeTool('delete_thing', 'destructive'))
    const names = registry.listVisible().map(t => t.name)
    expect(names).toContain('read_thing')
    expect(names).toContain('write_thing')
    expect(names).toContain('delete_thing')
  })

  it('hides write tools when readonly=true', () => {
    const registry = new ToolRegistry({ ...baseConfig, readonly: true })
    registry.register(makeTool('read_thing', 'read'))
    registry.register(makeTool('write_thing', 'write'))
    const names = registry.listVisible().map(t => t.name)
    expect(names).toContain('read_thing')
    expect(names).not.toContain('write_thing')
  })

  it('hides destructive tools when readonly=true', () => {
    const registry = new ToolRegistry({ ...baseConfig, readonly: true })
    registry.register(makeTool('read_thing', 'read'))
    registry.register(makeTool('delete_thing', 'destructive'))
    const names = registry.listVisible().map(t => t.name)
    expect(names).toContain('read_thing')
    expect(names).not.toContain('delete_thing')
  })

  it('filters to only allowed tools when toolsAllow is set', () => {
    const registry = new ToolRegistry({ ...baseConfig, toolsAllow: new Set(['read_thing']) })
    registry.register(makeTool('read_thing', 'read'))
    registry.register(makeTool('write_thing', 'write'))
    expect(registry.listVisible().map(t => t.name)).toEqual(['read_thing'])
  })

  it('excludes denied tools', () => {
    const registry = new ToolRegistry({ ...baseConfig, toolsDeny: new Set(['write_thing']) })
    registry.register(makeTool('read_thing', 'read'))
    registry.register(makeTool('write_thing', 'write'))
    const names = registry.listVisible().map(t => t.name)
    expect(names).toContain('read_thing')
    expect(names).not.toContain('write_thing')
  })

  it('deny takes precedence over allow', () => {
    const registry = new ToolRegistry({
      ...baseConfig,
      toolsAllow: new Set(['read_thing', 'write_thing']),
      toolsDeny: new Set(['write_thing']),
    })
    registry.register(makeTool('read_thing', 'read'))
    registry.register(makeTool('write_thing', 'write'))
    expect(registry.listVisible().map(t => t.name)).toEqual(['read_thing'])
  })
})

describe('ToolRegistry.call', () => {
  it('calls handler and returns result', async () => {
    const registry = new ToolRegistry(baseConfig)
    registry.register(makeTool('read_thing', 'read'))
    const result = await registry.call('read_thing', {}, mockClient)
    expect(result).toEqual({ ok: true })
  })

  it('throws for unknown tool', async () => {
    const registry = new ToolRegistry(baseConfig)
    await expect(registry.call('unknown', {}, mockClient)).rejects.toThrow('Unknown tool: unknown')
  })

  it('throws when calling a tool hidden by readonly', async () => {
    const registry = new ToolRegistry({ ...baseConfig, readonly: true })
    registry.register(makeTool('write_thing', 'write'))
    await expect(registry.call('write_thing', {}, mockClient)).rejects.toThrow('Tool not available: write_thing')
  })

  it('rejects write to non-allowlisted channel', async () => {
    const registry = new ToolRegistry({ ...baseConfig, channelsAllow: new Set(['allowed-ch']) })
    registry.register(makeTool('write_thing', 'write'))
    await expect(
      registry.call('write_thing', { channelId: 'other-ch' }, mockClient)
    ).rejects.toThrow('Channel other-ch is not in the allowed channel list')
  })

  it('allows write to allowlisted channel', async () => {
    const registry = new ToolRegistry({ ...baseConfig, channelsAllow: new Set(['allowed-ch']) })
    registry.register(makeTool('write_thing', 'write'))
    const result = await registry.call('write_thing', { channelId: 'allowed-ch' }, mockClient)
    expect(result).toEqual({ ok: true })
  })

  it('allows write when channelId is absent from args even if channelsAllow is set', async () => {
    const registry = new ToolRegistry({ ...baseConfig, channelsAllow: new Set(['allowed-ch']) })
    registry.register(makeTool('write_thing', 'write'))
    // Tool without channelId arg — channel allowlist does not apply
    const result = await registry.call('write_thing', {}, mockClient)
    expect(result).toEqual({ ok: true })
  })

  it('writes audit log entry after successful write tool call', async () => {
    const auditLines: string[] = []
    const registry = new ToolRegistry(baseConfig, (line) => { auditLines.push(line) })
    registry.register(makeTool('write_thing', 'write'))
    await registry.call('write_thing', { channelId: '123' }, mockClient)
    expect(auditLines).toHaveLength(1)
    const entry = JSON.parse(auditLines[0]!)
    expect(entry.tool).toBe('write_thing')
    expect(entry.kind).toBe('write')
    expect(entry.result).toBe('ok')
    expect(typeof entry.ts).toBe('string')
    expect(typeof entry.durationMs).toBe('number')
    expect(entry.args).toEqual({ channelId: '123' })
  })

  it('writes audit log entry with result=error when handler throws', async () => {
    const auditLines: string[] = []
    const registry = new ToolRegistry(baseConfig, (line) => { auditLines.push(line) })
    const failTool: ToolDef = {
      ...makeTool('write_thing', 'write'),
      handler: async () => { throw new Error('oops') },
    }
    registry.register(failTool)
    await expect(registry.call('write_thing', {}, mockClient)).rejects.toThrow('oops')
    expect(auditLines).toHaveLength(1)
    const entry = JSON.parse(auditLines[0]!)
    expect(entry.result).toBe('error')
    expect(entry.error).toBe('oops')
  })

  it('does not write audit log for read tool calls', async () => {
    const auditLines: string[] = []
    const registry = new ToolRegistry(baseConfig, (line) => { auditLines.push(line) })
    registry.register(makeTool('read_thing', 'read'))
    await registry.call('read_thing', {}, mockClient)
    expect(auditLines).toHaveLength(0)
  })
})
