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
