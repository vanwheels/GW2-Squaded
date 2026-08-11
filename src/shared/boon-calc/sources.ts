import type {
  Build,
  Consumable,
  EquipmentSlotKey,
  Fact,
  Infusion,
  ItemStat,
  ItemStatLegalIds,
  Legend,
  Pet,
  Profession,
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
import { boonDurationPercent, computeGearAttributeTotals, conditionDurationPercent } from '../gear-calc/attribute-totals'
import { WEAVER_SPEC_ID, weaponSkillIdsForPair } from '../weapon-calc/weapon-skills'
import { bundleCapableSkillIds, bundleSkillIdsForBuild } from '../skill-calc/bundle-skills'
import { professionMechanicBar, RANGER_BEASTMODE_SPEC_ID } from '../skill-calc/profession-mechanic'
import { unleashedWeaponOneId, UNTAMED_SPEC_ID } from '../skill-calc/untamed-unleash'

export type BoonConditionCategory = 'boon' | 'condition' | 'aura'

export interface BoonConditionSource {
  sourceKind: 'skill' | 'trait'
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
   * Resolved once per skill/trait's flat facts array and applied uniformly to every
   * `BoonConditionSource` `extractFromFacts` emits from that call — a skill with both a self-only
   * buff and an ally-only buff in the same facts array can't be bound per-buff-line without a
   * positional heuristic. Concrete examples of that exact shape turned up this sweep (Guardian's
   * Tome of Courage, Willbender's Phoenix Protocol — both mix self-only and party-wide boons
   * depending on which OTHER trait is chosen) but were left unresolved rather than mis-curated; see
   * `TARGET_COUNT_OVERRIDES`' doc comment. See TODO.md for the still-open, much larger curation-sweep
   * item this leaves (the ~399 skills/traits with an ambiguous "Number of Targets"-only reading).
   */
  targetCount: number | null
}

/** A wiki-confirmed decision for a source with no target-count fact of its own (`resolveTargetCount`
 *  would otherwise return `null`): a number is the confirmed ally count to show instead; `'self'`
 *  documents "confirmed self-only, `null` is correct" so a future sweep doesn't re-research it. */
export type TargetCountOverride = number | 'self'

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
 * Also NOT covered: Tome of Courage (ids 42259/42371/68646/68650) and the Willbender's Phoenix
 * Protocol (trait 2195) — both found to have a genuine mix of self-only and party-wide boons in the
 * SAME facts array depending on which OTHER trait is chosen (Guardian's Inspired Virtue/Indomitable
 * Courage; Willbender's Battle Presence), which this table's one-value-per-source shape can't express
 * (`targetCount` is computed once per source and applied uniformly to every boon line it emits — see
 * `BoonConditionSource.targetCount`'s doc comment on why a positional/per-buff-line split isn't
 * implemented). Concrete real-world example of the gap that doc comment says wasn't found yet — see
 * TODO.md.
 *
 * Also NOT covered: Thief's Pitfall (skill 56880). Its Might `Buff` fact only exists in
 * `traitedFacts` gated on Even the Odds (trait 1169) — Even the Odds' own description ("Apply
 * vulnerability when you steal. Apply conditions when you hit with a stealth attack.") has nothing
 * to do with Might, and the wiki flags this exact combination as a confirmed tooltip bug ("If the
 * Even the Odds trait is active, the tooltip will falsely display granting Might 5"). Since the
 * grant itself isn't real, neither `'self'` nor a number would be a correct answer — left out
 * entirely rather than curating a boon that doesn't actually happen.
 *
 * Also NOT covered: Necromancer's Well of Power (ids 10609, 10673). A genuine per-buff-line split,
 * same shape as Tome of Courage/Phoenix Protocol above — the wiki's own notes are explicit: "Only
 * the stability and stun break are exclusively applied to the caster upon cast," while "[o]ne stack
 * of Might is applied to allies in range every pulse." Stability self-only, Might party-wide(5), same
 * source, no positional split available — left out entirely rather than mis-applying one number to
 * both boon lines.
 *
 * Also NOT covered: Necromancer's Mark of Blood (skill 19117). Its base, unconditioned Regeneration
 * is confirmed party-wide ("grants regeneration to allies," own Radius(240)/Number-of-Targets(5)) —
 * but the Transfusion-trait-gated (778) Vigor is a different mechanic entirely: Transfusion's own
 * description is "Marks can be triggered by allies to heal them and provide them with additional
 * benefits," meaning only the ONE ally who steps on and triggers the mark receives Vigor, not up to
 * 5 simultaneously. Same same-source per-buff-line conflict as Well of Power above — left out.
 *
 * Also NOT covered: Revenant's Pain Absorption (ids 27322, 78505). Its own description states
 * "Grant resistance to yourself and nearby allies. Absorb conditions from those allies, gaining
 * resolution and additional resistance per condition" — the API backs this with THREE separate
 * unconditioned Resistance/Resolution `Buff` facts of different durations (party-wide base
 * Resistance at 3s, a self-only "additional resistance per condition" bonus Resistance at 1s, and a
 * self-only Resolution at 5s), i.e. the very same "Resistance" status appears twice on one source
 * with two different reaches. Same same-status per-buff-line conflict as Well of Power above — left
 * out (a fourth Resistance fact, trait-gated on Demonic Defiance/1789, is separately confirmed
 * self-only — see that trait's own "gain resistance" first-person text — but doesn't rescue the
 * base-vs-bonus conflict on the unconditioned facts).
 *
 * Also NOT covered: Revenant's Gladiator's Defense (skill 77291). Wiki confirms its boons (Weakness
 * is a condition, ignore; Resolution/Resistance are the tracked boons) are self-only by default, but
 * its "Resonance" note states that when Legendary Dwarf Stance is equipped the SAME boons are
 * "also granted to allies in a radius around you" — an explicit `Additional Allies Affected: 4` fact
 * confirms the expanded reach. This is a legend-equipped conditional, not a `requires_trait` gate the
 * fact data can express, and — like Tome of Courage/Phoenix Protocol above — flips between fully
 * self-only and fully party-wide depending on player choice with no positional split available;
 * left out rather than picking one state to always show.
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
 * excluded — a new instance of the mixed self/party-wide-under-one-source gap this table can't
 * express (see this table's top comment): its Might line ("Triggered virtue effects...now grant
 * might to allies") is party-wide, but its Fury line ("Gain fury when activating Rushing Justice") is
 * self-only, and both share the same single Radius(360)/Number-of-Targets(5) fact with no
 * `requires_trait` split distinguishing them. New recurring pattern this leg: the wiki's own "Symbol"
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
 * Also NOT covered: Elementalist's Overload Earth (skill 29618). Wiki confirms its base (untraited)
 * Stability is self-only ("Initial Stability... as a personal effect") while its base Protection is
 * party-wide ("the protection is granted to self too," despite the description saying "other
 * allies") — two different-reach boons on ONE source with no `requires_trait` (or any other) gate
 * distinguishing them, sharing the same Radius(240)/Number-of-Targets(5) fact. Same shape as Holy
 * Reckoning above — left out rather than picking one reach for both.
 *
 * Also NOT covered: Elementalist's Hare's Agility (skill 76583). Its base Swiftness is self-only
 * (wiki: "applies only to the caster," matching the skill's own first-person "Gain endurance and
 * swiftness"); Altruistic Aspect (trait 2415, "Meditation skills grant boons to allies") separately
 * confirms it adds Fury to up to 5 nearby allies specifically for this skill when traited — a real,
 * documented addition, not an undocumented quirk, but still a self-only base boon and a party-wide
 * trait-gated boon sharing one source with no way to split them. Contrast with Otter's Compassion
 * and Toad's Fortitude below, the other two Altruistic-Aspect-affected meditations this leg — both
 * curated normally because their OWN base boons are already party-wide by their own description, so
 * the trait's added boon (Regeneration / Stability respectively) shares the same reach rather than
 * conflicting with it.
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
 * first-person, no Number/Radius fact). Leg now fully closed — 4/4 Guardian sources curated. 6 sources
 * remain across 5 professions: Mesmer(2), Necromancer(1), Warrior(1), Engineer(1), Thief(1).
 */
// Exported for scripts/fetch-target-counts.ts (the wiki-extraction pipeline's target-count leg,
// TODO.md's "Wiki-sourced data pipeline" step 3) — same shape as damage-calc.ts's own
// CURATED_DAMAGE_COEFFICIENTS export for its pilot script.
export const TARGET_COUNT_OVERRIDES: { skill: Record<number, TargetCountOverride>; trait: Record<number, TargetCountOverride> } = {
  skill: {
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
    // "applies alacrity to allies affected by your dodge" (PvE only, still party-wide when it applies).
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
    76982: 5 // Glaring Burst (Luminous/radiant weapon mechanic). Own facts: explicit "Number of
    // Targets: 5", Radius(240). Two of its 4 weapon-variant PrefixedBuff facts are boon-classified —
    // Radiant Bulwark's Resolution ("Grants aegis to nearby allies on activation") and Luminous
    // Staff's Regeneration ("granting boons to allies and creating a symbol") — both explicitly ally-
    // facing per the wiki; the other 2 variants (Gleaming Blade's Vulnerability, Dazzling Hammer's
    // Damage Increase) aren't boons and are out of this sweep's scope.
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
    2116: 5 // Legendary Lore (Firebrand). Wiki: "Tome skills gain bonuses..." — vague on its own, but
    // a documented bug note confirms the ally reach explicitly ("Chapter 1: Searing Spell only grants
    // 1 stack of Might instead of 2 stacks to allies. It works as intended on self"). Firebrand's
    // Tome-skill analog of Inspired Virtue above, same boon set (Might/Regeneration/Protection) —
    // same party-wide(5) default-count convention as the rest of this table.
  }
}

/** The only reliable "this reaches up to N allies" signal in the API's fact data — see
 *  `BoonConditionSource.targetCount`'s doc comment for why nothing else (the enemy-facing "Number
 *  of Targets" fact, or the absence of any Number fact at all) is trustworthy enough to use here.
 *  Falls back to `overrides` (a curated, wiki-verified per-source decision, same `skill`/`trait`
 *  shape as `TARGET_COUNT_OVERRIDES`/`CONDITION_CLEANSE_TARGETS`) when the fact data itself has no
 *  signal at all. */
function resolveTargetCountFrom(
  facts: Fact[],
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  overrides: { skill: Record<number, TargetCountOverride>; trait: Record<number, TargetCountOverride> }
): number | null {
  const alliedFact = facts.find((f) => f.type === 'Number' && f.text === 'Number of Allied Targets' && typeof f.value === 'number')
  if (typeof alliedFact?.value === 'number') return alliedFact.value
  const override = overrides[sourceKind][sourceId]
  return typeof override === 'number' ? override : null
}

/** `resolveTargetCountFrom` against `TARGET_COUNT_OVERRIDES` specifically — the boon/condition
 *  case every existing caller uses. */
function resolveTargetCount(facts: Fact[], sourceKind: 'skill' | 'trait', sourceId: number): number | null {
  return resolveTargetCountFrom(facts, sourceKind, sourceId, TARGET_COUNT_OVERRIDES)
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
export const CONDITION_CLEANSE_TARGETS: { skill: Record<number, TargetCountOverride>; trait: Record<number, TargetCountOverride> } = {
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

/** Default classifier: real boons/conditions only — every existing caller relies on this exact
 *  behavior (unchanged from before `BoonConditionCategory` existed), so it's the default rather
 *  than something every call site has to pass explicitly. */
function classifyBoonCondition(status: string): BoonConditionCategory | null {
  if (isBoonName(status)) return 'boon'
  if (isConditionName(status)) return 'condition'
  return null
}

/** `computeAuraSources`' classifier — the 7 auras, see `AURA_NAMES` in constants.ts. */
function classifyAura(status: string): BoonConditionCategory | null {
  if (isAuraName(status)) return 'aura'
  return null
}

function extractFromFacts(
  facts: Fact[],
  traitedFacts: Fact[],
  activeIds: Set<number>,
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  sourceName: string,
  sourceIcon: string,
  durationPercent: { boon: number; condition: number },
  wvwOverrides: Record<string, WvwFactOverride> | undefined,
  classify: (status: string) => BoonConditionCategory | null = classifyBoonCondition
): BoonConditionSource[] {
  const out: BoonConditionSource[] = []
  const emittedOverriddenStatuses = new Set<string>()
  const combinedFacts = [...facts, ...traitedFacts]
  const targetCount = resolveTargetCount(combinedFacts, sourceKind, sourceId)
  for (const fact of combinedFacts) {
    // `PrefixedBuff` (e.g. Revenant/Salvation's Serene Rejuvenation, "Legendary Centaur skills
    // apply boons in an area") carries the identical status/duration/apply_count/requires_trait
    // shape as `Buff`, just with an extra `prefix` naming the specific effect it rides on — see
    // `Fact`'s doc comment for why `prefix.status` isn't used for source attribution here.
    if ((fact.type !== 'Buff' && fact.type !== 'PrefixedBuff') || typeof fact.status !== 'string' || typeof fact.duration !== 'number') {
      continue
    }
    const category = classify(fact.status)
    if (category === null) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue

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
    const baseDuration = typeof wvwOverride === 'number' ? wvwOverride : fact.duration

    const percent = category === 'condition' ? durationPercent.condition : category === 'boon' ? durationPercent.boon : 0
    out.push({
      sourceKind,
      sourceId,
      sourceName,
      sourceIcon,
      boonOrConditionName: fact.status,
      isCondition: category === 'condition',
      category,
      baseDurationSeconds: baseDuration,
      scaledDurationSeconds: baseDuration * (1 + percent / 100),
      applyCount: fact.apply_count ?? 1,
      requiresTraitId: fact.requires_trait ?? null,
      targetCount
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
  durationPercent: { boon: number; condition: number },
  wvwOverride: Record<string, WvwFactOverride> | undefined
): BoonConditionSource[] {
  return extractFromFacts(
    skill.facts,
    skill.traitedFacts,
    activeIds,
    'skill',
    skill.id,
    skill.name,
    skill.icon,
    durationPercent,
    wvwOverride
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
  durationPercent: { boon: number; condition: number },
  wvwOverride: Record<string, WvwFactOverride> | undefined
): BoonConditionSource[] {
  return extractFromFacts(
    trait.facts,
    trait.traitedFacts,
    activeIds,
    'trait',
    trait.id,
    trait.name,
    trait.icon,
    durationPercent,
    wvwOverride
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
    const offWeapon = offType ? profession.weapons[offType] : mainWeapon
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
 *  comment). Same walk as `relatedVariantSkills`'s tooltip-chain logic and `untamed-unleash.ts`'s
 *  private `flipChainIds`, duplicated locally rather than shared since each caller's return shape
 *  differs (a flat id list here vs. a `Set` there). */
function withFlipChain(startId: number, skillsById: Map<number, Skill>): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  let current: number | null = startId
  while (current !== null && !seen.has(current)) {
    seen.add(current)
    ids.push(current)
    current = skillsById.get(current)?.flipSkill ?? null
  }
  return ids
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
 * via `withFlipChain`, since none of `THIEF_STOLEN_SKILL_IDS` has an outgoing `flipSkill`).
 */
function skillIdsForBuild(
  build: Build,
  legends: Legend[],
  pets: Pet[],
  professions: Profession[],
  skillsById: Map<number, Skill>,
  soulbeastBeastmode: SoulbeastBeastmodeMap
): number[] {
  const nonWeaponIds =
    build.skills.kind === 'revenant'
      ? build.skills.legends
          .filter((id): id is string => id !== null)
          .map((id) => legends.find((l) => l.id === id))
          .filter((l): l is Legend => l !== undefined)
          .flatMap((l) => [l.swap, l.heal, l.elite, ...l.utilities])
          .flatMap((id) => withFlipChain(id, skillsById))
      : [build.skills.heal, ...build.skills.utility, build.skills.elite].filter((id): id is number => id !== null)

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
  return bundleSkillIdsForBuild(bundleCapableIds, skillsById, tomeChapters, build.environment)
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
  // `BoonConditionSource.targetCount`'s doc comment gives for the API-sourced case (one of those 8,
  // Firebrand's "Chapter 4: Shining River", is confirmed party-wide by its own description despite
  // carrying no target-count fact at all).
  const alliedTargetsFact = chapter.facts.find((f) => f.label === 'allied targets')
  const parsedTargetCount = alliedTargetsFact ? Number(alliedTargetsFact.values[0]) : NaN
  const targetCount = Number.isFinite(parsedTargetCount) ? parsedTargetCount : null
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
 */
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
  }
): BoonConditionSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const out: BoonConditionSource[] = []
  const skillsById = new Map(gameData.skills.map((s) => [s.id, s]))

  const gearTotals = computeGearAttributeTotals(build, gameData)
  const durationPercent = {
    boon: boonDurationPercent(gearTotals),
    condition: conditionDurationPercent(gearTotals)
  }

  const bundleContributions = bundleContributionsForBuild(build, gameData.professions, skillsById, gameData.tomeChapters)
  const skillIds = [
    ...skillIdsForBuild(build, gameData.legends, gameData.pets, gameData.professions, skillsById, gameData.soulbeastBeastmode),
    ...bundleContributions.kitSkillIds
  ]
  for (const id of skillIds) {
    const skill = skillsById.get(id)
    if (!skill) continue
    out.push(
      ...extractFromFacts(
        skill.facts,
        skill.traitedFacts,
        activeIds,
        'skill',
        skill.id,
        skill.name,
        skill.icon,
        durationPercent,
        gameData.wvwFactOverrides.skill[skill.id]
      )
    )
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
          'trait',
          trait.id,
          trait.name,
          trait.icon,
          durationPercent,
          gameData.wvwFactOverrides.trait[trait.id]
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
  }
): { skillsById: Map<number, Skill>; skillIds: number[] } {
  const skillsById = new Map(gameData.skills.map((s) => [s.id, s]))
  const bundleContributions = bundleContributionsForBuild(build, gameData.professions, skillsById, gameData.tomeChapters)
  const skillIds = [
    ...skillIdsForBuild(build, gameData.legends, gameData.pets, gameData.professions, skillsById, gameData.soulbeastBeastmode),
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
  }
): BoonConditionSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const out: BoonConditionSource[] = []
  const unscaled = { boon: 0, condition: 0 }
  const { skillsById, skillIds } = equippedSkillsById(build, gameData)

  for (const id of skillIds) {
    const skill = skillsById.get(id)
    if (!skill) continue
    out.push(
      ...extractFromFacts(
        skill.facts,
        skill.traitedFacts,
        activeIds,
        'skill',
        skill.id,
        skill.name,
        skill.icon,
        unscaled,
        gameData.wvwFactOverrides.skill[skill.id],
        classifyAura
      )
    )
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
  wvwOverride: Record<string, WvwFactOverride> | undefined
): BoonConditionSource[] {
  return extractFromFacts(
    skill.facts,
    skill.traitedFacts,
    activeIds,
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
  sourceKind: 'skill' | 'trait'
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
 *  gets `null` (see `NamedFactSource.targetCount`'s doc comment). */
function namedFactsFrom(
  facts: Fact[],
  traitedFacts: Fact[],
  activeIds: Set<number>,
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  sourceName: string,
  sourceIcon: string,
  matchers: Record<string, (fact: Fact) => boolean>,
  targetCountTables?: Record<string, { skill: Record<number, TargetCountOverride>; trait: Record<number, TargetCountOverride> }>
): NamedFactSource[] {
  const out: NamedFactSource[] = []
  const matchedNames = new Set<string>()
  const combinedFacts = [...facts, ...traitedFacts]
  for (const fact of combinedFacts) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    for (const [name, match] of Object.entries(matchers)) {
      if (matchedNames.has(name) || !match(fact)) continue
      const table = targetCountTables?.[name]
      const targetCount = table ? resolveTargetCountFrom(combinedFacts, sourceKind, sourceId, table) : null
      out.push({ sourceKind, sourceId, sourceName, sourceIcon, name, detail: namedFactDetail(fact), targetCount })
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

/** Matcher names in `BOON_STRIP_CORRUPT_MATCHERS` (or any other matcher table) that have a
 *  curated wiki-verified target-count table to resolve `NamedFactSource.targetCount` from — passed
 *  to `computeNamedFactSources` alongside the matcher table itself. Only `Cleanse` has one today;
 *  Strip/Corrupt (how many enemies a boon is stripped/corrupted from) and every Control/
 *  Miscellaneous name were never scoped for this and stay `null`. */
export const NAMED_FACT_TARGET_COUNT_TABLES: Record<
  string,
  { skill: Record<number, TargetCountOverride>; trait: Record<number, TargetCountOverride> }
> = {
  Cleanse: CONDITION_CLEANSE_TARGETS
}

/**
 * Generic counterpart to `computeAuraSources`/`computeComboSources` for named facts that don't
 * share boons/conditions/auras' `Buff`-with-`status` shape — Control/Miscellaneous/Strip&Corrupt
 * each read a mix of fact `type`s (`Time`/`Distance`/`Number`/`StunBreak`/`NoData`/`AttributeAdjust`),
 * so each is defined as a small `name -> (fact) => boolean` matcher table (`CONTROL_MATCHERS` etc.,
 * above) instead of a single classify function. Same skill/trait-walking rules as
 * `computeAuraSources`/`computeComboSources`; call once per matcher table. `targetCountTables` is
 * optional and forwarded straight to `namedFactsFrom` — pass `NAMED_FACT_TARGET_COUNT_TABLES` for
 * `BOON_STRIP_CORRUPT_MATCHERS`, omit it for `CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`.
 */
export function computeNamedFactSources(
  build: Build,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
  },
  matchers: Record<string, (fact: Fact) => boolean>,
  targetCountTables?: Record<string, { skill: Record<number, TargetCountOverride>; trait: Record<number, TargetCountOverride> }>
): NamedFactSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const out: NamedFactSource[] = []
  const { skillsById, skillIds } = equippedSkillsById(build, gameData)

  for (const id of skillIds) {
    const skill = skillsById.get(id)
    if (!skill) continue
    out.push(
      ...namedFactsFrom(skill.facts, skill.traitedFacts, activeIds, 'skill', skill.id, skill.name, skill.icon, matchers, targetCountTables)
    )
  }

  for (const line of build.specializations) {
    if (line == null) continue
    for (const trait of gameData.traits) {
      if (trait.specializationId !== line.specializationId) continue
      const isMinor = trait.slot === 'Minor'
      const isChosenMajor = trait.slot === 'Major' && line.chosenTraitIds.includes(trait.id)
      if (!isMinor && !isChosenMajor) continue
      out.push(
        ...namedFactsFrom(trait.facts, trait.traitedFacts, activeIds, 'trait', trait.id, trait.name, trait.icon, matchers, targetCountTables)
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
 * whole-build version — `namedFactsFrom` takes no `wvwOverrides` param at all (unlike
 * `extractFromFacts`'s Buff-fact path), a known architecture limit documented on
 * `computeNamedFactSources` itself, so there's no override to thread through here either.
 */
export function namedFactsForSkill(
  skill: Skill,
  activeIds: Set<number>,
  matchers: Record<string, (fact: Fact) => boolean>,
  targetCountTables?: Record<string, { skill: Record<number, TargetCountOverride>; trait: Record<number, TargetCountOverride> }>
): NamedFactSource[] {
  return namedFactsFrom(skill.facts, skill.traitedFacts, activeIds, 'skill', skill.id, skill.name, skill.icon, matchers, targetCountTables)
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
  }
): ComboSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const out: ComboSource[] = []
  const { skillsById, skillIds } = equippedSkillsById(build, gameData)

  for (const id of skillIds) {
    const skill = skillsById.get(id)
    if (!skill) continue
    out.push(...comboFactsFrom(skill.facts, skill.traitedFacts, activeIds, 'skill', skill.id, skill.name, skill.icon))
  }

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
