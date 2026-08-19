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
      (a full facts dump, 2026-08-19) — Serene Rejuvenation has 2 unlabeled "Effectiveness Increased
      Percent" facts (20/15, likely pve/wvw+pvp) plus `PrefixedBuff` facts naming SKILLS not legends
      (Natural Harmony/Purifying Essence/etc. — `resolveLegendFromPrefix` deliberately doesn't
      attribute these, per its own doc comment, so they render unlabeled); Generous Abundance has 2x
      "Centaur Skill Healing" and 3x "Other Legend Healing" (per-skill breakdown, unlabeled which
      skill each is); Resilient Spirit has 2 identical "Barrier per Boon" facts; Invigorating
      Dismissal has 3 "Endurance Gained" values; Life Attunement has 2 "Attribute Conversion"
      percents; Invoking Harmony has 3 "Healing Increase to Others Percent" values; Unyielding
      Devotion has 2 "Damage Reduced Percent" values. `NUMERIC_FACT_WVW_OVERRIDES` (`fact-numbers.ts`)
      already exists for exactly this shape but has exactly 1 entry today (Calming Tongue) — every
      Salvation case above is a fresh, uncurated instance of the same gap. Given the pattern held for
      100% of Salvation's majors checked, it likely recurs across Invocation/Retribution/Corruption/
      Devastation/Renegade/Vindicator/Conduit too — scope as its own dedicated sweep (one leg at a
      time, per the pacing lesson in `pacing_large_sweeps` memory) rather than folding into the
      2 items above. Not started; Salvation itself would be the natural first leg since it's already
      fully triaged above.

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

- [ ] Discord bot — a guild-scoped, curated build/squad board (slash-command add/edit/remove/move,
      profession-sectioned board messages the bot keeps in sync, optional Manual-approval workflow
      with role-gated buttons) mapped out in full 2026-08-12. Full design-of-record — command
      list, D1 schema, approval workflow, architecture decisions, explicit v1 non-goals, phased
      build order — lives in `docs/discord-bot.md`, not here; read that first before picking this
      up. **Phases 1-3 all done, deployed, registered, and live-verified in a real Discord server**
      (Phase 1: 2026-08-19; Phase 2 core CRUD/board sync: 2026-08-19, setup/add/remove/edit/move/
      autocomplete all confirmed; Phase 3 approval workflow: 2026-08-19, approvalmode/
      setapproverrole/approvalschannel + gated add + both Approve and Reject confirmed, plus a
      same-day Preview-button follow-up after live testing showed the card gave an approver
      nothing to inspect before deciding). **Phase 4 leg 1-2 (display) done and live-verified
      2026-08-19** (`/builddisplay` screenshot render) — the live-verify pass caught 4 real bugs
      invisible to local typecheck/lint/dry-run (a game-data race, 3 missing context providers,
      missing local icon assets + a too-narrow image CSP, and a too-narrow render viewport); see
      `docs/discord-bot.md`'s "Status" section for the full writeup. **Only remaining piece:
      Phase 4 leg 3, `/squaddisplay`** — not started; squad requests in the approval workflow have
      no Preview button yet for the same reason (no squad renderer exists to reuse).

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
