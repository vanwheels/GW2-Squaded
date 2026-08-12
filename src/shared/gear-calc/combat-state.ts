import type { Build, EquipmentSlotKey, Trait } from '../types'
import { ALL_CORE_ATTRIBUTE_KEYS, isActiveWeaponSlot } from './attribute-totals'
import { activeTraitIds } from './trait-attributes'

/**
 * Ephemeral "what-if" combat inputs for the Stats panel — deliberately never persisted on `Build`
 * (resets on reload/build switch, unlike every other build-editor field). This models a snapshot
 * of buffs/stacks a player might have mid-fight, not a build choice like equipment/skills. See
 * TODO.md's "Combat state" design writeup for the reasoning behind each field.
 */
export interface CombatState {
  /** 0-25 stacks. */
  mightStacks: number
  /** Fury's effect on specific skills/traits ("while under the effect of Fury") is NOT modeled —
   *  no structural data exists anywhere in the app for conditional Fury-gated bonuses. */
  furyActive: boolean
  /** Gates `REGENERATION_ATTRIBUTE_TRAIT_BONUSES` — mirrors `furyActive`'s shape/gating, one
   *  boolean per boon rather than a generalized "which boons are up" map, since only Regeneration
   *  and Quickness have any curated conditional trait bonus so far (see TODO.md's "Boon-gated flat
   *  bonuses" family). */
  regenerationActive: boolean
  /** Gates `QUICKNESS_ATTRIBUTE_TRAIT_BONUSES` — sibling to `regenerationActive` above. */
  quicknessActive: boolean
  /** Gates `MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES` — the "Shroud/stance-gated flat bonuses"
   *  family from TODO.md: whether the build's profession mechanic (Necromancer Shroud, Necromancer
   *  Scourge's active shade, Warrior Berserker's berserk mode, ...) is currently toggled on. One
   *  boolean covers every profession rather than a per-profession field, same reasoning as
   *  `furyActive`/`regenerationActive`/`quicknessActive` being single fields even though only some
   *  traits key off each — a build only ever has one profession's mechanic to toggle at all, so
   *  `CombatStatePanel` only surfaces this control when a curated trait for the build's own
   *  profession actually exists. */
  mechanicActive: boolean
  /** Gates `REVEALED_ATTRIBUTE_TRAIT_BONUSES` — the "Revealed-state-gated flat bonuses" family from
   *  TODO.md (Thief only, currently just Revealed Training). Single boolean, same shape as
   *  `furyActive`/`mechanicActive`, even though only one profession has any curated Revealed-gated
   *  trait so far — `CombatStatePanel` only surfaces this control when the build has a curated
   *  trait for it chosen, same gating as `mechanicActive`. */
  revealedActive: boolean
  /** Gates `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES` — the "Health-threshold-conditional flat
   *  bonuses" family from TODO.md, 8th and final leg of the conditional-trait-attribute-bonus sweep.
   *  A 3-way tier rather than a boolean (unlike every other family here) since the two curated
   *  traits key off different thresholds (50% for Empire Divided, 75%/50% for Last Rites) — one
   *  field covers both without needing a raw 0-100 slider, matching how coarse the actual curated
   *  breakpoints are. Always meaningful (no "which trait is chosen" branch the way `mechanicActive`/
   *  `revealedActive` need one to pick an icon) since a tier is always selected, just defaults to
   *  full health. */
  healthTier: HealthTier
  /** 0-25 stacks of whichever stacking sigil is equipped on the active weapon set, if any — see
   *  `detectActiveStackingSigil`. Meaningless when no stacking sigil is equipped. */
  stackingSigilStacks: number
  /** Only meaningful when the equipped relic has a curated entry in
   *  `CURATED_RELIC_DAMAGE_BONUSES` below. */
  relicActive: boolean
  /** Assumed enemy armor class for the Damage tooltip row (see `damage-calc.ts`) — armor is the
   *  *target's* stat, not this build's, so it has no other home on a single-build editor and rides
   *  along with the other "what-if" combat inputs here. Same 3-tier convention gw2skills.net's own
   *  WvW golem toggle uses. */
  targetArmorClass: TargetArmorClass
  /** 0-5 stacks of Kalla's Fervor, Revenant/Renegade's own stacking self-buff (2% strike damage,
   *  2% condition damage, 2% life-steal damage per stack — see `KALLA_FERVOR_*_PERCENT_PER_STACK`
   *  below). Only meaningful/surfaced when the Renegade elite spec is equipped (`CombatStatePanel`
   *  gates its stepper on `RENEGADE_SPECIALIZATION_ID`), same shape as `stackingSigilStacks` (a
   *  build-conditional stepper) rather than a flat boolean like `furyActive` etc. */
  kallaFervorStacks: number
}

