# Completed

Entries are added as work lands, most recent first. Everything through the "Sep 15, 2026 patch +
fixes" milestone (shipped 2026-09-16) is archived in `COMPLETED-archive-sep-15-2026-patch.md`.
Everything before that, back through v1.0.0, is in `COMPLETED-archive-pre-1.0.md`.

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
