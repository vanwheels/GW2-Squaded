# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Path to 1.0 (target: ship this week for community testing/feedback)

User's explicit goal, stated 2026-08-12: cut a 1.0 release this week so the community can start using
it and giving feedback — the user isn't deeply familiar with every profession's own meta/quirks and is
relying on wider playtesting to catch what solo curation can't. 1.0 scope = README roadmap items 1-4
(scaffolding, build editor + boon/condition calculator, squad preview builder, sync/share backend) —
the Discord bot and the Capacitor mobile port are explicitly OUT of 1.0 scope (later roadmap stages,
own sub-projects). Already shipping releases (v0.1.0-v0.3.0 tagged, electron-builder + auto-update
live) — the app is feature-complete for this scope; the open question is correctness confidence, not
missing features.

Both gaps that stood between here and 1.0 are now closed:
1. ~~**Never visually verified in a running app.**~~ **DONE 2026-08-13** — user did a manual
   click-through pass. Found one real bug along the way: Revenant's skill bar was showing phantom
   duplicate icon rows for skills with no real secondary action — fixed same day, see COMPLETED.md
   Session 165 and the "Follow-ups from the Revenant flip-duplicate fix" section below for the
   narrower, unfinished piece of that fix.
2. ~~**Zero automated tests.**~~ **DONE 2026-08-13** — 108 tests across 3 completeness scans + 3
   value-correctness tiers; full history in COMPLETED.md (Sessions 158-164). Also found and fixed 7
   real bugs as a byproduct (stale `factText` matches, missing health-threshold/full-endurance combat
   state dimensions, one live ArenaNet API data bug) — see COMPLETED.md for details.

**1.0 is otherwise unblocked** — what's left in this file below is post-1.0 polish, deliberately
deferred features (Discord bot, Capacitor port — always out of 1.0 scope), and open curation gaps
that don't block a release.

## Bugs

- [ ] **Multiple same-status Buff facts on one skill render as unlabeled duplicate rows** — flagged
      by the user 2026-08-09 looking at Icerazor's Ire's tooltip (2 separate Vulnerability
      applications, 8s×10 on-summon + 8s×5 on-hit, both just labeled "Vulnerability" with no way to
      tell them apart). **Confirmed NOT specific to this skill or to synthetic-facts curation** — a
      full scan of `data/game-data/skills.json` found 214 real-API skills with this exact shape
      already (e.g. Skull Fear applies Fear 3 separate times, Blowtorch applies Burning 4 times), all
      already rendering the same way today. Root cause: `extractFromFacts`
      (`src/shared/boon-calc/sources.ts`) builds `BoonConditionSource` from only
      `status`/`duration`/`apply_count`/`requires_trait` — never `fact.description` (which the real
      API does populate, but with a generic per-status blurb, not a per-instance qualifier like the
      wiki's own `alt=` labels) — and `factsBlock` (`SkillsEditor.tsx`) renders only
      `f.boonOrConditionName`. No field exists anywhere in the pipeline to carry a per-instance label
      like "on summon" vs "on hit". User picked "leave as-is for now" when asked about scope (options
      were: leave as-is / add an optional label field populated only where hand-curated / a fully
      automatic generic label for all 214+ skills at once) — this entry is that future design pass,
      not started.

## Follow-ups from the Revenant flip-duplicate fix (2026-08-13)

Session 165 (COMPLETED.md) fixed Revenant's phantom flip-duplicate skill-bar rows (a `flipSkill` hop
pointing at a same-name sibling with no real new content). One of the two things it deliberately left
open is now also done:

- [x] **Same "same-name `flipSkill` sibling" shape found outside Revenant** — DONE 2026-08-13
      (COMPLETED.md Session 166). Turned out to be 23 pairs (not ~15) across Engineer/Guardian/
      Elementalist/Thief; 19 confirmed non-actionable and excluded (`other-profession-flip-
      duplicates.ts`), 4 (Elementalist Evoker's familiar Utility skills) confirmed genuinely
      actionable and left alone.
- [ ] **Breakrazor's Bastion (Renegade heal, 45686) never got the Kalla's Fervor "Band Together"
      curation** its 3 Legend5 siblings did (Darkrazor's Daring/Razorclaw's Rage/Icerazor's Ire, all
      curated 2026-08-12) — its flip target (72389) currently has zero distinguishing facts, so it's
      excluded from the flip-icon stack via `NON_ACTIONABLE_REVENANT_FLIP_TARGET_IDS`
      (`revenant-flip-duplicates.ts`) as a still-open gap, not a permanent decision. Wiki-verify
      Breakrazor's Bastion's own Band Together bonus and curate it the same way, then remove it from
      that exclusion table.

## Scoped features, not yet built

- [ ] Dodge-roll-sourced boons/conditions/heals/damage aren't tracked as their own category —
      flagged by the user 2026-08-07 (Vindicator and Mirage in particular build entire kits around
      dodging). Splits into two different problems on investigation:
      1. Trait procs already modeled as ordinary facts on the trait itself (e.g. Guardian's Selfless
         Daring, "the end of your dodge roll heals nearby allies" — real `AttributeAdjust`+Number(5)+
         Radius facts) likely already flow into totals today, since this app treats any chosen
         trait/skill with real facts as always-contributing regardless of its specific trigger
         condition — not a calc gap, just nothing labels it "from dodging" anywhere in the UI.
      2. Whole alternate dodge-replacement mechanics (Vindicator's Legendary Alliance dodge, Mirage's
         Mirage Cloak) have no skill id in `skills.json` at all and nothing in `src` references them
         by name — the GW2 API doesn't expose the dodge button as an activatable skill the way it
         does weapon/utility skills. Same "API gives nothing to render" shape as Revenant's
         Otherworldly Bond (see COMPLETED.md Session 131), not a wiring bug — would need hand-curated
         content.
      Also flagging: relics can grant dodge-triggered effects too (e.g. Relic of Rivers, "alacrity
      and regeneration at the end of your dodge roll") with only flavor text — same empty-facts
      problem again. User's proposed UI treatment once data exists: a small visual indicator above the
      skill bar (not a real skill slot) with its own custom tooltip for whatever a build's dodge
      grants beyond the normal evade frames.

- [ ] Discord bot — a guild-scoped, curated build/squad board (slash-command add/edit/remove/move,
      profession-sectioned board messages the bot keeps in sync, optional Manual-approval workflow
      with role-gated buttons) mapped out in full 2026-08-12, not started. Full design-of-record —
      command list, D1 schema, approval workflow, architecture decisions, explicit v1 non-goals —
      now lives in `docs/discord-bot.md` rather than here; read that first before picking this up.

- [ ] Capacitor port for iOS/Android — scoped 2026-08-01, two-part seam: (1)
      `StorageAdapter`/`Repository<T>` (`src/shared/storage/storage-interface.ts`) is already
      backend-agnostic — needs a new implementation (e.g. `@capacitor-community/sqlite`) replacing
      `sqlite-storage.ts`; (2) the renderer never calls that interface directly — it goes through the
      Electron-only preload bridge (`window.gw2Storage`, wired in `src/preload/index.ts` +
      `src/main/ipc/storage-ipc.ts`), which has no Capacitor equivalent — needs a platform-neutral
      seam or a Capacitor-side shim. Also: native HTML5 drag-and-drop in the squad editor has no
      touch-input fallback yet.

- [ ] Stretch, deferred 2026-08-01: frame a build's "last updated" (shown today as a plain relative
      timestamp) relative to GW2 balance patches instead — e.g. "not reviewed since the last patch."
      Was blocked on a `/v2/build`-polling mechanism not existing yet; that's no longer true as of
      2026-08-11's in-app game-data refresh (`src/main/game-data/data-update.ts` now fetches and
      compares `/v2/build` via `meta.json`'s `gw2Build` — see `docs/game-data.md`'s "In-app
      game-data refresh" section). Not itself built — this stretch item can now reuse that same
      `gw2Build` value (the currently-loaded local `meta.json`'s, via `getLocalMeta()`) instead of
      polling a second, parallel patch-tracking path.

## New attribute-bonus gaps needing new CombatState infra

Spun off by the trait-attribute-bonus sweep (`trait-attributes.ts`, COMPLETED.md Session 148), its
8-family conditional follow-on sweep (Sessions 149-156), and the trait attribute-bonus completeness
scan (2026-08-12, TODO's now-closed "Automated testing strategy" section) — all now-closed sweeps that
don't have their own open-items table to hold these. Each is a genuine, wiki-confirmed character-stat
grant, not a proc/skill-tooltip coefficient, but needs a conditional-gate shape this codebase doesn't
have infra for yet, so none are rushed into an existing curated table:

- [ ] **Power Overwhelming (Elementalist, id 334) — might-stack-THRESHOLD-gated Power, doubled by
      attunement.** "While at or above the might threshold, gain increased power. Power bonuses are
      doubled while attuned to fire." Wiki-verified 2026-08-12: +150 Power once `mightStacks >= 8`
      (WvW/PvP threshold; PvE is 10), doubled to +300 while `activeAttunement === 'Fire'`. Distinct
      from `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`'s continuous per-stack scaling (this is a binary
      on/off at a threshold) AND distinct from `ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES`'s flat
      attunement-gated bonus (this is a *multiplier* on an already-conditional bonus, same
      "doubling isn't its own fact" shape `WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES`'s Forceful
      Greatsword/Blood Reaction comments already flag) — needs its own combined-gate table, not a fit
      for any existing one.
- [ ] **Deadly Strength (Necromancer/Harbinger, id 855) — per-Carapace-stack Power/ConditionDamage.**
      "Carapace stacks grant power and condition damage." Wiki-verified 2026-08-12: +10 Power / +10
      ConditionDamage per stack, no game-mode split (`{{skill fact|attribute|Power|10}}` +
      `{{skill fact|attribute|Condition Damage|10}}`). "Carapace" is Harbinger's own stacking
      resource (built from applying Blight, distinct from Might) — no `CombatState` field tracks it
      today (`mightStacks`/`kallaFervorStacks` are the only stack counters that exist). Needs a new
      `CombatState.carapaceStacks` field (same UI shape as `kallaFervorStacks`'s Renegade-gated
      stepper, surfaced only when Harbinger is equipped) before this can be curated.
- [ ] Pinnacle of Strength's flat, unconditional +5% critical-hit chance fact is NOT curated
      anywhere — no unconditional flat-crit-chance table exists yet in this codebase (only the
      Fury-gated `FURY_CRIT_CHANCE_TRAIT_BONUSES`). Worth a future small sweep if more unconditional
      flat-crit traits turn up.

## Coefficient curation — remaining exceptions

`CURATED_HEALING_COEFFICIENTS` and `CURATED_DAMAGE_COEFFICIENTS` are now complete sweeps across all
9 professions and all 4 skill slots (see COMPLETED.md Sessions 57-74 for the full sweep history).
What's left below is specific skills/traits that were investigated and deliberately left uncurated —
don't re-guess a coefficient for these without a fresh look at the source conflict.

**Healing — Elite (1):**
- Revenant 29114 (Energy Expulsion, flip-skill): a fresh live API pull still returns a totally
  different fact set ("Healing Fragment"/knockback) than the wiki's current single knockdown+heal —
  unresolved API/wiki mismatch, not a stale cache.

**Healing — Utility (3):**
- Guardian 31295 (Sanctuary, underwater variant): a frozen pre-2016-balance-pass copy of id 9128 —
  no wiki coefficient documented for it specifically (underwater is out of scope for WvW anyway).
- Guardian 62669 (Repose): the wiki page itself is tagged stub — coefficient is an unfilled `?`.
- Revenant 29082 (Natural Harmony, Ventari facet): wiki base value (1124) disagrees with a freshly
  reconfirmed API value (1620) — a real conflict, not a stale read.

**Healing — Heal-slot (6):** Elementalist 44239 (Aquatic Stance — wiki template value matches
neither this app's API base nor the wiki's own version history, likely a stale unedited template);
Engineer 63049 (Rectifier Signet's trait-upgraded pulse heal — no wiki fact template at all);
Engineer 76738 (Mitotic State — API base 305 vs. wiki 7625/5500, ratio suggests a per-tick vs.
summed-total mismatch, unconfirmed); Necromancer 10547 (Summon Blood Fiend — pet's own fixed-0
Healing Power, no coefficient param on wiki, expected non-scaling); Necromancer 10670 (2nd Well of
Blood id — API values don't match either PvE/WvW reading of the shared wiki page, likely an
undocumented Scourge-context variant); Revenant 26937 (Enchanted Daggers — wiki 1640 vs. API 1560,
same +80 offset also shows up on its Siphon Damage facts).

**Healing — Weapon-slot (5):** Elementalist 72982 (Etching: Jökulhlaup, Spear — no `coefficient=`
param on wiki); Necromancer 30860 (Death Spiral — wiki stub, missing siphon coefficients);
Necromancer 69302 (Life Siphon — wiki 450/300 vs. API 537/238, unexplained); Ranger 31889 (Astral
Wisp, post-rework — wiki gives one base value across modes, API shows two duplicate-text facts at
~1/4 each, pulse relationship undocumented); Thief 72991 (Shadow Veil, Spear — two facts share
identical factText with only one wiki-documented coefficient; the table matches by factText alone so
curating risks binding to the wrong fact).

**Healing — Thief's Assassin's Reward trait (id 1238)**, investigated 2026-08-05: ~38
`requires_trait`-gated Healing facts (one per initiative-costing weapon skill), each a non-uniform
multiple consistent with `0.085 * that skill's own initiative cost`. **Blocked on missing data** —
this app has no initiative-cost field anywhere in `src/shared/types` or `skills.json`, so a generic
per-point trait-bonus table can't render without new data modeling first. (Necromancer's equivalent
case, Chillblains/Transfusion trait 778, was resolved 2026-08-05 as a genuine per-skill design, not
this shape — already curated.) Worth checking other professions for the same "heal on X while this
trait is active" shape before scoping further.

**Damage** — condition-damage skills (coefficient against Condition Damage rather than Power) were
never in scope for the sweep; would need their own wiki-verification pass
(condition-per-stack-per-second base values are a separate documented constant table) before
extending `CURATED_DAMAGE_COEFFICIENTS` to cover one.

**Both tables**: never visually spot-checked in the running app (Electron sandbox limitation) — do
that before extending either further, and before the tooltip visual-pass item below.

- [ ] Mesmer's Tale of the Second Scion (id 76695) also grants "Scion's Reprieve," a self-buff
      (+15% WvW/PvP Heal Effectiveness) that nothing in the app accounts for — not a Healing fact
      itself, it modifies *other* incoming/outgoing heals. App has no general outgoing/incoming
      heal-modifier concept yet (distinct from the boon/condition uptime system); needs scoping, not
      a one-off patch for this skill.

- [ ] Dedicated visual pass over every tooltip type — icon-next-to-title and rarity-colored name
      header now landed (Session 141, visually confirmed live) for traits, skills, gear stat
      prefixes, runes, sigils, relics, and infusions, via `TooltipBody`'s new `icon`/`rarity` props
      in `Tooltip.tsx` + `.tooltip-header`/`.tooltip-icon`/`.tooltip-title.rarity-*` in
      `global.css`. Divider, tidy-list stat lines, and muted-vs-bright text were already in place
      from earlier work. Still open: **food/utility** — no icon-header work needed (already
      inherited via the shared `UpgradePicker`), but their real GW2 rarity varies per item (unlike
      every other category's single fixed tier), so they still render title-only, no rarity color.
      Needs each food/utility item's actual rarity plumbed from game data into `UpgradePicker`'s
      per-option tooltip (not just its single fixed `rarity` prop) before extending
      `.tooltip-title.rarity-*` to them.

- [ ] 76 Food catalog entries still have no buff data after `borrowSharedContainerBonuses` +
      `applyAscendedFeastFormula` (`fetch-gear-upgrades.ts`) — genuinely buff-less items that don't
      belong being offered as a "Food" pick at all: Mastery-point currency ("Elixir/Draught of X
      Mastery"), crafting materials ("Gift of Quartz"/"Pile of Golden Sand"), and achievement/
      collection rewards ("Threat Report: ..."). These came back in the picker when the (wrong)
      blanket exclusion was reverted 2026-08-06; whether to filter them back out by a narrower,
      verified rule (not the blanket `effectName === null` check that wrongly caught Feasts too) is
      an open question, not decided either way yet.

## Stats panel / boon-condition bar polish

- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Nice-to-haves

- [ ] Equipment editor: a "clear all" button per row (weapons, sigils, armor, runes, accessories,
      infusions, relic, food, utility) — flagged by the user 2026-08-11, not scoped yet (which rows
      count as one "row" vs. several, e.g. armor is 6 slots/trinkets are 6 slots — needs a UI pass to
      decide grouping before implementing).

- [ ] More curated fury-crit-chance traits in `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`
      (seeded 2026-08-01 with only Revenant's Roiling Mists, for the Gear Optimizer's Critical
      Chance metric). Mesmer's Quiet Intensity added 2026-08-12 (wiki-verified: 15% PvE / 10% WvW,
      value 10 stored) as a side effect of curating this same trait's *other* unconditional effect in
      `trait-attributes.ts`. Still open — Engineer's Hematic Focus, Warrior's Furious Burst, Ranger's
      Vicious Quarry, Revenant/Renegade's Brutal Momentum — each needs its current WvW-mode value
      confirmed against the wiki (same as Roiling Mists) before being added.

- [ ] Gear Optimizer's rune/infusion search (2026-08-11, see COMPLETED.md) adds up to ~18 extra
      per-slot infusion search variables + 1 rune slot on top of the existing ~12-14 gear/food/
      utility slots — a synthetic stress case (2 floors, 3 maximize tiers, food/utility AND
      runes/infusions all on at once, 35 total slots) hit the search's `NODE_LIMIT` truncation
      (still returned a feasible, reasonable-looking result in ~1s — not a hang — and the UI already
      surfaces "truncated" transparently) where the same query without rune/infusion search stays
      well within budget. Not itself a bug, just a real trade-off worth watching: if truncated
      results turn out to look meaningfully suboptimal in practice, look at raising `NODE_LIMIT`,
      tightening the branch-order heuristics for infusion-shaped (single-attribute, low-spread)
      slots specifically, or collapsing same-key infusion slots that end up with identical option
      sets before they hit the solver.