export const DEFAULT_COMBAT_STATE: CombatState = {
  mightStacks: 0,
  furyActive: false,
  regenerationActive: false,
  quicknessActive: false,
  mechanicActive: false,
  revealedActive: false,
  healthTier: 'above75',
  stackingSigilStacks: 0,
  relicActive: false,
  targetArmorClass: 'Medium',
  kallaFervorStacks: 0
}

// wiki-confirmed flat value at level 80, quoted directly (not derived from a per-level formula).
export const MIGHT_POWER_PER_STACK = 34
export const MIGHT_CONDITION_DAMAGE_PER_STACK = 34

/** Revenant/Renegade's elite-spec trait line — gates `CombatStatePanel`'s Kalla's Fervor stepper
 *  (also happens to be the same id Revenant/Shortbow's `specializationId` requires, since both are
 *  Renegade-gated; unrelated to this constant's own use here). */
export const RENEGADE_SPECIALIZATION_ID = 63

/**
 * Kalla's Fervor (Revenant/Renegade's stacking self-buff, max 5 stacks) — wiki-verified via raw
 * wikitext (wiki.guildwars2.com/index.php?title=Kalla%27s_Fervor&action=raw) 2026-08-12: "passively
 * grants 2% strike damage, 2% condition damage and 2% life-steal damage per stack, for a maximum of
 * 5 stacks" — flat 2%/2%/2% per stack, no game-mode split. Life-steal has no other home anywhere in
 * this codebase (`DerivedStats.lifeStealPercent` is the first/only field for it); the strike-damage
 * share adds onto `DerivedStats.outgoingDamagePercent` alongside the relic bonus, and condition
 * damage gets its own `DerivedStats.outgoingConditionDamagePercent` sibling field (distinct from the
 * raw `ConditionDamage` attribute total).
 */
export const KALLA_FERVOR_MAX_STACKS = 5
export const KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK = 2
export const KALLA_FERVOR_CONDITION_DAMAGE_PERCENT_PER_STACK = 2
export const KALLA_FERVOR_LIFE_STEAL_PERCENT_PER_STACK = 2

export const FURY_CRITICAL_CHANCE_PERCENT = 20

export type TargetArmorClass = 'Light' | 'Medium' | 'Heavy'

/** gw2skills.net's own WvW golem armor values, quoted directly per the user's spec rather than
 *  re-derived — this app has no independent source for "typical WvW target armor" the way skill
 *  coefficients have the wiki. */
export const TARGET_ARMOR_VALUES: Record<TargetArmorClass, number> = {
  Light: 2000,
  Medium: 2200,
  Heavy: 2681
}

const ALL_STATS = 'AllStats' as const

/**
 * The 8 sigils whose description matches "Gain a charge of +X <attribute> each time you kill a
 * foe... Max 25 stacks" — confirmed exhaustive via a full scan of data/game-data/sigils.json,
 * these are the only sigils with that text. Attribute keys match the `ItemStat`/API convention
 * used throughout gear-calc (see attribute-totals.ts), except `AllStats`, a sentinel this module
 * expands to all 9 core attributes (Superior Sigil of the Stars' "+2 to all stats" wording).
 */
export const STACKING_SIGILS: Record<number, { name: string; attribute: string | typeof ALL_STATS; perStack: number }> = {
  24575: { name: 'Superior Sigil of Bloodlust', attribute: 'Power', perStack: 10 },
  24578: { name: 'Superior Sigil of Corruption', attribute: 'ConditionDamage', perStack: 10 },
  24580: { name: 'Superior Sigil of Perception', attribute: 'Precision', perStack: 10 },
  24582: { name: 'Superior Sigil of Life', attribute: 'Healing', perStack: 10 },
  49457: { name: 'Superior Sigil of Momentum', attribute: 'Toughness', perStack: 5 },
  67341: { name: 'Superior Sigil of Cruelty', attribute: 'CritDamage', perStack: 10 },
  81045: { name: 'Superior Sigil of Bounty', attribute: 'BoonDuration', perStack: 9 },
  86170: { name: 'Superior Sigil of the Stars', attribute: ALL_STATS, perStack: 2 }
}

/**
 * Relic ids whose full proc is a flat, unconditional outgoing-strike-damage-% bonus — hand-curated
 * from data/game-data/relic-effects.json's "Damage Increase" facts, one manual wiki-verification
 * pass per relic (same process as `wvwFactOverrides`, see docs/game-data.md). Relic of Fireworks is
 * the only relic verified so far; most other "Damage Increase" relics carry conditions (target
 * health, weapon type, class) that need the same check before being added here. Both ids below are
 * "Relic of Fireworks" — relics.json lists the same relic twice under different ids — so either
 * pick in the equipment editor is recognized.
 */
export const CURATED_RELIC_DAMAGE_BONUSES: Record<number, number> = {
  100262: 7, // Relic of Fireworks
  100947: 7 // Relic of Fireworks (duplicate relics.json id, identical effect)
}

