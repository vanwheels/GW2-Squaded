import type { Build, SquadComp } from '../types'

/**
 * A deleted record's surviving trace, kept around so a later sync pass can tell a remote
 * peer "this was removed" instead of the id just silently disappearing. Shape matches the
 * Worker's own `SyncTombstone` (worker/src/merge.ts) exactly — no translation at the API
 * boundary — but isn't imported from it since the Worker is a separate deployable package.
 */
export interface SyncTombstone {
  id: string
  deletedAt: string
}

/**
 * CRUD contract for a saved-record collection. Implementations are async even where a
 * given backend (e.g. SQLite via better-sqlite3, which is synchronous) doesn't strictly
 * need to be, so that IPC-backed (Electron) and native-plugin-backed (future Capacitor)
 * implementations share the exact same interface.
 */
export interface Repository<T extends { id: string }> {
  list(): Promise<T[]>
  get(id: string): Promise<T | null>
  create(record: T): Promise<T>
  update(record: T): Promise<T>
  /** Deletes the record and records a tombstone for it, replacing any earlier one. */
  remove(id: string): Promise<void>
  /** Tombstones not yet acknowledged by a sync push. */
  listTombstones(): Promise<SyncTombstone[]>
  /** Drops tombstones once a sync pass has reconciled them with the remote side. */
  clearTombstones(ids: string[]): Promise<void>
}

/**
 * The full local storage surface the app depends on. The renderer never talks to a
 * concrete backend directly — it only ever depends on this interface, reached via the
 * preload-exposed `window.gw2Storage` bridge (see src/preload/index.ts). This is the
 * seam that gets swapped for a Capacitor storage plugin later.
 */
export interface StorageAdapter {
  builds: Repository<Build>
  squadComps: Repository<SquadComp>
}
