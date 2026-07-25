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
  - [ ] Gear scaling (boon duration/condition duration %) is NOT applied yet. The GW2 API's
        itemstats give each attribute a `multiplier`/`value` pair (e.g. `BoonDuration` — this is
        the API's name for Concentration; `ConditionDuration` is Expertise), but resolving that
        into an actual attribute point value requires knowing which attributes on a given combo
        count as "major" vs "minor" per rarity/slot, and the multiplier constants differ between
        2/3/4-stat combos in a way I wasn't able to verify confidently from the wiki this session
        (see `Attribute_combinations` on the wiki — it has final level-80 major/minor bonus
        tables per slot/rarity, but not the multiplier→major/minor mapping needed to apply them
        generically). Don't hand-wave this — get it right (verify against a known real build's
        computed % on gw2skills.net) before wiring it in, rather than shipping a number that
        looks precise but is quietly wrong.
  - [ ] Needs food/utility consumable data + selection UI — not yet fetched (GW2 API `/v2/items`
        is much larger than the endpoints currently pulled; scope that fetch when this starts)
        and not yet modeled on `Build`.
  - [ ] IMPORTANT: use WvW-specific balance numbers, not PvE. Verified this session: the public
        API does NOT reliably split them — confirmed via GW2 forum posts (e.g. Restoring
        Reprieve applies Protection+Resolution in PvE but Aegis in PvP/WvW, and `/v2/skills`
        returns all three facts with no indication of which mode each applies in) and the wiki's
        own `game_mode`/`split` template fields, which exist for human-maintained wiki articles,
        not as something exposed back through the API. So: the current parser surfaces whatever
        facts the API returns (frequently PvE-biased or ambiguous), and the UI now says so
        explicitly. Fixing this for real means a hand-maintained override table (skill/trait id →
        WvW-specific fact values, sourced from the wiki) for the specific skills/traits the
        target party comp actually uses — feasible because that's a small, bounded set, not all
        4700+ skills.
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