/**
 * Trait id -> extra critical-hit-chance % granted while Fury is active, on top of the flat
 * `FURY_CRITICAL_CHANCE_PERCENT` every profession already gets from Fury itself — hand-curated
 * and wiki-verified per trait, same process as `CURATED_RELIC_DAMAGE_BONUSES` above (the raw API
 * `facts` array is ambiguous: it dumps PvE/WvW/PvP-split values together with no mode tag, so the
 * wiki's own text is the only reliable source). `1719` is Revenant/Invocation's tier-3 Major trait
 * "Roiling Mists" ("Critical-hit chance is further increased while you are under the effect of
 * fury") — confirmed via wiki.guildwars2.com/wiki/Roiling_Mists 2026-08-01: the raw facts list
 * both 25 (PvE) and 20 (WvW/PvP); this app is WvW-focused (see gw2squaded-claude-code-prompt.md),
 * so 20 is correct here. A
 * handful of other professions have similarly-shaped fury-crit traits (Engineer's Hematic Focus,
 * Warrior's Furious Burst, Ranger's Vicious Quarry, Mesmer's Quiet Intensity, Revenant/Renegade's
 * Brutal Momentum — found via a full `traits.json` scan for "Critical Chance Increase" facts near
 * "fury" in the description) but aren't curated yet — add them here the same way once verified.
 */
export const FURY_CRIT_CHANCE_TRAIT_BONUSES: Record<number, number> = {
  1719: 20, // Roiling Mists (Revenant, Invocation, Major tier 3) — WvW value
  2193: 10 // Quiet Intensity (Mesmer, Virtuoso, Minor GM) — WvW/PvP value; PvE is 15, WvW is 10
}

/**
 * Sums every curated fury-crit trait bonus actually active on this build (via `activeTraitIds`).
 * Only meaningful when combined with `combatState.furyActive` by the caller (this function doesn't
 * know about `CombatState` at all, matching `boonDurationPercent`'s "raw ingredient" shape rather
 * than a fully-derived value).
 */
export function furyCritChanceTraitBonus(build: Build, traitsById: Map<number, Trait>): number {
  const active = activeTraitIds(build, traitsById)
  let bonus = 0
  for (const [traitIdText, value] of Object.entries(FURY_CRIT_CHANCE_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) bonus += value
  }
  return bonus
}

/**
 * Trait id -> extra flat attribute point granted while Fury is active, on top of any curated
 * critical-*chance* bonus above — a sibling family for traits whose Fury-gated bonus instead
 * targets a raw attribute (Ferocity/Condition Damage). Found via the trait-attribute-bonus sweep
 * (`trait-attributes.ts`, COMPLETED.md Session 148) — each of these was excluded from that sweep's
 * unconditional `CURATED_FLAT_BONUSES` table specifically because the bonus only applies under
 * Fury, same conditional shape as `FURY_CRIT_CHANCE_TRAIT_BONUSES` above. All 5 wiki-verified via
 * raw wikitext (`?action=raw`) 2026-08-12: No Scope (wiki.guildwars2.com/wiki/No_Scope, Guardian/
 * Firearms-adjacent, Major) +150 Ferocity, no game-mode split; Raging Storm (wiki.guildwars2.com/
 * wiki/Raging_Storm, Elementalist, Major) +180 Ferocity, no split; Deep Strikes
 * (wiki.guildwars2.com/wiki/Deep_Strikes, Warrior, Minor) +180 Condition Damage, no split; Vicious
 * Quarry (wiki.guildwars2.com/wiki/Vicious_Quarry, Ranger, Major) +250 Ferocity, no split; No
 * Quarter (wiki.guildwars2.com/index.php?title=No_Quarter_(trait), Thief, Major) — genuine 2-way
 * split, `{{skill fact|attribute|Ferocity|250|game mode = pve}}` /
 * `{{skill fact|attribute|Ferocity|300|game mode = pvp wvw}}`, WvW value is 300. `target` uses the
 * same `CritDamage` key as Ferocity elsewhere in this codebase (matches the raw API fact's own
 * `target` field).
 *
 * Sharpening Sorrow (wiki.guildwars2.com/wiki/Sharpening_Sorrow, Mesmer/Virtuoso, Major, id 2207)
 * was added later, found while wiki-verifying the "Boon-gated flat bonuses" family
 * (TODO.md) — its description reads "Gain fury when you activate Bladesong Sorrow. Fury increases
 * your expertise.", which sounds Regeneration/boon-shaped at a glance but is actually Fury-gated
 * (the trait's own on-cast Fury proc, not an external boon), so it belongs here rather than in that
 * new family. Raw facts confirm: `{{skill fact|attribute|Expertise|alt=Expertise granted by
 * fury|150}}`, no game-mode split. `target` uses `ConditionDuration`, this codebase's API key for
 * Expertise (same convention as Chaotic Persistence's Expertise bonus, see
 * `REGENERATION_ATTRIBUTE_TRAIT_BONUSES` below).
 */
