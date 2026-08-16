import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { branchConditionalFacts } from './branch-conditional-facts'
import { professionMechanicBar } from './profession-mechanic'
import type { Profession } from '../types'

/**
 * Regression guard for the 2026-08-16 Luminary fixes (TODO.md bug report): the F4 "Enter Radiant
 * Forge" bundle wiring in `bundle-skills.ts` (`RADIANT_FORGE_SLOT_SKILLS`) and the F1-F3 Virtue
 * fact curation in `branch-conditional-facts.ts` (`radiantJusticeSections`/`radiantResolveSections`/
 * `radiantCourageSections`). Same "lock in what's already known-correct" purpose as
 * `evoker-familiar-facts.test.ts`.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const skills = readJson<Skill[]>('skills.json')
const byId = new Map(skills.map((s) => [s.id, s]))
const professions = readJson<Profession[]>('professions.json')
const guardian = professions.find((p) => p.id === 'Guardian')

const LUMINARY_SPEC_ID = 81
const ENTER_RADIANT_FORGE_ID = 77073
const RADIANT_JUSTICE_ID = 78837
const RADIANT_RESOLVE_ID = 78604
const RADIANT_COURAGE_ID = 78358

describe('Luminary profession-mechanic bar', () => {
  it('resolves F1-F4 to Radiant Justice/Resolve/Courage/Enter Radiant Forge with only Luminary equipped', () => {
    expect(guardian).toBeDefined()
    if (!guardian) return
    const bar = professionMechanicBar(guardian, byId, new Set([LUMINARY_SPEC_ID]))
    const bySlot = new Map(bar.map((e) => [e.slot, e.skill.id]))
    expect(bySlot.get('Profession_1')).toBe(RADIANT_JUSTICE_ID)
    expect(bySlot.get('Profession_2')).toBe(RADIANT_RESOLVE_ID)
    expect(bySlot.get('Profession_3')).toBe(RADIANT_COURAGE_ID)
    expect(bySlot.get('Profession_4')).toBe(ENTER_RADIANT_FORGE_ID)
  })

  it('does not show any Luminary mechanic skill when no elite spec is equipped', () => {
    expect(guardian).toBeDefined()
    if (!guardian) return
    const bar = professionMechanicBar(guardian, byId, new Set())
    const ids = new Set(bar.map((e) => e.skill.id))
    expect(ids.has(RADIANT_JUSTICE_ID)).toBe(false)
    expect(ids.has(RADIANT_RESOLVE_ID)).toBe(false)
    expect(ids.has(RADIANT_COURAGE_ID)).toBe(false)
    expect(ids.has(ENTER_RADIANT_FORGE_ID)).toBe(false)
  })
})

describe('Radiant Forge bundle (RADIANT_FORGE_SLOT_SKILLS)', () => {
  it('maps Enter Radiant Forge to 5 real, distinct skill ids that exist in skills.json', async () => {
    const { bundleCapableSkillIds } = await import('./bundle-skills')
    const capable = bundleCapableSkillIds(
      { skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: null } } as never,
      byId,
      {},
      [ENTER_RADIANT_FORGE_ID]
    )
    expect(capable).toContain(ENTER_RADIANT_FORGE_ID)
  })

  it('resolveActiveBundle returns the 5 Radiant Forge weapon-bar skills in slot order', async () => {
    const { resolveActiveBundle } = await import('./bundle-skills')
    const build = {
      activeBundleSkillId: ENTER_RADIANT_FORGE_ID,
      environment: 'land'
    } as never
    const bundle = resolveActiveBundle(build, byId, {}, 'land')
    expect(bundle).not.toBeNull()
    expect(bundle?.kind).toBe('kit')
    expect(bundle?.slots.map((s) => (s?.kind === 'kit' ? s.skill.name : null))).toEqual([
      'Glaring Burst',
      'Dazzling Hammer',
      'Luminous Staff',
      'Gleaming Blade',
      'Radiant Bulwark'
    ])
  })
})

describe('Radiant Virtue branch-conditional facts', () => {
  const durationPercent = { boon: 0, condition: 0 }

  it('Radiant Justice grants Burning (passive), Quickness (activate), and Vulnerability (Empowered Hammer)', () => {
    const skill = byId.get(RADIANT_JUSTICE_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const names = (branches ?? []).flatMap((b) => b.facts.map((f) => f.boonOrConditionName))
    expect(names).toContain('Burning')
    expect(names).toContain('Quickness')
    expect(names).toContain('Vulnerability')
    // Virtue + Activate are the always-on components; only they should count toward aggregate totals.
    const counted = (branches ?? []).filter((b) => b.countsTowardTotals).map((b) => b.label)
    expect(counted).toEqual(['Virtue (Passive)', 'Activate'])
  })

  it('Radiant Resolve grants Light Aura (activate) and Regeneration (Empowered Staff)', () => {
    const skill = byId.get(RADIANT_RESOLVE_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 1000)
    expect(branches).not.toBeNull()
    const names = (branches ?? []).flatMap((b) => b.facts.map((f) => f.boonOrConditionName))
    expect(names).toContain('Light Aura')
    expect(names).toContain('Regeneration')
    // Healing-Power-scaled text lines should reflect the passed-in healingPower, not the base value.
    const activateLines = (branches ?? []).find((b) => b.label === 'Activate')?.numericLines ?? []
    expect(activateLines.some((l) => l.text.includes('Healing: 1,985'))).toBe(true) // 985 + 1.0*1000
  })

  it('Radiant Courage grants Aegis + Resistance (activate) and Immobile (Empowered Sword)', () => {
    const skill = byId.get(RADIANT_COURAGE_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const names = (branches ?? []).flatMap((b) => b.facts.map((f) => f.boonOrConditionName))
    expect(names).toContain('Aegis')
    expect(names).toContain('Resistance')
    expect(names).toContain('Immobile')
  })

  it('returns null for an unrelated skill', () => {
    const skill = byId.get(9115) // core Virtue of Justice — already has real API facts, no override needed
    expect(skill).toBeDefined()
    if (!skill) return
    expect(branchConditionalFacts(skill, durationPercent, 0)).toBeNull()
  })
})
