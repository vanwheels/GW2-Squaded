import type { Build, Consumable, EquipmentSlotKey, Trait } from '../types'
import { ALL_CORE_ATTRIBUTE_KEYS, isActiveWeaponSlot } from './attribute-totals'
import { activeTraitIds, activeWeaponTypes } from './trait-attributes'

/**
 * Ephemeral "what-if" combat inputs for the Stats panel — deliberately never persisted on `Build`
 * (resets on reload/build switch, unlike every other build-editor field). This models a snapshot
 * of buffs/stacks a player might have mid-fight, not a build choice like equipment/skills. See
 * TODO.md's "Combat state" design writeup for the reasoning behind each field.
 */
export interface CombatState {
  /** 0-25 stacks. */
  mightStacks: number
  /** Gates every Fury-conditional trait bonus curated anywhere in this file (crit chance —
   *  `FURY_CRITICAL_CHANCE_TRAIT_BONUSES`; movement speed — `FURY_MOVEMENT_SPEED_TRAIT_BONUSES`;
   *  outgoing damage — `FURY_DAMAGE_TRAIT_BONUSES`) — a real boon state, not a build choice, same
   *  "assume the condition is currently true" shape as `mechanicActive`/`relicActive`. */
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
  /** 0-25 stacks of whichever stacking sigil is equipped on either weapon set, if any — stacks
   *  persist across a weapon swap, unlike passive sigil bonuses, so this isn't gated to the active
   *  set — see `detectActiveStackingSigil`. Meaningless when no stacking sigil is equipped. */
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
  /** Manual count of the player's current total "points of upkeep" — Revenant/Herald's Rising
   *  Momentum (see `RISING_MOMENTUM_TRAIT_ID`) reads this. Unlike every other stepper above, this
   *  has no fixed real max: it's the sum of however many upkeep skills (Facets, Impossible Odds,
   *  Protective Solace, ...) the player currently has toggled on, each contributing its own
   *  wiki-listed point cost — this app has no per-skill upkeep-cost data anywhere (the GW2 API's
   *  own skill `facts` never expose it, confirmed via a `skills.json` scan 2026-08-20) and no
   *  concept of "which legend/utility loadout is on the bar right now" to derive it from
   *  automatically, so — same reasoning as `kallaFervorStacks`/`deathsCarapaceStacks` sidestepping
   *  their own untracked resources — this is a raw manual entry rather than an auto-derived count.
   *  Only meaningful/surfaced when Rising Momentum is actually chosen (`CombatStatePanel` gates its
   *  input on `RISING_MOMENTUM_TRAIT_ID`, same pattern as `mechanicActive`/`revealedActive`'s
   *  single-trait gates). */
  upkeepPoints: number
  /** Gates `CELESTIAL_AVATAR_OUTGOING_HEALING_TRAIT_BONUSES` (currently just Lingering Light) — a
   *  real in-combat state (actually shapeshifted into Celestial Avatar form), not a build choice,
   *  same "assume the condition is currently true" shape as `furyActive`/`mechanicActive`.
   *  Deliberately distinct from `Build.activeBundleSkillId` (Ranger/Druid's own Celestial-Avatar
   *  entry there is display-only and doesn't gate boon/condition totals, per that field's own doc
   *  comment) — Lingering Light's bonus genuinely only applies while actually shapeshifted, so it
   *  needs its own toggle here instead. */
  celestialAvatarActive: boolean
  /** Gates `INVOKING_HARMONY_HEALING_PERCENT` — Invoking Harmony's bonus only lasts a short window
   *  after invoking a legend (wiki: 10s), not a steady-state passive, same "assume the proc window
   *  is currently up" shape as `relicActive`. Only meaningful/surfaced when Invoking Harmony
   *  (`INVOKING_HARMONY_TRAIT_ID`) is actually chosen. */
  invokingHarmonyActive: boolean
  /** Gates Superior Sigil of the Night's (`SIGIL_OF_THE_NIGHT_ID`) additional +7% night-only damage
   *  share, on top of its own always-on 3% (see `CURATED_SIGIL_DAMAGE_BONUSES`) — a real Tyrian-
   *  time-of-day condition (wiki-verified 2026-08-22: active 21:00-5:00 Tyrian time, inactive during
   *  dawn/dusk), not a build choice, so it needs its own toggle rather than being folded into the
   *  flat per-sigil table like every unconditional sigil bonus. Defaults `false` (assume day), same
   *  "off by default" convention as `relicActive`/`invokingHarmonyActive` rather than the "assume
   *  full/passive resource" default `fullEnduranceActive`/`healthTier` use. Only meaningful/surfaced
   *  when Sigil of the Night is actually equipped on the active weapon set. */
  nightActive: boolean
  /** Gates `RESOLUTION_DAMAGE_TRAIT_BONUSES` (currently just Guardian/Radiance's Retribution) — a
   *  real boon state, not a build choice, same "assume the condition is currently true" shape as
   *  `furyActive`. Unlike `furyActive`/`regenerationActive`/`quicknessActive` (unconditionally
   *  shown in `CombatStatePanel`, each already gating multiple older attribute-bonus families),
   *  Resolution only has this one curated candidate so far, so it follows the newer "only surfaced
   *  when a curated trait for it is actually chosen" pattern instead — same as `celestialAvatarActive`/
   *  `invokingHarmonyActive`. */
  resolutionActive: boolean
  /** Manual count of how many boons are currently active on the player — gates `PER_BOON_DAMAGE_
   *  TRAIT_BONUSES` (currently Guardian/Virtues' Inspired Virtue and Warrior/Tactics' Empowered).
   *  This app has no general "which boons are up" tracking (see `regenerationActive`'s doc comment
   *  — even the boons that DO have dedicated fields are one boolean each, not a shared count), so —
   *  same reasoning as `upkeepPoints` sidestepping Revenant's untracked upkeep-cost data — this is a
   *  raw manual entry rather than an auto-derived count. Only surfaced when a curated per-boon-damage
   *  trait is actually chosen, same gating as `upkeepPoints`/`celestialAvatarActive`. No fixed real
   *  max (a full boon bar is commonly 8-10+ boons in a support-heavy WvW squad), so — like
   *  `upkeepPoints` — this is a raw number input, not a dropdown. */
  activeBoonCount: number
  /** Gates `SWIFTNESS_DAMAGE_TRAIT_BONUSES` (currently just Warrior/Discipline's Warrior's Sprint)
   *  — a real boon state, not a build choice, same "assume the condition is currently true" shape
   *  as `furyActive`/`resolutionActive`. Only one curated candidate so far, so it follows the newer
   *  "only surfaced when a curated trait for it is actually chosen" pattern — same as
   *  `resolutionActive`/`celestialAvatarActive`. */
  swiftnessActive: boolean
  /** Gates `STABILITY_DAMAGE_TRAIT_BONUSES` (currently just Warrior/Defense's Stalwart Strength) —
   *  same shape/reasoning as `swiftnessActive` above, one boon, one curated candidate so far. */
  stabilityActive: boolean
  /** Gates `AEGIS_DAMAGE_TRAIT_BONUSES` (currently just Guardian/Virtues' Unscathed Contender) —
   *  same shape/reasoning as `swiftnessActive`/`stabilityActive` above. */
  aegisActive: boolean
  /** Gates `VIGOR_DAMAGE_TRAIT_BONUSES` (currently just Engineer/Tools' Excessive Energy) — a real
   *  boon state, not a build choice, same shape/reasoning as `swiftnessActive`/`stabilityActive`/
   *  `aegisActive` above (one boon, one curated candidate so far, "off by default"). */
  vigorActive: boolean
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
  deathsCarapaceStacks: 0,
  upkeepPoints: 0,
  celestialAvatarActive: false,
  invokingHarmonyActive: false,
  nightActive: false,
  resolutionActive: false,
  activeBoonCount: 0,
  swiftnessActive: false,
  stabilityActive: false,
  aegisActive: false,
  vigorActive: false
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
  /** Righteous Rebel's own outgoing-healing-to-others bonus while Kalla's Fervor is active — unlike
   *  the 3 fields above (which scale *per stack*), this is a flat value applied once whenever
   *  `CombatState.kallaFervorStacks > 0`, not multiplied by the stack count (user-caught 2026-08-22:
   *  the wiki's "Kalla's Fervor increases your healing to other allies" fact carries no "per stack"
   *  language the way Kalla's Fervor's own strike/condition/life-steal shares do — the raw API fact
   *  is a single flat 4%, same regardless of whether 1 or 5 stacks are up). 0 unless Righteous Rebel
   *  itself (`RIGHTEOUS_REBEL_TRAIT_ID`) is chosen, since (unlike the baseline strike/condition/
   *  life-steal shares, which Kalla's Fervor grants regardless of which GM trait is picked)
   *  healing-to-others is Righteous Rebel's *own* effect on the buff, not part of Kalla's Fervor's
   *  own baseline. Not affected by Lasting Legacy's upgrade (a different GM-tier pick in the same
   *  line — wiki gives no evidence the two interact). See `resolveOutgoingHealingPercent`'s own use
   *  of this field for the flat (not `stacks *`) application. */
  outgoingHealing: number
  /** Whether Lasting Legacy's upgraded per-stack values are the ones being returned — surfaced so
   *  `CombatStatePanel` can label its stepper accordingly. */
  improved: boolean
}

/** Renegade/Grandmaster major trait "Righteous Rebel" (id 2182) — wiki-verified via raw wikitext
 *  2026-08-22: "Kalla's Fervor increases your healing to other allies" — a flat 4% Healing Increase
 *  to Others while Kalla's Fervor is active (i.e. at least 1 stack), no game-mode split, and no
 *  per-stack scaling (corrected 2026-08-22 — see `KallaFervorPercentPerStack.outgoingHealing`'s doc
 *  comment; originally miscoded as `stacks * 4`, matching the 3 sibling fields' shape instead of
 *  this one's genuinely different, flat one). Mutually exclusive with Lasting Legacy (same GM tier,
 *  same Renegade line), so a build never has both — `kallaFervorPercentPerStack` gates this
 *  independently of the `improved` flag regardless. */
export const RIGHTEOUS_REBEL_TRAIT_ID = 2182
export const RIGHTEOUS_REBEL_HEALING_PERCENT = 4

/** Resolves Kalla's Fervor's actual per-stack %-per-stat, upgraded by Lasting Legacy when it's
 *  chosen — mirrors `mightStackAttributeTraitBonus`'s "check `activeTraitIds` once" convention, but
 *  a straight override rather than an additive bonus (Lasting Legacy replaces the base 2%/2%/2%
 *  with 3%/3%/3%, it doesn't stack on top of it). */
