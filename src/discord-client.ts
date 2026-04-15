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
    const onReady = () => {
      client!.off('error', onError)
      console.error(`[discord-mcp-plus] Logged in as ${client!.user?.tag}`)
      resolve()
    }
    const onError = (err: Error) => {
      client!.off('ready', onReady)
      reject(err)
    }
    client!.once('ready', onReady)
    client!.once('error', onError)
    client!.login(token).catch(reject)
  })
}
