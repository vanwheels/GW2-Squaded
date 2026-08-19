import { getBuildById, getPendingRequest, type BoardType } from '../db'
import type { Env } from '../env'
import { renderBuildScreenshot } from '../render/build-screenshot'
import { editOriginalInteractionResponse, type DiscordMessagePayload } from './api'
import { decideApprovalRequest, type PendingRequestHandlers } from './approvals'
import {
  buildBoardConfigApprovalMode,
  buildBoardConfigApprovalsChannel,
  buildBoardConfigSetApproverRole,
  buildBoardConfigSetPermission,
  buildBoardRebuild,
  buildBoardSetup,
  squadBoardRebuild,
  squadBoardSetup
} from './commands/board-admin'
import {
  applyPendingBuildRequest,
  buildAdd,
  buildEdit,
  buildMove,
  buildRemove,
  describePendingBuildRequest,
  resolvePendingBuildPreviewShareId
} from './commands/builds'
import { buildDisplay, squadDisplay } from './commands/display'
import { applyPendingSquadRequest, squadAdd, squadEdit, squadRemove, describePendingSquadRequest } from './commands/squads'
import type { CommandContext } from './commands/context'
import { UserError } from './errors'
import type { DiscordInteraction, InteractionOption } from './interaction-types'
import { subcommand } from './interaction-types'

/** Supplies `approvals.ts`'s `decideApprovalRequest` with each board type's describe/apply pair —
 *  kept here (not in `approvals.ts` itself) to avoid a module import cycle, since `commands/
 *  builds.ts`/`squads.ts` import `checkApprovalGate` from `approvals.ts`. See that file's
 *  `PendingRequestHandlers` doc comment. */
const BOARD_REQUEST_HANDLERS: Record<BoardType, PendingRequestHandlers> = {
  build: { describe: describePendingBuildRequest, apply: applyPendingBuildRequest },
  squad: { describe: describePendingSquadRequest, apply: applyPendingSquadRequest }
}

type CommandHandler = (ctx: CommandContext) => Promise<DiscordMessagePayload>

/** Every flat (no-subcommand) command this bot handles, keyed by its registered name — Discord
 *  requires CHAT_INPUT command names to be all-lowercase, so these don't match
 *  docs/discord-bot.md's camelCase command names verbatim (`/buildAdd` there is `buildadd` here);
 *  `scripts/register-commands.ts` registers the same lowercase names. */
const COMMANDS: Record<string, CommandHandler | undefined> = {
  buildadd: buildAdd,
  buildremove: buildRemove,
  buildedit: buildEdit,
  buildmove: buildMove,
  builddisplay: buildDisplay,
  squadadd: squadAdd,
  squadremove: squadRemove,
  squadedit: squadEdit,
  squaddisplay: squadDisplay,
  buildboardsetup: buildBoardSetup,
  buildboardrebuild: buildBoardRebuild,
  squadboardsetup: squadBoardSetup,
  squadboardrebuild: squadBoardRebuild
}

/** Resolves a command name (+ its raw top-level options) to the handler that should run and the
 *  option list *that handler* should see. Only `buildboardconfig` has a subcommand layer today
 *  (`setpermission`) — its handler gets that subcommand's own nested options rather than the
 *  top-level list, so every handler can read its arguments the same flat way regardless of
 *  whether its command has subcommands. Returns `null` for an unknown command/subcommand. */
export function resolveHandler(
  commandName: string,
  topLevelOptions: InteractionOption[] | undefined
): { handler: CommandHandler; options: InteractionOption[] } | null {
  if (commandName === 'buildboardconfig') {
    const sub = subcommand(topLevelOptions)
    if (sub?.name === 'setpermission') return { handler: buildBoardConfigSetPermission, options: sub.options ?? [] }
    if (sub?.name === 'approvalmode') return { handler: buildBoardConfigApprovalMode, options: sub.options ?? [] }
    if (sub?.name === 'setapproverrole') return { handler: buildBoardConfigSetApproverRole, options: sub.options ?? [] }
    if (sub?.name === 'approvalschannel') return { handler: buildBoardConfigApprovalsChannel, options: sub.options ?? [] }
    return null
  }
  const handler = COMMANDS[commandName]
  return handler ? { handler, options: topLevelOptions ?? [] } : null
}

/** Runs a command's handler and PATCHes the deferred placeholder response with the real result —
 *  called via `ctx.waitUntil` from `interactions.ts` after the initial DEFERRED response has
 *  already been sent, so it has no return value Discord is waiting on. A `UserError` becomes its
 *  own message verbatim; anything else is logged and replaced with a generic failure message so a
 *  raw stack trace never reaches a Discord user.
 *
 *  Note this means `handler`'s own work (D1 writes, board-message PATCHes) can succeed even when
 *  the *followup* below fails to reach Discord — the caller would then see no response at all
 *  despite the action having actually gone through. That gap is why the followup itself gets one
 *  retry rather than a bare `await`: a transient failure here is otherwise silent (nothing else
 *  is watching this `ctx.waitUntil`'d call), and a lost followup reads to the user as "nothing
 *  happened" even when it did. */
export async function runCommand(
  env: Env,
  interaction: DiscordInteraction,
  handler: CommandHandler,
  options: InteractionOption[]
): Promise<void> {
  let payload: DiscordMessagePayload
  try {
    const ctx: CommandContext = {
      env,
      guildId: interaction.guild_id!,
      channelId: interaction.channel_id!,
      member: interaction.member!,
      options
    }
    payload = await handler(ctx)
  } catch (err) {
    if (err instanceof UserError) {
      payload = { content: err.message }
    } else {
      console.error(`Command /${interaction.data?.name} failed:`, err)
      payload = { content: 'Something went wrong running that command. Try again, or check with an admin if it keeps happening.' }
    }
  }

  await deliverInteractionResult(interaction, payload)
}

