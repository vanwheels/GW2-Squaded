# Completed

Entries are added as work lands, most recent first.

## Session 10 — Elite specialization selector, unblocked by a trait-line data-model fix

Continuation of "Build editor UI/UX overhaul," picking up the item Session 9 explicitly left
blocked: a specialization selector beneath the profession picker that auto-swaps the 3rd trait
line.

- **Fixed the underlying data model first**: `Build.specializations` was a *compacted*
  `TraitLineSelection[]` — `TraitsEditor`'s `fromLines` dropped `null` entries before calling
  `onChange`, so "line 2" wasn't a stable array index (picking only the visually-2nd column's spec
  produced a 1-element array that silently became "line 0" on the next render). Replaced with a new
  `TraitLineSlots` type (`src/shared/types/build.ts`): a fixed-length 3-tuple,
  `[TraitLineSelection | null, TraitLineSelection | null, TraitLineSelection | null]`. `TraitsEditor`
  no longer compacts/decompacts at all (`toLines`/`fromLines` deleted — `value` *is* the slots array
  now). The two other consumers of `build.specializations` (`sources.ts`'s `activeTraitIds` and its
  trait-fact loop, `BuildEditorView`'s `equippedSpecializationIds`/`handleSpecializationsChange`)
  were already order-independent (they use `specializationId`, not array position) — updated only to
  filter/guard the new possible `null` entries, no behavioral changes needed there. No build-data
  migration required: no builds are checked into the repo, and the app-userData ones are dev-only so
  far.
- **New `EliteSpecSelect` component** (`src/renderer/components/build-editor/EliteSpecSelect.tsx`):
  icon-button row (reuses `.spec-icon-button`) listing the current profession's elite specs plus a
  "Core" option (new `.core-spec-button` pill style, since it has no icon), writing straight to
  `specializations[2]` — the elite line is always index 3/array-index-2 by GW2 convention, and that
  index is now stable thanks to the fix above. Wired into `BuildEditorView` beneath
  `ProfessionSelect`, reusing the existing `handleSpecializationsChange` handler so switching elite
  specs also clears any now-invalid elite-spec-gated skill picks (e.g. dropping Firebrand while
  "Resolute Stance" is equipped), exactly like changing specs any other way already did.
- **Known non-issue, documented in TODO.md**: `TraitsEditor`'s own per-line picker row for column 3
  still independently lets you choose any spec (elite or core) into that line, unchanged from
  before — it targets the same array slot as `EliteSpecSelect` so the two stay in sync rather than
  conflicting, just worth knowing about for a future stricter-parity pass.
- **Verified**: `npm run typecheck` and `npm run lint` both pass clean. Tried `npm run dev` again in
  this sandboxed shell in case the user's "resolved the npm run dev issue" note (mentioned at the
  start of this session) applied here too — it doesn't: same `electron.app.isPackaged` crash as
  Session 9, so this remains typecheck/lint/code-review-verified only, not visually confirmed.
  Recommend running `npm run dev` locally to eyeball it.

## Session 9 — Build editor UI/UX overhaul: instant tooltips, aligned trait grid, skill boon/condition tooltips

Resumed the TODO at its explicitly-flagged next priority ("Build editor UI/UX overhaul," not
started as of the 2026-07-25 scoping session). That item has ~15 sub-parts of very different
sizes; this session picked off the well-specified, low-ambiguity ones and deliberately deferred
the ones that needed either the reference screenshots (not saved to the repo) or a data-model
change discovered mid-session, rather than guessing.

- **New `Tooltip` component** (`src/renderer/components/common/Tooltip.tsx`): replaces every
  native `title=` attribute in the build editor, whose hover delay is OS/browser-controlled and
  can't be shortened via CSS/JS. Portals a `position: fixed` popup into `document.body` on
  `mouseenter`/`focus` (no delay) positioned from the trigger's `getBoundingClientRect()`, closes
  on `mouseleave`/`blur`. A `TooltipBody` helper renders the common "bold title + muted
  description" shape. Wired into every current hover target: `TraitsEditor` (spec icons, minor
  traits, major traits), `SkillsEditor` (skill-bar slots + picker-grid options), `ProfessionSelect`
  (profession icons).
- **`TraitsEditor` restructured to a CSS Grid** (`grid-template-columns: repeat(3, 1fr)`) instead
  of three independent `.trait-line` wrapper divs. Every line's spec-picker row, spec name, and
  each tier (1-3) render as separate grid children placed via explicit `gridColumn`/`gridRow`
  rather than being nested inside a per-column div — this closes both the "horizontal instead of
  vertical" layout ask and the "trait rows don't line up evenly across columns" ask in one change,
  since CSS Grid sizes each row track to its tallest cell across all 3 columns automatically.
