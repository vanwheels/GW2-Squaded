import type { GlyphFormVariantMap, Skill } from '../types'
import { resolvedFlipSkillId } from './flip-skill-overrides'

const GROUND_TARGETED_FLAG = 'GroundTargeted'

/**
 * Skill ids that are structurally indistinguishable from a real equippable Heal/Utility/Elite
 * skill (non-empty `categories` would normally flag a sub-ability via
 * `stripNonEquippableSubAbilities`, but these carry `categories: []` with no `toolbeltSkill`/
 * `flipSkill` link back to an owning skill either) yet are never independently bindable in-game —
 * a small, hand-verified constant table for a real API gap, same pattern as
 * `EXCLUDED_MECHANIC_SKILL_IDS` in `profession-mechanic.ts`, not a name-prefix guess (see TODO.md's
 * own caution that "Lesser" doesn't guarantee non-equippable).
 *
 * - **44918 "Lesser Fiery Eruption"** (Elementalist Elite slot): wiki-confirmed (raw wikitext,
 *   2026-08-05) `parent = Conjure Fiery Greatsword` and `[[Category:Lesser skills]]` — an
 *   auto-triggered passive proc of the real Elite skill Conjure Fiery Greatsword, not something a
 *   player binds directly. A full scan of `skills.json` for every `name` starting with "Lesser "
 *   (37 ids total) found this is the only one with a Heal/Utility/Elite `slot` today — every other
 *   "Lesser "-prefixed id has `slot: ""` (trait/proc-only, already outside the picker's candidate
 *   filter) or `slot: "Weapon_5"` (Catalyst jade sphere overloads, a different picker entirely). If
 *   a future data refresh adds another "Lesser "-prefixed id with a Heal/Utility/Elite slot, it is
 *   NOT safe to assume it belongs here without the same wiki spot-check — some elite specs have
 *   legitimately-bound skills named that way.
 */
const NON_EQUIPPABLE_SKILL_IDS: ReadonlySet<number> = new Set([44918])

/**
 * Duplicate-name skill ids to drop in favor of a same-name sibling with strictly more complete
 * data — same "small, hand-verified constant table" pattern as `NON_EQUIPPABLE_SKILL_IDS`.
 *
 * - **15795 "Mist Form"** (Elementalist Utility slot, sibling `5554`): wiki-confirmed (raw
 *   wikitext, 2026-08-06) this is one skill with a real `recharge`/`recharge wvw`/`recharge pvp`
 *   split (30/60/75) exposed as 2 separate API ids — not 2 different skills, unlike every other
 *   still-unresolved group below. `5554` carries the PvE recharge (30) AND a `traitedFacts` entry
 *   (Soothing Disruption's Stability grant, `requires_trait: 364`); `15795` carries the WvW/PvP
 *   recharge (60) but is missing that `traitedFacts` entry entirely — a real API data gap, not a
 *   documented mechanical difference (the wiki doesn't say Soothing Disruption stops applying in
 *   WvW/PvP). `Recharge` facts are purely cosmetic tooltip text in this app (see `factLine` in
 *   `fact-numbers.ts` — never read by any calc), while `traitedFacts` feeds real boon-calc totals
 *   (`boon-calc/sources.ts` gates on `requires_trait`), so keeping `5554` avoids ever silently
 *   dropping a real Stability contribution to trade for a cosmetically-more-accurate recharge
 *   number. Net effect: this app's Mist Form tooltip shows the PvE recharge (30s) rather than the
 *   WvW one (60s) — a known, deliberate, cosmetic-only inaccuracy.
 */
const INCOMPLETE_DATA_DUPLICATE_SKILL_IDS: ReadonlySet<number> = new Set([15795])

/** Engineer trait "Gadgeteer" (specialization 21, Explosives) — see `GADGETEER_GATED_SKILL_IDS`. */
const GADGETEER_TRAIT_ID = 1679

/**
 * The Engineer "Throw Mine" id (`30337`) that's live only while Gadgeteer is chosen — confirmed via
 * a direct `/v2/skills` diff (2026-08-06): its `description` documents Gadgeteer's real "a second
 * mine is planted at your location" effect (`6161`'s doesn't), and its `flipSkill` points to a
 * different "Detonate" id than `6161`'s (the post-activation skill must itself describe 1 vs. 2
 * mines) — real, structurally-backed evidence, not a guess from the description text alone.
 */
