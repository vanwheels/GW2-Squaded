# Completed

Entries are added as work lands, most recent first. Everything through the "Sep 15, 2026 patch +
fixes" milestone (shipped 2026-09-16) is archived in `COMPLETED-archive-sep-15-2026-patch.md`.
Everything before that, back through v1.0.0, is in `COMPLETED-archive-pre-1.0.md`.

### [Celestial Stat Prefix Concentration/Expertise] — Leg 1
2026-09-20. User's premise ("removed from Celestial a while back") didn't match the live API —
confirmed live that `/v2/itemstats` still reports Concentration/Expertise on Celestial. The real
gap: the wiki's `Celestial` page raw wikitext shows both were removed from **WvW only** in the
October 8, 2024 update, kept for PvE. Since this app models WvW exclusively, the API's PvE-only
spread was wrong for every build here. Fixed via a `WVW_ITEMSTAT_ATTRIBUTE_EXCLUSIONS` table in
`fetch-game-data.ts`'s `normalizeItemStat` (same "small hardcoded constant for a real API gap"
pattern as `LEGEND_SPECIALIZATION_ID`), plus a direct patch to the committed `itemstats.json`
rather than re-running the full fetch pipeline. Closes the "Thief Pass + Celestial Fix" milestone —
see `docs/postmortems/thief-pass-plus-celestial-fix.md`. See commit `fe71962`.

### [Specter Siphon F1 Recharge Split] — Leg 1
2026-09-20. Already fixed, no code change needed: `data/game-data/recharge-wvw-overrides.json`'s
2026-08-22 sweep (commit `6b75e7d`, predates this leg's own 2026-09-20 origin comment in
`branch-conditional-facts.ts`) already carries a `"63067": 25` entry, and `ProfessionMechanicBar.tsx`
already threads `gameData.rechargeWvwOverrides` through to `skillFactLines` for the F1 mechanic bar.
Verified directly: `skillFactLines` on skill 63067 with the loaded override renders `Recharge: 25s`,
not the stale flat 18. The origin comment logging this as unresolved was written before checking
whether the general recharge-override sweep already covered this id. No commit — doc-only close.

### [Deadeye's Mark/Skritt Swipe Stale Even the Odds Vulnerability] — Leg 1
2026-09-20. Root cause: Deadeye's Mark (43390) and Skritt Swipe (77397) both carried a native
stale pre-2024-10-08-patch Vulnerability `traitedFact` for Even the Odds. Fixed via a
`BUFF_INSTANCE_VALUE_OVERRIDES.skill` `'omit'` entry plus a fresh `synthetic-facts.json` entry
matching Siphon's own already-correct value. Full test suite (547 tests) and typecheck pass with
only the one pre-existing, unrelated `legend-form-facts.test.ts` failure noted below (not touched
here). See commit `2b455d4`.

