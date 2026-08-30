# Completed

Entries are added as work lands, most recent first. Everything before the v1.0.0 release
(2026-08-15) is archived in `COMPLETED-archive-pre-1.0.md`.

### Gear Optimizer: food/utility self-conversion search credit — 2026-08-28
Credits a candidate's own food/utility self-conversion during the Gear Optimizer search itself (previously only fixed/equipped items got credit), reusing the existing EffectivePower fixed-point iteration loop to refine the assumption pass over pass. See commit `bc342ef`.

### Condition-damage display, Leg 2: wire into skill tooltips — 2026-08-28
Wires Leg 1's condition-damage formula table into skill tooltips as an "≈ N dmg/s" line; resolves Torment (always stationary), Confusion (DoT half only), and scope (skill tooltips only, not the aggregate panel) per user direction. See commit `0172608`.

### Resource-cost modeling (energy/initiative/upkeep/health cost) — 2026-08-28
Adds wiki-sourced Energy/Initiative/Upkeep/Health Cost as new display-only tooltip lines (108 skills across Revenant/Thief/Necromancer/Ranger), since the API carries no cost field for any of them. See commit `bc92317`.

### Data-completeness audit Shape 2: 6 relic bonuses wired in — 2026-08-28
Wires 6 of the 14 Shape 2 relic bonuses (flat-attribute, duration-%, crit-chance) into calculators via 3 new `CURATED_RELIC_*` tables; 2 more logged as excluded with reasoning. See commit `a466c25`.

### Build Template chat-link codec — 2026-08-23
Builds the official GW2 Build Template chat-link encode/decode (byte layout reverse-engineered from the wiki and cross-checked against a reference implementation), wired in as Copy/Paste Build Template buttons. Same-day validation against 5 real in-game-captured codes decoded with zero warnings. See commits `76163d0` (core) and `8b82438` (validation close-out).

### v1.2.1 release — 2026-08-23
Patch release shipping the in-app release-notes dialog below. See commit `08b2694`.

### In-app release notes ("What's New" dialog) — 2026-08-23
Adds a Markdown-rendered "What's New" dialog sourced directly from `CHANGELOG.md`, auto-popping once after an update and reachable on-demand from Settings; shipped in the same commit as the v1.2.1 release. See commit `08b2694`.

### v1.2.0 release — 2026-08-23
Second post-1.0 feature release, covering the Discord bot's full Phases 1-4 build-out, a batch of Gear Optimizer work, Builds/Squads UX polish, and a large volume of boon/condition/stat-accuracy curation since v1.1.0. See commit `5d69d38`.

### Gear Optimizer: active trait conversions credited during search — 2026-08-23
Trait attribute conversions (e.g. Virtuoso's Quiet Intensity) previously only applied to the final reported result, not the search's own slot-by-slot comparisons — fixed exactly (not approximated) by splitting the linear conversion into a fixed baseline credit plus a per-option delta credit. See commit `424131e`.

### Gear Optimizer: every weapon slot shares one stat prefix across both sets — 2026-08-23
Closes the "doesn't fill the inactive weapon set" gap: all weapon items across both weapon sets now search as one shared-prefix slot, so a weapon-swap can no longer cause a stat swing mid-fight. See commit `2aba5f1`.

### Gear Optimizer truncation item closed out — 2026-08-23
Bookkeeping close-out confirming all 4 planned steps (Pareto-dominance pruning, Web Worker move, slot-group collapsing, infeasible-message fix) had already landed. See commit `3378580`.

### Gear Optimizer: `EffectivePower` composite maximize-target — 2026-08-23
Adds a linearized Power×CritChance×CritDamage composite metric (with a small fixed-point re-linearization loop) so the optimizer can maximize real expected damage instead of a guessed stat-priority order. See commit `6a7e10c`.

### Gear Optimizer: fixed a misleading "infeasible" message and its cause — 2026-08-23
A proven-infeasible search and a timed-out search looked identical to the user; fixed the message, and root-caused the real slowdown to per-slot search-space explosion, fixed via `collapseIdenticalOptionGroups`. See commit `d65969b`.

### Scion's Reprieve investigated and correctly excluded — 2026-08-23
Closes the last open item from the Outgoing/Incoming Healing % sweep: wiki-verified it buffs the *target's* incoming healing, not the caster's own output, so it's out of scope for this app's single-character stat model. See commit `c1ba645`.

### Wellspring tooltip gap closed — 2026-08-23
`BuffConversion` facts had no tooltip-rendering case at all; adding one fixes all 27 `CURATED_CONVERSIONS` entries at once, not just Wellspring. See commit `e68c17a`.

### Data-completeness audit Shape 1 (opaque effectiveness) — 2026-08-22
4 of the backlog's sources wired into calculators (Swiftness effectiveness, Relic of Atrocity life-steal, Bolstered Bonds' Cosmic Wisdom doubling); the rest logged as new never-modeled stat families, none worth dedicated infra for 1-2 candidates. See commit `40d5438`.

