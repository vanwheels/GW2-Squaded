import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { applySchema } from './schema'
import { JsonBlobRepository } from './json-blob-repository'

type Record = { id: string; name: string }

let repo: JsonBlobRepository<Record>

beforeEach(() => {
  const db = new Database(':memory:')
  applySchema(db)
  repo = new JsonBlobRepository<Record>(db, 'builds')
})

describe('JsonBlobRepository', () => {
  it('creates, lists, gets, updates, and removes', async () => {
    await repo.create({ id: 'a', name: 'first' })
    await repo.create({ id: 'b', name: 'second' })

    expect(await repo.get('a')).toEqual({ id: 'a', name: 'first' })
    expect((await repo.list()).map((r) => r.id).sort()).toEqual(['a', 'b'])

    await repo.update({ id: 'a', name: 'updated' })
    expect(await repo.get('a')).toEqual({ id: 'a', name: 'updated' })

    await repo.remove('b')
    expect(await repo.get('b')).toBeNull()
  })

  it('records a tombstone on remove and clears it later', async () => {
    await repo.create({ id: 'a', name: 'first' })
    await repo.remove('a')

    const tombstones = await repo.listTombstones()
    expect(tombstones).toHaveLength(1)
    expect(tombstones[0].id).toBe('a')
    expect(typeof tombstones[0].deletedAt).toBe('string')

    await repo.clearTombstones(['a'])
    expect(await repo.listTombstones()).toEqual([])
  })

  it('overwrites an earlier tombstone for the same id on repeated removal', async () => {
    await repo.create({ id: 'a', name: 'first' })
    await repo.remove('a')
    const firstDeletedAt = (await repo.listTombstones())[0].deletedAt

    await repo.create({ id: 'a', name: 'recreated' })
    await repo.remove('a')
    const tombstones = await repo.listTombstones()

    expect(tombstones).toHaveLength(1)
    expect(tombstones[0].deletedAt >= firstDeletedAt).toBe(true)
  })

  it('clearTombstones is a no-op for an empty id list', async () => {
    await repo.create({ id: 'a', name: 'first' })
    await repo.remove('a')

    await repo.clearTombstones([])
    expect(await repo.listTombstones()).toHaveLength(1)
  })
})
