# Contributing to discord-mcp-plus

PRs welcome. Here's everything you need to know.

---

## Running locally

```bash
git clone https://github.com/gregatryanconsultingai/discord-mcp-plus
cd discord-mcp-plus
npm install
cp .env.example .env   # fill in a real bot token for manual testing
npm run dev            # stdio transport, connects to Discord
```

Unit tests (no Discord connection needed — all Discord calls are mocked):

```bash
npm test
npm run typecheck
```

---

## Adding a new tool

### 1. Write the ToolDef

Add your tool to the appropriate file in `src/tools/` (or create a new file for a new domain):

```typescript
import type { ToolDef } from '../registry.js'

export const myNewTool: ToolDef = {
  name: 'my_new_tool',           // snake_case
  description: 'What it does — be specific. Example: list all text channels in the server.',
  inputSchema: {
    type: 'object',
    properties: {
      guildId: { type: 'string', description: 'Server ID' },
    },
    required: ['guildId'],
  },
  kind: 'read',                  // 'read' | 'write' | 'destructive'
  async handler(args, config, client) {
    const { guildId } = args as { guildId: string }
    // ... implementation
    return { result: 'data' }
  },
}
```

### 2. Register it in src/index.ts

```typescript
import { myNewTool } from './tools/my-file.js'
// ...
registry.register(myNewTool)
```

### 3. Write a test

Add at least one Vitest test in `tests/`. Tests mock the Discord client — no real bot token needed:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { myNewTool } from '../src/tools/my-file.js'
import type { Config } from '../src/config.js'

const baseConfig: Config = {
  token: 'tok', guildId: 'guild1', readonly: false,
  toolsAllow: null, toolsDeny: new Set(), channelsAllow: null,
  dryRun: false, auditLog: false, confirmationToken: false,
  transport: 'stdio', httpPort: 3000, httpToken: false,
}

describe('my_new_tool', () => {
  it('returns expected shape', async () => {
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({ /* mock guild */ }),
      },
    } as any

    const result = await myNewTool.handler({ guildId: 'guild1' }, baseConfig, client) as any
    expect(result).toHaveProperty('result')
  })
})
```

### 4. Add it to the README tools table

Find the appropriate section in `README.md` and add a row:

```markdown
| `my_new_tool` | read | Brief description |
```

---

## Rules for specific tool kinds

### Destructive tools (`kind: 'destructive'`)

Must honor `config.dryRun`. The registry handles this automatically via `ToolRegistry.call()` — if `dryRun` is true, the handler is never called and a simulated response is returned. You don't need to add dry-run logic inside the handler.

Destructive tools also automatically receive a `confirmToken` argument injection via the registry when `config.confirmationToken` is set. You don't need to handle this in the handler either.

### Read tools with large result sets

If the underlying Discord API supports pagination (e.g., fetching messages, members), your tool should accept `limit` and `before`/`after` cursor parameters and pass them through. See `get_messages` in `src/tools/messages.ts` for an example.

---

## PR guidelines

- **One feature or fix per PR** — easier to review, easier to revert
- **Conventional commit messages:** `feat:`, `fix:`, `ci:`, `docs:`, `chore:`
- **Tests must pass:** `npm test && npm run typecheck`
- **No new runtime dependencies** without opening an issue first — keep the install footprint small
- **Match existing code style** — TypeScript strict mode, ESM imports with `.js` extensions, no `any` unless unavoidable

---

## Project structure

```
src/
  config.ts         — env var parsing, Config interface
  registry.ts       — ToolRegistry: safety policy, dry-run, audit log
  server.ts         — MCP server setup, transport branching (stdio / HTTP)
  index.ts          — entry point, tool registration
  init.ts           — `npx discord-mcp-plus init` template printer
  discord-client.ts — Discord.js client singleton
  tools/            — one file per tool domain
    messages.ts
    channels.ts
    members.ts
    ... etc
tests/              — Vitest unit tests, one file per tool domain
docs/               — guides and design specs
```