- **Skill tooltips now show the skill's boon/condition output**, not just name/description.
  `sources.ts` gained `boonConditionFactsForSkill` (plus exporting the previously-private
  `activeTraitIds`) — a per-skill wrapper around the existing `extractFromFacts` internals, letting
  a skill's gated/WvW-scaled boon output be computed standalone, without it needing to already be
  equipped on the build (needed for the picker grid, not just the 5 equipped slots).
  `formatBoonDuration`/`formatBoonPercent` were factored out of `BoonUptimePanel` into
  `src/shared/boon-calc/format.ts` so both it and the new `SkillsEditor` tooltips format durations
  identically. Boons and conditions render in one undifferentiated list per skill, matching how the
  skill actually behaves in-game.
- **`ProfessionSelect` converted from a `<select>` to a row of icon buttons**, reusing the existing
  `.spec-icon-button` pattern already used for specialization icons.
- **Confirmed and closed** the already-resolved "equipment stats should use Ascended, not Exotic"
  item from the 2026-07-25 survey — code already did this (`attribute-totals.ts:55`), no change
  needed, just marking it off.
- **New finding, not fixed this session**: the "specialization selector beneath the profession
  selector, auto-swapping the 3rd trait line" item is blocked by a real data-model issue —
  `TraitsEditor`'s `TraitLineSelection[]` is a *compacted* array (`fromLines` drops nulls before
  calling `onChange`), so "the 3rd line" isn't a stable index today; a spec picked only in the
  visually-2nd column silently becomes "line 1" on the next render. A selector meant to specifically
  target "line 3" needs a non-compacting representation (fixed-length `[T|null,T|null,T|null]` or
  an explicit line-index field) before it can be built correctly — documented in TODO.md so the
  next session doesn't have to rediscover this.
- **Verification**: `npm run typecheck` and `npm run lint` both pass clean. Could not get a live
  screenshot in this sandboxed shell — `npm run dev` builds the main/preload/renderer bundles
  successfully (renderer dev server does come up at `localhost:5173`), but the spawned Electron
  process crashes on `electron.app.isPackaged` being undefined, which means it's being executed as
  plain Node rather than through the real Electron runtime. That crash happens during main-process
  bootstrap before any renderer code (including everything changed this session) ever loads, so
  it's an environment/launch issue in this sandbox, not a regression from these changes — but it
  does mean this session's UI changes are typecheck/lint-verified and code-reviewed, not
  visually confirmed in a running window. Recommend running `npm run dev` locally to eyeball it.

## Session 8 — WvW-vs-PvE fact splits for the boon/condition calculator

Continuation of "keep working through the TODO" — picked up the next flagged item, applying
WvW-specific (not PvE) balance numbers to the boon/condition uptime calculator. TODO.md had this
scoped narrowly to "the ~15-20 skills/traits the target party comp actually uses"; expanded scope
mid-session once it was clear the app lets you build any of the 9 professions, not just that one
comp — a narrower fix would've left every other profession's builds silently showing PvE numbers.

- **The problem, confirmed by direct API/wiki cross-check**: `/v2/skills` and `/v2/traits` Buff
  facts carry no `game mode` tag. For an unsplit skill the API's `duration` is simply the one true
  value; for a *split* skill/trait, the API's `duration` turns out to be the PvE-tagged wiki value
  when a PvE variant exists, or the sole tagged value otherwise. Worse, some skills' facts arrays
  mix PvE-only and WvW/PvP-only boons together with no way to tell which is which by looking at
  the API alone — e.g. `Restoring Reprieve` (Firebrand heal) lists Protection+Resolution (PvE
  only) right alongside Aegis (WvW/PvP only), so reading the API facts raw overstates what a WvW
  build actually gets.
