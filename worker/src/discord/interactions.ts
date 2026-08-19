import type { Env } from '../env'
import { json } from '../http'
import { verifyDiscordRequest } from './verify'

/** Subset of Discord's InteractionType enum this app currently handles.
 *  https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type */
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2
} as const

/** Subset of Discord's InteractionResponseType enum. */
const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4
} as const

/** Discord's "ephemeral" message flag — only the invoking user sees the reply. */
const EPHEMERAL = 1 << 6

interface DiscordInteraction {
  type: number
  data?: { name?: string }
}

/** Handles `POST /interactions`, the single HTTP endpoint Discord calls for every slash command
 *  and button click in this design (see docs/discord-bot.md's "Architecture" section — an
 *  interactions endpoint, not a persistent gateway connection).
 *
 *  Phase 1 scope only: verifies the request is really from Discord, answers PING with PONG (the
 *  handshake Discord requires before it'll accept this URL in the Developer Portal), and replies
 *  to any application command with a static acknowledgement so the round-trip can be tested
 *  end-to-end. Real command logic (board CRUD, approval workflow) lands in later phases. */
export async function handleInteraction(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('X-Signature-Ed25519')
  const timestamp = request.headers.get('X-Signature-Timestamp')
  const body = await request.text()

  const valid = await verifyDiscordRequest(body, signature, timestamp, env.DISCORD_PUBLIC_KEY)
  if (!valid) return new Response('invalid request signature', { status: 401 })

  let interaction: DiscordInteraction
  try {
    interaction = JSON.parse(body) as DiscordInteraction
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (interaction.type === InteractionType.PING) {
    return json({ type: InteractionResponseType.PONG })
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    // Phase 2+ dispatches on interaction.data.name here (/buildAdd, /squadAdd, etc.). Phase 1
    // only needs one command to exist (registered by scripts/register-commands.ts) so this whole
    // path — Discord Developer Portal → HTTP → signature verification → response — can be
    // proven end-to-end before any real board logic exists.
    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `pong from /${interaction.data?.name ?? 'unknown'}`, flags: EPHEMERAL }
    })
  }

  return json({ error: 'unhandled_interaction_type' }, 400)
}
