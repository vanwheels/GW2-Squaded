# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.
Deep investigation history (cross-checks, historical readings, per-attempt reasoning) lives in
`docs/investigations/`; items below link out to it rather than carrying it inline.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Current Milestone: Data Completeness Test Coverage

Done when:
- A structural completeness test exists for all 5 curated coefficient tables (damage/healing/
  barrier/trait-healing/siphon-damage), and every fact it flags has a recorded decision (covered,
  excluded-with-reason, or deferred to a new TODO item). Split into 2 legs (2026-10-19): Leg 1
  (healing/barrier/siphon-damage) and Leg 2 (damage, plus the new reachable-id-filter infra it
  needed) both shipped.
- A registry-driven test links `skillFactLines`/`traitFactLines`'s generic fact loop to
  `computeNamedFactSources`'s correction tables, passing against the existing Cleansing Ire fix.
- The skill-side WvW-override question is resolved — either a generalized mechanism ships
  (mirroring `NUMERIC_FACT_WVW_OVERRIDES`), or the direct-value-table approach is explicitly
  confirmed sufficient and the item closed as such.

### [Damage Coefficient Sweep — New/Uncurated Skill Content] — Leg 9
Found by the Coefficient-Table Completeness Test's Leg 2 scan (2026-10-19), via the new reachable-
id filter (`damage-coefficient-completeness.test.ts`): 176 equippable skill ids carried a real,
uncurated Damage fact, spanning several distinct mechanics this app has apparently never swept for
Damage coefficients before — too varied to triage in that scan's own session (confirmed with the
user 2026-10-19), so split by mechanic family. Leg 1 (Ranger Soulbeast Beastmode F1-F3, 42 ids),
Leg 2 (Catalyst's "Deploy Jade Sphere" overloads, 20 ids), Leg 3 (Necromancer Shroud-reuse Downed
skills + Scourge Shade F-skills, 25 ids: 18 curated, 6 minion-summon ids excluded as a new "no
mechanism" Known Exception — minions scale off their own fixed Power, not the player's — and Garish
Pillar excluded for having zero wiki-documented Damage fact at all), Leg 4 (Mesmer core
Shatter + Virtuoso Bladesong skills, 8 ids: Cry of Frustration, Mind Wrack, Rewinder, Split Second,
Bladeturn Requiem, Bladesong Dissonance/Sorrow/Harmony, all curated; plus a zero-research find while
in the file — Rampart Splitter (71875) already had a dated "PvE/WvW sources disagree" exclusion
written directly in `CURATED_DAMAGE_COEFFICIENTS`'s own comments from before this sweep existed,
just never actually logged to TODO.md despite the comment claiming it was — recategorized out of the
generic new-content bucket into its own Known Exception reason instead of re-investigating), and Leg
5 (Engineer Mechanist Mech Core F-skill bar, the 3 ids TODO.md had already named as a family: Crash
Down (63050) and Mech Support: Depth Charges (63210) both curated — wiki confirms both use the
normal player-scaling `weapon=unequipped` param, PvE/WvW 2.5/0.5 and flat 0.5 respectively — while
Jade Buster Cannon (63374) turned out to be a second zero-research find of the same "comment exists,
never logged" shape as Rampart Splitter: its Elite-slot sweep comment already documented the wiki's
`weapon=pet|power=1250` fixed-Power override, re-verified unchanged, and recategorized into its own
Known Exception reason instead of re-investigating), and Leg 6 (Revenant's legend-themed
Profession_2/_3 mechanic-skill family — Herald's Citadel Bombardment (F3), Vindicator's True Nature
(assassin) (F2) plus 4 same-named, zero-Damage-fact siblings confirming only this one Legend-themed
variant deals damage, and 3 of Conduit's 5-Legend "Release Potential" F2 variants (Assassin/Mesmer/
Warrior — Monk/Dervish have no Damage fact) — all 5 wiki-verified and curated. Release Potential:
Warrior (78895) surfaced a live id-reachability conflict: the wiki's own documented `id =` for this
skill's page is 77896, but `profession-mechanic.ts`'s earlier live verification found 77896 is NOT in
Revenant's `professionSkills` at all (an orphaned, never-equippable duplicate) while 78895 is the
real id `CONDUIT_RELEASE_POTENTIAL_BY_LEGEND` resolves to — curated under 78895 instead of the wiki's
own id, and flagged as a new TODO item below since `CURATED_BARRIER_COEFFICIENTS` (barrier-calc.ts)
keys this same skill's Barrier fact to 77896 on the opposite assumption. Also recategorized Conduit's
Hex-Eater Vortex (77243) and Gladiator's Defense (77291), a third "comment exists, never logged" find
of the same shape as Rampart Splitter/Jade Buster Cannon — both wiki pages are still stub-tagged with
no `coefficient=` param, re-verified unchanged, same as `CURATED_DAMAGE_COEFFICIENTS`'s own existing
comment already said) shipped 2026-10-19 — see COMPLETED.md. Leg 7 (2026-10-19) swept the "base
Engineer turret-deploy skills" cluster named below: the 5 canonical turret skills (Rifle/Flame/
Thumper/Rocket/Harpoon Turret) turned out to be a 4th instance of the same "comment exists, never
logged" shape — `damage-calc.ts` already excluded all 5 by name as non-player-scaling (wiki's
`weapon=utility|power=2389` fixed-Power override, confirmed unchanged), just never logged to this
exclusion map. Also found and logged: 5 stale duplicate ids for those same 5 turrets (differing only
by a `GroundTargeted` flag, none named in any turret's own wiki `id =` field — same "wiki's own id=
decides canonical" precedent as Supply Crate's stale 6183 duplicate), and the 2 Sylvari racial
skills in this same non-player-scaling shape (Grasping Vines, Seed Turret) that already had their own
unlogged exclusion comment from the original Racial-slot sweep. No new `CURATED_DAMAGE_COEFFICIENTS`
entries this leg (pure exclusion-map housekeeping) — golden coefficient snapshot unchanged. 12 ids
resolved; shipped 2026-10-19 — see COMPLETED.md. Leg 8 (2026-10-19) swept Mesmer Troubadour's F1-F5
bar (Lively Lute x2, Flustering Flute, Deafening Drum, Crescendo): all 5 ids curated. Found a new
weapon-strength shape along the way — unlike every other profession-mechanic skillbar in this
sweep (all `weapon=unequipped`), Lively Lute's own wiki page documents a conditional
"weapon-equipped vs. not" branch (1034-1166 vs. 656-725 normalised weapon strength, exactly this
app's existing `hammer`/`unequipped` `WEAPON_STRENGTH_MIDPOINTS` midpoints) while its 3 siblings
just tag `weapon=hammer` directly — `hammer` used for all 4 skills since every build this app
models has a weapon equipped. Also confirmed Lively Lute's 2 ids (76552/77306) are the "split id"
pair `sources.ts`'s own boon-calc curation already names (identical Damage fact, no distinguishing
API field) rather than a stale duplicate — both curated identically, not collapsed to one. No
Known Exceptions this leg. Shipped 2026-10-19 — see COMPLETED.md. Leg 9 (2026-10-19) swept
Elementalist Evoker's F5 "Familiar" bar (Conflagration/Seismic Impact/Lightning Blitz — Water's
Buoyant Deluge is the bar's 4th slot but carries no Damage fact at all, already curated elsewhere
as Healing): only Lightning Blitz (77089, Air/hare) curated — no `strikes=` param, but a separate
"Number of Hits" fact (5) plus the wiki's own Notes line ("0.28 coefficient on each of 5 hits, for
a total of 1.4") confirmed the main fact's `coefficient=` is per-hit, not totaled; WvW per-hit
0.1448 × 5 = 0.724 curated. The other 2 are new Known Exceptions, not stale pre-existing comments
this time: Seismic Impact's (76707, Earth/toad) own wiki Mechanics section states outright "the
version of this skill provided by profession skill 5 deals no damage" even though the local API's
facts array carries 2 Damage-type entries for it anyway (inherited from its elite-skill sibling
76681 "Elemental Procession," which does have a real Damage fact) — same "stale/non-authoritative
API fact" shape as Garish Pillar's exclusion, just inherited rather than fabricated; and
Conflagration (76585, Fire/fox) is `{{stub||damage coeff}}`-tagged with a fully-resolved PvE
Damage fact (`weapon=staff|coefficient=1.555`) but only a bare, undecomposed PvP+WvW tooltip
number (562, no `weapon=`/`coefficient=`) — the one gamemode this app curates for has nothing
documented, an asymmetric variant of the Hex-Eater Vortex/Gladiator's Defense stub shape (those
had zero coefficient in any mode). Shipped 2026-10-19 — see COMPLETED.md.
Remaining 50 ids, re-triaged 2026-10-19 after an initial "festival/novelty" mislabel (corrected —
these are real mechanic-skill F-bars this app already supports for every other fact type, just not
yet for Damage; Leg 9 already resolved the Evoker F5 Familiar bar named here previously):
Thief's core "Steal" variant skills themed by stolen-from faction
(Metal Legion Guitar, Zephyrite Sun Crystal x2, Exalted Hammer x2, Forged Surfer Dash x2, Holo-Dancer
Decoy, Summon Kryptis Turret, Unstable Skritt Bomb, Mistburn Mortar), already-named elite specs'
remaining F-skills (Warrior Spellbreaker x6, Guardian Willbender x2, Guardian Firebrand x2, Ranger
Untamed x3, Ranger Soulbeast x3 more beyond Leg 1's Beastmode sweep, Revenant Renegade x1, Revenant
Herald x1, Engineer Scrapper's Function Gyro x3 dup ids), core Elementalist Conjure/Glyph summon
skills (Ice Storm/Lightning Storm/Sandstorm, Glyph of Elemental Power x2, Crashing Waves/Flame
Barrage, Lesser Fiery Eruption), and a handful of racial command-skill ids (professions: [], shared
across all races, same shape as Artillery Barrage above). Full id list in
`damage-coefficient-completeness.test.ts`'s `REASON_NEW_CONTENT_SKILL`-bucketed exclusion entries.
Worth checking `CURATED_DAMAGE_COEFFICIENTS`'s own comments for each remaining id before fresh wiki
research — 4 ids/clusters across Legs 4-7 so far (Rampart Splitter, Jade Buster Cannon, Hex-Eater
Vortex/Gladiator's Defense, and now the turret family) turned out to already have a dated,
still-accurate exclusion comment sitting unlogged from before this completeness sweep existed.
Done check: each id wiki-verified and either added to `CURATED_DAMAGE_COEFFICIENTS` or logged as a
new Known Exception; `damage-coefficient-completeness.test.ts`'s exclusion map shrinks accordingly.
Given the spread, keep splitting this by mechanic family per leg rather than sweeping as one.
Manual verification: no.
Last touched: 2026-10-19. Re-checks: 0.

### [Release Potential: Warrior Barrier Coefficient Keyed to Orphaned Id]
Found while wiki-verifying the Damage sweep's Leg 6 (2026-10-19): `CURATED_BARRIER_COEFFICIENTS`
(`barrier-calc.ts`) keys this skill's Barrier fact to id 77896, with a comment claiming the wiki
infobox's `id =` field makes 77896 canonical and 78895 the "stale/non-canonical" duplicate. But
`profession-mechanic.ts`'s own earlier, more rigorous live verification (`CONDUIT_RELEASE_POTENTIAL_BY_LEGEND`'s
doc comment) found the opposite: 77896 is NOT in Revenant's `professionSkills` at all — a dead,
never-equippable orphan — while 78895 is the id the app's own Legend-swap resolver actually uses and
the one confirmed live in `professionSkills`. The two files' comments directly contradict each
other; `barrier-calc.ts`'s conclusion looks like the wrong one (it never checked `professionSkills`
reachability, only the wiki's bare `id =` field), which would mean the live app currently shows NO
Barrier coefficient for this skill's real, reachable id. Not fixed inline since it's a different
calculator/file than the Damage sweep this was found during.
Done check: confirm which id is actually reachable (should match `profession-mechanic.ts`'s
determination), then re-key `CURATED_BARRIER_COEFFICIENTS`'s entry to the correct id (same
value — 975/0.2 — just moved from 77896 to 78895) and update `barrier-calc.ts`'s comment.
Manual verification: no.
Last touched: 2026-10-19. Re-checks: 0.

