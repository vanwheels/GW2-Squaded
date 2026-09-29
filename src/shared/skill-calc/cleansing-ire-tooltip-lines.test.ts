import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types/game-data'
import { skillFactLines } from './skill-fact-lines'

/**
 * Leg 9 of the Known Exceptions Sweep: `sources.ts`'s `CLEANSING_IRE_CLEANSE_FACTS` only fixed the
 * aggregate Cleanse-row/per-skill-chip pipeline (see `cleansing-ire-cleanse-sources.test.ts`) — this
 * covers the separate per-skill tooltip path (`skillFactLines`) that reads raw `Fact`s directly.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(__dirname, '../../../data/game-data')
const skills: Skill[] = JSON.parse(readFileSync(resolve(dataDir, 'skills.json'), 'utf-8'))

const eviscerate = skills.find((s) => s.id === 14353) as Skill // core, genuinely tiered, raw fact MISSING entirely
const decapitate = skills.find((s) => s.id === 30851) as Skill // Berserker Primal Burst, fixed, raw fact stale
const fullCounter = skills.find((s) => s.id === 44165) as Skill // Spellbreaker, fixed, raw fact stale

function cleanseLine(lines: ReturnType<typeof skillFactLines>): string | undefined {
  return lines.find((l) => l.text.startsWith('Conditions Removed'))?.text
}

describe('skillFactLines — Cleansing Ire tooltip line', () => {
  it('shows nothing when Cleansing Ire is not equipped', () => {
    const lines = skillFactLines(eviscerate, new Set(), 1000, 1000, 2597)
    expect(cleanseLine(lines)).toBeUndefined()
  })

  it('Eviscerate (core, no raw fact at all) shows the adrenaline-scaled range', () => {
    const lines = skillFactLines(eviscerate, new Set([1649]), 1000, 1000, 2597)
    expect(cleanseLine(lines)).toBe('Conditions Removed: 2 / 3 / 4 (adrenaline tier 1/2/3)')
  })

  it('Decapitate (Berserker Primal Burst, stale raw value) shows the fixed tier-1 value, not the stale one', () => {
    const lines = skillFactLines(decapitate, new Set([1649]), 1000, 1000, 2597)
    expect(cleanseLine(lines)).toBe('Conditions Removed: 2')
  })

  it('Full Counter (Spellbreaker, stale raw value) shows the fixed level-1-cap value', () => {
    const lines = skillFactLines(fullCounter, new Set([1649]), 1000, 1000, 2597)
    expect(cleanseLine(lines)).toBe('Conditions Removed: 2')
  })

  it('does not duplicate the line when the raw stale fact and the curated line would share text', () => {
    const lines = skillFactLines(decapitate, new Set([1649]), 1000, 1000, 2597)
    expect(lines.filter((l) => l.text.startsWith('Conditions Removed'))).toHaveLength(1)
  })
})