export function kallaFervorPercentPerStack(build: Build, traitsById: Map<number, Trait>): KallaFervorPercentPerStack {
  const active = activeTraitIds(build, traitsById)
  const improved = active.has(LASTING_LEGACY_TRAIT_ID)
  const outgoingHealing = active.has(RIGHTEOUS_REBEL_TRAIT_ID) ? RIGHTEOUS_REBEL_HEALING_PERCENT : 0
  return improved
    ? {
        strikeDamage: KALLA_FERVOR_IMPROVED_STRIKE_DAMAGE_PERCENT_PER_STACK,
        conditionDamage: KALLA_FERVOR_IMPROVED_CONDITION_DAMAGE_PERCENT_PER_STACK,
        lifeSteal: KALLA_FERVOR_IMPROVED_LIFE_STEAL_PERCENT_PER_STACK,
        outgoingHealing,
        improved: true
      }
    : {
        strikeDamage: KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK,
        conditionDamage: KALLA_FERVOR_CONDITION_DAMAGE_PERCENT_PER_STACK,
        lifeSteal: KALLA_FERVOR_LIFE_STEAL_PERCENT_PER_STACK,
        outgoingHealing,
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

/**
 * Revenant/Herald's Rising Momentum (Adept Major, id 1716) — "Gain increased movement speed for
 * each point of upkeep currently in use." Wiki-verified via raw wikitext
 * (wiki.guildwars2.com/index.php?title=Rising_Momentum&action=raw) 2026-08-20:
 * `{{skill fact|effect|Rising Momentum (effect)|desc=+5% Movement Speed}}` per point of upkeep, no
 * PvE/WvW/PvP split (confirmed against the live rendered page too — no version-history entry ever
 * introduced one). "Points of upkeep" itself is a wiki-documented Revenant mechanic, not this
 * trait's own invention: every upkeep skill (Facets, Impossible Odds, Protective Solace, Vengeful
 * Hammers, Embrace the Darkness, Soulcleave's Summit, Urn of Saint Viktor, ...) lists its own point
 * cost, and Rising Momentum's bonus scales with the *sum* of whichever of those the player
 * currently has toggled on — see `CombatState.upkeepPoints`'s doc comment for why that sum is a
 * manual entry here rather than derived from equipped skills. First trait in this file whose
 * bonus targets movement speed rather than an attribute/crit-chance/%-damage stat — `DerivedStats.
 * movementSpeedPercent` is its own new, first-of-its-kind field for that reason.
 */
export const RISING_MOMENTUM_TRAIT_ID = 1716
export const RISING_MOMENTUM_MOVEMENT_SPEED_PERCENT_PER_UPKEEP_POINT = 5

/**
 * Resolves Rising Momentum's movement-speed bonus for the given `upkeepPoints` count — 0 unless
 * the trait is actually chosen (mirrors `fullEnduranceCritChanceTraitBonus`'s single-trait gating
 * shape), then a flat multiple of `upkeepPoints` with no threshold or cap of its own.
 */
export function risingMomentumMovementSpeedPercent(build: Build, upkeepPoints: number, traitsById: Map<number, Trait>): number {
  if (!activeTraitIds(build, traitsById).has(RISING_MOMENTUM_TRAIT_ID)) return 0
  return upkeepPoints * RISING_MOMENTUM_MOVEMENT_SPEED_PERCENT_PER_UPKEEP_POINT
}

/**
 * Movement speed does NOT stack additively across sources the way every other %-bonus in this
 * file does — wiki-confirmed on Relic of the Wayfinder ("this Relic does not stack with other
 * increases and only the highest value is used") and independently on Rising Momentum's own page
 * ("Stacks additively with your highest other movement speed-increasing effect" — the explicit
 * exception that proves the general "highest value wins" rule). So every source below (found via a
 * full `traits.json`/`runes.json`/`relic-effects.json` scan for "Movement Speed Increase"/"Movement
 * Speed" 2026-08-20, deliberately scoped to steady-state build bonuses only — skill-cast/signet/
 * stance effects like Mist Form, Signet of the Locust, or Impossible Odds' own +50%-while-active
 * are transient procs, out of scope, same "not a character stat gain" reasoning already applied to
 * Reaper's Onslaught's Quickness grant; Pet's Prowess affects the pet's speed, not the player's;
 * Relic of the Necromancer slows the *target*, not the wearer) competes for one "highest value
 * wins" slot rather than adding together — `resolveMovementSpeedPercent` below is the only function
 * that combines them, and Rising Momentum above is the only one that adds on top instead of
 * competing.
 */

/** Trait id -> flat movement-speed-% granted unconditionally, once the (Minor, always-active once
 *  its line is equipped) trait itself is on the build. All 3 wiki-verified via raw wikitext
 *  (`?action=raw`) 2026-08-20, no game-mode split on any:
 *  - Time Marches On (wiki.guildwars2.com/wiki/Time_Marches_On, Mesmer/Chronomancer, Minor, id
 *    1859): "You move 25% faster" (its Alacrity-strength clause is separate, out of scope).
 *  - Righteous Sprint (wiki.guildwars2.com/wiki/Righteous_Sprint, Guardian/Willbender, Minor, id
 *    2222): "Gain increased movement speed" — a separate sentence from its own Swiftness-on-
 *    virtue-cast clause (a boon proc, not this trait's own flat %).
 *  - Jetstream (wiki.guildwars2.com/wiki/Jetstream, Ranger/Galeshot, Minor, id 2341): "Your base
 *    movement speed is increased" — separate from its own Superspeed-on-Hawkeye clause (out of
 *    scope as a proc, same reasoning). */
export const FLAT_MOVEMENT_SPEED_TRAIT_BONUSES: Record<number, number> = {
  1859: 25, // Time Marches On (Mesmer, Chronomancer, Minor)
  2222: 25, // Righteous Sprint (Guardian, Willbender, Minor)
  2341: 25 // Jetstream (Ranger, Galeshot, Minor)
}

/** Trait id -> movement-speed-% gated on a specific attunement — Zephyr's Speed (Elementalist/Air,
 *  Minor, id 221): "While attuned to air, your movement speed is also increased" (its own
 *  unconditional +5% crit-chance half is separately curated in `FLAT_CRIT_CHANCE_TRAIT_BONUSES`).
 *  Wiki-verified via raw wikitext 2026-08-20, no game-mode split. Reuses `Build.activeAttunement`
 *  directly, same reuse `MIGHT_THRESHOLD_ATTUNEMENT_DOUBLED_ATTRIBUTE_TRAIT_BONUSES` above already
 *  documents — no new state needed. */
export const ATTUNEMENT_MOVEMENT_SPEED_TRAIT_BONUSES: Record<number, { percent: number; attunement: 'Fire' | 'Water' | 'Air' | 'Earth' }> = {
  221: { percent: 25, attunement: 'Air' } // Zephyr's Speed (Elementalist, Air, Minor)
}

/** Trait id -> movement-speed-% gated on Fury being up — Furious Focus (Guardian/Zeal, Major, id
 *  2017): "Your strike damage and movement speed are increased while you have fury" (its Damage
 *  Increase half is a separate fact, out of scope here). Wiki-verified via raw wikitext 2026-08-20,
 *  no game-mode split. Reuses `CombatState.furyActive`. */
export const FURY_MOVEMENT_SPEED_TRAIT_BONUSES: Record<number, number> = {
  2017: 33 // Furious Focus (Guardian, Zeal, Major)
}

/** Trait id -> movement-speed-% gated on Quickness being up — Aggressive Onslaught (Warrior/
 *  Strength, Major, id 1440): "While you have quickness, your movement speed is increased" (its
 *  own Quickness-on-disable proc and Might grant are separate facts, out of scope here).
 *  Wiki-verified via raw wikitext 2026-08-20, no game-mode split. Reuses
 *  `CombatState.quicknessActive`. */
export const QUICKNESS_MOVEMENT_SPEED_TRAIT_BONUSES: Record<number, number> = {
  1440: 33 // Aggressive Onslaught (Warrior, Strength, Major)
}

/** Trait id -> movement-speed-% gated on wielding a melee weapon — Warrior's Sprint (Warrior/
 *  Discipline, Major, id 1413): "Run faster while wielding melee weapons" (its Swiftness-strike-
 *  damage clause and Immobile-break clause are separate facts, out of scope here). Wiki-verified
 *  via raw wikitext + the live page's own Notes section 2026-08-20: no game-mode split, and —
 *  since this is a Warrior-only trait — only the subset of the wiki's generic "melee weapon" list
 *  Warrior can actually wield matters (the wiki's list also includes Pistol/Staff for other
 *  professions' equivalent checks, but neither ever appears on a Warrior build, so both are
 *  harmlessly included below rather than hand-trimmed). Reuses `activeWeaponTypes` (exported from
 *  `trait-attributes.ts` for this purpose), the same "either hand, active set only" gating
 *  `WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES` already uses. */
export const MELEE_WEAPON_MOVEMENT_SPEED_TRAIT_BONUSES: Record<number, { percent: number; weaponTypes: string[] }> = {
  1413: {
    percent: 25,
    weaponTypes: ['Axe', 'Dagger', 'Mace', 'Sword', 'Pistol', 'Shield', 'Torch', 'Warhorn', 'Greatsword', 'Hammer', 'Staff', 'Spear']
  } // Warrior's Sprint (Warrior, Discipline, Major)
}

/** Relic id -> movement-speed-% granted while `CombatState.relicActive` is on — the same generic
 *  "assume the relic's own condition/proc is currently satisfied" toggle `CURATED_RELIC_DAMAGE_
 *  BONUSES` already uses (`CombatStatePanel` surfaces one shared icon for whichever curated table
 *  the equipped relic appears in, gated on membership in either table). Relic of the Wayfinder
 *  (101943) wiki-verified via raw wikitext 2026-08-20: "Gain increased movement speed" is a flat,
 *  always-on +25% while in combat (33% out-of-combat, not modeled — this app has no in/out-of-
 *  combat state anywhere, and WvW play is the assumed context per
 *  `gw2squaded-claude-code-prompt.md`), no game-mode split. The relic's own combat-entry Superspeed
 *  burst is a transient proc, out of scope per this section's own doc comment. */
export const CURATED_RELIC_MOVEMENT_SPEED_BONUSES: Record<number, number> = {
  101943: 25 // Relic of the Wayfinder
}

/**
 * Resolves the single "highest value wins" movement-speed-% slot from every curated non-additive
 * source above, plus Rising Momentum's own additive contribution on top (see this section's own
 * doc comment for why Rising Momentum alone gets to add rather than compete). `gearMovementSpeedPercent`
 * is `AttributeTotals.bonusPercent.movementSpeed` (the rune-derived contribution — resolved in
 * `attribute-totals.ts` since it flows through that module's generic bonus pipeline, unlike every
 * trait/relic family here) — passed in rather than recomputed here, since this function has no
 * gear access of its own.
 */
export function resolveMovementSpeedPercent(
  build: Build,
  combatState: CombatState,
  gearMovementSpeedPercent: number,
  traitsById: Map<number, Trait>
): number {
  const active = activeTraitIds(build, traitsById)
  const candidates = [gearMovementSpeedPercent]

  for (const [traitIdText, percent] of Object.entries(FLAT_MOVEMENT_SPEED_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) candidates.push(percent)
  }
  for (const [traitIdText, { percent, attunement }] of Object.entries(ATTUNEMENT_MOVEMENT_SPEED_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText)) && build.activeAttunement === attunement) candidates.push(percent)
  }
  if (combatState.furyActive) {
    for (const [traitIdText, percent] of Object.entries(FURY_MOVEMENT_SPEED_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) candidates.push(percent)
    }
  }
  if (combatState.quicknessActive) {
    for (const [traitIdText, percent] of Object.entries(QUICKNESS_MOVEMENT_SPEED_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) candidates.push(percent)
    }
  }
  const equippedWeaponTypes = activeWeaponTypes(build)
  for (const [traitIdText, { percent, weaponTypes }] of Object.entries(MELEE_WEAPON_MOVEMENT_SPEED_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText)) && weaponTypes.some((w) => equippedWeaponTypes.has(w))) candidates.push(percent)
  }
  if (combatState.relicActive && build.relicId !== null) {
    const relicBonus = CURATED_RELIC_MOVEMENT_SPEED_BONUSES[build.relicId]
    if (relicBonus !== undefined) candidates.push(relicBonus)
  }

  return Math.max(...candidates) + risingMomentumMovementSpeedPercent(build, combatState.upkeepPoints, traitsById)
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
/** Sentinel `STACKING_SIGILS` attribute for Superior Sigil of Benevolence — its per-kill charge
 *  grants outgoing-healing-%-to-others, not a core `AttributeTotals` point, so `combatStatePoints`
 *  below deliberately skips adding it there; `stackingSigilOutgoingHealingPercent` reads it
 *  directly instead. Mirrors `ALL_STATS`'s role as a non-literal-attribute marker. */