export const FURY_ATTRIBUTE_TRAIT_BONUSES: Record<number, { target: string; value: number }> = {
  1923: { target: 'CritDamage', value: 150 }, // No Scope (Guardian, Major)
  214: { target: 'CritDamage', value: 180 }, // Raging Storm (Elementalist, Major)
  1343: { target: 'ConditionDamage', value: 180 }, // Deep Strikes (Warrior, Minor)
  1888: { target: 'CritDamage', value: 250 }, // Vicious Quarry (Ranger, Major)
  1904: { target: 'CritDamage', value: 300 }, // No Quarter (Thief, Major) — WvW/PvP value; PvE is 250
  2207: { target: 'ConditionDuration', value: 150 } // Sharpening Sorrow (Mesmer, Major)
}

/**
 * Sums every curated fury-attribute trait bonus actually active on this build, grouped by target
 * attribute (mirrors `furyCritChanceTraitBonus`'s gating, see that function's doc comment). Only
 * meaningful when combined with `combatState.furyActive` by the caller.
 */
export function furyAttributeTraitBonus(build: Build, traitsById: Map<number, Trait>): Record<string, number> {
  const active = activeTraitIds(build, traitsById)
  const bonus: Record<string, number> = {}
  for (const [traitIdText, { target, value }] of Object.entries(FURY_ATTRIBUTE_TRAIT_BONUSES)) {
    if (!active.has(Number(traitIdText))) continue
    bonus[target] = (bonus[target] ?? 0) + value
  }
  return bonus
}

/**
 * Trait id -> extra flat attribute point granted per stack of Might currently applied, on top of
 * the flat `MIGHT_POWER_PER_STACK`/`MIGHT_CONDITION_DAMAGE_PER_STACK` every build already gets in
 * `combatStatePoints` below — a third sibling family (after `FURY_CRIT_CHANCE_TRAIT_BONUSES` and
 * `FURY_ATTRIBUTE_TRAIT_BONUSES`) for traits whose bonus continuously scales with
 * `state.mightStacks` rather than being flat or Fury-gated. Reuses the existing `mightStacks`
 * `CombatState` field directly — no new UI needed. All wiki-verified via raw wikitext
 * (`?action=raw`) 2026-08-12:
 * - Awaken the Pain (wiki.guildwars2.com/wiki/Awaken_the_Pain, Necromancer/Spite, Minor, id 915):
 *   Notes state "each stack of Might grants 40 Power and 30 Condition Damage" against the wiki's
 *   own unmodified-Might baseline of "30 Power and 30 Condition Damage" — net +10 Power/stack,
 *   Condition Damage unchanged. Matches the raw API's own second `AttributeAdjust` fact (value 10,
 *   target Power) exactly.
 * - Pinnacle of Strength (wiki.guildwars2.com/wiki/Pinnacle_of_Strength, Warrior/Strength, Minor,
 *   id 1453): "Might applied to you grants more power", raw API `AttributeAdjust` value 10/target
 *   Power, same +10 Power/stack shape. Also carries a flat, unconditional +5% critical-hit chance
 *   ("Critical Chance Increase" fact, added 2022-07-19) — NOT curated here or anywhere else yet, no
 *   unconditional flat-crit-chance table exists in this codebase (only the Fury-gated one above);
 *   logged in TODO.md as a follow-up.
 * - Applied Force (wiki.guildwars2.com/wiki/Applied_Force, Engineer/Scrapper, Major, id 1849):
 *   `split = pve, wvw, pvp`, raw facts dump all 3 untagged (30/15/10) same ambiguous shape as other
 *   split traits elsewhere in this codebase; WvW value is 10 (reduced from 15 on 2026-01-13). The
 *   trait's separate "gain stability when you gain might at or above the threshold" clause is an
 *   event-triggered proc, not a gate on the power bonus itself — the description's two independent
 *   sentences ("Gain stability when..." / "Might grants bonus power.") confirm the power bonus
 *   applies continuously per stack, the same shape as the other two entries here, not a
 *   single-breakpoint fact.
 */
export const MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES: Record<number, { target: string; valuePerStack: number }> = {
  915: { target: 'Power', valuePerStack: 10 }, // Awaken the Pain (Necromancer, Minor)
  1453: { target: 'Power', valuePerStack: 10 }, // Pinnacle of Strength (Warrior, Minor)
  1849: { target: 'Power', valuePerStack: 10 } // Applied Force (Engineer, Major) — WvW value
}

/**
 * Sums every curated Might-stack-scaling trait bonus actually active on this build, grouped by
 * target attribute and pre-multiplied by the current `mightStacks` count (mirrors
 * `furyAttributeTraitBonus`'s shape/gating, see that function's doc comment).
 */
