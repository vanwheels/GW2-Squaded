# TODO

## Next up

- [ ] Theoretical boon/condition uptime calculator — source list (Fact parser) shipped; scaling
      and consumables still open. Confirmed scope: for a single build (like gw2skills.net), list
      every boon/condition source (skill or trait) it provides, with duration computed from base
      values scaled by boon duration/concentration and food/utility consumables. Squad-view mode
      (later) shows all 5 party members' sources per boon side by side, with a stretch goal of an
      estimated combined/ideal uptime. Applies equally to condition output (not just boons).
  - [x] Real parser for the GW2 API's `Fact`/`traitedFacts` objects: `src/shared/types/game-data.ts`
        now types `Fact` (was `unknown[]`); `src/shared/boon-calc/sources.ts` walks equipped
        skills + auto-granted minor traits + chosen major traits, extracts `type: 'Buff'` facts
        matching a known boon/condition name, and gates conditional facts via `requires_trait`
        against the build's active trait set. Wired into `BoonUptimePanel` (grouped by
        boon/condition, base durations only — see below for what's not yet applied).
  - [x] Gear scaling (boon duration/condition duration %) is now applied. Implemented in
        `src/shared/gear-calc/attribute-totals.ts`: `computeGearAttributeTotals` sums
        `attribute_adjustment * multiplier + value` (quoted from the wiki's `API:2/itemstats`
        page, raw wikitext fetched this session) across every equipped `EquipmentSlot`, using a
        per-slot-type `attribute_adjustment` constant table (also quoted verbatim from that page's
        "Notes" table) — level-80 Ascended by default (not user-selectable yet). The earlier
        open question ("which of 43 duplicate-name itemstat ids is correct per slot") turned out
        to already be resolved: `EquipmentEditor`'s stored `itemStatId` only ever comes from the
        deduped canonical list its dropdown offers, so no further resolution was needed — the id
        on a build is always sensible. `BoonDuration`/`ConditionDuration` totals (Concentration/
        Expertise) convert to a duration % at a flat 15-points-per-1% rate (quoted from the wiki's
        Concentration/Expertise pages) via `boonDurationPercent`/`conditionDurationPercent`, then
        `sources.ts` applies that % to every source's `scaledDurationSeconds`, and
        `BoonUptimePanel` displays both the scaled durations and the build's overall %.
        Known limitation, documented in code: weapon slots don't track weapon type (only
        `itemStatId`), so all weapon slots use the one-handed `attribute_adjustment` constant —
        undercounts total attributes for two-handed-weapon builds. Verified via Playwright: hand-
        calculated 109.124% boon duration for an all-"Diviner's" build matched the rendered
        109.1%, and every source's scaled duration matched `base * (1 + percent/100)` exactly.
  - [ ] Needs food/utility consumable data + selection UI — not yet fetched (GW2 API `/v2/items`
        is much larger than the endpoints currently pulled; scope that fetch when this starts)
        and not yet modeled on `Build`. Superseded/absorbed by the "Build editor UI/UX overhaul"
        stats-panel item below (user decided 2026-07-25 to build runes/sigils/food/consumables
        together with that stats panel rather than as a separate pass) — do the fetch once there,
        not twice.
  - [x] IMPORTANT: use WvW-specific balance numbers, not PvE — now applied for the boon/condition
        calculator. Built as `scripts/fetch-wvw-splits.ts` (`npm run fetch-wvw-splits`), writing
        `data/game-data/wvw-fact-overrides.json`: fetches `Category:Split skills` (1,664 pages) /
        `Category:Split traits` (545 pages) from the wiki, narrows to the ~1,110 pages that are
        BOTH in one of those categories AND correspond by unambiguous name match to a skill/trait
        with a boon/condition Buff fact locally, fetches each page's raw wikitext, and parses out
        every `{{skill fact|...|game mode=...}}` / `{{trait fact|...}}` boon/condition line. Went
        wider than the originally-scoped "~15-20 skills the target party comp uses" once it became
        clear the app supports any of the 9 professions, not just the target comp — restricting to
        one comp would've left every other build silently showing PvE numbers. Every parsed
        PvE-tagged value is cross-checked against the already-fetched API `duration` before being
        trusted (naive wikitext `|`-splitting can misparse an embedded `[[Link|text]]` pipe); a
        mismatch, a boon appearing more than once in one id's Buff facts, more than one
        same-game-mode fact line for one boon on one page, or a page title matching >1 skill/trait
        id are all skipped and logged rather than guessed (314/1110, 68/1110, 26/1110, and
        119/1110 pages respectively — see fail-safe philosophy in docs/game-data.md). Net result:
        187 skills + 99 traits got a real WvW override. Wired into
        `src/shared/boon-calc/sources.ts` (`gameData.wvwFactOverrides`, consumed in
        `extractFromFacts`: `'omit'` drops a PvE-only fact entirely, a number replaces the API's
        default duration with the WvW-tagged one) and reflected in `BoonUptimePanel`'s caveat
        text. Verified via Playwright against the hand-checked `Restoring_Reprieve` case from this
        session's investigation: with Firebrand equipped and Restoring Reprieve as heal skill, the
        panel shows only Aegis (2s) — Protection and Resolution (PvE-only per the wiki split) are
        correctly absent. Known gap: boon/condition sources on skills/traits the fetch script
        skipped (see counts above) still show their PvE value — same fail-safe default as before
        this existed, not a regression.
  - [ ] Target party comp for first pass (per current WvW meta, confirm before assuming stale):
        Luminary (Guardian elite spec — stability/defensive boons), Troubadour (Mesmer elite
        spec — defensive boons + healing), Druid (Ranger — healer), plus 2 DPS (e.g. Reaper,
        Spellbreaker). Elite spec roster has grown since original scaffolding — re-check
        `data/game-data/specializations.json` rather than assuming a remembered list is current.
