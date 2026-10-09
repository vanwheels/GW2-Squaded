import type Database from 'better-sqlite3'
import type { Repository, SyncTombstone } from '@shared/storage/storage-interface'

/**
 * Repository<T> implementation backed by a two-column (id, data JSON) SQLite table, plus
 * a sibling `<table>_tombstones` table recording `{id, deleted_at}` for ids removed from
 * it — the sync hook's read surface for "what did this device delete since the last push."
 * Builds/squad comps are small, nested, and still evolving — storing them as a JSON
 * blob keyed by id avoids a premature relational schema while still giving us
 * indexed lookup by id via the primary key.
 */
export class JsonBlobRepository<T extends { id: string }> implements Repository<T> {
  private readonly tombstoneTable: string

  constructor(
    private readonly db: Database.Database,
    private readonly table: 'builds' | 'squad_comps'
  ) {
    this.tombstoneTable = `${table}_tombstones`
  }

  async list(): Promise<T[]> {
    const rows = this.db.prepare(`SELECT data FROM ${this.table} ORDER BY updated_at DESC`).all() as {
      data: string
    }[]
    return rows.map((row) => JSON.parse(row.data) as T)
  }

  async get(id: string): Promise<T | null> {
    const row = this.db.prepare(`SELECT data FROM ${this.table} WHERE id = ?`).get(id) as
      | { data: string }
      | undefined
    return row ? (JSON.parse(row.data) as T) : null
  }

  async create(record: T): Promise<T> {
    this.db
      .prepare(`INSERT INTO ${this.table} (id, data, updated_at) VALUES (?, ?, ?)`)
      .run(record.id, JSON.stringify(record), new Date().toISOString())
    return record
  }

  async update(record: T): Promise<T> {
    this.db
      .prepare(`UPDATE ${this.table} SET data = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(record), new Date().toISOString(), record.id)
    return record
  }

  async remove(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id)
    this.db
      .prepare(
        `INSERT INTO ${this.tombstoneTable} (id, deleted_at) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at`
      )
      .run(id, new Date().toISOString())
  }

  async listTombstones(): Promise<SyncTombstone[]> {
    const rows = this.db.prepare(`SELECT id, deleted_at FROM ${this.tombstoneTable}`).all() as {
      id: string
      deleted_at: string
    }[]
    return rows.map((row) => ({ id: row.id, deletedAt: row.deleted_at }))
  }

  async clearTombstones(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(', ')
    this.db.prepare(`DELETE FROM ${this.tombstoneTable} WHERE id IN (${placeholders})`).run(...ids)
  }
}
