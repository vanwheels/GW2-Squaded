import type { Env } from '../env'
import { json } from '../http'
import { autocompleteChoices } from './autocomplete'
import { runCommand, resolveHandler } from './dispatch'
import { EPHEMERAL, InteractionResponseType, InteractionType, type DiscordInteraction } from './interaction-types'
import { verifyDiscordRequest } from './verify'

/** Handles `POST /interactions`, the single HTTP endpoint Discord calls for every slash command,
 *  autocomplete request, and (future — Phase 3) button click in this design (see
 *  docs/discord-bot.md's "Architecture" section — an interactions endpoint, not a persistent
 *  gateway connection).
 *
 *  Every real command handler is deferred: this function acks with `DEFERRED_CHANNEL_MESSAGE_WITH
 *  _SOURCE` immediately (Discord's 3-second initial-response window), then runs the actual D1
 *  writes + board-message PATCH in the background via `ctx.waitUntil` and delivers the real result
 *  by editing that placeholder afterward (`dispatch.ts`'s `runCommand`). Autocomplete has no
 *  deferred variant, so it's answered synchronously — a single indexed `LIKE` query comfortably
 *  fits the 3-second window on its own. */
export async function handleInteraction(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

  if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
    const choices = await autocompleteChoices(env, interaction.guild_id, interaction.data?.name ?? '', interaction.data?.options)
    return json({ type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices } })
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    // Every registered command in this bot is guild-only (no DM support — a board is inherently
    // guild-scoped state), so both should always be present here; this guard is defensive, not
    // an expected path.
    if (!interaction.guild_id || !interaction.member) {
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'This bot only works inside a server.', flags: EPHEMERAL }
      })
    }

    const resolved = resolveHandler(interaction.data?.name ?? '', interaction.data?.options)
    if (!resolved) {
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Unknown command.', flags: EPHEMERAL }
      })
    }

    ctx.waitUntil(runCommand(env, interaction, resolved.handler, resolved.options))
    return json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: EPHEMERAL }
    })
  }

  return json({ error: 'unhandled_interaction_type' }, 400)
}
