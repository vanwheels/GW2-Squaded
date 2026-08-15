import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Trait } from '../types'
import { boonConditionFactsForTrait } from './sources'

/**
 * `BUFF_INSTANCE_VALUE_OVERRIDES` value-correctness test — the sibling `buff-instance-label-
 * completeness.test.ts` only checks that curated keys still resolve against current fact data
 * (staleness), not that the resulting rows carry the right VALUES or that the right occurrences get
 * dropped. This locks in Seize the Moment's actual behavior against the real `traits.json` entry
 * (trait 2022), since the whole point of this mechanism is collapsing 6 raw facts down to exactly 2
 * WvW-correct rows — see `BUFF_INSTANCE_VALUE_OVERRIDES`'s own doc comment in sources.ts for the
 * full per-occurrence breakdown this test is verifying.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const traits: Trait[] = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/traits.json'), 'utf-8'))
const seizeTheMoment = traits.find((t) => t.id === 2022)!

const NO_DURATION_BONUS = { boon: 0, condition: 0 }

describe('BUFF_INSTANCE_VALUE_OVERRIDES — Seize the Moment (trait 2022)', () => {
  it('collapses the 6 raw Quickness facts down to exactly 2 WvW-correct rows', () => {
    const sources = boonConditionFactsForTrait(seizeTheMoment, new Set(), new Set(), NO_DURATION_BONUS, undefined)
    expect(sources).toHaveLength(2)
  })

  it('keeps the per-Clone occurrence at its real WvW value (0.5s), labeled', () => {
    const sources = boonConditionFactsForTrait(seizeTheMoment, new Set(), new Set(), NO_DURATION_BONUS, undefined)
    const perClone = sources.find((s) => s.instanceLabel === 'Quickness per Clone')
    expect(perClone).toBeDefined()
    expect(perClone!.baseDurationSeconds).toBe(0.5)
  })

  it('keeps the base occurrence at its real WvW value (0.75s), unlabeled', () => {
    const sources = boonConditionFactsForTrait(seizeTheMoment, new Set(), new Set(), NO_DURATION_BONUS, undefined)
    const base = sources.find((s) => s.instanceLabel === undefined)
    expect(base).toBeDefined()
    expect(base!.baseDurationSeconds).toBe(0.75)
  })
})
