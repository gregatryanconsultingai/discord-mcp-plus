# Setting Up a Discord Bot

This guide walks you through creating a Discord bot and getting its token for use with discord-mcp-plus.

---

## 1. Create a Discord application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** in the top right
3. Give it a name (e.g., "My MCP Bot") and click **Create**

---

## 2. Create the bot

1. In the left sidebar, click **Bot**
2. Click **Add Bot** → **Yes, do it!**
3. Under **Token**, click **Reset Token** → copy the token and store it somewhere safe — this is your `DISCORD_TOKEN`

> **Never share this token.** Anyone with it can control your bot.

---

## 3. Enable privileged intents

Still on the Bot page, scroll down to **Privileged Gateway Intents** and enable:

- ✅ **Server Members Intent** — required for `list_members`, `get_member`, role tools
- ✅ **Message Content Intent** — required for `get_messages`, `search_messages`, reactions

Click **Save Changes**.

---

## 4. Invite the bot to your server

1. In the left sidebar, click **OAuth2** → **URL Generator**
2. Under **Scopes**, check `bot`
3. Under **Bot Permissions**, check the permissions your use case needs:

| Permission | Required for |
| --- | --- |
| View Channels | Everything |
| Read Message History | `get_messages`, `search_messages` |
| Send Messages | `send_message`, `send_dm` |
| Attach Files | `send_message_with_attachment` |
| Add Reactions | `add_reaction` |
| Manage Messages | `delete_message`, `remove_user_reaction`, `remove_all_reactions` |
| Manage Channels | `create_channel`, `delete_channel` |
| Manage Roles | `add_role`, `remove_role` |
| Kick Members | `kick_member` |
| Ban Members | `ban_member` |
| Manage Webhooks | `create_webhook`, `delete_webhook`, `list_webhooks` |

4. Copy the generated URL at the bottom of the page
5. Open the URL in your browser, select the server to invite the bot to, and click **Authorize**

---

## 5. Set up your .env

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
DISCORD_TOKEN=your_token_from_step_2
DISCORD_GUILD_ID=your_server_id   # optional but recommended
```

To find your server ID: in Discord, enable Developer Mode (Settings → Advanced → Developer Mode), then right-click your server name and click **Copy Server ID**.

---

## Done

Run `npm run dev` (or `npx discord-mcp-plus` for the published package) and connect your MCP client.
