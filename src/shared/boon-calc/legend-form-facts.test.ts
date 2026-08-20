import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Legend, Skill } from '../types'
import { legendFormFactsForSkill } from './sources'

/** Regression guard for Cosmic Wisdom's per-legend "form" tooltip fix (2026-08-20, flagged by the
 *  user: "the Cosmic Wisdom tooltip doesn't display the specific skill's tooltip depending on the
 *  equipped legends") — same "lock in what's already known-correct against the real game data"
 *  purpose as `evoker-familiar-facts.test.ts`. */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const skills = readJson<Skill[]>('skills.json')
const legends = readJson<Legend[]>('legends.json')
const legendIdByName = new Map(legends.map((l) => [l.name, l.id]))

describe('legendFormFactsForSkill', () => {
  it('returns nothing for a skill not on the curated allow-list (e.g. True Nature, the still-open Herald F2 gap)', () => {
    const trueNature = skills.find((s) => s.id === 29393)
    expect(trueNature).toBeDefined()
    const allEquipped = new Set(legends.map((l) => l.id))
    expect(legendFormFactsForSkill(trueNature!, allEquipped, legends)).toEqual([])
  })

  it('returns nothing for Cosmic Wisdom when neither of its 5 legends is equipped', () => {
    const cosmicWisdom = skills.find((s) => s.id === 77371)
    expect(cosmicWisdom).toBeDefined()
    const noneEquipped = new Set<string>()
    expect(legendFormFactsForSkill(cosmicWisdom!, noneEquipped, legends)).toEqual([])
  })

  it('resolves Cosmic Wisdom to only the equipped legends among its 5 forms', () => {
    const cosmicWisdom = skills.find((s) => s.id === 77371)
    expect(cosmicWisdom).toBeDefined()
    const assassinId = legendIdByName.get('Legendary Assassin Stance')!
    const dwarfId = legendIdByName.get('Legendary Dwarf Stance')!
    const equipped = new Set([assassinId, dwarfId])
    const result = legendFormFactsForSkill(cosmicWisdom!, equipped, legends)
    expect(result).toHaveLength(2)
    const names = result.map((r) => r.legend.name).sort()
    expect(names).toEqual(['Legendary Assassin Stance', 'Legendary Dwarf Stance'].sort())
    for (const { text } of result) expect(text.length).toBeGreaterThan(0)
  })

  it('resolves all 5 forms when all 5 of Cosmic Wisdom\'s reachable legends are equipped', () => {
    const cosmicWisdom = skills.find((s) => s.id === 77371)
    expect(cosmicWisdom).toBeDefined()
    const allEquipped = new Set(legends.map((l) => l.id))
    const result = legendFormFactsForSkill(cosmicWisdom!, allEquipped, legends)
    expect(result).toHaveLength(5)
  })
})
