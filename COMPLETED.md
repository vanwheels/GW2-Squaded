# Completed

Entries are added as work lands, most recent first.

### [Local Browser Storage Adapter] — Leg 1
2026-10-08. New `src/shared/storage/indexeddb-adapter.ts`: `createIndexedDbStorage()` implements
`StorageAdapter` (`builds`/`squadComps`) purely with IndexedDB — one database, one object store per
collection keyed by `id`, `list()` sorted by `updatedAt` descending in-memory to match
`JsonBlobRepository`'s `ORDER BY updated_at DESC`. Tested via `fake-indexeddb` since Node has no
native IndexedDB. No sync/tombstones yet — same local-only scope as the existing SQLite adapter.
See commit `<pending>`. Everything through the "Known Exceptions
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
