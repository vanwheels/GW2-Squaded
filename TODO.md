# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.
Deep investigation history (cross-checks, historical readings, per-attempt reasoning) lives in
`docs/investigations/`; items below link out to it rather than carrying it inline.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Current Milestone: Web App Port

Full web transition to `gw2squaded.vannyproductions.com`, mirroring ChoiceBuds' web port
(`D:/Projects/ChoiceBuds/docs/web-transition-playbook.md`). This milestone is the first of a
4-milestone initiative (full plan: `C:\Users\vanny\.claude\plans\goofy-stirring-nautilus.md`) —
local-only web app first, then a sync backend, then wiring continuous cross-device sync into both
clients, then polish. Future milestones are named below under Future Milestones (unscheduled)
rather than detailed yet.

### [Deploy to gw2squaded.vannyproductions.com] — Leg 4
First attempt built the full app into the Worker's `worker/public` and tried a Workers Custom
Domain, but that needs `vannyproductions.com`'s whole DNS zone on Cloudflare — it's on IONOS
nameservers today (hosting that domain's email among other things), so moving it was too risky
just for this subdomain. Reverted that approach and switched to GitHub Pages instead, mirroring
ChoiceBuds' `choicebuds.vannyproductions.com` (same zone, same constraint, same answer — see its
`docs/postmortems/web-version-teams-box-mvp.md`): `web/vite.config.ts` back to a standalone
`dist/web` output, new `.github/workflows/deploy-web.yml` (build + `actions/deploy-pages` on every
push to main), GitHub Pages enabled on the repo with `build_type: workflow` and custom domain
`gw2squaded.vannyproductions.com` set via `gh api`. `worker/wrangler.toml` reverted to its original
shape — the Worker goes back to only serving the share API, Discord bot, and the Discord-bot
preview pages, unrelated to this domain.
Blocked: needs one CNAME record added at the IONOS DNS panel for `gw2squaded` → `vanwheels.github.io`
(same target ChoiceBuds' `choicebuds` CNAME uses) before the custom domain's cert can issue and
`https_enforced` can flip on — that's Vanny's to add, not something this session can reach. Once
it's added, confirm `https://gw2squaded.vannyproductions.com` serves the app after the first
Actions deploy (first push to main after this change triggers it).
Last touched: 2026-10-08. Re-checks: 0.

## Future Milestones (unscheduled)

- **Sync Backend Foundation** — adapt ChoiceBuds' `worker/src/crypto.ts` (password hashing, token
  gen/hash, constant-time compare) and `worker/src/merge.ts` (per-record last-write-wins merge +
  tombstone reconciliation) onto a `SyncPayload` scoped to GW2-Squaded's `builds`/`squadComps`, on
  the existing `gw2-squaded-share` Worker. New KV namespace (account/token/lockout state) + new R2
  bucket (per-account sync blob — not KV, per ChoiceBuds' own write-cap lesson). Routes:
  `POST /signup`, `POST /login`, `PUT|GET /sync/:username`, same shape as ChoiceBuds'.
- **Continuous Cross-Device Sync** — add tombstone tracking for deletes to both
  `src/main/storage/sqlite-storage.ts` (desktop) and the IndexedDB adapter (web) — neither retains
  anything today once a record is removed. Add an `applySyncedState` bulk-replace method to
  `builds-store.tsx`/`squad-comps-store.tsx`. Port ChoiceBuds' `useSync.ts` trigger logic
  (mount/sign-in, `online` event, ~5min fallback poll, ~5s debounce-on-mutation) as a shared hook
  in `src/renderer`, wired into both `AppWeb` and the existing Electron `App`. Sign-in UI in
  Settings on both. Finishes with a real cross-device verification pass (concurrent edit, reorder,
  delete, edit-after-delete resurrection) — note `Build.order`/`SquadComp.order` are already
  separate from `updatedAt`, so list reordering itself needs no new sync-safety work.
- **Polish/Parity** — mobile/responsive layout pass for the web build; "Copy screenshot" parity on
  web (desktop uses Electron offscreen capture; needs a browser-native equivalent or a documented
  gap); a `deploy-web` CI workflow (build + `wrangler deploy` on push to `main`), separate from the
  desktop `release.yml`.

## Unscheduled

### [Discord Bot Profession-Scoped Game-Data Fetch] — Leg 1 (nice-to-have, deprioritized)
A fresh browser session still re-fetches all 26 game-data JSON files (11MB) per render even though
most previews only need one or a few professions' worth of data. `buildGameData()`/
`GameDataProvider` is shared with Electron's load-everything-once design, and a squad preview's
profession set isn't known until the share is fetched and parsed — a genuinely bigger refactor.
Session-reuse already avoids repeat downloads within a warm browser session, so a cold start pays
the full 11MB only once. User confirmed 2026-08-19 the other latency fixes weren't clearly
noticeable either way and is satisfied with "cleaner on the backend" for now — revisit only if
latency becomes a live complaint again, ideally backed by a `wrangler tail` timing pass.
Blocked: waiting on latency becoming a live complaint again.
Last touched: 2026-08-19. Re-checks: 0.

## Known Exceptions — investigated, permanently excluded

Leg 1 of the sweep above (2026-09-29) gave each of these a fresh-eyes re-check — current wiki
content and local API data all re-pulled and compared against the prior conclusions. All 6
reconfirmed closed with no new leads; no code changes needed. Full derivation for each:
`docs/investigations/coefficient-verification-queue.md`.

- Guardian 31295 (Sanctuary, underwater variant)
- Necromancer 10547 (Summon Blood Fiend)
- Necromancer 10670 (2nd Well of Blood id)
- Thief 71802 (Helmet Breaker)
- Soul Grasp
- Grim Specter, Carnivore, Replenishing Despair

Leg 2 (2026-09-29): Relic of Karakosa's Sep 29 patch trigger-location change (heal now centers on
blast-finisher location, not player location). Already a `COMBO`-bucket relic per
`docs/relic-trigger-classification.md` — unbounded trigger, never a `RELIC_TRIGGER_GATES` candidate
for reasons independent of this patch; its heal payload was never curated in `healing-calc.ts`
either (that table has no relic-keyed entries at all). Modeling the new mechanic specifically would
require spatial/positional infra (player vs. finisher vs. ally position) this app has nowhere else.
No code change possible or needed. Full scoping:
`docs/investigations/sep-29-2026-patch-changes.md`.

