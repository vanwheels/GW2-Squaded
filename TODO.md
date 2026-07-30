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
  - [x] Revenant-specific: available skills depend on which specialization is selected (legend
        pool), AND Revenant equips 2 legends at once, effectively giving 2 separate skill bars.
        Need to display one bar at a time with a toggle button to switch between them, and clearly
        indicate which legend/bar is currently "active" (matches in-game skill-bar swap UX).
        Landed 2026-07-29: new `Legend` game-data type (`src/shared/types/game-data.ts`), fetched
        from `/v2/legends` in `scripts/fetch-game-data.ts` (`name`/`icon` borrowed from the
        legend's `swap` skill since the endpoint has neither; `specializationId` — null for the 4
        core legends, else the gating elite spec — from a small hand-verified constant table,
        since the API exposes no legend↔elite-spec link at all; see docs/game-data.md for the
        full verification method). `SkillSelection` (`src/shared/types/build.ts`) is now a
        discriminated union: `StandardSkillSelection` (unchanged shape, every non-Revenant
        profession) vs `RevenantSkillSelection` (`{ legends: [string|null, string|null],
        activeLegendIndex }`). `SkillsEditor.tsx` now dispatches on `value.kind`: Revenant gets a
        dedicated editor with 2 legend-picker slots (gated by equipped specializations, can't pick
        the same legend twice) plus a toggle row that switches which equipped legend's *fixed*
        (read-only, not player-chosen) heal/3-utility/elite bar is displayed, each skill still
        showing its boon/condition tooltip via the existing `boonConditionFactsForSkill`.
        `sources.ts`'s `computeBoonConditionSources` gained `skillIdsForBuild` to resolve a
        Revenant build's boon/condition sources from both equipped legends' full kits
        (swap+heal+utilities+elite) instead of a single heal/utility/elite triplet.
        `BuildEditorView`'s profession-change and specialization-change handlers updated to
        build/gate the correct skills shape per kind (dropping the Herald line now clears a
        Legendary Dragon Stance pick, same pattern elite-spec-gated skills already had for other
        professions). Verified via `npm run typecheck` + `npm run lint` (both clean) and a live
        `npm run fetch-game-data` run (8/8 legends matched the verification table, no
        "unrecognized legend" warnings); not visually confirmed in a running window (see
        COMPLETED.md for the standing Electron-sandbox launch limitation) — recommend
        `npm run dev` locally to eyeball the new Revenant editor.
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
        digested below, so nothing was lost. **Resumed 2026-07-29 (2nd pass)**: every sub-item below
        except the sigil/infusion pickers (absorbed into the stats-panel item further down, see
        below) and the multi-variant-skill collapsing UX (separate item, see below) is now
        implemented — `EquipmentSlot` gained `weaponType`, `EquipmentSlotKey` gained `weaponU1`/
        `weaponU2`, `Build` gained `environment`/`activeWeaponSet`/`activeUnderwaterSet`, and a new
        `src/shared/weapon-calc/weapon-skills.ts` resolves a weapon type's 5-slot skill bar per
        environment. `npm run typecheck` and `npm run lint` both clean; not visually confirmed in a
        running window (standing Electron-sandbox limitation, see COMPLETED.md) — recommend
        `npm run dev` locally to eyeball the new weapon pickers.
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
    - [x] Choosing a weapon *type* (sword/axe/bow/etc.) is its own picker, separate from the
          existing stat-combo/sigil/infusion pickers on the equipped-weapon icon — a horizontal
          row of weapon-type icons scoped to what the current profession can use. Confirmed via
          screenshot: this row appears inline in the `WEAPON I` header area once a profession is
          selected (**profession must be chosen first** — the picker has nothing to show before
          that, since availability is per-profession). **Implemented 2026-07-29**:
          `EquipmentEditor.tsx`'s `weaponTypeRow` renders a `.profession-picker-row` of
          `.spec-icon-button.weapon-type-button` icon buttons (same visual pattern as
          `EliteSpecSelect`, square not circular), gated by `profession.weapons` filtered to
          `specializationId === null || equippedSpecializationIds.has(...)`, icon sourced from the
          weapon type's first granted skill (`ProfessionWeapon` itself carries no icon field).
    - [x] Off-hand (2nd slot) picker shows a different, filtered list than main-hand — confirmed
          via screenshot (Revenant, main-hand Mace picked → off-hand picker offered only Axe /
          Sword / Shield). Real GW2 hand-restriction, now directly modeled by the `ProfessionWeapon`
          data above (see foundational-data item) — implement by filtering on `flags`, not by
          fetching anything new. **Implemented 2026-07-29**: main-hand picker filters on
          `flags.includes('Mainhand') || flags.includes('TwoHand')`, off-hand on
          `flags.includes('Offhand')`, underwater on `flags.includes('Aquatic')`.
    - [x] A 2-handed weapon occupies both the main- and off-hand slot as a single entry (matches
          in-game); a 1-handed weapon leaves the other slot independently choosable. Re-asked about
          the yellow/orange 1-handed tint this session — user doesn't have it confirmed either way
          and said the color doesn't matter as long as main/off-hand and per-profession
          availability are modeled correctly. **Drop the tint as a requirement**; treat as optional
          visual polish only if it comes up again later. **Implemented 2026-07-29**:
          `EquipmentEditor.tsx`'s `renderWeaponPair` mirrors `weaponType`+`itemStatId` onto the
          off-hand slot key when the chosen main-hand weapon's `flags` include `TwoHand`, and
          renders the off-hand slot as a disabled "(2-handed)" placeholder instead of its own
          picker; switching back to 1-handed (or clearing) resets the off-hand slot to empty rather
          than leaving stale mirrored data. `attribute-totals.ts` relies on this mirroring: crediting
          the one-handed constant to each of the two mirrored slots sums to the correct two-handed
          total for free, since `weaponOneHanded.ascended * 2 === weaponTwoHanded.ascended` exactly
          per the wiki's own constants — no special-casing needed, see that file's updated comment.
    - [x] Underwater uses its own weapon bar with its own swap toggle, separate from the land
          Weapon I/II swap — confirmed via screenshot: `WEAPON I` / `WEAPON II` / `UNDERWATER` are
          3 always-visible sections in the top bar (not tabs that hide each other), each with its
          own independent swap-set toggle. A Revenant example screenshot showed Mace/Axe (land) +
          Trident (underwater) all populated simultaneously. **Implemented 2026-07-29**: confirmed
          via a live check of every profession's aquatic weapons (`Spear`/`Trident`/`Speargun`) that
          all carry `TwoHand` — underwater is always a single logical slot per swap set, never a
          main/off pair — so `EquipmentSlotKey` gained `weaponU1`/`weaponU2` (not a hand-paired
          4-key set) and `EquipmentEditor.tsx` renders a 3rd always-visible "Underwater" section
          alongside "Weapon I"/"Weapon II".
    - [x] Each weapon slot (once a type is chosen) still has its own sigil (×1–2) and infusion
          (×2) pickers layered on top — confirmed via the equipment-panel screenshots this session
          too (every weapon row shows the item icon plus 2 upgrade-slot badges beside it); the
          weapon-type picker is an additional *new* picker, not a replacement for those. Landed as
          part of the stats-panel item's session 15 picker-UI pass (see below) —
          `EquipmentEditor.tsx`'s `sigilRow`/`infusionRow` are wired into every weapon slot
          (`renderWeaponPair` for main/off-hand, plus the underwater slot), gated by
          per-item-not-per-slot capacity (2-handed = 2 slots on that one item, 1-handed = 1 each).
          TODO line left unchecked in a prior pass by mistake — confirmed done by reading
          `EquipmentEditor.tsx` directly, not re-implemented.
    - [x] Need a land/underwater toggle that scopes both the skill bar and the boon/condition
          calculator — confirmed via screenshot: a separate `ENVIRONMENT` control (tree icon =
          land / wave icon = underwater, active one underlined orange) is what actually switches
          which skill bar (slots 1-5, the weapon skills) and which stats/boon totals are shown —
          distinct from the underwater weapon-swap-set's own internal toggle noted above. Confirmed
          behavior across 2 screenshots of the same build: toggling `ENVIRONMENT` from land to
          water swapped the rendered weapon-skill icons in slots 1-5 from the land set to the
          underwater set, with the rest of the build (traits, other skills, stats) unchanged.
          **Implemented 2026-07-29**, including resolving the land/underwater skill-id split this
          entry left as "presumably order-distinguished": re-fetched `/v2/skills` with a new
          `Skill.flags` field (`scripts/fetch-game-data.ts`) and confirmed the real disambiguator is
          each skill's own flags, not array order — the GW2 API tags a duplicate slot's land variant
          with `"NoUnderwater"` (verified against Guardian `Spear`'s 10 entries: ids
          `73015`/`72972`/... carry `NoUnderwater` and are the land skills; `28714`/`28915`/... don't
          and are the underwater skills). `src/shared/weapon-calc/weapon-skills.ts`'s
          `resolveWeaponSkillIds` implements this rule; `Build.environment` (new field) plus a new
          `WeaponSkillBar.tsx` (rendered by `SkillsEditor.tsx` for every profession) provide the
          actual Land/Underwater toggle plus a display-only active-set toggle (mirrors
          `RevenantSkillSelection.activeLegendIndex`'s "both sets always contribute" reasoning —
          `sources.ts`'s boon/condition calc now includes both land sets, or both underwater sets,
          per `build.environment`, regardless of which one is currently displayed).
    - [ ] **New, discovered this session**: some weapon types have duplicate skill-slot entries for
          reasons other than land/underwater that this app doesn't disambiguate — e.g. Revenant
          `Sword` has 6 entries (main/off-hand context split, unconfirmed which), and every
          Elementalist weapon has up to 26 (per-attunement variants). `resolveWeaponSkillIds` falls
          back to the first matching entry for these cases (documented in its own doc comment,
          fail-safe not a silent guess) rather than attempting full auto-chain/hand-context/
          attunement modeling, which is out of scope for this pass — revisit if Elementalist weapon
          skill accuracy or off-hand-Sword accuracy turns out to matter for a real build.
  - [x] Minor traits: original complaint was "no hover tooltip at all," but survey finding showed
        minor traits actually already carried a native `title=` same as majors — so there was no
        missing-wiring bug here specifically. Wired into the new `Tooltip` component along with
        majors as part of the tooltip-infra item above (not a separate fix, as predicted).
  - [x] Skills with multiple trait-dependent or (Revenant) legend-dependent variants currently
        show up as separate duplicate entries in the skill picker — should collapse to a single
        entry. User confirmed (2026-07-25) the cycling UX: small in-tooltip prev/next arrows or
        numbered tabs (1/2/3) to step through variants — not hover-auto-cycle, not a dropdown.
        **Session 18 (2026-07-29): implemented, and the confirmed cycling UX turned out not to be
        needed for any of the 117 duplicate-name groups found in Session 17's scoping pass** — every
        group that's cleanly resolvable turned out to resolve via automatic selection (current
        attunement, equipped spec, or "functionally identical either way"), not a manual pick, so
        there's nothing for a user to cycle through. 3 real, API-native (not guessed) signals,
        captured live by re-fetching `/v2/skills` with 2 new fields on `Skill`
        (`attunement`/`specializationId`) plus the already-captured `GroundTargeted` flag:
        `attunement` (8 groups — e.g. Elementalist "Glyph of Lesser Elementals" ×5: the 4
        attunement-tagged ids aren't independently equippable at all, only the attunement-agnostic
        base id is a real pick), `specializationId` (45 groups — e.g. Guardian "Renewed Focus" ×2:
        `68666` auto-replaces base id `9154` whenever Dragonhunter is equipped, zero user choice),
        and the `GroundTargeted` flag (~54 groups — e.g. "Lightning Flash" ×2, every Necromancer
        Well, every Warrior Banner: GW2's client-side ground-target-vs-auto-target casting toggle,
        functionally identical effect either way). New `src/shared/skill-calc/skill-variants.ts`
        (`visibleSkillsForSlot`) applies all 3 in order, wired into `skillsForProfessionAndSlot`
        (`game-data-store.tsx`) — every picker gets the collapsed list for free, no UI changes
        needed since dedup happens before the picker sees the candidate list. See
        docs/game-data.md for the full signal writeup. **~47 groups remain genuinely ambiguous**
        (re-counted per-profession after collapsing) — no `attunement`/`specialization`/
        `GroundTargeted` signal distinguishes their members (e.g. Engineer "Deploy Mine": `6163`
        "deploy a mine" vs `30893` "deploy two mines", almost certainly a trait rework with no
        `specialization` id set; Ranger "Spike Trap" differs in stun-vs-launch). Left un-collapsed,
        shown as-is (fail-safe, not guessed) — would need a per-skill wiki cross-check to resolve,
        same shape of effort as `fetch-wvw-splits.ts`, not attempted this session. Full list of the
        ~47 remaining group names is in the verification output referenced in COMPLETED.md.
        Verified via a standalone script (not committed) against 7 hand-picked cases spanning all 3
        signals plus one deliberately-ambiguous case (Deploy Mine, confirmed left un-collapsed) —
        all passed. `npm run typecheck`/`lint`/`build` all clean; not visually confirmed in a
        running window (standing Electron-sandbox limitation, see COMPLETED.md) — recommend
        `npm run dev` locally to eyeball the now-shorter picker lists. **Update, Session 19**: a 4th
        signal (`flip_skill`, see the multi-step-skills item directly below) resolved 24 of these
        47 down to 1 id each — 23 remain genuinely ambiguous (Deploy Mine among them, still
        unresolved as predicted). Current full list: Engineer "Grenade Kit"/"Slick Shoes"/
        "Automatic Fire"/"Rocket Boots"/"Rocket Turret"/"Detonate Rocket Turret"/"Throw Mine"/
        "Deploy Mine"/"Elixir X"/"Detonate Supply Crate Turrets"/"Overcharge Supply Crate", Ranger
        "Glyph of Rejuvenation"/"Spike Trap"/"Glyph of the Tides"/"Glyph of Alignment"/"Glyph of
        Equality"/"Glyph of Burgeoning"/"Glyph of the Stars", Elementalist "Rejuvenate"/"Mist
        Form", Mesmer "Mirage Advance", Revenant "Protective Solace"/"Jade Winds".
  - [x] Same collapsing behavior, same arrows/tabs cycling UX, needed for multi-step skills
        (distinct effects on 1st click vs. 2nd click, etc.) — one entry, not duplicate list
        entries. **Implemented Session 19 (2026-07-29)**: live-verified `/v2/skills`' `flip_skill`
        field (the id a skill becomes after activation — e.g. "Med Kit" flips to "Stow Med Kit",
        "Healing Turret" flips to "Detonate Healing Turret", a Thief Elite chains 3 ids deep) and
        found it resolves this cleanly with no cycling UX needed — same "turned out to be
        automatic, nothing to cycle through" shape as Session 18's other 3 signals. New
        `Skill.flipSkill` field; `skill-variants.ts` gained a global `stripFlipTargets` pre-pass
        (removes a different-named flip target from the whole candidate pool before per-name
        grouping — these 84 pairs, e.g. every Engineer kit/turret, Mesmer mantra, Ranger spirit,
        Revenant facet, never landed in the same name-group to begin with) plus a 4th per-group
        "flip-root" signal for same-name flip pairs (e.g. Guardian Spirit Weapons) Session 18
        explicitly flagged as unresolved. Net effect: 84 previously wrongly-offered flip-target
        skills now correctly hidden, and the ~47 ambiguous same-name groups Session 18 left open
        drops to 23. See COMPLETED.md for the full writeup, including why Session 18's initial
        "drop `flip_skill`, unneeded" conclusion turned out to be incomplete.
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
        **Session 2026-07-29 (3rd pass): landed the data layer only** (runes/sigils/infusions/
        relics/food/utility fetch + normalized types + game-data-store wiring — see per-sub-item
        notes below and COMPLETED.md), deliberately not the picker UI or stats-calc math, same
        "data layer first" split as the weapon-selection item's Session 11/13 pattern. New
        `scripts/fetch-gear-upgrades.ts` (`npm run fetch-gear-upgrades`) — see docs/game-data.md
        for the full endpoint/gotcha writeup; two real API-shape assumptions from the 2026-07-25
        scoping session turned out wrong once fetched live (infusions' `details.type`, relics'
        `Fact` system) and are corrected in place below rather than left stale.
        **Session 15 (2026-07-29, picker UI pass): landed the picker UI** for every category —
        `Build`/`EquipmentSlot` gained `runeId`/`sigilIds`/`infusionIds` (per-slot) and
        `relicId`/`foodId`/`utilityId` (build-level); a new shared `UpgradePicker` component
        (icon+name+search grid, reused across all 6 categories) wired into `EquipmentEditor`
        (rune badge on the 6 armor slots, sigil+infusion badges on weapon slots, infusion badges
        on every armor/trinket slot, all per the confirmed per-slot capacity table) and a new
        `ConsumablesEditor` (relic/food/utility, build-level). Infusions were also wired into
        `attribute-totals.ts`'s existing `AttributeTotals` — trivial since infusion attribute
        names match `ItemStat` attribute names verbatim (confirmed live), so an equipped
        Concentration/Expertise WvW infusion now correctly feeds the boon/condition duration %
        calc. **Deliberately NOT done this session** (see the "full character-stats panel" item
        below, still open): merging rune/food/utility attribute-bonus text into `AttributeTotals`
        (blocked on a free-text-to-`ItemStat`-attribute-name mapping table, e.g. rune text
        "Ferocity" vs. itemstat key `CritDamage`, plus rune's per-equipped-count stage math) and
        the crit%/armor/health derived-stat formulas — those need their own wiki-verification
        pass, scoped as their own session same as gear-scaling was. Verified via
        `npm run typecheck`, `npm run lint`, `npm run build`, all clean; not visually confirmed
        (standing Electron-sandbox limitation, see COMPLETED.md) — recommend `npm run dev`
        locally to eyeball the new rune/sigil/infusion/relic/food/utility pickers.
        **Session 16 (2026-07-29, stats-calc math + panel pass): landed the piece Session 15 left
        open** — merging rune/food/utility attribute-bonus text into `AttributeTotals`, the
        crit%/armor/health/Magic Find derived-stat formulas (wiki-verified, not guessed), and the
        actual `StatsPanel` UI (previously only designed, never built). See COMPLETED.md for the
        full writeup and the wiki sources for every formula; short version: `AttributeTotals` is
        now `{points, bonusPercent}` (points = the 9 core attributes; bonusPercent = rune/food/
        utility bonuses already expressed as a direct % — e.g. "+5% Boon Duration" — which add on
        top of the points-derived % rather than being reconverted). Rune bonuses are gated by
        same-rune-id count across the 6 armor slots (stage 1..count active, not the top stage
        alone). A free-text-attribute-name mapping table handles the ~9 core-attribute aliases
        (including case variants and "+N to All Stats"/"to All Attributes" distributing across all
        9); everything else (Karma, Gold from Monsters, per-faction damage, "on Kill" procs,
        seasonal Magic Find, per-condition durations like "Burning Duration") is intentionally left
        unmapped — out of the stats panel's confirmed scope, stays display-only. New
        `src/shared/gear-calc/derived-stats.ts` computes the actual character stats (base +
        gear/rune/food/utility) and the 7 derived values shown in `StatsPanel.tsx`, wired into
        `BuildEditorView`'s 3rd column above `BoonUptimePanel`. Verified via a standalone `tsx`
        script (not committed) with 3 hand-calculated scenarios — empty build, a fully-geared
        build (Diviner's armor+weapon, Superior Rune of the Scholar ×6, a food item, a
        Concentration infusion), and a partial-rune-stage-gating case (Superior Rune of the
        Traveler ×4, exercising "to All Stats" + percent Boon Duration bonuses + a Magic Find
        utility) — every computed value matched hand math to full float precision. `npm run
        typecheck`/`lint`/`build` all clean; not visually confirmed in a running window (standing
        Electron-sandbox limitation, see COMPLETED.md) — recommend `npm run dev` locally to
        eyeball the new Stats panel. Still open, tracked below: relic numeric effects (no data from
        the public API, needs a ~211-page wiki cross-check), item-rarity color coding, and the
        bottom Conditions/Boons/Control/Auras/Misc/Combo icon bar (separate items, unchanged by
        this session).
    - [x] **Item-rarity color coding, and an important scope nuance**: user identified the app's
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
          **Implemented 2026-07-29**: since this app has no real per-item icons for armor/weapon/
          trinket slots at all (those slots store a stat *combo*, not a concrete item — see
          `SlotIcon.tsx`'s doc comment; the picker is a `<select>` of stat names, not an icon
          grid), the border goes on the visible slot chrome instead of an item icon: `.gear-slot-
          icon` (the placeholder glyph box) and the stat-combo `<select>` itself, both turning
          `--rarity-ascended` (pink/magenta, `#fb3e8d`) once `itemStatId` is set, across all 4
          render paths that pick a stat combo (`renderSlot` for armor/trinkets, both hands of
          `renderWeaponPair`, `renderUnderwaterSlot`). Relic and infusion pickers (both already
          `UpgradePicker`-based, unlike the raw-`<select>` armor/weapon slots) gained a new
          `rarity?: 'ascended' | 'fine'` prop — `--rarity-fine` (blue, `#62a4da`) wired into the
          relic slot (`ConsumablesEditor`) and every infusion badge (`EquipmentEditor`'s
          `infusionRow`). Runes/sigils/food/utility intentionally left without a `rarity` prop —
          no single confirmed rarity per the bullets above. New CSS custom properties `--rarity-
          ascended`/`--rarity-fine` added to `:root` in `global.css`, sourced from GW2's own
          well-known rarity colors (not guessed). `npm run typecheck`/`lint`/`build` all clean;
          not visually confirmed in a running window (standing Electron-sandbox limitation, see
          COMPLETED.md) — recommend `npm run dev` locally to eyeball the new borders.
    - [x] **Runes/sigils: only the top ("Superior") tier matters** — user explicitly said lower
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
          **Data layer landed 2026-07-29** (picker UI landed the same day in session 15):
          `scripts/fetch-gear-upgrades.ts` fetches
          198 Superior runes + 162 Superior sigils from `/v2/items` (new `Rune`/`Sigil` types in
          `src/shared/types/game-data.ts`). Confirmed live against Superior Rune of the Scholar:
          `details.bonuses` is exactly the literal 6-entry list predicted above
          (`+25 Power/+35 Ferocity/+50 Power/+65 Ferocity/+100 Power/+125 Ferocity`), parsed into
          structured `{attribute, value, isPercent}` per stage by
          `parseAttributeBonusText`(shared with food/utility parsing below) — falls back to
          `raw`-only for non-numeric proc text rather than guessing. Sigil effect text
          (`details.infix_upgrade.buff.description`) confirmed matching the Force example
          ("+5% Damage"). **Stats-calc wiring landed 2026-07-29 (session 16)**: same-rune-id count
          across the 6 armor slots gates which stages are active (`addRuneBonuses` in
          `attribute-totals.ts`), and free-text attribute names (e.g. "Ferocity", "Concentration")
          map to their `ItemStat` key via a small alias table — see the session-level note above.
          Sigils remain proc/effect text only (no flat attribute to feed the stats calc, confirmed
          via the Force example above), so they don't participate in `AttributeTotals` — not a gap,
          just nothing to wire.
    - [x] **Infusions: only WvW-specific infusions matter** — user said ignore Agony infusions and
          other general infusion types; only fetch/support ones like "Concentration WvW Infusion",
          "Expertise WvW Infusion", "Healing WvW Infusion". **Confirmed via a fresh screenshot**
          (Mighty WvW Infusion: "+5 Power" flat stat plus "+1% Damage to Guards/Lords/Supervisors"
          WvW-flavored secondary effect) — matches the originally-assumed shape exactly.
          **Per-slot infusion counts, confirmed 2026-07-29** (an earlier read of the equipment-panel
          screenshots mistakenly flattened this to "2 per weapon, 1 per trinket" — user corrected
          it, twice, to the following exact counts): a **2-handed weapon has 2 infusion slots on
          that single item; each 1-handed weapon has 1** (so a main+off 1-handed pair still totals
          2 across the set, same total as one 2-handed weapon — it's per-item, not a flat "2 per
          weapon slot" rule). **Rings have 3 infusion slots each; the backpiece has 2; every other
          armor piece (helm/shoulders/chest/gloves/leggings/boots) has 1 each; accessory1/
          accessory2 have 1 each; the amulet has 0.** All confirmed by the user directly, no wiki
          cross-check needed.
          **Data layer landed 2026-07-29**: `scripts/fetch-gear-upgrades.ts` found exactly the 8
          core-attribute WvW infusions expected (Healing/Resilient/Vital/Malign/Mighty/Precise/
          Concentration/Expertise), each a flat +5 to one attribute via
          `details.infix_upgrade.attributes[0]` (new `Infusion` type). **Real gotcha hit and
          documented in docs/game-data.md**: infusions do NOT have `details.type === 'Infusion'`
          as originally assumed — that field is `'Default'` for every infusion, WvW and Agony
          alike (verified against a live Agony infusion too); `details.infusion_upgrade_flags`
          containing `'Infusion'` is the real infusion-slot marker, and there's no API field at
          all distinguishing WvW from Agony infusions — the `"... WvW Infusion"` name suffix is
          the only reliable filter. **Picker UI + attribute-totals wiring landed 2026-07-29
          (session 15)**: per-slot infusion badges (using the exact counts above) in
          `EquipmentEditor`, and infusion values now feed `attribute-totals.ts`'s
          `AttributeTotals` directly (infusion attribute names matched `ItemStat` names verbatim,
          no mapping table needed) — so a Concentration/Expertise WvW infusion already affects the
          boon/condition duration % shown in `BoonUptimePanel`.
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
          **Data-layer finding 2026-07-29, overturns the "same Fact system" assumption above**:
          fetched all 211 relics from `/v2/items` (new `Relic` type) and confirmed live that
          relics carry NO `details` object at all via the public API — not a `Fact[]` array, not
          even the passive-modifier shape guessed above. `Relic of the Warrior`'s raw API response
          is just `{ description: "Weapon swap recharge time is reduced." }` — no "25%", no
          structured data whatsoever. So `extractFromFacts` doesn't need widening after all (it
          was never going to receive relic data in a `Fact` shape); what's actually missing is any
          numeric relic value at all. Getting exact modifiers would need a per-relic wiki
          cross-check (~211 pages, same shape of effort as `scripts/fetch-wvw-splits.ts`) — not
          done this session; `description` is stored as-is for display only. **Picker UI landed
          2026-07-29 (session 15)**: build-level relic picker in the new `ConsumablesEditor`
          (`Build.relicId`), description shown as plain text in the tooltip. Still open: whether
          the stats panel shows relic effects as inert descriptive text (cheap) or invests in the
          wiki cross-check (expensive) — a scoping question for whoever picks this back up.
    - [x] **Food and utility consumables: keep the full list selectable, don't pre-filter to a
          "WvW meta" subset** — user was explicit here despite there being a lot of options ("it's
          best to keep them all available"). Deferred fast-follow (not blocking first pass, but
          worth a placeholder TODO sub-item once this ships): add a "Favorites" marker so users
          can pin their preferred food/utility choices to the top of the selection list.
          **Data layer landed 2026-07-29**: fetched 859 Food + 246 Utility consumables (new
          `Consumable` type). **Real gotcha, documented in docs/game-data.md**: a consumable's
          buff is NOT a `Fact[]` array either — it's a flattened `details.{name, duration_ms,
          apply_count, description}` descriptor. Confirmed against Plate of Truffle Steak
          (`description: "+100 Power\n+70 Precision\n+10% Experience from Kills"`, parsed via the
          same `parseAttributeBonusText` used for runes) and a Nourishment/Enhancement-labeled
          example each. ~37% of Food entries (e.g. "Feast" reagents meant to be served to a group,
          not eaten directly) have no buff at all — `bonuses` is empty and `effectName`/
          `durationMs`/`applyCount` are `null` for those, by design, not a parse failure. **Picker
          UI landed 2026-07-29 (session 15)**: build-level food/utility pickers in the new
          `ConsumablesEditor` (`Build.foodId`/`utilityId`), full unfiltered catalogs, `UpgradePicker`
          grows a name-search box since both lists are large. **Stats-calc wiring landed 2026-07-29
          (session 16)**: `bonuses` now feed `AttributeTotals` the same way rune bonuses do (see the
          session-level note above) — a build's chosen food/utility affects the Stats panel and,
          for Concentration/Expertise/Magic-Find-bearing ones, the boon/condition duration % too.
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
          **Implemented 2026-07-29 (session 16)**, using formulas quoted directly from the wiki
          (Precision/Ferocity/Toughness/Health/Armor-class pages — see
          `src/shared/gear-calc/derived-stats.ts`) rather than reverse-engineered from these
          screenshots — the two independently-sourced before/after pairs above turned out to
          disagree with each other at the same Precision value (83.71% vs. 50.71% crit chance at
          Precision 1960), which the wiki-sourced formula (`5% + (Precision-1000)/21`) resolves
          exactly against the second, self-consistent pair (`5 + 960/21 = 50.71%`) — treated the
          first pair's number as an unreliable screenshot transcription rather than a real target
          to match, consistent with this project's "verify against the primary source" approach
          elsewhere (e.g. gear-scaling, WvW splits). New `StatsPanel.tsx` renders exactly this
          two-column layout, wired into `BuildEditorView`'s 3rd column above `BoonUptimePanel`.
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