const OUTGOING_HEALING_PERCENT = 'OutgoingHealingPercent' as const

/**
 * The 8 sigils whose description matches "Gain a charge of +X <attribute> each time you kill a
 * foe... Max 25 stacks" — confirmed exhaustive via a full scan of data/game-data/sigils.json,
 * these are the only sigils with that text. Attribute keys match the `ItemStat`/API convention
 * used throughout gear-calc (see attribute-totals.ts), except `AllStats`, a sentinel this module
 * expands to all 9 core attributes (Superior Sigil of the Stars' "+2 to all stats" wording).
 */
export const STACKING_SIGILS: Record<number, { name: string; attribute: string | typeof ALL_STATS | typeof OUTGOING_HEALING_PERCENT; perStack: number }> = {
  24575: { name: 'Superior Sigil of Bloodlust', attribute: 'Power', perStack: 10 },
  24578: { name: 'Superior Sigil of Corruption', attribute: 'ConditionDamage', perStack: 10 },
  24580: { name: 'Superior Sigil of Perception', attribute: 'Precision', perStack: 10 },
  24582: { name: 'Superior Sigil of Life', attribute: 'Healing', perStack: 10 },
  49457: { name: 'Superior Sigil of Momentum', attribute: 'Toughness', perStack: 5 },
  67341: { name: 'Superior Sigil of Cruelty', attribute: 'CritDamage', perStack: 10 },
  81045: { name: 'Superior Sigil of Bounty', attribute: 'BoonDuration', perStack: 9 },
  86170: { name: 'Superior Sigil of the Stars', attribute: ALL_STATS, perStack: 2 },
  // Superior Sigil of Benevolence — wiki-verified 2026-08-22: "Gain a charge that grants 0.5%
  // outgoing healing effectiveness toward other allies each time you kill a foe, five if you kill
  // an enemy player. (Max 25 stacks; ends on down.) (Only one attribute-stacking sigil can be
  // active at a time.)" — that last clause is the same mutual-exclusivity rule the other 8 entries
  // here already share, confirming this belongs in the same family/field despite its payout being
  // a %-effectiveness rather than a core attribute (see `OUTGOING_HEALING_PERCENT`'s doc comment).
  24584: { name: 'Superior Sigil of Benevolence', attribute: OUTGOING_HEALING_PERCENT, perStack: 0.5 }
}

/**
 * Relic ids whose full proc is a flat outgoing-strike-damage-% bonus while active, gated on
 * `CombatState.relicActive` (the same "assume the relic's own proc/trigger condition is currently
 * satisfied" simplification `CURATED_RELIC_OUTGOING_HEALING_BONUSES` already uses for Relic of the
 * Monk/Castora) — hand-curated from data/game-data/relic-effects.json's "Damage Increase" facts,
 * one manual wiki-verification pass per relic (same process as `wvwFactOverrides`, see
 * docs/game-data.md). Every entry's trigger is a player-controlled action (evade, trap hit,
 * shadowstep/deception, stance use, granting self Protection/Resolution, weapon-skill-with-recharge
 * hit, cantrip use, disable a foe, heal-skill use, blast-finisher-into-combo-field) except Relic of
 * the Eagle (target-health-threshold-gated, same "assume satisfied" simplification already applied
 * to Castora's own ally-health-threshold condition), so the same blanket toggle covers all of them.
 * All 13 below plus Fireworks wiki-verified via raw wikitext 2026-08-22 — no other "Damage
 * Increase"-tagged relic exists in relic-effects.json (14 total hits including Fireworks, confirmed
 * exhaustive via a full scan). Both Fireworks ids are "Relic of Fireworks" — relics.json lists the
 * same relic twice under different ids — so either pick in the equipment editor is recognized.
 */
export const CURATED_RELIC_DAMAGE_BONUSES: Record<number, number> = {
  100262: 7, // Relic of Fireworks
  100947: 7, // Relic of Fireworks (duplicate relics.json id, identical effect)
  99997: 10, // Relic of Isgarren — after evading, +10% strike damage to the marked target for 6s
  100090: 10, // Relic of the Dragonhunter — trap-hit target hunted, +10% strike damage for 5s
  100177: 10, // Relic of Peitha — after shadowstep/deception skill, +10% strike damage to marked target for 4s
  100194: 10, // Relic of the Weaver — after a stance skill, +10% strike damage for 4s
  100527: 10, // Relic of the Brawler — after granting self Protection/Resolution, +10% strike damage
  100916: 5, // Relic of the Thief — +1% strike damage per stack (max 5) on weapon-skill-with-recharge hits; modeled at its max, same simplification as Relic of the Monk's stacking heal
  100924: 10, // Relic of the Deadeye — after a cantrip skill, +10% strike damage for a duration
  101191: 15, // Relic of Nourys — "Nourys's Hunger" 10-stack payout, WvW/PvP value (25% PvE); its Condition Damage/incoming-damage/healing-conversion lines are separate stats, see `CURATED_RELIC_CONDITION_DAMAGE_BONUSES`
  103574: 7, // Relic of the Claw — after disabling a foe, +7% strike damage for a duration
  104241: 10, // Relic of the Eagle — +10% strike damage to enemies below a 50% health threshold
  104501: 10, // Relic of Fire — Fire Aura from a heal skill grants +10% outgoing strike damage (WvW/PvP value, PvE is 7%)
  104800: 10, // Relic of Bloodstone — "Bloodstone Fervor" window from a combo-field blast, +10% strike damage (WvW/PvP value, PvE is 7%)
  109351: 10 // Relic of the Director — after a heal skill, +10% strike damage to vulnerable foes for a duration
}

/**
 * Relic id -> flat outgoing-condition-damage-% bonus while `CombatState.relicActive` is on — first/
 * only entry so far is Relic of Nourys's "Nourys's Hunger" payout (see `CURATED_RELIC_DAMAGE_
 * BONUSES` above for its strike-damage half and the rest of its 6-stat combo line, out of scope
 * here): wiki-verified 2026-08-22, "+15% Condition Damage" alongside the "+15% Damage" line, same
 * WvW/PvP value (25% PvE).
 */
export const CURATED_RELIC_CONDITION_DAMAGE_BONUSES: Record<number, number> = {
  101191: 15 // Relic of Nourys — WvW/PvP value
}

/** Superior Sigil of Force (24615) — wiki-verified 2026-08-21 (see TODO.md): flat +5% outgoing
 *  strike damage, but explicitly "Does not stack if used on both main hand and off hand weapons" —
 *  unlike every other passive/stat sigil bonus in this file (which doubles per equipped slot, see
 *  `CURATED_SIGIL_OUTGOING_HEALING_BONUSES`), so it's kept out of `CURATED_SIGIL_DAMAGE_BONUSES`
 *  and applied at most once regardless of slot count — see `curatedSigilDamagePercent` below. Also
 *  wiki-confirmed "Does not affect Condition Damage and Life stealing," which needs no special
 *  handling here since this app already tracks strike/condition damage as separate `DerivedStats`
 *  fields and has no life-steal-%-from-sigils source anywhere. */
export const SIGIL_OF_FORCE_ID = 24615
export const SIGIL_OF_FORCE_DAMAGE_PERCENT = 5

/** Superior Sigil of the Night (36053) — wiki-verified 2026-08-22: "Outgoing damage is increased by
 *  3% with an additional 7% at night" (10% total during the night stage, 3% otherwise), explicitly
 *  "does not increase condition damage." The always-on 3% share lives in `CURATED_SIGIL_DAMAGE_
 *  BONUSES` below (so it doubles per slot like every other unconditional sigil bonus); the
 *  conditional +7% is added separately here, gated on `CombatState.nightActive`, and doubles per
 *  slot the same way (no "does not stack" clause found for this sigil, unlike Sigil of Force). */
export const SIGIL_OF_THE_NIGHT_ID = 36053
export const SIGIL_OF_THE_NIGHT_BASE_DAMAGE_PERCENT = 3
export const SIGIL_OF_THE_NIGHT_ADDITIONAL_NIGHT_DAMAGE_PERCENT = 7

/**
 * Sigil id -> flat outgoing-strike-damage-% bonus while equipped on the active weapon set, doubling
 * per equipped slot like every other passive/stat sigil (see `CURATED_SIGIL_OUTGOING_HEALING_
 * BONUSES`) — excludes Superior Sigil of Force (handled separately above, since it does NOT
 * double). The 18 "Slaying" sigils and Superior Sigil of Impact each carry a second, genuinely
 * unconditional "+3% Strike Damage" line alongside their own +7%-vs-monster-type/vs-Stunned-or-
 * Knocked-Down conditional line (wiki-verified 2026-08-22 against Superior Sigil of Undead Slaying's
 * raw wikitext infobox, confirmed a real second bonus, not a display artifact of the conditional
 * one) — only that unconditional +3% baseline is curated here; the conditional halves are excluded
 * as too situational to assume steady-state (WvW has none of the "Slaying" sigils' target monster
 * types per TODO.md's original scoping note, and Impact's Stunned-or-Knocked-Down condition is a
 * target combat-state this app doesn't track). Sigil of the Night's own always-on 3% share (see its
 * doc comment above) is folded in here too since it follows the same per-slot-doubling rule.
 */
export const CURATED_SIGIL_DAMAGE_BONUSES: Record<number, number> = {
  24642: 3, // Superior Sigil of Undead Slaying
  24645: 3, // Superior Sigil of Centaur Slaying
  24648: 3, // Superior Sigil of Grawl Slaying
  24651: 3, // Superior Sigil of Icebrood Slaying
  24654: 3, // Superior Sigil of Destroyer Slaying
  24655: 3, // Superior Sigil of Ogre Slaying
  24658: 3, // Superior Sigil of Serpent Slaying
  24661: 3, // Superior Sigil of Elemental Slaying
  24664: 3, // Superior Sigil of Demon Slaying
  24667: 3, // Superior Sigil of Wrath
  24672: 3, // Superior Sigil of Mad Scientists
  24675: 3, // Superior Sigil of Smothering
  24678: 3, // Superior Sigil of Justice
  24681: 3, // Superior Sigil of Dreams
  24684: 3, // Superior Sigil of Sorrow
  24809: 3, // Superior Sigil of Ghost Slaying
  37912: 3, // Superior Sigil of Karka Slaying
  91339: 3, // Superior Sigil of Hologram Slaying
  24868: 3, // Superior Sigil of Impact — unconditional baseline only, see doc comment above
  36053: SIGIL_OF_THE_NIGHT_BASE_DAMAGE_PERCENT // Superior Sigil of the Night — always-on share
}