- [ ] Elite-spec skill gating for the Heal/Utility/Elite pickers — mostly shipped this session
      (`scripts/fetch-elite-spec-skills.ts` + wiring in `SkillsEditor`/`BuildEditorView`/
      `game-data-store.tsx`; see docs/game-data.md and COMPLETED.md for how it works). 211
      skill→spec mappings resolved cleanly.
  - [ ] ~36 skill names matched multiple ids ambiguously (mostly Revenant legend skills and
        Elementalist dual-attunement skills — GW2 sometimes has two ids sharing a display name for
        a display/tooltip-copy reason) and ~16 wiki pages didn't match any skill id (Druid
        Celestial-Avatar-form variants, a couple of gadget "backfired" flavor pages). Both are
        excluded from the map rather than guessed, so those specific skills stay ungated (fail-
        safe, not silently wrong) — revisit only if it turns out to matter for a real build.
- [x] Icon + name UI swap, pulled forward ahead of MVP per explicit user direction ("I'd much
      rather switch to the icon+name UI swap now"). Landed in two passes — Traits/"masteries" +
      gear loadout first, then `SkillsEditor` and `BoonUptimePanel` icons as a follow-up pass
      through the rest of this TODO item (see COMPLETED.md for both writeups). Fully done:
      - [x] `SkillsEditor` (Heal/Utility/Elite) — in-game-style skill bar (icon buttons in slot
            order) that opens an icon+name picker grid per slot on click, closing on selection.
      - [x] `BoonUptimePanel` boon/condition icons — turns out no hand-maintained map was needed:
            every `Buff`-type `Fact` already fetched into data/game-data/{skills,traits}.json
            carries the boon/condition's own icon URL, so `src/shared/boon-calc/icons.ts` was
            populated straight from that existing data (one icon per name, same URL everywhere
            it's granted). Source lines also now show the granting skill/trait's own icon.
- [ ] Build editor UI/UX overhaul — user reviewed the current build editor against gw2skills.net
      (screenshots provided 2026-07-25, not saved to the repo) and called out the following. In
      progress (resumed 2026-07-29) — several sub-items landed this session, see below for what's
      done vs. still open. Scoping questions were asked back and answered same-day (2026-07-25) —
      decisions below are confirmed, not open. Grounded against an Explore-agent code survey done
      the same day; file:line refs below reflect that survey (some now stale post-refactor).
  - [x] Tooltip hover delay is noticeably slow — should pop up ~instantly. Survey finding: there
        was **no custom Tooltip component anywhere in `src/renderer`**; every tooltip was a native
        HTML `title=` attribute, and native `title` delay is OS/browser-controlled, not something
        CSS/JS can shorten. Built `src/renderer/components/common/Tooltip.tsx`: portals a
        `position: fixed` popup into `document.body` on `mouseenter`/`focus` (no delay), positioned
        from the trigger's `getBoundingClientRect()`, hidden on `mouseleave`/`blur`. Wired into
        every current icon hover target — `TraitsEditor` (spec icons, minor traits, major traits),
        `SkillsEditor` (skill-bar slots + picker-grid options), `ProfessionSelect` (profession
        icons) — replacing their native `title=` attributes. Still to reuse this component for:
        minor-trait tooltips (done, see below), and the variant-cycling items further down (not
        started).
  - [x] Traits section layout should be horizontal instead of vertical (was 3 vertical
        `.trait-line` columns, each stacking its own tiers independently — reference gw2skills.net's
        horizontal trait-line layout). Restructured `TraitsEditor` from "one wrapper div per spec
        column" to a single CSS Grid (`display: grid; grid-template-columns: repeat(3, 1fr)`) where
        every line's spec-picker row, spec name, and each tier (1-3) are separate grid children
        placed by explicit `gridColumn`/`gridRow` rather than nested per-column divs — this also
        closes the row-alignment item below for free, since CSS Grid sizes each row track to its
        tallest cell across all 3 columns.
  - [x] Data-model fix (prerequisite, resumed 2026-07-29): `Build.specializations` changed from a
        compacted `TraitLineSelection[]` to a fixed-length `TraitLineSlots` 3-tuple
        (`[TraitLineSelection | null, TraitLineSelection | null, TraitLineSelection | null]`,
        `src/shared/types/build.ts`) so a trait line's array index is a stable identity — picking
        only the visually-2nd column's spec no longer re-renders as "line 1" on the next pass.
        `TraitsEditor` no longer compacts/decompacts (`toLines`/`fromLines` removed — `value` is the
        slots array directly); `sources.ts`'s two `build.specializations` consumers and
        `BuildEditorView`'s `equippedSpecializationIds`/`handleSpecializationsChange` updated to
        filter/guard nulls instead of assuming every entry is non-null. No on-disk build migration
        needed — no builds are checked into the repo, and app-userData builds are dev-only so far.
  - [x] Add a specialization selector beneath the profession selector, defaulting to the base
        (non-elite) line for that profession. New `EliteSpecSelect` component
        (`src/renderer/components/build-editor/EliteSpecSelect.tsx`): a row of icon buttons (reuses
        `.spec-icon-button`) for the profession's elite specializations plus a "Core" option,
        writing directly to `specializations[2]` (the elite line is always index 2 by GW2
        convention) via the now-stable `TraitLineSlots` index. Wired into `BuildEditorView` beneath
        `ProfessionSelect`, reusing the existing `handleSpecializationsChange` handler so switching
        elite specs also clears any now-invalid elite-spec-gated skill picks, same as changing
        specs any other way already did.
  - [x] Selecting a specialization there should auto-swap the 3rd trait line to that
        specialization (i.e. specialization choice and 3rd-trait-line choice become one control,
        not two independent ones). Same change as above — `EliteSpecSelect` writes `specializations[2]`
        directly, so choosing an elite spec there *is* setting the 3rd trait line. Note:
        `TraitsEditor`'s own per-line picker row for column 3 still independently allows choosing
        any spec (elite or core) into that line too, same as before this session — the two controls
        both target the same array slot and stay in sync, not a conflict, but worth knowing if a
        future session wants to restrict column 3's own picker to elite-only for stricter parity.
  - [x] Profession selector and the new specialization selector should both be icon buttons (like
        the existing `.spec-icon-button` pattern already used elsewhere), not `<select>` dropdowns.
        `ProfessionSelect` (prior session) and `EliteSpecSelect` (this session) both use
        `.spec-icon-button`; "Core" renders as a small pill-shaped text button (`.core-spec-button`)
        since it has no icon to show.
  - [x] Trait rows don't line up evenly across the 3 columns because the 3rd line (elite spec)
        has different content/height than the other two — fix the layout so all 3 trait columns
        align row-for-row regardless of which specializations are selected. Fixed as part of the
        horizontal-grid restructure above (same change, same commit).
  - [ ] Revenant-specific: available skills depend on which specialization is selected (legend
        pool), AND Revenant equips 2 legends at once, effectively giving 2 separate skill bars.
        Need to display one bar at a time with a toggle button to switch between them, and clearly
        indicate which legend/bar is currently "active" (matches in-game skill-bar swap UX).
        Survey finding: confirmed `SkillSelection` (`build.ts:14-18`) is a single flat
        `{ heal, utility: [3], elite }` bar with **no legend concept at all** and `SkillsEditor`
        renders exactly one `.skill-bar` (lines 47-67) — this is new modeling, not a tweak.
  - [x] Skill and weapon-skill tooltips/entries don't currently display the boons they grant —
        surface boon facts (already parsed for the boon-calc feature, see `sources.ts`) in the
        skill tooltip/detail view too, not just the aggregate `BoonUptimePanel`. Done for regular
        (Heal/Utility/Elite) skills: added `boonConditionFactsForSkill` to `sources.ts` (exports
        `activeTraitIds` + a per-skill wrapper around the existing `extractFromFacts`, so a skill's
        gated/scaled boon output can be computed without it being equipped — needed for the picker
        grid, not just the equipped bar) and wired it into every skill tooltip in `SkillsEditor`
        (both the 5 skill-bar slots and the picker-grid options), listed below the name/description
        with the same scaled-duration formatting `BoonUptimePanel` uses (factored out to
        `src/shared/boon-calc/format.ts`, shared by both now). Weapon-skill tooltips aren't
        included yet since weapon skills aren't modeled as a slot type at all — revisit once the
        weapon-selection item below lands.
  - [x] Same gap for conditions — condition facts aren't displayed in skill/weapon tooltips either.
        Closed by the same change (`boonConditionFactsForSkill` returns both boon and condition
        facts undifferentiated in one list, matching how the skill actually behaves in-game).
  - [ ] Weapon selection — user confirmed (2026-07-25) full gw2skills.net parity: land Weapon I +
        Weapon II swap sets, AND underwater weapon slot, all in the first pass (not a smaller
        land-only first cut). Survey finding: weapon skills are entirely unhandled today — no
        weapon-skill slot type exists, and `EquipmentSlotKey` (`build.ts:38-40`) only stores
        `{ itemStatId: number | null }` with no weapon-type field, even though `Skill.weaponType`
        already exists as per-skill metadata in game-data (`game-data.ts:76`). This UI is the
        natural place to finally capture weapon type per slot (ties into the gear-scaling
        limitation above where all weapon slots currently use the one-handed attribute constant).
        The original 2026-07-25 reference screenshots were never saved; a fresh set (11 images) was
        provided 2026-07-29 (also not saved to the repo — re-request if needed) and is fully
        digested below, so nothing was lost.
    - [x] **Foundational data landed this session**: `Profession` (`src/shared/types/game-data.ts`)
          gained a `weapons: Record<string, ProfessionWeapon>` field —
          `{ flags: WeaponFlag[], specializationId: number | null, skills: {id, slot}[] }` per
          weapon type, sourced directly from `/v2/professions`' own `weapons` object (confirmed via
          live API call, not hand-rolled). `scripts/fetch-game-data.ts` updated to capture it;
          `data/game-data/professions.json` re-fetched. Verified against real examples: Guardian's
          `Axe` carries `specializationId: 62` (Firebrand) and `Longbow` carries `27`
          (Dragonhunter) — both match known unlocks, confirming the field means what it says.
          `Spear` carries `flags: ['TwoHand', 'Aquatic']` with **10** skill entries (5 land + 5
          underwater variants — it's the one dual-use land/underwater weapon), while `Trident`
          carries `['TwoHand', 'Aquatic']` with only 5 (underwater-only, no land variant) — the
          `Aquatic` flag is what distinguishes underwater-eligible weapons, not a separate
          "underwater weapon type" list. Land-slot options = weapons whose `flags` include the
          slot's needed hand flag; underwater-slot options = weapons whose `flags` include
          `Aquatic`. Not yet wired into any UI/equipment model — this is the data layer only.
    - [ ] Choosing a weapon *type* (sword/axe/bow/etc.) is its own picker, separate from the
          existing stat-combo/sigil/infusion pickers on the equipped-weapon icon — a horizontal
          row of weapon-type icons scoped to what the current profession can use. Confirmed via
          screenshot: this row appears inline in the `WEAPON I` header area once a profession is
          selected (**profession must be chosen first** — the picker has nothing to show before
          that, since availability is per-profession).
    - [x] Off-hand (2nd slot) picker shows a different, filtered list than main-hand — confirmed
          via screenshot (Revenant, main-hand Mace picked → off-hand picker offered only Axe /
          Sword / Shield). Real GW2 hand-restriction, now directly modeled by the `ProfessionWeapon`
          data above (see foundational-data item) — implement by filtering on `flags`, not by
          fetching anything new.
    - [ ] A 2-handed weapon occupies both the main- and off-hand slot as a single entry (matches
          in-game); a 1-handed weapon leaves the other slot independently choosable. Re-asked about
          the yellow/orange 1-handed tint this session — user doesn't have it confirmed either way
          and said the color doesn't matter as long as main/off-hand and per-profession
          availability are modeled correctly. **Drop the tint as a requirement**; treat as optional
          visual polish only if it comes up again later.
    - [x] Underwater uses its own weapon bar with its own swap toggle, separate from the land
          Weapon I/II swap — confirmed via screenshot: `WEAPON I` / `WEAPON II` / `UNDERWATER` are
          3 always-visible sections in the top bar (not tabs that hide each other), each with its
          own independent swap-set toggle. A Revenant example screenshot showed Mace/Axe (land) +
          Trident (underwater) all populated simultaneously.
    - [ ] Each weapon slot (once a type is chosen) still has its own sigil (×1–2) and infusion
          (×2) pickers layered on top — confirmed via the equipment-panel screenshots this session
          too (every weapon row shows the item icon plus 2 upgrade-slot badges beside it); the
          weapon-type picker is an additional *new* picker, not a replacement for those.
    - [x] Need a land/underwater toggle that scopes both the skill bar and the boon/condition
          calculator — confirmed via screenshot: a separate `ENVIRONMENT` control (tree icon =
          land / wave icon = underwater, active one underlined orange) is what actually switches
          which skill bar (slots 1-5, the weapon skills) and which stats/boon totals are shown —
          distinct from the underwater weapon-swap-set's own internal toggle noted above. Confirmed
          behavior across 2 screenshots of the same build: toggling `ENVIRONMENT` from land to
          water swapped the rendered weapon-skill icons in slots 1-5 from the land set to the
          underwater set, with the rest of the build (traits, other skills, stats) unchanged.
          Real-data note for the "distinct underwater skill variant" sub-question: since `Spear`
          alone carries 10 skill entries split by `slot` value (5x `Weapon_1..5` land + 5 more of
          the same slot names, presumably order-distinguished — needs closer inspection of the raw
          entries when this is implemented) while single-context weapons only have 5, the
          land-vs-underwater skill id split is already fully present in the `ProfessionWeapon.skills`
          data fetched above — no additional API flag hunting needed.
  - [x] Minor traits: original complaint was "no hover tooltip at all," but survey finding showed
        minor traits actually already carried a native `title=` same as majors — so there was no
        missing-wiring bug here specifically. Wired into the new `Tooltip` component along with
        majors as part of the tooltip-infra item above (not a separate fix, as predicted).
  - [ ] Skills with multiple trait-dependent or (Revenant) legend-dependent variants currently
        show up as separate duplicate entries in the skill picker — should collapse to a single
        entry. User confirmed (2026-07-25) the cycling UX: small in-tooltip prev/next arrows or
        numbered tabs (1/2/3) to step through variants — not hover-auto-cycle, not a dropdown.
  - [ ] Same collapsing behavior, same arrows/tabs cycling UX, needed for multi-step skills
        (distinct effects on 1st click vs. 2nd click, etc.) — one entry, not duplicate list
        entries.
  - [x] Confirm equipment stat calculations use Ascended/Legendary values, not Exotic — Ascended
        and Legendary share the same (highest) stat budget, so gear math should always assume that
        tier regardless of what the user actually has crafted. Survey finding: this was already
        true in code — `attribute-totals.ts:55` hardcodes `const RARITY: 'exotic' | 'ascended' =
        'ascended'` (comment there notes it's "not user-selectable yet, would need a rarity field
        on `EquipmentSlot`"), and no "Exotic"/"Ascended" strings appear anywhere in
        `data/game-data`. Confirm-and-close, no code change needed — a per-piece rarity selector UI
        would be new scope if wanted later, but hasn't been requested.
  - [ ] Add a full character-stats panel (Power/Precision/Ferocity/Toughness/Vitality/etc. plus
        derived %s — crit chance, boon duration, etc.) that factors in gear + traits + runes +
        sigils + infusions + relic + food/utility, matching gw2skills.net's stats sidebar. User
        confirmed (2026-07-25) scope: **include runes, sigils, infusions, relics, AND food/utility
        consumables in this same first pass**, not deferred — despite none of those concepts
        existing in `Build`/`GameData` today (survey: zero matches for rune/sigil/food/consumable/
        legend across `src/shared/types`), so this item now also covers designing those types +
        fetching their game-data + selection UI, not just the stats math. This absorbs/supersedes
        the earlier separate "food/utility consumable" TODO line under the boon-calculator item
        above — do them together here, not twice. 12 detailed reference screenshots received
        2026-07-25 (not saved to the repo — re-request if needed when resuming); scope nailed down
        from them plus follow-up user clarification:
    - [ ] **Item-rarity color coding, and an important scope nuance**: user identified the app's
          (and gw2skills.net's) existing pink/magenta = Ascended, orange/yellow = Exotic border
          convention (already visible on armor pieces in every full-build screenshot). The
          earlier "ignore Exotic, assume Ascended/Legendary" decision (see the equipment-stat item
          above) applies specifically to **armor/weapon/trinket base rarity** — it is NOT a
          blanket "exclude anything Exotic" rule for every item category here:
          - Relics are shown with a blue "Fine"-tier border per the user, and separately the user
            confirmed relics are **Exotic-tier only — there is no Ascended relic in the game** —
            so relics must stay in scope even though they're Exotic; don't let a naive "skip
            Exotic items" filter accidentally drop them.
          - All WvW infusions are **Fine tier** (blue), not Ascended and not Exotic — that's just
            their native rarity in-game, unrelated to the armor/weapon Ascended-vs-Exotic
            decision; still fully in scope per the infusions bullet below.
          - Runes and sigils don't have an Ascended/Exotic distinction at all — "Superior" is
            simply their one relevant (max) tier, per the bullet below.
    - [ ] **Runes/sigils: only the top ("Superior") tier matters** — user explicitly said lower
          rune/sigil tiers (the non-Superior "Rune of X" / "Major Rune of X" progression) don't
          need to be fetched or selectable, only "Superior Rune of X" / "Superior Sigil of X".
          Rune tooltips show a numbered (1)–(6) stat-bonus list — bonuses unlock progressively
          based on how many pieces of that rune are equipped (standard GW2 mechanic: 6 armor
          pieces → up to 6 stages). **Confirmed via a fresh screenshot (2026-07-29, Superior Rune
          of the Scholar): the per-stage attribute is NOT a fixed alternating pattern** — this
          rune's 6 stages read `+25 Power / +35 Ferocity / +50 Power / +65 Ferocity / +100 Power /
          +125 Ferocity`, i.e. Power and Ferocity interleaved but at different values each stage,
          not a simple "same two attributes repeating a formula." The data model needs the full
          literal per-stage `{attribute, value}` list sourced per rune (from the API's item facts
          or the wiki), not a derived/computed formula — and the stats calc needs to count
          same-rune armor pieces to know which stages are active. Sigils are 1–2 per weapon
          (2 on two-handed, 1 each on main/off-hand) and don't have a count-based stage mechanic —
          confirmed via a fresh screenshot too (Superior Sigil of Force: flat "+5% strike damage",
          one effect, no stages).
    - [ ] **Infusions: only WvW-specific infusions matter** — user said ignore Agony infusions and
          other general infusion types; only fetch/support ones like "Concentration WvW Infusion",
          "Expertise WvW Infusion", "Healing WvW Infusion". **Confirmed via a fresh screenshot**
          (Mighty WvW Infusion: "+5 Power" flat stat plus "+1% Damage to Guards/Lords/Supervisors"
          WvW-flavored secondary effect) — matches the originally-assumed shape exactly. **Exact
          per-slot infusion counts now fully confirmed via the 2026-07-29 equipment-panel
          screenshots** (previously only weapon slots were confirmed): weapons get 2 each (both
          Weapon I and Weapon II rows showed 2 upgrade-slot badges per weapon icon); every one of
          the 6 armor pieces gets exactly 1; every trinket gets exactly 1 **except the amulet,
          which visibly has none** — directly confirms the user's earlier rule, no wiki
          cross-check needed anymore.
    - [ ] **Relics are a must-have, not optional** — exactly 1 relic equipped per build. Relics
          grant effects through the *same* `Fact` system already used for skills/traits, so relics
          should plug into the existing `sources.ts` boon/condition extraction path, not a separate
          one-off system — **but a fresh screenshot this session (2026-07-29, Relic of the
          Warrior) shows a fact shape `extractFromFacts` doesn't handle yet**: "Weapon swap
          recharge time is reduced." plus a named, non-Buff, non-duration fact
          ("Weapon Swap Recharge Reduction: 25%") — a flat passive modifier, not a `Buff`/duration
          or a `Damage`-per-interval shape like the previously-seen Relic of Agony example. When
          this is implemented, `extractFromFacts`/the `Fact` type may need to widen beyond the
          current Buff-focused handling (or explicitly skip unrecognized fact `type`s rather than
          silently mis-rendering them) — check a handful of other relics' facts before assuming
          Buff-shaped is the common case. Still no dedicated relic-*picker* screenshot (only the
          tooltip) — picker UI/placement can be designed reasonably without one.
    - [ ] **Food and utility consumables: keep the full list selectable, don't pre-filter to a
          "WvW meta" subset** — user was explicit here despite there being a lot of options ("it's
          best to keep them all available"). Deferred fast-follow (not blocking first pass, but
          worth a placeholder TODO sub-item once this ships): add a "Favorites" marker so users
          can pin their preferred food/utility choices to the top of the selection list.
    - [x] Stats sidebar layout (from full-build screenshots, before/after gearing up): two columns
          of icon+number rows. Left column = raw/base attribute totals (Power, Toughness,
          Vitality, Precision, Ferocity, Healing Power, Condition Damage, Expertise,
          Concentration — standard GW2 core+secondary attributes). Right column = derived/
          converted values (Armor, Health, Critical Chance %, Critical Damage %, Boon Duration %,
          Condition Duration %, Magic Find %). Confirmed via a before/after pair: an empty build
          showed flat base values (1000/1000/1000/1000/0/2211/15922/38%/150%/0%/0%/0%), and after
          equipping full Ascended gear + runes + sigils + infusions + relic + food + utility on
          the same character the totals rose to Power 2947, Precision 1960 (83.71% crit),
          Ferocity 1255 (233.67% crit damage), Armor 2271, Magic Find 20%, etc. — confirms the
          panel is a live recompute of everything equipped, not a static per-slot display.
          **Re-confirmed with a second, independently-sourced before/after pair (2026-07-29,
          Revenant)**: empty build again showed the same flat base values; after gearing (weapon +
          full armor/accessories, no consumables yet in this particular pair) the same two-column
          layout showed Power 3187, Precision 1960 (50.71% crit), Ferocity 1255 (233.67% crit
          damage), Armor 2271, Magic Find 20% — consistent shape and behavior across two different
          professions/gear sets, scope considered closed (design confirmed, not yet implemented).
          Also newly spotted in these screenshots, **not part of this item's scope**: gw2skills.net
          shows each of the 3 trait lines as a condensed one-row summary (spec icon + a compact
          grid of the chosen minor/major trait icons) with a "▶" expand control, rather than an
          always-expanded per-tier grid like this app's current `TraitsEditor` — worth considering
          for a future polish pass on the traits UI, but out of scope for the stats-panel item.
          Two small unlabeled counters were also visible near the trait area (possibly Mastery/WvW
          rank points) — purpose unclear from the screenshot alone, not investigated further.
    - [ ] Bottom "Conditions / Boons / Control / Auras / Miscellaneous / Combo" icon bar (already
          partially built as `BoonUptimePanel`, boons+conditions only): full screenshots show this
          bar in-game actually also covers Control (e.g. Daze), Auras, Miscellaneous (e.g.
          Healing, Execute), and Combo-field/finisher icons, with icons highlighted/colored when
          the current build can produce them and greyed out otherwise. Worth treating as the
          longer-term target shape for `BoonUptimePanel` to grow into (not required for this
          item's first pass, which is the stats panel — just noted so the two features converge
          intentionally rather than by accident).
    - [ ] Interesting but explicitly out of scope for this item (noted for later, not requested):
          screenshot showed a per-skill "Healing" tooltip breakdown (hovering the Healing stat
          lists each heal skill on the bar with its computed heal amount at current Healing Power,
          e.g. "[6] Breakrazor's Bastion - 4,655; 416; 2,081") — a nice stretch goal once base
          Healing Power total is correct, not needed for v1 of the stats panel.
    - [x] The weapon-*type* picker screenshot gap is now closed — captured 2026-07-29 as part of
          the weapon-selection reference set; see the weapon-selection item above for details.
    - [ ] Minor, non-blocking, still genuinely unresolved: an earlier survey guessed the itemstat-
          combo picker might have two filter tabs (pink vs. grey armor-shaped icon) for an
          Ascended-vs-Exotic availability filter. Asked again 2026-07-29 — user has no screenshot
          of this and wasn't sure what was meant, so **treat the original observation as
          unconfirmed/possibly mistaken**, not a real gap. `EquipmentEditor` doesn't have any such
          tabs today; leave as-is unless it resurfaces with a concrete example.
- [ ] Squad preview builder (drag-and-drop party grid; WvWSquadCrafter as UX reference only —
      no shared code/assets without explicit permission, no LICENSE on that repo)
- [ ] Thin backend: generate/resolve shareable immutable links for builds and squad comps
- [ ] Discord bot (client of the backend API)
- [ ] Capacitor port for iOS/Android (swap storage adapter + native bindings only)
- [ ] "Not affiliated with ArenaNet/NCSOFT" disclaimer if bundling official GW2 icon assets
- [ ] Automatic game-data refresh mechanism (balance patches) — manual refresh only for now
- [ ] Electron packaging/distribution config (electron-builder.yml is not set up yet — only
      `install-app-deps` postinstall is wired up for native module rebuilding)
