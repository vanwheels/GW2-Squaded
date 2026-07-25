# TODO

## Next up

- [ ] Theoretical boon/condition uptime calculator. Confirmed scope: for a single build (like
      gw2skills.net), list every boon/condition source (skill or trait) it provides, with
      duration computed from base values scaled by boon duration/concentration and food/utility
      consumables. Squad-view mode (later) shows all 5 party members' sources per boon side by
      side, with a stretch goal of an estimated combined/ideal uptime. Applies equally to
      condition output (not just boons).
  - [ ] Needs a real parser for the GW2 API's `Fact`/`traitedFacts` polymorphic objects
        (currently `unknown[]` in `src/shared/types/game-data.ts`) to get real boon
        durations/ICDs/trigger conditions — confirmed approach is to parse the actual API data,
        not hand-write a rules table.
  - [ ] Needs food/utility consumable data + selection UI — not yet fetched (GW2 API `/v2/items`
        is much larger than the endpoints currently pulled; scope that fetch when this starts)
        and not yet modeled on `Build`.
  - [ ] IMPORTANT: use WvW-specific balance numbers, not PvE — skill/trait facts can differ
        materially by game mode and the public API's split-balance representation needs
        verifying before trusting any single number pulled from it.
  - [ ] Target party comp for first pass (per current WvW meta, confirm before assuming stale):
        Luminary (Guardian elite spec — stability/defensive boons), Troubadour (Mesmer elite
        spec — defensive boons + healing), Druid (Ranger — healer), plus 2 DPS (e.g. Reaper,
        Spellbreaker). Elite spec roster has grown since original scaffolding — re-check
        `data/game-data/specializations.json` rather than assuming a remembered list is current.
- [ ] Squad preview builder (drag-and-drop party grid; WvWSquadCrafter as UX reference only —
      no shared code/assets without explicit permission, no LICENSE on that repo)
- [ ] Thin backend: generate/resolve shareable immutable links for builds and squad comps
- [ ] Discord bot (client of the backend API)
- [ ] Capacitor port for iOS/Android (swap storage adapter + native bindings only)
- [ ] "Not affiliated with ArenaNet/NCSOFT" disclaimer if bundling official GW2 icon assets
- [ ] Automatic game-data refresh mechanism (balance patches) — manual refresh only for now
- [ ] Electron packaging/distribution config (electron-builder.yml is not set up yet — only
      `install-app-deps` postinstall is wired up for native module rebuilding)
