import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { RelicEffectsById } from '../types'
import { formatRelicDescription } from '../gear-calc/relic-effects-format'

/**
 * Regression test for `synthetic-relic-effects.json` (New Relic Coefficient Curation, Leg 2):
 * relics released with no `{{Relic infobox}}` wiki page yet have no entry `fetch-relic-effects.ts`
 * can produce, so their user-supplied in-game values are hand-curated here instead — same
 * "survives a full regenerating re-fetch" discipline `synthetic-facts.json` uses for skills, per
 * `withSyntheticRelicEffects`'s doc comment in `build-game-data.ts`.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
function loadGameData<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/' + name), 'utf-8')) as T
}

const relicEffects = loadGameData<RelicEffectsById>('relic-effects.json')
const syntheticRelicEffects = loadGameData<RelicEffectsById>('synthetic-relic-effects.json')
const mergedRelicEffects: RelicEffectsById = { ...syntheticRelicEffects, ...relicEffects }

describe('synthetic-relic-effects.json — Relic of the Lantern (109936)', () => {
  it('is absent from the generated relic-effects.json (no wiki page yet)', () => {
    expect(relicEffects[109936]).toBeUndefined()
  })

  it('is present in the merged relicEffects via the synthetic overlay', () => {
    expect(mergedRelicEffects[109936]).toEqual(syntheticRelicEffects[109936])
  })

  it('formats into a correct WvW tooltip line via formatRelicDescription', () => {
    const relic = { id: 109936, name: 'Relic of the Lantern', icon: 'icon.png', description: 'Reveal nearby enemies when you use a healing skill.' }
    const text = formatRelicDescription(relic, mergedRelicEffects[109936])
    expect(text).toContain('Revealed (6s)')
    expect(text).toContain('Targets: 5')
    expect(text).toContain('Radius: 600')
    expect(text).toContain('Recharge: 20s')
    expect(text).not.toContain('effect (')
  })
})

/**
 * Coefficient derived from 2 live WvW tooltip readings (2026-09-16): Power 2696/CondiDmg 0 ->
 * Damage 1075, Power 2629/CondiDmg 54 -> Damage 1049. Assuming the game's usual
 * `Math.floor(coefficient * Power)` rounding, both readings bound `coefficient` to
 * [0.398991, 0.399109) — 0.399 sits inside that tight interval. The Burning half was corroborated
 * independently against `CONDITION_DAMAGE_FORMULAS.Burning` (131 + 0.155*CondiDmg per stack per
 * second, already curated): 1 stack for 8s at 0 CondiDmg gives 131*8 = 1048 (exact match), and at
 * 54 CondiDmg / 30 Expertise (2.00% condition duration -> 8.16s true duration, displayed rounded to
 * the nearest quarter-second as "8¼s") gives (131 + 0.155*54)*8.16 = 1137.5 (matches the observed
 * 1137) — strong confirmation this relic's explosion applies exactly 1 stack of Burning, not more.
 */
describe('synthetic-relic-effects.json — Relic of the Last Tyrant (109942)', () => {
  it('is absent from the generated relic-effects.json (no wiki page yet)', () => {
    expect(relicEffects[109942]).toBeUndefined()
  })

  it('formats into correct WvW tooltip lines via formatRelicDescription', () => {
    const relic = {
      id: 109942,
      name: 'Relic of the Last Tyrant',
      icon: 'icon.png',
      description: "Gain stacks of Tyrant's Fury when you inflict burning on a foe. After reaching the maximum number of stacks, the next time you inflict burning causes an explosion that burns nearby foes."
    }
    const text = formatRelicDescription(relic, mergedRelicEffects[109942])
    expect(text).toContain('Damage (coefficient 0.399)')
    expect(text).toContain('Burning: 8')
    expect(text).toContain('Maximum Stacks: 5')
    expect(text).toContain('Targets: 5')
    expect(text).toContain('Radius: 240')
    expect(text).toContain('Recharge: 12s')
  })
})
