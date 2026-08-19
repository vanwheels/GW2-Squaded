# GW2-Squaded

A Guild Wars 2 WvW tool for building theoretical stat builds (similar to
[gw2skills.net](https://en.gw2skills.net/)), assembling squad compositions, calculating
theoretical boon/condition uptime, and optimizing gear to min-max your stats.

Offline-first desktop app for Windows, built with Electron + React + TypeScript. Everything —
builds, squad comps, game data — is stored locally on your machine; no account, no login, no
telemetry.

This project is not affiliated with or endorsed by ArenaNet or NCSOFT. Guild Wars 2 game data
is used under [ArenaNet's Content Terms of Use](https://www.guildwars2.com/en/legal/guild-wars-2-content-terms-of-use/).

## Download

Grab the latest Windows installer from the
**[Releases page](https://github.com/vanwheels/GW2-Squaded/releases/latest)**
(`GW2-Squaded-Setup-*.exe`). Run it, launch GW2-Squaded, and you're in — no further setup
required. The app checks for its own updates and for game-data updates (new profession/skill/item
data after a balance patch) from Settings, so you don't need to reinstall to stay current.

macOS/Linux aren't packaged/published yet — see [Building from source](#building-from-source) if
you want to run it there.

## Features

- **Build editor** — pick a profession and elite specialization, choose traits, equip weapons/
  armor/trinkets with stat prefixes and upgrades (runes, sigils, relics, infusions), set your
  Heal/Utility/Elite skills, and pick food/utility consumables.
- **Live stats & boon/condition uptime** — a Stats panel showing your build's fully computed
  attributes (Power, Precision, Boon Duration, etc.), and a Boon/Condition summary estimating
  uptime/stacks from everything your traits, skills, and gear actually grant — adjustable against
  a combat-state panel (target count, target armor class, health tier, active boons, stacks, etc.)
  so the numbers match the fight you're theorycrafting for.
- **Gear optimizer** — set minimum stat floors (shown in their translated Health/Armor/Critical
  Chance/Critical Damage form) and up to 3 stats to maximize, and it searches the full legal gear
  stat-combo pool (including runes, infusions, and food/utility) for the best combination, with a
  live "current vs. proposed" stat comparison before you apply it.
- **Squad composition builder** — a roster grid of up to 10 parties of 5. Drag saved builds in
  from the sidebar, or drop in a lightweight "ghost pick" (just a profession/elite-spec icon) or a
  free-text placeholder for a slot you haven't planned out yet.
- **Sharing** — every build and squad comp has a *Share* button that creates a permanent,
  read-only link anyone can open (no account needed) to view or copy into their own app. There's
  also a one-click *Copy screenshot* button that puts an image straight on your clipboard, handy
  for pasting into Discord.
- **Organization** — tags, free-text/keyword search (gear-upgrade pickers support `#stat` search,
  e.g. `#power`), and middle-click-to-favorite on any build/squad/food/utility item. Build and
  squad cards are colored by profession (real GW2 class colors) so a list or squad roster reads at
  a glance.
- **Light / Dark / System theme** — follows your OS theme by default, or pin one from Settings.
- **Offline-first** — your builds and squad comps are saved locally (SQLite); the app works
  without a network connection once game data has been fetched once.

## Using the app

### Builds tab

Click **+ New build** to start one, or open an existing card. Inside the editor:

- **Profession & elite spec** — pick at the top-left; this drives which traits/skills/weapons are
  available.
- **Traits** — pick your specialization lines and majors/minors.
- **Equipment** — set weapons and armor/trinket stat prefixes, then click into a slot's upgrade
  icon (rune, sigil, relic, infusion) to search and assign it. Food and Utility consumables live
  in the same panel.
- **Stats / Boon-Condition summary** — updates live as you edit. Use the combat-state icons next
  to the Stats panel (target count/armor, health tier, boon stacks, etc.) to match the scenario
  you care about.
- **Skills** — set your Heal/Utility/Elite/Elite-specialization skills; weapon skills follow from
  your equipped weapons automatically.
- **Gear Optimizer** — below the main columns. Set stat floors and pick stats to maximize, then
  apply the suggested gear directly to your build.
- **Tags** — add free-text tags under the name field for your own filtering scheme (profession/
  elite-spec tags are added automatically).
- Use **Copy screenshot** or **Share** (top-right) to export the build.

Back on the Builds list: search/filter by name, tag, or profession; drag cards to reorder;
middle-click a card to favorite it; **Import from link** pastes in someone else's share link as a
new build of your own.

### Squads tab

Create a squad comp, then build out your roster: drag a build from the sidebar onto a party slot,
or click a slot to search/pick a saved build *or* a lightweight "ghost pick" (just a profession/
elite-spec icon, for a role you haven't built out yet) from the same picker. Each slot also has an
optional free-text role label (e.g. "any DPS"). Parties can be added up to the real WvW squad cap
(10 parties of 5). Right-click a sidebar card or a filled party slot for a quick Preview/Edit menu.
Tags, search, favorites, screenshots, sharing, and link import all work the same way as Builds.

### Discord bot

A companion Discord bot lets a server curate shared build/squad boards and preview them without
opening the app — see [docs/discord-bot-commands.md](./docs/discord-bot-commands.md) for the full
command reference, or run `/help` once it's in your server.

### Settings tab

- **Appearance** — Light/Dark/System theme toggle.
- **Display** toggles for underwater equipment/skills and racial skills (both off by default —
  hidden from pickers and excluded from Stats/boon-condition totals when off).
- **Updates** — check for and install new app versions (Windows only).
- **Game data** — check for and download updated GW2 game data (professions, skills, items) after
  a balance patch, without needing a new app release.
- **Credits** — attribution for icons and reference data.

## Building from source

```bash
npm install
npm run fetch-game-data   # one-time: pulls static GW2 game data into data/game-data/
npm run dev                # launches the Electron shell with the React app inside it
```

To build an installer yourself: `npm run package:win` (or `:mac` / `:linux`).

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
worker/         Cloudflare Worker backend for share links (immutable, read-only)
```

`src/renderer` and `src/shared` avoid Electron-specific APIs so the same React core can later
be reused in a Capacitor shell (iOS/Android) with only the storage adapter swapped out.

## Status

**1.0** — the build editor, boon/condition uptime calculator, squad preview builder, and
sync/sharing backend (roadmap items 1-4) are all implemented and released. The Discord bot
(roadmap item 5, see [docs/discord-bot-commands.md](./docs/discord-bot-commands.md)) is also
built, deployed, and live-verified, though it ships separately from the desktop app itself. See
[CHANGELOG.md](./CHANGELOG.md) for user-facing release notes, or
[TODO.md](./TODO.md) / [COMPLETED.md](./COMPLETED.md) for the ongoing development log; the
Capacitor mobile port is the one remaining later roadmap stage, not part of 1.0.

## Roadmap

1. ✅ Project scaffolding, static GW2 game data pipeline, core data model, local storage,
   minimal UI shell.
2. ✅ Build editor UI + theoretical boon/condition uptime calculator, covering all 9 professions.
3. ✅ Squad preview builder (offline, local saves).
4. ✅ Sync/sharing via a thin backend (unique immutable links — "copy into your own app", not
   collaborative editing).
5. ✅ Discord bot (client of the same backend API).
6. Mobile via Capacitor (iOS first, then Android).

## Credits

Equipment-slot and stat-prefix icons are used with permission from
[gw2skills.net](https://en.gw2skills.net/) — thanks to Connor McLeoud for granting reuse.
Profession and elite-specialization icons are the Guild Wars 2 Wiki's community-drawn Tango icon
set, used under the [GNU Free Documentation License](https://www.gnu.org/licenses/fdl-1.3.html).
Reference data and imagery also draw on the Guild Wars 2 Wiki community.
