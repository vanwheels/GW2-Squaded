import type { Build, Trait } from '../types'
import { addPoints, applyConversions, emptyTotals, type AttributeConversion, type AttributeTotals } from './attribute-totals'

/**
 * Traits can grant a flat attribute bonus (`AttributeAdjust` fact) or convert a percentage of one
 * attribute into another (`BuffConversion` fact) — a contribution previously entirely unmodeled in
 * `computeGearAttributeTotals`/`computeCharacterStats`, discovered by the user cross-checking
 * against gw2skills.net. Confirmed live 2026-08-02 via a full `traits.json` scan: 193 traits carry
 * at least one such fact — but **the fact type alone does not mean "you passively gain this"**:
 * verified live that "Healer's Gift" (Revenant/Salvation minor) carries an unambiguous single-value
 * `AttributeAdjust` (197 Healing) that is NOT a stat grant at all — it's the base-heal coefficient
 * for that trait's own proc ("The end of your dodge roll heals nearby allies"), i.e. skill-tooltip
 * math reusing the same fact type. Only `AttributeAdjust`/`BuffConversion` facts on traits whose
 * *description* is itself an unconditional "you gain/convert this" (no proc/skill/condition
 * language) are genuine character-stat contributions — this can't be told apart reliably from the
 * fact data alone, so (same as `CURATED_RELIC_DAMAGE_BONUSES`/`FURY_CRIT_CHANCE_TRAIT_BONUSES`
 * elsewhere in this codebase) this is a hand-curated, individually-verified whitelist, not an
 * automatic parse-everything pipeline. Traits not listed here contribute nothing — fails open,
 * same convention as `glyphFormVariants`/`skillVariantExclusions`. See TODO.md for the process to
 * add more (there are ~190 unverified candidates from the `traits.json` scan).
 */
export interface TraitFlatBonus {
  traitId: number
  target: string
  value: number
}

export interface TraitConversion extends AttributeConversion {
  traitId: number
}

