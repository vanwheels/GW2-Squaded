import type { Env } from './env'

/** Board type — matches `board_messages.board_type`/`action_permissions.board_type`'s two values
 *  per the schema in `migrations/0001_init_schema.sql` (see docs/discord-bot.md for the design). */
export type BoardType = 'build' | 'squad'
export type BoardAction = 'add' | 'edit' | 'remove' | 'move'

export interface BoardMessageRow {
  channel_id: string
  message_id: string
}

export async function getBoardMessage(
  env: Env,
  guildId: string,
  boardType: BoardType,
  category: string
): Promise<BoardMessageRow | null> {
  return env.DB.prepare(
    'SELECT channel_id, message_id FROM board_messages WHERE guild_id = ? AND board_type = ? AND category = ?'
  )
    .bind(guildId, boardType, category)
    .first<BoardMessageRow>()
}

export async function upsertBoardMessage(
  env: Env,
  guildId: string,
  boardType: BoardType,
  category: string,
  channelId: string,
  messageId: string
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO board_messages (guild_id, board_type, category, channel_id, message_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (guild_id, board_type, category)
     DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`
  )
    .bind(guildId, boardType, category, channelId, messageId)
    .run()
}

/** `null` = no role gate configured for this guild/board/action — per the 2026-08-19 Phase 2
 *  scoping decision, that means the action is OPEN to any server member, not locked out. An admin
 *  opts into gating via `/buildBoardConfig setPermission`; nothing needs configuring to use
 *  Automatic-mode CRUD at all. */
export async function getActionPermission(
  env: Env,
  guildId: string,
  boardType: BoardType,
  action: BoardAction
): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT role_id FROM action_permissions WHERE guild_id = ? AND board_type = ? AND action = ?'
  )
    .bind(guildId, boardType, action)
    .first<{ role_id: string }>()
  return row?.role_id ?? null
}

export async function setActionPermission(
  env: Env,
  guildId: string,
  boardType: BoardType,
  action: BoardAction,
  roleId: string
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO action_permissions (guild_id, board_type, action, role_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (guild_id, board_type, action) DO UPDATE SET role_id = excluded.role_id`
  )
    .bind(guildId, boardType, action, roleId)
    .run()
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

// ---------------------------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------------------------

export interface BuildRow {
  id: number
  guild_id: string
  name: string
  share_id: string
  profession: string
  sort_order: number
  added_by: string
  added_at: string
  updated_at: string
}

export async function listBuildsByProfession(env: Env, guildId: string, profession: string): Promise<BuildRow[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM builds WHERE guild_id = ? AND profession = ? ORDER BY sort_order ASC'
  )
    .bind(guildId, profession)
    .all<BuildRow>()
  return result.results
}

export async function getBuildByName(env: Env, guildId: string, name: string): Promise<BuildRow | null> {
  return env.DB.prepare('SELECT * FROM builds WHERE guild_id = ? AND name = ?').bind(guildId, name).first<BuildRow>()
}

export async function searchBuildNames(env: Env, guildId: string, query: string): Promise<string[]> {
  const result = await env.DB.prepare(
    "SELECT name FROM builds WHERE guild_id = ? AND name LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT 25"
  )
    .bind(guildId, `%${escapeLike(query)}%`)
    .all<{ name: string }>()
  return result.results.map((r) => r.name)
}

/** Appends a new build to the end of its profession's section (`sort_order` = current max + 1,
 *  or 0 if the section is empty). Throws (D1's `UNIQUE (guild_id, name)` constraint) if the name
 *  is already taken by another build in this guild — callers catch and report that as a friendly
 *  error rather than pre-checking, avoiding a check-then-insert race. */
export async function insertBuild(
  env: Env,
  fields: Omit<BuildRow, 'id' | 'sort_order'>
): Promise<BuildRow> {
  const order = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM builds WHERE guild_id = ? AND profession = ?'
  )
    .bind(fields.guild_id, fields.profession)
    .first<{ next: number }>()
  const sortOrder = order?.next ?? 0

  const result = await env.DB.prepare(
    `INSERT INTO builds (guild_id, name, share_id, profession, sort_order, added_by, added_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`
  )
    .bind(
      fields.guild_id,
      fields.name,
      fields.share_id,
      fields.profession,
      sortOrder,
      fields.added_by,
      fields.added_at,
      fields.updated_at
    )
    .first<BuildRow>()
  if (!result) throw new Error('insertBuild: RETURNING produced no row')
  return result
}

/** Deletes a build and compacts the remaining `sort_order` values in its profession's section
 *  (0..n-1, no gaps) so a later `/buildMove` position argument stays a clean 1-based index. */
export async function deleteBuild(env: Env, build: BuildRow): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM builds WHERE id = ?').bind(build.id),
    env.DB.prepare(
      `UPDATE builds SET sort_order = sort_order - 1
       WHERE guild_id = ? AND profession = ? AND sort_order > ?`
    ).bind(build.guild_id, build.profession, build.sort_order)
  ])
}

interface BuildUpdateFields {
  name?: string
  shareId?: string
  profession?: string
  updatedAt: string
}

/** Renames/relinks a build in place. If `profession` changes, the caller is responsible for
 *  moving it between sections (compact the old section, append to the new one) — this function
 *  only writes the row's own columns, same "one write, caller orchestrates section membership"
 *  split as `moveBuildToProfession` below. */