const GADGETEER_GATED_SKILL_IDS: ReadonlySet<number> = new Set([30337])

/**
 * `skillsForProfessionAndSlot` returns every skill id matching (profession, slot) with no dedup —
 * for 117 same-name groups (verified live 2026-07-29 across Heal/Utility/Elite) this means the
 * picker shows 2+ visually-identical-looking entries for what's really one in-game skill. This
 * function collapses each same-name group down to the id(s) actually worth offering as a distinct
 * pick, using 4 real (not guessed) signals the GW2 API exposes per skill id:
 *
 * 1. **`attunement`** (8 groups, all Elementalist "based on your attunement" skills like "Glyph of
 *    Lesser Elementals"): the 4 attunement-specific ids aren't independently equippable at all —
 *    a player takes the one attunement-agnostic id and its effect varies live with current
 *    attunement. The attunement-tagged ids exist only so the API/wiki can describe each variant's
 *    effect; they're dropped entirely rather than offered as alternate picks.
 * 2. **`specializationId`** (45 groups, e.g. Guardian's "Renewed Focus" reworked by Dragonhunter,
 *    or several Revenant Legendary Demon skills reworked by Vindicator/Conduit): the reworked id
 *    is used automatically whenever that elite spec is equipped — not a user choice — so this
 *    picks whichever variant matches the build's currently-equipped specs, falling back to the
 *    spec-less (`specializationId === null`) variant when none match.
 * 3. **`flipSkill`** (multi-step skills — kits, turrets, mantras, spirit weapons, Revenant facets,
 *    a Thief chain-finisher elite): the id a skill becomes after being activated. Its target is
 *    never independently equippable in-game (you can't bind "Stow Med Kit" or "Detonate Healing
 *    Turret" as your heal skill directly — you bind the base skill and the target only ever
 *    appears as what it turns into), so `stripFlipTargets` removes any candidate that's another
 *    candidate's `flipSkill` target under a *different* name globally, before per-name grouping
 *    even runs (these never land in the same name-group to begin with). A handful of same-name
 *    flip pairs also exist with no `specializationId` to distinguish them (e.g. Guardian's Spirit
 *    Weapons — `9125`/`46170` "Hammer of Wisdom", both textually identical) — for those,
 *    `resolveGroup`'s flip-root step below drops whichever id is pointed to by the other's
 *    `flipSkill`, keeping the one the player actually equips.
 * 4. **The `GroundTargeted` flag** (~54 groups, e.g. "Lightning Flash", every Necromancer Well,
 *    every Warrior Banner): GW2 exposes its client-side ground-target-vs-auto-target casting
 *    toggle as two separate skill ids with an otherwise-identical effect. Functionally identical
 *    for this app's purposes (boon/condition output, tooltip text), so these collapse to the
 *    non-ground-targeted id as the one canonical representative.
 *
 * 5. **`glyphFormVariants`** (6 groups, Druid's duplicate-named Glyph skills — e.g. "Glyph of
 *    Equality" has 3 ids sharing one `specializationId`, so signal 2 above can't tell them apart):
 *    wiki-sourced (no API field distinguishes these, see `scripts/fetch-glyph-forms.ts`) map of
 *    non-equippable "(non-celestial)"/"(Celestial Avatar)" form-description id -> the one
 *    canonical id a player actually binds, whose effect changes automatically with current
 *    Celestial Avatar form (same "one id, context-dependent effect" shape as signal 1's
 *    attunement-based Elementalist glyphs). Applied as a `stripFlipTargets`-style pre-pass, before
 *    per-name grouping, same reasoning as flip targets: these ids are never independently
 *    equippable, so they shouldn't reach `resolveGroup` at all.
 *
 * 6. **Turret/gadget/elixir "context-menu" sub-abilities** (Engineer only — `Automatic Fire`,
 *    `Detonate <X> Turret`, `Overcharge Supply Crate`, ...): live-verified 2026-07-30 these carry
 *    `categories: []` while sharing their `toolbeltSkill` value with the real equippable skill
 *    that generates them (e.g. Rifle Turret `5818` and its own F5 overcharge `Automatic Fire`
 *    `5874` both carry `toolbeltSkill: 6178`) — they're never independently bindable to a Heal/
 *    Utility/Elite slot at all (you place the turret/gadget/elixir; the sub-ability appears
 *    automatically), unlike a real equippable skill, which always carries a non-empty `categories`
 *    (`Kit`/`Gadget`/`Turret`/`Elixir`/... — confirmed across all 745 Heal/Utility/Elite skills, no
 *    false positives found). `stripNonEquippableSubAbilities` drops any empty-`categories` skill
 *    that shares a `toolbeltSkill` with an equippable (non-empty-`categories`) sibling — a pure
 *    local-data pre-pass, no wiki fetch needed. Same treatment as flip targets: excluded before
 *    per-name grouping, sometimes emptying a group entirely (e.g. "Automatic Fire" isn't
 *    independently equippable under *either* of its 2 ids — Rifle Turret's land one and Harpoon
 *    Turret's underwater one — so the whole group disappears from the picker, not just collapses).
 * 7. **`skillVariantExclusions`** (wiki-sourced, see `scripts/fetch-skill-duplicate-resolutions.ts`):
 *    for groups signals 1-6 still can't resolve, this fetch script re-derives what's still
 *    ambiguous, fetches that name's wiki page, and excludes any local id absent from the wiki's own
 *    `id=` field (the wiki's main page is treated as authoritative for "what a player currently
 *    binds") — catching cases like a land skill's now-undocumented legacy id (Rocket Turret `22574`)
 *    or a skill's dedicated "(underwater)" sibling page (Elixir X, Rocket Boots, Spike Trap, ...),
 *    which this app doesn't model as a separate pick since only the weapon skill bar gets an
 *    Environment toggle. Applied as a pre-pass identically to signal 6.
 *
 * 8. **`familiarIdBySkillId`** (Elementalist Evoker's Heal skill "Rejuvenate" only — 1 group, 4
 *    ids): every id shares the same `specializationId` (80), so signal 2 can't tell them apart —
 *    they differ only in which familiar (Fox/Otter/Hare/Toad) the wiki documents them under (see
 *    `Familiar` in game-data.ts). Resolved by `selectedFamiliarId` (the build's own choice, not
 *    game data) the same way signal 2 resolves by equipped specs: picks the id matching the
 *    currently-selected familiar, falling back to a stable default (lowest id) before one is
 *    chosen — same "functionally identical, cosmetic-only difference" shape as the
 *    `GroundTargeted` signal, just resolved by a build field instead of always collapsing to one
 *    fixed id.
 *
 * 9. **`NON_EQUIPPABLE_SKILL_IDS`** (1 id today, see the constant's own doc comment): unlike signal
 *    6, these carry `categories: []` with no `toolbeltSkill`/`flipSkill` link back to an owning
 *    equippable skill either, so no existing structural signal catches them — a single-name group
 *    (not a duplicate), so `skillVariantExclusions` (signal 7, which only ever re-derives *still
 *    ambiguous duplicate-name groups*, see `fetch-skill-duplicate-resolutions.ts`) would never
 *    regenerate an entry for one and silently drop it on the next data refresh if added there
 *    instead. Hardcoded in-source and wiki-verified per id instead, applied as a pre-pass alongside
 *    `skillVariantExclusions`.
 *
 * 10. **`INCOMPLETE_DATA_DUPLICATE_SKILL_IDS`** (1 id today, see the constant's own doc comment):
 *     a same-name duplicate id dropped in favor of a sibling with strictly more complete data
 *     (currently just Elementalist "Mist Form"'s `15795`, missing a `traitedFacts` entry its
 *     sibling `5554` has) — same "small hand-verified constant table" shape as signal 9, applied
 *     alongside it.
 *
 * 11. **`GADGETEER_GATED_SKILL_IDS`** (Engineer "Throw Mine" only — 1 group, ids `6161`/`30337`):
 *     confirmed via a direct API diff (2026-08-06, not just the wiki text) these aren't the same
 *     "no distinguishing field" shape as signal 10's `INCOMPLETE_DATA_DUPLICATE_SKILL_IDS` — every
 *     other fact is identical, but `30337`'s `description` documents the Gadgeteer trait's real
 *     "a second mine is planted" effect and its `flipSkill` points to a different id than `6161`'s
 *     (the two ids' post-activation "Detonate" skill must itself describe 1 vs. 2 mines) — real,
 *     structurally-backed evidence this is a genuine trait-gated pair, confirming rather than
 *     overturning the prior session's wiki-text-only conclusion. Resolved by `chosenTraitIds` (the
 *     build's own currently-selected major trait ids, threaded down from `Build.specializations`
 *     the same way `selectedFamiliarId` is): picks `30337` when Gadgeteer (`1679`) is chosen,
 *     `6161` otherwise.
 *
 * The remaining duplicate-name groups (Elementalist "Mist Form" now resolved via signal 10 above;
 * Revenant "Protective Solace"/"Jade Winds" turned out not to be live picker bugs at all —
 * `RevenantSkillsEditor` builds its bar directly from `legends.json`'s fixed ids and never calls
 * this function, so their second ids are structurally unreachable orphans, same shape as the
 * Vindicator `62841`/`62793` finding — see TODO.md) have no groups left unresolved as of
 * 2026-08-06.
 */
