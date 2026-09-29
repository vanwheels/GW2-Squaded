# Completed

Entries are added as work lands, most recent first. Everything through the "Known Exceptions
Sweep" milestone (shipped 2026-09-29) is archived in `COMPLETED-archive-known-exceptions-sweep.md`.
Everything through the "Sep 15, 2026 patch + fixes" milestone (shipped 2026-09-16) is archived in
`COMPLETED-archive-sep-15-2026-patch.md`. Everything before that, back through v1.0.0, is in
`COMPLETED-archive-pre-1.0.md`.

### [Auto-Update Check: Launch Check + Nav Badge] — Leg 1
2026-09-29. Mirrored the game-data auto-updater's launch-check + nav-badge pattern for the
app-binary updater: `registerUpdaterIpc` now returns a `runAutoCheck` fired alongside the game-data
one on `ready-to-show`, a new `UpdaterStoreProvider`/`useUpdater` context shares status between
`SettingsView` and `NavBar` instead of Settings owning it alone, and the Settings nav badge now
lights up for either an available game-data update or an available/downloaded app update. See
commit `389c745`.
