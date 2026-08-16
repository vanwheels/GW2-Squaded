import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { flipTargetSkills } from './multi-effect'
import { TURRET_SUB_ABILITY_IDS } from './turret-sub-abilities'

/**
 * `TURRET_SUB_ABILITY_IDS` staleness scan + wiring check — same "a game-data refresh can silently
 * drift a hand-curated id table" concern `buff-instance-label-completeness.test.ts` guards against,
 * plus a direct check that `flipTargetSkills` actually surfaces both sub-abilities (the user-flagged
 * bug this table exists to fix, 2026-08-16: Supply Crate showed neither).
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const skills: Skill[] = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/skills.json'), 'utf-8'))
const skillsById = new Map(skills.map((s) => [s.id, s]))

describe('TURRET_SUB_ABILITY_IDS', () => {
  it('every turret id and both its sub-ability ids still exist in skills.json', () => {
    for (const [turretId, subIds] of TURRET_SUB_ABILITY_IDS) {
      expect(skillsById.has(turretId), `turret id ${turretId} missing from skills.json`).toBe(true)
      expect(subIds).toHaveLength(2)
      for (const subId of subIds) {
        expect(skillsById.has(subId), `sub-ability id ${subId} (turret ${turretId}) missing from skills.json`).toBe(true)
      }
    }
  })

  it('every turret key is still tagged the Turret category, and its sub-abilities still share its toolbeltSkill', () => {
    for (const [turretId, subIds] of TURRET_SUB_ABILITY_IDS) {
      const turret = skillsById.get(turretId)!
      expect(turret.categories, `turret id ${turretId} lost its Turret category`).toContain('Turret')
      for (const subId of subIds) {
        const sub = skillsById.get(subId)!
        expect(sub.toolbeltSkill, `sub-ability ${subId} no longer shares toolbeltSkill with turret ${turretId}`).toBe(
          turret.toolbeltSkill
        )
      }
    }
  })

  it("Supply Crate (6183) resolves both its Overcharge and Detonate flip icons via flipTargetSkills", () => {
    const supplyCrate = skillsById.get(6183)!
    const flips = flipTargetSkills(supplyCrate, skillsById)
    expect(flips.map((f) => f.skill.id).sort()).toEqual([30230, 38750].sort())
    expect(flips.map((f) => f.label)).toEqual(['Overcharge Supply Crate', 'Detonate Supply Crate Turrets'])
  })

  it('Rifle Turret (5818), whose raw flipSkill is null on the equipped id, still resolves both flip icons', () => {
    const rifleTurret = skillsById.get(5818)!
    expect(rifleTurret.flipSkill, 'fixture assumption drifted — re-check the raw API data').toBeNull()
    const flips = flipTargetSkills(rifleTurret, skillsById)
    expect(flips.map((f) => f.skill.id).sort()).toEqual([5874, 5957].sort())
  })
})
