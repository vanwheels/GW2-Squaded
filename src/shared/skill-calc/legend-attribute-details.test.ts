import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Legend, Trait } from '../types'
import { LEGEND_ATTRIBUTE_BONUS_DETAILS, legendAttributeDetailFacts } from './legend-attribute-details'

/** Regression guard for the Bolstered Bonds display fix (2026-08-20, flagged by the user: "we
 *  should be displaying each legend detail, same as we do with the trait Spirit Boon") — same
 *  "lock in what's already known-correct against the real game data" purpose as
 *  `evoker-familiar-facts.test.ts`. */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const traits = readJson<Trait[]>('traits.json')
const legends = readJson<Legend[]>('legends.json')

describe('LEGEND_ATTRIBUTE_BONUS_DETAILS', () => {
  it('every curated trait id exists in traits.json', () => {
    for (const idStr of Object.keys(LEGEND_ATTRIBUTE_BONUS_DETAILS)) {
      const id = Number(idStr)
      expect(traits.find((t) => t.id === id), `trait id ${id} missing from traits.json`).toBeDefined()
    }
  })

  it('every curated legend name matches a real Legend.name in legends.json', () => {
    const realNames = new Set(legends.map((l) => l.name))
    for (const [idStr, byLegendName] of Object.entries(LEGEND_ATTRIBUTE_BONUS_DETAILS)) {
      for (const legendName of Object.keys(byLegendName)) {
        expect(realNames.has(legendName), `trait ${idStr}: "${legendName}" doesn't match any Legend.name`).toBe(true)
      }
    }
  })
})

describe('legendAttributeDetailFacts', () => {
  it('returns nothing for a trait with no curated entry (e.g. Spirit Boon, the boon-granting shape this is NOT)', () => {
    const spiritBoon = traits.find((t) => t.id === 1774)
    expect(spiritBoon).toBeDefined()
    expect(legendAttributeDetailFacts(spiritBoon!, legends)).toEqual([])
  })

  it('resolves Bolstered Bonds (2331) to its 5 curated legends, each with a real Legend attached', () => {
    const bolsteredBonds = traits.find((t) => t.id === 2331)
    expect(bolsteredBonds).toBeDefined()
    const result = legendAttributeDetailFacts(bolsteredBonds!, legends)
    expect(result).toHaveLength(5)
    for (const { legend, text } of result) {
      expect(legend.icon).toMatch(/^https:\/\//)
      expect(text.length).toBeGreaterThan(0)
    }
    // Dragon/Renegade/Alliance are genuinely absent from this trait's own wiki page — not a gap.
    const names = result.map((r) => r.legend.name)
    expect(names).not.toContain('Legendary Dragon Stance')
    expect(names).not.toContain('Legendary Renegade Stance')
    expect(names).not.toContain('Legendary Alliance Stance')
  })
})
