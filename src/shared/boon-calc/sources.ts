import type {
  Build,
  Consumable,
  EquipmentSlotKey,
  Fact,
  Familiar,
  Infusion,
  ItemStat,
  ItemStatLegalIds,
  Legend,
  Pet,
  Profession,
  Relic,
  RelicEffectsById,
  RelicFactLine,
  Rune,
  Sigil,
  Skill,
  SoulbeastBeastmodeMap,
  TomeChapter,
  TomeChaptersByTomeId,
  Trait,
  WvwFactOverride,
  WvwFactOverrides
} from '../types'
import { isAuraName, isBoonName, isConditionName } from './constants'
import { boonDurationPercent, computeGearAttributeTotals, conditionDurationPercent, isActiveWeaponSlot } from '../gear-calc/attribute-totals'
import { WEAVER_SPEC_ID, weaponSkillIdsForPair } from '../weapon-calc/weapon-skills'
import { bundleCapableSkillIds, bundleSkillIdsForBuild } from '../skill-calc/bundle-skills'
import { branchConditionalFacts } from '../skill-calc/branch-conditional-facts'
import { WEAPON_STRENGTH_MIDPOINTS } from '../skill-calc/damage-calc'
import {
  catalystJadeSphereBar,
  CATALYST_SPEC_ID,
  conduitReleasePotentialBar,
  CONDUIT_SPEC_ID,
  engineerToolbeltBar,
  evokerFamiliarBar,
  professionMechanicBar,
  RANGER_BEASTMODE_SPEC_ID
} from '../skill-calc/profession-mechanic'
import { EVOKER_SPECIALIZATION_ID } from '../skill-calc/familiar'
import { unleashedWeaponOneId, UNTAMED_SPEC_ID } from '../skill-calc/untamed-unleash'
import { isNonActionableFlipTarget } from '../skill-calc/non-actionable-flip-targets'
import { resolvedFlipSkillId } from '../skill-calc/flip-skill-overrides'
import { ADDITIVE_FLIP_PAIRS } from '../skill-calc/additive-flip-pairs'
import { TURRET_SUB_ABILITY_IDS } from '../skill-calc/turret-sub-abilities'
import { MANTRA_FINAL_CHARGE_IDS } from '../skill-calc/mantra-final-charge'

export type BoonConditionCategory = 'boon' | 'condition' | 'aura'

export interface BoonConditionSource {
  sourceKind: 'skill' | 'trait' | 'relic'
  sourceId: number
  sourceName: string
  sourceIcon: string
  boonOrConditionName: string
  isCondition: boolean
  /** 'aura' entries only ever come from `computeAuraSources` — `computeBoonConditionSources` (and
   *  everything built on it: squad views, the in-build skill tooltips) only ever produces
   *  'boon'/'condition', unchanged from before this field existed. */
  category: BoonConditionCategory
  baseDurationSeconds: number
  /** `baseDurationSeconds` scaled by the build's gear-derived boon/condition duration % — 'aura'
   *  entries are never scaled (Concentration/Expertise only affect boons/conditions), so this
   *  always equals `baseDurationSeconds` for those. */
  scaledDurationSeconds: number
  applyCount: number
  requiresTraitId: number | null
  /**
   * How many allies this source's facts say it can reach at once — read straight from the GW2
   * API's own `type: "Number", text: "Number of Allied Targets"` fact when the skill/trait carries
   * one, else `TARGET_COUNT_OVERRIDES`' curated decision, else `null` (see `resolveTargetCount`).
   * `null` means "unknown," not "self-only": a full scan of data/game-data/skills.json this session
   * found the API omits ANY target-count fact (`"Number of Allied Targets"` or the enemy-facing
   * `"Number of Targets"`) on plenty of genuinely party-wide effects (Engineer's Healing Turret,
   * Mesmer's Lesser Chaos Storm, Elementalist's Tidal Surge/Infusion Bomb — all pulse a boon to
   * nearby allies with zero Number fact of any kind), so absence can't be read as "self-only" the
   * way an earlier pass assumed — `TARGET_COUNT_OVERRIDES` now covers every such source a 2026-08-06
   * sweep found (see its own doc comment; NOT every candidate turned out party-wide on inspection —
   * e.g. Ranger's "Guard!" has a Radius fact but its Might is confirmed self-only by the wiki, a
   * radius alone isn't sufficient evidence any more than a Number fact's absence is). The enemy-
   * facing `"Number of Targets"` fact is deliberately never used as a fallback either — it's
   * ambiguous on skills that hit foes AND self simultaneously (e.g. Elementalist's Grinding Stones:
   * Stability to self only, damage to up to 3 foes, both sharing one "Number of Targets" fact) vs. a
   * handful that reuse the same label for an ally count instead (Healing Rain, Healing Seed, Heat
   * Wave, and — confirmed this sweep — Healing Turret's id 5857 variant). [Note: an earlier version
   * of this comment misidentified Heat Wave as belonging to the first ("ambiguous, self-only")
   * group — the Elementalist leg (2026-08-07) wiki-confirmed it actually belongs to the second
   * ("reused as ally count") group instead, and it's now curated as party-wide in the table below.]
   *
   * **Per-buff-line resolution (added 2026-08-11):** resolved once PER BUFF FACT (not once per
   * source) via `resolveTargetCount`, which is called from inside `extractFromFacts`'s per-fact
   * loop. A source's `TARGET_COUNT_OVERRIDES` entry can be a flat `TargetCountOverride` (the
   * original shape, applies uniformly to every boon line the source emits — still the overwhelming
   * majority of entries) OR one of `SourceTargetCountOverride`'s per-line shapes: a `status`-keyed
   * map (different boon STATUSES on one source reach different counts — e.g. Guardian's Tome of
   * Courage: self Aegis, party Stability/Protection), a trait-conditional (the WHOLE source's reach
   * flips between two values depending on whether some OTHER trait is chosen — e.g. Willbender's
   * Phoenix Protocol: self unless Battle Presence is also chosen), or a legend-conditional (same
   * idea, gated on an EQUIPPED legend rather than a chosen trait — e.g. Revenant's Gladiator's
   * Defense: self unless Legendary Dwarf Stance is also equipped). See `SourceTargetCountOverride`'s
   * own doc comment and `TARGET_COUNT_OVERRIDES`' "Per-buff-line resolved conflicts" section for the
   * concrete entries. A conditional override that resolves via its "active" branch also appends a
   * `+ <TraitOrLegendName>` suffix to the emitted source's `sourceName` (see `extractFromFacts`), so
   * e.g. a party-wide Gladiator's Defense row reads "Gladiator's Defense + Dwarf Stance" rather than
   * looking indistinguishable from a source that's unconditionally party-wide — the reach depends on
   * a DIFFERENT skill/trait than the one on the row, which needs to stay visible without requiring
   * that legend to be the currently-*displayed* one (same "every equipped alternate always
   * contributes" convention as `RevenantSkillSelection.legends`/`activeLegendIndex` itself).
   */
  targetCount: number | null
  /**
   * The specific legend this boon/condition line is gated on, when the source is a `PrefixedBuff`
   * fact naming one — e.g. Invocation's Spirit Boon: each of its 8 boon lines carries a
   * `prefix.status` of "Legendary <X> Stance" naming exactly which legend-swap grants it (see
   * `resolveLegendFromPrefix`). `undefined` for every ordinary `Buff` fact and for a `PrefixedBuff`
   * whose `prefix.status` doesn't name a legend (e.g. Salvation's Serene Rejuvenation names a set of
   * skills, not a legend) — deliberately narrow, unlike the general "resolve `prefix.status` to a
   * specific id" case `Fact`'s own doc comment says NOT to attempt (ambiguous for skills; the fixed
   * 8-entry legend list has no such ambiguity).
   */
  legendIcon?: string
  legendName?: string
  /**
   * A wiki-sourced qualifier distinguishing this fact from another on the SAME source sharing the
   * SAME `boonOrConditionName` — e.g. Fire Bomb's "Initial Burning" (5s×2) vs "Pulse Burning" (2s),
   * Pain Absorption's unlabeled base Resistance (3s) vs "Self-Resistance per Condition" (1s). TODO.md
   * bug entry: "Multiple same-status Buff facts on one skill render as unlabeled duplicate rows" — a
   * full scan of `data/game-data/{skills,traits}.json` (after excluding sources already resolved by
   * `WvwFactOverrides`, which collapses a same-status PAIR that's really the SAME grant split
   * per-game-mode with no `alt=` wording — see `Unrelenting Assault`'s WvW-override entry for that
   * case) found 255 sources with 2+ genuinely simultaneous facts sharing one status: 204 skills + 51
   * traits. `undefined` (renders no qualifier) both for sources with only one fact per status AND for
   * an uncurated conflict source — this field is populated ONLY from `BUFF_INSTANCE_LABELS`, one
   * source at a time, each entry checked against that source's own wiki page's `{{skill fact}}`
   * `alt=` labels (see `BUFF_INSTANCE_LABELS`'s own doc comment for the key format and current
   * curation coverage).
   */
  instanceLabel?: string
  /**
   * A short, wiki-quoted trigger qualifier for a source whose boon/condition only applies on a
   * specific player action rather than unconditionally on cast/equip — currently only "On Dodge"/
   * "On Evade" (TODO.md's dodge-roll item, flagged by the user 2026-08-07: "trait procs already
   * modeled as ordinary facts... likely already flow into totals today... not a calc gap, just
   * nothing labels it 'from dodging' anywhere in the UI"). Populated ONLY from
   * `DODGE_TRIGGER_NOTES` — every OTHER source (the overwhelming majority) leaves this `undefined`
   * and renders no qualifier, same "opt-in curated table, fails open" convention as `instanceLabel`/
   * `BUFF_INSTANCE_LABELS`. Deliberately narrow in scope: a trait/skill's OWN tooltip already shows
   * its full wiki description above its facts (where "Gain might when you dodge" is already
   * visible), so this field only matters for the AGGREGATE Boon/Condition summary panel
   * (`BoonConditionSummaryPanel`/`SlotTile`), which pools sources by boon name and shows only
   * name/icon/duration with no per-source description — that's the one place a dodge-gated source
   * looks indistinguishable from an unconditional one. Whole alternate dodge-replacement mechanics
   * (Vindicator's Legendary Alliance dodge, Mirage Cloak) and relic dodge-triggers with no skill id
   * at all are a separate, still-open TODO.md problem this field doesn't attempt to solve.
   */
  triggerNote?: string
}

/** A wiki-confirmed decision for a source with no target-count fact of its own (`resolveTargetCount`
 *  would otherwise return `null`): a number is the confirmed ally count to show instead; `'self'`
 *  documents "confirmed self-only, `null` is correct" so a future sweep doesn't re-research it. */
export type TargetCountOverride = number | 'self'

/** A `TARGET_COUNT_OVERRIDES`/`CONDITION_CLEANSE_TARGETS` entry whose reach flips between two
 *  `TargetCountOverride`s depending on whether ANOTHER specific trait is chosen — see
 *  `BoonConditionSource.targetCount`'s doc comment ("per-buff-line resolution"). Applies to every
 *  boon line the source emits uniformly (unlike the per-status map shape below): the sources found
 *  needing this (Willbender's Phoenix Protocol) don't distinguish which of their own boon lines the
 *  OTHER trait affects — it broadens all of them at once. `traitName` is display-only, appended to
 *  the emitted source's `sourceName` (as `+ <traitName>`) when `whenActive` is the resolved branch. */
export interface TraitConditionalTargetCountOverride {
  gatedBy: 'trait'
  traitId: number
  traitName: string
  whenActive: TargetCountOverride
  otherwise: TargetCountOverride
}

/** Same shape as `TraitConditionalTargetCountOverride`, gated on an EQUIPPED Revenant legend
 *  (`Legend.id`, e.g. `'Legend3'` for Legendary Dwarf Stance) instead of a chosen trait — see
 *  `equippedLegendIds`. `legendId` is checked against BOTH equipped legend slots (whichever one
 *  currently holds it), the same "every equipped alternate always contributes regardless of which
 *  is displayed" convention `RevenantSkillSelection.activeLegendIndex`'s own doc comment documents
 *  for legends generally — the gating legend doesn't need to be the build's *currently active* one,
 *  only equipped in either slot. */
export interface LegendConditionalTargetCountOverride {
  gatedBy: 'legend'
  legendId: string
  legendName: string
  whenEquipped: TargetCountOverride
  otherwise: TargetCountOverride
}

/**
 * A source's full target-count decision — the original flat `TargetCountOverride` (still correct
 * for the vast majority of sources, which reach the same count on every boon line they grant) widened
 * to also allow the 3 per-buff-line shapes `BoonConditionSource.targetCount`'s doc comment describes:
 *  - `Record<string, TargetCountOverride>`: keyed by the boon/condition `status` name (e.g. `Might`,
 *    `Aegis`) for sources where DIFFERENT statuses reach different counts. When the SAME status
 *    appears more than once on one source with genuinely different reaches (Revenant's Pain
 *    Absorption: "Resistance" both party-wide(3s) and self-only(1s)), key by `status@duration`
 *    instead (e.g. `'Resistance@3'`) — `resolveTargetCount` tries the composite key first, falling
 *    back to the bare status name. Every entry in this map still gated by the fact's own
 *    `requires_trait` as usual (`extractFromFacts` skips facts for inactive traits before this map
 *    is ever consulted), so a status that only exists in a trait-gated form doesn't need special
 *    handling here beyond its own override value.
 *  - `TraitConditionalTargetCountOverride` / `LegendConditionalTargetCountOverride`: the whole
 *    source's reach flips based on a build-state check outside the fact data itself (an unrelated
 *    trait choice, or an equipped legend) — see each type's own doc comment.
 */
export type SourceTargetCountOverride = TargetCountOverride | Record<string, TargetCountOverride> | TraitConditionalTargetCountOverride | LegendConditionalTargetCountOverride

/** Narrows a `SourceTargetCountOverride` to the original flat shape — used by tooling
 *  (`scripts/fetch-target-counts.ts`/`fetch-balance-patch-changes.ts`) that diffs a curated value
 *  against a single wiki-parsed number and has no way to diff a per-buff-line/conditional entry the
 *  same way (there's no single "the" value to compare — see each conditional type's own doc
 *  comment). */
export function isFlatTargetCountOverride(override: SourceTargetCountOverride): override is TargetCountOverride {
  return typeof override === 'number' || override === 'self'
}

/**
 * Curation sweep (2026-08-06) of every skill/trait that grants a tracked boon (`BOON_NAMES`) with a
 * `Radius` fact but no `Number` fact of any kind — the bucket `BoonConditionSource.targetCount`'s doc
 * comment calls out by name (Healing Turret, Symbol of Protection, "Guard!", etc.). Each entry below
 * was checked against its own wiki page (and, where the boon is trait-gated, the gating trait's own
 * page) rather than assumed from the `Radius` fact's mere presence — several skills here have a
 * `Radius` fact for an unrelated area (a trap's foe-trigger zone, a gadget's knockdown puddle, a
 * teleport's landing circle) while the boon itself is actually self-only, and would have been
 * mis-curated as party-wide by that heuristic alone. Where the wiki doesn't state an explicit ally
 * cap, 5 is used — GW2's standard "nearby allies" pulse cap, confirmed explicitly on enough sources
 * in this same sweep (Healing Turret, Phalanx Strength, Tidal Surge, Chaos Storm) to treat as the
 * default for the rest rather than a guess.
 *
 * Deliberately NOT covered here: the much larger ~399-entry "ambiguous `Number of Targets`" bucket
 * (the OTHER half of the same TODO.md item) — that fact's ambiguity (enemy-hit count on some skills,
 * reused as an ally count on others, e.g. Healing Rain) needs its own separate sweep, not this one.
 * Was NOT covered here until 2026-08-11: Tome of Courage (ids 42259/42371/68646/68650) and the
 * Willbender's Phoenix Protocol (trait 2195) — both found to have a genuine mix of self-only and
 * party-wide boons in the SAME facts array depending on which OTHER trait is chosen (Guardian's
 * Inspired Virtue/Indomitable Courage; Willbender's Battle Presence), which this table's original
 * one-value-per-source shape couldn't express. **RESOLVED 2026-08-11** via the new per-buff-line
 * model (`SourceTargetCountOverride`, see `BoonConditionSource.targetCount`'s doc comment) — Tome of
 * Courage is now a per-status map (self Aegis, party Stability/Protection, self Resolution — see its
 * own entry below for why Resolution isn't party too); Phoenix Protocol is now a
 * `TraitConditionalTargetCountOverride` gated on Battle Presence (554), since ALL of its boon lines
 * (Alacrity/Regeneration/Resolution) broaden together rather than individually — confirmed via its
 * own `traitedFacts`: a single Radius(600) fact gated on 554 is the only trait-conditioned fact on
 * the whole source, with no per-status split in the base Buff facts themselves.
 *
 * Also NOT covered: Thief's Pitfall (skill 56880). Its Might `Buff` fact only exists in
 * `traitedFacts` gated on Even the Odds (trait 1169) — Even the Odds' own description ("Apply
 * vulnerability when you steal. Apply conditions when you hit with a stealth attack.") has nothing
 * to do with Might, and the wiki flags this exact combination as a confirmed tooltip bug ("If the
 * Even the Odds trait is active, the tooltip will falsely display granting Might 5"). Since the
 * grant itself isn't real, neither `'self'` nor a number would be a correct answer — left out
 * entirely rather than curating a boon that doesn't actually happen.
 *
 * Was NOT covered here until 2026-08-11: Necromancer's Well of Power (ids 10609, 10673). A genuine
 * per-buff-line split, same shape as Tome of Courage/Phoenix Protocol above — the wiki's own notes
 * are explicit: "Only the stability and stun break are exclusively applied to the caster upon cast,"
 * while "[o]ne stack of Might is applied to allies in range every pulse." **RESOLVED 2026-08-11** as
 * a per-status map: self Stability, party(5) Might — the two statuses never collide so no composite
 * `status@duration` key is needed even though Might itself has 2 differently-timed Buff facts (both
 * party-wide, same value either way).
 *
 * Was NOT covered here until 2026-08-11: Necromancer's Mark of Blood (skill 19117). Its base,
 * unconditioned Regeneration is confirmed party-wide ("grants regeneration to allies," own
 * Radius(240)/Number-of-Targets(5)) — but the Transfusion-trait-gated (778) Vigor is a different
 * mechanic entirely: Transfusion's own description is "Marks can be triggered by allies to heal them
 * and provide them with additional benefits," meaning only the ONE ally who steps on and triggers the
 * mark receives Vigor, not up to 5 simultaneously. **RESOLVED 2026-08-11** as a per-status map:
 * party(5) Regeneration, party(1) Vigor (not `'self'` — same "one ally per mark trigger" mechanic
 * already curated for Chillblains/Reaper's Mark/Lesser Chilblains above).
 *
 * Was NOT covered here until 2026-08-11: Revenant's Pain Absorption (ids 27322, 78505). Its own
 * description states "Grant resistance to yourself and nearby allies. Absorb conditions from those
 * allies, gaining resolution and additional resistance per condition" — the API backs this with
 * THREE separate unconditioned Resistance/Resolution `Buff` facts of different durations (party-wide
 * base Resistance at 3s, a self-only "additional resistance per condition" bonus Resistance at 1s,
 * and a self-only Resolution at 5s), i.e. the very same "Resistance" status appears twice on one
 * source with two different reaches (a fourth Resistance fact, trait-gated on Demonic Defiance/1789,
 * is separately confirmed self-only — see that trait's own "gain resistance" first-person text).
 * **RESOLVED 2026-08-11** as a `status@duration`-keyed per-status map — the only source in this sweep
 * that actually needed the composite key, since bare `Resistance` alone can't disambiguate its 3
 * same-status facts: `Resistance@3` party(5), `Resistance@1` self, `Resistance@5` self (the
 * Demonic-Defiance-gated one), bare `Resolution` self (only 1 Resolution fact, no collision).
 *
 * Was NOT covered here until 2026-08-11: Revenant's Gladiator's Defense (skill 77291). Wiki confirms
 * its boons (Weakness is a condition, ignore; Resolution/Resistance are the tracked boons) are
 * self-only by default, but its "Resonance" note states that when Legendary Dwarf Stance is equipped
 * the SAME boons are "also granted to allies in a radius around you" — an explicit `Additional Allies
 * Affected: 4` fact confirms the expanded reach (self + 4 = the standard 5). This is a
 * legend-equipped conditional, not a `requires_trait` gate the fact data can express on its own.
 * **RESOLVED 2026-08-11** as a `LegendConditionalTargetCountOverride` gated on `'Legend3'` (Legendary
 * Dwarf Stance's `Legend.id`) — applies to both Resolution and Resistance uniformly (both flip
 * together, no per-status split needed here unlike Pain Absorption above) via `equippedLegendIds`,
 * which checks BOTH equipped legend slots the same way `activeTraitIds` checks every equipped
 * specialization line, not just whichever legend is currently toggled active.
 *
 * Revenant leg (6th leg, 2026-08-06): 33 skills + 6 traits curated (2 skills excluded as above), plus
 * 2 leftover "no profession tag" skills (Invoke Torment 59591, Lesser Chilblains 76506) that a fresh
 * rescan turned up outside the original no-profession-tag leg's scan — Lesser Chilblains repeats the
 * Necromancer leg's Transfusion (trait 778) one-ally mark-trigger mechanic exactly (targetCount 1,
 * not 5 or 'self'), confirming that pattern generalizes beyond the base Chillblains/Reaper's Mark
 * pair it was first found on.
 *
 * Warrior leg (4th, 2026-08-06): 23 skills + 1 trait, no exclusions needed. Confirmed the same
 * first-person-phrasing tell as the Necromancer leg, extended to a subset (Sundering Leap, Wild
 * Blow, Shattering Blow, Gunstinger, Crushing Blow) where the boon doesn't appear in the skill's own
 * description text at all — checked each one's wiki page too, none states allies wording either, so
 * "no allies wording anywhere" was treated as equally reliable as explicit first-person phrasing.
 *
 * Ranger leg (7th leg, 2026-08-06/07): 37 skills + 6 traits, no exclusions needed. New recurring
 * pattern: several skills grant their tracked boon specifically "to your pet" (Precision Swipe,
 * Feeding Frenzy, Ancestral Grace's Protection line) — wiki-confirmed self-only for all three, since
 * a pet is a fixed companion, never one of the squad allies this app tracks (consistent with the
 * pre-existing "Guard!"/Lesser "Guard!" self-only entries above, which cover the reverse case: boon
 * granted to the ranger FROM the pet's action). Also confirmed Untamed's Let Loose (trait 2271,
 * "Unleashed Ambush skills grant boons to nearby allies") is a separate unconditioned bonus layered
 * on top of any Unleashed Ambush skill use, NOT a `requires_trait` gate on those skills' own Buff
 * facts — so Unleashed Thump/Relentless Whirl's own self-only Might/Fury/Stability facts are curated
 * independently (self) rather than assumed party-wide from the trait's existence, while Solar
 * Brilliance's own explicit "healing nearby allies" wording makes it party-wide on its own merits.
 *
 * Mesmer leg (8th leg, 2026-08-07): 22 skills + 12 traits, no exclusions needed. A rescan with a fixed
 * extraction script (the prior scan's brace-matcher grabbed the TYPE annotation's `{ skill: ...; trait:
 * ... }` braces instead of the object literal that follows `=`, so it never actually excluded any
 * already-curated id) found the true remaining pool was Mesmer (34), not Guardian (39) as the previous
 * session's rescan had claimed — picked Mesmer instead as the genuinely smaller leg. Two skills needed
 * a wiki raw-wikitext check to settle a same-shape-as-Heat-Wave ambiguity (self-scaling buff alongside
 * an unrelated ally-facing heal, both undifferentiated in the description): Effervescence's Vigor has
 * no `allied targets` wiki fact and its stack count matches the skill's own hit count (self-only), while
 * Journey's Regeneration does carry an explicit `allied targets|5` fact (party-wide) — same wording
 * ("damaging enemies and healing allies"), opposite answers. Also confirmed Time Warp's two ids (10311,
 * 10377) share one wiki-documented ally cap of 5 despite 10377's own game-data Number-of-Targets fact
 * reading 10 — that fact is the enemy-facing/shared count, not the true ally cap.
 *
 * Guardian leg (9th leg, 2026-08-07): 45 skills + 3 traits resolved, 1 trait (Holy Reckoning, 2210)
 * excluded at the time — a new instance of the mixed self/party-wide-under-one-source gap this table
 * couldn't yet express (see this table's top comment): its Might line ("Triggered virtue
 * effects...now grant might to allies") is party-wide, but its Fury line ("Gain fury when activating
 * Rushing Justice") is self-only, and both share the same single Radius(360)/Number-of-Targets(5)
 * fact with no `requires_trait` split distinguishing them. **RESOLVED 2026-08-11** as a per-status
 * map (party(5) Might, self Fury) — the 3 differently-timed Might Buff facts all share one value so
 * no composite key is needed. New recurring pattern this leg: the wiki's own "Symbol"
 * skill-type page states a blanket rule — "delivers a boon to allies that stand on it," except
 * Symbol of Ignition by name — used to resolve every Symbol skill's boon as party-wide even where the
 * skill's own tooltip omits "allies" wording entirely (Symbol of Spears, Symbol of Vengeance), and to
 * confirm Symbol of Ignition as the sole self-only exception on that page's say-so alone. Also
 * confirmed Inspired Virtue (trait 621, "Virtues apply boons to allies when activated") gates Virtue
 * of Justice/Virtue of Resolve/Wings of Resolve's boon facts party-wide via `requires_trait`, and
 * Shimmering Stances (trait 2410)/Resplendent Weaponry (trait 2330) do the same for the Luminary
 * spec's Stance/weapon skills — same trait-gate-carries-the-reach pattern as prior legs' Specter/
 * Ritualist wells. Guardian's two traps (Test of Faith, Dragon's Maw) share the established "on Trap
 * Trigger" self-reward phrasing with no allies wording anywhere on either wiki page — resolved
 * self-only, same "no allies wording anywhere" tell used throughout this sweep.
 *
 * Was NOT covered here until 2026-08-11: Elementalist's Overload Earth (skill 29618). Wiki confirms
 * its base (untraited) Stability is self-only ("Initial Stability... as a personal effect") while its
 * base Protection is party-wide ("the protection is granted to self too," despite the description
 * saying "other allies") — two different-reach boons on ONE source with no `requires_trait` (or any
 * other) gate distinguishing them, sharing the same Radius(240)/Number-of-Targets(5) fact. Same shape
 * as Holy Reckoning above. **RESOLVED 2026-08-11** as a per-status map: self Stability (also covers a
 * `requires_trait`-gated Stability apply-count upgrade — same self-only mechanic, just more stacks),
 * party(5) Protection.
 *
 * Was NOT covered here until 2026-08-11: Elementalist's Hare's Agility (skill 76583). Its base
 * Swiftness is self-only (wiki: "applies only to the caster," matching the skill's own first-person
 * "Gain endurance and swiftness"); Altruistic Aspect (trait 2415, "Meditation skills grant boons to
 * allies") separately confirms it adds Fury to up to 5 nearby allies specifically for this skill when
 * traited — a real, documented addition, not an undocumented quirk, but still a self-only base boon
 * and a party-wide trait-gated boon sharing one source. **RESOLVED 2026-08-11** as a per-status map:
 * self Swiftness, party(5) Fury (the Fury fact's own `requires_trait: 2415` already gates it to only
 * emit when Altruistic Aspect is chosen, same as every other trait-gated fact). Contrast with Otter's
 * Compassion and Toad's Fortitude below, the other two Altruistic-Aspect-affected meditations this
 * leg — both curated normally because their OWN base boons are already party-wide by their own
 * description, so the trait's added boon (Regeneration / Stability respectively) shares the same
 * reach rather than conflicting with it.
 *
 * Elementalist leg (10th and final leg of the Group A sweep, 2026-08-07): 51 skills + 5 traits
 * resolved (2 skills excluded, above), closing out Group A entirely — see TODO.md. 20 of the 51
 * skills are all "Deploy Jade Sphere" (the Catalyst's jade-sphere-element profession mechanic, ids
 * 62723/62813/62837/62940/63396/63416/63439/63454/63458/63459/63461/63472/75391/75392/75394/75395/
 * 75399/75405/75406/75407) sharing one description across every element/tier variant — "granting
 * boons to allies in its radius based on its element" — and one shared "Number of Targets: 5" fact
 * reused as the ally count (same reused-label shape as Healing Rain/Heat Wave). Corrected a stale
 * claim in this table's top doc comment: Heat Wave (5600) was named there as an example of a
 * self-only Vigor grant, but this leg's wiki fetch found the opposite — "grants vigor to allies" is
 * accurate, backed by a single shared "targets|5" wiki fact — now curated party-wide, with the doc
 * comment's illustrative example swapped for a real self-only one (Grinding Stones). Two Cantrips
 * (Tornado, Cleansing Fire) gate a bonus boon behind Soothing Disruption (trait 364, "Cantrips grant
 * boons") — same trait already resolved self-only for Lightning Flash (5536, this table's first
 * entry) since the trait's own page has no allies/radius wording; both new cantrips follow the same
 * self-only precedent. Elementalist's three Shouts ("Flash-Freeze!", "Aftershock!", "Feel the
 * Burn!") each name only ONE of their boons explicitly as ally-facing in the skill's own description
 * (Frost/Magnetic/Fire Aura respectively) while leaving their other boons (Regeneration; Protection
 * and Aegis; Might and Fury) undescribed — wiki-checked each and confirmed all of a shout's boons
 * share the one party-wide reach, the standard GW2 shout mechanic. Six Dual-Attack/utility hammer
 * skills (Grinding Stones, Lahar, Glacial Drift, Katabatic Wind, Molten Burst, Lava Skin) all grant
 * Stability/Regeneration with zero allies wording in their own description — wiki-checked each
 * individually and confirmed self-only for five of them, with Katabatic Wind's wiki page notably
 * citing an explicit version-history bug-fix ("caused this skill to grant an improper version of the
 * regeneration boon to allies") as direct proof the boon was never intended for allies. The sixth,
 * Transmute Earth, is the one exception — wiki confirms its Stability reaches nearby allies via an
 * explicit "Boon Radius(600)" fact distinct from its "Attack Radius(240)," a good corroborating
 * signal for distinguishing a real ally-reach radius from an unrelated foe-facing one. Otter's
 * Compassion, Toad's Fortitude, and Hare's Agility (excluded, above) are Evocation-specialization
 * meditations, each gaining a bonus boon from Altruistic Aspect (trait 2415) — its own wiki page
 * documents it as a fixed per-meditation bonus-boon table (Otter's Compassion→Regeneration, Hare's
 * Agility→Fury, Toad's Fortitude→Stability, plus three non-Elementalist-relevant others), all capped
 * at 5 within a 360 radius.
 *
 * --- PrefixedBuff target-count sweep (2026-08-09) ---
 * A second, separate sweep from Group A above: the TODO.md follow-up left open by Session 133's
 * `PrefixedBuff` extraction fix (`extractFromFacts` now emits a `PrefixedBuff` fact's boon exactly
 * like an ordinary `Buff` fact, but `PrefixedBuff` sources were never in scope for Group A, which
 * predates that fix). Scoped to boon-classified facts only — `SkillsEditor.tsx` only ever renders
 * `targetCount` when `category === 'boon'`, so `PrefixedBuff` condition facts (e.g. Arcane
 * Precision's crit-triggered conditions) have no consumer for a curated value and are out of scope
 * by design, not overlooked.
 *
 * Original estimate (2026-08-09) was 35 distinct sources across 8 professions; that discovery pass
 * undercounted (method unrecorded, likely an eyeballed subset rather than an exhaustive scan).
 * 2026-08-10 correction: a programmatic re-scan (every `type === 'PrefixedBuff'` fact with an
 * `isBoonName` status on both `skills.json`/`traits.json`, filtered against the *actual* top-level
 * keys already present in `TARGET_COUNT_OVERRIDES` rather than a text-presence check — several ids
 * only appeared in other sources' comments as a gate reference, e.g. trait 621/1678/778/2289, and a
 * naive "is this id anywhere in the file" check misreads that as already curated) found the true
 * total is 45 distinct sources across 9 professions (Thief wasn't in the original 8 at all). See
 * TODO.md for the corrected per-profession remaining count.
 *
 * Elementalist leg (1st leg, 2026-08-09 + correction 2026-08-10): 10 skills + 10 traits, all
 * confirmed self-only except the 3 the original pass missed (Elemental Attunement, Familiar's
 * Blessing, Altruistic Aspect — all party-wide(5), each wiki page's own `{{skill fact|targets|5}}`).
 * Every other source is an attunement/combo-based personal buff (Glyph of Elemental Harmony's heal,
 * Inscription riding on the Glyph of (Lesser) Elementals variants, Elemental Celerity, Unravel,
 * Arcane Lightning, Soothing Disruption, Elemental Lockdown, Swift Revenge, Elemental Synergy,
 * Enhanced Potency) with "Gain X" (first-person) wording throughout. See the skill/trait tables' own
 * leg comment for per-source detail. Leg now fully closed — 20/20 Elementalist sources curated.
 * Second correction (2026-08-10, found re-scanning ahead of the Guardian leg): 5 more Glyph of
 * Elemental Power ids (5506/34637/34714/34736/34772) the original scan missed entirely — same
 * Inscription-gated self-only reasoning as the already-curated Glyph of (Lesser) Elementals sibling
 * skill. True Elementalist total is 25/25, not 20/20; TODO.md's/this comment's earlier per-leg counts
 * are left as historical record rather than renumbered.
 *
 * Revenant leg (2nd leg, 2026-08-10): 1 skill + 6 traits, mixed self/party-wide (unlike the all-self
 * Elementalist leg) — party-wide entries are each corroborated by an explicit "Number of Allied
 * Targets" fact somewhere in the chain (Spirit Boon(5)/Bold Reversal(5)/Found Purpose(4) on the
 * source's own facts; Serene Rejuvenation(5) via its 3 linked Legendary Centaur skills' own facts).
 * Self-only: Ancient Echo (wiki: "All four effects only affect the caster"), Reaver's Curse (no ally
 * wording, corroborated against the structurally-parallel self-only Death Drop variant), Numinous
 * Gift (no Number/Radius fact at all; its party-wide counterpart is the separate Found Purpose id).
 * Leg now fully closed — 7/7 Revenant sources curated.
 *
 * Ranger leg (3rd leg, 2026-08-10): 6 skills + 2 traits, all 6 Untamed cantrips self-only (gated by
 * the Unleash Ranger F2 mechanic's two mutually-exclusive states — "Unleashed"/"Pet Unleashed" —
 * neither of which spreads to other squad members; no ally wording on any of the 6 wiki pages and no
 * Number-of-Allied-Targets/Radius fact tied to either PrefixedBuff variant on any of them). Enhancing
 * Impact (Untamed minor) same self-only reasoning ("grants YOU boons"). Cloudburst (Soulbeast) is
 * party-wide(5), corroborated by its own explicit "Number of Targets: 5"/Radius(480) facts and wiki
 * wording ("nearby allies"). Leg now fully closed — 8/8 Ranger sources curated.
 *
 * Guardian leg (4th leg, 2026-08-10): 1 skill + 3 traits, mixed self/party-wide. Party-wide: Glaring
 * Burst (76982, own explicit "Number of Targets: 5"/Radius(240), 2 of its 4 weapon-variant boon facts
 * wiki-confirmed ally-facing), Inspired Virtue (621, own explicit "Number of Targets: 5"/Radius(1200)
 * facts, "Virtues apply boons to allies when activated" — gates Virtue of Justice/Resolve/Courage's
 * own already-curated party-wide(5) boon facts), Legendary Lore (2116, Firebrand's Tome-skill analog
 * of Inspired Virtue, same boon set — vague on its own wording but a documented tooltip-bug note
 * explicitly names "allies" as the affected reach). Self-only: Zealous Scepter (1925, "Gain might...",
 * first-person, no Number/Radius fact). Leg now fully closed — 4/4 Guardian sources curated.
 *
 * Final leg (2026-08-10): the last 6 sources across 5 professions, combined into a single leg since
 * each remaining profession had only 1-2 sources left. Party-wide(5): Experimental Turrets (Engineer
 * 1678, ally-facing Radius(600) fact but no explicit Number fact — default-5 convention), Life of the
 * Party (Mesmer 2367, explicit "grant boons to affected allies" wording, same default-5 convention),
 * Shadestep (Thief 2289, own explicit Number-of-Targets(5)/Radius(360) facts), Roaring Reveille
 * (Warrior 1471, gates the already-curated party-wide(5) Charge/Call of Valor skills). Party, count 1:
 * Transfusion (Necromancer 778, the established "one ally per mark trigger" mechanic already curated
 * for its 4 gated skill ids). Self-only: Auspicious Anguish (Mesmer 673, "Convert damaging conditions
 * to boons whenever you gain Distortion or become disabled" — first-person throughout, no ally
 * wording anywhere). Sweep now fully closed — 45/45 sources curated across all 9 professions.
 *
 * --- Per-buff-line target-count model (2026-08-11) ---
 * TODO.md's "per-buff-line (not per-source) target-count model" item, closing the 7 genuine
 * same-source conflicts the two sweeps above kept finding and deliberately leaving uncurated (see
 * each one's own "Was NOT covered here until 2026-08-11" paragraph above for the full reasoning):
 * Tome of Courage, Phoenix Protocol, Well of Power, Mark of Blood, Pain Absorption, Gladiator's
 * Defense, and the Guardian leg's Holy Reckoning / Elementalist leg's Overload Earth and Hare's
 * Agility. `SourceTargetCountOverride` (see its own doc comment) widens a table entry from one flat
 * value to 3 shapes: a per-`status`(-or-`status@duration`) map, a `TraitConditionalTargetCountOverride`,
 * or a `LegendConditionalTargetCountOverride` — `resolveTargetCount` now runs once PER BUFF FACT
 * (inside `extractFromFacts`'s loop) instead of once per source. Thief's Pitfall (56880) stays
 * excluded — that one was never a target-count conflict, it's a confirmed wiki-documented tooltip
 * bug (the Might grant isn't real at all), so no override value would be correct.
 *
 * `CONDITION_CLEANSE_TARGETS`' own EXCLUDED list (see its doc comment) has several sources with the
 * exact same shape (Virtue of Resolve/Wings of Resolve, Diamond Skin, Grasping Shadows) that could
 * reuse this same mechanism — deliberately NOT curated in this pass (out of this TODO.md item's
 * scope, a separate table with its own backlog), but the resolution code (`resolveTargetCountFrom`)
 * is already shared, so a future pass just needs the per-source table entries, no new plumbing.
 */
// Exported for scripts/fetch-target-counts.ts (the wiki-extraction pipeline's target-count leg,
// TODO.md's "Wiki-sourced data pipeline" step 3) — same shape as damage-calc.ts's own
// CURATED_DAMAGE_COEFFICIENTS export for its pilot script.
export const TARGET_COUNT_OVERRIDES: { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> } = {
  skill: {
    // Cosmic Wisdom (Revenant/Conduit) — Found Purpose's boons reach 4 allies once it supersedes
    // Numinous Gift's self-only copies on this skill (see `FOUND_PURPOSE_TRAIT_ID`'s doc comment,
    // by `LEGEND_GATED_TRAIT_IDS`, for the full writeup). Keyed by `status@duration` since Numinous
    // Gift's own (self-only, no entry needed here — defaults to `null`) and Found Purpose's boons
    // share every status name, only distinguished by duration (Found Purpose's are always shorter).
    77371: { 'Fury@5': 4, 'Resistance@2': 4, 'Stability@2': 4, 'Protection@2': 4, 'Might@5': 4 },

    // Cry of Frustration (Mesmer core Shatter 2/F2, id 10190). Illusionary Defense's (trait 675,
    // see this table's own `675: 5` entry below) synthetic Protection copy reaches the same 5
    // nearby allies as the trait's own tooltip — scoped to just this status (bare key, both its
    // Base/Additional durations share the one reach) so it doesn't widen this skill's own Confusion
    // condition (foe-targeted, unrelated) to match.
    10190: { Protection: 5 },

    // Lightning Flash (Elementalist cantrip). Resistance only exists with Soothing Disruption
    // ("Cantrips grant boons") traited — that trait's own page states no radius/ally wording, and
    // unlike every confirmed party-wide entry below, no Radius fact is gated to the Resistance fact
    // itself (the skill's own Radius(120) is the teleport landing circle, unrelated). Self-only.
    5536: 'self',
    // Healing Turret (Engineer heal, this specific id has no local Number fact — a sibling id 5857
    // does carry one, itself part of the separate ambiguous-fact bucket this sweep excludes).
    // Wiki confirms "regenerates you and your allies," Radius(480) tied directly to the Regeneration
    // fact, and an explicit "Number of Targets: 5" on the tooltip.
    6140: 5,
    // "Guard!" (Ranger pet command). Wiki confirms the pet's damage-redirect ("guard") effect reaches
    // 5 allies via Radius(600), but the Might itself is explicitly self-only: "Gain might when your
    // pet receives damage" — granted to the ranger, not the guarded allies. Same for Lesser "Guard!".
    12632: 'self',
    69183: 'self',
    // Lesser Chaos Storm (Mesmer phantasm proc). Description states outright: "applies random
    // conditions to foes and boons to allies." The full Chaos Storm's own wiki page confirms a single
    // "Number of Targets: 5" fact shared between foes and allies (no separate allied-only count).
    13733: 5,
    // Bandage Self (Engineer heal). Protection is gated on Expert Examination (1999), whose own page
    // confirms "grants protection to nearby allies" — wiki notes this specific grant actually comes
    // from the associated toolbelt skill's use, not Bandage Self itself, but the API attaches the
    // fact to this skill id regardless, so the party-wide reach is what would display if it renders.
    29772: 5,
    // Infusing Terror (Necromancer Reaper Shroud). Wiki confirms Stability is granted "upon initial
    // activation of the shroud" to the necromancer only; Radius(360) is the separate fear pulse on
    // foes when the skill is reactivated, unrelated to the Stability grant. Self-only.
    29958: 'self',
    // Purification / Procession of Blades / Light's Judgment (Guardian traps). All three share the
    // same "Boon on Trap Trigger" tooltip template with no allies wording — wiki confirms Purification
    // and Procession of Blades are self-only ("benefits only the activating player" / no ally
    // mention); Light's Judgment follows the same template and is treated the same way. Their Trigger/
    // Attack Radius facts are the trap's foe-detection and damage area, unrelated to the boon.
    30025: 'self',
    30364: 'self',
    30871: 'self',
    // Slick Shoes (Engineer gadget, both ids). Wiki: "the stability benefit is granted to the
    // engineer performing the action, not to nearby allies" — Radius is the oil-slick knockdown puddle
    // behind the engineer, unrelated to Stability.
    30828: 'self',
    50472: 'self',
    // Tidal Surge (Elementalist water). Wiki confirms "the user and 4 other allies" (5 total) via the
    // Healing Radius(360) fact, which is tied directly to the Regeneration/heal.
    30864: 5,
    // Infusion Bomb (Engineer bomb, both ids). Description states outright "grants boons to nearby
    // allies when it explodes," Radius(300) tied directly to the boon pulse. No explicit wiki count —
    // 5 used (see table doc comment).
    50444: 5,
    58104: 5,
    // Transmute Fire (Elementalist fire aura proc). Description states outright "damaging enemies and
    // benefiting allies" — Might goes to allies (Burning to foes), Radius(240) tied to the explosion.
    51711: 5,

    // --- Group A sweep (2026-08-06), "no profession tag" bucket: pet/mount/racial/trait-proc skills
    // whose only target-count signal is the ambiguous enemy-facing "Number of Targets" fact (see
    // TODO.md for the ~290 remaining per-profession candidates this leaves).
    1139: 5, // Healing Seed (Sylvari racial elite). Wiki: "gives nearby allies regeneration."
    5625: 'self', // Lightning Leap (Lightning Hammer bundle, Elementalist conjure). Wiki: quickness is
    // "granted to the caster only" on hit — the Number(3) fact is the enemy hit count, not allies.
    5747: 'self', // Magnetic Shield (Conjure Earth Shield bundle, Elementalist). Wiki: "gaining
    // protection...for each foe pulled" — self-only, scales with foes hit like Lightning Leap above.
    12376: 5, // Roar of the Forest (Ranger pet, Krytan Drakehound). Wiki: "Imbue allies with protection."
    12390: 10, // Howl (Become the Wolf, Norn racial elite transform). Wiki: "giving allies fury and
    // regeneration," explicit Number(10) fact, id-matched to skill 12390.
    12658: 5, // Mighty Roar (Ranger pet, Jungle Stalker). Wiki: "Give extreme might to nearby allies."
    12712: 5, // Furious Screech (Ranger pet, Red Moa). Wiki: "grant fury to nearby allies."
    12713: 5, // Protecting Screech (Ranger pet, Blue Moa). Wiki: "grant protection to nearby allies."
    12717: 5, // Regenerate (Ranger pet, Fern Hound; id-matched). Wiki: "grant regeneration to nearby allies."
    13677: 5, // Lesser Symbol of Resolution (Guardian trait proc). Wiki: "granting resolution to allies."
    13684: 5, // Lesser Symbol of Protection (Guardian trait proc, Protector's Restoration). Wiki: "gives
    // protection to you and your allies."
    13849: 5, // Lesser Well of Blood (Necromancer trait proc). Wiki: "heal nearby allies" — Regeneration
    // shares the same allies-only well as the heal.
    13918: 5, // Lesser Mark of Blood (Necromancer trait proc). Wiki: "grants regeneration to allies."
    14268: 'self', // Reckless Impact, wiki page "Reckless Dodge" (Warrior trait proc; id-matched). Wiki:
    // "Gain might for each foe struck" — self-only.
    22521: 'self', // Lesser Cleansing Fire (Elementalist trait proc, Burning Fire; id-matched). Wiki:
    // might goes "to the elementalist using it, not allies."
    29449: 5, // Lesser Call of the Wild (Ranger trait proc, Call of the Wild). Wiki: "Grant fury, might,
    // and swiftness to yourself and nearby allies."
    29560: 'self', // Spiteful Spirit, wiki page "Spite" trait skill (Necromancer; id-matched). Wiki:
    // "Gain resolution for each foe you strike" — self-only.
    46854: 'self', // Call of the Assassin (Revenant trait proc, Song of the Mists; id-matched). Wiki:
    // "gaining quickness. Gain additional quickness for each foe you hit" — self-only.
    62689: 5, // Saint's Shield, wiki page "Saint of zu Heltzer" (Guardian trait proc; id-matched). Wiki:
    // "applies alacrity to allies affected by your dodge" — target count only, NOT wired into the
    // trait's own synthetic fact below: this app's own `wvw-fact-overrides.json` already resolves
    // this Alacrity to `'omit'` (wiki-confirmed PvE-only, added 2025-06-24, no WvW-tagged line at
    // all — see `resolveOverride`'s `pveLines.length === 1 && wvwLines.length === 0` case in
    // `fetch-wvw-splits.ts`), and this app never displays a fact that's confirmed absent in WvW.
    // Kept here purely as historical documentation of the proc skill's own reach, same as every
    // other now-orphaned entry in this table.
    62693: 5, // Death Drop, wiki page "Forerunner of Death" (Vindicator trait proc; id-matched). Wiki:
    // "{{skill fact|vulnerability|10|stacks=5}}" alongside "{{skill fact|targets|5}}" — foes hit, not
    // allies, but this table's target-count resolution is shared across boon and condition sources.
    62859: 5, // Imperial Impact, wiki page "Vassals of the Empire" (Vindicator trait proc; id-matched).
    // Wiki: "{{skill fact|allied targets|5}}" alongside its Might/Protection facts.
    62839: 5, // Water Sphere (Elementalist Catalyst trait proc, Depth of Elements; id-matched). Wiki:
    // "boons to allies within range based on your active attunement."
    62842: 5, // Air Sphere (same Depth of Elements proc family as Water Sphere above; id-matched).
    62881: 5, // Earth Sphere (same Depth of Elements proc family; id-matched).
    62949: 5, // Fire Sphere (same Depth of Elements proc family; id-matched).
    63141: 5, // Barrier Burst (Engineer Mechanist, mech skill). Wiki: "Pulse a barrier and boons to all
    // nearby allies."
    63293: 5, // Crisis Zone (Engineer Mechanist, mech skill). Wiki: "grants boons to itself and nearby
    // allies."
    65418: 5, // Hunker Down (Ranger Siege Turtle mount; id-matched). Wiki: "shields allies from incoming
    // projectiles and grants protection."
    65528: 'self', // Spotter's Shot (Siege Turtle "The Sniper" passenger skill) — distinct from Thief's
    // skill 44591 of the same name (separate, not-yet-curated candidate). Wiki gives no "allies"
    // wording for Fury/Vigor here, unlike every confirmed party-wide entry above; self-only pending
    // stronger evidence.
    76681: 5, // Seismic Impact (Elementalist Evoker familiar mechanic; id-matched). Wiki: "Allies in the
    // area gain protection."
    77164: 5, // Sovereign of Light (Guardian Willbender trait proc, Radiant Forge; id-matched). Wiki:
    // "Luminary skills detonate light aura, damaging enemies and healing allies" — Resolution bundled
    // with the same allies-only heal.
    79336: 5, // Lesser Symbol of Blades (Guardian trait proc). Wiki: "grant boons to allies."

    // --- Group A sweep (2026-08-06), Thief leg (2nd leg, smallest profession per user's stated
    // order): 18 skills (some ids are the same-named skill's PvE/underwater or split variant).
    // Infiltrator's Strike/Skirmisher's Shot/Spotter's Shot: all three read "grants you a boon(s)"
    // in both the API description and the wiki, with the Number-of-Targets fact matching the skill's
    // own enemy pierce/hit count (Pierces fact present on the latter two) — self-only. Spotter's
    // Shot here (44591, Deadeye rifle) is distinct from the unrelated Siege Turtle skill of the same
    // name already curated above (65528).
    13015: 'self', // Infiltrator's Strike (Thief sword). Wiki: "grants you Swiftness" — self-only.
    41494: 'self', // Skirmisher's Shot (Thief Deadeye rifle). API/wiki: "grants you a boon" — self-only.
    44591: 'self', // Spotter's Shot (Thief Deadeye rifle, id 44591 — not Siege Turtle's 65528).
    // API/wiki: "grants you boons" — self-only.

    // Specter shroud weapon skills: Shadestep (trait 2289, "Shadow Shroud skills provide additional
    // supportive effects to nearby allies and your tethered ally") gates most of these Buff facts via
    // `requires_trait`; trait 2289's own facts carry the shared Radius(360)/Number-of-Targets(5) that
    // governs every boon line it lists. Haunt Shot's Might is the one exception — unconditional in
    // its own base facts, matching its own description ("granting might to nearby allies and your
    // tethered ally") with no Shadestep requirement at all.
    63362: 5, // Haunt Shot (Specter pistol 1, unconditional). Wiki/API: "nearby allies and your
    // tethered ally" gain Might.
    63107: 5, // Grasping Shadows (Specter scepter 2, PvE). Alacrity/Regeneration only exist via
    // Shadestep's traitedFacts — party-wide per trait 2289's Number(5)/Radius(360).
    63167: 5, // Grasping Shadows (same skill, PvP/WvW split id) — same Shadestep-gated Alacrity/
    // Regeneration as 63107.
    63220: 5, // Dawn's Repose (Specter dagger 3, PvE). Protection only exists via Shadestep's
    // traitedFacts — party-wide per trait 2289.
    63227: 5, // Dawn's Repose (same skill, underwater/split id) — same Shadestep-gated Protection.
    63249: 5, // Mind Shock (Specter dagger 5). Stability is unconditional and its own description
    // says "Nearby allies and your tethered ally gain stability"; Aegis is additionally gated on
    // Shadestep. Both party-wide.

    // Specter wells: Traversing Dusk (trait 2285, "Wells grant resistance on their initial impact")
    // gates every well's Resistance `Buff` fact via `requires_trait`; trait 2285's own facts carry
    // the shared Radius(360)/Number-of-Targets(5). Well of Bounty is the one exception — its full
    // boon kit (Stability/Might/Fury/Vigor/Regeneration) is unconditional, with its own explicit
    // Radius(240)/Number-of-Targets(5) confirming "create a well that grants boons to allies."
    63230: 5, // Well of Silence. Resistance only via Traversing Dusk — party-wide per trait 2285.
    63275: 5, // Shadowfall (Specter elite well) — same Traversing Dusk-gated Resistance.
    63276: 5, // Well of Sorrow — same Traversing Dusk-gated Resistance.
    63292: 5, // Well of Gloom (Specter heal) — same Traversing Dusk-gated Resistance.
    63294: 5, // Well of Tears — same Traversing Dusk-gated Resistance.
    63323: 5, // Well of Bounty (unconditional kit) — wiki: "create a well that grants boons to
    // allies," own Number-of-Targets(5) fact.

    // Holo-Dancer Decoy (a "Defensive Artifact" gizmo skill, both ids — one Weapon_1, one
    // Profession_2 — same description on both). Wiki confirms "grants boons to nearby allies" (up
    // to 5 during the active phase) and "granting additional boons to allies" on self-destruct.
    76674: 5,
    76800: 5,

    // --- Group A sweep (2026-08-06), Necromancer leg (3rd leg, smallest remaining profession per
    // user's stated order): 18 skills (3 more — Plague Blast/Dhuumfire/Life Reap — were resolved but
    // then dropped, see below). Well of Power (10609, 10673) and Mark of Blood (19117) deliberately
    // excluded — see this table's top comment (genuine per-buff-line self/party-wide splits).
    // Recurring pattern found across this leg: whenever the skill's own description phrases the grant
    // in first person ("Gain X," referring to the necromancer) rather than "to allies"/"protects
    // allies," the boon is confirmed self-only even when a Radius/Number-of-Targets fact is present
    // alongside it (that fact governs the skill's separate foe-facing damage/condition component, not
    // the boon).
    //
    // NOT included despite matching the sweep's boon-fact filter: Plague Blast (10690), its flip
    // Dhuumfire (24287), and Life Reap (30278) — all three carry `slot: "Downed_1"` in the raw API
    // data. `Build` has no downed-skill concept at all, and neither `skillIdsForBuild` nor
    // `bundleContributionsForBuild` (see `NECRO_SHROUD_SLOT_SKILLS` in `bundle-skills.ts`, which
    // deliberately omits 30278 as a non-entry-point Reaper Shroud chain id) ever produce these three
    // ids for any build — `resolveTargetCount` can never be called with them, so curating an answer
    // would be dead weight. Contrast with 29958 (Infusing Terror) above, also raw-labeled `Downed_3`
    // but genuinely reachable as Reaper Shroud slot 3's real entry point in that same map — not every
    // `Downed_`-slotted id is unreachable, only ones absent from a bundle-slot mapping.
    10527: 5, // Well of Blood (Necromancer heal). Wiki: "Conjure a well of blood to heal allies" —
    // Regeneration only, no caster-exclusive component (unlike Well of Power) — party-wide per its
    // own Number-of-Targets(5)/Radius(240).
    10605: 1, // Chillblains (Necromancer staff mark). Protection only exists via Transfusion
    // (trait 778, "Marks can be triggered by allies to heal them and provide them with additional
    // benefits") — exactly the ONE ally who triggers the mark, not a radius pulse. No other boon on
    // this source, so unlike Mark of Blood there's no per-buff-line conflict to exclude over.
    10608: 5, // Spectral Ring. Wiki: "protects allies and inflicts fear on foes," confirmed radius
    // 180 (undocumented in the API facts). No explicit ally cap stated — default 5.
    10619: 'self', // Deadly Feast. "Gain swiftness and summon a swarm of vampiric shrimp that siphon
    // health from nearby foes" — Swiftness is the caster's own, the Radius/Number-of-Targets facts
    // govern the shrimp's foe-siphon range instead.
    19115: 1, // Reaper's Mark (Necromancer staff mark). Stability only via Transfusion (trait 778) —
    // same one-ally-who-triggers mechanic as Chillblains above.
    29414: 'self', // "You Are All Weaklings!" (Reaper shout). Wiki infobox description: "Damage foes
    // around you, and gain boons... gain boons per foe struck" — first-person "gain," caster-only;
    // the Number-of-Targets(5)/Radius facts scale how many foes struck, not an ally count.
    29740: 'self', // Grasping Darkness (Reaper GS). "Gain quickness if you strike a foe and gain life
    // force for each struck foe" — self-only, no allies mentioned.
    29855: 'self', // Nightfall (Reaper GS). Wiki version history: the skill "now also grants
    // protection to the necromancer" — Protection is self-only despite no explicit self/ally wording
    // in the current description.
    30105: 'self', // "Chilled to the Bone!" (Reaper elite shout). Same self-buff-scaling-with-foes-
    // struck pattern as "You Are All Weaklings!" above — wiki infobox: "Gain boons for each foe you
    // freeze," all four boons (Stability/Might/Fury/Quickness) are the caster's own.
    40274: 5, // Trail of Anguish (Scourge punishment). Wiki: "Grant boons to allies passing through
    // it" — Swiftness/Stability party-wide; its Number-of-Targets(10) fact governs the trail's
    // separate burning-on-enemies effect, not the ally count, so the standard 5 default is used.
    41615: 5, // Serpent Siphon (Scourge punishment). Wiki: "granting barrier and boons to nearby
    // allies" — Aegis/Regeneration party-wide per its own Number-of-Targets(5)/Radius(240).
    42935: 5, // Desiccate (Scourge punishment). Wiki: "grant boons to nearby allies" — Might/Fury
    // party-wide per its own Number-of-Targets(5)/Radius(300).
    44296: 5, // Oppressive Collapse (Scourge). Wiki: "Grant might to allies near your target" via its
    // own Might Radius(360) fact — no explicit ally cap stated, default 5.
    44663: 'self', // Desert Shroud (Scourge shade). Fury only via Furious Demise (trait 803, "Gain
    // fury when entering shroud") — self-only.
    73007: 'self', // Extirpate (Necromancer spear). "Gain soul shards and might for each target
    // struck" — first-person "gain," same self-buff-scaling-with-foes-struck pattern as this leg's
    // two shouts.

    // --- Group A sweep (2026-08-06), Warrior leg (4th leg, smallest remaining profession per
    // user's stated order): 23 skills + 1 trait. Recurring pattern (same as the Necromancer leg):
    // when the skill's own description grants the boon in first person ("gain X"/"gaining X",
    // referring to the warrior) or doesn't mention allies at all, the boon is self-only even with
    // an adjacent enemy-facing Number-of-Targets/Radius fact; when the description explicitly says
    // "allies" (or "yourself and allies"), it's party-wide. Several self-only entries here (Sundering
    // Leap, Wild Blow, Shattering Blow, Gunstinger, Crushing Blow) don't mention the boon in their
    // own description text at all — undocumented tooltip-only procs, same as Nightfall in the
    // Necromancer leg — but no wiki page for any of them states allies either, so the pattern still
    // applies rather than being left ambiguous.
    14375: 'self', // Arcing Slice (Warrior Greatsword burst, base). "...deliver a circular attack to
    // foes around you, and gain fury" — first-person, self-only; Number-of-Targets(5) is the
    // enemy hit count for the damage/Fury-per-hit stacking, not an ally count.
    14545: 'self', // Arcing Slice (split/PvP id) — same self-only Fury as 14375.
    14546: 'self', // Arcing Slice (split id) — same.
    14547: 'self', // Arcing Slice (split id) — same.
    42707: 'self', // Arcing Slice (Berserker-traited variant, requires_trait 1657) — same self-only
    // Fury as the base skill above.
    14388: 'self', // Stomp (Physical utility). "Gain stability...Gain stability for each enemy
    // struck" — first-person, self-only.
    14393: 5, // Charge (Warhorn 4). "Grant boons and remove movement-impairing conditions from
    // allies" — explicit party-wide, own Radius(600)/Number-of-Targets(5).
    14394: 5, // Call of Valor (Warhorn 5). "Removes conditions from allies and grants them vigor" —
    // explicit party-wide, own Radius(600)/Number-of-Targets(5).
    14403: 5, // "For Great Justice!" (shout). "Grant fury and might to yourself and allies" —
    // explicit party-wide, own Radius(600)/Number-of-Targets(5).
    14418: 'self', // Dual Strike (weapon skill). "Gain quickness for each strike that hits" —
    // first-person, self-only; Number-of-Targets(3) is the enemy pierce/hit count.
    14421: 'self', // Cyclone Axe (Axe 5). "Gain fury for each foe hit" — first-person, self-only.
    14518: 'self', // Crushing Blow (weapon skill). "...leaving them vulnerable and gaining might" —
    // no allies wording anywhere on the skill or its wiki page; same self-buff-on-hit pattern as
    // Cyclone Axe/Dual Strike above.
    29613: 'self', // Sundering Leap (Berserker Rage skill). Aegis isn't mentioned in the skill's own
    // description at all ("Leap to a location, dealing damage and inflicting conditions on all foes
    // in the area"); the wiki's Notes section says only "This skill grants Aegis at the beginning of
    // the cast" with no allies wording — self-only, undocumented-in-description proc (same shape as
    // Necromancer's Nightfall in the previous leg).
    29941: 'self', // Wild Blow (Berserker Rage skill). Wiki: "Gain fury and extend the duration of
    // berserk mode if this attack hits" — first-person, self-only.
    30074: 'self', // Shattering Blow (Berserker Rage skill). Stability isn't mentioned in the
    // description ("Summon a rock that blocks attacks, then shatter it...") and the wiki has no
    // allies wording for it either — self-only, same undocumented-proc pattern as Sundering Leap
    // (the skill's own "Rock Guard" block buff, not a tracked boon, is unambiguously self already).
    41919: 'self', // Imminent Threat (Spellbreaker meditation). "Taunt nearby foes, gaining
    // adrenaline and barrier for each affected foe" — first-person "gaining," self-only; Resolution
    // rides along with the same self-only grant, no allies wording anywhere.
    44165: 'self', // Full Counter (Spellbreaker burst). "Absorb the next attack against you and
    // counterattack all foes around you" — no allies wording; Stability is the counter's own
    // self-only defensive proc, same as every other self-buff-on-defensive-skill in this leg.
    62697: 'self', // Gunstinger (Bladesworn Gunsaber 4). "Quickly step forward to strike your foe
    // while reloading your gun" — no allies wording on the skill or its wiki page; Aegis is a
    // self-only dash proc, Number-of-Targets(3) is the enemy hit count.
    71860: 5, // Line Breaker (Bladesworn Gunsaber 3). "...heal nearby allies and grant them boons
    // while debilitating nearby enemies" — explicit party-wide (Protection/Aegis), own
    // Radius(300)/Number-of-Targets(5).
    71875: 5, // Rampart Splitter (Berserker primal burst). "...inspiring nearby allies, healing and
    // granting regeneration to them" — explicit party-wide, own Radius(360)/Number-of-Targets(5).
    72002: 5, // Valiant Leap (Bladesworn Gunsaber 2). "Leap to the targeted location, empowering
    // allies and damaging enemies" — explicit party-wide (Might/Fury), own Healing Radius(300)/
    // Number-of-Targets(5).
    76934: 5, // "Brace Yourselves!" (Paragon command shout). "Apply barrier to yourself and allies
    // around you...Apply barrier again to allies" — explicit party-wide (Protection rides the same
    // grant), own Radius(360)/Number-of-Targets(5).
    77040: 5, // "Find Their Weakness!" (Paragon command shout). "Echo. Apply might to allies..." —
    // explicit party-wide, own Radius(360)/Number-of-Targets(5).

    // --- Group A sweep (2026-08-06), Engineer leg (5th leg): 35 skills. Same first-person/no-allies-
    // wording-anywhere self-only tell as the Necromancer/Warrior legs, plus turret overcharge boons
    // gated by Experimental Turrets (trait 1678, "Turrets... grant boons to allies around them") which
    // resolve party-wide even when the base turret skill's own description doesn't mention a boon at
    // all. 2 candidates the scan turned up — Holo Leap (42965) and Corona Burst (44530), both
    // Downed_-slotted Holosmith skills — were dropped per TODO.md's standing instruction rather than
    // researched (this app has no downed-skill concept, so they're unreachable regardless of being
    // real GW2 skills).
    5836: 5, // Flame Turret. Own description never mentions a boon; Might only exists via Experimental
    // Turrets (trait 1678, gates the fact) — that trait's text is explicit "allies," party-wide.
    5838: 5, // Thumper Turret. Same Experimental-Turrets-gated Protection as Flame Turret above.
    5857: 5, // Healing Turret. "...heals you briefly, then regenerates you and your allies" — explicit
    // party-wide Regeneration.
    5912: 5, // Rocket Turret. Same Experimental-Turrets-gated Resolution as Flame Turret above.
    5936: 5, // Acid Bomb (Elixir Gun 4). Own description doesn't mention Might — only exists via HGH
    // (trait 473). Wiki version history confirms directly: "Fixed a bug that prevented HGH from
    // properly functioning with this skill and granting might to nearby allies" — explicit party-wide.
    5937: 5, // Super Elixir (Elixir Gun 5, ground-targeted variant). "...healing allies on impact..." —
    // explicit party-wide.
    5966: 5, // Healing Mist (Elixir Gun toolbelt). "...granting regeneration to yourself and allies" —
    // explicit party-wide.
    5967: 5, // Toss Elixir B (ground-targeted variant). "...granting stability and one of the following
    // boons to allies..." — explicit party-wide.
    5978: 5, // Toss Elixir H (ground-targeted variant). "...grant protection, regeneration, and vigor
    // to allies" — explicit party-wide.
    5980: 5, // Cleansing Burst (Healing Turret's own overcharge chain skill, not the toolbelt). Own
    // description doesn't say "allies," but the wiki version history confirms Automated Medical
    // Response (an explicit "nearby allies" trait, see below) affects this skill's Regeneration too,
    // consistent with parent Healing Turret's own explicit party-wide heal/regen — party-wide.
    6088: 5, // Detonate Elixir U (toolbelt). "...grant allies superspeed and break them out of stun" —
    // explicit party-wide (Quickness represents superspeed).
    6092: 5, // Toss Elixir B (non-ground-targeted split id) — same explicit "to allies" wording as 5967.
    6102: 5, // Super Elixir (non-ground-targeted split id) — same explicit "healing allies" as 5937.
    6118: 5, // Toss Elixir H (non-ground-targeted split id) — same explicit "to allies" wording as 5978.
    6153: 5, // Blunderbuss (Rifle 2). "...You and nearby allies gain might" — explicit party-wide.
    6176: 5, // Regenerating Mist (toolbelt). "...regenerate nearby allies" — explicit party-wide.
    6180: 'self', // Rumble (Thumper Turret toolbelt). Wiki has no allies wording anywhere on the page;
    // Stability is a plain self-buff-on-stunbreak proc, same shape as every other undocumented-proc
    // self-only entry in this table.
    12320: 'self', // Pain Inverter (Utility). "Apply confusion to nearby foes. You gain resolution" —
    // first-person, self-only; Number-of-Targets(5) is the enemy hit count for the Confusion.
    12338: 5, // Battle Roar (Utility). "...giving might and fury to nearby allies" — explicit
    // party-wide.
    12354: 5, // Invigorating Roar (Battle Roar's toolbelt). "...removing weakness and vulnerability
    // from allies and granting vigor" — wiki Notes confirm directly: "This ability's Vigor gain does
    // apply to allies" — explicit party-wide.
    12377: 5, // Blessing of Dwayna (toolbelt). "...restore health and grant regeneration to allies at
    // target location" — explicit party-wide.
    12435: 5, // Roar (Warhorn 4). "Roar, giving allies might" — explicit party-wide; its own
    // Number-of-Targets(10) is higher than the table's standard default, but that fact is still the
    // enemy-facing count per the table's doc comment, so the standard 5 is used regardless.
    12440: 5, // Healing Seed (Heal, ground-targeted). "...periodically gives nearby allies
    // regeneration" — explicit party-wide.
    30032: 5, // Elixir Shell (Mortar Kit 5, ground-targeted). "...heals allies in the target area" —
    // explicit party-wide.
    30489: 'self', // Equalizing Blow (Hammer chain finisher, Scrapper). Wiki Notes: "Might is applied
    // for each enemy struck" — self-buff-scaling-with-hits pattern, same as Warrior's Cyclone Axe;
    // no allies wording anywhere.
    30501: 'self', // Positive Strike (Hammer chain, Scrapper). "...while empowering yourself" —
    // first-person, self-only.
    37873: 'self', // Channeled Agony (multi-profession shared Weapon_5 skill, Engineer included).
    // "Steel yourself and channel a burst of spectral agony to foes within range" — no allies wording
    // on the skill or its wiki page; Stability is a plain self-buff-on-cast proc.
    40160: 'self', // Radiant Arc (Gunsaber 3, Bladesworn — shared with Engineer's own weapon-skill
    // pool). "...Gain quickness based on your heat level" — first-person, self-only.
    45732: 5, // Particle Accelerator (toolbelt, Holosmith). "Allies the bolt passes through are
    // granted swiftness" — explicit party-wide.
    63169: 5, // Energizing Slam (Hammer 2, Mechanist). "...granting barrier and boons to allies" —
    // explicit party-wide (Vigor/Regeneration both ride the same "boons to allies" grant).
    69565: 'self', // Radiant Arc (split id, no traited variants). "...Gain quickness" — same self-only
    // first-person Quickness as 40160.
    71870: 5, // Essence of Liquid Wrath (Short Bow 4, Mechanist). "...granting boons to allies on the
    // initial detonation..." plus its Chain Reaction text ("grant an additional boon to allies") —
    // explicit party-wide.
    72052: 5, // Essence of Animated Sand (Short Bow 2, Mechanist). "...granting barrier and might to
    // allies," Chain Reaction "grant additional might to allies" — explicit party-wide.
    76493: 'self', // Stoke the Flames (Flamethrower 4, Holosmith-era kit). "...as you grant yourself
    // boons" — first-person, self-only.
    77069: 'self', // Solid State (Stance, Mechanist, ground-targeted). "Gain stability and increase your
    // outgoing stun durations for a duration" — first-person, self-only.

    // --- Stationary-sources spot-check (2026-08-07), follow-up to the completed Group A sweep:
    // cross-referenced every skill tagged with the API's own `Turret`/`SpiritWeapon`/`Well`/`Spirit`/
    // `Banner` categories against this table. Banners (Warrior) all carry their own direct
    // "Number of Allied Targets" fact, so `resolveTargetCount` already handles them correctly with no
    // override needed — not a gap. Wells/Spirits were already fully covered by the profession legs
    // above (Necromancer/Mesmer/Thief/Ranger), aside from Well of Power's already-documented
    // per-buff-line exclusion (this table's top comment). One genuine gap turned up: Blast Gyro, below
    // — miscategorized as `Well` in the API but actually a delayed-explosion gadget, not a pulsing well.
    31248: 'self', // Blast Gyro (Engineer, categorized "Well" but really a timed-blast gadget). Wiki raw
    // wikitext has no allies wording anywhere on the Might facts or the skill description ("Unleash a
    // blast gyro to begin a countdown to a tremendous blast") — same "no allies wording anywhere"
    // self-only tell used throughout this sweep; the Might comes from the skill's own
    // Combo-Field(Fire)+Combo-Finisher(Blast) self-combo, not a party-wide grant.

    // --- Group A sweep (2026-08-06), Revenant leg (6th leg): 33 skills (2 more, Pain Absorption and
    // Gladiator's Defense, excluded — see this table's top comment). Recurring pattern: every Facet
    // (Strength/Elements/Light/Chaos/Darkness) states "grant nearby allies X" directly in its own
    // description — party-wide. Recurring self-only pattern: Legendary Demon Stance's Resistance
    // (Banish Enchantment, Call to Anguish, Embrace the Darkness) only exists via Demonic Defiance
    // (trait 1789, "Gain resistance...when you use a Legendary Demon skill" — first-person) with no
    // unconditioned boon of the skill's own, so all four resolve to self-only from the gating trait's
    // text alone, same "check the gating trait's own text first" shortcut as the Thief/Engineer legs.
    26644: 5, // Facet of Strength. "...grant nearby allies might."
    27014: 5, // Facet of Elements. "...grant nearby allies swiftness."
    27220: 5, // Facet of Light. "...grant nearby allies regeneration."
    27760: 5, // Facet of Chaos. "...grant nearby allies protection."
    28379: 5, // Facet of Darkness. "...grant nearby allies fury."
    28516: 5, // Inspiring Reinforcement. "...granting stability to allies."
    50383: 5, // Inspiring Reinforcement (split id) — same as 28516.
    29386: 5, // Envoy of Exuberance. "...heals allies and grants boons" (Protection/Aegis).
    50390: 5, // Rift of Pain. "Allies in the affected area gain beneficial effects" (Protection).
    51675: 5, // True Nature (Legendary Dragon F2). "Grant stability to nearby allies" — own
    // Radius(600)/Number-of-Targets(5); the Core Value trait (1806) only raises apply_count on the
    // same party-wide Stability, no self/party conflict.
    62702: 5, // Battle Dance. "...granting boons to allies" (Resistance/Regeneration).
    62738: 5, // Drop Urn of Saint Viktor. "Grant boons and heals allies" (Regeneration/Protection/
    // Resistance).
    62796: 5, // Awakening. "Break stun on nearby allies and grant protection" — explicit party-wide.
    62941: 5, // Tree Song. "Grant regeneration...from allies in the targeted area."
    27505: 'self', // Banish Enchantment. Only boon is Demonic Defiance's (1789) self-only Resistance.
    78587: 'self', // Banish Enchantment (split id) — same.
    27917: 'self', // Call to Anguish. Only boon is Demonic Defiance's (1789) self-only Resistance.
    31100: 'self', // Call to Anguish (split id) — same.
    78203: 'self', // Call to Anguish (split id) — same.
    78798: 'self', // Call to Anguish (split id) — same.
    27665: 'self', // Field of the Mists. Wiki version history: "This skill now grants aegis to the
    // user on activation" — no allies wording, self-only.
    27964: 'self', // Echoing Eruption. Not in own description at all; wiki version history: "This
    // skill now also grants might to the user" (singular) — self-only, undocumented-proc pattern.
    28287: 'self', // Embrace the Darkness. Only boon is Demonic Defiance's (1789) self-only Resistance
    // (Torment is a foe-facing condition, unrelated).
    78191: 'self', // Embrace the Darkness (split id) — same.
    31294: 'self', // Jade Winds. Might only via Notoriety (trait 1765, "Gain might when using a
    // legendary stance skill" — first-person) — self-only.
    51698: 'self', // Elemental Blast. Quickness only via Draconic Echo (trait 1772, entirely
    // self-focused "you"/"your" text, no allies wording) — self-only.
    51714: 'self', // True Nature (Legendary Renegade F2 variant). "Gain might for each condition
    // transferred" — first-person, self-only.
    62719: 'self', // Selfish Spirit. "healing and empowering yourself for each enemy struck" —
    // first-person, self-only.
    62832: 'self', // Nomad's Advance. "gaining might for each target struck" — first-person, self-only.
    62878: 'self', // Reaver's Rage. "gaining stability for each target struck" — first-person, self-only.
    62895: 'self', // Phantom's Onslaught. No allies wording in description or wiki page — self-only,
    // same undocumented-proc pattern as Echoing Eruption above.
    62962: 'self', // Scavenger Burst. "gaining boons and endurance for each foe struck" — first-person,
    // self-only.

    // Leftover "no profession tag" skills a fresh rescan turned up outside the original leg's scan.
    59591: 'self', // Invoke Torment. Resistance only via Fiendish Tenacity (trait 1720, "Resistance
    // heals you every interval" — first-person) — self-only.
    76506: 1, // Lesser Chilblains. Protection only via Transfusion (trait 778) — same one-ally
    // mark-trigger mechanic as the base Chillblains/Reaper's Mark pair in the Necromancer leg.

    // --- Group A sweep (2026-08-06/07), Ranger leg (7th leg): 37 skills. New recurring pattern this
    // leg: several skills grant their boon specifically "to your pet" (a fixed companion, never a
    // squad member the app tracks) rather than to the ranger or nearby allies — wiki-confirmed
    // self-only for all three found (Precision Swipe, Feeding Frenzy, Ancestral Grace's Protection
    // line specifically — its Regeneration-adjacent heal line targets allies but isn't a tracked boon).
    12473: 'self', // Precision Swipe. Wiki: "Grants the pet a stack of might for each foe hit. While
    // in Beastmode, grants might to the player" — never reaches other squad members either way.
    12489: 5, // Healing Spring. "Place a trap that grants regeneration...on allies."
    12493: 5, // Storm Spirit. "...granting boons to nearby allies" (Fury).
    12494: 'self', // Lightning Reflexes. "gaining vigor" — first-person, self-only.
    12495: 5, // Stone Spirit. "...granting boons to nearby allies" (Aegis/Protection).
    12497: 5, // Frost Spirit. "...granting boons to nearby allies" (Resistance/Resolution).
    12498: 5, // Sun Spirit. "...granting boons to nearby allies" (Might).
    12528: 'self', // Feeding Frenzy. Wiki: "Apply fury to your pet" — pet-only, same as Precision Swipe.
    12621: 5, // Call of the Wild. "Grant fury, might, and swiftness to yourself and nearby allies."
    12639: 'self', // Whirling Defense. No allies wording in description, Notes, or version history —
    // self-only per the established "no allies wording anywhere" tell.
    21773: 5, // Water Spirit. Same spirit-shake template as Storm/Stone/Frost/Sun Spirit above.
    31401: 5, // Glyph of Equality (stun-break form). Wiki: "break stun for allies," version history
    // confirms Stability itself also reaches "nearby allies" (Radius 600/Number 5).
    31503: 5, // Natural Convergence (Celestial Avatar). Version history: "...grants might to nearby
    // allies every pulse" (2023-06-27) — Stability shares the same unconditioned pulse/Radius/Number
    // facts with no differentiating text, so treated as the same reach.
    31535: 'self', // Ancestral Grace. Wiki explicit: "grant protection to your pet" — pet-only; the
    // heal on the same skill goes to nearby allies but Regeneration isn't one of its tracked facts.
    31658: 5, // Glyph of Equality (daze form). Same Stability/Radius(300+)/Number(5) template as
    // 31401 above — wiki confirms both forms reach "nearby allies."
    31894: 5, // Rejuvenating Tides. Version history: "This skill now grants might to nearby allies in
    // addition to its previous effects" (2023-06-27); heal itself already explicit "nearby allies."
    32253: 5, // Rejuvenating Tides (split id) — same as 31894.
    34070: 5, // Natural Convergence (split id) — same as 31503.
    43186: 5, // Healing Cloud. "regenerate you and your allies" — explicit party-wide.
    63073: 'self', // Savage Shock Wave. Version history: "This skill now grants protection to the
    // user" (2022-11-29) — explicit self-only.
    63208: 'self', // Unleashed Thump. "gaining boons for each target struck" — first-person, self-only
    // (Let Loose trait 2271's own party-wide Might/Quickness grant is a separate, unconditioned bonus
    // on ANY Unleashed Ambush skill use, not a gate on this skill's own Might/Fury facts).
    63438: 'self', // Relentless Whirl. No allies wording in description or Notes — self-only.
    69175: 5, // Solar Brilliance. "healing nearby allies and damaging nearby enemies" — explicit
    // party-wide (Protection); unlike Relentless Whirl/Unleashed Thump above, this Unleashed Ambush
    // skill's own description states allies directly.
    69203: 'self', // Pounce. "Gain vigor if an enemy is struck" — first-person, self-only.
    69244: 5, // Water Spirit (split id) — same as 21773.
    69340: 'self', // Savage Shock Wave (split id) — same as 63073.
    69349: 5, // Sun Spirit (split id) — same as 12498.
    69351: 5, // Storm Spirit (split id) — same as 12493.
    69378: 5, // Stone Spirit (split id) — same as 12495.
    69379: 5, // Frost Spirit (split id) — same as 12497.
    71903: 'self', // Thistleguard. "gaining stability for a brief duration" — first-person, self-only.
    71963: 5, // Oaken Cudgel. "grant nearby allies protection" — explicit party-wide, own Boon
    // Radius(360) fact backs it.
    71999: 5, // Flourish. "healing nearby enemies and healing nearby allies" — Regeneration explicit
    // party-wide (Nature's Strength/Force of Nature on the same skill aren't tracked boons).
    73087: 'self', // Cheetah's Strike. "gaining swiftness if you strike an enemy" — first-person,
    // self-only.
    76664: 5, // Hawkeye. All boon facts gated by Cloudburst (trait 2425, "grant boons to nearby
    // allies when you use Bluster or Hawkeye") — explicit party-wide.
    77211: 'self', // Wind Shear. No allies wording in description, Notes, or version history — the
    // "around you" phrasing and lack of any allies mention matches the established self-only tell.
    77319: 5, // Bluster. Same Cloudburst (2425) gate as Hawkeye above — explicit party-wide.

    // --- Group A sweep (2026-08-07), Mesmer leg (8th leg): 22 skills, no exclusions needed. Rescanning
    // with a fixed extraction script (the prior session's script matched the TYPE annotation's braces
    // instead of the object literal's, so it silently treated every earlier leg as still-uncurated —
    // fixed here by locating the `= {` after the const name before brace-matching) showed the true
    // remaining pool was Mesmer (34), not Guardian (39) as the prior session's rescan claimed — Mesmer
    // picked instead as the genuinely smaller leg.
    10169: 5, // Chaos Storm. "applies random conditions to foes and boons to allies" — same shared
    // Number-of-Targets(5) template as Lesser Chaos Storm (13733, already curated above).
    10211: 5, // Mantra of Pain. "Grant might to nearby allies when this spell is fully charged."
    10237: 5, // Mantra of Concentration. "grant stability to nearby allies...boons to nearby allies."
    10238: 5, // Power Break. "Break stuns on yourself and grant stability to nearby allies."
    10311: 5, // Time Warp. "granting you and your allies quickness" — wiki confirms `targets|5` shared
    // by both this id and its split id 10377 below, despite 10377's own Number-of-Targets fact reading
    // 10 in this app's game-data (an enemy-facing count, not the true ally cap).
    10331: 'self', // Chaos Armor. "Chaos aura grants YOU a random boon" — first-person, self-only; the
    // foe-facing confuse/blind is unrelated to the boon line.
    10377: 5, // Time Warp (split id). Same wiki-confirmed ally cap of 5 as 10311 above.
    29526: 5, // Well of Precognition. "gives allies the ability to see the future...allies within the
    // well regain endurance" — explicit party-wide (Aegis/Stability).
    30643: 5, // Tides of Time. "Grant boons to nearby allies..." — own "Ally Boon Radius" fact backs it.
    30814: 5, // Well of Action. "time snaps back, granting boons to allies."
    40184: 5, // Chaos Vortex. "Allies near you gain boons" — own "Ally Boon Radius" fact backs it.
    44241: 'self', // Split Surge. No allies wording anywhere; wiki confirms Might is granted "to the
    // user" on hit — self-only, matching Vulnerability's separate foe-facing reach.
    62522: 'self', // Twin Blade Restoration. "If the first blade hits, you gain aegis" — first-person,
    // self-only.
    62573: 'self', // Psychic Force. No allies wording anywhere (self-buff Fury/Might scaling with the
    // channel) — self-only per the established "no allies wording anywhere" tell.
    71800: 'self', // Effervescence. "damaging enemies and healing allies" but the Vigor fact itself has
    // no allies wording and its stack count (4) matches the skill's own hit count — same self-scaling-
    // buff-alongside-an-unrelated-ally-facing-heal shape as the code's own Heat Wave precedent (Vigor to
    // self, Burning to foes); wiki's raw wikitext confirms only a bare `targets|5` fact, no `allied
    // targets` fact, unlike Journey below.
    71897: 5, // Journey. "damaging enemies and healing allies" — wiki raw wikitext confirms an explicit
    // `allied targets|5` fact backing the Regeneration line, unlike Effervescence above.
    72005: 5, // Inspiring Imagery. "granting boons to nearby allies."
    72008: 5, // Singularity Shot. "granting resistance and barrier to allies."
    72946: 'self', // Phantasmal Lancer. No allies wording anywhere — self-only (the tracked Swiftness
    // fact is a self-buff for the dash, unrelated to the foe-facing crip/immobilize/boon-strip effects).
    73066: 'self', // Psystrike. "Gain might per target struck" — first-person, self-only.
    73093: 'self', // Mind the Gap. "If you are empowered, gain might" — first-person, self-only.
    73154: 'self', // Psycut. "Gain might per target struck" — first-person, self-only (same as Psystrike).

    // --- Group A sweep (2026-08-07), Guardian leg (9th leg): 45 skills. All "Symbol of X" entries
    // resolved via the wiki's blanket "Symbol" skill-type rule (see this table's top comment), even
    // where the individual skill's own tooltip has no "allies" wording (Symbol of Spears, Symbol of
    // Vengeance) — Symbol of Ignition is that page's one named exception, self-only. Virtue of
    // Justice/Resolve and Wings of Resolve's boon facts only exist gated behind Inspired Virtue
    // (trait 621, "Virtues apply boons to allies when activated") — unconditionally party-wide per
    // that trait's own wording whenever the fact is present. Resolute Stance/Daring Advance/Stalwart
    // Stance/Valorous Stance similarly gate their Protection line behind Shimmering Stances (trait
    // 2410, "Stances grant protection to affected allies"), and Luminous Staff/Radiant Bulwark/
    // Dazzling Hammer gate their bonus Might/Fury/Alacrity behind Resplendent Weaponry (trait 2330,
    // "Grant boons to nearby allies when you equip a radiant weapon") — both unconditionally
    // party-wide the same way. Test of Faith and Dragon's Maw are both traps whose boon is granted
    // "on Trap Trigger" with no allies wording anywhere on either wiki page — self-only, same tell as
    // Roiling Light's "gaining resistance" (first-person, no allies wording).
    9084: 5, // "Advance!" Own description: "Grant aegis and swiftness to up to five nearby allies."
    9086: 5, // Protector's Strike. "granting boons to nearby allies."
    9087: 5, // Shield of Judgment. "giving protection and aegis to you and up to five allies."
    9090: 5, // Symbol of Punishment. "grants might to nearby allies" — also a Symbol (see leg note).
    9097: 5, // Symbol of Blades. "damages nearby enemies and benefits allies" — Symbol.
    9111: 5, // Symbol of Faith. "regenerates allies" — Symbol.
    9115: 5, // Virtue of Justice. Might only exists via Inspired Virtue (trait 621) — party-wide.
    9118: 5, // Virtue of Courage. Own unconditioned Aegis fact: "grant aegis to yourself and nearby
    // allies."
    9120: 5, // Virtue of Resolve. Regeneration only exists via Inspired Virtue (trait 621) —
    // party-wide (the unconditioned healing line is "heal yourself and nearby allies" but that's an
    // AttributeAdjust fact, not a tracked boon).
    9143: 5, // Symbol of Swiftness. "granting swiftness to allies" — Symbol.
    9146: 5, // Symbol of Resolution. "granting resolution to allies" — Symbol.
    9150: 5, // Signet of Judgment. "Grant resolution and protection to nearby allies."
    9182: 5, // Shield of the Avenger. Wiki version history: "This skill now grants protection to
    // allies within its dome" (2025-06-24).
    9192: 5, // Symbol of Spears. No "allies" wording in its own tooltip, but the wiki's "Symbol"
    // skill-type page states every Symbol delivers its boon to allies except Symbol of Ignition —
    // party-wide.
    9209: 5, // Refraction. "grants resolution to allies."
    9250: 5, // Virtue of Resolve (split id) — same Inspired Virtue-gated Regeneration as 9120.
    9253: 5, // Hallowed Ground. "granting stability to allies inside."
    9265: 5, // Empower. "Channel healing and might to nearby allies."
    9268: 5, // Virtue of Courage (split id) — same unconditioned Aegis as 9118.
    15834: 5, // Shield of Judgment (split id) — same as 9087.
    29786: 'self', // Test of Faith. Trap; Protection applied "on Trap Trigger" with no allies wording
    // anywhere on the wiki page — self-only.
    29789: 5, // Symbol of Energy. No "allies" wording in its own tooltip — party-wide per the Symbol
    // page's blanket rule (see 9192).
    30029: 5, // Shield of Courage. Unconditioned Aegis: "Grant aegis to nearby allies."
    30039: 5, // Shield of Courage (split id) — same as 30029.
    30083: 5, // Wings of Resolve. Same Inspired Virtue-gated Regeneration as Virtue of Resolve above.
    30225: 5, // Wings of Resolve (split id) — same as 30083.
    30273: 'self', // Dragon's Maw. Trap; Might applied "on Trap Trigger" with no allies wording
    // anywhere on the wiki page — self-only, same shape as Test of Faith.
    30286: 5, // Wings of Resolve (split id) — same as 30083.
    30461: 5, // Signet of Courage. Wiki: "Now also channels protection, resolution, and stability on
    // allies in the radius" (2022-06-28).
    30783: 5, // Wings of Resolve (split id) — same as 30083.
    40624: 5, // Symbol of Vengeance. No "allies" wording in its own tooltip — party-wide per the
    // Symbol page's blanket rule (see 9192).
    62521: 'self', // Roiling Light. "gaining resistance" — first-person, no allies wording — self-only.
    68676: 5, // Signet of Courage (split id) — same as 30461.
    68686: 'self', // Dragon's Maw (split id) — same as 30273.
    71987: 'self', // Symbol of Ignition. The wiki's "Symbol" skill-type page names this skill as its
    // one exception to the "delivers a boon to allies" rule — self-only Might.
    76572: 5, // Glaring Burst (Regeneration variant, Luminous Staff). No damage/foe facts at all on
    // this skill — its own Number-of-Targets(5) fact has nothing else to describe but the ally reach,
    // consistent with every other Luminary-spec support skill this leg.
    76621: 5, // Resolute Stance. Protection only exists via Shimmering Stances (trait 2410) —
    // party-wide.
    76687: 5, // Daring Advance. Same Shimmering Stances-gated Protection as Resolute Stance.
    76708: 5, // Luminous Staff. Own unconditioned Resolution/Protection: "granting boons to allies";
    // bonus Might/Fury/Alacrity via Resplendent Weaponry (trait 2330) — both party-wide.
    77197: 5, // Radiant Bulwark. Own unconditioned Aegis: "Grants aegis to nearby allies on
    // activation"; bonus Might/Fury/Alacrity via Resplendent Weaponry (trait 2330) — both party-wide.
    77198: 5, // Daring Advance (split id) — same as 76687.
    77300: 5, // Valorous Stance. Own unconditioned Stability/Protection: "grant boons to nearby
    // allies"; additional Protection via Shimmering Stances (trait 2410) — both party-wide.
    77321: 5, // Stalwart Stance. Own unconditioned Aegis ("Break stun for nearby allies"); additional
    // Protection via Shimmering Stances (trait 2410) — both party-wide.
    77339: 5, // Dazzling Hammer. Own unconditioned Might/Fury: "granting boons to nearby allies";
    // additional Might/Fury/Alacrity via Resplendent Weaponry (trait 2330) — both party-wide.
    78730: 5, // Glaring Burst (Resolution variant, Radiant Bulwark) — same no-foe-facts reasoning as
    // 76572.

    // --- Group A sweep (2026-08-07), Elementalist leg (10th and final leg): 51 skills resolved (2
    // excluded, see this table's top comment: Overload Earth 29618, Hare's Agility 76583).
    5534: 'self', // Tornado (Cantrip). "Gain stability..." — first-person self-only; Protection only
    // exists via Soothing Disruption (trait 364, "Cantrips grant boons") — same self-only gate
    // already resolved for Lightning Flash (5536) above.
    5535: 'self', // Cleansing Fire (Cantrip). "Gain might for each condition removed" — first-person
    // self-only; Fury via the same Soothing Disruption (364) gate as Tornado above.
    5551: 5, // Healing Rain. "granting regeneration to allies" — explicit party-wide, reuses the
    // enemy-facing Number-of-Targets(5) fact as the ally count.
    5600: 5, // Heat Wave (Trident 5). Wiki: "Each burns foes and grants vigor to allies," a single
    // shared "targets|5" wiki fact governing both — party-wide (see top comment's correction).
    5602: 'self', // Whirlpool (Cantrip). Stability is the caster's own shape-shift; no allies wording
    // anywhere.
    5646: 'self', // Convergence. "gain fury for each foe struck" — first-person self-only.
    5675: 'self', // Phoenix. "granting you vigor" — first-person self-only.
    5682: 5, // Windborne Speed. "You and nearby allies gain swiftness" — explicit party-wide, own
    // Number-of-Targets(5).
    5687: 'self', // Updraft. "Gain swiftness from a gust of wind" — first-person self-only.
    5748: 5, // Undercurrent. "damage foes and regenerate allies" — explicit party-wide.
    25498: 5, // Stomp (Elemental elite pet command). "granting protection to allies and crippling
    // foes" — explicit party-wide.
    29453: 5, // Sand Squall. "Apply protection to you and your allies" — explicit party-wide.
    29719: 5, // Overload Air. Wiki: "imbue your allies with electricity," Fury applied "in a 360
    // radius around the elementalist" with no separate ally cap stated — default 5.
    29948: 5, // "Flash-Freeze!" (Shout). Wiki confirms Regeneration reaches nearby allies alongside
    // the skill's own explicit "Frost Aura to allies in range" wording — standard shout reach.
    30047: 5, // "Eye of the Storm!" (Shout). "massively increasing speed and breaking stun for nearby
    // allies" — explicit party-wide (covers Superspeed/Swiftness/Stability together).
    30336: 5, // Dust Storm. "Grant boons to nearby allies" — explicit party-wide (Resistance).
    30432: 5, // "Aftershock!" (Shout). Wiki confirms Protection and Aegis reach nearby allies
    // alongside the skill's own explicit "Magnetic Aura to allies" wording — standard shout reach.
    30662: 5, // "Feel the Burn!" (Shout). Wiki confirms Might and Fury reach allies alongside the
    // skill's own explicit "Fire Aura to allies" wording — standard shout reach; Tempestuous Aria
    // (trait 1891) adds more of the same party-wide Might on top, no conflict.
    40332: 5, // Pressure Blast (Trident 4, dual attack). "healing allies and damaging foes" —
    // explicit party-wide, separate Ally Healing/Self Healing facts both present (standard "nearby
    // allies including self" reach).
    40963: 'self', // Grinding Stones (Hammer). Wiki confirms Stability applies "only to the caster" —
    // no allies wording anywhere.
    44550: 'self', // Lahar (Hammer). Wiki confirms Stability applies "only to the caster" — no
    // allies wording anywhere.
    45742: 'self', // Glacial Drift (Hammer). Wiki confirms Stability applies "only to the caster" —
    // no allies wording anywhere.
    46140: 'self', // Katabatic Wind (Hammer). Wiki confirms Regeneration applies "only to the
    // caster" — a version-history note explicitly states this boon was never intended for allies.
    46185: 'self', // Molten Burst (Hammer). "Gain a shield of earth" — first-person self-only; wiki
    // confirms Stability is the caster's own.
    46447: 'self', // Lava Skin (Hammer, dual attack). "Cover yourself in an increasing barrier" —
    // first-person self-only, no allies wording anywhere.
    51646: 5, // Transmute Frost. "healing allies and damaging foes" — explicit party-wide.
    51684: 5, // Transmute Earth. Wiki confirms Stability reaches allies via its own explicit "Boon
    // Radius(600)" fact, distinct from the "Attack Radius(240)" — party-wide.
    62910: 'self', // Molten End (Catalyst hammer). "gain offensive boons" — first-person self-only
    // (Might/Fury).
    76563: 5, // Otter's Compassion (Evocation meditation). "granting them boons" — explicit
    // party-wide (Resolution/Vigor); Regeneration bonus via Altruistic Aspect (trait 2415) shares
    // the same party-wide reach — no conflict (contrast with Hare's Agility, excluded above).
    76707: 5, // Seismic Impact (Evoker toad familiar). "Allies in the area gain protection" —
    // explicit party-wide.
    77247: 5, // Toad's Fortitude (Evocation meditation). "Grant protection to nearby allies" —
    // explicit party-wide (Protection); Resistance ("grants resistance to allies") and Stability
    // bonus via Altruistic Aspect (trait 2415) share the same party-wide reach — no conflict.

    // Deploy Jade Sphere (Catalyst profession mechanic, one id per element/tier variant). Shared
    // description across every variant: "granting boons to allies in its radius based on its
    // element" — party-wide, reusing the shared "Number of Targets: 5" fact as the ally count (same
    // reused-label shape as Healing Rain/Heat Wave above). Element→boon: Water→Resolution,
    // Fire→Might, Earth(Poison field)→Protection, Air(Lightning field)→Fury+Quickness.
    62723: 5,
    62813: 5,
    62837: 5,
    62940: 5,
    63396: 5,
    63416: 5,
    63439: 5,
    63454: 5,
    63458: 5,
    63459: 5,
    63461: 5,
    63472: 5,
    75391: 5,
    75392: 5,
    75394: 5,
    75395: 5,
    75399: 5,
    75405: 5,
    75406: 5,
    75407: 5,

    // --- PrefixedBuff target-count sweep (2026-08-09), Elementalist leg (1st leg): the TODO.md
    // follow-up left open by the Session 133 `PrefixedBuff` extraction fix. This leg's sources are
    // every attunement-based boon grant on Elementalist (`Glyph of Elemental Harmony`'s heal,
    // `Inscription`'s glyph-boon effect riding on `Glyph of (Lesser) Elementals`, `Elemental
    // Celerity`, `Unravel`) — all confirmed self-only: every source's own wiki description phrases
    // the grant "Gain X" (first-person, the elementalist), never "nearby allies"/"to allies," unlike
    // every confirmed party-wide entry above. Only boon-classified facts are curated here — condition
    // facts riding the same `PrefixedBuff` shape (e.g. Arcane Precision's crit conditions) never
    // render `targetCount` at all (`SkillsEditor.tsx` gates the tooltip badge on `category === 'boon'`),
    // so they're out of scope for this sweep, not overlooked.
    5569: 'self', // Glyph of Elemental Harmony (heal). Wiki: "Heal yourself and gain a boon based on
    // your attunement."
    25486: 'self', // Glyph of Lesser Elementals (fire variant) — Might gated by Inscription (trait
    // 229 below); Inscription's own description: "Gain boons upon casting a glyph based on your
    // attunement."
    25487: 'self', // Glyph of Lesser Elementals (water variant) — Regeneration, same Inscription gate.
    25489: 'self', // Glyph of Elementals (earth variant, elite) — Protection, same Inscription gate.
    25490: 'self', // Glyph of Elementals (air variant, elite) — Swiftness, same Inscription gate.
    25491: 'self', // Glyph of Elementals (water variant, elite) — Regeneration, same Inscription gate.
    25495: 'self', // Glyph of Lesser Elementals (air variant) — Swiftness, same Inscription gate.
    25497: 'self', // Glyph of Lesser Elementals (earth variant) — Protection, same Inscription gate.
    62725: 'self', // Elemental Celerity (Catalyst elite). Wiki: "gain a boon based on its element" —
    // no allies wording on any of Might/Vigor/Fury/Protection.
    80231: 'self', // Unravel (Weaver mechanic). Wiki: "Gain boons based on your primary attunement."

    // Elementalist leg correction (2026-08-10, found while re-scanning ahead of the Guardian leg):
    // 5 more Glyph of Elemental Power ids the original leg's scan missed — same Inscription (229)
    // gate/reasoning as the Glyph of (Lesser) Elementals variants above, just a sibling skill whose
    // base (untraited) tooltip grants unrelated non-boon effects per attunement (Fire: burning,
    // Water: condition removal, Air: daze, Earth: barrier — confirmed via the wiki's own raw
    // wikitext), with Inscription layering ITS OWN boon on top the same "Gain boons upon casting a
    // glyph based on your attunement" way. Self-only, same precedent.
    5506: 'self', // Glyph of Elemental Power (base id) — Might(Fire)/Regeneration(Water)/
    // Swiftness(Air)/Protection(Earth), all Inscription-gated.
    34637: 'self', // Glyph of Elemental Power (air-attunement palette variant) — Swiftness.
    34714: 'self', // Glyph of Elemental Power (earth-attunement palette variant) — Protection.
    34736: 'self', // Glyph of Elemental Power (fire-attunement palette variant) — Might.
    34772: 'self', // Glyph of Elemental Power (water-attunement palette variant) — Regeneration.

    // --- PrefixedBuff target-count sweep, Revenant leg (2nd leg, 2026-08-10) — see the sweep's top
    // doc comment for scope/method. Confirmed self-only from the API's own fact data (no Number-of-
    // Allied-Targets/Radius signal, and the structurally parallel Death Drop buff variants are all
    // first-person "outgoing ... increased," no ally wording).
    55029: 'self', // Ancient Echo (Herald mechanic, all 4 legend-bond effects). Wiki: "All four effects
    // only affect the caster."

    // --- PrefixedBuff target-count sweep, Ranger leg (3rd leg, 2026-08-10) — see the sweep's top doc
    // comment for scope/method. 6 Untamed cantrips, all confirmed self-only: each carries two
    // PrefixedBuff variants gated by the Unleash Ranger F2 mechanic's two mutually-exclusive states
    // ("Unleashed" = ranger fights alone, pet stowed; "Pet Unleashed" = pet is out and active), but
    // neither state spreads the boon to other squad members — no ally wording on any wiki page, and
    // no Number-of-Allied-Targets/Radius fact tied to either PrefixedBuff variant on any of them
    // (the one Number/Radius fact each carries, where present, is for an enemy-facing effect: Nature's
    // Binding's cage targets, Unnatural Traversal's vulnerability radius). Same "self, regardless of
    // whether a pet also benefits" precedent as Guard!/Lesser Guard! above (12632/69183).
    63130: 'self', // Nature's Binding (Cantrip). Quickness (Unleashed)/Resistance (Pet Unleashed).
    63157: 'self', // Exploding Spores (Cantrip). Might (Unleashed)/Protection (Pet Unleashed).
    63163: 'self', // Forest's Fortification (Cantrip). Vigor (Pet Unleashed) — wiki notes the pet is
    // also affected, but that's not a squad ally.
    63195: 'self', // Unnatural Traversal (Cantrip). Quickness (Unleashed)/Regeneration (Pet Unleashed).
    63256: 'self', // Mutate Conditions (Cantrip). Fury (Unleashed)/Vigor (Pet Unleashed).
    63319: 'self', // Perilous Gift (Cantrip). Stability (Pet Unleashed).

    // --- PrefixedBuff target-count sweep, Guardian leg (4th leg, 2026-08-10) — see the sweep's top
    // doc comment for scope/method. See the matching trait table entry below (Inspired Virtue, 621)
    // for the other 3 Guardian sources this leg.
    76982: 5, // Glaring Burst (Luminous/radiant weapon mechanic). Own facts: explicit "Number of
    // Targets: 5", Radius(240). Two of its 4 weapon-variant PrefixedBuff facts are boon-classified —
    // Radiant Bulwark's Resolution ("Grants aegis to nearby allies on activation") and Luminous
    // Staff's Regeneration ("granting boons to allies and creating a symbol") — both explicitly ally-
    // facing per the wiki; the other 2 variants (Gleaming Blade's Vulnerability, Dazzling Hammer's
    // Damage Increase) aren't boons and are out of this sweep's scope.

    // --- Per-buff-line target-count model (2026-08-11) — see this table's own top doc comment's
    // "Per-buff-line target-count model" section for the full list/rationale. Each entry below is a
    // `SourceTargetCountOverride` per-status map or conditional, not a flat value.

    // Tome of Courage (Guardian, all 4 flip-chain ids share the identical fact shape — confirmed live
    // against game-data). Base Aegis (no requires_trait): self, wiki "Virtue: Gain aegis
    // periodically." Stability (requires_trait 612, Indomitable Courage: "grants stability to nearby
    // allies"): party(5). Protection (requires_trait 621, Inspired Virtue: "apply boons to allies
    // when activated"): party(5). Resolution (requires_trait 604, Virtue of Resolution: "Gain
    // resolution when you activate a Virtue" — first-person, no allies wording despite living on the
    // same source as 2 party-wide lines): self.
    42259: { Aegis: 'self', Stability: 5, Protection: 5, Resolution: 'self' },
    42371: { Aegis: 'self', Stability: 5, Protection: 5, Resolution: 'self' },
    68646: { Aegis: 'self', Stability: 5, Protection: 5, Resolution: 'self' },
    68650: { Aegis: 'self', Stability: 5, Protection: 5, Resolution: 'self' },

    // Well of Power (Necromancer, both ids). Stability (1 fact, no requires_trait): self, wiki "Only
    // the stability and stun break are exclusively applied to the caster upon cast." Might (2
    // differently-timed facts on 10609, 1 on 10673, all unconditioned): party(5), wiki "One stack of
    // Might is applied to allies in range every pulse" — no composite key needed, both Might facts on
    // 10609 share the same reach.
    10609: { Stability: 'self', Might: 5 },
    10673: { Stability: 'self', Might: 5 },

    // Mark of Blood (Necromancer staff mark). Base Regeneration (no requires_trait): party(5), wiki
    // "grants regeneration to allies," own Number-of-Targets(5)/Radius(240). Vigor (requires_trait
    // 778, Transfusion): party but count 1 — the established "one ally per mark trigger" mechanic,
    // same as Chillblains/Reaper's Mark/Lesser Chilblains above, not the usual 5-ally pulse.
    19117: { Regeneration: 5, Vigor: 1 },

    // Pain Absorption (Revenant/Legendary Demon, both ids). THREE unconditioned/trait-gated
    // Resistance facts with different durations need the composite `status@duration` key (bare
    // `Resistance` alone can't disambiguate them): Resistance@3 (no requires_trait, wiki "Grant
    // resistance to yourself and nearby allies"): party(5). Resistance@1 (no requires_trait, wiki's
    // "additional resistance per condition" bonus, caster-only): self. Resistance@5 (requires_trait
    // 1789, Demonic Defiance: "Gain resistance...when you use a Legendary Demon skill" — first-person):
    // self. Resolution (1 fact @5s, no requires_trait, wiki "gaining resolution" — the caster's own
    // condition-absorb bonus, not shared): self, no composite key needed (only 1 Resolution fact).
    27322: { 'Resistance@3': 5, 'Resistance@1': 'self', 'Resistance@5': 'self', Resolution: 'self' },
    78505: { 'Resistance@3': 5, 'Resistance@1': 'self', 'Resistance@5': 'self', Resolution: 'self' },

    // Gladiator's Defense (Revenant/Legendary Entity Stance, "Antique Stance"). Self-only by default
    // (Resolution/Resistance both @3s) — wiki's "Resonance" note: when Legendary Dwarf Stance
    // (`Legend.id` 'Legend3') is ALSO equipped, "the boons are also granted to allies in a radius
    // around you," backed by an explicit `Additional Allies Affected: 4` fact (self + 4 = 5, the
    // standard cap). A whole-source legend-conditional, not per-status — both Resolution and
    // Resistance flip together, so one override covers the entire source.
    77291: { gatedBy: 'legend', legendId: 'Legend3', legendName: 'Dwarf Stance', whenEquipped: 5, otherwise: 'self' },

    // Overload Earth (Elementalist/Catalyst). Base (untraited) Stability (no requires_trait, wiki
    // "Initial Stability... as a personal effect"): self — also covers a `requires_trait`-gated
    // apply-count upgrade (same self-only Stability, more stacks). Base Protection (no requires_trait,
    // wiki confirms it reaches self AND allies despite its own text naming only "other allies"):
    // party(5).
    29618: { Stability: 'self', Protection: 5 },

    // Hare's Agility (Elementalist/Evocation meditation). Base Swiftness (no requires_trait, wiki
    // "applies only to the caster"): self. Fury (requires_trait 2415, Altruistic Aspect: "Meditation
    // skills grant boons to allies" — its own wiki page documents a fixed per-meditation bonus-boon
    // table naming this exact Swiftness->Fury addition): party(5).
    76583: { Swiftness: 'self', Fury: 5 }
  },
  trait: {
    // All of the below grant a tracked boon on some proc condition with no Number fact of their own,
    // and each one's OWN description explicitly says "nearby allies" (or "yourself and nearby
    // allies") — no ambiguity to resolve, just the missing count. Phalanx Strength is the one with an
    // explicit wiki count ("applies to 4 other targets", i.e. 5 total); the rest use 5 by the same
    // default (see table doc comment).
    677: 5, // Master of Manipulation (Mesmer) — "Manipulations grant aegis to yourself and nearby allies."
    965: 5, // Spirited Arrival (Ranger) — "Grant boons to nearby allies when swapping pets."
    1697: 5, // Invigorating Bond (Ranger) — "Beast skills heal allies around the ranger."
    1711: 5, // Phalanx Strength (Warrior) — wiki: "Applies to 4 other targets" (5 total).
    1948: 5, // Hardy Conduit (Elementalist) — "Overloads grant protection to nearby allies."
    1952: 5, // Gale Song (Elementalist) — "Grant protection to nearby allies when you use a healing skill."
    1999: 5, // Expert Examination (Engineer) — see skill 29772's comment above.
    2042: 5, // Heat the Soul (Warrior) — "Grant boons to nearby allies when you hit an enemy with a Burst skill."
    2052: 5, // Kinetic Accelerators (Engineer) — "Grant boons to nearby allies when you...combo a field..."
    2105: 5, // Stoic Demeanor (Guardian) — "Grant boons to nearby allies when you disable, immobilize, or slow an enemy."
    2154: 5, // Endless Enmity (Revenant) — "Grant fury to yourself and nearby allies when you critically strike a foe."
    2237: 5, // River's Flow (Elementalist) — "Grant boons to nearby allies and gain positive flow when swapping to the gunsaber."
    // Phoenix Protocol (trait 2195, Willbender) deliberately excluded — see this table's top comment.

    // --- Group A sweep (2026-08-06), Thief leg: all three explicitly say "nearby allies"/"allies" in
    // their own description, each with its own Radius/Number-of-Targets(5) fact backing it up.
    1210: 5, // Unrelenting Strikes (Critical Strikes). "Grant fury to yourself and nearby allies when
    // you critically strike an enemy."
    2285: 5, // Traversing Dusk (Specter). "Heal allies in the area around you when you shadowstep...
    // Wells grant resistance on their initial impact" — also gates every Specter well's Resistance
    // (see the skill table above).
    2393: 5, // Possessive Hoarder (Antiquary). "Artifacts grant boons to allies when used...Barrier...
    // now also granted to allies as well."

    // --- Group A sweep (2026-08-06), Necromancer leg:
    2405: 5, // Empowering Spirits (Ritualist). "Grant boons to nearby allies when you summon a
    // spirit" — own Radius(300)/Number-of-Targets(5) fact confirms the standard 5.

    // --- Group A sweep (2026-08-06), Warrior leg:
    1482: 5, // Empower Allies (Tactics). "...grant might to yourself and nearby allies each
    // interval" — explicit party-wide, own Radius(600)/Number-of-Targets(5).

    // --- Group A sweep (2026-08-06), Engineer leg:
    1901: 5, // Automated Medical Response (Alchemy). "Grant regeneration to nearby allies when you use
    // a healing skill's associated tool belt skill" — explicit party-wide.
    1923: 'self', // No Scope (Firearms). "Critical hits on foes within the range threshold have a
    // chance to grant fury. Fury grants you ferocity" — first-person throughout, self-only; the
    // Number-of-Targets(5)/Boon Radius(360) facts describe the crit-eligible foe area, not an ally
    // count.
    2296: 5, // Mech Arms: High-Impact Drivers (Mechanist). "Your mech's attacks now generate might for
    // allies within a radius" — explicit party-wide.
    2387: 5, // New Genes (Amalgam). "Morph skills grant boons to allies" — explicit party-wide.

    // --- Group A sweep (2026-08-06), Revenant leg (6th leg): all 6 explicitly say "nearby allies"/
    // "allies" in their own description, each with its own Number-of-Targets(5) fact backing it up.
    1738: 5, // Shared Empowerment (Herald). "When applying a boon to an ally, also apply might to
    // nearby allies."
    1786: 5, // Assassin's Presence (Vindicator). "...grant fury to yourself and nearby allies each
    // interval."
    2228: 5, // Redemptor's Sermon (Salvation). "...heal allies in the area and grant them protection."
    2248: 5, // Amnesty of Shing Jea (Alliance). "...grants...to nearby allies" (Might/Regeneration).
    2255: 5, // Song of Arboreum (Alliance). "...grants its endurance and vigor to nearby allies."
    2355: 5, // Shared Wisdom (Alliance). "Grant boons to allies whenever you use a Legendary Entity
    // Skill."

    // --- Group A sweep (2026-08-06/07), Ranger leg (7th leg): all 6 explicitly say "nearby allies"/
    // "around the ranger" in their own description, each with its own Number-of-Targets(5) fact.
    978: 5, // Wellspring (Druidic Clarity). "Grant regeneration to nearby allies when you use a
    // healing skill."
    1016: 5, // Fang and Claw (Beastmastery). "Beast skills grant fury around the ranger."
    1055: 5, // Rejuvenation (Beastmastery). "Beast skills grant regeneration around the ranger."
    2016: 5, // Verdant Etching (Druid). "Glyphs heal nearby allies. While in celestial avatar form,
    // grant protection instead."
    2271: 5, // Let Loose (Untamed). "Unleashed Ambush skills grant boons to nearby allies." A separate,
    // unconditioned bonus on top of whichever ambush skill is used — not a `requires_trait` gate on
    // those skills' own facts (see Unleashed Thump/Relentless Whirl's own self-only entries above).
    2408: 5, // Flock Together (Beastmastery). "Beast skills grant quickness around the ranger."

    // --- Group A sweep (2026-08-07), Mesmer leg (8th leg): all 12 explicitly say "nearby allies"/
    // "allies" in their own description, each with its own Radius/Number-of-Targets(5) fact backing it.
    666: 5, // Metaphysical Rejuvenation (Chaos). "Grant regeneration to nearby allies when you use a
    // healing skill."
    668: 5, // Chaotic Transference (Chaos). "Gaining chaos aura grants boons to nearby allies."
    675: 5, // Illusionary Defense (Chaos). "Grant protection to nearby allies when you use Shatter skill 2."
    707: 5, // Master Fencer (Domination). "Grant fury to yourself and nearby allies when you critically
    // strike an enemy."
    1687: 5, // Bountiful Disillusionment (Chaos). "Grant an additional boon to nearby allies based on
    // which Shatter skill you use."
    1852: 5, // Inspiring Distortion (Chaos). "Grant aegis to other nearby allies whenever you give
    // yourself distortion or use Shatter skill 4."
    1942: 5, // Stretched Time (Chronomancer). "Nearby allies gain boons for each clone you shatter.
    // Grant boons to nearby allies when you summon a phantasm."
    1980: 5, // Temporal Enchanter (Chronomancer). "When you cast a glamour, allies near the glamour gain
    // resistance and superspeed."
    2005: 5, // Mental Defense (Chronomancer). "Shatter skill 4 grants boons and breaks allies out of
    // stuns" — own Radius(600)/Number-of-Targets(5) fact confirms the standard 5.
    2022: 5, // Seize the Moment (Chronomancer). "You and nearby allies gain quickness for each clone you
    // shatter. Grant quickness to nearby allies when you summon a phantasm."
    2174: 5, // Mirage Mantle (Mirage). "Ambush skills you use grant boons to nearby allies."
    2326: 5, // Raconteur (Troubadour). "Tales heal and grant protection to nearby allies."

    // --- Group A sweep (2026-08-07), Guardian leg (9th leg): 3 traits resolved. Holy Reckoning
    // (trait 2210) deliberately excluded — see this table's top comment.
    562: 5, // Empowering Might (Honor). "Grant might to nearby allies when you critically strike."
    586: 5, // Monk's Focus (Valor). "Meditation skills heal you and grant fury to nearby allies" (also
    // grants Resolution to allies as of 2024-06-25).
    612: 5, // Indomitable Courage (Virtues). "The active effect of Virtue skill 3...grants stability to
    // nearby allies."

    // --- Group A sweep (2026-08-07), Elementalist leg (10th and final leg): 5 traits resolved, no
    // exclusions.
    214: 'self', // Raging Storm (Air). "Critically striking a foe grants fury" — first-person
    // self-only despite its own Radius(360)/Number-of-Targets(5) fact, same "radius alone isn't
    // sufficient evidence" tell as Ranger's "Guard!".
    281: 5, // Rock Solid (Earth). "Grant stability to nearby allies when attuning to earth" —
    // explicit party-wide.
    1891: 5, // Tempestuous Aria (Tempest). "Using a shout grants allies might" — explicit
    // party-wide.
    2033: 5, // Lucid Singularity (Tempest). "Apply boons to nearby allies while channeling
    // overloads..." — explicit party-wide (Alacrity/Might).
    2234: 5, // Spectacular Sphere (Catalyst). "...grants quickness and an additional boon based on
    // your current attunement to nearby allies when activated" — explicit party-wide (Swiftness/
    // Quickness/Might/Vigor/Fury/Aegis/Resistance, depending on attunement).

    // --- PrefixedBuff target-count sweep (2026-08-09), Elementalist leg (1st leg) — see the skill
    // table's matching comment above for this leg's scope/reasoning. All 7 traits confirmed
    // self-only from their own wiki wording (no "allies" anywhere).
    229: 'self', // Inscription (Air). Wiki: "Gain boons upon casting a glyph based on your
    // attunement. Gain resistance when attuning to air." — also gates the Glyph skill entries above.
    263: 'self', // Arcane Lightning (Arcane). Wiki: each linked Arcane skill's bonus is worded as a
    // personal effect (Arcane Brilliance "grants Protection at the end of its animation," Arcane
    // Shield "grants stability...when the shield is destroyed," Arcane Echo "grants Quickness when
    // cast") — no ally wording on any of them.
    364: 'self', // Soothing Disruption (Water). Wiki: "Cantrips grant boons" — every linked cantrip's
    // bonus (Vigor/Fury/Stability/Resistance/Aegis/Protection/Regeneration) is a personal on-cast
    // buff, no ally wording; corroborates skill 5536's (Lightning Flash) existing self-only entry
    // above, gated by this same trait.
    1673: 'self', // Elemental Lockdown (Arcane). Wiki: "When you disable a foe, gain a boon based
    // upon your current attunement... Does not activate per target" — explicitly self, one buff per
    // disable regardless of how many foes.
    2061: 'self', // Swift Revenge (Weaver). Wiki: "Dual Attacks grant you additional bonuses based on
    // their elements" — "grant you," self-only.
    2233: 'self', // Elemental Synergy (Catalyst). Wiki: "Gain a bonus effect when you finish a combo"
    // — Fire/Water/Air/Earth bonuses (Might/self-heal/Endurance/Stability) all first-person.
    2382: 'self', // Enhanced Potency (Evoker minor). Wiki: "Improve a boon based on your familiar" —
    // strengthens the elementalist's own existing Might/Regeneration/Fury/Protection from familiar
    // skills (Ignite/Splash/Zap/Calcify), no ally wording.

    // --- PrefixedBuff target-count sweep, Elementalist leg correction (2026-08-10): the leg's
    // original discovery pass missed these 3 — all genuinely party-wide, unlike every other
    // Elementalist source above. Each wiki page's own `{{skill fact|targets|5}}` confirms the
    // standard 5.
    264: 5, // Elemental Attunement (Arcane minor). Wiki: "Grant a boon to nearby allies when changing
    // attunements" — explicit targets=5, radius=240.
    2380: 5, // Familiar's Blessing (Evoker). Wiki: "Grant boons to nearby allies when you use a
    // familiar skill" — explicit targets=5, radius=300.
    2415: 5, // Altruistic Aspect (Evoker). Wiki: "Meditation skills grant boons to allies" — explicit
    // targets=5, radius=360.

    // --- PrefixedBuff target-count sweep, Revenant leg (2nd leg, 2026-08-10): 7 sources, mixed
    // self/party-wide (unlike the all-self Elementalist leg). Party-wide ones are each corroborated
    // by an explicit "Number of Allied Targets" fact either on the trait itself or on the specific
    // linked skill(s) whose use grants the boon — same corroboration pattern as Hardening Persistence
    // above. Self-only ones have no such fact anywhere in the chain and their own wording is
    // first-person.
    1774: 5, // Spirit Boon (Invocation). Own facts: explicit "Number of Allied Targets: 5",
    // Radius(240) — "Invoking a legend grants boons to nearby allies based on the legend invoked."
    1814: 5, // Serene Rejuvenation (Salvation). Wiki: "Increase healing to other allies. Legendary
    // Centaur skills apply boons in an area." Corroborated by its 3 linked Centaur skills' own API
    // facts: Natural Harmony, Purifying Essence, and Energy Expulsion each carry "Number of Targets:
    // 5", Radius(240) — Protective Solace shares the same Radius(240) template.
    2133: 5, // Bold Reversal (Renegade). "Your Citadel Order skills are improved" — the added
    // Swiftness/Protection ride on Heroic Command and Orders from Above, both already explicit
    // "Number of Allied Targets: 5" on their own API facts (radius 300/240 respectively).
    2259: 'self', // Reaver's Curse (Vindicator). "Energy Meld's cooldown is reduced and it increases
    // the effectiveness of your NEXT DODGE" — no ally wording. Its Might (via the "Vassals of the
    // Empire" Death Drop variant) is structurally identical to the API-confirmed self-only
    // "Forerunner of Death" Death Drop variant (skill 62693): a personal on-landing buff, distinct
    // from that same skill's foe-facing Number of Targets(5)/Vulnerability.
    2352: 4, // Found Purpose (Conduit). Own facts: explicit "Number of Allied Targets: 4", Range(360)
    // — "Triggering Numinous Gift grants boons to allies in an area around you."
    2440: 'self', // Numinous Gift (Conduit minor). Own facts have no Number/Radius fact at all —
    // "Gain might and additional boons when you use Cosmic Wisdom" (first-person). The party-wide
    // version of this same effect is Found Purpose (2352) above, a separate trait id with its own
    // independent fact array — no per-line conflict, each renders its own tooltip from its own facts.

    // --- PrefixedBuff target-count sweep, Ranger leg (3rd leg, 2026-08-10): 2 traits, mirrors the
    // Revenant leg's mixed self/party-wide shape.
    2263: 'self', // Enhancing Impact (Untamed minor). Quickness (Unleashed)/Stability (Pet Unleashed).
    // Own description: "Disabling a foe grants YOU boons" (first-person) — same Unleash Ranger
    // self-only reasoning as the skill leg above.
    2425: 5, // Cloudburst (Soulbeast). Own facts: explicit "Number of Targets: 5", Radius(480) — wiki:
    // "these boons apply to nearby allies" when using Bluster or Hawkeye.

    // --- PrefixedBuff target-count sweep, Guardian leg (4th leg, 2026-08-10): 3 traits, mirrors the
    // Revenant/Ranger legs' mixed self/party-wide shape. See the skill table's Guardian entry above
    // for the matching skill-side source.
    621: 5, // Inspired Virtue (Zeal). Own facts: explicit "Number of Targets: 5", Radius(1200, though
    // the wiki flags the in-game value as actually 600 except on Willbender) — "Virtues apply boons
    // to allies when activated." Gates Virtue of Justice/Resolve/Courage's own Might/Regeneration
    // boon facts (already curated party-wide(5) above, e.g. 9115/9120/9250).
    1925: 'self', // Zealous Scepter (Zeal). Wiki: "Gain might when your Virtue skill 1 passive effect
    // triggers; gain more might while wielding a scepter" — first-person, no ally wording, no
    // Number/Radius fact of its own.
    2116: 5, // Legendary Lore (Firebrand). Wiki: "Tome skills gain bonuses..." — vague on its own, but
    // a documented bug note confirms the ally reach explicitly ("Chapter 1: Searing Spell only grants
    // 1 stack of Might instead of 2 stacks to allies. It works as intended on self"). Firebrand's
    // Tome-skill analog of Inspired Virtue above, same boon set (Might/Regeneration/Protection) —
    // same party-wide(5) default-count convention as the rest of this table.

    // --- PrefixedBuff target-count sweep, final leg (2026-08-10): the last 6 sources across 5
    // professions, small enough to combine into one leg rather than five single-source legs (see
    // TODO.md/the sweep's top doc comment for the corrected accounting). Closes the sweep — 45/45.
    1678: 5, // Experimental Turrets (Engineer, Inventions Master). Wiki: "Turrets... grant boons to
    // allies around them on a regular interval" — own Boon-Radius(600) fact but no explicit
    // Number-of-Targets fact, same "no explicit ally cap stated, default 5" convention as Oppressive
    // Collapse (44296)/Spectral Ring (10608) in the skill table above.
    673: 'self', // Auspicious Anguish (Mesmer, Chaos Master). Wiki: "Convert damaging conditions to
    // boons whenever you gain Distortion or become disabled" — first-person throughout, no ally
    // wording or Number/Radius fact anywhere on the page; the converted boons are the mesmer's own.
    2367: 5, // Life of the Party (Mesmer, Virtuoso). Wiki: "Lively Lute and Crescendo grant boons to
    // affected allies" — explicit ally wording, own Radius facts (600 for Lively Lute, 360 for
    // Crescendo) but no explicit Number-of-Targets fact, same default-5 convention as Experimental
    // Turrets above.
    778: 1, // Transfusion (Necromancer, Blood Magic). Own description: "Marks can be triggered by
    // allies to heal them and provide them with additional benefits" — the established "one ally per
    // mark trigger" mechanic already curated for all 4 of this trait's gated skill ids (Chillblains
    // 10605, Reaper's Mark 19115, Lesser Chilblains 76506 above, Putrid Mark 19116 in
    // `CONDITION_CLEANSE_TARGETS`), reused verbatim for the trait's own tooltip.
    2289: 5, // Shadestep (Thief, Specter). Own facts: explicit "Number of Targets: 5", Radius(360) —
    // wiki: "Shadow Shroud skills provide additional supportive effects to nearby allies and your
    // tethered ally."
    1471: 5, // Roaring Reveille (Warrior, Tactics Adept). Wiki: "Warhorn skills apply additional boons."
    // Gates Charge (14393)/Call of Valor (14394), both already curated party-wide(5) above — same
    // gate-reuse pattern as Inspired Virtue/Legendary Lore gating their own Virtue/Tome skills.

    // --- Per-buff-line target-count model (2026-08-11) — see this table's own top doc comment's
    // "Per-buff-line target-count model" section for the full list/rationale.

    // Holy Reckoning (Guardian/Willbender). 3 differently-timed Might facts (no requires_trait, own
    // description "Triggered virtue effects...now grant might to allies"): party(5), no composite key
    // needed since they all share one value. Fury (own description "Gain fury when activating Rushing
    // Justice" — first-person): self.
    2210: { Might: 5, Fury: 'self' },

    // Phoenix Protocol (Guardian/Willbender). Own base facts (multiple Alacrity/Regeneration/
    // Resolution tiers, no requires_trait on any of them) are self-only by default; its ONLY
    // trait-conditioned fact is a Radius(600) in `traitedFacts` gated on Battle Presence (554,
    // Guardian/Virtues: "Nearby allies gain the passive effect of Virtue skill 2") — when chosen,
    // ALL of Phoenix Protocol's boon lines broaden together (no per-status split in the data itself),
    // so this is a whole-source trait-conditional rather than a per-status map.
    2195: { gatedBy: 'trait', traitId: 554, traitName: 'Battle Presence', whenActive: 5, otherwise: 'self' },

    // Dodge-trigger calc-gap fix (2026-08-15, TODO.md): these traits' real Buff fact(s) were copied
    // onto the trait itself via `synthetic-trait-facts.json` (see that file's doc comment in
    // `load-game-data.ts`) from a separate un-equippable "proc skill" `skillIdsForBuild` never
    // reaches — each entry here just mirrors the SAME target-count value the proc skill's own
    // (now-orphaned but left in place) entry above already established.
    1446: 'self', // Reckless Dodge (Warrior/Discipline). Proc skill Reckless Impact (14268) above: self.
    //
    // Saint of zu Heltzer (2238) has NO entry here (as of 2026-08-15, reversing an earlier one): its
    // Alacrity grant is wiki-confirmed PvE-only (added 2025-06-24; `wvw-fact-overrides.json` already
    // resolves it to `'omit'` — see `62689`'s own comment above), and this app never displays a fact
    // confirmed absent in WvW. User-caught 2026-08-15; `synthetic-trait-facts.json`'s "2238" entry
    // and `DODGE_TRIGGER_NOTES.trait`'s "2238" entry were both removed for the same reason.
    //
    // Found in a follow-up 2026-08-15 pass once the original 28-candidate sweep's "dodge"-substring
    // gap (see `load-game-data.ts`) was discovered — these two traits' descriptions say "Dodging,"
    // not "dodge," so the original sweep never looked at them at all.
    2257: 5, // Forerunner of Death (Revenant/Vindicator). Proc skill Death Drop (62693) above: party(5)
    // (Vulnerability hits up to 5 foes, not allies — see that entry's own comment).
    2232: 5 // Vassals of the Empire (Revenant/Vindicator). Proc skill Imperial Impact (62859) above:
    // party(5). Trait's own `facts` array is entirely empty in the live API; both Might and
    // Protection come from the proc skill via `synthetic-trait-facts.json`.
  }
}

/** A resolved `SourceTargetCountOverride`, plus the display note (see `resolveOverrideValue`'s doc
 *  comment) to append to the emitted source's `sourceName` when a conditional override resolved via
 *  its "active" branch. */
interface ResolvedTargetCount {
  value: number | null
  nameSuffix: string | null
}

/**
 * Resolves one `SourceTargetCountOverride` against a specific Buff `fact`, given the build's active
 * traits/equipped legends — see `SourceTargetCountOverride`'s own doc comment for the 4 shapes this
 * handles. A per-status map is looked up by the composite `status@duration` key first (the only
 * disambiguator for a source with the SAME status appearing more than once with different reaches,
 * e.g. Pain Absorption's 2 unconditioned Resistance facts), falling back to the bare `status` key
 * (every other per-status entry, where one lookup covers every differently-timed fact of that status).
 * A conditional override (`gatedBy: 'trait'`/`'legend'`) returns a `nameSuffix` when it resolves via
 * its "active" branch, so `extractFromFacts` can append `+ <name>` to the emitted source's
 * `sourceName` — without that, a conditionally-party-wide row (e.g. Gladiator's Defense only when
 * Legendary Dwarf Stance is also equipped) would look indistinguishable from an unconditionally
 * party-wide one.
 */
function resolveOverrideValue(
  override: SourceTargetCountOverride | undefined,
  fact: Fact,
  activeTraitIdSet: Set<number>,
  equippedLegendIdSet: Set<string>
): ResolvedTargetCount {
  if (override === undefined) return { value: null, nameSuffix: null }
  if (typeof override === 'number' || override === 'self') return { value: typeof override === 'number' ? override : null, nameSuffix: null }
  if (override.gatedBy === 'trait') {
    return activeTraitIdSet.has(override.traitId)
      ? { value: typeof override.whenActive === 'number' ? override.whenActive : null, nameSuffix: override.traitName }
      : { value: typeof override.otherwise === 'number' ? override.otherwise : null, nameSuffix: null }
  }
  if (override.gatedBy === 'legend') {
    return equippedLegendIdSet.has(override.legendId)
      ? { value: typeof override.whenEquipped === 'number' ? override.whenEquipped : null, nameSuffix: override.legendName }
      : { value: typeof override.otherwise === 'number' ? override.otherwise : null, nameSuffix: null }
  }
  // Per-status(-line) map.
  const compositeKey = `${fact.status}@${fact.duration}`
  const resolved = compositeKey in override ? override[compositeKey] : override[String(fact.status)]
  return { value: typeof resolved === 'number' ? resolved : null, nameSuffix: null }
}

/** The only reliable "this reaches up to N allies" signal in the API's fact data — see
 *  `BoonConditionSource.targetCount`'s doc comment for why nothing else (the enemy-facing "Number
 *  of Targets" fact, or the absence of any Number fact at all) is trustworthy enough to use here.
 *  Falls back to `overrides` (a curated, wiki-verified per-source decision, same `skill`/`trait`
 *  shape as `TARGET_COUNT_OVERRIDES`/`CONDITION_CLEANSE_TARGETS`) when the fact data itself has no
 *  signal at all. Resolved per BUFF FACT, not once per source — see `resolveOverrideValue`. */
function resolveTargetCountFrom(
  fact: Fact,
  combinedFacts: Fact[],
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  overrides: { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> },
  activeTraitIdSet: Set<number>,
  equippedLegendIdSet: Set<string>
): ResolvedTargetCount {
  const alliedFact = combinedFacts.find((f) => f.type === 'Number' && f.text === 'Number of Allied Targets' && typeof f.value === 'number')
  if (typeof alliedFact?.value === 'number') return { value: alliedFact.value, nameSuffix: null }
  return resolveOverrideValue(overrides[sourceKind][sourceId], fact, activeTraitIdSet, equippedLegendIdSet)
}

/**
 * Curated per-instance qualifiers for sources with 2+ simultaneous `Buff`/`PrefixedBuff` facts
 * sharing one `status` — see `BoonConditionSource.instanceLabel`'s doc comment for the bug this
 * closes and the 255-source scope it found. Each entry is keyed by
 * `${status}@${duration}@${applyCount}` — the same tuple the tooltip's own duration/count text
 * already displays, so a lookup miss can't silently mislabel a fact whose numbers don't match. That
 * tuple is unique for the overwhelming majority of conflicts (the two facts differ in duration
 * and/or apply_count, e.g. Fire Bomb's 5s×2 vs 2s×1) — where it ISN'T unique (2+ facts share the
 * EXACT same status/duration/apply_count, e.g. Inspiring Reinforcement's two identical 3s×1
 * Stability facts, only distinguished by the wiki's own `alt=` template order), the key gets an
 * `#<occurrence>` suffix instead, numbered by each fact's 1-based position among its own tuple-mates
 * in the source's raw `facts`/`traitedFacts` array — the same order the wiki's `{{skill fact}}`
 * templates are listed in (confirmed: this codebase's other alt-label-derived facts, e.g. Searing
 * Fissure's "Initial Strike"/"Additional Strikes" damage lines, already rely on that same
 * template-order-mirrors-API-order convention). A tuple with no entry renders unlabeled — always the
 * source's unqualified "base" grant in every entry curated so far, its sibling instance(s) being the
 * only one(s) that need a qualifier to read unambiguously.
 *
 * Every label is quoted straight from its source's own wiki `alt=` text — EXCEPT Icerazor's Ire's
 * "On Hit" (see its own entry below), the one case in this table sourced from the user's direct
 * in-game observation instead, since the wiki itself gives that particular fact no qualifying text
 * at all.
 *
 * Revenant leg (1st leg, 2026-08-13): started from a scan of `data/game-data/{skills,traits}.json`
 * (after excluding sources `WvwFactOverrides` already resolves) that found 255 sources across all 9
 * professions with 2+ genuinely simultaneous same-status facts: 204 skills + 51 traits, 0 of the
 * traits Revenant's. Of the profession's 10 `skills.json`-sourced conflicts (12 ids — Pain
 * Absorption/Embrace the Darkness/Inspiring Reinforcement each have a 2nd split id), 9 got a real
 * wiki-`alt=`-sourced label here; the 10th, `Unrelenting Assault` (26699), turned out during its
 * wiki check to NOT be a genuine per-instance case at all — its "2 Might facts" are a bare
 * PvE(8s)/WvW+PvP(3s) split with no `alt=` wording anywhere on its own page, the exact shape
 * `WvwFactOverrides` already exists to collapse — fixed there instead (see
 * `data/game-data/wvw-fact-overrides.json`'s `"26699"` entry), not here.
 *
 * That `skills.json`/`traits.json` scan is blind to a SEPARATE, smaller universe this leg also swept
 * by hand after finding it: `data/game-data/synthetic-facts.json` (hand-curated facts for skills
 * whose real API entry is near-empty — see e.g. `fetch-wvw-splits.ts`'s comment on Icerazor's Ire,
 * this whole TODO.md bug's ORIGINAL flagged example, 2026-08-09). Of its 81 skill ids, 4 distinct
 * concepts (8 ids, all Revenant/Renegade "Band Together" legend skills) had the same unlabeled-
 * duplicate shape: Icerazor's Ire and Breakrazor's Bastion both got real wiki-`alt=` labels below;
 * Darkrazor's Daring's wiki page has no `alt=` wording for either of its 2 simultaneous Stability
 * facts (already documented as a gap in `fetch-wvw-splits.ts`'s own comment on 72366) so is
 * deliberately left with no entry — nothing to curate from, not an oversight; Fox's Fury turned out
 * to be Elementalist, not Revenant, despite living in this same Revenant-heavy synthetic-facts.json
 * neighborhood — left for that profession's own future leg. A full synthetic-facts.json sweep for
 * the other 8 professions hasn't been done yet — noted as added scope in TODO.md alongside the
 * 245-source `skills.json`/`traits.json` remainder.
 *
 * Thief leg (2nd leg, 2026-08-14): smallest remaining profession pool per a rescan (17 skill + 9
 * trait conflict sources -- the rescan also fixed the original scan methodology: it now excludes
 * `overrides`-linked traitedFacts, which REPLACE the fact they point at rather than adding a 2nd
 * simultaneous instance, same precedent as barrier-calc.ts's comment on Lava Skin/46447). Of those
 * 26, several turned out to be dead ends the rescan itself couldn't see: their conflicting `status`
 * isn't a recognized `BOON_NAMES`/`CONDITION_NAMES` entry at all (a skill's own self-named buff
 * marker like "Assassin's Signet", or a status handled by the entirely separate
 * `MISCELLANEOUS_MATCHERS` pipeline like Stealth/Superspeed, or "Heal"/"Exhaustion" on 2 trait
 * facts) -- `classifyBoonCondition` gates every one of those out before this table's lookup is ever
 * reached, so no entry (here or in `WvwFactOverrides`) would have any effect; see the `skill`/
 * `trait` blocks' own NOTEs below for the full list this ruled out.
 *
 * Of the sources that DO reach this table's lookup, 6 got real labels here (5 skill, the
 * first-ever trait entry -- `BUFF_INSTANCE_LABELS.trait` was empty before this leg): Venomous
 * Knife, Deadly Aim, Brutal Aim, Malicious Ripper, Holo-Dancer Decoy (both split ids share one
 * entry), and Serpent's Touch. 3 more turned out to be plain PvE/WvW(+PvP) splits with no `alt=`
 * wording at all, fixed via `WvwFactOverrides`/`fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` instead
 * (same redirect as Unrelenting Assault in the Revenant leg) -- see that file's own comment on
 * skill id 76674 and trait ids 1292/2093 for the reasoning (Be Quick or Be Killed is the
 * documented "API rounds X.5s up" quirk, same shape as Potent Haste/Overwhelming Celerity).
 *
 * The remaining sources stay open, nothing to curate from: Choking Gas (13024) and Leeching
 * Venoms' Spider Venom stacks (1130, a non-boon status so moot for THIS table but its Poisoned
 * facts share the same shape) are genuine API duplicates/mode-splits with no wiki text to
 * distinguish them, Leeching Venoms' also a duration-unchanged apply_count-only split which
 * `WvwFactOverride` structurally can't express (it only overrides `duration`, same limitation
 * documented on Icerazor's Ire/Fox's Fury in fetch-wvw-splits.ts); Spider Venom (13037) and Falling
 * Spider (73076) are pve/wvw+pvp splits where duration AND apply_count both change, the same
 * mechanism gap; Death Blossom (13006) has a wiki split whose exact values don't line up with the
 * locally-cached raw facts (possible data drift, not confidently resolvable without a live-API
 * cross-check); Deadly Strike (13125) and Malicious Deadly Strike (50417) each have a 2nd Weakness
 * fact gated by the Hidden Thief trait (1284) with no wiki `alt=` anywhere on either skill's own
 * page to quote; Forged Surfer Dash (76633) and Mistburn Mortar (77277/77288) are Convergence
 * "Artifact" skills whose Burning facts tangle a 3-way pve/wvw/pvp split across 2 different
 * `linked skill=` sources -- not confidently untangleable from the wiki alone. That same Artifact
 * system also has its own trait side (Possessive Hoarder, 2393) with a 3-way-split Might/Alacrity/
 * Protection/Regeneration/Fury shape too entangled to safely map onto this leg's local raw fact
 * order -- deliberately left uncurated rather than risk mis-assigning a label to the wrong fact;
 * worth a dedicated future pass across every profession's Artifact skills/traits as one unit rather
 * than piecemeal per-profession legs, since the mechanic itself isn't profession-specific.
 *
 * Warrior leg (3rd leg, 2026-08-14): smallest remaining pool per a rescan re-run with the Thief
 * leg's 2 methodology fixes applied from the start (excluding `overrides`-linked facts AND
 * pre-filtering to recognized `BOON_NAMES`/`CONDITION_NAMES` statuses) — 19 skill + 4 trait sources,
 * several of them split ids sharing one wiki page/fact set (Arcing Slice x4, Bloodthirster x4).
 * 8 got real labels here (5 skill entries, 2 of which cover 4 ids each so 8 ids total; 2 trait
 * entries), including this table's 2nd `linked skill=`-sourced label (Heat the Soul's "On
 * Decapitate", same convention as Shadestep in the Thief leg). 3 more were plain PvE/WvW(+PvP)
 * splits with no `alt=` wording, fixed via `WvwFactOverrides` instead (Banner of Tactics' Resistance,
 * Marching Orders' Might, Feverish Pulse's Quickness). The rest stay open: 2 were scan false
 * positives (a `{{skill fact|condition|...}}` Condition-Removed marker fact with no `duration`,
 * which `extractFromFacts` already filters out before this table is ever consulted — Knot Shot,
 * Brutal Shot's Immobile pair); Brutal Shot's Vulnerability pair and Eviscerate's Might pair are
 * pve/wvw+pvp splits where duration AND apply_count both change (the same `WvwFactOverride`
 * limitation as Falling Spider in the Thief leg); Wounding Strike has no wiki page at all despite a
 * live-API-confirmed name; Banner of Tactics' Stability pair has only ONE `alt=`-labeled Stability
 * template on its whole wiki page for 2 raw-identical facts; Marching Orders' Protection pair is
 * gated by a different trait (Vengeance) with no wiki text of its own to quote for it. See the
 * `skill`/`trait` blocks' own comments below for the full per-source writeup.
 *
 * Necromancer leg (4th leg, 2026-08-14): smallest remaining pool per a rescan with all prior legs'
 * methodology fixes applied — only 3 skill + 1 trait conflict sources (a much smaller pool than the
 * pre-fix "24" estimate, itself now confirmed stale). All 3 skill sources got real wiki-`alt=`-
 * sourced labels: Dark Pact's self-inflicted Bleeding echo, Rending Claws' below-health-threshold
 * Vulnerability bonus, and "You Are All Weaklings!"'s 2 single-stack Might bonuses (occurrence-
 * indexed, "Might per Hit"/"Might per Melee Hit"). The lone trait conflict, Dhuumfire's untraited
 * Burning pair, stays open — 2 raw-identical 3s facts, but the wiki page's base section carries only
 * ONE `{{skill fact|burning|3}}` template, nothing to distinguish them (same "one wiki concept, two
 * raw facts" shape as this leg's own Banner-of-Tactics precedent above).
 *
 * Guardian leg (5th leg, 2026-08-14): smallest remaining pool per a rescan (18 skill + 6 trait
 * conflict sources, several split ids sharing one wiki page — Sword of Justice x4, Shield of
 * Judgment/Tome of Justice x2 each). Most of this leg's real finds turned out to be plain
 * WvwFactOverride cases rather than genuine per-instance conflicts — a bare mode split with only
 * ONE wiki concept (Tome of Justice, Shield of Judgment, Sword of Justice, Advancing Strike,
 * Permeating Wrath, Unrelenting Criticism, Legendary Lore's 3 Tome-linked grants, and Willbender
 * Flames' Searing Pact-linked Burning, a "trait fact copied onto the skill it triggers from" case
 * same shape as the Notoriety cluster) — fixed via `WvwFactOverrides`/`fetch-wvw-splits.ts`'s
 * `MANUAL_OVERRIDES` instead, see that file's own comment block on this leg for the per-source
 * writeup (2 of them, Permeating Wrath and Unrelenting Criticism, also hit the documented "API
 * rounds a half-second duration up" quirk). Only 2 sources got a genuine BUFF_INSTANCE_LABELS entry
 * this leg: Rushing Justice's partial "Initial Burning" label (skill) and both of this leg's first
 * multi-status-family entries, Zealous Scepter's Scepter/Non-Scepter Might Gain and Phoenix
 * Protocol's Trigger/Activation Alacrity+Resolution (traits) — see the `skill`/`trait` blocks' own
 * comments below for the full per-source writeup, including everything left open (Virtue of Justice,
 * Spear of Justice, Crashing Courage, Dragon's Maw, Resolute Subconscious).
 *
 * Engineer leg (6th leg, 2026-08-14): smallest remaining pool per a rescan (23 skill + 3 trait
 * conflict sources — Toss Elixir H/Super Elixir each split across 2 ids sharing one wiki page).
 * 8 skill + 2 trait sources got a genuine label here: Blowtorch, Blunderbuss, Radiant Arc, Essence
 * of Liquid Wrath, Essence of Animated Sand, Lightning Rod, Conduit Surge, Electric Artillery
 * (skills), New Genes and Hardened Chrome (traits — New Genes' Offensive Protocol: Obliterate label
 * is this table's first sourced from a version-history note rather than a wiki fact line/`linked
 * skill=`, since the wiki's own fact template for that line is missing its wvw+pvp variant). 7 more
 * turned out to be plain WvwFactOverride cases — Magnetic Shield/Static Shield (an Over Shield-
 * linked Protection pair with no wiki fact at all, sourced from that trait's own version history
 * instead), Blessing of Dwayna/Leafy Bandage/Static Shock/Bandage Self/Regenerating Mist (an Expert
 * Examination-linked Protection pair) — see `fetch-wvw-splits.ts`'s own comment block on this leg.
 * New failure mode this leg: Toss Elixir H (both ids) and Reconstruction Field carry that exact
 * same Expert-Examination-linked pair PLUS their own genuine untraited base Protection fact sharing
 * the same status — `WvwFactOverride` can only override a whole status, not scope to just the
 * trait-gated subset, so fixing them the same way would silently corrupt the untraited value; left
 * unfixed rather than risk a wrong display (see the `skill` block's own comment for this leg). Also
 * left open: Poison Dart Volley and Super Elixir (both ids), each a data mismatch between the local
 * raw facts and either the wiki or the gating trait's own facts, not confidently resolvable; Throw
 * Napalm, no `alt=` anywhere on its page.
 *
 * Ranger leg (7th leg, 2026-08-14): smallest remaining pool per a rescan — only 3 skill sources, 0
 * trait sources (the earlier "31" estimate was as stale as Necromancer's "24" turned out to be, once
 * the Thief leg's methodology fixes are applied from the start). All 3 are the elite spirit skills'
 * own pulsed-boon fact, each duplicated identically twice: Storm Spirit (Fury), Stone Spirit
 * (Protection), Frost Spirit (Resolution). Storm Spirit and Stone Spirit turned out to be plain
 * pve/wvw+pvp splits with no `alt=` wording — fixed via `WvwFactOverrides`/`fetch-wvw-splits.ts`'s
 * `MANUAL_OVERRIDES` instead, a new sub-shape of that pattern: the API duplicates the PvE duration
 * onto BOTH raw facts rather than encoding one fact per mode, so the usual auto-detection (which
 * requires both the wiki's PvE AND wvw+pvp values to already appear among the raw durations) can't
 * find it — Storm Spirit's wvw+pvp Fury value (1.5s) is confirmed via a 2023-07-18 version-history
 * note instead of a coincidental raw-fact match, same sourcing shape as Engineer leg's New Genes.
 * Frost Spirit's identical-shaped Resolution pair stays open — its wiki page carries only ONE
 * `{{skill fact|resolution|2|stacks=4}}` line, no game-mode split and no `alt=`, so unlike its two
 * spirit siblings there's no wiki text to attribute either raw fact to (same "one wiki concept, two
 * raw facts" shape as the Thief leg's Dhuumfire precedent).
 *
 * Mesmer leg (8th leg, 2026-08-14): smallest of the 2 remaining pools per a rescan (22 skill + 12
 * trait conflict sources, Axes of Symmetry/Lively Lute each split across 2 ids sharing one wiki
 * page/trait data). 11 skill + 6 trait sources got a genuine label here — Temporal Curtain,
 * Phantasmal Mage, The Prestige, Chaos Armor, Well of Precognition, Chaos Vortex, Axes of Symmetry
 * (both ids), Imaginary Axes, Lacerating Chop, Lively Lute (both ids) on the skill side;
 * Illusionary Defense, Master Fencer, Phantasmal Haste, Stretched Time, Seize the Moment, Life of
 * the Party on the trait side. This leg's own new failure mode: Lively Lute's Might bonus is
 * granted identically by 2 DIFFERENT traits at once (Bountiful Disillusionment and Life of the
 * Party), so `WvwFactOverride` can't safely collapse either copy's own mode split without risking
 * silently swallowing the other trait's contribution when a build picks both — occurrence-indexed
 * `BUFF_INSTANCE_LABELS` entries instead, one per split id since their raw fact order (which
 * trait's copy comes first) differs between the two. The same "2 concepts share one status"
 * shape, without the cross-trait wrinkle, also ruled out `WvwFactOverride` for Phantasmal Haste and
 * Life of the Party's own conflicts. 8 more sources (Cry of Frustration, Rewinder, Bladesong
 * Sorrow, Flustering Flute, Deafening Drum, Crescendo, Phantasmal Lancer, Abstraction on the skill
 * side; Bountiful Disillusionment's Might/Vigor/Fury, Blinding Dissipation's Blinded, Mental
 * Defense, Nomad's Endurance, Renewing Oasis on the trait side) turned out to be plain
 * single-concept `WvwFactOverride` cases instead — see `fetch-wvw-splits.ts`'s own comment block on
 * this leg. Left open: Power Break and Phantom Razor (skill), each a data mismatch/nothing-to-quote
 * case in the same shape as prior legs' Dhuumfire/Death Blossom; Bountiful Disillusionment's
 * Stability and Blinding Dissipation's Confusion (trait), both blocked from a safe
 * `WvwFactOverride` fix by a coexisting genuine 2nd application (see that file's own writeup); Flow
 * of Time (trait), the "PvE and WvW now round to the same number" shape with nothing to quote.
 *
 * Elementalist leg (9th leg, FINAL leg, 2026-08-14): the only pool left, per a rescan with every
 * prior leg's methodology fix applied — 48 skill + 13 trait conflict sources (several split ids
 * sharing one wiki page, and one large entangled family: Catalyst's "Deploy Jade Sphere" mechanic,
 * 20 skill ids across its 4 attunement variants × normal/no-energy/underwater/sphere-specialist
 * sub-variants). 7 skill + 2 trait sources got a genuine label here: Flamestrike ("Secondary
 * Burning"), Rock Spray (3 range-banded Bleeding stacks, all 3 wiki-`alt=`-labeled, no unlabeled
 * base this time — same shape as Inspiring Reinforcement/Spear of Anguish), Ring of Fire ("Initial
 * Burning"/"Pass-Through Burning"), Heat Sync ("Boon Copied" — its `alt=`-labeled Might/Fury facts
 * are the skill's own copy-whatever-boons-you-currently-have mechanic, API-encoded as a literal
 * `duration: 0` marker fact, distinct in tuple from the real base grant so no occurrence-indexing
 * needed despite the value being meaningless on its own), Pyro Vortex (occurrence-indexed, "Initial
 * Burning" only — its 2nd tuple-mate is the wiki's own unlabeled base line), Pyroclastic Blast
 * ("Burning on Impact"/"Pulse Burning"), Molten End ("First Hit Might"/"Additional Hit Might"/
 * "First Hit Fury"/"Additional Hit Fury", all 4 wiki-`alt=`-labeled) on the skill side; Lucid
 * Singularity and Familiar's Blessing on the trait side, both a NEW failure mode: each grants a
 * DIFFERENT boon per game mode (not a duration split of one boon) — Lucid Singularity's Alacrity
 * (PvE only, "per Pulse"/"on Overload") and Might (WvW+PvP only, same 2 concepts) are 4 already-
 * distinct tuples, straightforwardly labeled; Familiar's Blessing links a different boon per
 * `linked skill=` AND per mode (4 familiar skills × PvE-boon/WvW+PvP-boon each), and 2 of its PvE-
 * side pairs (Ignite+Zap's Quickness, Splash+Calcify's Alacrity) collide on one raw tuple, needing
 * occurrence-indexed "On Ignite"/"On Zap"/"On Splash"/"On Calcify" labels — its WvW+PvP-side boons
 * (Might/Vigor/Fury/Protection) couldn't also be surfaced via `WvwFactOverride` even though each is
 * single-instance and would normally qualify: the wiki's stated wvw+pvp values (Might 6/Fury 3/
 * Protection 2) don't appear anywhere in the live API data at all (confirmed via a direct
 * `/v2/traits/2380` pull, not just the local cache) — every wvw+pvp-tagged raw fact actually returns
 * its PvE-side sibling's own value instead (Might=2 matching Ignite's Quickness=2, Protection=4
 * matching Calcify's Alacrity=4, etc.), an undocumented wiki/API mismatch with nothing trustworthy
 * to override TO, so those 4 single-instance facts are left showing whatever the (mismatched) raw
 * API value already is.
 *
 * 15 skill + 8 trait sources turned out to be plain single-concept `WvwFactOverride` cases —
 * Frost Aura, Shattering Ice (both hit the documented "API rounds a half-second duration up" quirk),
 * Conflagration (the API rounding a PvE 4.5s up to 5s happens to exactly match the WvW+PvP value,
 * collapsing 2 raw-identical facts into the correct single row same as Ranger leg's Storm/Stone
 * Spirit shape), Fox's Fury's enhanced cast (77282, a Fury pair the Revenant leg's original
 * synthetic-facts.json curation of this skill family never added — found while re-examining this
 * skill for its OTHER, left-open conflicts below), and the whole "Inscription" cluster (trait 229
 * itself, plus 10 Glyph skills whose Might/Regeneration comes SOLELY from that trait, copied onto
 * each skill's own tooltip with no coexisting untraited base — Ice Storm/Firestorm, Renewal of Fire/
 * Water ×2 split ids, Glyph of Lesser Elementals ×2, Glyph of Elementals, Glyph of Elemental Power
 * ×2 split ids) — see `fetch-wvw-splits.ts`'s own comment block on this leg for the per-source
 * writeup. Elemental Attunement, Elemental Shielding, Hardy Conduit, Bountiful Power, Invigorating
 * Torrents (a genuine 3-way pve/wvw/pvp split, wvw value used per this app's focus), Superior
 * Elements, and Altruistic Aspect (its Might half only — see below) rounded out the trait side.
 *
 * Left open, nothing safely curatable: Phoenix (5675, 3 raw-identical Burning facts against only 2
 * wiki concepts — one raw fact with nothing to attribute it to, same data-mismatch shape as Death
 * Blossom); Seismic Impact (76707, an extra 8-stack/8s-duration Bleeding fact the wiki's single
 * 10s/6-stack line doesn't account for, same shape); Glyph of Elemental Harmony (34743, its own
 * unsplit 20s/3-stack Might is a real 3rd concept coexisting with Inscription's copied pair — the
 * same "coexisting genuine untraited application blocks a safe status-wide override" hazard as
 * Toss Elixir H/Reconstruction Field, Engineer leg); "Feel the Burn!" (30662, a Might pair that both
 * hits the Ranger-leg "API duplicates the PvE duration onto both raw facts" encoding AND changes
 * stack count between modes, the latter alone already blocking `WvwFactOverride` since it can only
 * override `duration`); Electric Discharge (trait 222, Vulnerability pair changes stack count AND
 * duration between modes — 8@1 pve vs 6@8 wvw+pvp — but the apply_count change alone already blocks
 * a duration-only override) and Burning Rage (trait 325, Sunspot's Burning pair changes stack count
 * only, 2->1, duration unchanged at 4s both modes) — same architecture limit; Toad's Fortitude
 * (77247) and its gating trait Altruistic
 * Aspect's (2415) own Stability half (Might got a clean override above, but Stability's pve/wvw+pvp
 * split — wiki-confirmed via `linked skill=Toad's Fortitude` — only changes STACK COUNT, 3->2, with
 * duration unchanged at 5s both modes, same architecture limit as Icerazor's Ire's Torment/
 * Vulnerability). Fox's Fury's OTHER conflicts (77282's Might and Burning): Might extends an
 * already-documented gap from the Revenant leg (`fetch-wvw-splits.ts`'s own comment on skill 76711)
 * — 4 more trait-linked Might copies (2 from Evocation-gated synthetic facts, 2 from Altruistic
 * Aspect) layer on top of the already-irreconcilable base pair, more entangled than that leg left it,
 * not attempted; Burning's 3 raw facts don't cleanly map onto the wiki's 3 might-tier-conditional
 * concepts either (a wiki-stated duration of 7 for the top tier appears nowhere in the raw {5, 5, 3}
 * set), a data mismatch on top of the entanglement. Flame Uprising (45313) LOOKS like a conflict —
 * a base Burning fact plus a 2nd copy gated `requires_trait: 1376` — but that trait id belongs to
 * Warrior's "Shield Master" (`specializationId` 22), not any Elementalist line: a NEW failure mode,
 * a `requires_trait` pointing cross-profession, permanently inert since an Elementalist build can
 * never have a Warrior trait active — nothing to curate, the 2nd fact can never actually display.
 *
 * The single biggest left-open item is Catalyst's whole "Deploy Jade Sphere" family: the mechanic's
 * own trait, Spectacular Sphere (2234), copies each attunement's boon onto every one of the 20
 * skill ids as its own `requires_trait: 2234` fact (further modified by the Grandmaster upgrade
 * Sphere Specialist, 2251, via `overrides`-linked variants already correctly excluded by this
 * table's own methodology) — so EVERY one of the 20 base per-element conflicts that looked
 * cleanly fixable on paper (Fire's Might 10/5 pve/wvw+pvp split, Air's Fury 1/1 raw-duplicate
 * collapse, both wiki-confirmed with no `alt=`) turned out to have a coexisting genuine
 * trait-linked copy of that exact status once actually checked — the same "coexisting different
 * application blocks a safe status-wide override" hazard as Glyph of Elemental Harmony above, just
 * discovered AFTER drafting the fix instead of before, for all 20 ids at once. Water's Resolution
 * and Earth's Protection have no wiki split at all (one concept, 2 raw-identical facts, nothing to
 * quote, same as Frost Spirit/Dhuumfire); Fire's underwater id (63458) has an undocumented 8s
 * WvW+PvP Might value (wiki says 5s for every other id) live-API-reconfirmed but unexplained by any
 * wiki text. Spectacular Sphere's own tooltip compounds this further: it mixes an unconditional
 * pve-Quickness/wvw+pvp-Swiftness boon-swap with 4 attunement-conditional grants shown
 * simultaneously (this app doesn't model attunement as a runtime-exclusive state for trait facts),
 * one of which — Air's wvw-tagged Quickness — coincidentally shares both status AND duration with
 * the unconditional pve-tagged Quickness, impossible to safely disentangle from raw data alone.
 * Given the entanglement spans one whole mechanic (skill + trait + Grandmaster-upgrade-of-trait)
 * rather than one isolated source, this is left as a single documented gap rather than 20 separate
 * ones — worth a dedicated future pass over the whole Jade Sphere system as one unit, same
 * conclusion the Thief leg reached for the Convergence Artifact family.
 *
 * With this leg done, every profession pool from the original 255-source `skills.json`/
 * `traits.json` scan (plus the `synthetic-facts.json` overlay swept alongside it) has been curated
 * or explicitly, individually documented as left-open — the whole sweep (TODO.md's "Multiple
 * same-status Buff facts on one skill render as unlabeled duplicate rows" bug) is complete.
 */
export const BUFF_INSTANCE_LABELS: { skill: Record<number, Record<string, string>>; trait: Record<number, Record<string, string>> } = {
  skill: {
    // Cry of Frustration (Mesmer core Shatter 2/F2, id 10190). Mirrors Illusionary Defense's (trait
    // 675) own "Base"/"Additional Protection Duration" labels below onto its synthetic-facts.json
    // copy (added 2026-08-20, user-caught: the trait's boon wasn't showing up on the F2 skill at
    // all — the 2026-08-14 trait-granted-boons-on-skills sweep missed this trait because it's
    // gated by a generic `improves mechanic slot = 2` wiki field, not a named `improves skill=`).
    // Both facts already carry their real WvW values (no pvp-duplicate cleanup needed here — see
    // this trait's own `BUFF_INSTANCE_VALUE_OVERRIDES` entry for why the trait side needed that).
    10190: { 'Protection@4@1': 'Base Protection Duration', 'Protection@2@1': 'Additional Protection Duration' },
    // Fire Bomb (shared Bomb Kit bundle skill, every profession that can pick one up). Wiki:
    // {{skill fact|burning|alt=Initial Burning|5|stacks=2}}{{skill fact|burning|alt=Pulse Burning|2}}
    5823: { 'Burning@5@2': 'Initial Burning', 'Burning@2@1': 'Pulse Burning' },
    // Pain Absorption (Revenant/Demon, both split ids). Wiki: base `{{skill fact|resistance|3}}` is
    // unlabeled (matches this table's "unqualified base stays unlabeled" convention); the 1s bonus
    // carries `{{skill fact|resistance|1|alt=Self-Resistance per Condition|1}}` — matches the
    // `TARGET_COUNT_OVERRIDES` table's own doc comment ("additional resistance per condition" bonus,
    // self-only) for this exact source.
    27322: { 'Resistance@1@1': 'Self-Resistance per Condition' },
    78505: { 'Resistance@1@1': 'Self-Resistance per Condition' },
    // Embrace the Darkness (Revenant/Demon elite, both split ids). Wiki's base Torment line
    // (`{{skill fact|torment|5|game mode=pve}}{{skill fact|torment|6|game mode=pvp wvw}}`) carries no
    // `alt=`; all 3 of its "Additional Torment" mode-variant lines do
    // (`{{skill fact|torment|alt=Additional Torment|...}}` ×3 for pve/wvw/pvp) — the API bakes these
    // down to 3 raw Torment facts per id with no game-mode discriminator (same shape
    // `WvwFactOverrides`' own doc comment describes), so this can't be resolved to a clean
    // duration/count-keyed table the way most sources here are — occurrence-indexed instead: each
    // id's FIRST Torment fact (array order, matching the wiki template order above) is the unlabeled
    // base, every fact after it is "Additional Torment" regardless of its own duration/count (28287's
    // raw order is base/additional/additional; 78191's is base/additional/additional too, just with
    // its 2 differently-valued "additional" facts swapped — hence both ids sharing this exact table).
    28287: { 'Torment@5@2': 'Additional Torment', 'Torment@5@1#2': 'Additional Torment' },
    78191: { 'Torment@5@2': 'Additional Torment', 'Torment@5@1#2': 'Additional Torment' },
    // Searing Fissure (Revenant/Herald mace 2). Wiki:
    // {{skill fact|burning|alt=Initial Burning|3|stacks=3|game mode=pve}}...
    // {{skill fact|burning|alt=Additional Burning|1|game mode=pve}}...
    28357: { 'Burning@3@3': 'Initial Burning', 'Burning@1@1': 'Additional Burning' },
    // Inspiring Reinforcement (Revenant/Dwarf utility, both split ids). Wiki lists BOTH Stability
    // facts with an `alt=` (no unlabeled base this time) at the identical PvE/WvW value (3), only
    // distinguished by which alt= template comes first: `alt=Pulsing Stability` then
    // `alt=Initial Stability` — occurrence-indexed since the 2 facts share one duration/count tuple.
    28516: { 'Stability@3@1#1': 'Pulsing Stability', 'Stability@3@1#2': 'Initial Stability' },
    50383: { 'Stability@3@1#1': 'Pulsing Stability', 'Stability@3@1#2': 'Initial Stability' },
    // Spear of Anguish (Revenant spear 1, aquatic). Wiki:
    // {{skill fact|torment|8|alt=Maximum Torment}}{{skill fact|torment|4|alt=Minimum Torment}} — both
    // labeled (the skill's own description already explains why: torment scales with the foe's
    // distance from the caster, "Minimum"/"Maximum" naming the 2 ends of that range).
    28714: { 'Torment@8@1': 'Maximum Torment', 'Torment@4@1': 'Minimum Torment' },
    // Reaver's Rage (Revenant/Vindicator utility). Wiki:
    // {{skill fact|stability|alt=Initial Stability|1}}
    // {{skill fact|stability|alt=Base Stability and Stability per Hit|6|game mode=pve wvw}}...
    62878: { 'Stability@1@1': 'Initial Stability', 'Stability@6@1': 'Base Stability and Stability per Hit' },
    // Abyssal Raze (Revenant spear 5, Weaponmaster). Wiki's base Torment (`{{skill fact|torment|6}}`)
    // is unlabeled; the per-stack bonus carries
    // `{{skill fact|torment|alt=Torment Per Crushing Abyss Count|5|stacks=2|game mode=pve}}`.
    73059: { 'Torment@5@2': 'Torment Per Crushing Abyss Count' },
    // Release Potential: Mesmer (Revenant/Conduit mechanic). Wiki's base (to-enemies) Torment
    // (`{{skill fact|torment|stacks=2|3|game mode=pve}}`) is unlabeled; the self-inflicted echo
    // carries `{{skill fact|torment|alt=Self Torment per Enemy Struck|8|game mode=pve}}` — matches
    // the skill's own description ("For each enemy struck, inflict torment on yourself").
    78615: { 'Torment@8@1': 'Self Torment per Enemy Struck' },

    // Icerazor's Ire (Revenant/Renegade, both split ids) — the ORIGINAL skill this whole bug entry
    // was flagged from (TODO.md, 2026-08-09), found again this leg via `synthetic-facts.json` (its
    // real API facts are near-empty; see `fetch-wvw-splits.ts`'s own comment on 40485 for why). Wiki:
    // `{{skill fact|Vulnerability|alt=Initial Vulnerability|8|stacks=10|game mode=pve}}` for the
    // 10-stack fact. The skill's OTHER Vulnerability fact (8s/5 stacks) carries no `alt=` at all on
    // the wiki page — the ONE exception in this whole table to "only quote a real wiki `alt=`": the
    // user's own original 2026-08-09 bug report already characterized this second fact as "on-hit"
    // from direct in-game play (Visk Icerazor's summoned attacks apply it per-strike, distinct from
    // the initial burst's 10-stack application), re-confirmed when asked again 2026-08-13 — trusted
    // as a first-party source the same way any other user-supplied game-mechanic fact would be,
    // labeled "On Hit" rather than left unlabeled.
    40485: { 'Vulnerability@8@10': 'Initial Vulnerability', 'Vulnerability@8@5': 'On Hit' },
    72359: { 'Vulnerability@8@10': 'Initial Vulnerability', 'Vulnerability@8@5': 'On Hit' },
    // Breakrazor's Bastion (Revenant/Renegade heal, both split ids) — same `synthetic-facts.json`
    // root cause as Icerazor's Ire above, found via the same full sweep of that file. Wiki:
    // `{{skill fact|resolution|alt=Initial Resolution|2.5}}` and
    // `{{skill fact|resolution|alt=Final Pulse Resolution|4}}`.
    45686: { 'Resolution@2.5@1': 'Initial Resolution', 'Resolution@4@1': 'Final Pulse Resolution' },
    72389: { 'Resolution@2.5@1': 'Initial Resolution', 'Resolution@4@1': 'Final Pulse Resolution' },

    // --- Thief leg (2nd leg, 2026-08-14) ---

    // NOTE: Assassin's Signet's passive/active pair (status "Assassin's Signet") and Shadow Meld's
    // Stealth pve/wvw+pvp split both looked like real conflicts during this leg's rescan but turned
    // out to be dead ends: `classifyBoonCondition` (this table's own gate, via `extractFromFacts`)
    // only recognizes `BOON_NAMES`/`CONDITION_NAMES` (constants.ts) — a skill's own self-named
    // buff-marker status ("Assassin's Signet", "Facet of Elements", ...) and "Stealth" (handled by
    // the entirely separate `MISCELLANEOUS_MATCHERS`/`computeNamedFactSources` pipeline, which
    // already dedupes by matcher name on its own) never reach this table's lookup at all, curated or
    // not — an entry for either would be silently inert. Same reasoning ruled out Instant Reflexes/
    // Meld with Shadows (Superspeed)/Unhindered Combatant (Exhaustion)/Shadestep (a `status: 'Heal'`
    // Buff fact, also not a recognized boon/condition name) from this leg's trait side below.
    // Venomous Knife (Deadeye rifle 4/underwater harpoon). Wiki:
    // {{skill fact|poisoned|8|stacks=2}}{{skill fact|poisoned|2|alt=Poison When Downed}}.
    13138: { 'Poisoned@2@1': 'Poison When Downed' },
    // Deadly Aim (Deadeye rifle 2, kneeling). Wiki: base `{{skill fact|vulnerability|6|stacks=2}}`
    // is unlabeled; the bonus against a marked target carries
    // `{{skill fact|vulnerability|6|alt=Additional Vulnerability}}`.
    40710: { 'Vulnerability@6@1': 'Additional Vulnerability' },
    // Brutal Aim (unkneeled rifle 2, same skill concept as Deadly Aim above). Wiki lists both
    // facts at the identical value (`{{skill fact|vulnerability|6}}` then
    // `{{skill fact|vulnerability|6|alt=Additional Vulnerability}}`) — occurrence-indexed since they
    // share one duration/count tuple, same shape as Inspiring Reinforcement.
    41422: { 'Vulnerability@6@1#2': 'Additional Vulnerability' },
    // Malicious Ripper (Deadeye harpoon gun 3, malice-consuming). Wiki: base
    // `{{skill fact|bleeding|10|stacks=4}}` is unlabeled; the malice-consuming bonus carries
    // `{{skill fact|bleeding|10|alt=Additional Bleeding per Malice}}`.
    50449: { 'Bleeding@10@1': 'Additional Bleeding per Malice' },
    // Holo-Dancer Decoy (Convergence "Defensive Artifact" skill, both split ids). Wiki's base Might
    // (`{{skill fact|might|8|stacks=2}}`) is unlabeled; the self-destruct bonus carries
    // `{{skill fact|might|alt=Might on Self-Destruct|8|stacks=4}}`. The skill's Taunt facts are a
    // separate, unlabeled pve+wvw(3s)/pvp(1s) split with no `alt=` — fixed via `WvwFactOverrides`
    // instead (id 76674 only; 76800 doesn't carry the pvp-only 2nd Taunt fact at all), see
    // `fetch-wvw-splits.ts`'s own comment on that id.
    76674: { 'Might@8@4': 'Might on Self-Destruct' },
    76800: { 'Might@8@4': 'Might on Self-Destruct' },

    // --- Warrior leg (3rd leg, 2026-08-14) ---

    // Arcing Slice (Berserker axe burst, all 4 split ids share one wiki page and one fact set —
    // same "page covers every id identically" shape as Holo-Dancer Decoy in the Thief leg). Wiki:
    // {{skill fact|fury|alt=Level 1 Adrenaline|8|...}}, alt=Level 2 Adrenaline|12, alt=Level 3
    // Adrenaline|16 — all 3 labeled (no unlabeled base; the pve and pvp+wvw variant of each level
    // share the identical duration, so only 3 distinct tuples exist locally, matching the 3 wiki
    // concepts 1:1).
    14375: { 'Fury@8@1': 'Level 1 Adrenaline', 'Fury@12@1': 'Level 2 Adrenaline', 'Fury@16@1': 'Level 3 Adrenaline' },
    14545: { 'Fury@8@1': 'Level 1 Adrenaline', 'Fury@12@1': 'Level 2 Adrenaline', 'Fury@16@1': 'Level 3 Adrenaline' },
    14546: { 'Fury@8@1': 'Level 1 Adrenaline', 'Fury@12@1': 'Level 2 Adrenaline', 'Fury@16@1': 'Level 3 Adrenaline' },
    14547: { 'Fury@8@1': 'Level 1 Adrenaline', 'Fury@12@1': 'Level 2 Adrenaline', 'Fury@16@1': 'Level 3 Adrenaline' },
    // Stomp (Physical utility, stability + launch). Wiki gives BOTH Stability facts a real `alt=`
    // (`{{skill fact|stability|alt=Initial Stability|6|pve}}...{{skill fact|stability|alt=On-Hit
    // Stability|6|pve}}...`, each also pve/wvw+pvp split at 6/1 and 6/3 respectively) — no
    // unlabeled base, matching Inspiring Reinforcement's shape: their pve values happen to be
    // numerically identical (6=6), which is exactly why the locally-cached (pve-only) API data
    // shows 2 identical Stability facts with nothing else to tell them apart without this entry.
    14388: { 'Stability@6@1#1': 'Initial Stability', 'Stability@6@1#2': 'On-Hit Stability' },
    // "Fear Me!" (shout, distance-scaled fear). Wiki:
    // {{skill fact|fear|alt=Maximum Fear|3}}{{skill fact|fear|alt=Minimum Fear|1}} — matches the
    // skill's own description (fear duration scales with caster distance).
    14409: { 'Fear@3@1': 'Maximum Fear', 'Fear@1@1': 'Minimum Fear' },
    // Flames of War (torch 4/Conjure Fire Axe-adjacent, mobile fire field). Wiki page title is
    // "Flames of War (warrior skill)" (the bare title is a disambiguation page). Base Burning
    // (`{{skill fact|burning|2}}`) is unlabeled; the field's expiry-detonation carries
    // `{{skill fact|burning|6|stacks=2|alt=Final Burning}}`.
    29940: { 'Burning@6@2': 'Final Burning' },
    // Keen Strike (dagger chain finisher). Wiki: base `{{skill fact|might|5}}` is unlabeled; the
    // critical-hit bonus carries `{{skill fact|might|alt=Critical Might|5}}` — occurrence-indexed
    // since both share the identical 5s/1-stack tuple.
    40275: { 'Might@5@1#2': 'Critical Might' },
    // Overcharged Cartridges (Engineer-shared Armament, explosion-attack Burning buildup). Wiki:
    // base `{{skill fact|Burning|3}}` is unlabeled; the supercharged (2nd use) variant carries
    // `{{skill fact|Burning|alt=Supercharged Burning|5}}`.
    68085: { 'Burning@5@1': 'Supercharged Burning' },
    // "Find Their Weakness!" (Bladesworn command, vulnerability spread + echo might). Wiki: base
    // Might (`{{skill fact|might|10|stacks=5|pve}}`, 8/stacks=5 wvw+pvp — local only carries the
    // pve-tagged value) is unlabeled; the per-enemy-struck echo bonus carries
    // `{{skill fact|might|alt=Bonus Might per Enemy Struck|10|stacks=2|pve}}` (8/stacks=2 wvw+pvp).
    // Both wiki stack counts (5 and 2) match this id's own apply_count values exactly.
    77040: { 'Might@10@2': 'Bonus Might per Enemy Struck' },
    // Bloodthirster (Bladesworn Gunsaber burst, all 4 split ids share one wiki page/fact set, same
    // shape as Arcing Slice above). Wiki: {{skill fact|bleeding|alt=Level 1 Bleeding|6|stacks=3}},
    // alt=Level 2 Bleeding|6|stacks=6, alt=Level 3 Bleeding|6|stacks=9 — all 3 labeled, no
    // unlabeled base (matches Arcing Slice's shape: 3 adrenaline-scaled tiers, all named).
    80203: { 'Bleeding@6@3': 'Level 1 Bleeding', 'Bleeding@6@6': 'Level 2 Bleeding', 'Bleeding@6@9': 'Level 3 Bleeding' },
    80221: { 'Bleeding@6@3': 'Level 1 Bleeding', 'Bleeding@6@6': 'Level 2 Bleeding', 'Bleeding@6@9': 'Level 3 Bleeding' },
    80248: { 'Bleeding@6@3': 'Level 1 Bleeding', 'Bleeding@6@6': 'Level 2 Bleeding', 'Bleeding@6@9': 'Level 3 Bleeding' },
    80263: { 'Bleeding@6@3': 'Level 1 Bleeding', 'Bleeding@6@6': 'Level 2 Bleeding', 'Bleeding@6@9': 'Level 3 Bleeding' },
    // NOTE on this leg's open (uncurated) Warrior sources, nothing here since none reach this
    // table's lookup or none are safely resolvable — see `BUFF_INSTANCE_LABELS`'s own top doc
    // comment for the full writeup: Knot Shot (14467) and Brutal Shot's Immobile pair (34296) are
    // scan false positives (the 2nd "fact" is a `{{skill fact|condition|immobile|...}}`
    // Condition-Removed marker with no `duration`, filtered out by `extractFromFacts` before ever
    // reaching this table — not a real duplicate); Brutal Shot's Vulnerability pair and Eviscerate's
    // (43566) Might pair are genuine pve/wvw+pvp splits where BOTH duration AND apply_count change,
    // the same `WvwFactOverride`-can't-express-`apply_count` limitation documented on Falling
    // Spider (Thief leg)/Icerazor's Ire; Wounding Strike (41543, live-API-confirmed name) has no
    // wiki page under that title at all (search turned up nothing skill-related); Banner of
    // Tactics' Stability pair (14408, its Resistance pair got a normal `WvwFactOverrides` fix
    // instead, see that file's own comment) is 2 raw-identical facts with only ONE `alt=`-labeled
    // Stability template on the whole page — nothing to distinguish the 2nd from the 1st.

    // Darkrazor's Daring (41220/72366), also found via this same synthetic-facts.json sweep,
    // deliberately has NO entry here: `fetch-wvw-splits.ts`'s own comment on 72366 already documents
    // its 2 simultaneous Stability facts (1s unsplit + a separate 6s/3-stack pve-wvw-split one) as a
    // wiki page with NO `alt=` wording on either — nothing to curate from, not an oversight. Stays an
    // open item (see TODO.md) until/unless the wiki page is updated with real qualifiers.

    // --- Necromancer leg (4th leg, 2026-08-14) ---

    // Dark Pact (dagger 4). Wiki: base `{{skill fact|bleeding|stacks=2|10}}` (to the target) is
    // unlabeled; the self-inflicted echo carries
    // `{{skill fact|bleeding|stacks=2|10|alt=Self-Bleeding|applies to=self}}` — occurrence-indexed
    // since both share the identical 10s/2-stack tuple.
    10529: { 'Bleeding@10@2#2': 'Self-Bleeding' },
    // Rending Claws (axe 2, health-threshold-scaled vulnerability). Wiki: base
    // `{{skill fact|vulnerability|7|stacks=2|game mode = pve}}` is unlabeled; the below-threshold
    // bonus carries `{{skill fact|vulnerability|7|stacks=2|alt=Vulnerability below threshold|game
    // mode = pve}}` — occurrence-indexed, identical 7s/2-stack tuple (matches the skill's own
    // description: "Vulnerability applied increases against foes below the health threshold").
    10561: { 'Vulnerability@7@2#2': 'Vulnerability below threshold' },
    // "You Are All Weaklings!" (Spite shout). Wiki's base Might
    // (`{{skill fact|might|stacks=5|10|game mode = pve}}`) has its own distinct 5-stack tuple, so
    // stays unlabeled without needing an entry; its 2 single-stack bonus facts share one 10s/1-stack
    // tuple, occurrence-indexed in wiki template order:
    // `{{skill fact|might|10|alt=Might per Hit|game mode = pve}}` then
    // `{{skill fact|might|10|alt=Might per Melee Hit|game mode = pve}}`.
    29414: { 'Might@10@1#1': 'Might per Hit', 'Might@10@1#2': 'Might per Melee Hit' },
    // Dhuumfire's (trait 905) base Burning pair (3s×1, both facts identical, the `overrides`-linked
    // Scourge/Harbinger-traited variants already excluded pre-scan) is a genuine raw-API duplicate
    // with nothing to curate from: the wiki page's base section carries only ONE
    // `{{skill fact|burning|3}}` template for the untraited case — same "one wiki concept, two raw
    // facts" shape as Warrior leg's Banner of Tactics Stability pair. Left open.

    // --- Guardian leg (5th leg, 2026-08-14) ---

    // Rushing Justice (Willbender virtue 1). Wiki:
    // `{{skill fact|burning|4|alt=Initial Burning}}` (universal, no game-mode split) is followed by
    // the "Justice"-effect burning (`{{skill fact|burning|2|game mode=pve}}{{skill fact|burning|1.5
    // |game mode=wvw pvp}}`, 5-consecutive-attacks proc). The local raw facts carry 4 Burning
    // instances, not the 2 this 2-concept/2-mode shape predicts: one clean 4s (matching Initial
    // Burning exactly, unique tuple, labeled here) plus THREE identical 2s facts, not just one —
    // that 3-way duplication doesn't map cleanly onto the wiki's single Justice-effect concept, so
    // only the confidently-resolvable Initial Burning gets an entry; the 3 unexplained 2s duplicates
    // stay unlabeled (documented gap, not an oversight — see TODO.md).
    62668: { 'Burning@4@1': 'Initial Burning' },
    // Several more Guardian conflicts investigated this leg turned out to be plain WvwFactOverride
    // cases instead (Tome of Justice, Shield of Judgment, Sword of Justice, Advancing Strike,
    // Willbender Flames' Searing Pact-linked Burning) — see fetch-wvw-splits.ts's own comment block
    // on this leg for those. Left open, nothing to curate from: Virtue of Justice (9115, 2 identical
    // "active effect" Burning@4 facts alongside a self-evidently-distinct Burning@2 passive fact —
    // only ONE wiki alt= template ("Burning (active effect)") to quote for the 2 duplicates, same
    // Dhuumfire shape); Spear of Justice (29887, Virtue of Justice's Dragonhunter flip — its Burning
    // pair has the same passive/active mode-value overlap ambiguity, and its Crippled pair is a
    // wiki/local-data mismatch, wiki says 1.5s/1s but raw is 2s/1s, same "possible data drift" shape
    // as Death Blossom in the Thief leg); Crashing Courage (62532/62596, Willbender virtue 1's other
    // flip — both ids carry 2 raw Stability facts each, but the wiki page has only ONE unqualified
    // `{{skill fact|Stability|4}}` template for the whole page, nothing to quote for either); Dragon's
    // Maw (68686, 2 raw-identical Slow@4 facts — the wiki's own pve(4)/wvw+pvp(3) split doesn't
    // appear as a 2nd distinct raw value at all, a data mismatch, not confidently resolvable).

    // --- Engineer leg (6th leg, 2026-08-14) ---

    // Blowtorch (flamethrower 3). Wiki: {{skill fact|burning|alt=Maximum Burning|4.5|stacks=3|game
    // mode = pve}}{{skill fact|burning|alt=Maximum Burning|12|stacks=2|game mode = pvp wvw}}
    // {{skill fact|burning|alt=Minimum Burning|3|stacks=3|game mode = pve}}{{skill fact|burning|
    // alt=Minimum Burning|6|stacks=2|game mode = pvp wvw}} — all 4 raw facts are unique tuples (the
    // pve 4.5 rounds up to 5, the documented half-second quirk), no unlabeled base, matching Arcing
    // Slice/Bloodthirster's "every mode-variant tuple gets the matching label" shape.
    5831: { 'Burning@5@3': 'Maximum Burning', 'Burning@12@2': 'Maximum Burning', 'Burning@3@3': 'Minimum Burning', 'Burning@6@2': 'Minimum Burning' },
    // Blunderbuss (shotgun 2, point-blank range scaling). Wiki:
    // {{skill fact|bleeding|alt=Maximum Bleeding|stacks=3|9}}{{skill fact|bleeding|alt=Minimum
    // Bleeding|stacks=3|3}} — both labeled, no unlabeled base, no game-mode split.
    6153: { 'Bleeding@9@3': 'Maximum Bleeding', 'Bleeding@3@3': 'Minimum Bleeding' },
    // Radiant Arc (Holosmith sword 3, heat-scaled quickness). Wiki: {{skill fact|quickness|alt=
    // Quickness at or below 50% heat|2|game mode = pve}}{{skill fact|quickness|alt=Quickness over
    // 50% heat|4|game mode = pve}} (each also pvp+wvw split, 1 and 2 respectively — not present
    // locally). A 3rd raw Quickness fact (6@1, gated on Enhanced Capacity Storage Unit/trait 2137 —
    // "Some skills and traits gain additional heat tiers") isn't documented anywhere on this skill's
    // own wiki page at all, so stays unlabeled/uncurated.
    40160: { 'Quickness@2@1': 'Quickness at or below 50% heat', 'Quickness@4@1': 'Quickness over 50% heat' },
    // Essence of Liquid Wrath (short-bow 4 Chain Reaction bonus, WvW siege consumable-style skill).
    // Wiki: base Protection (`{{skill fact|protection|5|game mode = pve pvp}}`) is unlabeled; the
    // Chain Reaction bonus carries `{{skill fact|protection|3|alt=Chain Reaction Protection|game
    // mode = pve pvp}}` (its wvw-mode variant flips to a same-named Resolution fact instead, already
    // unconflicted locally since only 1 Resolution fact is cached).
    71870: { 'Protection@3@1': 'Chain Reaction Protection' },
    // Essence of Animated Sand (short-bow 2, same Chain Reaction family as above). Wiki: base Might
    // has 3 mode variants (pve 8@5, wvw 5@5 — not cached locally, pvp 8@2) all unlabeled; the Chain
    // Reaction bonus carries `{{skill fact|might|alt=Chain Reaction Might|stacks=3|8|game mode=pve
    // pvp}}` (its wvw variant, 8@2, isn't distinguishable from the base's own pvp variant sharing
    // that exact tuple — not cached locally either way, so no collision to resolve). Base's pve
    // (8@5) and pvp (8@2) tuples both stay unlabeled, matching convention.
    72052: { 'Might@8@3': 'Chain Reaction Might' },
    // Lightning Rod (Weaponmaster spear 3, Mechanist-reachable — wiki page is disambiguated as
    // "Lightning Rod (engineer spear skill)", the bare title belongs to an unrelated Elementalist
    // trait). Wiki: {{skill fact|vulnerability|stacks=2|alt=Focused Target Vulnerability|8|game
    // mode=pve}}{{skill fact|vulnerability|alt=Unfocused Target Vulnerability|8|game mode=pve}} —
    // both labeled, no unlabeled base, identical pve duration but distinguished by stack count.
    73002: { 'Vulnerability@8@2': 'Focused Target Vulnerability', 'Vulnerability@8@1': 'Unfocused Target Vulnerability' },
    // Conduit Surge (spear 4, Lightning Rod's follow-up). Wiki: {{skill fact|burning|alt=Focused
    // Target Burning|7|game mode=pve}}{{skill fact|burning|alt=Unfocused Target Burning|5|game
    // mode=pve}} — both labeled, no unlabeled base.
    73122: { 'Burning@7@1': 'Focused Target Burning', 'Burning@5@1': 'Unfocused Target Burning' },
    // Electric Artillery (spear 5, consumes Lightning Rod Charges). Wiki: base Burning (`{{skill
    // fact|burning|stacks=2|alt=Minimum Burning Duration|3|game mode=pve}}`, wvw+pvp variant 6, not
    // cached locally) carries a real alt=; a "Focused/Unfocused Burning Duration Increase per
    // Charge" pair (0.5/0.25, `linked skill=Lightning Rod Charges`) also carries alt= text, but each
    // concept's single wiki line has no game-mode split of its own, while the local raw facts carry
    // 2 IDENTICAL copies of EACH (rounding 0.5/0.25 to 1/0 — same "pve and wvw+pvp happen to round
    // to the same displayed number" shape as Warrior leg's Stomp) — unlike Stomp, there's only ONE
    // wiki concept per tuple here (not 2 distinct ones sharing a tuple), so occurrence-indexing would
    // just apply an identical label to both copies without resolving anything — left unlabeled, same
    // "nothing to distinguish the 2nd from the 1st" call as Warrior leg's Banner of Tactics Stability
    // pair.
    73143: { 'Burning@3@2': 'Minimum Burning Duration' },
    // Several more Engineer conflicts investigated this leg turned out to be plain WvwFactOverride
    // cases instead (Magnetic Shield, Static Shield, Blessing of Dwayna, Leafy Bandage, Static Shock,
    // Bandage Self, Regenerating Mist) — see fetch-wvw-splits.ts's own comment block on this leg for
    // those. Left open, nothing safely curatable: Poison Dart Volley (5828, 2 raw-identical
    // Poisoned@7@5 facts — wiki says pve=7/pvp+wvw=10, a data mismatch, same "possible data drift"
    // shape as Death Blossom/Spear of Justice's Crippled pair); Throw Napalm (6181, bare `{{skill
    // fact|burning|4}}{{skill fact|burning|2}}` — no alt= anywhere on the page to quote for either);
    // Super Elixir (5937/6102, an HGH/trait-473-linked Might pair whose own values, 15@2/6@3, don't
    // cleanly match ANY of HGH's own 3 Might tiers, 15@2/8@3/10@2 — the "6" has no explanation on
    // either page, an unresolvable mismatch rather than a clean mode split); Toss Elixir H (5978/
    // 6118) and Reconstruction Field (29505) each carry the same Expert-Examination(1999)-linked
    // Protection pair as the WvwFactOverride-fixed sources above, but ALSO carry their own genuine
    // untraited base Protection fact sharing that status — `WvwFactOverride` can only override a
    // whole status, not scope to just the trait-gated subset, so mirroring the fix here would wrongly
    // overwrite the legitimate untraited value; left unfixed rather than risk a wrong display.

    // --- Mesmer leg (8th leg, 2026-08-14) ---

    // Temporal Curtain (mantra of swiftness wall). Wiki:
    // `{{skill fact|swiftness|alt=Initial Swiftness|12}}` (the wall's own cast) followed by a bare
    // `{{skill fact|swiftness|1}}` (per-crossing pulse) with no `alt=` at all — same "partial label"
    // shape as Rushing Justice (Guardian leg): only the wiki-named one gets an entry.
    10186: { 'Swiftness@12@1': 'Initial Swiftness' },
    // Phantasmal Mage (10189) and The Prestige (10285) both carry a base torch-strike Burning fact
    // (unlabeled on both wiki pages) plus an identical The Pledge (trait 691)-linked Burning bonus
    // with no `overrides` link — The Pledge's own page has a single unlabeled fact too
    // (`{{skill fact|burning|3|stacks=2}}`), so the trait's own name is used as the label (same
    // "trait fact copied onto the skill it triggers from" mechanism as Willbender Flames/Over
    // Shield, just resolved here instead of `WvwFactOverrides` since this is a trait-gate addition,
    // not a game-mode split).
    10189: { 'Burning@3@2': 'The Pledge' },
    10285: { 'Burning@3@2': 'The Pledge' },
    // Chaos Armor (Chaos aura on dodge). Wiki: `{{skill fact|confusion|alt=Confusion on Cast|5|
    // stacks=3}}` ... `{{skill fact|confusion|alt=Confusion on Attackers|5}}` — both labeled, no
    // unlabeled base, already-unique tuples (differ by stack count).
    10331: { 'Confusion@5@3': 'Confusion on Cast', 'Confusion@5@1': 'Confusion on Attackers' },
    // Well of Precognition (elite well). Wiki: `{{skill fact|stability|1|alt = Initial Stability}}`
    // and `{{skill fact|stability|5|stacks = 3|alt = First-Pulse Stability| game mode = pve wvw}}`
    // (+pvp variant 3, not cached locally) — both labeled, no unlabeled base.
    29526: { 'Stability@1@1': 'Initial Stability', 'Stability@5@3': 'First-Pulse Stability' },
    // Chaos Vortex (staff 5, dual player/clone conditions). Wiki names 3 status pairs, each
    // Player/Clone, no game-mode split: `{{skill fact|torment|10|alt=Player Torment}}
    // {{skill fact|torment|4|alt=Clone Torment}}`, `{{skill fact|confusion|10|alt= Player
    // Confusion}}{{skill fact|confusion|3|alt=Clone Confusion}}`, `{{skill fact|bleeding|10|alt=
    // Player Bleeding}}{{skill fact|bleeding|4|alt= Clone Bleeding}}` — all 6 tuples already unique,
    // every one labeled.
    40184: {
      'Torment@10@1': 'Player Torment',
      'Torment@4@1': 'Clone Torment',
      'Confusion@10@1': 'Player Confusion',
      'Confusion@3@1': 'Clone Confusion',
      'Bleeding@10@1': 'Player Bleeding',
      'Bleeding@4@1': 'Clone Bleeding'
    },
    // Axes of Symmetry (Virtuoso axe-throw, both split ids share one wiki page/fact set). Wiki:
    // `{{skill fact|confusion|6|stacks=5|alt=Player Confusion|game mode=pve}}{{skill fact|
    // confusion|3|stacks=3|alt=Player Confusion|game mode=wvw pvp}}{{skill fact|confusion|6|alt=
    // Clone Confusion|game mode=pve}}{{skill fact|confusion|3|alt=Clone Confusion|game
    // mode=wvw pvp}}` — 2 concepts (Player/Clone), each independently mode-split, all 4 tuples
    // already unique (distinguished by stack count and/or duration) so every one gets its matching
    // label directly, same "apply one label to every mode-variant tuple of one concept" convention
    // as Blowtorch/Zealous Scepter.
    43761: {
      'Confusion@6@5': 'Player Confusion',
      'Confusion@3@3': 'Player Confusion',
      'Confusion@6@1': 'Clone Confusion',
      'Confusion@3@1': 'Clone Confusion'
    },
    69385: {
      'Confusion@6@5': 'Player Confusion',
      'Confusion@3@3': 'Player Confusion',
      'Confusion@6@1': 'Clone Confusion',
      'Confusion@3@1': 'Clone Confusion'
    },
    // Imaginary Axes (Virtuoso axe-throw 2, PvE-cached values only). Wiki:
    // `{{skill fact|torment|alt=Player Torment|3.5|stacks=3|game mode = pve }}` (rounds to 4) and
    // `{{skill fact|torment|alt=Clone Torment|4|game mode = pve}}` — both labeled, both pve-cached
    // locally (the wvw+pvp variants, 8 and 2, aren't present).
    44321: { 'Torment@4@3': 'Player Torment', 'Torment@4@1': 'Clone Torment' },
    // Lacerating Chop (Virtuoso axe 2 chain). Wiki: base `{{skill fact|bleeding|2}}` is unlabeled;
    // the clone's own hit carries `{{skill fact|bleeding|alt=Clone Bleeding|1}}`.
    44791: { 'Bleeding@1@1': 'Clone Bleeding' },
    // Lively Lute (Troubadour instrument, both split ids share one wiki-page-equivalent trait
    // data). Both Bountiful Disillusionment (trait 1687, Chaos GM) and Life of the Party (trait
    // 2367, Troubadour master) independently grant an identical-shaped Might bonus here
    // (`linked skill=Lively Lute` on each trait's own page, no `overrides` link on either) — if a
    // build picks both traits at once, the 2 grants coexist and share an EXACT tuple, so
    // `WvwFactOverride` can't safely collapse either (would silently swallow the other trait's
    // contribution, same hazard as Toss Elixir H/Fox's Fury). Occurrence-indexed by each id's own
    // raw fact order (which trait's copy comes first differs between the 2 split ids), labeled with
    // the granting trait's own name since neither trait's page gives this bonus its own `alt=` text.
    76552: {
      'Might@8@5#1': 'Bountiful Disillusionment',
      'Might@8@5#2': 'Life of the Party',
      'Might@6@3#1': 'Bountiful Disillusionment',
      'Might@6@3#2': 'Life of the Party'
    },
    77306: {
      'Might@8@5#1': 'Life of the Party',
      'Might@8@5#2': 'Bountiful Disillusionment',
      'Might@6@3#1': 'Life of the Party',
      'Might@6@3#2': 'Bountiful Disillusionment'
    },
    // Several more Mesmer conflicts investigated this leg turned out to be plain WvwFactOverride
    // cases instead (Cry of Frustration, Rewinder, Bladesong Sorrow, Flustering Flute, Deafening
    // Drum, Crescendo, Phantasmal Lancer, Abstraction) — see fetch-wvw-splits.ts's own comment
    // block on this leg for those. Left open, nothing safely curatable: Power Break (10238, 2
    // raw-identical-duration Stability@3 facts differing only by stack count — the wiki's whole
    // page carries only ONE `{{skill fact|stability|3|stacks=3}}` template, matching just the
    // 3-stack fact and giving nothing to quote for the 5-stack one, same Dhuumfire/Banner-of-
    // Tactics shape); Phantom Razor (69389, its Bleeding AND Torment pairs both have a wiki-stated
    // Clone value, 7s, that doesn't appear among either pair's locally-cached raw durations, {5, 5}
    // — a data mismatch, same "possible data drift" shape as Death Blossom/Spear of Justice);

    // --- Elementalist leg (9th leg, FINAL leg, 2026-08-14) ---

    // Flamestrike (Fire/Scepter 1). Wiki: base `{{skill fact|burning|1.5|game mode=pve}}
    // {{skill fact|burning|1|game mode=wvw}}` is unlabeled; the 2nd-strike bonus carries
    // `{{skill fact|burning|2.5|alt=Secondary Burning|game mode=pve}}...`. Locally cached raw facts
    // only carry each concept's PvE-rounded value (2, 3) — the wvw-tagged variants aren't present at
    // all, so no `WvwFactOverride` is possible here either; label-only.
    5508: { 'Burning@3@1': 'Secondary Burning' },
    // Rock Spray (Earth/Trident 2, aquatic). Wiki labels all 3 range-banded Bleeding facts, no
    // unlabeled base this time (same "every tuple gets a label" shape as Inspiring Reinforcement/
    // Spear of Anguish): `{{skill fact|bleeding|10|alt=300-400 Range}}{{skill fact|bleeding|10|
    // stacks=2|alt=200-300 Range}}{{skill fact|bleeding|10|stacks=3|alt=0-200 Range}}`.
    5658: { 'Bleeding@10@1': '300-400 Range', 'Bleeding@10@2': '200-300 Range', 'Bleeding@10@3': '0-200 Range' },
    // Ring of Fire (Fire/Dagger-offhand 4). Wiki: `{{skill fact|burning|4|stacks=2|
    // alt=Initial Burning}}{{skill fact|burning|2|alt=Pass-Through Burning}}` — both labeled.
    5691: { 'Burning@4@2': 'Initial Burning', 'Burning@2@1': 'Pass-Through Burning' },
    // Heat Sync (Tempest/Warhorn 4). Wiki: base `{{skill fact|might|stacks=3|10|game mode=pve}}` /
    // `{{skill fact|fury|10|25|game mode=pve}}` are unlabeled; the skill's own "copy your current
    // Might/Fury to allies" mechanic (per its own description) is separately encoded as
    // `{{skill fact|might|alt=Boon Copied}}` / `{{skill fact|fury|alt=Boon Copied|0|25|...}}` — a
    // real, wiki-labeled fact with no fixed numeric value (there's nothing fixed TO show, since it
    // copies whatever the caster currently has), API-encoded as a literal `duration: 0` marker. The
    // tuple is already distinct from the base grant (0 vs 10) so no occurrence-indexing is needed.
    29548: { 'Might@0@1': 'Boon Copied', 'Fury@0@1': 'Boon Copied' },
    // Pyro Vortex (Weaver, Fire+Air Sword Dual Attack). Wiki: `{{skill fact|burning|2|
    // alt=Initial Burning|game mode=pve}}{{skill fact|burning|6|stacks=2|alt=Initial Burning|game
    // mode=wvw pvp}}` then a 2nd, unlabeled `{{skill fact|burning|2|game mode=pve}}
    // {{skill fact|burning|1|game mode=wvw pvp}}` line — both concepts' PvE values coincide (2),
    // collapsing the locally-cached raw facts onto one shared tuple; occurrence-indexed in wiki
    // template order (Initial Burning first), the 2nd occurrence stays unlabeled per this table's
    // "unqualified base" convention.
    43074: { 'Burning@2@1#1': 'Initial Burning' },
    // Pyroclastic Blast (Weaver, Fire+Earth Staff Dual Attack). Wiki:
    // `{{skill fact|burning|alt=Burning on Impact|3}}{{skill fact|burning|alt=Pulse Burning|1}}` —
    // both labeled, no mode split at all.
    43762: { 'Burning@3@1': 'Burning on Impact', 'Burning@1@1': 'Pulse Burning' },
    // Molten End (Catalyst/Hammer 5). Wiki labels all 4 Might/Fury facts, no unlabeled base:
    // `{{skill fact|might|alt=First Hit Might|10|stacks=6}}...{{skill fact|might|alt=Additional Hit
    // Might|10}}...{{skill fact|fury|alt=First Hit Fury|6|25|game mode = pve}}...
    // {{skill fact|fury|alt=Additional Hit Fury|1|25|game mode = pve}}...` — every tuple already
    // unique (Might by stack count, Fury by duration), no occurrence-indexing needed.
    62910: { 'Might@10@6': 'First Hit Might', 'Might@10@1': 'Additional Hit Might', 'Fury@6@1': 'First Hit Fury', 'Fury@1@1': 'Additional Hit Fury' },
    // Sandstorm Shroud (Necromancer/Scourge, 54870) — a fresh collision introduced by this
    // session's trait-granted-boons-on-skills curation (Necromancer leg): the skill's own genuine
    // unconditional Protection@3@1 fact now shares an exact tuple with Eternal Life's (trait 889)
    // synthetic "gain protection when you enter shroud" copy (`synthetic-facts.json`). Base stays
    // unlabeled per this table's convention (occurrence 1, no entry needed); the trait-gated 2nd
    // occurrence gets the real label.
    54870: { 'Protection@3@1#2': 'Eternal Life' },
    // --- Elementalist leg (5th leg, trait-granted-boons-on-skills sweep, 2026-08-14) --- 4 more
    // fresh collisions, same shape as Sandstorm Shroud above: Gale Song (trait 1952, "grant
    // protection to nearby allies when you use a healing skill") and Soothing Ice (trait 348,
    // "gain regeneration and frost aura when you use a healing skill") each got mirrored onto every
    // Elementalist heal skill via `synthetic-facts.json`, and 4 of those skills already carried a
    // genuine same-tuple fact of their own. Base/pre-existing stays unlabeled (occurrence 1) in all
    // 4 per this table's convention; only the newly-mirrored occurrence gets a label.
    // Signet of Restoration (5503): its own Frost Aura@4@1 is gated by Written in Stone (trait
    // 287, "gain an aura when you use a signet skill") — unrelated mechanic, already occurrence 1.
    5503: { 'Frost Aura@4@1#2': 'Soothing Ice' },
    // Prayer to Dwayna / Healing Seed (12360/12440, shared racial heal skills): each already carries
    // Dark Defense's (Necromancer trait 860) synthetic Protection@3@1 from the Necromancer leg —
    // occurrence 1. Gale Song's copy is occurrence 2.
    // --- Engineer leg (3rd leg, trait-granted-boons-on-skills sweep, 2026-08-14) --- Reconstruction
    // Enclosure (trait 508, "grant protection to nearby allies when you use a heal skill") mirrored
    // onto every Engineer heal skill via `synthetic-facts.json`, same heal-skill-category shape as
    // Dark Defense/Gale Song above; on these 2 shared racial ids that's a 3rd Protection@3@1 copy.
    // --- Ranger leg (6th leg, trait-granted-boons-on-skills sweep, 2026-08-14) --- Wellspring
    // (trait 978, "grant regeneration to nearby allies when you use a healing skill") mirrored onto
    // every Ranger heal skill; on these 2 shared racial ids its Regeneration@6@1 collides with the
    // Mesmer leg's Metaphysical Rejuvenation (trait 666) mirror, already occurrence 1 there (see
    // that leg's own comment further down for why 12440 never got a WvW override for this status).
    12360: {
      'Protection@3@1#2': 'Gale Song',
      'Protection@3@1#3': 'Reconstruction Enclosure',
      'Protection@3@1#4': 'Thick Skin',
      'Regeneration@6@1#2': 'Wellspring'
    },
    12440: {
      'Protection@3@1#2': 'Gale Song',
      'Protection@3@1#3': 'Reconstruction Enclosure',
      'Protection@3@1#4': 'Thick Skin',
      'Regeneration@6@1#2': 'Wellspring'
    },
    // Glyph of Elemental Harmony (34609): its own unconditional Protection@3@1 (the glyph's base
    // self-effect) is occurrence 1. Inscription's (trait 229, "gain boons upon casting a glyph based
    // on your attunement") own Protection upgrade is a different tuple (6s, `overrides: 2`) so it
    // doesn't collide here. Gale Song's mirrored Protection@3@1 copy is occurrence 2.
    34609: { 'Protection@3@1#2': 'Gale Song' },
    // --- Mesmer leg (5th leg, trait-granted-boons-on-skills sweep, 2026-08-14) --- Temporal
    // Enchanter (trait 1980, "when you cast a glamour, allies near the glamour gain resistance and
    // superspeed") mirrored onto every Glamour-category skill except Portal Exeunt (wiki: "does not
    // grant allies these boons"). Time Warp's own unconditional Superspeed@2@1 (base skill fact, no
    // `requires_trait`) is occurrence 1; the trait's wvw/pvp-tagged Superspeed copy (2s, same value
    // as Time Warp's own pve-unsplit number) is occurrence 2 — this pairing is also why no matching
    // skill-side `WvwFactOverrides` entry was added for Superspeed on these 2 ids specifically (see
    // that file's own comment on skill 10311/10377): collapsing via override would have overridden
    // Time Warp's OWN unconditional fact instead of just the trait's.
    10311: { 'Superspeed@2@1#2': 'Temporal Enchanter' },
    10377: { 'Superspeed@2@1#2': 'Temporal Enchanter' },
    // --- Revenant leg (7th leg, trait-granted-boons-on-skills sweep, 2026-08-14) --- Legendary
    // Demon Stance (28494, Mallyx's "invoke a legend" swap skill): Aggressive Arrival's (trait
    // 1776, "gain resistance when you invoke a legend") mirrored Resistance@2@1 is occurrence 1,
    // unlabeled — it's added first in `synthetic-facts.json`. Spirit Boon's (trait 1774,
    // "invoking a legend grants boons... based on the legend that was invoked") own Demon-specific
    // Resistance line happens to share the exact same 2s/1-stack tuple, added second — occurrence 2.
    28494: { 'Resistance@2@1#2': 'Spirit Boon' },
    // --- Warrior leg (9th and final leg, trait-granted-boons-on-skills sweep, 2026-08-14) ---
    // Thick Skin (trait 1350, "gain protection when you use a healing skill") mirrored onto all 10
    // Warrior heal skill ids, same heal-skill-category shape as every prior leg. On the 2 shared
    // racial heals its Protection@3@1 is a 4th copy (Necromancer/Elementalist/Engineer already sit
    // at occurrences 1-3 there).
    // Restorative Strength (trait 1451, "using a heal skill grants might [and resistance]") also
    // mirrored onto all 10 heal ids: Might@6@5 and Resistance@6@1 (pve; wvw+pvp Resistance drops to
    // 4, `WvwFactOverrides`) are both brand-new statuses on the 2 racial ids, no collision there —
    // but Healing Signet (14389) already carries its own unconditional Resistance@6@1 (a genuine,
    // always-on passive, unrelated to this trait): occurrence 1 stays that base fact, the trait's
    // mirror is occurrence 2, and the WvW override was deliberately skipped on just this one id
    // (adding it would have also dropped Healing Signet's own base Resistance in WvW/PvP — same
    // "coexisting genuine application blocks a safe status-wide override" hazard the Ranger leg's
    // Beast-skill mirror first ran into).
    14389: { 'Resistance@6@1#2': 'Restorative Strength' }
    // Resilient Counter (2097, Resistance) + Guard Counter (2153, Protection) both mirrored onto
    // Full Counter (44165) alone — its own raw Buff fact is Stability, a different status, so no
    // collision. Bloody Roar (1928, Resistance) + Burst of Aggression (1993, Quickness/pve 3s wvw+pvp
    // 2s via WvwFactOverrides/Superspeed/Fury) + Eternal Champion (2307, Stability x2 stacks) all
    // mirrored onto both Berserk-entry ids (30185/30435, the flip-skill pair) — each contributes a
    // distinct status, no collisions among them or with Berserk's own pre-existing (non-Buff) facts.
    // Heat the Soul (2042, "grant boons to allies when you hit with a Burst skill") is the leg's
    // largest mirror: Might@10@3 (pve; wvw+pvp 8, override) + Fury@5@1 (unsplit) onto all 79 Burst +
    // PrimalBurst-category skill ids game-wide (this app's own closed buff-instance-label sweep had
    // already resolved this trait's own tuple ambiguity — see the `trait:` block's Warrior-leg entry
    // below), plus Quickness@5@1 onto 78 of those 79 — Decapitate (30851, the one PrimalBurst skill
    // the trait's wiki `linked skill=` field names by name) gets Quickness@2@1 instead, mirroring
    // that trait-level distinction exactly. 6 of the 79 ids (5 Eviscerate variants + Decapitate
    // itself) already carry their own unrelated Might@5@5 fact (base Eviscerate's own might-on-hit
    // effect, a different tuple) — the Might WvW override was skipped on just those 6 to avoid
    // corrupting that unrelated fact, same shape as Healing Signet above; no tuple collision so no
    // label needed there either. Zero fresh same-tuple collisions found on the 79-id mirror itself.
  },
  trait: {
    // --- Thief leg (2nd leg, 2026-08-14) --- first-ever trait entries in this table; traits carry
    // no `synthetic-facts.json` overlay, so their tuple keys resolve against `facts`+`traitedFacts`
    // only (matches `buff-instance-label-completeness.test.ts`'s trait-side check, added alongside
    // these entries).

    // Serpent's Touch (Deadly Arts, stealing/downed poison). Local facts carry 3 Poisoned
    // instances: a pve-tagged base (10s/2 stacks) and a pvp-tagged variant (10s/1 stack) — both
    // stay unlabeled per this table's convention, already distinguishable by their own stack-count
    // numbers, and neither carries wiki `alt=` text anyway — plus
    // `{{skill fact|poisoned|2|alt=Poison When Downed}}` for the downed-state poison.
    1279: { 'Poisoned@2@1': 'Poison When Downed' },
    // Shadestep's Heal (2289) and Unhindered Combatant's Exhaustion (1964) both looked like real
    // "linked skill="-sourced conflicts during this leg's rescan (see the `skill` block's own NOTE
    // above) but "Heal"/"Exhaustion" aren't recognized boon/condition names (`BOON_NAMES`/
    // `CONDITION_NAMES`, constants.ts) — `classifyBoonCondition` gates them out before this table's
    // lookup is ever reached, so neither gets an entry. Panic Strike's Immobile and Be Quick or Be
    // Killed's Quickness ARE real recognized statuses with genuine pve/wvw+pvp splits, but with NO
    // wiki `alt=` text distinguishing the 2 facts (a bare mode split, not 2 different concepts) —
    // fixed via `WvwFactOverrides`/`fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` instead, not here.

    // --- Warrior leg (3rd leg, 2026-08-14) ---

    // Sundering Burst (Spellbreaker, burst-skill vulnerability). The wiki has since renamed this
    // trait to "Rending Strikes" (its own page title, "Sundering Burst" redirects there) — local
    // game-data's name is stale, doesn't affect curation. Wiki: base Vulnerability
    // (`{{skill fact|vulnerability|8|stacks=5|pve}}{{skill fact|vulnerability|6|stacks=5|pvp
    // wvw}}`) is unlabeled; the critical-hit bonus carries an IDENTICAL pve/wvw+pvp split, just
    // `alt=Critical Vulnerability` on both variants. Local carries all 4 raw facts (pve/wvw pairs
    // for both concepts), so both the 8@5 and 6@5 tuples need occurrence-indexing — 1st occurrence
    // of each (array order matches wiki template order: base-pve, base-wvw, crit-pve, crit-wvw)
    // stays unlabeled, 2nd occurrence of each gets the label.
    1316: { 'Vulnerability@8@5#2': 'Critical Vulnerability', 'Vulnerability@6@5#2': 'Critical Vulnerability' },
    // Heat the Soul (Berserker, burst-skill boons). Wiki's base Quickness
    // (`{{skill fact|Quickness|5|pve}}`) is unlabeled; a 2nd, shorter Quickness application is
    // tagged `linked skill=Decapitate` (`{{skill fact|Quickness|2|linked skill=Decapitate|pve}}`)
    // — same "linked skill="-sourced label convention as Shadestep in the Thief leg (real wiki
    // text, just a different template parameter than `alt=`). The tuples differ (5@1 vs 2@1) so no
    // occurrence-index is needed regardless of array order. This trait's Might pair (8s wvw+pvp/
    // 10s pve, both stacks=3, no `alt=`) is a plain mode split — fixed via `WvwFactOverrides`
    // instead, see that file's own comment on trait 2042.
    2042: { 'Quickness@2@1': 'On Decapitate' },
    // Marching Orders' Might pair (1480) is a plain pve/wvw+pvp split with no `alt=` — fixed via
    // `WvwFactOverrides` instead. Its Protection pair (both gated by a DIFFERENT trait, 1474 —
    // Vengeance, not native to this trait's own description) isn't documented anywhere on this
    // trait's own wiki page at all (no `{{trait fact}}` for it, external trait-granted bonus),
    // same "no wiki text to quote" shape as Deadly Strike/Hidden Thief in the Thief leg — left
    // uncurated. Feverish Pulse's Quickness pair (2369, 2s pvp-tagged/1s wvw-tagged, no `alt=`) is
    // also a plain mode split, fixed via `WvwFactOverrides` instead.

    // --- Guardian leg (5th leg, 2026-08-14) ---

    // Zealous Scepter (Zeal, scepter Might on Virtue of Justice's passive trigger). Wiki names 2
    // distinct concepts via `linked skill=Virtue of Justice`, each split 3 ways (pve/wvw/pvp, no
    // clean 2-value WvwFactOverride shape since all 3 differ):
    // `{{skill fact|might|alt=Scepter Might Gain|...|10|stacks=2|pve}}` (+wvw=4, pvp=6) while
    // wielding a scepter, and `{{skill fact|might|alt=Non-Scepter Might Gain|...|10|pve}}` (+wvw=4,
    // pvp=6, stacks=1) otherwise. Every (duration, applyCount) tuple is already unique (stacks=2 vs
    // stacks=1 alone would disambiguate), but the wiki's own naming is genuinely useful build info
    // (whether a scepter is equipped changes the might gain) so every tuple gets the matching label,
    // same "apply one label text to multiple mode-variant tuples" convention as the Revenant leg's
    // Embrace the Darkness.
    1925: {
      'Might@10@2': 'Scepter Might Gain',
      'Might@6@2': 'Scepter Might Gain',
      'Might@4@2': 'Scepter Might Gain',
      'Might@10@1': 'Non-Scepter Might Gain',
      'Might@6@1': 'Non-Scepter Might Gain',
      'Might@4@1': 'Non-Scepter Might Gain'
    },
    // Phoenix Protocol (Willbender, Flowing Resolve boons). Wiki names 2 distinct concepts, each
    // split by mode into a DIFFERENT status entirely (Alacrity for pve/pvp, Resolution for wvw):
    // "on Trigger" (`{{skill fact|alacrity|alt=Alacrity on Trigger|1|pve}}` +pvp=2;
    // `{{skill fact|resolution|alt=Resolution on Trigger|2|wvw}}`) and "on Activation"
    // (`{{skill fact|alacrity|alt=Alacrity on Activation|5|pve}}` +pvp=3;
    // `{{skill fact|resolution|alt=Resolution on Activation|3|wvw}}`). Every tuple across both
    // statuses is unique, so no occurrence-indexing needed — each of the 6 raw facts (4 Alacrity + 2
    // Resolution) maps 1:1 onto one of these 4 label texts.
    2195: {
      'Alacrity@1@1': 'Alacrity on Trigger',
      'Alacrity@2@1': 'Alacrity on Trigger',
      'Alacrity@5@1': 'Alacrity on Activation',
      'Alacrity@3@1': 'Alacrity on Activation',
      'Resolution@2@1': 'Resolution on Trigger',
      'Resolution@3@1': 'Resolution on Activation'
    },
    // Several more Guardian trait conflicts investigated this leg turned out to be plain
    // WvwFactOverride cases instead (Permeating Wrath, Unrelenting Criticism, Legendary Lore) — see
    // fetch-wvw-splits.ts's own comment block on this leg. Left open: Resolute Subconscious (625, 2
    // raw-identical Resolution@3 facts, wiki's whole page only carries ONE unqualified
    // `{{skill fact|resolution|3}}` template, nothing to quote — same Dhuumfire shape).

    // --- Engineer leg (6th leg, 2026-08-14) ---

    // New Genes (Amalgam GM, morph-skill boons). The bare, unconditioned Might
    // (`{{skill fact|Might|12|stacks=4|game mode = pve}}{{skill fact|Might|6|stacks=3|game mode =
    // pvp wvw}}`) has no `alt=`/`linked skill=` and stays unlabeled; the Offensive Protocol:
    // Obliterate-linked Might (`{{skill fact|Might|12|stacks=5|linked skill=Offensive Protocol:
    // Obliterate}}`) is distinguished from the bare grant by its own apply_count (5, vs. the bare
    // grant's 4/3) so every tuple is already unique — but the wiki's own fact line only shows ONE
    // flat value (12) for the Obliterate line, missing the wvw+pvp variant (6) the raw data and this
    // trait's own 2025-12-09 version-history note ("Increased the Offensive Protocol: Obliterate
    // might duration from 6 seconds to 12 seconds in PvE only") both confirm is real — same
    // "linked skill=-sourced label applied to every mode-variant tuple of one concept" convention as
    // Guardian leg's Zealous Scepter, just sourced from a version-history note instead of a 2nd
    // wiki-fact line.
    2387: { 'Might@12@5': 'Offensive Protocol: Obliterate', 'Might@6@5': 'Offensive Protocol: Obliterate' },
    // Hardened Chrome (Amalgam adept, morph/evolve protection). Wiki: base
    // (`{{skill fact|protection|2.5}}`) is unlabeled (the local raw 3 is the documented half-second-
    // rounds-up quirk); the Evolve-triggered bonus carries `{{skill fact|protection|alt=Protection
    // on Evolve|4}}`.
    2434: { 'Protection@4@1': 'Protection on Evolve' },
    // Experimental Turrets' Might pair turned out to be a plain WvwFactOverride case instead (see
    // fetch-wvw-splits.ts's own comment block on this leg) — its other 5 Buff facts (Vigor/
    // Swiftness/Fury/Resolution/Protection, one per turret type) are all single-instance already.

    // --- Mesmer leg (8th leg, 2026-08-14) ---

    // Illusionary Defense (Chaos, Shatter 2 protection). Wiki names 2 concepts, each mode-split:
    // `{{skill fact|protection|4|alt=Base Protection Duration|game mode = pve wvw}}
    // {{skill fact|protection|2|alt=Base Protection Duration|game mode = pvp}}` and
    // `{{skill fact|protection|2|alt=Additional Protection Duration|game mode = pve wvw}}
    // {{skill fact|protection|1|alt=Additional Protection Duration|game mode = pvp}}` — Base's pvp
    // value (2) collides with Additional's pve+wvw value (2), occurrence-indexed in wiki template
    // order (matches this trait's own raw fact order); the other 2 tuples (4, 1) are already
    // unique. Labels only, though — this table never drops the 2 pvp-only occurrences on its own;
    // see `BUFF_INSTANCE_VALUE_OVERRIDES.trait[675]` above for the 2026-08-20 fix that does, plus
    // the new `synthetic-facts.json` copy onto Cry of Frustration (id 10190, this trait's own
    // "Shatter skill 2") so the boon shows up on the F2 skill's own tooltip too.
    675: {
      'Protection@4@1': 'Base Protection Duration',
      'Protection@2@1#1': 'Base Protection Duration',
      'Protection@2@1#2': 'Additional Protection Duration',
      'Protection@1@1': 'Additional Protection Duration'
    },
    // Master Fencer (Dueling, on-crit fury). Wiki: base `{{skill fact|fury|4|25|game mode=pve}}`
    // (+pvp/wvw=4, identical, no 2nd tuple) is unlabeled; the self bonus carries
    // `{{skill fact|fury|8|25|game mode=pve|alt = Personal Fury}}` (+pvp/wvw=8, also identical) —
    // both concepts' pve/pvp+wvw values coincide, so only 2 raw tuples exist locally, matching the
    // 2 wiki concepts 1:1.
    707: { 'Fury@8@1': 'Personal Fury' },
    // Phantasmal Haste (Illusions, phantasm/personal quickness). Wiki: `{{skill fact|quickness|3|
    // alt=Phantasm Quickness}}` (no mode split) and `{{skill fact|quickness|1.5|alt=Personal
    // Quickness|game mode = pve}}` (rounds to 2) `{{skill fact|quickness|1|alt=Personal
    // Quickness|game mode = pvp wvw}}` — 2 concepts share this trait's "Quickness" status, so
    // `WvwFactOverride` can't safely collapse Personal Quickness's own mode split without also
    // swallowing Phantasm Quickness (same hazard as Radiant Arc, Engineer leg) — labeled instead,
    // reusing "Personal Quickness" across both its mode-variant tuples.
    729: { 'Quickness@3@1': 'Phantasm Quickness', 'Quickness@2@1': 'Personal Quickness', 'Quickness@1@1': 'Personal Quickness' },
    // Bountiful Disillusionment's Might/Vigor/Fury conflicts turned out to be plain single-concept
    // WvwFactOverride cases instead (see fetch-wvw-splits.ts's own comment block on this leg); its
    // Stability conflict is left open there too (a 2nd, genuinely-additive elite-spec-gated
    // instance blocks a safe override, and its own page has no `alt=` to quote either).

    // Blinding Dissipation's Blinded conflict turned out to be a plain WvwFactOverride case instead
    // (see fetch-wvw-splits.ts's own comment block on this leg); its Ineptitude-linked Confusion
    // conflict is left open there too (wiki/local data mismatch).

    // Flow of Time (Chronomancer, shatter alacrity). Its 2 raw-identical Alacrity@1@1 facts are a
    // NEW instance of the "pve and wvw+pvp happen to round to the same displayed number" shape
    // (Warrior leg's Stomp, Engineer leg's Electric Artillery): a 2025-02-11 patch increased the
    // WvW-only value from 0.75s to a full 1s, so it now numerically matches the PvE value exactly —
    // one wiki concept (`{{skill fact|alacrity|1|alt=Alacrity per Clone}}`, no `alt=` differentiating
    // a 2nd instance), 2 raw facts, nothing to distinguish the 2nd from the 1st. Left open.
    // Mirrored verbatim (both facts, still undistinguished) onto all 11 Shatter/Bladesong skill ids
    // by the Mesmer leg of the trait-granted-boons-on-skills sweep (2026-08-14, `synthetic-facts.json`)
    // — same already-accepted duplicate shape, not a new problem introduced by that mirroring.

    // Stretched Time (Chaos, shatter/phantasm boons). Wiki names 2 Alacrity concepts and 2 Might
    // concepts, matching this trait's own raw fact order exactly:
    // `{{skill fact|alacrity|1|game mode = pve pvp|alt=Alacrity per Clone}}
    // {{skill fact|might|6|game mode = wvw|alt=Might per Clone}}
    // {{skill fact|alacrity|3|game mode = pve|alt=Alacrity on Phantasm Spawn}}
    // {{skill fact|alacrity|1|game mode = pvp|alt=Alacrity on Phantasm Spawn}}
    // {{skill fact|might|6|stacks=2|game mode = wvw|alt=Might on Phantasm Spawn}}` — Alacrity per
    // Clone's pve/pvp value (1) collides with Alacrity on Phantasm Spawn's pvp value (1),
    // occurrence-indexed; the Might pair is already unique (differs by stack count).
    1942: {
      'Alacrity@1@1#1': 'Alacrity per Clone',
      'Alacrity@3@1': 'Alacrity on Phantasm Spawn',
      'Alacrity@1@1#2': 'Alacrity on Phantasm Spawn',
      'Might@6@1': 'Might per Clone',
      'Might@6@2': 'Might on Phantasm Spawn'
    },
    // Mental Defense's Resistance conflict, Nomad's Endurance's Vigor conflict, and Renewing
    // Oasis's Regeneration conflict all turned out to be plain single-concept WvwFactOverride cases
    // instead (see fetch-wvw-splits.ts's own comment block on this leg).

    // Seize the Moment (Illusions, shatter/phantasm quickness). Wiki: `{{Skill fact|quickness|1|
    // alt=Quickness per Clone|game mode = pve}}{{Skill fact|quickness|0.75|alt=Quickness per
    // Clone|game mode = pvp}}{{Skill fact|quickness|0.5|alt=Quickness per Clone|game mode = wvw}}`
    // followed by an unlabeled base `{{Skill fact|quickness|3|game mode = pve}}
    // {{Skill fact|quickness|1|game mode = pvp}}{{Skill fact|quickness|0.75|game mode = wvw}}` — all
    // 3 "Quickness per Clone" values round to 1s locally, AND the base's own pvp/wvw values also
    // round to 1s, so 5 of this trait's 6 raw facts collapse onto one shared tuple. RESOLVED
    // 2026-08-15 via the new `BUFF_INSTANCE_VALUE_OVERRIDES` below (see its own doc comment for the
    // full breakdown): occurrences #1/#2/#4 and the sole `Quickness@3@1` fact are now omitted
    // outright as non-WvW duplicates, so only occurrence #3 (the real WvW "per Clone" value, 0.5s)
    // ever gets emitted — this label entry is trimmed down to just that surviving occurrence.
    2022: {
      'Quickness@1@1#3': 'Quickness per Clone'
    },
    // Life of the Party (Troubadour, Lively Lute/Crescendo boons). Wiki names 2 `linked skill=`
    // concepts sharing this trait's "Quickness" and "Might" statuses at once (Lively Lute's own
    // grant, and Crescendo's, each independently mode-split) — same 2-concepts-share-a-status
    // hazard as Phantasmal Haste above, so labeled rather than collapsed via `WvwFactOverride`
    // (which would silently swallow one `linked skill=`'s contribution). Every tuple here is
    // already unique so no occurrence-indexing is needed; the matching label is applied per
    // `linked skill=` regardless. Lively Lute's OWN copy of this same Might bonus (76552/77306, a
    // 3rd source since it's also gated by Bountiful Disillusionment, trait 1687) is curated
    // separately in the `skill` block above.
    2367: {
      'Quickness@6@1': 'Lively Lute',
      'Quickness@8@1': 'Crescendo',
      'Quickness@4@1': 'Crescendo',
      'Quickness@2@1': 'Crescendo',
      'Might@8@5': 'Lively Lute',
      'Might@6@3': 'Lively Lute',
      'Might@15@8': 'Crescendo'
    },

    // --- Elementalist leg (9th leg, FINAL leg, 2026-08-14) ---

    // Lucid Singularity (Tempest, overload boons). NEW failure mode: this trait grants a DIFFERENT
    // boon per game mode rather than a duration split of one boon — Alacrity only in PvE
    // (`{{skill fact|alacrity|alt=Alacrity per Pulse|1|game mode = pve}}
    // {{skill fact|alacrity|alt=Alacrity on Overload|4.5|game mode = pve}}`), Might only in
    // WvW+PvP (`{{skill fact|Might|alt=Might per Pulse|8|game mode = pvp wvw}}
    // {{skill fact|Might|alt=Might on Overload|8|stacks=3|game mode = pvp wvw}}`) — all 4 tuples
    // already distinct (Alacrity by duration, Might by stack count), straightforwardly labeled.
    2033: {
      'Alacrity@1@1': 'Alacrity per Pulse',
      'Alacrity@5@1': 'Alacrity on Overload',
      'Might@8@1': 'Might per Pulse',
      'Might@8@3': 'Might on Overload'
    },
    // Familiar's Blessing (Evoker, familiar-skill boons). Same "different boon per mode" shape as
    // Lucid Singularity above, but per `linked skill=` too — 4 familiar skills each grant one boon
    // in PvE and a DIFFERENT boon in WvW+PvP: Ignite (PvE Quickness/WvW+PvP Might), Splash (PvE
    // Alacrity/WvW+PvP Vigor), Zap (PvE Quickness/WvW+PvP Fury), Calcify (PvE Alacrity/WvW+PvP
    // Protection). Ignite's and Zap's PvE Quickness (both 1.75s, rounds to 2) collide on one tuple,
    // as do Splash's and Calcify's PvE Alacrity (both 4s) — occurrence-indexed in raw fact order
    // (matches wiki template order: Ignite, Splash, Zap, Calcify), labeled by `linked skill=` name.
    // The WvW+PvP-side boons (Might/Fury/Protection) are each single-instance so would normally
    // qualify for `WvwFactOverride` instead, but a direct `/v2/traits/2380` pull confirms the wiki's
    // stated wvw+pvp values (Might 6/Fury 3/Protection 2) don't appear in the live API at all —
    // every wvw+pvp-tagged fact actually returns its PvE sibling's OWN value (Might/Fury/Protection
    // all showing 2/2/4, matching Ignite/Zap's Quickness and Splash/Calcify's Alacrity exactly), an
    // undocumented wiki/API mismatch with no trustworthy value to override to — left showing the
    // (mismatched) raw API value as-is.
    2380: {
      'Quickness@2@1#1': 'On Ignite',
      'Quickness@2@1#2': 'On Zap',
      'Alacrity@4@1#1': 'On Splash',
      'Alacrity@4@1#2': 'On Calcify'
    }
  }
}

/**
 * `BoonConditionSource.triggerNote`'s source table — see that field's doc comment for scope/intent.
 * A one-time sweep (2026-08-15) of every `traits.json` entry whose `description` mentions "dodge"
 * (28 candidates) found 9 already producing a real, `classifyBoonCondition`-recognized Buff fact
 * directly on the trait's own `facts` array (i.e. already counted in
 * `computeBoonConditionSources`'s totals today, confirmed by tracing `computeBoonConditionSources`'s
 * chosen-trait loop — it walks every chosen major/minor trait's `facts` unconditionally, no
 * trigger-aware gating exists anywhere in that pipeline), plus 1 more (Reckless Dodge 1446) added the
 * same day once `synthetic-trait-facts.json` closed its calc gap — see that file's own doc comment in
 * `load-game-data.ts` for why its real Might fact wasn't on the trait at all until then. A 2nd trait
 * (Saint of zu Heltzer 2238) got the same fix that same day for its Alacrity grant, but that fix was
 * ITSELF reverted the same day once found to be wrong (see below) — 2238 carries no entry in this
 * table at all as a result. The other 17 candidates fall into buckets this table deliberately
 * excludes: heal/barrier-on-dodge coefficients (Selfless Daring 551, Healer's Gift 1816, Master's
 * Fortitude 2180) already show their own trait tooltip with the dodge wording still attached
 * (Healing/Damage never enter the pooled aggregate panel this table targets, see
 * `BoonConditionSummaryPanel`'s own doc comment for why); a flat always-on stat bonus whose dodge-roll
 * wording only gates an unrelated stealth-attack-access clause (Silent Scope 2118's Precision,
 * `trait-attributes.ts`); non-`BOON_NAMES`/`CONDITION_NAMES` custom statuses with no tracked consumer
 * (Lotus Training 1833, Unhindered Combatant 1964, Bounding Dodger 2047, Mirage Cloak 2150, Saint of
 * zu Heltzer 2238's OWN "Saint of zu Heltzer" buff — its separate Alacrity grant is ALSO excluded as
 * of 2026-08-15, see below, so nothing from this trait is labeled here at all — Resolute Evasion
 * 1782's OWN second "Resolute Evasion" buff alongside its tracked Resolution — only Resolution is
 * listed below); non-boon effects (Deceptive Evasion 704's clone summon, Adrenal Implant 523/Power
 * Wrench 531's recharge reduction, Mark of Evasion 792/Uncatchable 1159/Explosive Entrance 432/
 * Evasive Arcana 238's empty-facts "Combat Only" markers — real effects with zero live API fact of the
 * needed shape). Reaver's Curse (2259, Vindicator) is ALSO excluded: its wiki page confirms the trait
 * only "increases the effectiveness of your NEXT dodge," modifying a different, already
 * self-only-curated Might source (`TARGET_COUNT_OVERRIDES`) rather than itself being granted "on
 * dodge."
 *
 * Saint of zu Heltzer's Alacrity grant was REMOVED from this table 2026-08-15, the same day it was
 * added, once the user caught (via a wiki screenshot) that the June 2025 patch note reads "applies
 * alacrity to allies affected by your dodge in PvE only" — a wiki page with no WvW-tagged line to
 * split against at all, which is exactly why the original sweep's cross-validation never flagged it:
 * `wvw-fact-overrides.json` already independently resolves this fact to `'omit'` (see
 * `resolveOverride`'s `pveLines.length === 1 && wvwLines.length === 0` case in
 * `fetch-wvw-splits.ts`), and this app never displays a fact confirmed absent in WvW anywhere else —
 * showing it here was an inconsistency, not a deliberate exception. `synthetic-trait-facts.json`'s
 * "2238" entry and `TARGET_COUNT_OVERRIDES.trait`'s "2238" entry were both removed for the same reason.
 *
 * 2 more (Forerunner of Death 2257, Vassals of the Empire 2232) were added in that same follow-up
 * 2026-08-15 pass (the user report that started it: "trait tooltips ... just flavor text," Vindicator's
 * 3 Grandmasters singled out) after discovering the original 28-candidate sweep's search only matched
 * the substring "dodge" — both these traits' descriptions say "Dodging," which never matched, so
 * neither was ever considered by the original sweep at all (not excluded on purpose, simply never
 * seen). Forerunner of Death's own trait facts already carried its self-only "Forerunner of Death"
 * buff but no Vulnerability; Vassals of the Empire's `facts` array was entirely empty in the live API.
 * Unlike Saint of zu Heltzer's Alacrity, both of these ARE wiki-confirmed to apply in WvW (Death
 * Drop's Vulnerability is unsplit across game modes; Imperial Impact's Might/Protection have a real
 * WvW value, already present in `wvw-fact-overrides.json`) — no reversal needed. Both closed via
 * `synthetic-trait-facts.json` the same way Reckless Dodge was, pulling from proc skills Death Drop
 * (62693) and Imperial Impact (62859) respectively — see `load-game-data.ts`'s
 * `withSyntheticTraitFacts` doc comment.
 * That same re-check found ~10 more "Dodging"-worded traits, triaged in a dedicated follow-up pass
 * 2026-08-15 (same day). 2 were genuine gaps of this same shape, both already carrying a real,
 * duration-bearing `Buff` fact needing only a label (no `synthetic-trait-facts.json` merge required,
 * unlike the Vindicator pair above): Expeditious Dodger 1240 (Thief/Acrobatics, wiki: "Gain swiftness
 * upon dodging") and Weakening Strikes 1887 (Thief/Daredevil, wiki: "Your next attack after dodging
 * causes weakness to foes struck" — the Weakness fact's dual PvE/WvW-duration facts were already
 * deduped by a pre-existing `wvw-fact-overrides.json` entry). 1 more, Duelist's Reversal 2215
 * (Mesmer/Virtuoso, wiki: "activates when blocking OR dodging attacks"), grants real Quickness/Fury/
 * Regeneration facts but on a broader trigger than a bare dodge — same shape as Upper Hand 1295 above,
 * labeled distinctly rather than folded into "On Dodge". The other 7 confirmed out of scope on
 * inspection: Stop, Drop, and Roll 360 and Pain Response 1237 are condition-CLEANSE traits whose
 * removed-condition `Buff` facts carry no `duration` field at all, so `extractFromFacts`'s
 * `typeof fact.duration === 'number'` gate already filters them out automatically (same non-issue as
 * Evasive Purity 1054, which has no `Buff`-type fact at all — only `Number`/`AttributeAdjust`); Light
 * on your Feet 1912's own "Light on Your Feet" self-buff and Psychic Riposte 2211's "blades" resource
 * are non-`BOON_NAMES`/`CONDITION_NAMES` custom statuses/counters with no tracked consumer, same
 * bucket as Lotus Training etc. above; Tenacious Ruin 2262 is a dodge-REPLACEMENT ability (Vindicator)
 * with a real `Damage` fact already visible on its own trait tooltip, but `Damage` facts are outside
 * this Boon/Condition table's scope entirely (unlike Vindicator's Legendary Alliance dodge/Mirage
 * Cloak, it isn't a Problem-2 "API gives nothing to render" case — just a different fact type this
 * table doesn't cover); Mayhem 2427's Torment fact belongs to Flustering Flute (the skill it modifies),
 * not to dodging itself — the trait's own dodge tie-in is only a non-boon recharge reduction, so
 * labeling its Torment "On Dodge" would misattribute it. This closed out every candidate the original
 * "dodge"/"Dodging" substring sweep could find at all.
 *
 * A follow-up terminology sweep (2026-08-15, while scoping TODO.md's Problem 2) widened the search to
 * `/mirage cloak|evade|evasion|death drop/i` — profession-specific dodge synonyms the "dodge" substring
 * itself can never match (Mesmer's dodge roll is always narrated as gaining "Mirage Cloak", and several
 * evade-frame traits across professions are worded "evade an attack" with no "dodge" in sight at all).
 * 4 more genuine gaps found, same shape as before — a real, already-counted Buff fact needing only a
 * label: Mental Gymnastics 705 (Mesmer/Dueling, wiki: "When you successfully evade an attack, gain
 * vigor") and Primal Reflexes 1067 (Ranger/Skirmishing, identical wording) both labeled 'On Evade' (Vigor,
 * same trigger breadth as Upper Hand 1295); Wandering Mind 1960 (Mesmer/Dueling, wiki: "Remove a
 * nondamaging condition and gain swiftness whenever you evade an attack") also 'On Evade' (Swiftness);
 * Renewing Oasis 2082 (Mesmer/Mirage, wiki: "Gain regeneration when you gain Mirage Cloak") labeled 'On
 * Mirage Cloak' rather than folded into 'On Dodge' — Mirage Cloak can also be granted by Dune Cloak's
 * Shatter-triggered route (not just dodging), so a bare "On Dodge" would be narrower than the real
 * trigger, same reasoning as 'On Block or Dodge'/'On Evade' above. The rest of that sweep's matches
 * confirmed out of scope: Instant Reflexes 1112 GRANTS evasion rather than triggering on it (wrong
 * direction for this table); Hunter's Fortification 1908 and Escapist's Fortitude 2023 are heal/condi-
 * cleanse only, no Buff fact — same "Healing never enters this table's aggregate panel" exclusion as
 * Selfless Daring/Healer's Gift/Master's Fortitude above; Infinite Horizon 2070 grants Mirage Cloak to
 * illusions, not a boon to the player; Elusive Mind 2113's "Conditions Removed" is a `Number` fact with
 * no `duration` field, same non-issue as Stop, Drop, and Roll/Pain Response; Speed of Sand 2117 is a
 * flat `Percent` movement-speed bonus, not a `BOON_NAMES`-tracked Swiftness grant; Dune Cloak 2169 runs
 * the mechanic in reverse (Shatter grants Mirage Cloak, not the other way around) and has no Buff fact
 * of its own. This closes out every candidate both sweeps together could find — see TODO.md for
 * problems 2/3 (whole dodge-replacement mechanics; relic dodge-triggers), still open.
 */
export const DODGE_TRIGGER_NOTES: { skill: Record<number, string>; trait: Record<number, string> } = {
  skill: {},
  trait: {
    445: 'On Dodge', // Mecha Legs (Engineer/Inventions). Wiki: "Gain resistance when you dodge."
    564: 'On Dodge', // Vigorous Precision (Guardian/Honor). Wiki: "Gain vigor at the end of your dodge roll."
    753: 'On Dodge', // Malicious Sorcery (Mesmer/Illusions). Wiki: "When you dodge an attack, inflict
    // confusion on your attacker" — both curated Confusion facts (PvE/WvW+PvP split) come from this.
    1090: 'On Dodge', // Companion's Defense (Ranger/Wilderness Survival). Wiki: "You and your pet gain
    // protection when you dodge roll."
    1289: 'On Dodge', // Pumping Up (Thief/Acrobatics). Wiki: "Gain might when you dodge."
    // Upper Hand (Thief/Acrobatics): its tracked Regeneration specifically triggers "when you evade
    // an attack" per the wiki, not a bare dodge roll (dodging alone only grants untracked Initiative)
    // — a broader trigger than the other 8 entries here, labeled distinctly rather than folded in.
    1295: 'On Evade',
    1379: 'On Dodge', // Resilient Roll (Warrior/Defense). Wiki: "Gain resistance when you dodge."
    1782: 'On Dodge', // Resolute Evasion (Revenant/Retribution). Wiki: "Gain resolution after you dodge."
    2066: 'On Dodge', // Thermal Release Valve (Engineer/Holosmith). Wiki: "Dodge rolling vents heat as
    // an attack against nearby foes and grants vigor."
    1446: 'On Dodge', // Reckless Dodge (Warrior/Discipline). Wiki: "Damage foes at the end of a dodge
    // roll. Gain might for each foe struck" — Might fact merged in via `synthetic-trait-facts.json`.
    //
    // Saint of zu Heltzer (2238) has NO entry here (as of 2026-08-15, reversing an earlier one): its
    // only synthetic-merged fact was Alacrity, which is wiki-confirmed PvE-only and now correctly
    // omitted instead — see `TARGET_COUNT_OVERRIDES.trait`'s own "2238" comment above for the full
    // reasoning. User-caught 2026-08-15 (a wiki screenshot showing the June 2025 patch note "applies
    // alacrity...in PvE only," with no WvW-tagged line to have flagged this any other way).
    //
    // Found in a follow-up 2026-08-15 pass once the original 28-candidate sweep's "dodge"-substring
    // gap was discovered (see `load-game-data.ts`'s `withSyntheticTraitFacts` doc comment) — both
    // traits' descriptions say "Dodging," which the sweep's case-insensitive "dodge" search missed.
    2257: 'On Dodge', // Forerunner of Death (Revenant/Vindicator). Wiki: "Dodging now deals more
    // damage but affects a smaller area" — Vulnerability fact merged in via `synthetic-trait-facts.json`.
    2232: 'On Dodge', // Vassals of the Empire (Revenant/Vindicator). Wiki: "Dodging now grants boons to
    // allies and strikes foes when landing" — Might/Protection facts merged in via `synthetic-trait-facts.json`.
    //
    // Found in the "~10 more Dodging-worded traits" follow-up leg, same day:
    1240: 'On Dodge', // Expeditious Dodger (Thief/Acrobatics). Wiki: "Gain swiftness upon dodging."
    1887: 'On Dodge', // Weakening Strikes (Thief/Daredevil). Wiki: "Your next attack after dodging
    // causes weakness to foes struck."
    2215: 'On Block or Dodge', // Duelist's Reversal (Mesmer/Virtuoso). Wiki: "Blocking or dodging an
    // attack grants boons" — broader trigger than a bare dodge, same treatment as Upper Hand 1295 above.
    //
    // Found in the 2026-08-15 terminology re-sweep (`/mirage cloak|evade|evasion|death drop/i`,
    // TODO.md Problem 2 scoping) — none of these 4 contain "dodge"/"Dodging" at all.
    705: 'On Evade', // Mental Gymnastics (Mesmer/Dueling). Wiki: "When you successfully evade an
    // attack, gain vigor."
    1067: 'On Evade', // Primal Reflexes (Ranger/Skirmishing). Wiki: identical to Mental Gymnastics above.
    1960: 'On Evade', // Wandering Mind (Mesmer/Dueling). Wiki: "Remove a nondamaging condition and
    // gain swiftness whenever you evade an attack."
    2082: 'On Mirage Cloak' // Renewing Oasis (Mesmer/Mirage). Wiki: "Gain regeneration when you gain
    // Mirage Cloak." Not folded into 'On Dodge' — Dune Cloak (2169) can also grant Mirage Cloak via
    // Shatter, not just dodging, so the real trigger is broader than a bare dodge roll.
  }
}

/**
 * A single Buff-fact occurrence's WvW duration, resolved per-instance rather than per-status —
 * `WvwFactOverride` (in `types/game-data.ts`, keyed only by `status`) can hold exactly one number
 * per status per source, which breaks down when a source's raw facts encode 2+ DIFFERENT concepts
 * under the SAME status at once (see `BUFF_INSTANCE_VALUE_OVERRIDES`'s own doc comment for the
 * motivating case). `'omit'` drops this specific occurrence entirely (it's a same-concept PvE/PvP
 * duplicate of another occurrence that already carries the real WvW value, not a second real
 * application) — same semantics as `WvwFactOverride`'s own `'omit'`, just scoped to one occurrence
 * instead of the whole status.
 */
export type WvwInstanceOverride = number | 'omit'

/**
 * Occurrence-indexed WvW duration corrections — TODO.md's Seize the Moment follow-up to
 * `BUFF_INSTANCE_LABELS` above (same `${status}@${duration}@${applyCount}[#${occurrence}]` key
 * scheme, see that table's doc comment for the format/when-the-suffix-applies rules; `resolveInstance
 * ValueOverride` below mirrors `resolveInstanceLabel`'s own lookup exactly). Where `BUFF_INSTANCE_
 * LABELS` only adds a display qualifier on top of the API's own (possibly wrong) duration,
 * this table replaces the duration itself, or removes the occurrence outright — for sources where
 * the API's `duration` field has rounded 2+ genuinely different WvW values down to the same bucket,
 * so no single override number could represent all of them.
 *
 * Only one entry so far: Seize the Moment (Mesmer/Illusions, Major tier 3, id 2022). Wiki-verified
 * via raw wikitext (`?action=raw`) 2026-08-15 (matches the 2026-08-14 scoping note in TODO.md
 * exactly): `{{Skill fact|quickness|1|alt=Quickness per Clone|game mode = pve}}` /
 * `...|0.75|alt=Quickness per Clone|game mode = pvp}}` / `...|0.5|alt=Quickness per Clone|game mode
 * = wvw}}`, followed by an unlabeled base grant `{{Skill fact|quickness|3|game mode = pve}}` /
 * `...|1|game mode = pvp}}` / `...|0.75|game mode = wvw}}` — 2 real concepts (per-Clone, base), each
 * independently pve/pvp/wvw-split, 6 raw values total. The live API's own `duration` field (`data/
 * game-data/traits.json`, id 2022) rounds 5 of those 6 down to a shared `1` bucket (per-Clone's pve
 * value IS 1 exactly; pvp's 0.75 and wvw's 0.5 both round up to 1; base's pvp value IS 1 exactly;
 * base's wvw value 0.75 also rounds up to 1) — only base's pve value (3) stays unique. Raw fact
 * order matches the wiki's own per-Clone-then-base, pve-then-pvp-then-wvw template order exactly, so
 * tuple-occurrence position identifies each one unambiguously: occurrences #1/#2/#4 of the
 * `Quickness@1@1` tuple (per-Clone pve/pvp, base pvp) and the sole `Quickness@3@1` occurrence (base
 * pve) are omitted outright — real values, just not this app's WvW focus, none of them coincidentally
 * equal to their own real WvW counterpart; #3 (per-Clone wvw, 0.5) and #5 (base wvw, 0.75) are the 2
 * real WvW values, both previously indistinguishable from the pve/pvp occurrences they shared a
 * rounded bucket with. Net result: the 6 raw facts collapse to exactly 2 emitted rows — "Quickness
 * per Clone" 0.5s (label already curated in `BUFF_INSTANCE_LABELS` above, now trimmed to just this
 * surviving occurrence) and an unlabeled base Quickness 0.75s, matching the wiki's 2-concept
 * structure instead of the API's accidental 1s/3s bucketing.
 */
export const BUFF_INSTANCE_VALUE_OVERRIDES: { skill: Record<number, Record<string, WvwInstanceOverride>>; trait: Record<number, Record<string, WvwInstanceOverride>> } = {
  skill: {},
  trait: {
    675: {
      // Illusionary Defense (Chaos, id 675, "Grant protection to nearby allies when you use Shatter
      // skill 2"). BUFF_INSTANCE_LABELS above already labels this trait's 4 raw Protection facts
      // "Base"/"Additional" (2026-08-13 label sweep), but never dropped the 2 pvp-only occurrences —
      // user-caught 2026-08-20, both concepts' real WvW value coincides with their own pve value
      // (Base 4, Additional 2), only pvp differs (Base 2, Additional 1). Occurrence-indexed same as
      // that labeling: fact order is Base-pve/wvw(4), Base-pvp(2), Additional-pve/wvw(2),
      // Additional-pvp(1) — Base's pve/wvw value (occurrence-unique, key `Protection@4@1`) and
      // Additional's pve/wvw value (`Protection@2@1#2`) are already correct and need no entry; only
      // the 2 pvp-only occurrences below need dropping.
      'Protection@2@1#1': 'omit', // Base's pvp value (2) — collides with Additional's real WvW value
      'Protection@1@1': 'omit' // Additional's pvp value (1) — not a real WvW duration
    },
    2022: {
      'Quickness@1@1#1': 'omit', // per-Clone pve (1) — real value, not WvW
      'Quickness@1@1#2': 'omit', // per-Clone pvp (0.75, rounds to 1)
      'Quickness@1@1#3': 0.5, // per-Clone wvw — the real WvW value this app should show
      'Quickness@3@1': 'omit', // base pve (3)
      'Quickness@1@1#4': 'omit', // base pvp (1) — real value, not WvW
      'Quickness@1@1#5': 0.75 // base wvw — the real WvW value this app should show
    },
    2352: {
      // Found Purpose (Conduit). Its flat, legend-less Might fact carries an untagged PvE-only
      // duplicate (10s×5 stacks) alongside the real WvW+PvP value (5s×3 stacks, `Might@5@3`, which
      // needs no override — it's already the sole occurrence of its own tuple, since the OTHER
      // `Might@5@3` fact on this trait is Entity-legend-specific, a genuinely separate simultaneous
      // grant, not a mode-split duplicate of this one). Found during the 2026-08-20 Cosmic Wisdom
      // "Found Purpose supersedes Numinous Gift" fix — see `FOUND_PURPOSE_TRAIT_ID`'s doc comment in
      // this file (by `LEGEND_GATED_TRAIT_IDS`) for the writeup; discovered as a drive-by while
      // wiki-verifying Found Purpose's own numbers to copy onto Cosmic Wisdom, unrelated to that fix
      // itself. Wiki raw wikitext (`action=raw`) confirms: `{{skill fact|might|stacks=5|10|game
      // mode=pve}}{{skill fact|might|stacks=3|5|game mode=pvp wvw}}`.
      'Might@10@5': 'omit'
    },

    // Engineer leg (4th leg of the "remaining 8 professions" main WvW-duplicate sweep, TODO.md,
    // 2026-08-20) — 3 latent bugs found in ALREADY-curated `wvw-fact-overrides.json` entries for
    // this profession (predating this leg, likely from the original `fetch-wvw-splits.ts` run):
    // each trait's Might/Burning facts carry a genuine pve-vs-wvw split where BOTH `duration` AND
    // `apply_count` (stack count) change, but the existing plain per-status override only replaces
    // `duration` — it silently kept whichever occurrence's OWN `apply_count` happened to be first
    // in raw fact order, which for all 3 was the WRONG (non-WvW) one. Fixed the same way as Seize
    // the Moment/Found Purpose above: omit the non-WvW occurrences outright and let the WvW-correct
    // tuple (which already exists as its own distinct raw fact, duration+apply_count together) pass
    // through untouched rather than trying to express a duration-only correction.
    473: {
      // HGH (Alchemy). Wiki (`split = pve, wvw, pvp`): `{{skill fact|might|stacks=2|15|game mode =
      // pve}}{{skill fact|might|stacks=2|10|game mode = pvp}}{{skill fact|might|stacks=3|8|game
      // mode = wvw}}` — the old `wvw-fact-overrides.json` entry (`{Might: 8}`) replaced the FIRST
      // raw fact's (pve, 15/2) duration with 8 but kept its apply_count of 2, showing "8s, 2
      // stacks" instead of the real wvw "8s, 3 stacks". `Might@8@3` (the wvw fact itself) needs no
      // entry, already correct as-is.
      'Might@15@2': 'omit', // pve (15s/2 stacks)
      'Might@10@2': 'omit' // pvp (10s/2 stacks)
    },
    2052: {
      // Kinetic Accelerators (Scrapper). Wiki (`split = pve, wvw, pvp`): `{{skill fact|might|10|
      // stacks=3|game mode = pve}}{{skill fact|might|5|stacks=2|game mode = wvw}}{{skill
      // fact|might|8|stacks=3|game mode = pvp}}` — the old `wvw-fact-overrides.json` entry
      // (`{Might: 5}`) replaced the FIRST raw fact's (pve, 10/3) duration with 5 but kept its
      // apply_count of 3, showing "5s, 3 stacks" instead of the real wvw "5s, 2 stacks".
      // `Might@5@2` (the wvw fact itself) needs no entry, already correct as-is.
      'Might@10@3': 'omit', // pve (10s/3 stacks)
      'Might@8@3': 'omit' // pvp (8s/3 stacks)
    },
    2064: {
      // Photonic Blasting Module (Holosmith). Wiki (`split = pve, wvw, pvp`): `{{skill
      // fact|burning|6|stacks=7|game mode = pve}}{{skill fact|burning|2|stacks=2|game mode = pvp
      // wvw}}` — the old `wvw-fact-overrides.json` entry (`{Burning: 2}`) replaced the FIRST raw
      // fact's (pve, 6/7) duration with 2 but kept its apply_count of 7, showing "2s, 7 stacks"
      // instead of the real wvw+pvp "2s, 2 stacks". `Burning@2@2` (the wvw+pvp fact itself) needs
      // no entry, already correct as-is.
      'Burning@6@7': 'omit' // pve (6s/7 stacks)
    },
    2387: {
      // New Genes (Amalgam). Wiki (`split = pve, wvw pvp`): `{{skill fact|Might|12|stacks=4|game
      // mode = pve}}{{skill fact|Might|6|stacks=3|game mode = pvp wvw}}` — same duration+apply_count
      // shape as the 3 entries above; previously assumed unfixable (same "`WvwFactOverride` can't
      // express `apply_count` changes" limitation documented on the Warrior/Necromancer legs'
      // Eviscerate/Falling Spider/Brutal Shot), but the wvw+pvp tuple already exists as its own
      // distinct raw fact here too, so the same omit-the-other-occurrence trick applies. Worth
      // rechecking those older "left open" cases with this trick on a future pass — not attempted
      // here, out of this leg's scope. `Might@6@3` (the wvw+pvp fact itself) needs no entry,
      // already correct as-is.
      'Might@12@4': 'omit' // pve (12s/4 stacks)
    },

    // Ranger leg (5th leg of the "remaining 8 professions" main WvW-duplicate sweep, TODO.md,
    // 2026-08-20) — 2 more latent bugs of the exact same shape found in ALREADY-curated
    // `wvw-fact-overrides.json` entries predating this leg (Blood Moon id 1935, Let Loose id 2271),
    // plus 2 newly-discovered cases this leg (Eclipse id 2055, Cloudburst id 2425).
    1935: {
      // Blood Moon (Druid). Wiki (`split = pve, wvw pvp`): `{{skill fact|bleeding|4|stacks=2|game
      // mode=pve}}{{skill fact|bleeding|8|game mode=wvw pvp}}` — the old `wvw-fact-overrides.json`
      // entry (`{Bleeding: 8}`) replaced the FIRST raw fact's (pve, 4/2) duration with 8 but kept
      // its apply_count of 2, showing "8s, 2 stacks" instead of the real wvw+pvp "8s, 1 stack".
      // `Bleeding@8@1` (the wvw+pvp fact itself) needs no entry, already correct as-is.
      'Bleeding@4@2': 'omit' // pve (4s/2 stacks)
    },
    2055: {
      // Eclipse (Druid). Wiki (`split = pve, wvw pvp`): `{{skill fact|Poison|8|linked skill=Seed of
      // Life|game mode=pve}}{{skill fact|Poison|4|linked skill=Seed of Life|game mode=wvw pvp}}` —
      // the live API's own raw facts carry apply_count 3 (pve) and 1 (wvw+pvp) for this pair despite
      // the wiki not mentioning stacks at all, the same duration+apply_count shape as the other
      // entries in this table. `Poisoned@4@1` (the wvw+pvp fact itself) needs no entry, already
      // correct as-is. (Its Immobile/Burning pairs share the same duration split but matching
      // apply_count both modes, 1/1, so those 2 are plain `wvw-fact-overrides.json` entries instead
      // — see that file's own trait-2055 entry.)
      'Poisoned@8@3': 'omit' // pve (8s/3 stacks)
    },
    2271: {
      // Let Loose (Untamed). Wiki (`split = pve, wvw pvp`): `{{skill fact|Might|10|stacks=5|game
      // mode=pve}}{{skill fact|Might|8|stacks=3|game mode=wvw pvp}}` — the old
      // `wvw-fact-overrides.json` entry (`{Might: 8}`) replaced the FIRST raw fact's (pve, 10/5)
      // duration with 8 but kept its apply_count of 5, showing "8s, 5 stacks" instead of the real
      // wvw+pvp "8s, 3 stacks". `Might@8@3` (the wvw+pvp fact itself) needs no entry, already
      // correct as-is. (Its sole Quickness fact stays `wvw-fact-overrides.json`'s pre-existing
      // `'omit'` — the wiki only ever documents a pve value for it, no wvw/pvp value exists in the
      // API at all to pick, same "documented but absent" shape as other loose ends in this file.)
      'Might@10@5': 'omit' // pve (10s/5 stacks)
    },
    2425: {
      // Cloudburst (Galeshot). Wiki (`split = pve, wvw pvp`): under its Hawkeye linked-skill prefix,
      // `{{skill fact|quickness|8|linked skill=Hawkeye|game mode=pve}}{{skill
      // fact|quickness|3|linked skill=Hawkeye|game mode=pvp}}` (wvw shares pvp's value per the
      // trait's own `split` field) — a genuine same-status mode-split, both occurrences apply_count
      // 1, so no `apply_count` bug risk; still needs the occurrence-indexed form (not a plain
      // `wvw-fact-overrides.json` entry) because this trait ALSO has a 3rd, genuinely different
      // Quickness application under its separate Bluster prefix (duration 4, its own real pve
      // grant) that a per-status override would incorrectly collapse into this pair. `Quickness@3@1`
      // (Hawkeye's wvw+pvp fact) needs no entry, already correct as-is. Cloudburst also has 2 real
      // boon-type-swap gaps this table can't express, documented in `fact-numbers.ts`'s own
      // Ranger-leg intro comment: Bluster's Quickness+Might swap entirely to Swiftness+Fury in
      // wvw+pvp, and Hawkeye's Might swaps entirely to Fury — same shape as Guardian's Phoenix
      // Protocol/Engineer's Mech Frame: Channeling Conduits.
      'Quickness@8@1': 'omit' // Hawkeye pve (8s)
    },

    // Thief leg (6th leg of the "remaining 8 professions" main WvW-duplicate sweep, TODO.md,
    // 2026-08-20) — 2 latent bugs found in ALREADY-curated `wvw-fact-overrides.json` entries
    // predating this leg (Thrill of the Crime id 1163, Bountiful Theft id 1277), same "plain
    // per-status override only replaces duration, not apply_count" shape as every prior leg's
    // findings, plus 1 brand-new same-shape gap (Serpent's Touch id 1279) and 1 fully-entangled
    // multi-boon trait (Possessive Hoarder id 2393) the 2026-08-14 buff-instance-label sweep had
    // explicitly deferred as "too entangled to safely map," now resolved with the raw wikitext
    // in hand.
    1163: {
      // Thrill of the Crime (Trickery). Wiki (`split = pve, wvw pvp`): `{{skill fact|might|10|
      // stacks=5|game mode = pve}}{{skill fact|might|6|stacks=3|game mode = pvp wvw}}` — the old
      // `wvw-fact-overrides.json` entry (`{Might: 6}`) replaced the FIRST raw fact's (pve, 10/5)
      // duration with 6 but kept its apply_count of 5, showing "6s, 5 stacks" instead of the real
      // wvw+pvp "6s, 3 stacks". `Might@6@3` (the wvw+pvp fact itself) needs no entry, already
      // correct as-is. Its Fury pair (unsplit duration, 10 both modes) stays a plain
      // `wvw-fact-overrides.json` entry, unaffected by this fix.
      'Might@10@5': 'omit' // pve (10s/5 stacks)
    },
    1277: {
      // Bountiful Theft (Trickery). Wiki (`split = pve, wvw pvp`): `{{skill fact|might|10|
      // stacks=5|game mode = pve}}{{skill fact|might|10|stacks=1|game mode = pvp wvw}}` — same
      // duration (10) both modes, only the stack count differs, so the old `wvw-fact-overrides.
      // json` entry (`{Might: 10}`) looked like a no-op duration replacement but still carried the
      // bug: it kept the FIRST occurrence's own apply_count (5, pve) instead of the real wvw+pvp
      // "10s, 1 stack" — same underlying shape as Leeching Venoms' documented Spider Venom gap
      // above (duration-unchanged, apply_count-only split), except Might IS a recognized boon so
      // this one's actually fixable. `Might@10@1` (the wvw+pvp fact itself) needs no entry,
      // already correct as-is. Its separate "Boons Stolen" Number fact (3 pve/2 wvw+pvp) is
      // curated in `NUMERIC_FACT_WVW_OVERRIDES` instead.
      'Might@10@5': 'omit' // pve (10s/5 stacks)
    },
    1279: {
      // Serpent's Touch (Deadly Arts). The 2026-08-14 buff-instance-label sweep already labeled
      // this trait's 3rd Poisoned occurrence ("Poison When Downed", `Poisoned@2@1`) but left the
      // OTHER 2 raw Poisoned facts alone as "already distinguishable by their own stack-count
      // numbers" — true for display, but nothing was ever added to drop the non-WvW one, so both
      // showed simultaneously. Wiki (`split = pve wvw, pvp`): `{{skill fact|poisoned|10|stacks=2|
      // game mode =pve}}{{skill fact|poisoned|10|game mode =pvp}}` — pve+wvw share the pve-tagged
      // value (10s/2 stacks per the page's own split declaration), pvp alone drops to 10s/1 stack.
      // A plain `wvw-fact-overrides.json` entry would be unsafe here (all 3 Poisoned facts share
      // one status; the "only emit the first occurrence of an overridden status" collapse would
      // wrongly swallow the genuinely-different "Poison When Downed" fact too) — occurrence-
      // indexed omit instead. `Poisoned@10@2` (the pve/wvw fact itself) needs no entry, already
      // correct as-is; its own `traitedFacts` 2nd pair (gated on Potent Poison, id 1291) is the
      // same cross-trait-interaction shape left alone on every prior leg (Serene Rejuvenation
      // etc.), not touched here.
      'Poisoned@10@1': 'omit' // pvp-only (10s/1 stack)
    },
    2393: {
      // Possessive Hoarder (Antiquary). The 2026-08-14 buff-instance-label sweep found this
      // trait's Might/Alacrity/Protection/Regeneration/Fury facts "too entangled to safely map
      // onto this leg's local raw fact order" and deliberately left it uncurated. Full raw
      // wikitext (`action=raw`, 2026-08-20) resolves it cleanly (`split = pve, wvw, pvp`):
      // offensive artifacts grant `{{skill fact|Might|12|stacks=10|game mode=pve}}` +
      // `{{skill fact|Fury|6|game mode=wvw}}{{skill fact|Might|6|stacks=4|game mode=pvp}}` +
      // `{{skill fact|Alacrity|5|game mode=pve}}{{skill fact|Protection|3|game mode=wvw}}
      // {{skill fact|Fury|6|game mode=pvp}}` + `{{skill fact|Alacrity|5|game mode=pve}}
      // {{skill fact|Might|6|stacks=8|game mode=wvw}}{{skill fact|Regeneration|6|game
      // mode=pvp}}`; defensive artifacts grant `{{skill fact|Protection|5|game mode=pve}}
      // {{skill fact|Regeneration|8|game mode=wvw}}{{skill fact|Protection|3|game mode=pvp}}`.
      // Untangled by status: Might is a genuine 3-way split (12/10 pve, 6/4 pvp, 6/8 wvw) — the
      // old `wvw-fact-overrides.json` entry (`{Might: 6}`) had the same "kept the first
      // occurrence's own apply_count" bug as Thrill of the Crime/Bountiful Theft above (showed
      // "6s, 10 stacks" instead of the real wvw "6s, 8 stacks"), fixed here the same way. Fury (6,
      // unsplit across wvw/pvp) and Protection (5 pve/3 wvw+pvp, unsplit apply_count both) need no
      // instance-level fix, already correct via `factLine`'s natural single-occurrence collapse /
      // the existing plain `Protection: 3` override respectively. Alacrity is PvE-only — BOTH raw
      // Alacrity facts (5/1, from the offensive AND defensive artifact triggers) are pve-tagged
      // with no wvw/pvp variant at all — now dropped via a plain `Alacrity: 'omit'` entry in
      // `wvw-fact-overrides.json` (safe since no other Alacrity concept exists on this trait to
      // wrongly swallow). Regeneration (6 pvp/8 wvw) was missing an override entirely before this
      // leg — both facts showed simultaneously — now fixed via a plain `Regeneration: 8` entry
      // (safe, both occurrences share apply_count 1, no bug risk). `Might@6@8` (the wvw fact
      // itself) needs no entry, already correct as-is.
      'Might@12@10': 'omit', // pve (12s/10 stacks)
      'Might@6@4': 'omit' // pvp (6s/4 stacks)
    },

    // Elementalist leg (7th leg of the "remaining 8 professions" main WvW-duplicate sweep, TODO.md,
    // 2026-08-20) — 2 latent apply_count bugs found in ALREADY-curated Elementalist overrides
    // predating this leg (Electric Discharge id 222, Burning Rage id 325), same "plain per-status
    // override only replaces duration, not apply_count" shape as every prior leg's findings.
    222: {
      // Electric Discharge (Air). Wiki (`split = pve, wvw pvp`): `{{skill fact|vulnerability|8|
      // game mode = pve}}{{skill fact|vulnerability|6|stacks=8|game mode=wvw pvp}}` — the old
      // `wvw-fact-overrides.json` entry (`{Vulnerability: 6}`) replaced the FIRST raw fact's (pve,
      // 8s/1 stack) duration with 6 but kept its apply_count of 1, showing "6s, 1 stack" instead of
      // the real wvw+pvp "6s, 8 stacks". `Vulnerability@6@8` (the wvw+pvp fact itself) needs no
      // entry, already correct as-is.
      'Vulnerability@8@1': 'omit' // pve (8s/1 stack)
    },
    325: {
      // Burning Rage (Fire). Wiki (`split = pve, wvw pvp`): `{{skill fact|Burning|4|stacks=2|game
      // mode = pve}}{{skill fact|Burning|4|game mode = pvp wvw}}` — same duration (4) both modes,
      // only the stack count differs (2 pve / 1 wvw+pvp), so the old `wvw-fact-overrides.json`
      // entry (`{Burning: 4}`) looked like a no-op duration replacement but still carried the bug:
      // it kept the FIRST occurrence's own apply_count (2, pve) instead of the real wvw+pvp "4s, 1
      // stack" — same underlying shape as Bountiful Theft's Might (Thief leg). `Burning@4@1` (the
      // wvw+pvp fact itself) needs no entry, already correct as-is.
      'Burning@4@2': 'omit' // pve (4s/2 stacks)
    },

    // Necromancer leg (8th and final leg of the "remaining 8 professions" main WvW-duplicate sweep,
    // TODO.md, 2026-08-20) — 1 latent apply_count bug found in an ALREADY-curated Necromancer
    // override predating this leg (Implacable Foe id 2192), same "plain per-status override only
    // replaces duration, not apply_count" shape as every prior leg's findings, plus 1 new same-shape
    // source found fresh this leg (Empowering Spirits id 2405). Dark Disciple (2183) and Doom
    // Approaches (2203) each have this exact same shape on their own "Blight" grant (pve/wvw+pvp
    // stack-count-only splits, 25s/2-vs-1 stacks and 25s/4-vs-3 stacks respectively) but "Blight"
    // itself isn't in `BOON_NAMES`/`CONDITION_NAMES` at all — `classifyBoonCondition` gates every
    // Blight fact out before any override table (this one included) is ever consulted, so an entry
    // here would be dead code, same "custom effect-status the boon/condition pipeline structurally
    // can't see" shape as Ranger's Natural Balance/Elementalist's Galvanic Enchantment/Conduit's
    // Bolstered Bonds — left undocumented in code, just here.
    2192: {
      // Implacable Foe (Harbinger, Master major). Wiki (`split = pve, wvw pvp`): `{{skill
      // fact|Stability|stacks=3|5|game mode=pve}}{{skill fact|Stability|3|game mode=wvw pvp}}` — the
      // old `wvw-fact-overrides.json` entry (`{Stability: 3}`) replaced the FIRST raw fact's (pve,
      // 5s/3 stacks) duration with 3 but kept its apply_count of 3, showing "3s, 3 stacks" instead of
      // the real wvw+pvp "3s, 1 stack". `Stability@3@1` (the wvw+pvp fact itself) needs no entry,
      // already correct as-is.
      'Stability@5@3': 'omit' // pve (5s/3 stacks)
    },
    // Doom Approaches (Harbinger, Grandmaster major, id 2203) has 2 wiki-confirmed splits — a
    // "Blight" stack-count-only pair (`stacks=4` pve / `stacks=3` wvw+pvp, 25s both) that hits the
    // same "Blight" isn't-a-recognized-status dead-code shape as Dark Disciple's own Blight grant
    // above, and a "Boons Converted to Conditions" pair (linked skill=Devouring Cut, pve pvp=2/
    // wvw=1) whose own `status` string isn't a recognized boon/condition name either, same
    // "custom effect-status the pipeline structurally can't see" shape as Ranger's Natural
    // Balance/Conduit's Bolstered Bonds — neither is fixable here, no entry added for either.
    2405: {
      // Empowering Spirits (Ritualist, Grandmaster major): "Anguish, Wanderlust, and Preservation's
      // effects are improved." Wiki (`split = pve, wvw pvp`): Anguish's Might grant is
      // `{{skill fact|might|10|stacks=8|linked skill=Anguish|game mode=pve}}{{skill
      // fact|might|8|stacks=3|linked skill=Anguish|game mode=wvw pvp}}` — same duration+apply_count
      // shape as the entries above. This trait's separate Quickness/Vigor pair
      // (`{{skill fact|quickness|3.75|game mode=pve}}{{skill fact|vigor|2|game mode=wvw
      // pvp}}`) is a genuine boon-TYPE swap (pve grants Quickness, wvw+pvp swaps to Vigor entirely)
      // — unlike Guardian's Phoenix Protocol/Ranger's Cloudburst, this one IS cleanly resolvable
      // since neither Quickness nor Vigor has any internal ambiguity of its own (each is a single,
      // unsplit raw fact): Quickness is omitted via `wvw-fact-overrides.json` (a WvW-focused app
      // should never show a pve-only boon grant), and Vigor needs no entry at all since it's already
      // the only occurrence. Wanderlust's Fury (`{{skill fact|fury|5|25|...}}` / `{{skill
      // fact|fury|5|20|...}}`) and Preservation's Resolution are single, unambiguous raw facts as-is
      // (Fury's 2nd numeric wiki param, 25/20, doesn't map to any exposed `Fact` field — an
      // embedded-sub-value gap, out of scope). `Might@8@3` (the wvw+pvp fact itself) needs no entry,
      // already correct as-is.
      'Might@10@8': 'omit' // pve (10s/8 stacks)
    }
  }
}

/** Resolves `BUFF_INSTANCE_VALUE_OVERRIDES` for one buff fact — mirrors `resolveInstanceLabel`'s
 *  lookup exactly (bare key when the tuple is unique, `#<occurrence>`-suffixed key otherwise). */
function resolveInstanceValueOverride(
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  status: string,
  duration: number,
  applyCount: number,
  tupleOccurrence: number,
  tupleTotal: number
): WvwInstanceOverride | undefined {
  const table = BUFF_INSTANCE_VALUE_OVERRIDES[sourceKind][sourceId]
  if (!table) return undefined
  const baseKey = buffInstanceKey(status, duration, applyCount)
  if (tupleTotal > 1) {
    const suffixedKey = `${baseKey}#${tupleOccurrence}`
    if (suffixedKey in table) return table[suffixedKey]
  }
  return table[baseKey]
}

function resolveTriggerNote(sourceKind: 'skill' | 'trait', sourceId: number): string | undefined {
  return DODGE_TRIGGER_NOTES[sourceKind][sourceId]
}

/** `${status}@${duration}@${applyCount}` — see `BUFF_INSTANCE_LABELS`'s doc comment for why this
 *  tuple (not a bare status) is the lookup key, and when the `#<occurrence>` suffix applies. */
function buffInstanceKey(status: string, duration: number, applyCount: number): string {
  return `${status}@${duration}@${applyCount}`
}

/** Resolves `BoonConditionSource.instanceLabel` for one buff fact via `BUFF_INSTANCE_LABELS`.
 *  `tupleOccurrence`/`tupleTotal` are this fact's 1-based position among every fact on the SAME
 *  source sharing its exact status/duration/apply_count tuple, and how many such facts exist —
 *  computed by `extractFromFacts` from the same `combinedFacts` list it already walks, since the
 *  suffix only matters when a tuple isn't unique (see `BUFF_INSTANCE_LABELS`'s doc comment). */
function resolveInstanceLabel(
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  status: string,
  duration: number,
  applyCount: number,
  tupleOccurrence: number,
  tupleTotal: number
): string | undefined {
  const table = BUFF_INSTANCE_LABELS[sourceKind][sourceId]
  if (!table) return undefined
  const baseKey = buffInstanceKey(status, duration, applyCount)
  if (tupleTotal > 1) {
    const suffixedKey = `${baseKey}#${tupleOccurrence}`
    if (suffixedKey in table) return table[suffixedKey]
  }
  return table[baseKey]
}

/** `resolveTargetCountFrom` against `TARGET_COUNT_OVERRIDES` specifically — the boon/condition
 *  case every existing caller uses. */
function resolveTargetCount(
  fact: Fact,
  combinedFacts: Fact[],
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  activeTraitIdSet: Set<number>,
  equippedLegendIdSet: Set<string>
): ResolvedTargetCount {
  return resolveTargetCountFrom(fact, combinedFacts, sourceKind, sourceId, TARGET_COUNT_OVERRIDES, activeTraitIdSet, equippedLegendIdSet)
}

/**
 * Curated self-vs-party classification for TODO.md's Condition Cleanse item (folding a "Conditions
 * Removed"-family `Number` fact into the Strip/Corrupt row, relabeled "Strips / Corrupts /
 * Cleanses") — a bare `Conditions Removed` fact never itself says WHO gets cleansed, same ambiguity
 * `TARGET_COUNT_OVERRIDES` above resolves for boons, so this reuses that table's exact shape
 * (`TargetCountOverride`, `skill`/`trait` split) and default-5 convention rather than inventing a
 * new one. Wired into the Strip/Corrupt row's `Cleanse` matcher via `NAMED_FACT_TARGET_COUNT_TABLES`
 * (see `BOON_STRIP_CORRUPT_MATCHERS` below) — `NamedFactSource.targetCount` resolves through
 * `resolveTargetCountFrom` the same way `BoonConditionSource.targetCount` resolves through
 * `TARGET_COUNT_OVERRIDES`.
 *
 * Built 2026-08-08 from `scripts/fetch-condition-cleanse.ts`'s first-draft classifier output (235
 * candidates: 193 skill, 42 trait) plus a manual review pass, NOT a straight copy of that script's
 * verdicts — several corrections came out of the review:
 *  - The script's `classifyDescription` treats any of "allies/ally/party/squad/**nearby**" as
 *    ally-evidence. That's wrong when "nearby" modifies "foes," not "allies" (e.g. "Cure conditions
 *    and damage **nearby foes**" has zero ally wording but still flagged PARTY) — caught by hand on
 *    every one of the script's own PARTY-NO-COUNT entries, corrected below (Smite Condition, The
 *    Prestige, Flames of War, Cleansing Typhoon, Hungering Darkness are the 5 flipped to self).
 *  - `requires_trait`-gated cleanse facts (the script's own TRAIT-GATED bucket, 75 raw skill ids)
 *    are resolved here straight from each candidate's own `facts`/`traitedFacts` in local
 *    `skills.json` (which trait id actually gates it) rather than from a wiki lookup on the base
 *    skill's own page — the base page's description is exactly the signal the script itself flags
 *    as untrustworthy for these (a shatter skill's own page says nothing about conditions; the
 *    GRANTING trait's page is the real source of truth). This local grouping happened to also
 *    resolve most of the script's own 30-entry UNRESOLVED COLLISION bucket for free: 18 of those are
 *    just other adrenaline-tier/PvP-split ids of the same Cleansing-Ire-gated Warrior burst skills
 *    already covered by the trait grouping, 3 more are Restorative-Illusions-gated Mesmer
 *    shatter-skill split ids, and the remaining 4 are same-name sibling ids of an already-classified
 *    base skill (Purging Flames/Null Field/Tree Song/Buoyant Deluge split ids) — same
 *    sibling-id-attribution tier `fetch-skill-coefficients.ts`/`fetch-target-counts.ts` already use.
 *  - Where a `requires_trait`-gated cleanse fact's granting trait ALSO carries an ordinary
 *    (non-cleanse) tracked boon this app already curated a `targetCount` for in
 *    `TARGET_COUNT_OVERRIDES` above, that existing curation is trusted as corroboration rather than
 *    re-derived from scratch (Hardening Persistence's own Envoy of Exuberance entry above is already
 *    party-wide(5); Core Value's own comment above already establishes it doesn't create a
 *    self/party conflict on True Nature) — consistent, not coincidental, since both tables describe
 *    the same trait's real in-game reach.
 *
 * Granting-trait groups (the 75-raw-id TRAIT-GATED bucket, now resolved to 8 real traits — smaller
 * than the ~11 the script's own raw-id count suggested, since 3 of those "distinct traits" turned
 * out to be the same handful once local `requires_trait` data replaced wiki-guessed groupings):
 *  - **Cleansing Ire** (Warrior, trait 1649): "Remove a condition when you hit with a burst skill,
 *    then remove an additional condition for every bar of adrenaline spent" — wiki-confirmed
 *    self-only, no allies wording at all. Gates 66 skill ids (every burst skill across every
 *    Warrior weapon, all its PvP/WvW-split/tier variants) — by far the largest single cluster,
 *    matching the TODO.md note this alone explains most of the original 75-id count.
 *  - **Restorative Illusions** (Mesmer, trait 1866): own description "Heal and cleanse conditions
 *    from yourself and nearby allies when you use a Shatter skill" — explicit party-wide, gates 23
 *    skill ids (every shatter skill/Virtuoso blade-consuming skill/Harmonic-instrument-family skill
 *    that destroys clones or consumes blades).
 *  - **Absolute Resolve** (Guardian, trait 610): own description "Activating Virtue skill 2 removes
 *    conditions from nearby allies" — explicit party-wide, no explicit count on its own page (same
 *    default-5 convention as the rest of this table). Gates Tome of Resolve's 4 ids cleanly (its
 *    only cleanse fact). Deliberately does NOT resolve Virtue of Resolve/Wings of Resolve below —
 *    see EXCLUDED.
 *  - **Transfusion** (Necromancer, trait 778): already characterized in `TARGET_COUNT_OVERRIDES`'
 *    own comments above (Chillblains/Reaper's Mark/Lesser Chilblains) as a "one ally per mark
 *    trigger" mechanic, NOT the usual up-to-5 pulse — reused verbatim here for Putrid Mark's own
 *    Transfusion-gated cleanse fact (`targetCount: 1`, not 5).
 *  - **Blurred Inscriptions** (Mesmer, trait 752): "Signets have improved active effects..." —
 *    wiki-confirmed self-only for the condition removal specifically ("removes conditions" with no
 *    allies wording, unlike its other per-signet effects). Gates Signet of Midnight's 1 id.
 *  - **Shrouded Removal** (Necromancer/Scourge, trait 1922 — itself already self-only in the table
 *    below): "Lose a condition when you enter shroud... Gain carapace when removing conditions from
 *    yourself" — explicit first-person, self-only. Gates Desert Shroud/Sandstorm Shroud's 2 ids.
 *  - **Hardening Persistence** (Revenant/Glint, trait 1730): own description doesn't itself say
 *    who's cleansed ("Shield skills remove conditions"), but both skills it gates (Crystal
 *    Hibernation, Envoy of Exuberance) are already-party-wide Glint shield support skills — Envoy of
 *    Exuberance's own Protection/Aegis is already curated party-wide(5) in `TARGET_COUNT_OVERRIDES`
 *    above, no self/party conflict — trusted as the same reach for the cleanse extension. Party-wide
 *    (5) for the trait's own entry and both gated skills.
 *  - **Core Value** (Ranger/Druid, trait 1806): only raises `apply_count` on True Nature's own
 *    already-party-wide (per its own description) cleanse — same "no conflict" shape
 *    `TARGET_COUNT_OVERRIDES`' own comment already documents for this exact trait/skill pair's
 *    Stability. No separate table entry needed (True Nature's own party-wide reading already covers
 *    it); noted here only so a future reviewer doesn't wonder why Core Value itself isn't listed.
 *  - **Meticulous Custodian** (Engineer, trait 2431): EXCLUDED, see below — genuinely ambiguous
 *    which of two different cleanse mechanics on Zephyrite Sun Crystal it gates.
 *
 * EXCLUDED (left uncurated, same "skip+log rather than guess" rule as every other sweep in this
 * codebase) — a source's own wiki description is either genuinely ambiguous, or mixes two different
 * reaches on the same source with no `requires_trait` (or other) split available:
 *  - Guardian's Virtue of Resolve (9120, 9250) and Willbender's Wings of Resolve (30083, 30225,
 *    30286, 30783): each carries BOTH an unconditioned self-only periodic cleanse (the virtue's own
 *    passive) AND an Absolute-Resolve-gated party-wide cleanse (activating virtue skill 2) — same
 *    "mixed self/party on one source" shape `TARGET_COUNT_OVERRIDES`' own top comment documents for
 *    Tome of Courage/Phoenix Protocol/Holy Reckoning, not resolvable with one value.
 *  - Specter's Grasping Shadows (63107, 63167): its OWN cleanse line ("cleanse conditions from
 *    yourself while healing and cleansing your tethered ally") is explicitly self + one specific
 *    tethered ally, NOT the party-wide "nearby allies and your tethered ally" reach its
 *    Shadestep-gated Alacrity/Regeneration (already curated party-wide(5) in `TARGET_COUNT_OVERRIDES`
 *    above) gets — a real self+1 shape neither `'self'` nor a flat party number fits cleanly.
 *  - Engineer's Zephyrite Sun Crystal (76733, 76895): its own description names two different
 *    cleanse mechanics ("removing conditions from allies around you" on landing, PLUS "whenever you
 *    use a weapon skill that costs initiative, remove conditions from yourself" afterward) and it's
 *    unclear which one the wiki's `Meticulous Custodian`-referencing "artifact" framing actually
 *    gates — genuinely ambiguous which fact the local `requires_trait` value binds to.
 *  - Revenant's Energy Expulsion (29114): already a documented Healing-sweep exception elsewhere in
 *    TODO.md (a live API pull returns a totally different fact set than the wiki's current
 *    description) — same unresolved API/wiki mismatch applies here, not re-litigated.
 *  - Guardian's Repose (62669): wiki page is tagged stub (also a documented Healing-sweep exception)
 *    — no reliable description to classify from.
 *  - Elementalist's Glyph of Elemental Power (34772, water variant): base description ("differs by
 *    attunement") doesn't itself describe the cleanse; unclear if it's self or party without a
 *    dedicated look at the water-specific sub-effect.
 *  - Mesmer's Abstraction (72076): "debilitating enemies and bolstering allies" doesn't say which of
 *    those two effects is the cleanse.
 *  - Engineer's Cleansing Burst (5980, Healing Turret overcharge): genuinely unclear from either the
 *    API facts or the wiki description whether the overcharge's own cleanse reaches allies the way
 *    the turret's passive water-field pulses do, or is caster-only.
 *  - Catalyst's Joy of Movement (trait 2402): "Squalls remove movement-impairing conditions and a
 *    damaging condition" doesn't say whether the jade sphere's squalls reach nearby allies (the way
 *    its other pulses do) or are self-only.
 *  - Ranger's trait 362 (Cleansing Water: "cleanse conditions from allies you grant regeneration
 *    to"), 472 (Anticorrosion Plating: "cleanse conditions from them" — singular "an ally," per
 *    Protection granted, not a flat pulse), Thief's 1293 (Shadow's Embrace: base self, extends to
 *    "stealth you grant to allies" conditionally), Warrior's 1667 (Martial Cadence: rides on
 *    Soldier's Focus's own reach), Scourge's 2167 (Abrasive Grit: "removes conditions afflicting
 *    them" per barrier granted, singular), Guardian's 2376 (Wielder's Boon: rides on "weapon
 *    spells'" own reach), Revenant's 2433 (Calming Tongue: rides on Chant of Recuperation's own
 *    reach) — 6 traits whose own cleanse explicitly rides on a DIFFERENT skill's/effect's reach
 *    rather than pulsing a fixed count of its own; the count is "however many that other effect
 *    already reaches," not a number this table can express without also modeling that other effect.
 *  - Elementalist's Diamond Skin (trait 1508): "Remove conditions from yourself when you...combo a
 *    field with a leap finisher. Remove conditions from nearby allies when you...combo...with a
 *    blast finisher" — self for one finisher type, party for another, same one-source-two-reaches
 *    shape as the Virtue of Resolve pair above.
 */
export const CONDITION_CLEANSE_TARGETS: { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> } = {
  skill: {
    // --- Self-only, explicit "from Self"/"yourself" wiki wording, no allies mention ---
    5965: 'self', // Fumigate
    9088: 'self', // Cleansing Flame
    10207: 'self', // Mantra of Resolve
    5507: 'self', // Ether Renewal
    5675: 'self', // Phoenix
    9158: 'self', // Signet of Resolve
    10176: 'self', // Ether Feast
    14401: 'self', // Mending
    27372: 'self', // Soothing Stone
    43845: 'self', // Cauterize
    62522: 'self', // Twin Blade Restoration
    63111: 'self', // Shift Signet
    72967: 'self', // Ripple
    77243: 'self', // Hex-Eater Vortex

    // --- Self-only, corrected from the classifier's own PARTY-NO-COUNT bucket: each description's
    // only "nearby"/"allies"-looking word actually modifies FOES, not allies (a real classifier
    // false-positive, caught by hand — see this table's own top doc comment). ---
    9245: 'self', // Smite Condition (Guardian focus). "Cure conditions and damage nearby foes" — the
    // cleanse is caster-only; "nearby" modifies foes.
    10285: 'self', // The Prestige (Thief). "...losing conditions" is first-person/self; "blinding
    // nearby foes" is the unrelated other half of the skill.
    29940: 'self', // Flames of War (Warrior). "Cleanse conditions and become a mobile fire field that
    // burns nearby foes" — self cleanse, foe-facing burn.
    62843: 'self', // Cleansing Typhoon. "Strike nearby foes, cleansing a condition for each target
    // struck" — self cleanse scaled by foes hit, not an ally pulse.

    // --- Self-only, no condition mention in the base description at all but confirmed self via a
    // targeted look (see this table's top doc comment's EXCLUDED section for the ones that stayed
    // genuinely unresolved instead). ---
    45449: 'self', // Jaunt (Thief). Shadowstep + lose a condition, self.
    71903: 'self', // Thistleguard (Ranger). "Envelop YOURSELF in thorns."
    77271: 'self', // Soothing Breeze (Ranger). "Heal...you and your pet" — self+pet, treated as self
    // (a pet is never one of this app's tracked party allies, same convention
    // `TARGET_COUNT_OVERRIDES` already uses elsewhere for pet-only boon grants).

    // --- Self-only, from the classifier's UNCLEAR bucket, resolved by hand (well-established
    // personal-signet/personal-utility shape, no allies wording anywhere on the page). ---
    5535: 'self', // Cleansing Fire (Elementalist torch)
    5865: 'self', // Utility Goggles (Engineer toolkit)
    29591: 'self', // Utility Goggles (split id)
    14479: 'self', // Signet of Stamina (Warrior)
    41937: 'self', // Death's Retreat (Thief)
    43701: 'self', // Photosynthesize (Ranger/Soulbeast)
    43745: 'self', // Sight beyond Sight (Ranger)
    44948: 'self', // Bear Stance (Ranger/Soulbeast). "Heal yourself and your pet" — self+pet, same
    // pet convention as Soothing Breeze above.
    62827: 'self', // Soothing Water (Elementalist/Weaver)
    73152: 'self', // Imaginary Inversion (Mesmer)

    // --- Cleansing Ire (trait 1649, Warrior — see this table's top doc comment): wiki-confirmed
    // self-only ("remove a condition when you hit with a burst skill..."). Every burst skill across
    // every Warrior weapon that carries a Cleansing-Ire-gated cleanse fact, including every
    // adrenaline-tier/PvP-WvW-split id (the local `requires_trait` grouping this table uses resolves
    // these directly, without needing each split id's own wiki page — see top doc comment). ---
    14422: 'self', // Eviscerate
    14423: 'self', // Eviscerate
    14424: 'self', // Eviscerate
    43566: 'self', // Eviscerate (split id)
    14425: 'self', // Skull Crack
    14426: 'self', // Skull Crack
    14427: 'self', // Skull Crack
    41110: 'self', // Skull Crack (split id)
    14469: 'self', // Forceful Shot
    14470: 'self', // Forceful Shot
    14471: 'self', // Forceful Shot
    41330: 'self', // Forceful Shot (split id)
    14473: 'self', // Kill Shot
    14474: 'self', // Kill Shot
    14475: 'self', // Kill Shot
    42041: 'self', // Kill Shot (split id)
    14512: 'self', // Earthshaker
    14513: 'self', // Earthshaker
    14514: 'self', // Earthshaker
    40601: 'self', // Earthshaker (split id)
    14520: 'self', // Combustive Shot
    14521: 'self', // Combustive Shot
    14522: 'self', // Combustive Shot
    42803: 'self', // Combustive Shot (split id)
    14545: 'self', // Arcing Slice
    14546: 'self', // Arcing Slice
    14547: 'self', // Arcing Slice
    42707: 'self', // Arcing Slice (split id)
    14549: 'self', // Whirling Strike
    14550: 'self', // Whirling Strike
    14551: 'self', // Whirling Strike
    41746: 'self', // Whirling Strike (split id)
    29644: 'self', // Gun Flame
    29679: 'self', // Skull Grinder
    39972: 'self', // Silencer
    41283: 'self', // Boon Crusher
    41543: 'self', // Wounding Strike
    43488: 'self', // Fleeting Stability
    44397: 'self', // Dissonance
    46044: 'self', // Magehunter Strike
    29852: 'self', // Arc Divider
    29923: 'self', // Scorched Earth
    30682: 'self', // Flaming Flurry
    30851: 'self', // Decapitate
    30879: 'self', // Rupturing Smash
    30989: 'self', // Burning Shackles
    31048: 'self', // Wild Whirl
    44165: 'self', // Full Counter
    45252: 'self', // Breaching Strike
    69245: 'self', // Breaching Strike (split id)
    69297: 'self', // Breaching Strike (split id)
    69392: 'self', // Breaching Strike (split id)
    69433: 'self', // Breaching Strike (split id)
    69290: 'self', // Slicing Maelstrom
    71875: 'self', // Rampart Splitter
    71922: 'self', // Path to Victory
    71932: 'self', // Path to Victory
    71950: 'self', // Path to Victory
    72029: 'self', // Path to Victory
    72089: 'self', // Path to Victory
    72911: 'self', // Harrier's Toss
    73006: 'self', // Harrier's Toss
    73014: 'self', // Harrier's Toss
    73024: 'self', // Harrier's Toss
    73042: 'self', // Harrier's Toss
    73103: 'self', // Wild Throw

    // --- Blurred Inscriptions (trait 752, Mesmer): wiki-confirmed self-only. ---
    10234: 'self', // Signet of Midnight

    // --- Shrouded Removal (trait 1922, Necromancer/Scourge — itself already self-only below): both
    // gated skills inherit the trait's own self-only reach. ---
    44663: 'self', // Desert Shroud
    54870: 'self', // Sandstorm Shroud

    // --- Party-wide(5), directly wiki-parsed `allied targets`/`targets` count (the script's own
    // HIGH-CONFIDENCE PARTY bucket — an actual wiki fact, not this table's own default). ---
    9112: 5, // Ray of Judgment
    42864: 5, // Opening Passage
    44626: 5, // Spiritual Reprieve
    55046: 5, // Glyph of the Stars
    73094: 5, // Solar Storm
    76811: 5, // Buoyant Deluge
    76935: 5, // Buoyant Deluge (split id, sibling-attributed)

    // --- Party-wide(5), explicit "allies" wording in the base description but no dedicated wiki
    // count template — same default-5 "nearby allies" pulse convention `TARGET_COUNT_OVERRIDES`
    // above already establishes and documents. ---
    5551: 5, // Healing Rain
    5558: 5, // Cleansing Wave
    5570: 5, // Signet of Water
    9187: 5, // Purging Flames
    31159: 5, // Purging Flames (split id, sibling-attributed)
    9207: 5, // Purify
    9234: 5, // Purifying Blast
    10203: 5, // Null Field
    50440: 5, // Null Field (split id, sibling-attributed)
    10209: 5, // Power Cleanse
    12489: 5, // Healing Spring
    12600: 5, // Cold Snap
    13062: 5, // Signet of Agility
    14372: 5, // "Shake It Off!"
    14394: 5, // Call of Valor
    25492: 5, // Crashing Waves
    29197: 5, // Purifying Essence
    29321: 5, // Renewing Wave
    29535: 5, // "Wash the Pain Away!"
    29739: 5, // Purge Gyro
    30305: 5, // Well of Eternity
    31348: 5, // Glyph of Alignment
    31406: 5, // Seed of Life
    32242: 5, // Seed of Life (underwater id)
    49045: 5, // Cleansing Field
    51696: 5, // True Nature (dragon)
    51713: 5, // True Nature (centaur). Core Value (trait 1806) only raises its apply_count, same
    // no-conflict shape as its Stability in `TARGET_COUNT_OVERRIDES` above — see top doc comment.
    62941: 5, // Tree Song
    62793: 5, // Tree Song (split id, sibling-attributed)
    71882: 5, // Essence of Living Shadows
    76563: 5, // Otter's Compassion
    76621: 5, // Resolute Stance
    76755: 5, // "We Shall Return!"
    77136: 5, // Restorative Glow
    5937: 5, // Super Elixir
    6102: 5, // Super Elixir (underwater id)
    29415: 5, // Overload Water
    29716: 5, // Med Pack Drop. Own API "Number of Allied Targets: 5" fact — not actually a default,
    // an already-known count (see TODO.md's Condition Cleanse item history).
    30588: 5, // Med Pack Drop (underwater id)
    31401: 5, // Glyph of Equality (Celestial Avatar)
    77022: 5, // Weapon of Remedy (Revenant). "Grant this to nearby allies for a reduced duration."

    // --- Restorative Illusions (trait 1866, Mesmer — see this table's top doc comment):
    // wiki-confirmed party-wide, no dedicated count -> default 5. Every shatter/blade-consuming/
    // instrument-family skill it gates, including its own split ids resolved via local
    // `requires_trait` grouping (see top doc comment). ---
    10190: 5, // Cry of Frustration
    10191: 5, // Mind Wrack
    49068: 5, // Mind Wrack (split id)
    10192: 5, // Distortion
    10287: 5, // Diversion
    29830: 5, // Continuum Split
    56873: 5, // Time Sink
    56925: 5, // Split Second (split id)
    56930: 5, // Split Second
    56928: 5, // Rewinder
    62586: 5, // Bladesong Harmony (split id)
    62597: 5, // Bladeturn Requiem
    62602: 5, // Bladesong Dissonance
    62616: 5, // Bladesong Sorrow
    62617: 5, // Bladesong Harmony
    68273: 5, // Bladesong Distortion
    76552: 5, // Lively Lute
    77306: 5, // Lively Lute (split id)
    76746: 5, // Flustering Flute
    76931: 5, // Crescendo
    76960: 5, // Harmonious Harp
    77077: 5, // Harmonious Harp
    77079: 5, // Deafening Drum

    // --- Absolute Resolve (trait 610, Guardian — see this table's top doc comment): its only
    // unconditioned-on-Virtue-of-Resolve gate, Tome of Resolve, all 4 ids. ---
    41780: 5, // Tome of Resolve
    45023: 5, // Tome of Resolve (split id)
    68648: 5, // Tome of Resolve (split id)
    68649: 5, // Tome of Resolve (split id)

    // --- Hardening Persistence (trait 1730, Revenant/Glint — see this table's top doc comment):
    // party-wide via corroborating already-curated Envoy of Exuberance boon reach. ---
    28262: 5, // Crystal Hibernation
    29386: 5, // Envoy of Exuberance

    // --- Transfusion (trait 778, Necromancer): the established "one ally per mark trigger"
    // mechanic (see `TARGET_COUNT_OVERRIDES`' own comments on Chillblains/Reaper's Mark/Lesser
    // Chilblains above) — party, but count 1, not the usual default 5. ---
    19116: 1 // Putrid Mark
  },
  trait: {
    // --- Self-only, explicit first-person "yourself"/"you" wiki wording, no allies mention. ---
    413: 'self', // Compounding Chemicals
    1054: 'self', // Evasive Purity
    1100: 'self', // Empathic Bond. "Remove conditions when you swap pets" — the pet is the trigger,
    // not the target; the cleanse itself is first-person/self.
    1237: 'self', // Pain Response
    1703: 'self', // Don't Stop
    1709: 'self', // Brawler's Recovery
    1876: 'self', // Blood Renewal
    1922: 'self', // Shrouded Removal
    1960: 'self', // Wandering Mind
    2023: 'self', // Escapist's Fortitude
    2090: 'self', // Woven Stride
    2113: 'self', // Elusive Mind
    2168: 'self', // Resolute Counter
    2423: 'self', // Card Swap
    2287: 'self', // Cleansing Unleash (Ranger/Untamed). "Remove conditions when you or your pet
    // unleash" — pet only names the trigger, same convention as Empathic Bond above.

    // --- Self-only, corrected: classifier read the word "ally" inside "tethered ally" as
    // ally-evidence, but this trait's own cleanse line names only "yourself." ---
    2300: 'self', // Hungering Darkness (Necromancer/Harbinger). "...cleanse conditions from
    // yourself" — the "your tethered ally" wording elsewhere in the description is a DIFFERENT
    // mechanic (transferring conditions TO the tethered ally), not who gets cleansed.

    // --- Self-only, from the classifier's UNCLEAR bucket, resolved by hand (well-established
    // personal-trait shape, no allies wording anywhere on the page). ---
    588: 'self', // Strength of the Fallen
    1286: 'self', // Trickster (Thief)
    1699: 'self', // Wilderness Knowledge (Ranger)
    1732: 'self', // Cleansing Channel (Revenant)
    1908: 'self', // Hunter's Fortification (Ranger)
    1872: 'self', // Mechanized Deployment (Engineer/Mechanist). "Tool belt skills remove
    // conditions" — tool belt skills are a personal (non-shareable) mechanic.
    2416: 'self', // Ethereal Purification (Mesmer/Virtuoso)

    // --- Party-wide(5), directly wiki-parsed `allied targets` count. ---
    1868: 5, // Druidic Clarity
    2299: 5, // Shallow Grave

    // --- Party-wide(5), explicit "allies" wording, no dedicated wiki count -> default 5. ---
    358: 5, // Cleansing Wave
    610: 5, // Absolute Resolve
    1134: 5, // Cover of Shadow
    1822: 5, // Eluding Nullification
    1866: 5, // Restorative Illusions
    2384: 5, // Spirits' Remedy
    2401: 5, // Purging Light
    1730: 5 // Hardening Persistence (Revenant/Glint). Own description doesn't name a target, but
    // both skills it gates are already-party-wide Glint shield-support skills — see top doc comment.
  }
}

/**
 * Trait ids currently "active" for a build: every minor trait of an equipped
 * specialization line (auto-granted) plus every chosen major trait. Used to
 * gate `Fact.requires_trait` — some facts (on skills AND traits) only apply
 * when a specific other trait is also active.
 */
export function activeTraitIds(build: Build, allTraits: Trait[]): Set<number> {
  const equippedLines = build.specializations.filter((line): line is NonNullable<typeof line> => line != null)
  const equippedSpecIds = new Set(equippedLines.map((line) => line.specializationId))
  const ids = new Set<number>()
  for (const trait of allTraits) {
    if (trait.slot === 'Minor' && equippedSpecIds.has(trait.specializationId)) {
      ids.add(trait.id)
    }
  }
  for (const line of equippedLines) {
    for (const chosenId of line.chosenTraitIds) {
      if (chosenId !== null) ids.add(chosenId)
    }
  }
  return ids
}

/**
 * Legend ids (`Legend.id`, e.g. `'Legend3'`) currently equipped for a build — `activeTraitIds`'s
 * counterpart for `LegendConditionalTargetCountOverride` (see its doc comment). BOTH equipped legend
 * slots count, not just whichever one `RevenantSkillSelection.activeLegendIndex` currently displays —
 * same "every equipped alternate always contributes regardless of which is shown" convention that
 * field's own doc comment documents (mirrors `skillIdsForBuild`'s own legend handling). Empty for
 * every non-Revenant profession, same as `build.skills.kind !== 'revenant'` everywhere else in this
 * file.
 */
export function equippedLegendIds(build: Build): Set<string> {
  if (build.skills.kind !== 'revenant') return new Set()
  return new Set(build.skills.legends.filter((id): id is string => id !== null))
}

/** Default classifier: real boons/conditions only — every existing caller relies on this exact
 *  behavior (unchanged from before `BoonConditionCategory` existed), so it's the default rather
 *  than something every call site has to pass explicitly. */
export function classifyBoonCondition(status: string): BoonConditionCategory | null {
  if (isBoonName(status)) return 'boon'
  if (isConditionName(status)) return 'condition'
  return null
}

/** `computeAuraSources`' classifier — the 7 auras, see `AURA_NAMES` in constants.ts. */
function classifyAura(status: string): BoonConditionCategory | null {
  if (isAuraName(status)) return 'aura'
  return null
}

/**
 * Resolves a `PrefixedBuff` fact's `prefix.status` to the specific `Legend` it names, when it names
 * one at all — see `BoonConditionSource.legendIcon`'s doc comment for the reasoning/scope. `legends`
 * is the fixed 8-entry `data/game-data/legends.json` list; every prefix status observed matches a
 * legend's own `name` exactly EXCEPT "Legendary Alliance" (`prefix.status` instead reads "Legendary
 * Alliance Stance"), so `name + " Stance"` is checked too.
 */
export function resolveLegendFromPrefix(prefix: Fact['prefix'], legends: Legend[]): Legend | undefined {
  const status = prefix?.status
  if (!status) return undefined
  return legends.find((l) => l.name === status || `${l.name} Stance` === status)
}

/** One "this differs per equipped legend" line for a skill/trait tooltip — a per-legend text detail
 *  rather than a real boon/condition grant (see `legendFormFactsForSkill`'s doc comment for the
 *  shape this covers). Deliberately separate from `BoonConditionSource`'s own `legendIcon`/
 *  `legendName` fields (Spirit-Boon-style: a real boon whose PREFIX merely attributes it to a
 *  legend) — here the legend IS the entire content of the row, there's no boon name to show. */
export interface LegendFormFact {
  legend: Legend
  text: string
}

/** Skill ids whose `PrefixedBuff` facts get the `legendFormFactsForSkill` treatment below — an
 *  opt-in allow-list, not automatic, same "fails open, curated one source at a time" convention as
 *  `BUFF_INSTANCE_LABELS`/`DODGE_TRIGGER_NOTES` elsewhere in this file. A broader scan (2026-08-20)
 *  found 4 more skills/traits with this exact shape (`PrefixedBuff` fact whose own `status` isn't a
 *  recognized boon/condition, `prefix.status` naming a legend). Ancient Echo (55029, the non-Conduit
 *  spec-less fallback sharing Cosmic Wisdom's Profession_2/_3 slot family, see
 *  `profession-mechanic.ts`) is a plausible future candidate, not investigated this pass — its own
 *  3-legend set (`Unblockable`/Assassin, `Tranquil`/Centaur, `Rite of the Great Dwarf`/Dwarf) looks
 *  like the same clean shape as Cosmic Wisdom below, just not requested yet. Rift of Pain (50390)'s
 *  per-legend combo-field facts are a different content type (already the domain of
 *  `comboFactsForSkill`, not this).
 */
const LEGEND_FORM_FACT_SKILL_IDS = new Set<number>([
  77371, // Cosmic Wisdom (Revenant/Conduit, Profession_3) — flagged by the user 2026-08-20: "doesn't
  // display the specific skill's tooltip depending on the equipped legends." Its raw API facts
  // already carry all 5 "Form of X" descriptions as clean `PrefixedBuff` facts (one real Legend
  // named per `prefix.status`, `status`/`description` a genuinely usable ready-to-show line each,
  // unlike Bolstered Bonds' empty/absent descriptions) — previously silently dropped by
  // `boonConditionFactsForSkill` since none of "Form of the Assassin" etc. is a recognized boon
  // name. Conduit occupies its own elite-spec trait line, so only 5 of the 8 legends
  // (Assassin/Centaur/Demon/Dwarf/Entity) can ever be equipped alongside it anyway — matches this
  // skill's own 5 documented forms with none left over (same reasoning already established for
  // `CONDUIT_RELEASE_POTENTIAL_BY_LEGEND`/`LEGEND_ATTRIBUTE_BONUS_DETAILS`).
  29371 // Facet of Nature (Revenant/Herald, Profession_2) — the OTHER half of TODO.md's "Herald F2
  // lacks linked tooltips" item, closed 2026-08-20 alongside `trueNatureBranches`
  // (`skill-calc/branch-conditional-facts.ts`), which covers its Consume effect (True Nature)'s real
  // numbers. This covers Facet of Nature's OWN passive-tick descriptions instead — its raw facts are
  // 5 unclassified `PrefixedBuff` markers ("Facet of Nature—Assassin", etc.), same clean
  // description-per-legend shape as Cosmic Wisdom above, just no real numbers behind them yet (wiki-
  // fetched but not precisely verified — a separate, still-open TODO.md follow-up). Only 5 of
  // Revenant's legends have a Facet of Nature form at all (Assassin/Centaur/Demon/Dwarf/Dragon,
  // same 5 `trueNatureBranches` covers) — a Herald invoking Kalla/Alliance gets no row here, matching
  // the real game.
])

/**
 * Trait ids whose OWN `PrefixedBuff` facts get the same equipped-legend gate as
 * `LEGEND_FORM_FACT_SKILL_IDS` above — same-day follow-up (2026-08-20) after the user reported
 * Numinous Gift's boons still showing for all 5 legends in the build-wide Boon/Condition summary
 * panel even after `extractFromFacts` learned to filter the SKILL-side copy
 * (`synthetic-facts.json`'s 77371 entries). Root cause: Numinous Gift's own raw API facts (trait
 * 2440, a Grandmaster MINOR — always active once Conduit is equipped) already carry the identical 5
 * boon-per-legend `PrefixedBuff` facts natively; `computeBoonConditionSources`'s separate trait loop
 * walks every equipped trait's OWN facts independently of the skill loop, so this second,
 * completely unfiltered emission kept contributing all 5 legends' boons to the aggregate regardless
 * of what the skill-side gate did. Unlike Spirit Boon (trait 1774, deliberately left ungated — see
 * `LEGEND_FORM_FACT_SKILL_IDS`'s doc comment), Numinous Gift's own wiki wording is explicit that its
 * effect "depends on which legends you have equipped," and the user confirmed they want exactly
 * that build-specific behavior everywhere the trait's facts surface (its own picker tooltip
 * included, via `boonConditionFactsForTrait`), not just on Cosmic Wisdom's tooltip.
 */
const LEGEND_GATED_TRAIT_IDS = new Set<number>([2440])

/**
 * Same-day follow-up (2026-08-20): user flagged 3 more Conduit traits that interact with Cosmic
 * Wisdom specifically — "Numinous Gift gives boons/additional effects to Cosmic Wisdom, as do the
 * grandmaster majors Found Purpose and Mistfire." Unlike `LEGEND_FORM_EFFECT_DETAILS` above (which
 * covers effects with NO backing skill id at all), these 2 are ordinary "trait fact copied onto the
 * skill it triggers from" cases — same mechanism as the Notoriety cluster/Willbender Flames/Over
 * Shield elsewhere in this file — so they need no new code, just `synthetic-facts.json` entries
 * copied from each trait's own already-real API facts (`requires_trait` set to that trait's id):
 * - **Numinous Gift** (2440, Grandmaster minor, always active once Conduit is equipped): "Gain
 *   might and additional boons when you use Cosmic Wisdom, depending on which legends you have
 *   equipped." Its own 5 `PrefixedBuff` boon facts (Fury/Assassin, Resistance/Demon, Stability/
 *   Dwarf, Protection/Centaur, Quickness/Entity — already confirmed to need no WvW override at all
 *   during the earlier Conduit `wvw-fact-overrides.json` leg this same day) plus its flat Might
 *   fact are copied onto Cosmic Wisdom verbatim. Since these ARE recognized boon names (unlike the
 *   Forms' placeholder statuses), they flow through the ordinary `boonConditionFactsForSkill`
 *   pipeline automatically — Spirit-Boon-style legend-icon badge included, no `legendFormFactsForSkill`
 *   involvement needed.
 * - **Mistfire** (2429, Grandmaster major): "Perform an additional strike when using Cosmic Wisdom
 *   that damages and burns enemies." Its own real `Damage`/`Burning`/`Radius`/`Number of Targets`
 *   facts (NOT the "no id at all" shape `LEGEND_FORM_EFFECT_DETAILS` needed — Mistfire's facts
 *   already exist on the trait object itself) copied onto Cosmic Wisdom the same way; see
 *   `damage-calc.ts`'s matching `CURATED_DAMAGE_COEFFICIENTS` entry and `wvw-fact-overrides.json`'s
 *   `Burning` split (pve 6s/wvw+pvp 4s, mirroring trait 2429's own already-curated entry).
 *
 * **Found Purpose** (2352, TODO.md's follow-up item, closed 2026-08-20) is the 3rd Grandmaster
 * major, mutually exclusive with Mistfire — it grants the SAME boon statuses Numinous Gift does
 * (Fury/Resistance/Stability/Protection/Might), just party-wide(4) instead of self and at mostly-
 * shorter WvW+PvP durations (fetched fresh via the trait's own raw wikitext, `action=raw`, since the
 * rendered page collapses the pve/wvw/pvp split back into prose): Fury 5s (pve 10s), Resistance 2s
 * (pve 5s), Stability 2s (pve 5s), Protection 2s (pve 5s), plus a flat Might (5s×3, pve 10s×5) AND
 * an Entity-legend-specific Might (5s×3, no PvE equivalent — Entity's PvE grant is Quickness
 * instead, matching Numinous Gift's own Quickness/Entity line). Naively copying both traits' facts
 * onto Cosmic Wisdom (both `requires_trait`-gated, Numinous Gift always active + Found Purpose only
 * when chosen) would render TWO simultaneous rows per boon whenever Found Purpose is equipped (e.g.
 * "Fury: 10s (self)" AND "Fury: 5s (party 4)" both attributed to Assassin) — the same "trait B's
 * value supersedes trait A's, once B is ALSO active" shape Core Value/True Nature's now-closed
 * "Herald F2" item solved by hand-resolving inline (`trueNatureBranches` in
 * `skill-calc/branch-conditional-facts.ts`) rather than building a generic resolver, since only one
 * skill/trait pair was involved. Resolved the same way here via `FOUND_PURPOSE_SUPERSEDES_NUMINOUS_GIFT`
 * below: Cosmic Wisdom's `requires_trait: 2440` facts are skipped outright once Found Purpose (2352)
 * is ALSO active, and a new set of `requires_trait: 2352` facts (Found Purpose's own wiki-verified
 * numbers above) takes over — each status distinguished from Numinous Gift's copy by `duration`
 * alone (Numinous Gift's own durations, e.g. Fury@10, never collide with Found Purpose's shorter
 * ones, e.g. Fury@5), which is also how `TARGET_COUNT_OVERRIDES.skill[77371]` tells the two apart
 * without needing a live "Number of Allied Targets" fact (that lookup ignores `requires_trait`
 * entirely — see `resolveTargetCountFrom`'s doc comment — so an unconditioned Allied-Targets fact
 * would have wrongly widened Numinous Gift's own self-only rows too). Found Purpose's own trait
 * tooltip needed one small drive-by fix alongside this (see `BUFF_INSTANCE_VALUE_OVERRIDES.trait[2352]`):
 * its raw API facts carry an untagged PvE-duration duplicate of the flat Might fact (10s×5, no
 * `requires_trait`/mode discriminator) that nothing was previously deduping against the real
 * WvW+PvP one (5s×3) — same "multiple Buff facts sharing one status, no discriminator" shape
 * `fetch-wvw-splits.ts` already documents, just missed by that sweep since Found Purpose wasn't
 * flagged again after 2026-08-19's Conduit leg (Found Purpose's per-legend boons WERE fixed then;
 * only this one flat, legend-less Might fact was still an untouched duplicate).
 */
const FOUND_PURPOSE_TRAIT_ID = 2352
const COSMIC_WISDOM_SKILL_ID = 77371

/**
 * A real, current-build-scaled number to append below a `legendFormFactsForSkill` row's own
 * description — for the 3 Cosmic Wisdom forms that deal genuine damage/healing whose numbers live
 * entirely on the wiki's own separate "effect skill" page, never exposed by the public API AT ALL
 * (unlike the more common `synthetic-facts.json` shape, where the id exists but carries zero real
 * facts — these 3 ids, 78971/77920/76818, don't resolve via `/v2/skills` at all, so there's no
 * `Fact` to attach a curated coefficient to via the normal `CURATED_DAMAGE_COEFFICIENTS`/
 * `CURATED_HEALING_COEFFICIENTS` tables, which both require a matching real fact on the object).
 * Computed directly here instead, using the exact same formulas those tables' own consumers
 * (`damageLinesForSkill`/`healingLinesForSkill`) already use — deliberately NOT routed through
 * those tables/`skillFactLines`'s generic numeric-facts block, which has no per-legend gating: a
 * value added there would show unconditionally regardless of which legend is actually equipped,
 * inconsistent with this row's own equipped-legend filtering.
 */
interface LegendFormEffectDetail {
  label: string
  /** `'damage'`: the ordinary weapon-Damage-fact formula (`weaponStrength * coefficient * power /
   *  targetArmor`, `weapon: 'unequipped'` — non-weapon trait/utility damage, matches the wiki's
   *  plain `{{skill fact|damage|...}}` template both Warrior's and Dervish's pages use).
   *  `'siphonDamage'`/`'healing'`: the `AttributeAdjust` formula (`baseValue + coefficient *
   *  power/healingPower`, matches the wiki's `{{skill fact|life siphon damage|...}}`/
   *  `{{skill fact|life siphon healing|...}}` templates Assassin's page uses — a genuinely
   *  different fact TYPE (`AttributeAdjust`, `target: 'Power'`/`'Healing'`) from the ordinary
   *  weapon-Damage-fact shape, confirmed by cross-checking the real (non-Lesser) Enchanted Daggers
   *  heal skill's own raw API facts, id 26937, whose already-curated `CURATED_HEALING_COEFFICIENTS`
   *  entry's `Siphon Healing` baseValue (768) matches this page's wiki-quoted number exactly).
   */
  kind: 'damage' | 'siphonDamage' | 'healing'
  coefficient: number
  /** Only for `'siphonDamage'`/`'healing'` — the `AttributeAdjust` fact's own reference value (API
   *  convention: computed at 0 bonus Power/Healing Power), same meaning as `HealingCoefficient.baseValue`. */
  baseValue?: number
}

/**
 * `LEGEND_FORM_FACT_SKILL_IDS`' skill id -> `Legend.name` -> the real damage/healing detail(s) to
 * append to that legend's row (see `LegendFormEffectDetail`'s own doc comment for why these can't
 * go through the normal curated-coefficient tables). Every entry wiki-verified 2026-08-20 via each
 * effect's own separate wiki page (its own `{{skill fact}}` templates, not paraphrased from prose):
 * - Assassin — [[Lesser Enchanted Daggers]] (id 78971, no split: "identical across PvE, WvW, and
 *   PvP as of 20 Dec 2025"). Both halves share this app's WvW-focused convention trivially since
 *   there's nothing to pick between.
 * - Warrior — [[Dwarven Retribution]] (id 77920): genuine 3-way pve(1.1)/wvw(0.44)/pvp(0.54) split,
 *   WvW value used.
 * - Dervish — [[Form of the Dervish (Attack)]] (id 76818): pve(0.8)/wvw+pvp(0.525) split, WvW value
 *   used.
 * Centaur (Form of the Monk) and Demon (Form of the Mesmer) are genuinely non-damage utility
 * effects per their own descriptions (no separate "effect skill" page exists for either) — nothing
 * to add for those 2 legends.
 */
const LEGEND_FORM_EFFECT_DETAILS: Record<number, Record<string, LegendFormEffectDetail[]>> = {
  77371: {
    'Legendary Assassin Stance': [
      { label: 'Life Siphon Damage', kind: 'siphonDamage', baseValue: 1028, coefficient: 0.06 },
      { label: 'Siphon Healing', kind: 'healing', baseValue: 768, coefficient: 0.2 }
    ],
    'Legendary Dwarf Stance': [{ label: 'Damage', kind: 'damage', coefficient: 0.44 }],
    'Legendary Entity Stance': [{ label: 'Damage', kind: 'damage', coefficient: 0.525 }]
  }
}

/** Live build stats `legendFormFactsForSkill` needs to compute `LEGEND_FORM_EFFECT_DETAILS`'
 *  real numbers — the same trio `skillFactLines`/`damageLinesForSkill`/`healingLinesForSkill` are
 *  already called with at every one of this function's own call sites, just bundled together since
 *  the param list was getting long. Optional (defaulted `undefined`) so a caller with no attribute
 *  context handy still gets every OTHER curated skill's plain-text rows unaffected — only rows with
 *  a `LEGEND_FORM_EFFECT_DETAILS` entry actually need this, and there's currently exactly one such
 *  skill (Cosmic Wisdom). */
export interface LegendFormAttributeContext {
  power: number
  healingPower: number
  targetArmor: number
}

function formatLegendFormEffectDetail(detail: LegendFormEffectDetail, attrs: LegendFormAttributeContext): string {
  const value =
    detail.kind === 'damage'
      ? (WEAPON_STRENGTH_MIDPOINTS.unequipped * detail.coefficient * attrs.power) / attrs.targetArmor
      : (detail.baseValue ?? 0) + detail.coefficient * (detail.kind === 'healing' ? attrs.healingPower : attrs.power)
  return `${detail.label}: ${Math.round(value).toLocaleString()}`
}

/**
 * Per-legend "form"/effect detail lines for a curated skill (see `LEGEND_FORM_FACT_SKILL_IDS`) —
 * every `PrefixedBuff` fact whose own `status` ISN'T a recognized boon/condition (ruling out the
 * ordinary Spirit-Boon shape, already handled by `extractFromFacts`) but whose `prefix.status`
 * names a real `Legend`. Filtered to the build's actually-EQUIPPED legends only (`equippedLegendIdSet`,
 * both slots) — unlike Spirit Boon's boon rows (which always show every one of the 8 possibilities
 * regardless of what's equipped, since a real Revenant can freely swap to any of them), this app's
 * Conduit-legend universe is fixed to whichever 2 the player has actually chosen, so showing only
 * those keeps the tooltip build-specific rather than listing forms the player could never reach —
 * matches `conduitReleasePotentialBar`'s own per-equipped-legend swap for this exact skill's sibling
 * (`Release Potential`, same Profession_2/_3 slot family). `attrs` (optional) additionally appends
 * any `LEGEND_FORM_EFFECT_DETAILS` real number(s) on their own line(s) below the row's own
 * description text (rendered via `white-space: pre-line`, see `.tooltip-legend-fact-text`).
 */
export function legendFormFactsForSkill(
  skill: Skill,
  equippedLegendIdSet: Set<string>,
  legends: Legend[],
  attrs?: LegendFormAttributeContext
): LegendFormFact[] {
  if (!LEGEND_FORM_FACT_SKILL_IDS.has(skill.id)) return []
  const out: LegendFormFact[] = []
  for (const fact of [...skill.facts, ...skill.traitedFacts]) {
    if (fact.type !== 'PrefixedBuff' || typeof fact.status !== 'string' || typeof fact.description !== 'string') continue
    if (classifyBoonCondition(fact.status)) continue
    const legend = resolveLegendFromPrefix(fact.prefix, legends)
    if (!legend || !equippedLegendIdSet.has(legend.id)) continue
    const details = LEGEND_FORM_EFFECT_DETAILS[skill.id]?.[legend.name]
    const extraLines = details && attrs ? details.map((d) => formatLegendFormEffectDetail(d, attrs)) : []
    out.push({ legend, text: [fact.description, ...extraLines].join('\n') })
  }
  return out
}

function extractFromFacts(
  facts: Fact[],
  traitedFacts: Fact[],
  activeIds: Set<number>,
  equippedLegendIdSet: Set<string>,
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  sourceName: string,
  sourceIcon: string,
  durationPercent: { boon: number; condition: number },
  wvwOverrides: Record<string, WvwFactOverride> | undefined,
  classify: (status: string) => BoonConditionCategory | null = classifyBoonCondition,
  legends: Legend[] = []
): BoonConditionSource[] {
  const out: BoonConditionSource[] = []
  const emittedOverriddenStatuses = new Set<string>()
  const combinedFacts = [...facts, ...traitedFacts]

  // Pre-pass for `resolveInstanceLabel`'s `tupleOccurrence`/`tupleTotal` — counts how many facts on
  // this source share the exact same status/duration/apply_count tuple, unfiltered by
  // `requires_trait`/WvW-override activity (the curated `BUFF_INSTANCE_LABELS` keys were derived by
  // eye from the source's raw, unfiltered facts array, so this pre-pass has to match that exactly).
  const tupleCounts = new Map<string, number>()
  for (const fact of combinedFacts) {
    if ((fact.type !== 'Buff' && fact.type !== 'PrefixedBuff') || typeof fact.status !== 'string' || typeof fact.duration !== 'number') continue
    const key = buffInstanceKey(fact.status, fact.duration, fact.apply_count ?? 1)
    tupleCounts.set(key, (tupleCounts.get(key) ?? 0) + 1)
  }
  const tupleSeen = new Map<string, number>()

  for (const fact of combinedFacts) {
    // `PrefixedBuff` (e.g. Revenant/Salvation's Serene Rejuvenation, "Legendary Centaur skills
    // apply boons in an area") carries the identical status/duration/apply_count/requires_trait
    // shape as `Buff`, just with an extra `prefix` naming the specific effect it rides on — see
    // `Fact`'s doc comment for why `prefix.status` isn't used for source attribution here.
    if ((fact.type !== 'Buff' && fact.type !== 'PrefixedBuff') || typeof fact.status !== 'string' || typeof fact.duration !== 'number') {
      continue
    }
    const applyCount = fact.apply_count ?? 1
    const tupleKey = buffInstanceKey(fact.status, fact.duration, applyCount)
    const tupleTotal = tupleCounts.get(tupleKey) ?? 1
    const tupleOccurrence = (tupleSeen.get(tupleKey) ?? 0) + 1
    tupleSeen.set(tupleKey, tupleOccurrence)

    const category = classify(fact.status)
    if (category === null) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue

    // Found Purpose supersedes Numinous Gift's boons on Cosmic Wisdom once it's ALSO active (both
    // being `requires_trait`-gated onto the same skill isn't enough on its own to prevent both
    // showing at once) — see `FOUND_PURPOSE_TRAIT_ID`'s doc comment (by `LEGEND_GATED_TRAIT_IDS`)
    // for the full writeup. Scoped to this exact skill/trait pair, not a generic "supersedes"
    // mechanism.
    if (sourceKind === 'skill' && sourceId === COSMIC_WISDOM_SKILL_ID && fact.requires_trait === 2440 && activeIds.has(FOUND_PURPOSE_TRAIT_ID)) continue

    // Real recognized-boon-name `PrefixedBuff` facts (e.g. Numinous Gift's Fury/Resistance/
    // Stability/Protection/Quickness, both on Cosmic Wisdom's synthetic copy AND on Numinous Gift's
    // own trait facts — see `LEGEND_GATED_TRAIT_IDS`'s doc comment for why BOTH sources need this)
    // still need the SAME equipped-legend gate `legendFormFactsForSkill` already applies to Cosmic
    // Wisdom's own non-boon "Form of X" facts — all are `PrefixedBuff`s naming one of Conduit's 5
    // reachable legends, and without this check every one of the 5 boon rows shows regardless of
    // which 2 legends are actually equipped. Deliberately scoped to these 2 curated allow-lists
    // rather than applied to every `PrefixedBuff`-with-legend fact everywhere: Invocation's Spirit
    // Boon (trait 1774) has the identical shape (8 boon-per-legend `PrefixedBuff` facts) but is
    // intentionally NOT gated here — see `legendFormFactsForSkill`'s doc comment for why Spirit
    // Boon's rows show all 8 possibilities unconditionally.
    const isLegendGatedSource = (sourceKind === 'skill' && LEGEND_FORM_FACT_SKILL_IDS.has(sourceId)) || (sourceKind === 'trait' && LEGEND_GATED_TRAIT_IDS.has(sourceId))
    if (isLegendGatedSource && fact.type === 'PrefixedBuff') {
      const legend = resolveLegendFromPrefix(fact.prefix, legends)
      if (legend && !equippedLegendIdSet.has(legend.id)) continue
    }

    // Per-occurrence override takes priority over the per-status one below — when present, this
    // specific occurrence's fate (kept with a corrected value, or dropped as a same-concept
    // duplicate) is already fully decided, so the per-status collapse logic never applies to it (see
    // `BUFF_INSTANCE_VALUE_OVERRIDES`'s doc comment for why a per-status override can't express this
    // shape at all — 2+ genuinely different concepts sharing one status).
    const instanceOverride = resolveInstanceValueOverride(sourceKind, sourceId, fact.status, fact.duration, applyCount, tupleOccurrence, tupleTotal)
    if (instanceOverride === 'omit') continue

    let baseDuration: number
    if (typeof instanceOverride === 'number') {
      baseDuration = instanceOverride
    } else {
      const wvwOverride = wvwOverrides?.[fact.status]
      if (wvwOverride !== undefined) {
        // A curated override means the API bakes this status's per-game-mode values into multiple
        // raw facts with no discriminator (see fetch-wvw-splits.ts's "Multiple Buff facts sharing
        // one status" doc comment) — those facts represent the SAME application seen in different
        // modes, not separate simultaneous applications, so only the first is ever emitted. This is
        // distinct from the common case of a real multi-hit/multi-pulse skill genuinely applying the
        // same status more than once per cast (no override present there), which must still emit one
        // row per hit.
        if (emittedOverriddenStatuses.has(fact.status)) continue
        emittedOverriddenStatuses.add(fact.status)
      }
      if (wvwOverride === 'omit') continue
      baseDuration = typeof wvwOverride === 'number' ? wvwOverride : fact.duration
    }

    const { value: targetCount, nameSuffix } = resolveTargetCount(fact, combinedFacts, sourceKind, sourceId, activeIds, equippedLegendIdSet)
    const percent = category === 'condition' ? durationPercent.condition : category === 'boon' ? durationPercent.boon : 0
    const legend = fact.type === 'PrefixedBuff' ? resolveLegendFromPrefix(fact.prefix, legends) : undefined
    const instanceLabel = resolveInstanceLabel(sourceKind, sourceId, fact.status, fact.duration, applyCount, tupleOccurrence, tupleTotal)
    const triggerNote = resolveTriggerNote(sourceKind, sourceId)
    out.push({
      sourceKind,
      sourceId,
      sourceName: nameSuffix ? `${sourceName} + ${nameSuffix}` : sourceName,
      sourceIcon,
      boonOrConditionName: fact.status,
      isCondition: category === 'condition',
      category,
      baseDurationSeconds: baseDuration,
      scaledDurationSeconds: baseDuration * (1 + percent / 100),
      applyCount,
      requiresTraitId: fact.requires_trait ?? null,
      targetCount,
      legendIcon: legend?.icon,
      legendName: legend?.name,
      instanceLabel,
      triggerNote
    })
  }
  return out
}

/**
 * Boon/condition facts a single skill grants, gated by the same `requires_trait`/WvW-override/
 * duration-scaling rules as `computeBoonConditionSources` — used for skill tooltips (both the
 * equipped skill-bar slots and the picker grid) so a skill's boon/condition output is visible
 * without it needing to already be equipped. `activeIds`/`durationPercent` are the caller's
 * responsibility to compute once (via `activeTraitIds` and gear-calc's duration-percent
 * functions) and reuse across every skill shown, rather than recomputing per hover.
 */
export function boonConditionFactsForSkill(
  skill: Skill,
  activeIds: Set<number>,
  equippedLegendIdSet: Set<string>,
  durationPercent: { boon: number; condition: number },
  wvwOverride: Record<string, WvwFactOverride> | undefined,
  legends: Legend[] = []
): BoonConditionSource[] {
  return extractFromFacts(
    skill.facts,
    skill.traitedFacts,
    activeIds,
    equippedLegendIdSet,
    'skill',
    skill.id,
    skill.name,
    skill.icon,
    durationPercent,
    wvwOverride,
    classifyBoonCondition,
    legends
  )
}

/**
 * `boonConditionFactsForSkill`'s trait counterpart — a trait's own boon/condition facts (including
 * `PrefixedBuff` ones, e.g. Serene Rejuvenation's Legendary-Centaur-skill boons), for the trait
 * picker's own tooltip. Didn't exist before: `computeBoonConditionSources` already walks every
 * equipped trait's facts for the build-wide boon bar, but the trait picker (`TraitsEditor.tsx`)
 * only ever passed an empty boon-facts array to its own tooltip (`factsBlock(..., [])`), so a
 * trait's boon/condition grants — `PrefixedBuff` or plain `Buff` alike — never showed there even
 * though the aggregate boon bar had them right.
 */
export function boonConditionFactsForTrait(
  trait: Trait,
  activeIds: Set<number>,
  equippedLegendIdSet: Set<string>,
  durationPercent: { boon: number; condition: number },
  wvwOverride: Record<string, WvwFactOverride> | undefined,
  legends: Legend[] = []
): BoonConditionSource[] {
  return extractFromFacts(
    trait.facts,
    trait.traitedFacts,
    activeIds,
    equippedLegendIdSet,
    'trait',
    trait.id,
    trait.name,
    trait.icon,
    durationPercent,
    wvwOverride,
    classifyBoonCondition,
    legends
  )
}

const ELEMENTALIST_ATTUNEMENTS = ['Fire', 'Water', 'Air', 'Earth'] as const

/**
 * Every weapon-derived skill id a build's currently-`environment`-relevant weapon sets grant.
 * Land builds count BOTH swap sets (A and B); underwater builds count both underwater sets (U1
 * and U2) — a player carries both and can swap anytime, same "both always contribute" reasoning
 * as `RevenantSkillSelection.activeLegendIndex` (see its doc comment). `activeWeaponSet`/
 * `activeUnderwaterSet` are display-only and don't gate this. `equippedSpecializationIds` feeds
 * `weaponSkillIdsForPair`'s `specializationId`-match signal (e.g. Engineer Sword's Holosmith-vs-
 * base "Sun Edge" pair).
 *
 * For an Untamed Ranger, also includes each main-hand weapon's Untamed "Unleashed" autoattack
 * alternate (see `unleashedWeaponOneId`) alongside the normal one — same "both states always
 * contribute" reasoning as everything else here, since Unleashed cycles on a 1-second cooldown in
 * real combat rather than being a deliberate, long-lived player choice. `Build.rangerUnleashed` is
 * display-only and doesn't gate this, same as the other toggles above.
 *
 * For Elementalist, every attunement's own skill set contributes regardless of `Build.
 * activeAttunement` — same "both/all states always contribute" reasoning, since a real
 * Elementalist swaps attunement freely mid-fight (see `Build.activeAttunement`'s doc comment). For
 * Weaver specifically, every *current+previous attunement pair* contributes (all 16 combinations,
 * not just the 4 single attunements) — same reasoning, extended to Weaver's second axis, so every
 * reachable Dual Attack skill's facts are included regardless of `Build.
 * weaverPreviousAttunement`. Deduplicated (`[...new Set(...)]` below) since a differing-element
 * pair's Dual Attack id is reachable via 2 orderings (Fire+Water and Water+Fire resolve to the same
 * id, see `weaverWeaponThreeSkillId`) and would otherwise double-count that skill's sources.
 *
 * Every resolved id also gets walked through its own `withFlipChain` (fixed 2026-08-07 — see
 * TODO.md/COMPLETED.md): the GW2 API dual-purposes `Skill.flipSkill` to mean BOTH "this channel's
 * release/toggled-off effect" (already handled for Revenant's heal/utility/elite/swap ids, see
 * `skillIdsForBuild` below) AND "the next hit in this autoattack chain" — confirmed live against
 * the raw API (e.g. Warrior Greatsword's "Greatsword Swing" 14356 carries `next_chain: 14373` AND
 * `flip_skill: 14373`, the identical value). Without this, a chain's 2nd/3rd hit (where GW2 often
 * puts the actual boon/condition — e.g. Revenant Scepter's "Acerbic Cut," not its own first-hit
 * "Serene Slash," carries the autoattack's Might) was never reachable from the equipped weapon's
 * `professions.json` slot list at all (that list only has the chain's starting id per slot) — a
 * scan found 126 weapon-slot chain-continuation skills across every profession carry a `Buff` fact
 * their chain's starting skill doesn't.
 */
function weaponSkillIdsForBuild(
  build: Build,
  professions: Profession[],
  skillsById: Map<number, Skill>,
  equippedSpecializationIds: ReadonlySet<number>
): number[] {
  const profession = professions.find((p) => p.id === build.profession)
  if (!profession) return []

  const isUntamed = build.specializations.some((line) => line?.specializationId === UNTAMED_SPEC_ID)
  const isWeaver = equippedSpecializationIds.has(WEAVER_SPEC_ID)
  const attunementPairs: [string | null, string | null][] =
    profession.id === 'Elementalist'
      ? isWeaver
        ? ELEMENTALIST_ATTUNEMENTS.flatMap((current) => ELEMENTALIST_ATTUNEMENTS.map((previous): [string, string] => [current, previous]))
        : ELEMENTALIST_ATTUNEMENTS.map((a): [string, null] => [a, null])
      : [[null, null]]

  const pairs: [EquipmentSlotKey, EquipmentSlotKey | null][] =
    build.environment === 'land'
      ? [
          ['weaponA1', 'weaponA2'],
          ['weaponB1', 'weaponB2']
        ]
      : [
          ['weaponU1', null],
          ['weaponU2', null]
        ]

  const ids: number[] = []
  for (const [mainKey, offKey] of pairs) {
    const mainType = build.equipment[mainKey]?.weaponType
    const offType = offKey ? build.equipment[offKey]?.weaponType : undefined
    const mainWeapon = mainType ? profession.weapons[mainType] : undefined
    // Mirror main-hand into off-hand only for an actual two-handed weapon, same restriction
    // `WeaponSkillBar.tsx` documents: a one-handed weapon (Sword, Dagger, ...) with no off-hand
    // item equipped must NOT fall back to mainWeapon here, or its own off-hand (4-5) skill
    // variants would wrongly get counted into the aggregate Boon/Condition totals before an
    // off-hand is ever equipped.
    const mainIsTwoHanded = mainWeapon?.flags.includes('TwoHand') ?? false
    const offWeapon = offType ? profession.weapons[offType] : mainIsTwoHanded ? mainWeapon : undefined
    if (!mainWeapon && !offWeapon) continue
    for (const [current, previous] of attunementPairs) {
      for (const id of weaponSkillIdsForPair(
        mainWeapon,
        offWeapon,
        build.environment,
        skillsById,
        equippedSpecializationIds,
        mainType ?? null,
        offType ?? mainType ?? null,
        current,
        previous
      )) {
        if (id !== null) ids.push(...withFlipChain(id, skillsById))
      }
    }
    if (isUntamed && mainType && mainWeapon) {
      const altId = unleashedWeaponOneId(mainType, mainWeapon, build.environment, skillsById)
      if (altId !== null) ids.push(altId)
    }
  }
  return [...new Set(ids)]
}

/** Every id reachable from `startId` by following `Skill.flipSkill` (its own activated/toggled-off
 *  alternate, e.g. a Revenant channel's release effect, or — for Legendary Alliance's aspect-paired
 *  skills specifically — the other aspect's version of the same slot; see `skillIdsForBuild`'s doc
 *  comment), resolved through `resolvedFlipSkillId` rather than the raw field directly so
 *  `FLIP_SKILL_OVERRIDES`-patched ids (e.g. Facet of Elements -> Elemental Blast, missing from the
 *  live API entirely) feed the aggregate the same as any genuinely-linked pair. Same walk as
 *  `relatedVariantSkills`'s tooltip-chain logic and `untamed-unleash.ts`'s private `flipChainIds`,
 *  duplicated locally rather than shared since each caller's return shape differs (a flat id list
 *  here vs. a `Set` there). Stops before appending an `isNonActionableFlipTarget` id — same
 *  reasoning as `multi-effect.ts`'s `flipTargetSkills`, which shares that check: those ids carry no
 *  facts genuinely absent from their own source skill (stale orphans, near-identical mode-split
 *  copies), so folding them into the boon/condition totals here would double-count the source's own
 *  facts under a different id rather than add anything real. */
function withFlipChain(startId: number, skillsById: Map<number, Skill>): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  let current: number | null = startId
  while (current !== null && !seen.has(current)) {
    seen.add(current)
    ids.push(current)
    const currentSkill = skillsById.get(current)
    const next = currentSkill ? resolvedFlipSkillId(currentSkill) : null
    current = next !== null && isNonActionableFlipTarget(next) ? null : next
  }
  return ids
}

/**
 * Every skill id shown on the build's profession-mechanic (F1-F5) bar — Guardian's Virtues,
 * Warrior's Burst Skill (Paragon's Chants included, since Bladesworn's Dragon Trigger is the only
 * one of these already bundle-capable), Necromancer's Shroud F1 own id, Ranger's Celestial Avatar
 * toggle's own id, Vindicator's Energy Meld, Elementalist's F1-F4 Attunement buttons, Thief's Steal/
 * Specter's own F1, Engineer's base Toolbelt, Revenant Conduit's Release Potential, and Elementalist
 * Catalyst's Jade Sphere.
 *
 * Missing entirely before 2026-08-15 (found investigating a user report that Paragon's Chants
 * weren't contributing to the aggregate Boon/Condition panel): `skillIdsForBuild`'s own doc comment
 * lists every OTHER "always contributes" category (weapon skills, Revenant legend kit, pets,
 * Beastmode, Stolen Skill) but never this one, and `bundleContributionsForBuild`'s `kitSkillIds`
 * only pulls in BUNDLE-capable mechanic-bar ids' own nested sub-skills (Tome chapters, Shroud/
 * Gunsaber/Dragon Trigger's 5 slot skills) — never the F-button's own id, and never a non-bundle
 * mechanic-bar id at all. Every `professionMechanicBar` entry's id (plus its own `flipSkill` chain,
 * same "both toggle states always contribute" reasoning `withFlipChain` documents above) is folded
 * in here now, alongside the other narrower per-mechanic resolvers `ProfessionMechanicBar.tsx`
 * calls directly (`engineerToolbeltBar`/`conduitReleasePotentialBar`/`catalystJadeSphereBar`).
 * Warrior's Profession_1 (Burst Skill) is the one slot `professionMechanicBar` itself resolves
 * differently per equipped weapon type, so this calls it once per distinct main-hand weapon type
 * across BOTH equipped weapon sets (mirroring `weaponSkillIdsForBuild`'s own "both weapon sets
 * always contribute" loop) rather than just once for whichever set happens active — every other
 * profession's bar is weapon-independent, so the extra calls are harmless no-ops for them (deduped
 * by the caller regardless).
 *
 * Elementalist Evoker's Familiar (`evokerFamiliarBar`) is covered too (added 2026-08-15, needs
 * `Familiar[]` threaded all the way from `computeBoonConditionSources`/`equippedSkillsById`'s
 * `gameData` param down through `skillIdsForBuild` to here — see TODO.md's now-closed item for why
 * this was the one bar resolver missing before). Ranger's Soulbeast Beastmode is NOT a gap here
 * despite also being a separate resolver (`soulbeastBeastmodeBar`) — `skillIdsForBuild` already
 * covers it directly via `beastmodeSkillIds`.
 */
function mechanicBarIdsForBuild(build: Build, professions: Profession[], skillsById: Map<number, Skill>, familiars: Familiar[]): number[] {
  const profession = professions.find((p) => p.id === build.profession)
  if (!profession) return []
  const equippedSpecIds = new Set(build.specializations.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => s.specializationId))
  const mainKeys: EquipmentSlotKey[] = build.environment === 'land' ? ['weaponA1', 'weaponB1'] : ['weaponU1', 'weaponU2']
  const weaponTypes = [...new Set(mainKeys.map((k) => build.equipment[k]?.weaponType ?? null))]

  const ids = new Set<number>()
  for (const weaponType of weaponTypes.length > 0 ? weaponTypes : [null]) {
    for (const entry of professionMechanicBar(profession, skillsById, equippedSpecIds, build.environment, weaponType)) {
      for (const id of withFlipChain(entry.skill.id, skillsById)) ids.add(id)
    }
  }
  if (build.profession === 'Engineer') {
    for (const entry of engineerToolbeltBar(build, skillsById)) ids.add(entry.skill.id)
  }
  if (build.profession === 'Revenant' && equippedSpecIds.has(CONDUIT_SPEC_ID)) {
    for (const entry of conduitReleasePotentialBar(build, skillsById)) ids.add(entry.skill.id)
  }
  if (build.profession === 'Elementalist' && equippedSpecIds.has(CATALYST_SPEC_ID)) {
    for (const entry of catalystJadeSphereBar(build, profession, skillsById)) ids.add(entry.skill.id)
  }
  if (build.profession === 'Elementalist' && equippedSpecIds.has(EVOKER_SPECIALIZATION_ID)) {
    for (const entry of evokerFamiliarBar(build, skillsById, familiars)) ids.add(entry.skill.id)
  }
  return [...ids]
}

/**
 * Every skill id "equipped" by a build's skill selection — for a standard profession, the chosen
 * Heal/Utility/Elite skills; for Revenant, every skill (swap + heal + 3 utility + elite) belonging
 * to either of the 2 equipped legends, since a legend's kit is fixed rather than picked skill-by-
 * skill (see `RevenantSkillSelection`), PLUS each of those ids' own `flipSkill` chain (`withFlipChain`
 * above) — most legends' channeled skills grant different facts on activation vs. their own
 * release/off effect (e.g. Herald's "Facet of Chaos" -> "Chaotic Release" granting Superspeed;
 * confirmed live 2026-07-31 across every legend, not just one), and Legendary Alliance Stance's own
 * heal/3-utility/elite ids each flip to their opposite-aspect (Saint Viktor vs. Archemorus) version
 * of the same slot — `/v2/legends` only exposes one aspect's id per slot, with the other aspect
 * reachable exclusively via this same `flipSkill` link (confirmed live: e.g. heal id "Selfish
 * Spirit" flips to "Selfless Spirit", elite "Spear of Archemorus" flips 2 deep through "Urn of Saint
 * Viktor" -> "Drop Urn of Saint Viktor" — real boons/conditions on every one of these, not cosmetic).
 * Same "every equipped alternate always contributes, regardless of which is currently
 * shown/toggled" reasoning as every other toggle in this codebase (weapon swap sets, Ranger's both
 * pets, Soulbeast Beastmode, Untamed's Unleashed autoattack) — plus every weapon-derived skill id
 * from the build's currently-relevant weapon sets (see `weaponSkillIdsForBuild`), plus, for Ranger,
 * both equipped pets' own skill (`Build.equippedPetIds` — both always contribute, same "both always
 * equipped" reasoning as the Revenant legends and land weapon-swap sets above), plus, additionally
 * for Soulbeast, both equipped pets' Beastmode F1/F2/F3 triplet (`soulbeastBeastmodeBar` — same
 * "both always contribute regardless of which is currently active" reasoning, since Beastmode can be
 * toggled to either merged pet at will mid-fight), plus, for Thief, the manually-picked Stolen
 * Skill (`Build.thiefStolenSkillId` — unlike every other id folded in here, this one has no
 * automatic in-build resolution at all, see that field's doc comment; contributes directly, not
 * via `withFlipChain`, since none of `THIEF_STOLEN_SKILL_IDS` has an outgoing `flipSkill`), plus
 * every profession-mechanic (F1-F5) bar id (`mechanicBarIdsForBuild` — see its own doc comment;
 * added 2026-08-15, previously missing entirely).
 *
 * The non-Revenant branch below now also walks each equipped id's own `withFlipChain` (fixed
 * 2026-08-16, found investigating a user report that Supply Crate's sub-abilities weren't showing
 * up anywhere) — every OTHER category folded into this function's return value already gets this
 * treatment (weapon skills, Revenant's own branch just above, the mechanic bar), but the plain
 * standard-profession Heal/Utility/Elite branch never did, so any equipped skill whose release/
 * detonate/final-charge effect carries its own Buff/Condition fact (e.g. Engineer Net Turret's
 * "Electrified Net") silently never contributed to the aggregate totals even though it correctly
 * appeared as a `FlipSkillStack` icon on the tooltip — same "tooltip-correctness and aggregate-
 * contribution are separate code paths" trap as the 2026-08-15 `ProfessionMechanicBar` bug. Engineer
 * Turrets additionally get `TURRET_SUB_ABILITY_IDS` folded in directly (not via `withFlipChain`,
 * which only follows a skill's raw `flipSkill` — see that table's own doc comment for why the raw
 * field alone is insufficient for this family specifically), and a Firebrand mantra's chain gets its
 * orphaned `MANTRA_FINAL_CHARGE_IDS` sibling appended past wherever `withFlipChain` stops, same
 * extra hop `flipTargetSkills` already appends for the tooltip.
 */
function skillIdsForBuild(
  build: Build,
  legends: Legend[],
  pets: Pet[],
  professions: Profession[],
  skillsById: Map<number, Skill>,
  soulbeastBeastmode: SoulbeastBeastmodeMap,
  familiars: Familiar[]
): number[] {
  const nonWeaponIds =
    build.skills.kind === 'revenant'
      ? build.skills.legends
          .filter((id): id is string => id !== null)
          .map((id) => legends.find((l) => l.id === id))
          .filter((l): l is Legend => l !== undefined)
          .flatMap((l) => [l.swap, l.heal, l.elite, ...l.utilities])
          .flatMap((id) => withFlipChain(id, skillsById))
      : [build.skills.heal, ...build.skills.utility, build.skills.elite]
          .filter((id): id is number => id !== null)
          .flatMap((id) => {
            // Turret ids are fully overridden by `TURRET_SUB_ABILITY_IDS` rather than walked via
            // `withFlipChain` — see that table's doc comment for why the raw `flipSkill` field alone
            // is unreliable for this family; using both here would double-count whichever sub-ability
            // the raw field happens to already link.
            const turretSubAbilityIds = TURRET_SUB_ABILITY_IDS.get(id)
            if (turretSubAbilityIds) return [id, ...turretSubAbilityIds]
            // A Firebrand mantra's `flipSkill` chain only ever reaches its regular charge — the
            // enhanced Final Charge sibling is structurally orphaned (see `mantra-final-charge.ts`'s
            // doc comment) and needs appending separately, same extra hop `flipTargetSkills` already
            // adds for the tooltip. Every Final Charge skill carries several `Buff` facts of its own
            // (found 2026-08-16 investigating the turret gap above), so this was silently missing
            // from every Mantra Firebrand build's aggregate Boon/Condition totals until now.
            const chain = withFlipChain(id, skillsById)
            const finalChargeId = MANTRA_FINAL_CHARGE_IDS[chain[chain.length - 1]]
            return finalChargeId !== undefined ? [...chain, finalChargeId] : chain
          })

  const equippedPetIds = build.profession === 'Ranger' ? build.equippedPetIds.filter((id): id is number => id !== null) : []
  const petSkillIds = equippedPetIds
    .map((id) => pets.find((p) => p.id === id))
    .filter((p): p is Pet => p !== undefined)
    .map((p) => p.skillId)

  const equippedSpecIds = new Set(build.specializations.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => s.specializationId))
  const beastmodeSkillIds = equippedSpecIds.has(RANGER_BEASTMODE_SPEC_ID)
    ? equippedPetIds
        .map((id) => soulbeastBeastmode[id])
        .filter((bar): bar is NonNullable<typeof bar> => bar !== undefined)
        .flatMap((bar) => [bar.f1SkillId, bar.f2SkillId, bar.f3SkillId])
    : []

  const stolenSkillIds = build.thiefStolenSkillId !== null ? [build.thiefStolenSkillId] : []

  return [
    ...nonWeaponIds,
    ...petSkillIds,
    ...beastmodeSkillIds,
    ...stolenSkillIds,
    ...mechanicBarIdsForBuild(build, professions, skillsById, familiars),
    ...weaponSkillIdsForBuild(build, professions, skillsById, equippedSpecIds)
  ]
}

/**
 * Every id a build's equipped Engineer Kits/Firebrand Tomes contribute — kit ids resolve to real
 * `Skill`s (returned here to fold into the normal skill-id list, same as any other equipped
 * skill); Tome chapters have no `Skill` id at all (see `TomeChapter`'s doc comment), so they're
 * returned separately for `tomeChapterBoonSources` below. Every equipped bundle-capable skill
 * contributes regardless of `Build.activeBundleSkillId` — see that field's doc comment for why.
 */
function bundleContributionsForBuild(
  build: Build,
  professions: Profession[],
  skillsById: Map<number, Skill>,
  tomeChapters: TomeChaptersByTomeId
): { kitSkillIds: number[]; tomeChapters: TomeChapter[] } {
  const profession = professions.find((p) => p.id === build.profession)
  if (!profession) return { kitSkillIds: [], tomeChapters: [] }

  const equippedSpecIds = new Set(build.specializations.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => s.specializationId))
  const mechanicBarSkillIds = professionMechanicBar(profession, skillsById, equippedSpecIds, build.environment).map((e) => e.skill.id)
  const bundleCapableIds = bundleCapableSkillIds(build, skillsById, tomeChapters, mechanicBarSkillIds)
  return bundleSkillIdsForBuild(build, bundleCapableIds, skillsById, tomeChapters, build.environment)
}

/** Curated fallback for `TomeChapter`s whose wiki page carries no "allied targets" fact at all
 *  (the `null`/"unknown" bucket `tomeChapterBoonSources`'s own comment describes) but are
 *  confirmed party-wide(5) — self + 4 allies, this codebase's usual convention (e.g. line 933's
 *  Battle Dance) — by other means. Keyed by `tomeSkillId` → `slotIndex`.
 *  - 42259/3 (Tome of Courage, "Chapter 4: Stalwart Stand"): description reads "granting resistance
 *    to your allies," the same "to your allies" wording this tome's own Chapter 1 ("Unflinching
 *    Charge") and Epilogue ("Unbroken Lines") carry alongside their explicit "allied targets: 5"
 *    fact — user-confirmed 2026-08-21 the pulse also affects the caster (self + 4 allies = 5), not
 *    just the 4 allies the wiki's missing fact line would otherwise leave this at.
 *  - 41780/3 (Tome of Resolve, "Chapter 4: Shining River"): same shape — no "allied targets" fact
 *    despite a party-wide description — and user-confirmed 2026-08-21 it also affects the caster
 *    (self + 4 allies = 5), same reasoning as Stalwart Stand above.
 */
const TOME_CHAPTER_TARGET_COUNT_OVERRIDES: Record<number, Record<number, number>> = {
  41780: { 3: 5 },
  42259: { 3: 5 }
}

/** Boon/condition-shaped facts among a Tome chapter's wiki-sourced `RelicFactLine`s (e.g.
 *  "Burning"/"Might") — same extraction intent as `extractFromFacts`, but reading the wiki's
 *  `{label, values, params}` shape instead of the API's `Fact` shape, since these 15 chapter
 *  skills have no API `Fact` data to read at all (see `TomeChapter`'s doc comment). A fact's first
 *  bare positional value is its duration in seconds (matches every boon/condition line seen across
 *  all 15 chapters, e.g. `{{skill fact|Might|8|stacks=5}}` = 8s Might, `{{skill fact|Burning|3}}` =
 *  3s Burning) and `stacks=` (when present) is `apply_count` — no `requires_trait` concept exists
 *  in this wiki data, so every chapter fact is unconditional. WvW-vs-PvE line selection already
 *  happened during parsing (`scripts/fetch-tome-chapters.ts`), unlike `extractFromFacts`'s
 *  `wvwFactOverrides` lookup which corrects an API value after the fact — there's nothing to
 *  correct here since the wiki-sourced value already IS the WvW one.
 */
export function tomeChapterBoonSources(chapter: TomeChapter, durationPercent: { boon: number; condition: number }): BoonConditionSource[] {
  const out: BoonConditionSource[] = []
  // `targetCount`: the wiki's own "allied targets" fact line, present on 7 of the 15 chapters —
  // absent on the other 8, which is `null`/"unknown" rather than "self-only" for the same reason
  // `BoonConditionSource.targetCount`'s doc comment gives for the API-sourced case, unless
  // `TOME_CHAPTER_TARGET_COUNT_OVERRIDES` above has a curated value for this chapter.
  const alliedTargetsFact = chapter.facts.find((f) => f.label === 'allied targets')
  const parsedTargetCount = alliedTargetsFact ? Number(alliedTargetsFact.values[0]) : NaN
  const targetCount = Number.isFinite(parsedTargetCount)
    ? parsedTargetCount
    : (TOME_CHAPTER_TARGET_COUNT_OVERRIDES[chapter.tomeSkillId]?.[chapter.slotIndex] ?? null)
  for (const fact of chapter.facts) {
    const status = fact.label.charAt(0).toUpperCase() + fact.label.slice(1)
    const isBoon = isBoonName(status)
    const isCondition = isConditionName(status)
    if (!isBoon && !isCondition) continue
    const duration = Number(fact.values[0])
    if (!Number.isFinite(duration)) continue

    const percent = isCondition ? durationPercent.condition : durationPercent.boon
    out.push({
      sourceKind: 'skill',
      sourceId: chapter.tomeSkillId,
      sourceName: `${chapter.name}`,
      sourceIcon: chapter.icon,
      boonOrConditionName: status,
      isCondition,
      category: isCondition ? 'condition' : 'boon',
      baseDurationSeconds: duration,
      scaledDurationSeconds: duration * (1 + percent / 100),
      applyCount: fact.params.stacks ? Number(fact.params.stacks) : 1,
      requiresTraitId: null,
      targetCount
    })
  }
  return out
}

/**
 * A relic's proc trigger, restricted to the shapes this app already models a deterministic
 * frequency for (`docs/relic-trigger-classification.md`, TODO.md's "Relic proc integration sweep,"
 * leg 1): the equipped Elite skill slot, the equipped Heal skill slot, or any equipped Heal/
 * Utility/Elite skill carrying one of `Skill.categories`' ability-type strings (Well, Signet,
 * Mantra, ...) — Relic of the Astral Ward's own 2-step signet mechanic fits this `ability` shape
 * fine (leg 7, 2026-08-16, see `RELIC_TRIGGER_GATES`'s doc comment). Mantra-final-charge (Relic of
 * the Firebrand) is the one trigger shape genuinely absent from this type — its payload is a
 * duration-percent modifier, not a discrete boon/named-fact grant, so no `RelicTriggerGate` shape
 * would give it anywhere to go; see `RELIC_TRIGGER_GATES`'s doc comment for the full reasoning.
 */
type RelicTriggerGate = { kind: 'elite' } | { kind: 'heal' } | { kind: 'ability'; categories: string[] }

/**
 * Leg 2 of TODO.md's "Relic proc integration sweep": the curated subset of
 * `docs/relic-trigger-classification.md`'s 19 deterministic-trigger/real-boon-payload candidates
 * that are ALSO safely representable as ordinary `BoonConditionSource`/aura entries — i.e. every
 * fact this relic grants that matters here is a literal `BOON_NAMES`/`CONDITION_NAMES`/
 * `AURA_NAMES` status with a plain fixed duration, parsed via `extractFromRelicFacts` below (same
 * `RelicFactLine` shape `tomeChapterBoonSources` already parses for Firebrand Tome chapters — relic
 * wiki pages reuse the identical `{{skill fact}}` template, see `RelicFactLine`'s doc comment).
 * Opt-in only, same "curated table, fails open" discipline as `DODGE_TRIGGER_NOTES`/
 * `BUFF_INSTANCE_LABELS`: a relic id absent here contributes nothing to either aggregate, same as
 * before this mechanism existed — `formatRelicDescription` still shows its full tooltip either way.
 *
 * 12 of the 19 candidates are wired below; the other 7 stay unwired, each for a reason the
 * classification doc's one-line payload gloss didn't capture:
 * - Relic of Leadership (100625): wiki-confirmed (2026-08-16 follow-up) the payload is genuinely
 *   boon-less — `{{skill fact|Conditions Converted to Boons|5|game mode=pve}}` names a count (5
 *   PvE / 3 WvW/PvP) but never which boon(s) result, and no separate mapping table exists on the
 *   wiki either (checked). No literal `BOON_NAMES` status for `extractFromRelicFacts` to match.
 *   Permanently excluded, not deferred — same "no shape fits it" conclusion as Sorrow below.
 * - Relic of Sorrow (103424): re-checked against its own `relic-effects.json` facts for leg 2, then
 *   wiki-confirmed word for word in leg 4 (`docs/relic-trigger-classification.md`) — its "protects
 *   allies" prose describes a custom "Relic of Sorrow" damage-reduction/reflect zone plus pulsing
 *   healing (`effect` fact literally named "Relic of Sorrow," not "Protection"), never the Protection
 *   boon. The classification doc's plain-English payload gloss was imprecise here; correcting that,
 *   not re-litigating leg 1's trigger classification itself (still correctly bucketed as `ELITE`).
 *   Permanently excluded, not deferred — no `BoonConditionSource`/`AuraSource` shape fits it at all.
 * - Relic of the Twin Generals (101767): **Wired 2026-08-16** (leg 6) for its flat portion only —
 *   base Might (6 stacks, 10s, on Heal skill use) and Weakness (4s, on nearby enemies) are both
 *   fixed grants regardless of how many enemies the triggering hit struck, so `relicSources` below
 *   filters out the *other* Might fact (`alt=Might per Hit`, scales with enemies struck, same
 *   "don't invent a magnitude this app doesn't model" reasoning the whole sweep exists to apply)
 *   before calling `extractFromRelicFacts`, rather than wiring a blind pass-through of both.
 * - Relic of the Firebrand (100453): **Permanently excluded 2026-08-16** (leg 7), same bucket as
 *   Sorrow/Leadership above, reached for a different reason. Its payload is "+20% Boon Duration," a
 *   passive attribute-style modifier, not a discrete boon status with its own duration — no
 *   `BoonConditionSource`/`AuraSource` shape fits it at all, so it was never a candidate for this
 *   table regardless of trigger. It also isn't a fit for `new_attribute_bonus_infra`-style permanent
 *   attribute infra (Power Overwhelming/Deadly Strength's shape): those model a *steady-state*
 *   condition (an attunement, a stack count) this app's static build view can evaluate directly: the
 *   buff here only exists for 4s after "the final charge of a mantra skill," and how often that
 *   recurs depends on how many charges the build's mantras carry and how the player actually plays
 *   them — the same "no fixed frequency this app could assume without inventing one" reasoning that
 *   already excludes the dodge relics and Unseen Invasion/Wayfinder's Superspeed. No code change;
 *   already excluded (never added to `RELIC_TRIGGER_GATES`).
 * - Relic of the Astral Ward (100388): **Wired 2026-08-16** (leg 7) after all — re-examining the
 *   "2-step signet mechanic" this app previously deferred on found it isn't actually a different
 *   shape than every other `ability`-gated relic here, just a different-looking trigger condition.
 *   This table already doesn't model any relic's per-fire cooldown/frequency (e.g. Chronomancer
 *   fires its Quickness on every single Well cast with no accounting for how often a well is
 *   actually available) — Astral Ward firing its Resistance payload on every *2nd* Signet cast
 *   instead of every cast is the same kind of frequency detail this table already glosses over
 *   everywhere else, not a new non-deterministic-trigger problem. Wired as `ability`-gated on
 *   `Signet` (51 skills carry that category per `skills.json`); its "spawns then consumes" 2-step
 *   detail is called out honestly in `RELIC_NAMED_FACT_SOURCES`'s Cleanse entry below instead of
 *   silently assumed away. See Relic of Febe (101116) for the same "boon here, Cleanse in the other
 *   table" split payload shape.
 * - Relic of the Pack's Superspeed fact / Relic of Febe's condition-removed facts: real facts, but
 *   `Superspeed`/condition-cleanse are tracked via the separate `computeNamedFactSources`/
 *   `MISCELLANEOUS_MATCHERS` pipeline, not `BOON_NAMES` — `extractFromRelicFacts`'s strict
 *   `classify` match silently drops them, same as it silently drops every non-boon/aura fact below
 *   (Relic of Fire's own "Damage Increase," every relic's `targets`/`radius`/recharge facts, ...).
 *   **Wired 2026-08-16** (leg 5, `RELIC_NAMED_FACT_SOURCES`/`computeRelicNamedFactSources` below) —
 *   this table now also gates 6 more relics whose only real payload is a `computeNamedFactSources`
 *   name rather than a `BOON_NAMES` boon (Cerus, Trooper, Wizard's Tower, Water, Dagda, Bava
 *   Nisos) — never candidates for `extractFromRelicFacts` above, so absent from the 19-candidate
 *   count, but the same trigger-classification table gates both pipelines.
 *
 * Relic of the Zephyrite (100893) — the sweep's own motivating case — is the one entry below whose
 * payload isn't a flat pass-through of `extractFromRelicFacts`: its crystal duration scales with the
 * recharge of the elite skill that triggered it (a wiki-curated stepped table, see
 * `zephyriteCrystalDurationSeconds`), unlike every other relic here, which grants the same fixed
 * duration regardless of which qualifying skill fired it. `relicSources` below overrides its
 * `Protection`/`Resolution` entries' duration after the normal parse, rather than trusting
 * `relic-effects.json`'s own `protection`/`resolution` facts (`1`s — the crystal's per-pulse tick,
 * not its total lifetime).
 */
const RELIC_TRIGGER_GATES: Record<number, RelicTriggerGate> = {
  100063: { kind: 'elite' }, // Relic of Surging — Shocking Aura
  100435: { kind: 'elite' }, // Relic of the Earth — Protection + Magnetic Aura
  100752: { kind: 'elite' }, // Relic of the Pack — Might + Fury (Superspeed excluded, see above)
  100893: { kind: 'elite' }, // Relic of the Zephyrite — Protection + Resolution, duration computed per zephyriteCrystalDurationSeconds
  100385: { kind: 'heal' }, // Relic of the Centaur — Stability
  100455: { kind: 'heal' }, // Relic of Durability — Protection + Regeneration + Resolution
  100794: { kind: 'heal' }, // Relic of Resistance — Resistance
  101116: { kind: 'heal' }, // Relic of Febe — Swiftness (condition-removed facts excluded, see above)
  103984: { kind: 'heal' }, // Relic of Reunification — Frost Aura + Light Aura
  104256: { kind: 'heal' }, // Relic of Altruism — Might + Fury
  104501: { kind: 'heal' }, // Relic of Fire — Fire Aura (Damage Increase excluded, not a boon)
  100450: { kind: 'ability', categories: ['Well'] }, // Relic of the Chronomancer — Quickness
  104733: { kind: 'ability', categories: ['Cantrip', 'Meditation'] }, // Relic of the Phenom — Protection
  109267: { kind: 'ability', categories: ['Well', 'Consecration'] }, // Relic of the Sacred Grounds — Protection
  // Leg 5 (2026-08-16) — gates 6 relics whose only wireable payload is a `computeNamedFactSources`
  // name, not a boon/aura (`RELIC_NAMED_FACT_SOURCES` below consumes these too).
  100074: { kind: 'elite' }, // Relic of Cerus — Corrupt (1 boon converted, on enemies)
  100557: { kind: 'elite' }, // Relic of the Wizard's Tower — Pull
  100942: { kind: 'elite' }, // Relic of Dagda — Daze (on enemies)
  100659: { kind: 'heal' }, // Relic of the Water — Cleanse
  100411: { kind: 'ability', categories: ['Shout'] }, // Relic of the Trooper — Cleanse
  104848: { kind: 'ability', categories: ['Stance'] }, // Relic of Bava Nisos — Cleanse
  // Leg 6 (2026-08-16) — wiki re-check turned up 2 more real candidates from the "needs a real
  // decision" pile TODO.md's leg-5 note left open.
  101767: { kind: 'heal' }, // Relic of the Twin Generals — Might + Weakness, Might-per-Hit fact excluded (see above)
  100448: { kind: 'elite' }, // Relic of the Citadel — Stun, duration computed per citadelBuildStunDurationSeconds
  // Leg 7 (2026-08-16) — closes the sweep's last 2 open items (see this table's own doc comment):
  // Astral Ward wired after all, Firebrand permanently excluded (never added here).
  100388: { kind: 'ability', categories: ['Signet'] } // Relic of the Astral Ward — Resistance (Cleanse in RELIC_NAMED_FACT_SOURCES)
}

const ZEPHYRITE_RELIC_ID = 100893
const TWIN_GENERALS_RELIC_ID = 101767
const CITADEL_RELIC_ID = 100448

const CITADEL_STUN_MIN_RECHARGE_SECONDS = 60
const CITADEL_STUN_MAX_RECHARGE_SECONDS = 180

/**
 * Relic of the Citadel's (100448) actual Stun duration for one elite skill's own recharge in
 * seconds. TODO.md's leg-5 note assumed this scaled with "the triggering hit's defiance damage" —
 * a 2026-08-16 wiki re-check of the page's own Mechanics section corrects that: "The minimum
 * duration of 1 second applies to any elite ability with a cooldown shorter than 60 seconds. The
 * duration scales linearly with [cooldown], capping at 180 seconds (3 minutes) for the maximum 3
 * second stun duration" — i.e. a deterministic function of the equipped Elite skill's own
 * `Recharge` fact, the same quantity `zephyriteCrystalDurationSeconds` already reads, just a
 * continuous linear formula here instead of a stepped table (how the wiki documents this one).
 */
function citadelStunDurationSeconds(eliteRechargeSeconds: number): number {
  if (eliteRechargeSeconds <= CITADEL_STUN_MIN_RECHARGE_SECONDS) return 1
  if (eliteRechargeSeconds >= CITADEL_STUN_MAX_RECHARGE_SECONDS) return 3
  return (
    1 +
    ((eliteRechargeSeconds - CITADEL_STUN_MIN_RECHARGE_SECONDS) / (CITADEL_STUN_MAX_RECHARGE_SECONDS - CITADEL_STUN_MIN_RECHARGE_SECONDS)) * 2
  )
}

/**
 * `citadelStunDurationSeconds`, applied to `build`'s actual equipped Elite skill(s) — `Math.min`
 * across every equipped Elite (same Revenant dual-legend "don't assume which legend is active"
 * bias `zephyriteBuildCrystalDurationSeconds` uses), falling back to the minimum 1s tier when no
 * equipped Elite skill carries a `Recharge` fact at all.
 */
function citadelBuildStunDurationSeconds(build: Build, legends: Legend[], skillsById: Map<number, Skill>): number {
  const recharges = equippedEliteSkillIds(build, legends)
    .map((id) => skillsById.get(id)?.facts.find((f) => f.type === 'Recharge'))
    .map((fact) => (fact && typeof fact.value === 'number' ? fact.value : null))
    .filter((v): v is number => v !== null)
  return citadelStunDurationSeconds(recharges.length > 0 ? Math.min(...recharges) : 0)
}

/**
 * Relic of the Zephyrite's (100893) crystal duration tiers, hand-curated from the wiki (TODO.md's
 * "Relic proc integration sweep" leg-3 note): the wiki documents this as a stepped table keyed by
 * the *triggering elite skill's own recharge*, not a formula, so this is kept the same shape rather
 * than approximated by one. Ascending `maxRecharge`; the last entry's `Infinity` covers the wiki's
 * open-ended "61+ seconds" tier.
 */
const ZEPHYRITE_CRYSTAL_DURATION_TIERS: Array<{ maxRecharge: number; durationSeconds: number }> = [
  { maxRecharge: 0, durationSeconds: 4 },
  { maxRecharge: 20, durationSeconds: 5 },
  { maxRecharge: 40, durationSeconds: 6 },
  { maxRecharge: 60, durationSeconds: 7 },
  { maxRecharge: Infinity, durationSeconds: 8 }
]

/** `ZEPHYRITE_CRYSTAL_DURATION_TIERS`, applied to one elite skill's recharge in seconds. */
function zephyriteCrystalDurationSeconds(eliteRechargeSeconds: number): number {
  const tier = ZEPHYRITE_CRYSTAL_DURATION_TIERS.find((t) => eliteRechargeSeconds <= t.maxRecharge)
  return (tier ?? ZEPHYRITE_CRYSTAL_DURATION_TIERS[ZEPHYRITE_CRYSTAL_DURATION_TIERS.length - 1]).durationSeconds
}

/**
 * The equipped Elite skill id(s) a build carries, read straight off `Skill.facts`' own `Recharge`
 * fact below — `[build.skills.elite]` for a standard profession (`[]` when unset), or every equipped
 * legend's own `elite` id for Revenant. Deliberately reads BOTH equipped legends when present, never
 * preferring `RevenantSkillSelection.activeLegendIndex` — that field's own doc comment says it's
 * "display-only, doesn't affect computed totals," and both legends' kits already contribute equally
 * everywhere else in this file (`healUtilityEliteSkillIds`).
 */
function equippedEliteSkillIds(build: Build, legends: Legend[]): number[] {
  if (build.skills.kind === 'revenant') {
    return build.skills.legends
      .filter((id): id is string => id !== null)
      .map((id) => legends.find((l) => l.id === id)?.elite)
      .filter((id): id is number => id !== undefined)
  }
  return build.skills.elite !== null ? [build.skills.elite] : []
}

/**
 * Relic of the Zephyrite's actual crystal duration for `build` — the minimum
 * `zephyriteCrystalDurationSeconds` across every equipped elite skill that carries a `Recharge`
 * fact. `Math.min` (not the first id, not an average) is the same "don't invent/overstate a number
 * this app doesn't actually guarantee" bias `RELIC_TRIGGER_GATES`'s own doc comment applies
 * elsewhere: a Revenant with 2 legends can't guarantee which one is active when the relic fires, so
 * this reports the shorter of the two rather than assuming the longer. Falls back to the shortest
 * tier (4s) when no equipped elite skill carries a `Recharge` fact at all — shouldn't happen once
 * `relicTriggerSatisfied` confirms an elite skill is equipped, but stays conservative rather than
 * throwing.
 */
function zephyriteBuildCrystalDurationSeconds(build: Build, legends: Legend[], skillsById: Map<number, Skill>): number {
  const recharges = equippedEliteSkillIds(build, legends)
    .map((id) => skillsById.get(id)?.facts.find((f) => f.type === 'Recharge'))
    .map((fact) => (fact && typeof fact.value === 'number' ? fact.value : null))
    .filter((v): v is number => v !== null)
  return zephyriteCrystalDurationSeconds(recharges.length > 0 ? Math.min(...recharges) : 0)
}

/**
 * Every id a build's own Heal/Utility/Elite skill selection contributes — deliberately narrower
 * than `skillIdsForBuild` (excludes weapon skills, pets, the profession-mechanic bar, Revenant's
 * own legend-swap skill): `RELIC_TRIGGER_GATES`'s `ability` shape means "does an equipped
 * Heal/Utility/Elite skill carry this category," matching `docs/relic-trigger-classification.md`'s
 * own scoping exactly, not "does anything on the bar."
 */
function healUtilityEliteSkillIds(build: Build, legends: Legend[]): number[] {
  if (build.skills.kind === 'revenant') {
    return build.skills.legends
      .filter((id): id is string => id !== null)
      .map((id) => legends.find((l) => l.id === id))
      .filter((l): l is Legend => l !== undefined)
      .flatMap((l) => [l.heal, l.elite, ...l.utilities])
  }
  return [build.skills.heal, ...build.skills.utility, build.skills.elite].filter((id): id is number => id !== null)
}

/**
 * Whether `build` satisfies a `RelicTriggerGate`. For Revenant, both `elite`/`heal` are trivially
 * true whenever at least 1 legend is equipped — a legend's kit always includes both slots (see
 * `RevenantSkillSelection`'s doc comment), unlike a standard profession where either slot can still
 * be `null` mid-edit.
 */
function relicTriggerSatisfied(gate: RelicTriggerGate, build: Build, legends: Legend[], skillsById: Map<number, Skill>): boolean {
  if (build.skills.kind === 'revenant') {
    if (gate.kind === 'elite' || gate.kind === 'heal') return build.skills.legends.some((id) => id !== null)
  } else {
    if (gate.kind === 'elite') return build.skills.elite !== null
    if (gate.kind === 'heal') return build.skills.heal !== null
  }
  return healUtilityEliteSkillIds(build, legends).some((id) => skillsById.get(id)?.categories.some((c) => gate.categories.includes(c)))
}

/**
 * Parses a relic's wiki-sourced `RelicFactLine[]` (`RelicEffect.facts`) into `BoonConditionSource`
 * entries — the relic counterpart to `tomeChapterBoonSources`, reusing the exact same `{label,
 * values, params}` parsing since relic wiki pages carry the identical `{{skill fact}}` template.
 * Two label shapes appear in `relic-effects.json`:
 * - A literal boon/condition/aura name as the label itself (`protection`, `might`, `resistance`,
 *   ...), duration as the fact's first bare value, `stacks=` (when present) as `apply_count` — same
 *   convention `tomeChapterBoonSources` already established.
 * - `effect`, wrapping the proc's display name in its first value (occasionally suffixed
 *   `" (effect)"`, e.g. `"Shocking Aura (effect)"`) with duration as the second value — how every
 *   aura-granting relic below (and several non-aura custom effects `classify` correctly rejects,
 *   e.g. "Relic of Sorrow") is written on the wiki.
 * Every other fact shape (`targets`, `radius`, `recharge`, a bare stack-count with no boon name, a
 * custom-named effect) is silently skipped — `classify` returning `null` is the only exclusion rule
 * this function applies; `RELIC_TRIGGER_GATES`'s own doc comment explains why the harder exclusions
 * (Twin Generals' variable per-hit Might, Leadership's boon-less conversion) are handled by omitting
 * the relic from that table entirely rather than by a smarter parse here.
 */
function extractFromRelicFacts(
  facts: RelicFactLine[],
  durationPercent: { boon: number; condition: number },
  sourceId: number,
  sourceName: string,
  sourceIcon: string,
  targetCount: number | null,
  classify: (status: string) => BoonConditionCategory | null
): BoonConditionSource[] {
  const out: BoonConditionSource[] = []
  for (const fact of facts) {
    const isEffect = fact.label.toLowerCase() === 'effect'
    const status = isEffect ? (fact.values[0]?.replace(/\s*\(effect\)$/, '') ?? '') : fact.label.charAt(0).toUpperCase() + fact.label.slice(1)
    const duration = Number(isEffect ? fact.values[1] : fact.values[0])
    const category = classify(status)
    if (!category || !Number.isFinite(duration)) continue
    const percent = category === 'condition' ? durationPercent.condition : category === 'boon' ? durationPercent.boon : 0
    out.push({
      sourceKind: 'relic',
      sourceId,
      sourceName,
      sourceIcon,
      boonOrConditionName: status,
      isCondition: category === 'condition',
      category,
      baseDurationSeconds: duration,
      scaledDurationSeconds: duration * (1 + percent / 100),
      applyCount: fact.params.stacks ? Number(fact.params.stacks) : 1,
      requiresTraitId: null,
      targetCount
    })
  }
  return out
}

/**
 * The build's equipped relic's `RELIC_TRIGGER_GATES`-eligible boon/condition/aura sources, or `[]`
 * when no relic is equipped, the equipped relic isn't in `RELIC_TRIGGER_GATES`, its trigger gate
 * isn't satisfied, or (aura callers) it grants no aura facts at all. `targetCount` is resolved once
 * from the relic's own `targets`/`allied targets` fact (`null`, i.e. self-only/unknown, when
 * absent) — every relic in `RELIC_TRIGGER_GATES` grants its whole payload to the same reach, unlike
 * a skill/trait source that can mix self- and party-wide facts on one id, so a single value per
 * relic (rather than `extractFromFacts`'s per-fact `resolveTargetCount`) is sufficient here.
 */
function relicSources(
  build: Build,
  gameData: { relics: Relic[]; relicEffects: RelicEffectsById; skills: Skill[]; legends: Legend[] },
  durationPercent: { boon: number; condition: number },
  classify: (status: string) => BoonConditionCategory | null
): BoonConditionSource[] {
  if (build.relicId === null) return []
  const gate = RELIC_TRIGGER_GATES[build.relicId]
  if (!gate) return []
  const relic = gameData.relics.find((r) => r.id === build.relicId)
  const effect = gameData.relicEffects[build.relicId]
  if (!relic || !effect) return []
  const skillsById = new Map(gameData.skills.map((s) => [s.id, s]))
  if (!relicTriggerSatisfied(gate, build, gameData.legends, skillsById)) return []
  const targetsFact = effect.facts.find((f) => f.label === 'targets' || f.label === 'allied targets')
  const targetCount = targetsFact ? Number(targetsFact.values[0]) : null
  // Twin Generals carries 2 same-status Might facts — a flat "6 stacks" grant and a separate
  // "Might per Hit" that scales with how many enemies the triggering hit struck. Only the flat one
  // is a fixed grant this app can safely report; the per-hit fact is filtered out here (rather than
  // wired) so `extractFromRelicFacts` never sees it, see `RELIC_TRIGGER_GATES`'s own doc comment.
  const factsToParse =
    relic.id === TWIN_GENERALS_RELIC_ID ? effect.facts.filter((f) => f.params.alt !== 'Might per Hit') : effect.facts
  const parsed = extractFromRelicFacts(
    factsToParse,
    durationPercent,
    relic.id,
    relic.name,
    relic.icon,
    Number.isFinite(targetCount) ? targetCount : null,
    classify
  )
  if (relic.id !== ZEPHYRITE_RELIC_ID) return parsed
  // Zephyrite's own `protection`/`resolution` facts carry the crystal's 1s per-pulse tick, not its
  // total lifetime — see `zephyriteBuildCrystalDurationSeconds`'s doc comment for why the real
  // duration is computed instead of read off `relic-effects.json` directly.
  const duration = zephyriteBuildCrystalDurationSeconds(build, gameData.legends, skillsById)
  return parsed.map((source) => {
    const percent = source.category === 'condition' ? durationPercent.condition : durationPercent.boon
    return { ...source, baseDurationSeconds: duration, scaledDurationSeconds: duration * (1 + percent / 100) }
  })
}

/**
 * Every boon/condition source (skill or trait) a build provides. Walks
 * equipped heal/utility/elite skills, auto-granted minor traits on equipped
 * specialization lines, and chosen major traits — gated by requires_trait so
 * conditional facts only show up when the trait that unlocks them is active.
 *
 * `baseDurationSeconds` is the WvW-adjusted value (see `wvwFactOverrides` below);
 * `scaledDurationSeconds` further applies the build's gear-derived boon/condition duration %
 * (Concentration/Expertise from equipped armor/trinkets/back/weapons). Food/utility consumables
 * aren't fetched/modeled yet, so they're not included in either number — see TODO.md.
 *
 * Also walks every weapon-derived skill from the build's currently-`environment`-relevant weapon
 * sets (see `weaponSkillIdsForBuild`) — both land sets or both underwater sets always contribute,
 * per `Build.activeWeaponSet`'s doc comment.
 *
 * The GW2 API's `Fact.duration` for a Buff fact is PvE data (or the sole value, for facts with no
 * WvW/PvE split) — see scripts/fetch-wvw-splits.ts and docs/game-data.md for how that's verified
 * and how `gameData.wvwFactOverrides` is derived from the wiki. Every Buff fact is checked against
 * that map: an `'omit'` entry drops the fact (PvE-only, no WvW variant), a number entry replaces
 * `fact.duration` with the WvW-tagged value. Facts with no entry are used as-is (either unsplit,
 * or a split the fetch script couldn't confidently resolve — see TODO.md).
 *
 * Also includes the equipped relic's boon/condition facts, when it's one of `RELIC_TRIGGER_GATES`'
 * curated candidates AND that gate is satisfied (`relicSources`) — added 2026-08-16 as leg 2 of
 * TODO.md's "Relic proc integration sweep." Every OTHER relic, and every fact even a wired relic
 * grants that isn't a literal `BOON_NAMES`/`CONDITION_NAMES` status, still contributes nothing here
 * (unchanged from before this existed) — see `RELIC_TRIGGER_GATES`'s own doc comment for the full
 * scope/exclusion reasoning.
 */

/** Same composite content-key `SkillsEditor.tsx`'s `boonFactContentKey` uses to recognize "the same
 *  boon/condition grant, computed off a different id" — deliberately excludes `sourceId`/
 *  `sourceName`/`sourceIcon`, which differ between an `ADDITIVE_FLIP_PAIRS` base and its target by
 *  construction. Duplicated here (not imported from the renderer) since this shared module can't
 *  depend on `src/renderer`. */
function additiveFlipContentKey(f: BoonConditionSource): string {
  return [f.category, f.boonOrConditionName, f.isCondition, f.scaledDurationSeconds, f.applyCount, f.requiresTraitId, f.targetCount, f.instanceLabel ?? '', f.legendName ?? ''].join('|')
}

/** Same shape, for `NamedFactSource` (Control/Miscellaneous/Strip-Corrupt-Cleanse) — mirrors
 *  `SkillsEditor.tsx`'s `namedFactContentKey`. */
function additiveFlipNamedFactContentKey(f: NamedFactSource): string {
  return [f.name, f.detail ?? '', f.targetCount].join('|')
}

/** `sourceId -> targetId` reversed once, rather than re-deriving it per id inside the hot loop
 *  below — `ADDITIVE_FLIP_PAIRS` never changes at runtime. */
const ADDITIVE_FLIP_PAIR_SOURCE_BY_TARGET_ID: ReadonlyMap<number, number> = new Map(
  Array.from(ADDITIVE_FLIP_PAIRS.entries(), ([sourceId, pair]) => [pair.targetId, sourceId])
)

/**
 * Walks `skillIds`, extracting each skill's facts via `extractFn`, EXCEPT: when the current id is
 * an `ADDITIVE_FLIP_PAIRS` target, any of its own extracted items sharing a `contentKey` with
 * something its own base skill already contributed are dropped before appending. Shared by all 4
 * `skillIds`-driven aggregate computations (`computeBoonConditionSources`/`computeAuraSources`/
 * `computeComboSources`/`computeNamedFactSources`) — see `ADDITIVE_FLIP_PAIR_TARGET_IDS`'s own doc
 * comment for why the target id is deliberately still walked at all (it carries real content the
 * base doesn't, e.g. Darkrazor's Daring's Band-Together-enhanced cast (72366) adding Resistance/
 * Protection its base (41220) doesn't have) rather than skipped outright — only content the two
 * ids genuinely SHARE (e.g. both independently carrying the same 2 Stability facts, same Daze) gets
 * collapsed to one, mirroring `SkillsEditor.tsx`'s `additiveEnhancementFacts`'s identical base-vs-
 * target diff for the tooltip. `withFlipChain` always walks base -> target in order, so the base's
 * entry is guaranteed to already be in `emittedBySourceId` by the time its target is processed.
 */
function extractSkillSourcesWithAdditiveDedup<T>(
  skillIds: number[],
  skillsById: Map<number, Skill>,
  extractFn: (skill: Skill) => T[],
  contentKey: (item: T) => string
): T[] {
  const out: T[] = []
  const emittedBySourceId = new Map<number, Set<string>>()
  for (const id of skillIds) {
    const skill = skillsById.get(id)
    if (!skill) continue
    let extracted = extractFn(skill)
    const additiveSourceId = ADDITIVE_FLIP_PAIR_SOURCE_BY_TARGET_ID.get(id)
    if (additiveSourceId !== undefined) {
      const alreadyEmitted = emittedBySourceId.get(additiveSourceId) ?? new Set<string>()
      extracted = extracted.filter((item) => !alreadyEmitted.has(contentKey(item)))
    }
    if (ADDITIVE_FLIP_PAIRS.has(id)) {
      emittedBySourceId.set(id, new Set(extracted.map(contentKey)))
    }
    out.push(...extracted)
  }
  return out
}

export function computeBoonConditionSources(
  build: Build,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    itemStats: ItemStat[]
    itemStatLegalIds: ItemStatLegalIds
    infusions: Infusion[]
    runes: Rune[]
    sigils: Sigil[]
    food: Consumable[]
    utility: Consumable[]
    wvwFactOverrides: WvwFactOverrides
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
    familiars: Familiar[]
    relics: Relic[]
    relicEffects: RelicEffectsById
  }
): BoonConditionSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const legendIds = equippedLegendIds(build)
  const out: BoonConditionSource[] = []
  const skillsById = new Map(gameData.skills.map((s) => [s.id, s]))

  const gearTotals = computeGearAttributeTotals(build, gameData)
  const durationPercent = {
    boon: boonDurationPercent(gearTotals),
    condition: conditionDurationPercent(gearTotals)
  }

  out.push(...relicSources(build, gameData, durationPercent, classifyBoonCondition))

  const bundleContributions = bundleContributionsForBuild(build, gameData.professions, skillsById, gameData.tomeChapters)
  const skillIds = [
    ...skillIdsForBuild(build, gameData.legends, gameData.pets, gameData.professions, skillsById, gameData.soulbeastBeastmode, gameData.familiars),
    ...bundleContributions.kitSkillIds
  ]
  out.push(
    ...extractSkillSourcesWithAdditiveDedup(
      skillIds,
      skillsById,
      (skill) =>
        extractFromFacts(
          skill.facts,
          skill.traitedFacts,
          activeIds,
          legendIds,
          'skill',
          skill.id,
          skill.name,
          skill.icon,
          durationPercent,
          gameData.wvwFactOverrides.skill[skill.id],
          classifyBoonCondition,
          gameData.legends
        ),
      additiveFlipContentKey
    )
  )
  // `branchConditionalFacts`' own `countsTowardTotals`-flagged branch(es), if any — see
  // `ConditionalBranch.countsTowardTotals`'s doc comment for which branches get this and why.
  // `healingPower` is passed as `0` rather than threaded through from gear: every branch flagged
  // `countsTowardTotals` today grants only flat-duration Buff facts with no Healing-Power-scaled
  // component (the Chants' own Barrier/Healing numbers are `numericLines`, display-only, never
  // built into a `BoonConditionSource` — see `chantOfRecuperationSections`), so this only matters
  // if a future flagged branch's `.facts` ever needs it, at which point this would need real
  // `characterAttributes.healingPower` threaded in instead (this function doesn't compute character
  // attributes today, only gear-derived duration %). None of `ADDITIVE_FLIP_PAIRS`' 6 ids has a
  // `branchConditionalFacts` entry today, so this loop doesn't need the same dedup treatment above.
  // `category !== 'aura'` filter (fixed 2026-08-19): a branch's `.facts` can mix boon/condition AND
  // aura entries (e.g. `radiantResolveSections`' "Activate" branch grants Light Aura) — without this
  // filter an aura fact leaked into this function's output, which every caller (this function's own
  // `BoonConditionSource.category` doc comment, `SlotTile.tsx`'s `iconItems`) assumes never happens,
  // so it silently rendered in the Boons row wherever a caller doesn't also gate by a fixed name list
  // (`SlotTile.tsx` doesn't; `BoonConditionSummaryPanel.tsx`'s `BOON_NAMES` list happened to hide it
  // instead of surfacing it, which is why the two views disagreed). See `computeAuraSources` below
  // for the matching loop that now actually surfaces these aura facts where they belong.
  for (const id of skillIds) {
    const skill = skillsById.get(id)
    if (!skill) continue
    for (const branch of branchConditionalFacts(skill, durationPercent, 0, activeIds, legendIds, gameData.legends) ?? []) {
      if (branch.countsTowardTotals) out.push(...branch.facts.filter((f) => f.category !== 'aura'))
    }
  }
  for (const chapter of bundleContributions.tomeChapters) {
    out.push(...tomeChapterBoonSources(chapter, durationPercent))
  }

  for (const line of build.specializations) {
    if (line == null) continue
    for (const trait of gameData.traits) {
      if (trait.specializationId !== line.specializationId) continue
      const isMinor = trait.slot === 'Minor'
      const isChosenMajor = trait.slot === 'Major' && line.chosenTraitIds.includes(trait.id)
      if (!isMinor && !isChosenMajor) continue
      out.push(
        ...extractFromFacts(
          trait.facts,
          trait.traitedFacts,
          activeIds,
          legendIds,
          'trait',
          trait.id,
          trait.name,
          trait.icon,
          durationPercent,
          gameData.wvwFactOverrides.trait[trait.id],
          classifyBoonCondition,
          gameData.legends
        )
      )
    }
  }

  return out
}

/** Shared by `computeAuraSources`/`computeComboSources`/`computeNamedFactSources`: every equipped
 *  skill id, matching `computeBoonConditionSources`'s own skill-id gathering exactly (same helpers,
 *  same rules) but factored out since none of these callers need `computeBoonConditionSources`'s
 *  gear-derived duration-% computation (Concentration/Expertise don't affect any of these facts). */
function equippedSkillsById(
  build: Build,
  gameData: {
    skills: Skill[]
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
    familiars: Familiar[]
  }
): { skillsById: Map<number, Skill>; skillIds: number[] } {
  const skillsById = new Map(gameData.skills.map((s) => [s.id, s]))
  const bundleContributions = bundleContributionsForBuild(build, gameData.professions, skillsById, gameData.tomeChapters)
  const skillIds = [
    ...skillIdsForBuild(build, gameData.legends, gameData.pets, gameData.professions, skillsById, gameData.soulbeastBeastmode, gameData.familiars),
    ...bundleContributions.kitSkillIds
  ]
  return { skillsById, skillIds }
}

/**
 * Every Aura source a build provides — same skill/trait-walking rules as
 * `computeBoonConditionSources` (equipped skills, weapon skills, auto-granted minor traits, chosen
 * major traits, `requires_trait`/WvW-override gating), just classified against `AURA_NAMES` instead
 * of `BOON_NAMES`/`CONDITION_NAMES`. Deliberately a separate function rather than folded into
 * `computeBoonConditionSources` itself: that function's output already feeds the Squad tab's
 * party-wide boon/condition summary (`party-summary.ts`) and per-slot icon rows, which assume every
 * entry is a real boon or condition — mixing aura sources into that same stream would silently
 * break those (e.g. `BOON_CONDITION_ICONS['Fire Aura']` doesn't exist). Not duration-scaled (see
 * `BoonConditionSource.scaledDurationSeconds`'s doc comment) — Firebrand Tome chapters are skipped
 * (wiki-sourced tome data has no aura facts, confirmed via a full scan of
 * data/game-data/tome-chapters.json this session). Control/Hard-CC (Stun, Daze, Knockdown,
 * Knockback, Launch, Pull) turned out not to share auras' `Buff`-status shape — see
 * `computeNamedFactSources`/`CONTROL_MATCHERS` below instead.
 *
 * Also includes the equipped relic's aura facts, under the same `RELIC_TRIGGER_GATES` curation
 * `computeBoonConditionSources` uses for boons/conditions — see that function's own doc comment
 * and `RELIC_TRIGGER_GATES`'s for the full scope (e.g. Relic of Surging's Shocking Aura, Relic of
 * the Earth's Magnetic Aura).
 */
export function computeAuraSources(
  build: Build,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    wvwFactOverrides: WvwFactOverrides
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
    familiars: Familiar[]
    relics: Relic[]
    relicEffects: RelicEffectsById
  }
): BoonConditionSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const legendIds = equippedLegendIds(build)
  const out: BoonConditionSource[] = []
  const unscaled = { boon: 0, condition: 0 }
  const { skillsById, skillIds } = equippedSkillsById(build, gameData)

  out.push(...relicSources(build, gameData, unscaled, classifyAura))

  out.push(
    ...extractSkillSourcesWithAdditiveDedup(
      skillIds,
      skillsById,
      (skill) =>
        extractFromFacts(
          skill.facts,
          skill.traitedFacts,
          activeIds,
          legendIds,
          'skill',
          skill.id,
          skill.name,
          skill.icon,
          unscaled,
          gameData.wvwFactOverrides.skill[skill.id],
          classifyAura
        ),
      additiveFlipContentKey
    )
  )

  for (const line of build.specializations) {
    if (line == null) continue
    for (const trait of gameData.traits) {
      if (trait.specializationId !== line.specializationId) continue
      const isMinor = trait.slot === 'Minor'
      const isChosenMajor = trait.slot === 'Major' && line.chosenTraitIds.includes(trait.id)
      if (!isMinor && !isChosenMajor) continue
      out.push(
        ...extractFromFacts(
          trait.facts,
          trait.traitedFacts,
          activeIds,
          legendIds,
          'trait',
          trait.id,
          trait.name,
          trait.icon,
          unscaled,
          gameData.wvwFactOverrides.trait[trait.id],
          classifyAura
        )
      )
    }
  }

  // `branchConditionalFacts`' own `countsTowardTotals`-flagged branch(es) can carry aura facts mixed
  // in with boon/condition ones (e.g. `radiantResolveSections`' "Activate" branch grants Light Aura
  // alongside a Healing numeric line) — mirrors `computeBoonConditionSources`'s identical loop, just
  // filtered to `category === 'aura'` instead of excluding it, so this fact reaches the Auras row it
  // actually belongs in rather than leaking into the Boons row (fixed 2026-08-19, see that loop's own
  // doc comment for the full bug). `durationPercent` is passed as all-zero rather than the real
  // gear-derived %, matching `BoonConditionSource.scaledDurationSeconds`'s documented contract that
  // aura entries are never duration-scaled — `radiantResolveSections` itself computes its aura fact's
  // `scaledDurationSeconds` from whatever `durationPercent.boon` it's given, so passing 0 here is what
  // makes that come out equal to `baseDurationSeconds`, per contract.
  for (const id of skillIds) {
    const skill = skillsById.get(id)
    if (!skill) continue
    for (const branch of branchConditionalFacts(skill, { boon: 0, condition: 0 }, 0, activeIds, legendIds, gameData.legends) ?? []) {
      if (branch.countsTowardTotals) out.push(...branch.facts.filter((f) => f.category === 'aura'))
    }
  }

  return out
}

/**
 * Aura facts a single skill grants — per-skill counterpart to `computeAuraSources`, same
 * "`activeIds` is the caller's responsibility to compute once and reuse" convention as
 * `boonConditionFactsForSkill` (which this mirrors exactly, just classified against `AURA_NAMES`
 * instead of `BOON_NAMES`/`CONDITION_NAMES` — see `classifyAura`). Not duration-scaled, same as
 * `computeAuraSources` (see `BoonConditionSource.scaledDurationSeconds`'s doc comment) — auras have
 * no gear-derived duration-% concept, so `{ boon: 0, condition: 0 }` is passed rather than a real
 * `durationPercent`.
 */
export function auraFactsForSkill(
  skill: Skill,
  activeIds: Set<number>,
  equippedLegendIdSet: Set<string>,
  wvwOverride: Record<string, WvwFactOverride> | undefined
): BoonConditionSource[] {
  return extractFromFacts(
    skill.facts,
    skill.traitedFacts,
    activeIds,
    equippedLegendIdSet,
    'skill',
    skill.id,
    skill.name,
    skill.icon,
    { boon: 0, condition: 0 },
    wvwOverride,
    classifyAura
  )
}

export interface NamedFactSource {
  sourceKind: 'skill' | 'trait' | 'sigil' | 'relic'
  sourceId: number
  sourceName: string
  sourceIcon: string
  name: string
  /** Human-readable magnitude when the underlying fact carries one (duration in seconds, a
   *  distance, or a plain count) — `null` for presence-only facts (e.g. Breaks Stun). */
  detail: string | null
  /** Same "up to N allies" resolution `BoonConditionSource.targetCount` does (own "Number of
   *  Allied Targets" fact, else a curated override table), only actually populated for matcher
   *  names present in `NAMED_FACT_TARGET_COUNT_TABLES` (currently just `Cleanse`) — `null` for
   *  every other name (Control/Miscellaneous/Strip/Corrupt), which have no such table. */
  targetCount: number | null
}

function namedFactDetail(fact: Fact): string | null {
  if (typeof fact.duration === 'number') return `${fact.duration}s`
  if (typeof fact.distance === 'number') return `${fact.distance}`
  if (typeof fact.value === 'number') return `${fact.value}`
  return null
}

/** At most one entry per matcher name per source (a skill/trait with 2 facts both matching e.g.
 *  "Barrier" shouldn't produce 2 identical tooltip lines). `targetCountTables` is keyed by matcher
 *  name (e.g. `Cleanse`) — only names present there get a resolved `targetCount`, everything else
 *  gets `null` (see `NamedFactSource.targetCount`'s doc comment).
 *
 * `wvwOverrides` mirrors `extractFromFacts`'s handling exactly (same per-source, keyed-by-status
 * map, same `'omit'`/number semantics), fixing TODO.md's "`MISCELLANEOUS_MATCHERS` has no WvW-
 * override concept" gap: a `Buff`-typed fact whose `status` has a curated override is deduped by
 * status (only the first of a pve/wvw-split pair is ever considered, so raw array order can't
 * flip which duration wins) and has its `detail` replaced by the override's WvW-tagged duration;
 * `'omit'` drops it as a candidate match entirely (no WvW variant). Only `Buff`-typed facts carry a
 * `status` to look up, so this only ever affects Stealth/Superspeed (`MISCELLANEOUS_MATCHERS`) and
 * the `Buff`-shaped half of Stun/Daze (`CONTROL_MATCHERS`) — every other matcher name reads
 * `Time`/`Distance`/`Number`/`StunBreak`/`NoData`/`AttributeAdjust` facts with no `status`, so the
 * override lookup is simply never consulted for them. */
function namedFactsFrom(
  facts: Fact[],
  traitedFacts: Fact[],
  activeIds: Set<number>,
  equippedLegendIdSet: Set<string>,
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  sourceName: string,
  sourceIcon: string,
  wvwOverrides: Record<string, WvwFactOverride> | undefined,
  matchers: Record<string, (fact: Fact) => boolean>,
  targetCountTables?: Record<string, { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> }>
): NamedFactSource[] {
  const out: NamedFactSource[] = []
  const matchedNames = new Set<string>()
  const emittedOverriddenStatuses = new Set<string>()
  const combinedFacts = [...facts, ...traitedFacts]
  for (const fact of combinedFacts) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue

    const wvwOverride = fact.type === 'Buff' && typeof fact.status === 'string' ? wvwOverrides?.[fact.status] : undefined
    if (wvwOverride !== undefined) {
      if (emittedOverriddenStatuses.has(fact.status as string)) continue
      emittedOverriddenStatuses.add(fact.status as string)
    }
    if (wvwOverride === 'omit') continue

    for (const [name, match] of Object.entries(matchers)) {
      if (matchedNames.has(name) || !match(fact)) continue
      const table = targetCountTables?.[name]
      const targetCount = table ? resolveTargetCountFrom(fact, combinedFacts, sourceKind, sourceId, table, activeIds, equippedLegendIdSet).value : null
      const detail = typeof wvwOverride === 'number' ? `${wvwOverride}s` : namedFactDetail(fact)
      out.push({ sourceKind, sourceId, sourceName, sourceIcon, name, detail, targetCount })
      matchedNames.add(name)
    }
  }
  return out
}

/**
 * Control/Hard-CC matchers for `computeNamedFactSources` — each a structurally-verified exact
 * `type`+`text`/`status` match (not text-mined from free-form descriptions), confirmed via a full
 * scan of data/game-data/{skills,traits}.json this session. Stun/Daze can appear as either a
 * `Time`-typed fact (`text`, majority of occurrences) or a `Buff`-typed one (`status`, minority) —
 * both checked so neither is undercounted. Knockdown/Knockback/Launch/Pull only ever appear as
 * `Time`/`Distance`/`Number`-typed facts respectively (no `Buff`-typed alternate exists). Sink/Float
 * (underwater-only hard CC) are deliberately excluded — not relevant to this app's WvW land focus.
 * Object key order is this row's display order (`Object.keys` preserves insertion order).
 */
export const CONTROL_MATCHERS: Record<string, (fact: Fact) => boolean> = {
  Stun: (f) => (f.type === 'Time' && f.text === 'Stun') || (f.type === 'Buff' && f.status === 'Stun'),
  Daze: (f) => (f.type === 'Time' && f.text === 'Daze') || (f.type === 'Buff' && f.status === 'Daze'),
  Knockdown: (f) => f.type === 'Time' && f.text === 'Knockdown',
  Knockback: (f) => f.type === 'Distance' && f.text === 'Knockback',
  Launch: (f) => f.type === 'Distance' && f.text === 'Launch',
  Pull: (f) => f.type === 'Number' && f.text === 'Pull'
}

/**
 * Miscellaneous matchers for `computeNamedFactSources`. "Barrier" is the one exception to "exact
 * `text` match" here: `AttributeAdjust` facts that grant Barrier carry ~15 different exact labels
 * ("Barrier", "Ally Barrier", "Barrier per Hit", "Initial Barrier", ...) that all consistently
 * contain the word "Barrier" (confirmed via a full scan of every `AttributeAdjust` fact's `text`
 * this session) — a substring match, not a guess. Healing is deliberately not included here — a
 * presence-only boolean would be true for nearly every build (everyone has a heal skill); its real
 * computed magnitude is shown on the heal skill's own tooltip instead (see `SkillsEditor.tsx`'s
 * `skillFactLines`), not as another icon here.
 */
export const MISCELLANEOUS_MATCHERS: Record<string, (fact: Fact) => boolean> = {
  Stealth: (f) => f.type === 'Buff' && f.status === 'Stealth',
  Superspeed: (f) => f.type === 'Buff' && f.status === 'Superspeed',
  Evade: (f) => f.type === 'Time' && f.text === 'Evade',
  'Breaks Stun': (f) => f.type === 'StunBreak' || (f.type === 'NoData' && f.text === 'Breaks Stun'),
  Barrier: (f) => f.type === 'AttributeAdjust' && typeof f.text === 'string' && /barrier/i.test(f.text)
}

/**
 * Boon Strip/Corrupt/Cleanse — not part of gw2skills' own reference bar, added on request (strip =
 * remove an enemy's boon; corrupt = convert it into a condition instead; cleanse = remove a
 * condition from self/allies, TODO.md's "Condition Cleanse" item, folded into this row rather than
 * a separate one per that item's scoping). All three read `type: 'Number'` facts — e.g. Corrupt
 * Boon's "Boons Converted", Spectral-Grasp-style pulls' "Boons Removed"/"Boons Stolen", Healing
 * Seed's "Conditions Removed" — confirmed exhaustive label sets via a full scan of every `Number`
 * fact's `text` (Strip/Corrupt) and `scripts/fetch-condition-cleanse.ts`'s 235-candidate sweep
 * (Cleanse, see `CONDITION_CLEANSE_TARGETS` above).
 */
export const BOON_STRIP_CORRUPT_MATCHERS: Record<string, (fact: Fact) => boolean> = {
  Strip: (f) => f.type === 'Number' && typeof f.text === 'string' && /boons? (removed|stolen)/i.test(f.text),
  Corrupt: (f) => f.type === 'Number' && typeof f.text === 'string' && /boons? converted/i.test(f.text),
  Cleanse: (f) => f.type === 'Number' && typeof f.text === 'string' && /condition.*remov|remov.*condition/i.test(f.text)
}

/**
 * Party-wide entries for `MISCELLANEOUS_MATCHERS`' "Breaks Stun" row (TODO.md's "party-wide-only
 * filter," Misc-row scoping pass, 2026-08-19). First leg (2026-08-19) covered the 8 skill + 2 trait
 * sources below whose own description explicitly ties "breaks stun" to allies; the ~120 remaining
 * sources were left open as "mostly self-only by inspection, but not individually confirmed."
 *
 * Final leg (2026-08-19, closes this table's scope entirely): a full wiki pass over every one of
 * those ~120 (113 after excluding blank-data placeholder ids with no name at all, e.g. skill 72441)
 * — resolved each candidate's wiki page and read its own `{{skill/trait fact|breakstun}}` /
 * `{{skill fact|stun break|applies to=...}}` template (the wiki's own explicit self-vs-allies
 * signal, discovered via Otter's Compassion below and confirmed reliable against the already-known
 * Blinding Powder/"Shake It Off!" cases). Result: exactly ONE source in the entire leftover set
 * carries an explicit `applies to=allies` qualifier — Otter's Compassion, added below. The other 112
 * are now CONFIRMED (not just inspected) self-only: 4 carry an explicit `applies to=self` qualifier
 * (Elixir S, Hare's Agility, Toad's Fortitude, Fox's Fury — the latter two initially looked
 * ambiguous from prose alone, e.g. Toad's Fortitude's "grants resistance to allies and breaks stun"
 * reads ambiguously in English but the wiki's own fact template disambiguates it as self), and 108
 * carry the template with zero qualifier at all (GW2's bare-`breakstun`-defaults-to-self convention
 * — spot-checked across the full local wiki-page cache for any hidden `applies to=` parameter under
 * this alternate template spelling, found only on the already-curated "Shake It Off!"). Curating a
 * self entry has zero functional effect regardless (`'self'` resolves to `targetCount: null`, same
 * as leaving a source uncurated), so none of the 112 get an entry — this table still only lists
 * sources CONFIRMED party-wide. Many more Breaks-Stun sources resolve for free with no entry needed
 * at all, via their own `"Number of Allied Targets"` fact (`resolveTargetCountFrom` checks that
 * before ever consulting this table) — e.g. "Save Yourselves!", "Protect Me!", Banner of Tactics,
 * "Never Surrender!".
 */
export const BREAKS_STUN_PARTY_WIDE: { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> } = {
  skill: {
    14372: 5, // "Shake It Off!" — "breaks stuns for affected allies"
    30047: 5, // "Eye of the Storm!" — "breaking stun for nearby allies"
    31401: 5, // Glyph of Equality — "Break stun for nearby allies"
    62796: 5, // Awakening (Legendary Alliance) — "Break stun on nearby allies"
    63293: 5, // Crisis Zone (Mechanist) — "breaks stuns...to itself and nearby allies"
    76563: 5, // Otter's Compassion (Evoker meditation) — wiki: "this skill breaks stun for nearby
    // allies" when water is your specialized element, confirmed via the fact template itself
    // (`{{skill fact|stun break|applies to=allies}}`); its sibling boon facts are already curated
    // at 5 in `TARGET_COUNT_OVERRIDES`.
    77155: 5, // Chant of Freedom — "Breaks stun from allies in an area around you"
    77178: 5, // Tale of the Valiant Marshal — "Break their stuns" (nearby allies called to action)
    77321: 5 // Stalwart Stance — "Break stun for nearby allies"
  },
  trait: {
    612: 5, // Indomitable Courage — "breaks stun and grants stability to nearby allies" (one
    // compound predicate scoped to "nearby allies")
    2005: 5 // Mental Defense — "breaks allies out of stuns"
  }
}

/**
 * Party-wide entries for `MISCELLANEOUS_MATCHERS`' "Stealth" row — second sweep leg after Breaks
 * Stun (TODO.md's "party-wide-only filter" Misc-row scoping, 2026-08-19), same "confirmed party-wide
 * only, leave the self-only majority uncurated" approach `BREAKS_STUN_PARTY_WIDE`'s doc comment
 * explains (curating a self entry is undocumented value with zero functional effect — `'self'`
 * resolves to `targetCount: null`, identical to leaving a source uncurated). 40 skills + 3 traits
 * carry a `Buff`/`Stealth` fact; 10 already resolve for free via their own `"Number of Allied
 * Targets"` fact (`resolveTargetCountFrom` checks that before ever consulting this table); of the
 * remaining 32, a full read of local API `facts`/`description` data plus live wiki wikitext (for the
 * 2 sources with no local `Number` fact at all) found:
 *  - 5972/6090 "Toss Elixir S" (land/underwater pair) — own `"Number of Targets": 5` fact, no
 *    foe-facing fact on the source at all (pure ally stealth toss), so the normally-untrusted generic
 *    label is trusted here exactly like `BREAKS_STUN_PARTY_WIDE`'s entries.
 *  - 10245 Mass Invisibility — own `"Number of Targets": 10` fact (not the usual 5 — trusted as-is
 *    since it's the source's real API value, not a guess), zero foe-facing component
 *    ("You and all your allies gain stealth").
 *  - 13117 Shadow Refuge — own `"Number of Targets": 5` fact, zero foe-facing component (Healing +
 *    Stealth + a self/ally damage-reduction buff, no enemy-facing fact at all).
 *  - 10187/50414 "Veil" (duplicate ids, same facts) — no `Number` fact of any kind in the local data
 *    (confirmed live on the wiki too — no `{{skill fact|targets|...}}` template on the page at all),
 *    but explicit "grants stealth to you and your allies" wording — the established default-5
 *    convention `TARGET_COUNT_OVERRIDES` already documents for this exact shape.
 *  - 30815 Sneak Gyro — no `Number` fact locally either, but live wikitext has `targets|5` inside the
 *    infobox's `missing facts=` field; trusted despite being a skill (not trait) page because, like
 *    the entries above, the source has zero foe-facing component to compete with it for meaning
 *    (contrast `fetch-target-counts.ts`'s doc comment, which restricts that specific shape to traits
 *    ONLY because its candidate set includes skills with a competing foe-facing reading — not the
 *    case here).
 *  - 13044 Blinding Powder — user-confirmed 2026-08-19 (real-game knowledge, not derivable from the
 *    API facts alone): Blind and Stealth both independently cap at 5 targets (foes/allies
 *    respectively) despite sharing one `"Number of Targets": 5` label — not actually ambiguous
 *    between the two effects, both readings are simultaneously true. Only the Stealth (ally) reading
 *    matters here since this table only resolves `MISCELLANEOUS_MATCHERS`' Stealth row; Blind's own
 *    enemy-facing count isn't tracked by any `targetCount`-consuming code path (`targetCount` is
 *    documented as only meaningful for `isCondition === false` sources — see
 *    `BoonConditionSource.targetCount`'s doc comment). Initially excluded here as unresolvably
 *    ambiguous before the correction — see this table's git history / COMPLETED.md for the reversal.
 * Remaining scope at the time this table was written: Superspeed (51) and Barrier (68) still hadn't
 * had this manual pass; ~120 Breaks-Stun sources also remain (see `BREAKS_STUN_PARTY_WIDE`'s own doc
 * comment). Superspeed got its own leg next — see `SUPERSPEED_PARTY_WIDE` below; Barrier is still open.
 */
export const STEALTH_PARTY_WIDE: { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> } = {
  skill: {
    5972: 5, // Toss Elixir S — own "Number of Targets: 5" fact, no foe-facing component
    6090: 5, // Toss Elixir S (underwater variant) — same
    10187: 5, // Veil — "grants stealth to you and your allies", no Number fact, default-5 convention
    50414: 5, // Veil (duplicate id, identical facts) — same
    10245: 10, // Mass Invisibility — own "Number of Targets: 10" fact, no foe-facing component
    13117: 5, // Shadow Refuge — own "Number of Targets: 5" fact, no foe-facing component
    30815: 5, // Sneak Gyro — wiki "missing facts" targets|5, no foe-facing component
    13044: 5 // Blinding Powder — user-confirmed: StunBreak is personal, so "Number of Targets: 5"
    // describes the Stealth grant, not the foe-facing Blind
  },
  trait: {}
}

/**
 * Party-wide entries for `MISCELLANEOUS_MATCHERS`' "Superspeed" row — third sweep leg (TODO.md's
 * "party-wide-only filter" Misc-row scoping, 2026-08-19 continued), same "confirmed party-wide only,
 * leave the self/pet/illusion-only majority uncurated" approach `BREAKS_STUN_PARTY_WIDE`'s doc
 * comment explains. 47 skills + 13 traits carry a `Buff`/`Superspeed` fact; 9 already resolved for
 * free via their own `"Number of Allied Targets"` fact; of the remaining 51 (40 skills + 11 traits),
 * a full read of local API `facts`/`traitedFacts`/`description` data (plus one live wiki check for
 * the one skill whose own description doesn't mention Superspeed at all) found 12 skills + 3 traits
 * confirmed party-wide:
 *  - 5682 Windborne Speed — own description only mentions Swiftness ("You and nearby allies gain
 *    swiftness..."), not Superspeed, despite carrying an unconditioned Superspeed fact — live wiki
 *    check confirmed the Superspeed itself is also "you and nearby allies," own `Number of Targets: 5`
 *    + `Radius(300)` facts.
 *  - 5970/6089 Toss Elixir U (two ids, identical Superspeed/Number(5)/Radius facts, same "Toss Elixir
 *    S"-style land/underwater-style duplicate `STEALTH_PARTY_WIDE` already established a precedent
 *    for) — 5970's own description: "breaking stuns on allies and granting them superspeed."
 *  - 6088 Detonate Elixir U — own description: "grant allies superspeed and break them out of stun."
 *    Its Superspeed fact is gated on trait 473 (HGH, "Elixirs gain increased durations and grant
 *    might") — that's a real in-game gate (this "detonate" variant only exists with HGH traited), not
 *    a self/party ambiguity, so the entry applies whenever the fact is emitted at all.
 *  - 9143 Symbol of Swiftness — own description: "Allies in the area gain a burst of speed when the
 *    symbol is created," own `Number of Targets: 5`.
 *  - 10325 Slipstream — own description: "grants superspeed to allies passing through it," no
 *    explicit `Number`/`Radius` fact — default-5 convention (same as Veil in `STEALTH_PARTY_WIDE`).
 *  - 28075 Chaotic Release — own description: "granting superspeed to allies," own
 *    `Number of Targets: 5`.
 *  - 30047 "Eye of the Storm!" — own description: "massively increasing speed...for nearby allies"
 *    (already curated in `BREAKS_STUN_PARTY_WIDE` for its separate StunBreak fact; this is the same
 *    ally-only shout granting its Superspeed reach too), own `Number of Targets: 5`.
 *  - 30814 Well of Action — own description: "time snaps back, granting boons to allies," with
 *    Might/Fury/Superspeed all appearing as the well's pulse facts under that one ally-scoped
 *    sentence, own `Number of Targets: 5`.
 *  - 71888 Essence of Borrowed Time — own description: "applying superspeed to allies," own
 *    `Number of Targets: 5`.
 *  - 74314 Rallying Roar (pet Beast skill) — own description: "granting superspeed to nearby allies,"
 *    own `Number of Targets: 5`.
 *  - 76562 "We Will Never Yield!" — own description's 2nd paragraph: "Echo. Grant superspeed to
 *    nearby allies after a set interval or after you use a burst skill," own `Number of Targets: 5`.
 *  - Trait 1980 Temporal Enchanter — own description: "allies near the glamour gain resistance and
 *    superspeed," own `Number of Targets: 5`.
 *  - Trait 2014 Speed of Synergy — own description explicitly splits two cases: "Using a heal skill
 *    grants superspeed in a radius around you" (party-wide, this entry) vs. "Using a healing skill's
 *    associated tool-belt skill grants you personal superspeed" (self-only) — its own
 *    `Ally Superspeed Radius` fact confirms the party-wide case. This trait gates the Superspeed fact
 *    on 7 different Engineer heal-adjacent skills in this sweep's candidate set (5978/6118 Toss Elixir
 *    H, 6176 Regenerating Mist, 12377 Blessing of Dwayna, 12465 Leafy Bandage, 21661 Static Shock,
 *    29772 Bandage Self) — every one of them has API `slot: "Toolbelt"`, matching the trait's own
 *    "associated tool-belt skill" (personal) wording exactly, so none of those 7 skill ids are entered
 *    here despite carrying a trait-2014-gated Superspeed fact.
 *  - Trait 2357 Liberating Liaise — own description: "Chant of Freedom grants superspeed to affected
 *    allies when activated" — already wiki-verified as part of the 2026-08-15
 *    `MISCELLANEOUS_MATCHERS` WvW-override fix (see TODO.md/COMPLETED.md), corroborated here.
 * Explicitly excluded as self/pet/illusion-only (own description has no "allies" reach): Wind Blast,
 * Slick Shoes' "Superspeed" cast skill, Rocket Boots (both ids — "gain superspeed" is self, ends on
 * skill completion), Signet of the Hunt/Quickening Zephyr/Lesser Quickening Zephyr/Soothing Breeze
 * (self+pet only, not party), Holo Leap (trait 2091 upgrades the caster's own landing Swiftness fact,
 * not the pad's separate untracked ally-swiftness-on-contact effect), Polaric Leap/Griffon
 * Stance/Featherfoot Grace/Twist of Fate/Wind Storm/Invigorating Air/Energize/Whirlwind (all "gain
 * superspeed," no ally wording), Spider's Web (pet-only), One with Air/Meld with
 * Shadows/Kinetic Battery/Burst of Aggression/Crystal Configuration: Zephyr/Jetstream (self-only
 * triggers), Object in Motion (a damage modifier reading the caster's own current boons, not a grant),
 * Time Catches Up (grants illusions/clones Superspeed, not player allies). Initially left uncurated
 * as ambiguous — 10311/10377 Time Warp carries an unconditioned Superspeed fact locally, but an
 * earlier live wiki check found the current tooltip doesn't mention Superspeed at all — until the
 * user corrected this same-day with real-game knowledge: Time Warp (and every Glamour skill) only
 * grants Superspeed with the Temporal Enchanter trait (1980) equipped; confirmed no OTHER Glamour
 * skill (Veil/Portal Entre+Exeunt/Null Field/Feedback) carries a Superspeed fact of its own at all, so
 * Time Warp is the only skill-side entry this mechanic needs — every other Glamour skill's party-wide
 * Superspeed is fully covered by Temporal Enchanter's own already-curated trait row above. Modeled as
 * a `TraitConditionalTargetCountOverride` (party-wide(5) when 1980 is active, `'self'` — i.e. no
 * curated reach, matching the fact's absence of any real grant — otherwise), the same mechanism
 * `TARGET_COUNT_OVERRIDES` already uses for Willbender's Phoenix Protocol/Gladiator's Defense: a
 * source's reach flipping on an unrelated trait choice, not on its own fact data.
 * Barrier got its own leg next — see `BARRIER_PARTY_WIDE` below, now also done; ~120 Breaks-Stun
 * sources remain the only open piece of this whole sweep (see `BREAKS_STUN_PARTY_WIDE`'s own doc
 * comment).
 */
export const SUPERSPEED_PARTY_WIDE: { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> } = {
  skill: {
    5682: 5, // Windborne Speed — wiki-confirmed "you and nearby allies," own Number(5)/Radius(300)
    5970: 5, // Toss Elixir U — own desc "granting them superspeed" (allies), own Number(5)
    6089: 5, // Toss Elixir U (duplicate id, identical facts) — same
    6088: 5, // Detonate Elixir U — own desc "grant allies superspeed," own Number(5), HGH-gated
    9143: 5, // Symbol of Swiftness — own desc "Allies in the area gain a burst of speed," Number(5)
    10325: 5, // Slipstream — own desc "grants superspeed to allies passing through it," default-5
    10311: { gatedBy: 'trait', traitId: 1980, traitName: 'Temporal Enchanter', whenActive: 5, otherwise: 'self' }, // Time Warp
    10377: { gatedBy: 'trait', traitId: 1980, traitName: 'Temporal Enchanter', whenActive: 5, otherwise: 'self' }, // Time Warp (duplicate id)
    28075: 5, // Chaotic Release — own desc "granting superspeed to allies," own Number(5)
    30047: 5, // "Eye of the Storm!" — own desc "for nearby allies," own Number(5)
    30814: 5, // Well of Action — own desc "granting boons to allies," own Number(5)
    71888: 5, // Essence of Borrowed Time — own desc "applying superspeed to allies," own Number(5)
    74314: 5, // Rallying Roar — own desc "granting superspeed to nearby allies," own Number(5)
    76562: 5 // "We Will Never Yield!" — own desc "Grant superspeed to nearby allies," own Number(5)
  },
  trait: {
    1980: 5, // Temporal Enchanter — own desc "allies...gain resistance and superspeed," Number(5)
    2014: 5, // Speed of Synergy — own desc's "using a heal skill" (party) case; the "associated
    // tool-belt skill" case is self-only per the same sentence, see this table's doc comment
    2357: 5 // Liberating Liaise — own desc "grants superspeed to affected allies," wiki-verified
    // 2026-08-15 as part of the MISCELLANEOUS_MATCHERS WvW-override fix
  }
}

/**
 * Party-wide entries for `MISCELLANEOUS_MATCHERS`' "Barrier" row — fourth and last sweep leg
 * (TODO.md's "party-wide-only filter" Misc-row scoping, 2026-08-19 continued), same "confirmed
 * party-wide only, leave the self-only majority uncurated" approach `BREAKS_STUN_PARTY_WIDE`'s doc
 * comment explains. 79 skills + traits carry an `AttributeAdjust` fact whose `text` matches /barrier/i;
 * 11 already resolve for free via their own `"Number of Allied Targets"` fact; of the remaining 68, a
 * full read of local API `facts`/`description` data (plus 2 live wiki checks for the genuinely
 * ambiguous ones) found 15 skills + 7 traits confirmed party-wide:
 *  - 14394 Call of Valor — own desc "Removes conditions from allies... Affected targets also gain
 *    barrier," own `Number of Targets: 5`.
 *  - 30101 Bulwark Gyro — own desc "grant barrier to allies in the area," own `Number of Targets: 5`.
 *  - 31740 Glyph of Burgeoning — own desc "Grant barrier...to nearby allies," own `Number of Targets: 5`.
 *  - 34714 Glyph of Elemental Power — own desc doesn't name Barrier at all ("effect will differ based
 *    on your attunement"), own `Number of Targets: 5` — live wiki check confirmed the Earth-attunement
 *    branch "Grants Barrier to five nearby allies," the only branch of the 4 that grants Barrier.
 *  - 41615 Serpent Siphon — own desc "granting barrier and boons to nearby allies," own
 *    `Number of Targets: 5`.
 *  - 42917 Sand Swell — own desc "Grant allies using this passage a health barrier," no explicit
 *    `Number` fact — default-5 convention (same as Veil in `STEALTH_PARTY_WIDE`).
 *  - 43148 Sand Flare — own facts explicitly split `Self Barrier`(2420) from `Ally Barrier`(1220),
 *    own `Number of Targets: 5` — the split labeling is itself the ally-reach evidence, independent
 *    of the generic description text ("Gain barrier").
 *  - 62689 Saint's Shield — own desc "granting barrier and healing to allies in the affected area,"
 *    own `Number of Targets: 5`.
 *  - 63141 Barrier Burst (Mechanist Mech Command) — own desc "Pulse a barrier and boons to all nearby
 *    allies," own `Number of Targets: 5`.
 *  - 63169 Energizing Slam — own desc "granting barrier and boons to allies," own `Number of Targets: 5`.
 *  - 63220 Dawn's Repose (Range 450 leap variant) — own desc "Grant barrier to your tethered ally and
 *    NEARBY ALLIES based on targets struck," own `Number of Targets: 5`. Its same-named sibling 63227
 *    (Range 600 dash variant) is deliberately EXCLUDED below — that id's own description reads "Grant
 *    barrier to your tethered ally and YOURSELF" instead (no "nearby allies" wording at all), a
 *    genuinely different mechanic despite sharing a name, same "read each id's own description, don't
 *    group by name" discipline `STEALTH_PARTY_WIDE`'s Toss Elixir S entries already established.
 *  - 76562 "We Will Never Yield!" — own desc "Your allies' health cannot be reduced below zero... grant
 *    barrier proportionate to their missing health," own `Number of Targets: 5`. Already curated in
 *    `SUPERSPEED_PARTY_WIDE` for its separate Superspeed line — this is a second, independent entry
 *    for this table's own Barrier row on the same source id.
 *  - 76813 Effulgent Stance — own desc "Grant barrier and light aura to nearby allies," no explicit
 *    `Number` fact — default-5 convention.
 *  - 76816 Chak Shield — own desc "granting barrier to allies within it," own `Number of Targets: 5`.
 *  - 76934 "Brace Yourselves!" — own desc "Apply barrier to yourself and allies around you... Apply
 *    barrier again to allies," own `Number of Targets: 5`.
 *  - Trait 1060 Allies' Aid — own desc "Moa pets grant barrier to nearby allies," own
 *    `Number of Targets: 5`.
 *  - Trait 1854 Chain Reactivity — own desc "a larger barrier that is shared with allies," own facts
 *    explicitly carry 2 `Ally Barrier` entries (likely a PvE/competitive split, same shape as Sand
 *    Flare above) — no `Number` fact, default-5 convention.
 *  - Trait 1971 System Shocker — own desc "Disabling a foe grants barrier to nearby allies," no
 *    explicit `Number` fact — default-5 convention.
 *  - Trait 1981 Ex Machina — own desc "grants barrier to nearby allies," no explicit `Number` fact —
 *    default-5 convention.
 *  - Trait 2253 Unshakable Mountain — own desc "Grant barrier to nearby allies," own
 *    `Number of Targets: 5`.
 *  - Trait 2280 Panaku's Ambition — own desc's 2nd sentence "When you apply stealth to allies, you
 *    also grant them barrier," own facts explicitly split `Stealth Attack Barrier`(714, the self-only
 *    1st-sentence case) from `Stealth Barrier`(2122, the ally-facing 2nd-sentence case) — no `Number`
 *    fact, default-5 convention.
 *  - Trait 2281 Mech Core: Barrier Engine — own desc "your mech will automatically grant a small
 *    barrier each interval to nearby allies," own `Number of Targets: 5`.
 * Explicitly excluded as self/pet/single-ally-only (own description has no "nearby allies"/"allies
 * around you" reach): every Elementalist Earth-line self-barrier-stack skill (Armor of Earth, Rock
 * Barrier, Stone Sheath, Lesser/regular Stone Resonance, Molten Burst, Fortified Earth, Immutable
 * Stone — all "gain barrier" tied to the Tectonic Shift self-buff mechanic, no ally wording on any of
 * them), every "gain barrier per foe struck/disabled" personal-payoff skill (Magnetic Shield,
 * Zealot's Embrace, Pommel Bash, Imminent Threat, Desert Shroud, Lava Skin, Call of the Dwarf,
 * Overbearing Smash (both ids), Wild Swing (both ids), Crystal Configuration: Eclipse, Release
 * Potential: Warrior (both ids)), self-only gadgets/stances (Utility Goggles, Lesser Utility Goggles,
 * Shock Shield, Symbiotic Shielding, Earthen Blast, Last Stand, Resilient Spirit, Blast Shield, Feed
 * from Corruption, Elemental Refreshment (explicit "to yourself"), Master's Fortitude, Nature's
 * Shield (explicit "you and your pet," not party), Magpie's Defense (explicit "yourself" despite a
 * stray `Number of Targets`/`Range` fact — same "explicit self-wording wins over an unrelated fact"
 * reading `fetch-target-counts.ts`'s doc comment documents for "Guard!"/Lightning Flash), Enterprising
 * Aristocrat (explicit "You take reduced... damage," same reasoning), Hybrid Vigor). Also excluded:
 * 63155 Enter Shadow Shroud — grants barrier to a single targeted/tethered ally only ("Ally Target:
 * ...tether a targeted...ally, granting them barrier"), never reaching the party-wide threshold even
 * if curated, so left uncurated per this table's own "curating a non-qualifying entry has zero
 * functional effect" convention; 76931 Crescendo — live-wiki-fetched raw wikitext confirms its own
 * `{{skill fact|targets|5}}` template is the same BARE, unlabeled shape used elsewhere on this page for
 * the skill's own foe-facing Damage fact, with no ally wording anywhere in the description and no
 * `allied targets`-labeled template of its own — most likely describes the Damage foe count, not an
 * ally reach for Barrier, so left uncurated as unresolved rather than guessed (same "fail safe into a
 * logged bucket" convention `fetch-target-counts.ts` follows for this exact shape).
 * This closes out the whole `MISCELLANEOUS_MATCHERS` party-wide-targetCount scoping item — Stealth/
 * Superspeed/Breaks-Stun(partial)/Barrier have all now had their leg; only the ~120 leftover
 * Breaks-Stun sources remain open (see `BREAKS_STUN_PARTY_WIDE`'s own doc comment).
 */
export const BARRIER_PARTY_WIDE: { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> } = {
  skill: {
    14394: 5, // Call of Valor — "Affected targets also gain barrier," own Number(5)
    30101: 5, // Bulwark Gyro — "grant barrier to allies in the area," own Number(5)
    31740: 5, // Glyph of Burgeoning — "nearby allies," own Number(5)
    34714: 5, // Glyph of Elemental Power — wiki-confirmed Earth branch "grants barrier to five nearby
    // allies," own Number(5)
    41615: 5, // Serpent Siphon — "granting barrier...to nearby allies," own Number(5)
    42917: 5, // Sand Swell — "Grant allies...a health barrier," default-5 (no Number fact)
    43148: 5, // Sand Flare — explicit "Ally Barrier" fact split from "Self Barrier," own Number(5)
    62689: 5, // Saint's Shield — "barrier and healing to allies in the affected area," own Number(5)
    63141: 5, // Barrier Burst — "Pulse a barrier and boons to all nearby allies," own Number(5)
    63169: 5, // Energizing Slam — "granting barrier and boons to allies," own Number(5)
    63220: 5, // Dawn's Repose (leap variant) — "tethered ally and nearby allies," own Number(5).
    // Sibling id 63227 (dash variant) deliberately excluded — its own desc says "tethered ally and
    // yourself" instead, no ally-wide wording
    76562: 5, // "We Will Never Yield!" — "allies' health...grant barrier proportionate," own Number(5)
    76813: 5, // Effulgent Stance — "barrier and light aura to nearby allies," default-5 (no Number fact)
    76816: 5, // Chak Shield — "granting barrier to allies within it," own Number(5)
    76934: 5 // "Brace Yourselves!" — "barrier to yourself and allies around you," own Number(5)
  },
  trait: {
    1060: 5, // Allies' Aid — "Moa pets grant barrier to nearby allies," own Number(5)
    1854: 5, // Chain Reactivity — "larger barrier...shared with allies," explicit "Ally Barrier" facts,
    // default-5 (no Number fact)
    1971: 5, // System Shocker — "grants barrier to nearby allies," default-5 (no Number fact)
    1981: 5, // Ex Machina — "grants barrier to nearby allies," default-5 (no Number fact)
    2253: 5, // Unshakable Mountain — "Grant barrier to nearby allies," own Number(5)
    2280: 5, // Panaku's Ambition — "you also grant them barrier," explicit "Stealth Barrier" fact split
    // from "Stealth Attack Barrier," default-5 (no Number fact)
    2281: 5 // Mech Core: Barrier Engine — "grant a small barrier each interval to nearby allies," own
    // Number(5)
  }
}

/** Matcher names in `BOON_STRIP_CORRUPT_MATCHERS`/`MISCELLANEOUS_MATCHERS` (or any other matcher
 *  table) that resolve `NamedFactSource.targetCount` — passed to `computeNamedFactSources` alongside
 *  the matcher table itself. `Cleanse`/`Breaks Stun`/`Stealth`/`Superspeed`/`Barrier` all carry real
 *  curated overrides now (the whole `MISCELLANEOUS_MATCHERS` sweep, see `BARRIER_PARTY_WIDE`'s own doc
 *  comment for how it wraps up). Strip/Corrupt (how many enemies a boon is stripped/corrupted from)
 *  and every Control name were never scoped for this and stay `null` — omitted from this table
 *  entirely, not just uncurated within it. */
export const NAMED_FACT_TARGET_COUNT_TABLES: Record<
  string,
  { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> }
> = {
  Cleanse: CONDITION_CLEANSE_TARGETS,
  Stealth: STEALTH_PARTY_WIDE,
  Superspeed: SUPERSPEED_PARTY_WIDE,
  'Breaks Stun': BREAKS_STUN_PARTY_WIDE,
  Barrier: BARRIER_PARTY_WIDE
}

/**
 * Sigil-derived Control/Miscellaneous/Strip/Corrupt/Cleanse sources. Sigils carry no `Fact[]`
 * array at all (the GW2 API only exposes a `description` free-text string plus a best-effort
 * `bonuses` parse for stat sigils — see `Sigil`'s doc comment in `types/game-data.ts`), so none of
 * `CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`/`BOON_STRIP_CORRUPT_MATCHERS` (all matched against
 * `Fact` shapes) could ever see a sigil — a silent, total gap, distinct from the trait/skill
 * matchers' occasional missed-wording gap (TODO.md's "Sigil/Control-Strip completeness scan").
 * Curated by hand from a full read of every `description` in `data/game-data/sigils.json`
 * (2026-08-12, see `sigil-named-fact-completeness.test.ts`): every sigil whose free text genuinely
 * *grants* (not just references, e.g. Impact's "+damage vs. Stunned foes" or Paralyzation's "+30%
 * Stun Duration" — bonuses that require an external stun source, not one of their own) a
 * Control/Miscellaneous/Strip/Corrupt/Cleanse effect. `name` must be a key of whichever matcher
 * table the caller passes in, so `computeSigilNamedFactSources` can filter itself down to the row
 * currently being rendered.
 */
export const SIGIL_NAMED_FACT_SOURCES: Record<number, { name: string; detail: string }> = {
  24571: { name: 'Cleanse', detail: 'On flank/defiant hit (4s CD)' }, // Superior Sigil of Purity
  24572: { name: 'Strip', detail: 'On flank/defiant hit (5s CD)' }, // Superior Sigil of Nullification
  38294: { name: 'Cleanse', detail: 'On crit, transfers to foe (6s CD)' }, // Superior Sigil of Generosity
  67340: { name: 'Cleanse', detail: '×3 on weapon swap (9s CD)' }, // Superior Sigil of Cleansing
  72872: { name: 'Strip', detail: '×3 on interrupt (10s CD)' } // Superior Sigil of Absorption
}

/** `SIGIL_NAMED_FACT_SOURCES` entries for every sigil equipped on the build's currently-active
 *  weapon set(s) — same `isActiveWeaponSlot` gating `computeGearAttributeTotals` uses for a
 *  sigil's passive stat bonus (a stowed weapon's sigil doesn't proc either, same in-game rule
 *  confirmed for stat bonuses — see that function's own comment). Filtered to `matchers`' own keys
 *  so a single call only contributes to whichever of Control/Miscellaneous/Strip-Corrupt-Cleanse
 *  the caller is currently rendering. */
function computeSigilNamedFactSources(build: Build, sigils: Sigil[], matchers: Record<string, (fact: Fact) => boolean>): NamedFactSource[] {
  const sigilsById = new Map(sigils.map((s) => [s.id, s]))
  const out: NamedFactSource[] = []
  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    if (!slotKey.startsWith('weapon') || !isActiveWeaponSlot(slotKey, build)) continue
    for (const sigilId of build.equipment[slotKey]?.sigilIds ?? []) {
      if (sigilId == null) continue
      const entry = SIGIL_NAMED_FACT_SOURCES[sigilId]
      if (!entry || !(entry.name in matchers)) continue
      const sigil = sigilsById.get(sigilId)
      if (!sigil) continue
      out.push({ sourceKind: 'sigil', sourceId: sigilId, sourceName: sigil.name, sourceIcon: sigil.icon, name: entry.name, detail: entry.detail, targetCount: null })
    }
  }
  return out
}

/**
 * Relic-derived Control/Miscellaneous/Strip/Corrupt/Cleanse sources — TODO.md's "Smaller follow-up"
 * to leg 2 of the relic proc integration sweep, closed 2026-08-16 as leg 5. Unlike sigils, a relic
 * DOES carry a real `Fact[]`-shaped array (`RelicEffect.facts`, via `relic-effects.json`), but its
 * shape is `RelicFactLine` (`{label, values, params}`, wiki-template-sourced), not the GW2 API's
 * `Fact` — none of `CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`/`BOON_STRIP_CORRUPT_MATCHERS` (all
 * matched against `Fact`) can see it, so this is hand-curated the same shape
 * `SIGIL_NAMED_FACT_SOURCES` is, not derived from a generic parse.
 *
 * Found via a full regex sweep of every relic's `relic-effects.json` facts for Control/Miscellaneous/
 * Strip/Corrupt/Cleanse verb+noun patterns (`relic-named-fact-completeness.test.ts` runs the same
 * scan as a regression guard). 9 candidates landed in the `RELIC_TRIGGER_GATES`-deterministic bucket
 * with a fixed (non-variable) magnitude — wired below. The rest stayed out, each for a reason:
 * - Relic of the Citadel (100448): **Wired 2026-08-16** (leg 6) — its Stun looked like a genuine
 *   range (`alt: "Minimum Stun"` 1s / `"Maximum Stun"` 3s) scaling with the triggering hit's
 *   defiance damage, but a wiki Mechanics-section re-check corrects that: the duration is actually a
 *   deterministic linear function of the equipped Elite skill's own `Recharge` (1s at ≤60s cooldown
 *   up to 3s at ≥180s), the same quantity Zephyrite's crystal duration already reads — see
 *   `citadelStunDurationSeconds`'s doc comment. `computeRelicNamedFactSources` below overrides this
 *   entry's static `detail` with the build's actual computed duration, same pattern `relicSources`
 *   uses for Zephyrite.
 * - Relic of the Astral Ward (100388): **Wired 2026-08-16** (leg 7) — re-examining the "2-step
 *   signet mechanic" this table previously deferred on found it's the same `ability`-gated shape
 *   every other relic here already uses, just with a trigger condition ("every 2nd Signet cast,"
 *   not every cast) this table doesn't otherwise model the frequency nuance of anyway — see
 *   `RELIC_TRIGGER_GATES`'s own doc comment for the full reasoning. Its Resistance boon is wired via
 *   that table/`extractFromRelicFacts` instead; this entry is just its Cleanse half, same split
 *   payload shape as Relic of Febe above.
 * - Relic of the Unseen Invasion (100694) / Relic of the Wayfinder (101943): both carry a literal
 *   `"Superspeed"`-labeled fact, but `docs/relic-trigger-classification.md`'s leg-1 audit already
 *   flagged their triggers as non-deterministic for this app (stealth enter/exit "circular/
 *   unbounded"; generic combat-enter) — same exclusion reasoning as the dodge-relic policy, just
 *   for a different non-deterministic trigger shape.
 * - Relic of the Founding (101737) / Relic of the Mists Tide (103901): Barrier/Cleanse respectively,
 *   both gated on a Combo field/finisher interaction — this app doesn't model combo timing/positioning
 *   any more deterministically than dodge timing, so `COMBO`-bucket relics stay excluded same as
 *   `DODGE(excluded)` ones.
 * - Relic of Mosyn (101801): already covered by the existing dodge-relic exclusion policy
 *   (`DODGE_RELIC_IDS`) — its Cleanse fires on dodge, not a modeled trigger.
 *
 * `detail` states the trigger + any fixed cooldown (`relic-effects.json`'s own `rechargeSeconds`,
 * `null` when the wiki lists no ICD) alongside the magnitude, mirroring `SIGIL_NAMED_FACT_SOURCES`'
 * "trigger + CD" convention — a relic's `sourceName` alone ("Relic of the Pack") doesn't tell the
 * reader what gates it the way a skill/trait's own name usually does.
 */
export const RELIC_NAMED_FACT_SOURCES: Record<number, { name: string; detail: string }> = {
  100752: { name: 'Superspeed', detail: '4s (on Elite skill use, 30s CD)' }, // Relic of the Pack
  101116: { name: 'Cleanse', detail: 'Immobile, Chilled, Crippled (on Heal skill use, 10s CD)' }, // Relic of Febe
  100074: { name: 'Corrupt', detail: '1 boon (on Elite skill use, 30s CD)' }, // Relic of Cerus
  100557: { name: 'Pull', detail: '240 (on Elite skill use, 30s CD)' }, // Relic of the Wizard's Tower
  100942: { name: 'Daze', detail: '2s (on Elite skill use, 30s CD)' }, // Relic of Dagda
  100659: { name: 'Cleanse', detail: '2 conditions (on Heal skill use, 20s CD)' }, // Relic of the Water
  100411: { name: 'Cleanse', detail: '1 condition (on Shout use)' }, // Relic of the Trooper
  104848: { name: 'Cleanse', detail: '2 conditions (on Stance use)' }, // Relic of Bava Nisos
  // Leg 6 (2026-08-16) — see this table's own doc comment for why Citadel moved out of the
  // "genuinely variable" pile; `detail` here is a placeholder, always overridden below.
  100448: { name: 'Stun', detail: '1s–3s (on Elite skill use, 30s CD)' }, // Relic of the Citadel
  // Leg 7 (2026-08-16) — see this table's own doc comment for why Astral Ward moved out of the
  // deferred pile; Resistance (its other half) is wired via RELIC_TRIGGER_GATES instead.
  100388: { name: 'Cleanse', detail: '2 conditions (on every 2nd Signet cast — spawns then consumes, no fixed CD)' } // Relic of the Astral Ward
}

/** `RELIC_NAMED_FACT_SOURCES`' entry for the build's equipped relic, or `[]` when no relic is
 *  equipped, it isn't one of the curated candidates, its name isn't a key of the caller's
 *  `matchers` table, or (same `RELIC_TRIGGER_GATES` gating `relicSources` uses for the boon/aura
 *  pipeline) its trigger gate isn't satisfied. `targetCount` is read straight off the relic's own
 *  `targets`/`allied targets` fact when present (`null` — self-only/unknown — otherwise), same
 *  resolution `relicSources` uses; unlike sigils, which have no such fact at all and so always
 *  report `null`. Relic of the Citadel (100448) gets one further step: its static table `detail` is
 *  replaced with the build's actual computed Stun duration (`citadelBuildStunDurationSeconds`), the
 *  same "compute per-build rather than trust a static fact" override `relicSources` applies to
 *  Zephyrite. */
function computeRelicNamedFactSources(
  build: Build,
  gameData: { relics: Relic[]; relicEffects: RelicEffectsById; skills: Skill[]; legends: Legend[] },
  matchers: Record<string, (fact: Fact) => boolean>
): NamedFactSource[] {
  if (build.relicId === null) return []
  const entry = RELIC_NAMED_FACT_SOURCES[build.relicId]
  if (!entry || !(entry.name in matchers)) return []
  const gate = RELIC_TRIGGER_GATES[build.relicId]
  if (!gate) return []
  const skillsById = new Map(gameData.skills.map((s) => [s.id, s]))
  if (!relicTriggerSatisfied(gate, build, gameData.legends, skillsById)) return []
  const relic = gameData.relics.find((r) => r.id === build.relicId)
  const effect = gameData.relicEffects[build.relicId]
  if (!relic || !effect) return []
  const targetsFact = effect.facts.find((f) => f.label === 'targets' || f.label === 'allied targets')
  const targetCount = targetsFact ? Number(targetsFact.values[0]) : null
  const detail =
    relic.id === CITADEL_RELIC_ID
      ? `${citadelBuildStunDurationSeconds(build, gameData.legends, skillsById).toFixed(1)}s (on Elite skill use, 30s CD)`
      : entry.detail
  return [
    {
      sourceKind: 'relic',
      sourceId: relic.id,
      sourceName: relic.name,
      sourceIcon: relic.icon,
      name: entry.name,
      detail,
      targetCount: Number.isFinite(targetCount) ? targetCount : null
    }
  ]
}

/**
 * Generic counterpart to `computeAuraSources`/`computeComboSources` for named facts that don't
 * share boons/conditions/auras' `Buff`-with-`status` shape — Control/Miscellaneous/Strip&Corrupt
 * each read a mix of fact `type`s (`Time`/`Distance`/`Number`/`StunBreak`/`NoData`/`AttributeAdjust`),
 * so each is defined as a small `name -> (fact) => boolean` matcher table (`CONTROL_MATCHERS` etc.,
 * above) instead of a single classify function. Same skill/trait-walking rules as
 * `computeAuraSources`/`computeComboSources`, plus equipped sigils via
 * `computeSigilNamedFactSources` (sigils have no `Fact` shape to match at all, see that function's
 * doc comment), plus the equipped relic via `computeRelicNamedFactSources` (added 2026-08-16, leg 5
 * of the relic proc integration sweep — relics carry a `Fact`-shaped array too, but a different one,
 * see that function's doc comment); call once per matcher table. `targetCountTables` is optional and
 * forwarded straight to `namedFactsFrom` — pass `NAMED_FACT_TARGET_COUNT_TABLES` for
 * `BOON_STRIP_CORRUPT_MATCHERS`, omit it for `CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`.
 */
export function computeNamedFactSources(
  build: Build,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    sigils: Sigil[]
    wvwFactOverrides: WvwFactOverrides
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
    familiars: Familiar[]
    relics: Relic[]
    relicEffects: RelicEffectsById
  },
  matchers: Record<string, (fact: Fact) => boolean>,
  targetCountTables?: Record<string, { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> }>
): NamedFactSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const legendIds = equippedLegendIds(build)
  const out: NamedFactSource[] = [...computeSigilNamedFactSources(build, gameData.sigils, matchers), ...computeRelicNamedFactSources(build, gameData, matchers)]
  const { skillsById, skillIds } = equippedSkillsById(build, gameData)

  out.push(
    ...extractSkillSourcesWithAdditiveDedup(
      skillIds,
      skillsById,
      (skill) =>
        namedFactsFrom(
          skill.facts,
          skill.traitedFacts,
          activeIds,
          legendIds,
          'skill',
          skill.id,
          skill.name,
          skill.icon,
          gameData.wvwFactOverrides.skill[skill.id],
          matchers,
          targetCountTables
        ),
      additiveFlipNamedFactContentKey
    )
  )

  for (const line of build.specializations) {
    if (line == null) continue
    for (const trait of gameData.traits) {
      if (trait.specializationId !== line.specializationId) continue
      const isMinor = trait.slot === 'Minor'
      const isChosenMajor = trait.slot === 'Major' && line.chosenTraitIds.includes(trait.id)
      if (!isMinor && !isChosenMajor) continue
      out.push(
        ...namedFactsFrom(
          trait.facts,
          trait.traitedFacts,
          activeIds,
          legendIds,
          'trait',
          trait.id,
          trait.name,
          trait.icon,
          gameData.wvwFactOverrides.trait[trait.id],
          matchers,
          targetCountTables
        )
      )
    }
  }

  return out
}

/**
 * Named facts (Control/Miscellaneous/Strip-Corrupt-Cleanse) a single skill grants — per-skill
 * counterpart to `computeNamedFactSources`, same "`activeIds` is the caller's responsibility"
 * convention as `boonConditionFactsForSkill`/`auraFactsForSkill`. Call once per matcher table
 * (`CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`/`BOON_STRIP_CORRUPT_MATCHERS`), same as the
 * whole-build version. `wvwOverride` is this skill's own per-status override map (same
 * `gameData.wvwFactOverrides.skill[skill.id]` slice `boonConditionFactsForSkill`/
 * `auraFactsForSkill` take) — see `namedFactsFrom`'s doc comment for what it does.
 */
export function namedFactsForSkill(
  skill: Skill,
  activeIds: Set<number>,
  equippedLegendIdSet: Set<string>,
  wvwOverride: Record<string, WvwFactOverride> | undefined,
  matchers: Record<string, (fact: Fact) => boolean>,
  targetCountTables?: Record<string, { skill: Record<number, SourceTargetCountOverride>; trait: Record<number, SourceTargetCountOverride> }>
): NamedFactSource[] {
  return namedFactsFrom(
    skill.facts,
    skill.traitedFacts,
    activeIds,
    equippedLegendIdSet,
    'skill',
    skill.id,
    skill.name,
    skill.icon,
    wvwOverride,
    matchers,
    targetCountTables
  )
}

export interface NamedFactGroup {
  name: string
  sources: NamedFactSource[]
}

export function groupNamedFactSources(sources: NamedFactSource[]): NamedFactGroup[] {
  const map = new Map<string, NamedFactGroup>()
  for (const source of sources) {
    let group = map.get(source.name)
    if (!group) {
      group = { name: source.name, sources: [] }
      map.set(source.name, group)
    }
    group.sources.push(source)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export interface ComboSource {
  sourceKind: 'skill' | 'trait'
  sourceId: number
  sourceName: string
  sourceIcon: string
  kind: 'field' | 'finisher'
  /** GW2's 11 field types (e.g. "Fire", "Water", "Ethereal") — set when `kind === 'field'`. */
  fieldType: string | null
  /** GW2's 4 finisher types ("Blast"/"Leap"/"Projectile"/"Whirl") — set when `kind === 'finisher'`. */
  finisherType: string | null
}

function comboFactsFrom(
  facts: Fact[],
  traitedFacts: Fact[],
  activeIds: Set<number>,
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  sourceName: string,
  sourceIcon: string
): ComboSource[] {
  const out: ComboSource[] = []
  for (const fact of [...facts, ...traitedFacts]) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    if (fact.type === 'ComboField' && typeof fact.field_type === 'string') {
      out.push({ sourceKind, sourceId, sourceName, sourceIcon, kind: 'field', fieldType: fact.field_type, finisherType: null })
    } else if (fact.type === 'ComboFinisher' && typeof fact.finisher_type === 'string') {
      out.push({ sourceKind, sourceId, sourceName, sourceIcon, kind: 'finisher', fieldType: null, finisherType: fact.finisher_type })
    }
  }
  return out
}

/**
 * Every Combo Field/Finisher a build provides — same skill/trait-walking rules as
 * `computeAuraSources`, reading the API's own `ComboField`/`ComboFinisher` fact types
 * directly (a different shape than the `Buff`-with-`status`/`duration` facts boons/conditions/
 * auras use, so this doesn't go through `extractFromFacts`/`classify` at all). The API
 * exposes only one generic icon per fact type (not per field/finisher type — confirmed via a scan
 * of data/game-data/skills.json this session: every `ComboField` fact shares one icon regardless of
 * `field_type`, same for `ComboFinisher`/`finisher_type`), so `fieldType`/`finisherType` are
 * display-layer detail (e.g. a tooltip) rather than something with its own distinct icon to render.
 */
export function computeComboSources(
  build: Build,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
    familiars: Familiar[]
  }
): ComboSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const out: ComboSource[] = []
  const { skillsById, skillIds } = equippedSkillsById(build, gameData)

  out.push(
    ...extractSkillSourcesWithAdditiveDedup(
      skillIds,
      skillsById,
      (skill) => comboFactsFrom(skill.facts, skill.traitedFacts, activeIds, 'skill', skill.id, skill.name, skill.icon),
      (f) => [f.kind, f.fieldType, f.finisherType].join('|')
    )
  )

  for (const line of build.specializations) {
    if (line == null) continue
    for (const trait of gameData.traits) {
      if (trait.specializationId !== line.specializationId) continue
      const isMinor = trait.slot === 'Minor'
      const isChosenMajor = trait.slot === 'Major' && line.chosenTraitIds.includes(trait.id)
      if (!isMinor && !isChosenMajor) continue
      out.push(...comboFactsFrom(trait.facts, trait.traitedFacts, activeIds, 'trait', trait.id, trait.name, trait.icon))
    }
  }

  return out
}

/**
 * Combo Field/Finisher facts a single skill grants — per-skill counterpart to
 * `computeComboSources`, same "`activeIds` is the caller's responsibility" convention as
 * `boonConditionFactsForSkill`/`auraFactsForSkill`/`namedFactsForSkill`.
 */
export function comboFactsForSkill(skill: Skill, activeIds: Set<number>): ComboSource[] {
  return comboFactsFrom(skill.facts, skill.traitedFacts, activeIds, 'skill', skill.id, skill.name, skill.icon)
}

export interface BoonConditionGroup {
  name: string
  isCondition: boolean
  sources: BoonConditionSource[]
}

export function groupBoonConditionSources(sources: BoonConditionSource[]): BoonConditionGroup[] {
  const map = new Map<string, BoonConditionGroup>()
  for (const source of sources) {
    let group = map.get(source.boonOrConditionName)
    if (!group) {
      group = { name: source.boonOrConditionName, isCondition: source.isCondition, sources: [] }
      map.set(source.boonOrConditionName, group)
    }
    group.sources.push(source)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Minimum `targetCount` for a source to count as "reaches a full party" — TODO.md's "party-wide-only
 * filter" (flagged 2026-08-16, user-confirmed wording: "just the buffs that target 5+ players, a
 * full party"). A squad-wide 10-target effect still counts, since a full party is a subset of that
 * reach; self-only (1) and small-group (2-4) sources don't. `targetCount === null` (unresolved/
 * uncurated reach — see `BoonConditionSource.targetCount`'s doc comment) is deliberately excluded
 * too, conservative by design: don't claim party-wide for a source this app hasn't actually curated.
 */
export const PARTY_WIDE_TARGET_COUNT = 5

export function isPartyWideTargetCount(targetCount: number | null): boolean {
  return targetCount !== null && targetCount >= PARTY_WIDE_TARGET_COUNT
}

/**
 * Party-wide-only filter for a whole `BoonConditionGroup[]`/`NamedFactGroup[]` row — drops every
 * source that doesn't reach a full party (`isPartyWideTargetCount`), then drops any group left with
 * zero sources. Used by `BoonConditionSummaryPanel`/`PartyRow`/`SlotTile`'s "party-wide only" toggle
 * for the rows that are uniformly ally-facing (Boons, Auras, Miscellaneous) — the caller is
 * responsible for NOT applying this to Conditions/Control (enemy-facing, unaffected by the toggle
 * per the item's scoping) and for using `filterPartyWideNamedFactGroups` instead of this for the
 * combined "Strips / Corrupts / Cleanses" row, where only the Cleanse line is ally-facing.
 */
export function filterPartyWideGroups<G extends { sources: { targetCount: number | null }[] }>(groups: G[]): G[] {
  return groups
    .map((g) => ({ ...g, sources: g.sources.filter((s) => isPartyWideTargetCount(s.targetCount)) }))
    .filter((g) => g.sources.length > 0)
}

/** The one ally-facing name within `BOON_STRIP_CORRUPT_MATCHERS`' combined row — shared by every
 *  caller of `filterPartyWideNamedFactGroups`/`filterPartyWideNamedFactEntries` for the "Strips /
 *  Corrupts / Cleanses" row, so the set only needs to be extended in one place if that row ever
 *  gains a second ally-facing matcher name. */
export const CLEANSE_ONLY_NAMES: ReadonlySet<string> = new Set(['Cleanse'])

/**
 * Same idea as `filterPartyWideGroups`, but only filters groups whose `name` is in `namesToFilter` —
 * every other group's `sources` passes through untouched. Built for the combined "Strips / Corrupts /
 * Cleanses" row (`BOON_STRIP_CORRUPT_MATCHERS`), where Strip/Corrupt are enemy-facing (don't filter)
 * and only Cleanse is ally-facing (`namesToFilter: CLEANSE_ONLY_NAMES`).
 */
export function filterPartyWideNamedFactGroups(groups: NamedFactGroup[], namesToFilter: ReadonlySet<string>): NamedFactGroup[] {
  return groups
    .map((g) => (namesToFilter.has(g.name) ? { ...g, sources: g.sources.filter((s) => isPartyWideTargetCount(s.targetCount)) } : g))
    .filter((g) => g.sources.length > 0)
}
