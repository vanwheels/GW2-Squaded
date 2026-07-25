import type Database from 'better-sqlite3'
import type { Repository } from '@shared/storage/storage-interface'

/**
 * Repository<T> implementation backed by a two-column (id, data JSON) SQLite table.
 * Builds/squad comps are small, nested, and still evolving — storing them as a JSON
 * blob keyed by id avoids a premature relational schema while still giving us
 * indexed lookup by id via the primary key.
 */
export class JsonBlobRepository<T extends { id: string }> implements Repository<T> {
  constructor(
    private readonly db: Database.Database,
    private readonly table: 'builds' | 'squad_comps'
  ) {}

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
  }
}
