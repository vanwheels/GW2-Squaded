import {
  decidePendingRequest,
  getGuildSettings,
  getPendingRequest,
  insertPendingRequest,
  type BoardAction,
  type BoardType,
  type PendingRequestRow
} from '../db'
import type { Env } from '../env'
import { createChannelMessage, type DiscordActionRow, type DiscordMessagePayload } from './api'
import type { CommandContext } from './commands/context'
import { UserError } from './errors'

const CARD_COLOR_PENDING = 0xf1c40f
const CARD_COLOR_APPROVED = 0x2ecc71
const CARD_COLOR_REJECTED = 0xe74c3c

/** What a mutating command (`buildAdd`/`buildEdit`/... in `commands/builds.ts`/`squads.ts`) wants
 *  to happen if the guild turns out to be in Manual mode — mirrors `pending_requests`' own
 *  `proposed_*` columns 1:1. `null` (not `undefined`) throughout since these bind straight into a
 *  D1 statement. */
export interface PendingProposal {
  targetId: number | null
  proposedName: string | null
  proposedShareId: string | null
  proposedPosition: number | null
}

/** A board-specific pair of functions `discord/dispatch.ts` supplies to `decideApprovalRequest`
 *  below — kept out of this file (rather than importing `commands/builds.ts`/`squads.ts` here
 *  directly) to avoid a module cycle, since those files import `checkApprovalGate` from this one. */
export interface PendingRequestHandlers {
  /** Human-readable one-line summary of the proposed change, for the approval card's embed. Re-
   *  derives everything from the stored row (re-fetching the target build/squad by id, re-resolving
   *  a proposed share link) rather than trusting any snapshot text, so the card reflects reality
   *  even if something else changed the target in the meantime. */
  describe: (env: Env, request: PendingRequestRow) => Promise<string>
  /** Applies the change for real (only called once, right after `decidePendingRequest` wins the
   *  race to claim a `pending` row) and returns a short past-tense result message. Throws
   *  `UserError` for an apply-time failure (target deleted, share link no longer valid, etc.) —
   *  `decideApprovalRequest` folds that into the decided card instead of letting it escape. */
  apply: (env: Env, request: PendingRequestRow) => Promise<string>
}

/** Both request kinds get a Preview button ahead of Approve/Reject, so an approver isn't deciding
 *  off the card's one-line text summary alone — it reuses `/builddisplay`'s/`/squaddisplay`'s own
 *  screenshot render (see `dispatch.ts`'s `runApprovalPreview`). */
function decisionButtons(request: PendingRequestRow): DiscordActionRow[] {
  const components: DiscordActionRow['components'] = [{ type: 2, style: 2, label: 'Preview', custom_id: `preview:${request.id}` }]
  components.push(
    { type: 2, style: 3, label: 'Approve', custom_id: `approve:${request.id}` },
    { type: 2, style: 4, label: 'Reject', custom_id: `reject:${request.id}` }
  )
  return [{ type: 1, components }]
}

/** Parses a decision button's `custom_id` (`approve:<id>` / `reject:<id>`, built by
 *  `decisionButtons` above) back into a decision + `pending_requests.id`. `interactions.ts` calls
 *  this on every `MESSAGE_COMPONENT` interaction; `null` means the button wasn't one of ours
 *  (defensive — nothing else in this bot posts buttons today). */
export function parseDecisionCustomId(customId: string): { decision: 'approved' | 'rejected'; requestId: number } | null {
  const match = /^(approve|reject):(\d+)$/.exec(customId)
  if (!match) return null
  return { decision: match[1] === 'approve' ? 'approved' : 'rejected', requestId: Number(match[2]) }
}

/** Parses a Preview button's `custom_id` (`preview:<id>`, built by `decisionButtons` above) back
 *  into a `pending_requests.id`. Deliberately separate from `parseDecisionCustomId` above rather
 *  than folded into one union-returning function — `interactions.ts` needs to know *before*
 *  acking whether a click is a decision (which needs the synchronous approver-role check and a
 *  `DEFERRED_UPDATE_MESSAGE` ack) or a preview (no permission gate — seeing a render of a proposed
 *  build isn't privileged the way deciding it is — and a `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`
 *  ack instead, since it posts a new ephemeral message rather than editing the card). */
export function parsePreviewCustomId(customId: string): number | null {
  const match = /^preview:(\d+)$/.exec(customId)
  return match ? Number(match[1]) : null
}

function actionLabel(action: BoardAction): string {
  return action.charAt(0).toUpperCase() + action.slice(1)
}

function boardTypeLabel(boardType: BoardType): string {
  return boardType === 'build' ? 'Build' : 'Squad'
}

function renderPendingApprovalCard(request: PendingRequestRow, description: string): DiscordMessagePayload {
  return {
    embeds: [
      {
        title: `Pending approval — ${boardTypeLabel(request.board_type)} ${actionLabel(request.action)}`,
        description: `${description}\n\nRequested by <@${request.requested_by}>.`,
        color: CARD_COLOR_PENDING
      }
    ],
    components: decisionButtons(request)
  }
}

