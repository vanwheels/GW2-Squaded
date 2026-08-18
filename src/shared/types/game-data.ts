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
 *
 * `type: 'PrefixedBuff'` is the API's shape for "trait/skill X adds a boon
 * specifically to skill/effect Y's own application" (e.g. Revenant/Salvation's
 * Serene Rejuvenation, "Legendary Centaur skills apply boons in an area") — it
 * carries the exact same `status`/`duration`/`apply_count`/`requires_trait`
 * fields as an ordinary `Buff` fact, PLUS a nested `prefix` naming the specific
 * other effect it rides on. `prefix.status` is a display name only, NOT a
 * resolvable id — a scan of data/game-data/{traits,skills}.json found names
 * like "Natural Harmony" matching 2+ distinct skill ids with no discriminator
 * to pick one, so `extractFromFacts` (boon-calc/sources.ts) treats a
 * `PrefixedBuff` fact's boon/condition the same as an ordinary `Buff` fact
 * (same source-level attribution to the trait/skill that grants it) and never
 * tries to resolve `prefix.status` to a specific skill id.
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
  /** `type: 'PrefixedBuff'` only — see this interface's doc comment. */
  prefix?: { text?: string; icon?: string; status?: string; description?: string }
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
  /** The wiki's community-drawn "Tango icon" (GFDL-licensed, unlike the wiki's official ArenaNet
   *  art — see scripts/fetch-tango-icons.ts for why), merged in at load time from
   *  tango-icons.json by `withTangoIcons` in load-game-data.ts. Always present (all 9 professions
   *  have one, verified by that script's own hard failure if any are missing); preferred over
   *  `icon`/`iconBig` for the profession/elite-spec-identifying UI (build cards, squad-editor
   *  slots, the profession/spec pickers) per the 2026-08-18 icon-artwork switch. */
  tangoIcon: string
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
  /** Same Tango-icon merge as `Profession.tangoIcon`, only ever present for elite specs (core
   *  specializations aren't individually icon-identified anywhere in the UI, so were never
   *  fetched) — undefined for every non-elite entry. */
  tangoIcon?: string
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
 * Which `ItemStat.id`s are actually current/obtainable, split by equipment category —
 * `itemstats.json` itself is a raw dump of every combo the API has ever assigned an id to
 * (legacy pre-revamp combos included) with no "is this real" flag. Derived in
 * `scripts/fetch-gear-upgrades.ts` from every Legendary item's `details.stat_choices` (the
 * Legendary Armory stat-selector list) — confirmed live 2026-08-01 that Legendary armor and
 * Legendary weapons draw from one shared list (`armorWeapon`) and every Legendary trinket
 * (back/ring/accessory/amulet) draws from a separate, entirely disjoint list (`trinket`). A stat
 * id present in neither array (e.g. old 1-2 attribute-line combos like "Vital"/"Vigorous") isn't
 * selectable on any current item.
 */
