import type { ProfessionId, Skill } from '../types'

/**
 * Racial skills (Human/Charr/Asura/Norn/Sylvari Heal/Utility/Elite skills, e.g. "Avatar of
 * Melandru" or "Summon Druid Spirit") have no dedicated field anywhere in this app's data —
 * `skills.json` carries no `race`, and neither does any other file under `data/game-data/` (see
 * TODO.md, scoped 2026-08-04). Rather than hand-curate a 36-id list (this app's usual approach for
 * a real API gap, e.g. `NON_EQUIPPABLE_SKILL_IDS` in `skill-variants.ts`), racial skills turn out
 * to share one exact, verifiable signature already present in the API data: `specializationId ===
 * null` *and* `professions` is precisely these 8 — every profession except Revenant, which didn't
 * exist when racial skills were designed and was never retrofitted to use them. Confirmed
 * 2026-08-06 via a full `skills.json` scan: grouping every `specializationId: null` skill with 2-8
 * professions by its exact profession set yields exactly one group matching this signature (36
 * ids, all genuine racial skills including their "Release the X" flip targets), and no other group
 * at all in that profession-count range — no false positives to guard against. The only sibling
 * shape (`specializationId: null` spanning all *9* professions, e.g. the shared "Bandage" downed
 * skill) includes Revenant and is therefore excluded by the `=== 8` check below.
 */
const RACIAL_SKILL_PROFESSIONS: readonly ProfessionId[] = [
  'Elementalist',
  'Engineer',
  'Guardian',
  'Mesmer',
  'Necromancer',
  'Ranger',
  'Thief',
  'Warrior'
]

export function isRacialSkill(skill: Skill): boolean {
  return (
    skill.specializationId === null &&
    skill.professions.length === RACIAL_SKILL_PROFESSIONS.length &&
    RACIAL_SKILL_PROFESSIONS.every((p) => skill.professions.includes(p))
  )
}
