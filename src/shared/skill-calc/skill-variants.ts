import type { Skill } from '../types'

const GROUND_TARGETED_FLAG = 'GroundTargeted'

/**
 * `skillsForProfessionAndSlot` returns every skill id matching (profession, slot) with no dedup —
 * for 117 same-name groups (verified live 2026-07-29 across Heal/Utility/Elite) this means the
 * picker shows 2+ visually-identical-looking entries for what's really one in-game skill. This
 * function collapses each same-name group down to the id(s) actually worth offering as a distinct
 * pick, using 3 real (not guessed) signals the GW2 API exposes per skill id:
 *
 * 1. **`attunement`** (8 groups, all Elementalist "based on your attunement" skills like "Glyph of
 *    Lesser Elementals"): the 4 attunement-specific ids aren't independently equippable at all —
 *    a player takes the one attunement-agnostic id and its effect varies live with current
 *    attunement. The attunement-tagged ids exist only so the API/wiki can describe each variant's
 *    effect; they're dropped entirely rather than offered as alternate picks.
 * 2. **`specializationId`** (45 groups, e.g. Guardian's "Renewed Focus" reworked by Dragonhunter,
 *    or several Revenant Legendary Demon skills reworked by Vindicator/Conduit): the reworked id
 *    is used automatically whenever that elite spec is equipped — not a user choice — so this
 *    picks whichever variant matches the build's currently-equipped specs, falling back to the
 *    spec-less (`specializationId === null`) variant when none match.
 * 3. **The `GroundTargeted` flag** (~54 groups, e.g. "Lightning Flash", every Necromancer Well,
 *    every Warrior Banner): GW2 exposes its client-side ground-target-vs-auto-target casting
 *    toggle as two separate skill ids with an otherwise-identical effect. Functionally identical
 *    for this app's purposes (boon/condition output, tooltip text), so these collapse to the
 *    non-ground-targeted id as the one canonical representative.
 *
 * The remaining ~18 duplicate-name groups (e.g. Engineer's "Deploy Mine", Ranger's "Spike Trap")
 * differ for reasons none of these 3 signals capture — most look like trait-reworked variants with
 * no `specializationId` set, which would need a per-skill wiki cross-check (same shape of effort as
 * `scripts/fetch-wvw-splits.ts`) to resolve correctly. Left un-collapsed and shown as-is rather than
 * guessed at — see TODO.md for the specific group names.
 */
export function visibleSkillsForSlot(candidates: Skill[], equippedSpecializationIds: ReadonlySet<number>): Skill[] {
  const groupOrder: string[] = []
  const groups = new Map<string, Skill[]>()
  for (const skill of candidates) {
    if (!groups.has(skill.name)) {
      groups.set(skill.name, [])
      groupOrder.push(skill.name)
    }
    groups.get(skill.name)!.push(skill)
  }

  const out: Skill[] = []
  for (const name of groupOrder) {
    out.push(...resolveGroup(groups.get(name)!, equippedSpecializationIds))
  }
  return out
}

function resolveGroup(group: Skill[], equippedSpecializationIds: ReadonlySet<number>): Skill[] {
  if (group.length === 1) return group

  const nonAttuned = group.filter((s) => s.attunement === null)
  let remaining = nonAttuned.length > 0 ? nonAttuned : group
  if (remaining.length === 1) return remaining

  const specMatched = remaining.filter((s) => s.specializationId !== null && equippedSpecializationIds.has(s.specializationId))
  if (specMatched.length > 0) {
    remaining = specMatched
  } else {
    const ungated = remaining.filter((s) => s.specializationId === null)
    if (ungated.length > 0) remaining = ungated
  }
  if (remaining.length === 1) return remaining

  const autoTarget = remaining.filter((s) => !s.flags.includes(GROUND_TARGETED_FLAG))
  const groundTarget = remaining.filter((s) => s.flags.includes(GROUND_TARGETED_FLAG))
  if (autoTarget.length === 1 && groundTarget.length >= 1) {
    return autoTarget
  }

  return remaining
}
