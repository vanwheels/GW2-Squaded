/**
 * Fixed, wiki-verified per-second (or per-stack-application) damage formulas for GW2's 5 damaging
 * conditions — `damage = base + coefficient * ConditionDamage`. Unlike every other
 * `CURATED_*_COEFFICIENTS` table in this codebase (`CURATED_DAMAGE_COEFFICIENTS`,
 * `CURATED_HEALING_COEFFICIENTS`, `CURATED_BARRIER_COEFFICIENTS`, `CURATED_SIPHON_DAMAGE_
 * COEFFICIENTS`), these are NOT per-skill values needing a per-skill wiki-verification sweep — they're
 * 5 fixed, skill-independent, game-wide constants (a stack of Bleeding from any source ticks for the
 * exact same amount), each condition's own dedicated wiki page states its formula directly. Sourced
 * from raw wikitext (never a paraphrased fetch, same rigor bar as every other coefficient table in
 * this codebase), fetched 2026-08-29, all values "at level 80" (this app's only supported level, same
 * convention as `WEAPON_STRENGTH_MIDPOINTS`):
 *
 * - **Bleeding** (`wiki.guildwars2.com/wiki/Bleeding`): `(0.06 * ConditionDamage) + 22` damage per
 *   stack per second. No PvE/WvW/PvP split at all — the page states one formula, unconditionally.
 * - **Burning** (`.../Burning`): `(0.155 * ConditionDamage) + 131` damage per stack per second. Also
 *   no mode split.
 * - **Poisoned** (`.../Poisoned`, "Poison" redirects here): `(0.06 * ConditionDamage) + 33.5` damage
 *   per stack per second. Also no mode split.
 * - **Torment** (`.../Torment`) — the only condition whose damage additionally depends on whether the
 *   *target* is moving, not just game mode; genuinely 2-way split (moving vs. stationary) on top of
 *   the PvE/WvW+PvP split every other table already prefers WvW for. WvW+PvP values used, both halves
 *   kept as separate named formulas below (`'Torment (Moving)'`/`'Torment (Stationary)'`) rather than
 *   collapsed to one, since which applies is a per-skill/per-encounter judgment call this leg doesn't
 *   make — that's deferred to whichever future leg wires this table into skill facts:
 *   `(0.054 * ConditionDamage) + 19.8` while moving, `(0.07 * ConditionDamage) + 26` while stationary.
 * - **Confusion** (`.../Confusion`) — structurally different from the other 4: it deals damage BOTH
 *   as an ordinary per-second tick AND as a separate burst each time the afflicted character *activates
 *   a skill*, each with its own base/coefficient and its own PvE vs. WvW+PvP split (the WvW+PvP DoT
 *   half is the one exception across all 5 conditions that doesn't scale with Condition Damage at
 *   all — confirmed on the wiki page, not a transcription miss). Its on-activation half isn't a
 *   steady-state per-second rate the way the other 4 are (it depends on how often the target — not
 *   the player — activates skills, information this app has no model of), so it doesn't fit this
 *   table's `ConditionDamageFormula` shape at all; kept as its own separate constant
 *   (`CONFUSION_DAMAGE_FORMULA`) rather than forced into `CONDITION_DAMAGE_FORMULAS`, both halves
 *   still WvW+PvP-preferred per this codebase's usual convention:
 *   DoT `(0 * ConditionDamage) + 10` damage per stack per second; on-activation
 *   `(0.0975 * ConditionDamage) + 49.5` damage per stack, per activation.
 *
 * Leg 1 of TODO.md's "condition-damage skills" item — this table only. Leg 2 (2026-08-28) wired it
 * into `SkillsEditor.tsx`'s per-skill tooltip via `conditionDamagePerStack` below, resolving the
 * design decisions this leg deliberately left open, per explicit user direction:
 * - **Torment** always renders its STATIONARY value — no per-skill signal exists to pick moving vs.
 *   stationary, and no new `CombatState` toggle was added for it; stationary matches this app's
 *   existing "boss/golem" assumption elsewhere (e.g. `TARGET_ARMOR_VALUES`' own reference target).
 * - **Confusion** renders its DoT half only. The on-activation burst depends on how often the
 *   AFFLICTED TARGET (not the player) activates skills — information this app has no model of, same
 *   "excluded, depends on unmodeled target behavior" precedent as Scion's Reprieve — so it's left off
 *   `conditionDamagePerStack`'s table entirely rather than guessed at.
 * - Scoped to skill tooltips only (`SkillsEditor.tsx`'s `factsBlock`/`conditionalBranchesBlock` and
 *   `ProfessionMechanicBar.tsx`'s own inline tooltip builder) — the aggregate Boon/Condition Summary
 *   Panel doesn't total condition-DPS, that's a separate future leg if ever wanted.
 * - Multi-condition skills need no special handling: `boonConditionFactsForSkill` already emits one
 *   `BoonConditionSource` per condition-application fact, so each renders its own expected-damage
 *   line automatically, same "one row per fact" shape as every other boon/condition row.
 */
