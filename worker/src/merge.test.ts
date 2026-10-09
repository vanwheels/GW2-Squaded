import { describe, it, expect } from 'vitest'
import { mergeCollection, mergeSingleton } from './merge'

interface Record_ {
  id: string
  updatedAt: string
  label: string
}

function ts(offsetMs: number): string {
  return new Date(offsetMs).toISOString()
}

function record(id: string, updatedAt: number, label = id): Record_ {
  return { id, updatedAt: ts(updatedAt), label }
}

describe('mergeCollection', () => {
  it('keeps the newer record when both sides have it', () => {
    const existing = [record('a', 100, 'old')]
    const incoming = [record('a', 200, 'new')]
    const result = mergeCollection(existing, [], incoming, [])
    expect(result.records).toEqual([record('a', 200, 'new')])
  })

  it('keeps the existing record when the incoming one is older', () => {
    const existing = [record('a', 200, 'server')]
    const incoming = [record('a', 100, 'stale')]
    const result = mergeCollection(existing, [], incoming, [])
    expect(result.records).toEqual([record('a', 200, 'server')])
  })

  it('adds a record present on only one side', () => {
    const result = mergeCollection([record('a', 100)], [], [record('b', 200)], [])
    expect(result.records.map(r => r.id).sort()).toEqual(['a', 'b'])
  })

  it('a delete removes an older record and the tombstone survives', () => {
    const existing = [record('a', 100)]
    const incomingTombstones = [{ id: 'a', deletedAt: ts(200) }]
    const result = mergeCollection(existing, [], [], incomingTombstones)
    expect(result.records).toEqual([])
    expect(result.tombstones).toEqual([{ id: 'a', deletedAt: ts(200) }])
  })

  it('an edit after a delete resurrects the record and drops the stale tombstone', () => {
    const existingTombstones = [{ id: 'a', deletedAt: ts(100) }]
    const incoming = [record('a', 200, 'edited-after-delete')]
    const result = mergeCollection([], existingTombstones, incoming, [])
    expect(result.records).toEqual([record('a', 200, 'edited-after-delete')])
    expect(result.tombstones).toEqual([])
  })

  it('a delete after an edit still wins (delete newer than the edit)', () => {
    const existing = [record('a', 100, 'edited')]
    const incomingTombstones = [{ id: 'a', deletedAt: ts(200) }]
    const result = mergeCollection(existing, [], [], incomingTombstones)
    expect(result.records).toEqual([])
    expect(result.tombstones).toEqual([{ id: 'a', deletedAt: ts(200) }])
  })

  it('unions tombstones from both sides, keeping the newer deletedAt per id', () => {
    const existingTombstones = [{ id: 'a', deletedAt: ts(100) }]
    const incomingTombstones = [{ id: 'a', deletedAt: ts(50) }, { id: 'b', deletedAt: ts(300) }]
    const result = mergeCollection([], existingTombstones, [], incomingTombstones)
    expect(result.tombstones.sort((x, y) => x.id.localeCompare(y.id))).toEqual([
      { id: 'a', deletedAt: ts(100) },
      { id: 'b', deletedAt: ts(300) }
    ])
  })

  it('a tombstone with no matching record on either side is a no-op beyond being retained', () => {
    const incomingTombstones = [{ id: 'never-existed', deletedAt: ts(100) }]
    const result = mergeCollection([], [], [], incomingTombstones)
    expect(result.records).toEqual([])
    expect(result.tombstones).toEqual([{ id: 'never-existed', deletedAt: ts(100) }])
  })
})

describe('mergeSingleton', () => {
  it('keeps the newer side', () => {
    const existing = { updatedAt: ts(100), name: 'old' }
    const incoming = { updatedAt: ts(200), name: 'new' }
    expect(mergeSingleton(existing, incoming)).toEqual(incoming)
  })

  it('keeps the existing side when incoming is older', () => {
    const existing = { updatedAt: ts(200), name: 'server' }
    const incoming = { updatedAt: ts(100), name: 'stale' }
    expect(mergeSingleton(existing, incoming)).toEqual(existing)
  })

  it('returns incoming when existing is missing (first sync for this account)', () => {
    const incoming = { updatedAt: ts(100), name: 'new' }
    expect(mergeSingleton(undefined, incoming)).toEqual(incoming)
  })

  it('returns existing when incoming is missing (a pre-profile-sync client payload)', () => {
    const existing = { updatedAt: ts(100), name: 'server' }
    expect(mergeSingleton(existing, undefined)).toEqual(existing)
  })

  it('returns undefined when neither side has it', () => {
    expect(mergeSingleton(undefined, undefined)).toBeUndefined()
  })
})
