# Completed

Entries are added as work lands, most recent first.

### [Build Editor Mobile Tabs] — Leg 1
2026-10-08/09. Added a Traits/Equipment/Skills & Stats tab control to `BuildScreenshotGrid.tsx`
(local `mobileTab` state) plus a `max-width: 480px` tier in `global.css` that shows one section at
a time full-width; a no-op above that width. Manually verified live on a real phone (Safari,
`gw2squaded.vannyproductions.com`) across several rounds of fixes, not just the initial commit:
`.view-header` and `.gear-copy-paste-bar` needed `flex-wrap` (their items' default
`min-width: auto` was forcing real overflow, which was tripping Mobile Safari's whole-page
zoom-to-fit fallback); the equipment text manifest's 4-column grid got a 2-column phone tier;
`.ingame-skill-bar`'s utility column (Heal/Utility/Elite) needed its own phone-tier reflow since
CSS Grid tracks don't shrink/wrap like flex; and the stats grid swapped a contained scrollbar for
an actual 2-column reflow (hiding its spacer element lets the existing label/value DOM order
auto-place correctly) per user preference. Also hit the same source-order cascade trap 3 times —
a base rule using `display: none`/other properties declared *after* a `@media` override beats
that override at tied specificity — now flagged in comments at each fix site so it doesn't ship a
4th time. See commits `2dca58a`, `c054c49`, `78c72e6`, `550eb9e`, `95f7be9`, `6f300a6`, `4ddbf66`.

### [Cross-Device Verification Pass] — Leg 5
2026-10-09. Manually verified concurrent edit/reorder/delete/edit-after-delete-resurrection across
two real sessions (desktop + browser tab, same account). First attempt surfaced a real bug, not a
test failure: signing up under an existing ChoiceBuds username returned `username_taken` because
`worker/wrangler.toml`'s `SYNC_KV` binding pointed at ChoiceBuds' own already-existing KV namespace
instead of a fresh one (see fix below). After the fix, user confirmed cross-device sync works.
Closes out the Continuous Cross-Device Sync milestone. See commit `5599691` and
`docs/postmortems/continuous-cross-device-sync.md`.

### [Fix: GW2-Squaded's SYNC_KV namespace was ChoiceBuds']
2026-10-09. The "Account Routes + KV Namespace" leg (Sync Backend Foundation, 2026-10-08) wired in
ChoiceBuds' real, already-existing `SYNC_KV` namespace instead of provisioning a new one — accounts
and tokens for both apps lived in the same KV store, so a ChoiceBuds-issued bearer token for a
username also passed this Worker's own token check for that username's `/sync/:username` route (a
real auth-boundary failure, not just a username collision). Provisioned a fresh,
GW2-Squaded-only namespace and repointed the binding; ChoiceBuds' namespace/accounts untouched. See
commit `5599691`.

### [Sign-In UI in Settings] — Leg 4
2026-10-08. Added `SyncSection` (`components/common/SyncSection.tsx`) to `SettingsView.tsx` — sign
up/log in/log out, status, manual "Sync Now", and last-synced time, driven by Leg 3's
`useSyncStore()` with no new plumbing. Mirrors ChoiceBuds' `SyncSection.tsx` form shape but uses
this project's plain-CSS conventions (new `.sync-forms`/`.sync-form`/`.sync-signed-in`/
`.sync-status-ok` classes in `global.css`, plus `input[type='password']` styling) instead of
Tailwind. One implementation covers both desktop and web since Settings is already a shared view.
See commit `3cd161d`.

### [useSync Hook + Trigger Wiring] — Leg 3
2026-10-08. Added `src/renderer/hooks/useSync.ts` (mount/sign-in, browser `online`, ~5min fallback
poll, ~5s debounce-on-mutation, ported from ChoiceBuds) and a `SyncStoreProvider`/`useSyncStore()`
context (`state/sync-store.tsx`) so the one required hook instance lives above both `App.tsx` and
`AppWeb.tsx` and Leg 4's Settings UI can read/drive it without re-plumbing. Sync credentials joined
`app-settings-store.tsx`'s existing settings rather than a new store. Also added jsdom +
`@testing-library/react` as dev dependencies — the project's first stateful-hook test. See commit
`567e30b`.

### [Sync API Client + Bulk-Replace Store Methods] — Leg 2
2026-10-08. Added `src/renderer/services/syncApi.ts` (signup/login/push/pull, ported from
ChoiceBuds' client, reusing `share-client.ts`'s `apiBaseUrl()` since it's the same Worker
deployment) and a `replaceAll(records, tombstones)` method on `Repository<T>`, implemented in
both storage backends and wired through Electron's IPC bridge. `builds-store.tsx`/
`squad-comps-store.tsx` each gained `applySyncedState`, the one-shot swap Leg 3's `useSync` hook
will call with the Worker's merged response. See commit `bf8d5fb`.

### [Tombstone Tracking in Storage Layers] — Leg 1
2026-10-08. Added `{id, deletedAt}` tombstone retention to both local storage layers — new
`<table>_tombstones` SQLite tables (`schema.ts`/`json-blob-repository.ts`) and `<store>_tombstones`
IndexedDB object stores (`indexeddb-adapter.ts`, `DB_VERSION` bumped to 2) — so `remove(id)` no
longer just deletes the row. `Repository` gained `listTombstones()`/`clearTombstones(ids)`, wired
through the Electron IPC bridge and preload to keep `StorageAdapter` satisfied by both backends.
Shape matches the Worker's `SyncTombstone` exactly, so Leg 2's sync client needs no translation at
the API boundary. See commit `7179180`.

### [Sync Routes + R2 Bucket] — Leg 3
2026-10-08. Created the `gw2-squaded-sync` R2 bucket (`SYNC_R2` binding) for the per-account sync
blob and added `PUT|GET /sync/:username` to `index.ts`, ported from ChoiceBuds'
`handleSyncGet`/`handleSyncPut` — bearer-token auth, per-account write throttle via R2
`customMetadata`, merge via Leg 1's `mergeCollection`. No legacy-KV-blob fallback (new feature, not
a migration). Manual round-trip test against local `wrangler dev`: signup → push a payload (build
A, build B) → push an overlapping payload (build A edited, build B tombstoned, build C added) →
GET confirmed the merged result. This closes out the Sync Backend Foundation milestone. See commit
`6b9dd64`.

### [Account Routes + KV Namespace] — Leg 2
2026-10-08. Wired the already-existing `SYNC_KV` namespace into `wrangler.toml`/`Env`, defined
`SyncPayload` (`builds`/`buildTombstones`/`squadComps`/`squadCompTombstones`, `savedAt`) in a new
`worker/src/sync-types.ts`, and added `POST /signup`/`POST /login` to `index.ts`, ported from
ChoiceBuds' `handleSignup`/`handleLogin` — same key scheme, same limits. Dropped ChoiceBuds'
optional `email` signup field (not needed here). See commit `72d7ac2`.

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
