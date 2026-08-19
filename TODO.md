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

## Build screenshot layout redesign (2026-08-19) — DONE, one cosmetic follow-up unconfirmed

Goal: redesign the Build editor's screenshot output (`ScreenshotButton`/`EquipmentTextManifest`),
Discord-bot-facing down the road, so it fully fits on one screen without scrolling. Landed across 6
same-day rounds of real user-screenshot feedback (COMPLETED.md Session 230 + commits 0700228,
509f770, 29f2711, f9cf075, 386966d, 9d59966):
- Equipment: text manifest, weapon-type bar, profession-picker collapse (Session 230).
- `CombatStatePanel` moved out of the Stats column entirely into its own toolbar cell; toolbar row
  and the 3 editing columns merged into one CSS Grid (`.build-editor-grid`) so the toolbar's cells
  line up exactly above their matching column (Profession/Traits, Weapon-type/Equipment,
  Combat-state/Stats).
- `BoonConditionSummaryPanel` moved beside `StatsPanel`; its icon rows wrap onto multiple lines
  instead of scrolling (Conditions is the one row wide enough to need 2 lines).
- "Skills" heading folded into "Stats & Skills"; manifest's own redundant heading removed.
- Several vertical-spacing trims (row-gap, column/manifest padding) once every section was already
  as compact as it'd get on its own.
- **User confirmed 2026-08-19: "it all fits now"** — the actual success criterion for this whole
  redesign is met.
- [ ] Cosmetic follow-up, NOT yet confirmed: content fits but a small residual page overflow was
      still showing a scrollbar on the right edge. Trimmed ~20px more of build-editor-scoped
      spacing (commit 9d59966) as a blind fix (electron sandbox limitation, can't verify directly)
      — needs a screenshot to confirm the scrollbar is actually gone. If it persists, next
      candidate is `.app-content`'s 24px padding (app-wide, lower priority since it'd touch every
      other view's edge spacing too).

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

## Build "Updated"/staleness tracking is currently untrustworthy (flagged 2026-08-18)

User noticed the Builds tab's "Updated just now" label appears even when no actual edit was made —
just clicking into a build and immediately backing out marks it as freshly updated. Traced the root
cause: `BuildEditorView.handleBack` (`BuildEditorView.tsx:193-200`) unconditionally stamps both
`updatedAt: new Date().toISOString()` and `updatedAtGw2Build: localGw2Build` on every `onBack`, with
no check for whether `draft` actually differs from the `build` the editor was opened with.

This is worse than a cosmetic timestamp bug: the codebase already has a patch-staleness mechanism
built for exactly what the user wants — `isBuildStaleSincePatch` (`@shared/types/build`) compares
`build.updatedAtGw2Build` against the current `localGw2Build` snapshot and shows "Not reviewed since
latest patch" instead of the relative-time label (`BuildsView.tsx:170-178`, see COMPLETED.md for
when `updatedAtGw2Build` was introduced). But because `updatedAtGw2Build` gets silently re-stamped on
every back-navigation — not just on a real edit — merely glancing at a build and leaving clears the
staleness flag, defeating the one thing it exists to track. So the "Updated" label isn't really
tracking edits *or* patch-relevant review right now; it's tracking "was the editor closed."

Two-part fix, not started:
- [ ] Only bump `updatedAt`/`updatedAtGw2Build` in `handleBack` when `draft` is actually different
      from the `build` prop the editor opened with (a real content edit), not on every `onBack` call.
- [ ] Separately, add a **manual** "mark as up to date" checkbox/button inside the build editor —
      user-initiated, not automatic — that the user clicks after a balance patch drops to confirm
      they've reviewed the build and it's still good, stamping `updatedAtGw2Build: localGw2Build`
      (and probably `updatedAt` too) at that point. This decouples "I edited something" from "I
      reviewed this build against the current patch and it's still valid as-is" — today's mechanism
      conflates the two by only ever stamping `updatedAtGw2Build` as a side effect of saving,
      requiring an edit (however trivial) to clear a stale flag even when no edit was actually
      needed.

## Scoped features, not yet built

Paragon's Motivation-tiered Chants (flagged by the user 2026-08-14) is now **FULLY DONE 2026-08-15**
— the 3 Chant skills themselves (COMPLETED.md, same day) plus the 5 traits that further modify them
(Enduring Refrain, Feverish Pulse, Calming Tongue, Liberating Liaise, Strengthening Stanzas — see
COMPLETED.md for the per-trait writeup) are all curated. One genuine gap fell out of that pass, since
fixed — see COMPLETED.md's 2026-08-15 `MISCELLANEOUS_MATCHERS` WvW-override entry.

- [ ] Party-wide-only filter for boon/condition/effect summaries (flagged 2026-08-16) — a new toggle
      on the build editor (`BoonConditionSummaryPanel`) and squad editor (`SlotTile`/`PartyRow`) that,
      when on, only shows boons/auras/miscellaneous effects (stealth, superspeed, etc.) and cleanses
      whose `targetCount` reaches the full party: **`targetCount !== null && targetCount >= 5`**
      (user-confirmed 2026-08-16: "just the buffs that target 5+ players, a full party" — a squad-wide
      10-target effect still counts, since it covers the party as a subset; self-only (1) and
      small-group (2-4) sources don't). Sources with unresolved/uncurated `targetCount` (`null`) are
      **hidden** when the filter is on (conservative — don't claim party-wide for uncurated data).
      Scope is the ally-facing categories only (Boons, Auras, Miscellaneous, and the Cleanse line of
      Strips/Corrupts/Cleanses) — Conditions/Control/Strip/Corrupt are enemy-facing and "party wide"
      doesn't apply the same way to them, unaffected by this toggle. Filtering happens per-source
      within each group (a group with a mix of qualifying and non-qualifying sources still shows, just
      with only the qualifying sources listed in its tooltip); a group hides entirely only when NONE of
      its sources qualify. Needs a new `useAppSettings`-style boolean (or per-view local state — decide
      whether this should persist like `showUnderwater`/`showRacialSkills` or reset per session) wired
      through `computeBoonConditionSources`/`computeNamedFactSources`'s existing `targetCount` field —
      no new data modeling needed, the field already exists on every source.

- [ ] Exclusion filter on the Builds tab (flagged 2026-08-16) — extend `useTagFilter`
      (`src/renderer/state/use-tag-filter.ts`, shared by `BuildsView`/`SquadsView`/`BuildsSidebar`)
      from OR-inclusion-only to support excluding specific tags/professions too. User-confirmed
      interaction (2026-08-16): click-cycle the same chip through off → include → exclude → off, no
      new UI controls — reuses `TagChipDropdown`/`ProfessionTagPicker`'s existing chip click handlers,
      just needs a 3-state model (`Map<string, 'include' | 'exclude'>` instead of `Set<string>`) and a
      visual "excluded" chip state (e.g. a strike-through or red outline) distinct from "selected."
      Filter logic: keep OR-across-includes, AND NOT any excluded tag/profession present. Scoped to
      the Builds tab per the user's request — decide separately whether `BuildsSidebar`/`SquadsView`
      should get the same treatment since they share the hook (likely yes, low extra cost once the
      hook itself supports it).

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
