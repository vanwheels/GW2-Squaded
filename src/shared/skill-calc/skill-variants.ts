import type { Skill } from '../types'

const GROUND_TARGETED_FLAG = 'GroundTargeted'

/**
 * `skillsForProfessionAndSlot` returns every skill id matching (profession, slot) with no dedup —
 * for 117 same-name groups (verified live 2026-07-29 across Heal/Utility/Elite) this means the
 * picker shows 2+ visually-identical-looking entries for what's really one in-game skill. This
 * function collapses each same-name group down to the id(s) actually worth offering as a distinct
 * pick, using 4 real (not guessed) signals the GW2 API exposes per skill id:
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
 * 3. **`flipSkill`** (multi-step skills — kits, turrets, mantras, spirit weapons, Revenant facets,
 *    a Thief chain-finisher elite): the id a skill becomes after being activated. Its target is
 *    never independently equippable in-game (you can't bind "Stow Med Kit" or "Detonate Healing
 *    Turret" as your heal skill directly — you bind the base skill and the target only ever
 *    appears as what it turns into), so `stripFlipTargets` removes any candidate that's another
 *    candidate's `flipSkill` target under a *different* name globally, before per-name grouping
 *    even runs (these never land in the same name-group to begin with). A handful of same-name
 *    flip pairs also exist with no `specializationId` to distinguish them (e.g. Guardian's Spirit
 *    Weapons — `9125`/`46170` "Hammer of Wisdom", both textually identical) — for those,
 *    `resolveGroup`'s flip-root step below drops whichever id is pointed to by the other's
 *    `flipSkill`, keeping the one the player actually equips.
 * 4. **The `GroundTargeted` flag** (~54 groups, e.g. "Lightning Flash", every Necromancer Well,
 *    every Warrior Banner): GW2 exposes its client-side ground-target-vs-auto-target casting
 *    toggle as two separate skill ids with an otherwise-identical effect. Functionally identical
 *    for this app's purposes (boon/condition output, tooltip text), so these collapse to the
 *    non-ground-targeted id as the one canonical representative.
 *
 * The remaining ~18 duplicate-name groups (e.g. Engineer's "Deploy Mine", Ranger's "Spike Trap")
 * differ for reasons none of these signals capture — most look like trait-reworked variants with
 * no `specializationId` set, which would need a per-skill wiki cross-check (same shape of effort as
 * `scripts/fetch-wvw-splits.ts`) to resolve correctly. Left un-collapsed and shown as-is rather than
 * guessed at — see TODO.md for the specific group names.
 */
export function visibleSkillsForSlot(candidates: Skill[], equippedSpecializationIds: ReadonlySet<number>): Skill[] {
  const withoutFlipTargets = stripFlipTargets(candidates)

  const groupOrder: string[] = []
  const groups = new Map<string, Skill[]>()
  for (const skill of withoutFlipTargets) {
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

/**
 * Removes any candidate that's the `flipSkill` target of a *different-named* candidate — e.g.
 * "Med Kit" -> "Stow Med Kit", "Healing Turret" -> "Detonate Healing Turret". Same-named flip
 * pairs (e.g. "Renewed Focus" -> "Renewed Focus") are left alone here since they land in the same
 * name-group and `resolveGroup`'s signals (specialization first, flip-root as a fallback) need
 * both ids present to pick the right one.
 */
function stripFlipTargets(candidates: Skill[]): Skill[] {
  const byId = new Map(candidates.map((s) => [s.id, s]))
  const targetIdsToDrop = new Set<number>()
  for (const skill of candidates) {
    if (skill.flipSkill === null) continue
    const target = byId.get(skill.flipSkill)
    if (target && target.name !== skill.name) targetIdsToDrop.add(target.id)
  }
  return candidates.filter((s) => !targetIdsToDrop.has(s.id))
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

  const flipRoots = remaining.filter((s) => !remaining.some((other) => other.id !== s.id && other.flipSkill === s.id))
  if (flipRoots.length === 1) return flipRoots
  remaining = flipRoots.length > 0 ? flipRoots : remaining
  if (remaining.length === 1) return remaining

  const autoTarget = remaining.filter((s) => !s.flags.includes(GROUND_TARGETED_FLAG))
  const groundTarget = remaining.filter((s) => s.flags.includes(GROUND_TARGETED_FLAG))
  if (autoTarget.length === 1 && groundTarget.length >= 1) {
    return autoTarget
  }

  return remaining
}
