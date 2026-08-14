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
   duplicate icon rows for skills with no real secondary action — fixed same day (COMPLETED.md
   Session 165), including its non-Revenant sibling sweep (Session 166) and its last curation
   loose end, Breakrazor's Bastion (Session 167) — fully closed.
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
      tell them apart). **Mechanism built 2026-08-13** (user, re-asked, wanted real wiki-sourced
      qualifiers, not a generic index — see `BoonConditionSource.instanceLabel`'s doc comment in
      `src/shared/boon-calc/sources.ts`): a `BUFF_INSTANCE_LABELS` curated table (same `skill`/
      `trait` shape as `TARGET_COUNT_OVERRIDES`) resolves a per-instance qualifier from each
      source's own wiki `{{skill fact|...|alt=...}}` (or, since the Thief leg, a `linked skill=`
      parameter naming a specific other skill/condition) labels, keyed by
      `${status}@${duration}@${applyCount}` (`#<occurrence>` suffix for same-tuple collisions) —
      rendered in `SkillsEditor.tsx`'s `factsBlock`. A `buff-instance-label-completeness.test.ts`
      staleness scan guards every curated key (skill AND trait sides) against game-data drift.
      **4 legs done, smallest-remaining-pool-first** (full per-source reasoning for every leg lives
      in `BUFF_INSTANCE_LABELS`'s own doc comment, not duplicated here — this entry only tracks
      overall status): Revenant (1st, 2026-08-13, 11 skill ids labeled), Thief (2nd, 2026-08-14, 6
      sources labeled + fixed the scan methodology twice — excluded `overrides`-linked
      replace-not-add facts, and discovered several "conflicts" never reach the table at runtime
      since `classifyBoonCondition` only recognizes `BOON_NAMES`/`CONDITION_NAMES`), Warrior (3rd,
      2026-08-14, 8 sources labeled including this table's first `linked skill=`-derived trait
      label), Necromancer (4th, 2026-08-14, 3 sources labeled — Dark Pact, Rending Claws, "You Are
      All Weaklings!"; only 4 total conflict sources once the fixed methodology applied from the
      start, confirming the original "24" estimate was stale). Several sources across all 4 legs
      turned out to be plain PvE/WvW(+PvP) splits with no `alt=` wording — redirected to
      `WvwFactOverrides`/`fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` instead (regenerate
      `wvw-fact-overrides.json` by actually running `npm run fetch-wvw-splits` after editing that
      file, never hand-edit the generated JSON). Also found but deliberately deferred: a
      cross-profession "Convergence Artifact" skill/trait family (Forged Surfer Dash, Holo-Dancer
      Decoy, Mistburn Mortar, Possessive Hoarder) with an entangled 3-way pve/wvw/pvp split, worth
      its own dedicated pass rather than a per-profession fix. **Remaining**: 5 professions'
      `skills.json`/`traits.json` pools unswept, plus an unswept `synthetic-facts.json` remainder
      for those 5 — next leg picks smallest pool first, same pattern as `TARGET_COUNT_OVERRIDES`'s
      sweep, and checks the `classifyBoonCondition` recognized-name gate BEFORE drafting an entry,
      not after.

## Scoped features, not yet built