export function mightStackAttributeTraitBonus(build: Build, mightStacks: number, traitsById: Map<number, Trait>): Record<string, number> {
  const active = activeTraitIds(build, traitsById)
  const bonus: Record<string, number> = {}
  for (const [traitIdText, { target, valuePerStack }] of Object.entries(MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES)) {
    if (!active.has(Number(traitIdText))) continue
    bonus[target] = (bonus[target] ?? 0) + valuePerStack * mightStacks
  }
  return bonus
}

/**
 * Trait id -> extra flat attribute points (by target) granted while Regeneration is active — the
 * "Boon-gated flat bonuses" family from TODO.md, first leg (Regeneration; Quickness follows
 * immediately below). Unlike the single-target `FURY_ATTRIBUTE_TRAIT_BONUSES`/
 * `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES` shape, both traits here grant 2 attributes at once, so the
 * value is a target->amount map instead of one `{ target, value }` pair. Both wiki-verified via raw
 * wikitext (`?action=raw`) 2026-08-12:
 * - Chaotic Persistence (wiki.guildwars2.com/wiki/Chaotic_Persistence, Mesmer/Chaos, Minor GM, id
 *   1865): `split = pve, wvw, pvp`, genuine 3-way split on both attributes — Concentration
 *   (`BoonDuration`) is 250 PvE/WvW, 150 PvP; Expertise (`ConditionDuration`) is 100 PvE (reduced
 *   from 250 on 2026-04-14, PvE only), 250 WvW, 150 PvP. WvW value used here: Concentration 250,
 *   Expertise 250 — note WvW no longer matches PvE for Expertise since the 2026-04-14 patch split
 *   them.
 * - Energy Amplifier (wiki.guildwars2.com/wiki/Energy_Amplifier, Engineer/Inventions, Minor GM, id
 *   519): no split, flat Power 250 / Healing 250 in every game mode.
 */
export const REGENERATION_ATTRIBUTE_TRAIT_BONUSES: Record<number, Record<string, number>> = {
  1865: { BoonDuration: 250, ConditionDuration: 250 }, // Chaotic Persistence (Mesmer, Minor GM) — WvW value
  519: { Power: 250, Healing: 250 } // Energy Amplifier (Engineer, Minor GM)
}

/**
 * Sums every curated Regeneration-gated trait bonus actually active on this build, grouped by
 * target attribute (mirrors `furyAttributeTraitBonus`'s shape/gating). Only meaningful when
 * combined with `combatState.regenerationActive` by the caller.
 */
export function regenerationAttributeTraitBonus(build: Build, traitsById: Map<number, Trait>): Record<string, number> {
  const active = activeTraitIds(build, traitsById)
  const bonus: Record<string, number> = {}
  for (const [traitIdText, targets] of Object.entries(REGENERATION_ATTRIBUTE_TRAIT_BONUSES)) {
    if (!active.has(Number(traitIdText))) continue
    for (const [target, value] of Object.entries(targets)) bonus[target] = (bonus[target] ?? 0) + value
  }
  return bonus
}

/**
 * Trait id -> extra flat attribute points (by target) granted while Quickness is active — second
 * leg of the "Boon-gated flat bonuses" family, sibling to `REGENERATION_ATTRIBUTE_TRAIT_BONUSES`
 * above (same target-map shape, same reasoning for why). Both wiki-verified via raw wikitext
 * (`?action=raw`) 2026-08-12:
 * - Imbued Haste (wiki.guildwars2.com/wiki/Imbued_Haste, Guardian/Firebrand, Minor GM, id 2148):
 *   `split = pve, wvw pvp`, genuine 2-way split on all 3 attributes — Condition Damage/Healing
 *   Power/Vitality each 250 PvE, 150 WvW/PvP. WvW value used here: 150 for all three.
 * - Be Quick or Be Killed (wiki.guildwars2.com/wiki/Be_Quick_or_Be_Killed, Thief/Deadeye, Major GM,
 *   id 2093): the trait's own on-mark Quickness proc, not an external boon requirement — same shape
 *   as Sharpening Sorrow's Fury proc above, but the target attributes (Power/Precision) aren't
 *   split by game mode (only the Quickness proc's own duration is, 4s PvE / 2.5s WvW/PvP —
 *   irrelevant here since `combatState.quicknessActive` is a flat on/off, not a duration). Power
 *   200 / Precision 200 in every game mode.
 */
export const QUICKNESS_ATTRIBUTE_TRAIT_BONUSES: Record<number, Record<string, number>> = {
  2148: { ConditionDamage: 150, Healing: 150, Vitality: 150 }, // Imbued Haste (Guardian, Minor GM) — WvW/PvP value
  2093: { Power: 200, Precision: 200 } // Be Quick or Be Killed (Thief, Major GM)
}

