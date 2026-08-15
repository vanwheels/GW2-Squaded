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

Re-run it manually (along with the wiki-sourced scripts documented further down this file, as
needed) whenever a balance patch changes trait/skill values, then commit the regenerated
`data/game-data/*.json`. That commit **is** the publish step for the in-app refresh mechanism —
see "In-app game-data refresh" below; there's nothing further to run or upload.

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
- `meta.json` — `{ fetchedAt, gw2Build }`. `gw2Build` is the GW2 API's own `/v2/build` id at fetch
  time (added 2026-08-11; `null` on copies fetched before this field existed — the app's update
  check falls back to comparing `fetchedAt` in that case). Surfaced in the Settings tab and used
  as the freshness signal for the in-app refresh mechanism below.
- `skill-coefficient-verification.json` / `target-count-verification.json` /
  `balance-patch-verification.json` — **not read by the app at runtime**, unlike every file above.
  See "Wiki-verification audit trail" below.

## In-app game-data refresh

Built 2026-08-11, closing TODO.md's "Automatic game-data refresh mechanism" item (**Option C —
static-publish**, chosen 2026-08-07). Lets a packaged app pick up a regenerated
`data/game-data/*.json` without waiting for a new app-binary release.

**Publish side — nothing to run.** `data/game-data/*.json` is already committed to this public
repo (see `repo_now_public_for_autoupdate` in project memory), so the moment a curation session
commits+pushes a regenerated file to `main`, it's already fetchable at
`https://raw.githubusercontent.com/vanwheels/GW2-Squaded/main/data/game-data/<file>` — no worker
endpoint, no build/upload step, no new ops surface. `src/main/game-data/data-update.ts` hardcodes
that owner/repo/branch (kept in sync by hand with `electron-builder.yml`'s own `publish` config,
which points app-binary releases at the same repo).

**Consume side:**
- `src/main/game-data/load-game-data.ts`'s `resolveDataDir()` prefers a writable
  `<userData>/game-data/` override directory over the bundled/dev copy whenever that override's own
  `meta.json` exists — the override dir's presence alone (not any comparison) is what makes it
  authoritative, so a completed download takes effect without touching the bundled copy at all
  (not writable once packaged anyway).
- **Check**: fetches the remote `meta.json` and compares its `gw2Build` against the local copy's
  (falling back to `fetchedAt` if either is `null` — see `data-update-provider.ts`'s
  `GameDataMeta` doc comment for why `gw2Build` is preferred). Fired once automatically on launch
  (`ready-to-show`, from `src/main/index.ts`) — TODO.md's decided "check on launch, prompt the
  user, never a silent background download" contract — and again on demand from the Settings tab.
  A found update surfaces as a small badge on the NavBar's Settings tab (`NavBar.tsx`) plus the
  full check/download panel in `SettingsView.tsx`, mirroring the app-binary `UpdateControls`
  section right above it.
- **Download**: pulls every file in `GAME_DATA_FILE_NAMES`
  (`src/shared/game-data/data-files.ts`, hand-synced with `load-game-data.ts`'s own read list —
  same "duplicated, not shared via tooling" tradeoff as the Worker's `ShareKind`) into a temp
  directory, `meta.json` last so a partial temp dir never looks complete, then swaps it in for the
  override directory in one `rm`+`rename` — a failure partway through leaves the previous override
  (or bundled copy, if this was the first download) untouched rather than a mismatched mix of
  old/new files.
- **Apply**: same "downloaded, needs a restart" contract as the app-binary updater — the
  already-loaded in-memory `GameData` (and every renderer store built from it) stays exactly as it
  was for the rest of the running session; `SettingsView`'s "Restart now" button calls
  `app.relaunch()` + `app.exit()`.

**Known gap, not chased further**: `gw2Build` only reflects `scripts/fetch-game-data.ts`'s own
fetch — the separate wiki-sourced scripts (`fetch-elite-spec-skills.ts`, `fetch-wvw-splits.ts`,
etc., see their own sections below) don't bump it if run independently of a full
`fetch-game-data.ts` pass. In practice these are run together in the same curation session per
this file's own "re-run X too" notes throughout, so `meta.json` still reflects "as of this
pipeline run" closely enough — but a wiki-only content change committed without also re-running
`fetch-game-data.ts` wouldn't be detected as an update by this mechanism.

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

**A structurally-invisible sub-ability, found 2026-08-04 during the same sweep, fixed
2026-08-05 (`NON_EQUIPPABLE_SKILL_IDS`):** Elementalist's Elite-slot Conjure Fiery Greatsword has an
auto-triggered passive proc, "Lesser Fiery Eruption" (`44918`), that reached the live picker as if
it were its own independently-bindable skill — unlike every turret/gadget/elixir sub-ability above,
it has neither a `toolbeltSkill` link back to its parent (the signal `stripNonEquippableSubAbilities`
keys off) nor a `flipSkill` link (the signal `stripFlipTargets` keys off), and it's not part of any
duplicate-name group either, so `skillVariantExclusions` (which only re-derives *still-ambiguous
duplicate-name groups*) would never regenerate an entry for it — adding it there directly would've
been silently dropped on the next `fetch-skill-duplicate-resolutions` run. Confirmed via wiki raw
wikitext: `parent = Conjure Fiery Greatsword` and `[[Category:Lesser skills]]`. A full scan of
`skills.json` for every `name` starting with `"Lesser "` (37 ids) found this is the only one with a
Heal/Utility/Elite `slot` today — every other "Lesser "-prefixed id is `slot: ""` (trait/proc-only,
already outside the picker's candidate filter) or `slot: "Weapon_5"` (Catalyst jade sphere overloads,
a separate picker) — so this isn't (yet) a name-prefix category worth excluding wholesale, just one
hand-verified id. Fixed by adding `44918` to a new hardcoded `NON_EQUIPPABLE_SKILL_IDS` constant in
`skill-variants.ts` (signal 9), applied as a pre-pass alongside `skillVariantExclusions` — same
"small, documented constant table for a real API gap" pattern as `EXCLUDED_MECHANIC_SKILL_IDS` in
`profession-mechanic.ts`, chosen specifically because it lives in source rather than a
script-regenerated JSON file.

## WvW-vs-PvE fact splits (`wvw-fact-overrides.json`)

`/v2/skills` and `/v2/traits` facts carry no `game mode` tag, and (confirmed by direct
cross-check against the wiki, not assumed) the API's `duration` for a Buff fact is the PvE-tagged
value when a skill/trait's boon/condition grant is actually split between game modes, or the sole
value when it isn't split. Some skills' facts array even includes PvE-only AND WvW/PvP-only boons
side by side with no way to tell which applies where (e.g. Restoring Reprieve's API facts list
Protection+Resolution — PvE only — right alongside Aegis — WvW/PvP only) — so reading the API
facts directly, un-adjusted, overstates what a WvW-focused build actually gets.

**A rarer, more severe shape of the same gap (found 2026-08-06, Firebrand Mantra final-charge
skills):** some ids bake 2-3 raw Buff facts for the SAME status into the array with no
discriminator at all — e.g. Overwhelming Celerity's Might has 2 separate `duration: 10` and
`duration: 6` facts, not one. Reading these un-deduplicated (the pre-fix behavior) showed the boon
2-3x over in both the tooltip AND the real boon-uptime math, as if one skill use granted Quickness
three separate times. `collectCandidates`/`resolveOverride` in `fetch-wvw-splits.ts` now handle
this (`factCount > 1` branch) — only resolvable when BOTH the wiki's PvE-tagged and WvW-tagged
values for that status can be found among the id's actual raw API durations, which also catches
cases where the cached API data has drifted from the wiki's current numbers (Overwhelming
Celerity's own Quickness fails this validation and stays un-curated: API has `[5, 4, 3]`, current
wiki WvW value is `2.5` — not present in that set at all, so it's skipped and logged rather than
trusted). `sources.ts`'s `extractFromFacts` is what actually collapses the raw duplicate facts to
one row at read time, once a status has a curated override — every other (uncurated) same-status
duplicate keeps emitting one row per raw fact unchanged, since the overwhelming majority of the
~550 skill/trait ids with this shape are genuine multi-hit/multi-pulse mechanics (a 4-shot volley
applying Bleeding on each hit) where that's correct, not a mode-split at all.

