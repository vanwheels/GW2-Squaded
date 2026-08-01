# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Next up

- [ ] Discord bot (client of the backend API) — unblocked now that the thin backend is live at
      https://gw2-squaded-share.vanwheelstheman.workers.dev.
- [ ] Capacitor port for iOS/Android (swap storage adapter + native bindings only).
  - Native HTML5 drag-and-drop (squad editor) has no touch-input equivalent yet — needs a touch
    fallback if/when this lands.
- [ ] "Not affiliated with ArenaNet/NCSOFT" disclaimer if bundling official GW2 icon assets.
      Decided 2026-07-31: footer/about screen, small persistent text line.
- [ ] Automatic game-data refresh mechanism (balance patches) — manual refresh only for now.
      Decided 2026-07-31: check for updates on app launch, prompt the user to refresh (not a silent
      scheduled background refresh) — user stays in control of when the fetch runs.

## Stats panel / boon-condition bar polish

- [ ] "Combat state" simulation inputs (Might stacks, Fury, stacking-sigil stacks, relic
      Active/Inactive) — mapped out 2026-08-01, not yet implemented. Design:
  - Ephemeral, local-component state only (not saved on `Build` — resets on reload/build switch;
    this is a "what-if" snapshot, not a build choice like equipment/skills).
  - Might (0-25 stepper): +34 Power, +34 Condition Damage per stack at level 80 (wiki-confirmed
    flat value) — feeds `attributes.power`/`attributes.conditionDamage` in
    `src/shared/gear-calc/derived-stats.ts`.
  - Fury (on/off toggle): flat +20% Critical Chance, feeds `derived.criticalChance`. Fury's effect
    on specific skills/traits ("while under the effect of Fury") is NOT modeled — no structural
    data ingested for conditional Fury-gated bonuses anywhere in the app; explicit stretch goal,
    not part of this feature.
  - Stacking sigil (0-25 stepper): auto-detected from whichever sigil is actually equipped in
    `EquipmentSlot.sigilIds` (no separate picker) — confirmed exactly 8 stacking sigils exist in
    `data/game-data/sigils.json` (Bloodlust/Power, Malice/Condition Damage, Perception/Precision,
    Renewal/Healing, Stamina/Toughness, Strength/Ferocity, Energy/Concentration, Bounty/all stats
    +2 each), all sharing the identical "Gain a charge of +X `<attr>` each time you kill a foe...
    Max 25 stacks" description text — needs a small hardcoded id -> {attribute, perStackValue}
    lookup table (not worth structurally parsing, only 8 exist). Only the active weapon set's
    sigil counts (reuse `isActiveWeaponSlot` gating from `attribute-totals.ts`), matching the
    in-game rule that only one stacking sigil can be active at a time. Stepper is hidden if no
    stacking sigil is equipped.
  - Relic Active/Inactive (toggle, only shown for curated relics): full structural modeling of
    every relic's proc is explicitly out of scope (relics are description-text-only today by
    design — see `Relic`'s doc comment in `src/shared/types/game-data.ts`). Narrower slice: hand-
    curate the subset of relics whose effect is a flat, unconditional outgoing-damage-% (the
    `"Damage Increase"` fact in `data/game-data/relic-effects.json`) into a lookup table — Relic of
    Fireworks (id 100262, 7%, 6s duration) is the confirmed concrete example. ~20+ relics carry a
    "Damage Increase" fact but not all are simple/unconditional (some are conditional on target
    health, skill type, etc.) — needs one manual wiki-verification pass per relic before adding to
    the curated list, same process as the existing WvW-duration override work (see
    `docs/game-data.md`). This also requires a brand-new "outgoing damage %" derived-stat row in
    `StatsPanel.tsx` — no such concept exists anywhere in the app yet (checked gear-calc,
    boon-calc, and `game-data.ts` — confirmed nothing computes or displays a damage modifier %
    today).
  - UI: new small panel (e.g. "Combat State") near `StatsPanel`/`BoonUptimePanel`, both of which
    already read `build` + `gameData` the same way this would.
