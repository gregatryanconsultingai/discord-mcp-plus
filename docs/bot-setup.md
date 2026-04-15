# Discord Bot Setup — Full Walkthrough

This guide walks you through every click in the Discord Developer Portal to get a bot token and add your bot to a server. If you already know how to do this, the [README](../README.md) quick version is enough — come here when you want the full detail.

---

## Prerequisites

- A Discord account
- A Discord server you own or admin (you need Manage Server permission to add bots)
- Node.js 18+ installed (for the `npx` path)

---

## 1. Create a Discord application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) and log in
2. Click **New Application** in the top right
3. Give it a name — something like "MCP Bot" or your project name — and click **Create**

You're now on the application overview page. The application isn't a bot yet — that's the next step.

---

## 2. Create the bot user

1. In the left sidebar, click **Bot**
2. Click **Add Bot**, then **Yes, do it!** to confirm

You now have a bot user attached to your application.

**Getting your token:**

1. Under the **Token** section, click **Reset Token**
2. Confirm when prompted
3. Copy the token immediately and store it somewhere safe (a password manager, a `.env` file)

> **This token is the bot's password.** Anyone who has it can log in as your bot and do everything it's permitted to do. Never commit it to git, never share it, never paste it into chat. If it's ever exposed, reset it immediately from this page.

---

## 3. Enable privileged intents

Still on the **Bot** page, scroll down to **Privileged Gateway Intents**. These are opt-in access levels Discord requires you to explicitly enable.

Enable both of these:

**✅ Server Members Intent**
Required for: `list_members`, `get_member`, `add_role`, `remove_role`, `kick_member`, `ban_member`

**✅ Message Content Intent**
Required for: `get_messages`, `search_messages`, `wait_for_message`, `add_reaction`, `get_reactions`, attachment tools

> Without these intents enabled, the bot will connect successfully and appear online — but tools that depend on them will return empty results or errors. This is the #1 reason a freshly set-up bot doesn't work.

Click **Save Changes** before leaving the page.

---

## 4. Invite the bot to your server

Discord uses OAuth2 to authorize bots into servers. You'll generate a URL that grants the bot exactly the permissions it needs.

1. In the left sidebar, click **OAuth2** → **URL Generator**
2. Under **Scopes**, check `bot` (and optionally `applications.commands` if you plan to add slash commands)
3. Under **Bot Permissions**, check the permissions your use case needs (see the table below)
4. Copy the **Generated URL** at the bottom of the page
5. Open the URL in your browser
6. Select the server you want to add the bot to from the dropdown
7. Click **Authorize** and complete the CAPTCHA

The bot will now appear in your server's member list (initially offline until you start the MCP server).

### Permissions reference

Grant only what you need. Starting minimal and adding more later is much safer than granting everything upfront.

**Read-only (summarize, search, monitor):**

| Permission | Required for |
| --- | --- |
| View Channels | All read operations |
| Read Message History | `get_messages`, `search_messages` |

**Standard assistant (read + write messages):**

Everything above, plus:

| Permission | Required for |
| --- | --- |
| Send Messages | `send_message` |
| Send Messages in Threads | `send_message` inside threads |
| Attach Files | `send_message_with_attachment` |
| Embed Links | Message previews and embeds |
| Add Reactions | `add_reaction` |
| Use External Emojis | Reactions with custom emoji from other servers |
| Create Public Threads | `create_thread` |

**Full access (all tools):**

Everything above, plus:

| Permission | Required for |
| --- | --- |
| Manage Messages | `delete_message`, `remove_user_reaction`, `remove_all_reactions` |
| Manage Threads | `archive_thread`, `add_thread_member`, `remove_thread_member` |
| Manage Channels | `create_channel`, `delete_channel` |
| Manage Roles | `add_role`, `remove_role` |
| Kick Members | `kick_member` |
| Ban Members | `ban_member` |
| Manage Webhooks | `create_webhook`, `delete_webhook`, `list_webhooks` |

> **Never grant Administrator.** It bypasses all channel-level permission checks, and one leaked token means full server access. If a tool fails due to missing permissions, add only the specific permission it needs.

---

## 5. Find your server ID

`DISCORD_GUILD_ID` is optional but strongly recommended — it makes the `guildId` argument optional on every tool, so you can say "list channels" instead of "list channels in server 123456789".

**To find your server ID:**

1. In Discord, open **User Settings** (gear icon bottom left)
2. Go to **Advanced**
3. Toggle on **Developer Mode**
4. Close settings
5. Right-click your server name in the left sidebar
6. Click **Copy Server ID**

That number is your `DISCORD_GUILD_ID`.

---

## 6. Configure and run

You're now ready to configure your MCP client. Go back to the [README Setup section](../README.md#setup) and follow Step 4 for your specific client (Claude Code, Claude Desktop, Cursor, Windsurf, or Docker).

---

## Troubleshooting

### Bot appears offline in the server

The bot only shows as online when the MCP server process is running and connected. Start it with `npx discord-mcp-plus` (or your configured MCP client) — it should come online within a few seconds.

### Tools return empty results

Almost always a missing privileged intent. Go back to Step 3, confirm both **Server Members Intent** and **Message Content Intent** are enabled, and click **Save Changes**.

### "Missing Permissions" errors from tools

The bot's role in your server doesn't have the permission the tool needs. Either:
- Re-invite the bot with the correct permissions (re-running the OAuth2 URL updates permissions)
- Or manually edit the bot's role permissions in your server settings

### Token invalid / bot not logging in

The token was reset after you copied it. Go to the **Bot** page in the Developer Portal, click **Reset Token**, copy the new one, and update your config.

### Bot is in the server but can't see certain channels

Channel-level permission overrides can block the bot even if it has the right role permissions. In Discord, right-click the channel → **Edit Channel** → **Permissions** and verify the bot's role has access.

### `DISCORD_GUILD_ID` — where to find it

See Step 5 above. Enable Developer Mode, then right-click your server name → **Copy Server ID**.