- **New `scripts/fetch-wvw-splits.ts`** (`npm run fetch-wvw-splits`, after `fetch-game-data`),
  writing `data/game-data/wvw-fact-overrides.json`. Same shape of approach as
  `fetch-elite-spec-skills.ts` (wiki `action=query`/`action=raw`, User-Agent override, rate
  limiting) but sourcing a different thing:
  - Fetches `Category:Split skills` (1,664 pages) / `Category:Split traits` (545 pages) — real,
    maintained wiki lists of pages with *some* `game mode=` split on them.
  - Narrows to the ~1,110 pages that are BOTH in one of those categories AND correspond, by exact
    unambiguous name match, to a skill/trait with a boon/condition Buff fact already in
    `skills.json`/`traits.json` — the only ones the calculator reads. Page titles matching more
    than one skill/trait id (119 of them) are excluded outright and logged, same "don't guess"
    handling as the elite-spec-skills script.
  - Fetches each candidate page's raw wikitext and parses every `{{skill fact|...}}` /
    `{{trait fact|...}}` invocation whose first parameter is a boon/condition name: the boon name,
    its first bare numeric positional value (the duration — confirmed by inspecting real examples
    like `Empowering Might`'s `might|8|game mode=pve` vs `might|6|game mode=pvp wvw`, and
    `Elixir B`'s four boons each split the same way), and its `game mode=` parameter if present
    (values vary in wording — `wvw pvp`, `pvp wvw`, spacing around `=` — handled by
    whitespace-token matching rather than exact string equality).
  - Because naive `|`-splitting of wikitext can misparse a `[[Link|text]]` pipe embedded in a
    later field (e.g. a `desc=` param), every parsed PvE-tagged duration is cross-validated
    against the already-fetched API duration before being trusted — a mismatch is treated as a
    parse failure, not a real balance value, and skipped+logged (68/1110 pages hit this).
    Also skipped+logged, same fail-safe-not-guessed philosophy throughout: a boon/condition status
    appearing more than once in one id's Buff facts, since there's no way to tell which wikitext
    line maps to which fact (314/1110 — mostly multi-stack might/burning-style skills); more than
    one same-game-mode fact line for one boon on one page (26/1110); and a PvE/WvW mix where one
    variant is untagged (5/1110).
  - Net output: 187 skills + 99 traits got a real WvW override (`'omit'` for a PvE-only fact with
    no WvW variant, or a number to replace the API's default duration with the WvW-tagged one).
- **Wiring**: added `WvwFactOverride`/`WvwFactOverrides` to `src/shared/types/game-data.ts`,
  threaded through `load-game-data.ts` (main process) → IPC → `game-data-store.tsx` (same
  pass-through pattern as `eliteSpecSkills`, no IPC changes needed). `sources.ts`'s
  `extractFromFacts` now checks `gameData.wvwFactOverrides[kind][id][boonName]` for every Buff
  fact before scaling: `'omit'` drops the source entirely, a number substitutes for
  `fact.duration`. `BoonUptimePanel`'s caveat text now describes WvW-split coverage instead of the
  old "API doesn't distinguish WvW from PvE" disclaimer.
- **Verified**: typecheck/lint/build clean. Playwright: built a Guardian with Firebrand equipped
  and Restoring Reprieve as the heal skill — the panel shows only Aegis (2s); Protection and
  Resolution are correctly absent, matching the hand-verified wiki split exactly (screenshot
  confirms both the boon list and the updated caveat text render correctly).
- **Known gap, documented in TODO.md/docs/game-data.md**: skills/traits the fetch script couldn't
  confidently resolve (see skip counts above) still show their PvE value — the same fail-safe
  default as before this feature existed, not a regression. Re-run `fetch-wvw-splits` after future
  `fetch-game-data` runs, since it's scoped to whatever boon/condition-granting content existed
  locally at the time it was last run.

## Session 7 — Gear scaling for boon/condition duration %

Continuation of "keep working through the TODO" — picked up the top item in TODO.md's "Next up"
list, the gear-scaling half of the boon/condition uptime calculator, previously left "verified
and unblocked" pending an itemstat-id question.

- **New `src/shared/gear-calc/attribute-totals.ts`**: `computeGearAttributeTotals(build,
  itemStats)` sums each equipped item's contribution to every GW2 attribute via
  `attribute_adjustment * multiplier + value`. Both the formula and the `attribute_adjustment`
  constants (by armor detail type / trinket type / weapon handedness × Exotic/Ascended rarity)
  are quoted directly from the wiki's `API:2/itemstats` page — fetched as raw wikitext this
  session (`action=raw`, same pattern as `scripts/fetch-elite-spec-skills.ts`), not reconstructed
  from memory or from the earlier WebFetch summary alone (cross-checked both and they agreed).
  Defaults to level-80 Ascended (no rarity selector yet — the realistic tier for the target WvW
  comp). `boonDurationPercent`/`conditionDurationPercent` convert the `BoonDuration`/
  `ConditionDuration` attribute totals (i.e. Concentration/Expertise) to a duration % at a flat
  15-points-per-1% rate, also quoted from the wiki's Concentration/Expertise pages.

- **Resolved the itemstat-id question without new code**: TODO.md had flagged "which of 43
  duplicate-name itemstat ids is correct per equipment slot" as blocking real math. Turned out
  moot — `EquipmentEditor`'s dropdown only ever offers `dedupedStats()`'s canonical picks, so
  `EquipmentSlot.itemStatId` on any build is always one of those already-sensible ids. Gear math
  just looks it up directly; no further resolution needed.

- **Known, documented limitation**: `EquipmentSlotKey` has no weapon-type field (only
  `itemStatId`), so `attribute-totals.ts` can't tell a one-handed weapon slot from a two-handed
  one. All weapon slots use the one-handed `attribute_adjustment` constant — this undercounts
  totals for two-handed-weapon builds (Greatsword, Staff, etc.). Documented in code rather than
  guessed at or silently wrong; revisit if it turns out to matter (would need a weapon-type field
  added to the equipment model).

- **Wired into `sources.ts`/`BoonUptimePanel`**: `BoonConditionSource` gained
  `scaledDurationSeconds` (alongside the existing unscaled `baseDurationSeconds`), computed as
  `base * (1 + percent/100)` using the build's gear-derived boon or condition duration %, applied
  per-fact so boon sources scale by boon duration and condition sources scale by condition
  duration. `BoonUptimePanel` now shows the build's overall gear boon/condition duration % in its
  caveat line and renders `scaledDurationSeconds` (not the base value) per source.

- **Verification**: `npm run typecheck`, `npm run lint`, `npm run build` all clean. Visually
  verified via the established Playwright `_electron` driver (`env -u ELECTRON_RUN_AS_NODE`,
  scratchpad-local `playwright-core`): built a Guardian with all 16 gear slots set to "Diviner's"
  (has Concentration) and confirmed the rendered 109.1% boon duration matches a hand calculation
  from the raw itemstats.json data exactly, and that every rendered source duration
  (Aegis/Might/Protection, base 5s/15s/3s/1s) matches `base * 2.09124` to 2 decimals.

## Session 6 — Icon+name swap follow-through: SkillsEditor and BoonUptimePanel

Continuation of the icon+name UI swap from Session 5 ("keep working through the TODO" — the two
sub-items that session explicitly left open), no new user direction beyond that.

- **`SkillsEditor` rebuilt as an in-game-style skill bar** (`SkillsEditor.tsx`): the Heal/Utility
  ×3/Elite slots render as 5 icon buttons in skill-bar order; clicking a slot opens an inline
  icon+name picker grid of that slot's available skills (filtered the same way the old `<select>`
  was — elite-spec gating, no duplicate utility picks), selecting one closes the picker. Empty
  slots show a text placeholder instead of a blank icon. `Skill.icon` was already fetched from
  the GW2 API, same as trait/spec icons in Session 5 — no new data sourcing needed.
  - Added `skillsById: Map<number, Skill>` to `game-data-store.tsx` (mirrors the existing
    `specializationsById`/`traitsById` pattern) so the skill bar can resolve a chosen skill id
    back to its icon/name/description for the button and its tooltip.

- **`BoonUptimePanel` boon/condition icons, sourced without a hand-maintained map**: TODO.md had
  flagged this as needing "a small hand-maintained name→icon-URL map (12 boons + 14 conditions)"
  since `ItemStat`-style API endpoints don't expose one directly. Turned out unnecessary — every
  `type: 'Buff'` `Fact` on a skill/trait already carries an `icon` field pointing at the granted
  boon/condition's own CDN icon (same URL everywhere that boon/condition is granted, e.g. every
  Aegis-granting fact across the whole dataset points at one Aegis icon), and that data was
  already sitting in `data/game-data/skills.json`/`traits.json` from prior fetches. Extracted the
  26 URLs (all of `BOON_NAMES`/`CONDITION_NAMES`) via a one-off local scan of that already-fetched
  JSON (no network call) into `src/shared/boon-calc/icons.ts`. Also threaded a `sourceIcon` field
  through `BoonConditionSource`/`computeBoonConditionSources` (the granting skill's or trait's own
  icon) so each source line in the panel shows icon+name too, not just the group header.

