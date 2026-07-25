# Completed

Entries are added as work lands, most recent first.

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
