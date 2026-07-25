/**
 * Normalized, app-facing shapes for static GW2 game data.
 *
 * These are trimmed/normalized from the raw GW2 API v2 responses by
 * scripts/fetch-game-data.ts (see docs/game-data.md) and written to
 * data/game-data/*.json. Raw API response shapes are intentionally NOT
 * modeled here — they're typed loosely and locally within the fetch script.
 *
 * `facts` / `traitedFacts` are kept as `unknown[]` for now: the GW2 API's
 * Fact object is a large polymorphic union (damage, buff, heal, distance, ...)
 * that only matters once the boon/condition calculator is implemented
 * (out of scope this session). The raw fact data is preserved untyped so it
 * isn't lost, and can be typed precisely when that work starts.
 */

export type ProfessionId = string // e.g. "Guardian", "Warrior"

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
  facts: unknown[]
  traitedFacts: unknown[]
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
  facts: unknown[]
  traitedFacts: unknown[]
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
