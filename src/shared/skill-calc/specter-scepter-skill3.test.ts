import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { branchConditionalFacts } from './branch-conditional-facts'

/**
 * Regression guard for the 2026-09-20 follow-up to "Specter Scepter/Pistol Skill 3 Display"
 * (TODO.md Leg 3): once `weapon-calc/weapon-skills.ts` correctly resolves Scepter+Pistol's skill 3
 * to Measured Shot (63267, flipping to Endless Night 63128), the user found neither skill's own
 * tooltip showed any boon/condition beyond Range/Number of Targets — the local API data for both is
 * a stale/incomplete copy missing every real Enemy/Ally-branch number, same "empty API facts" shape
 * `specter-siphon.test.ts` already guards. `measuredShotSections`/`endlessNightSections` in
 * `branch-conditional-facts.ts` fill the gap from wiki-sourced data.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const skills = readJson<Skill[]>('skills.json')
const byId = new Map(skills.map((s) => [s.id, s]))

const MEASURED_SHOT_ID = 63267
const ENDLESS_NIGHT_ID = 63128

describe('Measured Shot (Scepter skill 3, off-hand Pistol) branch-conditional facts', () => {
  const durationPercent = { boon: 0, condition: 0 }

  it('Enemy Target grants Immobile', () => {
    const skill = byId.get(MEASURED_SHOT_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const enemyBranch = (branches ?? []).find((b) => b.label === 'Enemy Target')
    expect(enemyBranch).toBeDefined()
    expect(enemyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Immobile', baseDurationSeconds: 1, targetCount: 4 }))
  })

  it('Ally Target shows a Healing-Power-scaled heal, with no boon/condition facts', () => {
    const skill = byId.get(MEASURED_SHOT_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 1000)
    expect(branches).not.toBeNull()
    const allyBranch = (branches ?? []).find((b) => b.label === 'Ally Target')
    expect(allyBranch).toBeDefined()
    expect(allyBranch?.facts).toEqual([])
    expect(allyBranch?.numericLines.some((l) => l.text.includes('Healing: 1,885'))).toBe(true) // 1441 + 0.444*1000
  })
})

describe('Endless Night (Measured Shot flip target) branch-conditional facts', () => {
  const durationPercent = { boon: 0, condition: 0 }

  it('Enemy Target grants Slow and Torment', () => {
    const skill = byId.get(ENDLESS_NIGHT_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const enemyBranch = (branches ?? []).find((b) => b.label === 'Enemy Target')
    expect(enemyBranch).toBeDefined()
    expect(enemyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Slow', baseDurationSeconds: 0.5, targetCount: 3 }))
    expect(enemyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Torment', baseDurationSeconds: 6, targetCount: 3 }))
  })

  it('Ally Target grants Regeneration and Vigor (not Quickness) plus a Healing-Power-scaled Barrier', () => {
    const skill = byId.get(ENDLESS_NIGHT_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 1000)
    expect(branches).not.toBeNull()
    const allyBranch = (branches ?? []).find((b) => b.label === 'Ally Target')
    expect(allyBranch).toBeDefined()
    expect(allyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Regeneration', baseDurationSeconds: 1, targetCount: 5 }))
    expect(allyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Vigor', baseDurationSeconds: 0.5, targetCount: 5 }))
    expect(allyBranch?.facts.some((f) => f.boonOrConditionName === 'Quickness')).toBe(false)
    expect(allyBranch?.numericLines.some((l) => l.text.includes('Barrier: 865'))).toBe(true) // 645 + 0.22*1000
  })
})
