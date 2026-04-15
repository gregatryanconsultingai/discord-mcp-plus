# discord-mcp-plus

An open-source [Model Context Protocol](https://modelcontextprotocol.io) server for Discord — built for AI assistants that need to actually do useful work in a Discord server, not just send messages.

Ships as an `npx`-runnable npm package and a Docker image. Zero JVM, zero build step for end users.

> **Status:** beta — production-ready for read-heavy workflows. See the [Build order](#build-order) below for what's shipped and what's next.

---

## Why another Discord MCP?

There are a few Discord MCP servers out there. This one aims to be the one you'd actually want to hand to your team. Concretely, it adds:

| Capability                                     | Most existing servers | discord-mcp-plus |
| ---------------------------------------------- | :-------------------: | :--------------: |
| Messages, channels, roles, etc.                |           ✅           |        ✅        |
| Threads & forum channels                       |           ❌           |        ✅        |
| Native Discord search API                      |           ❌           |        ✅        |
| Cursor-based pagination for reads              |           ❌           |        ✅        |
| Attachment **content** (not just metadata)     |           ❌           |        ✅        |
| Reactions (add / remove / list)                |           ❌           |        ✅        |
| Webhooks (create / send / delete)              |           ❌           |        ✅        |
| Read-only mode                                 |           ❌           |        ✅        |
| Tool allowlist / denylist                      |           ❌           |        ✅        |
| Channel allowlist for writes                   |           ❌           |        ✅        |
| Dry-run on destructive tools                   |           ❌           |        ✅        |
| Confirmation tokens for deletes                |           ❌           |        ✅        |
| `wait_for_message` event primitive             |           ❌           |        ✅        |
| Interactive bot setup (`init`)                 |           ❌           |        ✅        |
| HTTP transport for remote / container use      |           ❌           |        ✅        |
| Docker image                                   |           ❌           |        ✅        |
| `npx` install                                  |           ❌           |        ✅        |

---

## Quick start

### 1. Create a Discord bot

```bash
npx discord-mcp-plus init
```

This prints a ready-to-use `.env` template. For a step-by-step guide to creating the bot in the Discord developer portal, see [docs/bot-setup.md](./docs/bot-setup.md).

### 2. Add it to your MCP client

**Claude Desktop / Claude Code / Cursor / Windsurf** — add to your MCP config:

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "discord-mcp-plus"],
      "env": {
        "DISCORD_TOKEN": "your_bot_token",
        "DISCORD_GUILD_ID": "optional_default_server_id"
      }
    }
  }
}
```

**Docker** (for always-on / shared deployments):

```bash
docker run -d --name discord-mcp \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DISCORD_TOKEN=your_token \
  -e DISCORD_GUILD_ID=your_guild_id \
  -e DISCORD_MCP_HTTP_TOKEN=your_secret_token \
  gregatryanconsultingai/discord-mcp-plus:latest
```

Then point your MCP client at `http://localhost:3000/mcp` with header `Authorization: Bearer your_secret_token`.

### 3. Try it

In your MCP client:

> Summarize the last 50 messages in #general.

> List all channels and their last activity.

> Search the server for messages about "launch date" in the last two weeks.

---

## Configuration

All config is environment variables. Only `DISCORD_TOKEN` is required.

| Variable | Default | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | — | Bot token. **Required.** |
| `DISCORD_GUILD_ID` | — | Default server ID. When set, `guildId` is optional on every tool. |
| `DISCORD_MCP_READONLY` | `false` | Hide all write/destructive tools from the AI. |
| `DISCORD_MCP_TOOLS` | all | Comma-separated allowlist of tool names. Everything else is hidden. |
| `DISCORD_MCP_TOOLS_DENY` | none | Comma-separated denylist. Takes precedence over the allowlist. |
| `DISCORD_MCP_CHANNELS` | all | Comma-separated allowlist of channel IDs. Writes outside this list are rejected. |
| `DISCORD_MCP_DRY_RUN` | `false` | Return previews instead of executing writes/deletes. |
| `DISCORD_MCP_AUDIT_LOG` | `stderr` | `stderr` (default), `off`, or a file path for structured write logs. |
| `DISCORD_MCP_CONFIRM_TOKEN` | — | Require this secret as a `confirmToken` arg on all destructive tool calls. |
| `DISCORD_MCP_TRANSPORT` | `stdio` | `stdio` (local MCP clients) or `http` (container/remote deployments). |
| `DISCORD_MCP_HTTP_PORT` | `3000` | Port for HTTP transport. |
| `DISCORD_MCP_HTTP_TOKEN` | — | Bearer token for HTTP auth. **Required** when `DISCORD_MCP_TRANSPORT=http`. |

### Recommended profiles

**Read-only research bot:**
```env
DISCORD_MCP_READONLY=true
```

**Scoped to specific channels:**
```env
DISCORD_MCP_CHANNELS=111222333444,555666777888
```

**Paranoid mode — preview before any delete/edit:**
```env
DISCORD_MCP_DRY_RUN=true
```

---

## Tools

All tools return structured JSON.

### Server info
| Tool | Kind | Description |
| --- | --- | --- |
| `get_server_info` | read | Server metadata, member/channel counts, features |
| `list_bot_permissions` | read | What the bot can do in this server |

