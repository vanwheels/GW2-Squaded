import type { Build, Consumable, EquipmentSlotKey, Trait } from '../types'
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
  /** Gates `FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES` (currently just Brutal Momentum) — defaults to
   *  `true`, unlike every boolean above (which default `false`): endurance, like health
   *  (`healthTier`, also defaulted to its "full" tier), is the player's own passively-regenerating
   *  resource rather than an externally-granted boon, so "full" is the reasonable steady-state
   *  assumption a static build snapshot should start from — matches gw2skills.net's own default and
   *  a real in-game hero-panel check out of combat (both confirmed 2026-08-13). */
  fullEnduranceActive: boolean
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
  /** 0-5 stacks of Kalla's Fervor, Revenant/Renegade's own stacking self-buff (2% strike damage, 2%
   *  condition damage, 2% life-steal damage per stack — 3%/3%/3% with Lasting Legacy chosen, see
   *  `kallaFervorPercentPerStack` below). Only meaningful/surfaced when the Renegade elite spec is
   *  equipped (`CombatStatePanel` gates its stepper on `RENEGADE_SPECIALIZATION_ID`), same shape as
   *  `stackingSigilStacks` (a build-conditional stepper) rather than a flat boolean like
   *  `furyActive` etc. */
  kallaFervorStacks: number
  /** 0-30 stacks of Death's Carapace, Necromancer/Death Magic's own stacking self-buff (+20
   *  Toughness per stack WvW/PvE, +10 PvP — see `DEATHS_CARAPACE_TOUGHNESS_PER_STACK`), granted by
   *  Death Magic's Armored Shroud (on Shroud entry, both auto-granted minors so always live once the
   *  line is equipped) and Soul Comprehension (on kill), or Dark Defense (on healing-skill use, a
   *  Major pick). Only meaningful/surfaced when Death Magic is equipped (`CombatStatePanel` gates its
   *  stepper on `DEATH_MAGIC_SPECIALIZATION_ID`), same shape as `kallaFervorStacks` (a
   *  build-conditional stepper) rather than a flat boolean. */
  deathsCarapaceStacks: number
}

