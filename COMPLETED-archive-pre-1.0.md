# Completed (pre-1.0 archive)

Everything before the v1.0.0 release (2026-08-15). Continues in `COMPLETED.md`. Entries are most recent first (i.e. closest to the release at the top).

### v1.0.0 release — 2026-08-15
Cut the 1.0 release per the 2026-08-12 goal: both blocking gaps (visual click-through pass, automated test suite) had already closed 2 days earlier, so this was the mechanical version bump and README update marking roadmap items 1-4 (scaffolding, build editor + boon/condition calculator, squad preview builder, sync/share backend) as released. See commit `82cf9a7`.

### Food catalog: closing the 76-buffless-entries TODO item — 2026-08-15
Investigation found a real sibling-matching bug (2 missing prefixes) accounting for 9 items, then wiki-verified the rest split into ~18 real buffless-in-API food items (hand-curated) and 48 genuinely-not-food items (excluded). Result: 859→811 Food entries, 0 buffless. See commit `1e722c4`.

### Food/Utility per-item rarity, closing the tooltip visual-pass item — 2026-08-15
Closes the last piece of the tooltip visual pass: Food/Utility are the only gear-upgrade categories whose real rarity varies per item, so they'd been left title-only; wired `Consumable.rarity` through from data already present in the cached raw API dump. See commit `2be147c`.

### Equipment editor "Clear All" buttons — 2026-08-15
Panel-level clears for Armor/Accessories/Weapon plus per-upgrade-type clears (Rune/Sigil/Infusion) on the copy-paste bar. See commit `c581568`.

### Seize the Moment: occurrence-indexed WvW instance-value overrides — 2026-08-15
Closes the last of 3 "new attribute-bonus gaps needing new CombatState infra" items. The trait grants 2 different Quickness concepts sharing one status with no discriminator, which the existing per-status WvW override mechanism structurally can't express; built a new occurrence-indexed override mechanism to resolve it. See commit `673fe8c`.

### Deadly Strength: new `deathsCarapaceStacks` CombatState field — 2026-08-15
2nd of the 3 attribute-bonus infra items. A fresh wiki check found Death's Carapace has its own baseline Toughness-per-stack grant separate from the trait's own bonus; added a manual "what-if" stepper field, same pattern Kalla's Fervor already established for an untracked resource. See commit `1bc66bd`.

### Power Overwhelming: might-threshold + attunement-doubled Power bonus — 2026-08-15
1st of the 3 attribute-bonus infra items; needed no new CombatState field since both inputs (Might stacks, active attunement) already existed. See commit `c515996`.

### Problem 3 of the dodge-roll item: relic dodge-triggers — 2026-08-15
Closes the 3-part dodge-roll item. Found the relevant relic data was already correctly curated and shown on the gear-picker tooltip — the only real gap was a missing surface to see it without opening the picker, reusing the indicator component from problem 2. See commit `a057f31`.

### Problem 2 of the dodge-roll item: Vindicator + Daredevil dodge indicator — 2026-08-15
Built a small above-skill-bar indicator for whole alternate dodge-replacement mechanics with no skill id in the API at all, scoped to Vindicator + Daredevil (Mirage Cloak excluded as a much larger separate feature); every number hand-verified against a throwaway formula script. See commit `d98d769`.

### Dodge-trigger labeling: terminology re-sweep — 2026-08-15
Re-ran the labeling sweep with a wider net (`mirage cloak|evade|evasion|death drop`, not just `dodge`), finding 4 more genuine labeling gaps. See commit `d98d769`.

### Dodge-trigger labeling: the "~10 more Dodging-worded traits" follow-up leg — 2026-08-15
Closed the last open piece of problem 1: triaged the ~10 remaining `/dodg/i`-matched traits the original sweep's narrower regex missed, finding 3 more genuine gaps. See commit `22fa8b4`.

### Correction: Saint of zu Heltzer's Alacrity fix was wrong, reverted — 2026-08-15
Same-day user catch via a wiki screenshot: the trait's Alacrity grant is PvE-only with no WvW value at all, not a PvE/WvW split — the earlier fix had bypassed the existing (correct) omit-resolution by re-keying the fact under the trait's own id. Reverted.  See commit `6c2c54d`.

### Two more dodge-trigger calc gaps, found via a sweep-methodology bug — 2026-08-15
User-flagged Vindicator traits led to the real root cause: the original dodge sweep searched for the substring "dodge", which never matches "Dodging" — both traits' real facts (on separate un-equippable proc skills) had simply never been considered. Fixed the same way as the prior session's spin-off. See commit `8c0abe9`.

### Dodge-trigger calc gap fix (spin-off from the dodge-roll labeling sweep) — 2026-08-15
Warrior's Reckless Dodge and Saint of zu Heltzer's own real Might/Alacrity facts live on separate un-equippable "proc skill" entities the aggregate calc never reaches; built a new `synthetic-trait-facts.json` merge mechanism (parallel to the existing skill-level one) to fix it. See commit `3e4c148`.

### Dodge-roll trigger labeling (problem 1 of the dodge-roll item) — 2026-08-15
Labels boons/conditions in the aggregate panel that only apply "on dodge," which previously looked identical to an unconditional source once pooled. Full 28-candidate investigation found 9 real labeling gaps, 2 genuine calc gaps (spun off separately), and several already-correctly-excluded shapes. See commit `46e8da2`.

