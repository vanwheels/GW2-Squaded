# GW2-Squaded — Groundwork Prompt for Claude Code

Paste this into Claude Code in the empty `GW2-Squaded` project folder.

---

I'm starting a new project called **GW2-Squaded** — a Guild Wars 2 WvW tool for building
theoretical stat builds (similar to gw2skills.net), assembling squad compositions, and
calculating theoretical boon/condition uptime. Long-term this will also sync to a backend
and power a Discord bot, but **this session is scaffolding and data-layer groundwork only.**
Do not implement the boon calculator logic, backend, or Discord bot yet.

## Stack

- **Frontend**: React + TypeScript
- **Shell**: Electron (same pattern as my other project, ChoiceBuds) — the app should run
  fully offline-first, with all core functionality (viewing skills/traits, building squads,
  running calculations once they exist) working with zero network connection after initial
  data sync.
- **Local storage**: SQLite (via Electron), for saved builds and squad comps.
- **Static game data**: cached locally as JSON, sourced from the public Guild Wars 2 API
  (no auth required for this data): professions, specializations, traits, skills, itemstats.
  This should be fetched once via a script and stored locally, not fetched live on every
  app launch. Build in a simple "refresh game data" mechanism for later (balance patches
  change these values), but it doesn't need to be automatic yet.
- Eventually this app will also be packaged for iOS/Android via Capacitor, reusing the same
  React core — so avoid Electron-specific APIs bleeding into core UI/logic components. Keep
  Electron-specific code (file system, SQLite bindings, window management) isolated behind a
  clean interface so it can be swapped for a Capacitor equivalent later.

## Conventions (please follow these throughout)

- Maintain `TODO.md` and `COMPLETED.md` at the project root for task tracking.
- Static/reference data (traits, skills, itemstats, etc.) should be modeled as data files/
  resources, not hardcoded inline in logic.
- Keep app-wide state centralized and clearly owned (e.g. a small set of well-defined
  stores/contexts), not scattered.
- Use typed contracts (TypeScript interfaces/types) for all data shapes — builds, squad
  comps, game data entities — defined up front in a shared `types/` location.
- No monolithic files — split by responsibility (data fetching, data models, UI components,
  local storage access should all be separate concerns).
- You own git for this project: initialize the repo (name it `GW2-Squaded`), commit as you
  go with clear, conventional commit messages, and push to the remote yourself once it's set
  up. No need to draft messages for manual review — author and push directly.

## Full Project Context & Roadmap (background — not all in scope this session)

This is everything decided so far, so you have the full picture for future sessions. Only
the "What to build this session" section below is in scope right now — treat the rest as
context that should inform structural decisions (e.g. keeping things swappable/extensible)
without building it yet.

### Vision
A Guild Wars 2 WvW tool with three core features: a theoretical stat build editor
(comparable to gw2skills.net), a squad composition preview builder, and a theoretical
boon/condition uptime calculator based on party comp and class/build selections. Audience is
my guild/squad initially, with the possibility of opening it up publicly later if it's well
received — so it should be built with multi-user use in mind even though it starts small.

### Sharing model (important for future data design)
Squad comps and builds are **not** collaboratively edited. When someone shares a build or
squad comp, it becomes an immutable snapshot with its own unique link. Someone else can copy
that link into their own local app and edit their own copy freely — there is no shared
mutable document and therefore no conflict resolution to design for. Keep this "copy, don't
co-edit" model in mind for any future sync/share data design.

### Architecture rationale
- **Offline-first is a hard requirement**, matching my other project (ChoiceBuds, also
  Electron). Viewing skills/traits and running the boon/condition calculator must work with
  zero network connection — this is why static GW2 game data is cached locally rather than
  fetched live, and why the calculator is a pure local computation, not a server call.
- **Backend is thin and optional at the core-app level**: it only exists for (a) generating/
  resolving shareable links for builds and squad comps, and (b) giving the future Discord bot
  something to read from. The desktop/mobile app itself never depends on it being reachable.
- **Discord bot** is a future, lower-priority addition (after the core app works) that will
  be a client of the same backend API — not a special case with its own data layer.
- **Mobile (iOS primary, then Android)** is planned via **Capacitor**, reusing this same
  React core rather than a separate native or React Native build. This is why
  Electron-specific code needs to stay isolated behind clean interfaces (see stack notes
  above) — the same core UI/logic should eventually drop into a Capacitor shell with only the
  storage adapter and native bindings swapped out.
  - iOS requires an Apple Developer Program membership ($99/year) for App Store
    distribution — not yet purchased; I'm holding off until closer to having something
    launch-ready, to avoid paying for an idle subscription.
  - Android requires a one-time $25 Google Play developer account.

