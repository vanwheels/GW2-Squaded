# GW2-Squaded

Offline-first Electron + React + TypeScript app: WvW build editor, squad composition builder,
boon/condition uptime calculator, gear optimizer. See `ARCHITECTURE.md` for systems/data flow,
`docs/game-data.md` for the static GW2 data pipeline, `docs/discord-bot.md` for the Discord bot.

## Commands

- `npm run dev` — Electron dev shell. `npm run dev:web` — web build dev server.
- `npm run test` / `npm run lint` / `npm run typecheck` — run all three before closing a leg.
- `npm run package:win` (`:mac` / `:linux`) — build an installer. `:win:publish` also publishes a
  GitHub Release — pre-create the draft release with `gh` first to avoid a duplicate-release race
  with electron-builder's own publish step.
- `npm run fetch-game-data` and the other `fetch-*` scripts pull static GW2 data from the API/wiki
  into `data/game-data/*.json` — see `docs/game-data.md` for the full list and when to re-run them.
- `worker/` is a separate deployable (own `package.json`/`wrangler.toml`): `wrangler dev` /
  `wrangler deploy` from inside that directory.

## Hard rules

- Update TODO.md's "Current Milestone" intro paragraph as each leg closes, not just at
  milestone close-out — it drifts out of sync with COMPLETED.md otherwise (confirmed drift in the
  Thief Pass + Celestial Fix milestone).
- Archive COMPLETED.md at the actual milestone boundary, not several milestones later (it fell
  behind by two milestones once, during Known Exceptions Sweep).
- Keep patch-driven work (new content from a specific game update) and standing verification
  queues as separately trackable TODO threads, even when they end up shipping in the same
  milestone — makes "done" unambiguous at a glance.
- Before provisioning or reusing a Cloudflare resource (KV/R2/D1) in `worker/wrangler.toml`,
  verify it with `wrangler kv/r2/d1 list` first. This Cloudflare account is shared with another
  app (ChoiceBuds); an "already-existing" namespace may actually belong to it, not this project —
  happened once with `SYNC_KV` (see that binding's comment in `wrangler.toml`), and the fix was a
  live auth-boundary bug, not just a naming collision.
- `worker/` has no shared import with `src/` (separate deployable, no monorepo tooling) — types it
  mirrors from the main app (`ShareKind`, `ProfessionId`, the sync payload shape) are duplicated by
  hand. Update both sides when either changes.
- `src/renderer` and `src/shared` stay Electron-free so the same code runs under the Electron
  shell and the web build (`web/`) unchanged. An Electron-only call there breaks the web build
  silently — there's no compile error, since the IPC bridge the renderer calls through is globally
  typed on both sides.

## Known pitfalls

- Per-skill tooltip fact rendering and the boon/condition aggregate calculator are separate code
  paths over the same source data — a coefficient/fact fix to one has repeatedly needed a second,
  separate fix to the other (Cleansing Ire, Specter Siphon F1). Check both when fixing a fact bug.
- `CURATED_TRAIT_HEALING_COEFFICIENTS` and the damage-coefficient tables only bind to wiki
  `AttributeAdjust`/`Healing` facts — a coefficient living inside a Buff-fact template (e.g. a
  per-stack self-heal like Adrenal Health) has no binding point yet; surfacing one needs new infra,
  not a table entry.