### Messages
| Tool | Kind | Description |
| --- | --- | --- |
| `get_messages` | read | Fetch messages with cursor-based pagination |
| `search_messages` | read | Native Discord search: author, channel, date range, `has:` filters |
| `send_message` | write | Send a text message to a channel |
| `edit_message` | write | Edit a message the bot sent |
| `delete_message` | destructive | Delete any message (requires Manage Messages) |
| `send_message_with_attachment` | write | Upload a file from a URL or base64 |
| `get_attachment_content` | read | Download attachment bytes (images returned vision-ready) |
| `wait_for_message` | read | Block up to N seconds for a message matching a filter |

### Reactions
| Tool | Kind | Description |
| --- | --- | --- |
| `add_reaction` | write | Add an emoji reaction to a message |
| `remove_reaction` | write | Remove the bot's own reaction |
| `remove_user_reaction` | destructive | Remove a specific user's reaction (requires Manage Messages) |
| `remove_all_reactions` | destructive | Remove all reactions from a message (requires Manage Messages) |
| `get_reactions` | read | List users who reacted with a specific emoji |

### Channels
| Tool | Kind | Description |
| --- | --- | --- |
| `list_channels` | read | List all channels in the server |
| `get_channel` | read | Get details about a specific channel |
| `create_channel` | write | Create a text, voice, or category channel |
| `delete_channel` | destructive | Delete a channel |

### Threads
| Tool | Kind | Description |
| --- | --- | --- |
| `list_threads` | read | List active and archived threads |
| `create_thread` | write | Create a thread on a message or standalone |
| `get_thread_messages` | read | Fetch messages from a thread |
| `archive_thread` | write | Archive or unarchive a thread |
| `add_thread_member` | write | Add a member to a thread |
| `remove_thread_member` | destructive | Remove a member from a thread |

### Forums
| Tool | Kind | Description |
| --- | --- | --- |
| `list_forum_posts` | read | List posts in a forum channel |
| `create_forum_post` | write | Create a new forum post |
| `read_forum_post` | read | Fetch messages from a forum post |

### Members & roles
| Tool | Kind | Description |
| --- | --- | --- |
| `list_members` | read | List server members with pagination |
| `get_member` | read | Get a specific member's details |
| `list_roles` | read | List all roles in the server |
| `add_role` | write | Assign a role to a member |
| `remove_role` | destructive | Remove a role from a member |
| `kick_member` | destructive | Kick a member from the server |
| `ban_member` | destructive | Ban a member from the server |

### Guilds
| Tool | Kind | Description |
| --- | --- | --- |
| `list_guilds` | read | List servers the bot is in |
| `get_guild` | read | Get details about a specific server |

### DMs
| Tool | Kind | Description |
| --- | --- | --- |
| `send_dm` | write | Send a direct message to a user |
| `get_dm_history` | read | Fetch DM history with a user |

### Webhooks
| Tool | Kind | Description |
| --- | --- | --- |
| `create_webhook` | write | Create a webhook in a channel |
| `list_webhooks` | read | List webhooks for a channel or guild |
| `delete_webhook` | destructive | Delete a webhook |
| `send_webhook_message` | write | Send a message via webhook URL (no bot token needed) |

---

## Safety model

1. **Scope bot permissions at the Discord level first.** Don't grant Administrator. Grant only what you need.
2. **Use `DISCORD_MCP_READONLY=true`** for summarise/research workflows — hides all write tools from the AI.
3. **Use `DISCORD_MCP_CHANNELS`** to restrict writes to known channels even if the bot has broader perms.
4. **Use `DISCORD_MCP_CONFIRM_TOKEN`** to require a secret passphrase before any destructive tool executes.
5. **Use `DISCORD_MCP_DRY_RUN=true`** while building workflows — nothing actually changes, you see what would have happened.
6. **The audit log is on by default** — every write is logged with tool name, args, and result.

---

## Build order

- [x] v0.1 — scaffolding, config, tool registry with readonly/allowlist gating, `get_server_info`
- [x] v0.2 — messages, channels, members/roles, guilds, threads, DMs
- [x] v0.3 — thread management, forums, attachments
- [x] v0.4 — search, pagination, `wait_for_message`
- [x] v0.5 — `init` CLI, dry-run, confirmation tokens
- [x] v0.6 — reactions (5 tools), webhooks (4 tools)
- [x] v0.7 — HTTP transport (`DISCORD_MCP_TRANSPORT=http`)
- [x] v0.8 — Dockerfile, GitHub Actions CI/publish pipelines
- [x] v0.9 — docs, README accuracy pass
- [ ] v1.0 — release cut, npm + Docker Hub tags

---

## Development

```bash
git clone https://github.com/gregatryanconsultingai/discord-mcp-plus
cd discord-mcp-plus
npm install
cp .env.example .env   # edit in your bot token
npm run dev            # runs with tsx watch, stdio transport
```

Run the MCP inspector against it:

```bash
npx @modelcontextprotocol/inspector npm run dev
```

Tests (no Discord connection needed — all mocked):

```bash
npm test
npm run typecheck
```

---

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

Quick rules:
- New tools need: JSON schema, description, unit test, entry in the Tools table above
- Destructive tools must honor `DISCORD_MCP_DRY_RUN` and support confirmation tokens
- Read tools should support cursor pagination where Discord's API allows
- `npm test && npm run typecheck` must pass before opening a PR

---

## License

MIT. See [LICENSE](./LICENSE).

## Acknowledgements

Tool surface inspired by [SaseQ/discord-mcp](https://github.com/SaseQ/discord-mcp). Built on [discord.js](https://discord.js.org) and the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).
