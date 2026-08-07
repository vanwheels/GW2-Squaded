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
   * ambiguous on skills that hit foes AND self simultaneously (e.g. Heat Wave: Vigor to self,
   * Burning to up to 5 foes) vs. a handful that reuse the same label for an ally count instead
   * (Healing Rain, Healing Seed, and — confirmed this sweep — Healing Turret's id 5857 variant).
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
type TargetCountOverride = number | 'self'

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
 */
const TARGET_COUNT_OVERRIDES: { skill: Record<number, TargetCountOverride>; trait: Record<number, TargetCountOverride> } = {
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
    51711: 5
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
    2237: 5 // River's Flow (Elementalist) — "Grant boons to nearby allies and gain positive flow when swapping to the gunsaber."
    // Phoenix Protocol (trait 2195, Willbender) deliberately excluded — see this table's top comment.
  }
}

/** The only reliable "this reaches up to N allies" signal in the API's fact data — see
 *  `BoonConditionSource.targetCount`'s doc comment for why nothing else (the enemy-facing "Number
 *  of Targets" fact, or the absence of any Number fact at all) is trustworthy enough to use here.
 *  Falls back to `TARGET_COUNT_OVERRIDES` (a curated, wiki-verified per-source decision) when the
 *  fact data itself has no signal at all. */
function resolveTargetCount(facts: Fact[], sourceKind: 'skill' | 'trait', sourceId: number): number | null {
  const alliedFact = facts.find((f) => f.type === 'Number' && f.text === 'Number of Allied Targets' && typeof f.value === 'number')
  if (typeof alliedFact?.value === 'number') return alliedFact.value
  const override = TARGET_COUNT_OVERRIDES[sourceKind][sourceId]
  return typeof override === 'number' ? override : null
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
    if (fact.type !== 'Buff' || typeof fact.status !== 'string' || typeof fact.duration !== 'number') {
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
        if (id !== null) ids.push(id)
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

export interface NamedFactSource {
  sourceKind: 'skill' | 'trait'
  sourceId: number
  sourceName: string
  sourceIcon: string
  name: string
  /** Human-readable magnitude when the underlying fact carries one (duration in seconds, a
   *  distance, or a plain count) — `null` for presence-only facts (e.g. Breaks Stun). */
  detail: string | null
}

function namedFactDetail(fact: Fact): string | null {
  if (typeof fact.duration === 'number') return `${fact.duration}s`
  if (typeof fact.distance === 'number') return `${fact.distance}`
  if (typeof fact.value === 'number') return `${fact.value}`
  return null
}

/** At most one entry per matcher name per source (a skill/trait with 2 facts both matching e.g.
 *  "Barrier" shouldn't produce 2 identical tooltip lines). */
function namedFactsFrom(
  facts: Fact[],
  traitedFacts: Fact[],
  activeIds: Set<number>,
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  sourceName: string,
  sourceIcon: string,
  matchers: Record<string, (fact: Fact) => boolean>
): NamedFactSource[] {
  const out: NamedFactSource[] = []
  const matchedNames = new Set<string>()
  for (const fact of [...facts, ...traitedFacts]) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    for (const [name, match] of Object.entries(matchers)) {
      if (matchedNames.has(name) || !match(fact)) continue
      out.push({ sourceKind, sourceId, sourceName, sourceIcon, name, detail: namedFactDetail(fact) })
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
 * Boon Strip/Corrupt — not part of gw2skills' own reference bar, added on request (strip = remove
 * an enemy's boon; corrupt = convert it into a condition instead). Both read `type: 'Number'` facts
 * — e.g. Corrupt Boon's "Boons Converted", Spectral-Grasp-style pulls' "Boons Removed"/"Boons
 * Stolen" — confirmed exhaustive label sets via a full scan of every `Number` fact's `text` this
 * session; deliberately excludes the much larger "Conditions Removed"-family labels (a build's own
 * condition-cleanse on itself/allies — an unrelated concept, not a strip/corrupt of an enemy boon).
 */
export const BOON_STRIP_CORRUPT_MATCHERS: Record<string, (fact: Fact) => boolean> = {
  Strip: (f) => f.type === 'Number' && typeof f.text === 'string' && /boons? (removed|stolen)/i.test(f.text),
  Corrupt: (f) => f.type === 'Number' && typeof f.text === 'string' && /boons? converted/i.test(f.text)
}

/**
 * Generic counterpart to `computeAuraSources`/`computeComboSources` for named facts that don't
 * share boons/conditions/auras' `Buff`-with-`status` shape — Control/Miscellaneous/Strip&Corrupt
 * each read a mix of fact `type`s (`Time`/`Distance`/`Number`/`StunBreak`/`NoData`/`AttributeAdjust`),
 * so each is defined as a small `name -> (fact) => boolean` matcher table (`CONTROL_MATCHERS` etc.,
 * above) instead of a single classify function. Same skill/trait-walking rules as
 * `computeAuraSources`/`computeComboSources`; call once per matcher table.
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
  matchers: Record<string, (fact: Fact) => boolean>
): NamedFactSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const out: NamedFactSource[] = []
  const { skillsById, skillIds } = equippedSkillsById(build, gameData)

  for (const id of skillIds) {
    const skill = skillsById.get(id)
    if (!skill) continue
    out.push(...namedFactsFrom(skill.facts, skill.traitedFacts, activeIds, 'skill', skill.id, skill.name, skill.icon, matchers))
  }

  for (const line of build.specializations) {
    if (line == null) continue
    for (const trait of gameData.traits) {
      if (trait.specializationId !== line.specializationId) continue
      const isMinor = trait.slot === 'Minor'
      const isChosenMajor = trait.slot === 'Major' && line.chosenTraitIds.includes(trait.id)
      if (!isMinor && !isChosenMajor) continue
      out.push(...namedFactsFrom(trait.facts, trait.traitedFacts, activeIds, 'trait', trait.id, trait.name, trait.icon, matchers))
    }
  }

  return out
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