### [Triple Threat/Twilight Combo Missing Enemy/Ally Effects] — Leg 1
2026-09-20. Same "empty/stale API facts" shape as Measured Shot/Endless Night (see "Specter
Scepter/Pistol Skill 3 Display" below), fixed the same way with a `tripleThreatSections`/
`twilightComboSections` pair sourced from fresh wiki `action=raw` fetches. Full test suite passes
with only the one pre-existing, unrelated `legend-form-facts.test.ts` failure noted below (not
touched here). See commit `ae7b788`.

### [Serpent's Touch Downstate/Steal Poison Duplication] — Leg 1
2026-09-20. Root cause: `extractFromFacts` (boon-calc/sources.ts) never consulted a `Fact.overrides`
index, so an active `traitedFact` showed ALONGSIDE the base fact it's meant to replace instead of
suppressing it — with Potent Poison (1291) equipped, Serpent's Touch's own tooltip leaked 5 Poisoned
rows instead of 2. Fixed generically in `extractFromFacts` itself (any active fact's `overrides`
index now suppresses its base-array target), plus one curated occurrence-omit entry for the
boosted pvp-only duplicate that isn't itself an `overrides` target. Full test suite (539 tests) and
typecheck/lint pass with only one pre-existing, unrelated failure (`legend-form-facts.test.ts`'s
Lesser Enchanted Daggers siphon numbers, confirmed failing on main before this change too — not
touched here). See commit `0194245`.

### [Shadestep WvW Alacrity Fix] — Leg 5
2026-09-20. Root cause: Shadestep (2289)'s own `facts` array carries both an Alacrity(5s) fact and
a Regeneration(3s) fact for Grasping Shadows with no game-mode discriminator in the local data, so
both showed unconditionally. Wiki raw wikitext confirmed the two are mutually exclusive per mode
(Alacrity PvE-only, Regeneration the WvW+PvP grant) — same "confirmed absent in WvW" shape as
Saint's Shield (62689). Fixed via a `wvw-fact-overrides.json`/`MANUAL_OVERRIDES` `Alacrity: 'omit'`
entry, this app's existing per-status WvW-override mechanism; no new infra needed. See commit
`1e0cf87`.

### [Specter Scepter Auto Chain Display] — Leg 4
2026-09-20. Root cause: Shadow Bolt (Scepter mainhand skill 1)'s live `flipSkill` points at
Shadowsquall (its Stealth Attack replacement) instead of Double Bolt, the real next autoattack-chain
step — confirmed via each chain skill's own wiki infobox `chain1`/`chain2`/`chain3` fields. A
different shape from Leg 3 as predicted (no off-hand/`resolveSkillBarIds` involvement at all).
Fixed by redirecting the flip walk via `FLIP_SKILL_OVERRIDES` (now checked ahead of the raw
`flipSkill` field, so an override can replace a present-but-wrong link, not just fill a missing
one) plus curating all 3 chain skills' missing Enemy/Ally Target boon/condition facts from the
wiki, same mechanism as Leg 3's Measured Shot/Endless Night follow-up. See commit `1c0e40e`.

### [Specter Scepter/Pistol Skill 3 Display] — Leg 3
2026-09-20. Root cause: Triple Threat (63154, Scepter's off-hand-empty skill 3 default) carries a
bogus `flipSkill` pointer to Measured Shot (63267, the real off-hand-Pistol variant) — same stale-
API-data shape as the earlier Revenant Duelist's Preparation finding, except here
`resolveSkillBarIds`' generic flip-target-removal signal wrongly dropped a candidate signal 4
(Thief's dual-wield hand-context table) still needed, so it fell through to the off-hand-agnostic
default (Triple Threat) regardless of the equipped off-hand. Fixed by exempting
`THIEF_DUAL_WIELD_OFFHAND` table entries from the flip-removal signal and adding Measured Shot's
missing Pistol entry to that table. See commit `d134053`.

**Follow-up (same day):** with the correct skill now resolving, the user reported Measured Shot and
its flip target Endless Night (63128) still showed only Range/Number of Targets — same "empty/stale
API facts" shape `siphonSections` already documents for Siphon (F1), confirmed via the wiki's raw
`action=raw` wikitext: both skills' real Enemy Target (Immobile/Slow/Torment)/Ally Target
(Healing/Barrier/Regeneration/Vigor) effects never made it into the local data at all. Fixed via new
`measuredShotSections`/`endlessNightSections` entries in `branch-conditional-facts.ts`, same
mechanism, flowing through the existing generic `skillTooltipContent` pipeline used by both the base
icon and the flip-stack icon with no new rendering code. Triple Threat/Twilight Combo (Scepter skill
3's other two off-hand variants) have the identical gap, logged to TODO.md rather than fixed here
since they were out of the user's report. See commit `8290e4a`.

### [Specter Siphon F1 Effects] — Leg 2
2026-09-20. Root cause: this app's local API data for skill 63067 (Siphon) is a stale, unmigrated
copy of core Thief's "Steal" (`description: "Steal."`, only Range/Recharge facts) — Specter's real
dual-target Siphon (enemy: Slow + Shadow Force gain; ally: Healing-Power-scaled Barrier + Siphon
cooldown reduction + shroud tether transfer) never made it into the raw data at all. Curated via a
new `siphonSections` entry in `branch-conditional-facts.ts`'s `branchConditionalFacts`, same
"labeled Enemy/Ally Target divider" mechanism `otherworldlyBondBranches` established, sourced from
the wiki's raw `action=raw` wikitext (not a rendered/summarized fetch). A related but out-of-scope
Recharge-split gap surfaced during the curation was logged separately, not fixed here (see TODO.md
Unscheduled). See commit `ef76ebd`.

**Follow-up (same day, same leg):** a user screenshot comparison against a live trait-loaded
reference build showed the base-facts fix above was only half the picture — a live Steal/Siphon
tooltip also folds in every equipped Thief trait that grants its own "on Steal" bonus (Kleptomaniac,
Sleight of Hand, Thrill of the Crime, Even the Odds, Serpent's Touch, Bountiful Theft's own "Boons
Stolen" count), none of which are Specter-specific — core Steal (13014) had the identical gap. Fixed
by extending `data/game-data/synthetic-facts.json` for all 4 "Steal-family" skill ids (13014 Steal,
43390 Deadeye's Mark, 63067 Siphon, 77397 Skritt Swipe) with each trait's wiki-verified WvW-value
facts, flowing through the existing generic `boonConditionFactsForSkill`/`numericFactLines` pipeline
with no new rendering code. Also fixed a pre-existing latent bug found along the way: the same
pipeline's Bountiful Theft Might fact was showing an un-deduped pve/wvw duplicate pair on every one
of these 4 skills' own tooltips (already fixed for the trait's own tooltip via
`BUFF_INSTANCE_VALUE_OVERRIDES.trait[1277]`, but that lookup keys off the passed-in skill id, so the
existing fix never reached the skill side) — mirrored into `BUFF_INSTANCE_VALUE_OVERRIDES.skill` for
all 4 ids. Daze (Sleight of Hand) has no generic Buff-fact render path in this app at all (not a
tracked boon/condition), so it's added as a conditional line inside `siphonSections` instead. A
separate, unrelated data-staleness gap found on Deadeye's Mark/Skritt Swipe's own native Even the
Odds Vulnerability fact was logged to TODO.md, not fixed in this pass. See commit `12c551a`.

### [Specter Steal F3 Slot Display] — Leg 1
2026-09-20. Root cause: Thief's only raw `Profession_3` candidates in the API data were two
orphan duplicate ids of "Zephyrite Sun Crystal" (78309, 79285), the same stolen skill already
correctly resolved under a third id (76895) in the Profession_2 stolen-skill pool — both
untagged to any spec, so the generic resolver picked one unconditionally on every Thief build,
not just Specter's. Excluded both, dropping the slot entirely (Thief has no real F3 mechanic on
any spec). See commit `fa0d663`.
