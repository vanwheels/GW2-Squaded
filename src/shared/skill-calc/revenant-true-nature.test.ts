import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Legend, Skill } from '../types'
import { branchConditionalFacts } from './branch-conditional-facts'
import { legendFormFactsForSkill } from '../boon-calc/sources'

/**
 * Regression guard for the 2026-08-19 TODO.md item "Herald F2 lacks linked tooltips + Core Value
 * lacks its details," closed 2026-08-20: Facet of Nature (29371)'s own per-legend descriptions
 * (`legendFormFactsForSkill`, `LEGEND_FORM_FACT_SKILL_IDS` in `boon-calc/sources.ts`) and its Consume
 * effect True Nature's real per-legend numbers + Core Value's boost (`trueNatureBranches` in
 * `branch-conditional-facts.ts`). Same "lock in what's already known-correct" purpose as
 * `evoker-familiar-facts.test.ts`/`luminary.test.ts`.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const skills = readJson<Skill[]>('skills.json')
const byId = new Map(skills.map((s) => [s.id, s]))
const legends = readJson<Legend[]>('legends.json')

const FACET_OF_NATURE_ID = 29371
const CORE_VALUE_TRAIT_ID = 1806
const durationPercent = { boon: 0, condition: 0 }

const dragon = legends.find((l) => l.name === 'Legendary Dragon Stance')!
const assassin = legends.find((l) => l.name === 'Legendary Assassin Stance')!
const dwarf = legends.find((l) => l.name === 'Legendary Dwarf Stance')!
const centaur = legends.find((l) => l.name === 'Legendary Centaur Stance')!
const demon = legends.find((l) => l.name === 'Legendary Demon Stance')!
const renegade = legends.find((l) => l.name === 'Legendary Renegade Stance')!
const alliance = legends.find((l) => l.name === 'Legendary Alliance')!

describe('Facet of Nature (29371) — own per-legend descriptions', () => {
  it('shows a descriptive row only for equipped, True-Nature-eligible legends', () => {
    const skill = byId.get(FACET_OF_NATURE_ID)!
    const equipped = new Set([dragon.id, dwarf.id])
    const facts = legendFormFactsForSkill(skill, equipped, legends)
    expect(facts.map((f) => f.legend.name).sort()).toEqual(['Legendary Dragon Stance', 'Legendary Dwarf Stance'])
    expect(facts.find((f) => f.legend.name === 'Legendary Dwarf Stance')?.text).toContain('Reduce incoming damage to allies.')
  })

  it('shows nothing for Renegade/Alliance — Facet of Nature has no form for either', () => {
    const skill = byId.get(FACET_OF_NATURE_ID)!
    const equipped = new Set([renegade.id, alliance.id])
    expect(legendFormFactsForSkill(skill, equipped, legends)).toEqual([])
  })
})

describe('True Nature (Facet of Nature\'s Consume effect) — trueNatureBranches', () => {
  it('returns one labeled branch per equipped True-Nature-eligible legend, none for the other', () => {
    const skill = byId.get(FACET_OF_NATURE_ID)!
    const equipped = new Set([dragon.id, assassin.id])
    const branches = branchConditionalFacts(skill, durationPercent, 0, new Set(), equipped, legends)
    expect(branches?.map((b) => b.label).sort()).toEqual(['True Nature (Legendary Assassin Stance)', 'True Nature (Legendary Dragon Stance)'])
  })

  it('returns no branches at all for Renegade + Alliance (no True Nature form for either)', () => {
    const skill = byId.get(FACET_OF_NATURE_ID)!
    const equipped = new Set([renegade.id, alliance.id])
    const branches = branchConditionalFacts(skill, durationPercent, 0, new Set(), equipped, legends)
    expect(branches).toEqual([])
  })

  it('Dwarf branch grants Stability (2 stacks base), flagged countsTowardTotals', () => {
    const skill = byId.get(FACET_OF_NATURE_ID)!
    const branches = branchConditionalFacts(skill, durationPercent, 0, new Set(), new Set([dwarf.id]), legends)!
    const dwarfBranch = branches.find((b) => b.label === 'True Nature (Legendary Dwarf Stance)')!
    expect(dwarfBranch.countsTowardTotals).toBe(true)
    expect(dwarfBranch.facts).toHaveLength(1)
    expect(dwarfBranch.facts[0]).toMatchObject({ boonOrConditionName: 'Stability', applyCount: 2, baseDurationSeconds: 4 })
  })

  it('Demon branch grants Might (5 stacks, unaffected by Core Value), flagged countsTowardTotals', () => {
    const skill = byId.get(FACET_OF_NATURE_ID)!
    const branches = branchConditionalFacts(skill, durationPercent, 0, new Set([CORE_VALUE_TRAIT_ID]), new Set([demon.id]), legends)!
    const demonBranch = branches.find((b) => b.label === 'True Nature (Legendary Demon Stance)')!
    expect(demonBranch.countsTowardTotals).toBe(true)
    expect(demonBranch.facts[0]).toMatchObject({ boonOrConditionName: 'Might', applyCount: 5, baseDurationSeconds: 10 })
  })

  it('Assassin/Dragon/Centaur branches carry no tracked boon/condition (display-only numericLines)', () => {
    const skill = byId.get(FACET_OF_NATURE_ID)!
    const equipped = new Set([assassin.id, dragon.id, centaur.id])
    const branches = branchConditionalFacts(skill, durationPercent, 0, new Set(), equipped, legends)!
    for (const b of branches) {
      expect(b.facts).toEqual([])
      expect(b.countsTowardTotals).toBeUndefined()
    }
  })

  it('Core Value (1806) boosts each variant\'s single overridden fact, base value otherwise', () => {
    const skill = byId.get(FACET_OF_NATURE_ID)!
    const equipped = new Set([assassin.id, dwarf.id, dragon.id, centaur.id, demon.id])

    const withoutCoreValue = branchConditionalFacts(skill, durationPercent, 0, new Set(), equipped, legends)!
    const withCoreValue = branchConditionalFacts(skill, durationPercent, 0, new Set([CORE_VALUE_TRAIT_ID]), equipped, legends)!
    const byLabel = (branches: typeof withoutCoreValue) => new Map(branches.map((b) => [b.label, b]))
    const base = byLabel(withoutCoreValue)
    const boosted = byLabel(withCoreValue)

    // Assassin: Boons Removed 2 -> 3
    expect(base.get('True Nature (Legendary Assassin Stance)')?.numericLines.find((l) => l.text.startsWith('Boons Removed'))?.text).toBe(
      'Boons Removed: 2'
    )
    expect(boosted.get('True Nature (Legendary Assassin Stance)')?.numericLines.find((l) => l.text.startsWith('Boons Removed'))?.text).toBe(
      'Boons Removed: 3'
    )

    // Dwarf: Stability apply_count 2 -> 3 (a real BoonConditionSource, not a numericLine)
    expect(base.get('True Nature (Legendary Dwarf Stance)')?.facts[0].applyCount).toBe(2)
    expect(boosted.get('True Nature (Legendary Dwarf Stance)')?.facts[0].applyCount).toBe(3)

    // Dragon: Duration Increase 2s -> 3s; its own separate "Conditions Removed" fact is untouched
    expect(base.get('True Nature (Legendary Dragon Stance)')?.numericLines.find((l) => l.text.startsWith('Duration Increase'))?.text).toBe(
      'Duration Increase: 2s'
    )
    expect(boosted.get('True Nature (Legendary Dragon Stance)')?.numericLines.find((l) => l.text.startsWith('Duration Increase'))?.text).toBe(
      'Duration Increase: 3s'
    )
    expect(boosted.get('True Nature (Legendary Dragon Stance)')?.numericLines.find((l) => l.text.startsWith('Conditions Removed'))?.text).toBe(
      'Conditions Removed: 3'
    )

    // Centaur: Conditions Removed 2 -> 3
    expect(base.get('True Nature (Legendary Centaur Stance)')?.numericLines.find((l) => l.text.startsWith('Conditions Removed'))?.text).toBe(
      'Conditions Removed: 2'
    )
    expect(boosted.get('True Nature (Legendary Centaur Stance)')?.numericLines.find((l) => l.text.startsWith('Conditions Removed'))?.text).toBe(
      'Conditions Removed: 3'
    )

    // Demon: Conditions Transferred 2 -> 3; Might itself is untouched (Core Value overrides a
    // different index on this variant)
    expect(base.get('True Nature (Legendary Demon Stance)')?.numericLines.find((l) => l.text.startsWith('Conditions Transferred'))?.text).toBe(
      'Conditions Transferred: 2'
    )
    expect(boosted.get('True Nature (Legendary Demon Stance)')?.numericLines.find((l) => l.text.startsWith('Conditions Transferred'))?.text).toBe(
      'Conditions Transferred: 3'
    )
    expect(boosted.get('True Nature (Legendary Demon Stance)')?.facts[0].applyCount).toBe(5)
  })
})
