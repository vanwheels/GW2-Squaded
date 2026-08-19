import { deleteSquad, getBoardMessage, getSquadByName, insertSquad, listSquads, updateSquad, type SquadRow } from '../../db'
import type { Env } from '../../env'
import { SQUAD_BOARD_CATEGORY } from '../../professions'
import { renderSquadSection } from '../../render/board'
import { asLikelySquadCompFields } from '../../share-validate'
import { extractShareId, resolveShare } from '../../share-resolve'
import { editChannelMessage, type DiscordMessagePayload } from '../api'
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
  await editChannelMessage(env.DISCORD_BOT_TOKEN, board.channel_id, board.message_id, renderSquadSection(squads))
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed')
}

export async function squadAdd(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const link = stringOption(ctx.options, 'link')
  const nameArg = stringOption(ctx.options, 'name')?.trim()
  if (!link) throw new UserError('A link is required.')

  await requireActionPermission(ctx.env, ctx.guildId, 'squad', 'add', ctx.member)

  const share = await resolveShare(ctx.env, link)
  if (!share) throw new UserError("That link wasn't found — check it was copied correctly.")
  if (share.kind !== 'squadComp') throw new UserError('That link is a build link, not a squad link.')

  const fields = asLikelySquadCompFields(share.data)
  if (!fields) throw new UserError("That link doesn't look like a valid squad composition.")

  const name = nameArg || fields.name
  if (!name) throw new UserError('A squad name is required — the linked squad has no name of its own either.')

  const board = await getBoardMessage(ctx.env, ctx.guildId, 'squad', SQUAD_BOARD_CATEGORY)
  if (!board) throw new UserError("The squad board isn't set up yet — ask an admin to run `/squadBoardSetup`.")

  const now = new Date().toISOString()
  let squad: SquadRow
  try {
    squad = await insertSquad(ctx.env, {
      guild_id: ctx.guildId,
      name,
      share_id: extractShareId(link),
      added_by: ctx.member.user.id,
      added_at: now,
      updated_at: now
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new UserError(`A squad named "${name}" already exists on this server.`)
    throw err
  }

  await syncSquadSection(ctx.env, ctx.guildId)
  return { content: `Added **${squad.name}** to the squad board.` }
}

export async function squadRemove(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const name = stringOption(ctx.options, 'name')
  if (!name) throw new UserError('A squad name is required.')

  await requireActionPermission(ctx.env, ctx.guildId, 'squad', 'remove', ctx.member)

  const squad = await getSquadByName(ctx.env, ctx.guildId, name)
  if (!squad) throw new UserError(`No squad named "${name}" found.`)

  await deleteSquad(ctx.env, squad)
  await syncSquadSection(ctx.env, ctx.guildId)
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
    const share = await resolveShare(ctx.env, newLink)
    if (!share) throw new UserError("That link wasn't found — check it was copied correctly.")
    if (share.kind !== 'squadComp') throw new UserError('That link is a build link, not a squad link.')
    if (!asLikelySquadCompFields(share.data)) throw new UserError("That link doesn't look like a valid squad composition.")
    newShareId = extractShareId(newLink)
  }

  const now = new Date().toISOString()
  try {
    await updateSquad(ctx.env, squad.id, { name: newName || undefined, shareId: newShareId, updatedAt: now })
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new UserError(`A squad named "${newName}" already exists on this server.`)
    throw err
  }

  await syncSquadSection(ctx.env, ctx.guildId)
  return { content: `Updated **${newName || squad.name}**.` }
}