export function visibleSkillsForSlot(
  candidates: Skill[],
  equippedSpecializationIds: ReadonlySet<number>,
  glyphFormVariants: GlyphFormVariantMap = {},
  skillVariantExclusions: ReadonlySet<number> = new Set(),
  familiarIdBySkillId: ReadonlyMap<number, string> = new Map(),
  selectedFamiliarId: string | null = null,
  chosenTraitIds: ReadonlySet<number> = new Set()
): Skill[] {
  // stripNonEquippableSubAbilities runs on the *full* candidate set before the exclusion filters
  // below — it identifies a sub-ability by the presence of its categorized parent (e.g. "Detonate
  // Rocket Turret" `38748` needs its sibling Rocket Turret `22574` still present to recognize
  // itself as non-equippable), and `skillVariantExclusions` can itself remove that parent (`22574`
  // is a wiki-confirmed legacy id, see scripts/fetch-skill-duplicate-resolutions.ts) — so running
  // sub-ability detection after exclusion would lose that evidence.
  const withoutSubAbilities = stripNonEquippableSubAbilities(candidates)
  const withoutFormVariants = withoutSubAbilities.filter(
    (s) =>
      !(s.id in glyphFormVariants) &&
      !skillVariantExclusions.has(s.id) &&
      !NON_EQUIPPABLE_SKILL_IDS.has(s.id) &&
      !INCOMPLETE_DATA_DUPLICATE_SKILL_IDS.has(s.id)
  )
  const withoutFlipTargets = stripFlipTargets(withoutFormVariants)

  const groupOrder: string[] = []
  const groups = new Map<string, Skill[]>()
  for (const skill of withoutFlipTargets) {
    if (!groups.has(skill.name)) {
      groups.set(skill.name, [])
      groupOrder.push(skill.name)
    }
    groups.get(skill.name)!.push(skill)
  }

  const out: Skill[] = []
  for (const name of groupOrder) {
    out.push(
      ...resolveGroup(groups.get(name)!, equippedSpecializationIds, familiarIdBySkillId, selectedFamiliarId, chosenTraitIds)
    )
  }
  return out
}

