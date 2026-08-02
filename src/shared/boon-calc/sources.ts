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
import { weaponSkillIdsForPair } from '../weapon-calc/weapon-skills'
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
  for (const fact of [...facts, ...traitedFacts]) {
    if (fact.type !== 'Buff' || typeof fact.status !== 'string' || typeof fact.duration !== 'number') {
      continue
    }
    const category = classify(fact.status)
    if (category === null) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue

    const wvwOverride = wvwOverrides?.[fact.status]
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
      requiresTraitId: fact.requires_trait ?? null
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
 * Elementalist swaps attunement freely mid-fight (see `Build.activeAttunement`'s doc comment).
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
  const attunements: (string | null)[] = profession.id === 'Elementalist' ? [...ELEMENTALIST_ATTUNEMENTS] : [null]

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
    for (const attunement of attunements) {
      for (const id of weaponSkillIdsForPair(
        mainWeapon,
        offWeapon,
        build.environment,
        skillsById,
        equippedSpecializationIds,
        mainType ?? null,
        offType ?? mainType ?? null,
        attunement
      )) {
        if (id !== null) ids.push(id)
      }
    }
    if (isUntamed && mainType && mainWeapon) {
      const altId = unleashedWeaponOneId(mainType, mainWeapon, build.environment, skillsById)
      if (altId !== null) ids.push(altId)
    }
  }
  return ids
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
      requiresTraitId: null
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
 * this session) — a substring match, not a guess. Healing is deliberately not included here — see
 * TODO.md's "Healing"/"Damage" numbers pass, which is where a real Healing signal belongs.
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
