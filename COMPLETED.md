# Completed

Entries are added as work lands, most recent first.

## Session 4 — Elite-spec skill gating, equipment dedup, and wiki-extraction research

- **Elite-spec skill gating** (the build editor previously showed every Heal/Utility/Elite skill
  for a profession regardless of which elite spec, if any, was equipped — e.g. Guardian's
  Luminary-only "Resolute Stance" was selectable with no elite spec chosen at all). Root cause:
  confirmed via direct API inspection that `/v2/skills` has no `specialization` field, and
  `/v2/professions/:id`'s `training` array only groups core skill categories. Fixed by sourcing
  the mapping from the wiki instead: `scripts/fetch-elite-spec-skills.ts` (new, run via
  `npm run fetch-elite-spec-skills`) pulls all 36 elite specs' `Category:<Name> skills` wiki
  pages via the MediaWiki API (`generator=categorymembers&prop=categories`, paginated), filters
  to pages tagged `Category:Healing/Utility/Elite skills`, and matches page titles against
  `skills.json` by (profession, slot, name) — with a quote-stripping fallback for shout-skill
  title mismatches (wiki drops the surrounding `"..."` GW2 keeps in the API name). Output:
  `data/game-data/elite-spec-skills.json`, a flat `{ skillId: specializationId }` map, 211
  entries resolved cleanly this run (16 unmatched, 36 ambiguous — both excluded rather than
  guessed, see docs/game-data.md for the full breakdown). Wired into `GameData`/`loadGameData`/
  `game-data-store.tsx`'s `skillsForProfessionAndSlot` (now takes the build's equipped
  specialization ids and filters out gated skills the build doesn't have), `SkillsEditor`, and
  `BuildEditorView` (which also now clears any skill selection invalidated by a specialization
  line change, e.g. dropping Luminary while "Resolute Stance" is the heal skill).
  - Real bug hit while writing the fetch script: the wiki's API returns HTTP 403 for Node's
    default `fetch` User-Agent (confirmed: `curl` with its default UA passes, bare Node `fetch`
    doesn't) — fixed by setting an explicit descriptive `User-Agent` header.
  - Verified the resulting map against the target party comp from TODO.md: all 5 Luminary-line
    skills (Resolute Stance, Effulgent Stance, Piercing Stance, Valorous Stance, Stalwart Stance)
    resolved correctly to the Luminary specialization id.
- **Equipment picker duplicate stat-name entries** (screenshot from the user showed "Apothecary's"
  listed 4 times, "Berserker's" 5 times, etc. in the Leggings dropdown with no way to tell them
  apart). Root cause: `data/game-data/itemstats.json` has 43 stat-combo names with multiple
  numeric ids each — legacy pre-revamp combos, trinket-only (value-only) variants, and the modern
  armor/weapon (multiplier+value) combo all share a display name. Fixed with a dedup heuristic in
  `EquipmentEditor.tsx`: per name, prefer the entry with the most attributes, then the one where
  every attribute has both a nonzero multiplier and value (the fully-specified modern combo),
  tie-broken by lowest id. Verified in Python against all 43 duplicate-name groups before porting
  to TypeScript (the TS scoring function was checked to produce identical picks to the reference
  implementation for every group). This is a display-only fix — it doesn't yet resolve which
  itemstat id is *correct per equipment slot type* for real stat-scaling math (still open, see
  TODO.md); nothing consumes itemstat attribute values yet, so this was safe to ship now.
- **Wiki-extraction research** (user asked directly: "can we get WvW-split and gear-scaling data
  from the wiki?" — prior session had only confirmed these were *missing* from the raw API,
  not investigated wiki feasibility). Two real research passes against live wiki pages, not
  assumptions:
  - Gear-scaling formula **is** documented: `wiki.guildwars2.com/wiki/API:2/itemstats` states
    `attribute_adjustment * multiplier + value` = attribute points, with a reference table of
    `attribute_adjustment` constants by level/rarity/slot-type. This overturns last session's
    finding that the multiplier→major/minor mapping was needed — that was based on the wiki's
    *pre-computed final totals* table, not the general per-item formula, which turns out to be
    much simpler. Still open: which itemstat id to pick for a given equipment slot when a name
    has duplicates (undocumented — only a talk-page comment, unverified).
  - WvW/PvE split values **are** extractable, just not via one bulk query: the wiki has no Cargo
    extension (404 on `Special:CargoTables`) and Semantic MediaWiki doesn't index the `game
    mode=` skill-fact template parameter (a live `Special:Ask` query for it returned nothing).
    But `Category:Split_skills` (1,664 pages) and `Category:Split_traits` (545 pages) are real
    maintained lists, and each page's raw wikitext has cleanly parseable `{{skill fact|...|game
    mode=pve/wvw pvp}}` template calls — confirmed directly against `Restoring_Reprieve`'s raw
    wikitext, matching the known in-game PvE-vs-WvW difference exactly. Feasible per-page for the
    bounded set of skills/traits a specific build/party comp uses; not built yet.
  - Elite-spec-to-skill mapping (the gating feature above) was confirmed feasible the same way
    before it was built — findings folded directly into the shipped fetch script rather than
    left as a separate note.
- Fixed a stale doc comment in `docs/game-data.md` claiming `facts`/`traitedFacts` are still
  `unknown[]` — they were typed as `Fact[]` last session; the doc just hadn't been updated.

## Session 3 — Boon/condition source parser (first slice of the uptime calculator)

- Typed the GW2 API's `Fact` object (`src/shared/types/game-data.ts`): `Skill.facts`/
  `traitedFacts` and `Trait.facts`/`traitedFacts` were `unknown[]`, now `Fact[]` with the fields
  the calculator needs (`type`, `status`, `duration`, `apply_count`, `requires_trait`) plus an
  index signature so the rest of each raw fact still round-trips untyped.
- `src/shared/boon-calc/`: `constants.ts` has the fixed boon/condition name lists (`BOON_NAMES`,
  `CONDITION_NAMES`); `sources.ts` has `computeBoonConditionSources(build, gameData)`, which walks
  a build's equipped heal/utility/elite skills, auto-granted minor traits on each equipped
  specialization line, and chosen major traits, extracting every `type: 'Buff'` fact whose
  `status` matches a known boon/condition name. Facts gated by `requires_trait` (on skills or
  traits) are only included if that trait is actually active for the build — computed via
  `activeTraitIds` (minors of equipped lines + all chosen majors).
- `BoonUptimePanel` (`src/renderer/components/build-editor/BoonUptimePanel.tsx`) now renders this
  for real: sources grouped by boon/condition name, each with its source skill/trait name and
  base duration. Explicitly labeled as base (unscaled) durations, with a visible caveat that gear/
  food scaling isn't applied yet and that the public API doesn't reliably distinguish WvW from
  PvE balance (see below).
- Verified via a scripted Electron launch (not committed) against the actual `npm run build`
  output: selected Guardian's "Purification" heal skill (grants Regeneration 10s + Blinded 6s)
  and confirmed the panel grouped/displayed both correctly; then, as a `requires_trait` gating
  test, equipped the Luminary line, picked "Resolute Stance" as the heal skill (grants Protection
  3s only via a traitedFact gated on the Luminary tier-1 trait "Shimmering Stances"), confirmed
  Protection was absent before that trait was chosen and present with the correct source after.
  No console/page errors in either run.
- Bug found and fixed during that verification: `loadGameData()` (`src/main/game-data/
  load-game-data.ts`) resolved `data/game-data/` relative to `app.getAppPath()`, which only
  happens to equal the project root under `electron-vite dev`. Running the actual built output
  (`out/main/index.cjs`) resolves it to `out/main` instead, so every game-data IPC call threw
  ENOENT and every selector in the editor silently rendered empty. Fixed by resolving the data
  directory from `__dirname` (stable at `out/main` in both dev and build output) instead.

### Investigated and confirmed this session (informs what's still open in TODO.md)

- The GW2 API does **not** reliably expose WvW-specific balance numbers separately from PvE —
  confirmed via GW2 forum reports (`/v2/skills` returns all facts for a skill with no game-mode
  indicator, even when the skill behaves differently per mode) and the wiki's own `game_mode`/
  `split` template fields, which are a human wiki-authoring convention, not an API-exposed field.
  So today's parser surfaces whatever the API returns, which may be PvE-biased or ambiguous for
  specific skills — the UI says so rather than implying WvW accuracy it can't back up.
- Gear-based boon/condition duration scaling was investigated but deliberately NOT implemented:
  the API's itemstat `multiplier`/`value` pairs need a major-vs-minor-attribute categorization per
  stat-combo type (2/3/4-stat combos use different multiplier constants) to resolve into an
  actual attribute value, and I couldn't verify that mapping confidently against the wiki this
  session. Shipping a number that looks precise but is quietly wrong would be worse than not
  computing it — deferred with the specific blocker written down in TODO.md rather than guessed.

## Session 2 — Build editor UI

- Game-data IPC bridge: main process reads `data/game-data/*.json` once (`src/main/game-data/load-game-data.ts`,
  cached in memory) and exposes it to the renderer via `window.gw2GameData.getAll()`
  (`src/main/ipc/game-data-ipc.ts`, `src/preload/index.ts`), mirroring the existing
  `window.gw2Storage` seam. `GameDataStoreProvider`/`useGameData` (`src/renderer/state/game-data-store.tsx`)
  loads it once and exposes lookup maps/selectors (specializations by profession, major/minor
  traits by specialization, skills by profession+slot).
- Build editor UI (`src/renderer/components/build-editor/`): `ProfessionSelect`, `TraitsEditor`
  (3 specialization lines, enforces at most one elite spec equipped and no duplicate lines,
  3-tier major trait radio picker per line, minor traits shown read-only), `SkillsEditor`
  (heal/utility×3/elite, filtered by profession + GW2 API `slot` field, prevents picking the
  same utility skill in two slots), `EquipmentEditor` (16 gear slots × itemstat picker), and a
  `BoonUptimePanel` stub documenting the planned calculator shape (per-boon source list with
  computed duration) without implementing it yet.
- `BuildEditorView` orchestrates all of the above with local draft state; changing profession
  resets specializations/skills (they don't carry over between professions). Wired into
  `BuildsView` — clicking a build (or "+ New build") opens the editor; Save round-trips through
  `builds-store`'s new `createBuild`/`updateBuild` (replacing the old single-purpose
  `createDummyBuild`).
- Data quality fix: 13 of 191 itemstat entries from the live API have an empty `name` string
  (deprecated/internal stat combos) — filtered out of the equipment picker rather than shown as
  blank options.
- Verified end-to-end via a scripted Playwright/Electron launch (not committed): create a build,
  pick a profession/specialization/trait tier/skill/equipment stat, save, confirm it appears in
  the list, reopen it, and confirm every selection persisted through SQLite. No console/page
  errors during the run.

### Scoping notes carried into TODO.md

- Confirmed with the user: boon/condition calculator should mirror gw2skills.net for a single
  build (list every source + computed duration from boon duration/concentration/consumables),
  with a later squad-view mode showing all 5 party sources per boon. Needs a real GW2 API
  `Fact`-parsing layer (not hand-written rules) and WvW-specific balance numbers (not PvE) —
  both still open. Target first-pass party comp and full detail captured in TODO.md.

## Session 1 — Scaffolding & data-layer groundwork

- Project scaffold: Electron + React + TypeScript via `electron-vite`, with `src/main`
  (Electron main process), `src/preload` (contextBridge IPC surface), `src/renderer` (React
  app, no Electron APIs), and `src/shared` (types + storage interface usable from anywhere).
  ESLint (flat config) + strict TypeScript (`npm run typecheck`) wired up. `npm run dev`
  launches the Electron shell with the React app inside it.
- GW2 static game data pipeline: `scripts/fetch-game-data.ts` (run via
  `npm run fetch-game-data`) pulls professions, specializations, traits, skills, and itemstats
  from the public GW2 API v2, batches bulk `ids=` requests (200/batch) with retry/backoff, and
  writes normalized JSON to `data/game-data/`. Verified against the live API: 9 professions, 81
  specializations, 999 traits, 4702 skills, 191 itemstats. Documented in `docs/game-data.md`.
- Core data model: `Build`, `SquadComp`, and static game data types (`Profession`,
  `Specialization`, `Trait`, `Skill`, `ItemStat`) defined in `src/shared/types/`.
- Local storage layer: SQLite (via `better-sqlite3`, N-API-based for ABI stability across
  Node/Electron versions) behind a `StorageAdapter`/`Repository<T>` interface in
  `src/shared/storage/`. Builds/squad comps are stored as JSON blobs keyed by id (avoids a
  premature relational schema for still-evolving nested shapes). Renderer never touches SQLite
  directly — it goes through a preload-exposed `window.gw2Storage` bridge over IPC, which is
  the seam a future Capacitor storage plugin will implement instead.
- Minimal UI shell: Builds/Squads nav, with a working create → save (SQLite) → list → persist
  across restart round trip on the Builds view (Squads view is a placeholder).
- Verified end-to-end via a scripted Playwright/Electron launch (not committed — one-off
  verification): app window opens, "Create dummy build" persists through SQLite, and the build
  is still present after a full app restart.

### Bugs hit and fixed during setup (worth remembering)

- Electron's main process has known ESM named-export interop issues with the native `electron`
  module (`import { BrowserWindow } from 'electron'` throws "does not provide an export named
  ..." under Node ESM, including inside `@electron-toolkit/utils`). Fixed by forcing CJS output
  (`.cjs` extension) for the main/preload bundles in `electron.vite.config.ts`, regardless of
  the root `package.json`'s `"type": "module"`.
- `better-sqlite3`'s native binding is compiled against a specific Node/V8 ABI. The version
  installed by default (11.x) doesn't compile against Electron 43's newer V8 API at all, and
  even when it does compile, an ABI built for the system Node ≠ the ABI Electron bundles
  internally — a silent crash (unhandled promise rejection) on `new Database()` at startup with
  no visible window. Fixed by upgrading to `better-sqlite3@^13` (N-API, ABI-stable across
  Node/Electron versions) and wiring `electron-builder install-app-deps` as a `postinstall`
  script so native deps are always rebuilt/reprovisioned for Electron's ABI after `npm install`.