export interface ConditionDamageFormula {
  /** Flat per-stack-per-second (or, for Confusion's on-activation half, per-stack-per-activation)
   *  damage at 0 Condition Damage, level 80. */
  base: number
  /** Condition Damage attribute coefficient. */
  coefficient: number
}

export type DamagingCondition = 'Bleeding' | 'Burning' | 'Poisoned' | 'Torment (Moving)' | 'Torment (Stationary)'

export const CONDITION_DAMAGE_FORMULAS: Record<DamagingCondition, ConditionDamageFormula> = {
  Bleeding: { base: 22, coefficient: 0.06 },
  Burning: { base: 131, coefficient: 0.155 },
  Poisoned: { base: 33.5, coefficient: 0.06 },
  'Torment (Moving)': { base: 19.8, coefficient: 0.054 },
  'Torment (Stationary)': { base: 26, coefficient: 0.07 }
}

/** Confusion's 2 independent damage components — see this file's own top comment for why it can't
 *  share `CONDITION_DAMAGE_FORMULAS`'s single-rate shape. Both halves are WvW+PvP values. */
export const CONFUSION_DAMAGE_FORMULA = {
  /** Per stack, per second — ticks continuously regardless of what the target does. */
  dot: { base: 10, coefficient: 0 } satisfies ConditionDamageFormula,
  /** Per stack, per skill activation by the afflicted target — NOT a per-second rate. */
  onActivation: { base: 49.5, coefficient: 0.0975 } satisfies ConditionDamageFormula
}

/** `formula.base + formula.coefficient * conditionDamage`, rounded to match every other calc
 *  module's `Math.round` convention (`damageLinesForSkill`, `healingLinesForSkill`, ...). */
export function conditionDamageValue(formula: ConditionDamageFormula, conditionDamage: number): number {
  return Math.round(formula.base + formula.coefficient * conditionDamage)
}

/** `BoonConditionSource.boonOrConditionName` -> the formula this app displays a tooltip line for —
 *  see this file's own top comment for why Torment/Confusion each resolve to only one of their
 *  possible values. Every boon name, and every other status this app has no formula for, is simply
 *  absent (not `null`-valued) — `conditionDamagePerStack` fails closed on a missing key. */
const DISPLAYED_CONDITION_FORMULAS: Partial<Record<string, ConditionDamageFormula>> = {
  Bleeding: CONDITION_DAMAGE_FORMULAS.Bleeding,
  Burning: CONDITION_DAMAGE_FORMULAS.Burning,
  Poisoned: CONDITION_DAMAGE_FORMULAS.Poisoned,
  Torment: CONDITION_DAMAGE_FORMULAS['Torment (Stationary)'],
  Confusion: CONFUSION_DAMAGE_FORMULA.dot
}

/**
 * Expected damage per stack per second for a `BoonConditionSource.boonOrConditionName`, at the
 * given `conditionDamage` attribute total — `null` for any name `DISPLAYED_CONDITION_FORMULAS`
 * doesn't cover (every boon, plus Confusion's on-activation half). Callers multiply by the source's
 * own `applyCount` (stack count) for the total per-second rate one application puts on the target —
 * done by the caller, not here, since this function has no `BoonConditionSource` to read that from.
 */
export function conditionDamagePerStack(boonOrConditionName: string, conditionDamage: number): number | null {
  const formula = DISPLAYED_CONDITION_FORMULAS[boonOrConditionName]
  return formula ? conditionDamageValue(formula, conditionDamage) : null
}
