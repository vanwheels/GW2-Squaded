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
  /** Raw API skill flags (e.g. `"NoUnderwater"`) — used to disambiguate a weapon's land vs.
   *  underwater skill variants, see src/shared/weapon-calc/weapon-skills.ts. */
  flags: string[]
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

/**
 * One line of flat attribute-bonus text, parsed from the API's raw bonus/description text (e.g.
 * "+25 Power", "+5% Boon Duration"). Shared by rune per-stage bonuses and food/utility
 * consumable effect text — both are API-provided as freeform lines, not a structured fact list
 * (confirmed live 2026-07-29: unlike skills/traits, `/v2/items` never populates a `Fact`-shaped
 * array for runes, consumables, or relics — see `Relic`/`Consumable` below). Not every line
 * parses cleanly — some are unique proc/flavor text with no flat attribute (e.g. a rune's 6th
 * stage: "Gain protection (3s) when you gain fury", or "+10% Experience from Kills", which isn't
 * a real GW2 combat attribute) — those keep `raw` with `attribute`/`value` both `null` rather
 * than a guessed value. See scripts/fetch-gear-upgrades.ts's `parseAttributeBonusText`.
 */
export interface AttributeBonusText {
  raw: string
  attribute: string | null
  value: number | null
  isPercent: boolean
}

/**
 * A Superior rune. `bonuses` is one entry per equipped-count stage (index 0 = 1 piece equipped
 * ... index 5 = 6 pieces), in the API's own literal order — confirmed NOT to be a fixed
 * alternating pattern (e.g. Superior Rune of the Scholar: Power/Ferocity interleaved at
 * different values each stage, not a repeating formula) — see TODO.md. Only "Superior" tier is
 * fetched; lower rune tiers aren't selectable in this app.
 */
export interface Rune {
  id: number
  name: string
  icon: string
  bonuses: AttributeBonusText[]
}

/**
 * A Superior sigil. Sigil effects (procs, on-crit/on-swap triggers, flat passive bonuses) are
 * too varied to model structurally — kept as the API's own description text. `weaponTypes` is
 * the list of weapon type names (e.g. `"Greatsword"`, `"Dagger"`) this sigil can be applied to —
 * a different vocabulary than `WeaponFlag` (which is hand/two-hand/aquatic, not weapon type).
 */
export interface Sigil {
  id: number
  name: string
  icon: string
  description: string
  weaponTypes: string[]
}

/**
 * A WvW-specific infusion (e.g. "Concentration WvW Infusion"). Only WvW infusions are fetched —
 * Agony infusions and other general-purpose infusion types are out of scope for this app (WvW
 * doesn't use Agony resistance). Confirmed live 2026-07-29: all 8 core-attribute WvW infusions
 * (Healing/Resilient/Vital/Malign/Mighty/Precise/Concentration/Expertise) grant a single flat
 * +5 to one attribute — `attribute`/`value` capture that; `description` keeps the full tooltip
 * text (some, like Mighty, also have a WvW-flavored secondary effect not modeled structurally).
 */
export interface Infusion {
  id: number
  name: string
  icon: string
  description: string
  attribute: string | null
  value: number | null
}

/**
 * A relic (exactly 1 equipped per build). Confirmed live 2026-07-29: relics do NOT carry a
 * `Fact`/`details` object at all via the public API — only a plain-text `description` (e.g.
 * "Weapon swap recharge time is reduced."), which is often less precise than the in-game tooltip
 * (no "25%" numeric value exposed here, unlike the fuller text a screenshot showed — see
 * TODO.md). There is currently no way to derive an exact numeric modifier for most relics from
 * this endpoint; `description` is displayable as-is but not safely parseable into a stats-calc
 * input without a per-relic wiki cross-check (out of scope for this pass).
 */
export interface Relic {
  id: number
  name: string
  icon: string
  description: string
}

export type ConsumableKind = 'Food' | 'Utility'

/**
 * A food or utility consumable. The full catalog is fetched (not pre-filtered to a "WvW meta"
 * subset) per explicit user direction — see TODO.md. Confirmed live 2026-07-29: a consumable's
 * actual buff (if any) lives at `details.{name,duration_ms,apply_count,description}`, a single
 * flattened descriptor — NOT the `Fact[]` shape skills/traits use. `effectName` is the buff's
 * in-game label (e.g. "Nourishment", "Enhancement"); `bonuses` is `description` parsed line-by-
 * line the same way as `Rune.bonuses`. Some catalog entries (e.g. "Feast" reagents meant to be
 * served to a group rather than eaten directly) have no buff at all — `effectName`/`durationMs`/
 * `applyCount` are `null` and `bonuses` is empty for those; `description` falls back to the
 * item's own flavor text in that case.
 */
export interface Consumable {
  id: number
  name: string
  icon: string
  kind: ConsumableKind
  effectName: string | null
  durationMs: number | null
  applyCount: number | null
  description: string
  bonuses: AttributeBonusText[]
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
  runes: Rune[]
  sigils: Sigil[]
  infusions: Infusion[]
  relics: Relic[]
  food: Consumable[]
  utility: Consumable[]
}
