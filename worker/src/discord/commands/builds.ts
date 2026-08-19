import {
  deleteBuild,
  getBoardMessage,
  getBuildById,
  getBuildByName,
  insertBuild,
  listBuildsByProfession,
  moveBuildToProfession,
  reorderBuildWithinProfession,
  updateBuild,
  type BuildRow,
  type PendingRequestRow
} from '../../db'
import type { Env } from '../../env'
import { escapeMarkdown, renderBuildSection } from '../../render/board'
import { asLikelyBuildFields } from '../../share-validate'
import { extractShareId, resolveShare } from '../../share-resolve'
import { editChannelMessage, type DiscordMessagePayload } from '../api'
import { checkApprovalGate } from '../approvals'
import type { CommandContext } from './context'
import { UserError } from '../errors'
import { requireActionPermission } from '../permissions'
import { integerOption, stringOption } from '../interaction-types'

/** Re-renders a profession's section from its current D1 rows and PATCHes the live board message
 *  in place — the "keep the message in sync" half of every mutating build command. Silently does
 *  nothing if that section was never set up (`/buildBoardSetup` not yet run); the write to
 *  `builds` itself already succeeded by the time this runs, so a missing board message is a
 *  display gap to fix with `/buildBoardRebuild` later, not a reason to fail the command. */
async function syncBuildSection(env: Env, guildId: string, profession: string): Promise<void> {
  const board = await getBoardMessage(env, guildId, 'build', profession)
  if (!board) return
  const builds = await listBuildsByProfession(env, guildId, profession)
  await editChannelMessage(env.DISCORD_BOT_TOKEN, board.channel_id, board.message_id, renderBuildSection(profession, builds))
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed')
}

// -------------------------------------------------------------------------------------------
// Apply — the actual D1 write + board resync for each action, shared between the Automatic-mode
// direct command path below and Phase 3's `applyPendingBuildRequest` (run once an Approve button
// click claims a pending request — see docs/discord-bot.md's "Approval workflow").
// -------------------------------------------------------------------------------------------