/** Runs the Approve/Reject decision behind a Phase 3 button click and delivers the result — the
 *  `MESSAGE_COMPONENT` counterpart to `runCommand` above, called the same way (`ctx.waitUntil`
 *  from `interactions.ts`, after that file already acked with `DEFERRED_UPDATE_MESSAGE` and
 *  checked the clicker holds `approver_role_id`). See `approvals.ts`'s `decideApprovalRequest` for
 *  the actual decide-and-apply logic; this just supplies the board-type handler table and reuses
 *  `deliverInteractionResult`'s retry-wrapped `@original` PATCH, which for this interaction type
 *  edits the approval card message itself rather than a command's ephemeral followup. */
export async function runApprovalDecision(
  env: Env,
  interaction: DiscordInteraction,
  requestId: number,
  decision: 'approved' | 'rejected'
): Promise<void> {
  let payload: DiscordMessagePayload
  try {
    payload = await decideApprovalRequest(env, requestId, decision, interaction.member!.user.id, BOARD_REQUEST_HANDLERS)
  } catch (err) {
    console.error(`Deciding approval request ${requestId} failed:`, err)
    payload = { content: 'Something went wrong deciding this request.' }
  }

  await deliverInteractionResult(interaction, payload)
}

/** Renders and delivers a Preview button click's screenshot — the `MESSAGE_COMPONENT` counterpart
 *  to `runCommand` that behaves like a *command*, not a decision: `interactions.ts` acks this one
 *  with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (ephemeral), same as a slash command, rather than
 *  `DEFERRED_UPDATE_MESSAGE` — a new message, so `editOriginalInteractionResponse`'s `@original`
 *  resolves to that new ephemeral message and the approval card underneath is never touched. Only
 *  wired for `build` requests (`decisionButtons` in `approvals.ts` only puts the button on those),
 *  but checks `board_type` again here anyway rather than trusting the button that was clicked. */
export async function runApprovalPreview(env: Env, interaction: DiscordInteraction, requestId: number): Promise<void> {
  let payload: DiscordMessagePayload
  try {
    const request = await getPendingRequest(env, requestId)
    if (!request) {
      payload = { content: 'This approval request no longer exists.' }
    } else if (request.board_type !== 'build') {
      payload = { content: "Preview isn't available for squad requests yet." }
    } else {
      const shareId = await resolvePendingBuildPreviewShareId(env, request)
      const png = await renderBuildScreenshot(env, shareId)
      payload = { file: { filename: 'build.png', contentType: 'image/png', data: png } }
    }
  } catch (err) {
    if (err instanceof UserError) {
      payload = { content: err.message }
    } else {
      console.error(`Previewing pending request ${requestId} failed:`, err)
      payload = { content: 'Something went wrong rendering that preview.' }
    }
  }

  await deliverInteractionResult(interaction, payload)
}

/** Renders and delivers a board section's "Preview a build…" select menu pick — the
 *  `MESSAGE_COMPONENT` counterpart to `runApprovalPreview` above for the board itself rather than
 *  an approval card, so it looks the build up directly by id (`render/board.ts`'s
 *  `buildPreviewSelectRow` uses `builds.id` as each option's value) instead of going through a
 *  `pending_requests` row. Same ack shape as a slash command (`DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`,
 *  a new ephemeral message) — the board message itself is never touched by a Preview selection. */
export async function runBoardBuildPreview(env: Env, interaction: DiscordInteraction, buildId: number): Promise<void> {
  let payload: DiscordMessagePayload
  try {
    const build = await getBuildById(env, buildId)
    if (!build) {
      payload = { content: 'That build is no longer on the board — try picking again, the list may be stale.' }
    } else {
      const png = await renderBuildScreenshot(env, build.share_id)
      payload = { file: { filename: 'build.png', contentType: 'image/png', data: png } }
    }
  } catch (err) {
    if (err instanceof UserError) {
      payload = { content: err.message }
    } else {
      console.error(`Previewing board build ${buildId} failed:`, err)
      payload = { content: 'Something went wrong rendering that preview.' }
    }
  }

  await deliverInteractionResult(interaction, payload)
}

/** Shared tail of both `runCommand` and `runApprovalDecision` — PATCHes the interaction's
 *  `@original` response with one retry, per the doc comment above on why a lost followup here
 *  reads to the user as "nothing happened" even when the underlying D1 write/apply already
 *  succeeded. */
async function deliverInteractionResult(interaction: DiscordInteraction, payload: DiscordMessagePayload): Promise<void> {
  try {
    await editOriginalInteractionResponse(interaction.application_id, interaction.token, payload)
  } catch (err) {
    console.error(`Delivering the result of interaction ${interaction.id} failed, retrying once:`, err)
    try {
      await editOriginalInteractionResponse(interaction.application_id, interaction.token, payload)
    } catch (retryErr) {
      // Nothing left to do — Discord's own client-side "the application did not respond"-style
      // messaging is the honest outcome here. Logged so `wrangler tail`/the dashboard surfaces it
      // rather than it vanishing as a silent unhandled rejection.
      console.error(`Delivering the result of interaction ${interaction.id} failed twice, giving up:`, retryErr)
    }
  }
}
