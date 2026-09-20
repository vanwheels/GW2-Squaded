import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { branchConditionalFacts } from './branch-conditional-facts'

/**
 * Regression guard for "Specter Scepter Auto Chain Display" (TODO.md, flagged 2026-09-20): Shadow
 * Bolt/Double Bolt/Triple Bolt's local `skills.json` entries carry only Range (plus Double/Triple
 * Bolt's own "Number of Impacts") — every real Enemy/Ally-branch number is filled from wiki-sourced
 * data by `scepterAutoBoltSections` in `branch-conditional-facts.ts`. See `flip-skill-overrides.test.ts`
 * for the separate chain-linking (flipSkill) regression guard.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const skills = readJson<Skill[]>('skills.json')
const byId = new Map(skills.map((s) => [s.id, s]))

const SHADOW_BOLT_ID = 63066
const DOUBLE_BOLT_ID = 63182
const TRIPLE_BOLT_ID = 63134

describe('Shadow Bolt/Double Bolt/Triple Bolt branch-conditional facts', () => {
  const durationPercent = { boon: 0, condition: 0 }

  it('Shadow Bolt Enemy Target grants Torment, with no Number of Hits line (single hit)', () => {
    const skill = byId.get(SHADOW_BOLT_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const enemyBranch = (branches ?? []).find((b) => b.label === 'Enemy Target')
    expect(enemyBranch).toBeDefined()
    expect(enemyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Torment', baseDurationSeconds: 2, targetCount: 1 }))
    expect(enemyBranch?.numericLines.some((l) => l.text.startsWith('Number of Hits'))).toBe(false)
  })

  it('Double Bolt Ally Target shows a Healing-Power-scaled Barrier and Number of Impacts: 2', () => {
    const skill = byId.get(DOUBLE_BOLT_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 1000)
    expect(branches).not.toBeNull()
    const allyBranch = (branches ?? []).find((b) => b.label === 'Ally Target')
    expect(allyBranch).toBeDefined()
    expect(allyBranch?.numericLines.some((l) => l.text.includes('Barrier: 435'))).toBe(true) // 365 + 0.07*1000
    expect(allyBranch?.numericLines.some((l) => l.text === 'Number of Impacts: 2')).toBe(true)
  })

  it('Triple Bolt Enemy Target shows Number of Hits: 3', () => {
    const skill = byId.get(TRIPLE_BOLT_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const enemyBranch = (branches ?? []).find((b) => b.label === 'Enemy Target')
    expect(enemyBranch).toBeDefined()
    expect(enemyBranch?.numericLines.some((l) => l.text === 'Number of Hits: 3')).toBe(true)
    expect(enemyBranch?.facts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Torment', baseDurationSeconds: 2 }))
  })
})