const CURATED_FLAT_BONUSES: TraitFlatBonus[] = [
  // Life Attunement (Revenant, Salvation, Minor tier 2) — "Gain healing power." Unambiguous
  // single-value AttributeAdjust fact; description confirms this is a genuine passive stat gain.
  { traitId: 1821, target: 'Healing', value: 120 },
  // Compounding Chemicals (Engineer, Alchemy, Minor GM) — "Gain increased concentration." Wiki-
  // verified 2026-08-12 (wiki.guildwars2.com/wiki/Compounding_Chemicals raw wikitext): split
  // pve=240/wvw+pvp=75; this app is WvW-focused so 75. The trait's other AttributeAdjust fact (37
  // Healing, coefficient 0.023) is the proc-heal-on-boon-grant, not a stat grant — excluded.
  { traitId: 413, target: 'BoonDuration', value: 75 },
  // Chemical Rounds (Engineer, Firearms, Major Adept) — "Gain condition damage." Wiki-verified
  // 2026-08-12: single game-mode-agnostic value (+120). The trait's other effect (pistol condition
  // duration) is a skill-specific modifier, not a character-stat gain — out of scope for this table.
  { traitId: 1878, target: 'ConditionDamage', value: 120 },
  // Thermal Vision (Engineer, Firearms, Major Master) — "Gain expertise." Wiki-verified 2026-08-12
  // (raw wikitext): split game mode=pve 150 / game mode=pvp wvw 60; WvW value is 60.
  { traitId: 2006, target: 'ConditionDuration', value: 60 },
  // Hybrid Vigor (Engineer, Amalgam, Minor Master) — "Gain vitality." Wiki-verified 2026-08-12 (raw
  // wikitext): single game-mode-agnostic value (+240), unlike this same trait's morph-skill barrier
  // proc (split pve/wvw/pvp), which is out of scope for this table.
  { traitId: 2389, target: 'Vitality', value: 240 },
  // Honorable Staff (Guardian, Honor, Major Adept) — "Gain concentration." Wiki-verified 2026-08-12
  // (raw wikitext): split game mode=pve 120 / game mode=pvp wvw 60; WvW value is 60. The trait's
  // other effect (Empower granting endurance) isn't a character-stat gain — out of scope.
  { traitId: 557, target: 'BoonDuration', value: 60 },
  // Right-Hand Strength (Guardian, Radiance, Major Adept) — "Your precision is increased." Wiki-
  // verified 2026-08-12: unconditional +80 Precision, no game-mode split. This trait's *other*
  // AttributeAdjust fact (+80 Power) is conditional on wielding a one-handed weapon in the main
  // hand — a weapon-equipped-gated shape this unconditional table doesn't model; excluded (see
  // TODO.md for the new-shape note, same family as Zealous Blade's greatsword-gated Power below).
  { traitId: 566, target: 'Precision', value: 80 },
  // Radiant Power (Guardian, Radiance, Minor Master) — "Your ferocity is increased." Wiki-verified
  // 2026-08-12: unconditional +150 CritDamage, no game-mode split. This trait's *other* effect
  // (crit chance vs burning foes) has no AttributeAdjust fact — out of scope for this table.
  { traitId: 568, target: 'CritDamage', value: 150 },
  // Zealous Blade (Guardian, Zeal, Major Adept) — "Your power is increased." Wiki-verified
  // 2026-08-12: unconditional +120 Power, no game-mode split. This trait's *other* Power fact,
  // explicitly labeled "Power While Wielding Greatsword" (+120), is conditional on wielding a
  // greatsword — same weapon-equipped-gated shape as Right-Hand Strength above, excluded.
  { traitId: 653, target: 'Power', value: 120 },
  // Defender's Dogma (Guardian, Dragonhunter, Minor Adept) — "Gain vitality." Wiki-verified
  // 2026-08-12: unconditional +180 Vitality, no game-mode split. This trait's other effect
  // (blocking maxes Justice's charge) isn't a stat gain — out of scope.
  { traitId: 1896, target: 'Vitality', value: 180 },
  // Conceited Curate (Guardian, Willbender, Major Adept) — "Gain increased vitality." Wiki-verified
  // 2026-08-12: unconditional +180 Vitality, no game-mode split. This trait's other AttributeAdjust
  // fact (272 Healing, coefficient 0.11) is the proc-heal coefficient for Willbender Flames striking
  // an enemy — same shape as Healer's Gift, excluded.
  { traitId: 2187, target: 'Vitality', value: 180 },
  // Power for Power (Guardian, Willbender, Major Adept) — "Gain increased power." Wiki-verified
  // 2026-08-12: unconditional +120 Power, no game-mode split. This trait's other effect (Willbender
  // Flames damage increase, split pve 200%/wvw pvp 100%) is a skill damage modifier, not a
  // character-stat gain — out of scope.
  { traitId: 2190, target: 'Power', value: 120 },
  // Searing Pact (Guardian, Willbender, Major Adept) — "Gain condition damage." Wiki-verified
  // 2026-08-12: unconditional +120 ConditionDamage, no game-mode split. This trait's other effect
  // (Willbender Flames apply burning, split pve 1s/wvw pvp 2s) is a skill effect, not a
  // character-stat gain — out of scope.
  { traitId: 2191, target: 'ConditionDamage', value: 120 },
  // Light's Gift (Guardian, Luminary, Minor Adept) — "Gain vitality." Wiki-verified 2026-08-12:
  // unconditional +180 Vitality, no game-mode split. This trait's other effect (Luminary's Blessing
  // on radiant-weapon equip, split pve 6s/wvw pvp 3s) is a skill effect, not a stat gain — out of
  // scope.
  { traitId: 2394, target: 'Vitality', value: 180 },
  // Aeromancer's Training (Elementalist, Air, Minor GM) — "Gain ferocity, and gain additional
  // ferocity while attuned to air." Wiki-verified 2026-08-12: unconditional half is a flat +150
  // CritDamage, no game-mode split. The trait's *other* CritDamage fact (+150, explicitly labeled
  // "Additional Ferocity" in the game data, only while attuned to air) is a new conditional shape —
  // attunement-gated flat bonus, same family as Empowering Flame below — excluded.
  { traitId: 223, target: 'CritDamage', value: 150 },
  // Burning Rage / Sunspot (Elementalist, Fire, Major Master) — "Your condition damage is
  // increased." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|attribute|Condition
  // Damage|180}}`, no game-mode split). This trait's other effect (Sunspot burning stacks/radius)
  // is a skill modifier, not a character-stat gain — out of scope.
  { traitId: 325, target: 'ConditionDamage', value: 180 },
  // Gathered Focus (Elementalist, Tempest, Minor Master) — "Your concentration is increased." Wiki-
  // verified 2026-08-12: split game mode=pve 240 / game mode=pvp wvw 120; WvW value is 120. As of
  // the 2024-06-25 patch this is fully unconditional (the trait's earlier above-90%-health
  // requirement for the bonus half was removed) — confirmed via version history on the same page.
  { traitId: 1938, target: 'BoonDuration', value: 120 },
  // Elemental Enchantment (Elementalist, Arcane, Minor GM) — "Gain concentration and your
  // attunements gain reduced recharge." Wiki-verified 2026-08-12: split game mode=pve 180 / game
  // mode=pvp wvw 120; WvW value is 120. The attunement-recharge-reduction half is a skill modifier,
  // not a character-stat gain — out of scope.
  { traitId: 2004, target: 'BoonDuration', value: 120 },
  // Soothing Power (Elementalist, Water, Major Master) — "Gain vitality." Wiki-verified 2026-08-12:
  // unconditional +300 Vitality, no game-mode split. This trait's other effect (Soothing Mist
  // healing effectiveness +100%) is a skill modifier, not a character-stat gain — out of scope.
  { traitId: 2028, target: 'Vitality', value: 300 },
  // Elemental Refreshment (Elementalist, Weaver, Minor Master) — "Gain vitality." Wiki-verified
  // 2026-08-12: unconditional +180 Vitality, no game-mode split. This trait's other effect (barrier
  // on Dual Attack skills, split pve/wvw pvp) is a proc barrier coefficient, not a character-stat
  // gain — out of scope.
  { traitId: 2077, target: 'Vitality', value: 180 }
]

