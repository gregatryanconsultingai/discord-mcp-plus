# discord-mcp-plus

A production-grade MCP server for Discord with advanced features including search, pagination, safety controls, and npx installation support.

## Features

- Search and filter Discord servers, channels, and messages
- Pagination support for large result sets
- Safety controls and permission management
- Comprehensive tool registry
- Type-safe configuration system
- Full test coverage
- CLI support via npx

## Prerequisites

- Node.js >= 18
- A Discord bot token

## Installation

```bash
npm install
```

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Watch tests
npm run test:watch

# Type check
npm run typecheck
```

## Configuration

See `.env.example` for available configuration options:

- `DISCORD_TOKEN` (required) — Your Discord bot token
- `DISCORD_GUILD_ID` (optional) — Default server ID
- `DISCORD_MCP_READONLY` — Read-only mode
- `DISCORD_MCP_TOOLS` — Allowed tools list
- `DISCORD_MCP_TOOLS_DENY` — Denied tools list
- `DISCORD_MCP_CHANNELS` — Allowed channels
- `DISCORD_MCP_DRY_RUN` — Dry run mode
- `DISCORD_MCP_AUDIT_LOG` — Audit logging level

## Project Structure

```
src/
  index.ts          — Entry point
  config/           — Configuration system
  tools/            — Tool implementations
  discord/          — Discord client wrapper
  server/           — MCP server implementation
tests/              — Test suite
docs/               — Documentation and design specs
```

## License

MIT
