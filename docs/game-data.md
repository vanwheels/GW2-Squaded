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
needed yet — and their `facts` / `traited_facts` arrays are a large polymorphic union used to
describe skill/trait effects (damage, boons applied, durations, etc.) that only matters once
the boon/condition calculator is built. Raw shapes are typed loosely and locally inside
`scripts/fetch-game-data.ts` (see the `Raw*` interfaces) and are never exposed outside that
file. The normalized, app-facing types the rest of the app depends on live in
`src/shared/types/game-data.ts`; `facts`/`traitedFacts` are preserved as `unknown[]` there so
the data isn't lost, and can be typed precisely when the calculator work starts.

## Output files

Written to `data/game-data/`, committed to the repo so a fresh clone has working data without
needing to run the fetch script immediately:

- `professions.json`
- `specializations.json`
- `traits.json`
- `skills.json`
- `itemstats.json`
- `meta.json` — just `{ fetchedAt }`, so the app/UI can eventually surface "game data last
  updated on ..." somewhere.