- **Verification**: `npm run typecheck` and `npm run lint` both clean. Visually verified end-to-
  end via the same Playwright `_electron` driver pattern as Session 5 (`env -u
  ELECTRON_RUN_AS_NODE`, scratchpad-local `playwright-core` install) — screenshots confirm the
  skill bar icons render, the picker grid opens/selects/closes correctly, and picking a heal +
  utility skill immediately populates the Boon & Condition Uptime panel with the correct boon
  icons, source skill icon, name, and duration for each — proving the new UI stays wired to the
  existing `computeBoonConditionSources` logic, not just restyled.

## Session 5 — Icon+name UI swap for gear loadout and traits, pulled forward ahead of MVP

- **Traits panel rebuilt as an icon-based progression tree** mirroring gw2skills.net/in-game
  layout (`TraitsEditor.tsx`): each of the 3 trait lines is a column with a row of clickable
  specialization icon buttons (click again to deselect/swap) instead of a `<select>`, followed
  by the real Adept → Master → Grandmaster progression — minor trait icon, then its 3 major
  trait choices, repeated per tier — instead of a flat list. Both `Specialization.icon` and
  `Trait.icon` were already fetched from the GW2 API; nothing new needed sourcing.
  - **Bug fix found while rebuilding**: the old tier grouping filtered major traits by
    `t.order` (0/1/2, the choice-slot position within a tier) instead of `t.tier` (1/2/3, the
    actual Adept/Master/Grandmaster tier) — e.g. for Guardian's Valor line this silently mixed
    "first choice of every tier" (Phantasmal Fury/Blinding Dissipation/Superiority Complex-style
    triples) into one displayed row instead of grouping by real tier. Fixed by grouping on
    `t.tier` and indexing `chosenTraitIds` by `tier - 1`.
