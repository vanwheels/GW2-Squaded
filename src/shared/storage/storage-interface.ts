import type { Build, SquadComp } from '../types'

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
  remove(id: string): Promise<void>
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
