# Architecture

GW2-Squaded is a desktop-first (Electron) app with a web build and a Cloudflare Worker backend,
sharing one calculation/type core across all three. This describes the system as it stands now.

## Systems

### `src/main` — Electron main process
Owns the window, SQLite storage, static-game-data loading, the in-app data-update check, the
auto-updater, and offscreen screenshot capture. Talks to the renderer only through typed IPC
handlers in `src/main/ipc/`. Never imports renderer code (bundled separately; would break HMR).

### `src/preload` — IPC bridge
`contextBridge`-exposed, typed surface (`window.gw2Storage`, `window.gw2GameData`, etc.) that the
renderer calls instead of touching Electron APIs directly. This seam is what lets the same
renderer code run unmodified in a browser: the web build supplies browser-native implementations
behind the same interfaces (see `src/shared/storage/storage-interface.ts`'s two implementations —
`sqlite-storage.ts` behind IPC for Electron, `indexeddb-adapter.ts` directly in-browser for web).

### `src/renderer` — React app
Views, components, hooks, and React-context-based stores (`src/renderer/state/`). Platform-agnostic: no
Electron imports. Runs two ways — `App.tsx` inside the Electron shell, `AppWeb.tsx` inside the web
build (`web/main.tsx`) — both over the same component tree, differing only in which storage/
capture/game-data provider implementation is wired in at the entry point.

### `src/shared` — pure logic and types
The calculation core, with no UI or platform dependency, used by main/preload/renderer alike:
- `boon-calc/`, `skill-calc/`, `gear-calc/`, `weapon-calc/`, `squad-calc/` — the boon/condition
  uptime, damage/healing coefficient, and attribute-total calculators. This is the largest and
  most actively changed part of the codebase (see the File Cap Splits backlog in TODO.md).
- `game-data/` — typed accessors over the static JSON in `data/game-data/`, plus the
  `GameDataProvider`/`DataUpdateProvider` interfaces each platform implements.
- `storage/`, `share/`, `chat-link/`, `tags/`, `updater/` — persistence, share-link, build-code,
  and tagging logic shared the same way.

### `data/game-data/` — static GW2 reference data
Professions, specializations, traits, skills, itemstats, and hand-curated override tables,
normalized to JSON and committed to the repo. Populated/refreshed by `scripts/fetch-*.ts` (pulls
the live GW2 API, and scrapes wiki wikitext for values the API doesn't expose, e.g. coefficients).
The app only ever reads these committed files at runtime — it never calls the GW2 API live. Full
pipeline and per-script notes: `docs/game-data.md`.

**In-app game-data refresh** (`src/main/game-data/data-update.ts`): fetches the same JSON straight
from this repo's own `raw.githubusercontent.com` content on `main`. Committing a refreshed
`data/game-data/*.json` *is* the publish step — chosen specifically to avoid standing up a
separate server or auth/rate-limit surface for something a public repo already serves for free.

### `scripts/` — data pipeline and audit tooling
One-off `tsx` scripts: `fetch-*` scripts populate/refresh `data/game-data/`; `audit-*` and
`scan-*` scripts find data gaps (missing facts, duplicate skill-picker ids, coefficient
completeness) without changing anything. Several `fetch-*` scripts are unsafe to blind-rerun —
they silently revert hand-curated overrides if their upstream source has since changed; see
CLAUDE.md pitfalls before re-running one near a release.

### `web/` and `vite.web-preview.config.ts` — web builds
Two separate Vite configs reuse the same `src/renderer`/`src/shared` code: `web/` is the full web
app (deployed to `gw2squaded.vannyproductions.com` via `.github/workflows/deploy-web.yml` on every
push to `main`, gated on test/lint/typecheck), and `vite.web-preview.config.ts` builds a lighter
"preview" bundle the Discord bot's screenshot renderer loads headlessly (see below) — same
renderer code, no sign-in/sync UI.

### `worker/` — Cloudflare Worker (`gw2-squaded-share`)
A separate deployable (own `package.json`, `tsconfig.json`, `wrangler.toml` — no shared import
with `src/`; mirrored types are duplicated by hand, see CLAUDE.md). One Worker serves three
features, each with its own storage binding chosen for its access pattern:
- **Share links** — immutable, read-only JSON blobs (a build or squad comp) in `SHARES` (KV),
  keyed by a UUID, no TTL. No account needed to create or open one.
- **Cross-device sync** — account/token/lockout state in `SYNC_KV` (KV; low-volume, fits the
  free-tier write cap), the actual per-account sync payload (all of a signed-in user's builds/
  squad comps) in `SYNC_R2` (R2; no comparable write cap, since every push/pull rewrites it).
  Pushed/pulled by `src/renderer/hooks/useSync.ts` via `src/renderer/services/syncApi.ts`.
- **Discord bot** — board/guild/permission state in `DB` (D1, relational with uniqueness
  constraints — a poor fit for KV's flat shape). Slash-command interactions are handled directly
  in the Worker (`worker/src/discord/`); `/builddisplay`-style screenshot rendering uses Cloudflare
  Browser Rendering (`MYBROWSER`) against the web-preview build above. Full design:
  `docs/discord-bot.md`.

## Key decisions

- **Shared calculation core, swapped adapters at the edge** — `src/shared` has zero Electron
  dependency so the same boon/skill/gear calculators back the Electron app, the web app, and the
  Discord bot's screenshot renderer. Why: three UIs re-implementing GW2 mechanics independently
  would drift; only storage/capture/game-data access differ per platform, behind small interfaces.
- **Static, committed game data, no live API calls at runtime** — `data/game-data/*.json` is
  fetched/curated ahead of time and committed, not queried live. Why: offline-first is a stated
  product goal, and curated wiki data (coefficients, overrides) the GW2 API doesn't expose has to
  be committed anyway.
- **One Worker, three storage bindings chosen per access pattern** (KV for low-volume keyed state,
  R2 for larger blobs rewritten often, D1 for relational data) rather than one datastore for
  everything. Why: KV's free-tier daily write cap would throttle sync if the sync payload itself
  lived there; D1's relational constraints fit the Discord bot's guild/board model better than a
  flat key-value shape would.
- **No monorepo tooling between `worker/` and `src/`** — the Worker is deployed independently via
  `wrangler`, so it keeps its own dependency tree and hand-duplicates the few types it needs from
  the main app, rather than importing across a package boundary. Why: the two deploy on different
  cadences (Worker on `wrangler deploy`, desktop app on `electron-builder` release) and share only
  a handful of types.
- **In-app game-data refresh reads the public repo's own raw content**, not a dedicated endpoint.
  Why: the repo is already public and already serves `data/game-data/*.json` on every commit to
  `main` — standing up a server to serve the same files would be pure overhead.
- **Desktop-only — no mobile port.** A Capacitor iOS/Android port and a mobile-compatible browser
  version were both considered and dropped. Why: the app's core interactions (gear optimizer,
  drag-and-drop squad editor) are desktop-shaped (no touch fallback for native HTML5 drag-and-drop),
  and iOS distribution friction outweighs the payoff for a community-sized userbase; the Discord
  bot's browser-rendered preview cards already cover the "check a build from my phone" case.