- **Equipment panel rebuilt as a paperdoll layout** (`EquipmentEditor.tsx` + new
  `SlotIcon.tsx`): armor slots down the left column, trinkets down the right, two weapon sets
  below — same positions as the in-game Hero > Equipment panel and gw2skills.net. Each slot
  gets an icon + the existing `<select>` for its stat combo. `ItemStat` (what a slot actually
  stores — just a stat combo, not a real item) has no `icon` field from the API, unlike
  Skill/Trait/Specialization, so there's no upstream art for gear slots; `SlotIcon.tsx` is a
  small set of hand-drawn inline SVG placeholder glyphs (helm/shoulders/chest/gloves/leggings/
  boots/backpiece/accessory/ring/amulet/weapon), styled with `currentColor` so no image assets
  or new dependencies were needed.
- **Real CSP bug found and fixed during visual verification**: `src/renderer/index.html`'s
  `Content-Security-Policy` was `default-src 'self'` with no `img-src` directive, which
  silently blocked every remote icon (`https://render.guildwars2.com/...`) the whole
  icon+name effort depends on — trait/spec icons rendered as empty circles in the built app
  until this was caught. This wasn't a pre-existing visible bug (nothing rendered `<img>`
  tags from that CDN before this session) but would have blocked this feature and any future
  one using `Skill`/`Trait`/`Specialization` icons. Fixed by adding
  `img-src 'self' https://render.guildwars2.com` to the policy.
  - Caught by actually building and running the packaged app (`npm run build` +
    Electron launched directly via Playwright's `_electron`, screenshotted) rather than
    trusting typecheck/lint — both passed cleanly the whole time despite the CSP silently
    dropping every icon.
  - Environment gotcha hit while setting up the verification driver: `ELECTRON_RUN_AS_NODE=1`
    was set in the shell environment (this session's harness sets it), which makes the
    `electron` binary run as plain Node instead of launching the real Electron runtime —
    `electron.app` comes back `undefined` and the main process crashes on
    `electron.app.isPackaged`. Fixed by unsetting it for the launch (`env -u
    ELECTRON_RUN_AS_NODE`), not by touching app code.
- Left out of this pass on purpose (see TODO.md): `SkillsEditor`'s Heal/Utility/Elite pickers
  are still plain `<select>`s (same icon pattern would apply directly), and boon/condition
  names in `BoonUptimePanel` still have no icon source at all.

## Session 4 — Elite-spec skill gating, equipment dedup, and wiki-extraction research

- **Elite-spec skill gating** (the build editor previously showed every Heal/Utility/Elite skill
  for a profession regardless of which elite spec, if any, was equipped — e.g. Guardian's
  Luminary-only "Resolute Stance" was selectable with no elite spec chosen at all). Root cause:
  confirmed via direct API inspection that `/v2/skills` has no `specialization` field, and
  `/v2/professions/:id`'s `training` array only groups core skill categories. Fixed by sourcing
  the mapping from the wiki instead: `scripts/fetch-elite-spec-skills.ts` (new, run via
  `npm run fetch-elite-spec-skills`) pulls all 36 elite specs' `Category:<Name> skills` wiki
  pages via the MediaWiki API (`generator=categorymembers&prop=categories`, paginated), filters
  to pages tagged `Category:Healing/Utility/Elite skills`, and matches page titles against
  `skills.json` by (profession, slot, name) — with a quote-stripping fallback for shout-skill
  title mismatches (wiki drops the surrounding `"..."` GW2 keeps in the API name). Output:
  `data/game-data/elite-spec-skills.json`, a flat `{ skillId: specializationId }` map, 211
  entries resolved cleanly this run (16 unmatched, 36 ambiguous — both excluded rather than
  guessed, see docs/game-data.md for the full breakdown). Wired into `GameData`/`loadGameData`/
  `game-data-store.tsx`'s `skillsForProfessionAndSlot` (now takes the build's equipped
  specialization ids and filters out gated skills the build doesn't have), `SkillsEditor`, and
  `BuildEditorView` (which also now clears any skill selection invalidated by a specialization
  line change, e.g. dropping Luminary while "Resolute Stance" is the heal skill).
  - Real bug hit while writing the fetch script: the wiki's API returns HTTP 403 for Node's
    default `fetch` User-Agent (confirmed: `curl` with its default UA passes, bare Node `fetch`
    doesn't) — fixed by setting an explicit descriptive `User-Agent` header.
  - Verified the resulting map against the target party comp from TODO.md: all 5 Luminary-line
    skills (Resolute Stance, Effulgent Stance, Piercing Stance, Valorous Stance, Stalwart Stance)
    resolved correctly to the Luminary specialization id.
- **Equipment picker duplicate stat-name entries** (screenshot from the user showed "Apothecary's"
  listed 4 times, "Berserker's" 5 times, etc. in the Leggings dropdown with no way to tell them
  apart). Root cause: `data/game-data/itemstats.json` has 43 stat-combo names with multiple
  numeric ids each — legacy pre-revamp combos, trinket-only (value-only) variants, and the modern
  armor/weapon (multiplier+value) combo all share a display name. Fixed with a dedup heuristic in
  `EquipmentEditor.tsx`: per name, prefer the entry with the most attributes, then the one where
  every attribute has both a nonzero multiplier and value (the fully-specified modern combo),
  tie-broken by lowest id. Verified in Python against all 43 duplicate-name groups before porting
  to TypeScript (the TS scoring function was checked to produce identical picks to the reference
  implementation for every group). This is a display-only fix — it doesn't yet resolve which
  itemstat id is *correct per equipment slot type* for real stat-scaling math (still open, see
  TODO.md); nothing consumes itemstat attribute values yet, so this was safe to ship now.
- **Wiki-extraction research** (user asked directly: "can we get WvW-split and gear-scaling data
  from the wiki?" — prior session had only confirmed these were *missing* from the raw API,
  not investigated wiki feasibility). Two real research passes against live wiki pages, not
  assumptions:
  - Gear-scaling formula **is** documented: `wiki.guildwars2.com/wiki/API:2/itemstats` states
    `attribute_adjustment * multiplier + value` = attribute points, with a reference table of
    `attribute_adjustment` constants by level/rarity/slot-type. This overturns last session's
    finding that the multiplier→major/minor mapping was needed — that was based on the wiki's
    *pre-computed final totals* table, not the general per-item formula, which turns out to be
    much simpler. Still open: which itemstat id to pick for a given equipment slot when a name
    has duplicates (undocumented — only a talk-page comment, unverified).
  - WvW/PvE split values **are** extractable, just not via one bulk query: the wiki has no Cargo
    extension (404 on `Special:CargoTables`) and Semantic MediaWiki doesn't index the `game
    mode=` skill-fact template parameter (a live `Special:Ask` query for it returned nothing).
    But `Category:Split_skills` (1,664 pages) and `Category:Split_traits` (545 pages) are real
    maintained lists, and each page's raw wikitext has cleanly parseable `{{skill fact|...|game
    mode=pve/wvw pvp}}` template calls — confirmed directly against `Restoring_Reprieve`'s raw
    wikitext, matching the known in-game PvE-vs-WvW difference exactly. Feasible per-page for the
    bounded set of skills/traits a specific build/party comp uses; not built yet.
  - Elite-spec-to-skill mapping (the gating feature above) was confirmed feasible the same way
    before it was built — findings folded directly into the shipped fetch script rather than
    left as a separate note.
- Fixed a stale doc comment in `docs/game-data.md` claiming `facts`/`traitedFacts` are still
  `unknown[]` — they were typed as `Fact[]` last session; the doc just hadn't been updated.

## Session 3 — Boon/condition source parser (first slice of the uptime calculator)

- Typed the GW2 API's `Fact` object (`src/shared/types/game-data.ts`): `Skill.facts`/
  `traitedFacts` and `Trait.facts`/`traitedFacts` were `unknown[]`, now `Fact[]` with the fields
  the calculator needs (`type`, `status`, `duration`, `apply_count`, `requires_trait`) plus an
  index signature so the rest of each raw fact still round-trips untyped.
- `src/shared/boon-calc/`: `constants.ts` has the fixed boon/condition name lists (`BOON_NAMES`,
  `CONDITION_NAMES`); `sources.ts` has `computeBoonConditionSources(build, gameData)`, which walks
  a build's equipped heal/utility/elite skills, auto-granted minor traits on each equipped
  specialization line, and chosen major traits, extracting every `type: 'Buff'` fact whose
  `status` matches a known boon/condition name. Facts gated by `requires_trait` (on skills or
  traits) are only included if that trait is actually active for the build — computed via
  `activeTraitIds` (minors of equipped lines + all chosen majors).
- `BoonUptimePanel` (`src/renderer/components/build-editor/BoonUptimePanel.tsx`) now renders this
  for real: sources grouped by boon/condition name, each with its source skill/trait name and
  base duration. Explicitly labeled as base (unscaled) durations, with a visible caveat that gear/
  food scaling isn't applied yet and that the public API doesn't reliably distinguish WvW from
  PvE balance (see below).
- Verified via a scripted Electron launch (not committed) against the actual `npm run build`
  output: selected Guardian's "Purification" heal skill (grants Regeneration 10s + Blinded 6s)
  and confirmed the panel grouped/displayed both correctly; then, as a `requires_trait` gating
  test, equipped the Luminary line, picked "Resolute Stance" as the heal skill (grants Protection
  3s only via a traitedFact gated on the Luminary tier-1 trait "Shimmering Stances"), confirmed
  Protection was absent before that trait was chosen and present with the correct source after.
  No console/page errors in either run.
- Bug found and fixed during that verification: `loadGameData()` (`src/main/game-data/
  load-game-data.ts`) resolved `data/game-data/` relative to `app.getAppPath()`, which only
  happens to equal the project root under `electron-vite dev`. Running the actual built output
  (`out/main/index.cjs`) resolves it to `out/main` instead, so every game-data IPC call threw
  ENOENT and every selector in the editor silently rendered empty. Fixed by resolving the data
  directory from `__dirname` (stable at `out/main` in both dev and build output) instead.

### Investigated and confirmed this session (informs what's still open in TODO.md)

- The GW2 API does **not** reliably expose WvW-specific balance numbers separately from PvE —
  confirmed via GW2 forum reports (`/v2/skills` returns all facts for a skill with no game-mode
  indicator, even when the skill behaves differently per mode) and the wiki's own `game_mode`/
  `split` template fields, which are a human wiki-authoring convention, not an API-exposed field.
  So today's parser surfaces whatever the API returns, which may be PvE-biased or ambiguous for
  specific skills — the UI says so rather than implying WvW accuracy it can't back up.
- Gear-based boon/condition duration scaling was investigated but deliberately NOT implemented:
  the API's itemstat `multiplier`/`value` pairs need a major-vs-minor-attribute categorization per
  stat-combo type (2/3/4-stat combos use different multiplier constants) to resolve into an
  actual attribute value, and I couldn't verify that mapping confidently against the wiki this
  session. Shipping a number that looks precise but is quietly wrong would be worse than not
  computing it — deferred with the specific blocker written down in TODO.md rather than guessed.

## Session 2 — Build editor UI

- Game-data IPC bridge: main process reads `data/game-data/*.json` once (`src/main/game-data/load-game-data.ts`,
  cached in memory) and exposes it to the renderer via `window.gw2GameData.getAll()`
  (`src/main/ipc/game-data-ipc.ts`, `src/preload/index.ts`), mirroring the existing
  `window.gw2Storage` seam. `GameDataStoreProvider`/`useGameData` (`src/renderer/state/game-data-store.tsx`)
  loads it once and exposes lookup maps/selectors (specializations by profession, major/minor
  traits by specialization, skills by profession+slot).
- Build editor UI (`src/renderer/components/build-editor/`): `ProfessionSelect`, `TraitsEditor`
  (3 specialization lines, enforces at most one elite spec equipped and no duplicate lines,
  3-tier major trait radio picker per line, minor traits shown read-only), `SkillsEditor`
  (heal/utility×3/elite, filtered by profession + GW2 API `slot` field, prevents picking the
  same utility skill in two slots), `EquipmentEditor` (16 gear slots × itemstat picker), and a
  `BoonUptimePanel` stub documenting the planned calculator shape (per-boon source list with
  computed duration) without implementing it yet.
- `BuildEditorView` orchestrates all of the above with local draft state; changing profession
  resets specializations/skills (they don't carry over between professions). Wired into
  `BuildsView` — clicking a build (or "+ New build") opens the editor; Save round-trips through
  `builds-store`'s new `createBuild`/`updateBuild` (replacing the old single-purpose
  `createDummyBuild`).
- Data quality fix: 13 of 191 itemstat entries from the live API have an empty `name` string
  (deprecated/internal stat combos) — filtered out of the equipment picker rather than shown as
  blank options.
- Verified end-to-end via a scripted Playwright/Electron launch (not committed): create a build,
  pick a profession/specialization/trait tier/skill/equipment stat, save, confirm it appears in
  the list, reopen it, and confirm every selection persisted through SQLite. No console/page
  errors during the run.

### Scoping notes carried into TODO.md

- Confirmed with the user: boon/condition calculator should mirror gw2skills.net for a single
  build (list every source + computed duration from boon duration/concentration/consumables),
  with a later squad-view mode showing all 5 party sources per boon. Needs a real GW2 API
  `Fact`-parsing layer (not hand-written rules) and WvW-specific balance numbers (not PvE) —
  both still open. Target first-pass party comp and full detail captured in TODO.md.

## Session 1 — Scaffolding & data-layer groundwork

- Project scaffold: Electron + React + TypeScript via `electron-vite`, with `src/main`
  (Electron main process), `src/preload` (contextBridge IPC surface), `src/renderer` (React
  app, no Electron APIs), and `src/shared` (types + storage interface usable from anywhere).
  ESLint (flat config) + strict TypeScript (`npm run typecheck`) wired up. `npm run dev`
  launches the Electron shell with the React app inside it.
- GW2 static game data pipeline: `scripts/fetch-game-data.ts` (run via
  `npm run fetch-game-data`) pulls professions, specializations, traits, skills, and itemstats
  from the public GW2 API v2, batches bulk `ids=` requests (200/batch) with retry/backoff, and
  writes normalized JSON to `data/game-data/`. Verified against the live API: 9 professions, 81
  specializations, 999 traits, 4702 skills, 191 itemstats. Documented in `docs/game-data.md`.
- Core data model: `Build`, `SquadComp`, and static game data types (`Profession`,
  `Specialization`, `Trait`, `Skill`, `ItemStat`) defined in `src/shared/types/`.
- Local storage layer: SQLite (via `better-sqlite3`, N-API-based for ABI stability across
  Node/Electron versions) behind a `StorageAdapter`/`Repository<T>` interface in
  `src/shared/storage/`. Builds/squad comps are stored as JSON blobs keyed by id (avoids a
  premature relational schema for still-evolving nested shapes). Renderer never touches SQLite
  directly — it goes through a preload-exposed `window.gw2Storage` bridge over IPC, which is
  the seam a future Capacitor storage plugin will implement instead.
- Minimal UI shell: Builds/Squads nav, with a working create → save (SQLite) → list → persist
  across restart round trip on the Builds view (Squads view is a placeholder).
- Verified end-to-end via a scripted Playwright/Electron launch (not committed — one-off
  verification): app window opens, "Create dummy build" persists through SQLite, and the build
  is still present after a full app restart.

### Bugs hit and fixed during setup (worth remembering)

- Electron's main process has known ESM named-export interop issues with the native `electron`
  module (`import { BrowserWindow } from 'electron'` throws "does not provide an export named
  ..." under Node ESM, including inside `@electron-toolkit/utils`). Fixed by forcing CJS output
  (`.cjs` extension) for the main/preload bundles in `electron.vite.config.ts`, regardless of
  the root `package.json`'s `"type": "module"`.
- `better-sqlite3`'s native binding is compiled against a specific Node/V8 ABI. The version
  installed by default (11.x) doesn't compile against Electron 43's newer V8 API at all, and
  even when it does compile, an ABI built for the system Node ≠ the ABI Electron bundles
  internally — a silent crash (unhandled promise rejection) on `new Database()` at startup with
  no visible window. Fixed by upgrading to `better-sqlite3@^13` (N-API, ABI-stable across
  Node/Electron versions) and wiring `electron-builder install-app-deps` as a `postinstall`
  script so native deps are always rebuilt/reprovisioned for Electron's ABI after `npm install`.
