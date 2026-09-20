import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { branchConditionalFacts } from './branch-conditional-facts'

/**
 * Regression guard for the 2026-09-20 "Specter Siphon F1 Effects" fix (TODO.md Leg 2):
 * `siphonSections` in `branch-conditional-facts.ts`. Same "lock in what's already known-correct"
 * purpose as `luminary.test.ts`.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const skills = readJson<Skill[]>('skills.json')
const byId = new Map(skills.map((s) => [s.id, s]))

const SIPHON_ID = 63067

describe('Specter Siphon (F1) branch-conditional facts', () => {
  const durationPercent = { boon: 0, condition: 0 }

  it('Enemy Target grants Slow and shows Shadow Force Gain', () => {
    const skill = byId.get(SIPHON_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const enemyBranch = (branches ?? []).find((b) => b.label === 'Enemy Target')
    expect(enemyBranch).toBeDefined()
    expect(enemyBranch?.facts.map((f) => f.boonOrConditionName)).toContain('Slow')
    expect(enemyBranch?.numericLines.some((l) => l.text === 'Shadow Force Gain: 25%')).toBe(true)
  })

  it('Ally Target shows a Healing-Power-scaled Barrier and cooldown reduction, with no boon/condition facts', () => {
    const skill = byId.get(SIPHON_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 1000)
    expect(branches).not.toBeNull()
    const allyBranch = (branches ?? []).find((b) => b.label === 'Ally Target')
    expect(allyBranch).toBeDefined()
    expect(allyBranch?.facts).toEqual([])
    expect(allyBranch?.numericLines.some((l) => l.text.includes('Barrier: 1,928'))).toBe(true) // 1428 + 0.5*1000
    expect(allyBranch?.numericLines.some((l) => l.text === 'Ally Target Recharge Reduction: 50%')).toBe(true)
  })

  it('neither branch counts toward aggregate boon/condition totals (a per-cast target choice)', () => {
    const skill = byId.get(SIPHON_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect((branches ?? []).some((b) => b.countsTowardTotals)).toBe(false)
  })

  it('returns null for an unrelated skill', () => {
    const skill = byId.get(63155) // Specter F2 "Enter Shadow Shroud" — no branch-conditional facts of its own
    expect(skill).toBeDefined()
    if (!skill) return
    expect(branchConditionalFacts(skill, durationPercent, 0)).toBeNull()
  })
})