function curatedSigilDamagePercent(build: Build, combatState: CombatState): number {
  let total = 0
  let forceEquipped = false
  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    if (!isActiveWeaponSlot(slotKey, build)) continue
    for (const sigilId of build.equipment[slotKey]?.sigilIds ?? []) {
      if (sigilId === null) continue
      if (sigilId === SIGIL_OF_FORCE_ID) {
        forceEquipped = true
        continue
      }
      total += CURATED_SIGIL_DAMAGE_BONUSES[sigilId] ?? 0
      if (sigilId === SIGIL_OF_THE_NIGHT_ID && combatState.nightActive) total += SIGIL_OF_THE_NIGHT_ADDITIONAL_NIGHT_DAMAGE_PERCENT
    }
  }
  if (forceEquipped) total += SIGIL_OF_FORCE_DAMAGE_PERCENT
  return total
}

/** True while Sigil of the Night is equipped on the active weapon set — gates `CombatStatePanel`'s
 *  night toggle, same "only surfaced when relevant" pattern every other conditional combat-state
 *  control here uses. */
export function hasSigilOfTheNightEquipped(build: Build): boolean {
  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    if (!isActiveWeaponSlot(slotKey, build)) continue
    for (const sigilId of build.equipment[slotKey]?.sigilIds ?? []) {
      if (sigilId === SIGIL_OF_THE_NIGHT_ID) return true
    }
  }
  return false
}

/** Superior Sigil of Bursting (44944) — wiki-verified 2026-08-22: "+5% Condition Damage," and per
 *  the page's own Notes section, "a flat increase of outgoing condition damage" (not the raw
 *  `ConditionDamage` attribute) since a 2018-11-13 rework — belongs in `outgoingConditionDamagePercent`,
 *  not the core attribute totals. No "does not stack" clause found, so it doubles per equipped slot
 *  like every other unconditional sigil bonus. */
export const CURATED_SIGIL_CONDITION_DAMAGE_BONUSES: Record<number, number> = {
  44944: 5 // Superior Sigil of Bursting
}

function curatedSigilConditionDamagePercent(build: Build): number {
  let total = 0
  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    if (!isActiveWeaponSlot(slotKey, build)) continue
    for (const sigilId of build.equipment[slotKey]?.sigilIds ?? []) {
      if (sigilId === null) continue
      total += CURATED_SIGIL_CONDITION_DAMAGE_BONUSES[sigilId] ?? 0
    }
  }
  return total
}

/**
 * "Outgoing Damage % full pass" Traits leg (TODO.md, started 2026-08-22) — Guardian, 1st
 * profession leg. Of Guardian's 9 unique candidate traits (raw `traits.json` scan for "Damage
 * Increase"/"Strike Damage Increase"/"Condition Damage Increase" Percent facts), only the 3 below
 * are curated; the rest were excluded after wiki-verification:
 * - Fiery Wrath (634, vs. burning foes), Symbolic Exposure (646, vs. vulnerable foes), Zealot's
 *   Aggression (1835, vs. crippled foes) — all target-condition-gated, same "target monster-type/
 *   CC-state this app doesn't track" exclusion the Slaying-sigil conditional halves already used
 *   (see `CURATED_SIGIL_DAMAGE_BONUSES`'s own doc comment).
 * - Big Game Hunter (1955, vs. foes tethered by Spear of Justice) and Power for Power (2190, only
 *   on "Willbender Flames" hits) — narrower still, gated on a specific skill's own proc/tether
 *   state rather than a general boon/CC condition, no existing `CombatState` field fits.
 * - Amplified Wrath (1686) — wiki-verified as "condition damage increase," not general damage,
 *   AND scoped to burning specifically, not condition damage broadly (unlike Sigil of Bursting's
 *   blanket +5%) — this app has no per-condition-type damage-%% field (only the one blanket
 *   `outgoingConditionDamagePercent`), so folding it in would overstate non-burning condition
 *   builds. Logged in TODO.md as needing new per-condition-type infra.
 * - Tyrant's Momentum (2201) — modifies Willbender's own "Lethal Tempo" stacking self-buff (up to
 *   5 stacks, gained from Virtue-skill use, with its own duration-reduction clause); no
 *   `CombatState` field tracks Lethal Tempo stacks and building one is out of scope for a single
 *   trait. Logged in TODO.md as needing dedicated stacking-buff modeling, same shape as Kalla's
 *   Fervor/Death's Carapace got their own dedicated fields for.
 *
 * Guardian catch-up (found while scanning the Warrior leg below): Unscathed Contender (624,
 * Guardian/Virtues, Adept Major) was missed by the original Guardian leg's own scan — it genuinely
 * belongs in this sweep and is curated below (`AEGIS_DAMAGE_TRAIT_BONUSES`/
 * `HIGH_HEALTH_DAMAGE_TRAIT_BONUSES`).
 *
 * Warrior leg (Session 280, 2026-08-22): 11 unique candidates. 5 curated below (`SWIFTNESS_DAMAGE_
 * TRAIT_BONUSES`, `FLAT_DAMAGE_TRAIT_BONUSES`, `PER_BOON_DAMAGE_TRAIT_BONUSES`'s new Warrior entry,
 * `STABILITY_DAMAGE_TRAIT_BONUSES`, `MECHANIC_ACTIVE_DAMAGE_TRAIT_BONUSES`'s new Warrior entry); 6
 * excluded after wiki-verification:
 * - Merciless Hammer (1367, vs. disabled/defiant foes), Cull the Weak (1372, vs. weakened foes),
 *   Leg Specialist (1469, vs. chilled/crippled/immobile foes) — all target-condition-gated, same
 *   exclusion class as the Guardian leg's Fiery Wrath/Symbolic Exposure/Zealot's Aggression.
 * - Warrior's Cunning (1486) — two separate target-condition-gated halves (vs. high-health foes,
 *   vs. foes with barrier), same exclusion class, just two conditions on one trait instead of one.
 * - Destruction of the Empowered (1489) — "per boon on your target," not on self (unlike Empowered/
 *   Inspired Virtue's own-boon-count halves) — this app has no tracked "target's boon count" field,
 *   only `activeBoonCount` for the player's own boons, so folding it into `PER_BOON_DAMAGE_TRAIT_
 *   BONUSES` would silently read the wrong count. No existing infra fits; not worth building for a
 *   single trait.
 * - Burst Mastery (1657) — "Burst skills deal more damage," scoped to one skill category rather
 *   than general outgoing strike damage (unlike Furious Focus/Retribution's blanket application) —
 *   same "narrower skill-specific proc" exclusion class as the Guardian leg's Big Game Hunter/Power
 *   for Power.
 *
 * Elementalist leg (Session 281, 2026-08-22): 8 unique candidates. 1 curated below (`HIGH_HEALTH_
 * DAMAGE_TRAIT_BONUSES`'s new Flow like Water entry); 7 excluded after wiki-verification:
 * - Bolt to the Heart (226, vs. low-health foes), Pyromancer's Training (319, vs. burning foes),
 *   Piercing Shards (363, vs. vulnerable foes — doubled while attuned to water, still target-
 *   condition-gated regardless), Stormsoul (1502, vs. disabled/defiant foes), Serrated Stones
 *   (1507, vs. bleeding foes), Fiery Might (2391, vs. burning foes) — all target-condition-gated,
 *   same exclusion class as every prior leg's Fiery Wrath/Cull the Weak/etc.
 * - Electric Discharge (222) — its "Damage Increase" match is actually a "Critical damage increase"
 *   fact (100%) on the trait's own on-attunement-swap proc hit (a `skill fact|damage|coefficient`
 *   strike, not a persistent character stat), not a general outgoing-damage-% bonus — same
 *   "narrower skill-specific proc" exclusion class as Big Game Hunter/Power for Power/Burst Mastery.
 *
 * Engineer leg (Session 282, 2026-08-22): 10 unique candidates. 3 curated below (`NOT_FULL_
 * ENDURANCE_DAMAGE_TRAIT_BONUSES`'s Takedown Round entry, `HIGH_HEALTH_DAMAGE_TRAIT_BONUSES`'s new
 * Glass Cannon entry, `VIGOR_DAMAGE_TRAIT_BONUSES`'s new Excessive Energy entry — the last needing a
 * brand-new `CombatState.vigorActive` field, same shape as `swiftnessActive`/`stabilityActive`/
 * `aegisActive`); 7 excluded after wiki-verification:
 * - Shaped Charge (429, per stack of vulnerability on target) and Modified Ammunition (516, per
 *   unique condition on a foe) — both scale off the *target's* own status-stack count, not self;
 *   this app has no tracked "target's condition/boon stack count" field, same class of gap as the
 *   Warrior leg's Destruction of the Empowered (target's boon count) — new shared gap-shape,
 *   "target-status-stack-count damage-%%," logged in TODO.md rather than built for two traits.
 * - Object in Motion (1860) — gated on having at least one of Stability/Swiftness/Superspeed, then
 *   "compounds for each boon you have" (i.e. scales by *total* boon count once that gate is met,
 *   wiki-verified `{{skill fact|damage increase|alt=Damage per Boon|...}}`, PvE/PvP 5%/WvW 3% per
 *   boon). Distinct from `PER_BOON_DAMAGE_TRAIT_BONUSES` (unconditional per-boon scaling, no gate):
 *   this needs a boon-subset presence check (stability/swiftness already have their own booleans,
 *   but superspeed doesn't) ANDed with the existing `activeBoonCount` scaling — a new resolver
 *   shape, not just a new table entry. Not worth building for a single trait; logged in TODO.md as
 *   a new "boon-subset-gated per-boon compounding" gap-shape.
 * - Big Boomer (1947) — "foes with a lower health percentage than you," a target-*relative* health
 *   comparison (not a fixed target-health threshold like Relic of the Eagle's "assume satisfied"
 *   `relicActive` reuse) — no trait-side equivalent toggle exists. Logged in TODO.md; could reuse
 *   the Eagle's "assume the condition is currently true" pattern if a second candidate turns up.
 * - Solar Focusing Lens (2106) — its Damage Increase fact only applies to "your first few attacks
 *   after entering or exiting Photon Forge" (or on overheat), a transient proc window rather than a
 *   steady-state build stat — same "not a character stat gain" exclusion already used for Peak
 *   Performance's other half/Mist Form/Signet of the Locust.
 * - Laser's Edge (2122) — scales continuously with Holosmith's own Heat meter (0-100), which this
 *   app has no `CombatState` field for at all (unlike Kalla's Fervor/Death's Carapace's dedicated
 *   steppers) — a genuinely new "heat-meter-scaling" gap-shape, logged in TODO.md.
 * - Symbiotic Synergy (2406) — "Morph skills deal increased strike damage," scoped to one skill
 *   category rather than general outgoing strike damage — same "narrower skill-specific proc"
 *   exclusion class as Burst Mastery/Big Game Hunter/Power for Power.
 *
 * Mesmer leg (Session 283, 2026-08-22): 14 unique candidates. 2 curated below (`FLAT_DAMAGE_TRAIT_
 * BONUSES`'s new Vicious Expression entry, `VIGOR_DAMAGE_TRAIT_BONUSES`'s new Nomad's Endurance
 * entry, the latter also needing a brand-new `VIGOR_CONDITION_DAMAGE_TRAIT_BONUSES` table since this
 * is the first vigor-gated trait with a condition-damage half); 12 excluded after wiki/description
 * verification:
 * - Mental Anguish (680, Shatter skills only), Infinite Forge (2206, Blade attacks only) — scoped to
 *   one skill category, same "narrower skill-specific proc"/"per-skill-category" exclusion class as
 *   Burst Mastery/Symbiotic Synergy.
 * - Time Catches Up (1995) — both a skill-category gate (Shatters only) AND a target-condition gate
 *   (movement-impaired foes), doubly out of scope.
 * - Empowered Illusions (682) — "Illusions deal increased strike damage" boosts the *illusions'* own
 *   damage, not the player's; this app has no tracked "summon/illusion damage" field (only "the
 *   player's own"), same reasoning as the Outgoing Healing % sweep's Spirit's Strength exclusion
 *   (pet-heal boost, not the player's own) — a new sibling to that same "pet/summon output not
 *   modeled" gap-shape family. Contrast with Vicious Expression (681) below, whose "you AND your
 *   illusions" wording covers the player directly too, so its baseline is in scope.
 * - Egotism (713) — "to foes with a lower health percentage than you," a target-*relative* health
 *   comparison, same exclusion class as the Engineer leg's Big Boomer (1947).
 * - Fragility (1941) — "for each stack of vulnerability on your target," a target-status-stack-count
 *   scaling, same exclusion class as Destruction of the Empowered/Shaped Charge/Modified Ammunition.
 * - Time Bomb (1978) — damage bonus only applies to targets carrying the "Time Bomb" debuff applied
 *   by one specific skill (Time Sink), a narrower-skill-specific proc, same exclusion class as Big
 *   Game Hunter/Power for Power/Electric Discharge.
 * - Bloodsong (2223) — "Bleeding you apply deals increased damage," scoped to one condition type
 *   rather than condition damage broadly (this app only has the one blanket `outgoingConditionDamage
 *   Percent` field) — same per-condition-type exclusion class as Guardian's Amplified Wrath.
 * - Shredding (2343) — "the lute's damage bonus is increased," a bonus to one specific skill's own
 *   proc damage (Lively Lute), same narrower-skill-specific-proc exclusion class as Time Bomb.
 * - Mental Focus (2208) — "Strike damage is increased against foes within the range threshold," a
 *   target-*range* gate; no `CombatState` field tracks target range at all (distinct from every
 *   other target-condition gate seen so far, which are status-based not distance-based) — a brand-
 *   new "target-range-gated damage-%%" gap-shape, logged in TODO.md.
 * - Superiority Complex (692), Danger Time (2009) — both are "Critical Damage Increase," a straight
 *   critical-hit-damage multiplier, not the `CritDamage`/Ferocity attribute (already modeled via
 *   `AttributeAdjust`) and not general outgoing strike/condition damage either — this app has no
 *   `DerivedStats` field for a standalone crit-damage-multiplier stat at all, a brand-new gap-shape
 *   logged in TODO.md.
 *
 * Necromancer leg (Session 284, 2026-08-22): 13 unique candidates, only 1 curated (`FLAT_DAMAGE_
 * TRAIT_BONUSES`'s new Spiteful Talisman entry — wiki-verified `split = pve, wvw pvp`, baseline
 * strike damage PvE 3%/WvW+PvP 7%, WvW value used; its own "further increased against foes without
 * boons" +12% WvW half is target-condition-gated, excluded below alongside every other trait sharing
 * that shape). 12 excluded after wiki/description verification:
 * - Close to Death (853, vs. foes below a health threshold), Cold Shoulder (2018, vs. chilled foes)
 *   — target-condition-gated, same exclusion class as every prior leg's Fiery Wrath/Cull the Weak/
 *   Bolt to the Heart/etc. (Close to Death's target is the *foe's* health, distinct from the self-
 *   health-gated `HIGH_HEALTH_DAMAGE_TRAIT_BONUSES` family Unscathed Contender/Flow like Water/Glass
 *   Cannon belong to).
 * - Putrid Defense (857, poison damage specifically), Fell Beacon (2074, burning damage
 *   specifically), Demonic Lore (2164, torment damage specifically) — all scoped to one condition
 *   type rather than condition damage broadly, same per-condition-type exclusion class as Guardian's
 *   Amplified Wrath/Mesmer's Bloodsong.
 * - Necromantic Corruption (858) — "Minions deal more damage," boosts the *minions'* own damage, not
 *   the player's — same "pet/summon output not modeled" gap-shape family as Mesmer's Empowered
 *   Illusions/the Outgoing Healing % sweep's Spirit's Strength.
 * - Death Perception (893), Wicked Corruption (2188, its own Critical Damage Increase half) — both
 *   "Critical Damage Increase," the same standalone crit-hit-damage-multiplier gap-shape as Mesmer's
 *   Superiority Complex/Danger Time (no `DerivedStats` field for it at all).
 * - Soul Barbs (894) — "Entering or exiting shroud increases all damage you deal for a duration"
 *   (wiki-confirmed explicit `Duration` facts, 15s/10s) — a timed proc window triggered by a shroud
 *   transition, not a steady-state build stat, same "not a character stat gain" exclusion already
 *   used for Peak Performance's own further-buff/Engineer's Solar Focusing Lens.
 * - Soul Eater (1969, wiki page since retitled "Soul Devourer") — "Striking foes within the range
 *   threshold," wiki-confirmed a 300-unit distance-to-target gate, not a status condition — joins
 *   Mesmer's Mental Focus in the "target-range-gated damage-%%" gap-shape (no `CombatState` field
 *   tracks distance to target).
 * - Augury of Death (1974) — "Shouts now siphon health," scoped to one skill category (Shouts) and
 *   about life-steal, not general outgoing damage — same "narrower skill-specific proc"/"per-skill-
 *   category" exclusion class as Warrior's Burst Mastery/Mesmer's Mental Anguish.
 * - Septic Corruption (2185), Wicked Corruption (2188, its own Damage Increase half) — both scale
 *   with the player's own stacks of Blight, Harbinger's own resource that this app has no
 *   `CombatState` field for at all (unlike Kalla's Fervor/Death's Carapace's dedicated steppers) —
 *   the same "untracked profession-resource-stack" gap-shape as Engineer's Laser's Edge (Heat meter),
 *   logged in TODO.md as a 2nd member of that family.
 */