- [ ] **Same-name "enhanced" flip targets should merge into one tooltip with a "When Enhanced"
      divider instead of a 2nd stacked icon** — flagged by the user 2026-08-13 looking at Icerazor's
      Ire's skill bar (still shows 2 icons even after the flip-duplicate sweep, since its enhanced
      cast DOES carry genuinely new content — Chilled — so the existing `isNonActionableFlipTarget`
      mechanism correctly leaves it as a separate icon per its own design). User's proposal: for this
      specific shape (flip target shares the exact same skill name as its source, i.e. "same skill,
      conditionally enhanced" rather than a genuinely different action), render ONE tooltip — base
      facts, then a divider, then "When Enhanced"/the triggering condition, then only the target's
      NEW facts — instead of a full 2nd icon+tooltip.
      **User chose the full-classification-first option** over "just ship the 2 already-confirmed
      families now": every same-name flip pair in the game must be individually classified before any
      rendering changes land, since a blanket "same name → merge" rule would be wrong for many of
      them (see below).
      **Scan** (2026-08-13): every `flipSkill` pair in `data/game-data/skills.json` where source and
      target share the exact same `name`, filtered against the existing
      `NON_ACTIONABLE_REVENANT_FLIP_TARGET_IDS`/`NON_ACTIONABLE_OTHER_PROFESSION_FLIP_TARGET_IDS`
      exclusion tables (already-hidden pure duplicates) — found ~50 pairs, NOT all the same shape:
        - Warrior adrenaline-tier bursts (Eviscerate, Kill Shot ×3-deep chain, Earthshaker, Arcing
          Slice, Skull Crack, Whirling Strike, Combustive Shot, Forceful Shot, Breaching Strike, Path
          to Victory, Harrier's Toss, Bloodthirster, Berserk — 14 pairs) — mutually EXCLUSIVE power
          tiers gated by current adrenaline, not additive. A divider merge would misrepresent them as
          stacking; needs its own classification pass (not started) to confirm this reading per-skill
          before deciding a treatment (may just need a different render shape entirely, e.g. "Tier 2"
          labels, not a same/enhanced divider).
        - Guardian Tome/Virtue/Spirit Weapon chains (Shield of Absorption, Virtue of Courage, Virtue
          of Resolve, Shield of Courage, Wings of Resolve, Tome of Resolve, Tome of Courage, Tome of
          Justice, Crashing Courage ×2, Glaring Burst chain, Radiant Courage, Radiant Resolve — 13
          pairs) — not yet classified, likely a mix of sequential-page/recharge-triggered shapes.
        - Mesmer (Mind Wrack, Axes of Symmetry, Split Second, Bladesong Harmony — 4 pairs) — not yet
          classified.
        - **Classified this session**:
          - **Additive enhancement** (the target shape, real divider-merge candidates once rendering
            is built): Revenant's Band Together family (Icerazor's Ire, Darkrazor's Daring,
            Razorclaw's Rage, Breakrazor's Bastion) + Elementalist's 4 attunement-conditional
            familiars (Fox's Fury, Otter's Compassion, Toad's Fortitude, Hare's Agility, all 4 now
            individually wiki-confirmed, not just "assumed" — see `other-profession-flip-
            duplicates.ts`). 8 pairs total, 0 rendering built yet.
          - **Genuine sequential chain, correctly left as-is**: Thief's Deathstrike (27074→28625,
            "quick attack, then a second devastating blow if it hits" — 2nd hit conditional on the
            1st landing, not an unconditional addition, same shape as any multi-hit autoattack chain).
          - **Out of scope, not a combat-facts case**: Revenant's Legendary Renegade Stance
            (46409→41858) — a Legend-select mechanic-bar button, differs only by a `StunBreak` flag,
            not a boon/condition/damage duplicate in the sense this item is about.
          - **Zero new content, now excluded** (added to `NON_ACTIONABLE_OTHER_PROFESSION_FLIP_
            TARGET_IDS` this session, same mechanism as the original sweep — these were STILL showing
            a pointless 2nd icon until now): Ranger's Maul, Thief's Repeater/Spinning Axe/Death's
            Advance, Necromancer's 3 Charged Souls "Innervate" mechanic-slot skills. 7 pairs fixed.
      **Next leg**: classify Warrior (14 pairs, likely needs its own "tiered, not additive" render
      treatment decided) and Guardian (13 pairs) — largest remaining pools. Once the full ~50-pair
      classification is done, THEN design+build the actual divider rendering for the confirmed-
      additive family (`skillTooltipContent`/`FlipSkillStack` in `SkillsEditor.tsx`).

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

**Healing — Utility (2):**
- Guardian 31295 (Sanctuary, underwater variant): a frozen pre-2016-balance-pass copy of id 9128 —
  no wiki coefficient documented for it specifically (underwater is out of scope for WvW anyway).
  Re-checked 2026-08-13: 9128's own wiki coefficient (522/0.1375) is unchanged and still the only one
  curated (id 31295 above); no separate documentation for 31295 has appeared, no change.
- Guardian 62669 (Repose): the wiki page itself is tagged stub — coefficient is an unfilled `?`.
  Re-checked 2026-08-13: still `?` — coefficient itself is still undocumented, no change. Note for
  whoever eventually fills this in: the wiki's Version History now shows a 2025-11-18 balance patch
  that dropped the WvW/PvP base value from 2595 to 1635 (PvE unaffected) — don't reuse the older 2595
  figure from before that patch if it surfaces anywhere stale.