/**
 * Sums every curated Quickness-gated trait bonus actually active on this build, grouped by target
 * attribute (mirrors `regenerationAttributeTraitBonus` above). Only meaningful when combined with
 * `combatState.quicknessActive` by the caller.
 */
export function quicknessAttributeTraitBonus(build: Build, traitsById: Map<number, Trait>): Record<string, number> {
  const active = activeTraitIds(build, traitsById)
  const bonus: Record<string, number> = {}
  for (const [traitIdText, targets] of Object.entries(QUICKNESS_ATTRIBUTE_TRAIT_BONUSES)) {
    if (!active.has(Number(traitIdText))) continue
    for (const [target, value] of Object.entries(targets)) bonus[target] = (bonus[target] ?? 0) + value
  }
  return bonus
}

/**
 * Trait id -> extra flat attribute points (by target) granted while the build's profession
 * mechanic is active (Shroud entered / a Sand Shade currently placed / Berserk mode) — the
 * "Shroud/stance-gated flat bonuses" family from TODO.md, 6th leg of the conditional-trait-
 * attribute-bonus sweep. Uses the same target-map shape as `REGENERATION_ATTRIBUTE_TRAIT_BONUSES`/
 * `QUICKNESS_ATTRIBUTE_TRAIT_BONUSES` above (kept uniform across all 3 entries even though Reaper's
 * Onslaught only grants one attribute) rather than the single-target `{ target, value }` shape
 * `FURY_ATTRIBUTE_TRAIT_BONUSES` uses. Needed a brand-new `CombatState.mechanicActive` toggle
 * (unlike the weapon-equipped/attunement legs) since none of these 3 mechanics has a persisted
 * `Build` field that means "currently active in a fight" — `Build.activeBundleSkillId` tracks
 * Shroud only as *which skill bar is displayed*, deliberately not gating real totals (same
 * "player can toggle at will, both states always contribute" reasoning documented on that field),
 * and Scourge's shade/Berserker's berserk mode have no `Build` field at all. All 3 wiki-verified via
 * raw wikitext (`?action=raw`) 2026-08-12:
 * - Reaper's Onslaught (wiki.guildwars2.com/wiki/Reaper's_Onslaught, Necromancer/Reaper, Major tier
 *   3, id 2021): "Gain ferocity and quickness while in Reaper's Shroud." The Quickness grant is a
 *   proc buff, not a character-stat gain — out of scope for this table. `{{skill fact|attribute|
 *   Ferocity|300}}`, no game-mode split.
 * - Fatal Frenzy (wiki.guildwars2.com/wiki/Fatal_Frenzy, Warrior/Berserker, Minor tier 3, id 2046):
 *   "Berserk mode increases power and condition damage." Power is a flat +300, no split (confirmed
 *   by the raw API's single Power `AttributeAdjust` fact). Condition Damage has a genuine 2-way
 *   split: pve 150 / wvw+pvp 300 (per the 2026-04-14 balance pass — "Reduced the condition damage
 *   granted from 300 to 150 in PvE only. Increased the power from 150 to 300 in WvW only.", the
 *   latter clause referring to a since-reverted earlier WvW-only Power change, not the current flat
 *   Power value). WvW value used here: Condition Damage 300.
 * - Sand Sage (wiki.guildwars2.com/wiki/Sand_Sage, Necromancer/Scourge, Minor tier 2, id 2121):
 *   "Gain concentration and expertise when you have an active shade." `split = pve, wvw pvp`,
 *   genuine 2-way split on both attributes — Concentration (`BoonDuration`) and Expertise
 *   (`ConditionDuration`) are each 225 PvE, 150 WvW/PvP. WvW value used here: 150 for both.
 */
export const MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES: Record<number, Record<string, number>> = {
  2021: { CritDamage: 300 }, // Reaper's Onslaught (Necromancer/Reaper, Major tier 3) — Ferocity
  2046: { Power: 300, ConditionDamage: 300 }, // Fatal Frenzy (Warrior/Berserker, Minor tier 3) — WvW value
  2121: { BoonDuration: 150, ConditionDuration: 150 } // Sand Sage (Necromancer/Scourge, Minor tier 2) — WvW value
}

/**
 * Sums every curated mechanic-active trait bonus actually active on this build, grouped by target
 * attribute (mirrors `regenerationAttributeTraitBonus`/`quicknessAttributeTraitBonus` above). Only
 * meaningful when combined with `combatState.mechanicActive` by the caller.
 */
export function mechanicActiveAttributeTraitBonus(build: Build, traitsById: Map<number, Trait>): Record<string, number> {
  const active = activeTraitIds(build, traitsById)
  const bonus: Record<string, number> = {}
  for (const [traitIdText, targets] of Object.entries(MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES)) {
    if (!active.has(Number(traitIdText))) continue
    for (const [target, value] of Object.entries(targets)) bonus[target] = (bonus[target] ?? 0) + value
  }
  return bonus
}