Same session: fixed a real pre-existing bug in the wiki-line game-mode bucketing this whole
mechanism depends on — a line tagged `game mode=pvp` only (neither `pve` nor `wvw`) was being
counted as a "PvE" line (the old bucket was "not wvw", not "explicitly pve"), so any genuine 3-way
pve/wvw/pvp split (3 separate `{{skill fact}}` lines, one per mode — common on Firebrand Mantra
pages) always tripped the "more than one PvE-tagged line" ambiguity check even when perfectly
resolvable. Fixed to bucket by explicit `pve`/`wvw` token presence, pvp-only lines simply ignored.
This alone newly resolved 97 skills + 60 traits across the full dataset on re-run (156 vs. the
prior 210 log lines skipped), all purely additive — no previously-curated value changed, confirmed
by diffing the full file before/after. One rare residual: a status appearing ONLY under a
`game mode=pvp`-only line (2 traits: Martial Cadence's Quickness, Kinetic Accelerators' Fury) has
no explicit pve/wvw line to resolve from at all — conservatively left un-curated (logged as
"skip (unhandled combination)") rather than assuming pvp-only implies omit-in-WvW.

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
special-casing needed anywhere else.

Two cases warrant a new entry:
1. A skill has a real wiki-documented Healing/Damage coefficient but no live-API fact of the
   matching `type`/`target`/`text` to gate on: pull the raw wikitext (`action=raw`, never a
   summarized fetch) for the coefficient itself as usual, then add a matching `{ type, target,
   text }` synthetic `Fact` here (its own `value` is cosmetic — put the wiki's stated base value for
   parity with a real fact, but the curated table's `baseValue` is what actually renders) plus the
   normal `CURATED_HEALING_COEFFICIENTS`/`CURATED_DAMAGE_COEFFICIENTS` entry. Worth checking for on
   any other very-recently-released skill (new elite specs in particular) that turns up with an
   empty-seeming Damage/Healing tooltip during a future sweep — Janthir Wilds-and-later content has
   hit real API-coverage gaps more than once during this project's curation sweeps (see TODO.md).
2. TODO.md's "some skills' real effects live entirely outside the GW2 API's `facts` array" bug —
   `scripts/scan-empty-effect-facts.ts` finds candidates (a skill with a substantive description but
   zero facts beyond Range/Recharge/Distance/Radius, where the live wiki page carries a structured
   `{{skill fact|...}}` template the local API omits entirely). Here a synthetic `Buff` fact
   (`status`/`duration`/`apply_count`, the same shape a real API Buff fact uses) is the usual shape
   — it flows through `extractFromFacts`/`boonConditionFactsForSkill` exactly like a real one, so it
   shows up in both the skill's own tooltip and the whole-build boon/condition bar automatically.
   **Not every finding in that scan's list is actually curatable this way** — spot-checked
   2026-08-08 while curating the first entries: a wiki `{{skill fact|effect|<Name>}}` template with
   no accompanying number (e.g. profession-mechanic toggles like Unleash Ranger/Unsheathe Gunsaber
   naming an internal state-flag effect such as "Unleashed"/"Gunsaber Mode") isn't a boon/condition
   and isn't rendered by any current fact-line path (`factLine` has no `NoData`/generic-text case at
   all — that's TODO.md's separate, not-yet-fixed "tooltips never show Misc/Control facts" bug) —
   curating one would be a silent no-op, not a real fix, so these are documented exclusions in
   TODO.md rather than synthetic-facts.json entries. Similarly, a skill whose real mechanic is a
   *single random pick* from a list of possible boons/conditions (e.g. the human racial skill Prayer
   to Lyssa) can't be modeled as ordinary `Buff` facts either — adding all N possible outcomes as
   simultaneous `Buff` facts would misrepresent every cast as granting all of them at once,
   overcounting boon uptime; left as an honest, documented skip instead of a wrong answer.
