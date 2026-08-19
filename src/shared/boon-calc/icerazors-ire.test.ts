import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact, Skill } from '../types'
import { boonConditionFactsForSkill } from './sources'

/**
 * Regression guard for "Icerazor's Ire lost its Immob condition application" (flagged 2026-08-19,
 * right after the Session 231 batch — but confirmed unchanged at the prior commit, so this typo
 * predates that session; it was never actually working). `synthetic-facts.json`'s entries for
 * 40485/72359 spelled the status "Immobilize" instead of `CONDITION_NAMES`' real "Immobile," so
 * `classifyBoonCondition` silently dropped the fact on every extraction — not a duration/scaling
 * bug, a total no-show. `wvw-fact-overrides.json`'s matching `Immobile: 1.5` entries (keyed by
 * `fact.status`, same lookup) were fixed alongside it for the same reason — a duration-only key fix
 * without the status-name fix would have left the override silently unmatched too.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}
const rawSkills = readJson<Skill[]>('skills.json')
const syntheticFacts = readJson<Record<string, Fact[]>>('synthetic-facts.json')
const wvwOverrides = readJson<{ skill: Record<number, Record<string, number | 'omit'>> }>('wvw-fact-overrides.json')
const skills = rawSkills.map((s) => (syntheticFacts[s.id] ? { ...s, facts: [...s.facts, ...syntheticFacts[s.id]] } : s))
const byId = new Map(skills.map((s) => [s.id, s]))

describe.each([
  ['Icerazor\'s Ire (base cast)', 40485],
  ['Icerazor\'s Ire (Band Together-enhanced cast)', 72359]
])('%s', (_label, id) => {
  it('applies Immobile at the wvw+pvp duration (1.5s), not dropped entirely', () => {
    const skill = byId.get(id)
    expect(skill).toBeDefined()
    if (!skill) return
    const facts = boonConditionFactsForSkill(skill, new Set(), new Set(), { boon: 0, condition: 0 }, wvwOverrides.skill[id], [])
    const immobile = facts.filter((f) => f.boonOrConditionName === 'Immobile')
    expect(immobile).toHaveLength(1)
    expect(immobile[0].baseDurationSeconds).toBe(1.5)
    expect(immobile[0].isCondition).toBe(true)
  })
})
