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
- `elite-spec-skills.json` — see below; sourced from the wiki, not `fetch-game-data.ts`
- `wvw-fact-overrides.json` — see below; sourced from the wiki, not `fetch-game-data.ts`
- `meta.json` — just `{ fetchedAt }`, so the app/UI can eventually surface "game data last
  updated on ..." somewhere.

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
