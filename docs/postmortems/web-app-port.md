# Web App Port — Post-mortem

Shipped 2026-10-08. First of the 4-milestone web-transition initiative (full plan:
`C:\Users\vanny\.claude\plans\goofy-stirring-nautilus.md`) — a local-only web build of the app,
live at `https://gw2squaded.vannyproductions.com`.

## What shipped

- `src/shared/storage/indexeddb-adapter.ts` — browser-native `StorageAdapter` implementation
  (`builds`/`squadComps`), local-only, no sync yet.
- `web/` — a sibling Vite entry point (`index.html`/`main.tsx`/`vite.config.ts`) and
  `src/renderer/AppWeb.tsx`, mirroring ChoiceBuds' "second entry point, not a second app" pattern.
  Reuses the full `src/renderer` component tree; only wires the hooks already ported to the
  storage adapter.
- Full interactive app (build editor, trait/equipment pickers, stats/boon-condition panel, gear
  optimizer, squad builder drag-and-drop, tags/search/favorites) manually verified working outside
  Electron with zero fixes needed.
- Deployed via GitHub Pages (`.github/workflows/deploy-web.yml`, build + `actions/deploy-pages` on
  every push to main), custom domain `gw2squaded.vannyproductions.com`, HTTPS enforced.

## What went well

- Incremental, hook-by-hook porting (per ChoiceBuds' playbook) meant Legs 1-3 each landed clean —
  no surprises, no rework. The interactive-app browser verification pass (Leg 3) needed zero
  fixes, which is a good sign the Electron/web split in the renderer tree was already clean before
  this milestone started.
- Once the right deploy target was identified, GitHub Pages setup itself was fast and
  uneventful — `gh api` to enable Pages + set the custom domain, one CNAME record from Vanny, cert
  issued automatically.

## What didn't go well

- Leg 4 initially built the full app into the Cloudflare Worker's `worker/public` and tried to
  attach `gw2squaded.vannyproductions.com` as a Workers Custom Domain, without first checking
  whether `vannyproductions.com`'s zone was even on Cloudflare. It wasn't (IONOS nameservers,
  hosting that domain's email) — the attach failed, and ChoiceBuds had already hit and documented
  this exact constraint for the same domain (`docs/postmortems/web-version-teams-box-mvp.md`
  there). That precedent should have been checked *before* touching `wrangler.toml`, not after a
  failed deploy attempt revealed it. Full revert was cheap (one session), but entirely avoidable.
- That same failed attempt caused a real, if brief, production incident: adding a `[[routes]]`
  block to `wrangler.toml` makes `wrangler deploy` silently default `workers_dev` to `false`, which
  took the live share backend and Discord bot offline for a few minutes before being caught via a
  manual curl check. Fixed in the moment, documented as a standing memory
  (`wrangler_routes_disables_workers_dev`) for any future Cloudflare Worker route change on this or
  other projects.

## Scope creep observed

None notable — each leg stayed to its own single deploy/porting decision.

## What changes next milestone

Before making any Cloudflare zone/custom-domain/route change against `vannyproductions.com` (or
any shared domain) again: check sibling-project precedent (ChoiceBuds' own `docs/postmortems/` and
`docs/web-transition-playbook.md`) *before* editing live infra config, not after hitting the same
wall. The next milestone (Sync Backend Foundation) touches this same Worker's `wrangler.toml` again
(new KV namespace, new R2 bucket) — lower risk than a custom domain, but still worth a quick
`wrangler deploy --dry-run` sanity check before a real deploy, given this milestone's incident.