Leg 8 (2026-09-29): Sapping Device (trait 507, Engineer) — its Weakness-on-disable/immobilize was
never modeled in the boon/condition aggregate calculator (pre-existing gap, unrelated to this
patch's added 8s internal cooldown), and "on disable" is an unbounded, combat-dependent trigger with
no fixed cadence to assume, same shape as Relic of Karakosa's COMBO-bucket exclusion above. No
ICD-tracking mechanism exists for trait Buff applications the way relics have `rechargeSeconds`.
Full scoping: `docs/investigations/sep-29-2026-patch-changes.md`.

Leg 13 (2026-09-29): Adrenal Health (trait 1348, Warrior Defense) — its wiki-documented 0.6/0.9/1.2
healing coefficient (by adrenaline stage) lives inside a `{{skill fact|effect|...}}` Buff-fact
template, not the `{{skill fact|healing|...}}` AttributeAdjust template
`CURATED_TRAIT_HEALING_COEFFICIENTS` binds to — confirmed via raw wikitext and the local API data
(trait 1348 has zero `AttributeAdjust`/`Healing` facts, only `Apply Buff/Condition`/`Interval`/
`Maximum Stacks`). Surfacing a number would need new infra (a per-stack heal-value lookup for
Buff-type self-heal facts, wired into `traitFactLines`) nothing else in the codebase uses — same
shape as the Relic of Karakosa/Sapping Device exclusions above. Full scoping:
`docs/investigations/sep-29-2026-patch-changes.md`.

## Reference — not scheduled

- **Future stat-family candidates** — never-modeled stat-family shapes (per-condition-type
  damage-%, self-stacking buffs, target-status-stack-count, per-skill-category, weapon-type-scoped,
  and more) found during the Outgoing Damage % and data-completeness sweeps. Each affects only 1-4
  skills/traits, not worth building dedicated infra for on its own. Revisit only if a future sweep
  needs the same shape for more candidates: `docs/investigations/future-stat-family-candidates.md`
  and `docs/investigations/data-completeness-gap-shapes.md`.
