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

export interface Profession {
  id: ProfessionId
  name: string
  icon: string
  iconBig: string
  specializationIds: number[]
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

export interface GameData {
  professions: Profession[]
  specializations: Specialization[]
  traits: Trait[]
  skills: Skill[]
  itemStats: ItemStat[]
}
