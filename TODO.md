# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## 1.0 shipped 2026-08-15

v1.0.0 released (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) are all implemented and
released; Discord bot and Capacitor mobile port remain later roadmap stages, out of scope. What's
left in this file below is post-1.0 polish and open curation gaps — none of it blocks the release
that already shipped.

## Revenant tooltip/data bugs (2026-08-19) — 5 of 7 fixed, 2 scoped below, plus a related sweep

User brain-dumped 7 Revenant bugs in one message, flagging the real list was probably bigger than
what they'd written down. 5 were fixed same day (COMPLETED.md Session 231): Sword 4's flip (retired
"Duelist's Preparation" data, `RETIRED_WEAPON_SKILL_IDS`), Facet of Elements' missing flip
(`FLIP_SKILL_OVERRIDES`), Draconic Fortitude's Health value (new `MAX_HEALTH_PERCENT_BONUSES`
mechanism), Draconic Echo's per-facet bonus text (`draconicEchoSections`), and Elevated Compassion
showing Quickness in WvW (`wvw-fact-overrides.json` `'omit'` entry). What's left:

- [ ] **Herald F2 ("lacks linked tooltips") + Core Value ("lacks its details")** — both trace to the
      same underlying mechanism, genuinely bigger than a one-off fix. Facet of Nature (29371, the F2
      skill itself) has `flipSkill: null` in the live API, same gap shape as Facet of Elements — but
      unlike that one, its real Consume target isn't a single skill: wiki confirms it flips into
      "True Nature," which exists as 6 different ids — one generic/un-legend-specific (29393, whose
      own facts are ALSO unclassified marker names, same empty-marker shape Draconic Echo just got
      fixed for) plus 5 real per-legend replacements (51667 Assassin/Shiro "strip boons", 51675
      Dwarf/Jalis "stability", 51696 Dragon/Glint "boon duration increase", 51713 Centaur/Ventari
      "condition cleanse + heal", 51714 Demon/Mallyx "condition transfer + might") — only ONE is
      live at a time, depending on whichever OTHER legend (not Dragon/Glint itself, which Herald
      always has via Facet of Nature) the player currently has invoked. This is the same "swap, not
      diff" shape `vindicator-aspect.ts` already solves for Aspect of the Archemorus, just with a
      2nd dimension (WHICH replacement) that Vindicator's case doesn't have — needs its own new
      mechanism (a `revenant-true-nature.ts` or similar), not a reuse of `flipTargetSkills`'s
      single-hop walk. Core Value (1806, Herald major) improves whichever True Nature variant is
      live — its own raw `facts` are 5 "True Nature" `PrefixedBuff` markers per legend (same
      unclassified-marker-name shape, needs `branchConditionalTraitFacts`), and each real True
      Nature variant's own `traitedFacts` entry (`requires_trait: 1806`) carries an `overrides`
      field this app's `Fact` type doesn't even model (confirmed via a full grep — `overrides` is
      dropped entirely today, not read anywhere) alongside a `value` that doesn't obviously match
      the base fact 1-for-1 (e.g. 51667's own "Boons Removed" base fact is 2, its `requires_trait:
      1806` traitedFact reads `value: 3, overrides: 4` — the `4` doesn't correspond to anything
      visible in that skill's own facts, needs the wiki's own explicit Core-Value-upgraded numbers
      per legend rather than inferring `overrides`' meaning from the raw data alone). Also
      wiki-fetched but NOT yet verified precisely enough to hard-code: Facet of Nature's own 5
      base (non-Core-Value) per-legend numbers — Assassin's Life Siphon is Power/Healing-Power
      coefficient-scaled (53 dmg @ 0.0666, 85 heal @ 0.0333, same shape `CURATED_DAMAGE_COEFFICIENTS`/
      `CURATED_HEALING_COEFFICIENTS` already model elsewhere), Centaur's heal is 471 @ 0.4 coefficient,
      Dwarf is a flat -10% incoming damage (no game-mode split seen), Dragon's own boon-duration %
      number wasn't present in the raw wikitext fetch that got the other 4 (needs a follow-up fetch),
      Demon has no flat number at all (a condition-transfer mechanic, not a stat). Full order once
      picked up: (1) wiki-verify Facet of Nature's 5 base numbers + Core Value's 5 boosted numbers,
      (2) `FLIP_SKILL_OVERRIDES`-style entry for 29371, (3) new legend-variant resolver, (4)
      `branchConditionalFacts`/`branchConditionalTraitFacts` entries for both skill and trait.

- [ ] **Rising Momentum** (1716, Herald major) — "Gain increased movement speed for each point of
      upkeep currently in use." A real per-upkeep-point formula, not a flat/curated bonus — this app
      has no "current upkeep cost" concept anywhere (Facets/Ventari's Tablet/etc. all have per-skill
      negative energy-per-second costs, but nothing sums "how many of the player's currently-equipped
      upkeep skills are toggled on" into a `CombatState` field the way `deathsCarapaceStacks`/Kalla
      Fervor stacks already do for other per-stack formulas — see
      `new_attribute_bonus_infra_2026-08-15` memory for that precedent). Needs scoping: likely a new
      `CombatState.activeUpkeepCount` (or similar) field plus a UI control to set it, before this
      trait's movement-speed number can be computed at all. Not started.

- [ ] **Related pattern the investigation surfaced**: multiple raw API facts sharing one label with
      no discriminator, beyond the already-solved Buff-status/PvE-WvW-PvP case
      `WvwFactOverride`/`fetch-wvw-splits.ts` handles. Confirmed live across Salvation's own majors
      (a full facts dump, 2026-08-19). **Salvation leg landed 2026-08-20**:
      `NUMERIC_FACT_WVW_OVERRIDES` (`fact-numbers.ts`) gained 4 wiki-verified entries — Serene
      Rejuvenation (1814, "Effectiveness Increased" 20 pve+pvp/**15 wvw**), Invigorating Dismissal
      (1820, "Endurance Gained" 4 pve/**2 wvw**/3 pvp), Invoking Harmony (1823, "Healing Increase to
      Others" 20 pve/15 pvp/**10 wvw**), Unyielding Devotion (1825, "Damage Reduced" 15 pve+wvw
      /10 pvp — kept **15**). The filter mechanism itself needed generalizing (`Percent`-type facts,
      not just `Number`) plus a `requires_trait == null` guard so it only touches base `facts`, not
      `traitedFacts` — Serene Rejuvenation's own `traitedFacts` carry a 2nd unrelated
      "Effectiveness Increased" pair (25/18) gated on Vindicator's Numinous Gift (2440, a cross-spec
      minor-trait-effectiveness boost), a genuinely different value the base override would've
      wrongly swallowed too; that 2nd pair is now correctly left alone (still renders as an
      unresolved duplicate when 2440 is active) rather than folded into this fix. The other 3
      Salvation candidates from the original dump turned out NOT to need a `NUMERIC_FACT_WVW_OVERRIDES`
      entry: **Resilient Spirit**'s "Barrier per Boon" pair is 229/229 — genuinely identical, already
      deduped for free by `numericFactLines`'s own `seen` set. **Life Attunement**'s "Attribute
      Conversion" facts are `BuffConversion`-typed, a type `factLine`'s switch has no case for (falls
      through to its `default: null`) — they never rendered via this path at all; the trait's real
      stat gain is already correctly curated in `trait-attributes.ts` (`CURATED_FLAT_BONUSES`/
      `CURATED_CONVERSIONS`, both wiki-verified back in 2026-08-02/08-12). **Generous Abundance** is
      a different shape entirely, not a pve/wvw/pvp split — its "Centaur Skill Healing"
      (783/271/463) and "Other Legend Healing" (261/152/197) triples are a **per-skill breakdown**
      (Ventari's Tablet skills / other-legend heal skills), unlabeled which raw value belongs to
      which skill; dropping to one value the way this table does would lose real information rather
      than just declutter a game-conflated duplicate — same shape as Facet of Nature's per-legend
      numbers in the Herald F2 item above, left for whoever picks that up (or its own future leg,
      would need its own per-skill wiki mapping, not a `NUMERIC_FACT_WVW_OVERRIDES` entry). Also
      still unaddressed from the original dump: Salvation's `PrefixedBuff` facts naming SKILLS not
      legends (Natural Harmony/Purifying Essence/etc.) — `resolveLegendFromPrefix` deliberately
      doesn't attribute these per its own doc comment, so they render unlabeled by design, not a bug.
      Given the pattern held for most of Salvation's majors, it likely recurs across
      Invocation/Retribution/Corruption/Devastation/Renegade/Vindicator/Conduit too. **Invocation leg
      landed 2026-08-20**: `NUMERIC_FACT_WVW_OVERRIDES` gained 4 more entries — Ferocious Aggression
      (1758, "Damage Increase" 10 pve/**7 wvw+pvp**), Rising Tide (1761, two independently-ambiguous
      labels on one trait: "Damage Increase" 10 pve/**7 wvw+pvp** and "Health Threshold" 75 pve/
      **90 wvw+pvp**), Charged Mists (1791, "Energy Gain" **25 pve+wvw**/20 pvp), Roiling Mists
      (1719, also two labels: "Percent" [crit-strike-damage-to-healing conversion] 2 pve/**5
      wvw+pvp**, and "Critical Chance Increase" 25 pve/**20 wvw+pvp** — the crit-chance half was
      already curated for aggregate calc in `FURY_CRIT_CHANCE_TRAIT_BONUSES`, but that's a separate
      code path from the tooltip fact-list rendering this fixes, same lesson as the
      `profession_mechanic_bar_branch_facts_bug_2026-08-15` memory). Invocation's other 2 majors
      with Number/Percent facts (Contained Temper, Cleansing Channel) turned out to carry only a
      single unambiguous value each, not a duplicate pair — nothing to fix. The line's `Buff`-type
      dupes (Invoker's Rage, Incensed Response) are already handled by the separate
      `wvw-fact-overrides.json` script, out of scope for this table. **Retribution leg landed
      2026-08-20**: only 1 real candidate this line — Determined Resolution (1713, Grandmaster
      minor, "Damage Reduced" 10 pve+wvw/**7 pvp**, matching `NUMERIC_FACT_WVW_OVERRIDES` picking
      the WvW value 10). Everything else investigated and found clean: Close Quarters/Dwarven Battle
      Training/Vicious Reprisal/Versed in Stone's Health-Threshold+Damage-Reduced facts each carry
      only one unambiguous value; Enduring Recovery's "Endurance Regeneration Increase" 25/25 is
      genuinely identical, already deduped for free (same shape as Salvation's Resilient Spirit);
      Versed in Stone's "Attribute Conversion" 13%/4% pair is `BuffConversion`-typed, out of scope
      for this table (same shape as Salvation's Life Attunement). No Buff-type dupes needed either.
      **Corruption leg landed 2026-08-20**: 3 candidates — Demonic Resistance (1726, "Damage
      Reduced" 20 pve/**10 wvw+pvp**), Pact of Pain (1714, two labels: "Conditions Applied to
      Foes" 15 pve/**7 wvw+pvp**, "Conditions Applied to Self" 10 pve/**5 wvw+pvp**), Permeating
      Pestilence (1721, "Conditions Copied" 3 pve/**2 wvw+pvp**). Acolyte of Torment's single
      "Damage Increase" fact has no split (nothing to add). Yearning Empowerment's base "Duration
      Increase" also has no split — its `traitedFacts` 2nd pair (`requires_trait: 2440`, Numinous
      Gift) is the same cross-spec-interaction shape as Serene Rejuvenation/Determined Resolution,
      deliberately left alone. No Buff-type dupes on this line either.
      **Devastation leg landed 2026-08-20**: 3 candidates — Brutality (1715, "Damage Increase" 15
      pve+wvw/**10 pvp** — split changed 2025-06-24 when the trait's primary effect moved from
      removing stability to bonus damage), Destructive Impulses (1724, "Bonus Damage from Off Hand"
      2.5 pve/**5 wvw+pvp**, PvE-only nerf 2021-06-08; its own unrelated "Damage Increase" 5% base
      fact has no split), Unsuspecting Strikes (1767, wiki page now titled "Vicious Lacerations"
      after a rename, values unchanged: "Damage Increase" 20 pve/**10 pvp+wvw**, PvE-only nerf
      2021-05-25; its "Health Threshold" 80 fact has no split). Notoriety/Assassin's Presence's
      Might/Fury Buff-type dupes already handled by the separate `wvw-fact-overrides.json` script.
      Targeted Destruction's 2nd `traitedFacts` pair is the same Numinous-Gift cross-spec shape seen
      every leg so far, left alone. Dance of Death/Swift Termination's Health-Threshold/Damage-
      Increase/Healing-Increase facts each carry one unambiguous value. **New open case surfaced,
      not resolved**: Battle Scarred (1755) has a "Life Siphon Healing" fact appearing 3x in the
      live API (117/58/68, `AttributeAdjust`-typed, not `Number`/`Percent`) — but both the wiki's
      raw wikitext and rendered infobox (re-checked 2026-08-20) only ever document 2 values (117
      pve, 58 shared pvp+wvw), no mention anywhere of what 68 represents. Left uncurated rather than
      guessed; would also need `numericFactLines`'s filter extended to cover `AttributeAdjust`,
      which it doesn't today. Worth a fresh wiki look (maybe a stale API value, or a genuine
      undocumented wvw-only number) whenever this line is revisited.
      **Renegade leg landed 2026-08-20**: 4 candidates — Brutal Momentum (2142, "Critical Chance
      Increase" 10 pve+wvw/**15 pvp**; its separate "Critical Chance Increase at Full Endurance"
      fact is unambiguous, no split), Heartpiercer (2092, "Strike Damage Bonus" 15 pve/**10
      wvw+pvp**), All for One (2108, two labels: "Energy Gain" 10 pve/**5 wvw+pvp** and "Recharge
      Reduced" 50 pve/**33 wvw+pvp**), Vindication (2094, "Damage to Healing per Kalla's Fervor" 1
      pve+pvp/**2 wvw** — the rare case where WvW is the high outlier, not the low one). Ambush
      Commander/Blood Fury/Wrought-Iron Will/Lasting Legacy/Righteous Rebel's Number/Percent facts
      each carry only one unambiguous value; Lasting Legacy's Might Buff-type dupe (12/9 duration)
      is already handled by the separate `wvw-fact-overrides.json` script. Endless Enmity/Ashen
      Demeanor have no Number/Percent facts at all. No new Battle-Scarred-shaped unresolved case.
      **Vindicator leg landed 2026-08-20**: 3 candidates — Reaver's Curse (2259, "Recharge Reduced"
      50 pve/**20 wvw+pvp**), Angsiyan's Trust (2243, "Energy Gain" 25 pve+wvw/**10 pvp**, pvp-only
      nerf 2024-08-20), Song of Arboreum (2255, "Endurance Gained" 40 pve/**10 wvw+pvp**). Vindicator
      has no `traitedFacts` at all, so no Numinous-Gift-shaped 2nd pairs this line. Tenacious Ruin,
      Empire Divided, Leviathan Strength, Amnesty of Shing Jea, Redemptor's Sermon each carry only
      one unambiguous value; Balance in Discord's Regeneration Buff dupe already handled by
      `wvw-fact-overrides.json`; Forerunner of Death/Vassals of the Empire/Saint of zu Heltzer have
      no Number/Percent facts. **New loose end surfaced**: Song of Arboreum's separate Vigor duration
      is a genuine 3-way wiki split (9 pve/7 wvw/6 pvp) but the live API's own Buff facts for it only
      carry 2 of those 3 values (9, 6) — WvW's 7 isn't present in the API to pick at all, inverse
      shape of Devastation's Battle-Scarred loose end. Also Buff-typed, out of this table's scope
      regardless (would need `wvw-fact-overrides.json`-side handling, and even that script can't
      invent a value the API never sent). Reaver's Curse also has 3 `PrefixedBuff`-typed per-linked-
      skill breakdowns (100%/25% Damage Increase pairs across the 3 dodge-replacement skills it
      improves, a 9/4 Might-stacks pair) left alone, same out-of-scope shape as Salvation's Generous
      Abundance. Next leg not started: Conduit, same process — last leg of this sweep.

## UI/UX polish (flagged 2026-08-16, refined in discussion same day)

User felt the overall UI/UX was "a little off." Talked through each area and landed on concrete
directions below (see this session's transcript for the fuller reasoning) — **still not started**,
this is a firmed-up plan, not a spec ready to code from; worth a `docs/`-style design-of-record
writeup once implementation starts, same pattern as the Discord bot/target-count features.

- [ ] **Builds tab** (`BuildsView.tsx`): record cards feel too similar and the page has a lot of
      empty vertical space.
        - Delete button → a small "X" icon, **hover-reveal** (invisible until the card is
          moused over, decided over always-visible-but-small) — replaces the current full-width
          "Delete" text button competing with "Open" for attention. **Done 2026-08-18**:
          `.record-delete` in `global.css`, positioned absolutely just left of the existing
          favorite-star badge in the card's top-right corner (own offset, not a shared wrapper —
          `.favorite-star` is reused as-is by SquadsView/UpgradePicker, so its positioning stays
          untouched). Opacity 0 at rest, revealed via `.record-list li:hover` or `:focus-visible`
          so keyboard users can still reach it.
        - Each card gets a colored outline/accent matching the build's profession, sourced from
          **real GW2 in-game class colors** (not an invented palette). **Done 2026-08-18**: color
          data lives in `src/renderer/lib/profession-colors.ts` (`PROFESSION_COLORS`,
          `professionAccentColor`/`professionColorSet`, the wiki's 4-shade set per profession, kept
          out of `professions.json` on purpose since `fetch-game-data.ts` fully regenerates that file
          and would silently wipe a hand-added field); `BuildsView.tsx` now sets a per-card
          `--profession-accent` CSS var from `professionAccentColor()` and `global.css`'s
          `.record-list li` renders it as a left-edge `box-shadow` inset stripe (not a border, so it
          never competes with the drag-and-drop `border-color` feedback). Note this only
          differentiates *across* professions, not between two builds of the same profession.
        - Profession filter row (`ProfessionTagPicker.tsx`) → collapse behind a disclosure toggle
          by default, closed on first paint, consistent with how `TagChipDropdown` already behaves
          next to it. Today it's an always-expanded 9-icon profession row + up to 27-icon elite-spec
          grid with no real affordance beyond a plain "Profession" text label — that wall of icons
          right above the build list is the likely source of "unintuitive first impression."
- [ ] **Squads tab** (`SquadsView.tsx`): same empty-space issue as Builds — **still open** — plus
      squad cards had zero visual distinguishability (no colors, no icons). Decided against
      per-slot profession icons (a squad can have several 5-slot parties — `PartySlots` is a fixed
      5-tuple per `Party` in `squad-comp.ts` — so a full icon grid could hit 15+ icons on one small
      card, too cluttered) and against a de-duplicated "which classes appear anywhere" row (loses
      the actual per-party shape). **Distinguishability done 2026-08-18**: a **per-party color
      mosaic** — one `.party-mosaic-row` of small dots per party (`global.css`), reusing
      `professionAccentColor()` from the same profession-color system built for Builds above. Each
      slot resolves to a profession via a saved build (`buildId`) or a `GhostPick`, else renders as
      a hollow `.party-mosaic-dot-empty` dot rather than being omitted, so a partially-filled
      party's shape still reads correctly.
- [ ] **Settings tab** (`SettingsView.tsx`): reads as hollow/underfilled for its horizontal space
      (Display/Updates/Game data/Credits currently stack single-column). Not urgent — more settings
      will fill it in naturally — but whenever it's next touched, switch the panels to a 2-column
      layout rather than full-width single-column stacking; no new content needed to justify it.

## Scoped features, not yet built

Paragon's Motivation-tiered Chants (flagged by the user 2026-08-14) is now **FULLY DONE 2026-08-15**
— the 3 Chant skills themselves (COMPLETED.md, same day) plus the 5 traits that further modify them
(Enduring Refrain, Feverish Pulse, Calming Tongue, Liberating Liaise, Strengthening Stanzas — see
COMPLETED.md for the per-trait writeup) are all curated. One genuine gap fell out of that pass, since
fixed — see COMPLETED.md's 2026-08-15 `MISCELLANEOUS_MATCHERS` WvW-override entry.

Party-wide-only filter for boon/condition/effect summaries (flagged 2026-08-16) is **DONE 2026-08-19**
— a `useAppSettings.partyWideOnly` toggle (persisted like `showUnderwater`/`showRacialSkills`, one
`ToggleSwitch` in each editor's header so it's never captured by `ScreenshotButton`) that, when on,
narrows `BoonConditionSummaryPanel` (build editor) and `PartyRow`/`SlotTile` (squad editor) to
boons/auras/miscellaneous effects and the Cleanse line of Strips/Corrupts/Cleanses whose `targetCount`
reaches a full party (`isPartyWideTargetCount`, `sources.ts`: `targetCount !== null && targetCount >=
5`). Conditions/Control/Strip/Corrupt stay unfiltered (enemy-facing). `filterPartyWideGroups`/
`filterPartyWideNamedFactGroups` (build editor) and `filterPartyWideEntries`/
`filterPartyWideNamedFactEntries` (squad editor, `party-summary.ts`) do the filtering; `PartyAuraEntry`
gained a `targetCount` field it didn't carry before (the underlying `BoonConditionSource` always had
one, `computePartyAuraSummary` just never copied it through).

Code review caught a real gap before ship: `MISCELLANEOUS_MATCHERS` (Stealth/Superspeed/Evade/Breaks
Stun/Barrier) had **zero** curated `targetCount` data anywhere, so the Misc row would've gone
permanently empty the instant the toggle was flipped on, for every build, regardless of what it
actually produces. First-leg fix landed same day: `NAMED_FACT_TARGET_COUNT_TABLES` now covers
Stealth/Superspeed/`Breaks Stun`/Barrier (Evade skipped — confirmed 100% self-only from local
description text across all 17 candidates, and `'self'` resolves to `targetCount: null` exactly like
"uncurated," so curating it changes no observable behavior). Every source with its own API `"Number of
Allied Targets"` fact now resolves for free (46 across the 4 names — `resolveTargetCountFrom` checks
that before ever consulting the override table), plus `BREAKS_STUN_PARTY_WIDE` manually curates 10
more from explicit "breaks stun for/on allies" wording in their own description, corroborated by a
`"Number of Targets": 5` fact each also carries (normally the untrusted enemy-facing label, but trusted
here since these sources have no foe-facing component at all — see the table's own doc comment).

Second leg landed 2026-08-19: `STEALTH_PARTY_WIDE` gives Stealth the same manual-description-read
treatment Breaks Stun got — 8 skill ids (5972/6090 Toss Elixir S, 10187/50414 Veil, 10245 Mass
Invisibility, 13117 Shadow Refuge, 30815 Sneak Gyro, 13044 Blinding Powder) confirmed party-wide from
their own local API facts plus live wiki wikitext for the 2 with no local `Number` fact at all.
Blinding Powder was initially flagged ambiguous (a foe-facing Blinded fact and the ally-facing Stealth
fact both compete for one generic `"Number of Targets"` label) but the user confirmed same-day that its
`StunBreak` is personal-only, so the shared count describes the Stealth grant — corrected in place. See
the table's own doc comment for the full per-entry reasoning.

Third leg landed 2026-08-18: `SUPERSPEED_PARTY_WIDE` gives Superspeed the same treatment — 12 skill
ids + 3 trait ids (Windborne Speed, both Toss Elixir U ids, Detonate Elixir U, Symbol of Swiftness,
Slipstream, Chaotic Release, "Eye of the Storm!", Well of Action, Essence of Borrowed Time, Rallying
Roar, "We Will Never Yield!"; traits Temporal Enchanter, Speed of Synergy, Liberating Liaise)
confirmed party-wide from their own local API facts/descriptions plus one live wiki check (Windborne
Speed, whose own description never mentions Superspeed at all despite carrying an unconditioned
fact for it). Notably found 7 Engineer heal-adjacent skills (Toss Elixir H x2, Regenerating Mist,
Blessing of Dwayna, Leafy Bandage, Static Shock, Bandage Self) that all carry a Speed-of-Synergy-
gated Superspeed fact but are correctly excluded as self-only: they're all API `slot: "Toolbelt"`,
matching that trait's own text distinguishing the party-wide "heal skill" case from the self-only
"associated tool-belt skill" case. Time Warp (both ids) was initially left uncurated as ambiguous — an
unconditioned local Superspeed fact conflicted with a live wiki check that found no Superspeed
mentioned in the current tooltip — until the user corrected this same-day: Time Warp (and every
Glamour skill) only grants Superspeed with the Temporal Enchanter trait equipped, confirmed as the
only Glamour skill carrying a Superspeed fact of its own at all. Now curated as a
`TraitConditionalTargetCountOverride` (party-wide(5) when Temporal Enchanter is active, otherwise no
reach) — the same conditional mechanism `TARGET_COUNT_OVERRIDES` already uses for Phoenix Protocol/
Gladiator's Defense. See the table's own doc comment for the full per-entry reasoning, including
everything excluded as self/pet/illusion-only.

Fourth leg landed 2026-08-18: `BARRIER_PARTY_WIDE` gives Barrier the same manual-description-read
treatment — 15 skill ids + 7 trait ids (Call of Valor, Bulwark Gyro, Glyph of Burgeoning, Glyph of
Elemental Power, Serpent Siphon, Sand Swell, Sand Flare, Saint's Shield, Barrier Burst, Energizing
Slam, Dawn's Repose (leap variant only — its same-named dash-variant sibling stays excluded, see the
table's own doc comment), "We Will Never Yield!", Effulgent Stance, Chak Shield, "Brace Yourselves!";
traits Allies' Aid, Chain Reactivity, System Shocker, Ex Machina, Unshakable Mountain, Panaku's
Ambition, Mech Core: Barrier Engine) confirmed party-wide from their own local API facts/descriptions
plus 2 live wiki checks (Glyph of Elemental Power's attunement-branch text, Crescendo's raw wikitext —
the latter turned out NOT party-wide, its bare `targets` template most likely describes its own foe-
facing Damage fact instead, so it stays uncurated). See `BARRIER_PARTY_WIDE`'s own doc comment for
the full per-entry reasoning, including everything excluded as self/pet/single-ally-only.

Fifth and final leg landed 2026-08-19: a full wiki pass over the ~120 still-uncurated Breaks-Stun
sources left open above (113 after excluding blank-data placeholder ids) — resolved each candidate's
wiki page and read its own `breakstun`/`stun break` fact template, whose optional `applies to=`
parameter is the wiki's own explicit self-vs-allies signal (discovered via Otter's Compassion, then
confirmed reliable against the already-known Blinding Powder/"Shake It Off!" cases). Exactly ONE
source turned out party-wide: Otter's Compassion (76563, Evoker meditation — `applies to=allies`
when water is your specialized element; its sibling boon facts were already curated at 5). The other
112 are now CONFIRMED (not just inspected) self-only — 4 via an explicit `applies to=self` qualifier
(Elixir S, Hare's Agility, Toad's Fortitude, Fox's Fury — the latter two read ambiguously from prose
alone but the wiki's own fact template disambiguates them), 108 via a bare qualifier-less template
(GW2's own defaults-to-self convention). This closes out the whole `MISCELLANEOUS_MATCHERS`
party-wide-targetCount item — see `BREAKS_STUN_PARTY_WIDE`'s own doc comment for the full writeup.

- [ ] Capacitor port for iOS/Android — scoped 2026-08-01, two-part seam: (1)
      `StorageAdapter`/`Repository<T>` (`src/shared/storage/storage-interface.ts`) is already
      backend-agnostic — needs a new implementation (e.g. `@capacitor-community/sqlite`) replacing
      `sqlite-storage.ts`; (2) the renderer never calls that interface directly — it goes through the
      Electron-only preload bridge (`window.gw2Storage`, wired in `src/preload/index.ts` +
      `src/main/ipc/storage-ipc.ts`), which has no Capacitor equivalent — needs a platform-neutral
      seam or a Capacitor-side shim. Also: native HTML5 drag-and-drop in the squad editor has no
      touch-input fallback yet.

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
that before extending either further.

- [ ] Mesmer's Tale of the Second Scion (id 76695) also grants "Scion's Reprieve," a self-buff
      (+15% WvW/PvP Heal Effectiveness) that nothing in the app accounts for — not a Healing fact
      itself, it modifies *other* incoming/outgoing heals. App has no general outgoing/incoming
      heal-modifier concept yet (distinct from the boon/condition uptime system); needs scoping, not
      a one-off patch for this skill.

## Stats panel / boon-condition bar polish

- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Nice-to-haves

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

- [ ] Discord bot latency (flagged 2026-08-19) — three fixes landed 2026-08-19 from the original
      diagnosis, one (the biggest remaining lever) still open:
      - **Done — session reuse**: `render/browser-session.ts` (new) reuses a warm Browser Rendering
        session via `puppeteer.sessions()`/`puppeteer.connect()` (Cloudflare's own documented
        pattern — pick a random session with no `connectionId` attached, fall back to
        `puppeteer.launch()` if none free or the connect races and fails) instead of
        `build-screenshot.ts`/`squad-screenshot.ts` always launching fresh. Callers now
        `browser.disconnect()` (not `.close()`) so the session survives for the next call, and
        explicitly `page.close()` first so a long-lived session doesn't accumulate stale tabs.
        This was diagnosed as the single biggest win of the two originally stacked preview fixes.
      - **Done — duplicate D1 round-trip**: the add path (`buildAdd`/`squadAdd`/both Phase 3
        `applyPending*Request` add cases) fetched the same `board_messages` row twice — once to
        validate the board's set up, again inside `syncBuildSection`/`syncSquadSection` right after
        the insert. `requireBoardSetUp` now returns the row it fetched instead of `void`, and
        `applyAdd`/`syncBuildSection`/`syncSquadSection` all take an optional `knownBoard` to skip
        the second lookup. Deliberately NOT extended to `buildEdit`'s cross-profession case — that
        path already re-derives its share-link fields a second time by design ("re-derive rather
        than trust a captured closure value", see the code comment), and reusing a board row fetched
        against the *first* resolution would undermine that guarantee for a fringe scenario (edit +
        profession change) that's rare to begin with.
      - **Done — concurrent permission check**: `requireActionPermission` was always awaited before
        the next lookup even though nothing about that lookup (resolving a share link, looking up
        the target build/squad by name) depends on the permission check's outcome. New
        `withPermissionCheck` helper (`discord/permissions.ts`) runs both concurrently via
        `Promise.allSettled`, but still surfaces the permission error preferentially if both reject
        — same failure-path behavior as the old serialized order, only the success-path latency
        changes. Applied to all 7 mutating commands (`buildAdd`/`Remove`/`Edit`/`Move`,
        `squadAdd`/`Remove`/`Edit`).
      - **Still open — profession-scoped game-data fetch**: the fresh browser's
        `load-game-data-web.ts` still re-fetches all 26 game-data JSON files (11MB total, ~9.3MB of
        which is just `skills.json`+`traits.json`) per render, for a preview that usually only needs
        one profession's (build preview) or a handful of professions' (squad preview) worth of data.
        Not attempted this pass — genuinely a bigger refactor, since `buildGameData()`/
        `GameDataProvider` is shared with Electron's load-everything-once design, and a squad
        preview's profession set isn't known until the share itself is fetched and parsed (so it
        can't simply mirror the build-preview case). With session reuse now in place, this may
        matter less in practice (a warm session's browser-level HTTP cache means repeat renders on
        the *same* session don't re-download the JSON at all — only the first render after a cold
        start pays the full 11MB) — worth re-profiling via `wrangler tail` before sinking time into
        it, per the note below.
      - Live-verified 2026-08-19: user confirmed `/builddisplay` and `/buildadd` both still work
        correctly against production after the deploy — no regression from the session-reuse/
        round-trip changes above. Perceived speedup wasn't clearly noticeable to them either way
        (no `wrangler tail` timing profile taken, so there's no before/after number to point to),
        but they're satisfied with "cleaner on the backend" as the bar for this pass. Given that,
        not chasing the still-open game-data-fetch refactor further right now — revisit only if
        latency becomes a live complaint again, ideally with an actual `wrangler tail` timing pass
        this time rather than another code-reading diagnosis.
