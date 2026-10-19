# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.
Deep investigation history (cross-checks, historical readings, per-attempt reasoning) lives in
`docs/investigations/`; items below link out to it rather than carrying it inline.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Current Milestone: Tooling & Cleanup

Done when:
- ~~Prettier is installed and configured, reconciled with ESLint, a full codebase format pass is
  done, and `npm run lint` includes a format check and passes clean.~~ Done in Leg 1.
- ~~Light Aura's Boons-bar presence matches between the Squad Builder and Build Editor for the same
  build.~~ Done in Leg 2 — turned out to be a stale duplicate, not a live bug.

## Unscheduled

### [Twin Moon Sweep] — Leg 1
Twin Moon (Revenant) has the same "one cast, mutually exclusive legend-gated branches" shape
Otherworldly Bond had before `branch-conditional-facts.ts`'s labeled-divider mechanism resolved
it — left as an untried candidate since nobody has checked whether a live-game screenshot of its
real tooltip exists to resolve it the same way. Ask for one before assuming it's out of reach.
Done check: Twin Moon's tooltip either renders via `branchConditionalFacts` with wiki-sourced
numbers, or is confirmed genuinely unresolvable and logged as a Known Exception instead.
Manual verification: no.
Last touched: 2026-10-19. Re-checks: 0.

### [Skill-Side Number-Fact WvW Override Gap] — Leg 1
Traits route `Number`/`Percent` facts through `numericFactLines`, which consults
`NUMERIC_FACT_WVW_OVERRIDES` to pick the WvW-correct value when the API gives one undiscriminated
number. Skills have no equivalent — `skillFactLines` is only mode-aware for `Recharge` and the 4
curated-coefficient tables. `CURATED_NUMERIC_FACT_VALUES` (`skill-fact-lines.ts`) currently patches
exactly 3 ids (Seed of Life/Lesser Seed of Life) via direct value replacement, not a generalized
mechanism. A future balance patch will keep hitting this on new skill-level Number facts.
Done check: either a generalized skill-side WvW-override mechanism exists (mirroring
`NUMERIC_FACT_WVW_OVERRIDES`'s shape), or the direct-value-table approach is confirmed sufficient
and this item is closed as "no new infra needed, extend the table as cases arise."
Manual verification: no.
Last touched: 2026-10-19. Re-checks: 0.

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

## Future Milestones (unscheduled)

### Polish/Parity

Last milestone of the 4-part web initiative, paused intact 2026-10-19 to plan Tooling & Cleanup.
Legs 1-2 (Build Editor Mobile Tabs, Squad Editor Mobile Layout) already shipped before the pause —
archived in `docs/archive/completed-2026-09-29-to-2026-10-19.md`. The `deploy-web` CI item
originally scoped for this milestone turned out to already be shipped as part of Web App Port
(`.github/workflows/deploy-web.yml` builds + `actions/deploy-pages` on every push to `main`) —
dropped from scope, nothing left to do there.

`global.css` already reflows down to 820px (and has ultrawide-side tiers up to 2600px+), but nothing
narrower than phone width (375-480px) has been audited, and Vanny confirmed 2026-10-08 that the build
editor's 3-column dense layout (Traits/Equipment/Stats+Skills columns + toolbar row + equipment text
manifest, see `BuildScreenshotGrid.tsx`) needed a genuinely different mobile layout, not a reflow or
one long scroll — same was true of the squad editor's sidebar+grid shape, both resolved in Legs 1-2.

#### [Remaining Views Mobile Audit] — Leg 3
Everything outside the build/squad editors (nav, Builds/Squads list views, Settings, gear optimizer
modal) at phone width — audit in a real browser (not just devtools resize), fix overflow/unusable
layouts found. These are lower-density than the editors, so a reflow matching the existing
breakpoint-tier pattern in `global.css` is likely sufficient here, unlike Legs 1-2.
Last touched: 2026-10-08. Re-checks: 0.

#### [Copy-Screenshot Web Parity] — Leg 4
Desktop's "Copy screenshot" drives an Electron-only offscreen `BrowserWindow` capture
(`src/main/capture/offscreen-capture.ts`); the web build's `window.gw2Capture` is a silent no-op
(`web/main.tsx`) — clicking the button shows "Copied to clipboard!" and does nothing, which is
misleading rather than just absent. Two paths: (a) a browser-native capture (e.g. render
`BuildScreenshotGrid`/`SquadCompScreenshotGrid` off-screen and rasterize via a canvas-based library,
then use the Clipboard API), or (b) hide/disable the button on web with a documented gap instead of
building real capture. Decide which during implementation — (a) is real parity but a new dependency
and rendering path; (b) is cheap but leaves a visible feature gap. Flag the tradeoff before picking.
Last touched: 2026-10-08. Re-checks: 0.

### File Cap Splits

15 source files over the 500-line soft/hard cap (data/generated files excluded). Splitting is risky
refactor work and gets its own milestone, not folded into Project Revision v2:

- `src/shared/boon-calc/sources.ts` (6760 lines)
- `src/shared/skill-calc/damage-calc.ts` (3986)
- `src/shared/gear-calc/combat-state.ts` (2604)
- `src/shared/skill-calc/fact-numbers.ts` (1954)
- `src/shared/gear-calc/gear-optimize.ts` (1589)
- `src/shared/skill-calc/branch-conditional-facts.ts` (1482)
- `src/shared/gear-calc/combat-state.test.ts` (1451)
- `src/shared/skill-calc/healing-calc.ts` (1228)
- `src/renderer/components/build-editor/SkillsEditor.tsx` (1009)
- `src/renderer/components/build-editor/EquipmentEditor.tsx` (829)
- `src/shared/gear-calc/trait-attributes.ts` (778)
- `src/shared/types/game-data.ts` (670)
- `src/renderer/components/build-editor/CombatStatePanel.tsx` (626)
- `src/shared/skill-calc/profession-mechanic.ts` (621)
- `src/shared/gear-calc/attribute-totals.ts` (542)

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

Project Revision v2 Leg 3 (2026-10-19): Necromancer life-force gain rate (Soul Comprehension/
Gluttony traits) — the mirror-image gap to the shipped resource-cost modeling work (energy/
initiative/upkeep/health cost). Never curated because life-force has no baseline value to apply a
%-modifier to, same blocker as when first flagged; no new information since. Investigated and
excluded, not forgotten — revisit only if this app ever models a baseline life-force gain rate for
some other reason.

Project Revision v2 Leg 3 (2026-10-19): Heated Rebuke (Tome of Justice Ch. 3, Firebrand) breakbar
damage — found unwired into any pipeline while fixing the Tome Cleanse/Stun Break gaps
(`docs/investigations/` has no dedicated writeup; see commit history around the Tome chapter
fixes), but the magnitude was deliberately left unmodeled per an earlier user confirmation that
breakbar damage isn't WvW-relevant for this app's purposes. Not a gap, a standing scope decision.

## Reference — not scheduled

- **Future stat-family candidates** — never-modeled stat-family shapes (per-condition-type
  damage-%, self-stacking buffs, target-status-stack-count, per-skill-category, weapon-type-scoped,
  and more) found during the Outgoing Damage % and data-completeness sweeps. Each affects only 1-4
  skills/traits, not worth building dedicated infra for on its own. Revisit only if a future sweep
  needs the same shape for more candidates: `docs/investigations/future-stat-family-candidates.md`
  and `docs/investigations/data-completeness-gap-shapes.md`.