const CURATED_CONVERSIONS: TraitConversion[] = [
  // Life Attunement — "Gain concentration based on a portion of your healing power." Wiki-verified
  // 2026-08-02 (wiki.guildwars2.com/wiki/Life_Attunement): 7% is the PvE **and** WvW value; 4% (the
  // raw API's other listed value) is competitive/PvP-only.
  { traitId: 1821, source: 'Healing', target: 'BoonDuration', percent: 7 },
  // Quiet Intensity (Mesmer, Virtuoso, Minor GM) — "Gain ferocity based on your vitality." Wiki-
  // verified 2026-08-12 (wiki.guildwars2.com/wiki/Quiet_Intensity): 10% is a single game-mode-
  // agnostic value, unlike this same trait's *other* effect ("Fury gives an increased critical
  // chance," 15% PvE / 10% WvW/PvP — that half is conditional-on-Fury, tracked separately in
  // `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`, not here).
  { traitId: 2193, source: 'Vitality', target: 'CritDamage', percent: 10 },
  // Blast Shield (Engineer, Explosives, Major Master) — "Gain vitality based on a percentage of
  // your power." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|gain|Vitality|Power|10}}`,
  // no game-mode split). This trait's other effect (Explosive Entrance barrier, split pve/wvw pvp)
  // is a proc, not a stat grant — excluded.
  { traitId: 1944, source: 'Power', target: 'Vitality', percent: 10 },
  // Power of the Virtuous (Guardian, Virtues, Minor Adept) — "Gain condition damage based on your
  // vitality." Wiki-verified 2026-08-12 (raw wikitext): split game mode=pve 7 / game mode=pvp wvw
  // 13; WvW value is 13. The trait's other effect (Virtue recharge reduction) isn't a stat gain.
  { traitId: 620, source: 'Vitality', target: 'ConditionDamage', percent: 13 },
  // Kindled Zeal (Guardian, Zeal, Major Master) — "Gain condition damage based on your power."
  // Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|gain|Condition Damage|Power|10}}`, no
  // game-mode split).
  { traitId: 1556, source: 'Power', target: 'ConditionDamage', percent: 10 },
  // Ferocious Winds (Elementalist, Air, Major Adept) — "Gain ferocity based on your precision."
  // Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|gain|Ferocity|Precision|7}}`, no game-mode
  // split). The wiki's version-history note about a 2015 bug (this trait briefly converting
  // toughness instead of precision) is historical, not a current conditional.
  { traitId: 232, source: 'Precision', target: 'CritDamage', percent: 7 },
  // Strength of Stone (Elementalist, Earth, Major Master) — "Gain condition damage based on your
  // toughness." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|gain|Condition
  // Damage|Toughness|10}}`, no game-mode split). This trait's other effect (bleed on immobilize,
  // split pve/wvw pvp stack count) is a skill effect, not a character-stat gain — out of scope.
  { traitId: 275, source: 'Toughness', target: 'ConditionDamage', percent: 10 }
]

