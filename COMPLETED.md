# Completed

Entries are added as work lands, most recent first.

### [Crypto + Merge Port] — Leg 1
2026-10-08. Ported ChoiceBuds' `worker/src/crypto.ts` and `merge.ts` into GW2-Squaded's
`gw2-squaded-share` Worker unchanged, except `merge.ts`'s `updatedAt: number` → `Timestamp` (ISO
8601 string). Added vitest to `worker/package.json`; 28 ported/adapted tests pass. Pure functions
only, not yet wired into `index.ts` (Leg 2). See commit `a52bd9d`.

### Web App Port milestone — 2026-10-08
Shipped. Post-mortem: `docs/postmortems/web-app-port.md`.

### [Deploy to gw2squaded.vannyproductions.com] — Leg 4
2026-10-08. First attempt (Worker-hosted, Cloudflare Custom Domain) reverted after discovering
`vannyproductions.com`'s zone is on IONOS, not Cloudflare — same constraint ChoiceBuds already hit
for `choicebuds.vannyproductions.com`. Switched to GitHub Pages: `.github/workflows/deploy-web.yml`,
Pages enabled via `gh api` with custom domain `gw2squaded.vannyproductions.com`, Vanny added the
CNAME record at IONOS, cert issued and HTTPS enforced. Live. See commits `e67afd0` (first attempt +
incident fix) and `c81472b` (revert + GitHub Pages pivot).

### [Browser End-to-End Verification] — Leg 3
2026-10-08. Manually exercised the full interactive app via `npm run dev:web`: build editor,
trait/equipment pickers, stats/boon-condition panel, gear optimizer, squad builder drag-and-drop,
tags/search/favorites. User confirmed everything works outside Electron with no fixes needed. No
code changes, no commit.

### [Web Entry Point + AppWeb Shell] — Leg 2
2026-10-08. New `web/` directory (sibling to `electron.vite.config.ts`) with its own
`index.html`/`main.tsx`/`vite.config.ts`, aliasing `@shared`/`@renderer` the way
`vite.web-preview.config.ts` does. New `src/renderer/AppWeb.tsx`, sibling to `App.tsx`, mounts the
same provider tree minus the Electron-only offscreen-capture branch, passing
`webGameDataProvider` (`src/web-preview/load-game-data-web.ts`) straight into
`GameDataStoreProvider` instead of reading `window.gw2GameData`. `web/main.tsx` wires
`window.gw2Storage` to `createIndexedDbStorage()` (Leg 1) and assigns no-op
`gw2Capture`/`gw2Updater`/`gw2DataUpdate` implementations so `NavBar`/`SettingsView`/
`ReleaseNotesProvider` (which read those globals unconditionally at mount) don't crash — none of
those three have a browser equivalent yet. `web/vite.config.ts` adds a small dev/build plugin that
serves `data/game-data/*.json` under `/game-data/*.json` directly from the committed source
directory (no staged copy, unlike the web-preview build) since that build has no fixed deploy
target yet. Verified via `npm run dev:web` (index/game-data/icons all serve correctly);
`npm run typecheck`/`lint`/`test` all pass. See commit `8124ff8`.

### [Local Browser Storage Adapter] — Leg 1
2026-10-08. New `src/shared/storage/indexeddb-adapter.ts`: `createIndexedDbStorage()` implements
`StorageAdapter` (`builds`/`squadComps`) purely with IndexedDB — one database, one object store per
collection keyed by `id`, `list()` sorted by `updatedAt` descending in-memory to match
`JsonBlobRepository`'s `ORDER BY updated_at DESC`. Tested via `fake-indexeddb` since Node has no
native IndexedDB. No sync/tombstones yet — same local-only scope as the existing SQLite adapter.
See commit `544af13`. Everything through the "Known Exceptions
Sweep" milestone (shipped 2026-09-29) is archived in `COMPLETED-archive-known-exceptions-sweep.md`.
Everything through the "Sep 15, 2026 patch + fixes" milestone (shipped 2026-09-16) is archived in
`COMPLETED-archive-sep-15-2026-patch.md`. Everything before that, back through v1.0.0, is in
`COMPLETED-archive-pre-1.0.md`.

### v1.6.0 release — 2026-09-29
Covers everything since the v1.5.0 release (2026-09-20): the Sep 29, 2026 patch's curated
coefficient edits, the full Known Exceptions Sweep, and the Auto-Update Check milestone below. See
commit `bc25058`.

### [Auto-Update Check: Launch Check + Nav Badge] — Leg 1
2026-09-29. Mirrored the game-data auto-updater's launch-check + nav-badge pattern for the
app-binary updater: `registerUpdaterIpc` now returns a `runAutoCheck` fired alongside the game-data
one on `ready-to-show`, a new `UpdaterStoreProvider`/`useUpdater` context shares status between
`SettingsView` and `NavBar` instead of Settings owning it alone, and the Settings nav badge now
lights up for either an available game-data update or an available/downloaded app update. See
commit `389c745`.
