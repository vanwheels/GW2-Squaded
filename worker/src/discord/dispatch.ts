import type { Env } from '../env'
import { editOriginalInteractionResponse, type DiscordMessagePayload } from './api'
import { buildBoardConfigSetPermission, buildBoardRebuild, buildBoardSetup, squadBoardRebuild, squadBoardSetup } from './commands/board-admin'
import { buildAdd, buildEdit, buildMove, buildRemove } from './commands/builds'
import { squadAdd, squadEdit, squadRemove } from './commands/squads'
import type { CommandContext } from './commands/context'
import { UserError } from './errors'
import type { DiscordInteraction, InteractionOption } from './interaction-types'
import { subcommand } from './interaction-types'

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
  squadadd: squadAdd,
  squadremove: squadRemove,
  squadedit: squadEdit,
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
    return null
  }
  const handler = COMMANDS[commandName]
  return handler ? { handler, options: topLevelOptions ?? [] } : null
}

/** Runs a command's handler and PATCHes the deferred placeholder response with the real result —
 *  called via `ctx.waitUntil` from `interactions.ts` after the initial DEFERRED response has
 *  already been sent, so it has no return value Discord is waiting on. A `UserError` becomes its
 *  own message verbatim; anything else is logged and replaced with a generic failure message so a
 *  raw stack trace never reaches a Discord user. */
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

  await editOriginalInteractionResponse(interaction.application_id, interaction.token, payload)
}
