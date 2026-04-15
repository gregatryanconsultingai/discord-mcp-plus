# discord-mcp-plus

An open-source [Model Context Protocol](https://modelcontextprotocol.io) server for Discord — built for AI assistants that need to actually do useful work in a Discord server, not just send messages.

Ships as an `npx`-runnable npm package and a Docker image. Zero JVM, zero build step for end users.

> **Status:** early development. See the [Build order](#build-order) below for what's shipped and what's next.

---

## Why another Discord MCP?

There are a few Discord MCP servers out there. This one aims to be the one you'd actually want to hand to your team. Concretely, it adds:

| Capability                        | Most existing servers | discord-mcp-plus |
| --------------------------------- | :-------------------: | :--------------: |
| Messages, channels, roles, etc.   |           ✅          |         ✅       |
| Threads & forum channels          |           ❌          |         ✅       |
| Native Discord search API         |           ❌          |         ✅       |
| Cursor-based pagination for reads |           ❌          |         ✅       |
| Attachment **content** (not just metadata) |    ❌          |         ✅       |
| Read-only mode                    |           ❌          |         ✅       |
| Tool allowlist / denylist         |           ❌          |         ✅       |
| Channel allowlist                 |           ❌          |         ✅       |
| Dry-run on destructive tools      |           ❌          |         ✅       |
| Confirmation tokens for deletes   |           ❌          |         ✅       |
| `wait_for_message` event primitive|           ❌          |         ✅       |
| Interactive bot setup (`init`)    |           ❌          |         ✅       |
| `npx` install                     |           ❌          |         ✅       |

---

## Quick start

### 1. Create a Discord bot

```bash
npx discord-mcp-plus init
```

This walks you through creating the Discord application, generating a token, enabling the right privileged intents (Server Members, Message Content), building a scoped invite URL, and writing a local `.env` file. If you'd rather do it manually, see [docs/bot-setup.md](./docs/bot-setup.md).

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
  -p 8085:8085 \
  -e DISCORD_TOKEN=your_token \
  -e DISCORD_GUILD_ID=your_guild_id \
  -e TRANSPORT=http \
  ghcr.io/<your-gh-user>/discord-mcp-plus:latest
```

Then point your client at `http://localhost:8085/mcp`.

### 3. Try it

In your MCP client:

> Summarize the last 50 messages in #papers.

> List channels that haven't had activity in 30 days.

> Search the server for messages about "eval framework" in the last two weeks.

---

## Configuration

All config is environment variables. None are required except `DISCORD_TOKEN`.

| Variable                 | Default | Description |
| ------------------------ | ------- | ----------- |
| `DISCORD_TOKEN`          | —       | Your Discord bot token. Required. |
| `DISCORD_GUILD_ID`       | —       | Default server ID. When set, `guildId` becomes optional on every tool. |
| `DISCORD_MCP_READONLY`   | `false` | When `true`, every write tool is disabled. Reads only. |
| `DISCORD_MCP_TOOLS`      | all     | Comma-separated allowlist of tool names. Everything else is hidden. |
| `DISCORD_MCP_TOOLS_DENY` | none    | Comma-separated denylist. Takes precedence over allowlist. |
| `DISCORD_MCP_CHANNELS`   | all     | Comma-separated allowlist of channel IDs. Writes outside this list are rejected. |
| `DISCORD_MCP_DRY_RUN`    | `false` | When `true`, destructive tools return a preview instead of executing. |
| `DISCORD_MCP_AUDIT_LOG`  | stdout  | Path to write a structured audit log of all writes. `off` to disable. |
| `TRANSPORT`              | `stdio` | `stdio` (default, for local MCP clients) or `http` (for shared deployments). |
| `PORT`                   | `8085`  | Port for HTTP transport. |

### Recommended profiles

**Read-only research bot:**
```bash
DISCORD_MCP_READONLY=true
```

**Scoped to one channel:**
```bash
DISCORD_MCP_CHANNELS=1234567890
DISCORD_MCP_TOOLS=read_messages,search_messages,send_message
```

**Paranoid mode for destructive operations:**
```bash
DISCORD_MCP_DRY_RUN=true  # preview every delete/edit before committing
```

---

## Tools

All tools return structured JSON. Every tool description includes an example invocation.

### Server info

- `get_server_info` — server metadata, member/channel counts, features
- `list_bot_permissions` — what the bot can actually do in this server (so agents can self-check)
- `get_audit_log` — who did what, with filters

### Messages

- `read_messages` — cursor-based pagination, includes attachment metadata
- `search_messages` — native Discord search: author, channel, date range, `has:link|image|embed`, mentions
- `get_message_context` — N messages before/after a target message
- `send_message`, `edit_message`, `delete_message`
- `send_message_with_attachment` — upload from URL or base64
- `get_attachment_content` — download attachment bytes (images returned vision-ready)
- `add_reaction`, `remove_reaction`
- `wait_for_message` — block up to N seconds for a message matching a filter
- `get_messages_since` — cursor-based incremental poll

### Threads & forums

- `list_threads`, `read_thread`, `create_thread`, `archive_thread`
- `add_thread_member`, `remove_thread_member`
- `list_forum_posts`, `create_forum_post`, `read_forum_post`

### Channels & categories

- `list_channels`, `find_channel`, `get_channel_info`
- `create_text_channel`, `create_voice_channel`, `create_stage_channel`
- `edit_text_channel`, `edit_voice_channel`
- `delete_channel`, `move_channel`
- `create_category`, `delete_category`, `find_category`, `list_channels_in_category`
- `list_active_conversations` — channels with recent human activity, deprioritizes bot-heavy ones

### Users & DMs

- `get_user_id_by_name`, `who_said` (fuzzy author search across recent messages)
- `send_private_message`, `edit_private_message`, `delete_private_message`, `read_private_messages`
- `get_member_activity` — last seen, recent message counts

### Roles

- `list_roles`, `create_role`, `edit_role`, `delete_role`
- `assign_role`, `remove_role`

### Moderation

- `kick_member`, `ban_member`, `unban_member`, `get_bans`
- `timeout_member`, `remove_timeout`
- `set_nickname`

### Voice & stage

- `move_member`, `disconnect_member`, `modify_voice_state`

### Scheduled events

- `create_guild_scheduled_event`, `edit_guild_scheduled_event`, `delete_guild_scheduled_event`
- `list_guild_scheduled_events`, `get_guild_scheduled_event_users`

### Permissions, invites, emojis, webhooks

- Channel permission overwrites: `list_channel_permission_overwrites`, `upsert_role_channel_permissions`, `upsert_member_channel_permissions`, `delete_channel_permission_overwrite`
- Invites: `create_invite`, `list_invites`, `delete_invite`, `get_invite_details`
- Emojis: `list_emojis`, `get_emoji_details`, `create_emoji`, `edit_emoji`, `delete_emoji`
- Webhooks: `create_webhook`, `delete_webhook`, `list_webhooks`, `send_webhook_message`

### Helpers

- `summarize_channel` — fetches N messages, dedups bot spam, collapses reactions, flattens replies, returns LLM-friendly formatted transcript

---

## Safety model

Open-sourcing a Discord bot with role, delete, and ban powers is a footgun if you're not careful. This server's defaults try to make the safe path the easy path:

1. **Scope bot perms at the Discord level first.** Don't grant Administrator. Grant only what you need.
2. **Use `DISCORD_MCP_READONLY=true`** when the MCP server doesn't need to write. This is almost always the right default for "Claude, summarize the server" workflows.
3. **Use `DISCORD_MCP_CHANNELS`** to scope writes to a known set of channels even if the bot has broader perms.
4. **Destructive tools (`delete_*`, role edits, bans) support confirmation tokens.** First call returns a token and a preview. A follow-up call with the token executes. This is on by default; disable with `DISCORD_MCP_CONFIRM=false` if you know what you're doing.
5. **Turn on `DISCORD_MCP_DRY_RUN=true`** while you're building workflows. Nothing actually changes; you see what would have happened.
6. **The audit log is always on by default.** Every write is logged with tool, args, caller context, and result.

---

## Build order

- [x] v0.1 — scaffolding, config, tool registry with readonly/allowlist gating, `get_server_info`
- [ ] v0.2 — message, channel, role, and moderation parity with existing servers
- [ ] v0.3 — threads, forums, attachment content
- [ ] v0.4 — search, pagination, `wait_for_message`
- [ ] v0.5 — `init` helper, dry-run, confirmation tokens
- [ ] v1.0 — docs, demo GIFs, npm + Docker Hub publish

---

## Development

```bash
git clone https://github.com/<your-gh-user>/discord-mcp-plus
cd discord-mcp-plus
npm install
cp .env.example .env   # edit in your bot token
npm run dev            # runs with tsx, stdio transport
```

Run the included MCP inspector against it:

```bash
npx @modelcontextprotocol/inspector npm run dev
```

Tests:

```bash
npm test
```

---

## Contributing

PRs welcome. A few guidelines:

- New tools need: JSON schema, description with at least one example, unit test, entry in this README.
- Destructive tools must implement confirmation-token support and honor `DISCORD_MCP_DRY_RUN`.
- Read tools should support cursor pagination where Discord's API allows.
- No hard dependencies on any specific MCP client — stick to the MCP spec.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full rundown.

---

## License

MIT. See [LICENSE](./LICENSE).

## Acknowledgements

Tool surface inspired by [SaseQ/discord-mcp](https://github.com/SaseQ/discord-mcp). Built on [discord.js](https://discord.js.org) and the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).
