import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createIndexedDbStorage } from './indexeddb-adapter'

// Each test gets empty object stores — fake-indexeddb otherwise persists state across tests in
// the same file/process, since it's a module-level in-memory store standing in for the browser's
// own. Clearing (not deleting) the database avoids blocking on the previous test's still-open
// connection, since `createIndexedDbStorage` never closes the one it opens — same as the real app,
// whose connection lives for the whole session.
afterEach(async () => {
  const request = indexedDB.open('gw2-squaded')
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const tx = db.transaction(['builds', 'squad_comps'], 'readwrite')
  tx.objectStore('builds').clear()
  tx.objectStore('squad_comps').clear()
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
})

function record(id: string, updatedAt: string): { id: string; updatedAt: string } {
  return { id, updatedAt }
}

describe('createIndexedDbStorage', () => {
  it('creates, lists (newest updatedAt first), gets, updates, and removes', async () => {
    const storage = createIndexedDbStorage()

    await storage.builds.create(record('a', '2026-01-01T00:00:00.000Z') as never)
    await storage.builds.create(record('b', '2026-01-03T00:00:00.000Z') as never)
    await storage.builds.create(record('c', '2026-01-02T00:00:00.000Z') as never)

    expect((await storage.builds.list()).map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(await storage.builds.get('a')).toEqual(record('a', '2026-01-01T00:00:00.000Z'))
    expect(await storage.builds.get('missing')).toBeNull()

    await storage.builds.update(record('a', '2026-01-04T00:00:00.000Z') as never)
    expect((await storage.builds.list()).map((r) => r.id)).toEqual(['a', 'b', 'c'])

    await storage.builds.remove('b')
    expect((await storage.builds.list()).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('keeps builds and squadComps in separate stores', async () => {
    const storage = createIndexedDbStorage()

    await storage.builds.create(record('shared-id', '2026-01-01T00:00:00.000Z') as never)
    await storage.squadComps.create(record('shared-id', '2026-01-02T00:00:00.000Z') as never)

    expect(await storage.builds.get('shared-id')).toEqual(record('shared-id', '2026-01-01T00:00:00.000Z'))
    expect(await storage.squadComps.get('shared-id')).toEqual(record('shared-id', '2026-01-02T00:00:00.000Z'))
  })
})
