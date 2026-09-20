import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Trait } from '../types'
import { boonConditionFactsForTrait } from './sources'

/**
 * Regression guard for TODO.md "Shadestep WvW Alacrity Fix" (Leg 5, 2026-09-20): Shadestep's own
 * `facts` array carries both an Alacrity(5s) fact and a Regeneration(3s) fact for Grasping Shadows
 * with no game-mode discriminator in the local data, so without an override both show up at once.
 * Wiki raw wikitext (`action=raw`, fetched 2026-09-20) confirms these are mutually exclusive per
 * mode — Alacrity is PvE-only (`game mode=pve`), Regeneration is the WvW+PvP grant (`game mode=pvp
 * wvw`) — so this app (WvW-first) should show Regeneration only, never Alacrity.
 */

const SHADESTEP_TRAIT_ID = 2289

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}
const traits = readJson<Trait[]>('traits.json')
const wvwOverrides = readJson<{ trait: Record<number, Record<string, number | 'omit'>> }>('wvw-fact-overrides.json')
const shadestep = traits.find((t) => t.id === SHADESTEP_TRAIT_ID)

describe('Shadestep (2289)', () => {
  it('omits Alacrity and keeps Regeneration at its wvw+pvp duration (3s)', () => {
    expect(shadestep).toBeDefined()
    if (!shadestep) return
    const facts = boonConditionFactsForTrait(
      shadestep,
      new Set([SHADESTEP_TRAIT_ID]),
      new Set(),
      { boon: 0, condition: 0 },
      wvwOverrides.trait[SHADESTEP_TRAIT_ID],
      []
    )
    expect(facts.some((f) => f.boonOrConditionName === 'Alacrity')).toBe(false)
    const regeneration = facts.filter((f) => f.boonOrConditionName === 'Regeneration')
    expect(regeneration).toHaveLength(1)
    expect(regeneration[0].baseDurationSeconds).toBe(3)
  })
})
