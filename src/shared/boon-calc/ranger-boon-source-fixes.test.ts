import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Trait } from '../types'
import { boonConditionFactsForTrait } from './sources'

/**
 * 2 user-caught Ranger boon-source bugs (2026-08-22, found alongside the Outgoing Healing % sweep
 * review) against the real `traits.json` entries — see `TRAIT_IDS_EXCLUDED_FROM_BOON_SOURCES`/
 * `WEAPON_SKILL_TRIGGER_NOTES`'s own doc comments in sources.ts for the full writeup each fix is
 * verifying.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const traits: Trait[] = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/traits.json'), 'utf-8'))
const fortifyingBond = traits.find((t) => t.id === 1056)! // Fortifying Bond (Ranger, Beastmastery, Minor)
const windborneNotes = traits.find((t) => t.id === 964)! // Windborne Notes (Ranger, Beastmastery, Major)

const NO_DURATION_BONUS = { boon: 0, condition: 0 }

describe('TRAIT_IDS_EXCLUDED_FROM_BOON_SOURCES — Fortifying Bond (trait 1056)', () => {
  it('emits nothing, even though its raw facts carry a Buff entry for every boon in the game', () => {
    // Sanity-check the premise: the raw data really does have all 12 boons as unconditional facts,
    // so an un-fixed extractFromFacts would otherwise report Fortifying Bond as a source of all 12.
    const rawBoonFactCount = fortifyingBond.facts.filter((f) => f.type === 'Buff').length
    expect(rawBoonFactCount).toBe(12)

    const sources = boonConditionFactsForTrait(fortifyingBond, new Set(), new Set(), NO_DURATION_BONUS, undefined)
    expect(sources).toHaveLength(0)
  })
})

describe('WEAPON_SKILL_TRIGGER_NOTES — Windborne Notes (trait 964)', () => {
  it('still shows its Regeneration facts (the data is genuinely only on the trait)', () => {
    const sources = boonConditionFactsForTrait(windborneNotes, new Set(), new Set(), NO_DURATION_BONUS, undefined)
    const regen = sources.filter((s) => s.boonOrConditionName === 'Regeneration')
    expect(regen.length).toBeGreaterThan(0)
  })

  it('labels every one of its Regeneration facts "On Warhorn Skill Use" rather than showing them as unconditional', () => {
    const sources = boonConditionFactsForTrait(windborneNotes, new Set(), new Set(), NO_DURATION_BONUS, undefined)
    const regen = sources.filter((s) => s.boonOrConditionName === 'Regeneration')
    for (const source of regen) expect(source.triggerNote).toBe('On Warhorn Skill Use')
  })
})
