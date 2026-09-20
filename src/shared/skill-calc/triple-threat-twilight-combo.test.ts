import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { branchConditionalFacts } from './branch-conditional-facts'

/**
 * Regression guard for TODO.md "Triple Threat/Twilight Combo Missing Enemy/Ally Effects" — Scepter
 * skill 3's other two off-hand variants had the same "empty/stale API facts" shape Measured Shot/
 * Endless Night already had a fix for (`specter-scepter-skill3.test.ts`). `tripleThreatSections`/
 * `twilightComboSections` in `branch-conditional-facts.ts` fill the gap from wiki-sourced data.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const skills = readJson<Skill[]>('skills.json')
const byId = new Map(skills.map((s) => [s.id, s]))

const TRIPLE_THREAT_ID = 63154
const TWILIGHT_COMBO_ID = 63254

describe('Triple Threat (Scepter skill 3, off-hand-empty) branch-conditional facts', () => {
  const durationPercent = { boon: 0, condition: 0 }

  it('Enemy Target grants Torment', () => {
    const skill = byId.get(TRIPLE_THREAT_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const enemyBranch = (branches ?? []).find((b) => b.label === 'Enemy Target')
    expect(enemyBranch).toBeDefined()
    expect(enemyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Torment', baseDurationSeconds: 4, targetCount: 1 }))
  })

  it('Ally Target shows a Healing-Power-scaled Barrier, with no boon/condition facts', () => {
    const skill = byId.get(TRIPLE_THREAT_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 1000)
    expect(branches).not.toBeNull()
    const allyBranch = (branches ?? []).find((b) => b.label === 'Ally Target')
    expect(allyBranch).toBeDefined()
    expect(allyBranch?.facts).toEqual([])
    expect(allyBranch?.numericLines.some((l) => l.text.includes('Barrier: 435'))).toBe(true) // 365 + 0.07*1000
    expect(allyBranch?.numericLines.some((l) => l.text.includes('Unblockable'))).toBe(true)
  })
})

describe('Twilight Combo (Scepter skill 3, off-hand Dagger) branch-conditional facts', () => {
  const durationPercent = { boon: 0, condition: 0 }

  it('Enemy Target grants Chilled, Poisoned and 3-stack Torment', () => {
    const skill = byId.get(TWILIGHT_COMBO_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const enemyBranch = (branches ?? []).find((b) => b.label === 'Enemy Target')
    expect(enemyBranch).toBeDefined()
    expect(enemyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Chilled', baseDurationSeconds: 3, targetCount: 1 }))
    expect(enemyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Poisoned', baseDurationSeconds: 8, targetCount: 1 }))
    expect(enemyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Torment', baseDurationSeconds: 8, applyCount: 3, targetCount: 1 }))
  })

  it('Ally Target grants Swiftness plus a Healing-Power-scaled Barrier and heal', () => {
    const skill = byId.get(TWILIGHT_COMBO_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 1000)
    expect(branches).not.toBeNull()
    const allyBranch = (branches ?? []).find((b) => b.label === 'Ally Target')
    expect(allyBranch).toBeDefined()
    expect(allyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Swiftness', baseDurationSeconds: 5, targetCount: 5 }))
    expect(allyBranch?.numericLines.some((l) => l.text.includes('Barrier: 3,076'))).toBe(true) // 2576 + 0.5*1000
    expect(allyBranch?.numericLines.some((l) => l.text.includes('Second Missile Healing: 914'))).toBe(true) // 714 + 0.2*1000
  })
})
