import { describe, it, expect } from 'vitest'
import { Writable } from 'node:stream'
import { printEnvTemplate } from '../src/init.js'

function captureOutput(): { stream: Writable; getOutput: () => string } {
  let output = ''
  const stream = new Writable({
    write(chunk, _enc, cb) {
      output += chunk.toString()
      cb()
    },
  })
  return { stream, getOutput: () => output }
}

describe('printEnvTemplate', () => {
  it('output contains all configuration variable names', () => {
    const { stream, getOutput } = captureOutput()
    printEnvTemplate(stream)
    const output = getOutput()
    expect(output).toContain('DISCORD_TOKEN')
    expect(output).toContain('DISCORD_GUILD_ID')
    expect(output).toContain('DISCORD_MCP_READONLY')
    expect(output).toContain('DISCORD_MCP_DRY_RUN')
    expect(output).toContain('DISCORD_MCP_CONFIRM_TOKEN')
    expect(output).toContain('DISCORD_MCP_AUDIT_LOG')
    expect(output).toContain('DISCORD_MCP_TOOLS')
    expect(output).toContain('DISCORD_MCP_CHANNELS')
  })

  it('DISCORD_TOKEN line is not commented out — it is required', () => {
    const { stream, getOutput } = captureOutput()
    printEnvTemplate(stream)
    const lines = getOutput().split('\n')
    const tokenLine = lines.find(l => l.includes('DISCORD_TOKEN=') && !l.startsWith('#'))
    expect(tokenLine).toBeDefined()
  })
})