async function applyAdd(env: Env, guildId: string, name: string, shareId: string, profession: string, addedBy: string): Promise<BuildRow> {
  const now = new Date().toISOString()
  let build: BuildRow
  try {
    build = await insertBuild(env, {
      guild_id: guildId,
      name,
      share_id: shareId,
      profession,
      added_by: addedBy,
      added_at: now,
      updated_at: now
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new UserError(`A build named "${name}" already exists on this server.`)
    throw err
  }
  await syncBuildSection(env, guildId, build.profession)
  return build
}

async function applyRemove(env: Env, build: BuildRow): Promise<void> {
  await deleteBuild(env, build)
  await syncBuildSection(env, build.guild_id, build.profession)
}

interface EditResult {
  finalName: string
  oldProfession: string
  newProfession?: string
}

async function applyEdit(
  env: Env,
  build: BuildRow,
  newName: string | undefined,
  newShareId: string | undefined,
  newProfession: string | undefined
): Promise<EditResult> {
  const now = new Date().toISOString()
  const oldProfession = build.profession
  try {
    // `build`'s own `profession`/`sort_order` fields still hold their pre-edit values here (this
    // row was never re-fetched), so the reshuffle below — which only runs once this write has
    // already succeeded — still has the correct "old section" to compact.
    await updateBuild(env, build.id, { name: newName || undefined, shareId: newShareId, profession: newProfession, updatedAt: now })
    if (newProfession) await moveBuildToProfession(env, build, newProfession)
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new UserError(`A build named "${newName}" already exists on this server.`)
    throw err
  }

  await syncBuildSection(env, build.guild_id, oldProfession)
  if (newProfession) await syncBuildSection(env, build.guild_id, newProfession)

  return { finalName: newName || build.name, oldProfession, newProfession }
}

async function applyMove(env: Env, build: BuildRow, position: number): Promise<number> {
  const section = await listBuildsByProfession(env, build.guild_id, build.profession)
  const targetIndex = Math.min(position - 1, section.length - 1)
  await reorderBuildWithinProfession(env, build, targetIndex)
  await syncBuildSection(env, build.guild_id, build.profession)
  return targetIndex
}

/** Re-resolves a `newlink`/`proposed_share_id` value and checks it still points at a valid build
 *  with a set-up board section — shared by `buildEdit`'s live path and `applyPendingBuildRequest`'s
 *  edit case, which re-validates rather than trusting the link was still good by the time an
 *  approver clicked Approve. */
async function resolveAndValidateBuildLink(env: Env, linkOrShareId: string) {
  const share = await resolveShare(env, linkOrShareId)
  if (!share) throw new UserError("That link wasn't found — check it was copied correctly.")
  if (share.kind !== 'build') throw new UserError('That link is a squad link, not a build link.')
  const fields = asLikelyBuildFields(share.data)
  if (!fields) throw new UserError("That link doesn't look like a valid build.")
  return fields
}

async function requireBoardSetUp(env: Env, guildId: string, profession: string): Promise<void> {
  const board = await getBoardMessage(env, guildId, 'build', profession)
  if (!board) {
    throw new UserError(`The build board isn't set up yet for **${profession}** — ask an admin to run \`/buildBoardSetup\`.`)
  }
}

// -------------------------------------------------------------------------------------------
// Commands
// -------------------------------------------------------------------------------------------

export async function buildAdd(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const link = stringOption(ctx.options, 'link')
  const nameArg = stringOption(ctx.options, 'name')?.trim()
  if (!link) throw new UserError('A link is required.')

  await requireActionPermission(ctx.env, ctx.guildId, 'build', 'add', ctx.member)

  const fields = await resolveAndValidateBuildLink(ctx.env, link)
  const name = nameArg || fields.name
  if (!name) throw new UserError('A build name is required — the linked build has no name of its own either.')
  await requireBoardSetUp(ctx.env, ctx.guildId, fields.profession)

  const shareId = extractShareId(link)

  const gated = await checkApprovalGate(
    ctx,
    'build',
    'add',
    { targetId: null, proposedName: name, proposedShareId: shareId, proposedPosition: null },
    describePendingBuildRequest
  )
  if (gated) return gated

  const build = await applyAdd(ctx.env, ctx.guildId, name, shareId, fields.profession, ctx.member.user.id)
  return { content: `Added **${name}** to ${build.profession}'s section.` }
}

export async function buildRemove(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const name = stringOption(ctx.options, 'name')
  if (!name) throw new UserError('A build name is required.')

  await requireActionPermission(ctx.env, ctx.guildId, 'build', 'remove', ctx.member)

  const build = await getBuildByName(ctx.env, ctx.guildId, name)
  if (!build) throw new UserError(`No build named "${name}" found.`)

  const gated = await checkApprovalGate(
    ctx,
    'build',
    'remove',
    { targetId: build.id, proposedName: null, proposedShareId: null, proposedPosition: null },
    describePendingBuildRequest
  )
  if (gated) return gated

  await applyRemove(ctx.env, build)
  return { content: `Removed **${build.name}** from ${build.profession}'s section.` }
}

export async function buildEdit(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const name = stringOption(ctx.options, 'name')
  const newName = stringOption(ctx.options, 'newname')?.trim()
  const newLink = stringOption(ctx.options, 'newlink')
  if (!name) throw new UserError('A build name is required.')
  if (!newName && !newLink) throw new UserError('Provide a new name and/or a new link — nothing to change otherwise.')

  await requireActionPermission(ctx.env, ctx.guildId, 'build', 'edit', ctx.member)

  const build = await getBuildByName(ctx.env, ctx.guildId, name)
  if (!build) throw new UserError(`No build named "${name}" found.`)

  let newShareId: string | undefined
  if (newLink) {
    const fields = await resolveAndValidateBuildLink(ctx.env, newLink)
    newShareId = extractShareId(newLink)
    if (fields.profession !== build.profession) await requireBoardSetUp(ctx.env, ctx.guildId, fields.profession)
  }

  const gated = await checkApprovalGate(
    ctx,
    'build',
    'edit',
    { targetId: build.id, proposedName: newName || null, proposedShareId: newShareId ?? null, proposedPosition: null },
    describePendingBuildRequest
  )
  if (gated) return gated

  let newProfession: string | undefined
  if (newShareId) {
    // Re-derive rather than trust a captured closure value — cheap (already-resolved KV read) and
    // keeps this path identical in shape to `applyPendingBuildRequest`'s edit case below.
    const fields = await resolveAndValidateBuildLink(ctx.env, newShareId)
    if (fields.profession !== build.profession) newProfession = fields.profession
  }

  const result = await applyEdit(ctx.env, build, newName, newShareId, newProfession)
  return {
    content: result.newProfession
      ? `Updated **${result.finalName}** — moved from ${result.oldProfession} to ${result.newProfession}'s section.`
      : `Updated **${result.finalName}**.`
  }
}

export async function buildMove(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const name = stringOption(ctx.options, 'name')
  const position = integerOption(ctx.options, 'position')
  if (!name) throw new UserError('A build name is required.')
  if (position === undefined || !Number.isInteger(position) || position < 1) {
    throw new UserError('Position must be a positive whole number (1 = top of the section).')
  }

  await requireActionPermission(ctx.env, ctx.guildId, 'build', 'move', ctx.member)

  const build = await getBuildByName(ctx.env, ctx.guildId, name)
  if (!build) throw new UserError(`No build named "${name}" found.`)

  const gated = await checkApprovalGate(
    ctx,
    'build',
    'move',
    { targetId: build.id, proposedName: null, proposedShareId: null, proposedPosition: position },
    describePendingBuildRequest
  )
  if (gated) return gated

  const targetIndex = await applyMove(ctx.env, build, position)
  return { content: `Moved **${build.name}** to position ${targetIndex + 1} in ${build.profession}'s section.` }
}

// -------------------------------------------------------------------------------------------
// Phase 3 — Manual-mode approval card description + apply-on-Approve, dispatched from
// `dispatch.ts`'s `runApprovalDecision` via `approvals.ts`'s `PendingRequestHandlers`.
// -------------------------------------------------------------------------------------------

async function requireTargetBuild(env: Env, request: PendingRequestRow): Promise<BuildRow> {
  const build = request.target_id !== null ? await getBuildById(env, request.target_id) : null
  if (!build) throw new UserError('That build no longer exists.')
  return build
}

/** Human-readable summary of a pending build request for the approval card's embed — re-derives
 *  everything from the stored row rather than a cached snapshot, so the card is honest even if the
 *  target build changed (or vanished) between submission and decision. */
export async function describePendingBuildRequest(env: Env, request: PendingRequestRow): Promise<string> {
  if (request.action === 'add') {
    let professionNote = ''
    if (request.proposed_share_id) {
      const share = await resolveShare(env, request.proposed_share_id)
      const fields = share && share.kind === 'build' ? asLikelyBuildFields(share.data) : null
      if (fields) professionNote = ` to ${fields.profession}`
    }
    return `Add **${escapeMarkdown(request.proposed_name ?? 'unnamed')}**${professionNote}.`
  }

  const build = request.target_id !== null ? await getBuildById(env, request.target_id) : null
  const label = build ? `**${escapeMarkdown(build.name)}**` : `build #${request.target_id}`

  if (request.action === 'remove') return `Remove ${label}.`
  if (request.action === 'move') return `Move ${label} to position ${request.proposed_position}.`

  // edit
  const changes: string[] = []
  if (request.proposed_name) changes.push(`rename to **${escapeMarkdown(request.proposed_name)}**`)
  if (request.proposed_share_id) changes.push('replace its share link')
  return `Edit ${label} — ${changes.join(', ') || 'no changes'}.`
}

/** Which share id the approval card's Preview button (`dispatch.ts`'s `runApprovalPreview`)
 *  should render for a pending build request — the proposed new link if this request is
 *  introducing or replacing one (`add`, or `edit` with a new link), otherwise the target build's
 *  existing link (`edit` with no new link, `remove`, `move` — none of which change what the build
 *  itself contains, only its name/position). */
export async function resolvePendingBuildPreviewShareId(env: Env, request: PendingRequestRow): Promise<string> {
  if (request.proposed_share_id) return request.proposed_share_id
  const build = await requireTargetBuild(env, request)
  return build.share_id
}

/** Applies a decided (Approved) build request for real — called once per request, right after
 *  `decidePendingRequest` wins the claim race. Re-validates everything (share link still resolves,
 *  target build still exists, board section still set up) rather than trusting the state at
 *  submission time, since Manual mode's whole point is a delay between the two. */
export async function applyPendingBuildRequest(env: Env, request: PendingRequestRow): Promise<string> {
  switch (request.action) {
    case 'add': {
      if (!request.proposed_name || !request.proposed_share_id) throw new UserError('This request is missing required fields.')
      const share = await resolveShare(env, request.proposed_share_id)
      if (!share || share.kind !== 'build') throw new UserError('That build link is no longer available.')
      const fields = asLikelyBuildFields(share.data)
      if (!fields) throw new UserError('That build link is no longer valid.')
      await requireBoardSetUp(env, request.guild_id, fields.profession)
      const build = await applyAdd(env, request.guild_id, request.proposed_name, request.proposed_share_id, fields.profession, request.requested_by)
      return `Added **${build.name}** to ${build.profession}'s section.`
    }
    case 'remove': {
      const build = await requireTargetBuild(env, request)
      await applyRemove(env, build)
      return `Removed **${build.name}** from ${build.profession}'s section.`
    }
    case 'edit': {
      const build = await requireTargetBuild(env, request)
      let newProfession: string | undefined
      if (request.proposed_share_id) {
        const share = await resolveShare(env, request.proposed_share_id)
        if (!share || share.kind !== 'build') throw new UserError('That build link is no longer available.')
        const fields = asLikelyBuildFields(share.data)
        if (!fields) throw new UserError('That build link is no longer valid.')
        if (fields.profession !== build.profession) {
          await requireBoardSetUp(env, request.guild_id, fields.profession)
          newProfession = fields.profession
        }
      }
      const result = await applyEdit(env, build, request.proposed_name ?? undefined, request.proposed_share_id ?? undefined, newProfession)
      return result.newProfession
        ? `Updated **${result.finalName}** — moved from ${result.oldProfession} to ${result.newProfession}'s section.`
        : `Updated **${result.finalName}**.`
    }
    case 'move': {
      const build = await requireTargetBuild(env, request)
      if (request.proposed_position === null) throw new UserError('This request is missing required fields.')
      const targetIndex = await applyMove(env, build, request.proposed_position)
      return `Moved **${build.name}** to position ${targetIndex + 1} in ${build.profession}'s section.`
    }
    default:
      throw new UserError(`Unsupported action: ${request.action}`)
  }
}