**Healing — Heal-slot (4):** Engineer 63049 (Rectifier Signet's trait-upgraded pulse heal — no wiki
fact template at all); Necromancer 10547 (Summon Blood Fiend — pet's own fixed-0 Healing Power, no
coefficient param on wiki, expected non-scaling); Necromancer 10670 (2nd Well of Blood id — API
values don't match either PvE/WvW reading of the shared wiki page, likely an undocumented
Scourge-context variant); Revenant 26937 (Enchanted Daggers — wiki 1640 vs. API 1560, same +80
offset also shows up on its Siphon Damage facts). All 4 re-checked 2026-08-13 against fresh wiki/API
pulls — same conflicts persist unchanged, still genuinely uncurated.

Closed 2026-08-13 (re-investigated, now curated in `CURATED_HEALING_COEFFICIENTS`): Elementalist
44239 (Aquatic Stance — the wiki's own dated Version History prose and the live API now agree on
6480; only the infobox's isolated template param was stale, off by 80) and Engineer 76738 (Mitotic
State — the "API 305" was confirmed to be a per-pulse value, 305 × 25 pulses over its 5s duration =
7625, matching the wiki's summed total exactly; not a real conflict).

**Healing — Weapon-slot (4):** Elementalist 72982 (Etching: Jökulhlaup, Spear — no `coefficient=`
param on wiki); Necromancer 30860 (Death Spiral — wiki stub, missing siphon coefficients);
Necromancer 69302 (Life Siphon — wiki 450/300 vs. API 537/238, unexplained); Thief 72991 (Shadow
Veil, Spear — two facts share identical factText with only one wiki-documented coefficient; the
table matches by factText alone so curating risks binding to the wrong fact). All 4 re-checked
2026-08-13 against fresh wiki/API pulls — same conflicts persist unchanged, still genuinely
uncurated.

Closed 2026-08-13 (re-investigated, now curated in `CURATED_HEALING_COEFFICIENTS`): Ranger 31889
(Astral Wisp, post-rework — same per-pulse-vs-total shape as Mitotic State above: wiki's one total
value (1288) ÷ its now-4 pulses = 322, matching the API's duplicate-text facts exactly; safe to bind
since, unlike Shadow Veil below, both duplicate facts share the same value).

Closed 2026-08-13 (re-investigated, resolved): **Healing — Thief's Assassin's Reward trait (id
1238)**, originally investigated 2026-08-05 and blocked on "this app has no initiative-cost field
anywhere ... so a generic per-point trait-bonus table can't render without new data modeling
first." Turned out no new data modeling was needed — the GW2 API itself exposes per-skill
initiative cost (`skill.initiative`), the original blocker was about this app's own stored data,
not the API. The trait's own wiki page gives a flat, unconditional rate (151 base + 0.085
coefficient per point of initiative spent, no PvE/WvW split), so each of the 45 candidate skills
just needed `baseValue = 151*N` / `coefficient = 0.085*N` with N wiki/API-confirmed per skill —
22 landed cleanly, plus 6 more (Spear/underwater-weapon skills) that carry a genuine, still-live
ArenaNet bug baking their Healing fact at the pre-2023-06-27 rate (102/point) instead of the
current 151 — reproduced as-is (that's what the live tooltip actually shows) rather than
"corrected." 17 stayed uncurated: 14 for the familiar `Array.find`-binds-to-array-order duplicate-
fact trap (a genuine PvE/WvW/PvP initiative-cost split materialized as 2-3 identical-factText facts
this table can't disambiguate — same shape as Shadow Veil), Black Powder (only its PvE/PvP-grouped
value is exposed, no sourced number for its separate WvW cost), and Measured Shot/Repeater(13111)
(each bakes an older, pre-patch initiative cost into its Healing fact — unlike the Spear group,
here it's N itself that's stale, so there's no way to know which N the HP-scaling coefficient
would use without live-testing). See `healing-calc.ts`'s Weapon-slot Thief block for the full
per-skill breakdown. (Necromancer's equivalent case, Chillblains/Transfusion trait 778, was
resolved 2026-08-05 as a genuine per-skill design, not this shape — already curated.) Still worth
checking other professions for the same "heal on X while this trait is active" shape someday.

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
