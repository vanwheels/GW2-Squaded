import {
  deleteSquad,
  getBoardMessage,
  getSquadById,
  getSquadByName,
  insertSquad,
  listSquads,
  updateSquad,
  type PendingRequestRow,
  type SquadRow
} from '../../db'
import type { Env } from '../../env'
import { SQUAD_BOARD_CATEGORY } from '../../professions'
import { escapeMarkdown, renderSquadSection } from '../../render/board'
import { asLikelySquadCompFields } from '../../share-validate'
import { extractShareId, resolveShare } from '../../share-resolve'
import { editChannelMessage, type DiscordMessagePayload } from '../api'
import { checkApprovalGate } from '../approvals'
import type { CommandContext } from './context'
import { UserError } from '../errors'
import { requireActionPermission } from '../permissions'
import { stringOption } from '../interaction-types'

/** Same "re-render from D1, PATCH in place, no-op if the board was never set up" shape as
 *  `builds.ts`'s `syncBuildSection` — squads have one section instead of nine. */
async function syncSquadSection(env: Env, guildId: string): Promise<void> {
  const board = await getBoardMessage(env, guildId, 'squad', SQUAD_BOARD_CATEGORY)
  if (!board) return
  const squads = await listSquads(env, guildId)
  await editChannelMessage(env.DISCORD_BOT_TOKEN, board.channel_id, board.message_id, renderSquadSection(squads, env.PUBLIC_ORIGIN))
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed')
}

// -------------------------------------------------------------------------------------------
// Apply — the actual D1 write + board resync for each action, shared between the Automatic-mode
// direct command path below and Phase 3's `applyPendingSquadRequest`, same split as builds.ts.
// -------------------------------------------------------------------------------------------

async function applyAdd(env: Env, guildId: string, name: string, shareId: string, addedBy: string): Promise<SquadRow> {
  const now = new Date().toISOString()
  let squad: SquadRow
  try {
    squad = await insertSquad(env, { guild_id: guildId, name, share_id: shareId, added_by: addedBy, added_at: now, updated_at: now })
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new UserError(`A squad named "${name}" already exists on this server.`)
    throw err
  }
  await syncSquadSection(env, guildId)
  return squad
}

async function applyRemove(env: Env, squad: SquadRow): Promise<void> {
  await deleteSquad(env, squad)
  await syncSquadSection(env, squad.guild_id)
}

async function applyEdit(env: Env, squad: SquadRow, newName: string | undefined, newShareId: string | undefined): Promise<string> {
  const now = new Date().toISOString()
  try {
    await updateSquad(env, squad.id, { name: newName || undefined, shareId: newShareId, updatedAt: now })
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new UserError(`A squad named "${newName}" already exists on this server.`)
    throw err
  }
  await syncSquadSection(env, squad.guild_id)
  return newName || squad.name
}

async function resolveAndValidateSquadLink(env: Env, linkOrShareId: string) {
  const share = await resolveShare(env, linkOrShareId)
  if (!share) throw new UserError("That link wasn't found — check it was copied correctly.")
  if (share.kind !== 'squadComp') throw new UserError('That link is a build link, not a squad link.')
  const fields = asLikelySquadCompFields(share.data)
  if (!fields) throw new UserError("That link doesn't look like a valid squad composition.")
  return fields
}

// -------------------------------------------------------------------------------------------
// Commands
// -------------------------------------------------------------------------------------------

export async function squadAdd(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const link = stringOption(ctx.options, 'link')
  const nameArg = stringOption(ctx.options, 'name')?.trim()
  if (!link) throw new UserError('A link is required.')

  await requireActionPermission(ctx.env, ctx.guildId, 'squad', 'add', ctx.member)

  const fields = await resolveAndValidateSquadLink(ctx.env, link)
  const name = nameArg || fields.name
  if (!name) throw new UserError('A squad name is required — the linked squad has no name of its own either.')

  const board = await getBoardMessage(ctx.env, ctx.guildId, 'squad', SQUAD_BOARD_CATEGORY)
  if (!board) throw new UserError("The squad board isn't set up yet — ask an admin to run `/squadBoardSetup`.")

  const shareId = extractShareId(link)

  const gated = await checkApprovalGate(
    ctx,
    'squad',
    'add',
    { targetId: null, proposedName: name, proposedShareId: shareId, proposedPosition: null },
    describePendingSquadRequest
  )
  if (gated) return gated

  const squad = await applyAdd(ctx.env, ctx.guildId, name, shareId, ctx.member.user.id)
  return { content: `Added **${squad.name}** to the squad board.` }
}

export async function squadRemove(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const name = stringOption(ctx.options, 'name')
  if (!name) throw new UserError('A squad name is required.')

  await requireActionPermission(ctx.env, ctx.guildId, 'squad', 'remove', ctx.member)

  const squad = await getSquadByName(ctx.env, ctx.guildId, name)
  if (!squad) throw new UserError(`No squad named "${name}" found.`)

  const gated = await checkApprovalGate(
    ctx,
    'squad',
    'remove',
    { targetId: squad.id, proposedName: null, proposedShareId: null, proposedPosition: null },
    describePendingSquadRequest
  )
  if (gated) return gated

  await applyRemove(ctx.env, squad)
  return { content: `Removed **${squad.name}** from the squad board.` }
}