/**
 * Trait id -> flat outgoing-strike-damage-% while Fury is active — the "Outgoing Damage % full
 * pass" Traits leg's first family, same shape/gating as
 * `FURY_MOVEMENT_SPEED_TRAIT_BONUSES`/`FURY_CRITICAL_CHANCE_TRAIT_BONUSES` above, reusing
 * `CombatState.furyActive`. Furious Focus (Guardian/Zeal, Grandmaster Major, id 2017) — its
 * Movement Speed half is already curated in `FURY_MOVEMENT_SPEED_TRAIT_BONUSES`, this is its
 * Damage Increase half, split out of that table's own doc comment ("out of scope here"). Wiki-
 * verified via raw wikitext 2026-08-22 (`split = pve, wvw pvp`): PvE 10%, WvW/PvP 7% — WvW value
 * used here.
 */
export const FURY_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  2017: 7 // Furious Focus (Guardian, Zeal, Major)
}

/**
 * Trait id -> flat outgoing-strike-damage-% while Resolution is active — gated on
 * `CombatState.resolutionActive`. Retribution (Guardian/Radiance, Master Major, id 565): "Strike
 * damage dealt is increased while you have resolution." Wiki-verified via raw wikitext
 * (wiki.guildwars2.com/wiki/Retribution_(trait)?action=raw) 2026-08-22: flat 10%, no game-mode
 * split.
 */
export const RESOLUTION_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  565: 10 // Retribution (Guardian, Radiance, Major)
}

/**
 * Trait id -> outgoing-strike-damage-% granted per active boon on self — multiplied by
 * `CombatState.activeBoonCount`. Inspired Virtue (Guardian/Virtues, Adept Minor, id 621): "Deal
 * increased strike damage for each boon on you." Wiki-verified via raw wikitext 2026-08-22:
 * `split = pve, wvw pvp`, PvE 0.5% per boon, PvP/WvW 1% per boon — WvW value used here. The
 * trait's own boon-application facts (Might/Regeneration/Protection on Virtue activation) are
 * separate `PrefixedBuff` facts, already rendered via `boonConditionFactsForTrait`, out of scope
 * for this per-boon-%% table. Empowered (Warrior/Tactics, Master Minor, id 1485), added in the
 * Warrior leg: "Deal increased strike damage for every boon on you" — wiki-verified via raw
 * wikitext 2026-08-22, flat 1% per boon, no game-mode split.
 */
export const PER_BOON_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  621: 1, // Inspired Virtue (Guardian, Virtues, Minor)
  1485: 1 // Empowered (Warrior, Tactics, Minor)
}

/**
 * Trait id -> flat outgoing-strike-damage-% while Swiftness is active — gated on
 * `CombatState.swiftnessActive`. Warrior's Sprint (Warrior/Discipline, Adept Major, id 1413): "deal
 * increased strike damage while you have swiftness" (its Movement Speed half is already curated in
 * `MELEE_WEAPON_MOVEMENT_SPEED_TRAIT_BONUSES` — out of scope there). Wiki-verified via raw wikitext 2026-08-22
 * (`split = pve, wvw pvp`): PvE 10%, WvW/PvP 3% — WvW value used here.
 */
export const SWIFTNESS_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  1413: 3 // Warrior's Sprint (Warrior, Discipline, Major)
}

/**
 * Trait id -> flat outgoing-strike-damage-% while Stability is active — gated on
 * `CombatState.stabilityActive`. Stalwart Strength (Warrior/Defense, Grandmaster Major, id 1708):
 * "Deal increased strike damage while you have stability." Wiki-verified via raw wikitext
 * 2026-08-22 (`split = pve, wvw, pvp`): flat 10% in every mode.
 */
export const STABILITY_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  1708: 10 // Stalwart Strength (Warrior, Defense, Major)
}

/**
 * Trait id -> flat outgoing-strike-damage-% while Aegis is active — gated on
 * `CombatState.aegisActive`. Unscathed Contender (Guardian/Virtues, Adept Major, id 624) — a
 * Guardian-leg candidate the original scan missed, curated here alongside its `HIGH_HEALTH_DAMAGE_
 * TRAIT_BONUSES` sibling below (see this section's own doc comment for the catch-up note). "Strike
 * damage dealt is increased while you have aegis." Wiki-verified via raw wikitext 2026-08-22
 * (`split = pve, wvw pvp`): PvE 5%, WvW/PvP 7% — WvW value used here.
 */
export const AEGIS_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  624: 7 // Unscathed Contender (Guardian, Virtues, Major)
}

/**
 * Trait id -> { above the health threshold / otherwise } flat outgoing-strike-damage-% bonus — the
 * damage-% sibling to `HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES`, reusing `CombatState.healthTier`
 * (no new field). Unscathed Contender's other half (see `AEGIS_DAMAGE_TRAIT_BONUSES` above):
 * "Strike damage dealt is increased while you are above the health threshold." Wiki-verified via
 * raw wikitext 2026-08-22: threshold is a flat 90% (no mode split on the threshold itself), damage
 * bonus is PvE 5% / WvW/PvP 7% — WvW value used here, approximated to the `'above75'` tier same as
 * Keen Observer's own 90% threshold already does. Elementalist leg (2026-08-22): Flow like Water
 * (Elementalist/Water, Master Major, id 349) — "Deal increased strike damage, which is further
 * increased while your health is above the threshold." Wiki-verified via raw wikitext: threshold is
 * a flat 50% (no mode split), the two damage facts (5% baseline + 10% above-threshold) also carry
 * no mode split despite the page's top-level `split = pve, wvw pvp` (only the trait's healing fact
 * is actually split) — so `otherwise` is the 5% baseline and `aboveThreshold` is 5%+10%=15%, both
 * approximated to the `'above75'`/`'otherwise'` 2-tier model same as Unscathed Contender's own 90%
 * threshold already does, despite the wiki's 50% threshold differing from both.
 */