/**
 * Trait id -> extra flat attribute point granted while the Revealed debuff is active — the
 * "Revealed-state-gated flat bonuses" family from TODO.md, 7th leg of the conditional-trait-
 * attribute-bonus sweep. Only one candidate turned up (Thief only): Revealed Training
 * (wiki.guildwars2.com/wiki/Revealed_Training, Thief/Deadly Arts, Major GM, id 1704) — surfaced
 * during the "Weapon-equipped-gated flat bonuses" leg's flat-bonus sweep (`trait-attributes.ts`,
 * the trait's unconditional "Base Power" half is already curated there) and re-confirmed via raw
 * wikitext (`?action=raw`) 2026-08-12: `{{skill fact|attribute|Power|alt=Power while Revealed|120|
 * game mode = pve}}` / `...150|game mode = pvp wvw}}`, genuine 2-way split; WvW value is 150. Same
 * single-target `{ target, value }` shape as `FURY_ATTRIBUTE_TRAIT_BONUSES` (only one entry so far,
 * no need for the target-map shape the boon/mechanic families use).
 */
export const REVEALED_ATTRIBUTE_TRAIT_BONUSES: Record<number, { target: string; value: number }> = {
  1704: { target: 'Power', value: 150 } // Revealed Training (Thief, Deadly Arts, Major GM) — WvW value
}

/**
 * Sums every curated Revealed-gated trait bonus actually active on this build (mirrors
 * `furyAttributeTraitBonus`'s shape/gating). Only meaningful when combined with
 * `combatState.revealedActive` by the caller.
 */
export function revealedAttributeTraitBonus(build: Build, traitsById: Map<number, Trait>): Record<string, number> {
  const active = activeTraitIds(build, traitsById)
  const bonus: Record<string, number> = {}
  for (const [traitIdText, { target, value }] of Object.entries(REVEALED_ATTRIBUTE_TRAIT_BONUSES)) {
    if (!active.has(Number(traitIdText))) continue
    bonus[target] = (bonus[target] ?? 0) + value
  }
  return bonus
}

/** 3-way health tier `CombatState.healthTier` distinguishes — coarse enough to cover both curated
 *  traits' breakpoints (Empire Divided's single 50% threshold, Last Rites' 75%/50% pair) without a
 *  raw percent slider; see `CombatState.healthTier`'s doc comment. */
export type HealthTier = 'above75' | 'between50and75' | 'below50'

/**
 * Trait id -> extra flat attribute points (by target), one entry per `HealthTier`, granted while
 * the player's own health sits in that tier — the "Health-threshold-conditional flat bonuses"
 * family from TODO.md, 8th and final leg of the conditional-trait-attribute-bonus sweep. Both
 * candidates were the sweep's own original prototype examples for this shape; both wiki-verified via
 * raw wikitext (`?action=raw`) 2026-08-12:
 * - Empire Divided (wiki.guildwars2.com/wiki/Empire_Divided, Revenant/Vindicator, Minor GM, id 2229):
 *   single 50% threshold, no game-mode split at all (only a PvP-specific value that has changed
 *   across balance patches independently of PvE/WvW, irrelevant here since this app only tracks a
 *   WvW value) — "Gain increased power while above the health threshold. Gain increased healing
 *   power when below it." Power 240 at/above 50%, Healing 240 below 50%. `between50and75` uses the
 *   same Power 240 as `above75` since Empire Divided's own threshold is 50%, not 75% — the tier only
 *   exists to serve Last Rites' finer breakpoint below.
 * - Last Rites (wiki.guildwars2.com/wiki/Last_Rites, Necromancer/Blood Magic, Major tier 3, id
 *   1931): `split = pve wvw, pvp`, genuine 2-way split on all 3 tiers — Healing Power is 150/300/450
 *   PvE+WvW vs. 50/100/150 PvP (above 75% / 75%-50% / below 50% respectively, per the raw API's own
 *   duplicate `AttributeAdjust` facts per tier). WvW values used here: 150/300/450. The trait's other
 *   effect (allies near you don't bleed out while downed) is a proc/utility effect, not a character-
 *   stat gain — out of scope.
 */
export const HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES: Record<number, Record<HealthTier, Record<string, number>>> = {
  2229: {
    // Empire Divided (Revenant/Vindicator, Minor GM) — WvW value
    above75: { Power: 240 },
    between50and75: { Power: 240 },
    below50: { Healing: 240 }
  },
  1931: {
    // Last Rites (Necromancer/Blood Magic, Major tier 3) — WvW value
    above75: { Healing: 150 },
    between50and75: { Healing: 300 },
    below50: { Healing: 450 }
  }
}