### Hosting plan (for later, not this session)
- Personal domain is registered through IONOS; the personal site/portfolio is static,
  hosted on GitHub Pages, and stays untouched by this project.
- The future backend (sync/share API + Discord bot process) most likely runs on a home
  Linux server I'm setting up separately (old Intel MacBook, Ubuntu Server 24.04 + Docker,
  also used for Palworld/Minecraft hosting) as additional Docker containers — zero extra
  hosting cost, acceptable uptime tradeoffs for guild-scale use.
- If this ever needs reliable always-on hosting beyond guild scale, a small VPS
  (DigitalOcean/Linode/Hetzner, ~$4-6/month) is the fallback, with a subdomain (e.g.
  `api.<mydomain>`) pointed at it via IONOS DNS, leaving the main site on GitHub Pages
  unaffected.

### Reference project: WvWSquadCrafter
A friend built a Godot desktop app called WvWSquadCrafter
(https://github.com/Orikata/WvWSquadCrafter) that does drag-and-drop squad party-grid
building — visually similar to what we want for the squad preview feature. The repo has no
LICENSE file (all rights reserved by default), so it can only be used as **UX/interaction
reference**, not forked or reused as code, unless/until I get explicit permission from the
author. Its GW2 asset icons are used under ArenaNet's Content Terms of Use with an
attribution disclaimer — if we ever bundle similar official GW2 icon assets, we need the
same kind of "not affiliated with or endorsed by ArenaNet/NCSOFT" disclaimer in the README.

### Phased roadmap
1. **This session**: project scaffolding, static GW2 game data pipeline, core data model,
   local storage layer, minimal UI shell (see below).
2. Build editor UI + theoretical boon/condition uptime calculator (the hardest part —
   per-skill/trait boon rules, ICDs, stacking duration vs. intensity, boon duration/
   concentration stat scaling). Likely scoped incrementally by profession rather than all at
   once — starting with 2-3 meta WvW support builds (e.g. firebrand, herald) rather than all
   nine professions.
3. Squad preview builder (offline, local saves; WvWSquadCrafter as UX reference).
4. Sync/sharing via the backend (unique immutable links, "copy into your own app" model).
5. Discord bot (reads/writes the same backend API).
6. Mobile via Capacitor (iOS first, then Android).

## What to build this session

1. **Project scaffold**: Initialize the Electron + React + TypeScript project. Set up the
   folder structure (e.g. `src/main` for Electron main process, `src/renderer` for the React
   app, `src/shared` for types/utilities used by both). Include basic tooling: linting,
   TypeScript config, and a working `npm run dev` that launches the Electron shell with the
   React app inside it.

2. **GW2 static game data pipeline**: Write a script (run manually via npm script, e.g.
   `npm run fetch-game-data`) that pulls from the public GW2 API — professions,
   specializations, traits, skills, itemstats — and writes normalized JSON files to a local
   data directory. Keep raw API shapes separate from any app-facing normalized types if the
   raw API data is unwieldy. Document the endpoints used and any pagination/rate-limit
   handling needed in a short `docs/game-data.md`.

3. **Core data model**: Define TypeScript types/interfaces for the domain entities we've
   scoped so far:
   - `Build` (profession, specializations + chosen traits, skills, equipment/stat selections)
   - `SquadComp` (a roster grid of parties, each slot referencing a `Build` or left empty,
     plus metadata like name/notes)
   - Static game data entities (Profession, Specialization, Trait, Skill, ItemStat) matching
     what the fetch script produces
   Put these in `src/shared/types/` so they're usable from both local storage and future
   sync code without duplication.

4. **Local storage layer**: Set up SQLite (via an appropriate Electron-compatible library)
   with a schema for saved `Build`s and `SquadComp`s, and a small data-access module
   (create/read/update/delete) that the UI can call — but keep this behind an interface so
   it's not tightly coupled to SQLite specifically, since Capacitor will need a different
   backing store later.

5. **Minimal UI shell**: A basic app shell with navigation between a "Builds" view and a
   "Squads" view (empty/placeholder screens are fine for now), just enough to confirm the
   Electron + React + local storage pipeline works end to end — e.g. create a dummy build,
   save it, reload the app, see it persisted.

Please start by proposing the folder structure and confirming the plan before writing code,
then work through the numbered items in order, updating `TODO.md`/`COMPLETED.md` as you go.