export const HIGH_HEALTH_DAMAGE_TRAIT_BONUSES: Record<number, { aboveThreshold: number; otherwise: number }> = {
  624: { aboveThreshold: 7, otherwise: 0 }, // Unscathed Contender (Guardian, Virtues, Major)
  349: { aboveThreshold: 15, otherwise: 5 }, // Flow like Water (Elementalist, Water, Major)
  // Glass Cannon (Engineer, Explosives, Major, id 1882): "Strike damage dealt increases when above
  // health threshold." Wiki-verified via raw wikitext 2026-08-22: threshold is a flat 75% (no mode
  // split), matching the `'above75'` tier exactly (no approximation needed, unlike Unscathed
  // Contender's 90%/Flow like Water's 50%). Damage bonus is PvE 7% / PvP 10% / WvW 5% — WvW value
  // used here, same convention as every other split entry in this sweep.
  1882: { aboveThreshold: 5, otherwise: 0 }
}

/**
 * Trait id -> flat outgoing-strike-damage-% while endurance is NOT full — the inverse gate of
 * `FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES`, reusing `CombatState.fullEnduranceActive` (no new
 * field, just read as `!fullEnduranceActive`). Takedown Round (Engineer/Tools, Adept Major, id
 * 1832): "Deal increased strike damage while your endurance is not full." Wiki-verified via raw
 * wikitext 2026-08-22: flat 10%, no game-mode split.
 */
export const NOT_FULL_ENDURANCE_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  1832: 10 // Takedown Round (Engineer, Tools, Major)
}

/**
 * Trait id -> flat outgoing-strike-damage-% while Vigor is active — gated on the new
 * `CombatState.vigorActive` (see its doc comment), same shape as `SWIFTNESS_DAMAGE_TRAIT_BONUSES`/
 * `STABILITY_DAMAGE_TRAIT_BONUSES`/`AEGIS_DAMAGE_TRAIT_BONUSES`. Excessive Energy (Engineer/Tools,
 * Grandmaster Minor, id 1936): "Strike damage dealt is increased while you have vigor." Wiki-
 * verified via raw wikitext 2026-08-22: flat 10%, no game-mode split. Nomad's Endurance (Mesmer/
 * Mirage, Master Minor, id 2069), added in the Mesmer leg: "Strike and condition damage dealt is
 * increased when you have vigor." Wiki-verified via raw wikitext 2026-08-22 (`split = pve, wvw,
 * pvp`, a genuine 3-way split): strike damage is PvE/WvW 10%, PvP 5% — note PvE and WvW share a
 * value here and PvP is the odd one out, the reverse of this table's usual "WvW/PvP share a value"
 * shape — WvW value (10) used here regardless. Its condition-damage half is curated separately in
 * the new `VIGOR_CONDITION_DAMAGE_TRAIT_BONUSES` table below (PvE 5%, WvW/PvP 10% — the more usual
 * split shape).
 */
export const VIGOR_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  1936: 10, // Excessive Energy (Engineer, Tools, Minor)
  2069: 10 // Nomad's Endurance (Mesmer, Mirage, Minor) — strike-damage half, see doc comment
}

/**
 * Trait id -> flat outgoing-condition-damage-% while Vigor is active — gated on `CombatState.
 * vigorActive`, the condition-damage sibling to `VIGOR_DAMAGE_TRAIT_BONUSES`. First entry: Nomad's
 * Endurance's condition-damage half (see `VIGOR_DAMAGE_TRAIT_BONUSES`'s doc comment) — wiki-verified
 * WvW/PvP value 10%.
 */
export const VIGOR_CONDITION_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  2069: 10 // Nomad's Endurance (Mesmer, Mirage, Minor) — condition-damage half, see doc comment
}

/**
 * Trait id -> flat outgoing-strike-damage-% while the build's profession mechanic is active —
 * gated on `CombatState.mechanicActive`, the damage-% sibling to `MECHANIC_ACTIVE_CRIT_CHANCE_
 * TRAIT_BONUSES`. Bloody Roar (Warrior/Berserker, Grandmaster Major, id 1928): "Deal increased
 * strike damage while in berserk mode." Wiki-verified via raw wikitext 2026-08-22: no `split`
 * parameter present, flat 10% in every mode (the trait's own resistance-on-berserk-entry effect is
 * a proc, not a character-stat gain — out of scope here). The `mechanicActive` toggle is already
 * surfaced for any Berserker build via Fatal Frenzy's auto-granted minor (`MECHANIC_ACTIVE_
 * ATTRIBUTE_TRAIT_BONUSES`), so no `CombatStatePanel` change is needed for this entry.
 */
export const MECHANIC_ACTIVE_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  1928: 10 // Bloody Roar (Warrior, Berserker, Major)
}

/**
 * Trait id -> flat, unconditional outgoing-strike-damage-% — the damage-% sibling to `FLAT_CRIT_
 * CHANCE_TRAIT_BONUSES`, no `CombatState` gating at all (added whenever the trait is picked). Peak
 * Performance (Warrior/Strength, Adept Major, id 1444): "Deal increased strike damage" is an
 * always-on baseline; wiki-verified via raw wikitext 2026-08-22 (`split = pve, wvw pvp`): PvE 5%,
 * WvW/PvP 3% — WvW value used here. The trait's other effect (a further +7%/+10% WvW/PvE "Peak
 * Performance" buff for 6s after using a Physical skill) is a transient proc window, not a
 * steady-state build stat — same "not a character stat gain" reasoning already used to exclude Mist
 * Form/Signet of the Locust from the movement-speed sweep — so only the always-on baseline is
 * curated here. Vicious Expression (Mesmer/Domination, Grandmaster Major, id 681 — the live wiki
 * page has since been retitled "Confounding Suggestions," `traits.json` still names live id 681
 * "Vicious Expression," kept for data consistency, same situation as Furious Burst/"Precise
 * Strikes"): "You and your illusions deal increased strike damage" is an always-on baseline; wiki-
 * verified via raw wikitext 2026-08-22 (`split = pve, wvw pvp`): PvE 10%, WvW/PvP 7% — WvW value
 * used here. Its "further increased against foes without boons" +15% half is target-condition-gated,
 * out of scope (see this section's own doc comment). Spiteful Talisman (Necromancer/Spite, Adept
 * Major, id 914), added in the Necromancer leg: "Your strike damage is increased" is an always-on
 * baseline; wiki-verified via raw wikitext 2026-08-22 (`split = pve, wvw pvp`): PvE 3%, WvW/PvP 7% —
 * WvW value used here. Its "further increased against foes without boons" +12% WvW half is target-
 * condition-gated, out of scope, same shape as Vicious Expression's own boonless half.
 */
export const FLAT_DAMAGE_TRAIT_BONUSES: Record<number, number> = {
  1444: 3, // Peak Performance (Warrior, Strength, Major) — baseline only, see doc comment
  681: 7, // Vicious Expression (Mesmer, Domination, Major) — baseline only, see doc comment
  914: 7 // Spiteful Talisman (Necromancer, Spite, Major) — baseline only, see doc comment
}

/**
 * Sums every curated outgoing-strike-damage-% source actually active on this build — the
 * `DerivedStats.outgoingDamagePercent` resolver, mirrors `resolveOutgoingHealingPercent`'s role
 * (plain additive stacking). Supersedes the old inline formula that only covered
 * `CURATED_RELIC_DAMAGE_BONUSES` + Kalla's Fervor.
 */
