import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ResourceCostsById, Skill } from '../types'
import { resourceCostLines } from './resource-cost-lines'
import { skillFactLines } from './skill-fact-lines'

/**
 * Regression guard for TODO.md's "Resource-cost modeling" item: `scripts/fetch-resource-costs.ts`
 * wiki-sources Revenant energy/upkeep, Thief initiative, and Necromancer/Ranger Untamed health
 * cost — none of which the public API exposes at all (unlike `Recharge`, which at least has a
 * PvE-reference-build number to override). Fixed ids below are wiki-verified 2026-08-28 (see this
 * test's own assertions for the exact values).
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}
const skills = readJson<Skill[]>('skills.json')
const resourceCosts = readJson<ResourceCostsById>('resource-costs.json')

const IMPOSSIBLE_ODDS_ID = 27107 // Revenant Legendary Assassin upkeep skill: energy=5, upkeep=-6 (unsplit)
const BLACK_POWDER_ID = 13113 // Thief offhand pistol: initiative=6 PvE, 7 WvW
const GORGE_ID = 71871 // Necromancer sword 3: health cost 2305 PvE, 1537 WvW

describe('resourceCostLines', () => {
  it('renders both Energy and Upkeep for a Revenant upkeep skill, base value only (no real WvW split)', () => {
    const lines = resourceCostLines(IMPOSSIBLE_ODDS_ID, resourceCosts)
    expect(lines.map((l) => l.text)).toEqual(['Energy: 5', 'Upkeep: -6/s'])
  })

  it('prefers the WvW value over the base value when the wiki documents a real split', () => {
    const lines = resourceCostLines(BLACK_POWDER_ID, resourceCosts)
    expect(lines).toEqual([{ icon: null, text: 'Initiative: 7' }])
  })

  it('formats a health-cost skill with its own WvW-preferred value', () => {
    const lines = resourceCostLines(GORGE_ID, resourceCosts)
    expect(lines).toEqual([{ icon: null, text: 'Health Cost: 1,537' }])
  })

  it('returns an empty array for a skill with no entry in the map', () => {
    expect(resourceCostLines(999999, resourceCosts)).toEqual([])
    expect(resourceCostLines(999999, {})).toEqual([])
  })
})

describe('skillFactLines — resource cost integration', () => {
  it('prepends the resource-cost line ahead of the skill\'s own facts when the map is passed', () => {
    const skill = skills.find((s) => s.id === BLACK_POWDER_ID)!
    const lines = skillFactLines(skill, new Set(), 1000, 1000, 2597, undefined, resourceCosts)
    expect(lines[0]).toEqual({ icon: null, text: 'Initiative: 7' })
  })

  it('shows no cost line at all when the map is omitted (back-compat, every pre-existing caller)', () => {
    const skill = skills.find((s) => s.id === BLACK_POWDER_ID)!
    const lines = skillFactLines(skill, new Set(), 1000, 1000, 2597)
    expect(lines.some((l) => l.text.startsWith('Initiative:'))).toBe(false)
  })
})
