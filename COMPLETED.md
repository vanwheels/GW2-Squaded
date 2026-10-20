# Completed

Entries are added as work lands, most recent first.

Everything through "Tooling & Cleanup" (shipped 2026-10-19, Prettier Adoption + Project Cleanup and
the Light Aura Squad Builder Bug investigation) is archived in
`docs/archive/completed-2026-10-19-to-2026-10-19.md`.
Everything through "Project Revision v2" (shipped 2026-10-19), plus the 4 milestones before it that
had fallen behind on archiving (Auto-Update Check, Web App Port, Sync Backend Foundation,
Continuous Cross-Device Sync) and Polish/Parity's completed Legs 1-2, is archived in
`docs/archive/completed-2026-09-29-to-2026-10-19.md`.
Everything through the "Known Exceptions Sweep" milestone (shipped 2026-09-29) is archived in
`COMPLETED-archive-known-exceptions-sweep.md`.
Everything through the "Sep 15, 2026 patch + fixes" milestone (shipped 2026-09-16) is archived in
`COMPLETED-archive-sep-15-2026-patch.md`.
Everything before that, back through v1.0.0, is in `COMPLETED-archive-pre-1.0.md`.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 5 (2026-10-19)
Wiki-verified the Engineer Mechanist Mech Core F-skill bar family TODO.md had already named: Crash
Down (63050) and Mech Support: Depth Charges (63210) both curated (PvE/WvW 2.5/0.5 and flat 0.5;
wiki confirms both use the normal player-scaling `weapon=unequipped` param, unlike their sibling).
Jade Buster Cannon (63374) turned out to be a second instance of the same "comment exists, never
logged" shape Rampart Splitter hit in Leg 4 — its Elite-slot sweep comment in `damage-calc.ts`
already documented the wiki's `weapon=pet|power=1250` fixed-Power override from before this
completeness sweep existed; re-verified unchanged and recategorized into its own Known Exception
reason instead of re-investigating. Golden coefficient snapshot updated for the 2 new curated
entries. 77 of the Leg 4 remainder's 80 ids left, still under the same TODO item, now Leg 6. Full
suite (625 tests), lint, and typecheck all pass. See commit b6081c1c0218d4321151b882432fba96a0c368b9.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 4 (2026-10-19)
Wiki-verified the Mesmer core Shatter + Virtuoso Bladesong family named in the Leg 3 remainder:
Cry of Frustration/Mind Wrack (core F2/F1), Rewinder/Split Second (Mirage's replacements for them),
and Bladeturn Requiem/Dissonance/Sorrow/Harmony (Virtuoso F5/F3/F2/F1). All 8 added to
`CURATED_DAMAGE_COEFFICIENTS` (WvW values; Mind Wrack/Split Second each needed 3 clone-count-tiered
entries rather than 1). 4 of the 8 also carry an Infinite Forge (trait 2206) requires_trait-gated
override in the local API data; left uncurated for all 4 rather than partially — Infinite Forge's
documented flat +7%/+10% PvE/WvW bonus cleanly reconstructs 2 of the 4 (Bladeturn Requiem,
Dissonance) but not the 3rd (Bladesong Sorrow), an unreconciled source disagreement.
Also recategorized Rampart Splitter (71875) out of the generic new-content exclusion bucket into
its own Known Exception reason — its PvE/WvW source-disagreement analysis already existed as a
dated comment in `CURATED_DAMAGE_COEFFICIENTS` from before this sweep, it just was never actually
logged to TODO.md despite the comment's own claim that it was; no re-investigation needed; a pure
bookkeeping fix found while in the file for this leg's own reason-constant work.
80 of the Leg 3 remainder's 89 ids left (minus these 8 curated and 1 recategorized), re-split by
mechanic family under the same TODO item, now Leg 5. Full suite (625 tests), lint, and typecheck
all pass. See commit e3b8e50d08ac51318b05cb7f27d37884a54ecabb.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 3 (2026-10-19)
Wiki-verified the 25 Necromancer ids left in the Leg 2 find: Shroud-reuse Downed skillbar skills
(vanilla Life Blast/Dark Water/Wave of Fear/Plague Blast, Reaper's Life Rend/Soul Spiral/Death's
Charge reskins, Harbinger's Tainted Bolts/Dark Barrage/Essence Blast reskins), Reaper/Harbinger's
actual in-Shroud weapon-5 skills (Executioner's Scythe, Vital Draw), Scourge's shade F-skills
(Manifest Sand Shade, Desert Shroud, Garish Pillar), Well of Darkness, and the base minion-summon
utility skills (Summon Bone Fiend/Bone Minions/Flesh Wurm/Blood Fiend/Shadow Fiend/Flesh Golem).
18 added to `CURATED_DAMAGE_COEFFICIENTS` (all WvW values per the table's standing convention).
7 logged as new Known Exceptions instead: the 6 minion summons (each wiki page documents the
minion's own fixed level-80 Power with no `weapon=` tag at all — same "no mechanism" shape as the
Beastmode-pet exclusion from Leg 1, now generalized to a second reason bucket,
`REASON_NO_MINION_POWER_SCALING`) and Garish Pillar (Scourge F4 — its live wiki page documents zero
Damage facts at all; the local API's own Damage fact has no wiki corroboration and is presumed
stale). 89 of the original 176-id find remain, re-split by mechanic family under the same TODO
item, now Leg 4. Full suite (625 tests), lint, and typecheck all pass. See commit
001f4df131e8ffcf8e2aa23c45ec61b980e04e0b.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 2 (2026-10-19)
Wiki-verified all 20 Catalyst "Deploy Jade Sphere" ids the Coefficient-Table Completeness Test's
Leg 2 scan found uncurated (4 attunements — fire/water/air/earth — x 5 ids each). Each attunement's
own wiki page (the base skill name is a disambiguation page) documents an identical
`weapon=unequipped`, 0.25 PvE / 0.01 WvW+PvP coefficient, confirmed via raw wikitext on all 4 pages
rather than assumed from one. Added all 20 to `CURATED_DAMAGE_COEFFICIENTS` using the WvW value per
this table's standing convention — no Known Exceptions needed this leg. Each page's own `id =`
comment names only 4 of its 5 ids (base, "no energy id", "underwater", "sphere specialist"); the
5th (75395 fire, 75392 water, 75394 air, 75407 earth) isn't named in any comment but carries the
identical, ungated Damage fact as its documented siblings, so it was curated the same way rather
than excluded. 114 of the original 176-id Leg 2 find remain, re-split by mechanic family under the
same TODO item, now Leg 3. Full suite (625 tests), lint, and typecheck all pass. See commit
dcaa821936a2f6a803060c0d4c901fedfe771d82.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 1 (2026-10-19)
Wiki-verified all 42 Ranger Soulbeast Beastmode F1-F3 skill ids the Coefficient-Table Completeness
Test's Leg 2 scan found uncurated (one per equipped pet family, `data/game-data/soulbeast-
beastmode.json`). Several plain-named skills (Bite, Chomp, Tail Lash, Brutal Charge, Charge, Dash,
Slam) required finding the correct soulbeast-specific wiki page behind a disambiguation page or a
same-named base ranger pet skill with a different id, confirmed against each page's own `| id = `
field. Added 40 to `CURATED_DAMAGE_COEFFICIENTS` (WvW value used for every PvE/WvW-split skill, per
this table's standing convention). Logged the remaining 2 (Siege Turtle's Slam/Heavy Shot) as new
Known Exceptions in `damage-coefficient-completeness.test.ts` instead of guessing: both tag
`weapon=pet` on their wiki page, and `WEAPON_STRENGTH_MIDPOINTS` has no constant for it (the wiki's
own Weapon Strength page: pet skills "use their own weapon strengths," per-species rather than a
single value like `unequipped`/`kit`/`conjure`). 134 of the original 176-id Leg 2 find remain,
re-split by mechanic family under the same TODO item, now Leg 2. Full suite (625 tests), lint, and
typecheck all pass. See commit 32c3b4854b1334b49469f9efd22d5e066854bc32.

### Coefficient-Table Completeness Test — Leg 2 (2026-10-19)
Built `src/shared/skill-calc/damage-coefficient-completeness.test.ts` for
`CURATED_DAMAGE_COEFFICIENTS`, the 5th and final table of this milestone's scope. Built the
reachable/equippable-id filter Leg 1 deferred (ids listed in `professions.json`'s `weapons[*].
skills`/`professionSkills`, or tagged `Heal`/`Utility`/`Elite` in `skills.json`'s `slot` field) as
self-contained test logic rather than a new `src/shared` runtime module, matching every other
completeness test's own pattern — confirmed via a dry run it has one known scope gap (bundle-
reachable Kit/Conjure/Dragon-Slash ids aren't in the filter) that hides zero real misses today.
Shrunk the naive 745-candidate problem to 267; 91 resolved as structurally-provable duplicates/
non-equippable ids (same-name sibling already curated, flip-target, turret/gadget sub-ability,
weapon- or mechanic-slot duplicate), the remaining 176 (42 Soulbeast Beastmode + 134 spanning
Shroud/Shatter/Jade Sphere/Mech Core/Revenant-legend/festival content) confirmed with the user as
too varied to triage inline and deferred to two new TODO items ([Damage Coefficient Sweep — New/
Uncurated Skill Content], [Trait-Side Damage Proc Tooltip Coverage]) rather than guessed at. Full
suite (625 tests), lint, and typecheck all pass. See commit bd0d14e.

### Coefficient-Table Completeness Test — Leg 1 (2026-10-19)
Built `src/shared/skill-calc/coefficient-completeness.test.ts`, mirroring `trait-attribute-
completeness.test.ts`'s shape, for `CURATED_HEALING_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`/
`CURATED_TRAIT_HEALING_COEFFICIENTS`/`CURATED_SIPHON_DAMAGE_COEFFICIENTS` (4 of the originally
scoped 5 tables). Split `CURATED_DAMAGE_COEFFICIENTS` into its own Leg 2 after a dry-run scan found
its naive candidate predicate matches 1,666 skills against only 931 curated — most of the 745
"uncovered" hits are structurally unreachable (chain-continuation/duplicate-tier ids, NPC/pet
skills), needing a new equippable-id filter before the predicate means anything. Every real hit
from the 4 shipped tables' scan (280 total candidates) got a recorded decision: known exceptions,
structurally-unreachable buckets (downed-state, pet, orphan, chain/duplicate ids), traits already
categorized by the sibling attribute-completeness test, or a genuine backlog deferred to two new
TODO items ([Healing/Barrier/Siphon Coefficient Sweep Refresh], [Trait-Side Heal/Barrier/Siphon
Proc Tooltip Coverage]) rather than wiki-verified inline. Full scan numbers and the Damage-leg
split rationale: `docs/investigations/data-completeness-test-coverage.md`. Lint, typecheck, and the
full test suite (619 tests) all pass. See commit
`53fd58f131d5010dd6d23a3f3c971dfb3ef37fac`.
