# Post-mortem: Auto-Update Check

Scoped 2026-09-29, shipped 2026-09-29 (single leg, single commit).

## What shipped

- **Launch-time app-binary update check**: `registerUpdaterIpc` (`src/main/updater/auto-updater.ts`)
  now returns a `runAutoCheck` the same shape as the game-data updater's, fired alongside it on
  `mainWindow`'s `ready-to-show` in `src/main/index.ts`. Previously the app-binary check only ran
  when the user opened Settings and clicked the button.
- **Shared updater status context**: new `UpdaterStoreProvider`/`useUpdater`
  (`src/renderer/state/updater-store.tsx`), mirroring the existing `DataUpdateStoreProvider`,
  mounted in `App.tsx`. `SettingsView`'s update panel now reads from it instead of owning its own
  local `useState`/`useEffect` subscription to `window.gw2Updater`.
- **Nav badge for app updates**: `NavBar.tsx`'s Settings-tab badge now lights up for either an
  available game-data update (existing) or an available/downloaded app update (new), with the
  title text favoring the app update as the more actionable of the two when both are true.

## What went well

- The whole leg was a direct mirror of an existing, already-decided pattern (the game-data
  updater), so there was no design ambiguity to resolve — implementation, typecheck, and lint all
  passed on the first pass.

## Friction / what didn't go as smoothly

- None worth noting — small, well-precedented leg.

## Scope creep observed

None. The milestone's own TODO.md scoping named exactly these three changes (main-process check,
shared renderer context, nav badge) and nothing more was touched.

## What changes for the next milestone

Nothing specific — this was a clean, precedent-driven leg with no process friction to carry
forward.