/**
 * Removes any candidate that's the `flipSkill` target of a *different-named* candidate — e.g.
 * "Med Kit" -> "Stow Med Kit", "Healing Turret" -> "Detonate Healing Turret", or (via
 * `resolvedFlipSkillId`'s `FLIP_SKILL_OVERRIDES` fallback) "Facet of Elements" -> "Elemental
 * Blast", a real Consume pair the live API itself never links. Same-named flip pairs (e.g.
 * "Renewed Focus" -> "Renewed Focus") are left alone here since they land in the same name-group
 * and `resolveGroup`'s signals (specialization first, flip-root as a fallback) need both ids
 * present to pick the right one.
 *
 * Also drops any OTHER candidate sharing the dropped target's own name (e.g. Elemental Blast's own
 * ground-targeted/auto-target duplicate pair, signal 4 below) — this runs before per-name grouping,
 * so without it, a flip target's same-name sibling would never meet the id this function actually
 * removed and would surface standalone as its own single-member group instead of going through
 * `resolveGroup`'s own GroundTargeted dedup.
 */
function stripFlipTargets(candidates: Skill[]): Skill[] {
  const byId = new Map(candidates.map((s) => [s.id, s]))
  const targetIdsToDrop = new Set<number>()
  const targetNamesToDrop = new Set<string>()
  for (const skill of candidates) {
    const flipId = resolvedFlipSkillId(skill)
    if (flipId === null) continue
    const target = byId.get(flipId)
    if (target && target.name !== skill.name) {
      targetIdsToDrop.add(target.id)
      targetNamesToDrop.add(target.name)
    }
  }
  return candidates.filter((s) => !targetIdsToDrop.has(s.id) && !targetNamesToDrop.has(s.name))
}

