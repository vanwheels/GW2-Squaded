import {
  getBoardMessage,
  listBuildsByProfession,
  listSquads,
  setActionPermission,
  upsertBoardMessage,
  type BoardAction,
  type BoardType
} from '../../db'
import { isProfession, PROFESSIONS, SQUAD_BOARD_CATEGORY } from '../../professions'
import { renderBuildSection, renderSquadSection } from '../../render/board'
import { createChannelMessage } from '../api'
import type { DiscordMessagePayload } from '../api'
import type { CommandContext } from './context'
import { UserError } from '../errors'
import { stringOption } from '../interaction-types'

const BOARD_ACTIONS: readonly BoardAction[] = ['add', 'edit', 'remove', 'move']
const BOARD_TYPES: readonly BoardType[] = ['build', 'squad']

function requireChannelOption(ctx: CommandContext): string {
  return stringOption(ctx.options, 'channel') ?? ctx.channelId
}

/** Posts the 9 empty profession messages into the target channel and records them in
 *  `board_messages`. Errors if the build board already has any section set up for this guild —
 *  re-running is `/buildBoardRebuild`'s job (per-profession), not this command's, so a second
 *  `/buildBoardSetup` can't silently spam a channel with a duplicate set of 9 messages. */
export async function buildBoardSetup(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const existing = await getBoardMessage(ctx.env, ctx.guildId, 'build', PROFESSIONS[0])
  if (existing) {
    throw new UserError('The build board is already set up for this server — use `/buildBoardRebuild` to recreate a missing section.')
  }

  const channelId = requireChannelOption(ctx)
  for (const profession of PROFESSIONS) {
    const message = await createChannelMessage(ctx.env.DISCORD_BOT_TOKEN, channelId, renderBuildSection(profession, []))
    await upsertBoardMessage(ctx.env, ctx.guildId, 'build', profession, channelId, message.id)
  }

  return { content: `Build board set up in <#${channelId}> — ${PROFESSIONS.length} profession sections posted.` }
}

/** Recreates one profession's board message — for when it was deleted out-of-band in Discord.
 *  Reuses the previously-recorded channel unless `channel` is given, rebuilding the message's
 *  content from the `builds` rows that already exist in D1 (nothing here is lost by a message
 *  getting deleted; only the Discord-side message id needs replacing). */
export async function buildBoardRebuild(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const profession = stringOption(ctx.options, 'profession')
  if (!profession || !isProfession(profession)) throw new UserError('Unknown profession.')

  const existing = await getBoardMessage(ctx.env, ctx.guildId, 'build', profession)
  const channelId = stringOption(ctx.options, 'channel') ?? existing?.channel_id ?? ctx.channelId

  const builds = await listBuildsByProfession(ctx.env, ctx.guildId, profession)
  const message = await createChannelMessage(ctx.env.DISCORD_BOT_TOKEN, channelId, renderBuildSection(profession, builds))
  await upsertBoardMessage(ctx.env, ctx.guildId, 'build', profession, channelId, message.id)

  return { content: `${profession}'s build board section rebuilt in <#${channelId}>.` }
}

export async function squadBoardSetup(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const existing = await getBoardMessage(ctx.env, ctx.guildId, 'squad', SQUAD_BOARD_CATEGORY)
  if (existing) {
    throw new UserError('The squad board is already set up for this server — use `/squadBoardRebuild` to recreate it.')
  }

  const channelId = requireChannelOption(ctx)
  const message = await createChannelMessage(ctx.env.DISCORD_BOT_TOKEN, channelId, renderSquadSection([]))
  await upsertBoardMessage(ctx.env, ctx.guildId, 'squad', SQUAD_BOARD_CATEGORY, channelId, message.id)

  return { content: `Squad board set up in <#${channelId}>.` }
}

export async function squadBoardRebuild(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const existing = await getBoardMessage(ctx.env, ctx.guildId, 'squad', SQUAD_BOARD_CATEGORY)
  const channelId = stringOption(ctx.options, 'channel') ?? existing?.channel_id ?? ctx.channelId

  const squads = await listSquads(ctx.env, ctx.guildId)
  const message = await createChannelMessage(ctx.env.DISCORD_BOT_TOKEN, channelId, renderSquadSection(squads))
  await upsertBoardMessage(ctx.env, ctx.guildId, 'squad', SQUAD_BOARD_CATEGORY, channelId, message.id)

  return { content: `Squad board rebuilt in <#${channelId}>.` }
}

/** `/buildBoardConfig setPermission` — the only Phase 2 subcommand of `buildBoardConfig` (the
 *  approval-mode/approver-role/visibility/approvals-channel subcommands from
 *  docs/discord-bot.md's design land in Phase 3). Governs both board types despite the command's
 *  `build`-flavored name — see that doc's "Board admin" table; a single admin-facing config
 *  command was chosen over separate `/buildBoardConfig`/`/squadBoardConfig` commands, so it takes
 *  its own `boardType` argument instead. */
export async function buildBoardConfigSetPermission(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const boardType = stringOption(ctx.options, 'boardtype')
  const action = stringOption(ctx.options, 'action')
  const roleId = stringOption(ctx.options, 'role')

  if (!boardType || !(BOARD_TYPES as string[]).includes(boardType)) throw new UserError('Unknown board type.')
  if (!action || !(BOARD_ACTIONS as string[]).includes(action)) throw new UserError('Unknown action.')
  if (!roleId) throw new UserError('A role is required.')

  await setActionPermission(ctx.env, ctx.guildId, boardType as BoardType, action as BoardAction, roleId)

  return { content: `\`${boardType} ${action}\` now requires the <@&${roleId}> role.` }
}
