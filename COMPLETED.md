# Completed

Entries are added as work lands, most recent first. Everything through the "Sep 15, 2026 patch +
fixes" milestone (shipped 2026-09-16) is archived in `COMPLETED-archive-sep-15-2026-patch.md`.
Everything before that, back through v1.0.0, is in `COMPLETED-archive-pre-1.0.md`.

### [Specter Steal F3 Slot Display] — Leg 1
2026-09-20. Root cause: Thief's only raw `Profession_3` candidates in the API data were two
orphan duplicate ids of "Zephyrite Sun Crystal" (78309, 79285), the same stolen skill already
correctly resolved under a third id (76895) in the Profession_2 stolen-skill pool — both
untagged to any spec, so the generic resolver picked one unconditionally on every Thief build,
not just Specter's. Excluded both, dropping the slot entirely (Thief has no real F3 mechanic on
any spec). See commit `fa0d663`.
