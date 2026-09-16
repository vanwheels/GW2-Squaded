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
