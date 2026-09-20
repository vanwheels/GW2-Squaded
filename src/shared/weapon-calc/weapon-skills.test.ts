import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ProfessionWeapon, Skill } from '../types'
import { resolveSkillBarIds } from './weapon-skills'

/**
 * Regression guard for the "rev sword 4 is displaying a flip skill for a skill that doesn't exist"
 * bug (flagged 2026-08-19) — see `RETIRED_WEAPON_SKILL_IDS`'s own doc comment in `weapon-skills.ts`
 * for the full root-cause writeup. Reads `data/game-data/skills.json`/`professions.json` directly,
 * same pattern `additive-flip-pairs.test.ts` already uses.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const skills = readJson<Skill[]>('skills.json')
const skillsById = new Map(skills.map((s) => [s.id, s]))

describe('resolveSkillBarIds — Revenant off-hand Sword (Duelist\'s Preparation retired 2017)', () => {
  it('resolves Weapon_4 to Shackling Wave alone, not the retired Duelist\'s Preparation', () => {
    const professions = readJson<{ id: string; weapons: Record<string, ProfessionWeapon> }[]>('professions.json')
    const revenant = professions.find((p) => p.id === 'Revenant')
    expect(revenant).toBeDefined()
    const offHandSword = revenant?.weapons['Sword']
    expect(offHandSword).toBeDefined()
    if (!offHandSword) return

    const ids = resolveSkillBarIds(offHandSword.skills, 'land', skillsById, new Set())
    expect(ids[3]).toBe(28472) // Shackling Wave, not 28571 Duelist's Preparation
  })
})

/**
 * Regression guard for "scepter+pistol skill 3 shows Triple Threat instead of Measured Shot"
 * (flagged 2026-09-20, TODO.md "Specter Scepter/Pistol Skill 3 Display") — Triple Threat's (63154)
 * bogus `flipSkill` pointer to Measured Shot (63267) used to make the flip-target-removal signal
 * drop Measured Shot before the Thief dual-wield hand-context signal ever got a chance to pick it
 * for a Pistol off-hand. See the `THIEF_DUAL_WIELD_OFFHAND` exemption in signal 1's doc comment.
 */
describe('resolveSkillBarIds — Specter Scepter skill 3 (off-hand-dependent)', () => {
  const professions = readJson<{ id: string; weapons: Record<string, ProfessionWeapon> }[]>('professions.json')
  const thief = professions.find((p) => p.id === 'Thief')
  const scepter = thief?.weapons['Scepter']

  it('resolves to Measured Shot with an off-hand Pistol, not Triple Threat', () => {
    expect(scepter).toBeDefined()
    if (!scepter) return
    const ids = resolveSkillBarIds(scepter.skills, 'land', skillsById, new Set([71]), 'Pistol')
    expect(ids[2]).toBe(63267) // Measured Shot, not 63154 Triple Threat
  })

  it('still resolves to Twilight Combo with an off-hand Dagger', () => {
    expect(scepter).toBeDefined()
    if (!scepter) return
    const ids = resolveSkillBarIds(scepter.skills, 'land', skillsById, new Set([71]), 'Dagger')
    expect(ids[2]).toBe(63254)
  })

  it('still falls back to Triple Threat with no off-hand', () => {
    expect(scepter).toBeDefined()
    if (!scepter) return
    const ids = resolveSkillBarIds(scepter.skills, 'land', skillsById, new Set([71]), null)
    expect(ids[2]).toBe(63154)
  })
})
