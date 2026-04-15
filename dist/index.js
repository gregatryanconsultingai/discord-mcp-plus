#!/usr/bin/env node

// src/index.ts
import "dotenv/config";
import { appendFile } from "fs/promises";

// src/config.ts
function parseBoolean(val, defaultVal) {
  if (val === void 0) return defaultVal;
  return val.toLowerCase() === "true";
}
function parseSet(val) {
  if (!val || val.trim() === "") return null;
  const items = val.split(",").map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return null;
  return new Set(items);
}
function parseAuditLog(val) {
  if (val === void 0) return "stderr";
  if (val === "off") return false;
  return val;
}
function loadConfig(env = process.env) {
  const token = env["DISCORD_TOKEN"];
  if (!token) throw new Error("DISCORD_TOKEN is required");
  return {
    token,
    guildId: env["DISCORD_GUILD_ID"] || void 0,
    readonly: parseBoolean(env["DISCORD_MCP_READONLY"], false),
    toolsAllow: parseSet(env["DISCORD_MCP_TOOLS"]),
    toolsDeny: parseSet(env["DISCORD_MCP_TOOLS_DENY"]) ?? /* @__PURE__ */ new Set(),
    // never null — empty means no denylist
    channelsAllow: parseSet(env["DISCORD_MCP_CHANNELS"]),
    dryRun: parseBoolean(env["DISCORD_MCP_DRY_RUN"], false),
    auditLog: parseAuditLog(env["DISCORD_MCP_AUDIT_LOG"]),
    transport: "stdio"
    // only 'stdio' supported in v0.1; reserved for HTTP transport in v1.0
  };
}

// src/discord-client.ts
import { Client, GatewayIntentBits, Partials } from "discord.js";
var client;
function getClient() {
  if (!client) throw new Error("Discord client not initialized. Call loginClient() first.");
  return client;
}
async function loginClient(token) {
  if (client) throw new Error("Discord client already initialized.");
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
  });
  await new Promise((resolve, reject) => {
    const onReady = () => {
      client.off("error", onError);
      console.error(`[discord-mcp-plus] Logged in as ${client.user?.tag}`);
      resolve();
    };
    const onError = (err) => {
      client.off("ready", onReady);
      reject(err);
    };
    client.once("ready", onReady);
    client.once("error", onError);
    client.login(token).catch(reject);
  });
}

// src/registry.ts
var ToolRegistry = class {
  constructor(config, auditSink) {
    this.config = config;
    this.auditSink = auditSink;
  }
  config;
  auditSink;
  tools = /* @__PURE__ */ new Map();
  register(tool) {
    this.tools.set(tool.name, tool);
  }
  listVisible() {
    return Array.from(this.tools.values()).filter((t) => this.isVisible(t));
  }
  isVisible(tool) {
    if (this.config.readonly && (tool.kind === "write" || tool.kind === "destructive")) {
      return false;
    }
    if (this.config.toolsDeny.has(tool.name)) return false;
    if (this.config.toolsAllow !== null && !this.config.toolsAllow.has(tool.name)) return false;
    return true;
  }
  async call(name, args, client2) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    if (!this.isVisible(tool)) throw new Error(`Tool not available: ${name}`);
    if (tool.kind !== "read" && this.config.channelsAllow !== null) {
      const channelId = args["channelId"];
      if (channelId && !this.config.channelsAllow.has(channelId)) {
        throw new Error(`Channel ${channelId} is not in the allowed channel list`);
      }
    }
    const start = Date.now();
    let result;
    try {
      result = await tool.handler(args, this.config, client2);
    } catch (err) {
      await this.writeAudit(tool, args, Date.now() - start, "error", err instanceof Error ? err.message : String(err));
      throw err;
    }
    if (tool.kind !== "read") {
      await this.writeAudit(tool, args, Date.now() - start, "ok");
    }
    return result;
  }
  async writeAudit(tool, args, durationMs, result, error) {
    if (!this.auditSink) return;
    const entry = {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      tool: tool.name,
      kind: tool.kind,
      args,
      durationMs,
      result
    };
    if (error) entry["error"] = error;
    try {
      await this.auditSink(JSON.stringify(entry) + "\n");
    } catch (err) {
      console.error("Audit log write failed:", err);
    }
  }
};

// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
async function startServer(registry, client2) {
  const server = new Server(
    { name: "discord-mcp-plus", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.listVisible().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }))
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await registry.call(name, args ?? {}, client2);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      console.error(`[discord-mcp-plus] Tool error [${name}]:`, error);
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// src/tools/server-info.ts
import { GuildChannel } from "discord.js";
var getServerInfo = {
  name: "get_server_info",
  description: 'Get metadata about a Discord server: name, member count, channel count, features, creation date. Example: "What server info do you have?"',
  inputSchema: {
    type: "object",
    properties: {
      guildId: {
        type: "string",
        description: "Server ID. Uses DISCORD_GUILD_ID env var as default if not provided."
      }
    }
  },
  kind: "read",
  handler: async (args, config, client2) => {
    const guildId = args["guildId"] ?? config.guildId;
    if (!guildId) throw new Error("guildId is required (or set DISCORD_GUILD_ID env var)");
    const guild = await client2.guilds.fetch(guildId);
    return {
      id: guild.id,
      name: guild.name,
      description: guild.description ?? null,
      memberCount: guild.memberCount,
      channelCount: guild.channels.cache.size,
      createdAt: guild.createdAt.toISOString(),
      premiumTier: guild.premiumTier,
      features: guild.features
    };
  }
};
var listBotPermissions = {
  name: "list_bot_permissions",
  description: 'List what permissions the bot has in the server or a specific channel. Useful for agents to self-check before attempting operations. Example: "What can the bot do in #general?"',
  inputSchema: {
    type: "object",
    properties: {
      guildId: {
        type: "string",
        description: "Server ID. Uses DISCORD_GUILD_ID env var as default if not provided."
      },
      channelId: {
        type: "string",
        description: "Channel ID. When provided, returns effective permissions in that channel (including overrides)."
      }
    }
  },
  kind: "read",
  handler: async (args, config, client2) => {
    const guildId = args["guildId"] ?? config.guildId;
    if (!guildId) throw new Error("guildId is required (or set DISCORD_GUILD_ID env var)");
    const guild = await client2.guilds.fetch(guildId);
    const me = guild.members.me ?? await guild.members.fetchMe();
    if (args["channelId"]) {
      const channel = await client2.channels.fetch(args["channelId"]);
      if (!channel || !(channel instanceof GuildChannel)) {
        throw new Error("Channel not found or not a guild channel");
      }
      const perms = channel.permissionsFor(me);
      if (!perms) throw new Error("Could not compute channel permissions");
      return {
        scope: "channel",
        channelId: args["channelId"],
        permissions: perms.toArray()
      };
    }
    return {
      scope: "guild",
      permissions: me.permissions.toArray()
    };
  }
};

// src/index.ts
function createAuditSink(auditLog) {
  if (auditLog === false) return void 0;
  if (auditLog === "stderr") return (line) => {
    process.stderr.write(line);
  };
  return async (line) => {
    await appendFile(auditLog, line);
  };
}
async function main() {
  const config = loadConfig();
  await loginClient(config.token);
  const client2 = getClient();
  const registry = new ToolRegistry(config, createAuditSink(config.auditLog));
  registry.register(getServerInfo);
  registry.register(listBotPermissions);
  await startServer(registry, client2);
}
main().catch((err) => {
  console.error("[discord-mcp-plus] Fatal error:", err);
  process.exit(1);
});