/** Drops empty-`categories` skills that share a `toolbeltSkill` value with an equippable
 *  (non-empty-`categories`) sibling — see this file's doc comment, signal 6. */
function stripNonEquippableSubAbilities(candidates: Skill[]): Skill[] {
  const byToolbeltSkill = new Map<number, Skill[]>()
  for (const skill of candidates) {
    if (skill.toolbeltSkill === null) continue
    if (!byToolbeltSkill.has(skill.toolbeltSkill)) byToolbeltSkill.set(skill.toolbeltSkill, [])
    byToolbeltSkill.get(skill.toolbeltSkill)!.push(skill)
  }
  return candidates.filter((skill) => {
    if (skill.categories.length > 0 || skill.toolbeltSkill === null) return true
    const family = byToolbeltSkill.get(skill.toolbeltSkill) ?? []
    const hasEquippableSibling = family.some((s) => s.id !== skill.id && s.categories.length > 0)
    return !hasEquippableSibling
  })
}

function resolveGroup(
  group: Skill[],
  equippedSpecializationIds: ReadonlySet<number>,
  familiarIdBySkillId: ReadonlyMap<number, string> = new Map(),
  selectedFamiliarId: string | null = null,
  chosenTraitIds: ReadonlySet<number> = new Set()
): Skill[] {
  if (group.length === 1) return group

  const nonAttuned = group.filter((s) => s.attunement === null)
  let remaining = nonAttuned.length > 0 ? nonAttuned : group
  if (remaining.length === 1) return remaining

  const specMatched = remaining.filter((s) => s.specializationId !== null && equippedSpecializationIds.has(s.specializationId))
  if (specMatched.length > 0) {
    remaining = specMatched
  } else {
    const ungated = remaining.filter((s) => s.specializationId === null)
    if (ungated.length > 0) remaining = ungated
  }
  if (remaining.length === 1) return remaining

  if (remaining.every((s) => familiarIdBySkillId.has(s.id))) {
    const familiarMatched = remaining.filter((s) => familiarIdBySkillId.get(s.id) === selectedFamiliarId)
    if (familiarMatched.length === 1) return familiarMatched
    return [remaining.slice().sort((a, b) => a.id - b.id)[0]]
  }

  const flipRoots = remaining.filter((s) => !remaining.some((other) => other.id !== s.id && other.flipSkill === s.id))
  if (flipRoots.length === 1) return flipRoots
  remaining = flipRoots.length > 0 ? flipRoots : remaining
  if (remaining.length === 1) return remaining

  const autoTarget = remaining.filter((s) => !s.flags.includes(GROUND_TARGETED_FLAG))
  const groundTarget = remaining.filter((s) => s.flags.includes(GROUND_TARGETED_FLAG))
  if (autoTarget.length === 1 && groundTarget.length >= 1) {
    return autoTarget
  }

  if (remaining.some((s) => GADGETEER_GATED_SKILL_IDS.has(s.id))) {
    const wantGadgeteerVariant = chosenTraitIds.has(GADGETEER_TRAIT_ID)
    const gadgeteerMatched = remaining.filter((s) => GADGETEER_GATED_SKILL_IDS.has(s.id) === wantGadgeteerVariant)
    if (gadgeteerMatched.length > 0) remaining = gadgeteerMatched
  }
  if (remaining.length === 1) return remaining

  return remaining
}