export function resolveOutgoingDamagePercent(build: Build, combatState: CombatState, traitsById: Map<number, Trait>): number {
  let total = 0
  const kallaFervorPerStack = kallaFervorPercentPerStack(build, traitsById)
  total += combatState.kallaFervorStacks * kallaFervorPerStack.strikeDamage
  if (combatState.relicActive && build.relicId !== null) total += CURATED_RELIC_DAMAGE_BONUSES[build.relicId] ?? 0
  total += curatedSigilDamagePercent(build, combatState)
  const active = activeTraitIds(build, traitsById)
  if (combatState.furyActive) {
    for (const [traitIdText, percent] of Object.entries(FURY_DAMAGE_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }
  if (combatState.resolutionActive) {
    for (const [traitIdText, percent] of Object.entries(RESOLUTION_DAMAGE_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }
  if (combatState.swiftnessActive) {
    for (const [traitIdText, percent] of Object.entries(SWIFTNESS_DAMAGE_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }
  if (combatState.stabilityActive) {
    for (const [traitIdText, percent] of Object.entries(STABILITY_DAMAGE_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }
  if (combatState.aegisActive) {
    for (const [traitIdText, percent] of Object.entries(AEGIS_DAMAGE_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }
  if (combatState.vigorActive) {
    for (const [traitIdText, percent] of Object.entries(VIGOR_DAMAGE_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }
  if (!combatState.fullEnduranceActive) {
    for (const [traitIdText, percent] of Object.entries(NOT_FULL_ENDURANCE_DAMAGE_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }
  if (combatState.mechanicActive) {
    for (const [traitIdText, percent] of Object.entries(MECHANIC_ACTIVE_DAMAGE_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }
  for (const [traitIdText, { aboveThreshold, otherwise }] of Object.entries(HIGH_HEALTH_DAMAGE_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) total += combatState.healthTier === 'above75' ? aboveThreshold : otherwise
  }
  for (const [traitIdText, percentPerBoon] of Object.entries(PER_BOON_DAMAGE_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) total += percentPerBoon * combatState.activeBoonCount
  }
  for (const [traitIdText, percent] of Object.entries(FLAT_DAMAGE_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) total += percent
  }
  return total
}

/**
 * Sums every curated outgoing-condition-damage-% source actually active on this build — the
 * `DerivedStats.outgoingConditionDamagePercent` resolver, sibling to `resolveOutgoingDamagePercent`
 * above. Supersedes the old inline formula that only covered Kalla's Fervor.
 */
export function resolveOutgoingConditionDamagePercent(build: Build, combatState: CombatState, traitsById: Map<number, Trait>): number {
  let total = 0
  const kallaFervorPerStack = kallaFervorPercentPerStack(build, traitsById)
  total += combatState.kallaFervorStacks * kallaFervorPerStack.conditionDamage
  if (combatState.relicActive && build.relicId !== null) total += CURATED_RELIC_CONDITION_DAMAGE_BONUSES[build.relicId] ?? 0
  total += curatedSigilConditionDamagePercent(build)
  if (combatState.vigorActive) {
    const active = activeTraitIds(build, traitsById)
    for (const [traitIdText, percent] of Object.entries(VIGOR_CONDITION_DAMAGE_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }
  return total
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
 * equipped — no separate picker. Deliberately does *not* use `isActiveWeaponSlot`'s "only the
 * active weapon set counts" gating that every other sigil bonus goes through
 * (`computeGearAttributeTotals`, which already carves out this same exception in its own sigil
 * loop's comment — see there): unlike passive/stat sigil bonuses, a stacking sigil's stacks persist
 * across a weapon swap (confirmed live by the user 2026-08-06), so the stepper should stay
 * available whenever the sigil is equipped on *either* weapon set, not just the one currently
 * active. Still scoped to the current environment
 * (land sets A/B vs. underwater sets U1/U2) since those are separate weapons entirely, not a
 * swap-hotkey pair — no evidence stacks carry over between land and underwater. Returns the first
 * match found in slot order; confirmed by the user 2026-08-16 that this is correct even if a build
 * has two *different* stacking sigils across its two sets (legal to equip — only "two on the same
 * set" isn't) — only one stacking sigil can ever be actively accruing stacks at a time in-game, so
 * `CombatState.stackingSigilStacks` being a single scalar isn't a simplification, it matches the
 * real mechanic.
 */
export function detectActiveStackingSigil(build: Build): ActiveStackingSigil | null {
  const relevantSlots: EquipmentSlotKey[] = build.environment === 'underwater'
    ? ['weaponU1', 'weaponU2']
    : ['weaponA1', 'weaponA2', 'weaponB1', 'weaponB2']
  for (const slotKey of relevantSlots) {
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
    } else if (sigil.attribute !== OUTGOING_HEALING_PERCENT) {
      add(sigil.attribute, value)
    }
    // OUTGOING_HEALING_PERCENT (Benevolence) isn't a core attribute point — DerivedStats.
    // outgoingHealingPercent reads it directly via `stackingSigilOutgoingHealingPercent` below.
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

/**
 * Outgoing-healing-%-to-other-allies and incoming-healing-%-to-self — `DerivedStats.
 * outgoingHealingPercent`/`incomingHealingPercent`'s source families, scoped 2026-08-21 (TODO.md),
 * researched and curated 2026-08-22. Both stack additively, wiki-confirmed on the `Healing` page's
 * own Notes section: "Outgoing healing modifiers stack additively" (unlike Movement Speed's
 * "highest wins" exception above) — so, like `outgoingDamagePercent`, every source below just sums.
 *
 * Scope note: several superficially similar traits/relics were investigated and deliberately
 * excluded because they're a *different* mechanic, not this one — logged here rather than TODO.md
 * since the reasoning is short and this is where a future re-scan would need it:
 * - Absolute Resolve (Guardian/Virtues, id 610) and Soothing Power (Elementalist/Water, id 2028)
 *   each boost one specific skill's own heal coefficient (Virtue of Resolve, Soothing Mist), not a
 *   general %-effectiveness stat — belongs to the healing-coefficient system instead.
 * - Dance of Death (Revenant/Devastation, id 1754 — NOT Necromancer, TODO.md's original guess was
 *   wrong) boosts the healing from Battle Scars, a self-life-steal proc, not outgoing/incoming
 *   healing to/from others.
 * - Augury of Death (Revenant, id 1974) and Spirit's Strength (Ranger, id 2421) each scale a
 *   specific siphon/pet-heal source, not the general stat.
 * - Relic of the Defender (100934) is a self-heal-on-block proc (a coefficient, same shape as
 *   `CURATED_HEALING_COEFFICIENTS`), not an effectiveness %.
 * - Relic of Zakiros (101955) converts outgoing critical-strike damage into healing (a conversion/
 *   siphon mechanic, closer to `lifeStealPercent`'s shape), not an effectiveness %.
 * - Epilogue: Eternal Oasis (Firebrand tome chapter, skill id 42925) applies a transient "+20% Heal
 *   Effectiveness" buff to allies on cast — a short skill-cast proc, out of scope for a steady-state
 *   build stat, same "not a character stat gain" reasoning `resolveMovementSpeedPercent`'s doc
 *   comment already applies to Mist Form/Signet of the Locust.
 * - Bloodstone Pot Pie (68562, "Healing effectiveness is halved") is a joke/negative-consequence
 *   food whose penalty is multiplicative ("halved"), not additive like every source below — modeling
 *   one multiplicative exception for a food nobody would seriously equip isn't worth the special
 *   case, so it's excluded rather than curated.
 * - Of the 14 traits the data-completeness audit's "Effectiveness Increased" Shape-1 backlog
 *   flagged (2026-08-22 TODO.md), only Aquamancer's Training turned out to be about healing at all —
 *   the other 13 (Perfect Inscriptions, Banshee's Wail, Soul Comprehension, Gluttony, Hardy Conduit,
 *   Elemental Pursuit, Amplified Siphoning, Bolstered Bonds, Double Helix, Bird of Prey, Mech Core:
 *   J-Drive) turned out to modify Signet/Warhorn/life-force/Protection/Swiftness/Barrier
 *   effectiveness — different stats entirely, confirmed via each trait's own `description` field.
 */

/** Trait id -> flat outgoing-healing-%-to-others bonus, granted unconditionally once the trait is
 *  chosen (no proc/combat-state gating needed) — every value below is already the WvW-specific
 *  number where the wiki documents a PvE/WvW/PvP split, wiki-verified via raw wikitext 2026-08-22:
 *  - Life from Death (Necromancer/Blood Magic, Master Major, id 789): "Increase healing to other
 *    allies" — flat 10%, no split.
 *  - Illusionary Inspiration (Mesmer/Inspiration, GM Minor, id 1915): "Increase healing to other
 *    allies" — flat 5%, no split (its "heals allies on illusion summon" clause is a separate
 *    coefficient fact, out of scope here).
 *  - Aquamancer's Training (Elementalist/Water, Major, id 1676): "Increase healing to other
 *    allies" — 20% PvE / 15% WvW+PvP.
 *  - Natural Mender (Ranger/Druid, GM Minor, id 1992): "Increase healing to other allies" — 20% PvE
 *    / 15% WvW+PvP.
 *  - Dark Sentry (Thief/Specter, Master Minor, id 2272): "Outgoing healing to allies is increased"
 *    — 20% PvE / 10% WvW+PvP.
 */
export const FLAT_OUTGOING_HEALING_TRAIT_BONUSES: Record<number, number> = {
  789: 10, // Life from Death (Necromancer, Blood Magic, Major)
  1915: 5, // Illusionary Inspiration (Mesmer, Inspiration, GM Minor)
  1676: 15, // Aquamancer's Training (Elementalist, Water, Major) — WvW value
  1992: 15, // Natural Mender (Ranger, Druid, GM Minor) — WvW value
  2272: 10 // Dark Sentry (Thief, Specter, Master Minor) — WvW value
}

/** Trait id -> flat incoming-healing-%-to-self bonus, granted unconditionally once the trait is
 *  chosen — wiki-verified via raw wikitext 2026-08-22, WvW value used wherever a split exists:
 *  - Stalwart Focus (Warrior/Discipline, Adept Major, id 1381): "Increase your incoming healing
 *    effectiveness" — 10% PvE / 3% WvW+PvP (its own outgoing half is in
 *    `FLAT_OUTGOING_HEALING_TRAIT_BONUSES`... actually see below, it's gated differently).
 *  - Health Insurance (Engineer/Alchemy, Adept Major, id 521): "Increase your incoming healing
 *    effectiveness" — flat 10%, no split (its Med-Kit-gated outgoing half is
 *    `MED_KIT_OUTGOING_HEALING_TRAIT_BONUSES` below).
 *  - Vital Persistence (Necromancer/Soul Reaping, Master Major, id 861): "Your incoming healing is
 *    increased" — 20% PvE / 10% WvW+PvP.
 */
export const FLAT_INCOMING_HEALING_TRAIT_BONUSES: Record<number, number> = {
  1381: 3, // Stalwart Focus (Warrior, Discipline, Major) — WvW value
  521: 10, // Health Insurance (Engineer, Alchemy, Major)
  861: 10 // Vital Persistence (Necromancer, Soul Reaping, Major) — WvW value
}

// Stalwart Focus also grants a flat outgoing-to-others half distinct from its incoming half above
// — wiki: "Increase your incoming healing effectiveness and healing to other allies," 15% PvE /
// 10% WvW+PvP outgoing (a different number from its own incoming half, so it can't be folded into
// `FLAT_INCOMING_HEALING_TRAIT_BONUSES` above). Folded into `FLAT_OUTGOING_HEALING_TRAIT_BONUSES`'s
// own object rather than kept separate, since nothing here needs to distinguish "which trait" once
// resolved — merged via `Object.assign` immediately below to keep the doc comment above accurate
// about what's WvW-verified where.
Object.assign(FLAT_OUTGOING_HEALING_TRAIT_BONUSES, {
  1381: 10 // Stalwart Focus (Warrior, Discipline, Major) — WvW value, outgoing half
})

/** Engineer's Heal-slot "Med Kit" skill (id 5802, `slot: 'Heal'` — despite the name, not a Utility
 *  kit) — gates Health Insurance's outgoing healing-to-others half. */
export const MED_KIT_SKILL_ID = 5802

/** Trait id -> outgoing-healing-%-to-others bonus while `Build.skills.heal === MED_KIT_SKILL_ID` —
 *  Health Insurance (Engineer/Alchemy, Adept Major, id 521): "Gain increased healing to others
 *  while using a med kit" — 20% PvE / 10% PvP / 7% WvW (a genuine independent 3-way split, unlike
 *  the trait's own flat-10%-everywhere incoming half). Wiki-verified via raw wikitext 2026-08-22. */
export const MED_KIT_OUTGOING_HEALING_TRAIT_BONUSES: Record<number, number> = {
  521: 7 // Health Insurance (Engineer, Alchemy, Major) — WvW value
}

/** Revenant/Salvation's Adept Major "Invoking Harmony" (id 1823) — wiki-verified via raw wikitext
 *  2026-08-22: "Healing done to other allies is increased for a short duration [10s] after invoking
 *  a legend" — 20% PvE / 15% PvP / 10% WvW (a genuine 3-way split). Gated on `CombatState.
 *  invokingHarmonyActive` rather than always-on, since — unlike the flat traits above — this is a
 *  timed proc window, not a steady passive (same "assume the proc is currently up" shape as
 *  `relicActive`). */
export const INVOKING_HARMONY_TRAIT_ID = 1823
export const INVOKING_HARMONY_HEALING_PERCENT = 10 // WvW value

/** Revenant/Salvation's own Grandmaster Minor "Serene Rejuvenation" (id 1814, auto-active whenever
 *  Salvation is equipped — see `activeTraitIds`) — wiki-verified via raw wikitext 2026-08-22:
 *  "Increase healing to other allies" — base 20% PvE / 15% WvW+PvP, upgraded to 25% PvE / 18%
 *  WvW+PvP when Numinous Gift (id 2440, Salvation's own GM Major, see the `numinous_gift_legend_
 *  gating_fix` memory) is also chosen — Numinous Gift's own "third minor traits ... have improved
 *  effectiveness" clause is genuinely a cross-trait conditional, not a display quirk, matching the
 *  raw API's `traitedFacts[].requires_trait` field on trait 1814 pointing at 2440. */
export const SERENE_REJUVENATION_TRAIT_ID = 1814
export const NUMINOUS_GIFT_TRAIT_ID = 2440
export const SERENE_REJUVENATION_BASE_HEALING_PERCENT = 15 // WvW value
export const SERENE_REJUVENATION_UPGRADED_HEALING_PERCENT = 18 // WvW value, with Numinous Gift

/** Ranger/Druid's Grandmaster Major "Lingering Light" (id 2058) — wiki-verified via raw wikitext
 *  2026-08-22: "While in Celestial Avatar form, your healing of others is significantly increased"
 *  — flat 20%, no game-mode split. Gated on `CombatState.celestialAvatarActive` — see that field's
 *  doc comment for why this needs its own toggle rather than reusing `Build.activeBundleSkillId`. */
export const CELESTIAL_AVATAR_OUTGOING_HEALING_TRAIT_BONUSES: Record<number, number> = {
  2058: 20 // Lingering Light (Ranger, Druid, GM Major)
}

/** Guardian/Honor's Grandmaster Major "Force of Will" (id 1682) — wiki-verified via raw wikitext
 *  2026-08-22: "Healing others is improved based on a percentage of your vitality" — 1% PvE / 0.5%
 *  WvW+PvP per 100 Vitality, continuous (not stepped — the raw API's own two duplicate "per 100
 *  Vitality" facts are the PvE/WvW+PvP split, no wiki language suggesting a floor/step). First
 *  "scales continuously with a live attribute total" outgoing-healing source in this file — reads
 *  `CharacterAttributes.vitality` directly from `derived-stats.ts`, the same "attributes are already
 *  computed by the time `derived` is built" reasoning `armor`/`health` already rely on. */
export const FORCE_OF_WILL_TRAIT_ID = 1682
export const FORCE_OF_WILL_HEALING_PERCENT_PER_100_VITALITY = 0.5 // WvW value

/** Relic id -> flat outgoing-healing-%-to-others bonus while `CombatState.relicActive` is on — same
 *  "assume the relic's own proc/condition is currently satisfied" toggle `CURATED_RELIC_DAMAGE_
 *  BONUSES` already uses. Both wiki-verified via raw wikitext 2026-08-22:
 *  - Relic of the Monk (100031): "Increase healing effectiveness to allies after granting a boon to
 *    an ally" — 1%/stack, max 10 stacks; modeled as the flat max (10%) while active, same "assume
 *    the steady-state max" simplification the relic-proc family already uses elsewhere for stacking
 *    procs this app can't simulate stack-by-stack.
 *  - Relic of Castora (105652): "Healing to other allies is increased while they are below the
 *    health threshold [50%]" — 25% PvE / 20% WvW+PvP (current post-2025-12-09-patch values; the
 *    infobox's own facts already reflect the post-patch numbers, not the pre-patch 25%-everywhere
 *    the version history entry documents changing from).
 */
export const CURATED_RELIC_OUTGOING_HEALING_BONUSES: Record<number, number> = {
  100031: 10, // Relic of the Monk
  105652: 20 // Relic of Castora — WvW value
}

/** Sigil id -> flat outgoing-healing-%-to-others bonus while equipped on the *active* weapon set —
 *  same "active weapon set only" gating every passive/stat sigil bonus already follows (see the
 *  `sigil_bonuses_active_weapon_set_only` memory), summed per equipped sigil slot so it doubles if
 *  equipped on both a 1h main-hand and off-hand weapon — unlike Superior Sigil of Force, the wiki
 *  page for Superior Sigil of Transference (74326, "Healing to other allies is increased by 10%",
 *  wiki-verified via raw wikitext 2026-08-22) carries no "does not stack" clause, so the normal
 *  stat-sigil doubling rule applies rather than Force's own explicit exception. */
export const CURATED_SIGIL_OUTGOING_HEALING_BONUSES: Record<number, number> = {
  74326: 10 // Superior Sigil of Transference
}

function curatedSigilOutgoingHealingPercent(build: Build): number {
  let total = 0
  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    if (!isActiveWeaponSlot(slotKey, build)) continue
    for (const sigilId of build.equipment[slotKey]?.sigilIds ?? []) {
      if (sigilId === null) continue
      total += CURATED_SIGIL_OUTGOING_HEALING_BONUSES[sigilId] ?? 0
    }
  }
  return total
}

/** Superior Sigil of Benevolence's (24584) outgoing-healing-%-to-others share of `CombatState.
 *  stackingSigilStacks` — see its `STACKING_SIGILS` entry's doc comment for why it's excluded from
 *  `combatStatePoints`'s generic core-attribute loop and read here instead. */
export function stackingSigilOutgoingHealingPercent(build: Build, state: CombatState): number {
  const sigil = detectActiveStackingSigil(build)
  if (!sigil || sigil.attribute !== OUTGOING_HEALING_PERCENT) return 0
  return sigil.perStack * state.stackingSigilStacks
}

/** Food/utility id -> flat outgoing-healing-%-to-others bonus, unconditional once equipped (`Build.
 *  foodId`/`Build.utilityId`) — ground-truth-scanned from `food.json`/`utility.json` 2026-08-22 for
 *  "Outgoing Healing"/"Healing to Other Allies" phrasing (more precise than TODO.md's original
 *  manual-scan estimate of "~25 Mint-family items" — the real count is 14). No item here carries a
 *  game-mode split (consumables never do in this dataset). The 12 "Mint"-family Feasts + Bowl of
 *  Mists-Infused Fruit Salad with Mint Garnish all share the identical +10% Outgoing Healing line;
 *  Delicious Rice Ball (Lunar New Year seasonal) shares the same flat 10%; Bowl of Tapioca Pudding
 *  is 10% (its separate "+200 Healing Power for 10s on heal-skill use" clause is a proc, out of
 *  scope here); Canned Rice Ball with "Lucky" Filling is 8% (wiki tags it "discontinued" but it's
 *  still present in `food.json` and equippable by anyone who already owns one, so still curated). */
export const CURATED_FOOD_OUTGOING_HEALING_BONUSES: Record<number, number> = {
  91690: 10, // Bowl of Fruit Salad with Mint Garnish
  91703: 10, // Mint-Pear Cured Meat Flatbread
  91727: 10, // Mint and Veggie Flatbread
  91743: 10, // Mint Creme Brulee
  91748: 10, // Spherified Oyster Soup with Mint Garnish
  91758: 10, // Eggs Benedict with Mint-Parsley Sauce
  91797: 10, // Plate of Clear Truffle and Mint Ravioli
  91801: 10, // Sous-Vide Steak with Mint-Parsley Sauce
  91809: 10, // Plate of Beef Carpaccio with Mint Garnish
  91822: 10, // Plate of Coq Au Vin with Mint Garnish
  91834: 10, // Mint Strawberry Cheesecake
  91864: 10, // Plate of Poultry Aspic with Mint Garnish
  99804: 10, // Bowl of Mists-Infused Fruit Salad with Mint Garnish
  68634: 10, // Delicious Rice Ball
  76840: 10, // Bowl of Tapioca Pudding
  89088: 8 // Canned Rice Ball with "Lucky" Filling
}

/** Utility id -> continuous per-100-Healing-Power / per-100-Concentration outgoing-healing-%-to-
 *  others scaling — the "Bountiful Maintenance Oil" family (3 ids sharing identical text: Bountiful
 *  Maintenance Oil 67528, Mist-Infused Maintenance Oil 99842, Bountiful Maintenance Oil Station
 *  103885 — the "Station" variant is a shareable placeable, same mechanic as the Feast/Station
 *  family, see the `feast_station_shared_consumables` memory). Wiki-verified via raw wikitext
 *  2026-08-22: "Gain 0.6% Increased Healing to Other Allies for Every 100 Healing Power. Gain 0.8%
 *  Increased Healing to Other Allies for Every 100 Concentration," with the wiki's own Notes section
 *  explicit that it's continuous, not stepwise: "Rather than being stepwise, as 'for Every 100
 *  Healing Power' might suggest, the conversion is continuous (i.e. 50 Healing Power would result in
 *  0.3% outgoing healing)." No game-mode split. */
export const CURATED_UTILITY_OUTGOING_HEALING_ATTRIBUTE_SCALING: Record<number, { perHealingPower: number; perConcentration: number }> = {
  67528: { perHealingPower: 0.6, perConcentration: 0.8 }, // Bountiful Maintenance Oil
  99842: { perHealingPower: 0.6, perConcentration: 0.8 }, // Mist-Infused Maintenance Oil
  103885: { perHealingPower: 0.6, perConcentration: 0.8 } // Bountiful Maintenance Oil Station
}

/** Inputs `resolveOutgoingHealingPercent` needs from `CharacterAttributes` — a narrow pick rather
 *  than importing the full interface (defined in `derived-stats.ts`, which already imports from
 *  this file, so a full import back would be circular). */
export interface OutgoingHealingAttributeInputs {
  healingPower: number
  concentration: number
  vitality: number
}

/**
 * Sums every curated outgoing-healing-%-to-others source actually active on this build — the
 * `DerivedStats.outgoingHealingPercent` resolver, mirrors `resolveMovementSpeedPercent`'s role but
 * with plain additive stacking (see this section's own doc comment) instead of a "highest wins"
 * rule.
 */
export function resolveOutgoingHealingPercent(
  build: Build,
  combatState: CombatState,
  traitsById: Map<number, Trait>,
  attributes: OutgoingHealingAttributeInputs
): number {
  const active = activeTraitIds(build, traitsById)
  let total = 0

  for (const [traitIdText, percent] of Object.entries(FLAT_OUTGOING_HEALING_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) total += percent
  }

  // Righteous Rebel's healing share is flat while Kalla's Fervor is active, unlike the per-stack
  // strike/condition/life-steal shares elsewhere in this file — see `KallaFervorPercentPerStack.
  // outgoingHealing`'s doc comment. Deliberately NOT `stacks * outgoingHealing`.
  const kallaFervorPerStack = kallaFervorPercentPerStack(build, traitsById)
  if (combatState.kallaFervorStacks > 0) total += kallaFervorPerStack.outgoingHealing

  if (active.has(SERENE_REJUVENATION_TRAIT_ID)) {
    total += active.has(NUMINOUS_GIFT_TRAIT_ID) ? SERENE_REJUVENATION_UPGRADED_HEALING_PERCENT : SERENE_REJUVENATION_BASE_HEALING_PERCENT
  }

  if (combatState.invokingHarmonyActive && active.has(INVOKING_HARMONY_TRAIT_ID)) total += INVOKING_HARMONY_HEALING_PERCENT

  if (combatState.celestialAvatarActive) {
    for (const [traitIdText, percent] of Object.entries(CELESTIAL_AVATAR_OUTGOING_HEALING_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }

  if (active.has(FORCE_OF_WILL_TRAIT_ID)) total += (attributes.vitality / 100) * FORCE_OF_WILL_HEALING_PERCENT_PER_100_VITALITY

  if (build.skills.kind === 'standard' && build.skills.heal === MED_KIT_SKILL_ID) {
    for (const [traitIdText, percent] of Object.entries(MED_KIT_OUTGOING_HEALING_TRAIT_BONUSES)) {
      if (active.has(Number(traitIdText))) total += percent
    }
  }

  if (combatState.relicActive && build.relicId !== null) total += CURATED_RELIC_OUTGOING_HEALING_BONUSES[build.relicId] ?? 0

  total += curatedSigilOutgoingHealingPercent(build)
  total += stackingSigilOutgoingHealingPercent(build, combatState)

  for (const id of [build.foodId, build.utilityId]) {
    if (id !== null) total += CURATED_FOOD_OUTGOING_HEALING_BONUSES[id] ?? 0
  }

  for (const id of [build.foodId, build.utilityId]) {
    if (id === null) continue
    const scaling = CURATED_UTILITY_OUTGOING_HEALING_ATTRIBUTE_SCALING[id]
    if (scaling) total += (attributes.healingPower / 100) * scaling.perHealingPower + (attributes.concentration / 100) * scaling.perConcentration
  }

  return total
}

/** Sums every curated incoming-healing-%-to-self source actually active on this build — the
 *  `DerivedStats.incomingHealingPercent` resolver. Every curated source so far is a flat,
 *  unconditional trait bonus (see `FLAT_INCOMING_HEALING_TRAIT_BONUSES`), so this is simpler than
 *  `resolveOutgoingHealingPercent` — no relic/sigil/food/proc family has turned up an incoming-
 *  healing source yet. */
export function resolveIncomingHealingPercent(build: Build, traitsById: Map<number, Trait>): number {
  const active = activeTraitIds(build, traitsById)
  let total = 0
  for (const [traitIdText, percent] of Object.entries(FLAT_INCOMING_HEALING_TRAIT_BONUSES)) {
    if (active.has(Number(traitIdText))) total += percent
  }
  return total
}
