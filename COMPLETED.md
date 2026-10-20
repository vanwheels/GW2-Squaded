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

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 11 (2026-10-19)
Swept the Elementalist core Glyph/Conjure cluster (8 ids). 3 (Crashing Waves 25492/Flame Barrage
25499/Lesser Fiery Eruption 44918) were a 5th instance of this sweep's "comment exists, never
logged" shape — `CURATED_DAMAGE_COEFFICIENTS`'s own Elite-slot sweep comment already excluded all 3
as non-player-scaling, just never logged to TODO.md. The other 5 (Ice Storm 5735/Lightning Storm
5737/Sandstorm 5738, Glyph of Elemental Power's Air/Fire 34637/34736) are Glyph attunement variants
— checking why they weren't already excluded surfaced a real, previously-unfixed live picker bug:
Ice Storm/Lightning Storm/Sandstorm each describe their effect under their own distinct flavor name
rather than "Glyph of Storms," so `skill-variants.ts`'s attunement-collapse signal never collapsed
their singleton-member groups, letting all 3 leak into the live Utility picker as independently-
equippable skills. Fixed by adding them to `NON_EQUIPPABLE_SKILL_IDS`, with a new regression test
(`glyph-attunement-variants.test.ts`). Glyph of Elemental Power's Air/Fire variants were NOT
affected by this bug (already correctly collapsed via name-sharing with their canonical sibling).
Also corrected a stale "likely still leaks" claim in `damage-calc.ts`'s Lesser Fiery Eruption
comment — that picker fix had already landed. No new `CURATED_DAMAGE_COEFFICIENTS` entries (pure
exclusion-map + picker-bug fix); golden coefficient snapshot unchanged. Checked the Warrior
Spellbreaker Burst-skill cluster (6 ids) while here: no wiki page exists for any of them yet
(too new for the wiki), left open rather than guessed at. Full suite (629 tests), lint, and
typecheck all pass. See commit 1e5dd7c66fdcd45f8ed160d67e7eeb6bd92631a0.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 10 (2026-10-19)
Wiki-verified the 11-id cluster TODO.md had labeled "Thief's core Steal variant skills themed by
stolen-from faction" — that label was an approximation: it's Thief's Antiquary elite spec's Steal
replacement (Skritt Swipe), which grants a random "Artifact" skill to F2 (always Offensive)/F3
(always Defensive). 10 of 11 ids curated: Forged Surfer Dash (land 76633 + underwater 76550, each
with its own distinct, never-synced facts), Metal Legion Guitar (76582), Exalted Hammer (land 76702
+ underwater 76601, identical facts), Holo-Dancer Decoy (76800, whose wiki Bug note overrides the
template's `weapon=hammer` tag with `unequipped` — the only id in this cluster where that applies),
Summon Kryptis Turret (76900, underwater id; land id 77192 is a stale orphan not in
`professionSkills`), Unstable Skritt Bomb (76909), Mistburn Mortar (77288, same orphaned-land-id
shape as the turret), Zephyrite Sun Crystal (76733, current/live id; land id 76895 from the wiki's
own `id=` field is the stale orphan here). The 11th, Zephyrite Sun Crystal's second id (78309), is a
new Known Exception: not named in the wiki's own `id=` field at all, and its facts match the
skill's pre-2026-01-13-rework shape exactly (old radius, `StunBreak: true`) rather than the live
skill's post-rework facts (blind + condition removal, no stun break) — same "wiki's id= decides
canonical" shape as the Release Potential: Warrior/turret-family exclusions, just for a mid-life
rework. 11 ids resolved (10 curated, 1 excluded); golden coefficient snapshot updated (10 new
Damage entries). Full suite (625 tests), lint, and typecheck all pass. See commit
575a7e32f03e2b7703635a30013c4c3d2c95886f.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 9 (2026-10-19)
Wiki-verified Elementalist Evoker's F5 "Familiar" bar: Conflagration (76585, Fire/fox), Seismic
Impact (76707, Earth/toad), Lightning Blitz (77089, Air/hare) — Water's Buoyant Deluge (76811) is
the bar's 4th slot but carries no Damage fact at all (already curated elsewhere as Healing). Only
Lightning Blitz curated: no `strikes=` param, but a separate "Number of Hits" fact (5) plus the
wiki's own Notes line ("0.28 coefficient on each of 5 hits, for a total of 1.4") confirmed the main
fact's `coefficient=` is per-hit, not pre-totaled — WvW per-hit 0.1448 × 5 = 0.724 curated. The
other 2 are new Known Exceptions (not stale pre-existing comments this time): Seismic Impact's own
wiki page states outright its F5 version "deals no damage" even though the local API carries 2
Damage facts for it anyway (stale, inherited from its elite-skill sibling 76681 "Elemental
Procession," which does have a real Damage fact); Conflagration is `{{stub||damage coeff}}`-tagged
with a fully-resolved PvE coefficient (`weapon=staff|coefficient=1.555`) but only a flat,
undecomposed PvP+WvW tooltip number (562) — the gamemode this app curates for has nothing
documented, an asymmetric variant of the Hex-Eater Vortex/Gladiator's Defense stub shape (those had
zero coefficient in any mode). 3 ids resolved (1 curated, 2 excluded); golden coefficient snapshot
updated (1 new Damage entry). Full suite (625 tests), lint, and typecheck all pass. See commit
dce2ee2d6e25312b96745aad76b6d3ab97cfe9d2.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 8 (2026-10-19)
Wiki-verified Mesmer Troubadour's F1-F5 bar: Lively Lute (76552, F1), Flustering Flute (76746, F2),
Deafening Drum (77079, F3), Crescendo (76931, F5) — all curated. Found a new weapon-strength shape:
unlike every other profession-mechanic skillbar curated so far in this sweep (all
`weapon=unequipped`), Lively Lute's own wiki page documents a conditional "weapon-equipped vs. not"
branch in its Mechanics section ("If a weapon is equipped the damage uses a normalised weapon
strength of 1034-1166[, i]f no weapons are equipped, the following weapon strength is used:
656-725") — those two ranges' midpoints (1100, 690.5) are exactly this app's existing
`hammer`/`unequipped` `WEAPON_STRENGTH_MIDPOINTS` entries, and its 3 siblings skip the conditional
phrasing and tag `weapon=hammer` directly on their own Damage facts. Since every build this app
models has a weapon equipped, `hammer` was used for all 4 skills rather than `unequipped`. Also
confirmed Lively Lute carries 2 ids (76552/77306, identical Damage fact, no distinguishing API
field) matching the "split id" pair `sources.ts`'s own boon-calc curation (Might/Quickness grants)
already names for this exact skill — both curated identically rather than treating one as a stale
duplicate, which would have silently left the other's live tooltip uncovered. No Known Exceptions
this leg. 5 ids resolved; golden coefficient snapshot updated (4 new Damage entries). Full suite
(625 tests), lint, and typecheck all pass. See commit 92a24d9d9aded7272adc7d305085d43bbd75abc9.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 7 (2026-10-19)
Wiki-verified the "base Engineer turret-deploy skills" cluster TODO.md had already named: Rifle
Turret (5818), Flame Turret (5836), Thumper Turret (5838), Rocket Turret (5912), and Harpoon Turret
(6093) turned out to be a 4th instance of the sweep's recurring "comment exists, never logged" shape
— `damage-calc.ts` already excluded all 5 by name (wiki's `weapon=utility|power=2389` fixed-Power
override on each turret's Damage fact, confirmed unchanged via fresh wikitext, plus the wiki's
general Turret page still stating turrets are "unaffected by character's stats" outside boon/
condition application), just never logged to `damage-coefficient-completeness.test.ts`'s exclusion
map. Also found and logged 5 stale duplicate ids for those same turrets (5987/5989/5990/5991/22574 —
identical name and Damage fact, differing only by a `GroundTargeted` flag, none named in any turret's
own wiki `id =` field — same "wiki's own id= decides canonical" precedent as Supply Crate's stale
6183 duplicate), and 2 Sylvari racial skills in the same non-player-scaling shape (Grasping Vines
12453, Seed Turret 12456) that already had their own unlogged exclusion comment from the original
Racial-slot sweep. No new `CURATED_DAMAGE_COEFFICIENTS` entries this leg — pure exclusion-map
housekeeping, golden coefficient snapshot unchanged. 12 of the Leg 6 remainder's 70 ids resolved, 58
left, still under the same TODO item. Full suite (625 tests), lint, and typecheck all pass. See
commit 0a08e7ec54024d7415e90eeae1a123490d1ae5cc.

### Damage Coefficient Sweep — New/Uncurated Skill Content — Leg 6 (2026-10-19)
Wiki-verified Revenant's legend-themed Profession_2/_3 mechanic-skill family: Herald's Citadel
Bombardment (F3, PvE/WvW 0.6/0.225), Vindicator's True Nature (assassin) (F2, no split, 1.0 —
confirmed its 4 same-named Legend siblings carry zero Damage fact, so only this one does damage),
and 3 of Conduit's 5-Legend "Release Potential" F2 variants (Assassin 1.35, Mesmer 1.1, Warrior
0.825 WvW values; Monk/Dervish have no Damage fact). All 5 added to `CURATED_DAMAGE_COEFFICIENTS`.
Release Potential: Warrior surfaced a cross-file id-reachability conflict: `barrier-calc.ts` keys
this same skill's Barrier fact to 77896 (the wiki's own documented id) on the assumption that it's
canonical and 78895 is a stale duplicate, but `profession-mechanic.ts`'s earlier live verification
found the opposite — 77896 isn't in Revenant's `professionSkills` at all, 78895 is. Curated the
Damage fact under 78895 (the reachable id) and logged the Barrier-side conflict as a new TODO item
rather than fixing it in this leg (different calculator/file). Also recategorized Conduit's
Hex-Eater Vortex (77243) and Gladiator's Defense (77291) — a third "comment exists, never logged"
find of the Rampart Splitter/Jade Buster Cannon shape: both wiki pages are still stub-tagged with no
`coefficient=` param, re-verified unchanged. Golden coefficient snapshot updated for the 5 new
curated entries. 70 of the Leg 6 remainder's ids left, still under the same TODO item. Full suite
(625 tests), lint, and typecheck all pass. See commit 452a79d8588cc0a44d3c80072e65e469c81ee019.

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
