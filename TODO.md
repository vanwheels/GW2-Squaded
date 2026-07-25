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
  - [ ] Gear scaling (boon duration/condition duration %) is NOT applied yet, but the formula is
        now verified and unblocked (confirmed against the wiki's own `API:2/itemstats`
        documentation page this session, quoted directly, not reconstructed from memory):
        `attribute_adjustment * multiplier + value` = attribute points, where `attribute_adjustment`
        is a level/rarity/slot-type constant from a reference table on that same wiki page (NOT
        something that needs a major/minor categorization per combo — that was last session's
        wrong mental model, based on reading the *pre-computed final totals* table instead of the
        general formula). Still open before this can be wired in: `data/game-data/itemstats.json`
        has 43 stat-combo names with multiple ids each (different `multiplier`/`value` pairs —
        legacy pre-revamp combos, trinket-only variants, modern armor/weapon combos all sharing a
        display name); which id is "correct" per equipment slot type is genuinely NOT documented
        on the wiki (only an unverified talk-page comment exists) — see the dedup heuristic added
        to `EquipmentEditor.tsx` this session for the *display*-only workaround, which picks a
        defensible single id per name but doesn't resolve the slot-correctness question needed
        for real math. Next step: implement the formula with the reference-table constants, and
        empirically verify the itemstat-id selection against a known build's real computed % on
        gw2skills.net before trusting it.
  - [ ] Needs food/utility consumable data + selection UI — not yet fetched (GW2 API `/v2/items`
        is much larger than the endpoints currently pulled; scope that fetch when this starts)
        and not yet modeled on `Build`.
  - [ ] IMPORTANT: use WvW-specific balance numbers, not PvE. Confirmed unextractable via the raw
        API (see prior note), but confirmed EXTRACTABLE from the wiki this session (verified via
        real fetches, not assumed): the wiki's per-fact `{{skill fact|...|game mode=pve/wvw pvp}}`
        template markup is present in raw wikitext (e.g. `Restoring_Reprieve`'s Protection+
        Resolution=pve vs Aegis=wvw pvp split, matching the known in-game behavior exactly), and
        `Category:Split_skills` (1,664 pages) / `Category:Split_traits` (545 pages) are real,
        maintained lists of which skills/traits actually have a split. There's no bulk structured
        query for this (no Cargo extension on the wiki; Semantic MediaWiki is installed but
        doesn't index the `game mode=` fact parameter as a queryable property — confirmed via a
        live `Special:Ask` query returning no results), so it's per-page wikitext fetch + regex/
        parse of the `game mode=` fact params, not a single global scrape. Feasible and scriptable
        for the ~15-20 skills/traits the target party comp actually uses (see below) — same
        pattern as `scripts/fetch-elite-spec-skills.ts` added this session (wiki API +
        User-Agent override), just parsing `action=raw` wikitext instead of category members.
        Not yet built.
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
- [ ] Once at MVP: swap panel/list text over to icon + name instead of plain text. `Skill`/
      `Trait`/`ItemStat` all already carry an `icon` URL from the GW2 API, so skill/trait/
      itemstat pickers and the boon-uptime source list can render those directly; boon/condition
      names themselves (`BOON_NAMES`/`CONDITION_NAMES` in `src/shared/boon-calc/constants.ts`)
      have no icon field on them today — would need a small hand-maintained name→icon-URL map
      (12 boons + 14 conditions, a bounded fetch from the wiki or `/v2/... ` if a matching
      endpoint exists) alongside the record-driven ones. Deliberately deferred past this session
      per explicit user direction ("once we get to MVP") — not started.
- [ ] Squad preview builder (drag-and-drop party grid; WvWSquadCrafter as UX reference only —
      no shared code/assets without explicit permission, no LICENSE on that repo)
- [ ] Thin backend: generate/resolve shareable immutable links for builds and squad comps
- [ ] Discord bot (client of the backend API)
- [ ] Capacitor port for iOS/Android (swap storage adapter + native bindings only)
- [ ] "Not affiliated with ArenaNet/NCSOFT" disclaimer if bundling official GW2 icon assets
- [ ] Automatic game-data refresh mechanism (balance patches) — manual refresh only for now
- [ ] Electron packaging/distribution config (electron-builder.yml is not set up yet — only
      `install-app-deps` postinstall is wired up for native module rebuilding)
