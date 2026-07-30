import type { Profession, Skill } from '../types'

export interface ProfessionMechanicBarEntry {
  slot: string
  skill: Skill
}

/**
 * Resolves a profession's mechanic ("F-skill") bar — Guardian's Virtue of Justice/Resolve/Courage
 * in F1-F3, Engineer's 4-slot Toolbelt, etc. — down to the one id per slot that actually applies
 * given the build's equipped specializations. Grouped by `Profession.professionSkills`' own
 * `slot` field (`Profession_1`-`Profession_4`) rather than by name, unlike
 * `skill-calc/skill-variants.ts`'s Heal/Utility/Elite collapsing: an elite spec reworking a
 * mechanic skill usually renames it entirely (Guardian's "Virtue of Justice" -> Firebrand's "Tome
 * of Justice" -> Willbender's "Rushing Justice"), so name-based grouping wouldn't collapse them.
 *
 * Per slot, resolution is:
 * 1. Prefer the id(s) whose `specializationId` matches an equipped spec; fall back to the
 *    spec-less (`specializationId === null`) base id if none match (same rule
 *    `skill-variants.ts` already uses for Heal/Utility/Elite reworks).
 * 2. Drop any remaining id that's another remaining id's `flipSkill` target (e.g. Firebrand's
 *    "Tome of Justice" (44364) flips to a "dormant" duplicate-named id (68647) the wiki itself
 *    documents as an alt id for the same skill — not a separate pick).
 * 3. If more than one id is still left (a real wrinkle found live 2026-07-30: Firebrand's F1 slot
 *    also lists "Stow Tome", a same-spec terminal id with no outgoing `flipSkill` of its own, and
 *    F3 lists a genuine duplicate-named "Tome of Courage" id with no outgoing flip either), prefer
 *    whichever id DOES have a non-null `flipSkill` — the entry-point skill a player actually
 *    equips always chains to something (its own activated/dormant effect), while a chain's
 *    terminal ids ("Stow X") don't. Falls back to the lowest id deterministically if that still
 *    doesn't narrow to one — a known, documented edge case, not a guess at which is "correct".
 */
export function professionMechanicBar(
  profession: Profession,
  skillsById: Map<number, Skill>,
  equippedSpecializationIds: ReadonlySet<number>
): ProfessionMechanicBarEntry[] {
  const slotOrder: string[] = []
  const bySlot = new Map<string, Skill[]>()
  for (const { id, slot } of profession.professionSkills) {
    const skill = skillsById.get(id)
    if (!skill) continue
    if (!bySlot.has(slot)) {
      bySlot.set(slot, [])
      slotOrder.push(slot)
    }
    bySlot.get(slot)!.push(skill)
  }

  const out: ProfessionMechanicBarEntry[] = []
  for (const slot of slotOrder.sort()) {
    const candidates = bySlot.get(slot)!
    const chosen = resolveMechanicSlot(candidates, equippedSpecializationIds)
    if (chosen) out.push({ slot, skill: chosen })
  }
  return out
}

function resolveMechanicSlot(candidates: Skill[], equippedSpecializationIds: ReadonlySet<number>): Skill | undefined {
  if (candidates.length === 1) return candidates[0]

  const specMatched = candidates.filter((s) => s.specializationId !== null && equippedSpecializationIds.has(s.specializationId))
  let remaining = specMatched.length > 0 ? specMatched : candidates.filter((s) => s.specializationId === null)
  if (remaining.length === 0) remaining = candidates
  if (remaining.length === 1) return remaining[0]

  const targetIds = new Set(remaining.map((s) => s.flipSkill).filter((id): id is number => id !== null))
  const notAFlipTarget = remaining.filter((s) => !targetIds.has(s.id))
  if (notAFlipTarget.length === 1) return notAFlipTarget[0]
  remaining = notAFlipTarget.length > 0 ? notAFlipTarget : remaining

  const entryPoints = remaining.filter((s) => s.flipSkill !== null)
  if (entryPoints.length === 1) return entryPoints[0]
  remaining = entryPoints.length > 0 ? entryPoints : remaining

  return [...remaining].sort((a, b) => a.id - b.id)[0]
}
