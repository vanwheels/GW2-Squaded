/**
 * Normalized, app-facing shapes for static GW2 game data.
 *
 * These are trimmed/normalized from the raw GW2 API v2 responses by
 * scripts/fetch-game-data.ts (see docs/game-data.md) and written to
 * data/game-data/*.json. Raw API response shapes are intentionally NOT
 * modeled here — they're typed loosely and locally within the fetch script.
 */

export type ProfessionId = string // e.g. "Guardian", "Warrior"

/**
 * The GW2 API's `Fact` object is a large polymorphic union keyed by `type`
 * (Buff, Damage, Heal, Distance, Recharge, ...) — most fields are specific to
 * one or two `type` values. Rather than modeling all ~19 variants, this keeps
 * the fields the boon/condition calculator (src/shared/boon-calc/) actually
 * reads, plus an index signature so the rest of the raw object round-trips
 * even though it isn't typed. `status`/`duration`/`apply_count` are what a
 * `type: 'Buff'` fact uses; `requires_trait` gates a fact (base or traited)
 * behind a specific trait being chosen, on either skills or traits.
 */
export interface Fact {
  type: string
  text?: string
  icon?: string
  status?: string
  description?: string
  duration?: number
  apply_count?: number
  requires_trait?: number
  overrides?: number
  [key: string]: unknown
}

export type WeaponFlag = 'Mainhand' | 'Offhand' | 'TwoHand' | 'Aquatic'

export interface ProfessionWeaponSkillSlot {
  id: number
  /** `Weapon_1`-`Weapon_5`, matching the GW2 API's weapon-skill slot naming. */
  slot: string
}

/**
 * One weapon type (e.g. "Greatsword") as usable by a specific profession. `flags` carries the
 * real GW2 hand-restriction rules (`Mainhand`/`Offhand`/`TwoHand`) plus `Aquatic` for
 * underwater-usable weapons — some weapons (e.g. Spear) carry both `TwoHand` and `Aquatic` and
 * are dual-use (10 skills: 5 land + 5 underwater variants), while others (e.g. Trident) are
 * `Aquatic`-only. Don't hand-roll this table — it's sourced directly from `/v2/professions`.
 */
export interface ProfessionWeapon {
  flags: WeaponFlag[]
  /** Elite specialization id required to unlock this weapon on this profession, if gated. */
  specializationId: number | null
  skills: ProfessionWeaponSkillSlot[]
}

export interface Profession {
  id: ProfessionId
  name: string
  icon: string
  iconBig: string
  specializationIds: number[]
  /** Keyed by weapon type name (e.g. "Greatsword", "Axe"). */
  weapons: Record<string, ProfessionWeapon>
}

export interface Specialization {
  id: number
  name: string
  profession: ProfessionId
  elite: boolean
  icon: string
  background: string
  minorTraitIds: number[]
  majorTraitIds: number[]
}

export type TraitSlot = 'Major' | 'Minor'

export interface Trait {
  id: number
  tier: number
  order: number
  name: string
  description: string
  slot: TraitSlot
  specializationId: number
  icon: string
  facts: Fact[]
  traitedFacts: Fact[]
}

export interface Skill {
  id: number
  name: string
  description: string
  icon: string
  chatLink: string
  type: string
  weaponType: string | null
  professions: ProfessionId[]
  slot: string
  facts: Fact[]
  traitedFacts: Fact[]
}

export interface ItemStatAttribute {
  attribute: string
  multiplier: number
  value: number
}

export interface ItemStat {
  id: number
  name: string
  attributes: ItemStatAttribute[]
}

/**
 * Skill id -> the elite specialization id required to use it, for Heal/Utility/Elite skills
 * gated behind a specific elite spec. The public GW2 API has no field for this (skills carry no
 * `specialization` id), so it's sourced from the wiki's per-spec skill categories instead — see
 * scripts/fetch-elite-spec-skills.ts and docs/game-data.md. Skills absent from this map are
 * either core (usable regardless of spec) or a small documented set the fetch script couldn't
 * unambiguously resolve (fails open — treated as ungated, same as before this existed).
 */
export type EliteSpecSkillMap = Record<number, number>

/**
 * A Revenant Legend: a fixed heal/3 utility/elite skill kit, swapped between (2 equipped at once)
 * rather than picked skill-by-skill like every other profession. `id` is the API's own opaque id
 * ("Legend1".."Legend8"); `name`/`icon` are borrowed from the legend's `swap` skill (the F2
 * "invoke legend" skill players actually click in-game) since `/v2/legends` itself carries neither.
 * `specializationId` is `null` for the 4 core legends, otherwise the elite specialization id that
 * unlocks it (Herald/Renegade/Vindicator/Conduit) — not exposed by the API at all, so it's a small
 * hand-verified constant table in scripts/fetch-game-data.ts (cross-checked against both the wiki
 * and each legend's `swap` skill name; see docs/game-data.md).
 */
export interface Legend {
  id: string
  name: string
  icon: string
  swap: number
  heal: number
  elite: number
  utilities: [number, number, number]
  specializationId: number | null
}

/**
 * A boon/condition Buff fact's game-mode split, per (skill/trait id, boon/condition name):
 * `'omit'` means the wiki tags this fact PvE-only with no WvW/PvP variant, so it should be
 * dropped entirely for a WvW-focused view; a number is the WvW/PvP-tagged duration to use in
 * place of the API's (PvE-default) `fact.duration`. Boon names absent from an id's map are
 * either unsplit (same value in every mode) or a split the fetch script couldn't verify — see
 * scripts/fetch-wvw-splits.ts and docs/game-data.md.
 */
export type WvwFactOverride = number | 'omit'
export interface WvwFactOverrides {
  skill: Record<number, Record<string, WvwFactOverride>>
  trait: Record<number, Record<string, WvwFactOverride>>
}

export interface GameData {
  professions: Profession[]
  specializations: Specialization[]
  traits: Trait[]
  skills: Skill[]
  itemStats: ItemStat[]
  eliteSpecSkills: EliteSpecSkillMap
  wvwFactOverrides: WvwFactOverrides
  legends: Legend[]
}
