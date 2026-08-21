import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { TomeChaptersByTomeId } from '../types'
import { isPartyWideTargetCount, tomeChapterBoonSources } from './sources'

/**
 * Regression guard for "Firebrand's Tome of Courage Chapter 4: Stalwart Stand undercounts its
 * Resistance reach" (flagged 2026-08-21). The wiki's own infobox for this chapter carries no
 * "allied targets" fact at all (unlike its tome-mates Chapter 1/Epilogue, which both explicitly
 * say 5) — user-confirmed the pulse also hits the caster, so the true reach is self + 4 allies = 5,
 * same party-wide convention as the rest of this tome. `TOME_CHAPTER_TARGET_COUNT_OVERRIDES`
 * (sources.ts) supplies that missing fact.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
const tomeChapters = JSON.parse(readFileSync(resolve(dataDir, 'tome-chapters.json'), 'utf-8')) as TomeChaptersByTomeId

describe('Chapter 4: Stalwart Stand (Tome of Courage)', () => {
  it('resolves Resistance to party-wide(5), not undercounted/unknown', () => {
    const chapter = tomeChapters['42259']?.find((c) => c.name === 'Chapter 4: Stalwart Stand')
    expect(chapter).toBeDefined()
    if (!chapter) return
    const facts = tomeChapterBoonSources(chapter, { boon: 0, condition: 0 })
    const resistance = facts.filter((f) => f.boonOrConditionName === 'Resistance')
    expect(resistance).toHaveLength(1)
    expect(resistance[0].targetCount).toBe(5)
    expect(isPartyWideTargetCount(resistance[0].targetCount)).toBe(true)
  })
})