function renderDecidedApprovalCard(
  request: PendingRequestRow,
  description: string,
  decidedBy: string,
  resultNote: string
): DiscordMessagePayload {
  const approved = request.status === 'approved'
  return {
    embeds: [
      {
        title: `${approved ? 'Approved ✅' : 'Rejected ❌'} — ${boardTypeLabel(request.board_type)} ${actionLabel(request.action)}`,
        description: `${description}\n\nRequested by <@${request.requested_by}>. ${approved ? 'Approved' : 'Rejected'} by <@${decidedBy}>.\n${resultNote}`,
        color: approved ? CARD_COLOR_APPROVED : CARD_COLOR_REJECTED
      }
    ],
    components: []
  }
}

/** Central Manual-mode gate every mutating build/squad command routes through, after its own
 *  pre-flight validation (share resolved, target found, board section exists, etc.) but *before*
 *  writing to `builds`/`squads` — see docs/discord-bot.md's "Approval workflow" section. Returns
 *  `null` when the caller should apply the change immediately (Automatic mode, or no
 *  `guild_settings` row at all — same "no row = the default" pattern used throughout this bot's
 *  D1 layer); returns a `DiscordMessagePayload` when Manual mode intercepted the action instead —
 *  the caller must return that payload as-is rather than applying anything, since a
 *  `pending_requests` row and an approvals-channel card have already been created here. */
export async function checkApprovalGate(
  ctx: CommandContext,
  boardType: BoardType,
  action: BoardAction,
  proposal: PendingProposal,
  describe: PendingRequestHandlers['describe']
): Promise<DiscordMessagePayload | null> {
  const settings = await getGuildSettings(ctx.env, ctx.guildId)
  if (!settings || settings.approval_mode === 'automatic') return null

  if (!settings.approver_role_id) {
    throw new UserError(
      'Manual approval mode is on for this server, but no approver role is set — ask an admin to run `/buildBoardConfig setApproverRole`.'
    )
  }
  if (!settings.approvals_channel_id) {
    throw new UserError(
      'Manual approval mode is on for this server, but no approvals channel is set — ask an admin to run `/buildBoardConfig approvalsChannel`.'
    )
  }

  const now = new Date().toISOString()
  const request = await insertPendingRequest(ctx.env, {
    guild_id: ctx.guildId,
    board_type: boardType,
    action,
    target_id: proposal.targetId,
    proposed_name: proposal.proposedName,
    proposed_share_id: proposal.proposedShareId,
    proposed_position: proposal.proposedPosition,
    requested_by: ctx.member.user.id,
    requested_at: now
  })

  const description = await describe(ctx.env, request)
  await createChannelMessage(ctx.env.DISCORD_BOT_TOKEN, settings.approvals_channel_id, renderPendingApprovalCard(request, description))

  return { content: `Submitted for approval in <#${settings.approvals_channel_id}> — an approver will review it.` }
}

/** Runs the actual work behind an Approve/Reject button click — called from `dispatch.ts`'s
 *  `runApprovalDecision` via `ctx.waitUntil`, after `interactions.ts` has already acked the
 *  interaction with `DEFERRED_UPDATE_MESSAGE` and separately verified the clicker holds
 *  `approver_role_id` (or is an admin) synchronously, before this ever got scheduled — nothing
 *  here re-checks that; only the pending/already-decided race, via `decidePendingRequest`'s atomic
 *  claim. `handlers` is keyed by board type so this function itself never needs to import
 *  `commands/builds.ts`/`squads.ts` — see `PendingRequestHandlers`'s doc comment. */
export async function decideApprovalRequest(
  env: Env,
  requestId: number,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  handlers: Record<BoardType, PendingRequestHandlers>
): Promise<DiscordMessagePayload> {
  const now = new Date().toISOString()
  const request = await decidePendingRequest(env, requestId, decision, decidedBy, now)

  if (!request) {
    const existing = await getPendingRequest(env, requestId)
    if (!existing) return { content: 'This approval request no longer exists.' }
    const description = await handlers[existing.board_type].describe(env, existing)
    return renderDecidedApprovalCard(
      existing,
      description,
      existing.decided_by ?? 'someone',
      'This request was already decided — no change made.'
    )
  }

  const description = await handlers[request.board_type].describe(env, request)

  if (decision === 'rejected') {
    return renderDecidedApprovalCard(request, description, decidedBy, 'No changes were made.')
  }

  try {
    const resultMessage = await handlers[request.board_type].apply(env, request)
    return renderDecidedApprovalCard(request, description, decidedBy, resultMessage)
  } catch (err) {
    const message = err instanceof UserError ? err.message : 'Something went wrong applying it.'
    if (!(err instanceof UserError)) console.error(`Approving pending request ${requestId} failed:`, err)
    return renderDecidedApprovalCard(request, description, decidedBy, `⚠️ Approved, but applying it failed: ${message}`)
  }
}