export async function updateBuild(env: Env, id: number, fields: BuildUpdateFields): Promise<void> {
  const sets: string[] = ['updated_at = ?']
  const binds: unknown[] = [fields.updatedAt]
  if (fields.name !== undefined) {
    sets.push('name = ?')
    binds.push(fields.name)
  }
  if (fields.shareId !== undefined) {
    sets.push('share_id = ?')
    binds.push(fields.shareId)
  }
  if (fields.profession !== undefined) {
    sets.push('profession = ?')
    binds.push(fields.profession)
  }
  binds.push(id)
  await env.DB.prepare(`UPDATE builds SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run()
}

/** Moves `build` out of its current profession section (compacting the gap left behind) and
 *  appends it to the end of `newProfession`'s section. Caller still needs a separate
 *  `updateBuild(..., { profession: newProfession })` call — this only fixes up `sort_order` on
 *  both sides; kept separate from `updateBuild` since a plain rename/relink-without-profession-
 *  change never needs this reshuffle. */
export async function moveBuildToProfession(env: Env, build: BuildRow, newProfession: string): Promise<number> {
  const order = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM builds WHERE guild_id = ? AND profession = ?'
  )
    .bind(build.guild_id, newProfession)
    .first<{ next: number }>()
  const newSortOrder = order?.next ?? 0

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE builds SET sort_order = sort_order - 1
       WHERE guild_id = ? AND profession = ? AND sort_order > ?`
    ).bind(build.guild_id, build.profession, build.sort_order),
    env.DB.prepare('UPDATE builds SET sort_order = ? WHERE id = ?').bind(newSortOrder, build.id)
  ])
  return newSortOrder
}

/** Moves `build` to 0-based `targetIndex` within its own profession section, shifting every build
 *  between the old and new position by one to keep `sort_order` a dense 0..n-1 sequence. */
export async function reorderBuildWithinProfession(env: Env, build: BuildRow, targetIndex: number): Promise<void> {
  const from = build.sort_order
  if (targetIndex === from) return

  const statements =
    targetIndex > from
      ? [
          env.DB.prepare(
            `UPDATE builds SET sort_order = sort_order - 1
             WHERE guild_id = ? AND profession = ? AND sort_order > ? AND sort_order <= ?`
          ).bind(build.guild_id, build.profession, from, targetIndex)
        ]
      : [
          env.DB.prepare(
            `UPDATE builds SET sort_order = sort_order + 1
             WHERE guild_id = ? AND profession = ? AND sort_order >= ? AND sort_order < ?`
          ).bind(build.guild_id, build.profession, targetIndex, from)
        ]
  statements.push(env.DB.prepare('UPDATE builds SET sort_order = ? WHERE id = ?').bind(targetIndex, build.id))
  await env.DB.batch(statements)
}

// ---------------------------------------------------------------------------------------------
// Squads
// ---------------------------------------------------------------------------------------------

export interface SquadRow {
  id: number
  guild_id: string
  name: string
  share_id: string
  sort_order: number
  added_by: string
  added_at: string
  updated_at: string
}

export async function listSquads(env: Env, guildId: string): Promise<SquadRow[]> {
  const result = await env.DB.prepare('SELECT * FROM squads WHERE guild_id = ? ORDER BY sort_order ASC')
    .bind(guildId)
    .all<SquadRow>()
  return result.results
}

export async function getSquadByName(env: Env, guildId: string, name: string): Promise<SquadRow | null> {
  return env.DB.prepare('SELECT * FROM squads WHERE guild_id = ? AND name = ?').bind(guildId, name).first<SquadRow>()
}

export async function searchSquadNames(env: Env, guildId: string, query: string): Promise<string[]> {
  const result = await env.DB.prepare(
    "SELECT name FROM squads WHERE guild_id = ? AND name LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT 25"
  )
    .bind(guildId, `%${escapeLike(query)}%`)
    .all<{ name: string }>()
  return result.results.map((r) => r.name)
}

export async function insertSquad(env: Env, fields: Omit<SquadRow, 'id' | 'sort_order'>): Promise<SquadRow> {
  const order = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM squads WHERE guild_id = ?')
    .bind(fields.guild_id)
    .first<{ next: number }>()
  const sortOrder = order?.next ?? 0

  const result = await env.DB.prepare(
    `INSERT INTO squads (guild_id, name, share_id, sort_order, added_by, added_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING *`
  )
    .bind(fields.guild_id, fields.name, fields.share_id, sortOrder, fields.added_by, fields.added_at, fields.updated_at)
    .first<SquadRow>()
  if (!result) throw new Error('insertSquad: RETURNING produced no row')
  return result
}

/** Deletes a squad and compacts the remaining `sort_order` values (0..n-1, no gaps) — squads have
 *  no `/squadMove` in v1, but the compaction keeps `sort_order` well-formed for when a later
 *  phase adds one, same reasoning as `deleteBuild`. */
export async function deleteSquad(env: Env, squad: SquadRow): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM squads WHERE id = ?').bind(squad.id),
    env.DB.prepare('UPDATE squads SET sort_order = sort_order - 1 WHERE guild_id = ? AND sort_order > ?').bind(
      squad.guild_id,
      squad.sort_order
    )
  ])
}

interface SquadUpdateFields {
  name?: string
  shareId?: string
  updatedAt: string
}

export async function updateSquad(env: Env, id: number, fields: SquadUpdateFields): Promise<void> {
  const sets: string[] = ['updated_at = ?']
  const binds: unknown[] = [fields.updatedAt]
  if (fields.name !== undefined) {
    sets.push('name = ?')
    binds.push(fields.name)
  }
  if (fields.shareId !== undefined) {
    sets.push('share_id = ?')
    binds.push(fields.shareId)
  }
  binds.push(id)
  await env.DB.prepare(`UPDATE squads SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run()
}