### Data-completeness audit Shape 3 resolved as false-positive — 2026-08-22
All 87 flagged hits were condition-removal or ignored-effect wiki templates, not real duration-bound applications the existing render gate already correctly excludes; fixed the audit script to stop flagging the pattern. See commit `272eed5`.

### Outgoing Damage % full pass, Traits leg (Thief) — sweep complete — 2026-08-22
Closes the Traits leg and the entire "Outgoing Damage % full pass" item — Sigils, Relics, and Traits are now fully curated across all 9 professions. See commit `c8d7ff5`.

### Outgoing Damage % full pass, Traits leg (Revenant) — 2026-08-22
6 of 12 candidates curated; a new `FLAT_CONDITION_DAMAGE_TRAIT_BONUSES` table was needed for Destructive Impulses (the first trait in this sweep affecting all damage, not just strike). See commit `efaac20`.

### Outgoing Damage % full pass, Traits leg (Ranger) — 2026-08-22
4 of 16 candidates curated; Bird of Prey needed a new `superspeedActive` combat-state field and OR-gated bonus table. See commit `53e3132`.

### Outgoing Damage % full pass, Traits leg (Engineer) — 2026-08-22
3 of 10 candidates curated (Takedown Round, Glass Cannon, Excessive Energy); also widened a `CombatStatePanel` gating check that was silently hiding a toggle for a build that picked only one of two traits sharing a table. See commit `39338b9`.

### Outgoing Damage % full pass, Traits leg (Elementalist) — 2026-08-22
Only 1 of 8 candidates curated (Flow like Water, folded into the existing high-health damage table); smallest leg so far. See commit `a06d96e`.

### Outgoing Damage % full pass, Traits leg (Warrior + Guardian catch-up) — 2026-08-22
5 of 11 Warrior candidates curated, plus a missed Guardian trait (Unscathed Contender) caught while cross-referencing and curated as a catch-up; also fixed a `CombatStatePanel` gating bug found along the way. See commit `4064b21`.

### Outgoing Damage % full pass, Traits leg (Guardian) — 2026-08-22
Started the Traits leg (166 raw rows / ~78 unique candidates across all 9 professions, bigger than the original scoping estimate); 3 of 9 Guardian candidates curated, including a new generalized `PER_BOON_DAMAGE_TRAIT_BONUSES` table anticipating 4 other professions' own per-boon damage traits. See commit `c57927f`.

### Outgoing Damage % full pass, Sigils + Relics legs — 2026-08-21
Replaced the inline `outgoingDamagePercent`/`outgoingConditionDamagePercent` formulas with proper resolvers and curated every Slaying/Force/Impact/Night/Bursting sigil plus all 14 "Damage Increase" relics; Traits (~148 candidates) deliberately deferred to a later session. See commit `717248e`.

