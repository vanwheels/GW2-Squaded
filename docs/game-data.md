# GW2 static game data pipeline

Static reference data (professions, specializations, traits, skills, itemstats) is pulled
once from the public [Guild Wars 2 API v2](https://wiki.guildwars2.com/wiki/API:2) via
`scripts/fetch-game-data.ts` and written as normalized JSON to `data/game-data/`. The app
reads only from these local files at runtime — it never hits the GW2 API live. This is what
makes viewing skills/traits and (later) running the boon/condition calculator work fully
offline.

Run it with:

```bash
npm run fetch-game-data
```

Re-run it manually whenever a balance patch changes trait/skill values. There's no automatic
refresh yet — see TODO.md.

## Endpoints used

All of these are public and require no API key / authentication:

| Endpoint             | Id type | Notes                                                        |
| --------------------- | ------- | ------------------------------------------------------------- |
| `/v2/professions`      | string  | 9 professions (e.g. `"Guardian"`)                              |
| `/v2/specializations`  | number  | Core + elite specialization lines                              |
| `/v2/traits`           | number  | Individual major/minor traits                                  |
| `/v2/skills`           | number  | Largest endpoint — several thousand records                    |
| `/v2/itemstats`        | number  | Stat combinations (e.g. Berserker's, Minstrel's)                |
| `/v2/legends`          | string  | Revenant legends (fixed heal/utility/elite kits) — see below     |

## Fetch pattern

For each endpoint the script:

1. `GET /v2/{endpoint}` with no query params — returns the full array of ids for that
   collection (this is how the GW2 API expresses "list everything available").
2. Splits the id list into batches of 200 (the API's bulk-expand batch limit for `ids=`) and
   calls `GET /v2/{endpoint}?ids=id1,id2,...` per batch to fetch full records.
3. Concatenates batch results into one array, then normalizes each record into the
   corresponding type in `src/shared/types/game-data.ts` before writing to disk.

A 150ms delay is inserted between batches as a courtesy to the API; it isn't required by a
documented hard rate limit for this endpoint class, but avoids hammering it during a fetch
that can be 10+ requests for `skills` alone.

## Retry/error handling

`fetchJsonWithRetry` retries up to 5 times with exponential backoff (500ms, 1s, 2s, 4s, 8s) on:

- HTTP 429 (rate limited)
- HTTP 5xx (server error)
- Network-level failures (timeouts, DNS, etc.)

Any other non-2xx response (e.g. 400 for a malformed id) fails fast rather than retrying,
since retrying won't fix a malformed request.

## Raw vs. normalized shapes

The raw GW2 API responses (especially `skills` and `traits`) include a lot of fields not
needed yet. Their `facts` / `traited_facts` arrays are a large polymorphic union used to
describe skill/trait effects (damage, boons applied, durations, etc.) — typed as `Fact` in
`src/shared/types/game-data.ts` (loosely, via an index signature, since modeling all ~19 `type`
variants isn't worth it when the boon/condition calculator only reads a handful of fields).
Everything else in the raw responses is typed loosely and locally inside
`scripts/fetch-game-data.ts` (see the `Raw*` interfaces) and never exposed outside that file.

## Output files

Written to `data/game-data/`, committed to the repo so a fresh clone has working data without
needing to run the fetch script immediately:

- `professions.json`
- `specializations.json`
- `traits.json`
- `skills.json`
- `itemstats.json`
- `legends.json` — Revenant legends; see below
- `pets.json` — Ranger pets; see below
- `elite-spec-skills.json` — see below; sourced from the wiki, not `fetch-game-data.ts`
- `wvw-fact-overrides.json` — see below; sourced from the wiki, not `fetch-game-data.ts`
- `runes.json` / `sigils.json` / `infusions.json` / `relics.json` / `food.json` / `utility.json`
  — see below; sourced from `/v2/items` by `scripts/fetch-gear-upgrades.ts`, not
  `fetch-game-data.ts`
- `itemstat-icons.json` — `ItemStat.name` -> icon URL, also written by `fetch-gear-upgrades.ts`
  (it needs the same `/v2/items` dump). `/v2/itemstats` itself has no icon field (an abstract
  attribute combo, not a real item); `deriveItemStatIcons` matches each stat name against a real
  craftable "`<Stat> <material> Insignia`" item sharing that name prefix and uses its icon as a
  representative glyph (Exotic-tier preferred, else lowest id, for determinism) — confirmed live
  2026-07-30 that these have real per-stat art (181 distinct icons across 199 non-recipe Insignia
  items), not one icon reused everywhere. 49/67 stat names resolve; the rest are compound legacy
  combos (e.g. "Dire and Rabid") or WvW/PvP-only amulet-only stat names (e.g. "Harrier's") with no
  matching insignia at all — absent from the map rather than guessed.
- `relic-effects.json` — see below; sourced from the wiki, not `fetch-game-data.ts` or
  `fetch-gear-upgrades.ts`
- `soulbeast-beastmode.json` — see "Soulbeast's Beastmode F1-F3" below; sourced from the wiki, not
  `fetch-game-data.ts`
- `familiars.json` — Elementalist Evoker familiars; see below
- `meta.json` — just `{ fetchedAt }`, so the app/UI can eventually surface "game data last
  updated on ..." somewhere.

## Revenant legends (`legends.json`)

Revenant doesn't pick Heal/Utility/Elite skills individually like every other profession — it
equips 2 **Legends** at once (swappable in combat), each a *fixed* kit of 1 heal + 3 utility + 1
elite skill (plus a `swap` skill, the F2 "invoke legend" button). `/v2/legends` returns exactly
that shape per legend (`{ id, swap, heal, elite, utilities: [3] }`) but carries neither a
human-readable `name`/`icon` nor which elite specialization (if any) unlocks it — both gaps are
filled in `scripts/fetch-game-data.ts`'s `normalizeLegend`:

- `name`/`icon` are borrowed from the legend's own `swap` skill (already fetched into
  `skills.json` in the same run) — that skill **is** the legend, visually, in-game.
- `specializationId` (`null` for the 4 core legends, otherwise the gating elite spec's id) comes
  from a small hardcoded `LEGEND_SPECIALIZATION_ID` table in the script, hand-verified 2026-07-29
  by cross-referencing each legend's `swap` skill name (fetched live from `/v2/skills`) against
  the wiki's "Legend" page — Dwarf/Assassin/Centaur/Demon are core, Dragon/Renegade/Alliance/
  Entity are gated behind Herald/Renegade/Vindicator/Conduit respectively, matching 1:1 with no
  ambiguity. This isn't derivable from the API at all (`/v2/professions/Revenant` has no `legends`
  field), and the set is small and stable — re-verify the same way if a new Revenant elite spec
  ever adds a 9th legend (the fetch script logs a warning, rather than guessing, if it ever sees a
  legend id outside the table).

Consumed in `src/shared/boon-calc/sources.ts` (`skillIdsForBuild` resolves a Revenant build's 2
equipped legends' full skill sets, since there's no per-skill picking to walk) and
`src/renderer/components/build-editor/SkillsEditor.tsx` (the Revenant-specific dual-legend editor).

## Ranger pets (`pets.json`)

Ranger's profession mechanic is a 2nd axis on top of its normal Heal/Utility/Elite picks: it also
equips 2 **pets** (swappable in combat), each contributing exactly one real skill (the "F2" special
shown by the pet's portrait in-game). `/v2/pets` gives this directly and cleanly — `{ id, name,
icon, skills: [{ id }] }`, one skill per pet, `type: "Pet"` on that skill's own `/v2/skills` entry
— normalized 1:1 by `normalizePet` into `Pet { id, name, icon, skillId }`.

Unlike `Legend`, `Pet` isn't spec-gated at all (no core/elite split — every pet is available
regardless of equipped specialization), so there's no `LEGEND_SPECIALIZATION_ID`-style table
needed here.

Stored on `Build` directly (`equippedPetIds: [number|null, number|null]`, `activePetIndex: 0|1`)
rather than folded into `SkillSelection` like `RevenantSkillSelection.legends` — a Ranger's pets
are *additive* to its normal skill picks, not a full-kit replacement, so they don't belong in that
union. Consumed in `src/shared/boon-calc/sources.ts` (`skillIdsForBuild` includes both equipped
pets' skills, same "both always contribute" reasoning as Revenant's 2 legends) and
`src/renderer/components/build-editor/PetsEditor.tsx` (mirrors `RevenantSkillsEditor`'s 2-slot-
picker-plus-active-toggle shape).

See "Soulbeast's Beastmode F1-F3" further down this doc for the much larger `Profession_1`/`_2`
pet-*family* skill list in `professionSkills` (e.g. "Swoop"/"Bite") — a different mechanic
(Soulbeast's Beastmode) from this pet skill, resolved separately per pet family/archetype rather
than per individual pet.

## Elementalist Evoker familiars (`familiars.json`)

Evoker's profession mechanic is choosing a **familiar** (Fox/Otter/Hare/Toad, one per element) via
a right-click on `Profession_5` — only one active at a time, switchable out of combat. There is no
`/v2/familiars` endpoint at all, so `familiars.json` isn't fetched from the API like `pets.json` —
it's built by `fetch-game-data.ts`'s `buildFamiliars` from a small hand-verified `FAMILIARS`
constant table (same pattern as `LEGEND_SPECIALIZATION_ID`), resolved once already-fetched
`skills.json` is available.

The one build-time-determinable effect of the choice this app models: the Heal skill "Rejuvenate"
has 4 ids (`76634`/`79314`/`79315`/`79323`) sharing identical facts/recharge/description and the
same `specializationId: 80` — an icon-only difference based on the currently-selected familiar, not
a gameplay one. Confirmed live 2026-07-31 via the skill's own wiki infobox, which annotates each id
in an HTML comment: `id = 79323 <!-- fire -->, 76634 <!-- water-->, 79315 <!-- air -->, 79314 <!--
earth -->`, cross-referenced against the `Evoker` wiki page's own Fox=Fire/Otter=Water/Hare=Air/
Toad=Earth mapping. `icon` on each `Familiar` is borrowed from its matching Rejuvenate variant's
own icon (no dedicated familiar-portrait field exists, same "borrow from a real skill" reasoning as
`Legend.icon`).

Since all 4 ids share one `specializationId`, the existing per-spec dedup signal in
`skill-variants.ts` can't tell them apart (it matches all 4). A new 8th signal
(`familiarIdBySkillId`/`selectedFamiliarId` params on `visibleSkillsForSlot`/`resolveGroup`) picks
the id matching `Build.familiarId`, falling back to the lowest id before a familiar is chosen — the
Heal picker always collapses to exactly 1 Rejuvenate entry.

**Deliberately not modeled**: the familiar's own passive combat bonus and active F5 skill. Per the
wiki's `Evoker`/`Familiar` pages, the active skill needs 6 accumulated charges (weapon skills grant
1, same-element weapon skills grant 2, Rejuvenate also contributes) and unlocks an "empowered"
version after 3 casts — a real-time state machine this app's static per-build loadout model has no
equivalent for, and there's no API endpoint to source per-familiar skill ids from even if it were
modeled. (An earlier note here compared this to Ranger Untamed's Unleash-Pet skill set as a similar
open gap — that comparison was wrong, see "Ranger" below: Unleash-Pet turned out to be a fixed,
non-family-varying set with no real-time charge mechanic, already fully resolved.)

Stored on `Build` directly (`familiarId: string | null`, Elementalist Evoker-only — meaningless,
always `null`, elsewhere), reset on a profession change away from Elementalist or on dropping the
Evoker trait line (`BuildEditorView.tsx`, same pattern as `equippedPetIds`'s reset). Consumed in
`src/renderer/components/build-editor/EvokerFamiliarSelect.tsx` (single-pick icon row, same
template as `EliteSpecSelect`).

## Elite-spec-gated skills (`elite-spec-skills.json`)

The official API has no field indicating which elite specialization (if any) unlocks a given
Heal/Utility/Elite skill — `/v2/skills` objects carry no `specialization` id, and
`/v2/professions/:id`'s `training` array only groups **core** skill categories (Signet
Training, Well Training, ...), not elite-spec-specific unlocks. Confirmed by direct API
inspection, not assumption.

`scripts/fetch-elite-spec-skills.ts` (run via `npm run fetch-elite-spec-skills`, after
`fetch-game-data`) sources this from the wiki instead: every elite specialization has a
maintained `Category:<Name> skills` page, and each member page is tagged with `Category:Healing
skills` / `Category:Utility skills` / `Category:Elite skills` identifying its slot. The script
pulls all 36 elite specs' category pages via the wiki's MediaWiki API (`action=query&
generator=categorymembers&prop=categories`, paginated), filters to Heal/Utility/Elite-tagged
members, and matches page titles against the already-fetched `skills.json` by
(profession, slot, name) to resolve wiki titles to numeric skill ids. Output is a flat
`{ [skillId]: specializationId }` map.

**Ambiguous-match resolution:** a wiki page title sometimes matches more than one `skills.json`
id in the same (profession, slot) — e.g. a ground-targeted/auto-target pair, a `flip_skill`
chain, or (for Druid) 3 ids sharing one name across its non-celestial/Celestial-Avatar forms.
Rather than guess which one is "the real pick," the script checks each candidate's own
`Skill.specializationId` field (already fetched from `/v2/skills`, no extra request): if *every*
matched id independently carries this exact spec's id, all of them are gated to it — dedup
(`skill-variants.ts`) still decides which single one reaches the picker, this only has to make
sure whichever one that is comes out correctly gated. If the candidates disagree (or one has no
`specializationId` at all), the page is left out of the map rather than guessed. A handful of
pages also carry a MediaWiki disambiguation suffix not present in the API name at all (e.g.
"Uppercut (Daredevil skill)" vs API `Uppercut`) — `titleVariants` strips a trailing `" (...)"`
as an extra candidate.

As of the last run (36 elite specs, post-fix): **295 skills matched, 0 unmatched, 0 ambiguous** —
every previously-excluded case turned out to resolve via one of the two rules above (the
`specializationId`-agreement check, or the disambiguation-suffix strip); nothing needed a guess.
A skill missing from the map is treated as ungated (shown regardless of equipped spec) as a
fail-safe default, but that path is now empty. Requires the wiki API's default `User-Agent`
header to be overridden (Node's default UA gets a 403; any identifiable UA passes — see
`USER_AGENT` in the script).

**Note:** this file's data is NOT re-derivable from `fetch-game-data.ts` — re-run
`fetch-elite-spec-skills` too whenever a balance patch might add/change elite-spec-gated skills.

## Duplicate-name skill collapsing (`skills.json`'s `attunement`/`specializationId`/`flipSkill` fields)

A live scan (2026-07-29) found 117 groups of same-(name, slot, professions) skill ids in
`skills.json` — e.g. Elementalist's "Glyph of Lesser Elementals" has 5 ids, Guardian's "Renewed
Focus" has 2 — which without dedup show up as visually-identical duplicate entries in the
Heal/Utility/Elite pickers. Investigating why turned up 3 real (API-native, not guessed) signals
that resolve ~70 of those 117 groups down to exactly one picker-visible id:

- **`attunement`** (`/v2/skills`' own field, now captured on `Skill.attunement`): present only on
  the attunement-specific ids of an Elementalist "effect varies with current attunement" skill
  (e.g. `25486`/Fire, `25487`/Water, `25495`/Air, `25497`/Earth for Glyph of Lesser Elementals) —
  the attunement-agnostic id (`5502`, `attunement: null`) is the only one a player actually
  equips; the other 4 exist so the API/wiki can describe each attunement's effect. 8 groups.
- **`specialization`** (`/v2/skills`' own field, now captured on `Skill.specializationId`):
  present on a same-name skill's id when that variant's effect is what a specific elite spec
  reworks it into (e.g. Guardian's Renewed Focus: `9154` base / `68666` under Dragonhunter;
  several Revenant Legendary Demon skills reworked by Vindicator/Conduit). Automatic based on
  which spec is equipped, not a user choice. 45 groups.
- **The `GroundTargeted` flag** (already-captured `Skill.flags`): GW2 exposes its client-side
  ground-target-vs-auto-target casting toggle (a Settings option / modifier key, not a build
  choice) as two separate skill ids with an otherwise-identical effect — e.g. Lightning Flash
  `5536` (ground-targeted) / `50447` (auto-target), every Necromancer Well, every Warrior Banner.
  Functionally identical for this app's purposes (boon/condition facts, tooltip text), so these
  collapse to the non-ground-targeted id. ~54 groups.

`src/shared/skill-calc/skill-variants.ts`'s `visibleSkillsForSlot` applies these 3 signals in
order (attunement → specialization → ground-target) and is wired into
`skillsForProfessionAndSlot` in `src/renderer/state/game-data-store.tsx`, so every picker
(Heal/Utility/Elite, both the skill-bar tooltips and the picker grid) sees the collapsed list for
free — no UI changes needed, since the dedup happens before the picker ever sees the candidate
list.

**Session 19 addendum — `flip_skill` (multi-step skills):** Session 18 considered `flip_skill` and
dropped it, reasoning the `GroundTargeted` signal alone covered every duplicate it had found. That
turned out to be incomplete once checked directly: `flip_skill` is the id a skill becomes after
being activated (e.g. Engineer's "Med Kit" `5802` flips to "Stow Med Kit" `6109`; "Healing Turret"
flips to "Detonate Healing Turret"; a Thief Elite chains `29516`→`30077`→`29639` three ids deep via
`flip_skill` alone — its `next_chain` field carries the identical id at each step, confirmed live,
so `next_chain` itself wasn't worth capturing separately). A flip target is never independently
equippable in-game, but 84 such different-named pairs (Engineer kits/turrets, Mesmer mantras,
Ranger spirits, Revenant facets) were being offered as if they were, since each had its own unique
name and so never entered the same-name grouping the first 3 signals operate on — arguably a worse
bug than the visually-obvious duplicate-name case, since nothing looked wrong in the picker.
`Skill.flipSkill: number | null` (from the same already-fetched `/v2/skills` response) feeds two
new mechanisms in `skill-variants.ts`: a global `stripFlipTargets` pre-pass (removes a
different-named flip target from the whole candidate pool before per-name grouping even runs) and
a 4th per-group "flip-root" signal, inserted between specialization and ground-target, for
same-name flip pairs (drops whichever id is pointed to by the other's `flip_skill`). The two
existing signals and the new one compound where needed — e.g. Guardian's "Hammer of Wisdom" is
actually a 4-id group (a ground-targeted flip pair `9125`→`46170` plus a separate auto-target flip
pair `55040`→`55053`, all 4 sharing one name and no `specializationId`): flip-root collapses each
pair to its root first, then `GroundTargeted` picks the auto-target root as the one canonical id.

**The remaining 23 groups** (down from 47 after the `flip_skill` addition; re-counted per-profession
with no spec equipped — see `TODO.md` for the full current list) have no `attunement`/
`specialization`/`GroundTargeted`/`flip_skill` signal distinguishing their members — e.g.
Engineer's "Deploy Mine" (`6163` "deploy a mine" vs `30893` "deploy two mines", almost certainly a
trait rework with no `specialization` id set) or Ranger's "Spike Trap" (differs in whether it
stuns or launches). These look like the same shape of problem `wvw-fact-overrides` solved for boon
durations — a per-skill wiki cross-check to find the actual gating trait — but that's a new,
separate research pass, not attempted here. Left un-collapsed and shown as-is (fail-safe, not
guessed) rather than arbitrarily picking one id and hiding a possibly-meaningful choice from the
user.

**Session addendum — Druid Glyph form variants (`glyph-form-variants.json`):** 6 of the 23
remaining groups turned out to be a distinct, resolvable pattern: Druid's duplicate-named Glyph
skills (Glyph of Rejuvenation/the Tides/Alignment/Equality/Burgeoning/the Stars). Each has 3 API
ids, but `specializationId` (signal 2) can't distinguish them — every id in a group shares the
same `specializationId: 5` (Druid), since the whole skill is Druid-gated, not one variant of it.
Live-checked each one's wiki page and found a consistent, non-guessed pattern: a "parent" page
(e.g. "Glyph of Equality") whose own `{{Skill infobox}}` `id=` is the one id a player actually
binds to a Heal/Utility/Elite slot — its effect changes automatically with current Celestial
Avatar form, the same "one id, context-dependent effect" shape signal 1 (`attunement`) already
models for Elementalist glyphs — plus 2 purely-descriptive child pages ("Glyph of Equality
(non-celestial)" / "Glyph of Equality (Celestial Avatar)") that exist only so the wiki can
document each form's effect separately and whose ids are never independently equippable. New
`scripts/fetch-glyph-forms.ts` (`npm run fetch-glyph-forms`, after `fetch-game-data`) discovers
every duplicate-named Ranger `categories: ["Glyph"]` group live (not a hand-typed name list),
fetches each parent + child page, and only records a mapping when the parent id is a member of the
local group AND the child ids together with the parent id exactly account for every id in the
group — any mismatch is logged and the group left unresolved rather than guessed, same posture as
every other fetch script here. All 6 known groups resolved cleanly on a live run. Output is
`GlyphFormVariantMap` (variant id -> canonical id), consumed as a 5th pre-pass signal in
`skill-variants.ts`'s `visibleSkillsForSlot` (dropped before per-name grouping, same treatment as
flip targets) — see that file's doc comment. Brings the genuinely-unresolved group count from 23
down to 17.

**Session addendum — the remaining 17 groups, two more signals
(`skill-variant-exclusions.json`):** Investigated all 17 by hand (11 Engineer, Ranger's "Spike
Trap", Elementalist's "Rejuvenate"/"Mist Form", Mesmer's "Mirage Advance", Revenant's "Protective
Solace"/"Jade Winds") and found two more real, distinguishable patterns:

- **Turret/gadget/elixir context-menu sub-abilities** (Engineer only, e.g. "Automatic Fire",
  "Detonate Rocket Turret", "Overcharge Supply Crate"): live-verified these are never
  independently equippable at all — you bind the turret/gadget/elixir itself; the sub-ability
  appears automatically once it's placed/active, the same way a kit's "Stow" skill or a turret's
  old-style "Detonate" flip target already aren't offered as separate picks. The API doesn't flag
  this directly, but two already-captured fields combine to reveal it cleanly: every one of the 745
  Heal/Utility/Elite skills in the dataset that's a real independently-bindable pick carries a
  non-empty `categories` (`Kit`/`Gadget`/`Turret`/`Elixir`/...); every sub-ability instead carries
  `categories: []` while sharing its `toolbeltSkill` value with the real equippable skill that
  generates it (e.g. Rifle Turret `5818` and its own F5 overcharge "Automatic Fire" `5874` both
  carry `toolbeltSkill: 6178`) — confirmed with a full scan of all 256 empty-`categories` Heal/
  Utility/Elite skills, no false positives (plenty of legitimately-equippable skills also have no
  category, e.g. "Med Kit"/"Shelter" — only the ones sharing a `toolbeltSkill` with a categorized
  sibling are sub-abilities). This is pure local-data logic — no wiki fetch needed — so it's a new
  unconditional pre-pass in `skill-variants.ts`, `stripNonEquippableSubAbilities`, run before
  per-name grouping. It fully resolves "Grenade Kit" (old pre-2015-rework id `5805` also happens to
  have `categories: []`, sharing `toolbeltSkill` with the current `6020`) and empties "Automatic
  Fire"/"Detonate Rocket Turret"/"Detonate Supply Crate Turrets"/"Overcharge Supply Crate" entirely
  (neither id in any of those groups is independently equippable — confirmed both belong to
  different turret/crate parents, e.g. "Automatic Fire" `5874` is Rifle Turret's own overcharge and
  `6098` is the unrelated Harpoon Turret's, sharing a name by coincidence, not a real duplicate at
  all).
- **A wiki-page-membership check** for whatever's still ambiguous after that: new
  `scripts/fetch-skill-duplicate-resolutions.ts` (`npm run fetch-skill-duplicate-resolutions`, after
  `fetch-game-data` and `fetch-glyph-forms`) re-derives "still ambiguous today" by importing and
  calling the real `visibleSkillsForSlot` across every (profession, slot) bucket (not a
  reimplementation, so it can't drift from runtime behavior), then for each remaining group fetches
  that skill name's own wiki page and excludes any local id absent from its `{{Skill infobox}}`
  `id=` field (a bare id or comma-list, e.g. `id = 5910, 29522`) — treating the wiki's main page as
  authoritative for "what a player can currently bind," same trust level already extended
  everywhere else in this project. A group's wiki ids and local ids must overlap by at least one id
  before anything is excluded (confirms the right page was found); if the wiki lists every local id
  already, or shares nothing with the local group, the group is left untouched and logged rather
  than guessed. Live results (2026-07-30), all independently cross-checked against each skill's
  wiki page directly, not just this heuristic:
  - **Fully resolved to 1 id**: Rocket Turret (`5912`; excludes `5991` — a `GroundTargeted`
    duplicate the existing signal 4 already would have dropped alone, and `22574` — a legacy id the
    current wiki page doesn't mention at all, no separate page found for it either), Elixir X
    (`5832`; excludes `20451` — confirmed via a dedicated "Elixir X (underwater)" wiki page carrying
    that exact id), Spike Trap (`12476`; excludes `51395` — confirmed via a dedicated "Spike Trap
    (underwater)" page; the TODO's original "differs in stun vs. launch" note turned out to be an
    environment split, not a trait rework as guessed — the wiki's own version history says so
    directly: "This skill can now be used underwater. The underwater version now stuns enemies
    instead of launching them."), Mirage Advance (`42851`; excludes `50419` — absent from the wiki
    page entirely, same "undocumented legacy id" shape as Rocket Turret's `22574`).
  - **Narrowed but still ambiguous**: Slick Shoes (4 ids -> 2: excludes `50472`/`50491`, both
    absent from the land page's own id list — `50491` independently confirmed via a dedicated
    "Slick Shoes (underwater)" page; a separate "Slick Shoes (Tybalt)" page exists too, for an NPC
    hallucination effect with entirely different ids, not part of this group at all), Rocket Boots
    (4 ids -> 2: excludes `50438`/`50441`, both confirmed via a dedicated "Rocket Boots
    (underwater)" page listing exactly that pair). Both land pairs (`5825`/`30828` and
    `5910`/`29522`) remain genuinely ambiguous — the wiki lists both together on the one land page
    with no distinguishing field (likely an old-vs-reworked pair, same shape as "Grenade Kit", but
    without that group's lucky `categories` difference to tell them apart).
  - **Unchanged (wiki lists every local id already, no exclusion possible)**: Throw Mine
    (`6161`/`30337` — confirmed via the wiki's own text this is a Gadgeteer-trait-gated pair, not a
    legacy/environment split; resolving it correctly would need the picker to know the build's
    currently-chosen traits, which `skillsForProfessionAndSlot` doesn't have access to today — an
    architecture change, not attempted), Mist Form (`5554`/`15795`, no distinguishing field of any
    kind found), Protective Solace (`26821`/`29310` — `26821` has a `flipSkill` chain into
    "Diminish Solace" matching the wiki's own documented `chain1`/`chain2`, `29310` doesn't, weak
    evidence but not conclusive enough to exclude), Jade Winds (`28406`/`31294`, no distinguishing
    field found). Rejuvenate (Elementalist, a brand-new elite spec not previously seen in this
    project — `specialization = Evoker` — whose Heal skill's tooltip icon changes per a new
    "familiar" companion concept this app doesn't model at all yet) was found already narrowed to 3
    of its 4 ids by the *existing* flip-root signal before this session touched anything (one id is
    already the `flipSkill` target of another within the same name-group) — left fully alone, flagged
    in TODO.md as needing real new-feature work, not a dedup fix.

  9 ids total excluded, fully resolving 4 of the remaining 17 groups and narrowing 2 more. `npm run
  typecheck`/`lint`/`build` all clean; verified via a standalone script (not committed) asserting
  the exact expected id set for all 16 investigated groups (including the 5 left intentionally
  unchanged) post-fix. One real ordering bug caught and fixed during that verification:
  `stripNonEquippableSubAbilities` must run on the *full* candidate set before the
  `skillVariantExclusions` filter, not after — "Detonate Rocket Turret" `38748` only recognizes
  itself as non-equippable by finding its categorized sibling Rocket Turret `22574` still present in
  the pool, and `22574` is itself one of the ids `skillVariantExclusions` removes; filtering first
  would silently make `38748` look independently equippable again.
- **A blind spot in the script above, found manually 2026-08-04** during the `CURATED_DAMAGE_
  COEFFICIENTS` Utility-slot sweep (Guardian leg): the script only re-checks groups where
  `visibleSkillsForSlot` still returns >1 id — but Guardian's 3 Spirit Weapons (Sword of Justice,
  Shield of the Avenger, Hammer of Wisdom) each have 4 raw ids in skills.json, and the *existing*
  signal 4 (`GroundTargeted` collapse) already narrows each group down to exactly 1 id on its own —
  `55027`/`55037`/`55040` respectively — so the script never considered them ambiguous and never
  wiki-checked them. Those 3 picks are wrong: live-verified (wiki infobox `id=` field for all 3 pages
  lists only the *other* pair — `9168, 44846` / `9182, 41571` / `9125, 46170` — and a wiki full-text
  search for `55027` returns zero skill-related hits) that `55019/55027`, `55035/55037`,
  `55040/55053` are stale/defunct ids no longer reachable in-game; every current Spirit Weapon is
  ground-targeted (per each page's own 2019-04-23 version-history entry: "These skills are now all
  ground-targeted while the player is on land"), so signal 4's "collapse to the non-ground-targeted
  id" heuristic — correct for Warrior Banners, wrong here — was quietly picking the dead id instead.
  This is exactly the scenario `skill-variants.ts`'s own doc comment already describes as the
  flip-root signal's intended target for these 3 skills (it names `9125`/`46170` as its own Hammer of
  Wisdom example), confirming `9168`/`9182`/`9125` (the flip-root survivor once the dead pair is
  excluded) are correct. Fixed by adding all 6 dead ids to `skill-variant-exclusions.json` directly
  (not re-running the fetch script, since it can't discover this class of gap as built). Worth
  auditing whether the fetch script should also re-check every group that *signal 4 alone* collapsed
  to 1, not just groups still >1 after all signals — no other same-shape case found in this session's
  Guardian Utility-slot sweep, but unconfirmed for the rest of the roster.

## WvW-vs-PvE fact splits (`wvw-fact-overrides.json`)

`/v2/skills` and `/v2/traits` facts carry no `game mode` tag, and (confirmed by direct
cross-check against the wiki, not assumed) the API's `duration` for a Buff fact is the PvE-tagged
value when a skill/trait's boon/condition grant is actually split between game modes, or the sole
value when it isn't split. Some skills' facts array even includes PvE-only AND WvW/PvP-only boons
side by side with no way to tell which applies where (e.g. Restoring Reprieve's API facts list
Protection+Resolution — PvE only — right alongside Aegis — WvW/PvP only) — so reading the API
facts directly, un-adjusted, overstates what a WvW-focused build actually gets.

`scripts/fetch-wvw-splits.ts` (run via `npm run fetch-wvw-splits`, after `fetch-game-data`)
sources the actual split from the wiki: `Category:Split skills` (1664 pages) / `Category:Split
traits` (545 pages) are real, maintained lists of pages with a `{{skill fact|...|game
mode=...}}` / `{{trait fact|...}}` split somewhere on them. The script narrows that down to the
~1100 pages that are BOTH in one of those categories AND correspond (by exact, unambiguous name
match) to a skill/trait with a boon/condition Buff fact in the already-fetched
`skills.json`/`traits.json` — the only ones the boon/condition uptime calculator reads — fetches
each page's raw wikitext (`action=raw`), and parses out every `{{skill fact}}`/`{{trait fact}}`
invocation whose first parameter is a boon/condition name, its first bare numeric value (the
duration), and its `game mode=` parameter if present.

Because naive `|`-splitting of wikitext can misparse a `[[Link|text]]` pipe embedded in a later
field, every parsed PvE-tagged value is cross-checked against the API's actual `duration` for
that boon on that id before being trusted; a mismatch is treated as a parse failure and skipped
rather than trusted. Also skipped (fail-safe, logged, not guessed): a page whose title maps to
more than one skill/trait id (ambiguous), an id with more than one Buff fact sharing the same
boon/condition status (can't tell which wikitext line maps to which), and more than one
same-game-mode fact line for one boon on one page.

Output is `{ skill: { [id]: { [boonName]: override } }, trait: { [id]: { [boonName]: override } } }`
where `override` is either `'omit'` (this boon/condition is PvE-only — drop it entirely for a
WvW view) or a number (the WvW-tagged duration to use in place of the API's). Consumed in
`src/shared/boon-calc/sources.ts`. Boon names absent from an id's map are either genuinely
unsplit (same value in every mode, the common case) or one of the skipped-and-logged cases above
— both fall back to using the API's PvE value as-is, which is the same behavior as before this
existed (fail-safe, not silently wrong).

**Note:** this file's data is NOT re-derivable from `fetch-game-data.ts` — re-run
`fetch-wvw-splits` too whenever a balance patch might change a WvW/PvE split. It's also scoped
to skills/traits that had a boon/condition Buff fact in `skills.json`/`traits.json` *at the time
it was last run* — re-run after `fetch-game-data` if new boon/condition-granting content is added.

## Skills the API returns with no usable facts at all (`synthetic-facts.json`)

`CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS` (`damage-calc.ts`/`healing-calc.ts`)
only ever render a number when a real matching `Fact` object exists on the skill to key off (by
`type`/`target`/`text`) — that fact's own numeric `value` is never read, it's purely a presence
gate (plus carries `requires_trait` for trait-conditional facts). Every downstream consumer walks
`skill.facts`/`skill.traitedFacts` to decide which tooltip lines exist at all
(`skill-fact-lines.ts`'s `skillFactLines`, `fact-numbers.ts`'s `numericFactLines`) — the curated
tables are consulted per-fact, not iterated independently. So a skill the GW2 API returns with
*zero* facts of the needed shape has no number to show no matter how good a wiki-sourced
coefficient is (first hit: Mesmer's Tale of the Second Scion, id 76695, released with Troubadour
2025-08-19 — a live `/v2/skills/76695` pull returns only `Recharge`/`Number of Targets`/`Radius`,
confirmed not a stale-cache issue).

`synthetic-facts.json` (hand-maintained, no fetch script — same shape as `wvw-fact-overrides.json`
but insertion instead of value-override) is `{ [skillId]: Fact[] }`, merged into each matching
skill's `.facts` array once, at load time, in `load-game-data.ts`'s `withSyntheticFacts`. Once
merged, the injected fact is indistinguishable from a real API one to every consumer — no
special-casing needed anywhere else. Add a new entry when a skill has a real wiki-documented
Healing/Damage coefficient but no live-API fact of the matching `type`/`target`/`text` to gate on:
pull the raw wikitext (`action=raw`, never a summarized fetch) for the coefficient itself as usual,
then add a matching `{ type, target, text }` synthetic `Fact` here (its own `value` is cosmetic —
put the wiki's stated base value for parity with a real fact, but the curated table's `baseValue`
is what actually renders) plus the normal `CURATED_HEALING_COEFFICIENTS`/`CURATED_DAMAGE_COEFFICIENTS`
entry. Worth checking for on any other very-recently-released skill (new elite specs in particular)
that turns up with an empty-seeming Damage/Healing tooltip during a future sweep — Janthir
Wilds-and-later content has hit real API-coverage gaps more than once during this project's
curation sweeps (see TODO.md).

## Gear upgrades and consumables (`runes.json`, `sigils.json`, `infusions.json`, `relics.json`, `food.json`, `utility.json`)

`scripts/fetch-gear-upgrades.ts` (run via `npm run fetch-gear-upgrades`) fetches Superior runes,
Superior sigils, WvW infusions, relics, and food/utility consumables. Unlike every other endpoint
in this doc, there's no dedicated `/v2/runes` or `/v2/relics` collection — all of these are just
`/v2/items` entries distinguished by their `type`/`details.type` fields, and `/v2/items` has
**~74,000 entries with no server-side subtype filter**. The only way to find "every Superior
rune" is to bulk-fetch the entire item catalog (370 batches of 200) and filter client-side.

Because that full-catalog fetch takes several minutes and every tweak to the filter/normalize
logic would otherwise cost a full refetch, the script caches the raw `/v2/items` dump to
`.cache/items-raw.json` (gitignored, NOT the same as the committed `data/game-data/*.json`
output) and reuses it on subsequent runs unless `--refresh` is passed. Delete `.cache/` or pass
`--refresh` to force a fresh pull (e.g. after a balance patch that might add new items).

**Per-category filter, confirmed live 2026-07-29 against real API responses (not assumed):**

- **Runes** — `type: 'UpgradeComponent'`, `details.type: 'Rune'`, name starts with
  `"Superior Rune of"`. Only the Superior tier is fetched (lower tiers aren't selectable in this
  app). Per-stage bonuses come from `details.bonuses`, a flat array of freeform text lines (e.g.
  `"+25 Power"`, `"+35 Ferocity"`) — index 0 is the 1-piece-equipped stage, index 5 is 6-piece.
  Confirmed NOT a fixed alternating formula (Superior Rune of the Scholar: Power/Ferocity
  interleaved at different values per stage, not a repeating pattern) — the literal per-stage
  list has to be kept, not derived.
- **Sigils** — `type: 'UpgradeComponent'`, `details.type: 'Sigil'`, name starts with
  `"Superior Sigil of"`. Effect text comes from `details.infix_upgrade.buff.description` (too
  varied — procs, on-crit/on-swap triggers — to model as a flat bonus like runes).
  `details.flags` on a sigil is the list of weapon *type* names it applies to (e.g.
  `"Greatsword"`, `"Dagger"`) — a different vocabulary than `WeaponFlag` in
  `src/shared/types/game-data.ts` (which is hand/two-hand/aquatic, not weapon type).
- **Infusions** — `type: 'UpgradeComponent'`, name includes `"WvW Infusion"`. **Real gotcha**:
  infusions do NOT have `details.type === 'Infusion'` — that field is `'Default'` for every
  infusion (WvW and Agony alike, confirmed against a live Agony infusion too).
  `details.infusion_upgrade_flags` containing `'Infusion'` is the actual infusion-slot-compatible
  marker, and there's no API field distinguishing WvW infusions from Agony ones at all — the name
  suffix is the only reliable filter. Only WvW infusions are fetched (Agony infusions are out of
  scope — WvW doesn't use Agony resistance). All 8 core-attribute WvW infusions
  (Healing/Resilient/Vital/Malign/Mighty/Precise/Concentration/Expertise) confirmed to grant a
  flat +5 to one attribute via `details.infix_upgrade.attributes[0]`.
- **Relics** — top-level `type: 'Relic'` (211 found; verified against 12 unrelated "Relic of ..."
  legendary *backpack* items from an older content release that share the naming pattern but are
  `type: 'Back'`, correctly excluded). **Real gotcha**: relics carry NO `details` object at all
  via the public API — only a plain-text top-level `description` (e.g. "Weapon swap recharge
  time is reduced."), which can be *less* precise than the actual in-game tooltip (no "25%"
  numeric value exposed for that example). `description` is stored as-is for display, not parsed.
  Exact numeric values are sourced separately, from the wiki — see "Relic numeric effects
  (`relic-effects.json`)" further down this doc.
- **Food / Utility** — `type: 'Consumable'`, `details.type: 'Food'` or `'Utility'`. The full
  catalog is fetched, not pre-filtered to a "WvW meta" subset, per explicit user direction (see
  TODO.md). **Real gotcha**: a consumable's actual buff (if any) is NOT a `Fact[]` array like
  skills/traits use — it's a single flattened descriptor at
  `details.{name, duration_ms, apply_count, description}`. `description` here is freeform text
  (e.g. `"+100 Power\n+70 Precision\n+10% Experience from Kills"`), parsed line-by-line the same
  way as rune bonuses. Some catalog entries (~37% of Food, e.g. "Feast" reagents meant to be
  served to a group rather than eaten directly) have no buff at all — `effectName`/`durationMs`/
  `applyCount` are `null` and `bonuses` is empty for those.

None of these 6 files are re-derivable from `fetch-game-data.ts` — re-run `fetch-gear-upgrades
--refresh` separately after a balance patch that might add/change gear-upgrade or consumable
items.

## Relic numeric effects (`relic-effects.json`)

`Relic.description` (from `fetch-gear-upgrades.ts`, above) is prose-only and often less precise
than the real in-game tooltip — no "25%", no boon durations, nothing structured. `scripts/
fetch-relic-effects.ts` (run via `npm run fetch-relic-effects`, after `fetch-gear-upgrades`) fills
that gap from the wiki: every relic's wiki page uses a `{{Relic infobox}}` template whose `facts=`
field is itself a list of `{{skill fact|...}}` invocations — **the exact same template
skills/traits use to document their own facts**, confirmed live 2026-07-30 (e.g. Relic of the
Warrior: `{{skill fact|Weapon Swap Recharge Reduction|25%}}`). Unlike `fetch-wvw-splits.ts`, there
is no API-side numeric value to cross-validate a parse against here — relics carry no `Fact` data
via the API at all (see above), so the wiki *is* the primary source for these numbers, not a
secondary check on one.

**Two real wrinkles, both handled rather than guessed around:**

- **A relic name can map to multiple `relics.json` ids, but MediaWiki only has one page per exact
  title.** A live scan (2026-07-30) found 113 unique relic names across 211 ids — 106 of those
  names' ids all share byte-identical API `description` text (confirmed live), so one wiki page's
  parsed facts safely apply to every id sharing that name (re-releases, level-80-boost variants,
  etc. — same effect, different acquisition method). The other **7 names have ids whose
  description text genuinely differs** (e.g. "Relic of the Pack": one id grants "superspeed,
  might, and fury", another grants only "superspeed" — an old pre-rework version and a newer one
  coexisting under the same display name) — for those, facts are attributed **only** to the id(s)
  the wiki page's own `id=` infobox field explicitly lists; the other id(s) sharing the name are
  left with no entry in `relic-effects.json` at all (falls back to `Relic.description` alone, same
  as before this existed — fail-safe, not a guess about which version an unlisted id actually is).
- **Naive `|`-splitting of a `{{skill fact|...}}` invocation breaks on a piped wikilink or nested
  template inside a later parameter** (e.g. `desc=30 [[Condition Damage]]` is fine, but
  `desc=Gain the [[Soul of the Titan|Soul of the TItan]]{{sic|Titan}}` has two nested pipes that
  would otherwise get treated as field separators). `protectPipes`/`restorePipes` swap one level of
  `[[X|Y]]`/`{{X|Y}}` pipes for a placeholder before splitting, which resolves every case found in a
  full scan except one (a `{{sic|...}}` nested inside a link's own `desc=` value, on "Relic of the
  Living City") — that remaining case is caught by a bracket-balance check (`isBalanced`) on each
  split segment and the whole fact line is dropped and logged, not stored possibly-corrupted.

**Output shape**: `Record<relicId, RelicEffect>` where `RelicEffect` is `{ facts: RelicFactLine[],
rechargeSeconds: number | null }` — `RelicFactLine` keeps a fact's wiki label, its positional
values, and its key=value params (`desc`, `stacks`, `alt`, `coefficient`, ...) close to verbatim
(see the type's doc comment in `src/shared/types/game-data.ts`), rather than trying to model every
fact "type" semantically the way skill/trait `Fact`s are partially modeled. A fact line split by
`game mode=` is already resolved to the WvW-relevant line before being stored (the PvE-only or
PvP-only sibling line for that same label is dropped) — confirmed live that a relic's internal
cooldown can *also* have a WvW-specific override (`recharge wvw=`, 7 relics) or PvP-specific
override (`recharge pvp=`, 5 relics) distinct from the base `recharge=` field; `rechargeSeconds`
prefers the WvW-tagged value when present.

**Consumed by** `src/shared/gear-calc/relic-effects-format.ts` (`formatRelicDescription`), which
appends each fact's formatted line (and the recharge, if documented) below the relic's prose
description — wired into `ConsumablesEditor.tsx`'s relic tooltip. Result counts as of the last run:
204 of 211 relic ids got a `RelicEffect` entry (108 relic names have at least one `{{skill fact}}`
line; 5 names — all "summon a creature while in combat" relics like Relic of the Lich — have none
at all, just a recharge; 7 ids were excluded per the differing-description rule above; 1 fact line
across the whole catalog was dropped as unparseable).

**Deliberately NOT done**: wiring relic facts into the boon/condition uptime calculator
(`src/shared/boon-calc/sources.ts`), even for facts whose label is a real boon/condition name
(e.g. "might", "protection" facts do appear on some relics). Skill/trait Buff facts represent a
guaranteed "you get this boon when you use this skill" — fully within player control (equipped +
cast). A relic's facts fire on a conditional in-combat trigger ("after granting a boon to an
ally", "upon dealing damage with a 20s+-recharge skill") with no fixed per-rotation frequency this
app models anywhere — folding them into an aggregate uptime total would silently overstate a
guaranteed number the app doesn't actually have. This is a display-layer enrichment only; see
TODO.md if a future session wants to revisit modeling relic proc frequency.

**Note:** this file's data is NOT re-derivable from `fetch-game-data.ts` or
`fetch-gear-upgrades.ts` — re-run `fetch-relic-effects` too whenever a balance patch might
change/add a relic (after re-running `fetch-gear-upgrades --refresh` first, since this script reads
`relics.json`).

## Profession-mechanic ("F-skill") data

`Profession.professionSkills` (`{id, slot}[]`) is sourced from `/v2/professions`' own `skills`
array, filtered to `type === 'Profession'` (`scripts/fetch-game-data.ts`'s `normalizeProfession`).
This is the raw list of every id that has ever occupied an F1-F5 mechanic slot for that profession,
across every base-game and elite-spec variant — e.g. Guardian's `Profession_1` alone lists Virtue
of Justice (core), Tome of Justice + a dormant duplicate + Stow Tome (Firebrand), Rushing Justice
(Willbender), and Radiant Justice (Luminary), all sharing that one slot string.

`src/shared/skill-calc/profession-mechanic.ts` (`professionMechanicBar`) resolves a slot's raw
candidate list down to the one id that actually applies for a build's equipped specializations
(and, for Warrior's `Profession_1` only, its equipped main-hand weapon type — see below), using the
skill's own `specializationId` field (same signal `skill-variants.ts` already uses for
Heal/Utility/Elite reworks) plus a `flipSkill`-chain-aware tiebreak for same-slot duplicates (see
that file's doc comment for the exact rule). It also filters `slot` to `Profession_*` — some
downed-state skills (`slot: 'Downed_1'`-`'_4'`) and even a Reaper Shroud skill (`slot: 'Weapon_5'`)
share `type === 'Profession'` in the raw data despite not being F-skills at all — and drops the
resolved skill entirely if it needs a specialization the build doesn't have equipped, so a slot
that only exists under one elite spec (e.g. a newest-spec-only F4/F5) doesn't leak through when
that spec isn't equipped.

**Live-verified against the real API 2026-07-30 across all 9 professions** (not just Guardian) to
scope what this resolver can and can't cleanly cover, wired into the UI (`ProfessionMechanicBar`)
per the findings below:

- **Guardian** — clean, generic resolver, verified across base/Dragonhunter/Firebrand/Willbender/
  Luminary.
- **Necromancer/Mesmer/Elementalist(F1-F4)** — clean, generic resolver (Enter Shroud; the 4
  Shatter skills + Chronomancer's F5; the 4 Attunement-swap buttons).
- **Warrior** — `Profession_1` (Burst Skill) has dozens of same-slot candidates with no
  `specializationId` at all, varying instead by equipped weapon type — `professionMechanicBar`
  takes an optional `mainHandWeaponType` param used only for this slot on this profession, reusing
  `WeaponSkillBar.tsx`'s existing main-hand lookup. Spellbreaker's `Profession_2` (Full Counter)
  had 6 same-slot/same-spec/no-flip `categories:["Burst"]` legacy ids alongside the real "Full
  Counter" (44165) — pinned via exclusion (see `EXCLUDED_MECHANIC_SKILL_IDS`).
- **Thief** — `Profession_1` (Steal) via the generic resolver; `Profession_2` (the "stolen skill")
  is explicitly skipped (`SKIPPED_SLOTS`) — its candidates are tagged per enemy `source` profession
  (`"Warrior"`, `"Guardian"`, ...), i.e. it depends on who you steal from in a live fight, not on
  anything in the build.
- **Revenant** — corrected 2026-07-30 after user testing found "Energy Meld" (Vindicator's real F2)
  missing: the original session wrongly generalized from `Profession_1` (which genuinely IS every
  Legend's own `swap` id, still excluded — redundant with `RevenantSkillsEditor`) to assume the
  *entire* mechanic was redundant, without checking `Profession_2`-`_4`. Those turned out to hold
  real per-spec F-buttons: core "Ancient Echo" (F2), Herald's "Facet of Nature" (F2 — 5 same-slot
  "True Nature" sub-effect ids also share the slot with no differentiator, but the existing
  lowest-id tiebreak happens to already prefer the correct entry-point id since they're all much
  newer), Renegade's "Heroic Command"/"Citadel Bombardment"/"Orders from Above" (F2/F3/F4), and
  Vindicator's "Energy Meld" (F2, via the existing flip-chain tiebreak). **Corrected 2026-08-01**:
  Conduit's F2 ("Release Potential", 5 ids named per Assassin/Monk/Dervish/Mesmer/Warrior) was
  previously assumed to depend on a player-chosen "Vestige" build axis this app doesn't model, and
  excluded outright — falling back to the core "Ancient Echo" id regardless of build, which live
  testing found never changed no matter which Legend was active (filed in TODO.md as "Conduit's F1
  ... always shows the base core-Revenant profession skill regardless of active Legend" — the
  reporter's "F1" meant the first *visible* mechanic-bar icon, since `Profession_1`/the real F1 is
  unconditionally hidden; the actual affected slot is `Profession_2`). The wiki
  (wiki.guildwars2.com/wiki/Cosmic_Wisdom, /wiki/Release_Potential) confirms there's no "Vestige"
  axis at all — Release Potential (and Profession_3's "Cosmic Wisdom", already correctly resolved
  as a single id) both change based on which Legend is *currently active* (swappable mid-fight),
  Razah channeling one of 5 GW1-profession "forms" per Legend. Since Conduit occupies the elite-spec
  line itself, only the 4 core Legends + Razah's own Legendary Entity Stance can ever be equipped
  alongside it — a clean 1:1 map onto the 5 forms, no ambiguity left over. Now resolved by
  `conduitReleasePotentialBar` (`profession-mechanic.ts`), keyed off `Build`'s `activeLegendIndex`
  the same way `RevenantSkillsEditor`'s own Heal/Utility/Elite bar already is — display-only, per
  `RevenantSkillSelection.activeLegendIndex`'s doc comment, and doesn't feed boon/condition totals
  (mechanic-bar skills never do; only bundle-capable ones like Tomes/Shroud do, via
  `bundleContributionsForBuild`). One of the 5 named variants, "Release Potential: Warrior", has a
  same-named orphaned id (77896) that exists in `/v2/skills` but isn't in Revenant's
  `professionSkills` at all — same class of leftover id as the Warrior Spellbreaker Full Counter
  duplicates above; 78895 (the one `professionSkills` actually references) is the real one.
- **Legendary Alliance Stance** (Vindicator's own legend, `Legend7`) has 2 visually-distinct
  sub-forms (Saint Viktor's/Archemorus's aspects) per heal/utility/elite slot. **Resolved
  2026-07-31**: `/v2/legends` exposes only the Archemorus-aspect id per slot, but each one's own
  `Skill.flipSkill` points straight at the Saint-Viktor-aspect id for the same slot (Elite chains 2
  deep: "Spear of Archemorus" -> "Urn of Saint Viktor" -> "Drop Urn of Saint Viktor") — no separate
  "legend form" concept needed. `RevenantSkillsEditor`'s existing tooltip already surfaces the
  flip-chain target via `relatedVariantSkills` for free; the real gap was `sources.ts`'s boon-calc
  input, which only fed the base ids — fixed via a new `withFlipChain` helper folding each legend
  skill's full flip chain in, which also fixes the same undercounting for every *other* legend's own
  channel-release effect (e.g. Herald's Facet of Chaos -> Chaotic Release), not just this one legend.
  See TODO.md for the full writeup/verification.
- **Engineer** — the base Toolbelt (F1-F4) isn't in `professionSkills` at all (confirmed: no base
  ids under those slots, only elite-spec sub-mechanics); it's generated per equipped Heal/Utility
  choice instead, via each `Skill.toolbeltSkill` field (`profession-mechanic.ts`'s
  `engineerToolbeltBar`, independent of the slot resolver). F5: Holosmith clean (Engage Photon
  Forge); Scrapper's "Function Gyro" had 2 orphaned same-name duplicate ids, pinned via exclusion
  to the highest remaining id (best-effort — no name-based tell, unlike the Warrior pin); Mechanist
  (`Profession_4`: "Crash Down"/"Depth Charges"/"Recall Mech", 3 differently-named ids, no clean
  single pick) and the newest elite spec "Amalgam" (`Profession_2`-`_5`, literally named "Locked" —
  a dynamically-chosen sub-mechanic, not a fixed id) are excluded entirely, genuinely unresolved.
- **Ranger** — `/v2/pets` gives exactly one real, always-equippable skill per pet (the "F2" special
  shown by its portrait) — modeled as `Pet` (`pets.json`) plus `Build`'s `equippedPetIds`/
  `activePetIndex` fields and a dedicated `PetsEditor` (mirrors `RevenantSkillsEditor`'s picker
  shape, plus a name search input since there are 66 pets). Corrected 2026-07-30, same shape as the
  Revenant mistake above: the original session wrongly generalized from `Profession_1`/`_2` (100%
  Soulbeast-gated, spec id 55 — "Swoop"/"Bite"/"Quickening Screech"/"Defy Pain" etc., Beastmode's
  per-pet-*family* skill kit, correctly excluded) to skip the resolver for Ranger entirely, without
  checking `Profession_3`-`_5`. Those hold real per-spec F-buttons: Druid's "Celestial Avatar" F5
  toggle (clean flip-chain to "Release Celestial Avatar") and Untamed's "Venomous Outburst"/
  "Rending Vines"/"Enveloping Haze" (F1-F3, unconditionally shown/counted whenever Untamed is
  equipped — see "Untamed's Unleash mechanic, resolved" below, this is intentional). Untamed's F5
  ("Unleash Ranger"/"Unleash Pet") is a single toggle skill (the 2 ids are each other's `flip_skill`
  target) rather than 2 independent picks — both excluded here since the toggle is instead surfaced
  as `Build.rangerUnleashed`, a `WeaponSkillBar.tsx` display toggle (landed in the weapon-selection
  session), not as a mechanic-bar button. Soulbeast's own
  `Profession_1`-`_4` (F1/F2 per merged pet *family*, F3 per pet *archetype*, F4 "Eternal Bond" a
  contextual alternate) stay excluded from this generic per-spec resolver — none of them is a single
  fixed id, so `EXCLUDED_MECHANIC_SKILL_IDS`/`RANGER_BEASTMODE_EXCLUDED_SLOTS` still drop all 4 here
  — but F1-F3 are resolved separately by the dedicated `soulbeastBeastmodeBar` (see "Soulbeast's
  Beastmode F1-F3" below); `Profession_4` has no per-pet data and stays genuinely unresolved.
  `Profession_5` ("Beastmode", the actual merge-with-pet toggle button) is the one clean single id
  from the generic resolver, not excluded. Also found and excluded "Worldly Impact" (`Profession_3`,
  one of its 2 legacy duplicate ids) — a Beastmode skill (description starts "Beast.", like every
  other Soulbeast id) whose `specialization` field is missing entirely in the raw API data on one of
  its 2 ids, a real gap rather than a base-game core F3 (confirmed by re-fetching live, not a
  transient glitch; the wiki's own infobox for this skill separately documents both ids together).

`EXCLUDED_MECHANIC_SKILL_IDS` in `profession-mechanic.ts` holds every hand-verified pin/exclusion
above, each with its own reasoning comment — same pattern as `LEGEND_SPECIALIZATION_ID` in
`fetch-game-data.ts`: a small, documented constant table for a real API gap rather than a guess.

**Untamed's Unleash mechanic, resolved (2026-07-31)**: TODO.md had left this open pending a
per-pet-family wiki lookup, on the assumption (from a user screenshot showing 3 animal-themed icons
beside the pet portrait, described as "Bear/Ursine family only") that "Unleash Pet" grants the pet a
3-skill set that varies by pet family — same shape of gap as Soulbeast's Beastmode. Live-checked the
`Unleash_Ranger`/`Unleash_Pet` wiki pages directly (raw wikitext, both are `{{Skill infobox}}` pages
with `chain1=`/`chain2=` linking them to each other, i.e. one toggle skill with 2 states, not 2
independent picks) — this overturns that premise entirely:
- **No family variance exists.** "Unleash Pet" (id 63344)'s own Notes state plainly: "Replaces your
  pet skills with Venomous Outburst, Rending Vines, and Enveloping Haze" — a fixed 3-skill set, the
  same regardless of which pet/family is active. The screenshot's "Bear/Ursine-only" icons were
  almost certainly the pet's own *default* (non-Unleashed) family-based kit instead — a pre-existing,
  Untamed-unrelated GW2 mechanic documented on the wiki's general `Pet` page ("these 3 skills the pet
  uses to attack are determined and shared by their family," e.g. all bears share Slash (bear)/Bite
  (bear)/Defy Pain) — not a per-family "Unleash Pet" variant. This app doesn't model that per-pet
  autoattack+2-skill kit at all (only `Pet.skillId`, the Beast/F2 skill), same as before this session
  — no gap, since it's not part of the Unleash toggle either way.
- **The toggle direction was backwards in an earlier session's note.** "Unleash Ranger" (id 63147)
  is the one that empowers the Ranger's own weapon autoattack (already correctly implemented,
  `untamed-unleash.ts`'s `unleashedWeaponOneId`, verified independently via each weapon's own
  `specializationId === 72` alternate skill data) — not "Unleash Pet" as an earlier write-up guessed.
- **Already fully implemented, no code gap.** `Venomous Outburst`/`Rending Vines`/`Enveloping Haze`
  each carry `specializationId: 72` with no competing candidate in their `Profession_1`-`_3` slots
  (confirmed by inspecting `professions.json` directly), so `professionMechanicBar`'s existing
  generic per-spec resolver already surfaces exactly these 3 whenever Untamed is equipped — with no
  Soulbeast-style special-casing needed — and they already flow into `sources.ts`'s boon/condition
  totals through the same `skillIdsForBuild`/`mechanicBarSkillIds` path every other profession's
  mechanic bar uses. Since both effects (empowered autoattack + pet-skill swap) fire from the *same*
  single toggle skill, unconditionally counting the pet-skill-replacement set (regardless of
  `Build.rangerUnleashed`'s display state) is consistent with this app's established "both toggle
  states always contribute" convention (`weaponSkillIdsForBuild`'s doc comment) — not a new
  simplification invented for this case.
No code changes were needed; this entry exists to correct the record (this doc, and the
`EXCLUDED_MECHANIC_SKILL_IDS`/`Familiar` comments referencing the old, wrong assumption) so a future
session doesn't re-attempt a wiki-lookup script for a per-family skill set that doesn't exist.

Separately, and orthogonal to the above: **Firebrand's Tomes and Engineer's Kits replace the weapon
skill bar (1-5) while active** — a real GW2 mechanic the user asked about directly, landed in a
follow-up session, see `Bundle skills (Engineer Kits, Firebrand Tomes)` below. **Ranger Soulbeast's
Beastmode does NOT do this** — an earlier session's assumption otherwise, corrected once the wiki
was actually checked; see that section for the real mechanic and the "Soulbeast's Beastmode F1-F3"
section directly below for the pet-family/archetype → skill-id mapping (resolved 2026-07-31).

### Soulbeast's Beastmode F1-F3 (per-pet-family/archetype skills)

No API field links a pet to a Beastmode skill at all — sourced entirely from the wiki's `Soulbeast`
page, via `scripts/fetch-soulbeast-beastmode.ts` (`npm run fetch-soulbeast-beastmode`, after
`fetch-game-data`), which writes `data/game-data/soulbeast-beastmode.json` (`SoulbeastBeastmodeMap`,
`Pet.id` -> `{f1SkillId, f2SkillId, f3SkillId}`).

- **`== Pet Family ==`** (26 rows): each row gives F1/F2 skill *titles* for one family — either a
  single-species family (a direct `[[Juvenile X|X]]` link, e.g. Phoenix/Warclaw/Wallow — these
  species get their own dedicated F1/F2, distinct from the broader archetype family they otherwise
  belong to) or a shared multi-species family (a bare `[[Bear]]`/`[[Feline]]`/etc. link giving that
  family's *default* F1/F2). Feline's row also carries one inline `<small>(...)</small>`-tagged
  White-Tiger-only F2 override (base Feline F2 "Maul" -> White Tiger's own "Phase Pounce").
- **`== Pet Archetypes ==`**: a "Soulbeast Beast skill" row gives the 5 archetypes' F3 titles in a
  fixed Stout/Deadly/Versatile/Ferocious/Supportive column order; the family rows below it enumerate
  every individual pet species as a real `[[Juvenile X|X]]` link per family+archetype cell — this is
  what actually tells you which of the 66 pets belong to which shared family (the Pet Family table's
  generic rows don't enumerate members themselves). **2 real family-name mismatches between the two
  tables** (Pet Family table says "Bear"/"Bird", Pet Archetypes table says "Ursine"/"Avian" for the
  same family) — handled by a small hardcoded rename table, `ARCHETYPE_TABLE_TO_FAMILY_TABLE_NAME`.
- Every parsed title is resolved to a real skill id by matching (name, slot) against the local
  Ranger `Profession_1`/`_2`/`_3` candidate pool; unique matches resolve directly, and the 4 real
  same-name-same-slot collisions found ("Bite" ×2 — Bear vs. Feline; "Tail Lash" ×2 — Devourer vs.
  Wyvern; "Brutal Charge" ×2 — Canine vs. Porcine; "Worldly Impact" ×2 — the known legacy-duplicate-
  id case above) are disambiguated by fetching that specific title's own wiki page for its `id=`.
- **Real finding: the wiki's aggregate tables lag actual game content.** Live-verified 2026-07-30:
  after fully resolving both tables, 4 local `Profession_1`/`_2` Soulbeast (`specializationId ===
  55`) ids remained unaccounted for — "Jet"/"Tail Whip" belong to a brand-new pet (Juvenile River
  Otter, `family = River Otter` per its own `{{Pet infobox}}` — a family absent from both wiki
  tables entirely) and "Saurian Might"/"Leaping Lizard" are an undocumented per-species override for
  Juvenile Raptor Swiftwing (`family = avian` per its own infobox, so it archetype-wise belongs to
  Avian, but its F1/F2 don't match Avian's shared "Bird" default — and unlike Phoenix/Warclaw it has
  no dedicated override row in the Pet Family table either, since that table simply hasn't been
  updated for this pet yet). Rather than hand-pinning these two cases, the script resolves *any*
  leftover unaccounted id generically: wiki-search `"<skill name>" soulbeast`, fetch the first
  result whose own `{{Skill infobox}}` `id=` matches, and read that page's own `pet=`/`mechanic
  slot=` fields directly — confirmed live every Beastmode F1/F2 skill's own page carries these
  (e.g. "Jet (soulbeast)"'s infobox: `pet = River Otter`, `mechanic slot = 1`), a *more*
  authoritative per-skill signal than the aggregate table. This makes the resolution self-healing
  against future new-pet content lag rather than a one-time hand-patch for today's 2 cases. Any pet
  found only via this leftover sweep (so it has no archetype from either wiki table) gets its
  `archetype=` field read straight from its own infobox as a final step.
- **Net result**: all 66 pets resolve to a complete triplet. Only 1 log line on a clean run: the
  wiki's own "Vampiric Bite (soulbeast)" title (documented as Wallow's F1 in the Pet Family table)
  is itself marked `status = historical` on its own infobox — removed from the game in a
  2023-11-28 patch and replaced by the generic Porcine family's shared "Maul". No special-casing was
  needed: the script's existing family-default fallback (used whenever a species' own row leaves a
  slot unresolved) already produces the correct current answer.
- **Wiring**: `soulbeastBeastmodeBar` (`profession-mechanic.ts`) resolves the build's *active*
  equipped pet's (`Build.equippedPetIds[activePetIndex]`) F1-F3, wired into `ProfessionMechanicBar
  .tsx` ahead of the generic resolver's output whenever Soulbeast (spec 55, `RANGER_BEASTMODE_SPEC_
  ID`, now exported) is equipped — same prepend pattern the Engineer Toolbelt already uses.
  `sources.ts`'s `skillIdsForBuild` folds in *both* equipped pets' full triplets unconditionally
  whenever Soulbeast is equipped (same "both always contribute regardless of which is active"
  reasoning as every other bar toggle), so the boon/condition calculator picks up boon-granting
  Beastmode skills correctly.

## Bundle skills (Engineer Kits, Firebrand Tomes)

Both mechanics temporarily swap the displayed weapon-skill bar (1-5) for a fixed 5-skill "bundle" —
same in-game shape, two different data sources:

- **Engineer Kits** have real API ids. A kit's own skill object (e.g. Grenade Kit, id 5805) carries
  a `bundle_skills` array — confirmed live 2026-07-30 it's always 10 ids for a 5-slot kit: 5 land +
  5 underwater, disambiguated the exact same way weapon types are (`Weapon_1`-`Weapon_5` slot label
  + the `NoUnderwater` flag on the land variant — see `weapon-calc/weapon-skills.ts`). New
  `Skill.bundleSkills: number[] | null` field (`scripts/fetch-game-data.ts`); `resolveWeaponSkillIds`
  generalized to `resolveSkillBarIds` (takes a bare `{id, slot}[]` instead of requiring a
  `ProfessionWeapon`) so weapons and kits share one resolver rather than duplicating the
  land/underwater disambiguation logic.
- **Firebrand's 3 Tomes' 15 chapter skills (5 each) have NO id anywhere in the public API** —
  confirmed live 2026-07-30: even though each chapter's own wiki page (e.g. "Chapter 1: Searing
  Spell") lists an `id=` field in its `{{Skill infobox}}` (41258 for that example), calling
  `/v2/skills?ids=41258` returns `{"text": "all ids provided are invalid"}`. So this data is
  entirely wiki-sourced. New `scripts/fetch-tome-chapters.ts` (`npm run fetch-tome-chapters`, after
  `fetch-game-data`): each tome's own page (e.g. "Tome of Justice") lists its 5 chapters via
  `{{Weapon skill table row|<chapter name>}}` in slot order; each chapter's own page has
  `description=`, `facts=` (the exact same `{{skill fact|...}}` template relics/skills/traits all
  use), and `weapon slot=` (1-5, used as the authoritative slot index over page order). The
  `{{skill fact}}` parser (pipe-protection for embedded `[[Link|text]]`/`{{template|arg}}`, WvW-line
  selection when a fact is split by `game mode=`) is a straight copy of `fetch-relic-effects.ts`'s
  own — these are standalone scripts with no shared script-lib module today, so it's duplicated
  rather than imported. **One real bug hit copying it**: the pipe-placeholder constant is a
  private-use-area Unicode character invisible in a text editor; retyping it by hand silently
  produced a real empty string, and splitting a string on `''` splits it into individual characters
  — the first run's output was every fact value shattered into single-character fragments. Caught by
  inspecting the output rather than trusting a clean-looking run; fixed by writing the exact
  codepoint (``) via a small Node script instead of retyping the character directly. New
  `TomeChapter`/`TomeChaptersByTomeId` types (`tomeChapters: Record<number, TomeChapter[]>`, keyed
  by the parent tome's own equippable skill id); no icon field exists on a chapter's own infobox, so
  every chapter falls back to its parent tome's icon (already in `skills.json`) — a documented
  simplification, not a guessed per-chapter icon this app has no source for. All 15 chapters fetched
  cleanly (0 log lines) on the verification run.
- **Shared consumption**: `src/shared/skill-calc/bundle-skills.ts` resolves which of a build's
  equipped skills are bundle-capable (Kits from `build.skills.utility`; Tomes from Firebrand's
  always-present F1-F3, found via `professionMechanicBar` — Tomes aren't a Heal/Utility/Elite pick
  at all, they're permanent mechanic-bar skills) and what their 5 slots show for the build's current
  `environment`. New `Build.activeBundleSkillId: number | null` is purely the *display* toggle
  (which bundle's bar is currently shown) — every equipped bundle's skills always contribute to
  `computeBoonConditionSources`'s output regardless, same "could be opened at will" reasoning
  `activeWeaponSet`/`activeLegendIndex`/`activePetIndex` already use. Kit skills are real `Skill`s
  and fold into the normal skill-id list `sources.ts` already walks; Tome chapters have no `Skill`
  to fold in, so a new `tomeChapterBoonSources` (`sources.ts`) reads their wiki-sourced
  `RelicFactLine`s directly — a chapter fact's first bare value is its duration in seconds and
  `stacks=` is `apply_count`, for any label matching a boon/condition name (case-normalized, since
  the wiki template's label casing isn't consistent — e.g. `vulnerability` lowercase vs. the app's
  `Vulnerability` constant). Verified against Tome of Justice's Epilogue chapter: correctly yields
  Burning (3s) and Might (8s ×5 stacks) — the WvW-tagged values, not the PvE-only 2s/8-stack pair
  sitting right next to them in the same wikitext line.
