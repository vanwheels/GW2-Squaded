import type { Build, SquadComp } from '../types'
import type { Repository, StorageAdapter, SyncTombstone } from './storage-interface'

const DB_NAME = 'gw2-squaded'
const DB_VERSION = 2

const STORE_NAMES = {
  builds: 'builds',
  squadComps: 'squad_comps'
} as const

const TOMBSTONE_STORE_NAMES = {
  builds: 'builds_tombstones',
  squadComps: 'squad_comps_tombstones'
} as const

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const storeName of [...Object.values(STORE_NAMES), ...Object.values(TOMBSTONE_STORE_NAMES)]) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' })
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Repository<T> implementation backed by a pair of IndexedDB object stores — the records
 * themselves plus a `<store>_tombstones` store recording `{id, deletedAt}` for removed ids
 * — the browser-native counterpart to `JsonBlobRepository` (src/main/storage/json-blob-
 * repository.ts), which SQLite can't be used for in a web build. `list()` sorts by
 * `updatedAt` in-memory after `getAll()` rather than via a dedicated index: builds/squad
 * comps are a single user's own collection (tens, not thousands, of records), so the extra
 * index would add schema complexity `JsonBlobRepository`'s own `ORDER BY` doesn't need and
 * this doesn't either.
 */
class IndexedDbRepository<T extends { id: string; updatedAt: string }> implements Repository<T> {
  constructor(
    private readonly dbPromise: Promise<IDBDatabase>,
    private readonly storeName: string,
    private readonly tombstoneStoreName: string
  ) {}

  private async openStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbPromise
    return db.transaction(storeName, mode).objectStore(storeName)
  }

  async list(): Promise<T[]> {
    const store = await this.openStore(this.storeName, 'readonly')
    const all = await promisifyRequest<T[]>(store.getAll())
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<T | null> {
    const store = await this.openStore(this.storeName, 'readonly')
    const result = await promisifyRequest<T | undefined>(store.get(id))
    return result ?? null
  }

  async create(record: T): Promise<T> {
    const store = await this.openStore(this.storeName, 'readwrite')
    await promisifyRequest(store.add(record))
    return record
  }

  async update(record: T): Promise<T> {
    const store = await this.openStore(this.storeName, 'readwrite')
    await promisifyRequest(store.put(record))
    return record
  }

  async remove(id: string): Promise<void> {
    const db = await this.dbPromise
    const tx = db.transaction([this.storeName, this.tombstoneStoreName], 'readwrite')
    tx.objectStore(this.storeName).delete(id)
    tx.objectStore(this.tombstoneStoreName).put({ id, deletedAt: new Date().toISOString() })
    await promisifyTransaction(tx)
  }

  async listTombstones(): Promise<SyncTombstone[]> {
    const store = await this.openStore(this.tombstoneStoreName, 'readonly')
    return promisifyRequest<SyncTombstone[]>(store.getAll())
  }

  async clearTombstones(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const store = await this.openStore(this.tombstoneStoreName, 'readwrite')
    await Promise.all(ids.map((id) => promisifyRequest(store.delete(id))))
  }

  async replaceAll(records: T[], tombstones: SyncTombstone[]): Promise<void> {
    const db = await this.dbPromise
    const tx = db.transaction([this.storeName, this.tombstoneStoreName], 'readwrite')
    const recordStore = tx.objectStore(this.storeName)
    const tombstoneStore = tx.objectStore(this.tombstoneStoreName)
    recordStore.clear()
    tombstoneStore.clear()
    for (const record of records) recordStore.put(record)
    for (const tombstone of tombstones) tombstoneStore.put(tombstone)
    await promisifyTransaction(tx)
  }
}

/**
 * Browser-native `StorageAdapter` implementation for the web build — one IndexedDB database,
 * one object store per collection plus one tombstone store per collection. Matches
 * `createSqliteStorage`'s (src/main/storage/sqlite-storage.ts) scope exactly, so renderer
 * code reading `window.gw2Storage` doesn't change when the web build swaps this in.
 */
export function createIndexedDbStorage(): StorageAdapter {
  const dbPromise = openDatabase()
  return {
    builds: new IndexedDbRepository<Build>(dbPromise, STORE_NAMES.builds, TOMBSTONE_STORE_NAMES.builds),
    squadComps: new IndexedDbRepository<SquadComp>(
      dbPromise,
      STORE_NAMES.squadComps,
      TOMBSTONE_STORE_NAMES.squadComps
    )
  }
}
