import { getGuildSettings } from '../db'
import type { Env } from '../env'
import { json } from '../http'
import { parseDecisionCustomId, parsePreviewCustomId } from './approvals'
import { autocompleteChoices } from './autocomplete'
import { runApprovalDecision, runApprovalPreview, runCommand, resolveHandler } from './dispatch'
import { EPHEMERAL, InteractionResponseType, InteractionType, isAdministrator, type DiscordInteraction } from './interaction-types'
import { verifyDiscordRequest } from './verify'

/** Handles `POST /interactions`, the single HTTP endpoint Discord calls for every slash command,
 *  autocomplete request, and (Phase 3) Preview/Approve/Reject button click in this design (see
 *  docs/discord-bot.md's "Architecture" section — an interactions endpoint, not a persistent
 *  gateway connection).
 *
 *  Every real command handler is deferred: this function acks with `DEFERRED_CHANNEL_MESSAGE_WITH
 *  _SOURCE` immediately (Discord's 3-second initial-response window), then runs the actual D1
 *  writes + board-message PATCH in the background via `ctx.waitUntil` and delivers the real result
 *  by editing that placeholder afterward (`dispatch.ts`'s `runCommand`). Autocomplete has no
 *  deferred variant, so it's answered synchronously — a single indexed `LIKE` query comfortably
 *  fits the 3-second window on its own. A button click (`MESSAGE_COMPONENT`) is one of two shapes:
 *  Preview acks and defers exactly like a command (new ephemeral message, no permission gate —
 *  `dispatch.ts`'s `runApprovalPreview`); Approve/Reject is a hybrid where the approver-role
 *  permission check runs synchronously first (cheap, and needs to decide the response type before
 *  acking), then the actual decide-and-apply work defers via `dispatch.ts`'s
 *  `runApprovalDecision`. */
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

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    if (!interaction.guild_id || !interaction.member) {
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'This bot only works inside a server.', flags: EPHEMERAL }
      })
    }

    // Preview is checked first and handled entirely separately from a decision: no approver-role
    // gate (seeing a render of a proposed build isn't privileged the way deciding it is), and it
    // acks the same way a slash command does (`DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`, a *new*
    // ephemeral message) rather than `DEFERRED_UPDATE_MESSAGE` (which would target the card
    // itself) — see `dispatch.ts`'s `runApprovalPreview` doc comment.
    const previewRequestId = parsePreviewCustomId(interaction.data?.custom_id ?? '')
    if (previewRequestId !== null) {
      ctx.waitUntil(runApprovalPreview(env, interaction, previewRequestId))
      return json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: EPHEMERAL } })
    }

    const parsed = parseDecisionCustomId(interaction.data?.custom_id ?? '')
    if (!parsed) {
      return json({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: 'Unrecognized button.', flags: EPHEMERAL } })
    }

    // Load-bearing, not just UX — button visibility in Discord isn't restricted to a specific
    // user, so anyone in the channel can see and click Approve/Reject (docs/discord-bot.md's
    // approval-workflow step 3). Checked synchronously here, before acking, so a rejected clicker
    // gets an immediate ephemeral reply that leaves the card (and its buttons) untouched for a
    // legitimate approver — only a real decision goes through the deferred apply path below.
    const settings = await getGuildSettings(env, interaction.guild_id)
    const approverRoleId = settings?.approver_role_id ?? null
    const allowed = isAdministrator(interaction.member) || (approverRoleId !== null && interaction.member.roles.includes(approverRoleId))
    if (!allowed) {
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: approverRoleId ? `You need the <@&${approverRoleId}> role to decide this.` : 'No approver role is configured for this server.',
          flags: EPHEMERAL
        }
      })
    }

    ctx.waitUntil(runApprovalDecision(env, interaction, parsed.requestId, parsed.decision))
    return json({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE })
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