### 3 bugs found reviewing the Healing % sweep (Heal Druid/Healegade) — 2026-08-22
User's review of Session 276 against 2 saved builds surfaced 3 real bugs: Righteous Rebel's healing share was wrongly per-stack instead of flat, Fortifying Bond was reporting all 12 boons as its own sources, and Windborne Notes' Regeneration showed as unconditional when it's Warhorn-skill-gated. See commit `4b0fb7c`.

### Outgoing/Incoming Healing % sweep — 2026-08-22
New `outgoingHealingPercent`/`incomingHealingPercent` `DerivedStats` fields (additive-stacking, unlike movement speed's "highest wins") with resolvers covering traits, sigils, relics, and food/utility across a re-scanned candidate list that both added and corrected several sources missed by the original manual scoping pass. See commit `88acbde`.

### Recharge/cooldown WvW-override sweep — 2026-08-22
Generalized the already-shipped relic-only "prefer the wiki's WvW recharge over the API's PvE-reference value" rule to skills and traits (149 skills + 4 traits), wired into both tooltip display and 2 relic-proc calculations that derive duration from an equipped skill's own recharge. See commit `6b75e7d`.

### Data-completeness audit script, first run — 2026-08-22
Built `scripts/audit-data-completeness.ts`, a standing tool scanning local data files (no wiki fetch) for 3 structural gap-shapes (opaque fact labels, numeric content buried in relic params, buffs missing a duration field); first run logged a backlog of 21+42+14+87 hits to TODO.md, no curation yet. See commit `1ae1acd`.

### Mesmer Shatter 4 stun-break fix — 2026-08-21
Distortion never showed "Breaks Stun" even with Mental Defense equipped — the 2026-08-14 trait-mirroring sweep had copied Mental Defense's Resistance grants onto the skill but left its stun-break fact out; fixed via `synthetic-facts.json` plus a matching target-count entry. Closes the entire trait/skill data-correctness pass. See commit `fef57c2`.

### Corrupt row undercount: Well of Corruption + Elixir of Bliss — 2026-08-21
Full 58-candidate description sweep of boon-corrupt sources found 2 genuine API omissions (both confirmed via wiki `missing facts=`), curated via a new hand-curated override table reused by both the aggregate row and per-skill tooltips. See commit `3b07c28`.

### Firebrand Tome chapters wired into the Control/Misc/Cleanse pipeline — 2026-08-21
Tome chapters had no `Skill` id at all, so nothing they carried could reach the Control/Miscellaneous/Strip-Corrupt-Cleanse pipeline regardless of content; fixed both user-flagged gaps (Stalwart Stand's Breaks Stun, Eternal Oasis's Cleanse) plus a 3rd found along the way (Heated Rebuke's Pull). See commits `44efbcf` and `dd1211e`.

### Duplicate builds/squads from a right-click menu — 2026-08-21
Wires the existing reusable context-menu component onto the main Builds/Squads tab card lists (previously only the squad editor's sidebar had one), adding a "Duplicate" action. See commit `3d85cbc`.

### Equipment text manifest always-on; Share Link auto-copies — 2026-08-21
The screenshot-only equipment manifest is now always shown instead of toggled; "Share" is renamed "Share Link" and copies to clipboard on first press instead of requiring a second Copy click. See commit `8a97ce3`.

### Main sweep complete: WvW/PvE duplicate-fact values, all 8 non-Revenant professions — 2026-08-20
Multi-commit sweep (one leg per profession) fixing the raw API's habit of baking undiscriminated PvE/WvW/PvP fact duplicates into `facts`, using the two mechanisms the earlier Revenant-only sweep proved out (`wvw-fact-overrides.json` for Buff facts, `NUMERIC_FACT_WVW_OVERRIDES` for numeric facts). Curated roughly 200 traits total across Guardian/Warrior/Mesmer/Engineer/Ranger/Thief/Elementalist/Necromancer; a recurring finding was a latent "override only replaces duration, not apply_count" bug, fixed via `BUFF_INSTANCE_VALUE_OVERRIDES` wherever found, plus several genuinely-unfixable boon-type-swap or embedded-sub-value gaps left documented rather than guessed. Closes both phases of the WvW-duplicate-fact sweep. See commits `7d7d970`, `19edf51`, `5ee37c8`, `ef017f7`, `ebacd2b`, `2f2517b`, `59217bc`, `f8290ab` (Guardian through Necromancer, in leg order).

### Illusionary Defense: Buff-type dedup + missing F2 boon — 2026-08-20
User-caught follow-up to the Mesmer leg above (which only scanned numeric fact types, not Buff-type): fixed a real duplicate-fact display bug plus a boon missing from the F2 skill's own tooltip because the trait-mirroring sweep's candidate list was built from a narrower wiki field than this trait used. See commit `af59e7e`.

### `AttributeAdjust` WvW-duplicate dedup: 3rd fact shape added — 2026-08-20
Infra leg landed ahead of the main 8-profession sweep so one pass could catch all 3 duplicate-fact shapes at once; also resolved 2 previously-known loose ends (Battle Scarred, Expanded Consciousness) now that the filter covers `AttributeAdjust` facts. See commit `be70e00`.

### Gear-box sizing fix; Equipment text manifest Ranger pet line — 2026-08-20
Two "quick wins" from the 2026-08-20 scoping discussion, landed in one commit: sigil/infusion badges no longer overflow the weapon icon (root cause was a stretched flex row with no width cap), and the equipment manifest gained a Ranger pet line. See commit `9296f27`.

### Life Siphon Damage sweep: new `CURATED_SIPHON_DAMAGE_COEFFICIENTS` table — 2026-08-20
Generalizes the Cosmic Wisdom siphon-damage formula into a proper per-skill coefficient table; of 14 candidate skills, only 4 had a wiki value matching the app's API-sourced base value closely enough to curate, the rest logged with per-skill reasons (wiki/API mismatches, stub tags, wrong formula shape, unreachable ids). See commit `7db0975`.

### Settings tab 2-column layout — 2026-08-20
Closes the UI/UX polish section: Settings' 4 panels now sit in a fixed 2-column grid, collapsing to 1 column under 820px. See commit `aac7b44`.

### Found Purpose supersedes Numinous Gift on Cosmic Wisdom — 2026-08-20
Closes the last open Revenant item: when both grandmaster majors are active, Found Purpose's own party-wide boon grants take over from Numinous Gift's self-only copy on Cosmic Wisdom cast, resolved the same "trait B supersedes trait A" way Core Value/True Nature's Herald F2 case was. See commit `be12b7d`.

### Movement-speed sweep: 4 runes + 7 traits + 1 relic — 2026-08-20
Extends the movement-speed stat added for Rising Momentum to every other real source; the key finding was that GW2 movement speed doesn't stack additively like every other %-bonus this app tracks — implemented as "highest value wins" with Rising Momentum layered on top as the one documented additive exception. See commit `6413048`.

### Rising Momentum (Herald): new movement-speed stat + upkeep-points combat state — 2026-08-19
Closes the last open item from the 2026-08-19 Revenant bug list. Needed a genuinely new `DerivedStats.movementSpeedPercent` field (first time this app modeled movement speed at all) plus a manual "points of upkeep" combat-state counter, since the API exposes no per-skill upkeep cost to derive one automatically. See commit `6bbc017`.

### Herald F2 (Facet of Nature) + Core Value: real linked tooltip + boosted numbers — 2026-08-19
Closes the last big item from the 2026-08-19 Revenant bug list. Facet of Nature's Consume effect is really 5 separate per-legend skill ids with no `flipSkill` link; curated as new labeled branch sections on the skill's own tooltip rather than generic flip-chain plumbing, and decoded the API's `overrides` field (a fact index, not a mystery value) to apply Core Value's boost. See commit `bd75770`.

### Numinous Gift's synthetic Cosmic Wisdom copy: add Dwarf's missing Resolution boon — 2026-08-19
Small follow-up: the synthetic copy of Numinous Gift's boons onto Cosmic Wisdom was missing Dwarf's Resolution grant that the real trait facts carry. See commit `5bba7a4`.

### Numinous Gift + Mistfire's Cosmic Wisdom effects (Found Purpose deliberately deferred) — 2026-08-19
Both traits' real API facts needed only copying onto Cosmic Wisdom via `synthetic-facts.json`; Found Purpose was deliberately NOT copied the same way since it shares statuses with Numinous Gift and this app's fact pipeline has no "trait B's value supersedes trait A's" concept yet (resolved 2 sessions later). See commit `bbb2e52`.

### Cosmic Wisdom's Assassin/Warrior/Dervish forms get real damage/healing numbers — 2026-08-19
The 3 forms' real effects live on wiki pages for skill ids that don't exist in the public API at all; curated by hand from each form's own formula template and appended as extra branch-conditional tooltip lines gated by equipped legend, rather than the generic coefficient tables (which would show unconditionally). See commit `0053574`.

### Bolstered Bonds' real stat contribution + Cosmic Wisdom's per-legend "Form" tooltip — 2026-08-19
Two follow-ups from the prior session: Bolstered Bonds now contributes real attribute points (gated on both equipped legends permanently, not just the active one), and Cosmic Wisdom's per-legend "Form of X" descriptions — previously dropped because they aren't recognized boon/condition names — now render via a new opt-in allow-list mechanism. A same-day follow-up fixed the new tooltip rows overlapping long description text. See commits `f100d75` and `a5646e3`.

### Bolstered Bonds: per-legend attribute detail display — 2026-08-19
User-flagged gap: the trait's 6 per-legend facts use legend names as their `status` rather than real boon names, so the boon/condition pipeline silently dropped all of them; built a small parallel hand-curated table and display path rather than reusing the boon pipeline. Display-only — the real stat contribution followed the next session. See commit `df97877`.

### Closes Session 251's 4-trait `wvw-fact-overrides.json` gap — 2026-08-19
A plain wiki-splits re-run didn't pick up the 4 flagged traits (their splits live on a fact type the automated candidate scan never considers); hand-investigated each — 2 curated as genuine splits, Numinous Gift needed no override, and Bolstered Bonds turned out to be a different, deeper gap entirely (resolved 2 sessions later). See commit `76552b0`.

### Conduit leg closes the Revenant `NUMERIC_FACT_WVW_OVERRIDES` sweep (8/8 lines) — 2026-08-19
Final leg of the multi-session Revenant trait-line sweep started from the Salvation triage; found 3 real splits on Conduit's newer traits, plus a new unresolved gap (4 traits with real Buff-typed splits not yet in `wvw-fact-overrides.json`) logged for follow-up. See commit `cd4717e`.

### Discord bot: squad equivalents for approval Preview + board select menu, live-verified — 2026-08-19
Closes the two follow-on integration points left open after `/squaddisplay`: squad approval requests can now preview a screenshot, and the squad board has its own per-entry preview select menu; live-verified in a real Discord server with no bugs found this time. Closes out the Discord bot's design-of-record. See commits `b8aac5a` and `805275a`.

### Discord bot Phase 4 leg 3: `/squaddisplay`, closes out Phase 4 — 2026-08-19
Mirrors `/builddisplay`'s design exactly. Live testing caught one real gap same-day (every slot's profession icon showed the empty placeholder because the preview page passed an empty builds list to the icon-lookup component) — fixed and redeployed same day. See commits `f2b0726` and `8a8d230`.

### Discord bot Phase 2: live verification + a real reliability fix — 2026-08-19
User manually tested Phase 2 end-to-end in a real Discord server; one real gap surfaced (a deferred-response followup with no error handling could silently swallow a transient failure), fixed with a retry same day. See commits `61a3631` and `e0b7d52`.

### Discord bot Phase 2: core CRUD + board sync — 2026-08-19
Built out board admin, build/squad CRUD, and name autocomplete in Automatic mode (no approval workflow yet); verified via a throwaway smoke-test script against a real local D1 database, then deployed live with the user's go-ahead. See commits `aee9899` and `51210b9`.

### Discord bot Phase 1: live end-to-end — 2026-08-19
Deployed the worker, set the production bot-token secret, registered `/ping` globally, and confirmed it live in a real Discord server. See commit `6d5fe74`.

### Build screenshot layout redesign: scrollbar follow-up confirmed — 2026-08-19
User confirmed the residual scrollbar from the earlier redesign is gone after a blind spacing trim; closes the whole item. See commit `85c0c75`.

### Builds-tab exclusion filter — 2026-08-19
Extends the shared tag-filter hook from OR-inclusion-only to a 3-state include/exclude/absent model, propagated through the shared filter-bar plumbing so Builds, Squads, and the squad editor's build picker all got exclusion filtering for free. See commit `1131729`.

### Party-wide filter sweep leg 5: Breaks-Stun wiki pass (closes the sweep) — 2026-08-19
Final leg of the Misc-row target-count sweep: rather than another local-description read, fetched each of 113 remaining Breaks-Stun candidates' own wiki page for its explicit self-vs-allies template signal. Found 1 real party-wide source; confirmed the other 112 as genuinely self-only. Closes the whole `MISCELLANEOUS_MATCHERS` party-wide item. See commit `81a70c7`.

### Party-wide filter sweep leg 4: Barrier manual description read (closes the sweep) — 2026-08-18
Fourth and last leg: of 79 Barrier-fact-carrying sources, a full local description read plus 2 wiki checks confirmed 15 skills + 7 traits as party-wide, including 2 same-name-but-different-mechanic sibling pairs found the same way the Stealth leg's Toss Elixir S pair was. See commit `e2b1ad9`.

### Time Warp Superspeed correction — 2026-08-18
Same-day user correction to the prior session's "left ambiguous" call: real-game knowledge confirmed Time Warp only grants Superspeed with Temporal Enchanter equipped, curated as a trait-conditional target count. See commit `dd2b5b4`.

### Party-wide filter sweep leg 3: Superspeed manual description read — 2026-08-18
Third leg: of 51 remaining Superspeed candidates, 12 skills + 3 traits confirmed party-wide from local data plus one live wiki check; found a clean systemic pattern excluding 7 Engineer toolbelt-adjacent skills that share a trait-gated fact but don't meet its own stated condition. See commit `1e1e445`.

### Party-wide filter sweep leg 2: Stealth manual description read — 2026-08-18
Second leg: of 32 remaining Stealth candidates, 8 skills confirmed party-wide from local data plus 2 via live wiki text. User corrected an initial "ambiguous" exclusion twice in-session, establishing a reusable lesson: two facts sharing one count label aren't necessarily competing readings — both can be true at once. See commit `3c2a6bb`.

### v1.1.0 release — 2026-08-18
First post-1.0 feature release: theme system, real-class-color card accents, Tango-icon profession art, Gear Optimizer modal, screenshot layout redesigns, the full 112-relic proc integration sweep, and a batch of Revenant/Renegade tooltip-accuracy fixes. See commit `27e4b48`.

### Build "Updated" timestamp fix: gate on real edits, add manual review confirm — 2026-08-18
Back-navigation was stamping `updatedAt` unconditionally even with zero real changes, silently clearing the "not reviewed since patch" flag; now gated on an actual content diff, plus a new "Mark as up to date" button for explicit confirmation without a throwaway edit. See commit `95c9678`.

### 3 Build editor UI bugs: trait-box heights, connector, Light Aura routing — 2026-08-18
Fixed all 3 remaining items from the 2026-08-16 testing batch: empty trait lines now reserve full height with placeholder slots, the trait connector no longer draws with nothing selected, and Light Aura now reaches both the Build Editor's and Squad Builder's Auras/Boons rows correctly (root cause was an aggregate-function contract violation letting an aura fact leak into the boon pipeline while never reaching the aura pipeline). See commit `0b96a72`.

### Squad screenshot stitch failing on >4-line squads: CSP blocked the tile `<img>`s — 2026-08-18
Same-day follow-up to the prior session: the stitched-capture path's offscreen tile images were silently blocked by the CSP's `img-src`, which had no `data:` scheme. See commit `cf6dfef`.

### Squad screenshot: drop editing chrome, stitch content taller than the viewport — 2026-08-18
Moved the capture target below the sidebar so editing chrome (sidebar, remove-line buttons, expand toggles) is excluded, and rewrote capture to scroll-and-stitch tiles onto one canvas so squads over 4 lines are captured in full instead of clipped to the viewport. See commit `1db887a`.

### Renegade "Band Together" pairs double-counting into aggregate Boon/Condition totals — 2026-08-18
User-flagged doubled rows: the aggregate functions were pushing both a Band Together skill's base and enhanced-cast fact sets unfiltered, double-counting every fact the two share. Fixed via a shared content-key dedup helper reused across all 4 aggregate functions. See commit `4b009e4`.

### Icerazor's Ire's missing Immobile: pre-existing typo, not a regression — 2026-08-18
User-reported regression traced to a pre-existing status-name typo (`"Immobilize"` vs. the real `"Immobile"`) confirmed present before the prior session's changes via `git show`; fixed in both the synthetic-facts and WvW-override entries that shared the typo. See commit `95ce8da`.

### Revenant tooltip bug batch: Sword 4 flip, Facet of Elements flip, Draconic Fortitude health, Draconic Echo, Elevated Compassion WvW — 2026-08-18
User brain-dumped 7 Revenant bugs in one message; 5 cleanly root-caused and fixed (a retired weapon skill's stale flip pointer, a missing flip-skill override, a genuinely new max-health%-bonus gap, 6 undocumented per-facet bonus facts, and a boon that swaps entirely by game mode), 2 left as documented TODO follow-ups rather than guessed. See commit `cdd8f46`.

### Build screenshot layout redesign, part 1: Equipment manifest, weapon-type bar, profession collapse — 2026-08-18
Kicked off the screenshot-output redesign (Discord-bot-facing), scoped to Equipment first: a new read-only text manifest, weapon-type selection moved out of the gear slots into its own top strip (after a first attempt was screenshot-flagged as unintuitive), and the profession/elite-spec picker collapsed behind a popover. Iterated across several commits based on the user's own running-app screenshots. See commit `09f596e` and its same-day follow-ups.

### Gear Optimizer entry point + UI: inline trigger, centered modal, live stat comparison — 2026-08-18
Moved the optimizer from a disconnected full-width panel to an inline button next to the Equipment column opening a centered modal, and added a live current-vs-proposed stat comparison table. See commit `5dc056d`.

### Profession/elite-spec icon artwork switch: Tango icons (GFDL), not the official wiki art — 2026-08-18
The originally-planned official wiki art turned out to be `{{ArenaNet image}}`-restricted (same blocker as an earlier equipment-icon attempt); switched to the wiki's separately-licensed, genuinely reusable Tango icon set instead, covering all 9 professions and 36 elite specs at one shared 48px size. See commit `f67ec21`.

### Relic proc integration sweep leg 7: Firebrand/Astral Ward, closing the sweep — 2026-08-16
Resolved the sweep's last 2 open relics: Astral Ward wired in (its "every 2nd cast" nuance is the same proc-frequency detail the existing trigger-gate table already glosses over elsewhere), Relic of the Firebrand permanently excluded (a temporary event-triggered %-modifier with no honest place to model its real-world trigger frequency). Closes the whole 112-relic sweep. See commit `3c756e2`.

### Relic proc integration sweep leg 6: Leadership/Twin Generals/Citadel wiki re-check — 2026-08-16
Direct wiki re-checks (not re-guesses) resolved 3 of the 5 relics left open by earlier legs: Leadership permanently excluded (genuinely boon-less payload), Twin Generals and Citadel both wired, the latter correcting an earlier leg's wrong assumption about its stun-duration formula. See commit `d8da623`.

### Relic proc integration sweep leg 5: Pack/Febe `MISCELLANEOUS_MATCHERS` follow-up — 2026-08-16
Re-ran the leg-1 audit discipline against the Control/Miscellaneous/Strip-Corrupt-Cleanse matcher names instead of just boons/auras, finding 6 more real candidates beyond the 2 already named; 8 relics wired total via a new `RELIC_NAMED_FACT_SOURCES` table. See commit `f092bd0`.

### Relic proc integration sweep leg 4: Relic of Sorrow, wiki-confirmed and closed for good — 2026-08-16
No code change — a direct wiki re-check confirmed the prior leg's read word for word (no boon anywhere in its real effect); permanently excluded as never a fit for the trigger-gate table's shape. See commit `7d5a291`.

### Relic proc integration sweep leg 3: Relic of the Zephyrite, fully curated + wired — 2026-08-16
Closes the sweep's own motivating bug report. The stepped Elite-Skill-Recharge → Crystal-Duration table lives only in wiki prose, not the infobox the fetch script parses, so it's hand-curated as a display override; aggregate wiring reads the build's actual equipped elite skill's recharge and maps it through the same table (Revenant takes the shorter of its 2 legends). See commit `30e1861`.

### Relic proc integration sweep leg 2: `RELIC_TRIGGER_GATES` mechanism + 10 relics wired — 2026-08-16
Built the general "relic effect gated on an already-modeled trigger" mechanism and wired 10 of the 19 leg-1 candidates whose facts were unambiguous boon/aura matches; the other 9 stayed deliberately unwired, each for a real per-relic reason resolved in later legs. See commit `bf3ff9d`.

### Relic proc integration sweep leg 1: classify all 112 relics' triggers — 2026-08-16
Full audit of every relic's proc trigger for whether this app already models a deterministic frequency for it; turned out broader than scoped once `Skill.categories`' profession-mechanic tags were recognized as just as deterministic as the elite/heal-skill case. 19 of 112 relics land in the wireable bucket. See commit `4ddd9f8`.

### Relic of the Flock duplicate entry + Guardian Luminary's F1-F4 tooltip/Radiant Forge gaps — 2026-08-16
3 of 4 user-flagged bugs: deduped ~10 mechanically-identical relic name-pairs, curated Luminary's F1-F4 virtue tooltips from wiki text (the API facts carry almost nothing), and modeled Radiant Forge as a Reaper-Shroud-style weapon-bar replacement. See commit `ec2cc60`.

### Engineer Turret sub-abilities + a standard-profession `flipSkill`-chain gap — 2026-08-16
User-flagged missing Supply Crate flip skills traced to a broader issue: the raw API's `flipSkill` field links at most one of a Turret's 2 sub-abilities inconsistently, fixed via a hand-curated override table. Wiring it into the aggregate path also surfaced a bigger, separate gap — the standard-profession branch never called the flip-chain walk at all, silently dropping every Firebrand Mantra's regular-charge boons from the aggregate panel. See commit `cfe9f54`.

### v1.0.1 patch: Boons/Condis Conditions-row scrollbar — 2026-08-15
The summary panel's paired columns split 50/50 by a fixed ratio, so a heavier left column (e.g. 12+ Conditions vs. 6 Auras) hit its own scrollbar while its partner sat half-empty; switched to a flex-grow split. See commits `878ba48` and `39d1b85` (release).
