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
  { traitId: 2077, target: 'Vitality', value: 180 },
  // Reinforced Potency (Revenant, Herald, Minor GM) — "Gain concentration and deal increased strike
  // damage for each active boon you have." Wiki-verified 2026-08-12 (raw wikitext): the Concentration
  // half is a flat, non-scaling `{{skill fact|attribute|Concentration|...}}` split pve 240/wvw+pvp
  // 60 — the "for each active boon" language only applies to the separate strike-damage-increase
  // fact, not this one. WvW value is 60.
  { traitId: 1788, target: 'BoonDuration', value: 60 },
  // Seething Malice (Revenant, Corruption, Minor Master) — "Your condition damage is increased."
  // Wiki-verified 2026-08-12 (raw wikitext): split "pve wvw"=120 / "pvp"=240 — unlike most splits
  // seen in this sweep, WvW groups with PvE here, not PvP (flagged as the exception this sweep's
  // notes warned to watch for). WvW value is 120.
  { traitId: 1801, target: 'ConditionDamage', value: 120 },
  // Lingering Curse (Necromancer, Curses, Major Grandmaster) — "Your condition damage is increased."
  // Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|attribute|Condition Damage|200}}`, no
  // game-mode split). This trait's other effect (scepter condition duration + Feast of Corruption
  // morph) is a skill modifier, not a character-stat gain — out of scope. Note: the raw API fact
  // data lists this fact's `target` as `"None"` (a data quirk), but the wiki confirms it's a genuine
  // Condition Damage attribute gain.
  { traitId: 801, target: 'ConditionDamage', value: 200 },
  // Furious Demise (Necromancer, Curses, Minor Master) — "Gain additional precision." Wiki-verified
  // 2026-08-12: unconditional +180 Precision, no game-mode split. This trait's other effect (fury on
  // shroud entry, split pve 25% crit-chance bonus/wvw pvp standard) is a proc buff, not a
  // character-stat gain — out of scope.
  { traitId: 803, target: 'Precision', value: 180 },
  // Vital Persistence (Necromancer, Soul Reaping, Major Master) — "Gain Vitality." Wiki-verified
  // 2026-08-12: unconditional +180 Vitality, no game-mode split. This trait's other effect (incoming
  // healing increase, split pve 20%/wvw pvp 10%) isn't modeled by this attribute-totals table —
  // out of scope.
  { traitId: 861, target: 'Vitality', value: 180 },
  // Alchemic Vigor (Necromancer, Harbinger, Minor Master) — "Gain increased vitality." Wiki-verified
  // 2026-08-12 (raw wikitext: `{{skill fact|attribute|Vitality|alt=Vitality Increased|240}}`, no
  // game-mode split). This trait's other effect (heal per blight stack each second) is a proc-heal
  // coefficient, not a character-stat gain — out of scope.
  { traitId: 2186, target: 'Vitality', value: 240 },
  // Boon of Creation (Necromancer, Ritualist, Minor Master) — "Gain concentration." Wiki-verified
  // 2026-08-12: split game mode=pve 180 / game mode=pvp wvw 60; WvW value is 60. This trait's other
  // effect (life force on creature summon, split pve 10/wvw pvp 3) is a resource gain, not a
  // character-stat gain — out of scope.
  { traitId: 2371, target: 'BoonDuration', value: 60 },
  // Blademaster (Warrior, Arms, Major Master) — "Gain expertise." Wiki-verified 2026-08-12 (raw
  // wikitext): unconditional +120 ConditionDuration (Expertise), no game-mode split. This trait's
  // other AttributeAdjust fact (+120 ConditionDamage, "while wielding a sword") is the
  // weapon-equipped-gated shape already flagged in the Guardian leg (Right-Hand Strength/Zealous
  // Blade) — excluded.
  { traitId: 1333, target: 'ConditionDuration', value: 120 },
  // Forceful Greatsword (Warrior, Strength, Major Adept) — "Gain power ... Double these bonuses
  // while wielding a greatsword or underwater spear." Wiki-verified 2026-08-12: unlike Blademaster/
  // Axe Mastery, the weapon-gated doubling here is NOT materialized as a second fact — the trait's
  // single AttributeAdjust fact (+120 Power) IS the always-active base value confirmed by version
  // history ("120 power base, plus an additional 120 power when wielding greatsword"); the doubled
  // total (240) while wielding greatsword/underwater spear is the same weapon-equipped-gated family,
  // just not exposed as its own line item in this trait's data — excluded, base only added here.
  { traitId: 1338, target: 'Power', value: 120 },
  // Axe Mastery (Warrior, Discipline, Major Grandmaster) — "Gain ferocity." Wiki-verified
  // 2026-08-12 (raw wikitext): unconditional +120 CritDamage, no game-mode split. This trait's
  // other CritDamage fact (+120, explicitly labeled "Additional Ferocity," while wielding an axe)
  // is the same weapon-equipped-gated shape as Right-Hand Strength/Zealous Blade — excluded.
  { traitId: 1369, target: 'CritDamage', value: 120 },
  // Roaring Reveille (Warrior, Tactics, Major Adept) — "Your concentration is increased." Wiki-
  // verified 2026-08-12 (raw wikitext): split game mode=pve 120 / game mode=pvp wvw 60; WvW value
  // is 60. This trait's other effects (warhorn Fury/Resistance grants) are skill modifiers, not
  // character-stat gains — out of scope.
  { traitId: 1471, target: 'BoonDuration', value: 60 },
  // Inspiring Implements (Warrior, Paragon, Minor Adept) — "Gain concentration." Wiki-verified
  // 2026-08-12 (raw wikitext): split game mode=pve 180 / game mode=pvp wvw 60; WvW value is 60.
  // This trait's other effects (adrenaline/motivation on weapon swap) are resource gains, not
  // character-stat gains — out of scope.
  { traitId: 2418, target: 'BoonDuration', value: 60 },
  // Honed Axes (Ranger, Beastmastery, Major Adept) — "You and your pet gain ferocity ... you gain
  // additional ferocity while wielding an axe." Wiki-verified 2026-08-12 (raw wikitext:
  // `{{skill fact|attribute|Ferocity|120}}`, no game-mode split). This trait's other CritDamage fact
  // (+120, labeled "Additional Ferocity"), gated on wielding an axe, is the same weapon-equipped-
  // gated shape as Right-Hand Strength/Zealous Blade/Axe Mastery — excluded.
  { traitId: 970, target: 'CritDamage', value: 120 },
  // Lingering Magic (Ranger, Nature Magic, Minor Master) — "You and your pet gain increased
  // concentration." Wiki-verified 2026-08-12 (raw wikitext): split game mode=pve 240 / game
  // mode=pvp wvw 120; WvW value is 120. This trait's other effect (regeneration effectiveness) isn't
  // a character-stat gain — out of scope.
  { traitId: 1059, target: 'BoonDuration', value: 120 },
  // Arachnophobia (Ranger, Wilderness Survival, Major Adept) — "You and your pet gain expertise;
  // spiders and devourers gain more." Wiki-verified 2026-08-12 (raw wikitext:
  // `{{skill fact|attribute|Expertise|150}}`, no game-mode split). This trait's other ConditionDuration
  // fact (+225, labeled "Spider and Devourer Additional Expertise") is conditional on pet type, not a
  // character-stat gain — out of scope.
  { traitId: 1099, target: 'ConditionDuration', value: 150 },
  // Ambidexterity (Ranger, Wilderness Survival, Major Master) — "Gain condition damage. Gain
  // additional condition damage while wielding a torch, dagger, or mace." Wiki-verified 2026-08-12:
  // this trait's game-mode split was removed by the 2019-03-05 update ("no longer split between game
  // modes and now uses its highest stat value in all modes"), leaving a single unconditional +120
  // ConditionDamage. This trait's other ConditionDamage fact (+120, "Additional Condition Damage") is
  // the same weapon-equipped-gated shape as Right-Hand Strength/Zealous Blade — excluded.
  { traitId: 1101, target: 'ConditionDamage', value: 120 },
  // Strider's Strength (Ranger, Skirmishing, Major Adept) — "You and your pet gain power. Gain
  // additional power while wielding a sword." Wiki-verified 2026-08-12 (raw wikitext:
  // `{{skill fact|attribute|power|120}}`, no game-mode split). This trait's other Power fact (+120,
  // "Additional Power"), gated on wielding a sword, is the same weapon-equipped-gated shape as
  // Right-Hand Strength/Zealous Blade/Axe Mastery/Honed Axes — excluded. The evade-grants-might
  // effect is a proc, not a stat gain — out of scope.
  { traitId: 1700, target: 'Power', value: 120 },
  // Natural Fortitude (Ranger, Untamed, Minor Adept) — "Gain vitality." Wiki-verified 2026-08-12
  // (raw wikitext: `{{skill fact|attribute|Vitality|240}}`, no game-mode split). This trait's other
  // effects (life-siphon on Unleashed Ambush hits) are the same life-siphon proc shape as
  // Necromancer's Predator's Cunning-family exclusions — excluded.
  { traitId: 2286, target: 'Vitality', value: 240 },
  // Deadly Ambition (Thief, Deadly Arts, Major Master) — "Inflict poison when striking a foe with a
  // dual wield attack. Gain increased Condition Damage." Wiki-verified 2026-08-12 (raw wikitext):
  // split game mode=pve 180 / game mode=wvw pvp 120; WvW value is 120. The poison-on-hit half is a
  // skill proc, not a character-stat gain — out of scope.
  { traitId: 1164, target: 'ConditionDamage', value: 120 },
  // Swindler's Equilibrium (Thief, Acrobatics, Major Adept) — "Gain power and additional power while
  // wielding a sword or underwater spear." Wiki-verified 2026-08-12 (raw wikitext:
  // `{{skill fact|attribute|Power|120}}` + `{{skill fact|attribute|Power|120|alt=Bonus Power}}`, no
  // game-mode split). Unconditional half only; the "Bonus Power" fact is the same weapon-equipped-
  // gated shape as Right-Hand Strength/Zealous Blade (gated on sword/underwater spear) — excluded.
  { traitId: 1192, target: 'Power', value: 120 },
  // Preparedness (Thief, Trickery, Minor Adept) — "Increases maximum initiative by 3. Gain increased
  // expertise." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|attribute|expertise|150}}`, no
  // game-mode split). The initiative increase is a resource-cap change, not a character-stat gain —
  // out of scope for this table.
  { traitId: 1232, target: 'ConditionDuration', value: 150 },
  // Dagger Training (Thief, Deadly Arts, Major Adept) — "Gain bonus power, which is increased when
  // wielding a dagger." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|attribute|Power|80}}` +
  // `{{skill fact|attribute|Power|80|alt=Additional Power}}`, no game-mode split). Unconditional half
  // only; the "Additional Power" fact is the same weapon-equipped-gated shape as Swindler's
  // Equilibrium above (gated on dagger) — excluded.
  { traitId: 1245, target: 'Power', value: 80 },
  // Revealed Training (Thief, Deadly Arts, Major Grandmaster) — "Gain power, then gain extra power
  // while you are revealed." Wiki-verified 2026-08-12 (raw wikitext): the base-power half splits
  // game mode=pve 80 / game mode=pvp wvw 100; WvW value is 100. The "Power while Revealed" half
  // (pve 120/wvw pvp 150) is a **new revealed-state-gated flat-bonus shape** — same conditional-gate
  // family as weapon-equipped/attunement/shroud/boon gating already flagged elsewhere in this sweep,
  // just keyed on the Revealed debuff — excluded, not added to this unconditional table.
  { traitId: 1704, target: 'Power', value: 100 },
  // Staff Master (Thief, Daredevil, Major Adept) — "While wielding a staff, gain endurance for each
  // initiative point spent. Gain bonus power, which is increased when wielding a staff." Wiki-verified
  // 2026-08-12 (raw wikitext: `{{skill fact|attribute|Power|120}}` +
  // `{{skill fact|attribute|Power|120|alt=Bonus Power with Staff}}`, no game-mode split).
  // Unconditional half only; "Bonus Power with Staff" is the same weapon-equipped-gated shape as
  // Swindler's Equilibrium/Dagger Training above (gated on staff) — excluded. The endurance-per-
  // initiative effect is a resource gain, not a character-stat gain — out of scope.
  { traitId: 1884, target: 'Power', value: 120 },
  // Silent Scope (Thief, Deadeye, Major Adept) — "Gain precision. When you dodge roll, gain access to
  // your stealth attack if your malice is above the threshold." Wiki-verified 2026-08-12 (raw
  // wikitext: `{{skill fact|attribute|Precision|120}}`, no game-mode split). The dodge-roll stealth-
  // attack-access clause is a skill-access unlock, not a character-stat gain — out of scope.
  { traitId: 2118, target: 'Precision', value: 120 },
  // Premeditation (Thief, Deadeye, Major Grandmaster) — "Deal increased strike damage for each unique
  // boon you have; concentration is increased." Wiki-verified 2026-08-12 (raw wikitext): split game
  // mode=pve 180 / game mode=pvp wvw 60; WvW value is 60. The per-boon strike-damage clause is a
  // damage modifier, not a character-stat gain — out of scope.
  { traitId: 2160, target: 'BoonDuration', value: 60 },
  // Second Opinion (Thief, Specter, Major Adept) — "A portion of condition damage is converted to
  // healing power. Gain condition damage, which is increased when wielding a scepter." Wiki-verified
  // 2026-08-12 (raw wikitext: `{{skill fact|attribute|Condition Damage|+90}}` +
  // `{{skill fact|attribute|Condition Damage|alt=Additional Condition Damage|+90}}`, no game-mode
  // split). Unconditional half only; "Additional Condition Damage" is the same weapon-equipped-gated
  // shape as Swindler's Equilibrium/Dagger Training/Staff Master above (gated on scepter) — excluded.
  // This trait's Condition Damage→Healing conversion is added separately below.
  { traitId: 2284, target: 'ConditionDamage', value: 90 }
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
  { traitId: 275, source: 'Toughness', target: 'ConditionDamage', percent: 10 },
  // Elevated Compassion (Revenant, Herald, Major Master) — in-game tooltip includes "Gain
  // Concentration Based on a Percentage of Power: 13%" (confirmed via wiki version history: added
  // 2023-07-18, "converts 13% of the herald's power into concentration in addition to its other
  // effects") even though this doesn't appear in the wiki's condensed description field, which only
  // covers this trait's two heal-on-boon-grant/boon-on-upkeep-threshold procs. Wiki-verified
  // 2026-08-12 (raw wikitext: `{{skill fact|gain|Concentration|Power|13}}`, no game-mode split) —
  // unconditional, "in addition to" the procs, so it belongs in this table despite the procs
  // themselves being out of scope (same shape as Healer's Gift-style exclusions elsewhere).
  { traitId: 1746, source: 'Power', target: 'BoonDuration', percent: 13 },
  // Versed in Stone (Revenant, Retribution, Major GM) — "Gain power based on your toughness," a
  // standalone unconditional sentence alongside this trait's two conditional/proc effects (extra
  // Rite of the Great Dwarf damage reduction; casting Rite of the Great Dwarf when struck below the
  // health threshold) — same multi-sentence shape as Life Attunement/Quiet Intensity, where one
  // clause is a genuine passive gain and the others aren't. Wiki-verified 2026-08-12 (raw wikitext):
  // split game mode=pve 13 / game mode=pvp wvw 4; WvW value is 4.
  { traitId: 1770, source: 'Toughness', target: 'Power', percent: 4 },
  // Target the Weak (Necromancer, Curses, Minor Grandmaster) — "Gain condition damage based on your
  // precision." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|Gain|Condition
  // Damage|Precision|13}}`, no game-mode split). This trait's other effect (crit chance per
  // condition on the foe) is a skill modifier, not a character-stat gain — out of scope.
  { traitId: 810, source: 'Precision', target: 'ConditionDamage', percent: 13 },
  // Spiteful Fortitude (Necromancer, Spite, Major Master) — "Gain vitality based on a percentage of
  // your power." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|gain|Vitality|Power|10}}`, no
  // game-mode split). This trait's other effect (life force on striking a foe below the health
  // threshold) is a resource-gain proc, not a character-stat gain — out of scope.
  { traitId: 829, source: 'Power', target: 'Vitality', percent: 10 },
  // Fell Beacon (Necromancer, Scourge, Major Adept) — "Gain expertise based on your condition
  // damage." Wiki-verified 2026-08-12: split game mode=pve 7 / game mode=pvp wvw 4; WvW value is 4.
  // This trait's other effect (burning damage increase) is a skill modifier, not a character-stat
  // gain — out of scope.
  { traitId: 2074, source: 'ConditionDamage', target: 'ConditionDuration', percent: 4 },
  // Implacable Foe (Necromancer, Harbinger, Major Master) — "Gain ferocity based on your vitality."
  // Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|Gain|Ferocity|Vitality|13}}`, no game-mode
  // split). This trait's other effect (stability + damage reduction on Harbinger Shroud entry, split
  // pve 5 stacks/wvw pvp 3 stacks) is a shroud-entry proc, not a character-stat gain — out of scope.
  { traitId: 2192, source: 'Vitality', target: 'CritDamage', percent: 13 },
  // Dark Gunslinger (Necromancer, Harbinger, Major Master) — "Gain expertise based on your vitality."
  // Wiki-verified 2026-08-12: split game mode=pve 10 / game mode=pvp wvw 13; WvW value is 13. This
  // trait's other effect (pistol skill recharge reduction) is a skill modifier, not a character-stat
  // gain — out of scope.
  { traitId: 2209, source: 'Vitality', target: 'ConditionDuration', percent: 13 },
  // Twisted Medicine (Necromancer, Harbinger, Major Master) — "Gain concentration based on your
  // vitality." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|Gain|Concentration|Vitality|13}}`,
  // no game-mode split). This trait's other effect (elixir boons shared with nearby allies) is a
  // skill modifier, not a character-stat gain — out of scope.
  { traitId: 2220, source: 'Vitality', target: 'BoonDuration', percent: 13 },
  // Great Fortitude (Warrior, Strength, Major Master) — "Gain vitality and ferocity based on a
  // percentage of your power." Wiki-verified 2026-08-12 (raw wikitext:
  // `{{skill fact|Gain|Vitality|Power|10}}` + `{{skill fact|Gain|Ferocity|Power|10}}`, no game-mode
  // split on either). Both clauses are unconditional and both convert from Power (the wiki flags a
  // discrepancy with 2021-05-11 patch notes claiming the ferocity half converts from Vitality
  // instead, but the trait's actual current data and description both agree on Power).
  { traitId: 1449, source: 'Power', target: 'Vitality', percent: 10 },
  { traitId: 1449, source: 'Power', target: 'CritDamage', percent: 10 },
  // Wounding Precision (Warrior, Arms, Major Adept) — "Gain expertise based on your precision."
  // Wiki-verified 2026-08-12 (raw wikitext): split game mode=pve 7 / game mode=pvp wvw 4; WvW
  // value is 4.
  { traitId: 1455, source: 'Precision', target: 'ConditionDuration', percent: 4 },
  // Vigorous Shouts (Warrior, Tactics, Major Master) — "Gain healing power based on your power," a
  // standalone unconditional clause alongside this trait's shout-heal-coefficient facts (excluded —
  // same proc shape as Healer's Gift). Wiki-verified 2026-08-12 (raw wikitext:
  // `{{skill fact|gain|Healing Power|Power|13}}`, no game-mode split).
  { traitId: 1470, source: 'Power', target: 'Healing', percent: 13 },
  // Blood Reaction (Warrior, Berserker, Major Adept) — "A percentage of precision is given as a
  // bonus to ferocity and a percentage of power is given as a bonus to condition damage. These
  // bonuses are doubled in berserk mode." Wiki-verified 2026-08-12 (raw wikitext): both conversions
  // are always-active base values (matching Forceful Greatsword's shape — the berserk-mode doubling
  // isn't materialized as a separate fact, it's a multiplier on these same base values, so only the
  // base is added here; the doubling itself is a new sub-variant of the shroud/stance-gated family
  // already flagged — a *multiplier* on an existing conversion rather than an additive bonus).
  // Precision→Ferocity is a genuine 3-way split: game mode=pve 12 / pvp 10 / wvw 5; WvW value is 5.
  // Power→Condition Damage splits game mode=pve 12 / pvp wvw 10; WvW value is 10.
  { traitId: 2011, source: 'Precision', target: 'CritDamage', percent: 5 },
  { traitId: 2011, source: 'Power', target: 'ConditionDamage', percent: 10 },
  // Wellspring (Ranger, Nature Magic, Major Master) — "You and your pet gain healing power based on
  // power," a standalone unconditional clause alongside this trait's regeneration-on-healing-skill
  // proc (excluded — not a stat grant). Wiki-verified 2026-08-12 (raw wikitext:
  // `{{skill fact|Gain|Healing Power|Power|7}}`, no game-mode split). The wiki separately notes an
  // in-game rounding anomaly where the actual gain computes to 6.5% rather than 7% — using the
  // declared fact value (7%) here, same convention as every other curated trait in this table.
  { traitId: 978, source: 'Power', target: 'Healing', percent: 7 },
  // Practiced Tolerance (Thief, Critical Strikes, Major Adept) — "Gain ferocity based on your
  // precision." Wiki-verified 2026-08-12 (raw wikitext): split game mode=pve 10 / game mode=pvp wvw
  // 15; WvW value is 15.
  { traitId: 1272, source: 'Precision', target: 'CritDamage', percent: 15 },
  // Marauder's Resilience (Thief, Daredevil, Major Adept) — "Gain vitality based on a portion of your
  // power." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|gain|Vitality|Power|7}}`, no
  // game-mode split). This trait's other effect (incoming-damage reduction within a range threshold)
  // is a damage modifier, not a character-stat gain — out of scope.
  { traitId: 1933, source: 'Power', target: 'Vitality', percent: 7 },
  // Strength of Shadows (Thief, Specter, Major Adept) — "Gain expertise based on a percentage of your
  // vitality." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|Gain|Expertise|Vitality|13}}`,
  // no game-mode split). This trait's other effect (torment damage increase, split pve 20%/wvw pvp
  // 25%) is a damage modifier, not a character-stat gain — out of scope.
  { traitId: 2264, source: 'Vitality', target: 'ConditionDuration', percent: 13 },
  // Second Opinion (Thief, Specter, Major Adept) — "A portion of condition damage is converted to
  // healing power." Wiki-verified 2026-08-12 (raw wikitext:
  // `{{skill fact|Gain|Healing Power|Condition Damage|7}}`, no game-mode split). This trait's flat
  // Condition Damage half is added separately above.
  { traitId: 2284, source: 'ConditionDamage', target: 'Healing', percent: 7 }
]

/**
 * Every trait currently active on a build: every Minor trait of an equipped specialization line
 * (auto-granted, no selection needed) plus whichever Major trait was actually chosen per tier.
 * Exported for reuse by `combat-state.ts`'s fury-gated trait-bonus tables, which need the exact
 * same "is this trait live on this build" check.
 */
export function activeTraitIds(build: Build, traitsById: Map<number, Trait>): Set<number> {
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
