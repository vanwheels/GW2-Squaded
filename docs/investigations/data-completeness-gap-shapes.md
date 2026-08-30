# Data-completeness audit — leftover gap shapes

Source: `npm run audit-data-completeness` (`scripts/audit-data-completeness.ts`), first run
2026-08-22. Shapes 1-3 are otherwise fully resolved (see COMPLETED.md's Session 289 and the
`data_completeness_audit_shape1_resolved_2026-08-22` / `_shape2_...` / `_shape3_...` memories) —
this doc only covers the individual candidates that were investigated and left deliberately
uncurated because the underlying stat family doesn't exist in this app yet. None of these are
scheduled; each affects only 1-2 skills/traits/relics, not worth building dedicated infra for on
its own. Revisit only if a future sweep turns up more members of the same family (see also
`docs/investigations/future-stat-family-candidates.md` for the larger such catalog from the
Outgoing Damage % sweep).

## Shape 1 — opaque/generic fact labels on skills/traits

- **Signet passive-effect potency** — Perfect Inscriptions (Guardian/Radiance, 579) and Mech Core:
  J-Drive (Engineer/Mechanist, 2298), both flat 20% ("Signets gain improved passive effects and
  continue to grant their passive bonuses while recharging"). This app has no representation of a
  signet's own passive value anywhere — Utility-slot skill effects never feed into attribute totals
  at all (unlike gear/food/utility-consumable bonuses) — so there's nothing to apply a multiplier to
  without first building that entire baseline system.
- **Per-weapon-category skill-duration bonus** — Banshee's Wail (Necromancer/Blood Magic, 799),
  flat 50% ("Warhorn skills gain increased effect duration"). No infra scopes a boon/buff-duration
  bonus to one weapon type's own skills — same "per-skill-category" gap-shape family as the Outgoing
  Damage % sweep's Burst Mastery/Symbiotic Synergy.
- **Life-force gain rate** — Soul Comprehension (Necromancer/Death Magic, 839, 20%) and Gluttony
  (Necromancer/Soul Reaping, 887, 10%). Necromancer life-force is an entirely untracked resource —
  the mirror-image "resource gain" version of the shipped resource-*cost* modeling (energy/
  initiative/upkeep/health-cost, see COMPLETED.md) — same reasoning applies: no baseline resource
  value exists to apply a %-modifier to.
- **Protection's own damage-reduction potency** — Hardy Conduit (Elementalist/Tempest, 1948, 20%)
  and Stone Resonance (Elementalist skill, 44926, 20%, "Protection on you is more effective" while
  the stance is active). This app has never modeled incoming-damage reduction from boons at all
  (already noted as a gap from the movement-speed sweep's own Survival Instincts exclusion).
- **Barrier/Shadow Force potency** — Amplified Siphoning (Thief/Specter, 2288): its barrier half
  ("Grant increased barrier when targeting an ally") is a %-modifier on barrier amounts, and
  `barrier-calc.ts` only has fixed per-skill coefficients, no modifier stat; its Shadow Force half is
  Specter's own untracked class resource, same "untracked profession-resource-stack" family as
  Holosmith's Heat/Harbinger's Blight.

## Shape 2 — numeric content hidden in `params.desc`/`alt`, not wired into any calculator

- **Soul of the Titan** (Relic of the Living City, 104928) — wiki-confirmed genuinely ambiguous even
  in raw wikitext whether "+15% All Stats" is a flat-point or percentage-multiplier bonus (no
  precedent for a %-multiplier on total attributes anywhere in this app). Its 5-condition Titanic
  Potential combo (heal skill + elite skill + combo-field finish + disable + evade, each once) for
  only a 5s window is also a much weaker "assume satisfied" candidate than every other relic in this
  app. Logged, not guessed.
- **Relic of Fog** (107030) — raw wikitext confirmed NOT a parse artifact: "Incoming Fumble" is a
  real (if obscurely worded) reference to the wiki's "Glancing" mechanic (forces the next incoming
  hit to deal 50% damage/no crit). Same already-logged gap as Nourys's Hunger and relic 103984 below
  — merged into that family, not a separate mystery.
- **Nourys's Hunger** (101191) and **relic 103984** (Frost/Light Aura) — their incoming-damage/
  damage-to-healing-conversion halves stay out of scope. No `DerivedStats` field for Incoming Damage
  Reduction exists yet.
- **Relic of Mabon** (100115) — its "might stacks become more effective" clause is a 10-stack-
  threshold + timed-window proc on Might, which this app already tracks as a plain 0-25 count rather
  than a duration-aware buff. No clean way to model without misrepresenting the mechanic.