### [Trait-Side Damage Proc Tooltip Coverage]
No trait-keyed `CURATED_DAMAGE_COEFFICIENTS` counterpart exists at all — same "no mechanism" gap
`coefficient-completeness.test.ts`'s own header already documents for Barrier/Siphon-Damage on
traits (`trait-fact-lines.ts` only ever calls `healingLinesForTrait`). The Coefficient-Table
Completeness Test's Leg 2 scan (2026-10-19) found 12 trait ids with a genuine Damage fact: Electric
Discharge, Earthen Blast, Mug, Power Block, Soaring Devastation, King of Fires, Photonic Blasting
Module, Loss Aversion, Tenacious Ruin, Explosive Growth, Mistfire, Syncopate.
Done check: each id wiki-verified and either added to a new trait-keyed Damage-coefficient table
(if one gets built) or logged as a Known Exception; `damage-coefficient-completeness.test.ts`'s
`REASON_NO_TRAIT_MECHANISM` exclusions shrink accordingly.
Manual verification: no.
Last touched: 2026-10-19. Re-checks: 0.

### [Healing/Barrier/Siphon Coefficient Sweep Refresh]
Found by the Coefficient-Table Completeness Test's Leg 1 scan (2026-10-19): 51 distinct equippable
skill ids with a real, uncurated Healing/Barrier/Siphon-Damage fact (one of them, Vampiric
Predation #80985, carries both an uncovered Healing- and an uncovered Siphon-shaped fact, so it's
excluded from both pools but counted once here), none of which match any name already
curated in `healing-calc.ts`/`barrier-calc.ts`/`siphon-damage-calc.ts` — newer content than the
original 2026-08 sweeps, never wiki-verified (e.g. Bloodthirster, Path to Victory, Willbender
Flames, Super Elixir, Wings of Resolve, Buoyant Deluge, Exalted Hammer, Harmonious Harp; full id
list in `coefficient-completeness.test.ts`'s `NEW_CONTENT_SKILL`-bucketed exclusion entries).
Deferred rather than wiki-verified inline per this leg's own scope limit.
Done check: each id wiki-verified and either added to the relevant curated table or logged as a new
Known Exception; `coefficient-completeness.test.ts`'s `NEW_CONTENT_SKILL` exclusions shrink
accordingly.
Manual verification: no.
Last touched: 2026-10-19. Re-checks: 0.

### [Trait-Side Heal/Barrier/Siphon Proc Tooltip Coverage]
`CURATED_TRAIT_HEALING_COEFFICIENTS` has exactly 1 entry (Healing Ripple, #351) — built as a proof
of concept, not a sweep. The Coefficient-Table Completeness Test's Leg 1 scan (2026-10-19) found 11
more trait ids with a genuine, uncurated Heal/Barrier-on-X proc coefficient (Compounding Chemicals,
Vigorous Shouts, Elevated Compassion, Last Rites, Blast Shield, Elemental Refreshment, Alchemic
Vigor, Conceited Curate, Redemptor's Sermon, Natural Fortitude, Hybrid Vigor) plus 1 Siphon-Damage
one (Natural Fortitude again, its damage half) that has no trait-keyed table at all. Confirms the
systemic gap `CURATED_TRAIT_HEALING_COEFFICIENTS`'s own doc comment already flagged, now with a
concrete candidate list.
Done check: each id wiki-verified and either added to `CURATED_TRAIT_HEALING_COEFFICIENTS` (or a
new trait-keyed Siphon-Damage table, if one gets built) or logged as a Known Exception;
`coefficient-completeness.test.ts`'s `NEW_CONTENT_TRAIT` exclusions shrink accordingly.
Manual verification: no.
Last touched: 2026-10-19. Re-checks: 0.

### [Cross-Pipeline Tooltip Consistency Test] — Leg 1
Build a registry-driven test catching the recurring "fixed the aggregate/named-fact pipeline but
forgot the separate per-skill tooltip renderer" bug class (happened twice: Cleansing Ire, Specter
Siphon F1) — `skillFactLines`/`traitFactLines`'s generic fact loop has no structural link to
`computeNamedFactSources`'s raw-fact correction tables. Boon/condition tooltip rendering itself is
already safe (both paths call the same shared `extractFromFacts`) — this is narrower, scoped only
to the unsynced generic-fact-loop path. Design (registry shape, exact file:line citations for the
Cleansing Ire fix) already done: `docs/investigations/data-completeness-test-coverage.md`.
Done check: new test passes against the existing (already-fixed) Cleansing Ire case, establishing
the mechanism for future corrections of this shape.
Manual verification: no. Review: yes (links two separately-maintained pipelines).
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
