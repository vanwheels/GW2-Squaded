import type { Build, SquadComp } from '../types'
import type { Repository, StorageAdapter } from './storage-interface'

const DB_NAME = 'gw2-squaded'
const DB_VERSION = 1

const STORE_NAMES = {
  builds: 'builds',
  squadComps: 'squad_comps'
} as const

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const storeName of Object.values(STORE_NAMES)) {
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

/**
 * Repository<T> implementation backed by a single IndexedDB object store, keyed by `id` —
 * the browser-native counterpart to `JsonBlobRepository` (src/main/storage/json-blob-repository.ts),
 * which SQLite can't be used for in a web build. `list()` sorts by `updatedAt` in-memory after
 * `getAll()` rather than via a dedicated index: builds/squad comps are a single user's own
 * collection (tens, not thousands, of records), so the extra index would add schema complexity
 * `JsonBlobRepository`'s own `ORDER BY` doesn't need and this doesn't either.
 */
class IndexedDbRepository<T extends { id: string; updatedAt: string }> implements Repository<T> {
  constructor(
    private readonly dbPromise: Promise<IDBDatabase>,
    private readonly storeName: string
  ) {}

  private async openStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbPromise
    return db.transaction(this.storeName, mode).objectStore(this.storeName)
  }

  async list(): Promise<T[]> {
    const store = await this.openStore('readonly')
    const all = await promisifyRequest<T[]>(store.getAll())
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<T | null> {
    const store = await this.openStore('readonly')
    const result = await promisifyRequest<T | undefined>(store.get(id))
    return result ?? null
  }

  async create(record: T): Promise<T> {
    const store = await this.openStore('readwrite')
    await promisifyRequest(store.add(record))
    return record
  }

  async update(record: T): Promise<T> {
    const store = await this.openStore('readwrite')
    await promisifyRequest(store.put(record))
    return record
  }

  async remove(id: string): Promise<void> {
    const store = await this.openStore('readwrite')
    await promisifyRequest(store.delete(id))
  }
}

/**
 * Browser-native `StorageAdapter` implementation for the web build — one IndexedDB database,
 * one object store per collection. No sync, no tombstone tracking: matches
 * `createSqliteStorage`'s (src/main/storage/sqlite-storage.ts) current local-only scope exactly,
 * so renderer code reading `window.gw2Storage` doesn't change when the web build swaps this in.
 */
export function createIndexedDbStorage(): StorageAdapter {
  const dbPromise = openDatabase()
  return {
    builds: new IndexedDbRepository<Build>(dbPromise, STORE_NAMES.builds),
    squadComps: new IndexedDbRepository<SquadComp>(dbPromise, STORE_NAMES.squadComps)
  }
}
