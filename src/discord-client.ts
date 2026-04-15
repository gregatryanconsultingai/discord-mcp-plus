import { Client, GatewayIntentBits, Partials } from 'discord.js'

let client: Client | undefined

export function getClient(): Client {
  if (!client) throw new Error('Discord client not initialized. Call loginClient() first.')
  return client
}

export async function loginClient(token: string): Promise<void> {
  if (client) throw new Error('Discord client already initialized.')

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  })

  await new Promise<void>((resolve, reject) => {
    client!.once('ready', () => {
      console.error(`[discord-mcp-plus] Logged in as ${client!.user?.tag}`)
      resolve()
    })
    client!.once('error', reject)
    client!.login(token).catch(reject)
  })
}
