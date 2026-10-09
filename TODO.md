# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.
Deep investigation history (cross-checks, historical readings, per-attempt reasoning) lives in
`docs/investigations/`; items below link out to it rather than carrying it inline.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

The Web App Port, Sync Backend Foundation, and Continuous Cross-Device Sync milestones (full plan:
`C:\Users\vanny\.claude\plans\goofy-stirring-nautilus.md`) all shipped 2026-10-08/09 — see
MILESTONES.md / COMPLETED.md. They're the first three of a 4-milestone web initiative. Milestone 4
(Polish/Parity) is now scoped and current (below).

## Current Milestone: Polish/Parity

Last milestone of the 4-part web initiative. The `deploy-web` CI item originally scoped for this
milestone turned out to already be shipped as part of Web App Port (`.github/workflows/deploy-web.yml`
builds + `actions/deploy-pages` on every push to `main`) — dropped from scope, nothing left to do
there.

`global.css` already reflows down to 820px (and has ultrawide-side tiers up to 2600px+), but nothing
narrower than phone width (375-480px) has been audited, and Vanny confirmed 2026-10-08 that the build
editor's 3-column dense layout (Traits/Equipment/Stats+Skills columns + toolbar row + equipment text
manifest, see `BuildScreenshotGrid.tsx`) needs a genuinely different mobile layout, not a reflow or
one long scroll — same likely true of the squad editor's sidebar+grid shape. Split into legs below
instead of one "layout pass."

### [Remaining Views Mobile Audit] — Leg 3
Everything outside the build/squad editors (nav, Builds/Squads list views, Settings, gear optimizer
modal) at phone width — audit in a real browser (not just devtools resize), fix overflow/unusable
layouts found. These are lower-density than the editors, so a reflow matching the existing
breakpoint-tier pattern in `global.css` is likely sufficient here, unlike Legs 1-2.
Last touched: 2026-10-08. Re-checks: 0.

### [Copy-Screenshot Web Parity] — Leg 4
Desktop's "Copy screenshot" drives an Electron-only offscreen `BrowserWindow` capture
(`src/main/capture/offscreen-capture.ts`); the web build's `window.gw2Capture` is a silent no-op
(`web/main.tsx`) — clicking the button shows "Copied to clipboard!" and does nothing, which is
misleading rather than just absent. Two paths: (a) a browser-native capture (e.g. render
`BuildScreenshotGrid`/`SquadCompScreenshotGrid` off-screen and rasterize via a canvas-based library,
then use the Clipboard API), or (b) hide/disable the button on web with a documented gap instead of
building real capture. Decide which during implementation — (a) is real parity but a new dependency
and rendering path; (b) is cheap but leaves a visible feature gap. Flag the tradeoff before picking.
Last touched: 2026-10-08. Re-checks: 0.

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
