# Discord Auto-Responder

A polling daemon that watches a Discord channel for @mentions and responds automatically using `claude -p` (Claude Code's headless mode).

```
Discord @mention → discord-mcp-plus (MCP) → discord-responder.py → claude -p → reply
```

## Prerequisites

- **discord-mcp-plus** running in HTTP mode (`DISCORD_MCP_TRANSPORT=http`)
- **Claude Code CLI** installed and authenticated (`claude` on your PATH)
- Python 3.9+

## Setup

**1. Copy and fill in the config:**

```bash
cp .env.example .env
```

Open `.env` and set:

| Variable | Where to find it |
| --- | --- |
| `DISCORD_CHANNEL_ID` | Right-click the channel in Discord → Copy Channel ID (requires Developer Mode) |
| `DISCORD_BOT_ID` | Right-click the bot in the member list → Copy User ID |
| `DISCORD_BOT_USERNAME` | The bot's username (e.g. `my-bot`) — used to filter its own messages |
| `MCP_URL` | URL of your MCP server, e.g. `http://localhost:3000/mcp` |
| `MCP_TOKEN` | The value of `DISCORD_MCP_HTTP_TOKEN` in your MCP server config |

**2. Start the daemon:**

```bash
python discord-responder.py
```

Or run it in the background:

```bash
# Unix/macOS
nohup python discord-responder.py &

# Windows (PowerShell)
Start-Process python discord-responder.py -WindowStyle Hidden
```

**3. Verify it's working:**

In your Discord channel, @mention the bot:

> @your-bot-name hello!

Within 10 seconds you should see a response. Check `discord-responder.log` in this directory for the full poll/response history.

**Stop the daemon:**

```bash
# Ctrl+C in the terminal, or:
rm discord-responder.pid   # causes a clean shutdown on the next poll
```

## How it works

1. Every `POLL_SECS` (default: 10), fetches the last 10 messages from the channel via MCP
2. Filters for messages newer than the last-seen ID that contain `<@BOT_ID>`
3. For each new @mention, calls `claude -p "<BOT_PROMPT> Respond to: <message>"`
4. Sends the response back to the channel via MCP

**Session auto-recovery:** If the MCP server restarts, the daemon detects the stale session and re-initializes automatically on the next poll cycle — no manual restart needed.

## Customizing the bot's personality

Set `BOT_PROMPT` in `.env`:

```env
BOT_PROMPT=You are HAL 9000 replying to crew members. Be calm, polite, and subtly ominous. One sentence max.
```

## Running as a service (always-on)

**Windows — NSSM:**
```
nssm install discord-responder python C:\path\to\discord-responder.py
nssm set discord-responder AppDirectory C:\path\to\examples\discord-autoresponder
nssm start discord-responder
```

**macOS/Linux — systemd:**
```ini
[Unit]
Description=Discord Auto-Responder

[Service]
ExecStart=/usr/bin/python3 /path/to/discord-responder.py
WorkingDirectory=/path/to/examples/discord-autoresponder
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
