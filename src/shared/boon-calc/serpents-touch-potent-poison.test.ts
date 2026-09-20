import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Trait } from '../types'
import { boonConditionFactsForTrait } from './sources'

/**
 * TODO.md's "Serpent's Touch Downstate/Steal Poison Duplication" (2026-09-20): with Potent Poison
 * (1291) also equipped, Serpent's Touch's own trait tooltip showed 5 "Poisoned" rows instead of 2 —
 * `extractFromFacts` never consulted a `traitedFact`'s `overrides` index to suppress the base fact
 * it's meant to replace. Locks in both the no-Potent-Poison baseline (2 rows, unboosted) and the
 * Potent-Poison-active case (2 rows, boosted), matching `BUFF_INSTANCE_VALUE_OVERRIDES[1279]`'s own
 * doc comment in sources.ts for the full per-occurrence breakdown.
 */

const POTENT_POISON_TRAIT_ID = 1291

const __dirname = dirname(fileURLToPath(import.meta.url))
const traits: Trait[] = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/traits.json'), 'utf-8'))
const serpentsTouch = traits.find((t) => t.id === 1279)!

const NO_DURATION_BONUS = { boon: 0, condition: 0 }

describe("Serpent's Touch (trait 1279) x Potent Poison (trait 1291)", () => {
  it('shows exactly 2 rows (unboosted Steal + Downed) without Potent Poison', () => {
    const sources = boonConditionFactsForTrait(serpentsTouch, new Set(), new Set(), NO_DURATION_BONUS, undefined)
    expect(sources).toHaveLength(2)
    expect(sources.map((s) => `${s.baseDurationSeconds}@${s.applyCount}`).sort()).toEqual(['10@2', '2@1'])
  })

  it('shows exactly 2 rows (boosted Steal + Downed), not 5, with Potent Poison active', () => {
    const sources = boonConditionFactsForTrait(serpentsTouch, new Set([POTENT_POISON_TRAIT_ID]), new Set(), NO_DURATION_BONUS, undefined)
    expect(sources).toHaveLength(2)
    expect(sources.map((s) => `${s.baseDurationSeconds}@${s.applyCount}`).sort()).toEqual(['10@3', '2@2'])
  })
})