### `MISCELLANEOUS_MATCHERS`/`CONTROL_MATCHERS` WvW-override gap — 2026-08-15
The Control/Miscellaneous/Strip-Corrupt-Cleanse fact pipeline had no WvW-override concept at all, unlike the boon/condition path; fixed by threading the same override map through, plus curated the motivating case (Liberating Liaise's Superspeed split). See commit `e1bcf63`.

### Flat critical-hit-chance trait sweep — 2026-08-15
Full 26-candidate scan for crit-chance traits found 5 fitting existing CombatState infra, curated into 3 new tables; the other 15 (foe-state-gated or resource-gated) have no infra to hang on yet, captured by a new permanent completeness test instead of a TODO list. See commit `dfb81c2`.

### Fix: Elementalist Evoker's Familiar (F5) now contributes to the aggregate Boon/Condition panel — 2026-08-15
Closed the one gap deliberately deferred from the profession-mechanic-bar fix: threaded `Familiar[]` data down to the aggregate functions that needed it. See commit `54161f5`.

### Fix: one-handed main-hand weapon with no off-hand wrongly mirrored into aggregate totals — 2026-08-15
Same bug shape as an earlier Revenant fix, in a different code path: the aggregate-totals function was missing the two-handed-weapon guard the on-screen skill bar already had. Swept for and confirmed no other unguarded fallback exists in the codebase. See commit `7c5a28c`.

### Fix: profession-mechanic-bar skills entirely missing from the aggregate Boon/Condition panel — 2026-08-15
Much bigger than the prior session's Chants fix: every profession's plain F-buttons had never contributed their real facts to the aggregate calc at all. Fixed the id enumeration, plus a new `countsTowardTotals` flag so a defensibly "always true" curated branch (like a Chant's best-maintained tier) can count too. See commit `719a13f`.

### Fix: profession-mechanic-bar tooltips never rendered `branchConditionalFacts` — 2026-08-15
User-reported immediately after the prior session shipped: the F1-F5 mechanic-bar tooltip builder never called the branch-rendering helper at all, silently hiding every curated branch section on any skill only reachable through that bar (also broke the untouched-until-now Warrior Burst Skill chain). See commit `129037b`.

### Paragon's Chant-modifying traits (5 traits, closes the Motivation-tiered Chants item) — 2026-08-15
Investigated all 5 rather than assuming a shared mechanism: 2 were already fully correct, 1 needed a small dedup fix, 1 needed a new hand-curated numeric-fact WvW-override table, 1 stayed genuinely blocked (logged), and 1 needed a proper new branch-conditional-trait-facts mechanism. See commit `23a37c0`.

### Paragon's Chant skills (Motivation-tiered Refrain effects) — 2026-08-15
Curates all 3 Chant skills, whose live API facts stop at Recharge/Radius, via wiki-verified branch sections for each escalating Motivation tier — turned out to need no new CombatState field since the branches are tooltip-only, same as Otherworldly Bond. See commit `48707e8`.

### Build "last updated" framed against GW2 balance patches — 2026-08-15
A build's card now flags "Not reviewed since latest patch" when it was last saved under an older game-data build than the one currently loaded, via a new `updatedAtGw2Build` field. See commit `400fb2a`.

### Bladesworn's Sharp as the Wind / River's Flow Dragon Slash branches — 2026-08-15
Closes the follow-up spun off by the Warrior Burst Skill sweep's last leg: wiki-verified all 6 trait-reflavored variant ids and curated their damage/healing coefficients, reusing the branch-section mechanism for the condition-branch's double-Burning-fact shape. See commit `baa80f1`.

### Elementalist Evoker familiars: same-name flip-pair item's last leg (now fully closed) — 2026-08-14
The last 4 of 10 same-name flip pairs needed a different mechanism than the other 6 (a swap, not a diff, since the base ids are nearly empty) — fresh wiki text confirmed which gated bonuses have no matching API fact at all and were left honestly unrepresented rather than guessed. See commit `92cd0ed`.

### Bladesworn's Dragon Slash chain: Warrior Burst Skill sweep's last leg — 2026-08-14
Closes the Warrior Burst Skill damage-coefficient item. Dragon Trigger's real burst damage lives on 3 hand-authored skill ids entirely absent from the public API (same gap shape as Gunsaber); curated Minimum/Maximum damage pairs for all 3. See commit `7f2ae32`.

### Revenant scepter 2/3 tooltip fixes: Blossoming Aura declutter + Otherworldly Bond re-curation — 2026-08-14
User-flagged, with reference screenshots: fixed Blossoming Aura's unfiltered duplicate/mislabeled percent facts via a new curated-override table, and reopened Otherworldly Bond's earlier "not curatable" conclusion using the newer synthetic-facts pattern plus a real in-game screenshot showing how the client resolves the branch. A same-day correction caught that the first draft had transcribed live-scaled numbers off the screenshot instead of wiki base values — re-fetched and fixed, establishing the standing lesson that a screenshot confirms which facts exist, never the base numbers themselves. See commits `2b22590` and `83f68fa`.

### Same-name flip-pair divider rendering (6 of 10 pairs) — 2026-08-14
Built the "When Enhanced" divider the classification sweep had been waiting on, for the 6 confirmed-additive pairs whose target genuinely adds new content on top of the base (Revenant's Band Together family, Guardian's Crashing Courage). The delta is computed live against the current build's own scaled numbers, not hand-transcribed. Elementalist's 4 attunement-familiar pairs deliberately excluded — a live wiki check found they need a hand-curated per-fact split, not an automatic diff, since the base id's own content is incomplete rather than empty. See commit `4fa7488`.

### Same-name flip-pair classification sweep, Mesmer leg (sweep COMPLETE) — 2026-08-14
Final leg (Revenant/Elementalist/Warrior/Guardian/Mesmer): all 4 Mesmer pairs excluded, surfacing a 4th shape (a recharge-reduced variant under an always-on minor trait). Confirmed-additive pool holds at 10 pairs total across all 5 legs. See commit `0759f68`.

### Same-name flip-pair classification sweep, Guardian leg — 2026-08-14
15 pairs classified: 10 excluded (byte-identical or a mode split), 2 genuinely additive (Crashing Courage, bringing the additive pool to 10), 3 out of scope entirely (a genuine multi-stage replace, and Radiant Forge's mode-select mechanic). See commit `af7fdc6`.

### Same-name flip-pair classification sweep, Warrior leg — 2026-08-14
Overturned the sweep's own working hypothesis for this pool (guessed mutually-exclusive adrenaline tiers; wiki-confirmed the 3 tiers actually report together on one skill id already) — 12 of 13 pairs turned out to be the ordinary duplicate-id shape, 1 left open as a genuine apply-count mismatch. See commit `d000397`.

### WvW mode-dependent boon-swap bug: Grace of the Land + Stretched Time fixed — 2026-08-14
2 of the 3 traits the trait-granted-boons sweep left open as "needs new infra" turned out to fit the existing single-value-per-status override after all — the mechanism wasn't missing, the entries just hadn't been added. Seize the Moment stays genuinely blocked (2 concepts sharing one status, needing a new occurrence-indexed mechanism, built the next day). See commit `98705f0`.

### Trait-granted-boons-on-skills sweep, Warrior leg (9th and final leg) — sweep complete — 2026-08-14
Closes all 9 profession legs of this sweep. 8 traits curated, including Heat the Soul's mirror onto all 79 Burst-category skill ids game-wide, the leg's largest single mirror. Confirms the original 48-candidate scoping estimate was wrong on literally every leg. See commit `8ec41a9`.

### Trait-granted-boons-on-skills sweep, Thief leg (8th leg) — 2026-08-14
7 traits curated via `synthetic-facts.json`, including a 3-trait "when you steal" cluster mirrored onto all 4 Steal-mechanic variants. See commit `a72fac2`.

### Trait-granted-boons-on-skills sweep, Revenant leg (7th leg) — 2026-08-14
Rescan caught a bug in the sweep's own candidate-discovery script (wrong field-name casing had silently excluded 10 already-correctly-linked traits); 8 traits curated including a 4-trait "invoke a legend" cluster mirrored onto all 10 legend-swap skill ids. See commit `2769957`.

### Trait-granted-boons-on-skills sweep, Ranger leg (6th leg) — 2026-08-14
11 traits curated, including a 4-trait "Beast skills grant ___" cluster mirrored onto all 76 Ranger pet skill ids at once — the largest single mirror target of the sweep to that point. See commit `039dd2c`.

### Trait-granted-boons-on-skills sweep, Mesmer leg (5th leg) — 2026-08-14
13 traits curated, the largest single-leg haul of the sweep; found a new failure mode where a mirrored trait's status collides with an unrelated pre-existing fact with no override of its own, handled by skipping the override rather than risk overwriting the other fact. See commit `bf8932d`.

### Buff instance-label sweep, Elementalist leg (9th leg, FINAL leg) — sweep complete — 2026-08-14
Closes the whole "unlabeled duplicate rows" bug across all 9 professions. Largest remaining pool (61 conflict sources); found 2 new trait-level failure modes (a trait swapping to a wholly different boon per game mode) plus a wiki/API mismatch confirmed via a direct API pull. See commit `c50a7ed`.

### Buff instance-label sweep, Mesmer leg (8th leg) — 2026-08-14
17 sources labeled, 8 redirected to WvW overrides, 5 left open; found a case where 2 different traits grant the identical bonus simultaneously, requiring occurrence-indexed labels instead of a status-wide override. See commit `9756f94`.

### Buff instance-label sweep, Ranger leg (7th leg) — 2026-08-13
Only 3 conflict sources (elite spirit skills' pulsed-boon facts), far below the original estimate; 2 redirected to WvW overrides, 1 left open with no wiki text to distinguish the duplicate. See commit `48ee0cb`.

### Buff instance-label sweep, Engineer leg (6th leg) — 2026-08-13
10 sources labeled, 7 redirected to WvW overrides; found a new failure mode where a trait-linked override pair coexists with a genuine untraited base fact sharing the same status, left unfixed to avoid a wrong display. See commit `c6c6e89`.

### Buff instance-label sweep, Guardian leg (5th leg) — 2026-08-13
Most finds turned out to be plain WvW-override cases rather than genuine per-instance conflicts; only 2 sources got a real instance label, including the table's first multi-status-family trait entries. See commit `afe467d`.

### Buff instance-label sweep, Necromancer leg (4th leg) — 2026-08-13
Only 4 conflict sources after applying the prior legs' methodology fixes, far below the original "24" estimate — confirms every leg needs its own fresh rescan, never trust a prior pass's count. See commit `8e836c0`.

### Buff instance-label sweep, Warrior leg (3rd leg) — 2026-08-13
8 real labels curated (adrenaline-tiered Fury/Bleeding, distance-scaled Fear, etc.) plus 3 redirected to WvW overrides; several remaining sources stay open where the wiki gives no discriminating text at all. See commit `c85488b`.

### Buff instance-label sweep, Thief leg (2nd leg) — 2026-08-13
Rescan fixed a methodology gap (an `overrides`-linked fact is a value swap, not a 2nd simultaneous instance) that had inflated the candidate count; also found several "conflicts" that never actually reach the render path at all, caught before committing. 6 real labels curated, including the table's first trait-side entry. See commit `78295c3`.

### Icerazor's Ire "On Hit" label + same-name flip-pair classification sweep (leg 1) — 2026-08-13
Two follow-ups from a user review of the live tooltip: labeled a 2nd Vulnerability fact from user-observed play (the one table entry not sourced from wiki text), and kicked off the same-name flip-pair classification sweep (Revenant leg). See commit `cff16fb`.

### Duplicate same-status buff row labeling: mechanism built, Revenant leg curated — 2026-08-13
Built `BoonConditionSource.instanceLabel` and a new curated table keyed by the status/duration/apply-count tuple so genuinely different applications sharing one status (e.g. "on-hit" vs. "on-summon") render distinguishably instead of as identical-looking duplicate rows. First leg (Revenant) curated 11 ids; a re-scoped candidate count found 255 genuine sources remain across the other 8 professions. See commit `30f2d61`.

### Assassin's Reward trait healing sweep, closing the last blocked Healing-sweep item — 2026-08-13
The trait's per-initiative-spent heal rate applies to ~45 weapon skills; the earlier "needs per-skill initiative data" blocker turned out unnecessary since the API exposes it directly. Live-API verification (not just the local snapshot) surfaced 2 ArenaNet data quirks affecting several skills' baked-in rate. 28 of 45 curated. See commit `4a0344c`.

### Fury-crit-chance trait sweep, closing the last 3 entries — 2026-08-13
Wiki-verified and curated the 3 remaining fury-gated crit-chance traits flagged in TODO's nice-to-haves list. See commit `69e2c90`.

### Breakrazor's Bastion Band Together curation (closes the Revenant flip-duplicate follow-up) — 2026-08-13
The last of Legend5's 4 flip pairs to get the "Band Together" curation its 3 siblings already had; wiki-verified it's shaped differently (real Healing facts, not just Buffs) and curated accordingly. See commit `0dca785`.

### Same-name flip-duplicate sweep, non-Revenant professions — 2026-08-13
Verified the ~15-pair (actually 23) follow-up the Revenant fix had logged: 19 confirmed non-actionable duplicates excluded, 4 (Elementalist's familiar skills) confirmed genuinely additive and left alone. Generalized the exclusion mechanism into a shared union helper for future families. See commit `0ed203a`.

### TODO.md cleanup: archiving the finished Renegade tooltip/data gaps sweep — 2026-08-13
Relocation only — moved the already-completed Renegade/Centaur Stance on-cast-effects curation and the Notoriety/Rapid Flow trait-granted-boons work from TODO.md into COMPLETED.md, per the file's own "completed work isn't tracked in TODO" rule. See commit `4595d04`.

### Revenant skill bar phantom "flip" duplicate rows, found by the user — 2026-08-13
User-flagged: the flip-chain logic assumed every `flipSkill` hop was a genuine 2nd action, but 9 ids across 4 legends turned out to be near-identical or stale-orphan duplicates with nothing new to show. Fixed via a new curated exclusion table; the same shape outside Revenant logged as a follow-up (closed 1 session later). See commit `3210bc1`.

### Mesmer's Mirror Blade coefficient re-verification (Tier 2's flagged stale entry) — 2026-08-13
Closed the one entry Tier 2's snapshot build had left open: confirmed via a fresh independent API pull that the live data itself changed (a real ArenaNet API bug, not a stale cache), fixed via a synthetic fact restoring the still-correct wiki-verified coefficient a place to key off. See commit `1cccc29`.

### Phantom double-counted two-handed-weapon infusions/sigils, found by the user — 2026-08-13
User's real saved build showed 2 extra Infusions' worth of stats; root-caused to a two-handed weapon's off-hand mirror slot being credited its own separate capacity by the bulk-fill "apply to all" actions, double-counting. Fixed to recognize the mirror relationship, and made the bulk-fill self-healing for already-corrupted saved builds. See commits `6668724` and `2bb7d8b` (backfilled write-up).

### Tier 3 hand-verified reference builds + 2 real bugs found & fixed — 2026-08-13
Closes the "Automated testing strategy" item's final tier: 3 real user-supplied WvW builds checked against gw2skills.net/in-game as an external oracle. Building the first one's expected numbers surfaced 2 real previously-unmodeled gaps (a health-threshold consumable family, and a full-endurance crit-chance trait), both fixed same session. See commit `96bc27d`.

### Tier 2 golden snapshot fixtures (curated coefficient tables) + 4 drift bugs found & fixed — 2026-08-13
Snapshots the already-wiki-verified output of the curated coefficient tables so future regressions show as a diff. Building it surfaced 5 real label-drift bugs where a curated `factText` no longer matched the live API's current wording; 4 fixed, 1 (Mirror Blade) left for a fresh wiki check, closed the next session. See commit `85068f1`.

### Tier 1 value-correctness tests (gear/derived-stat formulas) — 2026-08-12
First of the 3 testing-strategy tiers: hand-computes expected numbers from the same wiki-quoted constants each source file already cites and asserts the code reproduces them exactly, catching arithmetic slips a completeness scan can't see. See commit `e0dd5ef`.

### State-dependent bonus tests (Kalla's Fervor-shaped) — 2026-08-12
Closes the last of 3 completeness/coverage test items: exercises every state-dependent `combat-state.ts` formula at 0/mid/max points of its own dimension rather than one static snapshot, catching a scaling bug a single-point check would miss. See commit `40cd499`.

### Sigil/Control-Strip completeness scan — 2026-08-12
Found sigils carry no structured `Fact[]` at all, so the Control/Miscellaneous/Strip-Corrupt-Cleanse matchers could never see one even in principle — a total structural gap, not an occasional missed wording. Hand-scanned all 81 sigils, curated 5 genuine sources via a new sigil named-fact table. See commit `63fdf75`.

### Trait-granted boons on skills: Notoriety + Rapid Flow — 2026-08-12
Closes the item for these 2 Revenant traits: both target the same 45-skill candidate set (every legend kit skill, since all cost Energy), curated via the synthetic-facts mechanism since the API's own trait-skill link is empty for both. One real display gap found and documented rather than papered over (an existing override would silently collapse a 3rd fact sharing its status). See commit `e42d736`.

### Conditional trait-attribute bonuses, leg 8 (final): Health-threshold-conditional flat bonuses — 2026-08-12
Closes the whole 8-family conditional-trait-attribute-bonus sweep. Needed a new 3-way `HealthTier` CombatState field, unconditionally applied (unlike every other family's on/off gate) since health always has some value. See commit `019e8df`.

### Conditional trait-attribute bonuses, leg 7: Revealed-state-gated flat bonuses — 2026-08-12
Only 1 Thief-only candidate; needed a new `revealedActive` CombatState boolean since Revealed has no persisted Build field to key off. See commit `d3d6c0b`.

### Conditional trait-attribute bonuses, leg 6: Shroud/stance-gated flat bonuses — 2026-08-12
3 traits curated (Necromancer Shroud, Scourge Sand Shade, Warrior Berserk mode) via one new shared `mechanicActive` boolean, since none of the 3 mechanics had an existing persisted field suitable for gating real totals. See commit `900c800`.

### Conditional trait-attribute bonuses, leg 5: Attunement-gated flat bonuses — 2026-08-12
2 Elementalist traits curated; needed no new CombatState field after all — the existing `activeAttunement` Build field, previously considered display-only for boon-uptime purposes, is the semantically correct gate for a flat-bonus trait since it only applies at the instant you're standing in that attunement. See commit `eac7624`.

### Conditional trait-attribute bonuses, leg 4: Weapon-equipped-gated flat bonuses — 2026-08-12
13 traits curated, derivable purely from `build.equipment` with no new state needed. Surfaced 2 traits needing a fresh look beyond the base-half cross-check (one had no unconditional half at all) and dropped one checklist candidate that turned out pet-type-conditional, not weapon-gated. See commit `ca4a5ff`.

### Conditional trait-attribute bonuses, leg 3: Regeneration/Quickness-gated flat bonuses — 2026-08-12
4 traits curated via 2 new CombatState booleans; also caught a misfiled checklist entry (a trait believed Regeneration-gated turned out Fury-gated) and moved it into the already-closed Fury leg's table instead. See commit `28062c7`.

### Conditional trait-attribute bonuses, leg 2: continuous Might-stack scaling — 2026-08-12
3 traits curated reusing the existing Might-stacks CombatState field directly, no new UI needed. See commit `7a7ef19`.

### Conditional trait-attribute bonuses, leg 1: Fury-gated Ferocity/Condition-Damage — 2026-08-12
Kicked off the 8-family backlog the trait-attribute-bonus sweep surfaced; 5 traits curated as a direct sibling of the existing Fury-gated crit-chance family, no new plumbing needed. See commit `7650399`.

### Trait attribute bonus sweep complete (Thief leg, final of 9 professions) — 2026-08-12
Closes the full 187-candidate sweep across all 9 professions. Thief's own 29 candidates yielded 12 curated (9 flat + 4 conversions) and surfaced a new revealed-state-gated flat-bonus shape, later its own dedicated leg. See commit `f5f4803`.

### Gear Optimizer bug closed: user confirmed live in-app spot-check — 2026-08-12
Closes the item for good — user ran their own live spot-test and confirmed the earlier fix looks correct. See commit `0b99ddc`.

### Gear Optimizer fix re-verified (closes the "unverified in live app" gap) — 2026-08-12
Electron sandbox still blocks a real live-app check, so re-ran the same class of verification via a standalone script instead: exact match against an independent recomputation, and confirmed the check itself is meaningful by temporarily reverting the fix and watching the original bug reproduce. See commit `e33849b`.

### Per-buff-line target-count model — 2026-08-11
Closed a real modeling gap: target count used to resolve once per whole source, unable to express a source whose different boon lines genuinely reach different counts. Widened the override shape to 3 new forms (status-keyed, trait-conditional, legend-conditional) and moved resolution to run per buff fact. Verified the full resulting matrix against real game data by hand. See commit `ba2516e`.

### Gear Optimizer: searchable rune and infusion choice — 2026-08-11
Runes and infusions become search variables behind a new toggle, gated the same way food/utility already are; runes modeled as one uniform 6-piece slot, infusions modeled per physical slot since rings can legally hold different infusions. See commit `d099584`.

### Elementalist Glyph tooltips: swap to active attunement, not stack all 4 — 2026-08-11
The tooltip previously stacked all 4 attunement-variant sub-blocks as documentation instead of showing the live per-attunement effect; fixed via the same swap mechanism the Druid Glyph forms already used. See commit `2a421e5`.

### Automatic game-data refresh (Option C: static-publish, in-app) — 2026-08-11
Built the previously-decided design: the publish side needed zero new infra since game data is already committed to the public repo, so the raw GitHub URL is directly fetchable. Added a `gw2Build` freshness signal, a download-then-restart flow mirroring the existing app-binary updater, and a Settings panel + NavBar badge. See commit `a1a2732`.

### Tooltip visual pass: icon-in-header + rarity-colored titles (traits/skills/gear upgrades) — 2026-08-11
First slice of the full tooltip visual pass, visually confirmed live in the running app; a rarity-mapping correction landed mid-session once the user confirmed real GW2 rarities for relics/runes/sigils/infusions. See commit `aadeaeb`.

### Favorites pin for the squad editor's build-assignment picker — 2026-08-10
Closed the one location left unwired from the earlier Favorites feature — reused `Build.favorite` directly rather than a new install-specific store, since a build's favorite status is build data. See commit `d33a5d3`.

### `PrefixedBuff` target-count sweep, final leg — sweep closed (45/45) — 2026-08-10
Closed the sweep in one combined leg since only 6 sources remained; re-confirmed zero uncurated `PrefixedBuff` boon sources remain anywhere via a full 9-profession re-scan. See commit `e44eb3d`.

### `PrefixedBuff` target-count sweep, Revenant leg (2nd of the backlog) — 2026-08-09
7 sources curated, mixed self/party-wide. See commit `3fdd939`.

### `PrefixedBuff` target-count sweep, corrected the backlog count + closed out Elementalist — 2026-08-09
A programmatic re-scan found the true backlog is 45 sources across 9 professions, not the original undercounted estimate — the earlier pass had mistaken "referenced elsewhere in a comment" for "curated." Caught 3 missed Elementalist sources along the way, closing that profession fully. See commit `cbd782c`.

### `PrefixedBuff` target-count sweep, Elementalist leg (1st of the backlog) — 2026-08-09
Scoped the sweep down from an inflated raw-fact estimate to the real 35-source backlog (target count is only ever rendered for boon-classified facts); curated Elementalist's 17 sources, all self-only. See commit `cecaa73`.

### `PrefixedBuff` facts now surface everywhere (boon bar, all tooltips) — 2026-08-09
Fixed a real bug: `extractFromFacts` only ever recognized the `Buff` fact type, silently skipping every `PrefixedBuff` fact (the API's shape for "trait X grants a boon specifically via skill Y") everywhere, including the whole-build boon bar. Also closed a pre-existing, independent gap found during the same pass: trait tooltips hardcoded an empty boon-facts array for every trait. See commit `4e5629f`.

### Skill tooltips now render Misc/Control/Strip-Corrupt/Combo/Aura facts — 2026-08-09
Skill tooltips previously only rendered numeric lines and boon/condition facts — every other category (Stealth, Stun, Strip/Corrupt/Cleanse, Combo, Auras) only ever reached the whole-build aggregate panel, never a skill's own tooltip. Fixed via 3 new per-skill counterpart functions reusing the existing aggregate matcher tables directly, no new fact-matching logic. See commit `17b6c76`.

### Empty-effect-facts curation: Otherworldly Bond resolved (honest skip), closes the original 41-id backlog — 2026-08-09
The skill that started the whole empty-effect-facts investigation, deliberately deferred every prior leg. Concluded it's genuinely not curatable without misrepresenting it — its 2 branches are a mutually-exclusive per-cast player choice sharing one skill id, and its ticks carry no fixed stack count to represent honestly. Closes the entire 41-id backlog. See commit `3fd5477`.

### Empty-effect-facts curation: Twin Moon Sweep cluster — 2026-08-09
Curated the skill's unconditional Might; found a new architecture-limit shape (4 mutually-exclusive per-legend bonus blocks on one skill id with no gating field to express "requires this legend in the other slot") and left it an honest skip rather than an overcount. See commit `26d66ee`.

### Empty-effect-facts curation: Fox's Fury cluster — 2026-08-09
Curated both ids' Might/Fury grants; found the collapse-every-fact-sharing-a-status mechanism would have silently dropped a genuinely separate 2nd Might application if a WvW override were added there, caught by spot-verifying actual output before trusting it. See commit `ae24e8e`.

### Empty-effect-facts curation: Icerazor's Ire cluster + 2 unresolved ids resolved — 2026-08-09
Curated both cast variants' foe-facing conditions; found the WvW-override mechanism can only correct a duration, never a stack count, leaving one split an honest documented gap. Also resolved 2 of 3 previously-unresolved-collision ids as needing no curation. See commit `5e4a212`.

### Empty-effect-facts curation: Necromancer Shroud cluster (Voracious Arc/Devouring Cut/Anguish) — 2026-08-09
3 pure foe-facing condition skills curated cleanly; a 4th candidate (Summon Spirits) confirmed to have nothing curatable since every fact describes the summoned spirits' own attacks, not a caster grant. See commit `3666c20`.

### Empty-effect-facts curation: Shadowsquall/Malicious Shadowsquall cluster — 2026-08-09
Curated the ally-facing Regeneration half of both Stealth Attack skills (the foe-facing poison half stays out of scope); needed a new synthetic "Number of Allied Targets" fact shape alongside the synthetic Buff fact, first use of that shape. See commit `5118593`.

### Empty-effect-facts curation: Weaver Pistol/Spear Dual Attacks cluster — 2026-08-09
Found a new exclusion shape distinct from the Elixir cluster's: most of these 11 skills' bonuses only land on a bullet-consuming cast, not every cast, which this app's Fact model can't express without overcounting — only 4 of 11 had an unconditional base-cast boon to curate. See commit `a919d42`.

### Empty-effect-facts curation: Elixir of ___ cluster (Necromancer/Harbinger) — 2026-08-09
Curated all 5 elixirs' self-cast boons across both ground-targeted/non-ground-targeted id pairs (10 ids); deliberately did not curate the foe-facing condition halves since one target-count-per-skill limitation would force either side to render wrong. See commit `ee3d264`.

### Empty-effect-facts curation: first leg (Detonate Elixir H + 2 exclusion classes) — 2026-08-08
Confirmed the synthetic-facts injection mechanism (built earlier for one skill) generalizes cleanly to this whole 41-id backlog; curated 1 skill and documented 2 reusable exclusion classes (profession-mechanic internal state-flag markers with no display path, and Prayer to Lyssa's random-pick shape) rather than guessing at either. See commit `17b555e`.

### Balance-patch detection extended to target-count/Condition-Cleanse reach — 2026-08-08
Investigated the wiki's "number of allied targets from A to B" phrasing and built a 2nd parallel code path (kept separate from the coefficient-table machinery) covering these 2 differently-shaped tables. Live run found only 2 real clauses, both already correctly not-curated — a real result, not a parsing bug, since most entries in these tables exist precisely because no source ever states a number. Closes the wiki-sourced data pipeline's top-level checkbox. See commit `d7491be`.

### Wiki-extraction pipeline step 4: balance-patch change detection — 2026-08-08
Built the dated-subpage diff mechanism against the wiki's `Category:Balance updates` index (59 patches). Caught and fixed 2 real bugs before trusting the first run (a per-strike-vs-totaled coefficient mismatch, and a regex tail-boundary bug misreading a decimal point as a sentence end), plus added cross-corroboration against the existing live-wiki verification file to catch false-positive staleness. Final run found 0 genuinely-actionable staleness. See commit `2d166b2`.

### Wire wiki-pipeline output to data/game-data/ (audit-trail) — 2026-08-08
User picked the lowest-risk of 3 output-shape options: a verification-status file per fact type that doesn't change app behavior, since the curated tables still carry entries the scripts can't auto-resolve. See commit `bcbd3e3`.

### Wire `CONDITION_CLEANSE_TARGETS` into the UI — 2026-08-08
Closes the Condition Cleanse item's last piece — the curated table was data-only until now. Wired end to end as a 3rd Strip/Corrupt matcher, relabeling the row "Strips / Corrupts / Cleanses" everywhere it renders. See commit `faae8c5`.

### Migrate remaining fetch-*.ts scripts to the shared wiki-cache — 2026-08-08
Wired 6 more scripts onto the shared on-disk wiki cache. Verified every migrated script's output, not just that it typechecked — found real diffs on 3, each individually root-caused as pre-existing data staleness rather than a migration regression. See commit `ffcea5f`.

### `CONDITION_CLEANSE_TARGETS` curated table — 2026-08-08
Turned an earlier classifier's draft output into a real curated table. A full manual review pass over the classifier's own output caught a real classifier bug and resolved most of its unresolved-collision bucket by grouping candidates by their granting trait in local data instead of separate wiki lookups. 211 curated + 24 documented exclusions. See commit `df1fc7c`.

### Wiki-extraction pipeline step 3: target-count self-vs-party leg — 2026-08-08
Validates the earlier conversational target-count sweep against live wiki text, same pilot/diff shape as the damage-coefficient pipeline. Zero real mismatches and zero real self-vs-party contradictions found anywhere the wiki had evidence to check against. See commit `dd8b420`.

### Wiki-extraction pipeline step 3: empty-API-facts red-flag scan — 2026-08-07
Built the "does this page even carry the template we need" half of step 3, sizing the empty-effect-facts bug. A user-caught bug in the first version's reachability check (missing the Downed-slot-reused-as-real-Shroud-skill quirk) was fixed same session. Found 41 ids across 35 unique skill names with a real gap. See commits `0451645` and `cb870ba` (fix).

### Wiki-extraction pipeline: shared raw-wikitext cache (TODO.md step 2) — 2026-08-07
Built a shared on-disk wiki-page cache keyed by title + MediaWiki revision id, wired into the first script. Validated by deleting the cache and re-running from scratch: identical numbers to the last recorded run, then instant on the second run (all cache hits). See commit `2a579cc`.

### Wiki-extraction pipeline: shrunk MISSING/SKIP/UNRESOLVED, caught a self-introduced bug — 2026-08-07
3 more general, safe parsing fixes (comma-separated id-list parsing, case-normalized text matching, a last-resort sibling-id attribution tier) cut the unresolved buckets significantly. The sibling-attribution tier's first draft caught its own live false positive before landing, and a tier-ordering bug that let a coincidental match short-circuit a findable exact resolution. See commit `3447e6c`.

### Wiki-extraction pipeline: closed the last 3 MISMATCH entries — 2026-08-07
Investigated the 3 remaining mismatches without needing the user's offered help; all 3 curated values were already correct — each was a case where the specific wiki page under-documents a split that a related source (a Notes section, a sibling id's page) documents completely, already correctly cross-referenced by the original curator. See commit `8f81a4b`.

### Wiki-extraction pipeline: name-collision + requiresTrait handling — 2026-08-07
Made the pilot script production-ready for its 2 known gap shapes: a self-verifying wiki-search fallback for name-collision pages, and a validated formula for skills whose curated table carries a trait-boosted duplicate entry. Cut MISSING/SKIP/UNRESOLVED buckets substantially, confirming the fallback mechanism carries real weight. See commit `08d526c`.

### Wiki-extraction pipeline pilot: fetch-skill-coefficients.ts — 2026-08-07
Built and validated the pilot script for the wiki-sourced data pipeline: diffs a scripted wiki-parse against the already-hand-curated damage-coefficient table. Confirmed the approach works on the common case; the pilot's own diff output is what surfaced 3 explainable exception shapes, not a silent wrong parse. See commit `c14ec8c`.

### Weapon autoattack-chain boon/condition gap (Revenant Scepter report) — 2026-08-07
User-reported gap traced to the real root cause, not the symptom: a weapon slot's chain-continuation hits (where a boon/condition fact often actually lives) were never walked into the aggregate calc at all — confirmed as a project-wide gap (126 skills), not Revenant/Scepter-specific. Also flagged a separate, likely-larger `PrefixedBuff` gap for a future session rather than folding it into this fix. See commit `712f050`.

### Gear Optimizer bug hunt: found and fixed a real food/utility conversion bug — 2026-08-07
First real diagnosis pass on a previously-unfalsified bug report. Built a standalone repro script (Electron sandbox blocks live UI reproduction) and found the optimizer's final re-derivation step silently omitted the food/utility attribute-conversion mechanic, understating Power by ~100 points on a real test case. See commit `7e94130`.

### Stationary-sources spot-check for the target-count sweep — 2026-08-07
Follow-up spot-check using the API's own category field (not name-matching, which would misfire) to find every banner/well/spirit/turret; found the sweep already covered nearly all of them, plus 1 genuine gap (a mis-categorized gadget). See commit `7e994f9`.

### Elementalist leg of the Group A target-count sweep (final leg) — 2026-08-07
Closes the entire 10-leg Group A sweep. Corrected a stale illustrative example in the table's own doc comment along the way (a fresh wiki fetch reversed an earlier self-only assumption), and found 2 new per-buff-line self/party-wide-split conflicts the table's shape can't express. See commit `86ab422`.

### Guardian leg of the Group A target-count sweep — 2026-08-07
48 sources resolved; found a reusable "every Symbol grants to allies except Symbol of Ignition" wiki rule that resolved several skills with no ally wording of their own. See commit `bfba2a2`.

### Mesmer leg of the Group A target-count sweep — 2026-08-07
34 sources resolved, no exclusions needed; fixed a scan-script bug (a stale brace-matcher) that had been silently including already-curated ids in the candidate pool on every prior leg's rescan. See commit `6fd0f6e`.

### Ranger leg of the Group A target-count sweep — 2026-08-07
43 sources resolved; found a new recurring "granted to your pet, not the ranger" self-only pattern, and confirmed a trap to avoid (a trait that layers an unconditioned bonus on top of a skill category, not a gate on those skills' own facts). See commit `ee21eaa`.

### Revenant leg of the Group A target-count sweep — 2026-08-06
39 sources resolved; found 2 new genuine per-source conflicts the table's one-value-per-source shape can't express, added to the growing documented-exclusion list. See commit `ca29259`.

### Engineer leg of the Group A target-count sweep — 2026-08-06
39 sources resolved; dropped 2 unreachable Downed-slot candidates per the standing rule, and found a recurring "trait grants boons to a skill category" pattern resolvable from the trait's own text alone. See commit `2a70f25`.

### Warrior leg of the Group A target-count sweep — 2026-08-06
24 sources resolved, no exclusions needed; extended the "no allies wording anywhere" self-only tell to skills whose own description doesn't even mention the boon at all. See commit `ebef296`.

### Fixed 3 unreachable Downed_-slot entries from Session 98's Necromancer leg — 2026-08-06
A user question about downed-skill handling surfaced a real defect: 3 of the prior leg's "resolved" ids are structurally unreachable by any real build (a Downed-slot id absent from the bundle-slot mapping that makes some Downed-labeled ids real). Removed as dead weight; found 2 more of the same shape elsewhere in the game, left for their own profession's leg. See commit `8c7e45c`.

### Necromancer leg of the Group A target-count sweep — 2026-08-06
21 skills + 1 trait resolved; found a clean "first-person phrasing = self-only" tell, and 2 genuine per-buff-line self/party-wide splits the table's one-value-per-source shape can't express. See commit `432413f`.

### Thief leg of the Group A target-count sweep — 2026-08-06
21 sources resolved; most Specter kit pieces resolved for free via their gating trait's own explicit target-count fact. Found one skill whose Might only exists via a trait combination the wiki itself flags as a confirmed tooltip bug, left uncurated rather than force a wrong answer. See commit `bf53527`.

### First leg of the Group A (ambiguous "Number of Targets") target-count sweep — 2026-08-06
Started the much larger 318-candidate bucket, picking the smallest self-contained slice (30 no-profession-tag pet/mount/racial/trait-proc skills) at user's choice. See commit `e9bcaf1`.

### Curated the no-Number-fact-but-confirmed-party-wide bucket from Session 94's TODO — 2026-08-06
33 real candidates wiki-verified individually rather than trusted from the Radius fact's mere presence — several turned out to be false positives sharing a facts array with an unrelated Radius. Found 2 concrete real-world examples of the "self-only and party-wide boon on one source" gap the data model can't express. See commit `5d4dd39`.

### Boon tab / Squad tab: self vs. party-wide boon target counts — 2026-08-06
The TODO's own premise (no target-count fact implies self-only) didn't survive a full scan — both directions have real counterexamples. Shipped only what the API states unambiguously (an explicit "Number of Allied Targets" fact), wired into every boon-source display; the two ambiguous buckets left as a scoped future sweep per direct user choice. See commit `964f7cd`.

### Closed both `fetch-wvw-splits.ts` follow-ups from Session 92 — 2026-08-06
Both open items resolved: confirmed the API rounds half-second Buff durations up (explaining 2 "unexplained" values from the prior session) via a manual-override layer, and fixed a real `resolveOverride` gap where a pvp-only tag with no pve/wvw line fell through unhandled instead of resolving to omit. See commit `bcb8576`.

### Firebrand Mantra tooltip found the real "last charge" example, and a real boon-calc over-counting bug — 2026-08-06
User screenshots confirmed a real, previously-undiscovered bug: some Firebrand Mantra tooltips showed the same boon duplicated 2-3x at different durations, because a handful of skill ids bake multiple game-mode values into one facts array with nothing to distinguish them, and the aggregate calc counted every one as a separate real application. Fixed for the confirmed 12-id Mantra family; the same shape exists on ~550 other ids but most are genuine multi-hit mechanics, not a bug. See commits `9ed6c03` and `68f7e89` (follow-up correction).

### Resolved the last "Skill picker follow-ups" item: Ranger's Eternal Bond (Profession_4) — 2026-08-06
Re-checked the "needs a new per-pet table" premise against raw data and found it already resolvable by the existing generic per-spec resolver — it just needed to stop being unconditionally excluded. See commit `5889e03`.

### Closed out the last 4 "no resolving signal" duplicate-name skill groups — 2026-08-06
Re-investigated all 4 with fresh pulls rather than trusting the earlier "no signal found" conclusion — half of them turned out to have a real, findable resolution after all (2 structurally-unreachable Revenant orphans needing no fix, 1 genuine data-incompleteness workaround, 1 genuine trait-gated pair needing a threaded trait-choice parameter). See commit `353d37e`.

### Closed out the last item from the 2026-07-31 skill-bar feedback pass: Engineer Kit toggle row — 2026-07-31 (worked 2026-08-06)
Confirmed the earlier deferral was structurally correct (Engineer Kits can't migrate to the F-bar the way other bundle toggles did, since that slot is already showing a different real skill), then fixed the one real self-contained gap: the kit-toggle row still rendered stale plain-text pills instead of the icon-button treatment every other bundle toggle now has. See commit `d19a414`.

### Resolved the Vindicator Legendary Alliance orphan-id TODO item: not a picker bug, a mis-keyed curated coefficient — 2026-08-06
Corrected the TODO bullet's premise (only 2 of the 4 named skills actually have a duplicate id) and found the orphan ids are structurally unreachable by the live Revenant UI regardless of what the picker's own resolution logic would pick. The actual bug: a curated damage coefficient was keyed to the unreachable orphan instead of the id Revenant actually renders, silently hiding a Damage line on live Vindicator builds. See commit `2e95559`.

### Skill-picker "Tale"/"Deception"/"Minion" category miscategorization fix — 2026-08-06
Root cause: several skill families come back from the API with an empty `categories` array, dumping them into a shared uncategorized bucket that leaked across every Mesmer spec's picker. Fixed via a small curated override table, each entry backed by a real sibling tag or naming convention, not a guess. See commit `438f5cc`.

### v0.3.0 release — 2026-08-06
Covers 14 commits since 0.2.0: Favorites, auto-save on editor back-navigation, 2 new Settings toggles, Weaver's dual-attunement fix, gear-upgrade-picker keyword search, and the Utility conversion-parsing + Feast/Station buff-resolution fixes. See commit `fd34267`.

### Stat/keyword search in the gear-upgrade pickers — 2026-08-06
Landed as one shared-engine change across 6 categories rather than 6 separate ones, since they already share one search box. A leading `#` matches a new resolved-stat-name field (needed separately from plain text since e.g. a rune's raw bonus text says "Boon Duration" where the Stats panel says "Concentration"). See commits `aa66d34` and `62a1930` (fix).

### Settings toggle for racial skills — 2026-08-06
TODO had flagged this as needing a new race data model; turned out unnecessary — racial skills already carry one exact, verifiable signature (a specific profession-count group) in the existing data, no hand-curated id list needed. See commit `82a378f`.

### Settings toggle for underwater equipment/skills — 2026-08-06
Built via one shared read-side mask function applied at both the build editor and squad editor's summary/calc call sites, so every downstream boon/condition/stat function already treats underwater as unequipped with no per-function threading needed. Never applied to a build about to be saved, so an existing underwater build isn't mutated. See commit `ee56974`.

### Weaver dual-attunement weapon-skill-3 gap resolved — 2026-08-06
Closed a long-standing documented limitation: the API's attunement field only ever encodes one of Weaver's 2 simultaneous attunement axes, so weapon-skill-3 "Dual Attacks" couldn't be disambiguated. User explained the real mechanic; built a hand-verified 80-entry mapping plus a new "previous attunement" build-state toggle and threaded the aggregate calc to loop all 16 current×previous pairs. See commit `9799881`.

### Hand-curated the "Ascended Gourmet Feast" tier Session 80 flagged as unresolvable — 2026-08-06
User-spotted gap: confirmed this whole 68-item tier has zero buff data anywhere in the API, with no buffed sibling either, so the existing sibling-borrowing fix couldn't reach it. Reverse-engineered the exact formula from raw wikitext (not a rendered table) and hand-curated all 68 rather than guess. See commit `fed555f`.

### Session 79's tooltip fix was wrong: Feasts/Stations are the real WvW play, not dead weight — 2026-08-06
Same-day user correction: excluding no-buff Food/Utility catalog entries was backwards — Feasts/Stations are what most WvW players actually run, precisely because they're placeable and shareable. Fixed via 2 different root causes: a name-based sibling-buff-borrowing mechanism for Food, and a mis-bucketed API item-type fix for Utility Stations. Reverted the prior session's picker exclusion entirely. See commit `1e9e2c4`.

### Food/utility bug: Utility's dominant WvW shape wasn't computed at all; tooltip cleanup — 2026-08-06
Root cause was Utility-specific: ~43% of the catalog (the items real WvW players actually equip) uses a "Gain X Equal to N% of Your Y" conversion shape the parser had never recognized, silently contributing nothing. Extracted the existing single-purpose trait-conversion solution into a shared, reusable mechanism rather than writing a second parallel one. Also fixed the tooltip-cleanup half (picker was listing buffless placeholder catalog entries with no filter). See commit `812220d`.

### Sigils weren't factored into the Stats panel — 2026-08-06
Root cause: `Sigil` had no structural bonuses field at all, only free-text description — unlike Rune/Consumable. Parsed sigil bonus text with the existing shared regex and wired the 2 sigils that map to a tracked core attribute into the gear-totals calc, gated the same active-weapon-set-only way every other per-weapon-slot bonus already is. See commit `f4d7f2f`.

### v0.2.0 release — 2026-08-05
Covers all 4 releases to date; 0.2.0 summarizes ~70 commits since 0.1.2 (Gear Optimizer, trait-granted stat bonuses, real Healing/Damage/Barrier tooltip numbers, the full curated-coefficient sweep, flip-skill stacked icons). See commit `479445e`.

### Fixed 2 bugs surfaced by the Session 75 mechanic-bar consolidation: Evoker's F5 empty, Catalyst's Jade Sphere tooltip duplicating — 2026-08-05
Evoker's F5 had no way left to make the first familiar pick after an earlier session removed its standalone picker row; fixed with a placeholder button matching Thief's Stolen Skill pattern. Catalyst's Jade Sphere tooltip repeated content because the shared tooltip builder's variant-appending logic (designed for a genuinely-picked multi-form skill) was actively wrong for this always-current-form bar — gave the mechanic bar its own plain tooltip builder instead. See commit `55e74b0`.

### Elementalist attunement toggle merged into the F1-F4 profession-mechanic row — 2026-08-05
Removed a standalone attunement-toggle row that was pure duplication of the mechanic bar's own read-only F1-F4 icons; made those icons clickable instead, unified under one interaction. See commit `05a93e5`.

### `CURATED_DAMAGE_COEFFICIENTS` full category sweep COMPLETE across all 9 professions (Heal/Elite/Utility/Weapon-slot) — 2026-08-05
Closes the whole sweep started 2026-08-04, alongside the earlier Healing and Barrier sweeps. Mesmer's own Weapon-slot leg (the final leg) surfaced a new mechanic — phantasms use their own fixed weapon-strength tier while still scaling off the caster's Power, unlike non-player-scaling summons. See commit `07f27be`.

### Fixed the skill-variants picker gap: Elementalist's "Lesser Fiery Eruption" was reaching the live Elite picker as its own bindable skill — 2026-08-05
A conjure weapon's auto-triggered proc had neither of the app's 2 existing non-equippable signals, so it leaked into the picker. Confirmed via a full name-prefix scan that this is a one-off, not a whole category worth excluding, and added a small hardcoded exception constant rather than expanding a data file that gets wholesale-regenerated. See commit `b5cc2f5`.

### Closed the last `CURATED_BARRIER_COEFFICIENTS` loose end (Elementalist's Glyph of Elemental Power): not an architecture gap, just an uncurated reachable id — 2026-08-05
The earlier sweep had mis-filed this skill as an instance of the flip-architecture gap; it's actually already reachable via the existing attunement-variant tooltip mechanism, just never curated. Fixed the mis-filing and curated the fact. See commit `cdeef28`.

### Replicated the `requiresTrait` fix into Damage/Healing, closing the "Trait-duplicated-fact representation" TODO item — 2026-08-05
Extended the prior session's Barrier fix to Damage and Healing; curated 5 Mesmer damage entries whose trait-boosted value was independently cross-checked against a live API traited-fact pull for exact confidence. Re-investigated a lumped-together Necromancer case and found it's actually a different, unrelated, still-unmodeled mechanic. See commit `b5fb43d`.

### Closed out the 3 Barrier-sweep loose ends from Session 69 — 2026-08-05
1 fixed and curated (the motivating case for the whole "trait-duplicated-fact" architecture gap), 2 confirmed as genuine leave-uncurated cases rather than app-side bugs. See commit `6ecbc4b`.

### Built `CURATED_BARRIER_COEFFICIENTS` + `barrierLinesForSkill`, a new Barrier tooltip line — 2026-08-05
This app had no Barrier UI/formula at all before this — every Barrier-mislabeled-as-Healing fact had simply been excluded from the Healing sweep. Built as a full mirror of the Healing table's shape; research parallelized across agents (6 of 8 cut short by a session limit, absorbed directly). 48 of 58 candidates curated; found several new trap shapes (WvW as a genuinely standalone 3rd value more common here than in prior sweeps, a wiki-documented inline correction of its own fact template). See commit `4ce5bf4`.

### Fixed Druid Glyph equipped-slot icon not swapping with Celestial Avatar toggle — 2026-08-04
User-reported, with screenshots: the tooltip facts already swapped correctly on toggle, but the slot button's icon never did — the earlier form-swap fix only ever reached the tooltip fact lookup, never the equipped-slot icon render. See commit `426d4eb`.

### Curated Ranger's 3 Druid Glyphs' non-celestial-form Damage coefficients — 2026-08-04
The rendering gap was already fixed; this landed the wiki-verification pass for the 3 variant ids it unblocked. See commit `aefbd83`.

### Curated the flip-target Damage coefficients the stacked-icon display unblocked — 2026-08-04
9 ids curated, each wiki-verified and spot-run through the real calc before landing — every one previously left uncurated as "real fact, no UI path reaches it," now reachable via the new stacked-icon tooltips. See commit `4835cff`.

### Flip-skill stacked-icon display — 2026-08-04
Built the gw2skills-style stacked-icon display for genuine flip pairs, the user's originally-referenced screenshot's design. Split the existing variant-walking helper into two: attunement variants stay nested documentation text, while a flip-skill chain now gets its own icon stack with independently-computed tooltips. A same-day follow-up resized the icons from a shrunk secondary size to full slot size after seeing it live. See commit `55dbf1e`.

### Druid Glyph forms: swap-not-stack toggle-read fact rendering — 2026-08-04
An earlier picker-collapse fix had only hidden the non-equippable form-variant ids, never stitched their real facts back onto the canonical id's tooltip — so a Glyph's tooltip always showed the same generic fact set regardless of which form was active. Fixed by widening the form-variant map to record which form each variant is, then swapping the entire tooltip (not just one number) to match the active toggle. See commit `134ab07`.

### Vindicator's Aspect-swap toggle (Legendary Alliance Stance) — 2026-08-04
Confirmed via the wiki that this is a real in-combat manual toggle swapping all 5 heal/utility/elite slots at once (not a per-slot on/release pair like every other legend). Found the toggle's own F-button skill was the 6th instance of a known "real F-button missing from the API's professionSkills list" gap, hand-injected the same way prior instances were. See commit `5c69590`.

### Full skill-picker duplicate-id audit — 2026-08-04
Built a new audit closing a real coverage gap in the existing wiki-cross-check script (it could never even reach a group an in-code signal had already narrowed to 1 id before any check ran). First run found 36 candidate mismatches, about a third of them false positives caught by hand before writing anything; hardened the script's own auto-exclusion criteria so a future re-run can't reintroduce the same false-positive class. 28 ids added as genuine confirmed bugs. See commit `105b9c2`.

### Synthetic-fact injection for skills the API returns with no usable facts at all — 2026-08-04
Curated tables only ever render a number when a matching Fact object exists to gate on; a Mesmer heal skill returns zero Healing facts at all in the live API, so no coefficient could ever render regardless of correctness. Built a hand-maintained fact-injection file merged at load time, indistinguishable from a real API fact to every downstream consumer. See commit `c900a89`.

### Full Weapon-slot category sweep for `CURATED_HEALING_COEFFICIENTS` (last category) — 2026-08-04
Completes the category-sweep plan (Heal → Utility → Elite → Weapon). Largest surface yet (648 distinct ids); 2 known traps plus a newly-discovered one (a shared trait duplicated onto ~38 skills' own facts, not a per-skill design) narrowed the field before wiki research started. 49 of 55 genuine candidates curated. See commit `e3ee4a8`.

### Full Elite-skill category sweep for `CURATED_HEALING_COEFFICIENTS` — 2026-08-04
Only 12 candidates, far smaller than Heal/Utility; 10 of 11 genuine candidates curated, 1 left uncurated on a confirmed live API/wiki mechanic mismatch (not a stale cache). See commit `e04724f`.

### Full Utility-skill category sweep for `CURATED_HEALING_COEFFICIENTS` — 2026-08-04
Found the Barrier-mislabeling trap accounts for nearly half the raw candidates, common enough to warrant its own future dedicated sweep (built the next day). 20 of 23 genuine candidates curated across 8 parallel per-profession research passes. See commit `b0930be`.

### Full Heal-skill category sweep for `CURATED_HEALING_COEFFICIENTS`; Firebrand mantra Final Charge fix — 2026-08-02
User pushed back on build-by-build curation in favor of a full category sweep across every profession first. 81 of 85 candidates curated via 9 parallel per-profession research passes, all raw-wikitext-sourced. Caught 2 real bugs during review (a placeholder value written before its research agent actually returned, and a same-text duplicate-fact collision). Also fixed a real gap the user found spot-checking against gw2skills.net: a Firebrand mantra's Final Charge sub-skill had no API link back to its parent at all. See commit `889f372`.

### Healing/Damage real numbers moved from the summary row into each skill's own tooltip — 2026-08-02
User feedback right after the Damage row shipped: a single disconnected summary icon was hard to read compared to the number showing up on the skill itself. Moved both rows' content into each skill's own tooltip via a new shared renderer, deleting the now-redundant summary-row aggregation functions entirely. See commit `6d9f4a6`.

### Damage tooltip breakdown: new "Damage" row on the Boon-Condition summary bar — 2026-08-02
Bigger scope than Healing's: needed the real GW2 damage formula (weapon strength × coefficient × Power ÷ target Armor), not just a coefficient, since this app tracks Power but not the enemy's Armor. Added a target-armor-class combat-state toggle (matched to gw2skills.net's own WvW convention, per user's pointer) and a new weapon-strength-constants table. See commit `42cbc62`.

### Healing tooltip breakdown: new "Healing" row on the Boon-Condition summary bar — 2026-08-02
The API's heal-fact value is only the reference-build amount with no exposed scaling coefficient, so real scaling needed a wiki-sourced per-skill coefficient table, seeded with one common skill per profession rather than a bulk pass. Also found a real WvW-grouping-direction gap distinct from the existing WvW-override mechanism's own convention. See commit `2492816`.

### Trait and food/utility tooltips now show structured content, not raw description — 2026-08-02
Both reused patterns already proven elsewhere rather than inventing new ones: traits got the same generic fact-line formatter the skill picker already used, food/utility got a bonus-line-joining description builder mirroring how runes already render. See commit `59889f8`.

### Two-handed weapon tooltip used the one-handed constant, not a true 2x/rounding bug — 2026-08-02
User correctly flagged the relationship wasn't a plain doubling; root-caused to the new hover tooltip resolving its adjustment constant purely from the slot key, always returning the one-handed constant for a land weapon slot regardless of whether the equipped weapon was actually two-handed. The Stats-panel total itself was already exact and needed no change. See commit `322c226`.

### Root cause found: stat-prefix picker saved the wrong id for armor/weapon slots — 2026-08-01
User's full-gear screenshot comparison cracked it: the API returns 2 different entries for a stat-combo name that has both an armor/weapon and a trinket variant, and the picker's dedup logic always picked the trinket entry regardless of slot category, silently inflating several attributes on every armor/weapon slot. Fixed at the source (never merge the 2 categories before deduping) plus a self-healing resolver so already-saved builds correct automatically without a migration. See commit `ce51200`.

### Per-item numeric stat tooltips; formula re-verified byte-exact against gw2skills — 2026-08-01
Re-verified the per-item gear formula byte-for-byte against the user's own gw2skills screenshots (confirmed correct, ruling out the math as the source of a separate ongoing mismatch) and shipped the requested hover-tooltip feature showing each item's real point contribution. See commit `54b231e`.

### Trait attribute bonuses (flat + conversion): a real, previously-unmodeled gap — 2026-08-01
User's cross-check against gw2skills.net found the Stats panel never looked at a build's traits at all — a full scan found 193 traits carry a flat bonus or attribute-conversion fact. An unsafe first attempt to auto-apply every unambiguous-looking fact was caught by a synthetic test build (a trait's proc-heal amount isn't a stat grant, despite sharing the same fact shape) and reworked into a strict hand-verified opt-in whitelist. See commit `48fdc92`.

### Gear Optimizer rework: embedded in build editor, translated stats, lexicographic tiers — 2026-08-01
4 pieces of user feedback after trying the first version: moved from a separate nav tab into the build editor itself, switched the metric set to translated derived stats, added up to 3 true-lexicographic maximize tiers, and fixed a real search-quality bug where multi-attribute stat prefixes were systematically passed over by a single-floor-greedy warm start. See commit `44381ff`.

### Gear Optimizer — 2026-08-01
Implemented the net-new feature: operates on an existing saved build (not a blank slate), searching only each slot's stat combo (plus food/utility if toggled) via a greedy-warm-start-plus-branch-and-bound solver, re-deriving final numbers through the same calc path the Stats panel uses so the preview can never drift from what saving would actually produce. See commit `388709a`.

### Legendary-Armory-derived stat-combo legality; EquipmentEditor stat picker cleanup — 2026-08-01
Found the API has no "current/obtainable" flag for stat combos, but every Legendary item's own stat-choices field is exactly that list; derived and wired in a legal-id filter that also resolved the Gear Optimizer's still-open "curated vs. full combo pool" question in favor of the full legal pool. See commit `7bb349a`.

### Tag-filter UI rework: profession/elite-spec picker, custom-tag dropdown, OR semantics — 2026-08-01
Follow-up to user feedback on the first tags/filter pass: fixed a real bug (multi-selecting used AND semantics, so 2 professions always showed zero results — impossible to satisfy), and replaced the flat mixed-tag button row with a dedicated profession/elite-spec picker plus a separate custom-tag dropdown. See commit `a3c614e`.

### Drag-to-reorder cards; Tags + filter/search; last-updated display — 2026-08-01
3 features landed together: manual card reordering (writes only the dragged record's own order field, never touches `updatedAt`), tags with computed non-removable profession/elite-spec auto-tags, and a relative "Updated N days ago" display. Deferred making the relative time patch-aware rather than wall-clock, to avoid building a second parallel patch-detection path ahead of the already-flagged game-data-refresh mechanism. See commit `119bb68`.

### Compact Builds/Squads card grid — 2026-08-01
Switched the saved-record lists from one full-width row per record to a responsive card grid, matching the sidebar's existing compact-card info level. See commit `6b14b00`.

### Beta release prep: in-app auto-update (Settings tab), repo flipped public — 2026-08-01
User wanted beta distribution with in-app updates, Windows-only for now. Asked the user how to reconcile electron-updater needing public release assets rather than deciding unilaterally (a shipped GitHub token has real security tradeoffs) — user chose to make the repo public. Built the full updater seam (mirroring the existing provider-interface pattern) gated to Windows/packaged only, with explicit user-triggered check/download/install steps, no silent background flow. See commit `1c7dfa1`.

### First beta release published: v0.1.0 — 2026-08-01
Published immediately after the auto-update work landed. Found and worked around a real electron-builder bug: concurrent asset uploads on a brand-new tag raced to create 2 duplicate draft releases with assets split between them — fixed by pre-creating the draft release before publishing, establishing the workaround pattern every later release reuses. See commit `913fcfc`.

### Elite-spec grid column-alignment fix; full Control CC set, Miscellaneous, Strip/Corrupt rows — 2026-08-01
Fixed a real CSS bug (grid placement was set on a non-grid-item element two levels too deep). Then did a real fact-shape investigation for Control rather than guessing: found the existing Buff-status classifier was reading a minority signal, and the correct exact-text-match fact types cover Stun/Daze/Knockdown/Knockback/Launch/Pull reliably. Added new Miscellaneous and Strip/Corrupt rows via a new generic named-fact-matcher mechanism. See commit `3d3444d`.

### Build editor 3-column layout: single-click profession/elite-spec picker, relocated Boons/Conditions summary + Control/Auras/Combo — 2026-08-01
Feedback pass to fit the whole editor in one window without scrolling. Replaced 2 separate profession/elite-spec pickers with one combined click-to-both picker, reflowed to a flat 3-column layout, and moved the Boons/Conditions summary into its own standalone panel with 2 new categories (Control/Auras via a newly-parameterized extraction function, Combo via the API's separate combo-field fact type). See commit `60a0279`.

### "Combat state" simulation inputs (Might, Fury, stacking sigil, relic) — 2026-08-01
Built the ephemeral what-if mid-fight inputs scoped the day before: icon-based controls rendered inline in the Stats panel, never persisted on the build itself. Introduced a new `outgoingDamagePercent` derived stat and Stats-panel row that didn't exist anywhere in the app before this. See commit `62bcb31`.

### Thief skill-bar feedback pass (Specter Siphon/Shroud, manual Stolen Skill picker) — 2026-08-01
Specter's F1/F2 were missing from the API's own profession-skill list entirely (same gap class as Guardian's virtues); hand-injected. Thief's Stolen Skill has no build-derivable signal for which skill is "live" in combat, so built a real manual picker feeding the boon/condition calculator directly, closing a previously-open design question. See commit `80087d0`.

### Elementalist skill-bar feedback pass (attunement toggle, Tempest/Catalyst/Evoker F-bar, Staff bug) — 2026-08-01
Root-caused a "stuck skill" bug to a much broader API data gap than originally suspected (every Elementalist weapon's skills 4-5 come back attunement-untagged, not just Staff or Weaver), fixed via a hand-verified 56-id override table. Also converted the attunement toggle to icon-buttons and gave Tempest/Catalyst/Evoker's F-bar entries their real per-form behavior. See commit `2a3ac32`.

### Fix Revenant Conduit's Release Potential (F2) legend-dependence — 2026-08-01
The reported "F1 never changes" bug was actually about the first *visible* icon, previously excluded outright on a wrong assumption about a player-chosen axis this app doesn't model; wiki research found the real mechanic is a clean 1:1 map onto the currently-active legend, no ambiguity left. See commit `0955eca`.

### Skill bar feedback pass: Warrior (Bladesworn Gunsaber/Dragon Trigger) — 2026-08-01
Unblocked by real in-game screenshots the user supplied, which revealed the F1/F2 icons were already correctly resolvable (one real resolver bug fixed along the way) while the actual 5-skill Gunsaber weapon bar needed hand-authoring entirely — those 5 real skill ids are deliberately excluded from the public API. Also caught the earlier wiki-only investigation's ids as flat-out wrong (a coincidental name collision with unrelated NPC boss skills). See commit `373179a`.

### Skill bar feedback pass: Ranger — 2026-08-01
Converted pet-swap and Untamed's toggle to icon buttons, fixed a wrongly-shown Beastmode-only skill leaking onto every Ranger form, and found a real data-identification bug in Celestial Avatar's icon resolution (a spec-id filter that couldn't distinguish the transformation skills from Ranger's ordinary Staff weapon bar, which happens to share the same gating spec tag). See commit `faf0739`.

### Skill bar feedback pass: General, Guardian, Necromancer — 2026-07-31
Multi-commit session covering the empty-state weapon-bar width fix, always-on Weaponmaster Training, Dragonhunter's virtue-icon gap (another hand-injection case), Firebrand's Tomes converted to clickable F-bar icons, and Necromancer's Shroud converted the same way — the latter needing real data archaeology (Downed-slot label reuse) plus a same-day follow-up fix once a user report showed every Necromancer elite spec's Shroud was resolving to core Death Shroud instead of its own. See commits `b99fb5e`, `ee52544`, `e5c1cac`, `992ad9f`, and `a27f90e` (follow-up fix).

### Thin backend: shareable build/squad links, deployed live — 2026-07-31
Built and deployed a minimal Cloudflare Worker + KV opaque-blob store (no framework, matching this codebase's hand-rolled-over-dependency preference), plus a screenshot-to-clipboard sharing alternative to a public web viewer for v1. Squad comps share as a self-contained snapshot bundling every referenced build, not bare id references. Unblocks the Discord bot roadmap item. See commit `2cc8e47`.

### Electron packaging/distribution config — 2026-07-31
Landed the top-priority roadmap item. 2 real gaps fixed, not just config plumbing: better-sqlite3's native binding can't load from inside an asar archive, and game-data loading had never handled the packaged-app case at all. Verified by inspecting the actual build output tree, since this shell can't launch a real GUI window. See commit `adb0ef3`.

### Weapon duplicate-skill-slot edge cases resolved (Revenant/Guardian/Engineer/Thief/Elementalist) — 2026-07-31
Full pass across every profession's weapon-skill data (not just the 2 originally-spotted cases) found 5 distinct causes, each resolved via a real signal rather than an unexplained fallback — including modeling Elementalist's 4 simultaneously-equipped attunement skill bars as a genuinely new build-state axis, the same shape as Revenant's 2 legends. See commit `5f13536`.

### Ranger Untamed Unleash-Pet premise corrected; Vindicator Legend7 boon-calc gap fixed — 2026-07-31
The Untamed item turned out to have no real code gap at all — a wrong premise from a misread screenshot, corrected by reading the wiki's raw wikitext directly instead. The Vindicator item was a real boon-calc undercounting bug: the aggregate calc only ever fed the boon calculator each legend's base ids, never their flip targets, silently dropping every Saint-Viktor-side boon grant. Widened the fix to every legend's channeled skills once a quick scan showed the same pattern elsewhere. See commit `c8145fb`.

### Elite-spec skill gating: resolved all ~36 ambiguous / ~16 unmatched wiki pages — 2026-07-31
Extended the wiki-cross-check script using each candidate id's own `specializationId` field as a corroborating signal, after sanity-checking it against 211 already-clean mappings first. All ~36 ambiguous groups turned out to share one shape (multiple ids all within one elite spec); a disambiguation-suffix stripping fix resolved the one remaining unmatched page. Net: 295 mappings, 0 unmatched, 0 ambiguous. See commit `39c4ba1`.

### Elementalist Evoker's familiar concept + Rejuvenate dedup — 2026-07-31
Corrected the original scoping note's premise (Rejuvenate's 4 ids aren't per-attunement, they're per-familiar) via the wiki's own id-comment annotations. Modeled the familiar concept just enough to resolve the picker ambiguity; deliberately left the familiar's own passive bonus and active F5 skill (a charge-accumulation state machine) unmodeled as a real scope boundary. See commit `f976c0e`.

### Soulbeast's Beastmode F1-F3 (per-pet-family/archetype skills) — 2026-07-31
No API field links a pet to its Beastmode skill at all; sourced entirely from 2 wiki tables. Found the wiki's own aggregate tables lag actual game content (a brand-new pet family, an undocumented per-species override) and built a self-healing generic fallback resolution instead of hand-pinning the 2 cases found. All 66 pets now resolve to a complete skill triplet. See commit `7e5d551`.

### Remaining duplicate-skill groups: turret sub-abilities + wiki exclusion — 2026-07-31
Found a clean local-data-only signal (empty categories + a shared toolbeltSkill with a categorized sibling) that resolves an entire class of turret/gadget/elixir sub-abilities with no wiki fetch needed at all. Built a 2nd script for the rest, requiring at least one local id to overlap with the wiki page before trusting an exclusion. Also surfaced Elementalist's brand-new Evoker elite spec as a genuinely new modeling gap, flagged rather than guessed at. See commit `1a42688`.

### Druid Glyph duplicate-skill disambiguation — 2026-07-31
Live-verified via the wiki that each Glyph has one canonical id whose effect already changes automatically with the active Celestial Avatar form — overturning the original item's premise that a future toggle would need to swap picker entries; there's nothing to toggle, the picker just needed the 2 purely-documentary child pages excluded. See commit `695c47b`.

### Celestial Avatar / Untamed weapon-bar swap — 2026-07-31
Celestial Avatar has real API ids, extended straight from the existing bundle-skill machinery. Untamed turned out not to replace the full weapon bar at all (a wrong premise in the original item) — live wiki text showed it's a single autoattack-only swap plus a separate pet-command swap, already partly wired; built the real weapon-autoattack alternate-resolution logic this required. See commit `a8d436d`.

### Engineer Kits and Firebrand Tomes replace the weapon skill bar — 2026-07-31
Kits use real API bundle-skill ids; Firebrand's 15 Tome chapter skills have no id anywhere in the public API at all, so built a dedicated wiki-scrape script reusing the relic-effects fact parser. Investigation overturned the item's own premise for a 3rd case: Soulbeast's Beastmode doesn't replace the weapon bar either, it changes the profession-mechanic bar instead — descoped and corrected in TODO.md rather than built wrong. See commit `829b1dd`.

### Trait tier alignment fix, full F1-F5 profession-mechanic bar — 2026-07-31
A CSS-only fix for trait-tier layout, plus the "broad" scope the user chose for the F-bar: live-verified all 9 professions up front before writing code, finding real per-profession wrinkles (Warrior's Burst Skill varies by weapon type, Engineer's Toolbelt isn't in the API's profession-skill list at all, Ranger needed a whole new Pet concept). Also fixed a latent correctness gap in the underlying resolver where an unequipped elite spec's skill could still surface by default. See commit `16e6795`.

### Follow-up build-editor feedback: horizontal traits, weapon/spec pickers, gear copy/paste, F-skill investigation — 2026-07-31
Multi-part feedback pass: fixed the trait-line macro layout to real horizontal rows, replaced always-visible spec/weapon-type icon rows with click-to-open pickers, and built a full gear copy/paste bar with native drag-and-drop (no new dependency, matching this codebase's hand-rolled-over-library convention). Investigated F1-F6 profession-mechanic skills and found it much deeper than expected — landed the data layer but deliberately deferred any UI, since a generic bar would be flat wrong for most professions' genuinely multi-axis mechanics. See commits `bef3bb1` and `6db4ef7` (an earlier same-day pass, backfilled here since it was never separately written up).

### Squad preview builder (party grid, drag-and-drop, boon/condi summaries) — 2026-07-30
Built from a user hand-sketch, scope confirmed via follow-up questions before any code was written. Found the full squad data-model and persistence stack already existed from earlier scaffolding, unwired to any UI — this landed as renderer + one shared calc module with zero schema/IPC changes. Drag-and-drop built with native HTML5 DnD, no library. See commit `ecab675`.

### Relic numeric effects via a wiki `{{skill fact}}` cross-check — 2026-07-30
User chose the wiki cross-check over leaving relic tooltips as inert prose forever. Confirmed relic wiki pages reuse the exact same fact template skills/traits use, built a dedicated fetch script, and found 2 real wrinkles handled rather than guessed around: 7 of 113 relic names cover ids with genuinely different descriptions (facts attributed only to the ids the wiki explicitly lists), and a naive pipe-split breaks on embedded wikilinks (handled with a placeholder-swap plus a conservative drop-on-doubt safety net). Deliberately not wired into the boon/condition uptime calculator — a relic's proc has no fixed per-rotation frequency this app models, so aggregating it would invent a number. See commit `10f43a6`.

### Multi-step skill collapsing via the `flip_skill` field — 2026-07-29
Live-verified the API's flip_skill field before writing code, finding it chains through kits/turrets/mantras/multi-hit skills — none of whose intermediate/release ids are independently equippable, yet the picker had no way to know that. Found and fixed a previously-undiscovered bug: 84 different-named flip targets (not just same-name duplicates) were silently offered in pickers as if legitimate independent choices. Also added a 4th "flip-root" collapsing signal that, combined with the existing ground-target signal, resolves cases neither alone could. See commit `4cd741c`.

### Duplicate-name skill collapsing (attunement/specialization/ground-target signals) — 2026-07-29
Re-fetched the API to confirm 2 previously-uncaptured real fields (attunement, specialization) exist; a 3rd signal (the already-captured ground-target flag) resolved the largest chunk. All 3 signals resolve automatically with no manual cycling UI needed — every group that isn't a genuine independent choice collapses on its own. ~47 groups remained genuinely ambiguous, left un-collapsed rather than guessed. See commit `1b94f2c`.

### Item-rarity color coding + skill-variant-collapsing scoping investigation — 2026-07-29
Landed rarity color-coding for the 2 categories with a single confirmed native rarity. Investigated skill-variant collapsing and found it needs its own dedicated wiki-research session (117 duplicate-name groups, no existing field distinguishes them) — documented rather than guessed at or silently deferred. See commit `0a8efd3`.

### Character-stats panel: stats-calc math + UI — 2026-07-29
Wiki-verified every derived-stat formula from scratch (crit chance/damage, armor, health, profession weight class), matching the second of 2 previously-recorded reference numbers exactly while flagging the first as an unreliable transcription rather than chasing it. Restructured the core attribute-totals type to separate raw points from already-percent bonus text, added free-text attribute-name aliasing and rune stage-gating, and built the actual Stats panel UI. Verified against 3 hand-calculated scenarios. See commit `3d92cfe`.

### Gear-upgrade/consumable picker UI (runes, sigils, infusions, relics, food, utility) — 2026-07-29
Built the picker UI for all 6 categories via one shared generic component rather than 6 duplicated ones. Fixed a latent bug this surfaced: changing a slot's stat combo was silently wiping that slot's rune/sigil/infusion picks. Infusions turned out free to wire into the stats math since their attribute names already match the core-attribute key convention exactly. See commit `5e61182`.

### Gear-upgrade/consumable data layer (runes, sigils, infusions, relics, food, utility) — 2026-07-29
No dedicated API endpoint exists for any of these — all are `/v2/items` entries requiring a full 73,989-item bulk fetch filtered client-side, cached locally so iterating on filter bugs didn't cost a re-fetch each time. 2 real API-shape assumptions from earlier scoping turned out wrong once fetched live (infusions have no type field distinguishing WvW from Agony; relics carry no structured fact data via the public API at all, only prose) — both caught by the fetch script's own diagnostic logging, not shipped silently wrong. See commit `5e6118b`.

### Weapon selection (type picker, hand filtering, 2H merge, underwater, ENVIRONMENT toggle) — 2026-07-29
Closed every remaining sub-item of the weapon-selection feature. Resolved land/underwater skill disambiguation via a real API field rather than the earlier session's "presumably order-distinguished" guess. Found and fixed a latent bug the two-handed-weapon math newly exposed (crediting a weapon slot even when nothing was equipped there). Wired weapon-derived skills into the boon/condition calculator for the first time. See commit `2562b1e`.

### Revenant dual-legend skill bar — 2026-07-29
Modeled the legend-swap mechanic as a genuinely new concept rather than a tweak, since the existing skill-selection type had no legend concept at all. The API gives no elite-spec-gating info for legends, so cross-checked a small hand-verified table against the wiki, including an expansion legend pairing released after this assistant's training cutoff. See commit `e8eacf0`.

### Weapon-selection reference screenshots digested; per-profession weapon data fetched — 2026-07-29
Mostly a digestion session — wrote every confirmed UI detail from re-taken reference screenshots into TODO.md so it wouldn't be lost again — plus landed the one cleanly actionable piece of new scope: real per-profession weapon availability data straight from the API, including a same-day follow-up correction to the infusion slot counts once more screenshots came in. See commits `72bd535`, `d39a4a6`, and `0820185` (corrections).

### Elite specialization selector, unblocked by a trait-line data-model fix — 2026-07-29
Fixed the underlying bug first: the trait-line array was silently compacted on every change, so "the 3rd line" wasn't a stable index. Replaced with a fixed-length 3-slot type, then built the elite-spec selector on top of the now-stable index. See commit `833c70d`.

### Build editor UI/UX overhaul: instant tooltips, aligned trait grid, skill boon/condition tooltips — 2026-07-29
Picked off the well-specified pieces of a large multi-part UI item, deliberately deferring pieces blocked on missing reference screenshots or a data-model change discovered mid-session (documented, not guessed at) rather than forcing them through. Built a real hover-tooltip component (native `title=` has an uncontrollable OS delay), restructured the trait grid to real CSS Grid alignment, and gave skill tooltips their actual boon/condition output for the first time. See commit `aec9b73`.

### WvW-vs-PvE fact splits for the boon/condition calculator — 2026-07-25
Confirmed via direct API/wiki cross-check that Buff facts carry no game-mode tag at all, and some skills' facts arrays mix PvE-only and WvW/PvP-only boons together with no way to tell which is which from the API alone. Deliberately widened scope beyond the originally-scoped ~15-20 skills once it was clear a narrower fix would leave every other profession's builds silently showing wrong numbers. Built a dedicated wiki-splits fetch script with cross-validation against the API's own duration set to guard against wikitext-parsing pipe-collision bugs. See commit `feab9d4`.

### Gear scaling for boon/condition duration % — 2026-07-25
Quoted both the attribute-total formula and its constants directly from the wiki's API-reference page, not reconstructed from memory. A previously-blocking itemstat-id ambiguity question turned out moot — the picker only ever offers already-deduped canonical ids, so gear math needed no further resolution. Documented (not silently ignored) the known limitation that weapon slots couldn't yet distinguish one- from two-handed. See commit `feab9d4`.

### Icon+name swap follow-through: SkillsEditor and BoonUptimePanel — 2026-07-25
Rebuilt the skill picker as an in-game-style icon bar. A hand-maintained boon/condition icon map TODO.md had flagged as necessary turned out unnecessary — every Buff fact already carries its own icon URL, extractable from already-fetched data with no new fetch needed. See commit `feab9d4`.

### Icon+name UI swap for gear loadout and traits, pulled forward ahead of MVP — 2026-07-25
Rebuilt Traits as an icon-based progression tree and Equipment as a paperdoll layout. Found and fixed a real trait-tier grouping bug uncovered while rebuilding (grouping by choice-slot position instead of the real Adept/Master/Grandmaster tier), and a real CSP bug that had been silently blocking every remote icon in the app — caught only by actually building and screenshotting the packaged app, not by typecheck/lint. See commit `feab9d4`.

### Elite-spec skill gating, equipment dedup, and wiki-extraction research — 2026-07-25
The build editor had no elite-spec gating at all since neither API endpoint exposes the mapping; sourced it from the wiki instead via a new dedicated fetch script. Also fixed a duplicate-stat-name picker bug via a scoring heuristic verified in Python against all 43 duplicate groups before porting to TypeScript. Confirmed via live wiki research (not assumption) that both gear-scaling and WvW-split data are extractable from the wiki, setting up the next 2 sessions' work. See commit `86915e1`.

### Boon/condition source parser (first slice of the uptime calculator) — 2026-07-25
Typed the API's Fact shape and built the first real boon/condition extraction walk, including trait-gating. Verified end-to-end via a scripted Electron launch against the actual built output (not just dev mode), which caught a real path-resolution bug that would have made every game-data IPC call silently fail once packaged. Investigated but deliberately did not implement gear-based duration scaling this session — the wiki cross-check needed for confidence wasn't done yet. See commit `e6da047`.

### Build editor UI — 2026-07-25
Built the game-data IPC bridge and the first full build editor (profession/traits/skills/equipment pickers) plus a stub Boon Uptime panel documenting the planned calculator shape. Verified end-to-end via a scripted Playwright/Electron launch confirming a build round-trips through SQLite correctly. See commit `4211caf`.

### Scaffolding & data-layer groundwork — 2026-07-25
Project scaffold (Electron + React + TypeScript), the GW2 static-game-data fetch pipeline, the core data model, and a SQLite storage layer behind a swappable adapter interface (the seam a future Capacitor storage plugin would implement instead). Fixed 2 real environment bugs during setup: Electron's ESM/CJS interop issue with the native `electron` module, and a native-binding ABI mismatch between the default better-sqlite3 install and Electron's bundled V8. See commit `b962a88`.