/**
 * Sums every curated health-threshold trait bonus actually active on this build for the given tier,
 * grouped by target attribute (mirrors `mechanicActiveAttributeTraitBonus`'s shape/gating). Unlike
 * every prior family here, this isn't gated by a separate boolean — `state.healthTier` itself always
 * has a value, so this just picks the matching tier's bonus map per curated trait.
 */
export function healthThresholdAttributeTraitBonus(build: Build, tier: HealthTier, traitsById: Map<number, Trait>): Record<string, number> {
  const active = activeTraitIds(build, traitsById)
  const bonus: Record<string, number> = {}
  for (const [traitIdText, tiers] of Object.entries(HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES)) {
    if (!active.has(Number(traitIdText))) continue
    for (const [target, value] of Object.entries(tiers[tier])) bonus[target] = (bonus[target] ?? 0) + value
  }
  return bonus
}

export interface ActiveStackingSigil {
  sigilId: number
  name: string
  attribute: string
  perStack: number
}

/**
 * Auto-detects the stacking sigil to show a stepper for, from whichever sigil is actually
 * equipped — no separate picker. Mirrors `isActiveWeaponSlot`'s "only the active weapon set
 * counts" gating so this matches the in-game rule that only one stacking sigil can be active at a
 * time; returns the first match found since a build should never legally have 2 different
 * stacking sigils equipped on the same active set anyway.
 */
export function detectActiveStackingSigil(build: Build): ActiveStackingSigil | null {
  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    if (!slotKey.startsWith('weapon') || !isActiveWeaponSlot(slotKey, build)) continue
    for (const sigilId of build.equipment[slotKey]?.sigilIds ?? []) {
      if (sigilId == null) continue
      const entry = STACKING_SIGILS[sigilId]
      if (entry) return { sigilId, name: entry.name, attribute: entry.attribute, perStack: entry.perStack }
    }
  }
  return null
}

/**
 * Raw core-attribute point deltas contributed by Might (including any curated
 * `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`), an active stacking sigil, and (while the corresponding
 * `CombatState` boolean is on) any curated `FURY_ATTRIBUTE_TRAIT_BONUSES`,
 * `REGENERATION_ATTRIBUTE_TRAIT_BONUSES`, `QUICKNESS_ATTRIBUTE_TRAIT_BONUSES`,
 * `MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES`, or `REVEALED_ATTRIBUTE_TRAIT_BONUSES` — plus any
 * curated `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES` for the current `state.healthTier` (always
 * applied, no separate on/off gate) — in the same `points` shape `computeGearAttributeTotals`
 * produces — merged into that total by
 * `computeCharacterStats` before deriving the stats-panel values. Fury's own crit-*chance* bonus and
 * the relic bonus don't go through this path since they apply directly to derived stats, not raw
 * attribute points.
 */
export function combatStatePoints(build: Build, state: CombatState, traitsById: Map<number, Trait>): Record<string, number> {
  const points: Record<string, number> = {}
  const add = (attribute: string, value: number): void => {
    points[attribute] = (points[attribute] ?? 0) + value
  }

  if (state.mightStacks > 0) {
    add('Power', state.mightStacks * MIGHT_POWER_PER_STACK)
    add('ConditionDamage', state.mightStacks * MIGHT_CONDITION_DAMAGE_PER_STACK)
    for (const [attribute, value] of Object.entries(mightStackAttributeTraitBonus(build, state.mightStacks, traitsById))) add(attribute, value)
  }

  const sigil = detectActiveStackingSigil(build)
  if (sigil && state.stackingSigilStacks > 0) {
    const value = sigil.perStack * state.stackingSigilStacks
    if (sigil.attribute === ALL_STATS) {
      for (const attribute of ALL_CORE_ATTRIBUTE_KEYS) add(attribute, value)
    } else {
      add(sigil.attribute, value)
    }
  }

  if (state.furyActive) {
    for (const [attribute, value] of Object.entries(furyAttributeTraitBonus(build, traitsById))) add(attribute, value)
  }

  if (state.regenerationActive) {
    for (const [attribute, value] of Object.entries(regenerationAttributeTraitBonus(build, traitsById))) add(attribute, value)
  }

  if (state.quicknessActive) {
    for (const [attribute, value] of Object.entries(quicknessAttributeTraitBonus(build, traitsById))) add(attribute, value)
  }

  if (state.mechanicActive) {
    for (const [attribute, value] of Object.entries(mechanicActiveAttributeTraitBonus(build, traitsById))) add(attribute, value)
  }

  if (state.revealedActive) {
    for (const [attribute, value] of Object.entries(revealedAttributeTraitBonus(build, traitsById))) add(attribute, value)
  }

  for (const [attribute, value] of Object.entries(healthThresholdAttributeTraitBonus(build, state.healthTier, traitsById))) add(attribute, value)

  return points
}
