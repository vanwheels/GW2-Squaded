import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { TomeChaptersByTomeId } from '../types'
import { isPartyWideTargetCount, tomeChapterBoonSources } from './sources'

/**
 * Regression guard for "Firebrand Tome chapters undercount their reach" (flagged 2026-08-21). Both
 * chapters below carry no "allied targets" wiki fact at all (unlike their tome-mates' explicit "5"),
 * so they resolved to `targetCount: null` and never reached the party-wide-only boon category —
 * user-confirmed both also hit the caster, so the true reach is self + 4 allies = 5, same convention
 * as the rest of their tomes. `TOME_CHAPTER_TARGET_COUNT_OVERRIDES` (sources.ts) supplies the
 * missing fact for each.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
const tomeChapters = JSON.parse(readFileSync(resolve(dataDir, 'tome-chapters.json'), 'utf-8')) as TomeChaptersByTomeId

describe.each([
  ['Tome of Courage', '42259', 'Chapter 4: Stalwart Stand', 'Resistance'],
  ['Tome of Resolve', '41780', 'Chapter 4: Shining River', 'Swiftness']
])('%s — %s', (_tomeLabel, tomeId, chapterName, boonName) => {
  it(`resolves ${boonName} to party-wide(5), not undercounted/unknown`, () => {
    const chapter = tomeChapters[tomeId]?.find((c) => c.name === chapterName)
    expect(chapter).toBeDefined()
    if (!chapter) return
    const facts = tomeChapterBoonSources(chapter, { boon: 0, condition: 0 })
    const boon = facts.filter((f) => f.boonOrConditionName === boonName)
    expect(boon).toHaveLength(1)
    expect(boon[0].targetCount).toBe(5)
    expect(isPartyWideTargetCount(boon[0].targetCount)).toBe(true)
  })
})
