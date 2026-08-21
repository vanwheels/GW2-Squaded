import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { TomeChaptersByTomeId } from '../types'
import { BOON_STRIP_CORRUPT_MATCHERS, MISCELLANEOUS_MATCHERS, tomeChapterNamedFactSources } from './sources'

/**
 * Regression guard for TODO.md's 2 user-flagged 2026-08-21 Firebrand Tome gaps: neither chapter
 * ever reached the Control/Miscellaneous/Strip-Corrupt-Cleanse pipeline at all (tome chapters have
 * no `Skill` id for the normal `Fact`-matching pipeline to read), not just a target-count
 * undercount like `tome-chapter-target-count-overrides.test.ts`'s pair. `TOME_CHAPTER_NAMED_FACT_SOURCES`
 * (sources.ts) supplies both.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
const tomeChapters = JSON.parse(readFileSync(resolve(dataDir, 'tome-chapters.json'), 'utf-8')) as TomeChaptersByTomeId

describe('Tome of Courage — Chapter 4: Stalwart Stand', () => {
  const chapter = tomeChapters['42259']?.find((c) => c.name === 'Chapter 4: Stalwart Stand')

  it('registers a self-only Breaks Stun entry', () => {
    expect(chapter).toBeDefined()
    if (!chapter) return
    const sources = tomeChapterNamedFactSources(chapter, MISCELLANEOUS_MATCHERS)
    expect(sources).toHaveLength(1)
    expect(sources[0].name).toBe('Breaks Stun')
    expect(sources[0].targetCount).toBeNull()
  })

  it('contributes nothing to the Strip/Corrupt/Cleanse row', () => {
    if (!chapter) return
    expect(tomeChapterNamedFactSources(chapter, BOON_STRIP_CORRUPT_MATCHERS)).toEqual([])
  })
})

describe('Tome of Resolve — Epilogue: Eternal Oasis', () => {
  const chapter = tomeChapters['41780']?.find((c) => c.name === 'Epilogue: Eternal Oasis')

  it('registers a party-wide(5) Cleanse entry', () => {
    expect(chapter).toBeDefined()
    if (!chapter) return
    const sources = tomeChapterNamedFactSources(chapter, BOON_STRIP_CORRUPT_MATCHERS)
    expect(sources).toHaveLength(1)
    expect(sources[0].name).toBe('Cleanse')
    expect(sources[0].targetCount).toBe(5)
  })

  it('contributes nothing to the Control/Miscellaneous rows', () => {
    if (!chapter) return
    expect(tomeChapterNamedFactSources(chapter, MISCELLANEOUS_MATCHERS)).toEqual([])
  })
})
