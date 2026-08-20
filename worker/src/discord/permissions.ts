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

/**
 * Runs `requireActionPermission` concurrently with `work` — some other D1/KV lookup a mutating
 * command needs regardless of the outcome (resolving a share link, looking up the target build/
 * squad by name) — instead of serializing the two. They're independent (`work` never depends on
 * whether the caller turns out to be permitted), so there's no correctness reason to wait for the
 * permission check before starting it; this was the first of the two "smaller" round-trip-chaining
 * fixes flagged in TODO.md's Discord bot latency entry (the confirmed duplicate `getBoardMessage`
 * fetch on the add path was the other, fixed directly in `commands/builds.ts`/`squads.ts`).
 *
 * Uses `Promise.allSettled` rather than `Promise.all` so a permission failure is always the error
 * surfaced when both would fail — same as the original serialized order (permission checked
 * first) — even though both now run in parallel. Only the success-path latency changes.
 */
export async function withPermissionCheck<T>(permissionCheck: Promise<void>, work: Promise<T>): Promise<T> {
  const [permissionResult, workResult] = await Promise.allSettled([permissionCheck, work])
  if (permissionResult.status === 'rejected') throw permissionResult.reason
  if (workResult.status === 'rejected') throw workResult.reason
  return workResult.value
}
