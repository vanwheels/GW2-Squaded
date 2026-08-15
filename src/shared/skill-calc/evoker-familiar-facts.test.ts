import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact, Skill } from '../types'
import { MISCELLANEOUS_MATCHERS, namedFactsForSkill } from '../boon-calc/sources'
import { EVOKER_FAMILIAR_BASE_TO_TARGET_ID, EVOKER_FAMILIAR_SPECIALIZED_ELEMENT, EVOKER_FAMILIAR_TARGET_IDS, evokerFamiliarFactSourceSkill } from './evoker-familiar-facts'
import { flipTargetSkills } from './multi-effect'

/**
 * Regression guard for `evoker-familiar-facts.ts`/`SkillsEditor.tsx`'s `evokerFamiliarBonusFacts` —
 * same "lock in what's already known-correct" purpose as `additive-flip-pairs.test.ts`, scoped to
 * this file's swap-not-diff mechanism instead.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const rawSkills = readJson<Skill[]>('skills.json')
const syntheticFacts = readJson<Record<string, Fact[]>>('synthetic-facts.json')
const skills = rawSkills.map((s) => (syntheticFacts[s.id] ? { ...s, facts: [...s.facts, ...syntheticFacts[s.id]] } : s))
const byId = new Map(skills.map((s) => [s.id, s]))

describe('EVOKER_FAMILIAR_BASE_TO_TARGET_ID', () => {
  it('has exactly the 4 wiki-confirmed Meditations', () => {
    expect(EVOKER_FAMILIAR_BASE_TO_TARGET_ID.size).toBe(4)
  })

  it.each(Array.from(EVOKER_FAMILIAR_BASE_TO_TARGET_ID.entries()))('base %s really flips to target %s in skills.json', (baseId, targetId) => {
    const base = byId.get(baseId)
    expect(base, `base id ${baseId} missing from skills.json`).toBeDefined()
    expect(base?.flipSkill).toBe(targetId)
  })

  it.each(Array.from(EVOKER_FAMILIAR_BASE_TO_TARGET_ID.entries()))('base %s and target %s share the same skill name', (baseId, targetId) => {
    const base = byId.get(baseId)
    const target = byId.get(targetId)
    expect(base?.name).toBe(target?.name)
  })

  it('evokerFamiliarFactSourceSkill resolves every base id to its real target skill, and returns null for everything else', () => {
    for (const [baseId, targetId] of EVOKER_FAMILIAR_BASE_TO_TARGET_ID) {
      const base = byId.get(baseId)
      expect(base).toBeDefined()
      if (!base) continue
      expect(evokerFamiliarFactSourceSkill(base, byId)?.id).toBe(targetId)
    }
    // A skill with no Evoker relationship at all never matches.
    const unrelated = skills.find((s) => !EVOKER_FAMILIAR_BASE_TO_TARGET_ID.has(s.id) && !EVOKER_FAMILIAR_TARGET_IDS.has(s.id))
    expect(unrelated).toBeDefined()
    if (unrelated) expect(evokerFamiliarFactSourceSkill(unrelated, byId)).toBeNull()
  })

  it('flipTargetSkills stops at every familiar target instead of showing it as a 2nd stacked icon', () => {
    for (const baseId of EVOKER_FAMILIAR_BASE_TO_TARGET_ID.keys()) {
      const base = byId.get(baseId)
      expect(base).toBeDefined()
      if (!base) continue
      const flips = flipTargetSkills(base, byId)
      for (const f of flips) {
        expect(EVOKER_FAMILIAR_TARGET_IDS.has(f.skill.id)).toBe(false)
      }
    }
  })
})

describe('EVOKER_FAMILIAR_SPECIALIZED_ELEMENT', () => {
  it('has exactly the 4 targets, each carrying its own live StunBreak fact to split out', () => {
    expect(EVOKER_FAMILIAR_SPECIALIZED_ELEMENT.size).toBe(4)
    const activeIds = new Set<number>()
    const legendIds = new Set<string>()
    for (const targetId of EVOKER_FAMILIAR_SPECIALIZED_ELEMENT.keys()) {
      const target = byId.get(targetId)
      expect(target, `target id ${targetId} missing from skills.json`).toBeDefined()
      if (!target) continue
      const stunBreaks = namedFactsForSkill(target, activeIds, legendIds, MISCELLANEOUS_MATCHERS).filter((f) => f.name === 'Breaks Stun')
      expect(stunBreaks.length, `${target.name} (${targetId}) should carry exactly one StunBreak fact`).toBe(1)
    }
  })

  it('maps each familiar element to the wiki-confirmed skill (Fox=Fire, Otter=Water, Toad=Earth, Hare=Air)', () => {
    const byName = new Map(Array.from(EVOKER_FAMILIAR_SPECIALIZED_ELEMENT.entries()).map(([id, element]) => [byId.get(id)?.name, element]))
    expect(byName.get("Fox's Fury")).toBe('Fire')
    expect(byName.get("Otter's Compassion")).toBe('Water')
    expect(byName.get("Toad's Fortitude")).toBe('Earth')
    expect(byName.get("Hare's Agility")).toBe('Air')
  })
})
