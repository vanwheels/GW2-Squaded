# Post-mortem: Sep 15, 2026 patch + fixes

Scoped 2026-09-16, shipped 2026-09-16 (single-day milestone, commits `1706bd9`..`313743c`).

## What shipped

- **6 new relics from the Sep 15 patch** identified by diffing a live GW2 API item fetch against
  the committed `relics.json` (patch notes gave no names/ids). All 6 curated or wired:
  - Relic of the Tyrian Hero wired into boon-calc (new `skillIds` escape hatch on
    `RelicTriggerGate` for 12 Command skills the API doesn't tag).
  - Relic of the Curator's Protection-effectiveness bonus logged as a future-stat-family
    candidate rather than built (too small to justify new infra).
  - Lantern, Last Tyrant, Eternal Alchemy, and Visionary — none had wiki pages, so curated
    entirely from the user's own live WvW tooltip readings via a new `synthetic-relic-effects.json`
    overlay mechanism (first time this app curated a relic with zero wiki data).
- **2 Tyrian Hero tooltip formatting bugs** caught from the user's own in-app screenshots right
  after wiring: a literal "effect" string instead of "Superspeed" in the relic's own tooltip, and
  a garbled/overlapping Superspeed breakdown tooltip. Both root-caused and fixed same-day.
- **In-Game Coefficient Verification Queue, Leg 4**: Shadow Veil, Black Powder, and Vampiric Slash
  all resolved via live in-game readings. Queue is now empty.
- **Cosmic Wisdom Assassin-form Life Siphon Damage** and **Necromancer Life Siphon (69302)**
  coefficient corrections, both solved from live in-game readings rather than trusting stale wiki
  values.
- **Healing/Damage Coefficient Tables visual spot-check**: user manually verified 12 tooltips
  spanning both curated tables in the running app — no code changes needed, confirms the tables are
  in good shape.

## What went well

- The `synthetic-relic-effects.json` overlay (mirroring the existing `synthetic-facts.json` shape)
  cleanly handled 4 relics with zero wiki presence — a gap this app hadn't hit before at this scale.
  Coefficients and stack counts were derived from 2 differing-stat readings each rather than
  assumed, catching real precision instead of guessing round numbers.
- Bugs surfaced from the user's own screenshots (Tyrian Hero's 2 formatting bugs) were root-caused
  and fixed the same day they were flagged, before the milestone closed.
- Live in-game readings kept resolving cleanly to exact base/coefficient pairs (Vampiric Slash,
  Life Siphon, Cosmic Wisdom Life Siphon Damage) — the "pin one stat, vary another, solve the
  linear system" method continues to be reliable and is now well-worn.
- The in-game coefficient verification queue emptied naturally as part of this milestone rather
  than needing a dedicated closing pass.

## Friction / what didn't go as smoothly

- One coefficient (Cosmic Wisdom Assassin-form Life Siphon Damage) had an earlier pattern-based
  guess (968, matching 6 other resolved Siphon Damage skills) that looked plausible but was wrong
  when tested directly (real answer: 913/0.0575) — a reminder that a pattern match across sibling
  skills isn't a substitute for a direct reading, even when the pattern is strong.
- The milestone bundled two only loosely related threads under one heading: the Sep 15 patch's new
  relics, and the pre-existing in-game coefficient-verification queue that happened to still be
  open. That was a deliberate choice noted at scoping time, not an accident, but it means this
  milestone's scope doesn't map cleanly to "one patch's worth of work."

## Scope creep observed

None beyond the intentional bundling above — no unscoped work was absorbed mid-milestone.

## What changes for the next milestone

- Keep patch-driven work (new content from a specific game update) and standing verification
  queues as separately trackable threads where practical, even if they end up shipping in the same
  milestone — makes it easier to tell at a glance whether a milestone is "done because the patch
  content is done" or "done because an unrelated queue happened to empty at the same time."
- No process changes needed otherwise — the TODO/COMPLETED/MILESTONES workflow held up cleanly
  across a milestone with several small, well-isolated legs.
