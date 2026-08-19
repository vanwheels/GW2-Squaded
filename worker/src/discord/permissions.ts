import { getActionPermission, type BoardAction, type BoardType } from '../db'
import type { Env } from '../env'
import { UserError } from './errors'
import { isAdministrator, type InteractionMember } from './interaction-types'

/** Enforces `action_permissions` for one guild/board/action, per docs/discord-bot.md's role-gate
 *  design. Throws `UserError` (not a boolean) since every call site's next step on failure is
 *  identical — reject the command with an explanatory message — so there's nothing for a caller
 *  to branch on. See `getActionPermission`'s doc comment for the "no row = open" default and
 *  `isAdministrator`'s for the admin safety valve. */
export async function requireActionPermission(
  env: Env,
  guildId: string,
  boardType: BoardType,
  action: BoardAction,
  member: InteractionMember
): Promise<void> {
  if (isAdministrator(member)) return

  const roleId = await getActionPermission(env, guildId, boardType, action)
  if (roleId === null) return
  if (member.roles.includes(roleId)) return

  throw new UserError(`You need the <@&${roleId}> role to do that.`)
}
