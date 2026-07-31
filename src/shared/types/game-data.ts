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

/**
 * One profession-mechanic ("F-skill") slot entry, straight from `/v2/professions`' own `skills`
 * array filtered to `type === 'Profession'` — e.g. Guardian's `Profession_1`/`_2`/`_3` (Virtue of
 * Justice/Resolve/Courage), Engineer's `Profession_1`-`_4` (Toolbelt). Confirmed live 2026-07-30:
 * an elite spec that reworks a mechanic skill (e.g. Firebrand's Tomes replacing Guardian's base
 * Virtues) contributes its OWN id under the same `slot` string, distinguished from the base id via
 * that skill's own `Skill.specializationId` field (the exact same signal
 * `skill-calc/skill-variants.ts` already uses for Heal/Utility/Elite reworks) — no separate
 * per-elite-spec field exists on this entry itself, and none was needed.
 */
export interface ProfessionMechanicSkill {
  id: number
  /** `Profession_1`-`Profession_4`, matching the GW2 API's mechanic-slot naming. */
  slot: string
}

export interface Profession {
  id: ProfessionId
  name: string
  icon: string
  iconBig: string
  specializationIds: number[]
  /** Keyed by weapon type name (e.g. "Greatsword", "Axe"). */
  weapons: Record<string, ProfessionWeapon>
  /** Every profession-mechanic skill id across every base/elite-spec variant — see
   *  `ProfessionMechanicSkill` and `src/shared/skill-calc/profession-mechanic.ts`, which resolves
   *  this down to the one bar (F1-F5) that actually applies for a build's equipped specs. */
  professionSkills: ProfessionMechanicSkill[]
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
  /** GW2's own profession-mechanic grouping (e.g. `"Meditation"`, `"Signet"`, `"Consecration"`)
   *  for Heal/Utility/Elite skills — empty for weapon skills, which the API never categorizes.
   *  Confirmed live against the raw `/v2/skills` endpoint 2026-07-30 (not modeled in this app's
   *  data before that): most profession-mechanic skills carry exactly one category, a real chunk
   *  carry none at all (e.g. Guardian's "Shelter", Firebrand's "Restoring Reprieve") — used to
   *  group the skill picker into columns, see `SkillsEditor.tsx`. */
  categories: string[]
  facts: Fact[]
  traitedFacts: Fact[]
  /** Elemental attunement this specific id's effect is for (e.g. `"Fire"`), only present on the
   *  4 attunement-specific ids of an Elementalist attunement-conditional skill (e.g. "Glyph of
   *  Lesser Elementals") — the attunement-agnostic id a player actually equips has no attunement
   *  field at all. Used by src/shared/skill-calc/skill-variants.ts to exclude the non-equippable
   *  variant ids from pickers, see that file's doc comment. */
  attunement: string | null
  /** Elite specialization id this specific id's effect applies under, for a same-name skill whose
   *  effect is reworked by having that spec equipped (e.g. Revenant Demon-legend skills reworked
   *  by Vindicator/Conduit) — `null` for the base/unmodified id. Used by
   *  src/shared/skill-calc/skill-variants.ts to auto-select the right variant per equipped specs. */
  specializationId: number | null
  /** The skill id this one becomes after being activated (e.g. a kit's "Stow X" skill, a turret's
   *  "Detonate X" skill, a mantra's charged cast, a multi-hit chain's next hit) — `null` if this
   *  skill has no such second step. The target is never independently equippable in-game (you
   *  can't bind "Stow Med Kit" as your heal skill), so it's excluded from Heal/Utility/Elite
   *  pickers by src/shared/skill-calc/skill-variants.ts rather than offered as a separate pick. */
  flipSkill: number | null
  /** Engineer-only: the Toolbelt skill this Heal/Utility/Elite skill generates (F1-F4) when
   *  equipped — `null` for every non-Engineer skill and for Engineer skills with no toolbelt
   *  counterpart. Sourced from the API's own `toolbelt_skill` field; used by
   *  `skill-calc/profession-mechanic.ts`'s `engineerToolbeltBar` instead of the slot-based
   *  resolver, since the base Toolbelt bar isn't enumerable via `professionSkills` at all — it's
   *  generated per equipped Utility (and Heal) choice rather than fixed per elite spec. */
  toolbeltSkill: number | null
  /** Engineer Kit-style skills only: the ids of the 5 (or 10, land+underwater — see
   *  `weapon-calc/weapon-skills.ts`'s land/underwater disambiguation, reused for these) skills this
   *  bundle swaps the weapon-skill bar to while active. Sourced from the API's own `bundle_skills`
   *  field; `null` for every skill that isn't a bundle (the vast majority). Not populated for
   *  Firebrand's Tomes — those 15 chapter skills have no id anywhere in the public API at all (live-
   *  verified 2026-07-30), so they're sourced from the wiki instead, see `TomeChapter` below. */
  bundleSkills: number[] | null
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
 * Non-equippable Glyph form-variant skill id -> the canonical id it's actually equipped as.
 * Confirmed live 2026-07-30: Druid's 6 duplicate-named Glyph skills (e.g. "Glyph of Equality")
 * each have 3 API ids — one canonical id a player actually binds (whose effect changes
 * automatically with current Celestial Avatar form, the same "one id, context-dependent effect"
 * shape `Skill.attunement` already models for Elementalist glyphs), plus two purely-descriptive
 * wiki-subpage ids ("<name> (non-celestial)" / "<name> (Celestial Avatar)") that document each
 * form's effect separately but are never independently equippable. No API field distinguishes
 * these (unlike `Skill.attunement`), so it's sourced from the wiki instead — see
 * scripts/fetch-glyph-forms.ts and docs/game-data.md. Ids absent from this map need no
 * substitution (either not a Glyph, or a group the fetch script couldn't unambiguously resolve —
 * fails open, left un-collapsed same as before this existed).
 */
export type GlyphFormVariantMap = Record<number, number>

/**
 * Skill ids to always exclude from Heal/Utility/Elite pickers, on top of the 6 in-code signals
 * `skill-calc/skill-variants.ts` already applies (attunement/specialization/flip-root/
 * ground-target/glyph-form/turret-sub-ability). Wiki-sourced (see
 * scripts/fetch-skill-duplicate-resolutions.ts): for a duplicate-name group none of the in-code
 * signals resolve, an id absent from that skill's own wiki page `id=` field is treated as a
 * legacy/undocumented-variant id (e.g. an "(underwater)" sibling page's own id, since this app has
 * no per-skill environment toggle outside the weapon bar) and excluded. Ids absent from this list
 * need no exclusion (either not ambiguous, or a group the fetch script couldn't verify against the
 * wiki — fails open, left un-collapsed same as before this existed).
 */
export type SkillVariantExclusions = number[]

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
 * A Ranger pet species (e.g. "Juvenile Jungle Stalker"). Confirmed live 2026-07-30: `/v2/pets`
 * gives exactly one real, always-equippable skill per pet (`skillId`, the "F2" special ability
 * shown by the pet's portrait) — that's the entire per-build-determinable Ranger mechanic. The
 * much larger per-pet-*family* skill list in `Profession.professionSkills` (Profession_1/_2, e.g.
 * "Swoop"/"Bite") turned out to be Soulbeast's Beastmode skill-bar replacement, not this — same
 * "replaces the weapon bar" shape as Firebrand Tomes/Engineer Kits, deliberately out of scope
 * here (see TODO.md). Unlike `Legend`, pets aren't spec-gated at all (no core/elite split).
 */
export interface Pet {
  id: number
  name: string
  icon: string
  skillId: number
}

/**
 * Ranger Soulbeast's Beastmode F1/F2 (per pet *family*) and F3 (per pet *archetype*) skills,
 * keyed by `Pet.id` — see `scripts/fetch-soulbeast-beastmode.ts` for how this is resolved (no API
 * field links a pet to a Beastmode skill at all; wiki-sourced, cross-checked against
 * `data/game-data/skills.json` at every step, not guessed).
 */
export interface SoulbeastBeastmodeBar {
  f1SkillId: number
  f2SkillId: number
  f3SkillId: number
}
export type SoulbeastBeastmodeMap = Record<number, SoulbeastBeastmodeBar>

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
 * TODO.md). Exact numeric values are sourced separately from the wiki — see `RelicEffect` below.
 */
export interface Relic {
  id: number
  name: string
  icon: string
  description: string
}

/**
 * One `{{skill fact|...}}` template invocation parsed from a relic's wiki infobox `facts=` field
 * (relic wiki pages reuse the exact same template skills/traits use to document their own numeric
 * facts — see scripts/fetch-relic-effects.ts). `label` is the template's first parameter (e.g.
 * "Damage Increase", "effect", "might", "targets") in the wiki's own casing; `values` is every
 * remaining bare (non key=value) positional parameter, in wikitext order; `params` is every
 * key=value parameter (`desc`, `stacks`, `icon`, `alt`, `coefficient`, `weapon`, ...), keys
 * lowercased. Already filtered to the WvW-relevant line wherever a fact is split by `game mode=`
 * (a PvE-only or PvP-only alternate line for the same label is dropped, not stored) — there is no
 * per-line game-mode field left on this type because that resolution already happened.
 */
export interface RelicFactLine {
  label: string
  values: string[]
  params: Record<string, string>
}

/**
 * A relic's wiki-sourced numeric effect data: every WvW-relevant `{{skill fact}}` line from its
 * infobox, plus its internal cooldown if the wiki documents one (`rechargeSeconds` prefers a
 * `recharge wvw=` override over the plain `recharge=` field, since a handful of relics have a
 * WvW/PvP-specific recharge distinct from PvE — see docs/game-data.md). Purely a display-layer
 * enrichment of `Relic.description` — deliberately NOT wired into the boon/condition uptime
 * calculator (`src/shared/boon-calc/sources.ts`), unlike skill/trait Buff facts: a relic's facts
 * fire on conditional player actions ("after granting a boon", "upon dealing damage with a
 * skill on 20s+ recharge") rather than on-cast like a skill, so there's no fixed "you get this
 * boon for this duration" guarantee to aggregate into an uptime total without inventing a usage-
 * frequency assumption this app doesn't model anywhere else. See TODO.md.
 */
export interface RelicEffect {
  facts: RelicFactLine[]
  rechargeSeconds: number | null
}

/**
 * Relic id -> its wiki-sourced effect data. Not every relic id has an entry: some relic wiki
 * pages document a `facts=`-carrying effect that couldn't be safely attributed to every
 * relics.json id sharing that page's name — see scripts/fetch-relic-effects.ts's id-reliability
 * check — and those extra ids are simply omitted here (fail-safe: falls back to `Relic.description`
 * only, same as before this existed, never wrong data attached to the wrong id).
 */
export type RelicEffectsById = Record<number, RelicEffect>

/**
 * One of a Firebrand Tome's 5 chapter skills (e.g. Tome of Justice's "Chapter 1: Searing Spell"),
 * which genuinely replace the weapon-skill bar (1-5) while their tome is open — see
 * `Skill.bundleSkills` for Engineer's equivalent Kit mechanic. Confirmed live 2026-07-30 these 15
 * chapter skills carry NO id anywhere in the public API (`/v2/skills?ids=<the wiki's own internal
 * id>` returns "all ids provided are invalid" even though the wiki's `{{Skill infobox}}` lists
 * one), so unlike Kits, this data is entirely wiki-sourced via `scripts/fetch-tome-chapters.ts`,
 * reusing the exact `{{skill fact|...}}` parsing `scripts/fetch-relic-effects.ts` already
 * established (`RelicFactLine` — same shape, different source page).
 */
export interface TomeChapter {
  /** The parent tome's own equippable id (e.g. Tome of Justice = 44364) — one of the ids already
   *  resolved onto Firebrand's F1/F2/F3 by `skill-calc/profession-mechanic.ts`. */
  tomeSkillId: number
  /** 0-4, matching weapon-skill slots 1-5 in order (from the wiki's own `weapon slot=` field, not
   *  array position — authoritative in case a page is ever reordered). */
  slotIndex: number
  name: string
  description: string
  icon: string
  facts: RelicFactLine[]
}

/** Tome skill id -> its 5 chapters, in `slotIndex` order. */
export type TomeChaptersByTomeId = Record<number, TomeChapter[]>

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
  /** `ItemStat.name` -> a representative icon URL, e.g. "Berserker's" -> the icon of a real
   *  "Berserker's ... Insignia" crafting item sharing that name prefix (itemstats themselves have
   *  no icon field — see `scripts/fetch-gear-upgrades.ts`'s `deriveItemStatIcons`). Not every stat
   *  name resolves: compound legacy combos (e.g. "Dire and Rabid") and WvW/PvP-only amulet stat
   *  names (e.g. "Harrier's") have no matching insignia at all — absent from this map, not a bug. */
  itemStatIcons: Record<string, string>
  eliteSpecSkills: EliteSpecSkillMap
  glyphFormVariants: GlyphFormVariantMap
  skillVariantExclusions: SkillVariantExclusions
  wvwFactOverrides: WvwFactOverrides
  legends: Legend[]
  pets: Pet[]
  soulbeastBeastmode: SoulbeastBeastmodeMap
  runes: Rune[]
  sigils: Sigil[]
  infusions: Infusion[]
  relics: Relic[]
  relicEffects: RelicEffectsById
  food: Consumable[]
  utility: Consumable[]
  tomeChapters: TomeChaptersByTomeId
}