export const DEFAULT_COMBAT_STATE: CombatState = {
  mightStacks: 0,
  furyActive: false,
  regenerationActive: false,
  quicknessActive: false,
  fullEnduranceActive: true,
  mechanicActive: false,
  revealedActive: false,
  healthTier: 'above75',
  stackingSigilStacks: 0,
  relicActive: false,
  targetArmorClass: 'Medium',
  kallaFervorStacks: 0,
  deathsCarapaceStacks: 0
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

/**
 * Renegade/Grandmaster major trait "Lasting Legacy" (id 2100) upgrades Kalla's Fervor to "Improved
 * Kalla's Fervor" — wiki-verified via raw wikitext 2026-08-12: `split = pve, wvw pvp`, genuine 2-way
 * split — PvE is +5% Damage/+3% Condition Damage/+3% Life-Steal Damage per stack (asymmetric), WvW/
 * PvP is a flat +3%/+3%/+3% per stack (this app's WvW value, used here). The trait's other effect
 * ("lasts longer", `{{skill fact|duration increase|50%}}`) isn't modeled — Kalla's Fervor stacks are
 * a manual 0-5 combat-state count here, not a timed buff (see `CombatState.kallaFervorStacks`'s doc
 * comment), so a duration bonus has nothing to attach to, same as Might's own duration never being
 * tracked. Heroic Command's separate "grants more might per stack" clause is its own skill-tooltip
 * Buff fact (already rendered via `boonConditionFactsForTrait`), not part of this per-stack-%% math.
 */
export const LASTING_LEGACY_TRAIT_ID = 2100
export const KALLA_FERVOR_IMPROVED_STRIKE_DAMAGE_PERCENT_PER_STACK = 3
export const KALLA_FERVOR_IMPROVED_CONDITION_DAMAGE_PERCENT_PER_STACK = 3
export const KALLA_FERVOR_IMPROVED_LIFE_STEAL_PERCENT_PER_STACK = 3

export interface KallaFervorPercentPerStack {
  strikeDamage: number
  conditionDamage: number
  lifeSteal: number
  /** Whether Lasting Legacy's upgraded per-stack values are the ones being returned — surfaced so
   *  `CombatStatePanel` can label its stepper accordingly. */
  improved: boolean
}

/** Resolves Kalla's Fervor's actual per-stack %-per-stat, upgraded by Lasting Legacy when it's
 *  chosen — mirrors `mightStackAttributeTraitBonus`'s "check `activeTraitIds` once" convention, but
 *  a straight override rather than an additive bonus (Lasting Legacy replaces the base 2%/2%/2%
 *  with 3%/3%/3%, it doesn't stack on top of it). */
export function kallaFervorPercentPerStack(build: Build, traitsById: Map<number, Trait>): KallaFervorPercentPerStack {
  const improved = activeTraitIds(build, traitsById).has(LASTING_LEGACY_TRAIT_ID)
  return improved
    ? {
        strikeDamage: KALLA_FERVOR_IMPROVED_STRIKE_DAMAGE_PERCENT_PER_STACK,
        conditionDamage: KALLA_FERVOR_IMPROVED_CONDITION_DAMAGE_PERCENT_PER_STACK,
        lifeSteal: KALLA_FERVOR_IMPROVED_LIFE_STEAL_PERCENT_PER_STACK,
        improved: true
      }
    : {
        strikeDamage: KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK,
        conditionDamage: KALLA_FERVOR_CONDITION_DAMAGE_PERCENT_PER_STACK,
        lifeSteal: KALLA_FERVOR_LIFE_STEAL_PERCENT_PER_STACK,
        improved: false
      }
}

/**
 * Death's Carapace (Necromancer/Death Magic core spec's own stacking self-buff, max 30 stacks) —
 * wiki-verified via raw wikitext (wiki.guildwars2.com/index.php?title=Death%27s_Carapace&action=raw)
 * 2026-08-15: "Increased toughness per stack" — split PvE/WvW 20 / PvP 10 (reduced from 20 by a 2020
 * balance patch, PvP only); this app's WvW value is 20. Granted by Death Magic's Armored Shroud (856,
 * Minor tier 1 — "Gain carapace when entering shroud", 5 stacks/entry) and Soul Comprehension (839,
 * Minor tier 2 — "Kills grant carapace", 1 stack/kill), both auto-granted whenever Death Magic is
 * equipped at all, or Dark Defense (860, Major tier 2 — "Gain carapace ... when you use a healing
 * skill", 10 stacks/use, mutually exclusive with Deadly Strength below since both are Major tier 2).
 * This baseline Toughness grant is the buff's own effect, not any one trait's — applies whenever the
 * player holds stacks at all, same "unconditional per-stack baseline" shape `MIGHT_POWER_PER_STACK`/
 * `MIGHT_CONDITION_DAMAGE_PER_STACK` already model for Might. `DEADLY_STRENGTH_ATTRIBUTE_TRAIT_
 * BONUSES` below is Deadly Strength's own *additional* per-stack grant, the `MIGHT_STACK_ATTRIBUTE_
 * TRAIT_BONUSES`-shaped trait add-on sibling to this baseline. Soul Comprehension's separate "gain
 * life force per stack on shroud entry" clause and the granting traits' own apply-count mechanics are
 * out of scope here — Life Force is a resource this codebase doesn't track anywhere (same "resource
 * gain, not a character-stat gain" exclusion already applied to Boon of Creation's life-force-on-
 * summon and Spiteful Fortitude's health-threshold life-force proc elsewhere in this file), and how
 * stacks actually accumulate mid-fight is exactly what the manual `deathsCarapaceStacks` stepper
 * exists to sidestep, same reasoning `kallaFervorStacks` above already documents.
 */
export const DEATHS_CARAPACE_MAX_STACKS = 30
export const DEATHS_CARAPACE_TOUGHNESS_PER_STACK = 20 // WvW/PvE value; PvP is 10

/** Death Magic (Necromancer core spec) — gates `CombatStatePanel`'s Carapace stepper, mirrors
 *  `RENEGADE_SPECIALIZATION_ID`'s role for `kallaFervorStacks` above: Death's Carapace can't exist on
 *  a build without this line equipped (both granting minors live here), so there's no reason to show
 *  the stepper otherwise. */
export const DEATH_MAGIC_SPECIALIZATION_ID = 2

/**
 * Trait id -> extra flat attribute points (by target) granted per stack of Death's Carapace — Deadly
 * Strength (Necromancer/Death Magic, Major tier 2, id 855), TODO.md's "New attribute-bonus gaps
 * needing new CombatState infra" second item. Wiki-verified via the live API's own `description`/
 * `facts` (`data/game-data/traits.json`) 2026-08-15: "Carapace stacks grant power and condition
 * damage" — `{{skill fact|attribute|Power|10}}` + `{{skill fact|attribute|Condition Damage|10}}`, no
 * game-mode split (matches `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`'s per-stack shape, just keyed to
 * this resource instead of Might). Mutually exclusive with Dark Defense (860, same Major tier 2 slot)
 * — the two can never both be active on one build, but the calc doesn't need to special-case that
 * since `activeTraitIds` already only ever contains the one actually chosen.
 */
export const DEATHS_CARAPACE_ATTRIBUTE_TRAIT_BONUSES: Record<number, Record<string, number>> = {
  855: { Power: 10, ConditionDamage: 10 } // Deadly Strength (Necromancer/Death Magic, Major tier 2)
}

/**
 * Resolves the baseline Toughness grant plus any curated Deadly-Strength-shaped per-stack trait
 * bonus, grouped by target attribute, for the given `deathsCarapaceStacks` count (mirrors
 * `mightStackAttributeTraitBonus`'s shape, folding the always-on baseline and the trait add-on into
 * one function since — unlike Might, which every profession can have — nothing else in this file
 * ever needs Death's Carapace's baseline alone).
 */
export function deathsCarapaceAttributePoints(build: Build, stacks: number, traitsById: Map<number, Trait>): Record<string, number> {
  const bonus: Record<string, number> = {}
  if (stacks <= 0) return bonus
  bonus.Toughness = stacks * DEATHS_CARAPACE_TOUGHNESS_PER_STACK
  const active = activeTraitIds(build, traitsById)
  for (const [traitIdText, targets] of Object.entries(DEATHS_CARAPACE_ATTRIBUTE_TRAIT_BONUSES)) {
    if (!active.has(Number(traitIdText))) continue
    for (const [target, valuePerStack] of Object.entries(targets)) bonus[target] = (bonus[target] ?? 0) + valuePerStack * stacks
  }
  return bonus
}

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
 * so 20 is correct here. Revenant/Renegade's Brutal Momentum was originally assumed to belong to
 * this list too, but wiki-verification 2026-08-13 (prompted by a Tier 3 reference-build mismatch
 * — see TODO.md) found its actual gate is full Endurance, not Fury — it's curated separately
 * below, in `FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES`.
 *
 * The remaining 3 similarly-shaped fury-crit traits flagged in TODO.md (found via a full
 * `traits.json` scan for "Critical Chance Increase" facts near "fury" in the description) are now
 * also wiki-verified via raw wikitext (`?action=raw`) 2026-08-13:
 * - Hematic Focus (wiki.guildwars2.com/wiki/Hematic_Focus, Engineer/Firearms, Minor Master, id
 *   536): `{{skill fact|critical chance increase|15|game mode=pve}}` /
 *   `{{skill fact|critical chance increase|10|game mode=pvp}}` /
 *   `{{skill fact|critical chance increase|5|game mode=wvw}}` — a genuine 3-way split (WvW ≠ PvP
 *   here, unlike most of this table), and WvW was independently nerfed 10→5 by the 2026-01-13
 *   patch per the page's own version history, so the older "WvW/PvP share a value" assumption
 *   this table otherwise uses doesn't hold for this trait. WvW value is 5.
 * - Furious Burst (wiki.guildwars2.com/wiki/Furious_Burst, Warrior/Arms, Minor Adept, id 1342 —
 *   the raw wikitext's own infobox icon/description now reads "Precise Strikes", a 2023-11-28
 *   rework that changed its trigger from burst-skill-use to weapon-swap, but `traits.json` still
 *   names live id 1342 "Furious Burst", so kept that name here for consistency with this app's
 *   data): `{{skill fact|critical chance increase|5}}`, no game-mode split on this particular
 *   fact.
 * - Vicious Quarry (wiki.guildwars2.com/wiki/Vicious_Quarry, Ranger/Skirmishing, Major GM, id
 *   1888): `{{skill fact|critical chance increase|15|game mode=pve}}` /
 *   `{{skill fact|critical chance increase|10|game mode=pvp wvw}}`, WvW value 10 — a *second*,
 *   independent fact on the same trait from the one already curated in
 *   `FURY_ATTRIBUTE_TRAIT_BONUSES` below (`{{skill fact|attribute|Ferocity|250}}`, no split); both
 *   are real and both apply, this table just tracks the crit-chance half.
 */
export const FURY_CRIT_CHANCE_TRAIT_BONUSES: Record<number, number> = {
  536: 5, // Hematic Focus (Engineer, Firearms, Minor Master) — WvW value (PvP is 10, PvE is 15)
  1342: 5, // Furious Burst (Warrior, Arms, Minor Adept) — no mode split
  1719: 20, // Roiling Mists (Revenant, Invocation, Major tier 3) — WvW value
  1888: 10, // Vicious Quarry (Ranger, Skirmishing, Major GM) — WvW/PvP value; PvE is 15
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
 * Trait id -> { at full Endurance / otherwise } critical-chance bonus — sibling family to
 * `FURY_CRIT_CHANCE_TRAIT_BONUSES` above, for the one trait gated on Endurance instead of Fury.
 * Wiki-verified via raw wikitext (wiki.guildwars2.com/index.php?title=Brutal_Momentum&action=raw)
 * 2026-08-13: "Gain increased critical-hit chance. This bonus is increased further while your
 * endurance is full." — `{{skill fact|Critical Chance Increase|10|game mode=pve wvw}}` /
 * `{{skill fact|Critical Chance Increase|15|game mode=pvp}}` (WvW value 10) is the baseline, fully
 * REPLACED (not stacked on top of) by `{{skill fact|Critical Chance Increase|alt=Critical Chance
 * Increase at Full Endurance|33}}` while at full Endurance — confirmed against a real reference
 * build (gw2skills.net + in-game hero panel, both 2026-08-13): with Roiling Mists' Fury-gated bonus
 * OFF and Brutal Momentum's own trait chosen, the build's total critical chance matched
 * `base + Precision term + 33` exactly, not `+ 10 + 33` — the game's own "alt=" template usage
 * (an override display name for the same fact slot, not a separate additive fact) confirms this
 * reading structurally too.
 */
export const FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES: Record<number, { fullEndurance: number; otherwise: number }> = {
  2142: { fullEndurance: 33, otherwise: 10 } // Brutal Momentum (Revenant, Renegade, Minor GM) — WvW value
}

/**
 * Picks the right `FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES` value (full-Endurance vs. otherwise,
 * per `fullEnduranceActive`) for every curated trait active on this build, summed. Unlike
 * `furyCritChanceTraitBonus` (an on/off add the caller gates), this always contributes *something*
 * once the trait is active — mirrors `kallaFervorPercentPerStack`'s "override, not stack" shape.
 */
export function fullEnduranceCritChanceTraitBonus(build: Build, traitsById: Map<number, Trait>, fullEnduranceActive: boolean): number {
  const active = activeTraitIds(build, traitsById)
  let bonus = 0
  for (const [traitIdText, { fullEndurance, otherwise }] of Object.entries(FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) bonus += fullEnduranceActive ? fullEndurance : otherwise
  }
  return bonus
}

/**
 * Trait id -> flat critical-hit-chance bonus granted unconditionally (no Fury/Endurance/health/
 * mechanic gate at all) — TODO.md's "Pinnacle of Strength flat-crit sweep" follow-up to
 * `FURY_CRIT_CHANCE_TRAIT_BONUSES`/`FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES` above, run 2026-08-15
 * as a full `traits.json` scan for every `Percent` fact whose text matches "Critical Chance
 * Increase" (26 candidate traits found; the other 20 turned out to be foe-state-gated (e.g. vs.
 * Defiant/Disabled/Burning/Weakened/behind-target foes), own-resource-gated (Guardian's Resolution,
 * Ranger's Opening Strike), range-gated, or already covered by the Fury/Endurance tables above — see
 * `HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES`/`MECHANIC_ACTIVE_CRIT_CHANCE_TRAIT_BONUSES` below for the
 * 2 that fit *other* existing gates instead of this unconditional one). All 3 wiki-verified via raw
 * wikitext (`?action=raw`) 2026-08-15:
 * - Zephyr's Speed (wiki.guildwars2.com/index.php?title=Zephyr's_Speed_(elementalist), Elementalist/
 *   Air, Minor tier 1, id 221): `{{skill fact|critical chance increase|5}}`, no game-mode split. The
 *   trait's other effect (+25% movement speed while attuned to air) is attunement-gated, out of
 *   scope for this unconditional table.
 * - Death Perception (wiki.guildwars2.com/wiki/Death_Perception, Necromancer/Soul Reaping, Major
 *   tier 3, id 893): `{{skill fact|critical chance increase|15|game mode = pve wvw}}` /
 *   `...|10|game mode = pvp}}` — WvW value 15, and genuinely unconditional despite the trait's other
 *   half ("gain increased critical-strike damage while in shroud") being Shroud-gated — the crit-
 *   *chance* grant itself always applies, confirmed by the wiki's own fact template carrying no
 *   `requires`/shroud qualifier unlike the separate Critical Damage Increase facts.
 * - Pinnacle of Strength (wiki.guildwars2.com/wiki/Pinnacle_of_Strength, Warrior/Strength, Minor
 *   tier 3, id 1453): `{{skill fact|Critical Chance Increase|5}}`, no game-mode split (added by the
 *   2022-07-19 balance patch per the wiki's own Version History). The trait's other effect (+10
 *   Power per Might stack) is already curated in `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES` above.
 */
export const FLAT_CRIT_CHANCE_TRAIT_BONUSES: Record<number, number> = {
  221: 5, // Zephyr's Speed (Elementalist, Air, Minor tier 1) — no mode split
  893: 15, // Death Perception (Necromancer, Soul Reaping, Major tier 3) — WvW value (PvP is 10)
  1453: 5 // Pinnacle of Strength (Warrior, Strength, Minor tier 3) — no mode split
}

/**
 * Sums every curated unconditional flat-crit-chance trait bonus active on this build (mirrors
 * `furyCritChanceTraitBonus`'s shape, minus the caller-side gate — this one always contributes).
 */
export function flatCritChanceTraitBonus(build: Build, traitsById: Map<number, Trait>): number {
  const active = activeTraitIds(build, traitsById)
  let bonus = 0
  for (const [traitIdText, value] of Object.entries(FLAT_CRIT_CHANCE_TRAIT_BONUSES)) {
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
  1888: { target: 'CritDamage', value: 250 }, // Vicious Quarry (Ranger, Major) — also grants a crit-*chance* bonus, curated separately in FURY_CRIT_CHANCE_TRAIT_BONUSES above
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
 *   ("Critical Chance Increase" fact, added 2022-07-19) — curated separately in
 *   `FLAT_CRIT_CHANCE_TRAIT_BONUSES` below (2026-08-15 flat-crit sweep).
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
 * Trait id -> a Power bonus gated on BOTH a Might-stack threshold AND doubled while attuned to a
 * specific element — TODO.md's "New attribute-bonus gaps needing new CombatState infra" first item,
 * Power Overwhelming (Elementalist/Air, Major tier 2, id 334). Distinct from every other family in
 * this file: `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES` scales continuously per stack, this is a binary
 * on/off once `mightStacks` reaches `mightThreshold`; `ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES`
 * (`trait-attributes.ts`) is a flat attunement-gated bonus, this is a *multiplier* on an
 * already-threshold-gated bonus — the "doubling isn't its own fact" shape `WEAPON_EQUIPPED_
 * ATTRIBUTE_TRAIT_BONUSES`'s Forceful Greatsword/Blood Reaction comments already flag elsewhere.
 * Both facts wiki-verified via raw wikitext (`?action=raw`) 2026-08-15
 * (wiki.guildwars2.com/index.php?title=Power_Overwhelming_(trait)&action=raw): "While at or above
 * the might threshold, gain increased power. Power bonuses are doubled while attuned to fire."
 * `{{skill fact|attribute|Power|150}}` (no split) + `{{skill fact|Stack Threshold|10|game mode =
 * pve}}` / `...|8|game mode = pvp wvw}}` — this app's WvW value is the threshold 8, doubled to 300
 * only while `build.activeAttunement === doubleAttunement`. No other trait in `traits.json` shares
 * this combined-gate shape yet, so the table stays a `Record` (uniform with every other family here)
 * even with a single entry.
 */
export interface MightThresholdAttunementDoubledTraitBonus {
  target: string
  value: number
  mightThreshold: number
  doubleAttunement: 'Fire' | 'Water' | 'Air' | 'Earth'
}

export const MIGHT_THRESHOLD_ATTUNEMENT_DOUBLED_ATTRIBUTE_TRAIT_BONUSES: Record<number, MightThresholdAttunementDoubledTraitBonus> = {
  334: { target: 'Power', value: 150, mightThreshold: 8, doubleAttunement: 'Fire' } // Power Overwhelming (Elementalist, Air, Major tier 2) — WvW threshold
}

/**
 * Resolves every curated might-threshold+attunement-doubled trait bonus actually active on this
 * build for the given `mightStacks` count, grouped by target attribute (mirrors
 * `mightStackAttributeTraitBonus`'s shape/gating just above). Below `mightThreshold` a trait
 * contributes nothing at all (not a smaller flat amount) — matches the wiki's own "at or above the
 * threshold" wording, a hard gate rather than a taper.
 */
export function mightThresholdAttunementDoubledAttributeTraitBonus(build: Build, mightStacks: number, traitsById: Map<number, Trait>): Record<string, number> {
  const active = activeTraitIds(build, traitsById)
  const bonus: Record<string, number> = {}
  for (const [traitIdText, { target, value, mightThreshold, doubleAttunement }] of Object.entries(MIGHT_THRESHOLD_ATTUNEMENT_DOUBLED_ATTRIBUTE_TRAIT_BONUSES)) {
    if (!active.has(Number(traitIdText))) continue
    if (mightStacks < mightThreshold) continue
    const amount = build.activeAttunement === doubleAttunement ? value * 2 : value
    bonus[target] = (bonus[target] ?? 0) + amount
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
 * Trait id -> flat critical-hit-chance bonus while the profession mechanic is active — the
 * mechanic-active-gated sibling to `FLAT_CRIT_CHANCE_TRAIT_BONUSES` above, found by the same
 * 2026-08-15 "Critical Chance Increase" scan. Only one candidate: Smash Brawler
 * (wiki.guildwars2.com/wiki/Smash_Brawler, Warrior/Berserker, Major tier 1, id 2049) —
 * "Critical-hit chance is increased while berserk." Raw wikitext (`?action=raw`) confirms a
 * genuine 2-way split, `{{skill fact|Critical Chance Increase|15|game mode = pve pvp}}` /
 * `...|5|game mode = wvw}}` — WvW value 5. Reuses `CombatState.mechanicActive` (Berserk mode is one
 * of the 3 mechanics that toggle already, see `MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES`'s doc
 * comment), no new state needed. The trait's other effect (extends Berserk duration on Primal Burst
 * hit) is a proc/duration effect, not a character-stat gain — out of scope here.
 */
export const MECHANIC_ACTIVE_CRIT_CHANCE_TRAIT_BONUSES: Record<number, number> = {
  2049: 5 // Smash Brawler (Warrior, Berserker, Major tier 1) — WvW value (PvE/PvP is 15)
}

/**
 * Sums every curated mechanic-active flat-crit-chance trait bonus active on this build (mirrors
 * `furyCritChanceTraitBonus`'s shape). Only meaningful when combined with `combatState.mechanicActive`
 * by the caller.
 */
export function mechanicActiveCritChanceTraitBonus(build: Build, traitsById: Map<number, Trait>): number {
  const active = activeTraitIds(build, traitsById)
  let bonus = 0
  for (const [traitIdText, value] of Object.entries(MECHANIC_ACTIVE_CRIT_CHANCE_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) bonus += value
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

/**
 * Trait id -> { above the health threshold / otherwise } flat critical-hit-chance bonus — the
 * health-tier-gated sibling to `FLAT_CRIT_CHANCE_TRAIT_BONUSES`/`MECHANIC_ACTIVE_CRIT_CHANCE_TRAIT_BONUSES`
 * above, found by the same 2026-08-15 "Critical Chance Increase" scan. Only one candidate: Keen
 * Observer (wiki.guildwars2.com/wiki/Keen_Observer, Thief/Deadly Arts, Minor tier 1, id 1281) —
 * "Critical-hit chance is increased, and it is further increased while your health is above the
 * threshold." Raw wikitext (`?action=raw`) shows the threshold itself splits by mode (`{{skill
 * fact|health threshold|50|game mode = pve}}` / `...|90|game mode = wvw pvp}}` — WvW is 90%) and
 * the trait stacks 2 independent facts: an always-on base (`{{skill fact|critical chance
 * increase|10|game mode=pve}}` / `...|5|game mode=wvw pvp}}` — WvW 5%) plus a `alt=High-Health
 * Critical Chance Increase` bonus on top while above the threshold (`...|5|game mode=pve}}` /
 * `...|5|game mode=wvw pvp}}` — WvW 5% either mode). WvW total: 5% base, 10% while above 90%
 * health. Reuses the existing `HealthTier`/`state.healthTier` (no new `CombatState` field), same
 * `'above75'`-bucket approximation `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES` already documents for
 * a >75%-but-not-exactly-90% threshold — `aboveThreshold` only fires at the `'above75'` tier, not
 * `'between50and75'`.
 */
export const HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES: Record<number, { aboveThreshold: number; otherwise: number }> = {
  1281: { aboveThreshold: 10, otherwise: 5 } // Keen Observer (Thief, Deadly Arts, Minor tier 1) — WvW values
}

/**
 * Sums every curated health-tier-gated flat-crit-chance trait bonus active on this build for the
 * given tier (mirrors `fullEnduranceCritChanceTraitBonus`'s "override, not stack" shape, keyed by
 * `HealthTier` instead of a boolean). Unlike the Fury/mechanic-active crit-chance tables, this isn't
 * gated by a separate boolean — `state.healthTier` itself always has a value.
 */
export function highHealthCritChanceTraitBonus(build: Build, tier: HealthTier, traitsById: Map<number, Trait>): number {
  const active = activeTraitIds(build, traitsById)
  let bonus = 0
  for (const [traitIdText, { aboveThreshold, otherwise }] of Object.entries(HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) bonus += tier === 'above75' ? aboveThreshold : otherwise
  }
  return bonus
}

/**
 * Food/Utility consumable id -> flat attribute bonus while at/above 90% health — the WvW "Writ of
 * X" / "Thesis on X" family (Strength -> Power, Accuracy -> Precision, Malice -> Condition Damage;
 * Basic/Studied/Calculated/Learned/Masterful tiers = 40/100/120/160/200), sourced directly from
 * each item's own API description text (e.g. "Gain 200 Power When Health above 90%" — not
 * wiki-sourced, this is the game's own structured text, same trust level as any other consumable
 * bonus line already used unverified elsewhere, e.g. a stat sigil's "+N% Boon Duration"). Found
 * 2026-08-13 investigating a Tier 3 reference-build Power mismatch: `AttributeBonusText`'s parser
 * (`parseAttributeBonusText` in `scripts/fetch-gear-upgrades.ts`) only recognizes flat/percent/
 * sourceAttribute shapes, so every one of these 36 items' bonus line came back `{attribute: null}`
 * and silently contributed nothing — see TODO.md. Threshold is always exactly "above 90%" across
 * the whole family (confirmed via the scan that built this table — no other health-conditional
 * consumable shape exists in `food.json`/`utility.json`), which only cleanly maps onto this app's
 * `HealthTier`'s `'above75'` bucket (same simplification `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES`
 * already makes for its own curated traits) — `between50and75`/`below50` never grant this bonus.
 */
export const HEALTH_THRESHOLD_CONSUMABLE_BONUSES: Record<number, { target: string; value: number }> = {
  70845: { target: 'Power', value: 100 }, // Thesis on Studied Strength
  70883: { target: 'Power', value: 100 }, // Writ of Studied Strength
  70920: { target: 'ConditionDamage', value: 120 }, // Thesis on Calculated Malice
  71071: { target: 'ConditionDamage', value: 160 }, // Thesis on Learned Malice
  71377: { target: 'Power', value: 60 }, // Thesis on Strength
  71514: { target: 'Precision', value: 100 }, // Writ of Studied Accuracy
  71810: { target: 'Precision', value: 160 }, // Thesis on Learned Accuracy
  72048: { target: 'Power', value: 60 }, // Writ of Strength
  72291: { target: 'Precision', value: 60 }, // Writ of Accuracy
  72510: { target: 'ConditionDamage', value: 200 }, // Writ of Masterful Malice
  72563: { target: 'ConditionDamage', value: 40 }, // Writ of Basic Malice
  72572: { target: 'ConditionDamage', value: 120 }, // Writ of Calculated Malice
  72807: { target: 'Power', value: 160 }, // Writ of Learned Strength
  72813: { target: 'ConditionDamage', value: 60 }, // Writ of Malice
  72821: { target: 'Precision', value: 120 }, // Writ of Calculated Accuracy
  73006: { target: 'Power', value: 40 }, // Thesis on Basic Strength
  73105: { target: 'Power', value: 160 }, // Thesis on Learned Strength
  73191: { target: 'Power', value: 200 }, // Writ of Masterful Strength
  73286: { target: 'Power', value: 40 }, // Writ of Basic Strength
  73595: { target: 'Precision', value: 40 }, // Writ of Basic Accuracy
  74478: { target: 'Power', value: 120 }, // Thesis on Calculated Strength
  75051: { target: 'ConditionDamage', value: 100 }, // Writ of Studied Malice
  75060: { target: 'Precision', value: 40 }, // Thesis on Basic Accuracy
  75199: { target: 'Precision', value: 100 }, // Thesis on Studied Accuracy
  75598: { target: 'ConditionDamage', value: 60 }, // Thesis on Malice
  75610: { target: 'Precision', value: 160 }, // Writ of Learned Accuracy
  75728: { target: 'Precision', value: 60 }, // Thesis on Accuracy
  76353: { target: 'ConditionDamage', value: 40 }, // Thesis on Basic Malice
  76478: { target: 'ConditionDamage', value: 160 }, // Writ of Learned Malice
  76599: { target: 'Precision', value: 200 }, // Thesis on Masterful Accuracy
  76738: { target: 'ConditionDamage', value: 200 }, // Thesis on Masterful Malice
  76833: { target: 'Precision', value: 200 }, // Writ of Masterful Accuracy
  76870: { target: 'Precision', value: 120 }, // Thesis on Calculated Accuracy
  77106: { target: 'ConditionDamage', value: 100 }, // Thesis on Studied Malice
  77128: { target: 'Power', value: 120 }, // Writ of Calculated Strength
  77146: { target: 'Power', value: 200 } // Thesis on Masterful Strength
}

/**
 * Sums `HEALTH_THRESHOLD_CONSUMABLE_BONUSES` for whichever of `build.foodId`/`build.utilityId` has
 * a curated entry, gated on `tier === 'above75'` (see that table's doc comment). Mirrors
 * `healthThresholdAttributeTraitBonus`'s shape but reads consumables instead of traits — called
 * directly from `computeCharacterStats` (like `activeConsumableConversions`) rather than folded
 * into `combatStatePoints`, since only that call site already has `foodById`/`utilityById` maps.
 */
export function healthThresholdConsumableBonus(
  build: Build,
  tier: HealthTier,
  foodById: Map<number, Consumable>,
  utilityById: Map<number, Consumable>
): Record<string, number> {
  const bonus: Record<string, number> = {}
  if (tier !== 'above75') return bonus
  for (const id of [build.foodId, build.utilityId]) {
    if (id === null) continue
    if (!foodById.has(id) && !utilityById.has(id)) continue
    const entry = HEALTH_THRESHOLD_CONSUMABLE_BONUSES[id]
    if (!entry) continue
    bonus[entry.target] = (bonus[entry.target] ?? 0) + entry.value
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
 * `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES` and `MIGHT_THRESHOLD_ATTUNEMENT_DOUBLED_ATTRIBUTE_TRAIT_
 * BONUSES`), an active stacking sigil, and (while the corresponding
 * `CombatState` boolean is on) any curated `FURY_ATTRIBUTE_TRAIT_BONUSES`,
 * `REGENERATION_ATTRIBUTE_TRAIT_BONUSES`, `QUICKNESS_ATTRIBUTE_TRAIT_BONUSES`,
 * `MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES`, or `REVEALED_ATTRIBUTE_TRAIT_BONUSES` — plus any
 * curated `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES` for the current `state.healthTier` (always
 * applied, no separate on/off gate) — plus Death's Carapace's own baseline Toughness grant and any
 * curated `DEATHS_CARAPACE_ATTRIBUTE_TRAIT_BONUSES` for `state.deathsCarapaceStacks` — in the same
 * `points` shape `computeGearAttributeTotals` produces — merged into that total by
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
  for (const [attribute, value] of Object.entries(mightThresholdAttunementDoubledAttributeTraitBonus(build, state.mightStacks, traitsById))) add(attribute, value)

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

  for (const [attribute, value] of Object.entries(deathsCarapaceAttributePoints(build, state.deathsCarapaceStacks, traitsById))) add(attribute, value)

  return points
}
