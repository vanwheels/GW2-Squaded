import {
  deleteBuild,
  getBoardMessage,
  getBuildByName,
  insertBuild,
  listBuildsByProfession,
  moveBuildToProfession,
  reorderBuildWithinProfession,
  updateBuild,
  type BuildRow
} from '../../db'
import type { Env } from '../../env'
import { renderBuildSection } from '../../render/board'
import { asLikelyBuildFields } from '../../share-validate'
import { extractShareId, resolveShare } from '../../share-resolve'
import { editChannelMessage, type DiscordMessagePayload } from '../api'
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

export async function buildAdd(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const link = stringOption(ctx.options, 'link')
  const nameArg = stringOption(ctx.options, 'name')?.trim()
  if (!link) throw new UserError('A link is required.')

  await requireActionPermission(ctx.env, ctx.guildId, 'build', 'add', ctx.member)

  const share = await resolveShare(ctx.env, link)
  if (!share) throw new UserError("That link wasn't found — check it was copied correctly.")
  if (share.kind !== 'build') throw new UserError('That link is a squad link, not a build link.')

  const fields = asLikelyBuildFields(share.data)
  if (!fields) throw new UserError("That link doesn't look like a valid build.")

  const name = nameArg || fields.name
  if (!name) throw new UserError('A build name is required — the linked build has no name of its own either.')

  const board = await getBoardMessage(ctx.env, ctx.guildId, 'build', fields.profession)
  if (!board) {
    throw new UserError(`The build board isn't set up yet for **${fields.profession}** — ask an admin to run \`/buildBoardSetup\`.`)
  }

  const now = new Date().toISOString()
  let build: BuildRow
  try {
    build = await insertBuild(ctx.env, {
      guild_id: ctx.guildId,
      name,
      share_id: extractShareId(link),
      profession: fields.profession,
      added_by: ctx.member.user.id,
      added_at: now,
      updated_at: now
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new UserError(`A build named "${name}" already exists on this server.`)
    throw err
  }

  await syncBuildSection(ctx.env, ctx.guildId, build.profession)
  return { content: `Added **${name}** to ${build.profession}'s section.` }
}

export async function buildRemove(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const name = stringOption(ctx.options, 'name')
  if (!name) throw new UserError('A build name is required.')

  await requireActionPermission(ctx.env, ctx.guildId, 'build', 'remove', ctx.member)

  const build = await getBuildByName(ctx.env, ctx.guildId, name)
  if (!build) throw new UserError(`No build named "${name}" found.`)

  await deleteBuild(ctx.env, build)
  await syncBuildSection(ctx.env, ctx.guildId, build.profession)
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

  const now = new Date().toISOString()
  let newProfession: string | undefined
  let newShareId: string | undefined

  if (newLink) {
    const share = await resolveShare(ctx.env, newLink)
    if (!share) throw new UserError("That link wasn't found — check it was copied correctly.")
    if (share.kind !== 'build') throw new UserError('That link is a squad link, not a build link.')
    const fields = asLikelyBuildFields(share.data)
    if (!fields) throw new UserError("That link doesn't look like a valid build.")

    newShareId = extractShareId(newLink)
    if (fields.profession !== build.profession) {
      const targetBoard = await getBoardMessage(ctx.env, ctx.guildId, 'build', fields.profession)
      if (!targetBoard) {
        throw new UserError(`The build board isn't set up yet for **${fields.profession}** — ask an admin to run \`/buildBoardSetup\`.`)
      }
      newProfession = fields.profession
    }
  }

  const oldProfession = build.profession
  try {
    // The name-conflict-checked write goes first: if it throws, nothing else has touched
    // `sort_order` yet. `build`'s own `profession`/`sort_order` fields still hold their pre-edit
    // values here (this row was never re-fetched), so the reshuffle below — which only runs once
    // this write has already succeeded — still has the correct "old section" to compact.
    await updateBuild(ctx.env, build.id, {
      name: newName || undefined,
      shareId: newShareId,
      profession: newProfession,
      updatedAt: now
    })
    if (newProfession) await moveBuildToProfession(ctx.env, build, newProfession)
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new UserError(`A build named "${newName}" already exists on this server.`)
    throw err
  }

  await syncBuildSection(ctx.env, ctx.guildId, oldProfession)
  if (newProfession) await syncBuildSection(ctx.env, ctx.guildId, newProfession)

  const finalName = newName || build.name
  return {
    content: newProfession
      ? `Updated **${finalName}** — moved from ${oldProfession} to ${newProfession}'s section.`
      : `Updated **${finalName}**.`
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

  const section = await listBuildsByProfession(ctx.env, ctx.guildId, build.profession)
  const targetIndex = Math.min(position - 1, section.length - 1)

  await reorderBuildWithinProfession(ctx.env, build, targetIndex)
  await syncBuildSection(ctx.env, ctx.guildId, build.profession)
  return { content: `Moved **${build.name}** to position ${targetIndex + 1} in ${build.profession}'s section.` }
}
