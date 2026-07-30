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
- `elite-spec-skills.json` — see below; sourced from the wiki, not `fetch-game-data.ts`
- `wvw-fact-overrides.json` — see below; sourced from the wiki, not `fetch-game-data.ts`
- `runes.json` / `sigils.json` / `infusions.json` / `relics.json` / `food.json` / `utility.json`
  — see below; sourced from `/v2/items` by `scripts/fetch-gear-upgrades.ts`, not
  `fetch-game-data.ts`
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

**Known gaps (documented, not silently papered over):** as of the last run, 211 skills matched
cleanly; ~16 wiki pages didn't match any `skills.json` entry (mostly Druid Celestial-Avatar-form
variants and a couple of gadget "backfired" flavor pages — not real playable skill options), and
~36 page titles matched *multiple* skill ids ambiguously (e.g. Revenant legend skills, Weaver
dual-attunement skills — GW2 often has two skill ids sharing one display name for a display/
tooltip-copy reason that isn't worth guessing at). Both cases are simply **excluded** from the
map rather than guessed — a skill missing from the map is treated as ungated (shown regardless of
equipped spec), which is a fail-safe default equal to the pre-existing (ungated) behavior, never
a wrong exclusion. Requires the wiki API's default `User-Agent` header to be overridden (Node's
default UA gets a 403; any identifiable UA passes — see `USER_AGENT` in the script).

**Note:** this file's data is NOT re-derivable from `fetch-game-data.ts` — re-run
`fetch-elite-spec-skills` too whenever a balance patch might add/change elite-spec-gated skills.

## Duplicate-name skill collapsing (`skills.json`'s `attunement`/`specializationId` fields)

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

**The remaining ~47 groups** (re-counted per-profession after the above collapsing; see
`TODO.md`) have no `attunement`/`specialization`/`GroundTargeted` signal distinguishing their
members — e.g. Engineer's "Deploy Mine" (`6163` "deploy a mine" vs `30893` "deploy two mines",
almost certainly a trait rework with no `specialization` id set) or Ranger's "Spike Trap" (differs
in whether it stuns or launches). These look like the same shape of problem `wvw-fact-overrides`
solved for boon durations — a per-skill wiki cross-check to find the actual gating trait — but
that's a new, separate research pass, not attempted here. Left un-collapsed and shown as-is
(fail-safe, not guessed) rather than arbitrarily picking one id and hiding a possibly-meaningful
choice from the user.

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
  numeric value exposed for that example). There is currently no way to derive an exact numeric
  modifier for most relics from this endpoint — `description` is stored as-is for display, not
  parsed. Getting exact relic values would need a per-relic wiki cross-check (~211 pages), same
  shape of effort as `fetch-wvw-splits.ts`; not done in this pass.
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