export interface ItemStatLegalIds {
  armorWeapon: number[]
  trinket: number[]
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
 * Non-equippable Glyph form-variant skill id -> the canonical id it's actually equipped as, plus
 * which of the 2 context-dependent forms this variant id documents. Confirmed live 2026-07-30:
 * Druid's 6 duplicate-named Glyph skills (e.g. "Glyph of Equality") each have 3 API ids — one
 * canonical id a player actually binds (whose effect changes automatically with current Celestial
 * Avatar form, the same "one id, context-dependent effect" shape `Skill.attunement` already models
 * for Elementalist glyphs), plus two purely-descriptive wiki-subpage ids ("<name> (non-celestial)"
 * / "<name> (Celestial Avatar)") that document each form's effect separately but are never
 * independently equippable. No API field distinguishes these (unlike `Skill.attunement`), so it's
 * sourced from the wiki instead — see scripts/fetch-glyph-forms.ts and docs/game-data.md. Ids
 * absent from this map need no substitution (either not a Glyph, or a group the fetch script
 * couldn't unambiguously resolve — fails open, left un-collapsed same as before this existed).
 *
 * `form` was added 2026-08-04 (previously this map only recorded `canonicalId`, discarding which
 * form each variant documented) so `SkillsEditor.tsx` can read the build's current Celestial
 * Avatar toggle state (`Build.activeBundleSkillId`, same field `WeaponSkillBar` reads for its own
 * F5 toggle) and show that form's real facts on the canonical id's tooltip instead of the
 * canonical id's own sparse/generic facts — see `skill-calc/glyph-forms.ts`.
 */
export type GlyphFormVariantMap = Record<number, { canonicalId: number; form: 'normal' | 'celestial' }>

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
 * Elementalist Evoker's "familiar" companion — a passive combat pet chosen via a right-click on
 * profession skill 5 (`Profession_5`), one of 4 (Fox/Otter/Hare/Toad, one per element). Confirmed
 * live 2026-07-31 against the wiki's `Evoker`/`Familiar` pages: only one is active at a time,
 * switchable out of combat. This app models only the one build-time-determinable effect of
 * choosing a familiar: which of the Heal skill "Rejuvenate"'s 4 identical-effect ids is currently
 * bound (its icon changes to match the selected familiar — confirmed via the skill's own wiki
 * infobox: `id = 79323 <!-- fire -->, 76634 <!-- water-->, 79315 <!-- air -->, 79314 <!-- earth -->`,
 * cross-referenced against the `Evoker` page's Fox=Fire/Otter=Water/Hare=Air/Toad=Earth mapping).
 * `icon` is borrowed from that same Rejuvenate variant (same pattern `Legend.icon` uses, since
 * there's no dedicated familiar-portrait endpoint). The familiar's own basic/empowered active
 * skill (accumulated via a 6-charge system Rejuvenate also contributes to) and its passive combat
 * bonus are a real-time state machine this app's static loadout model has no equivalent for (no
 * `/v2/familiars` API endpoint exists either) — deliberately not modeled. See TODO.md.
 */
export interface Familiar {
  id: string
  name: string
  element: string
  icon: string
  rejuvenateSkillId: number
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
 *
 * `sourceAttribute` is a second, distinct shape: a "Gain <target> Equal to N% of Your <source>"
 * line (the Superior Sharpening Stone / Tuning Crystal formula — confirmed 2026-08-06 to be the
 * dominant WvW Utility-consumable shape, ~43% of `utility.json`'s catalog) rather than a flat/
 * percent bonus. When set, `attribute` holds the target's free-text name, `value` holds the
 * percent (not a flat point value or a direct-percent bonus), and `sourceAttribute` holds the
 * source's free-text name — `isPercent` is meaningless for these lines (always `false`). `null`
 * for every ordinary "+N[%] Attribute" line. Resolved against the *final* source-attribute total
 * (after gear/base/combat, same convention as `TraitConversion`) by
 * `activeConsumableConversions`/`applyConversions` in `attribute-totals.ts`, not by `addBonus`
 * (which no-ops on these — a single-pass point add can't know the source's final value yet).
 */
export interface AttributeBonusText {
  raw: string
  attribute: string | null
  value: number | null
  isPercent: boolean
  sourceAttribute: string | null
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
 * too varied to model structurally in general — kept as the API's own `description` text.
 * `bonuses` is a best-effort structured parse of that same text, one entry per line, using the
 * identical "+N[%] Attribute" pattern Rune/Consumable bonus lines use (see
 * `scripts/fetch-gear-upgrades.ts`'s `parseAttributeBonusText`) — this only actually captures the
 * small set of "stat sigils" whose whole effect is a flat/percent attribute bonus (e.g. Superior
 * Sigil of Concentration: "+10% Boon Duration"); on-crit/on-swap/on-kill procs and stacking
 * sigils (see `STACKING_SIGILS` in `combat-state.ts` — those need live stack-count simulation,
 * not a static bonus) fail to parse and come back as `{attribute: null}`, correctly left
 * display-only rather than guessed. `weaponTypes` is the list of weapon type names (e.g.
 * `"Greatsword"`, `"Dagger"`) this sigil can be applied to — a different vocabulary than
 * `WeaponFlag` (which is hand/two-hand/aquatic, not weapon type).
 */
export interface Sigil {
  id: number
  name: string
  icon: string
  description: string
  weaponTypes: string[]
  bonuses: AttributeBonusText[]
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
 * WvW/PvP-specific recharge distinct from PvE — see docs/game-data.md). Primarily a display-layer
 * enrichment of `Relic.description` (`formatRelicDescription`) — but AS OF the 2026-08-16 "Relic
 * proc integration sweep," a curated subset of relics whose proc trigger this app already models a
 * deterministic frequency for (an equipped Elite/Heal skill, or a skill of a given ability-type
 * category) also feed the boon/condition/aura uptime calculator, via `RELIC_TRIGGER_GATES` in
 * `src/shared/boon-calc/sources.ts` — see that table's own doc comment for the full curated list and
 * the reasoning for every relic deliberately still excluded. Every relic NOT in that table remains
 * display-only, for the reason this comment used to state universally: its facts fire on a
 * conditional player action with no fixed per-rotation frequency this app models.
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
 * line the same way as `Rune.bonuses`.
 *
 * Some catalog entries — "Feast"/"Tray"/"Pot" reagents that get placed down and shared with a
 * group (the WvW-standard way most players actually consume Food/Utility — a majority of WvW
 * squads run these rather than individually-carried items, per the user 2026-08-06) and Utility
 * "Station" items (see `fetch-gear-upgrades.ts`'s Generic-type bucketing) — have NO buff data of
 * their own on the API's raw item record (`details` is just `{type: 'Food'|'Generic'}`, nothing
 * else). Confirmed via the wiki (raw wikitext, e.g. Feast of Rare Veggie Pizzas: "Provides same
 * effect as Rare Veggie Pizza") that these grant the *identical* buff as a matching individually-
 * eaten item, just shareable and (usually) longer-lasting. `borrowSharedContainerBonuses` in
 * `fetch-gear-upgrades.ts` resolves this: for every such item, it looks for exactly one unambiguous
 * name match (stripping the container word — "Feast of X(s)"/"Tray of X(s)"/"Pot of X" etc. — and
 * re-singularizing/re-prefixing against every other buffed item's name) and copies that match's
 * `bonuses` over. `sharedBuffSource` records which item it borrowed from (`null` for an ordinary
 * item, or one where no unambiguous match was found — these keep `effectName`/`bonuses` empty and
 * `description` falls back to the item's own raw flavor text, same as before this existed).
 * `durationMs`/`applyCount` are deliberately NOT borrowed (the shared version's duration usually
 * differs, e.g. 1 hour vs. the individual item's 30 minutes — wrong to assume equal without a
 * per-item wiki check) — they stay `null` on a borrowed entry, same as an unmatched one.
 */
export interface Consumable {
  id: number
  name: string
  icon: string
  kind: ConsumableKind
  /** Raw GW2 API rarity string ("Basic", "Fine", "Masterwork", "Rare", "Exotic", "Ascended" — the
   *  full spread actually seen across Food/Utility; no Junk or Legendary items in either catalog).
   *  Unlike every other gear-upgrade category, Food/Utility have no single fixed rarity, so this
   *  travels with the item itself rather than being a picker-level constant — see `UpgradeRarity`/
   *  `toUpgradeRarity` in `UpgradePicker.tsx` for how it's mapped onto the tooltip/border color. */
  rarity: string
  effectName: string | null
  durationMs: number | null
  applyCount: number | null
  description: string
  bonuses: AttributeBonusText[]
  sharedBuffSource: string | null
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
  itemStatLegalIds: ItemStatLegalIds
  eliteSpecSkills: EliteSpecSkillMap
  glyphFormVariants: GlyphFormVariantMap
  skillVariantExclusions: SkillVariantExclusions
  wvwFactOverrides: WvwFactOverrides
  legends: Legend[]
  pets: Pet[]
  familiars: Familiar[]
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
