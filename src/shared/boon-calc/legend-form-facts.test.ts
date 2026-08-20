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

  describe('LEGEND_FORM_EFFECT_DETAILS (Assassin/Warrior/Dervish real damage/healing numbers)', () => {
    const cosmicWisdom = skills.find((s) => s.id === 77371)!
    const allEquipped = new Set(legends.map((l) => l.id))
    // Reference build: Power 1000, Healing Power 1000, target Armor 2597 — same reference point
    // this codebase's other coefficient formulas are cross-checked against (see damage-calc.ts's
    // Judge's Intervention validation).
    const attrs = { power: 1000, healingPower: 1000, targetArmor: 2597 }

    it('has no effect-detail lines when attrs is omitted (plain description text only)', () => {
      const result = legendFormFactsForSkill(cosmicWisdom, allEquipped, legends)
      const assassin = result.find((r) => r.legend.name === 'Legendary Assassin Stance')!
      expect(assassin.text).not.toContain('\n')
      expect(assassin.text).not.toMatch(/Damage|Healing:/)
    })

    it('appends Lesser Enchanted Daggers\' siphon damage + healing to the Assassin row', () => {
      const result = legendFormFactsForSkill(cosmicWisdom, allEquipped, legends, attrs)
      const assassin = result.find((r) => r.legend.name === 'Legendary Assassin Stance')!
      expect(assassin.text).toContain('Life Siphon Damage: 1,088')
      expect(assassin.text).toContain('Siphon Healing: 968')
    })

    it('appends Dwarven Retribution\'s damage to the Dwarf row', () => {
      const result = legendFormFactsForSkill(cosmicWisdom, allEquipped, legends, attrs)
      const dwarf = result.find((r) => r.legend.name === 'Legendary Dwarf Stance')!
      expect(dwarf.text).toContain('Damage: 117')
    })

    it('appends Form of the Dervish (Attack)\'s damage to the Entity row', () => {
      const result = legendFormFactsForSkill(cosmicWisdom, allEquipped, legends, attrs)
      const entity = result.find((r) => r.legend.name === 'Legendary Entity Stance')!
      expect(entity.text).toContain('Damage: 140')
    })

    it('adds no effect-detail line to Centaur/Demon (genuine non-damage utility forms)', () => {
      const result = legendFormFactsForSkill(cosmicWisdom, allEquipped, legends, attrs)
      const centaur = result.find((r) => r.legend.name === 'Legendary Centaur Stance')!
      const demon = result.find((r) => r.legend.name === 'Legendary Demon Stance')!
      expect(centaur.text).not.toContain('\n')
      expect(demon.text).not.toContain('\n')
    })
  })
})