export async function squadEdit(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const name = stringOption(ctx.options, 'name')
  const newName = stringOption(ctx.options, 'newname')?.trim()
  const newLink = stringOption(ctx.options, 'newlink')
  if (!name) throw new UserError('A squad name is required.')
  if (!newName && !newLink) throw new UserError('Provide a new name and/or a new link — nothing to change otherwise.')

  await requireActionPermission(ctx.env, ctx.guildId, 'squad', 'edit', ctx.member)

  const squad = await getSquadByName(ctx.env, ctx.guildId, name)
  if (!squad) throw new UserError(`No squad named "${name}" found.`)

  let newShareId: string | undefined
  if (newLink) {
    await resolveAndValidateSquadLink(ctx.env, newLink)
    newShareId = extractShareId(newLink)
  }

  const gated = await checkApprovalGate(
    ctx,
    'squad',
    'edit',
    { targetId: squad.id, proposedName: newName || null, proposedShareId: newShareId ?? null, proposedPosition: null },
    describePendingSquadRequest
  )
  if (gated) return gated

  const finalName = await applyEdit(ctx.env, squad, newName, newShareId)
  return { content: `Updated **${finalName}**.` }
}

// -------------------------------------------------------------------------------------------
// Phase 3 — Manual-mode approval card description + apply-on-Approve, dispatched from
// `dispatch.ts`'s `runApprovalDecision` via `approvals.ts`'s `PendingRequestHandlers`. Squads
// have no `/squadMove` in v1 (see docs/discord-bot.md), so unlike `builds.ts` there's no 'move'
// case to handle here.
// -------------------------------------------------------------------------------------------

async function requireTargetSquad(env: Env, request: PendingRequestRow): Promise<SquadRow> {
  const squad = request.target_id !== null ? await getSquadById(env, request.target_id) : null
  if (!squad) throw new UserError('That squad no longer exists.')
  return squad
}

/** Which share id the approval card's Preview button (`dispatch.ts`'s `runApprovalPreview`) should
 *  render for a pending squad request — same reasoning as `builds.ts`'s
 *  `resolvePendingBuildPreviewShareId`: the proposed new link if this request is introducing or
 *  replacing one (`add`, or `edit` with a new link), otherwise the target squad's existing link
 *  (`edit` with no new link, `remove` — squads have no `/squadMove`, see this file's Phase 3
 *  section header). */
export async function resolvePendingSquadPreviewShareId(env: Env, request: PendingRequestRow): Promise<string> {
  if (request.proposed_share_id) return request.proposed_share_id
  const squad = await requireTargetSquad(env, request)
  return squad.share_id
}

export async function describePendingSquadRequest(env: Env, request: PendingRequestRow): Promise<string> {
  if (request.action === 'add') {
    return `Add **${escapeMarkdown(request.proposed_name ?? 'unnamed')}** to the squad board.`
  }

  const squad = request.target_id !== null ? await getSquadById(env, request.target_id) : null
  const label = squad ? `**${escapeMarkdown(squad.name)}**` : `squad #${request.target_id}`

  if (request.action === 'remove') return `Remove ${label}.`

  // edit
  const changes: string[] = []
  if (request.proposed_name) changes.push(`rename to **${escapeMarkdown(request.proposed_name)}**`)
  if (request.proposed_share_id) changes.push('replace its share link')
  return `Edit ${label} — ${changes.join(', ') || 'no changes'}.`
}

export async function applyPendingSquadRequest(env: Env, request: PendingRequestRow): Promise<string> {
  switch (request.action) {
    case 'add': {
      if (!request.proposed_name || !request.proposed_share_id) throw new UserError('This request is missing required fields.')
      const share = await resolveShare(env, request.proposed_share_id)
      if (!share || share.kind !== 'squadComp') throw new UserError('That squad link is no longer available.')
      if (!asLikelySquadCompFields(share.data)) throw new UserError('That squad link is no longer valid.')
      const board = await getBoardMessage(env, request.guild_id, 'squad', SQUAD_BOARD_CATEGORY)
      if (!board) throw new UserError("The squad board isn't set up anymore.")
      const squad = await applyAdd(env, request.guild_id, request.proposed_name, request.proposed_share_id, request.requested_by)
      return `Added **${squad.name}** to the squad board.`
    }
    case 'remove': {
      const squad = await requireTargetSquad(env, request)
      await applyRemove(env, squad)
      return `Removed **${squad.name}** from the squad board.`
    }
    case 'edit': {
      const squad = await requireTargetSquad(env, request)
      if (request.proposed_share_id) {
        const share = await resolveShare(env, request.proposed_share_id)
        if (!share || share.kind !== 'squadComp') throw new UserError('That squad link is no longer available.')
        if (!asLikelySquadCompFields(share.data)) throw new UserError('That squad link is no longer valid.')
      }
      const finalName = await applyEdit(env, squad, request.proposed_name ?? undefined, request.proposed_share_id ?? undefined)
      return `Updated **${finalName}**.`
    }
    default:
      throw new UserError(`Unsupported action: ${request.action}`)
  }
}
