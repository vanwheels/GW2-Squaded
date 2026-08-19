import type { Env } from '../../env'
import type { InteractionMember, InteractionOption } from '../interaction-types'

/** Everything a command handler needs, already unwrapped from the raw interaction JSON —
 *  `dispatch.ts` builds one of these per `APPLICATION_COMMAND` interaction and passes it to
 *  whichever handler `COMMANDS` maps the command name to. `options` is the command's own argument
 *  list — for a command with a subcommand layer (only `/buildBoardConfig setPermission` today),
 *  `dispatch.ts` passes the subcommand's nested `options`, not the top-level ones, so every
 *  handler can read its own arguments the same flat way regardless of subcommand nesting. */
export interface CommandContext {
  env: Env
  guildId: string
  channelId: string
  member: InteractionMember
  options: InteractionOption[]
}
