# GW2-Squaded

A Guild Wars 2 WvW tool for building theoretical stat builds (similar to
[gw2skills.net](https://en.gw2skills.net/)), assembling squad compositions, and (eventually)
calculating theoretical boon/condition uptime.

Offline-first desktop app built with Electron + React + TypeScript, with static GW2 game data
(professions, specializations, traits, skills, itemstats) cached locally from the public
Guild Wars 2 API. Local saves (builds, squad comps) are stored in SQLite.

This project is not affiliated with or endorsed by ArenaNet or NCSOFT. Guild Wars 2 game data
is used under [ArenaNet's Content Terms of Use](https://www.guildwars2.com/en/legal/guild-wars-2-content-terms-of-use/).

## Status

Early scaffolding — see [TODO.md](./TODO.md) / [COMPLETED.md](./COMPLETED.md) for progress.
The build editor UI, boon/condition calculator, squad preview builder, sync/sharing backend,
and Discord bot are not implemented yet.

## Project structure

```
src/
├── main/       Electron main process (window management, SQLite storage, IPC handlers)
├── preload/    contextBridge — typed IPC surface exposed to the renderer
├── renderer/   React app (platform-agnostic; no Electron APIs) — views, components, state
└── shared/     Types and interfaces shared across main/preload/renderer (and future sync code)

scripts/        One-off scripts, e.g. fetch-game-data
data/game-data/ Normalized static GW2 game data (JSON), committed to the repo
docs/           Supplementary docs (e.g. game-data.md)
```

`src/renderer` and `src/shared` avoid Electron-specific APIs so the same React core can later
be reused in a Capacitor shell (iOS/Android) with only the storage adapter swapped out.

## Getting started

```bash
npm install
npm run fetch-game-data   # one-time: pulls static GW2 game data into data/game-data/
npm run dev                # launches the Electron shell with the React app inside it
```

## Roadmap

1. ✅ Project scaffolding, static GW2 game data pipeline, core data model, local storage,
   minimal UI shell.
2. Build editor UI + theoretical boon/condition uptime calculator, scoped incrementally by
   profession (starting with 2-3 meta WvW support builds).
3. Squad preview builder (offline, local saves).
4. Sync/sharing via a thin backend (unique immutable links — "copy into your own app", not
   collaborative editing).
5. Discord bot (client of the same backend API).
6. Mobile via Capacitor (iOS first, then Android).