- [ ] Boon tab / Squad tab: distinguish self-only vs. party-wide (up to 5) boon sources. Confirmed
      2026-08-01 the raw GW2 API data (already ingested into `data/game-data/skills.json`) carries
      this signal: a skill's `facts` array includes a `type: "Number"` fact with
      `text: "Number of Targets"` or `"Number of Allied Targets"` (`value` usually 5) alongside its
      `Buff` facts when the skill hits allies; purely self-targeted buffs (e.g. Signet of Fury/
      Signet of Might's passive/active) carry no such fact. `Fact` (`src/shared/types/game-data.ts`)
      already round-trips this via its index signature, but `extractFromFacts`
      (`src/shared/boon-calc/sources.ts`) currently ignores `Number` facts entirely — would need a
      `targetCount: number | null` (null = self only) added to `BoonConditionSource`, read from the
      first `Number` fact whose `text` contains "Target" among a skill's facts. Known caveats before
      building this: (1) the facts array is flat, so a skill with a self-only buff AND a separate
      ally-only buff in the same list (rare, not yet found a concrete example) can't be bound
      per-buff-line without a positional heuristic; (2) no WvW-style override table exists yet for
      target count the way `wvwFactOverrides` exists for duration, so any trait/WvW-driven target-
      count change would need the same manual wiki-verification pass docs/game-data.md describes for
      durations; (3) stationary sources (banners/wells/spirits) haven't been spot-checked for the
      same fact shape.
- [ ] Stretch goal, not currently planned: a per-skill "Damage" tooltip breakdown mirroring the
      Healing breakdown idea below — hovering a DPS stat would list each weapon/utility skill on the
      bar with its computed damage at current Power/Precision/Ferocity/condition stats.
- [ ] Bottom "Conditions / Boons / Control / Auras / Miscellaneous / Combo" icon bar —
      gw2skills.net-style screenshots show this bar also covers Control (e.g. Daze), Auras,
      Miscellaneous (e.g. Healing, Execute), and Combo-field/finisher icons, highlighted/greyed by
      whether the current build can produce them. `BoonUptimePanel` currently only covers
      boons/conditions — treat this as the long-term target shape for it to grow into.
- [ ] Stretch goal, not currently planned: a per-skill "Healing" tooltip breakdown (hovering the
      Healing stat lists each heal skill on the bar with its computed heal amount at current Healing
      Power).
- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Skill picker follow-ups

- [ ] 4 duplicate-named Heal/Utility/Elite skill groups still show duplicate entries in the picker
      with no resolving signal found yet: Engineer "Throw Mine" (Gadgeteer-trait-gated — would need
      the picker to know the build's chosen traits, an architecture change), Elementalist "Mist
      Form", Revenant "Protective Solace", Revenant "Jade Winds" (wiki lists all ids together with no
      distinguishing field).
- [ ] Known limitation, documented in code (`weapon-calc/weapon-skills.ts`): Weaver's "Dual Attack"
      weapon-skill-3 replacements (e.g. 3 different Fire-tagged ids sharing `specializationId: 56`)
      can't be disambiguated — which one is live depends on Weaver's second active attunement, a
      combat-state axis this app's static loadout model has no equivalent for. Falls back to the
      first candidate deterministically.
- [ ] Ranger Profession_4 "Eternal Bond" F-skill stays unresolved — no per-pet data exists for it
      (unlike Soulbeast's F1-F3, which resolve from `soulbeast-beastmode.json`).
- [ ] Unconfirmed edge case: whether any skill has a distinctly different effect specifically on its
      last charge before recharging (vs. every charge being identical) — no concrete example found
      to verify against; revisit if one surfaces.

## Skill bar UI/UX feedback pass (2026-07-31)

Large feedback pass from a full skill-bar walkthrough (screenshots per profession/general). Nothing
below has been implemented yet — captured here for a future session to pick up. Two UX questions
were resolved while triaging this list (see the affected items): multi-option F-icon toggles
(Firebrand's 3 Tomes) switch directly to whichever icon is clicked rather than cycling in sequence,
and the Ranger pet-swap/Untamed-swap text buttons get replaced by the cycle icon rather than gaining
it alongside.

### Engineer
- [ ] Edge case, explicitly deferred: Engineer's weapon-skill kit-swap is tied to `Skills`
      (Heal/Utility/Elite choices), not to profession specialization, so the Firebrand-style F-icon
      click-toggle pattern doesn't map cleanly onto it. Keep the current text-toggle row for kits
      as-is for now; revisit later.

### Elementalist
- [ ] Weaver's weapon-skill-3 "Dual Attack" ambiguity — already tracked in "Skill picker follow-ups"
      above and in `weapon-calc/weapon-skills.ts`; flagged again here as still open, no new action.

### Mesmer
- [ ] Troubadour's "Tales" skills and Mirage's "Mirror" skills fall into the generic "Other" category
      bucket in the skill picker (`groupSkillsByCategory` in `SkillsEditor.tsx`, driven by
      `skill.categories[0]`) instead of their own "Tales"/"Mirror" headers — and this leaks into other
      Mesmer specs' pickers too, not just Troubadour/Mirage's. Needs investigation into why the
      category grouping isn't picking up the right `categories[0]` for these, and why it's
      cross-contaminating unrelated specs.

### Necromancer
- [ ] "Necrotic Traversal" (2nd half of Summon Flesh Wurm's flip-skill chain) is filed under "Other"
      in the skill picker category grouping — should be associated with/grouped near Summon Flesh
      Wurm instead.

## Nice-to-haves

- [ ] "Favorites" pin for frequently-used builds in the squad editor's build sidebar; the
      build-picker option's description only shows the profession name today, not a fuller
      spec/gear summary.
- [ ] "Favorites" marker for food/utility consumables, to pin preferred choices to the top of the
      selection list (currently the full unfiltered catalog, by design).
- [ ] Settings toggle for underwater weapons/skills, defaulted **off**. Noted 2026-07-31 (UI polish
      session): underwater isn't frequently used in WvW and normally shouldn't factor into
      boon/condition output. When off, the Underwater weapon-set editor and its skill bar should
      stay hidden, and `sources.ts`'s boon/condition calculator should skip underwater skill ids
      the same way it would if nothing were equipped there.
