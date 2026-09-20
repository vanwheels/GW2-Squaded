# Post-mortem: Thief Pass + Celestial Fix

Scoped 2026-09-20, shipped 2026-09-20 (single-day milestone, commits `ef76ebd`..`fe71962`).

## What shipped

- **5 Specter-only display/mechanics bugs**, reported by the user in one batch, each its own leg:
  - Leg 1 — Specter Steal F3 Slot Display: dropped a bogus Thief F3 slot caused by two untagged
    orphan duplicate ids resolving unconditionally on every Thief build.
  - Leg 2 — Specter Siphon F1 Effects: curated Siphon's real dual-target enemy/ally facts (stale
    API data was a leftover copy of core Steal's), plus a same-day follow-up folding in every
    equipped "on Steal" trait bonus across all 4 Steal-family skill ids and fixing a latent
    un-deduped Bountiful Theft Might duplicate.
  - Leg 3 — Specter Scepter/Pistol Skill 3 Display: fixed a dual-wield hand-context resolution bug
    that ignored the equipped off-hand, plus a same-day follow-up curating Measured Shot/Endless
    Night's missing Enemy/Ally Target facts.
  - Leg 4 — Specter Scepter Auto Chain Display: redirected a wrong `flipSkill` pointer (Stealth
    Attack instead of the real autoattack-chain step) and curated the chain's missing facts.
  - Leg 5 — Shadestep WvW Alacrity Fix: omitted a PvE-only Alacrity fact incorrectly shown
    unconditionally, via the existing WvW-override mechanism.
- **Expanded to thief-wide gaps** surfaced during that same investigation pass:
  - Triple Threat/Twilight Combo Missing Enemy/Ally Effects — same "empty/stale API facts" shape
    as Measured Shot/Endless Night, fixed the same way.
  - Deadeye's Mark/Skritt Swipe Stale Even the Odds Vulnerability — a stale pre-2024-10-08-patch
    Vulnerability fact on 2 more Steal-family skills, fixed via an override + synthetic-facts entry.
  - Serpent's Touch Downstate/Steal Poison Duplication — a generic `extractFromFacts` bug (an
    active `traitedFact` showed alongside the base fact it replaces instead of suppressing it),
    fixed at the shared function rather than as a one-off.
  - Specter Siphon F1 Recharge Split — investigated and found already fixed by an earlier,
    unrelated sweep; closed doc-only, no code change.
- **Celestial Stat Prefix Concentration/Expertise** (unrelated data fix, bundled in for scheduling
  convenience): the API's `/v2/itemstats` has no game-mode field and still reports Celestial's
  PvE-only 9-attribute spread (Concentration/Expertise were removed from WvW specifically in the
  October 8, 2024 update). Fixed with a small `WVW_ITEMSTAT_ATTRIBUTE_EXCLUSIONS` table in
  `fetch-game-data.ts` so a future re-fetch can't silently revert it, plus a direct patch to the
  already-committed `itemstats.json`.

## What went well

- The Steal-family bug-fixing pattern (Leg 2's trait-bonus follow-up) generalized cleanly across
  4 skill ids sharing the same underlying mechanic, rather than needing 4 separate one-off fixes.
- Several "while investigating X, found unrelated bug Y" discoveries (the Bountiful Theft Might
  duplicate, Serpent's Touch's generic `extractFromFacts` gap) were root-caused to the actual
  shared function rather than patched at the surface, so the fix covers every current and future
  caller instead of just the reported symptom.
- The Celestial leg surfaced a genuine premise problem before any code changed: the live official
  API still reports Concentration/Expertise on Celestial, matching the already-committed data —
  the actual gap was PvE-vs-WvW, not staleness. Checking the live API and the wiki's raw wikitext
  directly (rather than trusting the user's or the assistant's own memory of the mechanic) caught
  this before a wrong "fix" was made.
- Every leg finished with a full typecheck/test pass, and the one recurring failure
  (`legend-form-facts.test.ts`'s Lesser Enchanted Daggers siphon numbers) was correctly identified
  as pre-existing and unrelated each time, rather than re-investigated from scratch per leg.

## Friction / what didn't go as smoothly

- The milestone's own scoping prose (`TODO.md`'s "Current Milestone" intro paragraph) fell out of
  sync with `COMPLETED.md` partway through — it kept referring to a Specter "Leg 5" as "not yet
  root-caused" for several legs after Leg 5 (Shadestep WvW Alacrity Fix) had already shipped. A
  closing pass had to reconcile the prose against `COMPLETED.md` rather than trusting the intro
  text at face value.
- Bundling the Celestial data fix into this milestone "for scheduling convenience" (per its own
  TODO.md note) meant the milestone's final post-mortem covers two genuinely unrelated threads —
  same shape of friction the previous milestone's post-mortem already flagged for itself.

## Scope creep observed

None — the Celestial bundling was a deliberate, already-noted scheduling choice from scoping time,
not scope absorbed mid-milestone.

## What changes for the next milestone

- Update the "Current Milestone" intro paragraph in `TODO.md` as each leg closes, not just at
  milestone-close time — this milestone's intro drifted out of sync with `COMPLETED.md` for
  several legs before being caught.
- Keep taking the "bundle an unrelated quick fix into the current milestone for scheduling
  convenience" shortcut when it's genuinely small, but keep flagging it explicitly (as this
  milestone did) so a post-mortem reader isn't left guessing why two unrelated threads are in one
  writeup.