3. TODO.md's "trait-granted boons not shown on the triggering skill" sweep — a trait grants a boon
   "when you use [a heal skill/shroud/kit/etc.]" (own wiki-confirmed `Buff` fact on the *trait*), but
   the GW2 API's `Skill.traitedFacts`/`requires_trait` linkage that would normally surface this on the
   triggering skill's own tooltip is only populated for a handful of skills game-wide — most need the
   trait's fact hand-mirrored onto every skill id that actually triggers it (`requires_trait: <trait
   id>` on the synthetic copy, so it only shows when that trait is equipped). First hit: Revenant's
   Notoriety/Rapid Flow (2026-08-12, trait ids 1765/1760, mirrored onto all 24 legend heal/utility/
   elite skills). Same "extractFromFacts collapses EVERY fact sharing one status once an override
   exists" hazard as case 2's `WvwFactOverrides` interactions applies here too, from the opposite
   direction: adding a synthetic fact can *introduce* a fresh same-tuple collision with a skill's own
   pre-existing genuine fact (found 2026-08-14, Necromancer leg: Eternal Life's synthetic Protection
   collided with Sandstorm Shroud's own unconditional Protection fact) — re-run the
   `BUFF_INSTANCE_LABELS` same-tuple check (`sources.ts`) after adding entries here, not just after
   the sweep that table was originally built for. Elementalist leg (2026-08-14) found 4 more this
   way, mirroring Earth's Embrace/Soothing Ice/Gale Song onto all 16 Elementalist heal skills and
   One with Air/Rock Solid onto the Air/Earth Attunement skills and Hardy Conduit onto the 4
   Overload skills — the moral holds regardless of trait count: check every touched skill, not just
   the ones a single trait's own mirror looks likely to collide on. Engineer leg (2026-08-14) added
   one more (Reconstruction Enclosure's Protection onto the shared racial heal skills Prayer to
   Dwayna/Healing Seed, already carrying 2 prior legs' copies — a 3rd occurrence, not just a 2nd);
   also the first leg to mirror onto a skill's *tool belt* id rather than the skill itself
   (Automated Medical Response, Optimized Activation) and to target a skill with empty
   `professions`/`slot` fields in `skills.json` (Explosive Entrance, Jade Mortar — real ids, just not
   profession-tagged by the API; the synthetic-fact merge is purely id-keyed so this works fine).
   Guardian leg (2026-08-14) added 8 more: Healer's Resolution/Liberator's Vow/Purging Light (all
   "when you use a heal skill", mirrored onto all 12 Guardian heal skill ids the same heal-skill-
   category shape as prior legs) and Monk's Focus (Meditation skills, mirrored onto all 7 Guardian
   Meditation-category skill ids) found zero fresh same-tuple collisions this time (verified by
   re-running the merge-and-group check from this leg's own comment above) — the first leg where that
   check came back clean. First leg to need `WvwFactOverrides` (`data/game-data/wvw-fact-overrides.json`,
   via `scripts/fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` table) on its own new mirrors more than once:
   Liberator's Vow's Quickness (pve/pvp 2s, wvw 1s) needed a matching skill-side override on all 12 heal
   ids, and Focus Mastery's Protection (pve 4s, wvw/pvp 2s) — tied specifically to Shield of Wrath's own
   block-window-expiry per its 2024-03-19 patch note, NOT to Focus's other skill Ray of Judgment, which
   only gets this trait's unsplit Resolution half — needed one on Shield of Wrath alone; both mirror
   trait 633/2101's own already-auto-detected overrides so every tooltip agrees. Also curated:
   Restorative Virtues (Vigor) and Holy Reckoning (Fury) onto the single Willbender virtue-skill each
   names ("activating Flowing Resolve"/"activating Rushing Justice") and Righteous Sprint (Swiftness)
   onto all 3 Willbender virtue-activation skills (Rushing Justice/Flowing Resolve/Crashing Courage,
   the latter's 4 raw ids all being genuine same-named reactivation charges) — deliberately NOT onto
   any of their same-page "Willbender Flames" flip-skill ids, which are a separate named follow-up
   skill (its own damage facts), not a re-activation of the virtue itself. Holy Reckoning's OTHER boon,
   Might, was left uncurated: its trigger is "any virtue's own passive effect firing" (crit for
   Justice, block for Courage, ally-heal for Resolve), explicitly NOT virtue activation itself per the
   trait's own Mechanics note — a foe/passive-proc trigger with no single skill id to mirror onto, same
   shape as the already-excluded Arcane Prowess/Heavy Light family. 26 other raw candidates left open,
   not fitting this sweep's single-triggering-skill shape (on-crit/on-block/on-disable/on-dodge/equip-
   triggers, foe-facing debuffs, or very recent Luminary elite-spec mechanics with no deep prior
   knowledge, same reasoning as Ritualist's Empowering Spirits/Engineer's morph-skill cluster) —
   itemized in TODO.md rather than here. Mesmer leg (2026-08-14) found the largest single-leg haul yet
   (13 traits) because "Shatter skills" is a whole-category trigger shared by 5 different traits at
   once (Rending Shatter/Maim the Disillusioned/Illusionary Reversion/Flow of Time/Nomad's Endurance),
   mirrored onto all 5 base shatter ids PLUS all 6 Virtuoso Bladesong ids — confirmed via Rending
   Shatter's own wiki `improves type = Shatter, Bladesong, Instrument` field that Bladesongs
   mechanically count as Shatters for every trait in that family (Instrument/Troubadour ids excluded,
   too recent). New failure mode this leg, one level past the same-tuple `BUFF_INSTANCE_LABELS` check:
   a mirrored trait can share a status with an UNRELATED pre-existing fact on the same skill that has
   no override of its own — adding a `WvwFactOverrides` entry for the new mirror would then silently
   overwrite that unrelated fact's own true value too (not just introduce an extra display row, an
   actual wrong number). Found twice: Healing Seed's own unconditional Regeneration@3@1 (no
   `requires_trait`, always present) vs. Metaphysical Rejuvenation's mirrored copy, and Cry of
   Frustration/Bladesong Sorrow's pre-existing Phantasmal Force-linked Vigor override (value 5) vs.
   Nomad's Endurance's own mirror (value 1.5) — since `WvwFactOverrides` only holds one value per
   status per skill, the fix in both cases was to skip adding an override (or skip the mirror
   entirely, for the 2 Vigor ids) rather than risk collapsing either trait's value into the other's.
   Also left open, too complex for one session: Stretched Time and Seize the Moment, both dual-trigger
   (shatter-clone-count AND phantasm-spawn) traits where the (separate) `BUFF_INSTANCE_LABELS` sweep
   had already decoded a genuine mode-dependent DIFFERENT-boon swap (Alacrity in pve/pvp, Might in
   wvw) — see `sources.ts`'s own trait-side comments on trait ids 1942/2022 for the full wiki
   breakdown a future session could resume from.

   Ranger leg (6th leg, 2026-08-14): 11 traits cleanly curated. Wellspring (978, "grant
   regeneration when you use a healing skill") mirrored onto all 14 Ranger heal skill ids;
   Stoneform (1021, "activating a Signet grants might and fury") onto all 4 signet ids;
   Wilderness Knowledge (1699, "Survival skills grant fury") onto all 6 Survival skill ids; Let
   Loose (2271, "Unleashed Ambush skills grant boons") onto the 12 Soulbeast Unleashed Ambush
   skill ids (its Quickness is PvE-only, omitted in WvW). The largest cluster: Fang and Claw
   (1016, Fury)/Rejuvenation (1055, Regeneration)/Live Fast (2071, Fury+Quickness)/Flock Together
   (2408, Quickness) are all "Beast skills grant ___" — a whole-category trigger covering every
   Ranger pet's own F2 skill — mirrored onto all 76 pet skill ids game-wide at once (same
   full-category-sweep shape as Engineer's 56-tool-belt-id leg, just larger); 5 of those 76 ids
   already carried a genuine, differently-valued real API fact of the exact same status (their own
   unsplit Fury/Regeneration/Quickness), each individually excluded from an override on just that
   one status/id, same "coexisting genuine application blocks a safe status-wide override" hazard
   as every prior leg — the synthetic fact itself is still added there, just left unsplit. Also
   fixed a fresh same-tuple collision on the 2 shared racial heal skills (Prayer to
   Dwayna/Healing Seed): Wellspring's Regeneration@6@1 collided with the Mesmer leg's Metaphysical
   Rejuvenation mirror already sitting there (`BUFF_INSTANCE_LABELS`, `sources.ts`). Found one
   genuinely NEW wiki-confirmed WvW split the automated scan had never resolved even at the trait
   level — Celestial Shadow (2053, "grant superspeed and stealth when leaving celestial avatar
   form"): Stealth splits pve(3)/wvw+pvp(2), added by hand to `MANUAL_OVERRIDES.trait` in
   `fetch-wvw-splits.ts` (same "wiki page confirmed a split the automation couldn't cross-validate
   on its own" pattern as that file's other manual entries) and mirrored onto Release Celestial
   Avatar (31411). Left open: Grace of the Land (2001, "grant boons within the radius of your
   Celestial Avatar skills") is a genuine mode-dependent DIFFERENT-boon swap (PvE grants Alacrity,
   WvW/PvP grant Might instead, wiki-confirmed) that isn't even correctly resolved on the trait's
   own tooltip yet — `WvwFactOverrides` can omit a fact but can't introduce a different one in its
   place, so this needs a base-trait-level fix before any skill mirror would be meaningful; same
   shape as the Mesmer leg's Stretched Time/Seize the Moment deferrals. Also left open: pet-swap/
   weapon-swap-triggered traits with no skill id to mirror onto (Spirited Arrival, Quick Draw, Tail
   Wind, Furious Grip — same "no single triggering skill" exclusion class as every dodge/on-crit
   trigger in prior legs), Fortifying Bond/Fresh Reinforcement (both "share/gain your pet's current
   boons" — a dynamic pet-state mechanic, not a fixed boon grant, can't be modeled as a static Buff
   fact), and Verdant Etching (2016, "Glyphs heal allies; in Celestial Avatar form, grant
   protection instead") — each Ranger Glyph has 3 separate skill ids for its different
   normal/Celestial-Avatar-form/other-state variants and this session didn't have enough confidence
   distinguishing which id is which to mirror the Protection half safely.

   Revenant leg (7th leg, 2026-08-14): rescanning fresh caught a bug in this sweep's own
   candidate-discovery script — it read `skill.traited_facts` (snake_case, doesn't exist) instead of
   the real field `skill.traitedFacts` (camelCase), so every prior leg's "not yet linked" candidate
   count silently included traits the GW2 API already links correctly on their own (10 for Revenant
   alone: Fiendish Tenacity, Permeating Pestilence, Notoriety, Draconic Echo, Demonic Defiance,
   Diabolic Inferno, Core Value, Lasting Legacy, Bold Reversal, Song of Arboreum) — worth checking
   this field name before trusting either remaining leg's candidate list. 8 traits cleanly curated.
   A 4-trait "invoke a legend" category cluster — Aggressive Arrival (1776, Resistance), Invoker's
   Rage (1778, Fury), Spiritual Reckoning (1810, Resolution, pve 6s/wvw+pvp 3s), Balance in Discord
   (2254, Regeneration, pve+wvw 6s/pvp-only 3s so no WvW override needed since this app only
   distinguishes pve vs. wvw) — mirrored onto all 10 "Legendary ___ Stance" legend-swap skill ids
   game-wide (Balance in Discord's 2nd OR-trigger, Alliance Tactics, got its own single-id mirror
   too). Spirit Boon (1774, "invoking a legend grants boons to nearby allies based on the legend that
   was invoked") looked like the sweep's usual "different boon per mode/target" deferral shape at
   first glance, but its own raw facts carry a `linked skill=`-equivalent `prefix.status` naming
   exactly which legend each boon belongs to — Might/Legendary Assassin Stance (pve 10s/wvw+pvp 6s),
   Resistance/Demon, Stability/Dwarf, Regeneration/Centaur, Protection/Dragon (pve 3s/wvw+pvp 2s),
   Resolution/Renegade, Vigor/Alliance — so each mirrored cleanly onto just that one legend's own
   swap id; only Legendary Entity Stance's own line ("gain the same boons as the legend equipped in
   the other slot") stayed uncurated, a dynamic reference not a static fact. Set in Stone (1766,
   Protection, "gain protection when you use your profession skill 2") looked like a guessing-game
   across 8 legends at first too, but the wiki's own `improves skill=` field spells out the full
   list verbatim — Ancient Echo, all 5 True Nature variants (one per core legend Herald re-themes),
   Heroic Command, both Energy Meld ids, and all 6 Release Potential variants — 15 ids, no per-legend
   guessing needed since the same Protection value applies regardless of which one fires. Ashen
   Demeanor (2166, Might flat + Resistance pve 6s/wvw+pvp 4s, "gain might, resistance, and Kalla's
   Fervor when you use a healing skill" — the Kalla's Fervor third excluded, not a recognized boon)
   and Redemptor's Sermon (2228, Protection flat, "heal allies in the area and grant them protection
   when you use a healing skill") both mirrored onto all 8 Revenant heal skill ids, the familiar
   heal-skill-category shape every prior leg has hit. Found+fixed 1 fresh same-tuple collision
   (`BUFF_INSTANCE_LABELS`): Aggressive Arrival's and Spirit Boon's Resistance@2@1 both landing on
   Legendary Demon Stance. Found 3 more genuinely NEW wiki-confirmed WvW splits the automated scan
   had never resolved even at the trait level (Spiritual Reckoning, Ashen Demeanor, and Spirit Boon's
   Might/Protection halves) — added by hand to `MANUAL_OVERRIDES.trait` in `fetch-wvw-splits.ts`,
   same pattern as the Ranger leg's Celestial Shadow. Left open: Invoking Harmony (1823) and
   Unyielding Devotion (1825) each grant a custom-named "unique effect" per their own wiki pages
   (Invoking Harmony/Unyielding Spirit) rather than a recognized `BOON_NAMES` entry — same exclusion
   class as Kalla's Fervor/Death's Carapace. ~36 other raw candidates left open, same shape as every
   prior leg's exclusions: weapon-swap/dodge/on-crit triggers with no skill id to mirror onto,
   overly-broad triggers ("applying a boon"/"gaining fury"/"removing a condition" — too many possible
   trigger skills to enumerate confidently), health-threshold triggers, Kalla's Fervor/Battle Scars
   stat-steppers, and Legendary Alliance/Conduit's very-recently-added elite-spec mechanics (no deep
   prior knowledge, same reasoning as Ritualist's Empowering Spirits in the Necromancer leg).

## Traits whose real fact lives on an un-equippable proc skill (`synthetic-trait-facts.json`)

Same shape/mechanism as `synthetic-facts.json` above (`{ [id]: Fact[] }`, merged once at load time —
`withSyntheticTraitFacts` in `load-game-data.ts`), but a separate file/id namespace merged onto
`GameData.traits` instead, since skill ids and trait ids are independent sequences that could
collide. Narrower trigger than any of `synthetic-facts.json`'s 3 cases: some trait procs summon a
separate, real, `/v2/skills`-visible entity to actually deal the damage/apply the buff (a "Lesser
X"/named proc skill, e.g. Reckless Impact 14268 for Warrior's Reckless Dodge trait 1446) — normally
harmless, since `computeBoonConditionSources` only walks *equipped skill*/*chosen trait* facts and
the proc skill was never meant to be equipped anyway, its Buff fact reachable some other way. Two
traits (found during the 2026-08-15 dodge-roll sweep, TODO.md) turned out to have NO other way in:
Reckless Dodge 1446 (real Might fact only on proc skill 14268) and Guardian/Vindicator's Saint of zu
Heltzer 2238 (its own "Saint of zu Heltzer" self-buff fact IS on the trait directly, but its separate
Alacrity-to-allies grant is only on proc skill Saint's Shield 62689) — `skillIdsForBuild` never
includes either proc skill id, so both traits contributed nothing to the aggregate Boon/Condition
panel despite each already having its own `TARGET_COUNT_OVERRIDES.skill` entry from an earlier sweep
(dead code today, left in place as historical documentation). Fixed by copying each proc skill's Buff
fact verbatim into a matching `synthetic-trait-facts.json` entry, then adding a same-value
`TARGET_COUNT_OVERRIDES.trait`/`DODGE_TRIGGER_NOTES.trait` entry keyed by the TRAIT's id (not the
proc skill's) since every downstream consumer resolves by `sourceKind`+`sourceId` and the merged fact
now reports `sourceKind: 'trait'`. Worth checking any future "trait proc summons a Lesser-X skill"
finding against `skillIdsForBuild` the same way before assuming it's already covered.

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
  varied — procs, on-crit/on-swap triggers — to model fully structurally like runes). Also parsed
  line-by-line into `bonuses: AttributeBonusText[]` using the same `parseAttributeBonusText` regex
  as Rune/Consumable bonus lines (fixed 2026-08-06, prior gap: sigils had no structural bonuses at
  all, so a "stat sigil" like Superior Sigil of Concentration's `"+10% Boon Duration"` never
  reached the Stats panel) — this only actually captures the handful of pure-stat sigils; every
  proc/on-crit/on-swap/on-kill line fails the regex and stays `{attribute: null}`, correctly
  display-only. One live quirk found doing this: Superior Sigil of Malice's description is
  `"+10% condition duration."` — lowercase and period-terminated, unlike every sibling sigil's
  `"+N% Attribute"` styling — so `parseAttributeBonusText` strips a trailing period off the
  captured attribute name before it's used as an alias-table lookup key.
  `details.flags` on a sigil is the list of weapon *type* names it applies to (e.g.
  `"Greatsword"`, `"Dagger"`) — a different vocabulary than `WeaponFlag` in
  `src/shared/types/game-data.ts` (which is hand/two-hand/aquatic, not weapon type). Stacking
  sigils (Bloodlust, Corruption, Bounty, etc.) are a separate mechanic entirely, unaffected by this
  — see `STACKING_SIGILS` in `combat-state.ts`.
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
  TODO.md) — this deliberately includes shared/placeable items (see below), which the user
  confirmed 2026-08-06 are what most WvW squads actually run over individually-carried food/
  utility. **Real gotcha**: a consumable's actual buff (if any) is NOT a `Fact[]` array like
  skills/traits use — it's a single flattened descriptor at
  `details.{name, duration_ms, apply_count, description}`. `description` here is freeform text
  (e.g. `"+100 Power\n+70 Precision\n+10% Experience from Kills"`), parsed line-by-line the same
  way as rune bonuses.
  **Second parsed shape, added 2026-08-06**: `parseAttributeBonusText` now also recognizes "Gain
  `<target>` Equal to N% of Your `<source>`" (e.g. "Gain Power Equal to 3% of Your Precision") —
  the Superior Sharpening Stone / Tuning Crystal formula, confirmed to be the dominant WvW
  Utility-consumable shape (~43% of the catalog; previously fell through to the generic
  `"+N[%] Attribute"` regex, matched nothing, and silently contributed 0). Parsed into
  `AttributeBonusText.sourceAttribute` (see its doc comment in `src/shared/types/game-data.ts`)
  rather than the flat/percent shape, and resolved late against the build's final source-attribute
  total by `activeConsumableConversions`/`applyConversions` in `attribute-totals.ts` — same
  resolve-after-everything-else pattern already used for trait `BuffConversion` facts
  (`trait-attributes.ts`).
  **Shared/placeable items, fixed 2026-08-06**: ~37% of Food ("Feast"/"Tray"/"Pot" reagents — place
  one, anyone nearby can interact for the buff, rather than eating it yourself) have NO buff data at
  all on their own raw item record (`details` is just `{type: 'Food'}`) — an earlier pass wrongly
  read this as "these items do nothing" and filtered them out of `EquipmentEditor.tsx`'s pickers;
  the user corrected this (most WvW squads run exactly these, not individually-carried items).
  The wiki confirms these grant the identical buff as a specific individually-eaten item (e.g. "Feast
  of Rare Veggie Pizzas": *"Provides same effect as Rare Veggie Pizza"*) — `borrowSharedContainerBonuses`
  in `fetch-gear-upgrades.ts` resolves this by stripping the container word ("Feast of X(s)"/"Tray of
  X(s)"/"Pot of X"/etc.), re-singularizing, and re-prefixing every plausible individual-item
  container word ("Bowl of X"/"Plate of X"/"Cup of X"/...) to find the matching buffed item's name —
  only applied on an unambiguous single match (174/318 Food entries this session). `Consumable.
  sharedBuffSource` records what was borrowed from (surfaced in the tooltip via
  `formatConsumableDescription`); `durationMs`/`applyCount` are NOT borrowed (the shared version's
  duration is usually different and wasn't individually verified).
  **"Ascended Gourmet Feast" tier, fixed 2026-08-06**: of the 144 Food entries still buffless after
  borrowing, 68 turned out to be a distinct End of Dragons-era tier (e.g. Cilantro Lime Sous-Vide
  Steak) with NO buff data anywhere in the API and no individually-eaten sibling to borrow from at
  all — genuinely shareable-only by design. `applyAscendedFeastFormula` in `fetch-gear-upgrades.ts`
  resolves these instead via the wiki's documented recipe formula: a "food type" (from the item's
  name, e.g. "Sous-Vide Steak") fixes a major/minor attribute pair, a "herb" (e.g. "Mint") fixes one
  more bonus effect, and 5 fixed lines (`+10% Karma`/`+5% All Experience Gained`/`+20% Magic Find`/
  `+20% Gold Find`/`+10% WXP Gained`) are appended to every one — cross-checked against several
  individual items' raw wikitext (not a rendered/summarized table) before being hardcoded, including
  the handful of names that don't spell out their food-type/herb word literally ("Salsa" = Cilantro,
  "Spiced"/"Peppered" = Peppercorn). The remaining 76 are genuinely non-food catalog noise (Mastery-
  point currency, crafting materials, achievement/collection rewards) — see TODO.md for the open
  question on filtering those back out of the picker.
  Utility's equivalent — "Station" items (Sharpening Stone Station, Tuning Crystal Station, etc.,
  14 total) — turned out to need a *different* fix: they're NOT missing buff data (their own raw
  item record has a complete `details.description`, same shape as an ordinary Utility item) — they
  were simply never fetched at all, filed under `details.type: 'Generic'` instead of `'Utility'` for
  reasons the API doesn't explain. `bucketItem` now pulls them in via a name-suffix
  (`"...Station"`) + description-prefix (`"Utility Station:"`) guard, tight enough to exclude the
  ~125 other `Generic`-type items that bucket also holds (Guild bank boosts, Fractal potions, Mist-
  attunement potions — a different consumable category entirely, not a per-character equipment-slot
  pick).

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
  See TODO.md for the full writeup/verification. **Display side corrected 2026-08-04**: the
  "stacked tooltip variant is enough, no separate legend-form concept needed" framing above was
  right for boon-calc (both aspects always contribute regardless of display) but wrong for display
  — live-verified against the wiki's "Alliance Tactics" page (F3, "Swap your Legendary Alliance
  Stance skills", 3s recharge) that this is a real in-combat manual toggle affecting all 5 slots at
  once, the same "hit a button, the whole kit swaps" shape as a Kit/Tome/Celestial Avatar toggling
  the weapon bar (`activeBundleSkillId`) — not an on/release pair like every other legend's own
  `flipSkill` link (1 slot only), which correctly stays a stacked tooltip variant. "Alliance Tactics"
  itself (62729) turned out to be a 6th instance of the "real F-button missing from
  `professionSkills` entirely" API gap already seen for Dragonhunter's virtues/Specter's mechanics —
  hand-injected (`VINDICATOR_MECHANIC_SKILLS`) the same way. Implemented as `Build.
  vindicatorAspectFlipped` (display-only, doesn't affect boon-calc totals — those were already
  correct) toggled by clicking the F3 icon; `RevenantSkillsEditor`'s bar resolves each slot through
  the toggle via `vindicator-aspect.ts`'s `vindicatorAspectSkillId` (a 1-hop `flipSkill` lookup from
  the canonical Archemorus id), and `relatedVariantSkills` skips stacking that specific hop for the 5
  canonical ids so the toggle and the tooltip don't both signal the same swap. See COMPLETED.md.
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
  session), not as a mechanic-bar button. Soulbeast's own `Profession_1`-`_3` (F1/F2 per merged pet
  *family*, F3 per pet *archetype*) stay excluded from this generic per-spec resolver — none of
  them is a single fixed id, so `EXCLUDED_MECHANIC_SKILL_IDS`/`RANGER_BEASTMODE_EXCLUDED_SLOTS`
  still drop those 3 here — resolved separately instead by the dedicated `soulbeastBeastmodeBar`
  (see "Soulbeast's Beastmode F1-F3" below). `Profession_4` ("Eternal Bond") and `Profession_5`
  ("Beastmode", the actual merge-with-pet toggle button) are NOT excluded: resolved 2026-08-06 —
  despite its tooltip text describing pet-dependent behavior ("Meld with your other pet"), Eternal
  Bond is a single fixed id (59554, the *only* `Profession_4` candidate across all of Ranger's
  `professionSkills`), so the generic resolver's own single-candidate/spec-gating logic already
  picks it correctly with no per-pet data needed, same as F5. Also found and excluded "Worldly
  Impact" (`Profession_3`,
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

## Druid Glyph forms: swap-not-stack fact rendering (2026-08-04)

The Druid Glyph form-variant collapse (`glyph-form-variants.json`, see the Session addendum
above) was a picker fix only — it hid the 2 non-equippable "(non-celestial)"/"(Celestial Avatar)"
ids from the Heal/Utility/Elite pickers, but left their real facts unreachable: the canonical id a
player actually equips carries only a sparse, generic fact set (e.g. Glyph of Alignment's
canonical id 31322 has 3 facts vs. its celestial-form variant 31348's 5), and nothing stitched the
form-specific facts back onto its tooltip. Flagged as a real gap in TODO.md during the 2026-08-04
Damage sweep (Ranger/Elementalist Utility-slot legs).

Fixed by treating this the same way `vindicator-aspect.ts`'s Legendary Alliance aspect toggle
treats its own "whole kit swaps at once" shape — **a swap, not a stack** — rather than
`relatedVariantSkills`'s flip-chain stacking (used for genuine on/release pairs that are both live
simultaneously, e.g. a Revenant facet's on/release effect):

- `GlyphFormVariantMap`'s value shape changed from a bare canonical id (`number`) to `{
  canonicalId: number; form: 'normal' | 'celestial' }` — the fetch script already had this
  information (each child wiki page's title literally says which form it documents) but was
  discarding it. `scripts/fetch-glyph-forms.ts` now classifies each child title by its
  "(non-celestial)"/"(Celestial Avatar)" suffix and fails the whole group (logged, left
  unresolved) if a title matches neither — same fail-safe posture as every other check in that
  script. All 6 known groups still resolve cleanly on a live re-run.
- New `skill-calc/glyph-forms.ts`'s `glyphFormFactSourceSkill(skill, celestialAvatarActive,
  glyphFormVariants, skillsById)`: given a (possibly-canonical) skill and whether the build's
  Celestial Avatar toggle is on, returns the matching form-variant `Skill` to actually read facts
  from, or `null` if `skill` isn't a Glyph group's canonical id at all (every other skill in the
  game — fails open, same as before this existed).
- `SkillsEditor.tsx`'s `skillTooltipContent` calls it first; when it resolves, the *entire* tooltip
  (description, `skillFactLines` numeric lines, `boonConditionFactsForSkill` boon/condition lines)
  is sourced from the resolved variant instead of the canonical skill's own sparse facts — not just
  the curated Damage/Healing number, since the two forms are genuinely different underlying skills
  with different generic facts too (e.g. Glyph of Alignment's non-celestial form debilitates foes,
  its celestial form heals allies — completely different fact sets, not just different numbers on
  the same fact).
- The toggle read is `Build.activeBundleSkillId === CELESTIAL_AVATAR_SKILL_ID` — the exact field
  `WeaponSkillBar` already flips when the player clicks the Celestial Avatar F5 icon
  (`bundle-skills.ts`, now exported so `glyph-forms.ts`'s callers can compare against it directly
  rather than duplicating the constant).
- `SkillVariantContext` (`SkillsEditor.tsx`) gained `glyphFormVariants`/`celestialAvatarActive`
  fields; every call site that constructs one now passes them, even ones that can never render a
  Glyph (Revenant's Legend bar, the profession-mechanic F-bar, `PetsEditor`) — harmless there since
  `glyphFormFactSourceSkill` only ever matches an actual Glyph canonical id, verified by
  construction rather than assumed.
- Verified end-to-end via a throwaway script (not committed) resolving all 6 canonical ids against
  both toggle states — every one returns the correct normal/celestial variant id matching its own
  wiki-documented description, e.g. Glyph of Alignment's non-celestial variant (31607, "Inflict
  bleeding and debilitate nearby foes") vs. celestial variant (31348, "Heal and remove conditions
  from nearby allies") — and cross-checked against `CURATED_HEALING_COEFFICIENTS`'s 2
  already-curated celestial-form entries (31348 Glyph of Alignment, 31888 Glyph of Burgeoning,
  seeded 2026-08-02 before this gap was even known) to confirm they're reachable now, not still
  dead data.

**Not done as part of this fix**: the 6 non-celestial-form Damage coefficients this gap was
blocking (Glyph of the Tides/Alignment/Equality, flagged in `damage-calc.ts`'s Ranger Utility-slot
block comment) still need their own wiki-verification pass before landing in
`CURATED_DAMAGE_COEFFICIENTS` — this session only removed the architecture blocker, it didn't
re-run the curation sweep. Same for the picker/bar icon, which still always shows the canonical
id's own icon (matching the normal-form variant's icon in every case checked) rather than swapping
to the celestial-form variant's distinct icon while the toggle is on — a cosmetic gap, not a facts
gap, left as a documented known limitation.

## Session 90 (2026-08-06) — Closed out the last 4 "no resolving signal" duplicate-name groups

Picked up where the earlier wiki-page-membership pass (above) left Throw Mine/Mist Form/Protective
Solace/Jade Winds untouched. Re-investigated all 4 from scratch with fresh raw-wikitext and direct
`/v2/skills` pulls (not reused from the earlier pass) rather than assuming the prior "no signal"
conclusion still held — it didn't, for 2 of the 4:

- **Protective Solace (`26821`/`29310`) and Jade Winds (`28406`/`31294`) were never live picker
  bugs at all.** Both are Revenant skills, and `SkillsEditor.tsx`'s `RevenantSkillsEditor` builds
  its bar directly from `legends.json`'s fixed `heal`/`utilities`/`elite` ids — it never calls
  `skillsForProfessionAndSlot`/`visibleSkillsForSlot` — so a second same-name id can never actually
  surface as a picker duplicate for this profession, only in the standalone audit script's synthetic
  per-(profession, slot) sweep (the exact blind spot Session 88's Vindicator investigation already
  documented, just not cross-checked against these 2 groups at the time). `legends.json` references
  `26821` (Legend6) and `28406` (Legend2) — confirming those are the live ids and `29310`/`31294` are
  structurally-unreachable orphans, same shape as the Vindicator `62841`/`62793` pair. Checked both
  orphan ids against every curated coefficient table: Jade Winds' damage curation already keys both
  ids identically (`2.0`, harmless dead data for `31294`); Protective Solace isn't curated anywhere
  (no Damage/Healing/Barrier/boon entry references either id) — nothing to fix in either case.
- **Mist Form (`5554`/`15795`) is a real PvE/WvW/PvP recharge split** (wiki: `recharge = 30`,
  `recharge wvw = 60`, `recharge pvp = 75`), not 2 different skills — the earlier pass's "no
  distinguishing field" was true only in the narrow sense that the wiki's own `id=` field lists both
  together (it does, since `split = pve, wvw, pvp` skills always do). `5554` carries the PvE recharge
  (30) and a `traitedFacts` entry for Soothing Disruption's Stability grant (`requires_trait: 364`);
  `15795` carries the WvW/PvP recharge (60) but is missing that `traitedFacts` entry — a real API
  completeness gap on the secondary id, not a documented mechanical difference. Since `Recharge`
  facts are cosmetic-only in this app (`fact-numbers.ts`'s `factLine` never feeds any calc) while
  `traitedFacts` feeds real boon-calc totals, added `15795` to a new `INCOMPLETE_DATA_DUPLICATE_
  SKILL_IDS` constant in `skill-variants.ts` (same shape as `NON_EQUIPPABLE_SKILL_IDS`) so the
  picker always resolves to `5554` — trading a cosmetically-wrong PvE-mode recharge number for never
  silently losing the Stability contribution.
- **Throw Mine (`6161`/`30337`) is a genuine Gadgeteer-trait-gated pair**, confirming rather than
  overturning the earlier pass's conclusion — but this time backed by a real structural diff, not
  just the wiki's prose: a direct `/v2/skills?ids=6161,30337` pull shows `30337`'s `description`
  documents Gadgeteer's actual "a second mine is planted at your location" effect (`6161`'s doesn't),
  and the two ids' `flip_skill` targets differ (`6162` vs `29473` — the post-detonation skill must
  itself describe 1 vs. 2 mines). Resolving this needed the picker to know the build's actual chosen
  traits, which `visibleSkillsForSlot` never had access to — the architecture change the earlier pass
  flagged but didn't attempt. Turned out to be small: `StandardSkillsEditor` (`SkillsEditor.tsx`)
  already computes `activeIds` (`activeTraitIds(build, gameData.traits)`, a `Set<number>` of every
  currently-active major+minor trait id) for tooltip fact-gating — the exact value needed. Threaded
  it through as a new optional `chosenTraitIds` parameter: `skillsForProfessionAndSlot` ->
  `visibleSkillsForSlot` -> `resolveGroup`, defaulting to an empty set everywhere else (harmless for
  every other call site, including both standalone scripts, which now correctly resolve Throw Mine
  to its base id `6161` under the "nothing equipped" baseline every other group is evaluated
  against). New `GADGETEER_GATED_SKILL_IDS`/`GADGETEER_TRAIT_ID` constants in `skill-variants.ts`
  resolve to `30337` when trait `1679` (Gadgeteer, specialization 21/Explosives) is active, `6161`
  otherwise.

All 4 groups from the TODO.md bullet are now resolved; the bullet itself was removed.
`npm run typecheck`/`npm run lint` clean. Not visually spot-checked in the running app (Electron
sandbox limitation) — verify live that equipping Gadgeteer swaps the Throw Mine picker entry to
`30337`.

## Wiki-verification audit trail (`skill-coefficient-verification.json`, `target-count-verification.json`, `balance-patch-verification.json`)

Files that look like every other entry in "Output files" above but aren't: they are **not**
read by the app at runtime, and never will be by design. Every other file in `data/game-data/`
exists so the app can compute something from it; these exist so a *future dev session* has
somewhere to look instead of re-running a script and re-reading a console dump.

`skill-coefficient-verification.json`/`target-count-verification.json` are written by
`scripts/fetch-skill-coefficients.ts`/`scripts/fetch-target-counts.ts` (`npm run
fetch-skill-coefficients` / `npm run fetch-target-counts`), via the shared writer in
`scripts/lib/wiki-verification.ts`. Each run re-derives every value in a hand-curated table
(`CURATED_DAMAGE_COEFFICIENTS` in `src/shared/skill-calc/damage-calc.ts`, or
`TARGET_COUNT_OVERRIDES` in `src/shared/boon-calc/sources.ts`) from live wiki wikitext (the
skill/trait's own current page) and diffs it against the curated value. Shape: one record per
curated value checked (a damage-coefficient candidate with 2 factText entries produces 2 records,
not 1), each carrying an outcome bucket (`match`, `mismatch`, `missing`, `skip`,
`unresolved-collision`, ...), the curated vs. wiki-derived value, and the wiki page title +
MediaWiki revision id it was checked against.

`balance-patch-verification.json` is written by `scripts/fetch-balance-patch-changes.ts` (`npm run
fetch-balance-patch-changes`) — TODO.md's wiki-extraction pipeline step 4, "Curation-side change
detection." Different source and different question than the two files above: instead of asking
"does the curated value agree with the wiki *today*," it walks the wiki's own dated
`Category:Balance updates` patch-note history (59 pages, 2022-present) and asks "does the curated
value already reflect the most recent patch that touched it" — giving a `stale` bucket (curated
value is still the pre-patch number) distinct from an undifferentiated `mismatch`. Only covers the
3 coefficient-shaped tables (`CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS`/
`CURATED_BARRIER_COEFFICIENTS`) via the patch notes' `"<field> from A to B"` prose — target-count/
Condition-Cleanse's own curated tables use the same "from A to B" shape on the wiki but aren't
wired up yet, same scripting effort would apply. See the script's own module doc comment for the
full method (mode-relevance filtering, per-hit vs. totaled-value handling, and cross-corroboration
against `skill-coefficient-verification.json` to catch a patch superseded by a later one outside
the Balance-updates category) and its documented limitation (prose-only reworks with no "from A to
B" phrasing produce no signal — still needs a periodic human read).

**The hand-curated tables remain the sole source of truth the running app computes from.** These
files change no app behavior — they exist purely as a queue: a `mismatch`/`stale` entry means "a
human should look," not an auto-applied fix.