/**
 * Every trait currently active on a build: every Minor trait of an equipped specialization line
 * (auto-granted, no selection needed) plus whichever Major trait was actually chosen per tier.
 */
function activeTraitIds(build: Build, traitsById: Map<number, Trait>): Set<number> {
  const active = new Set<number>()
  for (const line of build.specializations) {
    if (!line) continue
    const chosenIds = new Set(line.chosenTraitIds.filter((id): id is number => id !== null))
    for (const trait of traitsById.values()) {
      if (trait.specializationId !== line.specializationId) continue
      if (trait.slot === 'Minor' || chosenIds.has(trait.id)) active.add(trait.id)
    }
  }
  return active
}

/** Flat attribute-point bonuses from every currently-active, curated trait — gear-independent,
 *  safe to compute once regardless of what else is being varied (e.g. by the Gear Optimizer's
 *  search). */
export function activeTraitFlatBonuses(build: Build, traitsById: Map<number, Trait>): AttributeTotals {
  const active = activeTraitIds(build, traitsById)
  const totals = emptyTotals()
  for (const bonus of CURATED_FLAT_BONUSES) {
    if (active.has(bonus.traitId)) addPoints(totals, bonus.target, bonus.value)
  }
  return totals
}

/** Every currently-active, curated trait conversion, unresolved (the source attribute's *final*
 *  value — after gear, runes, other trait bonuses, everything — isn't known until the rest of the
 *  totals are assembled, so this just lists what to apply; see `applyTraitBonuses`). */
export function activeTraitConversions(build: Build, traitsById: Map<number, Trait>): TraitConversion[] {
  const active = activeTraitIds(build, traitsById)
  return CURATED_CONVERSIONS.filter((c) => active.has(c.traitId))
}

/** Applies every active trait's flat bonuses, then every active conversion computed from the
 *  resulting totals (not chained/compounding — every conversion reads the same post-flat-bonus
 *  snapshot, matching how the game itself computes simultaneous conversions), directly mutating
 *  `totals`. Call after every other additive contribution (gear/runes/food/utility/combat state)
 *  is already in `totals`, since conversions need the real final source-attribute value. */
export function applyTraitBonuses(totals: AttributeTotals, build: Build, traitsById: Map<number, Trait>): void {
  const flat = activeTraitFlatBonuses(build, traitsById)
  for (const [k, v] of Object.entries(flat.points)) addPoints(totals, k, v)

  applyConversions(totals, activeTraitConversions(build, traitsById))
}
