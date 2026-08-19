# Completed

Entries are added as work lands, most recent first.

## Session 247 — Discord bot Phase 2: core CRUD + board sync (code-complete, not yet deployed)

Built out `docs/discord-bot.md`'s Phase 2 in full: board admin (`buildboardsetup`/`rebuild`,
`squadboardsetup`/`rebuild`, `buildboardconfig setpermission`), build CRUD (`buildadd`/`remove`/
`edit`/`move`), squad CRUD (`squadadd`/`remove`/`edit`), and name autocomplete on every existing-
entry `name` argument — all in Automatic mode (no approval workflow yet, that's Phase 3). New
files: `worker/src/db.ts` (D1 query layer for all 5 Phase-2-relevant tables), `worker/src/discord/
api.ts` (Discord REST helpers), `worker/src/discord/dispatch.ts` + `interaction-types.ts` +
`permissions.ts` + `errors.ts` + `autocomplete.ts`, `worker/src/discord/commands/{board-admin,
builds,squads}.ts`, `worker/src/render/board.ts`, `worker/src/professions.ts`, `worker/src/share-
{resolve,validate}.ts` (duplicated share-reading/validation logic, same "separate deployable"
reasoning as the existing `ShareKind` duplication in `index.ts`). Rewrote `interactions.ts`/
`index.ts` to route by interaction type and thread an `ExecutionContext` through.

Three design decisions the doc left open, resolved with the user before writing code (see
`docs/discord-bot.md`'s Phase 2 checkbox for the fuller writeup): `action_permissions` with no
configured role defaults to **open**, not locked down; `/buildAdd` etc. **require** `/
buildBoardSetup` to have run first rather than auto-creating a section; **autocomplete built now**
rather than deferred. Added one safety valve beyond what was asked: guild Administrators always
bypass a configured role gate, so a misconfigured/never-configured gate can't lock an admin out of
their own board.

Every mutating command uses Discord's deferred-response pattern (ack immediately, do the D1 write
+ board-message PATCH via `ctx.waitUntil`, edit the placeholder with the real result) since that
combined work isn't reliably under Discord's 3-second window — a step beyond what Phase 1 needed.
Caught and fixed one real ordering bug during self-review: `buildEdit` was reshuffling
`sort_order` for a cross-profession move *before* the name-uniqueness-checked D1 write, so a
rejected rename (duplicate name) after a profession change would have left `sort_order` corrupted;
reordered so the constraint-checked write always happens first.

Verified with a throwaway smoke-test script (`_smoke.ts`, deleted before commit — not part of the
repo) that called the exported command handlers directly against a real local D1 database (via
wrangler's `getPlatformProxy`, sharing `.wrangler/state` with local dev) with `global.fetch`
stubbed for `discord.com` calls only. 17/17 assertions passed: board setup + its re-setup guard,
buildAdd (including duplicate-name rejection and the Guardian section's board message actually
getting PATCHed), autocomplete finding a freshly-added build, permission gating (open by default,
then blocked once a role is configured via `buildboardconfig setpermission`, then allowed for a
member holding that role), buildMove, buildEdit's cross-profession move, squadAdd/Edit/Remove, and
buildBoardRebuild. `npm run typecheck` and `eslint` both clean.

With the user's explicit go-ahead, deployed and went live: `wrangler deploy` pushed the new
`/interactions` handling to production; `wrangler d1 migrations apply DB --remote` confirmed
production's schema already had everything Phase 2 needs (no new migration, all 5 relevant tables
came from Phase 1's `0001_init_schema.sql`); `register-commands` run against production registered
all 13 commands (`ping` + the 12 Phase 2 commands) globally — propagation can take up to an hour.
Not yet manually click-through-verified in a live server (the smoke test exercised the handlers
directly, bypassing the real HTTP/signature-verification path) — natural next check once
propagation completes. `docs/discord-bot.md`'s Phase 2 checkbox and Status section, and TODO.md's
Discord bot entry, updated accordingly.

## Session 246 — Discord bot Phase 1: live end-to-end (deploy, secret, endpoint, /ping confirmed)

Closed out Phase 1 of `docs/discord-bot.md`'s phased build order, continuing from commit 8ace700's
foundational plumbing (interactions route, D1 schema, command registration script). Remaining
steps all touched live infra, done with the user's explicit go-ahead: `wrangler deploy` pushed the
worker (including `/interactions`) to `https://gw2-squaded-share.vanwheelstheman.workers.dev`;
`wrangler secret put DISCORD_BOT_TOKEN` set the production secret (previously only in local
`.dev.vars`); user saved the Interactions Endpoint URL in the Discord Developer Portal, which
Discord only accepts after a live PING/PONG round trip succeeds; `register-commands` run against
production registered `/ping` globally. User confirmed `/ping` responding live in a real Discord
server (screenshot: "pong from /ping"). `docs/discord-bot.md`'s Phase 1 checkbox and Status
section updated; TODO.md's Discord bot entry updated to point at Phase 2 (core CRUD + board sync,
Automatic mode) as the next phase, per the doc's own phased build order.

## Session 245 — Build screenshot layout redesign: scrollbar follow-up confirmed

User confirmed the residual right-edge scrollbar from Session 230's redesign is gone after the blind
~20px spacing trim (commit 9d59966). Closes the whole "Build screenshot layout redesign (2026-08-19)"
TODO item — the earlier "it all fits now" success criterion plus this scrollbar cleanup are both now
user-verified. No further action; `.app-content`'s padding was the fallback candidate if this hadn't
worked and is no longer needed.

## Session 244 — Builds-tab exclusion filter

Extended `useTagFilter` (`src/renderer/state/use-tag-filter.ts`) from OR-inclusion-only to a
3-state model: `selectedTags: Set<string>` → `tagStates: Map<string, 'include' | 'exclude'>`, per
the 2026-08-16-scoped TODO item. `toggleTag` now click-cycles absent → include → exclude → absent
(same handler everywhere, no new controls); a new `clearTag` gives `TagChipDropdown`'s `×` button a
one-click "drop to absent" shortcut instead of relying on cycling. Filter logic: keep OR-across-
includes, AND NOT any excluded tag/profession present. Propagated through the shared plumbing
(`TagFilterBar`, `TagChipDropdown`, `ProfessionTagPicker`) rather than duplicating it — so
`BuildsView`, `SquadsView`, and the squad editor's `BuildsSidebar` all picked up exclusion filtering
for free, closing the "decide separately" follow-on the original scoping note raised, at the low
extra cost it predicted. New `.tag-chip-excluded`/`.spec-icon-button.excluded` styles reuse
`--danger` (red-adjacent, consistent with its "negative/destructive signal" role) — extended that
token's documented scope in `global.css`'s theme-token comment rather than silently overloading it.
`npm run typecheck`/`lint`/`test` all clean (224 tests, no new ones needed — UI/filter-logic change
covered by existing manual verification, not unit-tested surface).

## Session 243 — Party-wide filter sweep leg 5: Breaks-Stun wiki pass (fully closes the sweep)

Fifth and final leg of the Misc-row `targetCount` sweep, closing the one item legs 1-4 left open: the
~120 still-uncurated Breaks-Stun sources, previously only "self-only by inspection." Instead of
another local-description read, this leg fetched each of the 113 real candidates' (after excluding
blank-data placeholder ids like skill 72441) own wiki page and read its `{{skill/trait
fact|breakstun}}` / `{{skill fact|stun break|applies to=...}}` template directly — the wiki's own
explicit self-vs-allies signal, discovered while confirming Otter's Compassion and then verified
reliable against the already-known Blinding Powder/"Shake It Off!" cases (spot-checked the full local
wiki-page cache for any hidden `applies to=` parameter under the older `breakstun` template spelling;
found only on the already-curated "Shake It Off!"). Result: exactly ONE source in the entire leftover
set is party-wide — Otter's Compassion (76563, Evoker meditation, `applies to=allies` when water is
your specialized element; its sibling boon facts were already curated at 5), now added to
`BREAKS_STUN_PARTY_WIDE`. The other 112 are now CONFIRMED (not just inspected) self-only: 4 via an
explicit `applies to=self` qualifier (Elixir S, Hare's Agility, Toad's Fortitude, Fox's Fury — the
latter two read ambiguously from prose alone, e.g. Toad's Fortitude's "grants resistance to allies and
breaks stun," but the wiki's own fact template disambiguates both as self), 108 via a bare
qualifier-less template (GW2's own defaults-to-self convention). This fully closes the whole
`MISCELLANEOUS_MATCHERS` party-wide-targetCount item — nothing left open. `npm run
typecheck`/`lint`/`vitest run` all clean (66 boon-calc tests, no new ones needed — curated data, not
new logic).

## Session 242 — Party-wide filter sweep leg 4: Barrier manual description read (closes the sweep)

Fourth and last leg of the Misc-row `targetCount` sweep (`BREAKS_STUN_PARTY_WIDE` leg 1,
`STEALTH_PARTY_WIDE` leg 2, `SUPERSPEED_PARTY_WIDE` leg 3). New `BARRIER_PARTY_WIDE` table
(`sources.ts`) replaces the empty `NO_MANUAL_TARGET_COUNT_OVERRIDES` placeholder: of 79
Barrier-fact-carrying skills/traits, 11 already resolved for free via their own `"Number of Allied
Targets"` fact; of the remaining 68, a full local `facts`/`description` read found 15 skill ids + 7
trait ids confirmed party-wide (Call of Valor, Bulwark Gyro, Glyph of Burgeoning, Glyph of Elemental
Power, Serpent Siphon, Sand Swell, Sand Flare, Saint's Shield, Barrier Burst, Energizing Slam, Dawn's
Repose (leap variant), "We Will Never Yield!", Effulgent Stance, Chak Shield, "Brace Yourselves!";
traits Allies' Aid, Chain Reactivity, System Shocker, Ex Machina, Unshakable Mountain, Panaku's
Ambition, Mech Core: Barrier Engine), plus 2 live wiki checks. Two same-name-but-different-mechanic
sibling pairs turned up, same discipline `STEALTH_PARTY_WIDE`'s Toss Elixir S entries already
established (read each id's own description, never group by name): Dawn's Repose's leap variant
(63220, "tethered ally and nearby allies") is party-wide but its dash-variant sibling (63227,
"tethered ally and yourself") isn't. Several sources had their ally-reach evidence sitting in an
explicitly split fact label rather than the free-text description (Sand Flare's `Self Barrier`/`Ally
Barrier` pair, Chain Reactivity's `Ally Barrier` facts, Panaku's Ambition's `Stealth Attack
Barrier`/`Stealth Barrier` pair) — trusted as ally-reach evidence in place of prose, all defaulting to
5 since none carry their own `Number` fact. The Elementalist Earth line's self-barrier-stack skills
(Armor of Earth, Rock Barrier, Stone Sheath, both Stone Resonance ids, Molten Burst, Fortified Earth,
Immutable Stone) turned out to be a clean recurring self-only pattern, all tied to the Tectonic Shift
self-buff mechanic with zero ally wording. Live wiki checks: Glyph of Elemental Power's own local
description never names Barrier at all ("effect differs based on attunement") — wiki confirmed the
Earth branch specifically grants it to "five nearby allies," now curated; Crescendo's raw wikitext
showed its own `{{skill fact|targets|5}}` is the same bare, unlabeled shape the page also uses for its
foe-facing Damage fact, no ally wording anywhere — left uncurated rather than guessed. Also excluded:
63155 Enter Shadow Shroud grants barrier to one single targeted/tethered ally only, never reaching the
party-wide threshold even if curated. This closes the whole `MISCELLANEOUS_MATCHERS`
party-wide-targetCount item; only Breaks Stun's own ~120 leftover self-only-by-inspection sources
remain open, logged in TODO.md. `npm run typecheck`/`lint`/`vitest run` all clean (66 boon-calc tests,
no new ones needed — this is curated data, not new logic).

## Session 241 — Time Warp Superspeed correction (same-day follow-up to Session 240)

User corrected Session 240's "left uncurated as ambiguous" call on Time Warp: real-game knowledge says
Time Warp (and every Mesmer Glamour skill) only grants Superspeed with the Temporal Enchanter trait
(1980) equipped — confirmed via a scan of every Glamour-category skill that Time Warp is the only one
carrying a Superspeed fact of its own at all (Veil/Portal Entre+Exeunt/Null Field/Feedback have none),
so every other Glamour skill's party-wide Superspeed is already fully covered by Temporal Enchanter's
own trait row. `SUPERSPEED_PARTY_WIDE`'s skill entries for 10311/10377 Time Warp now use a
`TraitConditionalTargetCountOverride` (party-wide(5) when trait 1980 is active, `'self'` otherwise) —
the same conditional mechanism `TARGET_COUNT_OVERRIDES` already uses for Willbender's Phoenix
Protocol/Gladiator's Defense (a source's reach flipping on an unrelated trait choice, not its own fact
data). `npm run typecheck`/`lint`/`vitest run` all clean (224 tests, no new ones needed). TODO.md/the
table's own doc comment updated in place.

## Session 240 — Party-wide filter sweep leg 3: Superspeed manual description read

Third leg of the Misc-row `targetCount` sweep (`BREAKS_STUN_PARTY_WIDE` leg 1, `STEALTH_PARTY_WIDE`
leg 2). New `SUPERSPEED_PARTY_WIDE` table (`sources.ts`) gives Superspeed the same manual read: of 47
Superspeed-granting skills + 13 traits, 9 already resolved for free via their own `"Number of Allied
Targets"` fact; of the remaining 51 (40 skills + 11 traits), 12 skill ids + 3 trait ids confirmed
party-wide from local API `facts`/`description` data (Windborne Speed, both Toss Elixir U ids,
Detonate Elixir U, Symbol of Swiftness, Slipstream, Chaotic Release, "Eye of the Storm!", Well of
Action, Essence of Borrowed Time, Rallying Roar, "We Will Never Yield!"; traits Temporal Enchanter,
Speed of Synergy, Liberating Liaise) plus one live wiki check (Windborne Speed — own description only
mentions Swiftness, not Superspeed, despite carrying an unconditioned Superspeed fact; wiki confirmed
both are "you and nearby allies"). Found a clean systemic pattern along the way: 7 Engineer
heal-adjacent skills (Toss Elixir H x2, Regenerating Mist, Blessing of Dwayna, Leafy Bandage, Static
Shock, Bandage Self) all carry a Speed-of-Synergy-gated Superspeed fact, but Speed of Synergy's own
description splits two cases — "using a heal skill" (party-wide radius) vs. "the associated tool-belt
skill" (self-only) — and all 7 turned out to be API `slot: "Toolbelt"`, so none were curated, matching
the trait's own wording exactly rather than guessing per-skill. Time Warp (both ids) was left
deliberately uncurated despite carrying an unconditioned local Superspeed fact: a live wiki check
found the current tooltip doesn't mention Superspeed at all, attributing any Superspeed near a glamour
to the separate (already-curated) Temporal Enchanter trait instead — conflicting enough to skip rather
than guess. `NAMED_FACT_TARGET_COUNT_TABLES['Superspeed']` now points at the real table instead of the
empty placeholder. `npm run typecheck`/`lint`/`vitest run` all clean (224 tests, no new ones needed).
TODO.md's item updated in place; Barrier (68) remains for a future leg.

## Session 239 — Party-wide filter sweep leg 2: Stealth manual description read

Second leg of the Misc-row `targetCount` sweep TODO.md opened 2026-08-16 (`BREAKS_STUN_PARTY_WIDE` was
leg 1). New `STEALTH_PARTY_WIDE` table (`sources.ts`) gives Stealth the same manual read: of 40
Stealth-granting skills + 3 traits, 10 already resolved for free via their own `"Number of Allied
Targets"` fact; of the remaining 32, 8 skill ids confirmed party-wide from local API `facts` data
(5972/6090 Toss Elixir S, 10245 Mass Invisibility, 13117 Shadow Refuge — each carries its own
`"Number of Targets"` fact with zero competing foe-facing fact on the source, so the normally-untrusted
generic label is trusted here) plus live wiki wikitext for 2 more with no local `Number` fact at all
(10187/50414 Veil — default-5 convention off explicit "you and your allies" wording; 30815 Sneak Gyro
— `missing facts=` `targets|5`, same zero-foe-facing-component trust). 13044 Blinding Powder was
initially excluded as ambiguous — it carries a foe-facing Blinded fact alongside the ally-facing
Stealth fact, both apparently competing for the same single generic `"Number of Targets": 5` label —
but the user corrected this twice in the same session: first that the skill's `StunBreak` fact is
personal-only (not evidence either way on its own), then that Blind and Stealth both independently cap
at 5 targets (foes/allies respectively) — the two readings aren't actually competing, both are true
simultaneously. Curated as party-wide(5) for Stealth; Blind's own enemy-facing count doesn't need (and
isn't consumed by) any curation here, since `targetCount` is documented as only meaningful for
non-condition sources. `NAMED_FACT_TARGET_COUNT_TABLES['Stealth']` now points at the real table
instead of the empty placeholder. `npm run typecheck`/`lint`/`vitest run` all clean (224 tests, no new
ones needed — this only adds curated data consumed by existing resolution code). TODO.md's item
updated in place; Superspeed (51) and Barrier (68) remain for future legs. **Lesson for future legs**:
a source with facts that "compete" under one shared count label may not actually be ambiguous at all —
both readings can be simultaneously true (an AoE cap applied identically to both its foe and ally
component), so don't stop at "two candidate meanings found" without checking whether they conflict.

## Session 238 — v1.1.0 release

Cut the first post-1.0 feature release, covering everything since v1.0.1 (Sessions 219-237 plus the
2026-08-16/18 UI/UX-polish and theme commits that landed without their own session write-up):
Light/Dark/System theme, real-class-color Build/Squad card accents, Tango-icon profession art, the
Gear Optimizer modal + live stat comparison, the Build/Squad editor UI polish batch, the Build and
Squad screenshot layout redesigns (including the multi-line squad stitch-capture fix), the full
112-relic proc integration sweep, the Revenant/Renegade/Engineer/Icerazor's Ire tooltip-accuracy
fixes, and the build "Updated"-timestamp gating fix. `package.json`/`package-lock.json` bumped
1.0.1 → 1.1.0 (`npm version 1.1.0 --no-git-tag-version`); `CHANGELOG.md` got a full in-depth entry
(user request) and `README.md` picked up the user-facing surface of this batch (theme, gear
optimizer comparison table, profession-colored cards, squad editor context menu, Tango-icon
credit). `npm run typecheck`/`lint`/`vitest run` all clean (224 tests) immediately before tagging.
Tagged `v1.1.0` and published via the same electron-builder GitHub-publish recipe prior releases
used (pre-created draft release to avoid the known duplicate-release race, see this file's earlier
`electron-builder-github-publish-race` note).

## Session 237 — Build "Updated" timestamp fix: gate on real edits, add manual review confirm

Closes TODO.md's "Build 'Updated'/staleness tracking is currently untrustworthy" item (flagged
2026-08-18). Two-part fix in `BuildEditorView.tsx`:

- **`handleBack`** previously stamped `updatedAt`/`updatedAtGw2Build` unconditionally on every
  back-navigation, so just opening a build and immediately leaving cleared the "Not reviewed since
  latest patch" flag (`isBuildStaleSincePatch`) with no real edit having happened. Now compares
  `JSON.stringify(draft)` against `JSON.stringify(build)` (the prop the editor opened with) — `Build`
  is plain JSON-serializable data (no `Date`/`Set`/`Map` fields), so this is a safe, dependency-free
  deep-equality stand-in — and only stamps fresh timestamps when they actually differ.
- **New "Mark as up to date" button** in the editor header, shown only when
  `isBuildStaleSincePatch(draft, localGw2Build)` is true, lets the user explicitly confirm a build
  still holds up under the current patch (stamps `updatedAt`/`updatedAtGw2Build` into `draft`) without
  needing a throwaway content edit to clear the flag. It only touches local `draft` state — persisted
  by the normal save-on-`handleBack` flow like every other field, not immediately — so it composes
  with the diff check above rather than bypassing it.

A brand-new blank build (`makeBlankBuild`) already stamps `createdAt`/`updatedAt` at creation time, so
backing out of a new build with zero changes still creates the record with a sensible "just now"
timestamp — this fix only changes behavior for re-opening an *existing* build. Typecheck/lint clean;
no view-level test infra exists in this repo to extend (existing 224 tests are all shared-logic
level). TODO.md's item removed.

## Session 236 — 3 Build editor UI bugs from the 2026-08-16 batch: trait-box heights, connector, Light Aura routing

All 3 remaining items from TODO.md's "Bugs found in testing (2026-08-16)" section:

- **Traits section box heights** (`TraitsEditor.tsx`, `global.css`): the `{chosenSpec && line && (...)}`
  gate around `.trait-line-tiers-horizontal` meant an empty line rendered only the Specialization
  picker, collapsing far shorter than a filled line — the existing `min-height: 160px` on `.trait-line`
  papered over the box-height mismatch but still left an empty box looking bare/unfinished. Replaced
  the gate with an always-rendered tier grid: 3 tiers × (1 minor + 3 majors, every spec has exactly 3
  majors/tier — confirmed via a full `specializations.json` scan) that renders real icons once a spec
  is chosen, or hollow dashed-outline placeholders (new `.trait-slot-placeholder` CSS) before one is.
  All 3 lines now reserve identical height from first paint; `.trait-line`'s `min-height` stays as a
  backstop but the content itself now does the real work.
- **Trait-line connector drawing minor→minor with nothing selected** (`useTraitConnector` in
  `TraitsEditor.tsx`): the connector's `active` gate was `Boolean(chosenSpec && line)` — true as soon
  as a spec was picked, regardless of whether any major trait had been chosen yet, so an
  otherwise-empty line still drew the full minor-tier1→minor-tier2→minor-tier3 zigzag. Added a
  `hasChosenTrait` check (`chosenTraitIds.some((id) => id !== null)`) to the gate — the whole line's
  connector now only renders once at least one major has actually been picked, per the TODO's
  explicitly-sanctioned simpler alternative to per-segment gating.
- **Light Aura showing in the Squad Builder's Boons row but not the Build Editor's Auras row**
  (`sources.ts`): root-caused past where the TODO's investigation left off. Radiant Resolve's
  `countsTowardTotals`-flagged "Activate" branch (`radiantResolveSections`) grants Light Aura
  (`category: 'aura'`) alongside its Healing numeric line, but `computeBoonConditionSources`'s branch
  loop pushed every branch fact unfiltered into its output — including that aura one — violating its
  own documented contract ("only ever produces 'boon'/'condition'"). Meanwhile `computeAuraSources` had
  no equivalent branch loop at all, so the aura fact never reached the function that was actually
  supposed to carry it. Net effect: `SlotTile.tsx`'s Boons row (which filters only by `isCondition`,
  not by a fixed name whitelist) rendered the leaked aura fact, while `BoonConditionSummaryPanel.tsx`'s
  Boons row (gated by the fixed `BOON_NAMES` list, which doesn't include "Light Aura") silently
  dropped it — and neither view's Auras row ever saw it. Fixed both sides: `computeBoonConditionSources`
  now filters `branch.facts` to `category !== 'aura'`, and `computeAuraSources` gained its own mirrored
  loop filtering to `category === 'aura'` (passing an all-zero `durationPercent`, matching
  `BoonConditionSource.scaledDurationSeconds`'s documented "auras are never duration-scaled" contract).
  New regression test `radiant-resolve-aura-routing.test.ts` locks in the correct routing for both
  functions plus the pre-existing "Empowered Staff branch doesn't count" behavior.

Typecheck/lint/full test suite (224 tests, 3 new) all clean. TODO.md's whole "Bugs found in testing
(2026-08-16)" section is now closed and removed — nothing left open from that batch.

## Session 235 — Squad screenshot stitch failing on >4-line squads: CSP blocked the tile `<img>`s

Same-day follow-up to Session 234: user reported the new stitched capture path itself failing
("Failed — try again") for any squad over 4 lines — exactly the case that now takes the stitch path
instead of the single-shot fast path. Root cause: `index.html`'s CSP `img-src` was
`'self' https://render.guildwars2.com https://wiki.guildwars2.com` — no `data:` scheme. `captureElement`'s
stitch loads each `captureRegionToDataUrl` tile into an offscreen `<img>` (`loadImage`) so it can be
drawn onto the compositing canvas; every one of those `img.src = <data: URL>` assignments violated
the CSP and silently fired `onerror` instead of `onload`, which `loadImage` turns into a rejected
promise, caught by `ScreenshotButton` as a capture failure. The single-shot fast path (≤4 lines, and
the Build editor, which always takes that path) never creates an `<img>` at all, so it was
unaffected — matching exactly the reported "only breaks over 4 lines" shape.

Fix: added `data:` to `img-src` in `index.html`'s CSP (one line). Scoped narrowly — the only `data:`
image consumer anywhere in the app is this same locally-generated screenshot-tile compositing, not
remote/user content, so this isn't loosening anything a real attacker could leverage.

Verified via `npm run typecheck`, `npm run lint`, `npx vitest run` (221 passing, unchanged). Not
visually confirmed in a running window (standing Electron-sandbox limitation) — recommend
`npm run dev` with a 5+ line squad to confirm Copy Screenshot now succeeds end-to-end.

## Session 234 — Squad screenshot: drop editing chrome, stitch content taller than the viewport

User flagged 3 problems with the Squad editor's Copy Screenshot: the Saved Builds sidebar and each
line's "Remove line" button shouldn't be in the capture, the per-line expand/collapse dropdown
(individual per-slot boon icons) shouldn't render in the screenshot either way (collapsed or
dropped-down), and squads over 4 lines didn't fit — capture should accommodate all `MAX_PARTIES`
(10) lines.

- **Editing chrome**: `SquadCompEditorView` now moves `ScreenshotButton`'s capture target from
  `.squad-editor-body` (sidebar + party rows) down to a ref on `.party-rows` alone, so
  `BuildsSidebar` is never in the captured rect. New `screenshotMode` state, flipped on/off via
  `ScreenshotButton`'s new `onBeforeCapture`/`onAfterCapture` hooks, threads down to `PartyRow` as a
  prop: hides the ▸/▾ expand toggle and the Remove-line button, and forces `SlotTile`'s
  `showSummary` false regardless of whatever the toggle's live `expanded` state is (so a line left
  expanded from normal editing doesn't leak into the screenshot). The always-visible party-wide
  Boons/Conditions/etc. summary column is untouched — that's core squad content, not editing chrome.
- **Content taller than the window**: root cause is `capturePage` only ever grabs the currently
  on-screen portion of the page (documented as a known "v1 limitation" back when `ScreenshotButton`
  first shipped) — a squad with more than ~4 lines runs off the bottom of the window with nothing
  capturing what's scrolled out of view. Rewrote `captureElement` (in `ScreenshotButton.tsx`) to
  scroll+stitch: when the target doesn't already fit the viewport at its current scroll position, it
  scrolls the window in slices covering the target's full height (`getBoundingClientRect().height`
  reports the true layout height regardless of what's currently scrolled into view), captures each
  slice as a data URL via a new `captureRegionToDataUrl` IPC method, draws every tile onto one
  offscreen `<canvas>`, and writes the composited PNG to the clipboard via a new `writeImageDataUrl`
  IPC method — original scroll position restored in a `finally`. The original single-shot
  `captureRegion` path is kept as a fast path for content that already fits (the common case), so
  behavior for the Build editor's own screenshot is unchanged apart from now also being correct if
  it ever runs long enough not to fit.
- New IPC surface: `CaptureIpcChannel.captureRegionToDataUrl`/`writeImageDataUrl` (`capture-ipc.ts`,
  `capture-provider.ts`, preload bridge) alongside the existing `captureRegion`.

Verified via `npm run typecheck`, `npm run lint`, `npx vitest run` (221 passing, unchanged — no
existing test covered `ScreenshotButton`, which has no unit test since it's IPC/DOM-measurement-
driven). Not visually confirmed in a running window (standing Electron-sandbox limitation) —
recommend `npm run dev` locally with a squad of 5+ lines to confirm the stitched screenshot both
excludes the sidebar/chrome and captures every line.

## Session 233 — Renegade "Band Together" pairs double-counting into the aggregate Boon/Condition totals

User flagged (screenshot: a doubled "Daze — Darkrazor's Daring 2s" row in the Control section) that
Renegade debuffs/boons were "being generated twice ... because it's counting the base skill and the
band-together version as 2 separate skills." Confirmed exactly right: `ADDITIVE_FLIP_PAIRS`
(Icerazor's Ire/Darkrazor's Daring/Razorclaw's Rage/Breakrazor's Bastion, all 4 of Legendary
Renegade Stance's Band Together skills) deliberately keeps `withFlipChain` walking into its target
ids for the aggregate — the target carries real new content (e.g. Darkrazor's Daring's enhanced cast
adds Resistance/Protection) that must count toward totals. But the target's facts are a SUPERSET of
its base's, not a disjoint addition, and every `skillIds`-driven aggregate function
(`computeBoonConditionSources`/`computeAuraSources`/`computeComboSources`/`computeNamedFactSources`)
was pushing both ids' full fact sets unfiltered — so every fact the base and its enhanced cast
happen to SHARE (Icerazor's Ire's Vulnerability/Torment/Immobile, Darkrazor's Daring's 2 Stability
facts and its Daze) got counted twice.

Fixed with a new shared `extractSkillSourcesWithAdditiveDedup` helper in `sources.ts`: walks
`skillIds` same as before, but when the current id is an `ADDITIVE_FLIP_PAIRS` target, filters out
any extracted item whose content-key (same composite key `SkillsEditor.tsx`'s
`boonFactContentKey`/`namedFactContentKey`/`comboFactContentKey` already use for the identical
tooltip-side diff) was already emitted by its own base skill — the base's genuinely-new content
(Resistance, Barrier, Torment, Chilled, per pair) still counts, only the shared portion collapses to
one row. All 4 aggregate functions now go through this one helper instead of their own bare loop.

New regression test `additive-flip-pair-dedup.test.ts` (a real Legend5/Renegade build, all 4 pairs
live at once via the legend's fixed utility kit) — building it caught a real test-authoring trap
worth remembering: every Band Together skill's actual content lives entirely in
`synthetic-facts.json`, not raw `skills.json`, so a test copying `turret-and-mantra-flip-chain.
test.ts`'s loader pattern (which doesn't merge synthetics) silently sees empty facts for all of them.

Verified via `npm run typecheck`, `npm run lint`, `npx vitest run` (221 passing, 3 new).

## Session 232 — Icerazor's Ire's missing Immobile: pre-existing typo, not a Session 231 regression

User reported Icerazor's Ire (Revenant/Renegade) had "lost its Immob condition application" right
after Session 231 shipped. Traced it down: `synthetic-facts.json`'s entries for both 40485 (base
cast) and 72359 (Band Together-enhanced cast) spelled the status `"Immobilize"` instead of
`CONDITION_NAMES`' real `"Immobile"` — `classifyBoonCondition` does an exact-set-membership check,
so the fact was silently dropped on every extraction (not a duration bug, a total no-show).
Confirmed via `git show` against the commit immediately before Session 231's changes: the typo was
already there, byte-identical — genuinely pre-existing, not something that session caused. The
matching `wvw-fact-overrides.json` entries (`Immobile: 1.5` on both ids, PvE 2s -> WvW/PvP 1.5s)
were keyed off the same misspelled status, so fixing only `synthetic-facts.json` would have left
those silently unmatched too — fixed both together, plus the generating script's own
`MANUAL_OVERRIDES` comment/keys in `fetch-wvw-splits.ts` for consistency. New regression test
`icerazors-ire.test.ts`. Verified via `npm run typecheck`, `npm run lint`, `npx vitest run` (218
passing, 2 new).

## Session 231 — Revenant tooltip bug batch: Sword 4 flip, Facet of Elements flip, Draconic Fortitude health, Draconic Echo, Elevated Compassion WvW

User brain-dumped 7 Revenant bugs in one message (2026-08-19), flagging that the real list was
probably bigger than what they'd written down. Investigated all 7 to find precise root causes; fixed
the 5 that were cleanly scoped, left 2 (Herald F2/Core Value's shared "True Nature" legend-variant
mechanism, Rising Momentum's per-upkeep formula) as documented TODO.md follow-ups rather than guess
at unverified numbers — see that file's new "Revenant tooltip/data bugs" section for the full
writeup, including a related pattern the investigation surfaced (unlabeled multi-value trait facts,
confirmed at least in Salvation, scoped as its own future sweep).

**Sword 4 flip ("displaying a flip skill for a skill that doesn't exist")**: wiki-confirmed
Duelist's Preparation (28571, Revenant off-hand Sword 4) was removed from the game 2017-11-07 — the
live API still returns it as a Weapon_4 candidate with a stale `flipSkill: 28472` (Shackling Wave)
pointer, which `resolveSkillBarIds`' flip-target-removal heuristic read backwards (dropping the real
current skill, keeping the retired one). New `RETIRED_WEAPON_SKILL_IDS` table in `weapon-skills.ts`
excludes it up front; new regression test `weapon-skills.test.ts`.

**Facet of Elements missing its flip icon**: the live API's `flipSkill` is `null` for this one Facet
only (every sibling Facet has a real pointer) — wiki-confirmed it should flip to Elemental Blast
(51698, the auto-target id of a ground-targeted/auto-target duplicate pair, matching the id
`skill-variants.ts` already treats as canonical elsewhere). New `flip-skill-overrides.ts`
(`FLIP_SKILL_OVERRIDES`/`resolvedFlipSkillId`) is now consulted by `multi-effect.ts`'s
`flipTargetSkills` (tooltip), `boon-calc/sources.ts`'s `withFlipChain` (aggregate Boon/Condition
panel), and `skill-variants.ts`'s `stripFlipTargets` (picker — also generalized to drop a dropped
target's own same-name duplicate sibling, so Elemental Blast's ground-targeted twin doesn't surface
standalone). New regression test `flip-skill-overrides.test.ts`.

**Draconic Fortitude not changing the Health value**: genuinely new gap, not a curation miss —
`derived-stats.ts`'s `health` formula had no percent-bonus hook at all, only
`baseHealth + vitality * HEALTH_PER_VITALITY`. New `MAX_HEALTH_PERCENT_BONUSES`/
`maxHealthPercentTraitBonus` in `trait-attributes.ts` (same hand-curated-whitelist shape as
`CURATED_FLAT_BONUSES`), applied multiplicatively in `derived-stats.ts`. New test case in
`derived-stats.test.ts`.

**Draconic Echo missing its per-facet bonus text**: its 6 "Facet of Light/Darkness/Elements/
Strength/Chaos/Nature" facts are bare `duration: 0` `Buff` markers with no numbers — not a real
`classifyBoonCondition` status, so both `numericFactLines` and `boonConditionFactsForTrait` silently
dropped all 6 (same empty-marker-fact shape `strengtheningStanzasBranches` already solved for
Paragon's Chant markers). New `draconicEchoSections` in `branch-conditional-facts.ts`, wiki-verified
raw-wikitext numbers (pve 10% / wvw+pvp 5% per facet, no `alt=` split).

**Elevated Compassion showing Quickness in WvW**: wiki raw wikitext confirms Quickness is PvE-only —
WvW/PvP gets Vigor instead (2 different statuses per mode, not a duration split of one, so the
automated `fetch-wvw-splits.ts` scanner never had a chance to flag it). New
`1746: { Quickness: 'omit' }` entry in that script's `MANUAL_OVERRIDES.trait`, plus a matching
hand-edit of the already-generated `data/game-data/wvw-fact-overrides.json` (not a full script
re-run, to avoid touching any other already-curated entry).

Verified via `npm run typecheck`, `npm run lint`, `npx vitest run` (216 passing, 4 new).

## Session 230 — Build screenshot layout redesign, part 1: Equipment manifest, weapon-type bar, profession collapse

Kicked off a redesign of the Build editor's screenshot output (Discord-bot-facing down the road),
scoped to Equipment first per user direction — Traits/Skills/Stats/Boons-Conditions left as-is for
now. Iterated through 3 rounds based on user screenshots of the actual running app (electron sandbox
still blocks running it myself, per memory — this was the first time real screenshots drove fixes
mid-session).

**Equipment text manifest** (`EquipmentTextManifest.tsx`, new): a read-only, screenshot-only full
manifest of the equipment loadout — one line per armor/trinket slot, grouped Rune/Infusion counts
("Scholar ×6"), weapon sets with inline sigils, Relic/Food/Utility by name. Toggled into view via a
"Preview screenshot layout" button in `BuildEditorView`'s header (off by default, zero effect on
normal editing); renders as a full-width band below the 3-column layout, inside the same
`.build-editor-capture` ref `ScreenshotButton` captures, so it's included whenever it's open.

**Weapon-type selection moved out of the gear slots entirely**, twice-iterated:
1st attempt merged weapon-type into a small interactive corner badge overlaid on the stat-prefix
slot — confirmed via screenshot feedback to be unintuitive/hard to click, no other control in the
app works that way. Replaced with `WeaponTypeBar.tsx` (new): a dedicated gw2skills.net-style top
strip (badge per hand, "2H" label when locked) living in a new `.editor-profession-weapon-bar` row
above the 3-column layout — **outside** `.build-editor-capture` (deliberately, same as
Back/Name/Tags — pure editing chrome, not meant to appear in the screenshot).
`EquipmentEditor`'s Weapon panel is back to stat/sigil/infusion-only slots (structurally identical
to Armor slots again), and the shared two-handed-mirroring logic that used to live only in
`EquipmentEditor` moved to a new `weapon-slot-logic.ts` so both it and `WeaponTypeBar` stay in sync
off the same source of truth.

**Weapon panel moved into the top row** alongside Armor/Accessories/Other (was previously a
full-width row below them) — Weapon I/II now stack vertically inside their own panel instead of
sitting side by side, keeping the panel narrow rather than doubling the column's width. This plus
the weapon-type-bar move shrank the Equipment column's height substantially.

**Profession/elite-spec picker collapsed behind a popover** (`ProfessionSpecPicker.tsx`, rewritten):
same `FloatingPanel`/`usePickerOpen` mechanism `ProfessionTagPicker` already uses for the Builds-page
filter, single-select flavor — trigger is a bare icon (no circle border, no text label; a first pass
with both was flagged as clunky) showing the current pick, click opens the same profession-row +
elite-spec-grid popover, picking auto-closes it. Moved out of the Traits column entirely into the
new `.editor-profession-weapon-bar`, so Traits now starts right at the top of its own column (the
old "profession picker up top, Traits pushed down to fill slack" flex trick was removed as
dead weight along with it).

**Not done yet** — see TODO.md's "Build screenshot layout redesign" entry for the agreed next step
(Stats/Boons-Conditions/Skills reorg) and the open question of whether Traits ends up the height
bottleneck once that's done; the manifest band still isn't confirmed to fully fit on screen.

Verified via `npm run typecheck`, `npm run lint`, `npm test` (212 passing), `npm run build` — all
clean each round. No visual click-through beyond the user's own screenshots (electron sandbox
limitation, see memory).

## Session 229 — Gear Optimizer entry point + UI: inline trigger, centered modal, live stat comparison

Closed TODO.md's "Gear Optimizer entry point + UI" item. `GearOptimizerPanel` was a collapsible
full-width panel living below the entire 3-column build editor grid, disconnected from
"Equipment" — moved its trigger to an inline "Gear Optimizer" button next to the Equipment column's
`<h3>` (right-aligned via a new `.column-header-row` class), and the panel itself now renders as a
centered modal dialog (decided over a slide-over side panel) instead of an in-flow row.

Built a new generic `Modal` component (`src/renderer/components/common/Modal.tsx`) — portaled to
`document.body`, closes on Escape or a backdrop click — distinct from the existing anchor-relative
`FloatingPanel` popover. `GearOptimizerPanel` now takes `open`/`onClose` from `BuildEditorView`
instead of managing its own collapse state, but stays mounted regardless of `open` so its
floors/tiers/checkbox state survives being closed and reopened.

Added the live side-by-side stat comparison the TODO item asked for: a "Current vs. proposed" table
in the results, both sides calling `computeGearAttributeTotals` (same function the Stats panel's
left column already uses) against `draft.equipment` and `result.build.equipment` respectively — all
9 core attributes, with a color-coded delta column (`--toggle-on`/`--danger`, reusing existing
tokens). No new calculation needed, exactly as scoped.

Verified via `npm run typecheck`, `npm run lint`, `npm test` (212 passing), `npm run build` — all
clean. Electron sandbox limitation still applies (see memory), so this hasn't been visually
clicked-through in the running app yet.

## Session 228 — Profession/elite-spec icon artwork switch: Tango icons (GFDL), not the official wiki art

Picked up TODO.md's 2026-08-16 "switch profession icon artwork" item. Investigating the planned
source first (wiki's `Category:Profession_icons`, the "overhead"/"highres" official art) found the
same blocker that ruled out `Category:Equipment_slot_icons` before it: every file is tagged
`{{ArenaNet image}}` — "used with permission... does not include third party use" — confirmed live
2026-08-18 by reading `File:Guardian_(overhead_icon).png`'s raw wikitext. Not usable, so the original
overhead/highres plan is dead as scoped.

Found and verified a real alternative: the wiki's **Tango icons** (`Category:Profession tango
icons`), a separate community-drawn set tagged `{{GFDL image}}` — genuinely third-party-reusable,
unlike the official art. Confirmed coverage live for all 9 professions and all 36 current elite
specs (including the newest expansion's), all still actively tagged GFDL. User confirmed proceeding
with these despite the different (flatter, older fan-art) visual style, after seeing sample icons.

Also found: nothing in the current UI renders a profession/elite-spec icon above 36px
(`.spec-icon-button`), so the original overhead(small)/highres(large) split has no real use case —
one 48px size covers every location. User confirmed scoping to just that one size.

Built `scripts/fetch-tango-icons.ts` — resolves each profession/elite-spec's 48px Tango file URL via
the MediaWiki imageinfo API, and independently verifies the `{{GFDL image}}` template is present on
each file's raw wikitext (`action=raw`, not the shared `fetchWikiPage` cache — several base-profession
files have a soft `#redirect` to their profession's own article for wiki categorization, and the
cache's `redirects=1` query follows that and loses the license template entirely). Found one real gap
while writing it: Thief's `48px`/`20px` files are missing the GFDL tag even though the sibling
`200px` file has it — almost certainly a tagging omission, not an actual license difference, so the
script falls back to `200px` for any name whose `48px` fails the check. Fails the whole run loudly on
any unresolved name rather than shipping a silent gap. Output: `data/game-data/tango-icons.json`,
kept as its own wiki-sourced file (same shape as `elite-spec-skills.json`/`relic-effects.json`) so a
routine `fetch-game-data.ts` re-run can never silently blow it away — the same landmine
`itemstat-icons.json` hit once before this pattern was established.

Wired: `Profession.tangoIcon`/`Specialization.tangoIcon` (optional, elite-only) merged in at load
time by a new `withTangoIcons` in `load-game-data.ts`; all 5 consumers (`BuildsView.tsx`,
`BuildsSidebar.tsx`, `SlotTile.tsx`'s `eliteSpecIconFor`/ghost options, `ProfessionTagPicker.tsx`,
`ProfessionSpecPicker.tsx`) switched from `.icon` to `.tangoIcon`. Added to
`GAME_DATA_FILE_NAMES`/`electron-builder.yml`'s already-whole-directory `extraResources`, so it ships
in both packaged builds and the in-app data-refresh download. Added a GFDL credit line (with a link
to the wiki's Tango-icon page and the FDL license text) to the Settings tab's Credits panel, next to
the existing gw2skills.net one. `npm run typecheck`/`lint`/`test` all clean (212 tests). Full writeup
in `docs/game-data.md`'s new "Profession/elite-spec icon artwork" section. TODO.md's item closed and
removed.

## Session 227 — Relic proc integration sweep leg 7: Firebrand/Astral Ward, closing the sweep

Resolved the sweep's last 2 open relics (TODO.md's "Relic proc integration sweep"), closing the
whole section — no relics left open. Neither needed a wiki re-check; both were resolved by
re-examining the *shape* of the existing infra against each relic's already-known payload.

Relic of the Astral Ward (100388) wired after all: legs 2/5/6 had all deferred it as "a 2-step
signet mechanic worth its own leg" without testing that assumption against `RELIC_TRIGGER_GATES`'s
real behavior — the table never modeled per-relic proc frequency/cooldown to begin with (Relic of
the Chronomancer fires its Quickness on every single Well cast with no accounting for how often a
well is actually up). Astral Ward firing its payload on every 2nd Signet cast instead of every cast
(spawns "Signet of the Astral Ward" on the first, consumes it on the second) is the same category of
frequency detail this table already glosses over elsewhere, not a new non-deterministic-trigger
problem like the dodge relics. Wired as `{ kind: 'ability', categories: ['Signet'] }` in
`RELIC_TRIGGER_GATES`: its Resistance fact (2s, 5 allied targets) goes through the normal
`extractFromRelicFacts`/`computeBoonConditionSources` boon pipeline; its Conditions-Removed fact goes
into `RELIC_NAMED_FACT_SOURCES` as a `Cleanse` entry — the same split-payload shape (one boon, one
separate named-fact Cleanse) Relic of Febe already uses. The "every 2nd cast" nuance is stated
honestly in that entry's `detail` text rather than silently assumed away.

Relic of the Firebrand (100453) is permanently excluded instead, joining Sorrow/Leadership in that
bucket. Its payload ("+20% Boon Duration" for 4s after using the final charge of a mantra skill) was
already known not to fit `RELIC_TRIGGER_GATES`'s shape (a duration-percent modifier, not a discrete
boon status) — the open question was whether it fit the permanent-attribute-bonus infra
[[new_attribute_bonus_infra_2026-08-15]] built for Power Overwhelming/Deadly Strength. It doesn't:
that infra models a steady-state condition (an attunement held, a stack count accumulated) this app's
static build view can evaluate directly, while Firebrand's buff only exists for 4 seconds after a
trigger whose real-world frequency depends on how many charges the build's mantras carry and how the
player actually casts them — the same "no fixed frequency this app could assume without inventing
one" reasoning that already excludes the dodge relics and Unseen Invasion/Wayfinder's Superspeed. No
shape (existing or new) gives a temporary event-triggered percent-modifier anywhere honest to go, so
it's closed the same way Sorrow/Leadership were — excluded for good, not deferred; it was never in
`RELIC_TRIGGER_GATES` to remove, so no runtime code change for this half.

New/updated tests: `relic-sources.test.ts` (Astral Ward's Resistance, ability-gated on Signet, +2
tests), `relic-named-fact-sources.test.ts` (Astral Ward's Cleanse, moved out of the exclusion list),
`relic-named-fact-completeness.test.ts` (Astral Ward's exclusion entry removed, now covered by
`RELIC_NAMED_FACT_SOURCES`). `npm run typecheck` clean; all 3 relic test files pass (46 tests). See
`docs/relic-trigger-classification.md`'s "Leg 7" section for the full writeup. TODO.md's "Relic proc
integration sweep" section closed and removed entirely — this leg was its last open item.

## Session 226 — Relic proc integration sweep leg 6: Leadership/Twin Generals/Citadel wiki re-check

Closed 3 of the 5 relics legs 2/5 left open, via a direct wiki re-check of each (raw wikitext, not
paraphrased) rather than re-guessing from `relic-effects.json` alone. Relic of Leadership (100625):
permanently excluded — the wiki's own infobox confirms the payload is genuinely boon-less
(`Conditions Converted to Boons` names a count but never which boon(s) result, and no separate
mapping table exists on the wiki either). Relic of the Twin Generals (101767): wired for its flat
portion — the wiki confirms leg 2's read (a flat "6 stacks, 10s" Might grant plus a separate
per-enemy-hit-scaling "Might per Hit" fact) and surfaces a third fact this app had never considered,
Weakness (4s, on nearby enemies), also unconditional; `relicSources` now filters out only the
per-hit fact before parsing, letting Might + Weakness through as a `HEAL`-gated entry. Relic of the
Citadel (100448): wired, correcting leg 5's own assumption — leg 5 guessed the Stun's 1s-3s range
scaled with the triggering hit's defiance damage, but the wiki's Mechanics section says it's actually
a deterministic linear function of the *equipped Elite skill's own recharge* (1s at ≤60s cooldown up
to 3s at ≥180s), the same quantity Zephyrite's crystal duration already reads; new
`citadelStunDurationSeconds`/`citadelBuildStunDurationSeconds` in `sources.ts`, added to
`RELIC_TRIGGER_GATES` as `ELITE`-gated, moved out of `relic-named-fact-completeness.test.ts`'s
`EXCLUDED_RELIC_IDS`. New/updated tests: `relic-sources.test.ts` (Twin Generals base-Might + Weakness,
no double-count), `relic-named-fact-sources.test.ts` (Citadel's computed Stun duration at 2 different
elite-skill recharges), `relic-named-fact-completeness.test.ts`. Left Firebrand (100453) and Astral
Ward (100388) open — closed next in leg 7 (Session 227, above). See
`docs/relic-trigger-classification.md`'s "Leg 6" section for the full writeup. (Committed as
d8da623, prior to this session's own COMPLETED.md entry being written — the entry was missed at
commit time and backfilled here.)

## Session 225 — Relic proc integration sweep leg 5: Pack/Febe `MISCELLANEOUS_MATCHERS` follow-up

TODO.md's "Smaller follow-up" to leg 2: re-ran leg 1's audit discipline against
`computeNamedFactSources`'s `CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`/`BOON_STRIP_CORRUPT_MATCHERS`
matcher names instead of `BOON_NAMES`/`AURA_NAMES` — turned up 6 more real candidates beyond the 2
the TODO note already named (never in scope for leg 1's boon/aura-only audit): Relic of Cerus
(Corrupt), Relic of the Wizard's Tower (Pull), Relic of Dagda (Daze), Relic of the Water (Cleanse),
Relic of the Trooper (Cleanse), Relic of Bava Nisos (Cleanse) — plus Relic of the Pack (Superspeed)
and Relic of Febe (Cleanse) from the original note, 8 wired total. New `RELIC_NAMED_FACT_SOURCES`
table + `computeRelicNamedFactSources` in `sources.ts`, gated by `RELIC_TRIGGER_GATES` (extended with
6 new entries for the relics that were never boon/aura candidates). 7 other candidates reviewed and
excluded with a stated reason each: Citadel (assumed non-deterministic at the time — corrected and
wired in leg 6), Astral Ward (its own already-deferred 2-step mechanic — wired in leg 7), Unseen
Invasion/Wayfinder (non-deterministic stealth/combat-enter trigger), Founding/Mists Tide
(combo-gated), Mosyn (already dodge-excluded). New tests: `relic-named-fact-sources.test.ts`
(per-relic gate-satisfied/gate-unsatisfied regression, mirroring `relic-sources.test.ts`) and
`relic-named-fact-completeness.test.ts` (full-sweep regression guard, mirroring
`sigil-named-fact-completeness.test.ts`, so a future balance patch adding a new
Control/Miscellaneous/Strip/Corrupt/Cleanse relic fact fails CI instead of going unnoticed). See
`docs/relic-trigger-classification.md`'s "Leg 5" section for the full writeup. (Committed as f092bd0,
prior to this session's own COMPLETED.md entry being written — the entry was missed at commit time
and backfilled here.)

## Session 224 — Relic proc integration sweep leg 4: Relic of Sorrow, wiki-confirmed and closed for good

Closed the first of the 5 relics leg 2's `RELIC_TRIGGER_GATES` deferred (TODO.md's "Relic proc
integration sweep"). No code change — leg 2 had already reached the right answer purely from
`relic-effects.json`'s facts; this leg did the wiki re-check TODO.md still asked for before calling
it closed. The GW2 Wiki's raw wikitext for Relic of Sorrow confirms leg 2's correction word for word:
"After using an elite skill, create an area that protects allies and destroys enemy projectiles,"
with "pulsing healing and projectile destruction" plus "20% incoming strike damage reduction" as its
actual mechanics — no boon anywhere in the prose, and specifically never Protection. That matches
`relic-effects.json`'s facts exactly (`Healing` 660@0.25 coefficient, a custom `effect` fact literally
named "Relic of Sorrow," `Duration` 4, `Radius` 240, `Damage reduced` 20) — every one of those is
either already-rendered plain tooltip text via `formatRelicDescription` (no display gap to fix) or
outside what `BoonConditionSource`/`AuraSource` can represent at all (a flat damage-reduction zone and
projectile destruction aren't boons, auras, or named facts this app tracks anywhere).

Conclusion: Relic of Sorrow is permanently excluded from `RELIC_TRIGGER_GATES`, not a deferred
candidate — it was never a fit for that table's shape regardless of further curation.
`relic-sources.test.ts`'s existing "contributes nothing" regression test for 103424 already covers
this; only doc comments (`sources.ts`, `docs/relic-trigger-classification.md`'s new "Leg 4" section)
and the test's own comment were updated for accuracy. TODO.md's "Relic proc integration sweep"
narrowed from 5 to 4 remaining relics (Leadership, Twin Generals, Firebrand, Astral Ward) plus the
separate Pack/Febe `MISCELLANEOUS_MATCHERS` follow-up. `npm run test` clean (13/13 in
`relic-sources.test.ts`).

## Session 223 — Relic proc integration sweep leg 3: Relic of the Zephyrite, fully curated + wired

Closes the sweep's own motivating case (Session 220's 4th user-flagged bug). Two parts:

**Display data.** The wiki infobox's own `{{skill fact}}` template only ever exposed a Min/Max pair
(and had gone stale — Max read 7 against the wiki's current 8). The real stepped table ("Elite Skill
Recharge" → "Crystal Duration": 0s→4s, 1-20s→5s, 21-40s→6s, 41-60s→7s, ≥61s→8s) lives in the wiki's
prose, not its infobox, so `fetch-relic-effects.ts` could never have parsed it. Fixed via a new
`CURATED_RELIC_FACT_OVERRIDES` table in `src/shared/gear-calc/relic-effects-format.ts` (same "curated
table sits downstream of the generated JSON" shape `CURATED_PERCENT_FACT_OVERRIDES` already uses for
skill facts, so a `fetch-relic-effects` re-run can never silently wipe it) — the relic's tooltip now
shows all 5 tiers instead of a stale Min/Max pair.

**Aggregate wiring.** Zephyrite joins `RELIC_TRIGGER_GATES` (`{ kind: 'elite' }`), but unlike every
other entry, its granted duration isn't a flat pass-through of `relic-effects.json`'s own facts —
those (`protection`/`resolution`, both `1`) are the crystal's per-pulse tick, not its lifetime.
`relicSources` now reads the build's actual equipped elite skill's own `Recharge` fact and maps it
through the same stepped table (`ZEPHYRITE_CRYSTAL_DURATION_TIERS` in `boon-calc/sources.ts`),
overriding `baseDurationSeconds`/`scaledDurationSeconds` with the result. Revenant (2 legends, no
single "the" elite skill) takes the shorter of the two rather than guessing which legend is active —
`RevenantSkillSelection.activeLegendIndex` is explicitly display-only, so it stays unread here, same
as everywhere else in this file. Also fixed 2 stale doc comments this surfaced along the way
(`RelicEffect`'s own type doc comment and `docs/game-data.md`'s relic section both still said relic
facts are "deliberately NOT wired" into the uptime calculator — no longer true since leg 2).

5 new tests in `relic-sources.test.ts` (recharge tiers at both endpoints and the middle, no-elite-
equipped, Revenant min-across-legends including one legend whose elite carries no `Recharge` fact at
all) + a new `relic-effects-format.test.ts` (3 tests) locking in the curated display override.
`npm run typecheck`/`lint`/`test` all clean (179 tests). See `docs/relic-trigger-classification.md`'s
"Leg 3" section for the full writeup; TODO.md's "Relic proc integration sweep" narrowed from 6 to 5
remaining relics (Sorrow, Leadership, Twin Generals, Firebrand, Astral Ward — Sorrow closed next,
Session 224) plus the separate Pack/Febe `MISCELLANEOUS_MATCHERS` follow-up.

## Session 222 — Relic proc integration sweep leg 2: `RELIC_TRIGGER_GATES` mechanism + 10 relics wired

Designed and built the general "relic effect gated on an already-modeled trigger" mechanism leg 1
scoped: `RELIC_TRIGGER_GATES` + `relicSources`/`extractFromRelicFacts` in `src/shared/boon-calc/
sources.ts`, wired into both `computeBoonConditionSources` AND `computeAuraSources` (auras needed
their own pass — that field's own "'aura' entries only ever come from `computeAuraSources`" contract).
Only 2 of the 3 scoped gate shapes turned out real (single-slot Elite/Heal, category-matched
ability-type via a new `healUtilityEliteSkillIds` helper); the 3rd (mantra-final-charge) had no real
candidate — Relic of the Firebrand's payload is a "+20% Boon Duration" passive modifier, not a
discrete boon status.

Went further than "design only" and also curated + wired 10 of the 19 leg-1 candidates whose facts
were unambiguous literal `BOON_NAMES`/`AURA_NAMES` matches: Surging, Earth, Pack, Centaur, Durability,
Resistance, Febe, Reunification, Altruism, Fire, Chronomancer, Phenom, Sacred Grounds. The other 9
stayed deliberately unwired, each for a real reason (Zephyrite's stepped-duration gap, Sorrow's
misidentified payload, Leadership's unnamed boon, Twin Generals' variable per-hit Might, Firebrand's
attribute-modifier shape, Astral Ward's 2-step mechanic, plus Pack/Febe's facts belonging to a
different pipeline) — full list in `RELIC_TRIGGER_GATES`'s own doc comment and TODO.md. 9 tests in
`relic-sources.test.ts`.

## Session 221 — Relic proc integration sweep leg 1: classify all 112 relics' triggers

Full audit of every relic in `data/game-data/relics.json`, classifying each proc's trigger by whether
this app already models a deterministic frequency/timing for it — `docs/relic-trigger-classification.md`.
Turned out broader than scoped: `Skill.categories` already carries GW2's profession-mechanic category
strings (Meditation/Signet/Consecration/...) for every equipped Heal/Utility/Elite skill, so
ability-type-gated relics ("upon using a well/signet/mantra/cantrip/... skill") are just as
deterministic as the elite/heal-skill case already assumed elsewhere (Chants, Virtue Activates) — not
merely "possible." That widened the deterministic bucket. Of 112 relics, 19 land in a
deterministic-trigger bucket AND grant a real ally/self boon or aura payload — the only ones worth
wiring into `computeBoonConditionSources`; full 112-row classification table in the doc. The existing
dodge-relic exclusion (`DODGE_RELIC_IDS`) was kept as-is, not re-litigated.

## Session 220 — Relic of the Flock duplicate entry + Guardian Luminary's F1-F4 tooltip/Radiant Forge gaps

3 of the 4 bugs the user flagged 2026-08-16 during personal testing:

**Relic duplicate entries.** `relics.json` carried ~10 duplicate-name pairs (Flock, Warrior,
Necromancer, Citadel, Fireworks, Durability, Water, Evasion, Thief, Living City) — confirmed live
against the API: every pair is mechanically identical (same icon/description/effect), differing
only in acquisition flags (one member `SoulBindOnUse` only/tradeable, the other adds
`SoulbindOnAcquire`/`NoSell`/`NoMysticForge`/`NoSalvage`, a reward-track-bound copy). This was a
known, documented gap (`fetch-gear-upgrades.ts`'s own comment called it "left as-is, out of
scope"). Added `dedupeRelicsByName` (keeps the openly-obtainable member, falls back to lowest id)
and ran it by hand against the current `relics.json`/`relic-effects.json` (122→112 relics; both
files' existing entries for the surviving ids were unaffected, confirmed identical content between
each removed/kept pair first) rather than a full `fetch-gear-upgrades` re-run, to avoid the known
itemstat-icons.json revert risk (see memory). `combat-state.ts`'s `CURATED_RELIC_DAMAGE_BONUSES`
and `dodge-replacement-facts.ts`'s `DODGE_RELIC_IDS` already carried both ids of their own pairs
defensively, so nothing broke there.

**Luminary (Guardian's newest elite spec, released 2025-10-28) F1-F4.** Investigation found the
mechanic-bar icons themselves were never the problem — `profession-mechanic.ts`'s generic resolver
already picks the right id per slot with zero hand-injection (unlike Dragonhunter/Specter/
Vindicator's real API gaps). The actual gap: Radiant Justice/Resolve/Courage's own `facts` arrays
in the live API carry almost nothing (Recharge only, Courage also StunBreak) — same "real effect
lives entirely in the wiki's structured templates" shape as Otherworldly Bond/the Paragon Chants.
Added `radiantJusticeSections`/`radiantResolveSections`/`radiantCourageSections` to
`branch-conditional-facts.ts` (wiki-verified 2026-08-16), each modeling the Virtue's passive +
Activate effect plus its "Empowered `<weapon>`" bonus on the next Radiant Forge weapon-bar skill
use (Dazzling Hammer/Luminous Staff/Gleaming Blade/Radiant Bulwark) as its own labeled section.

**F4 "Radiant Forge"** turned out to be architecturally identical to Reaper Shroud, exactly as the
user suspected: entering it replaces the weapon bar with 5 fixed skills. Added
`RADIANT_FORGE_SLOT_SKILLS` to `bundle-skills.ts` (same shape as `NECRO_SHROUD_SLOT_SKILLS`/
`GUNSABER_SLOT_SKILLS`, wired into all 4 consumer functions) — Weapon_1 ("Glaring Burst") uses the
wiki's own canonical id since its real effect depends on a "which radiant weapon is currently
primed" sub-state this app has no field for yet (documented simplification, same class as Ele
Catalyst/Evoker's attunement/familiar-conditional F5); slots 2-5 use their real 2-hit chains' entry
ids. New `luminary.test.ts` (8 tests) locks in both the mechanic-bar resolution and the bundle/fact
wiring. `npm run typecheck`/`lint`/`test` all clean (163 tests).

Not fixed this session (documented, not re-scoped): Relic of the Zephyrite's elite-skill-use
trigger — a bigger, separate wiring gap, left for its own pass.

## Session 219 — Engineer Turret sub-abilities + a standard-profession `flipSkill`-chain gap

User-flagged 2026-08-16: Supply Crate's 2 flip skills ("Overcharge Supply Crate," "Detonate Supply
Crate Turrets") didn't show up anywhere in the app. Investigating found this wasn't Supply-Crate-
specific — the raw API's `Skill.flipSkill` field links AT MOST one of a Turret's 2 sub-abilities
(which one varies per turret with no pattern; Rifle Turret and Supply Crate link neither, since the
API's link happens to sit on a duplicate id the picker doesn't equip). New hand-curated
`TURRET_SUB_ABILITY_IDS` (`skill-calc/turret-sub-abilities.ts`, all 8 turret families) overrides the
raw field entirely, consumed by both `multi-effect.ts`'s `flipTargetSkills` (tooltip stacked icons —
the reported bug) and `boon-calc/sources.ts`'s `skillIdsForBuild` (aggregate Boon/Condition totals).

That 2nd consumer surfaced a separate, bigger gap while wiring it in: `skillIdsForBuild`'s standard-
profession (non-Revenant) branch never called `withFlipChain` at all — every OTHER category folded
into the aggregate totals already does (weapon skills, Revenant's own legends, the mechanic bar), but
the plain Heal/Utility/Elite branch was simply missing the call. Same "tooltip-correctness and
aggregate-contribution are separate code paths" trap as the 2026-08-15 `ProfessionMechanicBar` bug.
Concretely, this means every Firebrand Mantra build was missing its regular-charge skill's own Buff
facts (e.g. Mantra of Solace's "Restoring Reprieve" — Regeneration/Protection/Aegis) from the
aggregate panel entirely, not just the already-known-missing `MANTRA_FINAL_CHARGE_IDS` Final Charge
sibling — a real gap for what's a very commonly-played WvW support build. Fixed by adding the
`withFlipChain` walk (plus the Final Charge append `flipTargetSkills` already did for the tooltip) to
that branch; Turret ids use the new override table directly instead of trusting the raw field.

6 new tests: `turret-sub-abilities.test.ts` (table staleness + `flipTargetSkills` wiring, including
Supply Crate and Rifle Turret specifically) and `turret-and-mantra-flip-chain.test.ts` (an Engineer
Rifle Turret build and a Guardian Firebrand Mantra-of-Solace build, asserting the previously-missing
facts now appear in `computeBoonConditionSources`' output). `npm run typecheck`/`lint`/`test` all
clean (155 tests). TODO.md's Supply Crate bug entry closed.

## Session 218 — v1.0.1 patch: Boons/Condis Conditions-row scrollbar

`BoonConditionSummaryPanel`'s row-pairs (Conditions/Auras, Boons/Misc., Control/Strips-Corrupts-
Cleanses, Combo Fields/Finishers) split their two columns 50/50 via a fixed flex ratio. The left
column routinely has far more icons than its right-side partner (e.g. 12+ Conditions vs. 6
Auras), so it hit its per-row horizontal scrollbar while the right column's half sat mostly
empty. Left column (`:first-child`) now grows to absorb whatever width the right column
(`:last-child`) doesn't need instead of a rigid even split — fixes the scrollbar without touching
layout for pairs that were already balanced. `package.json`/`package-lock.json` bumped
1.0.0 → 1.0.1; tagged `v1.0.1` and published via the same electron-builder GitHub-publish recipe
Session 217 used.

## Session 217 — v1.0.0 release

Cut the 1.0 release per the user's 2026-08-12 goal (see TODO.md's now-closed "Path to 1.0" entry).
Both blocking gaps (visual click-through pass, automated test suite) closed 2026-08-13; this session
is just the mechanical release: `package.json`/`package-lock.json` bumped 0.3.0 → 1.0.0, README
Status/Roadmap updated to reflect that roadmap items 1-4 (scaffolding, build editor + boon/condition
calculator, squad preview builder, sync/share backend) are all implemented and released — Discord bot
and Capacitor port remain later, out-of-scope roadmap stages. Tagged `v1.0.0` and published via the
electron-builder GitHub-publish recipe (pre-created draft release to avoid the known duplicate-release
race, see COMPLETED.md's earlier `electron-builder-github-publish-race` note).

## Session 216 — Food catalog: closing the 76-buffless-entries TODO item

Closes the long-open TODO.md item about Food entries with no buff data. Investigation went well
past the original "76 dead items, filter them out" framing:

1. **Real bug in `borrowSharedContainerBonuses`** (`fetch-gear-upgrades.ts`): its sibling-matching
   `INDIVIDUAL_CONTAINER_PREFIXES` list was missing `Filet of `/`Loaf of ` — 9 "Feast of .../Tray
   of ..." items had a real buffed sibling under one of those two prefixes that the matcher simply
   never tried (e.g. "Filet of Rosemary-Roasted Meat" for "Feast of Rosemary-Roasted Meat").
   Verified 0 new ambiguous matches introduced across the rest of the catalog before landing it.
2. Individually wiki-checked (raw wikitext, not a rendered table, per
   [[healing_damage_coefficient_curation]]) every one of the remaining 66 buffless entries — found
   they split into two genuinely disjoint groups, not one:
   - **~18 real, wiki-documented Food items** the API's own `details` object comes back completely
     empty for (same shape as the pre-existing Ascended Gourmet Feast gap) — new
     `CURATED_FOOD_BUFFS` table + `applyCuratedFoodBuffs()` hard-codes each one's Nourishment
     duration/bonus lines from its own wiki page. A few (Pitcher of Desert-Spiced Coffee/Mocha of
     the Mists Coffee Pitcher/Feast of Carne Khan Chili/Feast of Dill Meatball Dinners) borrow
     their bonus text from a sibling per that sibling's own wiki Notes rather than a fresh lookup.
   - **48 confirmed genuinely-not-food items** — Mastery-point/karma currency, home-instance/
     crafting-material delivery, transformation tonics, achievement/collection fodder, one real
     "alcohol"-type collectible, two literal dead items ("Pile of Golden/Pink Sand" — wiki says
     outright "doesn't seem to do anything"), a zone-gated quest buff, a non-Nourishment festival
     curiosity (Candy Cane), and an 8-item "Bloodstone" joke-food family individually confirmed to
     deal real damage before granting, at best, a trivial non-combat buff. New `EXCLUDED_FOOD_IDS`
     set + filter drops these from the catalog entirely (documented per-category in the code
     comment) rather than leaving them buff-less.
3. `main()` now warns if any Food entry is still buffless after all three passes (borrow + curate +
   exclude) — a signal a future API/wiki patch added a new one — and logs the exclusion count.

Regenerated `food.json` from the existing `.cache/items-raw.json` dump (no network refetch needed).
Result: 859 → 811 Food entries, **0 buffless** (previously 76). Restored `itemstat-icons.json` from
git after the run per [[gw2skills_icon_permission_request]]'s known re-run side effect.
`npm run typecheck`/`lint` clean, `npm test` 149/149 passing.

## Session 215 — Food/Utility per-item rarity, closing the tooltip visual-pass item

Closes the last open piece of TODO.md's "Dedicated visual pass over every tooltip type" item
(traits/skills/gear stat prefixes/runes/sigils/relics/infusions were already done as of Session
141). Food and Utility are the only gear-upgrade categories whose real GW2 rarity varies per item
rather than being one fixed tier for the whole category, so they'd been left title-only, no rarity
border/color, pending this.

`Consumable.rarity` (raw GW2 API string, e.g. "Masterwork") added to `game-data.ts` and
`fetch-gear-upgrades.ts`'s `normalizeConsumable`; `food.json`/`utility.json` regenerated from the
existing `.cache/items-raw.json` dump (no network refetch needed — the raw API records already
carried `rarity`, it just wasn't copied through). Confirmed live data spans all 6 tiers Food/
Utility actually use: Basic (129), Fine (543), Masterwork (303), Rare (39), Exotic (36), Ascended
(69) — no Junk or Legendary consumables exist in either catalog.

`UpgradePicker.tsx` gained an exported `UpgradeRarity` type (`'basic' | 'fine' | 'masterwork' |
'rare' | 'exotic' | 'ascended'`) and `toUpgradeRarity()` mapper, plus a new optional `rarity` field
on `UpgradeOption` — per-option rarity now wins over the picker-level fixed `rarity` prop wherever
both could apply. `Tooltip.tsx`'s `TooltipBody` and `global.css` extended with a `--rarity-
masterwork` (green) token and `.rarity-masterwork` border/title rules to cover the one tier that
had no color defined yet; `'basic'` deliberately renders unstyled (no CSS rule), matching GW2's own
convention of not highlighting Basic-rarity items. `EquipmentEditor.tsx`'s `foodOptions`/
`utilityOptions` now pass `rarity: toUpgradeRarity(item.rarity)` through.

As always in this environment, the Electron sandbox limitation (see memory) blocked launching the
real app to eyeball it — re-confirmed unchanged (`npm run dev`'s Electron process still crashes on
`electron.app.isPackaged` being undefined, same signature as every prior attempt). Verified instead
via `npm run typecheck`/`lint` (both clean) and `npm run test` (149/149 passing), plus a direct read
of the regenerated JSON confirming real rarity variety lands where the picker will render it.

## Session 214 — Equipment editor "Clear All" buttons

Closes the TODO.md nice-to-have flagged by the user 2026-08-11 ("a 'clear all' button per row").
Landed as panel-level clears (Armor, Accessories, Weapon — each wipes every slot in that panel,
stat prefix included) plus per-upgrade-type clears on the copy-paste bar (Rune/Sigil/Infusion —
not Stat Prefix, which has no meaningful empty state). New `clearAll` glyph in `SkillBarIcon`;
`.gear-panel-header`/`.gear-panel-header-actions` in `global.css` for the button layout. Commit
c581568.

## Session 213 — Seize the Moment: occurrence-indexed WvW instance-value overrides

Third and last of TODO.md's "new attribute-bonus gaps needing new CombatState infra" item (Mesmer/
Illusions, Major tier 3, id 2022) — closes the whole item. Re-verified via raw wikitext 2026-08-15
(matches the 2026-08-14 scoping note exactly): the trait grants 2 *different* Quickness concepts —
"Quickness per Clone" (pve 1s/pvp 0.75s/wvw 0.5s) and a separate unlabeled base grant on phantasm
summon (pve 3s/pvp 1s/wvw 0.75s) — 6 raw values total, but the live API's own `duration` field rounds
5 of the trait's 6 raw facts down onto a shared `1` bucket (only the base's pve value, 3, stays
unique), so the wvw-precise values (0.5s/0.75s) don't exist as literal numbers anywhere in
`traits.json`. `WvwFactOverride` (one number per status per source) structurally can't represent 2
different concepts sharing one status, which is exactly why this sat blocked since 2026-08-14.

New mechanism in `sources.ts`: `WvwInstanceOverride` (`number | 'omit'`) + `BUFF_INSTANCE_VALUE_
OVERRIDES` (`{ skill; trait }`, same `${status}@${duration}@${applyCount}[#${occurrence}]` key scheme
`BUFF_INSTANCE_LABELS` already uses) + `resolveInstanceValueOverride` (mirrors `resolveInstanceLabel`'s
lookup exactly). Wired into `extractFromFacts` ahead of the existing per-status `wvwOverrides` check:
when a per-occurrence override exists, it fully decides that occurrence's fate (a corrected duration,
or dropped as a non-WvW duplicate) and the per-status collapse logic never runs for it; everything
without a curated entry falls through unchanged. Seize the Moment's own entry: occurrences #1/#2/#4 of
the `Quickness@1@1` tuple (per-Clone pve/pvp, base pvp) and the sole `Quickness@3@1` fact (base pve)
are omitted; #3 (per-Clone) corrected to 0.5, #5 (base) corrected to 0.75 — 6 raw facts collapse to
exactly 2 emitted rows matching the wiki's real structure. `BUFF_INSTANCE_LABELS`' existing 2022 entry
trimmed from 3 keys down to 1 (occurrences #1/#2 now never emit at all, so their labels were dead).

New `buff-instance-value-override.test.ts`, run directly against the real `traits.json` entry for
2022 (not a synthetic fixture): confirms exactly 2 rows emit, the labeled one carries 0.5s, the
unlabeled one carries 0.75s. `npm run typecheck`, `lint`, and the full `vitest run` suite (149 tests)
all pass. TODO.md's "new attribute-bonus gaps needing new CombatState infra" section is now fully
closed and removed (Power Overwhelming/Deadly Strength from the prior 2 sessions, Seize the Moment
this one) — all 3 items resolved across 3 sessions in one day.

## Session 212 — Deadly Strength: new deathsCarapaceStacks CombatState field

Second of TODO.md's 3 "new attribute-bonus gaps needing new CombatState infra" items (Necromancer/
Death Magic, Major tier 2, id 855). Confirmed via a fresh wiki lookup 2026-08-15
(wiki.guildwars2.com/index.php?title=Death%27s_Carapace&action=raw) that Death's Carapace itself
(the buff Deadly Strength scales off of) carries its own baseline effect not previously scoped:
"Increased toughness per stack," +20 Toughness/stack WvW+PvE (PvP 10, reduced 2020), max 30 stacks —
this is the *buff's* own grant, separate from Deadly Strength's trait-specific +10 Power/+10
ConditionDamage per stack (unchanged from the 2026-08-14 scoping note).

New `CombatState.deathsCarapaceStacks` field (0-30, defaults 0) — same "manual what-if stepper"
shape as `kallaFervorStacks`, since how Carapace stacks actually accumulate mid-fight (on Shroud
entry via Armored Shroud, on kill via Soul Comprehension, on heal-skill-use via Dark Defense) isn't
something a static build snapshot can simulate. New `combat-state.ts` exports: `DEATHS_CARAPACE_
TOUGHNESS_PER_STACK`/`DEATHS_CARAPACE_MAX_STACKS` (the buff's own baseline, applied whenever stacks
> 0, mirrors `MIGHT_POWER_PER_STACK`'s always-on shape), `DEATH_MAGIC_SPECIALIZATION_ID` (gates the
new UI stepper, mirrors `RENEGADE_SPECIALIZATION_ID`), `DEATHS_CARAPACE_ATTRIBUTE_TRAIT_BONUSES` +
`deathsCarapaceAttributePoints` (Deadly Strength's own per-stack add-on, mirrors `MIGHT_STACK_
ATTRIBUTE_TRAIT_BONUSES`'s shape), wired into `combatStatePoints`. New `DEATHS_CARAPACE_ICON` in
`icons.ts` (pulled from Armored Shroud's own Buff fact). `CombatStatePanel` gets a new stepper row,
gated on Death Magic being equipped (same visibility pattern as every other build-conditional
control in that file), with a 5-increment dropdown (0/5/.../30) matching `STACK_OPTIONS`'s own
convention rather than Kalla's Fervor's every-integer one (its 0-30 range is too wide for that).

Scoping decision, made this session: Soul Comprehension/Armored Shroud/Dark Defense's own Carapace-
*granting* sides don't need separate curation — they're not character-stat formulas of their own,
just descriptive mechanics already visible on each trait's own generic tooltip (unaffected by this
change), and the manual stepper is deliberately how this app sidesteps needing to simulate them (same
reasoning `kallaFervorStacks` already established for Kalla's Fervor's own granting side). Soul
Comprehension's separate "gain life force per stack on shroud entry" clause stays out of scope too —
Life Force is a resource this codebase doesn't track anywhere, same "resource gain, not a character-
stat gain" exclusion already applied to Boon of Creation/Spiteful Fortitude elsewhere in this file.
This closes the full family, not just Deadly Strength's own trait id.

`trait-attribute-completeness.test.ts` updated: trait 855 moved from `EXCLUDED_TRAIT_IDS` into the
covered-ids union via the new `DEATHS_CARAPACE_ATTRIBUTE_TRAIT_BONUSES` table (Soul Comprehension/
Armored Shroud/Dark Defense were never flagged by that scan in the first place — none of their facts
are the `AttributeAdjust`/`BuffConversion` shape it checks for). 3 new unit tests in
`combat-state.test.ts` cover the baseline-only, baseline+trait, and trait-inactive cases. `npm run
typecheck`, `lint`, and the full `vitest run` suite (146 tests) all pass. TODO.md's item for this
family is closed; only Seize the Moment (Mesmer 2022, needs a new multi-value WvW override mechanism,
a different subsystem entirely — boon-calc, not gear-calc) remains open in that TODO.md section.

## Session 211 — Power Overwhelming: might-threshold + attunement-doubled Power bonus

First of TODO.md's 3 "new attribute-bonus gaps needing new CombatState infra" items (Elementalist/
Air, Major tier 2, id 334). Re-verified live via raw wikitext 2026-08-15 (matches the 2026-08-12
scoping note exactly): "While at or above the might threshold, gain increased power. Power bonuses
are doubled while attuned to fire." — flat +150 Power once `mightStacks >= 8` (this app's WvW/PvP
threshold; PvE is 10), doubled to +300 while `build.activeAttunement === 'Fire'`.

Needed no new `CombatState` field — both inputs (`state.mightStacks`, `build.activeAttunement`)
already exist and already have UI controls (the Might stepper, the F1-F4 attunement picker), so this
was a pure calc-layer addition. New `MIGHT_THRESHOLD_ATTUNEMENT_DOUBLED_ATTRIBUTE_TRAIT_BONUSES`
table + `mightThresholdAttunementDoubledAttributeTraitBonus` in `combat-state.ts`, wired into
`combatStatePoints` alongside the existing per-stack Might block. New shape, distinct from every
sibling family already in that file: a hard threshold gate (nothing below 8 stacks, not a smaller
scaled amount) combined with a doubling multiplier on top (same "doubling isn't its own fact" pattern
Forceful Greatsword/Blood Reaction already documented elsewhere in this file) — no other trait in
`traits.json` shares this combined shape yet, so the table stays single-entry for now.

`trait-attribute-completeness.test.ts` updated: trait 334 moved from `EXCLUDED_TRAIT_IDS` (logged as
a genuine-but-unmodeled gap) into the covered-ids union via the new table, keeping the completeness
scan's invariant intact. 4 new unit tests in `combat-state.test.ts` cover below-threshold/at-threshold/
doubled/trait-inactive. `npm run typecheck`, `lint`, and the full `vitest run` suite (139 tests) all
pass. TODO.md's item for this trait is closed; Deadly Strength (855, needs a new
`deathsCarapaceStacks` field) and Seize the Moment (Mesmer 2022, needs a new multi-value WvW override
mechanism) are still open in the same TODO.md section.

## Session 210 — Problem 3 of TODO.md's dodge-roll item: relic dodge-triggers

Closed the last of the 3-part dodge-roll item (Sessions 199-209 did problems 1/2). Full text scan of
`data/game-data/relics.json` for "dodge"/"evad" found 8 relic ids (7 distinct relics — Relic of
Evasion has 2 ids for the same effect, same pattern `CURATED_RELIC_DAMAGE_BONUSES` already documents
for Relic of Fireworks) whose full effect triggers on dodge rolling or evading an attack: Relic of
Isgarren (99997, Eye of Isgarren debuff), Relic of the Mirage (100158, Torment 6s×2), Relic of the
Daredevil (100345, guaranteed crit), Relic of Evasion (100614/100886, Vigor 5s), Relic of Mosyn
(101801, cleanse 1 nondamaging condition), Relic of Rivers (103015, Alacrity 1s + Regeneration 3s),
Relic of Fog (107030, guaranteed glancing blow on next incoming strike). Deliberately excluded Relic
of the Living City (104928/104938, "Titanic Potential"): evade is only 1 of 5 unrelated triggers
toward its payoff, not a dodge-triggered effect in the scope this item means — same "much larger
mechanic of its own" reasoning Session 209 used to exclude Mirage Cloak/Ambush skills.

TODO.md's original framing for this problem ("only flavor text — same empty-facts problem again") was
actually wrong: `data/game-data/relic-effects.json`'s wiki-sourced facts already cover all 7 relics
(Alacrity 1/Regeneration 3, Vigor 5, Torment 6×2, etc.) and were already showing correctly on the
relic's own gear-picker tooltip via `formatRelicDescription`. There was no missing data to curate —
just a missing surface to see it without opening the gear picker, which is what Session 209's
`DodgeIndicator.tsx` was already built for.

**`relicDodgeContent`, new in `dodge-replacement-facts.ts`** — looks up the equipped relic
(`build.relicId`) against a curated `DODGE_RELIC_IDS` set and, when it matches, reuses
`formatRelicDescription` wholesale (the same function `EquipmentEditor.tsx`'s relic picker already
calls) rather than hand-building new `numericLines`/`facts` — there's no new data to shape, just the
already-curated relic tooltip surfaced in one more place. `facts` is always `[]`: `RelicEffect`'s own
doc comment in `types/game-data.ts` already documents why relic facts stay out of
`computeBoonConditionSources` entirely (a relic fires on a conditional player action with no fixed
uptime guarantee, same as any other relic trigger) — a dodge roll doesn't change that, so this stays
display-only by design, not a leftover gap.

**`DodgeIndicator.tsx`** changed from "at most 1 row" to "0-2 rows": Problem 2's trait-keyed content
and Problem 3's relic-keyed content are independent (any profession can equip any relic), so e.g. a
Vindicator running Relic of Rivers now shows both Tenacious Ruin's reskin AND Rivers' Alacrity/
Regeneration as separate rows, filtered from `[professionContent, relicContent]`.

`npm run typecheck`, `lint`, and the full `vitest run` suite (135 tests) all pass — no dedicated test
file added, matching Session 209's own precedent (no completeness scan exists for this category yet).
TODO.md's dodge-roll item is now **fully closed** — all 3 problems done.

## Session 209 — Problem 2 of TODO.md's dodge-roll item: Vindicator + Daredevil dodge indicator

Built the small above-skill-bar indicator the user proposed for "whole alternate dodge-replacement
mechanics" (no skill id in `skills.json` at all, same shape Otherworldly Bond had before it was
curated) — scoped to Vindicator + Daredevil only, per user decision: Mirage Cloak itself grants no
quantifiable facts beyond unlocking Ambush skills (a separate, much larger feature), and its real
boon-granting modifier traits are already covered by Sessions 203-208's labeling work instead.

**New `src/shared/skill-calc/dodge-replacement-facts.ts`** — `vindicatorDodgeContent`/
`daredevilDodgeContent`, keyed by which traits are active (not a skill id, unlike
`branchConditionalFacts`) since none of this has one. All numbers wiki-verified via raw wikitext
2026-08-15 (WvW values, this app's usual convention):
- **Vindicator**: Tenacious Ruin (minor trait 2262, always active once the spec line is equipped) is
  the base "instead of dodging, deliver a blow" — Damage coefficient 1.0, unequipped weapon strength,
  5 targets, radius 240, computed with the same `weaponStrength * coefficient * power / targetArmor`
  formula `damage-calc.ts` uses (not threaded through `CURATED_DAMAGE_COEFFICIENTS` itself — that
  table's scope is real `Skill` lookups via `damageLinesForSkill`, and these proc skills have no
  skill-bar slot to hang one off). Reskinned by whichever of the 3 mutually-exclusive Grandmasters is
  chosen: Forerunner of Death 2257 → Death Drop (proc skill 62693): coefficient 2.22 WvW, radius
  shrinks to 180, Vulnerability 10s×5 (already reaches the aggregate panel via
  `synthetic-trait-facts.json`, repeated here display-only for a single "everything my dodge does"
  view), self "+15% Damage" 10s (non-tracked custom status, plain text). Vassals of the Empire 2232 →
  Imperial Impact (62859): coefficient 0.625 WvW (the API's 3 "duplicate" Damage facts are actually 3
  different game modes' single value, not 3 real hits), Might 8s×3/Protection 2s×1 WvW, 5 foes + 5
  allies, radius unchanged at 240 — Chilled deliberately dropped, wiki tags it PvE-only with no WvW/PvP
  line at all. Saint of zu Heltzer 2238 → a newly-found proc skill **Saint's Shield** (62689, same icon
  as the trait, found via a wiki page fetch after `specializationId: null` hid it from the same lookup
  that found the other 2 procs): replaces Damage with Healing AND Barrier, `300 + 0.2 × healingPower`
  WvW each (same formula shape as `CURATED_HEALING_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`,
  computed inline since neither table has a live fact to attach to), radius grows to 300, self "+20%
  Healing to Others" 6s. Alacrity is deliberately EXCLUDED — Saint's Shield's own live fact for it is
  real but wiki-confirmed PvE-only (Session 206's reversal), and this indicator must stay consistent
  with `synthetic-trait-facts.json`/`DODGE_TRIGGER_NOTES` already omitting it.
- **Daredevil**: no default content (Physical Supremacy, the actual always-on mechanic, only grants a
  3rd endurance bar) — returns content only when exactly one of the 3 mutually-exclusive GM traits is
  chosen (Lotus Training 1833 "+15% Condition Damage", Unhindered Combatant 1964 "-10%
  Incoming/Incoming Condition Damage" + its Exhaustion side-effect, Bounding Dodger 2047 "+15%
  Damage"), all WvW 4s (PvE 6s, same percentage — a common 2025-06-24 patch pattern across all 3). All
  3 grant a non-`BOON_NAMES` custom self-buff with no tracked consumer (already confirmed out of
  `DODGE_TRIGGER_NOTES`' scope, Session 207) — plain text lines, same treatment
  `strengtheningStanzasBranches` gives Paragon's Chant bonuses.

**New `src/renderer/components/build-editor/DodgeIndicator.tsx`** — renders 0 or 1 small (24px,
smaller than the 48px `skill-slot-button`) unclickable icon above `.ingame-skill-bar` (next to
`WeaponSkillBar`'s existing "extras" row), with a `Tooltip`/`factsBlock` tooltip built the same way
every other skill/trait tooltip in this app is. Wired into `SkillsEditor.tsx` right before the main
bar div; new `.dodge-indicator-bar`/`.dodge-indicator-icon` CSS in `global.css`.

All `facts` this module produces are DISPLAY-ONLY, passed straight to `factsBlock` for rendering —
never registered with `computeBoonConditionSources`, so Vulnerability/Might/Protection showing here
too (already counted via `synthetic-trait-facts.json` elsewhere) can't double-count into any total.

Sanity-checked all 8 branches (3 Vindicator GMs + base + null, 3 Daredevil traits + null) via a
throwaway `tsx` script against the real formula by hand before deleting it — Tenacious Ruin base
Damage 665, Death Drop 1,476, Imperial Impact 415, Saint's Shield Healing/Barrier 600 (all at
Power 2500/Healing Power 1500/target Armor 2597), matching hand-calculated formula results exactly.
`npm run typecheck`, `lint`, and the full `vitest run` suite (135 tests) all pass.

TODO.md's dodge-roll item's problem 2 is now DONE for Vindicator + Daredevil (Mirage Cloak
deliberately out of scope, see TODO.md's own note). Problem 3 (relic dodge-triggers, e.g. Relic of
Rivers) remains open — could reuse `DodgeIndicator.tsx`'s same component once curated.

## Session 208 — Dodge-trigger labeling: terminology re-sweep (`mirage cloak|evade|evasion|death drop`)

While scoping TODO.md's dodge-roll item's problem 2 (whole dodge-replacement mechanics), re-ran problem
1's labeling sweep with a wider net: every prior sweep (Sessions 203/205/207) searched `traits.json`
descriptions for the substring `dodge`/`dodging`, which can never match profession-specific synonyms —
Mesmer's dodge roll is always narrated as gaining "Mirage Cloak," and several evade-frame traits across
professions are worded "evade an attack" with no "dodge" anywhere in the description.

Triage (wiki-verified via raw wikitext):
- **4 genuine labeling gaps, added to `DODGE_TRIGGER_NOTES.trait`**: Mental Gymnastics 705 (Mesmer/
  Dueling) and Primal Reflexes 1067 (Ranger/Skirmishing) — both "When you successfully evade an attack,
  gain vigor" → `'On Evade'`, same breadth as Upper Hand 1295. Wandering Mind 1960 (Mesmer/Dueling) —
  "Remove a nondamaging condition and gain swiftness whenever you evade an attack" → `'On Evade'`.
  Renewing Oasis 2082 (Mesmer/Mirage) — "Gain regeneration when you gain Mirage Cloak" → `'On Mirage
  Cloak'` rather than folded into `'On Dodge'`, since Dune Cloak (2169) can also grant Mirage Cloak via
  Shatter, not just dodging — the real trigger is broader than a bare dodge roll, same "label the actual
  breadth" call as `'On Block or Dodge'`. All 4 already carried a real, duration-bearing `Buff` fact
  (Renewing Oasis's dual PvE/WvW Regeneration facts already deduped by a pre-existing
  `wvw-fact-overrides.json` entry) — no `synthetic-trait-facts.json` merge needed.
- **7 confirmed already out of scope, no code change**: Instant Reflexes 1112 GRANTS evasion (wrong
  direction — a source of evade frames, not a trigger off them). Hunter's Fortification 1908 and
  Escapist's Fortitude 2023 are heal/condition-cleanse only with no Buff fact — Healing never enters this
  table's pooled aggregate panel, same standing exclusion as Selfless Daring/Healer's Gift/Master's
  Fortitude. Infinite Horizon 2070 grants Mirage Cloak to the player's illusions, not a boon to the
  player. Elusive Mind 2113's "Conditions Removed" is a `Number` fact with no `duration` field, same
  non-issue as Stop, Drop, and Roll/Pain Response. Speed of Sand 2117 is a flat `Percent` movement-speed
  bonus, not a `BOON_NAMES`-tracked Swiftness grant. Dune Cloak 2169 runs the mechanic in reverse
  (Shatter grants Mirage Cloak, not the other way around) and has no Buff fact of its own.

Updated `DODGE_TRIGGER_NOTES`'s doc comment in `sources.ts` with the same inline-triage convention the
last 3 sessions established. `npm run typecheck`, `lint`, and the full `vitest run` suite (135 tests)
all pass — no test file references this table directly. This closes out every candidate both the
original and this sweep could find; problem 1 stays fully done. Problems 2 (whole dodge-replacement
mechanics: Vindicator's Legendary Alliance dodge, Mirage Cloak, Daredevil's Lotus Training/Unhindered
Combatant/Bounding Dodger) and 3 (relic dodge-triggers) remain open — picking up problem 2's design
next in the same session.

## Session 207 — Dodge-trigger labeling: the "~10 more Dodging-worded traits" follow-up leg

Closed out the last open piece of TODO.md's dodge-roll item's problem 1 (labeling): the ~10
"Dodging"-worded traits (`/dodg/i`, not `/dodge/i`) that Session 203's original sweep missed and
Session 205 logged but left untriaged (Stop, Drop, and Roll 360; Evasive Purity 1054; Pain Response
1237; Expeditious Dodger 1240; Weakening Strikes 1887; Light on your Feet 1912; Psychic Riposte 2211;
Duelist's Reversal 2215; Tenacious Ruin 2262; Mayhem 2427).

Triage (wiki-verified via raw wikitext for the boundary cases):
- **3 genuine labeling gaps, added to `DODGE_TRIGGER_NOTES.trait`**: Expeditious Dodger 1240 ("Gain
  swiftness upon dodging" → `'On Dodge'`) and Weakening Strikes 1887 ("Your next attack after dodging
  causes weakness to foes struck" → `'On Dodge'`, its Weakness fact's PvE/WvW split already deduped by
  a pre-existing `wvw-fact-overrides.json` entry) both already carried a real, duration-bearing `Buff`
  fact — no `synthetic-trait-facts.json` merge needed, unlike the Session 205 pair. Duelist's Reversal
  2215 ("Blocking or dodging an attack grants boons," Quickness/Fury/Regeneration) triggers on block
  OR dodge — broader than a bare dodge, so labeled distinctly (`'On Block or Dodge'`) rather than
  folded into `'On Dodge'`, same treatment Upper Hand 1295 got in Session 203.
- **7 confirmed already out of scope, no code change**: Stop, Drop, and Roll 360 and Pain Response 1237
  are condition-CLEANSE traits — their removed-condition `Buff` facts carry no `duration` field at all,
  so `extractFromFacts`'s existing `typeof fact.duration === 'number'` gate already filters them out
  (same non-issue as Evasive Purity 1054, which has no `Buff`-type fact at all). Light on your Feet
  1912's "Light on Your Feet" self-buff and Psychic Riposte 2211's "blades" resource counter are
  non-`BOON_NAMES`/`CONDITION_NAMES` custom statuses with no tracked consumer. Tenacious Ruin 2262
  (Vindicator dodge-replacement) has a real `Damage` fact already visible on its own trait tooltip, but
  `Damage` facts are outside this Boon/Condition table's scope entirely — unlike Legendary Alliance
  dodge/Mirage Cloak, the API doesn't give it nothing, it just gives it a different fact type. Mayhem
  2427's Torment fact belongs to Flustering Flute (the skill it modifies), not to dodging — the trait's
  actual dodge tie-in is only a non-boon recharge reduction, so labeling its Torment "On Dodge" would
  have misattributed it.

Updated `DODGE_TRIGGER_NOTES`'s doc comment in `sources.ts` to record the full triage inline (matching
the file's existing convention for this table) instead of leaving it as an open list. `npm run
typecheck` and the full `vitest run` suite (135 tests) both pass — no test file references this table
directly. TODO.md's dodge-roll item's problem 1 is now fully closed; problems 2 (whole
dodge-replacement mechanics: Vindicator's Legendary Alliance dodge, Mirage Cloak, Daredevil's Lotus
Training/Unhindered Combatant/Bounding Dodger) and 3 (relic dodge-triggers) remain open.

## Session 206 — Correction: Saint of zu Heltzer's Alacrity fix (Session 204) was wrong, reverted

Same-day user catch, via a wiki screenshot of Saint of zu Heltzer's version history: the June 2025
patch note reads "This trait now applies alacrity to allies affected by your dodge **in PvE only**" —
with no WvW-tagged fact on the page at all, not a PvE/WvW split. This app never displays a fact
confirmed absent in WvW anywhere else: `wvw-fact-overrides.json` already independently resolves this
exact shape to `'omit'` (`resolveOverride`'s `pveLines.length === 1 && wvwLines.length === 0` case in
`fetch-wvw-splits.ts`, verified live against skill 62689's own entry — it already said
`"Alacrity": "omit"` before this session started). Session 204's fix bypassed that: the synthetic-facts
merge re-keys the fact under the TRAIT's id (2238), which has no `wvw-fact-overrides.json` entry of
its own, so the normal omit-resolution never ran against it — the fact was copied over at its raw PvE
value instead, with a comment rationalizing it as "still party-wide when it applies." In hindsight
that was inconsistent with how every other PvE-only fact in this codebase is treated, and is also
exactly why the original Session 203 sweep never flagged this trait as a gap in the first place — an
`'omit'`-resolved fact and a genuinely-absent fact look identical to a sweep that only checks "does a
tracked Buff fact reach the trait."

Reverted cleanly: removed the `"2238"` entry from `synthetic-trait-facts.json` (its Alacrity fact was
the only thing in it — the trait's own real "Saint of zu Heltzer" self-buff fact, untouched by this
mechanism, stays exactly as before) and the matching `TARGET_COUNT_OVERRIDES.trait`/
`DODGE_TRIGGER_NOTES.trait` "2238" entries in `sources.ts`. Updated every doc comment that described
the now-reverted behavior (`sources.ts`'s `DODGE_TRIGGER_NOTES` doc comment, `load-game-data.ts`'s
`withSyntheticTraitFacts` doc comment, `docs/game-data.md`'s synthetic-trait-facts section) to record
both what happened and why, rather than silently deleting the history. Forerunner of Death (2257) and
Vassals of the Empire (2232), fixed in the same Session 205 pass, were NOT affected — both are
wiki-confirmed to genuinely apply in WvW (Death Drop's Vulnerability is unsplit across game modes;
Imperial Impact's Might/Protection have a real, already-cached WvW value).

Verified via a throwaway script (same `readJson`+merge logic as Session 205's, run via `tsx`) —
trait 2238 now merges to only its own untracked self-buff fact, no Alacrity; 2257/2232/1446 unchanged.
`npm run typecheck` and the full `vitest run` suite (135 tests) both pass. No TODO.md change needed —
this corrects an already-closed item rather than reopening scope.

## Session 205 — Two more dodge-trigger calc gaps, found via a sweep-methodology bug

User flagged Vindicator's 3 Grandmaster traits (Forerunner of Death, Vassals of the Empire, Saint of
zu Heltzer) as looking like "just flavor text" with no facts, missing from the aggregate Boon/
Condition panel. Saint of zu Heltzer was already fixed (Session 204); investigating the other two
found the real root cause: Session 203's 28-candidate dodge sweep searched `traits.json` descriptions
for the substring `"dodge"`, which never matches `"Dodging"` — both these traits' descriptions say
"Dodging now...", so neither was ever considered by that sweep at all (not excluded on purpose, just
never seen).

Investigated each against the live API and the wiki:
- **Forerunner of Death (2257)**: own trait facts already carry a self-only "Forerunner of Death"
  buff (untracked custom status, correctly excluded same as Saint of zu Heltzer's own buff), but its
  wiki-documented Vulnerability-to-foes grant ("Damage foes... inflict vulnerability") lives only on
  proc skill Death Drop (62693) — confirmed via the wiki's raw `{{skill fact|vulnerability|10|
  stacks=5}}` template, unsplit across game modes (matches the live API's own duration=10/apply_count=5
  on that skill exactly).
- **Vassals of the Empire (2232)**: `facts` array is entirely empty in the live API (worse than
  Forerunner — zero facts of any kind, not even the self-buff). Its proc skill, Imperial Impact
  (62859), does exist with real facts: Might and Protection to allies. Wiki raw wikitext confirmed the
  PvE/WvW split ({{skill fact|might|10|stacks=5|game mode=pve}}{{skill fact|might|8|stacks=3|game
  mode=wvw pvp}}, protection 5s pve / 2s wvw+pvp) — `wvw-fact-overrides.json` already had a
  `"62859": { "Might": 8, "Protection": 2 }` entry from an earlier automated run (the script scans all
  of `skills.json`, not just reachable skills, so this predates today), used directly rather than the
  API's raw PvE values. Its Chill fact is PvE-only per the wiki's version history ("no longer inflicts
  chill in PvP and WvW", 2023-02-14 patch) — omitted entirely, consistent with this app's WvW-first
  convention.

Fixed both the same way as Session 204: real Buff facts (Vulnerability for 2257; Might + Protection
for 2232) added to `synthetic-trait-facts.json`, keyed by trait id with WvW-adjusted values baked in
directly (the merge mechanism doesn't re-run `wvw-fact-overrides.json` resolution against a fact once
it's re-keyed under the trait's id, so values are pre-resolved the same way Session 204's entries
already were). Matching `TARGET_COUNT_OVERRIDES.trait`/`DODGE_TRIGGER_NOTES.trait` entries added
(both party(5), reusing each proc skill's own pre-existing `TARGET_COUNT_OVERRIDES.skill` entry as
corroboration — added `62693`/`62859` entries there too, alongside the pre-existing `62689`, since
they'd been missing). Also fixed a pre-existing copy-paste error found while touching these lines:
several existing comments mislabeled Vindicator as "Guardian/Vindicator" — it's a Revenant elite
spec; corrected every occurrence in `sources.ts`/`docs/game-data.md` (barrier-calc.ts already had it
right).

Verified with a throwaway script (`readJson` + the exact `withSyntheticTraitFacts` merge logic,
run directly via `tsx` since `load-game-data.ts` pulls in `electron`) confirming both traits now carry
the correct merged facts; deleted after confirming. `npm run typecheck` and the full `vitest run`
suite (135 tests) both pass unchanged.

The same re-check (searching `traits.json` for `/dodg/i` but not `/dodge/i`) surfaced ~10 more
"Dodging"-worded traits never considered by any prior sweep — not triaged this session, logged in
TODO.md's dodge-roll item and `DODGE_TRIGGER_NOTES`' own doc comment in `sources.ts` for a future
pass. TODO.md/`docs/game-data.md` updated; problems 2 and 3 of the parent dodge-roll item (whole
dodge-replacement mechanics, relic dodge-triggers) remain open and out of scope for this fix.

## Session 204 — Dodge-trigger calc gap fix (spin-off from the dodge-roll labeling sweep)

Closed the TODO.md spin-off item Session 203 raised: Warrior's Reckless Dodge (trait 1446) and
Guardian/Vindicator's Saint of zu Heltzer's own alacrity grant (trait 2238) each have their real
Might/Alacrity `Buff` fact sitting on a separate un-equippable "proc skill" entity (Reckless Impact
14268, Saint's Shield 62689) that `skillIdsForBuild` never reaches, so neither trait contributed
anything to the aggregate Boon/Condition panel despite each already having a `TARGET_COUNT_OVERRIDES`
entry (orphaned metadata for an unreachable source) from an earlier sweep.

Built a new, narrower counterpart to the existing `synthetic-facts.json` mechanism:
`data/game-data/synthetic-trait-facts.json` (`{ [traitId]: Fact[] }`), merged onto `GameData.traits`
by a new `withSyntheticTraitFacts` in `load-game-data.ts`, kept as a separate file/id-namespace from
the skill version since skill and trait ids are independent sequences that could collide. Copied each
proc skill's Buff fact verbatim onto its owning trait (Might@5×2 → 1446; Alacrity@4×1 → 2238,
alongside the trait's own pre-existing "Saint of zu Heltzer" self-buff fact, which stays untracked/
unlabeled as before). Added matching `TARGET_COUNT_OVERRIDES.trait` (1446: self, 2238: 5, mirroring
each proc skill's now-dead `TARGET_COUNT_OVERRIDES.skill` entry) and `DODGE_TRIGGER_NOTES.trait`
("On Dodge") entries keyed by the TRAIT's id — every downstream consumer resolves by
`sourceKind`+`sourceId`, and the merged fact now reports as `sourceKind: 'trait'`, not the proc
skill's id. Registered the new file in `GAME_DATA_FILE_NAMES` (`data-files.ts`) so it ships with the
in-app data-update downloader. Updated `buff-instance-label-completeness.test.ts`'s trait case to
overlay the new file too (its doc comment previously — and until now correctly — said traits get no
synthetic overlay at all). Full writeup in `docs/game-data.md`'s new "Traits whose real fact lives on
an un-equippable proc skill" section.

Verified with a throwaway test exercising `boonConditionFactsForTrait` directly on both traits (both
now emit the correct boon, target count, and "On Dodge" trigger note; deleted after confirming).
`npm run typecheck`, `npm run lint`, and the full `vitest run` suite (135 tests) all pass.

TODO.md: removed the calc-gap item entirely (folded its resolution into problem 1's note in the
parent dodge-roll item). Problems 2 (whole dodge-replacement mechanics — Vindicator's Legendary
Alliance dodge, Mirage Cloak, Daredevil's Lotus Training/Unhindered Combatant/Bounding Dodger, Saint
of zu Heltzer's area/effect change itself) and 3 (relic dodge-triggers, e.g. Relic of Rivers) are
still open — both need hand-curated content same shape as Revenant's Otherworldly Bond, no skill id
exists for any of them in `skills.json` to hang a fix on.

## Session 203 — Dodge-roll trigger labeling (problem 1 of TODO.md's dodge-roll item)

Picked up TODO.md's dodge-roll item, problem 1 only (user picked this slice when asked which of the
3 to start with): label boons/conditions in the aggregate Boon/Condition summary panel that only
apply "on dodge," which today look identical to an unconditional source once pooled by boon name.

Investigation first, since the TODO note's "likely already flow into totals today" was only partly
right: scanned every `traits.json` entry whose `description` mentions "dodge" (28 candidates) and
classified each by tracing whether its real API `facts` actually reach `computeBoonConditionSources`'s
totals. Found:
- **9 traits** (Mecha Legs 445, Vigorous Precision 564, Malicious Sorcery 753, Companion's Defense
  1090, Pumping Up 1289, Upper Hand 1295, Resilient Roll 1379, Resolute Evasion 1782, Thermal Release
  Valve 2066) carry a real, `classifyBoonCondition`-recognized `Buff` fact (Resistance/Vigor/
  Confusion/Protection/Might/Regeneration/Resolution) directly on the trait's own `facts` array —
  confirmed reachable by tracing `computeBoonConditionSources`'s chosen-trait loop, which walks every
  chosen major/minor trait's facts unconditionally with no trigger-aware gating anywhere. These were
  the real target for this fix.
- **3 traits** (Selfless Daring 551, Healer's Gift 1816, Master's Fortitude 2180) are heal/barrier-on-
  dodge coefficients that only ever render in the trait's OWN tooltip (Healing/Damage never enter the
  pooled aggregate panel — moved out of it entirely per that panel's own doc comment) — that tooltip
  already shows the trait's full wiki description above its facts, so no labeling gap exists there at
  all.
- **1 trait** (Silent Scope 2118) grants a flat, always-on Precision bonus; its dodge-roll wording only
  gates an unrelated stealth-attack-access clause — correctly excluded.
- **6 traits** (Lotus Training 1833, Unhindered Combatant 1964, Bounding Dodger 2047, Mirage Cloak
  2150, Saint of zu Heltzer 2238's own buff, Resolute Evasion 1782's second buff) grant a custom
  status outside `BOON_NAMES`/`CONDITION_NAMES` with no tracked consumer anywhere in the app.
- **6 traits** (Deceptive Evasion 704, Adrenal Implant 523, Power Wrench 531, Mark of Evasion 792,
  Uncatchable 1159, Explosive Entrance 432, Evasive Arcana 238) are non-boon effects (clone summon,
  recharge reduction) or carry zero real fact data beyond an empty "Combat Only" marker.
- **2 traits** (Reckless Dodge 1446, Saint of zu Heltzer 2238's alacrity grant) turned out to be a
  genuine CALC gap, not a labeling one: their real Might/Alacrity fact lives on a separate
  un-equippable "proc skill" entity (Reckless Impact 14268, Saint's Shield 62689) that
  `skillIdsForBuild` never includes — both already had `TARGET_COUNT_OVERRIDES` entries from an
  earlier sweep, which turned out to be orphaned metadata for an unreachable source, not evidence the
  pipeline actually uses them. Spun off as a new, narrowly-scoped TODO.md item (needs a
  `withSyntheticFacts`-style merge onto traits, which `synthetic-facts.json` today only does for
  skills) rather than silently left unlabeled.
- **1 trait** (Reaver's Curse 2259) excluded: its wiki page confirms it modifies a different,
  already-curated Might source's effectiveness rather than itself granting anything "on dodge."

Implementation: added `BoonConditionSource.triggerNote?: string` (`sources.ts`), populated by a new
`DODGE_TRIGGER_NOTES` curated table (`{skill: {}, trait: {...9 entries...}}`, same
`{skill, trait}` shape as `TARGET_COUNT_OVERRIDES`/`BUFF_INSTANCE_LABELS`) and a `resolveTriggerNote`
lookup wired into `extractFromFacts` right alongside `resolveInstanceLabel`. 8 of the 9 read "On
Dodge"; Upper Hand reads "On Evade" instead since its tracked Regeneration specifically triggers "when
you evade an attack" per the wiki (broader than a bare dodge roll — dodging alone only grants
untracked Initiative). Rendered as a small bordered pill (`.boon-source-trigger-note` in global.css,
new rule) next to the source name in `BoonConditionSummaryPanel.tsx`'s per-boon source list; `SlotTile.tsx`'s
squad-view equivalent (plain-string tooltips, not JSX) gets the same info as a trailing `[On Dodge]`
suffix. Individual trait tooltips (`TraitsEditor.tsx`) deliberately left untouched — they already show
the trait's full wiki description above its facts, where "Gain might when you dodge" is already
visible; the gap only existed in the pooled aggregate view. `npm run typecheck` clean, all 135 existing
tests still pass (no new completeness test added — this is a small, one-time 9-entry curation, not an
open-ended sweep needing regression coverage). TODO.md's problem-1 sub-item closed; problems 2/3 and
the new Reckless-Dodge/Saint-of-zu-Heltzer calc-gap item remain open.

## Session 202 — `MISCELLANEOUS_MATCHERS`/`CONTROL_MATCHERS` WvW-override gap

Closed the other open item `flat_crit_chance_sweep_2026-08-15` flagged (user picked this one when
asked): `namedFactsFrom` (the shared engine behind `computeNamedFactSources`/`namedFactsForSkill` in
`sources.ts`, covering Control/Miscellaneous/Strip-Corrupt-Cleanse) had no `WvwFactOverride` concept
at all, unlike `extractFromFacts`'s boon/condition/aura path — a `Buff`-typed fact with a pve/wvw
split (Stealth, Superspeed, or the `Buff`-shaped half of Stun/Daze) showed whichever raw duplicate
`Fact` happened to be scanned first, uncorrected.

Fix: `namedFactsFrom` now consults the same per-source `WvwFactOverride` map `extractFromFacts`
already threads through — for a `Buff`-typed fact with a `status`, a `'omit'` entry drops it as a
match candidate and a number entry replaces its displayed duration, with the same "only the first of
a same-status pair is ever considered" dedup `extractFromFacts` uses. Threaded `wvwOverrides`/
`wvwFactOverride` through `computeNamedFactSources` (now takes `wvwFactOverrides` in its `gameData`
param, same object every other `compute*Sources` already receives) and `namedFactsForSkill` (new
`wvwOverride` param, positioned like `auraFactsForSkill`'s) down to `namedFactsFrom` itself. Updated
`SkillsEditor.tsx`'s `skillNamedFacts` (already had `wvwOverride` in scope for `auraFactsForSkill`,
just wasn't forwarding it) and the 2 test files calling `namedFactsForSkill` directly
(`additive-flip-pairs.test.ts`, `evoker-familiar-facts.test.ts`, both pass `undefined` — no override
data relevant to what they assert). Every other `computeNamedFactSources`/`computePartyNamedFactSummary`
call site (`BoonConditionSummaryPanel.tsx`, `SlotTile.tsx`, `PartyRow.tsx`, `party-summary.ts`) already
passes the same whole-`gameData` object used for `computeBoonConditionSources`, which already carries
`wvwFactOverrides` — no call-site changes needed there beyond the type widening.

Fixed the motivating case for real, not just the mechanism: added a
`2357: { Superspeed: 2 }` entry to `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` (wiki-verified via a
live wikitext fetch — Liberating Liaise, Paragon/Motivation Adept, plain pve(3)/wvw+pvp(2) Superspeed
split, no `alt=`) and hand-patched the corresponding entry into
`data/game-data/wvw-fact-overrides.json` (matches what a full `fetch-wvw-splits` run would produce
for this one manual-only id — not re-run in full, since it needs no other change and a full run is a
slow, non-incremental wiki sweep). Verified end-to-end with a throwaway `tsx` script:
`namedFactsForSkill` on trait 2357 now returns Superspeed `"2s"` (was `"3s"`, the PvE value) once the
override is passed. TODO.md's item closed.

## Session 201 — Flat critical-hit-chance trait sweep

Closed TODO.md's "Pinnacle of Strength's flat, unconditional +5% critical-hit chance fact is NOT
curated anywhere" follow-up from the trait-attribute-bonus completeness scan. Ran a full
`data/game-data/traits.json` scan for `Percent`-typed facts whose `text` matches
"critical...chance" (covers "Critical Chance Increase", "Critical Chance per Stack", and any
`alt=`-renamed variant) — 26 candidate traits found, 6 already covered by the existing
`FURY_CRIT_CHANCE_TRAIT_BONUSES`/`FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES` tables.

Of the remaining 20, 5 fit existing `CombatState` infra and are now curated (`combat-state.ts`, all
wiki-verified via raw wikitext 2026-08-15):
- **`FLAT_CRIT_CHANCE_TRAIT_BONUSES`** (new, unconditional — no gate at all): Zephyr's Speed
  (Elementalist/Air, id 221, +5%, no split), Death Perception (Necromancer/Soul Reaping, id 893,
  +15% WvW, its crit-*damage* half stays Shroud-gated but crit-*chance* is unconditional), Pinnacle
  of Strength (Warrior/Strength, id 1453, +5%, no split — the trait's Power-per-Might-stack half
  was already curated in `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`).
- **`HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES`** (new, gated by the existing `HealthTier` from
  `combatState.healthTier` — no new state needed): Keen Observer (Thief/Deadly Arts, id 1281), WvW
  5% base / 10% above the (~90%, approximated to the `'above75'` tier bucket) health threshold.
- **`MECHANIC_ACTIVE_CRIT_CHANCE_TRAIT_BONUSES`** (new, gated by the existing `combatState.mechanicActive`
  toggle — no new state needed): Smash Brawler (Warrior/Berserker, id 2049), WvW +5% while berserk.

All 3 new tables wired into `derived-stats.ts`'s `criticalChance` formula alongside the existing
Fury/Endurance ones.

The other 15 candidates are foe-state-gated (vs. Defiant/Disabled/Burning/Weakened/behind-or-side/
in-range/bleeding foes, or scaling per condition/Vulnerability stack on the *foe*), own-resource-gated
(Guardian's Resolution, Ranger's Opening Strike, Mesmer's per-clone-shatter Alacrity), or a
proc/temporary-buff-on-cast value (Burst Precision) — none of these have any `CombatState` concept to
gate against, same "genuine stat gain, no infra yet" shape TODO.md's "New attribute-bonus gaps
needing new CombatState infra" section already tracks for other attributes. Not re-logged there
individually — instead captured as a permanent CI-enforced completeness scan
(`crit-chance-completeness.test.ts`, new, same "coverage not correctness" shape as
`trait-attribute-completeness.test.ts`) so a future balance patch adding a new crit-chance trait, or
one of these 15 gaining new infra elsewhere, gets caught instead of silently staying stale.

`npm run typecheck`/`lint`/`test` all clean (135 tests, +3 new).

## Session 200 — Fix: Elementalist Evoker's Familiar (F5) now contributes to the aggregate Boon/Condition panel

Closed the one remaining gap Session 198 explicitly deferred: every other profession-mechanic (F1-F5)
bar resolver was wired into `mechanicBarIdsForBuild`, but `evokerFamiliarBar` needed `Familiar[]` data
that `computeBoonConditionSources`/`skillIdsForBuild`'s callers didn't have on hand.

**Fix**: threaded `familiars: Familiar[]` all the way from each public entry point's `gameData` param
down to `mechanicBarIdsForBuild` — `computeBoonConditionSources`, `equippedSkillsById` (shared by
`computeAuraSources`/`computeNamedFactSources`/`computeComboSources`), and the 4
`computePartyXSummary` functions in `squad-calc/party-summary.ts`, all of which declare their own
inline `gameData` object-literal types rather than sharing one. `mechanicBarIdsForBuild` now calls
`evokerFamiliarBar(build, skillsById, familiars)` when Evoker (`EVOKER_SPECIALIZATION_ID`, 80) is
equipped, same "fold every entry's id + flip chain into the walked skill-id set" pattern as the other
narrower bar resolvers. No renderer changes needed — every call site already passes the full
`useGameData()` store object (which already carries `familiars`), not a hand-built literal, so the
widened parameter types were satisfied automatically.

Verified end-to-end via a throwaway vitest file (not committed, deleted after): built a minimal
Elementalist/Evoker `Build` with `familiarId: 'Fox'` and confirmed `computeBoonConditionSources`
now includes Conflagration's (id 76585) Burning fact; a build with `familiarId: null` (no familiar
chosen yet) correctly contributes nothing from F5, matching `evokerFamiliarBar`'s own "no entry until
chosen" behavior.

`npm run typecheck`/`lint`/`test` all clean (132 tests unchanged — same "no existing coverage for
this class of behavior" situation as Session 198).

## Session 199 — Fix: one-handed main-hand weapon with no off-hand wrongly mirrored into aggregate totals

User-reported: a Warrior with only main-hand Sword equipped (no off-hand item) had the aggregate
Boon/Condition panel behave as if an off-hand Sword were also equipped — same shape of bug as a
Revenant issue fixed before (`WeaponSkillBar.tsx`'s "must NOT mirror a one-handed weapon into the
off-hand slot" comment), but in a different code path.

**Root cause**: `weaponSkillIdsForBuild` (`sources.ts`), which feeds the aggregate panel, had
`const offWeapon = offType ? profession.weapons[offType] : mainWeapon` — an unconditional
fallback to `mainWeapon` whenever no off-hand item is equipped, regardless of whether the
main-hand weapon is actually two-handed. `WeaponSkillBar.tsx` (the on-screen skill bar) already
had the correct, explicitly-commented gate for this — `mainIsTwoHanded` — but that fix was never
carried over to the aggregate-totals function, same "tooltip-correctness and aggregate-
contribution are separate code paths" shape as Session 198.

**Fix**: added the same `mainIsTwoHanded` (`flags.includes('TwoHand')`) gate to
`weaponSkillIdsForBuild`, mirroring `WeaponSkillBar.tsx`'s logic exactly. Underwater weapon types
(Trident/Speargun/Harpoon Gun) all carry `TwoHand` themselves, so the underwater pairs (which have
no off-hand key at all) are unaffected.

**Swept for the same pattern**: grepped every `mainWeapon`/`offWeapon` construction site in the
codebase (`sources.ts`, `WeaponSkillBar.tsx`, `EquipmentEditor.tsx`, `weapon-skills.ts`) — this was
the only unguarded fallback; `EquipmentEditor.tsx`'s two sites already gate correctly.
`damage-calc.ts`/`barrier-calc.ts` don't construct `offWeapon` themselves, they consume ids already
resolved via `weaponSkillIdsForPair`. Since the fix is in a shared, profession-agnostic function,
it applies to every profession/weapon combination at once, not just Warrior/Sword — no separate
per-spec sweep needed.

`npm run typecheck` clean.

## Session 198 — Fix: profession-mechanic-bar skills entirely missing from the aggregate Boon/Condition panel

User follow-up to Session 197: after that fix, Paragon's Chants' Motivation-tier boons showed
correctly in the Chants' own tooltip, but still weren't contributing to the build-wide Boon/
Condition summary panel. Investigation found this was much bigger than the Chants.

**Root cause, confirmed via direct test**: `computeBoonConditionSources` (the aggregate calc)
builds its skill-id list from `skillIdsForBuild`, which enumerated every OTHER "always contributes"
category (weapon skills, Revenant legend kit, pets, Beastmode, Stolen Skill) but never the
profession-mechanic (F1-F5) bar at all. `bundleContributionsForBuild`'s `kitSkillIds` only pulls in
BUNDLE-capable mechanic-bar ids' own nested sub-skills (Tome chapters, Shroud/Gunsaber/Dragon
Trigger's 5 slot skills) — never the F-button's own id, and never a non-bundle mechanic-bar id at
all. So EVERY profession's plain F-buttons (Guardian's 3 Virtues, Warrior's base Burst Skill,
Vindicator's Energy Meld, Paragon's Chants, Elementalist's F1-F4 Attunement buttons, Thief's Steal,
...) had never contributed their real live-API facts to the aggregate panel, not just curated
branch content — confirmed live: a bare core Guardian build (no weapon, no heal/utility/elite)
correctly showed nothing before the fix, but should have shown Virtue of Justice's Burning and
Virtue of Courage's Aegis.

**Fix 1 (foundational)**: new `mechanicBarIdsForBuild` in `sources.ts`, folded into
`skillIdsForBuild`'s return — calls the same `professionMechanicBar` resolver
`ProfessionMechanicBar.tsx` renders from (once per distinct main-hand weapon type across both
equipped weapon sets, since Warrior's Profession_1/Burst Skill is the one slot that resolves
differently per weapon), plus the narrower `engineerToolbeltBar`/`conduitReleasePotentialBar`/
`catalystJadeSphereBar` resolvers. `withFlipChain` applied to each id, same "both toggle states
contribute" reasoning as everywhere else in this file. Verified live: core Guardian now correctly
shows Virtue of Justice/Courage, Firebrand shows both Tome (already-working bundle path) AND
Virtue of Resolve/Courage (newly-working). Deliberately still NOT covered: Elementalist Evoker's
Familiar (`evokerFamiliarBar`, needs `Familiar[]` data this function's callers don't have) — logged
in TODO.md rather than threading a new param through for one remaining case.

**Fix 2 (branches)**: this alone still didn't surface the Chants' OWN Might/Fury/Vigor/etc, since
those live entirely in `branchConditionalFacts` (tooltip-only), never in `skill.facts` —
`extractFromFacts` correctly finds zero real Buff facts on Chant of Action's id even once it's in
the walked list. New `ConditionalBranch.countsTowardTotals?: boolean` flag (`branch-conditional-
facts.ts`) — `computeBoonConditionSources` now also consults `branchConditionalFacts` per walked
skill and folds in any flagged branch's `.facts`. Flagged, after discussing the design trade-off
with the user (fixed steady-state assumption, no new CombatState UI toggle — same "idealized
sustained rotation" idea this app's boon uptime already assumes everywhere else, not a live
simulation): each Chant's "Initial Cast" (recurs every cast, not mutually exclusive with a tier) +
"7-10 Motivation" (best-maintained tier) branches; Dragon Slash Sharp as the Wind/River's Flow's
"Maximum Charge" (a well-played Bladesworn charges to max before releasing). Deliberately NOT
flagged: Otherworldly Bond's Enemy/Ally Target branches — unlike the tiers above, that's a genuine
build-time CHOICE with no defensible single "always true" pick (a control build only ever uses
Enemy Target, a support build only Ally Target); flagging either would silently inflate one
archetype's totals with a boon/condition it may never apply. `healingPower` passed as `0` into this
new `branchConditionalFacts` call site — none of the flagged branches' `.facts` (as opposed to
their display-only `numericLines`) currently use it, documented as a note for whoever adds the next
flagged branch.

Both fixes verified end-to-end via throwaway vitest files (not just typecheck) before deleting them:
confirmed Chant of Action/Recuperation/Freedom's Might/Fury/Vigor/Regeneration/Stability/Swiftness/
Resolution/Protection now appear in `computeBoonConditionSources`' output, and confirmed Otherworldly
Bond correctly still contributes nothing.

`npm run typecheck`/`lint`/`test` all clean (132 tests unchanged — this class of behavior, "does a
build's whole-aggregate total include X," has no existing test coverage to update or break).

**User-visible effect**: previously-saved builds using Guardian Virtues, Warrior Burst Skill,
Vindicator Energy Meld, Paragon Chants, or similar F-button-sourced boons/conditions will now show
correctly higher totals in the Boon/Condition summary panel — this is the totals becoming more
accurate, not a regression, but worth knowing if a user asks why a build's numbers moved.

## Session 197 — Fix: profession-mechanic-bar tooltips never rendered `branchConditionalFacts`

User-reported bug, found immediately after Session 196: Paragon's Chants showed only Recharge/
Radius/Number of Targets/Interval + flavor text in the actual running app — none of the curated
Motivation-tier boon sections from Sessions 195-196.

Root cause: `ProfessionMechanicBar.tsx`'s own `skillTooltipFor` deliberately builds a plain
title+description+facts tooltip instead of reusing `SkillsEditor.tsx`'s `skillTooltipContent` (to
skip `relatedVariantSkills`, which is actively wrong for this bar — see that function's own doc
comment) — but was never updated to also call `branchConditionalFacts`/`conditionalBranchesBlock`
when those were introduced. Every skill rendered by this bar (the F1-F5 profession-mechanic row)
went through this path exclusively, so any curated branch content on such a skill was silently
invisible no matter how correct the underlying data was.

Scope was bigger than just the Chants: Warrior's Burst Skill chain — including Dragon Slash's Sharp
as the Wind/River's Flow branches (Session 193) — also renders *only* through this bar, so that
curation had been silently broken since it landed too, not just today's Chant work. Otherworldly
Bond (a weapon skill, `WeaponSkillBar.tsx`) and the Chant-modifying traits (`TraitsEditor.tsx`) were
unaffected — both of those render paths already called the right helper.

Fix: added the same `branchConditionalFacts(skill, durationPercent, healingPower)` +
`conditionalBranchesBlock(branches)` calls `skillTooltipContent` and `TraitsEditor.tsx` already use.
Added a doc-comment note on `ProfessionMechanicBar.tsx` flagging that any *future*
`branchConditionalFacts` entry needs verifying against every render path a skill might reach, not
just `SkillsEditor.tsx` — this bar bypasses that helper by design, so it's an easy blind spot.

`npm run typecheck`/`lint`/`test` all clean (132 tests unchanged). Not caught by the earlier
scratch-vitest spot-check in Session 196 since that only exercised the data functions directly, not
each component's actual render path — worth remembering next time a `branchConditionalFacts` entry
is added: check which component(s) actually render the skill, not just that the data function
returns the right thing.

## Session 196 — Paragon's Chant-modifying traits (5 traits, closes the Motivation-tiered Chants item)

Picks up the "5 traits" TODO.md left open after Session 195's Chant-skills pass. Wiki-verified all 5
via fresh raw wikitext (`?action=raw`, 2026-08-15) — the earlier `WebFetch`-summarized pass from
this same session invented facts not in the actual wikitext (wrong page titles, wrong numbers), so
every value below is off a direct `curl` of the raw page, not that summary. Investigating each
trait's actual current rendering (rather than assuming all 5 needed a new mechanism, per TODO.md's
original framing) turned up 4 very different outcomes:

- **Feverish Pulse (2369)** — already fully correct, zero code changes. Its Quickness/Alacrity
  game-mode split was already fixed via `WvwFactOverrides` back in Session 173 (`{Alacrity: 'omit',
  Quickness: 1}`), and its "Recharge Time Reduced" fact is a plain `Time`-type fact `numericFactLines`
  already renders generically (`fact-numbers.ts`'s `factLine`). Both already flowed into the trait's
  own tooltip via the existing `boonConditionFactsForTrait`/`numericFactLines` calls.
- **Enduring Refrain (2428)** — already shows everything the wiki actually quantifies. Its "Refrain
  effects... are stronger" text has no number anywhere on the wiki (confirmed via raw wikitext — the
  3 per-chant facts are bare qualitative descriptions, `desc=` only, no `effect bonus number=`); only
  "+1 Motivation Stack" is a real number, and that's already a plain `Number` fact rendering as
  "Motivation Stacks: 1". Nothing left to add without inventing a magnitude the wiki doesn't give.
- **Calming Tongue (2433)** — real small bug, fixed. Its "Conditions Removed" pve+wvw(2)-vs-pvp(1)
  split has no discriminator on the 2 raw `Number` facts, so `numericFactLines` showed both
  "Conditions Removed: 2" and "Conditions Removed: 1" simultaneously. `fetch-wvw-splits.ts`'s
  `WvwFactOverride` mechanism doesn't cover this — its candidate discovery is hard-filtered to
  `Buff`-type facts only (`collectCandidates`), and `Number` facts have no `status` to key on
  anyway. Added a small, separate `NUMERIC_FACT_WVW_OVERRIDES` table in `fact-numbers.ts` instead
  (keyed by trait/skill id then fact `text`, same shape as `WvwFactOverride` but hand-curated rather
  than scraper-generated) — `numericFactLines` now takes an optional 4th param and drops any
  `Number` fact whose `value` doesn't match. `TraitsEditor.tsx` passes
  `NUMERIC_FACT_WVW_OVERRIDES[trait.id]` in for both minor and major trait tooltips.
- **Liberating Liaise (2357)** — investigated, genuinely blocked, NOT curated. Its Superspeed grant
  (pve 3s / wvw+pvp 2s) turned out to be a dead end for the `WvwFactOverride` pipeline: Superspeed
  isn't a `classifyBoonCondition`-recognized status (not one of GW2's own 12 real boons —
  `BOON_NAMES`/`CONDITION_NAMES`), so `extractFromFacts` drops it before any override lookup ever
  runs; it only surfaces via the separate `MISCELLANEOUS_MATCHERS`/`computeNamedFactSources` named-
  fact pipeline, which has no WvW-override concept of its own at all (`namedFactsFrom` just reads
  whichever raw fact's `duration` matches first, no dedup). Logged in TODO.md as a general
  `namedFactsFrom` gap (affects any `MISCELLANEOUS_MATCHERS`/`CONTROL_MATCHERS` entry with a pve/wvw
  split, not just this trait), not special-cased here.
- **Strengthening Stanzas (2385)** — the one that actually needed TODO's proposed new mechanism.
  "Refrains grant bonus effects to you while they are active" — only one of the 3 Chant Refrains can
  be running at a time (activating a chant replaces whichever was already ticking), the same "one
  cast, mutually exclusive outcomes" shape `otherworldlyBondBranches`/the Chant sections already
  exist for, just on a trait instead of a skill. New `strengtheningStanzasBranches` +
  `branchConditionalTraitFacts` (siblings of `otherworldlyBondBranches`/`branchConditionalFacts`) in
  `branch-conditional-facts.ts` — 3 labeled sections (While Chant of Action/Recuperation/Freedom
  Active), each a plain descriptive `FactLine` (WvW: +10% Damage/+10% Condition Damage; -7% Incoming
  Damage/-7% Incoming Condition Damage; +50% Movement Speed — none of these is a tracked
  boon/condition, so no `BoonConditionSource` facts, same "display-only" treatment the Chant
  sections' own "Motivation Cost per Interval" lines get). Divider rendering itself was factored out
  of `SkillsEditor.tsx`'s `skillTooltipContent` into a new exported `conditionalBranchesBlock`
  helper so `TraitsEditor.tsx` draws the identical `.tooltip-divider`/`.tooltip-section-label` style
  rather than reimplementing it — both minor and major trait tooltips in `TraitsEditor.tsx` now call
  `branchConditionalTraitFacts`.

Verified all 4 behavioral outcomes (Calming Tongue's dedup, Strengthening Stanzas' 3 branches,
Feverish Pulse's/Enduring Refrain's already-correct rendering) via a throwaway vitest file exercising
the real trait data before deleting it — not just typecheck-clean.

`npm run typecheck`/`lint`/`test` all clean (132 tests unchanged — no dedicated test added for this
trait-only rendering path, consistent with `branch-conditional-facts.ts` having none before this
either).

## Session 195 — Paragon's Chant skills (Motivation-tiered Refrain effects)

Picks up TODO.md's "Paragon's Motivation-tiered Chants" item (flagged 2026-08-14, not started until
now). Curates all 3 Chant skills — Chant of Action (F2, id 77342), Chant of Recuperation (F3, id
76782), Chant of Freedom (F4, id 77155) — whose live API `facts` stop at Recharge/Radius/Number of
Targets/Interval, same "API gives nothing to render" shape as Otherworldly Bond (COMPLETED.md
Session 131).

- Wiki-verified via raw wikitext (`?action=raw`) for all 3 skills, cross-checked against each page's
  own *rendered* Skill Facts panel (fetched separately) since Chant of Action's stacked Might/Fury
  facts share positional template arguments the raw templates alone don't disambiguate. WvW values
  used throughout per this app's convention.
- New `chantOfActionSections`/`chantOfRecuperationSections`/`chantOfFreedomSections` in
  `branch-conditional-facts.ts`, dispatched from `branchConditionalFacts` (now also takes
  `healingPower`) — 4 labeled tooltip sections per chant ("Initial Cast" for the Burst's own
  one-time grant, then "1-3"/"4-6"/"7-10 Motivation" for the Refrain's 3 escalating bands), same
  divider mechanism `otherworldlyBondBranches` established, extended to a 4-way split instead of 2.
- Chant of Action: Initial Might(2 stacks/4s)+Fury(2s), then Might 1/2/3 stacks per tier (Fury joins
  at tier 2+, unchanged into tier 3), Motivation cost 1/2/3 per interval.
- Chant of Freedom: Initial Stability (2 stacks/3s, stun-break itself already a live API fact, no
  action needed), then Swiftness (all 3 tiers) + Resolution (tier 2+) + Protection (tier 3 only).
- Chant of Recuperation: Initial Vigor (3s) + Barrier (`1615 + 0.5 × healingPower`, WvW coefficient),
  then Healing per tick (`330+0.1×hp` / `431+0.15×hp` / `532+0.2×hp`) + Regeneration (tier 3 only).
  Barrier/Healing have no live fact for `CURATED_BARRIER_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS`
  to attach a coefficient to (both match by `factText` against a real API fact, and this skill has
  none), so both are computed inline with the same formula instead of going through either table —
  confirmed correct against a synthetic 1500-Healing-Power test (`Barrier: 2,365` / tier-1
  `Healing: 480`, both match the formula by hand).
- Turned out **no new `CombatState.motivationStacks` field was needed** — TODO.md's original scoping
  guess assumed this would be closer to `HealthTier`'s shape (a combat-state gate gets stored,
  bonuses apply through it), but `branchConditionalFacts` is tooltip-only (never touched by the
  aggregate boon-uptime calculation, same as Otherworldly Bond), so all 4 sections just render as
  honestly-labeled alternatives with no "current tier" state required.
- Still open, logged in TODO.md: the 5 traits that further modify chant effects (Enduring Refrain
  2428, Feverish Pulse 2369, Calming Tongue 2433, Liberating Liaise 2357, Strengthening Stanzas
  2385) — all wiki-verified this session too (raw wikitext), but traits render through
  `TraitsEditor.tsx`'s own separate, plainer path with no divider/branch concept, so wiring these in
  needs its own small follow-up mechanism.

`npm run typecheck`/`lint`/`test` all clean (132 tests unchanged — no existing test covers
`branch-conditional-facts.ts`, same as the Otherworldly Bond/Dragon Slash branches before it).

## Session 194 — Build "last updated" framed against GW2 balance patches

Closes TODO.md's "Nice-to-haves" stretch item scoped 2026-08-01: a build's card now shows "Not
reviewed since latest patch" (orange, `--rarity-exotic`) instead of the normal relative-time line
when it was last saved under an older GW2 build than the currently-loaded game data.

- New `Build.updatedAtGw2Build: number | null` field — the `GameDataMeta.gw2Build` id current at
  the moment `updatedAt` was last stamped. `null` = unknown (pre-existing records via
  `normalizeBuild`'s backfill, or builds imported from someone else's local snapshot via
  `BuildsView`/`SquadsView`'s `handleImport` — deliberately nulled rather than carried over, since
  the sharer's `gw2Build` isn't comparable to the importer's).
- `DataUpdateStoreProvider` (already the single mounted-near-the-top source for
  `window.gw2DataUpdate` status) gained `localGw2Build`, re-read via `getLocalMeta()` on every
  status change — same "on-disk copy updates immediately, in-memory game data waits for restart"
  reasoning `SettingsView`'s own local reads already used.
- `BuildEditorView.handleBack` (the single save path for both new and edited builds) stamps
  `updatedAtGw2Build: localGw2Build` alongside `updatedAt`.
- New `isBuildStaleSincePatch(build, currentGw2Build)` in `shared/types/build.ts` — `false`
  whenever either side is `null` (unknown reads as "not stale," never a false-positive warning),
  drives `BuildsView`'s card display.
- Scoped to `Build` only, not `SquadComp` — a squad comp has no traits/skills of its own to go
  stale, it only references builds that already carry the signal.

`npm run typecheck`/`lint`/`test` all clean (132 tests, 4 fixture files needed the new required
field added).

## Session 193 — Bladesworn's Sharp as the Wind / River's Flow Dragon Slash branches

Closes the TODO.md follow-up spun off by Session 191 (Warrior Burst Skill sweep's last leg): the 2
Bladesworn traits that reflavor the whole Dragon Slash chain (Force/Boost/Reach) into differently-
named, differently-described ids per skill.

Wiki-verified via raw wikitext (`?action=raw`) for all 6 variant ids (`Dragon Slash—Force/Boost/Reach
(Sharp as the Wind)` 80199/80281/80246, `... (River's Flow)` 80250/80228/80236) plus both trait pages
(Sharp as the Wind 2260, River's Flow 2237). Hand-authored into 2 new `Skill[]` arrays in
`dragon-slash-skills.ts` (`DRAGON_SLASH_SHARP_AS_THE_WIND_SKILLS`/`DRAGON_SLASH_RIVERS_FLOW_SKILLS`),
reusing the base 3 skills' own `TRIGGERGUARD_ID`/`FLICKER_STEP_ID` objects rather than duplicating
them (Triggerguard/Flicker Step are untouched by either trait).

Each variant keeps the base skill's "consumes all charges to increase X" shape, but X is no longer
Damage (now a single flat, unscaled-by-charge fact) — it's whatever the branch is themed around:
- **Sharp as the Wind** (condition branch, all 3 skills inflict Burning): wiki gives an explicit
  Minimum/Maximum Burning Duration pair per skill. Since Burning IS a tracked `CONDITION_NAMES`
  entry (unlike Damage), 2 real `Buff` facts on one skill would double-count into
  `computeBoonConditionSources`'s aggregate totals as if both applications happen on the same cast —
  resolved via a new `branch-conditional-facts.ts` function, `dragonSlashSharpAsTheWindBranches`,
  producing "Minimum Charge"/"Maximum Charge" labeled sections (same mechanism Otherworldly Bond's
  Enemy/Ally Target split already established, first reuse of that mechanism for a 2nd skill).
- **River's Flow** (support branch): Boost's Healing gets the same Minimum/Maximum pair, but
  Healing tooltip lines are pure per-fact display (no aggregate total to double-count into) — curated
  directly in `CURATED_HEALING_COEFFICIENTS`, no branch treatment needed. Reach's Daze isn't a
  tracked `CONDITION_NAMES`/`BOON_NAMES` entry at all, so its Minimum/Maximum Daze Duration are
  plain `Time` facts. Force's Might grant is the one genuinely ambiguous case (a flat per-charge
  rate, no total-charges-consumed number to multiply it by) — kept as a plain `Number` fact rather
  than a real `Buff` fact, same "honest, unscaled flat text" treatment Otherworldly Bond's own
  "Might Stacks per Level" got.

Trait-gated bar selection wired into `bundle-skills.ts`'s new `dragonSlashBarSkillIdsForBuild`
(checks `chosenTraitIds` membership across every specialization line, same shape as
`skill-variants.ts`'s `GADGETEER_GATED_SKILL_IDS`) — replaces the old static `DRAGON_SLASH_SLOT_SKILLS`
map. `bundleSkillIdsForBuild` gained a new `build: Build` parameter (needed the trait choice, unlike
every other bundle it already handled) — its one call site (`sources.ts`) already had `build` in
scope. All 6 new ids curated in `CURATED_DAMAGE_COEFFICIENTS` (`damage-calc.ts`) plus 1 in
`CURATED_HEALING_COEFFICIENTS` (`healing-calc.ts`); merged into `game-data-store.tsx`'s `skillsById`
and `coefficient-snapshots.test.ts`'s local one, same pattern as the base `DRAGON_SLASH_SKILLS`.
`npm run test` 132/132 (2 new snapshot entries accepted), `npm run typecheck`/`npm run lint` clean.

## Session 192 — Elementalist Evoker familiars: same-name flip-pair item's last leg (now fully closed)

Closes out the "same-name enhanced flip targets merge into one tooltip" item (TODO.md entry removed;
classification finished Session 188, 6 of 10 pairs' rendering landed Session 189) — this session builds
the last 4 (Fox's Fury, Otter's Compassion, Toad's Fortitude, Hare's Agility), deliberately excluded
from Session 189's `ADDITIVE_FLIP_PAIRS` table because their shape doesn't fit that mechanism (a live
target-minus-base diff): unlike the other 10 pairs, these 4 base ids' own facts are nearly EMPTY
(Range/Recharge only) — the target carries the skill's entire real, mostly-unconditional effect, not
an add-on, so diffing against the base would mislabel almost everything as "Fire Specialized" etc.

Fetched fresh raw wikitext (`action=parse&prop=wikitext`) for all 4 skill pages to get an authoritative
always-on/gated split (rather than trust the API's own fact grouping, already known incomplete here).
Found one consistent shape across all 4: each skill's description ends "If [element] is your specialized
element, this skill breaks stun[, grants more X]" — but of that gated text, only the StunBreak fact is
actually present as a discrete API fact (`type: 'StunBreak'`) on any of the 4 targets. The other gated
bonuses (Fox's extra Might, Toad's Resistance, Hare's Blur) have no matching API fact at all on either
id — a 2nd, larger gap than the "wrong id" one, not just misplaced but genuinely absent — so those stay
unrepresented (same "API gives nothing to render" posture as Gunsaber), not guessed at.

Also newly confirmed via the wiki's own `Evoker` page: "specializing into an element" (F5, `Build.
familiarId`) and choosing a familiar are literally the same one choice, not two — so `familiarId`
resolved to its `Familiar.element` is exactly "your specialized element," a real, already-modeled build
state to gate on (not a per-cast ambiguity like Otherworldly Bond's branches).

- New `evoker-familiar-facts.ts`: `EVOKER_FAMILIAR_BASE_TO_TARGET_ID` (the 4 base->target id pairs),
  `EVOKER_FAMILIAR_TARGET_IDS` (reverse set, for `flipTargetSkills`' 4th stop-condition), `EVOKER_
  FAMILIAR_SPECIALIZED_ELEMENT` (target id -> required element), and `evokerFamiliarFactSourceSkill`
  (the swap resolver). Full per-skill wiki citations in its doc comment.
- `SkillsEditor.tsx`'s `skillTooltipContent`: `evokerFamiliarFactSourceSkill` joins the `glyphFormSkill
  ?? attunementVariantSkill ?? ...` swap chain (unconditional — the target's content is the skill's own
  real effect, always shown, not gated), then a new `evokerFamiliarBonusFacts` helper pulls the "Breaks
  Stun" `NamedFactSource` out of the main list and only re-adds it (under a new `"${element} Specialized"`
  divider) when `SkillVariantContext.familiarElement` matches. New `familiarElement` field threaded
  through all 4 `SkillVariantContext` construction sites (`SkillsEditor.tsx` x2, `WeaponSkillBar.tsx`,
  `PetsEditor.tsx`) — resolved from `build.familiarId` via `gameData.familiars` where meaningful (the
  2 Standard-editor sites), `null` elsewhere (Revenant/pet skills never match an Evoker base id).
- `multi-effect.ts`'s `flipTargetSkills` gets a 4th stop-condition (`EVOKER_FAMILIAR_TARGET_IDS`), same
  outcome as the `ADDITIVE_FLIP_PAIR_TARGET_IDS` one but kept as its own set/doc-comment paragraph since
  the underlying mechanism differs (swap, not diff).
- Updated `additive-flip-pairs.ts`/`other-profession-flip-duplicates.ts`'s existing "Elementalist
  familiars deliberately NOT included" paragraphs to point at the resolution instead of describing it as
  still-open.
- New `evoker-familiar-facts.test.ts` (11 tests): the 4 base->target mappings actually match `skills.
  json`'s `flipSkill`/`name` fields, the swap resolver, the `flipTargetSkills` exclusion, each target
  carries exactly one live StunBreak fact to split, and the element mapping matches the wiki's Fox=Fire/
  Otter=Water/Toad=Earth/Hare=Air. `npm run test` 132/132, typecheck/lint clean.

Not visually verified in the running app (Electron sandbox limitation, as usual) — same caveat as every
other tooltip change this sweep landed.

## Session 191 — Bladesworn's Dragon Slash chain: Warrior Burst Skill sweep's last leg

Closes out the Warrior Burst Skill damage coefficients item (all 4 legs now done; TODO.md entry
removed, folded into a narrower Sharp as the Wind / River's Flow follow-up).

Bladesworn's F2 "Dragon Trigger" (62803) is a real, already-correctly-resolving API skill (Flow
Cost/Drain/Recharge only, no Damage fact of its own) — the actual burst damage lives on 3 of the 5
skills shown while it channels (Dragon Slash—Force/Boost/Reach, chosen by the player to end the
channel; Triggerguard/Flicker Step are the other 2, utility-only, don't end the channel). Live-
verified against the live `/v2/skills` endpoint that all 5 of these ids ("all ids provided are
invalid") are the same class of API gap as `gunsaber-skills.ts`'s Gunsaber weapon bar — real,
wiki-documented, in-game skills entirely absent from the public API. New `dragon-slash-skills.ts`
hand-authors all 5 (mirroring Gunsaber's structure/icon-sourcing exactly) and wires them into
`bundle-skills.ts` as a new `DRAGON_SLASH_SLOT_SKILLS` bundle (Dragon Trigger's id -> these 5),
merged into every function that already handled `GUNSABER_SLOT_SKILLS` the same way — no
`ProfessionMechanicBar.tsx` changes needed at all, since `isMechanicBarBundleId` already generalizes
over any registered bundle-source id.

Unlike Gunsaber (deliberately left with zero Damage facts — none of its 5 skills has an unambiguous
single coefficient), Dragon Slash—Force/Boost/Reach each have a clean wiki-quoted Minimum/Maximum
Damage pair (Minimum = ending the channel at the lowest charge level, Maximum = at full charge) —
curated into `CURATED_DAMAGE_COEFFICIENTS` as this sweep's 4th leg, WvW+PvP-shared values used per
this sweep's established convention, `weapon: 'bundle'` (new `WEAPON_STRENGTH_MIDPOINTS` key, 968.5,
matching the wiki's own `weapon=bundle` tag on each page — same value as the existing `kit`/`conjure`
keys, kept separate to match what each skill's own wikitext literally says).

This is the first hand-authored-id source to actually get a damage curation entry, which exposed a
real gap in `coefficient-snapshots.test.ts`: its `snapshotFor` helper throws loudly if a curated id
has no matching skill in the on-disk `skills.json` it reads directly (by design — the Gunsaber
precedent never triggered this, since Gunsaber has no curated entries at all). Fixed by importing
`GUNSABER_SKILLS`/`DRAGON_SLASH_SKILLS` directly into the test (both plain data with no Electron
dependency, unlike `load-game-data.ts`) and merging them into the test's own local `skillsById`, the
same merge `game-data-store.tsx` does for the real app. `npm run test` 119/119 (snapshot updated),
`npm run typecheck`/`npm run lint` clean.

Deliberately not attempted this session: Sharp as the Wind / River's Flow, the 2 Bladesworn traits
that reflavor the whole Dragon Slash chain into differently-named/-described ids — spun off as its
own TODO.md item (a `branch-conditional-facts.ts` candidate, same shape as Otherworldly Bond).

## Session 190 — Revenant scepter 2/3 tooltip fixes: Blossoming Aura declutter + Otherworldly Bond
re-curation (reopens Session 131's honest skip)

User flagged both scepter off-hand skills while flipping through the app, with reference screenshots
of the real in-game tooltips for both.

**Blossoming Aura (scepter 2, id 71816)**: the live API duplicates 4 of its `Percent` facts once per
game mode with no mode-selector field (unlike `Damage`'s own `dmg_multiplier`, already handled) — the
skill's own tooltip was rendering all 8 raw percent lines flat and unfiltered. Fetched the wiki's raw
`{{skill fact}}` templates fresh (not the API — no mode field to trust there, and not the screenshot —
too easy to misread which duplicate is which mode) to get an authoritative PvE/WvW split, confirming
one of the 4 "WvW" duplicates additionally comes back from the API mislabeled (`text: "Damage Increase
per Interval"` when the wiki template says `Barrier Increase per Interval`, sharing the Barrier fact's
own icon not the Damage facts'). New `CURATED_PERCENT_FACT_OVERRIDES` table in `skill-fact-lines.ts`
(currently this one skill only) drops each PvE duplicate and relabels the mislabeled WvW one before
`factLine` ever sees it — cuts the tooltip from 17 raw facts down to 12 real ones, matching this app's
existing WvW-first convention for the skill's already-curated Damage/Barrier coefficients.

**Otherworldly Bond (scepter 3, id 71952)**: reopened Session 131's (2026-08-07) "not curatable
without misrepresenting it" conclusion at the user's request. That session's blocker was real at the
time — no mechanism existed to inject facts the live API doesn't carry at all for a mutually-exclusive
per-cast branch — but two things changed the calculus: `synthetic-facts.json` now exists (built for a
later sweep) proving synthetic facts are an accepted pattern in this codebase, and the user supplied a
fresh in-game screenshot of the real tooltip showing exactly how the client itself resolves the
"can't know which branch a given cast picks" problem: it shows BOTH branches side by side, each under
its own "Enemy Target"/"Ally Target" header, rather than picking one. New `branch-conditional-facts.ts`
(`branchConditionalFacts`, keyed by skill id, only this skill today) mirrors that exact layout — two
extra labeled divider sections rendered below the base facts, reusing the same `.tooltip-divider`/
`.tooltip-section-label` CSS and `factsBlock` shape Session 189's enhancement dividers already
established. Session 131's 2nd objection (open-ended tick count, no `stacks=`) is sidestepped rather
than re-litigated: every boon/condition row uses `applyCount: 1` (never claims a total application
count), and the "Might Stacks per Level" line — which doesn't cleanly fit the single-status/single-
duration `BoonConditionSource` shape at all — stays a flat, unscaled text line instead of being
force-fit into one. Wired into `skillTooltipContent` in `SkillsEditor.tsx` right after the existing
`additiveEnhancementFacts` divider block. `Deactivate Otherworldly Bond` (71858) unchanged — Session
131 already confirmed it has nothing beyond Range.

**Correction mid-session**: the first draft transcribed its numbers straight off the user's reference
screenshot, which the user then correctly flagged — that screenshot was captured on a live character
with its own boon-duration gear equipped, not a base-value tooltip. Re-fetched the wiki's raw
`{{skill fact}}` templates + its own rendered Skill Facts table (same rigor as Blossoming Aura's fix
above) and found 2 of the 5 curated values were indeed live-scaled, not base: Fury read 3s (really the
wiki's base-2s × the character's own +50% boon duration) and "Might Stacks per Level" read "(5x4s): 20
Condition Damage, 40 Power" (really the wiki's flat, un-split "(4s): 30 Condition Damage, 30 Power").
Vulnerability/Crippled/Slow already matched the wiki's base WvW values exactly, consistent with that
same character having boon duration but no condition duration equipped — corroborating rather than
contradicting the fix. Both corrected to wiki base values, left for the normal `durationPercent`
scaling to reproduce per-build (verified: a synthetic +50% boon-duration test run reproduces the
original screenshot's 3s Fury exactly). **Lesson: a reference screenshot shows a scaled tooltip, not a
base-value one — always source curated base numbers from the wiki, use a screenshot only to confirm
which facts exist/how they're grouped, never for the numbers themselves.** User then independently
verified by supplying their own character's actual Boon/Condition Duration % (46.66%/0.00%) and
confirming the fix's live-scaled output reproduces their original screenshot exactly, then separately
confirmed the wiki's own rendered fact table matches this file's curated WvW/PvP values line for line.

**Follow-up same session — phase-by-phase branch descriptions**: user flagged that a flat bullet list
of Vulnerability/Cripple/Slow under "Enemy Target" reads as "all three apply the instant you cast,"
losing the escalating-over-time structure the skill is built around. `ConditionalBranch` gained an
optional `description` field — the wiki's own 0-2s/2-4s/4-6s narrative prose (quoted verbatim, same
sourcing rigor as every number in this file), rendered via the existing `.tooltip-description` CSS
`TooltipBody` already uses for a skill's own description, right below each branch's divider label and
above its fact list. `npm run typecheck`/`lint`/`test` clean, manual script confirmed both branches'
description text renders as expected.

Left as an open door, not attempted here: the same "mutually exclusive branches, real screenshot
available" shape likely applies to Twin Moon Sweep (Session 130, also an honest skip) — noted in
`branchConditionalFacts`'s own doc comment for whoever picks that up next, not scoped into this fix.

`npm run typecheck`/`npm run lint`/`npm run test` all clean (119/119), plus a manual script rendering
both skills' real output against sample stats to confirm the fact lines/branches look right before
calling it done (no Electron launch — see the sandbox-limitation note in memory).

## Session 189 — Same-name flip-pair divider rendering (6 of 10 pairs)

Built the "When Enhanced" divider rendering the classification sweep (Sessions 171, 186-188) was
waiting on, for 6 of the 10 confirmed-additive pairs — Revenant's Band Together family (Icerazor's
Ire, Darkrazor's Daring, Razorclaw's Rage, Breakrazor's Bastion) and Guardian's Crashing Courage (both
the normal-cast and ground-targeted pairs).

- New `additive-flip-pairs.ts`: `ADDITIVE_FLIP_PAIRS` (source id -> `{ targetId, triggerLabel }`) +
  `ADDITIVE_FLIP_PAIR_TARGET_IDS` (reverse set).
- `SkillsEditor.tsx`'s `skillTooltipContent` now appends a divider + trigger label + the enhancement's
  own facts when the skill being rendered has an `ADDITIVE_FLIP_PAIRS` entry. The delta is computed
  LIVE by a new `additiveEnhancementFacts` helper — target's real current-build-scaled numeric/boon/
  named facts (`skillFactLines`/`boonConditionFactsForSkill`/`skillNamedFacts`, same functions the
  base skill's own tooltip uses) minus whatever content-key-matches something already on the base's
  tooltip — rather than hand-transcribed text, so it can't drift as gear/traits/duration % change.
- `multi-effect.ts`'s `flipTargetSkills` now also stops its stacked-icon walk at an
  `ADDITIVE_FLIP_PAIR_TARGET_IDS` member (3rd exception alongside `isNonActionableFlipTarget` and the
  Vindicator Aspect check) — the merged divider replaces the 2nd icon instead of sitting next to it.
  Deliberately did NOT touch `boon-calc/sources.ts`'s `withFlipChain` (the build-wide total walk) —
  these targets carry real content that must keep counting toward totals, only the visual
  representation changes.
- New `.tooltip-divider`/`.tooltip-section-label` CSS in `global.css`.
- New permanent regression test `additive-flip-pairs.test.ts` (9 tests): pair count, a guard against
  re-adding an Elementalist familiar id without re-verifying, a per-pair "target has a real delta"
  check, and a `flipTargetSkills` exclusion check. `npm run test` 119/119, typecheck clean.

**Elementalist Evoker's 4 attunement familiars deliberately NOT included**, despite the classification
sweep calling them additive too — caught by a dry run + live wiki fetch (Fox's Fury, Hare's Agility raw
wikitext) before landing. Their base/equippable skill id's own facts are incomplete (the
`damage-calc.ts` Evoker comment's already-documented "flip-architecture gap": the API attaches the
skill's real, UNCONDITIONAL effect to the flip target id, not the base), so an automatic target-minus-
base diff would bundle always-on content (Fox's Fury's unconditional Burning, Hare's Agility's
unconditional Endurance/Swiftness/chain-lightning Damage — both confirmed unconditional by the wiki's
own core description) together with the genuinely specialization-gated extras (breaks stun, extra
might/blur, area damage — confirmed gated by the wiki's "if X is your specialized element" sentence).
Labeling that bundle "Fire/Air Specialized" would misrepresent unconditional content as conditional.
Needs its own hand-curated per-fact split before joining the table; TODO.md entry left open for it,
these 4 pairs unchanged (still 2 stacked icons) in the meantime.

## Session 188 — Same-name flip-pair classification sweep, Mesmer leg (sweep COMPLETE)

Final leg of the flip-pair classification sweep (Sessions 171, 186, 187). Confirmed the 4-pair Mesmer
pool from the original ~50-pair scan: Mind Wrack (10191->49068), Axes of Symmetry (43761->69385),
Split Second (56930->56925), Bladesong Harmony (62617->62586).

All 4 excluded, surfacing a 4th shape not seen on earlier legs:
- **3 pairs — "with Master of Misdirection trait" recharge-reduced variant**: Mind Wrack, Split
  Second, Bladesong Harmony. Wiki-confirmed via each skill's own id-comment (e.g.
  `id = 10191,49068 <!-- normal, with Shatter Storm -->` — "Shatter Storm" is the wiki's legacy name
  for trait 731, now "Master of Misdirection," an always-on Illusions Grandmaster MINOR trait
  ("Shatter skills gain recharge reduction," 15%, `improves type = Shatter, Bladesong, Instrument` —
  matches all 3 skills here). The flip target only changes Recharge/Count Recharge/Maximum Count
  charge-mechanic facts — no new Damage/Buff/Condition fact type appears that the source doesn't
  already have. Bladesong Harmony's Infinite Forge (trait 2206) trait-conditional facts differ in
  count (3 entries on source vs 2 on target) but both are still bare `Damage` values under the same
  trait, read as a game-mode-split representation quirk rather than a new effect.
- **1 pair — byte-identical facts, description-only difference**: Axes of Symmetry. Same
  Damage/4x-Confusion-apply/breaks-targeting/leap-finisher facts on both ids; only the flavor text
  differs (whether clones separately strike vs one strike scaled by clone count — same net effect
  already baked into identical facts), same "flavor text differs, no new fact" shape as Warrior's
  Whirling Strike. The live wiki infobox lists only `id = 43761`; 69385 isn't documented there at all.

**This completes the full ~50-pair same-name flip-pair classification sweep** across all 5 legs
(Revenant, Elementalist, Warrior, Guardian, Mesmer — Sessions 171, 186, 187, 188). Confirmed-additive
pool stays at 10 pairs total (Revenant's Band Together family x4, Elementalist's attunement familiars
x4, Guardian's Crashing Courage x2) — no new candidates found this leg. Divider-rendering design for
those 10 is the next step, not yet started. Full citations in `other-profession-flip-
duplicates.ts`'s doc comment and TODO.md. `npm run test` 110/110, typecheck clean — pure data-table
addition, no code changes.

## Session 187 — Same-name flip-pair classification sweep, Guardian leg

Continuation of the flip-pair classification sweep (Session 171, 186). Scanned every same-name
`flipSkill` pair on Guardian and found 27 raw pairs; 12 were already excluded by the earlier Spirit
Weapon mode-split sweep, leaving 15 to classify (not the originally-estimated 13 — the Glaring Burst
chain turned out to be 4 pairs, not counted individually before).

Mixed result, not one shape like Warrior's:
- **10 excluded** (added to `NON_ACTIONABLE_OTHER_PROFESSION_FLIP_TARGET_IDS`): 9 byte-identical/
  reordered-only pairs (Virtue of Courage, Virtue of Resolve, Wings of Resolve, Tome of Resolve, Tome
  of Courage, Tome of Justice, Radiant Courage, Radiant Resolve, one of the 4 Glaring Burst pairs)
  plus 1 wiki-confirmed PvE/PvP-vs-WvW mode split (Shield of Courage: `id = 30039, 30029`,
  `split = pve pvp, wvw`), same "2nd id instead of an override" shape as Utility Goggles/Berserk.
- **2 pairs are genuine additive enhancement, left alone as future divider-merge candidates**: both
  Crashing Courage pairs (normal-cast and ground-targeted) gain StunBreak + extra Stability/
  Resistance/Protection only with the Indomitable Courage trait equipped — wiki-confirmed on the
  trait's own page ("The active effect of Virtue skill 3 breaks stun and grants stability to nearby
  allies"). The API represents this trait bonus as a full 2nd skill id linked via `flipSkill` instead
  of the usual `requires_trait`-gated facts on one id. Brings the confirmed-additive pool to 10 pairs
  total (8 from Session 171 + these 2).
- **3 pairs are genuinely out of scope, a 3rd shape not seen before**: Shield of Absorption
  (cast forms a knockback dome; detonating it early swaps to an unrelated heal effect, not a superset
  of the cast's facts — same "genuine multi-stage action" bucket as Thief's Deathstrike, just
  replace-not-append) and the remaining 3 Glaring Burst pairs (Guardian's Radiant Forge transform
  swaps which of ~5 unrelated fact sets "Glaring Burst" resolves to depending on equipped radiant
  weapon, all sharing one tooltip name by design — wiki: "Apply an additional effect to Glaring Burst
  until a new weapon is chosen") — same "mode/mechanic-select button, not a boon/condition duplicate"
  category as Revenant's Legendary Renegade Stance.

Full citations in `other-profession-flip-duplicates.ts`'s doc comment and TODO.md. `npm run test`
110/110, typecheck clean — pure data-table addition, no code changes.

**Next leg**: Mesmer (4 pairs: Mind Wrack, Axes of Symmetry, Split Second, Bladesong Harmony) — the
last unclassified pool from the original scan.

## Session 186 — Same-name flip-pair classification sweep, Warrior leg

Continuation of the flip-pair classification sweep TODO.md tracks (started 2026-08-13, see Session
171). Scanned every same-name `flipSkill` pair on Warrior and found 13 (not the originally-estimated
14 — Kill Shot's chain turned out to be 3 hops, all part of one pool): Eviscerate, Arcing Slice,
Earthshaker, Kill Shot (14396→14473→14474→14475, plus a Spellbreaker-specific entry id 42041 that
flips straight to 14474), Skull Crack, Whirling Strike, Combustive Shot, Forceful Shot, Breaching
Strike, Path to Victory, Harrier's Toss, Bloodthirster, and Berserk.

Overturned the sweep's own working hypothesis for this pool: TODO.md had guessed these were
mutually-exclusive adrenaline-gated power tiers needing a dedicated "Tier N" render treatment.
Checked the live wiki (Eviscerate) and confirmed the opposite — all 3 adrenaline tiers ("Level
1/2/3" facts) already report together in ONE fact block on a single skill id. The `flipSkill` target
in each pair turned out to just be a 2nd id carrying identical or reordered-only facts, the same
"2nd id, not 2nd effect" shape `other-profession-flip-duplicates.ts` already tracks for other
professions — not a genuinely different tier at all.

12 of the 13 pairs fit that shape cleanly, cross-checked fact-by-fact against each source/target:
Eviscerate, Arcing Slice, Earthshaker, all 3 Kill Shot hops, Skull Crack, Whirling Strike, Forceful
Shot, Breaching Strike, Path to Victory, Harrier's Toss, Bloodthirster (byte-identical or
reordered-only) plus Berserk, which is its own sub-case — wiki-confirmed as a genuine PvE-vs-
competitive mode split via a 2nd id (30435 PvE: 8s recharge; 30185 PvP/WvW: 15s recharge +
StunBreak), the same "mode split via 2nd id" category as Utility Goggles/Guardian Spirit Weapons.
All 14 target ids (13 duplicate-content + Berserk's mode-split target) added to
`NON_ACTIONABLE_OTHER_PROFESSION_FLIP_TARGET_IDS` in `other-profession-flip-duplicates.ts`.

Left open, not guessed at: **Combustive Shot** (14506→14520) — its Burning fact's `apply_count`
genuinely differs between source and target (1 vs 2), and doesn't cleanly match the wiki's own
stated 2/3/4-pulse-per-adrenaline-tier breakdown either way. The wiki also documents 3 more ids
(14521, 14522, 42803) that exist in local `skills.json` but aren't linked via `flipSkill` at all —
confirmed this is a separate, already-handled duplicate-candidate shape (`profession-mechanic.ts`'s
`resolveMechanicSlot`, which already dedupes same-slot candidates via spec-match + lowest-id
tie-break), not part of this sweep. Left for a future individual wiki-page check.

Also confirmed while investigating: Warrior's mechanic-bar F-buttons (Burst Skill, Rage) DO render
`FlipSkillStack`'s 2nd-icon treatment today — `WeaponSkillBar.tsx` runs the same flip-chain logic
over `professionMechanicBar`'s resolved skill as it does over weapon skills, so this was a real,
user-visible extra-icon bug for every Warrior weapon, not a theoretical one. `npm run test` stays at
110/110, typecheck clean — pure data-table addition, no code changes.

**Next leg**: Guardian (13 pairs, Tome/Virtue/Spirit Weapon chains) — largest remaining pool.

## Session 185 — WvW mode-dependent boon-swap bug: Grace of the Land + Stretched Time fixed

Follow-up after the trait-granted-boons-on-skills sweep closed (Session 184): re-examined the 3
"genuine mode-dependent DIFFERENT-boon swap" traits that sweep left open (Grace of the Land/Ranger,
Stretched Time + Seize the Moment/Mesmer), each flagged at the time as needing a new
`WvwFactOverrides` mechanism since the existing one can only omit or reduce-duration an existing
status, not substitute a different one. On closer look, 2 of the 3 fit the *existing* single-value-
per-status override shape after all — the mechanism wasn't missing, the override entries just hadn't
been added:

- **Grace of the Land (2001)**: pve grants 1-stack Alacrity, wvw grants Might (4s/2 stacks), pvp
  grants Might (6s/2 stacks). The automated wiki scan had already found+omitted the pve-only Alacrity
  concept, but left both raw Might facts (4s and 6s) un-deduped since neither alone is PvE-only — so
  the trait tooltip was showing Might twice at once instead of picking the wvw-correct value. Added
  `Might: 4` alongside the existing `Alacrity: 'omit'`.
- **Stretched Time (1942)**: BOTH its Alacrity concepts ("per Clone", "on Phantasm Spawn") are pve/pvp
  only with no wvw value at all — only its 2 Might concepts (already correctly distinguished via
  existing `BUFF_INSTANCE_LABELS` entries) are wvw-tagged. The automated scan never flagged this
  (neither individual Alacrity fact is a plain pve-vs-wvw+pvp split, so its pattern-match missed it
  entirely) — added `Alacrity: 'omit'`, which correctly clears both concepts at once since neither has
  a wvw application worth preserving.

Both fixes are pure `wvw-fact-overrides.json` additions (hand-patched directly + mirrored into
`fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES.trait`, same "hand-patch + verify `git diff --stat` stays
minimal" pattern the Guardian leg established) — no code changes, no new architecture. `npm run test`
stays at 110/110, typecheck clean.

**Seize the Moment (2022) is still genuinely blocked**, unlike the other two: its wiki breakdown
splits 2 *different* concepts ("Quickness per Clone" and a separate base "Quickness", each with its
own pve/wvw/pvp values) under the same "Quickness" status at once — `WvwFactOverride` can only hold
one number per status per source, so it can't represent both simultaneously. Worse, the raw API
duration field rounds 5 of its 6 facts down to the same 2 buckets (1s/3s), destroying the wvw-precise
values (0.5s/0.75s) entirely — a real WvW-focused fix needs either a new occurrence-indexed override
type (paralleling `BUFF_INSTANCE_LABELS`'s own keying scheme) or some other value-injection mechanism,
not just a missing data entry. Left open, TODO.md not touched (this was never a formal TODO.md item —
tracked only in COMPLETED.md/docs/game-data.md leg writeups and
[[trait_granted_boons_on_skills_sweep_2026-08-14]]).

## Session 184 — Trait-granted-boons-on-skills sweep, Warrior leg (9th and final leg) — sweep complete

Rescanned fresh (specializations.json maps `specializationId`→profession since traits.json has no
direct field) — 53 raw not-yet-linked candidates, again well past the original scoping estimate. 8
traits cleanly curated via `synthetic-facts.json`: Thick Skin (Protection) + Restorative Strength
(Might + Resistance pve-6/wvw+pvp-4) onto all 10 Warrior heal skill ids, the familiar heal-skill-
category shape; Resilient Counter (Resistance) + Guard Counter (Protection) onto Full Counter alone;
Bloody Roar (Resistance) + Burst of Aggression (Quickness pve-3/wvw+pvp-2 + Superspeed + Fury) +
Eternal Champion (Stability x2 stacks) onto both Berserk-entry skill ids (a flip-skill pair, same
shape as shroud-entry/beastmode-entry in earlier legs). Heat the Soul ("grant boons when you hit with
a Burst skill") was the leg's largest single mirror: Might (pve-10/wvw+pvp-8 x3 stacks) + Fury
(unsplit) onto all 79 Burst + PrimalBurst-category skill ids game-wide, Quickness onto 78 of them —
Decapitate, the one skill the trait's own wiki `linked skill=` field names specifically (already
independently confirmed by the closed buff-instance-label sweep), gets a different Quickness value
instead of the blanket one.

Found 2 fresh same-tuple `BUFF_INSTANCE_LABELS` collisions (Prayer to Dwayna/Healing Seed's
Protection@3@1 became a 4th copy; Healing Signet's own pre-existing unconditional Resistance
collided with Restorative Strength's mirror) — both labeled, full merge-and-group recheck across all
91 touched skill ids came back clean otherwise. Skipped the `WvwFactOverrides` entry on Healing
Signet and on 6 of Heat the Soul's 79 ids (5 Eviscerate variants + Decapitate already carry their own
unrelated Might fact a status-wide override would have corrupted) — same "coexisting genuine
application blocks a safe override" hazard every prior leg's version of this check has hit.

Left open: Brave Stride (combo-finisher-category gap, same as Thief leg's Guarded Initiation);
Marching Orders/Soldier's Comfort/Martial Cadence (all keyed off "Soldier's Focus," confirmed not a
real skill id at all); the whole Bladesworn "Positive Flow"/Dragon Trigger cluster (custom stacking
statuses, charge-scaling complexity, one target skill id with unlocalized placeholder API text); the
whole Paragon "Chant" cluster (a very-recent elite spec whose own key trigger skill, "Chant of
Freedom," isn't in `skills.json` yet). ~30 more raw candidates left open in the by-now-familiar
excluded shapes (foe-facing debuffs, custom non-`BOON_NAMES` statuses, dodge/weapon-swap/on-disable/
on-crit dynamic triggers with no skill id, health-threshold/condition-manipulation triggers) — full
writeup in TODO.md's own entry, now removed from TODO.md since this closes the sweep: **all 9
profession legs done** (Necromancer/Elementalist/Engineer/Guardian/Mesmer/Ranger/Revenant/Thief/
Warrior), 48-candidate original scoping estimate confirmed unreliable on literally every single leg —
every leg needs its own fresh rescan, never trust a prior scoping pass's count.

## Session 183 — Trait-granted-boons-on-skills sweep, Thief leg (8th leg)

Rescanned fresh with the corrected `traitedFacts` field name — 46 raw not-yet-linked candidates. 7
traits cleanly curated via `synthetic-facts.json`: a 3-trait "when you steal" category cluster (Cover
of Shadow/Protection, Bountiful Theft/Vigor + Might, Shadow Savior/Dark Aura) all mirrored onto the
wiki's own `improves skill=` list for all 4 Steal-mechanic variants — Steal, Deadeye's Mark, Siphon,
Skritt Swipe (base/Deadeye/Specter/Antiquary); Shielding Restoration (Dark Aura) onto all 11 Thief
heal skill ids, the familiar heal-skill-category shape; Sundering Shade (Fury half only — its
Vulnerability half is foe-facing, out of scope) onto all 23 `StealthAttack`-category skill ids,
found via `skills.json`'s own `categories` field rather than guessed; Be Quick or Be Killed
(Quickness, pve 4s/wvw+pvp 2.5s) onto Deadeye's Mark alone per the wiki's own `improves skill=`;
Fire for Effect (Might pve 12s/wvw+pvp 6s + Fury) onto both Deadeye's Mark and Steal Time, again
following the wiki's `improves skill=` field literally rather than second-guessing which one the
trait's own "always Steal Time" text implied.

Bountiful Theft's Might is a genuine pve-5-stacks/wvw+pvp-1-stack split, but the API encodes it as
two raw duplicate facts differing only in `apply_count` (same 10s duration both modes) —
`WvwFactOverrides` can only override duration, so both facts were mirrored as-is rather than forcing
a fix, same architecture limit `BUFF_INSTANCE_LABELS`'s own doc comment already documents for Feel
the Burn!/Electric Discharge/Burning Rage/Toad's Fortitude. 2 new `WvwFactOverrides` skill-side
entries added, each mirroring a trait's own already-resolved override: Deadeye's Mark gets
`Quickness: 2.5` + `Might: 6`; Steal Time gets `Might: 6` added alongside its pre-existing unrelated
`Quickness: 3` entry. Same-tuple collision re-check came back clean except 2 pre-existing collisions
on the shared racial heals (Prayer to Dwayna/Healing Seed) already labeled from prior legs —
Shielding Restoration's Dark Aura is a new status there, no fresh collision introduced.

Left open: Guarded Initiation (Resistance, "Movement skills grant resistance") — wiki confirms
`improves type = Leap, Retreat`, an unenumerable-from-this-app's-data combo-finisher-type category
(`skills.json` has no finisher-type field), plus 3 named skills and one exclusion; deferred the whole
trait rather than partially curate just the named skills. ~38 other raw candidates left open in the
usual excluded shapes (self-named "unique effect" statuses not in `BOON_NAMES`/`AURA_NAMES`,
foe-facing debuffs, dodge/evade triggers with no skill id, on-crit/on-gain-boon dynamic triggers,
"enter/exit stealth" too broad, condition-removal not a boon grant, health-threshold/on-kill/on-revive
triggers, and Antiquary's very-recently-added artifact mechanic) — full writeup in TODO.md's own
entry. 1 leg remains (Warrior, the final leg of this sweep).

## Session 182 — Trait-granted-boons-on-skills sweep, Revenant leg (7th leg)

Rescanned fresh — 47 raw not-yet-linked candidates (again undercounting the original "5" estimate),
but the rescan also caught a bug in this sweep's own candidate-discovery script: it read
`skill.traited_facts` (snake_case, doesn't exist on the real data) instead of `skill.traitedFacts`
(camelCase) — so the original count included 10 traits the GW2 API *already* links correctly
(Fiendish Tenacity, Permeating Pestilence, Notoriety, Draconic Echo, Demonic Defiance, Diabolic
Inferno, Core Value, Lasting Legacy, Bold Reversal, Song of Arboreum), no action needed on any of
those. Worth re-checking this field name before trusting a "not yet linked" candidate list on either
remaining leg.

8 traits cleanly curated via `synthetic-facts.json`: a 4-trait "invoke a legend" category cluster
(Aggressive Arrival/Resistance, Invoker's Rage/Fury, Spiritual Reckoning/Resolution pve 6s-wvw+pvp
3s, Balance in Discord/Regeneration pve+wvw 6s-pvp-only 3s so no WvW override needed) mirrored onto
all 10 "Legendary ___ Stance" legend-swap skill ids game-wide (Balance in Discord also onto Alliance
Tactics, its own 2nd trigger); Spirit Boon ("invoking a legend grants boons... based on the legend
invoked") mirrored its own per-legend boon, read straight off the wiki's `linked skill=` field, onto
that specific legend's own swap id — Might/Shiro (pve 10s/wvw+pvp 6s), Resistance/Mallyx, Stability/
Jalis, Regeneration/Ventari, Protection/Glint (pve 3s/wvw+pvp 2s), Resolution/Kalla, Vigor/Alliance,
leaving only Legendary Entity Stance's own sub-case open (dynamic "same boons as the other slot's
legend", not a static fact); Set in Stone (Protection, "profession skill 2") mirrored onto the full
wiki `improves skill=` list — 15 ids spanning Ancient Echo, all 5 True Nature variants, Heroic
Command, both Energy Meld ids, and all 6 Release Potential variants; Ashen Demeanor (Might flat +
Resistance pve 6s/wvw+pvp 4s, its Kalla's Fervor half excluded — not a recognized boon) and
Redemptor's Sermon (Protection flat) both mirrored onto all 8 Revenant heal skill ids, the familiar
heal-skill-category shape every prior leg has hit.

Found+fixed 1 fresh same-tuple collision (`BUFF_INSTANCE_LABELS`): Aggressive Arrival's and Spirit
Boon's Resistance@2@1 both landing on Legendary Demon Stance. Found 3 more genuinely-new
wiki-confirmed WvW splits the automated scan had never resolved even at the trait level (Spiritual
Reckoning, Ashen Demeanor, Spirit Boon's Might/Protection halves) — added by hand to
`fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES.trait`, same pattern as the Ranger leg's Celestial Shadow.
Deliberately left open: Invoking Harmony and Unyielding Devotion both grant a custom-named "unique
effect" per their own wiki pages (Invoking Harmony/Unyielding Spirit), not a recognized `BOON_NAMES`
entry — same exclusion class as Kalla's Fervor/Death's Carapace. ~36 other raw candidates left open,
not fitting this sweep's single-triggering-skill shape (weapon-swap/dodge/on-crit triggers with no
skill id, overly-broad "applying a boon"/"gaining fury"/"removing a condition" triggers, health-
threshold triggers, Kalla's Fervor/Battle Scars stat-steppers, and Legendary Alliance/Conduit's
very-recently-added elite-spec mechanics) — full writeup in TODO.md's own entry and
`docs/game-data.md`'s synthetic-facts.json section. 2 legs remain (Thief, Warrior).

## Session 181 — Trait-granted-boons-on-skills sweep, Ranger leg (6th leg)

Rescanned fresh (27 raw zero-skill-linkage-with-a-Buff-fact candidates, vs. the original scoping
pass's "5" estimate — same badly-undercounted pattern every leg so far has found). 11 traits cleanly
curated via `synthetic-facts.json`: Wellspring (Regeneration) onto all 14 Ranger heal skill ids;
Stoneform (Fury + Might) onto all 4 signet ids; Wilderness Knowledge (Fury) onto all 6 Survival skill
ids; Let Loose (Quickness + Might) onto the 12 Soulbeast Unleashed Ambush skill ids (Quickness is
PvE-only, omitted in WvW); a 4-trait "Beast skills grant ___" category cluster (Fang and Claw/Fury,
Rejuvenation/Regeneration, Live Fast/Fury+Quickness, Flock Together/Quickness) onto all 76 Ranger pet
skill ids game-wide at once — the largest single mirror target of the sweep so far (previous largest
was Engineer's 56 tool-belt ids), 5 of those 76 ids individually excluded from an override on just
their one already-real-fact status (their own unsplit Fury/Regeneration/Quickness), synthetic fact
still added unsplit there; Unstoppable Union (Protection) onto Beastmode entry/exit; Celestial Shadow
(Stealth + Superspeed) onto Release Celestial Avatar; Jetstream (Superspeed) onto Hawkeye.

Found one genuinely new wiki-confirmed WvW split the automated scan had never resolved even at the
trait level: Celestial Shadow's Stealth (pve 3s / wvw+pvp 2s) — added by hand to
`fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES.trait`, same pattern as that file's other manual entries.
Fixed 1 fresh same-tuple collision (`BUFF_INSTANCE_LABELS`): Wellspring's Regeneration@6@1 vs. the
Mesmer leg's Metaphysical Rejuvenation mirror, both landing on the shared racial heal skills Prayer
to Dwayna/Healing Seed. Deliberately left open: Grace of the Land — a genuine mode-dependent
DIFFERENT-boon swap (PvE grants Alacrity, WvW/PvP grant Might instead, wiki-confirmed) that isn't
even correctly resolved on the trait's own tooltip yet, needing a base-trait fix before any skill
mirror would be meaningful (same shape as the Mesmer leg's Stretched Time/Seize the Moment);
Spirited Arrival/Quick Draw/Tail Wind/Furious Grip (pet-swap/weapon-swap triggers, no skill id to
mirror onto); Fortifying Bond/Fresh Reinforcement (share/gain your pet's current dynamic boons, not
a fixed grant); Verdant Etching (each Ranger Glyph has 3 separate skill ids for different form
states, not confidently distinguishable this session). Full writeup in TODO.md's own entry and
`docs/game-data.md`'s synthetic-facts.json section. 3 legs remain (Revenant, Thief, Warrior).

## Session 180 — Trait-granted-boons-on-skills sweep, Mesmer leg (5th leg)

Rescanned fresh (52 raw zero-skill-linkage-with-a-Buff-fact candidates, vs. the original scoping
pass's "6" estimate — same badly-undercounted pattern every leg so far has found). 13 traits cleanly
curated via `synthetic-facts.json`, the largest single-leg haul of the sweep: Metaphysical
Rejuvenation (Regeneration) onto all 11 Mesmer heal skills; a 5-trait "Shatter skills" category
cluster (Rending Shatter/Vulnerability, Maim the Disillusioned/Torment, Illusionary
Reversion/Alacrity, Flow of Time/Alacrity, Nomad's Endurance/Vigor) onto all 5 base shatter ids PLUS
all 6 Virtuoso Bladesong ids, confirmed via Rending Shatter's own wiki `improves type = Shatter,
Bladesong, Instrument` field; 2 "Shatter skill 2"-only traits (Illusionary Membrane/Chaos Aura,
Blinding Dissipation/Blinded) onto Cry of Frustration + its Bladesong equivalent; 2 "Shatter skill
4"-only traits (Inspiring Distortion/Aegis, Mental Defense/Resistance) onto Distortion + its
equivalent; Bladeturn Refrain (Aegis) onto all 6 Bladesongs; Master of Manipulation (Aegis) onto all
6 Manipulation-category skills; Temporal Enchanter (Superspeed + Resistance) onto every Glamour
skill except Portal Exeunt (wiki: doesn't grant the boons despite being tagged Glamour).

New failure mode, one level past the usual same-tuple `BUFF_INSTANCE_LABELS` check: a mirrored
trait's status can collide with an UNRELATED pre-existing fact on the same skill that has no
override of its own — adding a `WvwFactOverrides` entry for the new mirror would silently overwrite
that other fact's true value too. Found twice (Healing Seed's own unconditional Regeneration@3@1;
Cry of Frustration/Bladesong Sorrow's pre-existing Phantasmal Force-linked Vigor override) — fixed by
skipping the override, or skipping the mirror entirely where even that wasn't safe. Fixed 1 fresh
same-tuple collision (`BUFF_INSTANCE_LABELS`): Time Warp's own unconditional Superspeed@2@1 vs.
Temporal Enchanter's copy. Deliberately left open: Stretched Time and Seize the Moment (both
dual-trigger, and both a genuine mode-dependent different-boon swap already decoded by the separate
BUFF_INSTANCE_LABELS sweep — see `sources.ts`'s trait-side comments on 1942/2022), Phantasmal Haste
(3 raw facts turned out to be 2 different targets, phantasm vs. player), and Illusionary Defense (a
genuine base+per-clone-scaling mechanic that doesn't fit the flat single-duration fact shape). Full
writeup in TODO.md's own entry and `docs/game-data.md`'s synthetic-facts.json section. 4 legs remain
(Ranger, Revenant, Thief, Warrior).

## Session 179 — Buff instance-label sweep, Elementalist leg (9th leg, FINAL leg) — sweep complete

Closed out TODO.md's "unlabeled duplicate rows" bug — Elementalist was the last profession pool
([[buff_instance_label_sweep_2026-08-13]] convention). Rescanned with all 8 prior legs' methodology
fixes applied — 48 skill + 13 trait conflict sources (61 total), the largest remaining pool since it
was the only one left. One large entangled family accounted for a third of it: Catalyst's "Deploy
Jade Sphere" mechanic, 20 skill ids across its 4 attunement variants' normal/no-energy/underwater/
sphere-specialist sub-variants, plus its own trait (Spectacular Sphere, 2234).

9 sources got a genuine `BUFF_INSTANCE_LABELS` entry: Flamestrike, Rock Spray (3 range-banded
Bleeding stacks, all 3 wiki-labeled — no unlabeled base this time), Ring of Fire, Heat Sync ("Boon
Copied" — a real wiki-`alt=`-labeled fact for the skill's copy-your-current-boons mechanic, API-
encoded as a literal `duration: 0` marker), Pyro Vortex, Pyroclastic Blast, Molten End on the skill
side; Lucid Singularity and Familiar's Blessing on the trait side. Both trait entries are a NEW
failure mode: each grants a DIFFERENT boon per game mode rather than splitting one boon's duration —
Lucid Singularity swaps Alacrity (PvE-only) for Might (WvW+PvP-only) between its "per Pulse"/"on
Overload" triggers; Familiar's Blessing swaps a different boon per `linked skill=` AND per mode across
4 familiar skills, with 2 of its PvE-side pairs colliding on one raw tuple (occurrence-indexed). Its
WvW+PvP-side boons couldn't be surfaced via `WvwFactOverride` either, despite being single-instance —
a direct `/v2/traits/2380` API pull confirmed the wiki's stated wvw+pvp values don't appear in the
live API at all (an undocumented wiki/API mismatch, not just a stale local cache).

23 sources (15 skill + 8 trait) turned out to be plain single-concept pve/wvw(+pvp) splits with no
`alt=` wording — redirected to `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES`, JSON regenerated via
`npm run fetch-wvw-splits` (never hand-edited) — a clean 50-insertion diff. Includes the whole
"Inscription" cluster (the trait itself plus 10 Glyph skills whose Might/Regeneration comes solely
from it, each mirroring the trait's own override), 2 more rounding-quirk hits, a "PvE value rounds up
to exactly match WvW" dedup-only case (Conflagration, same shape as Ranger leg's spirits), a 3-way
pve/pvp/wvw split (Invigorating Torrents), and a Fox's Fury Fury pair the Revenant leg's original
synthetic-facts.json pass never added.

29 sources stayed open. Most (20 skill ids + the Spectacular Sphere trait) are the Deploy Jade Sphere
family: every one of its 20 base per-element conflicts looked cleanly fixable on paper (Fire's Might
pve/wvw split, Air's Fury raw-duplicate collapse, both wiki-confirmed with no `alt=`), but EVERY id
turned out to have a coexisting genuine Spectacular-Sphere-trait-linked copy of that exact status —
the same "coexisting different application blocks a safe status-wide override" hazard as Toss Elixir
H/Reconstruction Field (Engineer leg), just discovered after drafting the fix instead of before, for
all 20 at once. Left as one documented gap rather than 20 separate ones — same conclusion the Thief
leg reached for the Convergence Artifact family. The other 9 open sources: 2 data mismatches (Phoenix,
Seismic Impact); Glyph of Elemental Harmony (its own genuine unsplit Might grant coexists with
Inscription's copy, same hazard as the Jade Sphere family); "Feel the Burn!" and Electric Discharge/
Burning Rage/Altruistic Aspect's Stability (all blocked by `WvwFactOverride`'s duration-only
architecture — the pve/wvw split changes STACK COUNT, not duration); and a genuinely new failure mode
on Flame Uprising — its apparent 2nd Burning fact is gated by a `requires_trait` id that belongs to
Warrior's Shield Master, not any Elementalist line, so it's permanently inert (an Elementalist build
can never have that trait active) rather than an actual bug to fix.

`npm run typecheck`/`npm run lint` clean; full suite 110/110. TODO.md's "Multiple same-status Buff
facts on one skill render as unlabeled duplicate rows" entry removed entirely (the whole `## Bugs`
section is now empty and removed with it) — **the sweep is complete across all 9 professions**: 255
sources from the original scan (`skills.json`/`traits.json`) plus a `synthetic-facts.json` overlay,
every one of them either curated with a real wiki-sourced label, redirected to `WvwFactOverrides`, or
individually documented as left-open with a specific, non-guessable reason.

## Session 178 — Buff instance-label sweep, Mesmer leg (8th leg)

Continued TODO.md's "unlabeled duplicate rows" bug sweep, picking the smallest remaining pool
([[buff_instance_label_sweep_2026-08-13]]/[[pacing_large_sweeps]] convention). Rescanned with all 7
prior legs' methodology fixes applied — Mesmer had 22 skill + 12 trait conflict sources (34 total,
Axes of Symmetry and Lively Lute each split across 2 ids sharing one wiki page/trait data).

Fetched raw wikitext directly via `curl` rather than the summarizing WebFetch tool, per
[[healing_damage_coefficient_curation]]'s "always fetch raw wikitext, never paraphrase" rule — a
couple of early WebFetch summaries turned out to misattribute duration/alt= pairings across
skill-history bullet points, caught by cross-checking against the raw game-data JSON before trusting
any of it.

17 sources got a genuine `BUFF_INSTANCE_LABELS` entry: Temporal Curtain, Phantasmal Mage, The
Prestige, Chaos Armor, Well of Precognition, Chaos Vortex, Axes of Symmetry (both ids), Imaginary
Axes, Lacerating Chop, Lively Lute (both ids) on the skill side; Illusionary Defense, Master Fencer,
Phantasmal Haste, Stretched Time, Seize the Moment, Life of the Party on the trait side. This leg's
own new failure mode: Lively Lute's Might bonus is granted identically by 2 different traits at once
(Bountiful Disillusionment, Chaos GM, and Life of the Party, Troubadour master) — since both can be
slotted simultaneously, `WvwFactOverride` can't safely collapse either copy's own pve/wvw split
without risking silently swallowing the other trait's contribution (the same
extractFromFacts-collapses-every-fact-sharing-a-status hazard as Fox's Fury/Toss Elixir H from
earlier legs), so it got occurrence-indexed `BUFF_INSTANCE_LABELS` entries instead — one per split id,
since which trait's copy comes first in the raw fact array differs between the two. The same
"2 concepts share one status" shape, without the cross-trait wrinkle, also ruled out
`WvwFactOverride` for Phantasmal Haste and Life of the Party's own conflicts.

8 more sources turned out to be plain single-concept pve/wvw(+pvp) splits with no `alt=` wording —
redirected to `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` (Cry of Frustration, Rewinder, Bladesong
Sorrow, Flustering Flute, Deafening Drum, Crescendo, Phantasmal Lancer, Abstraction on the skill side;
Bountiful Disillusionment's Might/Vigor/Fury, Blinding Dissipation's Blinded, Mental Defense, Nomad's
Endurance, Renewing Oasis on the trait side), JSON regenerated via `npm run fetch-wvw-splits` (never
hand-edited) — clean diff, only the 13 new entries added.

Left open, 5 sources: Power Break and Phantom Razor (skill) are each a wiki/local-data mismatch with
nothing safely quotable, same shape as prior legs' Dhuumfire/Death Blossom. Bountiful
Disillusionment's Stability conflict found a new sub-failure-mode: its base pve/wvw pair looks like a
normal override candidate, but the trait ALSO grants a 2nd, genuinely-additive Stability instance
through 3 mutually-exclusive elite-spec-gated `linked skill=`s with no `overrides` link of its own —
collapsing the base pair would silently swallow that bonus whenever an elite spec is selected, and
there's no wiki `alt=` to label it with either, so left open (same hazard class as Toss Elixir
H/Fox's Fury, just newly encountered on the trait's own base facts rather than a linked skill).
Blinding Dissipation's Ineptitude-linked Confusion conflict also stays open — a wiki/local data
mismatch, and the wiki page itself documents this exact display bug as still unresolved in-game.
Flow of Time's Alacrity pair is a new sub-shape of the "PvE and WvW round to the same number"
pattern (Stomp/Electric Artillery precedent): a 2025-02-11 patch raised the WvW value to exactly
match PvE, so what was a real split is now numerically a duplicate with nothing to distinguish it.

`npm run typecheck`/`npm run lint` clean; full suite 110/110 (no new tests needed, same reasoning as
prior legs — the completeness scan already covers new curated keys generically). Rescan confirms
Mesmer's pool dropped from 34 to exactly the 5 sources deliberately left open. TODO.md entry updated
to 8 legs done — only Elementalist remains (the last profession, no more "smallest pool" choice to
make for the final leg).

## Session 177 — Buff instance-label sweep, Ranger leg (7th leg)

Continued TODO.md's "unlabeled duplicate rows" bug sweep, picking the smallest remaining profession
pool per [[buff_instance_label_sweep_2026-08-13]]/[[pacing_large_sweeps]] convention. Rebuilt the
scan script (scratchpad, not committed) with all 6 prior legs' methodology fixes applied from the
start — Ranger came out with only 3 skill conflict sources and 0 trait sources, far below the earlier
"31" estimate (same stale-estimate pattern as Necromancer's "24"→4 drop).

All 3 hits were the elite spirit skills' own pulsed-boon fact, each duplicated identically twice:
Storm Spirit (Fury), Stone Spirit (Protection), Frost Spirit (Resolution). Storm Spirit and Stone
Spirit turned out to be plain pve/wvw+pvp splits with no `alt=` wording — redirected to
`fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` and the JSON regenerated via `npm run fetch-wvw-splits`
(never hand-edited). A new sub-shape of that pattern: the API duplicates the PvE duration onto BOTH
raw facts instead of encoding one fact per mode, so the usual auto-detection (which requires both the
wiki's PvE AND wvw+pvp values to already appear among the raw durations) can't find it on its own —
Storm Spirit's wvw+pvp Fury value (1.5s) had to be confirmed via a 2023-07-18 version-history note
instead, same sourcing shape as Engineer leg's New Genes. Frost Spirit's identical-shaped Resolution
pair stays open — its wiki page carries only ONE `{{skill fact|resolution|2|stacks=4}}` line, no
game-mode split and no `alt=`, so unlike its two spirit siblings there's no wiki text to attribute
either raw fact to (same "one wiki concept, two raw facts" shape as the Thief leg's Dhuumfire).

No new `BUFF_INSTANCE_LABELS` entries this leg (0 skill, 0 trait) — every real find redirected to
`WvwFactOverrides` or stayed open. `npm run typecheck` clean; full suite 110/110 (no new tests needed,
same reasoning as the Guardian leg). TODO.md entry updated to 7 legs done, 2 professions remaining
(Mesmer/Elementalist, smallest-first).

## Session 176 — Buff instance-label sweep, Engineer leg (6th leg)

Continued the same sweep (commit c6c6e89; this session's COMPLETED.md entry was missed when the leg
landed and is being logged retroactively). Rebuilt the scan script from scratch (scratchpad, not
committed — a new session has no access to the prior session's scratchpad file) — 23 skill + 3 trait
conflict sources (Fire Bomb, id 5823, was already curated from the Revenant leg since it's a shared
cross-profession Bomb Kit skill, not a new find).

10 sources got real `BUFF_INSTANCE_LABELS` entries: Blowtorch (4-tuple pve/wvw+pvp mode-variant set,
all labeled, no unlabeled base — same shape as Arcing Slice), Blunderbuss, Radiant Arc (heat-scaled
quickness, 3rd tuple gated by a DIFFERENT trait with no wiki text of its own, left open), Essence of
Liquid Wrath, Essence of Animated Sand, Lightning Rod (id 73002 — wiki's bare "Lightning Rod" title
belongs to an unrelated Elementalist trait; the real page is "Lightning Rod (engineer spear skill)",
found via wiki search, not `titleVariants`), Conduit Surge, Electric Artillery (partial — its
"Minimum Burning Duration" tuple labeled, but 2 "per Charge" pairs stayed unlabeled, same call as
Warrior leg's Banner of Tactics), New Genes (this table's FIRST label sourced from a version-history
note rather than a wiki fact line — the wiki's own Obliterate-linked Might fact is missing its
wvw+pvp variant, but a 2025-12-09 patch note confirms the value), Hardened Chrome.

7 more redirected to `WvwFactOverrides` instead: Magnetic Shield/Static Shield (an Over Shield/trait
394-linked Protection pair, sourced from that trait's own version history since trait 394 has no Buff
fact of its own), Blessing of Dwayna/Leafy Bandage/Static Shock/Bandage Self/Regenerating Mist (an
Expert Examination/trait 1999-linked Protection pair, mirroring that trait's own pre-existing
override). New failure mode found this leg: Toss Elixir H (both ids) and Reconstruction Field carry
that exact same Expert-Examination-linked pair PLUS their own genuine untraited base Protection fact
sharing the same status — since `WvwFactOverride` overrides a whole status (not scoped to just the
trait-gated subset), mirroring the fix here would silently overwrite the legitimate untraited value
even when the trait isn't selected; left unfixed rather than risk a wrong display. Also left open:
Poison Dart Volley (2 raw-identical facts, wiki says pve=7/pvp+wvw=10, a data mismatch), Super Elixir
(both ids, an HGH/trait-473-linked Might pair whose values don't match any of HGH's own 3 Might
tiers), Throw Napalm (no `alt=` anywhere on its page).

`npm run typecheck`/lint clean; full suite passing. TODO.md entry updated to 6 legs done, 3
professions remaining (Ranger/Mesmer/Elementalist, smallest-first).

## Session 175 — Buff instance-label sweep, Guardian leg (5th leg)

Continued TODO.md's "unlabeled duplicate rows" bug sweep, picking the smallest remaining profession
pool per [[buff_instance_label_sweep_2026-08-13]]/[[pacing_large_sweeps]] convention. Rescanned
`skills.json`/`traits.json` with all 4 prior legs' methodology fixes applied from the start —
Guardian came out with 18 skill + 6 trait conflict sources (several split ids sharing one wiki page:
Sword of Justice x4, Shield of Judgment/Tome of Justice x2 each), the smallest of the 5 remaining
professions (Guardian 24 < Necromancer/Engineer 25-26 < Ranger 31 < Mesmer 34 < Elementalist 52).

Most of this leg's real finds turned out to be plain `WvwFactOverrides` cases rather than genuine
per-instance conflicts — a bare mode split with only ONE wiki concept, not two simultaneous ones —
so they got redirected to `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` and the JSON regenerated via
`npm run fetch-wvw-splits` (never hand-edited): Tome of Justice, Shield of Judgment, Sword of
Justice, Advancing Strike (skills); Permeating Wrath, Unrelenting Criticism, Legendary Lore's 3
Tome-linked grants (traits). Permeating Wrath and Unrelenting Criticism both hit the documented "API
rounds a half-second duration up" quirk (1.5s→2s, 4.5s→5s). Willbender Flames' 3 split ids needed a
skill-side override mirroring their Searing Pact trait's own already-curated one — a "trait fact
copied onto the skill it triggers from" case, same shape as the Notoriety cluster.

Only 2 sources got a genuine `BUFF_INSTANCE_LABELS` entry this leg: Rushing Justice's partial
"Initial Burning" skill label (the other 3 raw Burning duplicates don't map cleanly onto the wiki's
single Justice-effect concept, left unlabeled), and this table's first 2 multi-status-family trait
entries — Zealous Scepter (Scepter/Non-Scepter Might Gain, 6 tuples all individually unique but
labeled anyway since the wiki's own naming is real build info) and Phoenix Protocol (Trigger/
Activation, split across BOTH Alacrity and Resolution depending on game mode). Left open, nothing to
curate from: Virtue of Justice and its Dragonhunter flip Spear of Justice (ambiguous passive/active
mode-value overlap, plus a wiki/local-data mismatch on Spear of Justice's Crippled duration), Crashing
Courage (wiki's single unqualified Stability template doesn't cover either split id's real 2-fact
shape), Dragon's Maw (2 raw-identical Slow facts, wiki's split value doesn't appear in the raw data
at all), Resolute Subconscious (2 raw-identical Resolution facts, only one wiki template to quote).

`npm run typecheck`/lint clean; full suite 110/110 (no new tests needed — the existing staleness scan
already covers both table sides). TODO.md entry updated to 5 legs done, 4 professions remaining
(Engineer/Ranger/Mesmer/Elementalist, smallest-first), next leg picks the smallest remaining pool.

## Session 174 — Buff instance-label sweep, Necromancer leg (4th leg)

Continued TODO.md's "unlabeled duplicate rows" bug sweep, picking the smallest remaining profession
pool per [[buff_instance_label_sweep_2026-08-13]]/[[pacing_large_sweeps]] convention. Rescanned
`skills.json`/`traits.json` with both of the Thief/Warrior legs' methodology fixes applied from the
start (exclude `overrides`-linked traitedFacts, pre-filter to `classifyBoonCondition`-recognized
statuses) — Necromancer came out with only 3 skill + 1 trait conflict sources, far smaller than the
original pre-fix "24" estimate.

All 3 skill sources got real wiki-`alt=`-sourced labels: Dark Pact's self-inflicted Bleeding echo
("Self-Bleeding", `applies to=self`), Rending Claws' health-threshold-scaled Vulnerability bonus
("Vulnerability below threshold"), and "You Are All Weaklings!"'s 2 single-stack Might bonuses
(occurrence-indexed, "Might per Hit"/"Might per Melee Hit" — its 5-stack base Might already has a
distinct tuple so needed no entry). The lone trait conflict, Dhuumfire's untraited Burning pair (2
raw-identical 3s facts, its 2 trait-gated `overrides`-linked variants correctly excluded pre-scan),
stays open: the wiki page's base section carries only ONE `{{skill fact|burning|3}}` template,
nothing to distinguish the 2 raw facts — same "one wiki concept, two raw facts" shape as the Warrior
leg's Banner of Tactics Stability pair.

`npm run typecheck`/lint clean; full suite 110/110 (no new tests needed — the existing staleness scan
already covers both table sides, verified the 3 new keys resolve correctly). TODO.md entry updated to
4 legs done, 5 professions remaining, next leg picks the smallest remaining pool.

## Session 173 — Buff instance-label sweep, Warrior leg (3rd leg)

Continued TODO.md's "unlabeled duplicate rows" bug sweep. Re-ran the conflict scan with both of the
Thief leg's methodology fixes applied from the start this time (exclude `overrides`-linked facts,
pre-filter to `classifyBoonCondition`-recognized statuses) — Warrior came out smallest at 19 skill +
4 trait sources, several of them split ids sharing one wiki page (Arcing Slice ×4, Bloodthirster ×4).

Curated 8 real labels: Arcing Slice's 3-tier adrenaline Fury ("Level 1/2/3 Adrenaline", applied
identically to all 4 split ids), Stomp's Stability pair ("Initial Stability"/"On-Hit Stability" —
both wiki-`alt=`-labeled, no unlabeled base, since their pve values happen to be numerically
identical), "Fear Me!"'s distance-scaled Fear ("Maximum"/"Minimum Fear"), Flames of War's Burning
("Final Burning"), Keen Strike's crit-bonus Might ("Critical Might"), Overcharged Cartridges' 2nd-use
Burning ("Supercharged Burning"), "Find Their Weakness!"'s echo Might ("Bonus Might per Enemy
Struck"), and Bloodthirster's 3-tier adrenaline Bleeding ("Level 1/2/3 Bleeding", also applied to all
4 split ids) — plus 2 trait entries: Sundering Burst (now renamed "Rending Strikes" on the wiki,
local data's name is just stale) got its crit-bonus Vulnerability labeled, and Heat the Soul's
Decapitate-linked Quickness became this table's 2nd `linked skill=`-sourced label (after Shadestep in
the Thief leg), "On Decapitate".

3 more sources were plain PvE/WvW(+PvP) splits with no `alt=` wording — fixed via `WvwFactOverrides`
instead (Banner of Tactics' Resistance, Marching Orders' Might, Feverish Pulse's Quickness),
regenerated by running `npm run fetch-wvw-splits` after adding the 3 new `MANUAL_OVERRIDES` entries,
not by hand-editing the generated JSON. The remaining sources stay open: Knot Shot and Brutal Shot's
Immobile pair turned out to be scan false positives (a `{{skill fact|condition|...}}`
Condition-Removed marker fact with no `duration`, already filtered out by `extractFromFacts` before
this table is ever consulted — not a real duplicate, and not present in the app today); Brutal
Shot's Vulnerability pair and Eviscerate's Might pair are pve/wvw+pvp splits where duration AND
apply_count both change, the same `WvwFactOverride`-can't-express-`apply_count` limitation as
Falling Spider (Thief leg); Wounding Strike has no wiki page at all despite a live-API-confirmed
name (confirmed via `/v2/skills/41543` directly); Banner of Tactics' Stability pair has only ONE
`alt=`-labeled Stability template on the whole wiki page for 2 raw-identical facts; Marching Orders'
Protection pair is gated by a different trait (Vengeance) with no wiki text of its own to quote.

`npm run typecheck`/lint clean; full suite 110/110 (no new tests needed — the existing staleness
scan already covers both table sides). TODO.md entry trimmed to a summary + pointer to
`BUFF_INSTANCE_LABELS`'s own doc comment for full per-leg reasoning, rather than growing indefinitely
leg-by-leg. 6 professions remain, Necromancer next-smallest.

## Session 172 — Buff instance-label sweep, Thief leg (2nd leg)

Continued TODO.md's "unlabeled duplicate rows" bug sweep, picking the smallest remaining profession
pool per [[buff_instance_label_sweep_2026-08-13]]/[[pacing_large_sweeps]] convention.

Rescanned `skills.json`/`traits.json` from scratch first, since the original scan's methodology had
a gap: `overrides`-linked `traitedFacts` (an API field meaning "REPLACES the fact this index points
at when the trait is active," confirmed via existing precedent in barrier-calc.ts's comment on Lava
Skin/46447) were being counted as a 2nd simultaneous instance when they're actually a value swap —
excluding them dropped the false-positive count from ~450 candidates to the true ~340. Thief came out
smallest (17 skill + 9 trait conflict sources).

A second, more consequential gap surfaced while curating: several "conflicts" the rescan found don't
actually reach `BUFF_INSTANCE_LABELS`'s lookup at runtime at all. `extractFromFacts` only computes
`instanceLabel` for facts whose `status` passes `classifyBoonCondition` (`BOON_NAMES`/
`CONDITION_NAMES` in constants.ts) — a skill's own self-named buff marker ("Assassin's Signet",
"Facet of Elements", ...) and statuses owned by the entirely separate `MISCELLANEOUS_MATCHERS`/
`computeNamedFactSources` pipeline (Stealth, Superspeed — which already dedupes by matcher name on
its own, no bug to fix there) never get there, curated or not. This ruled out Assassin's Signet and
Shadow Meld's Stealth (skill side) and Instant Reflexes/Meld with Shadows/Unhindered Combatant/
Shadestep (trait side) after they'd already been drafted — caught before committing by checking each
status against the recognized name lists, not left in as dead entries.

Final scope: 6 sources got real wiki-`alt=`-sourced labels (Venomous Knife, Deadly Aim, Brutal Aim,
Malicious Ripper, Holo-Dancer Decoy — both split ids share one entry — and Serpent's Touch, the
first-ever `BUFF_INSTANCE_LABELS.trait` entry, closing the "has no trait entries yet" placeholder
test). 3 more (Holo-Dancer Decoy's Taunt, Panic Strike's Immobile, Be Quick or Be Killed's Quickness)
turned out to be plain PvE/WvW(+PvP) splits with no `alt=` wording — fixed via `WvwFactOverrides`
instead, regenerated by actually running `npm run fetch-wvw-splits` (not hand-editing the generated
JSON) after adding the 3 new entries to `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES`; 2 of the 3 hit the
already-documented "API rounds a half-second duration up" quirk (same shape as Potent Haste/
Overwhelming Celerity). The remaining 8 sources stay open, nothing to curate from (ambiguous API
duplicates, an apply-count-only split `WvwFactOverride` can't express, a wiki split that doesn't line
up with locally-cached values, and a trait-gated Weakness bonus — Hidden Thief — with no wiki `alt=`
anywhere) — full per-source reasoning in `BUFF_INSTANCE_LABELS`'s own doc comment in sources.ts.
Also surfaced but deliberately left alone: a "Convergence Artifact" skill/trait family (Forged Surfer
Dash, Holo-Dancer Decoy, Mistburn Mortar, Possessive Hoarder) sharing a 3-way pve/wvw/pvp split too
entangled to safely curate piecemeal — flagged as worth its own dedicated cross-profession pass.

`buff-instance-label-completeness.test.ts`'s placeholder "no trait entries yet" test grew into a real
trait-side staleness check mirroring the skill-side one. `npm run typecheck`/lint clean; full suite
110/110. TODO.md entry left open — 7 professions' pools still unswept, next leg picks the smallest
remaining one.

## Session 171 — Icerazor's Ire "On Hit" label + same-name flip-pair classification sweep (leg 1)

Two follow-ups from Session 170, both prompted by the user reviewing the live-rendered Icerazor's
Ire tooltip:

1. Added "On Hit" to Icerazor's Ire's 2nd Vulnerability fact (8s/5 stacks) in `BUFF_INSTANCE_LABELS`
   — the wiki gives this fact no `alt=` text, but the user's own original 2026-08-09 bug report
   already characterized it as "on-hit" from direct play, re-confirmed when asked again. The one
   entry in the table sourced from user observation rather than a literal wiki string; doc comment
   updated to flag the exception.

2. User asked why Icerazor's Ire still shows 2 skill-bar icons despite the earlier flip-duplicate
   sweep, and proposed merging same-name "enhanced" flip targets into one tooltip with a "When
   Enhanced" divider instead. Investigated: the existing sweep's own design already explains this —
   `isNonActionableFlipTarget` only hides a flip target with literally NO new content; Icerazor's Ire's
   enhanced cast DOES add real content (Chilled), so it correctly keeps its own icon under that rule.
   The user's proposal is a genuine UX improvement for that specific shape, but "same name on both
   ends of a flip" turned out to cover ~50 pairs game-wide, most of which are NOT the same shape
   (Warrior adrenaline-tier bursts and Guardian Tome/Virtue chains are mutually-exclusive tiers, not
   additive enhancements) — user chose to fully classify all ~50 before any rendering changes, over
   shipping just the 2 already-obvious families.

   First leg: classified Revenant's remaining 2 same-name pairs (Deathstrike — genuine 2-hit combo,
   correctly left as-is; Legendary Renegade Stance — a Legend-select button, out of scope) and all 4
   Elementalist familiar skills (Fox's Fury/Otter's Compassion/Toad's Fortitude/Hare's Agility, now
   individually wiki-confirmed as the same additive-enhancement shape, not just "assumed" as the prior
   sweep left them). Also swept Ranger/Thief/Necromancer's remaining same-name pairs opportunistically
   (smaller pools) and found 7 more zero-new-content duplicates the original 19-id sweep missed (Maul,
   Repeater, Spinning Axe, Death's Advance, and all 3 Necromancer "Innervate" mechanic-slot skills) —
   added to `NON_ACTIONABLE_OTHER_PROFESSION_FLIP_TARGET_IDS`, fixing a real "pointless 2nd icon with
   zero new information" bug immediately using the existing exclusion mechanism, no new code needed.

   8 pairs now confirmed as real divider-merge candidates (Revenant's Band Together family +
   Elementalist's familiars); rendering itself not yet built. Warrior (14 pairs) and Guardian (13
   pairs) — the two largest, most ambiguous remaining pools — logged in TODO.md as the next leg.

`npm run typecheck`/lint/full test suite (110/110) all clean.

## Session 170 — Duplicate same-status buff row labeling: mechanism built, Revenant leg curated

TODO.md's "unlabeled duplicate rows" bug (deferred 2026-08-09 as "leave as-is for now"): re-asked,
user wanted real wiki-sourced qualifiers ("on-hit vs on-summon or other cases"), not a generic
index — different applications "have very different consequences," so an uninformative label
wouldn't actually fix the confusion.

Built the mechanism: `BoonConditionSource.instanceLabel` (new optional field), populated by a new
curated `BUFF_INSTANCE_LABELS` table (`skill`/`trait` shape, same convention as
`TARGET_COUNT_OVERRIDES`) keyed by `${status}@${duration}@${applyCount}` — falling back to an
`#<occurrence>` suffix for the rarer case where 2+ facts share that exact tuple, matching the wiki's
own `{{skill fact}}` template order. `extractFromFacts` resolves it per fact via a new tuple-counting
pre-pass; `SkillsEditor.tsx`'s `factsBlock` renders it next to the boon/condition name (new
`.boon-source-instance-label` CSS, styled like the existing target-count qualifier).

Re-scanned scope first (the original "214 real-API skills" estimate predates `WvwFactOverrides`,
which already resolves a large chunk of same-status "duplicates" that are really just an unsplit
PvE/WvW value baked into 2 raw facts): 255 genuine sources across `skills.json`/`traits.json` (204
skill + 51 trait) once those are filtered out, PLUS a separate `synthetic-facts.json` universe the
first scan couldn't see at all (facts for near-empty-API skills — this is where the ORIGINAL flagged
example, Icerazor's Ire, actually lives).

Revenant leg (1st leg): all 10 `skills.json`-sourced conflicts + 2 of 3 `synthetic-facts.json`-sourced
ones resolved via real wiki `alt=` labels (11 ids labeled total, spanning Fire Bomb/Pain Absorption/
Embrace the Darkness/Searing Fissure/Inspiring Reinforcement/Spear of Anguish/Reaver's Rage/Abyssal
Raze/Release Potential: Mesmer/Icerazor's Ire/Breakrazor's Bastion). 2 exceptions found and handled
differently: `Unrelenting Assault` (26699) turned out to be a plain PvE(8s)/WvW+PvP(3s) Might split
with no `alt=` wording at all — fixed via `WvwFactOverrides` instead (added to both
`wvw-fact-overrides.json` and `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES`, since editing the JSON
output alone would get silently wiped by the next automated run); Darkrazor's Daring (41220/72366)
stays genuinely open — its wiki page has no `alt=` text for either of its 2 simultaneous Stability
facts, nothing to curate from (already a documented gap in `fetch-wvw-splits.ts`'s own comments).

Added `buff-instance-label-completeness.test.ts` — a staleness scan (not a coverage scan) verifying
every curated key still resolves against current `skills.json` + `synthetic-facts.json` data, so a
future game-data refresh that reshuffles a fact's duration/apply_count fails loudly instead of
silently reverting to the unlabeled-duplicate bug. `npm run typecheck` clean; full suite 110/110 (108
+ 2 new). TODO.md entry left open — ~245 sources remain across the other 8 professions plus an
unswept `synthetic-facts.json` remainder; next leg picks up the same way the target-count sweep did
(smallest remaining pool first).

## Session 169 — Assassin's Reward trait healing sweep, closing the last blocked Healing-sweep item

TODO.md's one remaining blocked item from the Weapon-slot Healing sweep: Thief's Assassin's Reward
trait (id 1238) grants "Heal yourself for each point of initiative spent" on ~45 initiative-costing
weapon skills, previously deferred 2026-08-05 as needing per-skill initiative-cost data this app
had nowhere to model. Turned out unnecessary — the GW2 API itself exposes `skill.initiative`
per-skill; the blocker was only about this app's own stored data, not a real data gap. The trait's
own wiki page gives a flat, unconditional rate (151 base + 0.085 coefficient per point of
initiative, no PvE/WvW split), so curation reduced to `baseValue = 151*N` / `coefficient =
0.085*N` per skill, N confirmed via each skill's own wiki infobox + a live API cross-check.

Live-API verification (not just the local `skills.json` snapshot, which turned out stale for
several of these) surfaced two distinct ArenaNet data quirks along the way:
- **Spear/underwater-weapon skills** (6 of them) bake their Healing fact at the pre-2023-06-27
  rate (102/point) instead of the current 151, confirmed still live today (e.g. Shadow Assault,
  id 13068: `initiative: 5` current, but Healing fact = 509 ≈ 102×5, not 151×5=755) — reproduced
  as-is since that's what the live tooltip actually shows, not "corrected" to a theoretical number.
- **Measured Shot / Repeater (13111)** each bake an older, pre-balance-patch initiative cost into
  their Healing fact (unlike the Spear group, N itself is stale here, not just the rate) — left
  uncurated since there's no way to know which N the HP-scaling coefficient would actually use
  without live-testing.

Of the 45 candidates: 28 curated (22 clean + the 6 Spear-quirk skills), 17 stayed uncurated — 14
for the familiar `Array.find`-binds-to-array-order duplicate-fact trap (a genuine PvE/WvW/PvP
initiative-cost split materialized as 2-3 identical-factText facts this table's data model can't
disambiguate, same shape as Shadow Veil), Black Powder (only its PvE/PvP-grouped value is exposed,
no sourced number for its separate WvW cost), and the two stale-N skills above. Added to
`CURATED_HEALING_COEFFICIENTS` in `healing-calc.ts` (Weapon-slot Thief block); golden snapshot
regenerated (168 lines added, only new ids). `npm run typecheck`/full test suite clean (108/108).
TODO.md entry closed.

## Session 168 — Fury-crit-chance trait sweep, closing the last 3 entries

TODO.md's "Nice-to-haves" list had 3 remaining fury-gated critical-chance traits (Engineer's
Hematic Focus, Warrior's Furious Burst, Ranger's Vicious Quarry) needing their current WvW value
confirmed against the wiki before adding to `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`
(seeded 2026-08-01 with Revenant's Roiling Mists; Mesmer's Quiet Intensity added 2026-08-12). A
4th listed trait, Revenant/Renegade's Brutal Momentum, was already resolved earlier (2026-08-13,
Tier 3 reference-build session) as NOT belonging to this family — it's Endurance-gated, not
Fury-gated, curated separately in `FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES`.

Wiki-verified all 3 via raw wikitext (`?action=raw`, not the rendered page):
- **Hematic Focus** (Engineer/Firearms, Minor Master, id 536): `{{skill fact|critical chance
  increase|15|game mode=pve}}` / `|10|game mode=pvp}}` / `|5|game mode=wvw}}` — a genuine 3-way
  split (WvW ≠ PvP), unlike most of this table's entries. The page's own version history shows WvW
  was independently nerfed 10→5 by a 2026-01-13 patch. WvW value curated: 5.
- **Furious Burst** (Warrior/Arms, Minor Adept, id 1342): `{{skill fact|critical chance
  increase|5}}`, no game-mode split. The raw wikitext's own infobox now reads "Precise Strikes"
  (a 2023-11-28 rework changed its trigger from burst-skill-use to weapon-swap), but live
  `traits.json` still names id 1342 "Furious Burst", so kept that name for consistency with this
  app's data. Value curated: 5.
- **Vicious Quarry** (Ranger/Skirmishing, Major GM, id 1888): `{{skill fact|critical chance
  increase|15|game mode=pve}}` / `|10|game mode=pvp wvw}}` — a *second*, independent fact on a
  trait that already had its Ferocity bonus (`+250`, no split) curated in
  `FURY_ATTRIBUTE_TRAIT_BONUSES` since the 2026-08-12 sweep; both facts are real and both apply,
  cross-referenced in both tables' comments so a future reader doesn't mistake the two entries for
  an accidental duplicate. WvW/PvP value curated: 10.

Also fixed a dangling TODO.md cross-reference left over from the 2026-08-13 TODO cleanup pass
(pointed at a "Follow-ups from the Revenant flip-duplicate fix" section that had since been fully
archived to COMPLETED.md/Sessions 165-167). `npm run typecheck`/`lint`/`test` all clean (108/108,
no snapshot changes — crit-chance % isn't part of the coefficient-snapshot fixtures).

## Session 167 — Breakrazor's Bastion Band Together curation (closes the Revenant flip-duplicate follow-up)

The last open item from Session 165/166's flip-duplicate cleanup: Legendary Renegade Stance's heal
skill, Breakrazor's Bastion (45686, flip target 72389), never got the "Band Together" curation its 3
Legend5 siblings (Darkrazor's Daring/Razorclaw's Rage/Icerazor's Ire) did in the 2026-08-12 sweep, so
its flip target sat in `NON_ACTIONABLE_REVENANT_FLIP_TARGET_IDS` as a documented open gap rather than
a permanent exclusion.

Wiki-verified (raw wikitext, not paraphrased) that this skill is shaped differently from its 3
siblings: those are Buff-only skills (conditions/boons), but Breakrazor's Bastion carries real Healing
facts — 3 sub-facts (Initial Self Heal, Heal Pulses, Final Heal), each with its own PvE/WvW/PvP split
— plus 2 Resolution buff facts, all applying on **every** cast (base or enhanced), plus a Barrier bonus
(2440/0.5, no mode split) that's enhance-only. The API returns zero facts of any kind on either id, so
everything is wiki-sourced via the usual `synthetic-facts.json` Case 1 pattern (matching the same
"empty facts" shape as the sibling trio and Legendary Centaur Stance before it).

Curated: Healing (`CURATED_HEALING_COEFFICIENTS`, WvW values — Initial Self Heal 4529/0.8, Heal Pulses
373/0.3, Final Heal 1845/1.5) and Resolution facts on **both** 45686 and 72389 (mirrors how the sibling
trio's own shared action facts, e.g. Stability/Daze/Bonus Defiance Break, are repeated on their own
enhanced ids); Barrier (`CURATED_BARRIER_COEFFICIENTS`, 2440/0.5) on 72389 only. Might/Swiftness/Rapid
Flow Healing deliberately NOT repeated on 72389, matching the sibling trio's own precedent (avoids
double-counting a trait proc that fires once per skill-use event regardless of which cast variant
triggers it). Removed 72389 from `NON_ACTIONABLE_REVENANT_FLIP_TARGET_IDS` now that it's a genuine
superset of its base id's content. `npm run typecheck`/`lint`/`test` all clean (108/108 — 2 golden
snapshot fixtures updated to include the new curated lines, no other changes).

## Session 166 — Same-name flip-duplicate sweep, non-Revenant professions

Follow-up to Session 165's Revenant fix — TODO.md had logged "the same shape exists outside Revenant
too, ~15 more pairs, needs the same per-pair verification" as a deliberately-not-guessed-at follow-up.
Did that verification now: filtered the earlier full-`skills.json` scan down to Engineer/Guardian/
Elementalist/Thief Heal/Utility/Elite skills specifically, which actually turned up 23 pairs (not 15).

Checked each pair's raw + `synthetic-facts.json`-merged fact signature (ignoring pure metadata like
Recharge/Range) for whether the flip target is a strict superset of its source's own content, then
wiki-verified the ambiguous ones directly:

- **19 confirmed non-actionable**, two different reasons: (a) **12 Guardian Spirit Weapon pairs +
  Rejuvenate + the Thief trio** are byte-identical-or-reduced copies with zero new content — Utility
  Goggles' own wiki infobox nails down *why*: `split = pve, wvw pvp` with `id = 5865,29591` both
  listed on one page, i.e. this is the wiki's own PvE-vs-WvW/PvP mode-split convention surfacing as a
  second id instead of a `wvw-fact-overrides.json` correction on the same id, and the other 18 pairs
  share the identical signature. (b) **A.E.D.** (Engineer heal) — its flip target's extra "Shocking
  Aura" fact matches nothing in the skill's current wiki-documented mechanic, so it reads as
  stale/superseded data, same "orphan carries wrong info" shape as Revenant's Centaur orphans.
- **4 confirmed genuinely actionable, left alone**: Elementalist Evoker's 4 familiar Utility skills
  (Fox's Fury, Otter's Compassion, Toad's Fortitude, Hare's Agility) all show their flip target as a
  strict content superset, and Fox's Fury/Otter's Compassion are wiki-confirmed as a real, current,
  attunement-conditional enhancement (e.g. "if fire is your specialized element, this skill also
  breaks stun / grants extra might / strikes nearby foes" — Fox's Fury last balance-patched
  2025-10-28). Toad's Fortitude/Hare's Agility weren't individually wiki-checked but match the same
  signature, so assumed to follow the same pattern rather than excluded on a guess (documented as an
  assumption, not a confirmed fact, in the new file's comment).

Added `other-profession-flip-duplicates.ts` (the 19 new ids, full per-family reasoning) and a small
`non-actionable-flip-targets.ts` exporting `isNonActionableFlipTarget`, which now unions that table
with Session 165's `revenant-flip-duplicates.ts` — both `multi-effect.ts`'s `flipTargetSkills` and
`boon-calc/sources.ts`'s `withFlipChain` were repointed at the combined helper instead of the
Revenant-only constant, so a future family's exclusion table only needs adding to the union, not to
both call sites again. `npm run typecheck`/`lint`/`test` all clean (108/108, no snapshot changes).

## Session 165.5 — TODO.md cleanup: archiving the finished Renegade tooltip/data gaps sweep

Moved here verbatim from TODO.md's "Renegade tooltip/data gaps (flagged by the user 2026-08-12)"
section — both of its items were already marked `[x]` done and the file's own header rule is
"completed work is tracked in COMPLETED.md, not here." No content changes, just relocation.

A user pass over Renegade turned up 5 display gaps, investigated together; the first 3 were fixed
same-session (weapon-clearing bug fix + `Percent` fact rendering + Kalla's Fervor combat-state wiring +
Spirit-Boon-style legend-icon attribution). The remaining 2 were hand-curation sweeps:

- [x] **Legendary Renegade Stance skills are missing on-cast effects the wiki documents** — Renegade
      leg DONE 2026-08-12: Darkrazor's Daring (41220 base / 72366 "Band Together"-enhanced) now has
      Daze/Stability(x2)/Bonus Defiance Break, plus Resistance/Protection on the enhanced cast;
      Razorclaw's Rage (42949/72363) now has Bleeding/enhanced-Torment. Icerazor's Ire (40485/72359)
      was already done by an earlier sweep. Added via `synthetic-facts.json` (see
      `docs/game-data.md`'s "Skills the API returns with no usable facts at all" section) +
      `fetch-wvw-splits.ts` `MANUAL_OVERRIDES` for the one cleanly-splittable status (72366's
      Protection). Deliberately NOT curated, same family, documented in `fetch-wvw-splits.ts`'s
      comment: both skills' wiki Damage coefficients (no CURATED_DAMAGE_COEFFICIENTS entry, matching
      Icerazor's Ire's own precedent), Razorclaw's Rage's "(effect)" ally-buff + dependent "Enhance
      Bleeding" (not a recognized boon/condition name, `factLine` has no generic-text case — same
      Unleashed/Gunsaber-Mode-shaped skip as `docs/game-data.md` already documents), and
      Darkrazor's Daring's WvW-split Stability durations (two simultaneous same-status Buff facts —
      overriding either would collapse-drop the other, same failure mode Fox's Fury's Might hit).
      **Full sweep DONE 2026-08-12** (all 8 legends checked, not just Renegade): Dragon/Assassin/
      Dwarf/Demon/Alliance/Entity Stances turned out to already have real, substantial API facts for
      every heal/elite/utility skill — no gap of this shape existed there. **Legendary Centaur
      Stance was the other real gap**, same "API returns almost nothing" shape as Renegade — fixed:
      Energy Expulsion (27356, Healing/Conditions Removed/Knockdown), Protective Solace (26821,
      barrier Duration), Natural Harmony (27025, Healing/Delay Time), Purifying Essence (27715,
      Healing per Condition Removed/Conditions Removed). Ventari's Will (28427, the legend's
      heal-slot id) needed nothing — wiki-confirmed (2022-06-28 patch notes) it no longer heals at
      all, "will the tablet toward target location" is its whole effect; the near-empty facts were
      correct, not a gap.
      **Load-bearing wrinkle found mid-sweep**: `legends.json`'s ids (the ones `RevenantSkillsEditor`
      actually displays, confirmed via `docs/game-data.md`'s Protective Solace/Jade Winds writeup)
      are DIFFERENT ids from same-named, structurally-unreachable "orphan" siblings elsewhere in
      `skills.json` (26821 vs `29310`, 27025 vs `29082`, 27356 vs `29114`, 27715 vs `29197`) — the
      orphans often carry richer real API facts (an earlier Healing-category sweep had already
      curated 29197, and flagged 29114/29082 as unusable — see `healing-calc.ts`), but being
      unreachable, none of that helps the live ids on its own. Natural Harmony's Healing was
      initially left uncurated for this reason (orphan 29082's own live API value, 1620, disagreed
      with the wiki's 1124) — **resolved same session**: user-verified against the live wiki page
      (base unchanged across every dated Version History entry back to 2015) that 1124 is correct,
      confirming this app's standing wiki-over-API convention holds even when a same-skill API value
      exists to tempt otherwise (an orphan id has no in-game path forcing ArenaNet to keep it
      synced). Energy Expulsion's own orphan (29114) was separately confirmed stale by the same
      route — its "healing fragments" mechanic is verifiably pre-2022-06-28, retired by that patch's
      own wiki-documented notes, matching the current mechanic curated on live id 27356 exactly.
      **Not re-litigated, pre-existing partial curation**: Entity Stance's elite (76968/77001,
      wiki-titled "Fragment of Razah") already had its unconditional Might fact curated by an earlier
      session; its base Bleeding fact and its "Resonance" mechanic (5 different bonus effects
      depending on which OTHER legend is equipped) remain uncurated — a legend-conditional curation
      shape of its own, out of scope here, not chased further this session.

- [x] **Trait-granted boons don't show up on the skill that actually triggers them** — DONE
      2026-08-12. Notoriety (trait 1765, Might on legendary-stance-skill cast) and Rapid Flow (trait
      1760, Swiftness+Heal on any energy-cost skill cast) both curated via `synthetic-facts.json`
      `requires_trait`-gated facts, same mechanism the empty-effect-facts sweep uses, not real
      `traitedFacts` (the API never populates that link for either trait, confirmed via a full scan).
      Both traits turned out to target the exact same 45-skill candidate set (every legend's
      heal/3 utilities/elite across all 8 legends, including Vindicator's 10 Archemorus/Saint-Viktor
      aspect-flip ids) since every one of those costs Energy by design — Notoriety got 44 of the 45
      (Might), Rapid Flow all 45 plus one wiki-documented outlier, Shackling Wave (28472, a Sword
      weapon skill — "Updated this trait to allow Shackling Wave to heal the revenant", 2017-12-13
      patch note). `CURATED_HEALING_COEFFICIENTS` got a matching `'Rapid Flow Healing'` entry per
      skill (WvW value 333/0.05, deliberately NOT reusing the plain `'Healing'` factText some of
      these skills already have their own unconditional entry for — `skillFactLines`' `healingByLabel`
      lookup collapses same-text entries and would otherwise show the wrong number on one of the two
      lines). `wvw-fact-overrides.json` got a matching `Might: 10` override per skill via
      `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` (mirrors the trait's own already-curated WvW value).
      **One documented display gap**: Facet of Strength (26644) did NOT get a Notoriety fact at all —
      it already carries 2 real Might facts under an existing WvW override, and `extractFromFacts`
      collapses every fact sharing one status once any override exists for it, so a 3rd (ours) would
      be silently dropped rather than shown (same hazard Fox's Fury/Darkrazor's Daring hit in the
      empty-effect-facts sweep, see `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` comment) — adding
      permanently-invisible data seemed worse than a documented omission. 4 more skills (Twin Moon
      Sweep, Empowering Misery, Selfish Spirit, Nomad's Advance) got the Notoriety fact but no WvW
      override for the same underlying reason, so their Notoriety line shows a flat 5s instead of
      splitting 5s pve/10s wvw — a narrower, cosmetic-only version of the same gap.
      **Deliberately out of scope, not chased this session**: Notoriety's own trait infobox also
      names Ancient Echo (core Revenant F2), True Nature ×5 legend flavors (Herald F2), and Citadel
      Order ×3 (Renegade F2-F4) as triggering skills — none of the 3 render anywhere in this app's UI
      at all (confirmed: none of their ids appear in Revenant's `professionSkills` list at all, the
      same real API-gap class `profession-mechanic.ts`'s `EXCLUDED_MECHANIC_SKILL_IDS` already
      documents for Dragonhunter's virtues/Specter's mechanics — would need new hand-injected
      mechanic-bar wiring before any trait-linking here could ever be seen). Also unexplored: whether
      a Facet's flip/consume half (e.g. Infuse Light, reached via `FlipSkillStack`'s own independent
      tooltip) should carry these facts too, since consuming a Facet is its own energy-costing skill
      activation in-game — left uncurated pending a genuine per-skill mechanic check, not assumed
      either way.

## Session 165 — Revenant skill bar phantom "flip" duplicate rows, found by the user

User flagged (screenshots of a live 2-legend skill bar) that Revenant's Heal/Utility/Elite row shows
a second full row of icons underneath, even though not every skill has a real flip/secondary action —
and that this also produced duplicate-looking entries in the boon/condition totals.

Root cause: `flipTargetSkills` (drives `SkillsEditor`'s `FlipSkillStack`, the stacked-icon UI for a
skill's `flipSkill` chain) and `withFlipChain` (`boon-calc/sources.ts`, folds a skill's flip chain into
the build's aggregate boon/condition totals) both assume every `flipSkill` hop is a genuine on/release
action pair (e.g. Facet of Chaos -> Chaotic Release — different name, different facts, the common
case, correctly rendered). A full scan of every Legend's heal/3-utility/elite `flipSkill` chain found
9 ids across 4 Legends that break that assumption in 3 different ways, none a real secondary action:

1. **Legendary Demon Stance** (28219 Empowering Misery, 27322 Pain Absorption, 27505 Banish
   Enchantment) each flip to a byte-for-byte-or-near-identical copy of themselves under a different
   id (78681/78505/78587) — no wiki mechanic names a second cast for any of these.
2. **Legendary Centaur Stance**'s 3 already-documented "orphan" siblings (see the Renegade-tooltip-
   gaps sweep, COMPLETED Session prior to 162) — 27025 Natural Harmony -> 29082, 27356 Energy
   Expulsion -> 29114, 27715 Purifying Essence -> 29197 — are worse than redundant: showing them would
   re-surface already-confirmed-*wrong* numbers (29082's Healing 1620 vs. the wiki-verified 1124 now
   curated onto live id 27025; 29114's whole "Healing Fragment" mechanic confirmed retired by the
   2022-06-28 patch).
3. **Legendary Entity Stance**'s Beguiling Haze (both ground-targeted and not, 76805->76917,
   77141->77159) flips to a Recharge-1 twin with otherwise identical facts — the wiki's real
   "Resonance" conditional bonus for this skill is still uncurated (TODO.md), so there's nothing yet
   to distinguish the flip target from the source.

Also found or (Renegade Legend5) confirmed-correct-to-keep: 3 of Legend5's 4 flip pairs
(72359/72363/72366) are the already-curated Kalla's Fervor "Band Together"-enhanced casts from an
earlier dedicated sweep — genuinely distinct facts (extra Resistance/Protection/Torment/Chilled),
correctly left alone. The 4th, 45686 Breakrazor's Bastion -> 72389, never got that sweep and currently
has zero distinguishing facts either — flagged in the new exclusion table as a still-open curation gap
(remove once it's curated) rather than assumed permanent, same "documented, not guessed" treatment
`VINDICATOR_ASPECT_ARCHEMORUS_IDS` already established for this exact class of problem.

Fixed via a new `NON_ACTIONABLE_REVENANT_FLIP_TARGET_IDS` table
(`src/shared/skill-calc/revenant-flip-duplicates.ts`, full per-entry reasoning in its doc comment),
wired into both `flipTargetSkills` (`multi-effect.ts`) and `withFlipChain` (`boon-calc/sources.ts`) —
the walk now stops before appending one of these ids instead of rendering it as a phantom stacked icon
or double-counting its source's own facts under a different id. `npm run typecheck`/`lint`/`test` all
clean (108/108 tests, no snapshot changes — none of the 9 excluded ids had a
`CURATED_HEALING_COEFFICIENTS`/`CURATED_DAMAGE_COEFFICIENTS` entry of their own being exercised through
this path).

**Not fixed, logged in TODO.md as a follow-up**: the same "flipSkill points at a same-name sibling"
shape exists outside Revenant too (a full-codebase scan found ~15 more pairs across Engineer, Guardian,
Elementalist, and Thief Heal/Utility/Elite skills) — each needs the same kind of per-pair fact
comparison this session did for Revenant before deciding curated-content-worth-keeping vs.
stale-duplicate-worth-excluding, not assumed to be the same shape without checking.

## Session 164 — Mesmer's Mirror Blade coefficient re-verification (Tier 2's flagged stale entry)

Closed the one open item TODO.md's Tier 2 snapshot build (Session 161) had left behind: `CURATED_DAMAGE_COEFFICIENTS[10333]` only resolved 2 of its 3 lines against current `skills.json`.

Fetched Mirror Blade's raw wikitext fresh (`action=raw`) — completely unchanged since this entry was originally curated (still Maximum 2.5 PvE/0.75 WvW, Minimum 0.4437 PvE/0.1923 WvW, most recent Version History entry 2026-04-14). Cross-checked against a fresh, independent `api.guildwars2.com/v2/skills/10333` pull (not just this repo's cached copy) and got a byte-identical result to what's already in `skills.json` — confirming the mismatch is a real live ArenaNet API bug, not a stale local cache: `facts` now carries *two* `'Maximum Damage'` entries (both `dmg_multiplier` 0.75, the WvW value) and the `'Minimum Damage'` fact/text is gone entirely.

Fixed by adding a synthetic `'Minimum Damage'` `Fact` for skill 10333 in `synthetic-facts.json` (cosmetic `dmg_multiplier: 0.1923`, matching the WvW value for parity with a real fact) so the still-correct, still wiki-verified 0.1923 coefficient has something to key off again — same "no live-API fact of the matching text to gate on" shape `docs/game-data.md`'s `synthetic-facts.json` section already documents, no code changes needed (`damageLinesForSkill`'s match is a presence check by `factText`/`requiresTrait`, not by the API's own `dmg_multiplier`, so the two real duplicate Maximum Damage facts were already harmless).

Also traced the *other* half of what Tier 2 flagged — a second trait-2206-gated `traitedFacts` entry (`dmg_multiplier: 2.675`) the curated table didn't reference at all. Confirmed it's not a new mechanic: Infinite Forge's own wiki page (re-pulled raw) documents its own PvE/WvW split, `damage increase|7|pve` / `damage increase|10|wvw pvp` — 2.5 (PvE Maximum) × 1.07 = 2.675 exactly, mirroring 0.75 (WvW Maximum) × 1.10 = 0.825 exactly, the value already curated. This app's standing WvW-only convention already picks the right one; no new curated line was needed.

`npm run test -- -u` regenerated the Tier 2 snapshot (now shows all 3 lines: Maximum 938, Minimum 240, Infinite-Forge-traited Maximum 1031) — clean 4-line diff, no other snapshot moved. `npm run typecheck`/`npm run lint` both clean, 108/108 tests pass.

## Session 163 — Phantom double-counted two-handed-weapon infusions/sigils, found by the user

Follow-up to Session 162: after that session's Power-total fix landed, the user reloaded their
actual saved Renegade build and got 2841, not the 2830 the session had verified — a clean +10 over
the reconstructed test build's 2831 (itself already matching the external oracle). +10 is exactly 2
extra Mighty WvW Infusions (+5 each), which pointed straight at a two-handed weapon's 2-slot
infusion capacity being counted twice somewhere.

Root cause: `weaponSlotCapacity()` in `EquipmentEditor.tsx` (used only by the "apply to all"
sigil/infusion bulk-fill actions, not by the per-slot pickers) derived a slot's upgrade capacity
purely from that slot's own `weaponType`/`TwoHand` flag. A two-handed weapon's off-hand mirror slot
(`weaponA2`/`weaponB2` — `itemStatId`+`weaponType` mirrored from the main slot per
`setMainItemStat`'s own doc comment, but deliberately given no sigil/infusion picker of its own in
the render, per `renderWeaponPair`) still has that mirrored `weaponType` set, and that weapon type
*is* `TwoHand`-flagged — so the naive check returned capacity 2 for the mirror slot too, same as the
real main slot. `applySigilToAll`/`applyInfusionToAll` then wrote a second, phantom set of 2
sigils/infusions onto the mirror slot on top of the main slot's real 2, and
`computeGearAttributeTotals` (which iterates every populated slot key independently, with no
"is this a mirror" awareness) counted both — a two-handed weapon's infusions/sigils contributed
double whenever the bulk-fill action had ever been used on it.

Fixed: `weaponSlotCapacity()` now recognizes the mirror relationship (new
`WEAPON_OFF_HAND_MIRROR` map: `weaponA2`->`weaponA1`, `weaponB2`->`weaponB1`; underwater slots
excluded — `weaponU1`/`weaponU2` are never paired, each is independently a real weapon) and returns
0 for a mirror slot whenever its paired main slot is actually two-handed.
`applySigilToAll`/`applyInfusionToAll` were also changed to always write (including a capacity-0
write, i.e. `sigilIds: []`/`infusionIds: []`) rather than skipping once a `weaponType` is present —
so the next time either bulk-fill action runs, it self-heals any stale phantom data an
already-saved build (like the user's) is still carrying, not just prevents new occurrences.

## Session 162 — Tier 3 hand-verified reference builds + 2 real bugs found & fixed

Picks up TODO.md's "Automated testing strategy" Tier 3, the final tier, right after Session 161's
Tier 2 — closes out the whole testing-strategy item. Unlike Tier 1 (arithmetic against wiki-quoted
constants) or Tier 2 (drift protection for already-curated tables), Tier 3 is the actual
manual-verification oracle: real builds independently checked against gw2skills.net/in-game, not
just against this app's own reasoning about itself.

The user supplied 3 real WvW builds they'd hand-built with their guild (gw2skills.net editor links
+ screenshots of the Gear/Traits/Skills tabs) — Power Strip Renegade, Shattered Aegis Firebrand,
Heal Druid. Along the way the user taught a reusable shorthand for describing trait picks:
`"[Specialization] x-x-x"`, where each `x` (1/2/3 = top/mid/bottom) is that tier's chosen column,
decodable directly against `traits.json`'s own `order` field — saved to memory
(`trait_notation_shorthand`) since it'll come up again. All 3 builds' gear/rune/sigil/infusion/food/
utility/relic/skill/trait ids were resolved against this repo's own `data/game-data/*.json` (not
guessed from screenshot icons — an early attempt to cross-reference against a public build-guide
site via `WebFetch` produced fabricated trait-line names for a Revenant, since these are custom
guild builds with no public match, and was abandoned in favor of asking the user directly).

**Building the first (Renegade) build's oracle number surfaced 2 real, previously-unmodeled bugs**
— its computed Power (2641) and Critical Chance (27.3%) didn't match gw2skills.net/in-game (2830 /
60.29%) even after every gear/trait/rune/infusion input was confirmed correct, which is exactly the
"silent omission" class this whole testing strategy exists to catch. Both fixed same session in
`combat-state.ts`/`derived-stats.ts`/`CombatStatePanel.tsx`:
1. **`HEALTH_THRESHOLD_CONSUMABLE_BONUSES`** (new) — the WvW "Writ of X"/"Thesis on X" consumable
   family (36 items: Strength→Power, Accuracy→Precision, Malice→Condition Damage, 5 tiers each at
   40/100/120/160/200, all "Gain N Attribute When Health above 90%") parsed to `{attribute: null}`
   in `AttributeBonusText` — the existing parser only recognizes flat/percent/sourceAttribute
   shapes, not a health-threshold-gated one, so every one of these 36 items silently contributed
   nothing. Only traits had an equivalent table before this
   (`HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES`); this is the consumable sibling, gated the same way
   (only the `'above75'` `HealthTier` bucket qualifies, since ">90%" only cleanly maps onto that
   tier). Wired into `computeCharacterStats` directly (alongside `activeConsumableConversions`,
   which already has the `foodById`/`utilityById` maps `combatStatePoints` doesn't receive).
2. **`FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES`** (new) + **`CombatState.fullEnduranceActive`**
   (new field, defaults `true` — endurance regenerates passively like health, same "assume the
   steady state" reasoning `healthTier`'s `'above75'` default already uses, unlike an
   externally-granted boon like Fury which defaults off). Renegade's Brutal Momentum trait (id
   2142) was wiki-verified (raw wikitext) to grant +10%/+15% (PvE+WvW/PvP) critical chance
   unconditionally, REPLACED (not stacked on top of) by +33% while at full Endurance — confirmed
   both from the wiki's own `alt=` template usage (an override display name for the same fact slot)
   and empirically against the reference build's real total (base + Precision term + 33 matched
   exactly; + 10 + 33 overshot). An earlier trait-attribute-completeness-scan comment had actually
   already flagged Brutal Momentum as "aren't curated yet" but miscategorized it as Fury-gated
   (grouped with Roiling Mists/Quiet Intensity) — corrected in that comment too. Wired into
   `derived-stats.ts`'s `criticalChance` formula; surfaced in `CombatStatePanel.tsx` as a new
   toggle icon (only shown when a curated trait is active, same gating pattern as
   `mechanicActive`/`revealedActive`), and the existing health-tier selector's surfacing condition
   was widened to also fire for a curated health-threshold *consumable* (previously trait-only).

With both fixed, all 3 builds' full stat panels (Power/Toughness/Vitality/Precision/Ferocity/
Concentration/Armor/Health/Critical Chance/Critical Damage/Boon Duration/Magic Find) match the
external oracle within normal display-rounding tolerance. New
`src/shared/gear-calc/tier3-reference-builds.test.ts`, 9 tests (`npm run test` now 108 total).

Also discovered along the way: `computeGearAttributeTotals` relies on a "mirrored slot" convention
for two-handed weapons (`EquipmentEditor.tsx` writes the same `itemStatId`/`weaponType` into both
`weaponA1` and `weaponA2`, letting the calc treat every weapon slot uniformly as one-handed and get
the correct two-handed total by summing both mirrored slots) — already covered by a Tier 1 test
(`attribute-totals.test.ts`'s "weaponOneHanded doubled equals weaponTwoHanded") but easy to miss
when hand-constructing a `Build` object outside the UI, as this session's own first draft did.

## Session 161 — Tier 2 golden snapshot fixtures (curated coefficient tables) + 4 drift bugs found & fixed

Picks up TODO.md's "Automated testing strategy" Tier 2, right after Session 160's Tier 1. Where
Tier 1 hand-verified the *arithmetic* against wiki-quoted constants, Tier 2 pays no new
verification cost at all — it locks in the *already wiki-verified* output of
`CURATED_HEALING_COEFFICIENTS`/`CURATED_DAMAGE_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`
(150+ sessions of curation) as a snapshot, so a future regression shows up as a diff instead of
shipping silently.

New `coefficient-snapshots.test.ts` (`skill-calc/`, 3 tests): reads `skills.json` +
`synthetic-facts.json` directly and merges them the same way `load-game-data.ts`'s
`withSyntheticFacts` does (that function itself is Electron-`app`-path-dependent and can't be
imported into a plain vitest run) — several curated entries (every Legendary Stance skill's "Rapid
Flow Healing" line) only resolve against a synthetic fact, so skipping the merge would've silently
snapshotted an incomplete picture. Computes `healingLinesForSkill`/`damageLinesForSkill`/
`barrierLinesForSkill` for every curated skill id at one fixed reference build (Power 2500/Healing
Power 1500/`TARGET_ARMOR_VALUES.Medium`, every curated `requiresTrait` active at once so both a
skill's untraited and trait-boosted lines land in the same snapshot pass) and snapshots the whole
result per table. Also fails loudly (not silently) if a curated id no longer resolves to any skill
in `skills.json` at all.

**Building this surfaced 5 real bugs**, not just 5 rows of numbers — a curated `factText` silently
failing to match its skill's actual live-API fact text is exactly the "silent omission" class the
whole testing-strategy discussion (TODO.md, 2026-08-12) singled out as undetectable by a plain
value-correctness snapshot on its own; catching it here was a byproduct of computing real output
against real current data rather than hand-picked fixtures. **4 fixed same session** (curated
`baseValue`/`coefficient` confirmed unchanged — only the label was stale):
- Necromancer's Deadly Feast (10619): curated `'Life Siphon Healing'`, live API just says
  `'Healing'` on this particular skill (its Life-Siphon-family siblings do use that longer label,
  likely where the copy-paste came from).
- Ranger's Troll Unguent (12483): curated `'Health per second'`, live API capitalizes `'Health per
  Second'`.
- Elementalist's Wind Slam (62747, Hammer 1/Air): curated `'Damage'`, live API labels it `'Maximum
  Damage'` (unlike its other Hammer-1 attunement siblings, which really are plain `'Damage'`).
- Warrior's Tsunami Slash (14480, Spear 5), Barbarian's Retaliation (1338)-traited variant: curated
  `'Damage per Strike'` (matching the untraited fact's label), but the `traitedFacts` entry is
  labeled plain `'Damage'`.

**1 left unfixed, logged in TODO.md — needs fresh wiki verification, not a text fix**: Mesmer's
Mirror Blade (10333). Its 3rd curated line (`'Minimum Damage'`) matches nothing at all anymore —
the skill's real `facts` now carries two `'Maximum Damage'` entries, no Minimum — and its
`traitedFacts` carries a second Infinite-Forge(2206)-gated fact this table doesn't account for
(`dmg_multiplier: 2.675`) alongside the already-curated one (0.825). A real content/shape change,
not a naming drift — left as a documented TODO item rather than guessed at.

`npm run test` now 99 total (up from 96), `npm run typecheck` clean.

## Session 160 — Tier 1 value-correctness tests (gear/derived-stat formulas)

Picks up TODO.md's "Automated testing strategy" secondary priority, first of the 3 tiers (Tier 1:
deterministic formulas needing no external oracle). Unlike Sessions 156-159's completeness/coverage
scans (which only check that a source was *looked at*), these hand-compute an expected number from
the same wiki-quoted constants each source file already cites in its own comments and assert the
code reproduces it exactly — catching an arithmetic slip (wrong divisor, dropped term, compounding
where the game doesn't) that a completeness scan can't see because it never looks at values.

New `attribute-totals.test.ts` (36 tests, `gear-calc/`): `statComboContribution`'s
`adjustment * multiplier + value` formula at several adjustment tiers (armorHelm, trinketAmulet,
weaponTwoHanded) against the wiki-quoted ascended constants, plus the one-handed-mirrored-equals-
two-handed identity `computeGearAttributeTotals` relies on; `addBonus`'s 4 shapes (flat alias,
percent bucket, "to all stats" distribution, sourceAttribute no-op, unmapped/null no-ops);
`applyConversions`' simultaneous-not-chained resolution (multiple conversions all read the same
pre-conversion snapshot, and multiple conversions targeting the same attribute sum);
`boonDurationPercent`/`conditionDurationPercent`'s 15-points-per-1% conversion plus already-percent
bonus;
`magicFindPercent`'s pass-through; `resolveItemStatId`'s category self-heal (armor/weapon <->
trinket id correction by matching name); `isActiveWeaponSlot`'s land-set/underwater-set/non-weapon
gating; and `computeGearAttributeTotals` end-to-end (single-slot sum, two-handed mirroring, stowed-
set exclusion, empty-weapon-slot exclusion, underwater two-handed adjustment, infusion flat add,
sigil active-set gating, rune per-piece-count stage-gating — including a 4th stage staying locked
at only 3 pieces equipped, food/utility bonus lines).

New `derived-stats.test.ts` (14 tests, `gear-calc/`): `computeCharacterStats`'s crit chance formula
(5% base + Precision/21 above 1000, plus Fury's flat +20% only when `furyActive`), crit damage
formula (150% base + Ferocity/15), health formula (per-profession baseline + Vitality*10, confirmed
to actually differ by profession for identical Vitality), and armor formula (Toughness + Defense,
Defense gated per-armor-piece on that slot having an `itemStatId` — a partial 1-of-6-piece build
sums to less than the full 6-piece `fullArmorDefense` total, proving the per-piece gate is real
rather than always crediting the full set). Also pins the with-no-equipment baseline: attributes
match `BASE_ATTRIBUTES` exactly, crit chance/damage sit at their bases, health is exactly the
profession floor, armor is exactly base Toughness, and boon/condition duration/magic find are 0.

One test-writing mistake caught by the tests themselves and fixed before landing: an `ItemStat`
fixture used the display name `'Ferocity'` as its `attribute` key, but `ItemStat.attributes` uses
the raw ItemStat/API key convention (`CritDamage`) per `AttributeTotals`'s own doc comment in
`attribute-totals.ts` — `addBonus`'s free-text alias table doesn't apply to raw gear stat combos,
only to Rune/Consumable bonus lines. Fixed by using `CritDamage` directly, matching real
`itemstats.json` data.

`npm run test` now 96 total (up from 82), `npm run typecheck`/`npx eslint .` both clean.

## Session 159 — State-dependent bonus tests (Kalla's Fervor-shaped)

Closes TODO.md's "Automated testing strategy" item #3, the last of the 3 completeness/coverage
items (siblings: Session 156-ish trait scan, Session 158 sigil scan). Unlike those two structural
scans, every family in `combat-state.ts` is a runtime-parametrized formula (a per-stack multiplier,
a boolean gate, a 3-way health tier) — a single static snapshot only ever checks one point in that
state space and would pass even if the scaling itself were broken (e.g. a bonus that stopped
scaling past 1 stack, or a gate wired backwards).

New `combat-state.test.ts` (38 tests, `gear-calc/`) calls each state-dependent function at 0/mid/max
points of its own dimension and asserts the exact hand-computed value at each — not re-verifying the
underlying wiki numbers (each curated table's own comment already documents that source), just
locking in that the formula built on top of them stays correct:
- `mightStacks` — flat per-stack Power/ConditionDamage grant at 0/12/25 stacks, plus a curated
  per-stack trait bonus (Awaken the Pain) stacking on top, plus confirming the trait bonus is absent
  when the trait itself isn't active regardless of stack count.
- Stacking sigil — single-attribute (Bloodlust) and "all stats" (the Stars, expands to all 9 core
  attributes) scaling at 0/12/25 stacks, plus confirming a sigil on the *inactive* weapon set never
  contributes at any stack count.
- All 5 boolean-gated families (`furyActive`/`regenerationActive`/`quicknessActive`/
  `mechanicActive`/`revealedActive`) — table-driven off/on pair per family against one curated trait
  each, confirming the bonus is fully absent when off and exactly right when on.
- `healthTier` — all 3 tiers against 2 curated traits at once (Empire Divided + Last Rites), proving
  the additive sum changes correctly per tier including the below-50% tier where both traits' bonus
  moves to a *different* target attribute (Power → Healing).
- A combined-state test proving two families targeting the same attribute (Might-stack scaling +
  health-threshold Power) accumulate additively rather than one overwriting the other.
- `kallaFervorPercentPerStack` — base 2%/2%/2% vs. Lasting Legacy's improved 3%/3%/3%, a straight
  override not an additive stack.
- End-to-end via `computeCharacterStats`: Kalla's Fervor's 3 derived-stat percentages at 0/3/5
  stacks (base and Lasting-Legacy-improved rates), the curated relic bonus adding onto
  `outgoingDamagePercent` only while `relicActive`, and `furyActive`'s critical-chance bonus
  (flat 20% plus a curated Fury-gated crit trait, Roiling Mists) off vs. on.

All fixtures are self-contained synthetic `Build`/`Trait` objects built by local test helpers
(`makeBuild`/`buildWithTrait(s)`) — no dependency on `data/game-data/traits.json` or the renderer's
`makeBlankBuild`, so these tests exercise the formula in `combat-state.ts`/`derived-stats.ts` in
isolation from data-curation correctness (that's the completeness scans' job). `npm run typecheck`/
`npm run lint`/`npm run test` all clean (46 tests total across all 3 test files).

This closes out all 3 items in TODO.md's "Priority: completeness/coverage tests" list. Next up per
that section's own ranking is the secondary-priority Tier 1/2/3 value-correctness tests, not started.

## Session 158 — Sigil/Control-Strip completeness scan

Closes TODO.md's "Automated testing strategy" item #2, sibling to the trait attribute-bonus
completeness scan (Session 156-ish). `CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`/
`BOON_STRIP_CORRUPT_MATCHERS` (`boon-calc/sources.ts`) all match against the GW2 API's structured
`Fact` shape — but sigils carry no `Fact[]` at all, only a free-text `description` (confirmed via
`Sigil`'s own doc comment and `fetch-gear-upgrades.ts`), so those matchers could never see a sigil
even in principle. Unlike the trait scan's "occasional missed wording," this was a total, silent,
structural gap: equipped sigils never contributed to the Control/Miscellaneous/Strip/Corrupt/Cleanse
summary row at all.

Hand-scanned all 81 sigils in `data/game-data/sigils.json` for genuine grants (not mere references)
of any of the 3 tables' effects. 7 candidates, 5 genuine:
- **Strip**: Superior Sigil of Nullification (remove a boon on flank/defiant hit), Superior Sigil of
  Absorption (steal 3 boons on interrupt).
- **Cleanse**: Superior Sigil of Purity (remove a condition on flank/defiant hit), Superior Sigil of
  Cleansing (remove 3 conditions on weapon swap), Superior Sigil of Generosity (transfer a condition
  to the foe on crit — functions as a self-cleanse).

2 false positives, documented with reasons rather than silently dropped: Superior Sigil of
Paralyzation (+30% Stun Duration boosts a stun landed some other way, doesn't apply one itself),
Superior Sigil of Impact (+damage vs. already-Stunned/Knocked-Down foes, references the state
without granting it). Superior Sigil of Mischief's "Launch...snowballs" is flavor text for a ranged
attack, not the Launch knockback mechanic.

Added `SIGIL_NAMED_FACT_SOURCES` (id → `{name, detail}`) and `computeSigilNamedFactSources` in
`sources.ts`, wired into `computeNamedFactSources` — gated by `isActiveWeaponSlot`, same "a sigil on
a stowed weapon set doesn't proc either" rule already used for sigils' passive stat bonuses
(`computeGearAttributeTotals`). `NamedFactSource.sourceKind` widened to include `'sigil'`.
`computeNamedFactSources`'/`computePartyNamedFactSummary`'s (`party-summary.ts`) `gameData` param
types both grew a `sigils: Sigil[]` field — every call site already passes the full `GameData` from
`useGameData()`, so this was type-only, no call-site changes needed.

New `sigil-named-fact-completeness.test.ts` (5 tests, `boon-calc/`): scans every sigil's
`description` against a narrow verb+noun regex per matcher-table name (bare `/boon|condition/`
would flag ~15 unrelated flat-duration stat sigils, e.g. Bursting/Malice/Concentration), asserting
every hit is either in `SIGIL_NAMED_FACT_SOURCES` or a reviewed `EXCLUDED_SIGIL_IDS` entry — same
"reviewed allowlist, not a silent bypass" contract as the trait scan, plus 2 extra invariants
(`SIGIL_NAMED_FACT_SOURCES` names a real matcher key; ids still exist in `sigils.json`) since this
table feeds live UI, not just documentation. `npm run typecheck`/`npm run lint`/`npm run test` all
clean.

## Session 157 — Trait-granted boons on skills: Notoriety + Rapid Flow

Closes TODO.md's "Trait-granted boons don't show up on the skill that actually triggers them" item
(Revenant/Invocation minor traits Notoriety and Rapid Flow). Both traits already had their own
Might/Swiftness+Heal facts on the trait's own tooltip; the gap was that the *skill* whose cast
actually triggers each trait showed nothing, since the GW2 API's `traited_facts` link is empty for
both (confirmed via a full `requires_trait` scan of `skills.json`: populated for only 1 of many
candidate skills across both traits).

Scoped via each trait's own wiki infobox (`improves skill`/`improves type` fields, raw wikitext, not
paraphrased): Notoriety triggers on "using a legendary stance skill" (every legend's own
heal/utility/elite), Rapid Flow on "a skill that has an energy cost" — turned out to be the exact
same 45-skill candidate set (7 legends × 5 + Vindicator's 10 Archemorus/Saint-Viktor aspect-flip
ids), since every legend kit skill costs Energy by design. Curated via `synthetic-facts.json`
`requires_trait`-gated `Buff`/`AttributeAdjust` facts (same mechanism the empty-effect-facts sweep
uses), NOT real `traitedFacts` — the API link genuinely doesn't populate for these. Notoriety got 44
of the 45 (Might, 5s pve/2 stacks, `requires_trait: 1765`); Rapid Flow got all 45 plus one
wiki-documented outlier, Shackling Wave (28472, a Sword weapon skill — "Updated this trait to allow
Shackling Wave to heal the revenant", 2017-12-13 patch note, even though it's not a legend skill and
the API exposes no Energy Cost fact for it either).

`CURATED_HEALING_COEFFICIENTS` (`healing-calc.ts`) got a matching `'Rapid Flow Healing'` entry per
skill (WvW value 333, coefficient 0.05, `requiresTrait: 1760`) so the skill tooltip shows a real
healing-power-scaled number instead of the generic placeholder — deliberately a made-up factText
rather than reusing plain `'Healing'`, since `skillFactLines`' `healingByLabel` lookup collapses
same-text entries by label alone (not also by `requiresTrait`), which would have shown the wrong
number on one of the two lines for skills that already have their own unconditional "Healing" fact
(Natural Harmony 27025, Energy Expulsion 27356, Purifying Essence 27715). `wvw-fact-overrides.json`
got a matching `Might: 10` override per skill via `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` (mirrors
the trait's own already-curated WvW value) — re-ran the script live against the wiki rather than
hand-editing the generated file, verified additive-only via a before/after diff (no existing skill
entries lost or altered beyond the new `Might` keys).

**One real display gap found and documented, not silently papered over**: `extractFromFacts`
(`boon-calc/sources.ts`) collapses every fact sharing one status once ANY wvw override exists for
that status on that skill — a hazard the empty-effect-facts sweep already hit and documented (Fox's
Fury, Darkrazor's Daring). Facet of Strength (26644) already carries 2 real Might facts under an
existing override, so a 3rd (Notoriety's) would be silently dropped; rather than add permanently-
invisible data, `synthetic-facts.json` skips this one id's Notoriety fact entirely. 4 more skills
(Twin Moon Sweep 76968, Empowering Misery 28219, Selfish Spirit 62719, Nomad's Advance 62832) already
carry their own unconditional Might fact with no pre-existing override — adding one for Notoriety
would have both corrupted that unconditional fact's shown duration AND dropped Notoriety's via the
same dedup, so these got the fact but no override, meaning their Notoriety line shows a flat 5s
instead of the pve/wvw split (cosmetic-only gap).

**Deliberately out of scope this session** (both logged in TODO.md rather than chased): Notoriety's
own infobox also names Ancient Echo (core Revenant F2), True Nature ×5 legend flavors (Herald F2),
and Citadel Order ×3 (Renegade F2-F4) — none of the 3 render anywhere in this app's UI, confirmed via
`Profession.professionSkills`: none of their ids appear there at all, the same real API-gap class
`profession-mechanic.ts`'s `EXCLUDED_MECHANIC_SKILL_IDS` already documents for Dragonhunter's
virtues/Specter's mechanics — would need new hand-injected mechanic-bar wiring before any trait link
here could ever be seen. Also left open: whether a Facet's flip/consume half (e.g. Infuse Light, its
own independent `FlipSkillStack` tooltip) should carry these facts too, since consuming a Facet is
arguably its own energy-costing activation in-game — not assumed either way without a genuine
per-skill mechanic check.

`npm run typecheck`/`lint` both clean. No dedicated unit tests exist for this calc layer; not
visually spot-checked in the running app (Electron sandbox limitation).

## Session 156 — Conditional trait-attribute bonuses, leg 8 (final): Health-threshold-conditional flat bonuses

Closes TODO.md's "Conditional trait-attribute bonuses — remaining families" checklist, the last of
the 8 families the sweep surfaced (see Session 148). Both candidates were the checklist's own
original prototype examples for this shape, both wiki-verified via raw wikitext (`?action=raw`)
2026-08-12:

- **Empire Divided** (Revenant/Vindicator, Minor Grandmaster, id 2229): single 50% health threshold,
  no game-mode split at all — +240 Power at/above the threshold, +240 Healing Power below it.
- **Last Rites** (Necromancer/Blood Magic, Major tier 3, id 1931): a genuine 2-way PvE+WvW/PvP split
  across 3 tiers — +150/+300/+450 Healing Power above 75% / between 50%-75% / below 50% health
  (PvP-only values differ, irrelevant to this WvW-focused app). Its other effect (allies near you
  don't bleed out while downed) is a proc/utility effect, out of scope.

Needed a genuinely new `CombatState` field, as the checklist expected, but shaped as a 3-way tier
(`HealthTier = 'above75' | 'between50and75' | 'below50'`) rather than a raw 0-100 slider — coarse
enough to cover both traits' differing breakpoints (50% vs. 75%/50%) without over-building. Unlike
every other family in this sweep, it isn't gated by a separate on/off boolean: `state.healthTier`
always has a value (defaults to `'above75'`, full health), so `combatStatePoints` applies
`healthThresholdAttributeTraitBonus` unconditionally rather than behind an `if (state.xActive)`
check. Added `combat-state.ts`'s `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES`/
`healthThresholdAttributeTraitBonus` (per-tier target-map shape, mirroring the boon/mechanic
families' `Record<HealthTier, Record<string, number>>`). `CombatStatePanel.tsx` gained a new
3-option dropdown (not a toggle icon, matching `targetArmorClass`'s shape since there are more than 2
states), shown only when the build has one of the 2 curated traits chosen, using that trait's own
icon/name (same conditional-render pattern as the mechanic-active toggle). `gear-optimize.ts` needed
no changes, same as every prior ephemeral-`CombatState`-gated family.

`npm run typecheck`/`lint` both clean. No dedicated unit tests exist for this calc layer; not
visually spot-checked in the running app (Electron sandbox limitation).

**Sweep closeout, all 8 families now done** (Sessions 149-156): Fury-gated Ferocity/Condition-Damage
(No Scope, Raging Storm, Deep Strikes, Vicious Quarry, No Quarter, Sharpening Sorrow); Boon-gated
flat bonuses — Regeneration/Quickness (Chaotic Persistence, Energy Amplifier, Imbued Haste, Be Quick
or Be Killed); Weapon-equipped-gated flat bonuses (13 traits across Guardian/Warrior/Ranger/Thief);
Attunement-gated flat bonuses (Empowering Flame, Aeromancer's Training, Elementalist-only);
Shroud/stance-gated flat bonuses (Reaper's Onslaught, Fatal Frenzy, Sand Sage); Continuous
Might-stack-scaling flat bonuses (Awaken the Pain, Pinnacle of Strength, Applied Force);
Revealed-state-gated flat bonuses (Revealed Training, Thief-only); Health-threshold-conditional flat
bonuses (this session). TODO.md's whole "Conditional trait-attribute bonuses" section is now removed
(fully closed, nothing left open in it). Two loose ends spun off along the way, both still open in
TODO.md as their own small future items: Deadly Strength's Carapace-stack bonus (needs its own new
`CombatState` field, not part of any curated family) and Pinnacle of Strength's flat unconditional
+5% crit-chance fact (no unconditional flat-crit-chance table exists yet).

## Session 155 — Conditional trait-attribute bonuses, leg 7: Revealed-state-gated flat bonuses

Picks up TODO.md's checklist at the "Revealed-state-gated flat bonuses" family: traits whose flat
attribute bonus only applies while the Revealed debuff ("you cannot stealth") is active. Only one
candidate turned up — Thief-only, as the checklist expected. **Revealed Training** (Thief/Deadly
Arts, Major Grandmaster, id 1704): its unconditional "Base Power" half was already curated in the
"Weapon-equipped-gated" leg's flat-bonus sweep (`trait-attributes.ts`); this leg curates its excluded
"Power while Revealed" half. Re-confirmed via raw wikitext (`?action=raw`) 2026-08-12: genuine 2-way
split, pve 120 / wvw+pvp 150 — WvW value 150 used.

Same shape as the Fury/mechanic-active legs: needed a genuinely new `CombatState.revealedActive`
boolean (Revealed has no persisted `Build` field to key off, unlike the weapon-equipped/attunement
legs). Added `combat-state.ts`'s `REVEALED_ATTRIBUTE_TRAIT_BONUSES`/`revealedAttributeTraitBonus`
(single-target `{ target, value }` shape, mirroring `FURY_ATTRIBUTE_TRAIT_BONUSES` since there's only
one entry so far), wired into `combatStatePoints`. `gear-optimize.ts` needed no changes, same as every
prior ephemeral-`CombatState`-gated family. Added a new `REVEALED_ICON` constant to `icons.ts`, pulled
from the trait's own `Buff`-type fact (status "Revealed") rather than reusing `BOON_CONDITION_ICONS`,
since Revealed is neither a boon nor a condition. `CombatStatePanel.tsx` gained a new click-to-toggle
icon, shown only when the build has trait 1704 chosen (same conditional-render pattern as the
mechanic-active toggle).

`npm run typecheck`/`lint` both clean. No dedicated unit tests exist for this calc layer; not visually
spot-checked in the running app (Electron sandbox limitation). TODO.md's checklist updated to mark this
family done; 1 family remains (health-threshold-conditional), still expected to need its own new
`CombatState` field (a health-% slider or preset tiers).

## Session 154 — Conditional trait-attribute bonuses, leg 6: Shroud/stance-gated flat bonuses

Picks up TODO.md's checklist at the "Shroud/stance-gated flat bonuses" family: traits whose flat
attribute bonus only applies while the build's profession mechanic is toggled on (Necromancer Shroud,
Necromancer Scourge's active Sand Shade, Warrior Berserker's berserk mode). Unlike the previous two
legs (weapon-equipped-gated, attunement-gated), no persisted `Build` field could be reused here:
`Build.activeBundleSkillId` tracks Shroud only as *which skill bar is displayed*, deliberately not
gating real totals (its own doc comment's "player can toggle at will, both states always contribute"
reasoning), and Scourge's shade/Berserker's berserk mode have no `Build` field at all. So this leg
needed the genuinely new ephemeral `CombatState` toggle the checklist originally called for — added
`CombatState.mechanicActive`, a single boolean covering all 3 mechanics (mirrors `furyActive`/
`regenerationActive`/`quicknessActive`'s "one field, not per-profession" shape, since a build only
ever has one profession's mechanic to toggle anyway).

Added `combat-state.ts`'s `MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES`/`mechanicActiveAttributeTraitBonus`
(same target-map shape as the Regeneration/Quickness families), wired into `combatStatePoints`.
`gear-optimize.ts` needed no changes — it already threads the whole `CombatState` object through
`combatStatePoints` generically, same as every other Combat State family. `CombatStatePanel.tsx` gained
a new click-to-toggle icon, shown only when the build actually has one of the 3 curated traits chosen
(reads the trait's own icon/name from `traitsById` rather than a generic Shroud/Berserk/Shade icon,
same conditional-render pattern the relic toggle already uses).

3 traits curated, all wiki-verified via raw wikitext (`?action=raw`) 2026-08-12: **Reaper's Onslaught**
(Necromancer/Reaper, Major tier 3, id 2021) — "Gain ferocity and quickness while in Reaper's Shroud,"
+300 Ferocity, no game-mode split (the Quickness grant is a proc buff, out of scope). **Fatal Frenzy**
(Warrior/Berserker, Minor tier 3, id 2046) — "Berserk mode increases power and condition damage,"
Power flat +300 no split, Condition Damage a genuine 2-way split (pve 150 / wvw+pvp 300 per the
2026-04-14 balance pass); WvW value 300 used. **Sand Sage** (Necromancer/Scourge, Minor tier 2, id
2121) — "Gain concentration and expertise when you have an active shade," both attributes split pve
225 / wvw+pvp 150; WvW value 150 used for both.

`npm run typecheck`/`lint` both clean. No dedicated unit tests exist for this calc layer; not visually
spot-checked in the running app (Electron sandbox limitation). TODO.md's checklist updated to mark this
family done; 2 families remain (revealed-state-gated, health-threshold-conditional), both still
expected to need their own new `CombatState` field.

## Session 153 — Conditional trait-attribute bonuses, leg 5: Attunement-gated flat bonuses

Picks up TODO.md's "Conditional trait-attribute bonuses — remaining families" checklist at the
"Attunement-gated flat bonuses" family (Elementalist only): traits whose flat attribute bonus only
applies while attuned to a specific element. The checklist originally assumed this would need a new
`CombatState` field/UI (grouped with the boon-gated/shroud-gated/revealed-gated/health-threshold legs
still needing genuinely new toggles) — but a fresh look at `Build`'s own fields found
`activeAttunement` already tracks exactly this, set live by clicking the F1-F4 icons in
`ProfessionMechanicBar`. Reused it instead, same **no new `CombatState` UI** shape as the
weapon-equipped-gated leg (persisted `Build` state is the condition, not an ephemeral toggle).
`activeAttunement`'s own doc comment calls it "display-only" for `WeaponSkillBar`/boon-calc purposes
(a real Elementalist cycles all 4 attunements at will, so skill/boon totals credit every attunement
regardless of which is shown) — that reasoning doesn't apply here: a flat attribute bonus like these
only applies at the instant you're actually standing in that attunement, so gating on the
currently-selected one is the *correct* semantics, not merely a convenient shortcut, unlike boon
uptime.

Added `trait-attributes.ts`'s `ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES`/
`activeAttunementAttributeTraitBonus`, folded into `applyTraitBonuses` for every normal caller and
separately into `gear-optimize.ts`'s pre-search baseline (safe to fix before the search runs, same
reasoning as the weapon-equipped-gated leg, since the optimizer never touches
`build.activeAttunement`).

2 traits curated, both wiki-verified via raw wikitext (`?action=raw`) 2026-08-12, no game-mode split
on either: **Empowering Flame** (Elementalist/Fire, Minor Adept, id 320) — its entire +150 Power is
attunement-gated, no unconditional half at all (its description literally is the gate: "Gain power
while in fire attunement"), the second entry in this whole sweep with that shape after Stalwart
Defender. **Aeromancer's Training** (Elementalist/Air, Minor GM, id 223) — its *second* Ferocity
fact, explicitly labeled "Additional Ferocity" in both the raw API data and the wiki's own `alt=`
parameter, +150 CritDamage while attuned to air; its unconditional +150 CritDamage half was already
curated in `CURATED_FLAT_BONUSES` during the original Session 148 sweep (that entry's comment already
flagged this second half as excluded pending this family).

`npm run typecheck`/`lint` both clean. No dedicated unit tests exist for this calc layer; not
visually spot-checked in the running app (Electron sandbox limitation). TODO.md's checklist updated
to mark this family done; 3 families remain (shroud/stance-gated, revealed-state-gated,
health-threshold-conditional) — all still expected to need a genuinely new `CombatState` toggle,
unlike this leg and the weapon-equipped-gated one.

## Session 152 — Conditional trait-attribute bonuses, leg 4: Weapon-equipped-gated flat bonuses

Picks up TODO.md's "Conditional trait-attribute bonuses — remaining families" checklist at the
"Weapon-equipped-gated flat bonuses" family: traits whose flat attribute bonus only applies while a
specific weapon type is equipped. Unlike the 3 prior legs (Fury/Boon/Might), this needed **no new
`CombatState` field** — the condition is derivable purely from `build.equipment`, same shape as the
existing `detectActiveStackingSigil`.

Added `trait-attributes.ts`'s `WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES`/
`activeWeaponEquippedAttributeTraitBonus`, plus 2 new private helpers: `activeWeaponTypes` (every
weapon type equipped across the active set, either hand) and `activeMainHandWeaponType` (the active
set's main-hand slot only, `null` underwater). Folded into `applyTraitBonuses` for every normal
caller, and separately folded into `gear-optimize.ts`'s pre-search baseline alongside
`activeTraitFlatBonuses` — safe to fix before the search runs (unlike trait *conversions*) since the
optimizer never touches `weaponType`, only `itemStatId`/upgrades per slot.

13 traits curated, wiki-verified via the live API's own `description` text
(`data/game-data/traits.json`), cross-checked against each trait's already-wiki-verified base-half
comment in `CURATED_FLAT_BONUSES` (added during the original trait-attribute-bonus sweep, Session
148) — none carry a game-mode split, matching their base halves: Right-Hand Strength (Guardian, id
566, +80 Power, main-hand-only gate on Axe/Mace/Scepter/Sword — the only entry gated on a specific
hand), Zealous Blade (Guardian, id 653, +120 Power, Greatsword), Blademaster (Warrior, id 1333, +120
ConditionDamage, Sword — a *different* attribute than its unconditional Expertise half, not a
doubling of it), Axe Mastery (Warrior, id 1369, +120 CritDamage, Axe), Honed Axes (Ranger, id 970,
+120 CritDamage, Axe), Ambidexterity (Ranger, id 1101, +120 ConditionDamage, Torch/Dagger/Mace),
Strider's Strength (Ranger, id 1700, +120 Power, Sword), Swindler's Equilibrium (Thief, id 1192, +120
Power, Sword/Spear), Dagger Training (Thief, id 1245, +80 Power, Dagger), Staff Master (Thief, id
1884, +120 Power, Staff), Second Opinion (Thief, id 2284, +90 ConditionDamage, Scepter). `weaponTypes`
uses the `EquipmentSlot.weaponType`/API convention (e.g. `"Spear"` for both land and underwater
post-Janthir Wilds, confirmed via `data/game-data/professions.json`).

Two traits needed a fresh look beyond the base-half cross-check: **Forceful Greatsword** (Warrior, id
1338) wasn't on this checklist's original candidate list — surfaced by its own comment in
`CURATED_FLAT_BONUSES` noting the "double these bonuses while wielding a greatsword or underwater
spear" clause isn't materialized as a separate fact; added here as +120 Power *additional* on top of
its already-curated +120 base (Greatsword/Spear), matching the confirmed 120-base/240-doubled shape
from wiki version history. **Stalwart Defender** (Guardian, id 580) has no unconditional half at
all — its entire +240 Toughness is gated on wielding a Shield — confirmed via raw wikitext (`?action=
raw`) since `traits.json`'s facts alone don't carry the gating condition text for a single-fact
trait; the only entry in this family with no counterpart in `CURATED_FLAT_BONUSES`.

One checklist candidate was dropped on a fresh check: **Arachnophobia** (Ranger, id 1099) — its
second fact turned out to be pet-type-conditional (Spider/Devourer gets extra Expertise), not
weapon-gated, confirming the checklist's own warning not to trust the Session 148 candidate list
blindly.

`npm run typecheck`/`lint`/`build` all clean. No dedicated unit tests exist for this calc layer; not
visually spot-checked in the running app (Electron sandbox limitation). TODO.md's checklist updated
to mark this family done; 4 families remain (attunement-gated, shroud/stance-gated,
revealed-state-gated, health-threshold-conditional).

## Session 151 — Conditional trait-attribute bonuses, leg 3: Regeneration/Quickness-gated flat bonuses

Picks up TODO.md's "Conditional trait-attribute bonuses — remaining families" checklist at the
"Boon-gated flat bonuses" family: traits whose flat attribute bonus only applies while a specific
boon (not Fury or Might) is active. Needed genuinely new `CombatState` plumbing, per TODO.md's
scoping — went with one boolean per boon (`regenerationActive`/`quicknessActive`, mirroring the
existing `furyActive`) rather than a generalized "which boons are up" map, since only Regeneration
and Quickness have any curated trait bonus so far.

Added `combat-state.ts`'s `REGENERATION_ATTRIBUTE_TRAIT_BONUSES`/`regenerationAttributeTraitBonus`
and `QUICKNESS_ATTRIBUTE_TRAIT_BONUSES`/`quicknessAttributeTraitBonus`, wiki-verified via raw
wikitext (`?action=raw`, fetched directly with `curl` this session rather than through WebFetch's
summarizing model, after WebFetch's first pass paraphrased two of the pages instead of returning them
verbatim): Chaotic Persistence (Mesmer/Chaos, id 1865, Regeneration-gated, +250 Concentration/+250
Expertise WvW — a genuine 3-way PvE/WvW/PvP split where Expertise's PvE value alone dropped to 100 on
2026-04-14, WvW unaffected), Energy Amplifier (Engineer/Inventions, id 519, Regeneration-gated, +250
Power/+250 Healing, no split), Imbued Haste (Guardian/Firebrand, id 2148, Quickness-gated, +150
Condition Damage/Healing/Vitality WvW — 2-way split, PvE is 250 each), Be Quick or Be Killed
(Thief/Deadeye, id 2093, Quickness-gated — its own on-mark Quickness proc, +200 Power/+200 Precision,
no split on the attribute values). Unlike the single-target `FURY_ATTRIBUTE_TRAIT_BONUSES` shape,
each entry here grants 2-3 attributes at once, so the table value is a target->amount map instead of
one `{ target, value }` pair. `combatStatePoints` folds both in when the matching boolean is on, same
pattern as `furyActive`. Added two new toggle icons (Regeneration, Quickness) to
`CombatStatePanel.tsx` next to the existing Fury toggle, reusing `BOON_CONDITION_ICONS`.

Also fixed a misfile surfaced along the way: Sharpening Sorrow (Mesmer/Virtuoso, id 2207) was listed
in this checklist as Regeneration-gated, but its wiki page confirms it's actually Fury-gated (its own
on-cast Fury proc from Bladesong Sorrow, +150 Expertise) — moved into the already-closed Fury leg's
`FURY_ATTRIBUTE_TRAIT_BONUSES` table instead (target `ConditionDuration`, this codebase's key for
Expertise), no new plumbing needed since it reuses the existing `furyActive` toggle.

`npm run typecheck`/`lint`/`build` all clean. No dedicated unit tests exist for this calc layer; not
visually spot-checked in the running app (Electron sandbox limitation). TODO.md's checklist updated
to mark this family done (and to record the Sharpening Sorrow correction in the Fury leg's entry); 5
families remain (weapon-equipped-gated, attunement-gated, shroud/stance-gated, revealed-state-gated,
health-threshold-conditional).

## Session 150 — Conditional trait-attribute bonuses, leg 2: continuous Might-stack scaling

Picks up TODO.md's "Conditional trait-attribute bonuses — remaining families" checklist at the next
cheapest family: traits whose bonus scales continuously with the current Might-stack count (no
threshold cutoff), reusing the existing `CombatState.mightStacks` field directly — no new UI needed,
same low-cost shape as Session 149's leg.

Added `combat-state.ts`'s `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`/`mightStackAttributeTraitBonus`, a
third sibling to `FURY_CRIT_CHANCE_TRAIT_BONUSES`/`FURY_ATTRIBUTE_TRAIT_BONUSES`, wiki-verified via
raw wikitext (`?action=raw`): Awaken the Pain (Necromancer, id 915, +10 Power per Might stack — wiki
Notes state 40 Power/stack with the trait vs. 30 Power/stack unmodified, Condition Damage
unchanged, matching the raw API's own second `AttributeAdjust` fact), Pinnacle of Strength (Warrior,
id 1453, +10 Power per Might stack, matching its own `AttributeAdjust` fact — also carries a flat,
unconditional +5% crit chance NOT curated here, logged in TODO.md since no unconditional
flat-crit-chance table exists yet), and Applied Force (Engineer/Scrapper, id 1849, +10 Power per
Might stack, WvW value from a genuine 3-way PvE/WvW/PvP split reduced 15→10 on 2026-01-13 — its
"gain stability at ≥10 Might stacks" clause is a separate proc, not a gate on the power bonus, per
the trait's two independent description sentences; this resolves TODO.md's open question about
whether it belongs in this family). `combatStatePoints` folds these in whenever `mightStacks > 0`,
same path as the flat Might Power/Condition-Damage bonus.

`npm run typecheck`/`lint`/`build` all clean. No dedicated unit tests exist for this calc layer; not
visually spot-checked in the running app (Electron sandbox limitation). TODO.md's checklist updated
to mark this family done; 6 families remain, all needing genuinely new `CombatState` UI (boon-gated,
weapon-equipped-gated is actually still no-new-UI and should probably go next, then
attunement/shroud/revealed/health-threshold).

## Session 149 — Conditional trait-attribute bonuses, leg 1: Fury-gated Ferocity/Condition-Damage

Picks up TODO.md's new "Conditional trait-attribute bonuses — remaining families" checklist (the
8-family backlog Session 148 flagged) at the cheapest family first: traits whose flat bonus only
applies under Fury and targets a raw attribute (Ferocity/Condition Damage) rather than critical-hit
chance — a direct sibling of the already-existing `FURY_CRIT_CHANCE_TRAIT_BONUSES` family, so no new
`CombatState` field or UI was needed, just a second table plus wiring.

Added `combat-state.ts`'s `FURY_ATTRIBUTE_TRAIT_BONUSES`/`furyAttributeTraitBonus`, wiki-verified via
raw wikitext (`?action=raw`, cross-checked against each trait's own `AttributeAdjust` fact in
`traits.json`): No Scope (Guardian, id 1923, +150 Ferocity), Raging Storm (Elementalist, id 214, +180
Ferocity), Deep Strikes (Warrior, id 1343, +180 Condition Damage), Vicious Quarry (Ranger, id 1888,
+250 Ferocity), No Quarter (Thief, id 1904, +300 Ferocity — genuine PvE/WvW split, PvE is 250).
`combatStatePoints` now takes a `traitsById` param and folds these in when `state.furyActive`, same
path Might/stacking-sigil already use; both call sites (`derived-stats.ts`, `gear-optimize.ts`)
updated. Also exported `trait-attributes.ts`'s previously-private `activeTraitIds` helper and
refactored `furyCritChanceTraitBonus` to use it instead of re-implementing the same active-trait
gating inline — removes duplicated logic, same behavior.

`npm run typecheck`/`lint`/`build` all clean. No dedicated unit tests exist for this calc layer
(confirmed via glob); not visually spot-checked in the running app (Electron sandbox limitation).
TODO.md's new entry updated to mark this family done; 7 families remain, each scoped with its
candidate trait list and what new `CombatState` plumbing it needs — next session picks up wherever
the user wants (weapon-equipped-gated and the two Might-stack-scaling traits need no new UI either,
same low-cost shape as this leg).

## Session 148 — Trait attribute bonus sweep complete (Thief leg, final of 9 professions)

Closes TODO.md's "Curate more trait attribute bonuses" entry, open since 2026-08-12. Swept
`trait-attributes.ts`'s last remaining profession leg, Thief (29 candidates), completing the sweep
across all 9 professions (187 candidates total: Mesmer 8, Engineer 17, Guardian 21, Elementalist 19,
Revenant 19, Necromancer 29, Warrior 22, Ranger 23, Thief 29).

**Thief leg**: 12 traits curated into `CURATED_FLAT_BONUSES`/`CURATED_CONVERSIONS` — 9 flat (Deadly
Ambition +120 Condition Damage; Swindler's Equilibrium +120 Power, unconditional half; Preparedness
+150 Expertise; Dagger Training +80 Power, unconditional half; Revealed Training +100 Power,
unconditional half; Staff Master +120 Power, unconditional half; Silent Scope +120 Precision;
Premeditation +60 Concentration; Second Opinion +90 Condition Damage, unconditional half) and 4
conversions (Practiced Tolerance 15% Precision→Ferocity; Marauder's Resilience 7% Power→Vitality;
Strength of Shadows 13% Vitality→Expertise; Second Opinion 7% Condition Damage→Healing Power). All
percent/split values wiki-verified via raw wikitext (`?action=raw`), double-checked with a
"quote every `skill fact` line verbatim" re-fetch per candidate after last leg's lesson about the
raw-wikitext fetch tool itself summarizing through a small model. 15 excluded as proc-heal/barrier/
life-siphon coefficients (Leeching Venoms, Shielding Restoration, Assassin's Reward, Mug, Merciful
Ambush, Shadow Savior, Cloaked in Shadow, Shadow Siphoning, Escapist's Fortitude, Panaku's Ambition,
Traversing Dusk, Larcenous Torment, Hungering Darkness, Magpie's Defense, Enterprising Aristocrat).

2 traits fully excluded as new/known conditional shapes, not added to this unconditional table: No
Quarter (+250/300 Ferocity while under Fury — Fury-gated flat-bonus family, same as No
Scope/Raging Storm/Deep Strikes/Vicious Quarry from earlier legs); Be Quick or Be Killed (+200
Power/+200 Precision entirely gated on the Quickness gained from marking a foe — boon-gated flat-
bonus family, same as Chaotic Persistence/Energy Amplifier/Imbued Haste, this time keyed on
Quickness). Also surfaced a **new revealed-state-gated flat-bonus shape**: Revealed Training's
excluded half (+120/150 Power while Revealed) — same conditional-gate category as the
weapon-equipped/attunement/shroud/boon-gated families already flagged across this sweep, just keyed
on the Revealed debuff.

**Sweep-wide summary of what's still out of scope for this unconditional table**, tracked here since
the TODO.md entry is now closed: a boon-gated family (Regeneration/Fury/Quickness — Chaotic
Persistence, Sharpening Sorrow, Energy Amplifier, Imbued Haste, Be Quick or Be Killed) needing a
generalized `CombatState` "which boons are up" toggle; a Fury-gated-Ferocity/Condition-Damage family
(No Scope, Raging Storm, Deep Strikes, Vicious Quarry, No Quarter) needing a
`FURY_FEROCITY_TRAIT_BONUSES`-style sibling table; a weapon-equipped-gated family derivable from
`build.equipment` + `isActiveWeaponSlot` (Right-Hand Strength, Zealous Blade, Stalwart Defender,
Blademaster, Axe Mastery, Honed Axes, Arachnophobia, Ambidexterity, Strider's Strength, Swindler's
Equilibrium, Dagger Training, Staff Master, Second Opinion); an attunement-gated family (Aeromancer's
Training, Empowering Flame); a shroud/stance-gated family (Reaper's Onslaught, Sand Sage, Fatal
Frenzy); a revealed-state-gated family (Revealed Training); a continuous stack-scaling family
(Deadly Strength, Awaken the Pain, Pinnacle of Strength); a pet-only-stat exclusion category (Ranger's
Fang and Claw etc., correctly out of scope for the player's own attribute table); and a handful of
already-tracked health-threshold-conditional traits (Empire Divided, Last Rites). None of these are
omissions — each was investigated and deliberately deferred pending new plumbing, same convention as
prior sweeps' TODO notes.

## Session 147 — Gear Optimizer bug closed: user confirmed live in-app spot-check

Closes the TODO.md "Gear Optimizer doesn't function properly" entry for good. The remaining gap
after Session 146's scripted re-verification was a real live-app check, which this environment can't
do itself (Electron sandbox limitation). The user ran their own quick spot-test in the running app
2026-08-12 and confirmed it looks correct on first pass. They noted more in-depth testing may follow
later, but said this is sufficient to close the item for now — if a fresh failure mode turns up, it
gets logged as a new entry rather than reopening this one, per the user's own framing.

## Session 146 — Gear Optimizer fix re-verified (closes the "unverified in live app" gap)

TODO.md's Gear Optimizer bug entry (Session 108's `applyConversions` fix) was confirmed fixed but
flagged as never verified outside the original diagnosis session. Live in-app verification still
isn't possible here (Electron sandbox limitation persists — checked again: no Playwright/xvfb
available in this environment either), so re-ran the same class of check instead: a fresh standalone
`tsx` script (not committed — scratch-only) loading real `data/game-data/*.json` directly, building a
bare Guardian with Superior Sharpening Stone (id 9443, the "Gain Power Equal to N% of Your
Precision/Ferocity" shape) as a fixed utility item, running `optimizeGear` maximizing Power, and
diffing its `metricValues.Power` against an independent `computeCharacterStats` call on the exact
resulting build.

Result: exact match (2223.90196 both sides, diff 0). To confirm the check itself is meaningful (not
vacuously passing), temporarily commented out the fix's `applyConversions` call and re-ran — the
same ~91-Power understatement described in the original bug report reproduced immediately, then the
file was restored via `git checkout` and re-typechecked clean. TODO.md's "wasn't necessarily the only
issue" caveat still stands (no specific failure mode was ever captured for the original report), but
the one confirmed concrete bug is now verified fixed, not just theoretically fixed.

## Session 145 — Per-buff-line target-count model

Closed TODO.md's "per-buff-line (not per-source) target-count model" gap, open since 2026-08-06:
`BoonConditionSource.targetCount`/`resolveTargetCount` used to resolve once per skill/trait and apply
that one value to every boon line the source emitted — couldn't express a source whose different boon
lines (or the same status appearing twice) genuinely reach different counts. 7 known conflicts had been
deliberately left uncurated pending this: Guardian's Tome of Courage, Willbender's Phoenix Protocol,
Necromancer's Well of Power/Mark of Blood, Revenant's Pain Absorption/Gladiator's Defense, Guardian's
Holy Reckoning, Elementalist's Overload Earth/Hare's Agility.

`SourceTargetCountOverride` (`src/shared/boon-calc/sources.ts`) widens a `TARGET_COUNT_OVERRIDES`/
`CONDITION_CLEANSE_TARGETS` entry from a flat `TargetCountOverride` to 3 additional shapes:
- A `status`(-or-`status@duration`)-keyed map, for sources where different boon STATUSES reach
  different counts (the composite key only needed once, for Pain Absorption's 2 same-status
  differently-timed Resistance facts).
- `TraitConditionalTargetCountOverride`: the whole source's reach flips based on whether some OTHER
  trait is chosen (Phoenix Protocol, gated on Battle Presence/554).
- `LegendConditionalTargetCountOverride`: same idea, gated on an EQUIPPED Revenant legend rather than
  a trait (Gladiator's Defense, gated on Legendary Dwarf Stance/`Legend3`) — built per explicit user
  request rather than left excluded like the other legend-shaped gap (was going to be skipped
  otherwise, since it needed new plumbing). New `equippedLegendIds(build)` mirrors `activeTraitIds`:
  BOTH equipped legend slots count, not just whichever `activeLegendIndex` currently displays, same
  "every equipped alternate always contributes" convention as `RevenantSkillSelection` itself.

`resolveTargetCount` now runs once PER BUFF FACT (moved inside `extractFromFacts`'s loop) instead of
once per source. A conditional override that resolves via its "active" branch also appends
`+ <TraitOrLegendName>` to the emitted source's `sourceName` (e.g. "Gladiator's Defense + Dwarf
Stance") so a conditionally-party-wide row doesn't look indistinguishable from an unconditionally
party-wide one — the reach depends on a DIFFERENT skill/trait/legend than the row itself, which needs
to stay visible without the player needing that legend to be the currently-*displayed* one.

Threading `equippedLegendIds` (a `Set<string>`, empty for non-Revenant) through required updating
every call site of `extractFromFacts`/`boonConditionFactsForSkill`/`boonConditionFactsForTrait`/
`auraFactsForSkill`/`namedFactsFrom`/`computeNamedFactSources`/`namedFactsForSkill` — added `legendIds`
to `SkillsEditor.tsx`'s shared `useDurationContext` hook (alongside its existing `activeIds`) so most
consumers (PetsEditor, ProfessionMechanicBar, SkillsEditor, WeaponSkillBar) picked it up for free;
`TraitsEditor.tsx` computes it separately (doesn't use that hook) and threads it through as a new
`TraitLineRowProps.legendIds`.

Verified the whole matrix (Tome of Courage un/traited, Holy Reckoning, Phoenix Protocol with/without
Battle Presence, Pain Absorption with/without Demonic Defiance, Gladiator's Defense with/without
Legend3) against real `data/game-data/*.json` via a temporary `tsx` script — every resolution matched
hand-derivation exactly, including the `sourceName` suffix appearing only on the conditional branch.
Also fixed 2 scripts (`fetch-target-counts.ts`'s wiki-verification pilot, `fetch-balance-patch-changes.ts`'s
patch-diff tool) that read `TARGET_COUNT_OVERRIDES` expecting a flat value — new `isFlatTargetCountOverride`
type guard filters/branches around the new conditional shapes rather than trying to diff them against a
single wiki number (added a `complex-override` outcome bucket to the balance-patch script for these,
flagged for a human read rather than silently skipped). `npm run typecheck`/`lint` both clean.

## Session 144 — Gear Optimizer: searchable rune and infusion choice

Picked up TODO.md's "make rune and infusion choice searchable" item (scoped 2026-08-01). Runes and
infusions are now search variables in `optimizeGear`, gated behind a new `optimizeRunesInfusions`
toggle in `GearOptimizerPanel.tsx` — parallel to the existing "optimize food/utility" checkbox,
default off (existing behavior — runes/infusions as a fixed baseline — unchanged when off).

- **Rune**: modeled as a single search slot (`kind: 'rune'`, `equipmentKeys: RUNE_SLOT_KEYS`) applied
  uniformly across all 6 armor pieces — matches the WvW "6x one rune" convention (per the item's own
  scoping note) rather than 6 independently-searched rune slots. New `runeOptionsFor` sums a
  candidate rune's first 6 `bonuses` stages (mirrors `addRuneBonuses`' own per-count-of-stacks
  logic for a uniform 6-piece set) into one delta, deduped by `deltaSignature` like every other
  option list.
- **Infusion**: modeled as one `OptimizerSlot` per *physical* infusion slot (`kind: 'infusion'`,
  carrying a new `infusionIndex` into that key's `infusionIds` array) — a ring's 3 slots, for
  example, are searched independently since they can legally hold 3 different infusions. Capacity
  per key from the already-existing `armorTrinketInfusionCapacity`/`weaponUpgradeCapacity`
  (`upgrade-slots.ts`). New `infusionOptionsFor` builds one option per core-attribute WvW infusion
  (flat +5, no adjustment-tier math needed) — computed once and shared by reference across every
  physical slot, since infusions aren't slot-restricted.
- New `activeWeaponItems`/`buildWeaponInfusionSlots`: resolves the build's actually-equipped,
  actually-active weapon item(s) into per-item infusion capacity — a two-handed weapon gets 2 slots
  on its main-hand key only (confirmed against `EquipmentEditor.tsx`'s own comment: "its rune/sigil/
  infusion picks live independently per slot key... only the stat combo mirrors" onto the off-hand
  key), a one-handed main/off pair gets 1 slot each independently. Kept as a separate item-shaped
  traversal from `buildWeaponSlots`' own pair-merging (which exists because a 2H weapon's *stat
  combo* search slot legitimately spans both keys) rather than reusing that function directly.
  Underwater weapons (always 2H) get 2 slots on their single key.
  
- **Baseline correctness**: when `optimizeRunesInfusions` is true, the pre-search baseline now also
  nulls out `runeId` (for the 6 armor keys) and every `infusionIds` entry (for every key that got an
  infusion slot) on the fixed-equipment snapshot passed to `computeGearAttributeTotals` — otherwise
  the build's *original* rune/infusion contribution would double-count against the search's own
  delta on top of it. Mirrors the existing `itemStatId`-nulling pattern for gear slots exactly.
- Result-writing switched from the old `slot.id === 'food'`/`'utility'` string checks to an explicit
  `OptimizerSlot.kind` field (`'food' | 'utility' | 'rune' | 'infusion'`, undefined = ordinary gear
  slot) — a `switch` in the result-assembly loop writes `runeId`/`infusionIds[idx]` instead of
  `itemStatId` for the two new kinds. `OptimizerSlotResult` also carries `kind` now, so
  `GearOptimizerPanel.tsx`'s result list can filter out empty (`chosenId: null`) infusion rows —
  otherwise up to ~18 mostly-"None" infusion-slot rows would dominate the results list even on runs
  that only actually filled a handful of them.
- Verified functionally against real `data/game-data/*.json` (a temporary, not-committed script —
  see TODO.md's follow-up note on this session's stress-test finding): confirmed rune id lands
  uniformly across all 6 armor slots, confirmed per-slot infusion capacity is exactly right for both
  a two-handed (Greatsword, 2 slots on the main key only) and two independent one-handed
  (Sword+Focus, 1 slot each) weapon set, and cross-checked the optimizer's own `metricValues`
  against an independent `computeGearAttributeTotals` recomputation of the resulting build — exact
  agreement. `npm run typecheck`/`lint` both clean. Not itself visually confirmed live (Electron
  sandbox limitation, same caveat as everything else in this codebase that can't be screenshotted
  here) — and a synthetic stress case surfaced a real (documented in TODO.md, not itself a bug)
  truncation trade-off from the larger search space this adds.

## Session 143 — Elementalist Glyph tooltips: swap to active attunement, not stack all 4

Picked up TODO.md's "Elementalist Glyph tooltips should swap..." item (flagged 2026-08-07). Closed
the structural gap the item called out: `multi-effect.ts`'s `relatedVariantSkills` was already
finding all 4 attunement-specific variant ids of a Glyph (e.g. Glyph of Lesser Elementals'
Fire/Water/Air/Earth ids), but `SkillsEditor.tsx`'s `skillTooltipContent` stacked all 4 as
`tooltip-skill-variant` sub-blocks below the canonical skill's own (generic, low-fact) description
— a documentation list, not the live per-attunement effect.

- New `activeAttunementVariantSkill(skill, activeAttunement, allSkills)` in `multi-effect.ts`:
  finds the one `relatedVariantSkills` entry whose `attunement` matches `Build.activeAttunement`,
  returning `null` for any non-Glyph skill or an unmatched attunement — same fail-open posture as
  `glyph-forms.ts`'s `glyphFormFactSourceSkill`, which this deliberately parallels structurally per
  the TODO item's own framing.
- `skillTooltipContent` now resolves one `swappedFactSkill = glyphFormSkill ?? attunementVariantSkill`
  and sources the *entire* tooltip (description + facts) from it, exactly like the existing Druid
  Glyph swap already did — no profession has both kinds of Glyph, so the two never both match the
  same skill and the `??` ordering is unambiguous. Removed the old `variants.map(...)` stacking
  block entirely (Elementalist Glyphs were its only real-world caller — `relatedVariantSkills`
  itself stays, now used only internally by the new wrapper).
- `SkillVariantContext` gained `activeAttunement: Build['activeAttunement']`; all 4 construction
  sites (`SkillsEditor.tsx`'s `StandardSkillsEditor`/`RevenantSkillsEditor`, `WeaponSkillBar.tsx`,
  `PetsEditor.tsx`) now pass `build.activeAttunement` through — harmless everywhere except the
  Elementalist skill bar, since no other profession's skills ever carry a non-null
  `Skill.attunement`, same "accurate but never matches" posture the file already used for
  `glyphFormVariants`/`celestialAvatarActive` in those non-Ranger/non-Elementalist contexts.
- Removed the now-dead `.tooltip-skill-variant` CSS rules (`global.css`) — no remaining consumer.
- Verified against real `data/game-data/skills.json`: Glyph of Lesser Elementals' canonical id 5502
  has exactly the 4 expected attunement-tagged variant ids (25486 Fire/25487 Water/25495 Air/25497
  Earth), matching the same mechanism already confirmed live in an earlier session (COMPLETED.md
  Session 106-era note on `relatedVariantSkills(skill 5506, allSkills)`). `npm run
  typecheck`/`lint`/`build` all clean. Not itself visually re-confirmed live (Electron sandbox
  limitation) — same caveat as everything else in this codebase that can't be screenshotted here.

## Session 142 — Automatic game-data refresh (Option C: static-publish, in-app)

Picked up TODO.md's "Automatic game-data refresh mechanism" item — direction (Option C, "check on
launch, prompt the user") was already decided (2026-07-31/2026-08-07); this session built it.
Asked the user one open design question — how the launch-time "prompt" should surface — and they
picked a NavBar badge on the Settings tab over a dismissible banner or blocking modal.

- **Publish side turned out to need zero new infra**: `data/game-data/*.json` is already committed
  to this public repo, so the raw GitHub content URL for `main` already *is* the fetchable blob the
  moment a curation session pushes — no worker endpoint, no upload step. `data-update.ts` hardcodes
  the same owner/repo electron-builder.yml's `publish` config already uses.
- **Freshness signal**: added `gw2Build` (the GW2 API's own `/v2/build` id) to `meta.json`,
  fetched by `fetch-game-data.ts` alongside everything else. Chosen over comparing `fetchedAt`
  alone specifically because `fetchedAt` bumps on every pipeline re-run even for a curation-only
  tweak that touches no `data/game-data/*.json` content — `gw2Build` only changes on a real game
  update. The live repo's `meta.json` predates this field (`fetchedAt` only) — rather than
  fabricate a historical build number for it, left `gw2Build: null` there and added a fallback:
  the update-check compares `fetchedAt` instead whenever either side is `null`, so an existing
  local copy still gets offered the first real refresh once one is published.
- **Consume side** (`src/main/game-data/`):
  - `load-game-data.ts`'s `resolveDataDir()` now prefers a writable `<userData>/game-data/`
    override directory over the bundled/dev copy whenever that override's own `meta.json` exists.
  - `data-update.ts`: `checkForUpdate` compares local vs. remote `meta.json`;
    `downloadUpdate` pulls every file in the new `GAME_DATA_FILE_NAMES` list
    (`src/shared/game-data/data-files.ts`, hand-synced with `load-game-data.ts`'s own read list —
    same tradeoff as the Worker's `ShareKind`) into a temp directory, `meta.json` last, then
    swaps it in for the override directory in one `rm`+`rename` — a failure partway through never
    leaves a mismatched mix of old/new files.
  - Same "downloaded, needs a restart" contract as the existing app-binary updater — the
    already-loaded in-memory `GameData` stays exactly as it was until `SettingsView`'s "Restart
    now" button (`app.relaunch()` + `app.exit()`).
- **IPC/UI**, mirroring the app-binary updater's own shape end-to-end: `DataUpdateIpcChannel` +
  `DataUpdateProvider` (`src/shared/game-data/`), `registerDataUpdateIpc` (returns a
  `runAutoCheck` the main process fires once on `ready-to-show`), `window.gw2DataUpdate` preload
  bridge, a new `DataUpdateStoreProvider` React context (`src/renderer/state/data-update-store.tsx`,
  mounted in `App.tsx` alongside the other cross-cutting providers) so `NavBar`'s badge and
  `SettingsView`'s full check/download panel share one status rather than each subscribing
  independently, and a new "Game data" panel in `SettingsView.tsx` parallel to "Updates".
- Manually patched the live `data/game-data/meta.json` to add the new `gw2Build` field —
  confirmed live via a direct `/v2/build` call (returned 205299) before touching anything, then
  left the field `null` anyway rather than backdating today's build number onto an 11-day-old
  `fetchedAt` (that would misrepresent what build the data was actually fetched at — see the
  fallback-comparison reasoning above for why `null` here doesn't break the check).
- Also fixed stale TODO.md text: the item's own "Curation-side change detection" sub-bullet said
  "not yet built — direction only," but that was actually already closed in Session 121
  (`fetch-balance-patch-changes.ts`) — a separate, already-done piece of the same TODO entry that
  just hadn't been reconciled with the checklist wording.
- `npm run typecheck`/`lint`/`build` all clean.
- **Known gap, not chased further**: `gw2Build` only reflects `fetch-game-data.ts`'s own fetch —
  the separate wiki-sourced scripts (`fetch-elite-spec-skills.ts`, `fetch-wvw-splits.ts`, etc.)
  don't bump it if run independently. In practice these are run together in the same curation
  session per `docs/game-data.md`'s own "re-run X too" notes throughout, so this is close enough,
  but a wiki-only content change committed without also re-running `fetch-game-data.ts` wouldn't
  be detected as an update by this mechanism. Also unverified in the live packaged app (same
  Electron-sandbox limitation as ever — see project memory); typecheck/lint/build clean is the
  fallback confirmation for now.

## Session 141 — Tooltip visual pass: icon-in-header + rarity-colored titles (traits/skills/gear upgrades)

First slice of the "dedicated visual pass over every tooltip type" TODO item. Visually confirmed
live in `npm run dev` (traits/skills screenshots looked right; gear stat prefixes/relics/runes/
sigils/infusions approved after a rarity-mapping correction mid-session).

- **Icon next to title**: `Tooltip.tsx`'s `TooltipBody` gained an optional `icon` prop, rendered
  in a new `.tooltip-header` flex row ahead of the title (24px circular icon matching the app's
  existing trait-icon styling, 18px inside `.tooltip-skill-variant` sub-entries). Wired for
  traits/skills directly (`TraitsEditor.tsx`, the shared `skillTooltipContent` in
  `SkillsEditor.tsx` — which `WeaponSkillBar`/`ProfessionMechanicBar`/`PetsEditor` all reuse, so
  they picked it up for free) and generically for every `UpgradePicker`-backed category (stat
  prefixes, runes, sigils, infusions, relics, food, utility, squad build-assignment) since that's
  one shared component.
- **Rarity-colored tooltip title**: `TooltipBody` gained a matching `rarity` prop
  (`'ascended' | 'exotic' | 'rare' | 'fine'`), colored via new `.tooltip-title.rarity-*` CSS
  classes reusing the existing `--rarity-*` custom properties (added `--rarity-exotic`/
  `--rarity-rare` alongside the prior `--rarity-ascended`/`--rarity-fine`). `UpgradePicker`'s
  `rarity` prop (previously only driving badge border color) now drives both.
- **Corrected rarity mapping** (live user correction, confirmed real GW2 rarity, not the
  scoping-note guess a prior session made): gear stat prefixes stay Ascended; relics/runes/sigils
  are **Exotic** (previously relics were wired to Fine, runes/sigils were unstyled); WvW infusions
  are **Fine** (a first pass briefly wired them to Rare mid-session before the correction landed).
  Food/utility rarity varies per item and isn't wired to a fixed `rarity` prop — still open, see
  TODO.md.
- `npm run typecheck`/`lint` clean throughout.

## Session 140 — Favorites pin for the squad editor's build-assignment picker

Closed the last item left unwired from the 2026-08-06 Favorites feature (commit `f162583`): the squad
editor's per-slot build-assignment picker (`SlotTile`'s `UpgradePicker` instance) now supports
middle-click-to-favorite and sorts favorited builds first, gold star badge included — same
interaction as the Builds/Squads card grids and the Food/Utility pickers.

Reused `Build.favorite` directly (already persisted, already visible on the Builds card grid)
rather than adding a new per-install store like the Food/Utility pickers'
`useFavoriteConsumables` — a build's favorite status is build data, not install-specific, so
there was nothing new to store. `SlotTile` now pulls `updateBuild` from `useBuildsStore` (already
in scope two levels up in `SquadCompEditorView`) and passes `isFavorite`/`onToggleFavorite`
callbacks through to `UpgradePicker`, gated so ghost-pick options (profession/elite-spec
placeholders with no real `Build` behind them) can't be favorited. No CSS changes needed — the
existing `.favorite-star`/`.skill-option-button` rules already cover the `slot` variant.

## Session 139 — `PrefixedBuff` target-count sweep, final leg — sweep closed (45/45)

Closed out the sweep in one combined leg per the user's request, since only 6 sources across 5
professions remained (Mesmer(2)/Necromancer(1)/Warrior(1)/Engineer(1)/Thief(1) — each too small to
warrant its own single/double-source leg). Re-ran the discovery scan first per
[[prefixedbuff_target_count_sweep]]'s "how to apply" note and confirmed the logged 6-source count
still held before curating.

- **Party-wide(5)**: Experimental Turrets (Engineer trait 1678 — wiki: "Turrets... grant boons to
  allies around them," own Boon-Radius(600) fact but no explicit Number fact, same "no explicit ally
  cap stated, default 5" convention used elsewhere in the table); Life of the Party (Mesmer trait 2367
  — wiki: "Lively Lute and Crescendo grant boons to affected allies," own Radius facts (600/360) but
  no explicit Number fact, same default-5 convention); Shadestep (Thief trait 2289 — own facts already
  carry an explicit "Number of Targets: 5"/Radius(360)); Roaring Reveille (Warrior trait 1471 — gates
  Charge (14393)/Call of Valor (14394), both already curated party-wide(5), same gate-reuse pattern as
  Guardian's Inspired Virtue/Legendary Lore).
- **Party, count 1**: Transfusion (Necromancer trait 778 — own description: "Marks can be triggered by
  allies to heal them," the established "one ally per mark trigger" mechanic already curated for all 4
  of its gated skill ids — Chillblains/Reaper's Mark/Lesser Chilblains/Putrid Mark).
- **Self-only**: Auspicious Anguish (Mesmer trait 673 — "Convert damaging conditions to boons whenever
  you gain Distortion or become disabled," first-person throughout, no ally wording anywhere on the
  page).

Added all 6 to `TARGET_COUNT_OVERRIDES` in `src/shared/boon-calc/sources.ts` plus a closing leg
section in its doc comment; updated the sweep's top doc comment to record the final 45/45 total.
Re-ran the discovery scan (widened to all 9 professions this time) afterward and confirmed zero
uncurated `PrefixedBuff` boon sources remain anywhere. `tsc --noEmit` clean. Sweep fully closed —
removed its TODO.md entry.

## Session 136 — `PrefixedBuff` target-count sweep, Revenant leg (2nd of the backlog)

Continued the sweep per [[prefixedbuff_target_count_sweep]]'s "how to apply" note: re-ran the
discovery scan (a small Node script against `skills.json`/`traits.json`, bounded strictly to the
`TARGET_COUNT_OVERRIDES` export so it can't be confused with the differently-shaped
`CONDITION_CLEANSE_TARGETS` export) and confirmed the logged 25-source/8-profession count still held,
Revenant(7) largest.

Curated all 7 Revenant sources — 1 skill + 6 traits, mixed self/party-wide unlike the all-self
Elementalist leg:
- **Party-wide**: Spirit Boon (1774, party 5 — its own facts carry an explicit "Number of Allied
  Targets: 5"/Radius(240)); Serene Rejuvenation (1814, party 5 — corroborated via its 3 linked
  Legendary Centaur skills' own "Number of Targets: 5" facts, since the trait itself has no direct
  Number fact); Bold Reversal (2133, party 5 — the boons it adds ride on Heroic Command/Orders from
  Above, both already explicit party-5 on their own facts); Found Purpose (2352, party 4 — its own
  facts carry an explicit "Number of Allied Targets: 4"/Range(360)).
- **Self-only**: Ancient Echo (55029 — wiki: "All four effects only affect the caster"); Reaver's
  Curse (2259 — no ally wording anywhere, corroborated against the structurally-parallel self-only
  "Forerunner of Death" Death Drop variant, skill 62693); Numinous Gift (2440 — no Number/Radius fact
  at all, first-person "Gain might... when you use Cosmic Wisdom"; its party-wide counterpart is the
  separate Found Purpose trait id above, so no per-line conflict).

Added to `TARGET_COUNT_OVERRIDES` in `src/shared/boon-calc/sources.ts` plus a new leg section in its
doc comment. Revenant is now fully closed (7/7). 18 sources remain across Ranger(8)/Guardian(4)/
Mesmer(2)/Necromancer(1)/Warrior(1)/Engineer(1)/Thief(1) — logged in TODO.md for the next leg
(Ranger, largest remaining).

## Session 135 — `PrefixedBuff` target-count sweep, corrected the backlog count + closed out Elementalist

Resuming the sweep, re-ran the discovery scan per [[prefixedbuff_target_count_sweep]]'s own
"how to apply" note and found it had drifted more than expected: the original 35-source/8-profession
estimate undercounted. Root cause: that earlier pass (no discovery script was committed, so its exact
method is lost) apparently treated "this id appears anywhere in `sources.ts`" as "already curated" —
several trait ids (621, 1678, 778, 2289, ...) are referenced in *other* sources' comments as the gate
that gives them their target count, but never actually got their own top-level
`TARGET_COUNT_OVERRIDES` entry for their own tooltip rendering (`boonConditionFactsForTrait` resolves
each trait's own facts independently of any skill it gates). A programmatic re-scan — every
`type === 'PrefixedBuff'` fact with an `isBoonName` status across `skills.json`/`traits.json`, checked
against the real top-level keys in the `TARGET_COUNT_OVERRIDES` object literal — found the true total
is 45 distinct sources across 9 professions (Thief wasn't in the original 8 at all).

The re-scan also caught 3 sources inside the already-"done" Elementalist leg that the original pass
missed entirely: Elemental Attunement (264), Familiar's Blessing (2380), Altruistic Aspect (2415) —
all genuinely party-wide, unlike every other Elementalist source in that leg. Each one's own wiki page
carries an explicit `{{skill fact|targets|5}}`, so all three are curated `5`. Elementalist is now
fully closed (20/20 sources). Updated `TARGET_COUNT_OVERRIDES`' doc comment in
`src/shared/boon-calc/sources.ts` to record the corrected total and the discovery-scan lesson, and
TODO.md's per-profession remaining count (25 now: Revenant(7), Ranger(8), Guardian(4), Mesmer(2),
Necromancer(1), Warrior(1), Engineer(1), Thief(1)) for the next leg (Revenant).

## Session 134 — `PrefixedBuff` target-count sweep, Elementalist leg (1st of the backlog)

Started the TODO.md follow-up Session 133 left open. First, scoped it down from the original
452-fact estimate: `targetCount` is only ever rendered for boon-classified facts
(`SkillsEditor.tsx` gates the tooltip badge on `category === 'boon'`), so `PrefixedBuff` condition
facts (e.g. Arcane Precision's crit-triggered conditions) have no consumer for a curated value and
are out of scope by design. The real backlog is 35 distinct skill/trait sources (119 boon-fact
lines) across 8 professions — much smaller than the original raw-fact count suggested.

Curated the Elementalist leg (10 skills + 7 traits, largest of the 8 professions): all confirmed
self-only via wiki wikitext. Every source is an attunement/combo-based personal buff — Glyph of
Elemental Harmony's heal, Inscription (trait 229) riding on the Glyph of (Lesser) Elementals
variants, Elemental Celerity, Unravel, Arcane Lightning, Soothing Disruption, Elemental Lockdown,
Swift Revenge, Elemental Synergy, Enhanced Potency — each with first-person "Gain X" wording and no
"allies" wording found anywhere across the whole leg, so no exclusions were needed. Added to
`TARGET_COUNT_OVERRIDES` in `src/shared/boon-calc/sources.ts` (both the skill and trait tables, plus
a new doc-comment section distinguishing this sweep from the pre-existing Group A/B one). 18 sources
remain across Revenant/Guardian/Mesmer/Ranger/Necromancer/Warrior/Engineer — logged in TODO.md for a
future leg.

## Session 133 — `PrefixedBuff` facts now surface everywhere (boon bar, all tooltips)

Fixed the TODO.md bug flagged 2026-08-07: `extractFromFacts` (`boon-calc/sources.ts`) only ever
recognized `type: "Buff"`, so every `type: "PrefixedBuff"` fact — the API's shape for "trait/skill X
adds a boon specifically to skill Y's own application" (e.g. Revenant/Salvation's minor trait Serene
Rejuvenation, "Legendary Centaur skills apply boons in an area") — was silently skipped everywhere,
including the whole-build boon bar.

Scoping pass (the 3 questions the TODO entry left open, checked against real data before touching
`extractFromFacts`):
- **Does `prefix.status` reliably resolve to one already-modeled skill id?** No — a scan of
  `data/game-data/{traits,skills}.json` found names like "Natural Harmony" matching 2+ distinct skill
  ids with no discriminator to pick one. So source attribution stays at the trait/skill that grants
  the fact (unchanged from `Buff` handling), never resolving `prefix.status` to a specific id.
- **Gated the same way as ordinary `Buff` facts (`requires_trait`)?** Yes — same field, same shape
  (38/301 trait facts and 34/151 skill facts carry `requires_trait`, current data).
- **Do target-count/duration-scaling rules apply identically?** Yes, for free — `resolveTargetCount`
  already scans the combined facts array for a separate `type: "Number"` fact regardless of the
  triggering fact's own type, and `wvwOverrides`/duration-% scaling are keyed by `fact.status`, not
  `fact.type`. Un-curated `PrefixedBuff` sources just get `targetCount: null` ("unknown reach"), same
  as any other source `TARGET_COUNT_OVERRIDES` hasn't covered yet — logged as a new, much smaller
  TODO.md follow-up (452 facts, if a wiki-verified sweep is ever wanted) rather than blocking this
  fix.

Also confirmed 8 malformed `PrefixedBuff` facts (missing a top-level `status`, e.g. Transfusion,
Rapid Regeneration — these describe a triggering condition via `prefix` with the actual effect text
only in `description`, not a real boon/condition grant) already get skipped by the pre-existing
`typeof fact.status !== 'string'` guard — no special-casing needed.

Fix: widened `extractFromFacts`'s type guard to accept `'PrefixedBuff'` alongside `'Buff'`. Since
every consumer (whole-build boon bar, skill/aura/combo tooltips) already funnels through this one
function, this alone fixed all of them except one: `TraitsEditor.tsx`'s own trait-picker tooltip,
found during this pass to hardcode `factsBlock(numericFactLines(...), [])` — an empty boon-facts
array for *every* trait, `PrefixedBuff` or plain `Buff` alike (a pre-existing gap independent of this
bug, called out but deliberately left out of Session 132's tooltip work). Since the original bug
report specifically named "tooltip or boon bar" as both missing, closed this too: added
`boonConditionFactsForTrait` (trait counterpart to `boonConditionFactsForSkill`) to `sources.ts`,
threaded a `build` prop into `TraitsEditor` (only needed for gear-derived boon/condition duration %,
computed the same way `SkillsEditor.tsx`'s `useDurationContext` does) from `BuildEditorView.tsx`, and
wired both the minor- and major-trait tooltips to call it.

Also added a typed `prefix?: { text?, icon?, status?, description? }` field to the `Fact` interface
(`types/game-data.ts`) — previously only reachable through the interface's untyped index signature.

Verified via a standalone repro script (real game data, a bare Revenant/Ventari/Salvation build,
`computeBoonConditionSources` + `boonConditionFactsForTrait` called directly): all 5 of Serene
Rejuvenation's boons (Vigor, Regeneration, Swiftness, Resistance×2) now appear on both paths, where
before the fix all 5 were silently dropped. Typecheck/lint clean.

## Session 132 — Skill tooltips now render Misc/Control/Strip-Corrupt/Combo/Aura facts

Fixed the TODO.md bug flagged 2026-08-07: skill tooltips only ever rendered `factLine`'s numeric
lines and `boonConditionFactsForSkill`'s boon/condition output (hardcoded to `category:
'boon'|'condition'` only) — every other category (Misc: Stealth/Superspeed/Evade/Breaks Stun/Barrier;
Control: Stun/Daze/Knockdown/Knockback/Launch/Pull; Strip/Corrupt/Cleanse; Combo Field/Finisher;
Auras) only existed via the whole-build aggregation path (`computeNamedFactSources`/
`computeAuraSources`/`computeComboSources` in `boon-calc/sources.ts`) feeding
`BoonConditionSummaryPanel`, never the per-skill tooltip — e.g. a skill granting Superspeed showed up
correctly in the boon bar's Misc. row but nothing on its own tooltip.

Fix shape: exactly the "per-skill counterpart to `computeNamedFactSources`" the TODO entry already
proposed, mirroring the existing `boonConditionFactsForSkill` pattern (which already does this for
boons/conditions). Added 3 new exported per-skill functions to `sources.ts`, each just calling the
existing single-source helper (`extractFromFacts`/`namedFactsFrom`/`comboFactsFrom`) directly instead
of walking the whole build — no new fact-matching logic, reuses every matcher table
(`CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`/`BOON_STRIP_CORRUPT_MATCHERS`) and icon set
(`AURA_ICONS`/`CONTROL_ICONS`/`MISCELLANEOUS_ICONS`/`BOON_STRIP_CORRUPT_ICONS`/`COMBO_ICONS`) already
built for `BoonConditionSummaryPanel`:
- `auraFactsForSkill` — same `extractFromFacts`+`classifyAura` call `computeAuraSources` makes per
  source, not duration-scaled (auras have no gear-derived duration-% concept, matching
  `computeAuraSources`'s own `{ boon: 0, condition: 0 }`).
- `namedFactsForSkill` — thin wrapper around the not-yet-exported `namedFactsFrom`, called once per
  matcher table exactly like `computeNamedFactSources` does.
- `comboFactsForSkill` — thin wrapper around the not-yet-exported `comboFactsFrom`.

Wired into `SkillsEditor.tsx`: `factsBlock` gained an optional third `SkillNamedFacts` parameter
(auraFacts/namedFactSources/comboFacts, all defaulted to `[]` so trait tooltips — which call
`factsBlock` with only 2 args and don't compute any of this — keep compiling unchanged, since this
bug was scoped to skill tooltips specifically). Added 3 new render blocks reusing the exact same
`tooltip-boon-facts`/`tooltip-fact-label`/`boon-source-duration`/`boon-source-target` CSS classes the
existing boon-facts block already uses (no new CSS needed). A new `skillNamedFacts(skill, activeIds,
wvwOverride)` helper bundles all 3 matcher-table calls into one `SkillNamedFacts`, exported and reused
by `skillTooltipContent` (for both the base skill and its `relatedVariantSkills` entries) and by
`ProfessionMechanicBar`'s own inline tooltip builder (which deliberately doesn't call
`skillTooltipContent` itself, see that component's existing doc comment, but still needed the same fix).
`WeaponSkillBar.tsx`/`PetsEditor.tsx` needed no changes at all — both already route through
`skillTooltipContent`, so they picked up the fix for free.

Deliberately out of scope: `TraitsEditor.tsx`'s trait tooltips already don't render boon/condition
facts at all today (`factsBlock(numericFactLines(...), [])`, hardcoded empty array) — a separate,
larger, undocumented gap this bug's own TODO.md entry never mentioned (it's titled "Skill tooltips,"
not "Trait tooltips"). Left untouched rather than silently expanding scope; worth its own TODO.md entry
if it matters later. `WeaponSkillBar.tsx`'s `tomeChapterTooltip` (Firebrand Tome chapters) also
untouched — a genuinely different data shape (`TomeChapter.facts`, not `Skill.facts`/`Fact[]`), and
`computeAuraSources`'s own doc comment already confirms tome data carries no aura facts at all.

Verified via a standalone script (not just typecheck/lint, per this codebase's standard practice):
ran all 3 new functions directly against real `data/game-data/skills.json` entries for 5 known cases —
Windborne Speed (Superspeed/Misc), Shocking Aura (Stun/Control), Signet of Restoration's `requires_trait`
-gated Frost Aura (Aura — confirmed gating correctly returns empty with no active traits, then the real
entry once the gating trait id is included), Throw Gunk (Ethereal Combo Field), Throw Mine (Strip) — all
produced the expected non-empty output with correct fields. `npx tsc`/`npx eslint` clean across the
whole project. Not verified visually in the running app (Electron sandbox limitation, same caveat as
every other UI change in this codebase).

## Session 131 — Empty-effect-facts curation: Otherworldly Bond resolved (honest skip), closes the
original 41-id backlog

Last leg of the 35-skill/41-id empty-effect-facts backlog (TODO.md's "Some skills' real effects live
entirely outside the GW2 API's `facts` array" bug) — the very skill that started the whole
investigation back on 2026-08-07, deliberately deferred every prior session as "still the hardest."
(Note: the prior leg, Tale of the Tortured Mastermind + Radiant Resolve/Justice, commit `acfd89e`,
landed without its own COMPLETED.md write-up — its reasoning lives in TODO.md's own bug entry instead,
not duplicated here.)

Fetched Otherworldly Bond (71952) and Deactivate Otherworldly Bond (71858)'s live wiki pages fresh
rather than trusting the 2026-08-07 seed report's summary. Full mechanic: a scepter-3 tether the
player casts at either an ally or an enemy (their choice), escalating over 3 time tiers while it
survives (0-2s / 2-4s / 4-6s, broken early by leaving range or swapping weapons, max 7s total).
Enemy branch: Vulnerability ticking every `interval=1`, then Cripple added at 2s, then Slow at 4s.
Ally branch: Might ticking the same way to the linked ally *and* nearby allies (`allied targets=3`,
360 radius), then more Might, then Fury — unlocking a follow-up chain skill
(`Otherworldly Attraction`) at the 4-6s mark.

**Concluded not curatable without misrepresenting it**, for two independent reasons:

1. The enemy-branch and ally-branch facts are mutually exclusive per cast (target-type is the
   player's choice at cast time), sharing one skill id with no discriminator field — the same
   "curating both would show every cast granting everything simultaneously" overcount shape as Twin
   Moon Sweep's four legend-gated Resonance blocks (Session 130), actually a *stronger* case since the
   branch here is a live per-cast choice, not even a static per-build legend selection a future gating
   field could resolve.
2. Cross-checked the wiki template's own grammar against Icerazor's Ire's and Anguish's already-curated
   `stacks=N` pages (fetched both fresh to compare) and confirmed Otherworldly Bond's
   Vulnerability/Might facts carry **no `stacks=` parameter at all**, unlike every other multi-
   application skill this pipeline has curated — these are genuinely open-ended ticks tied to how long
   the tether survives, not a fixed per-cast total this app's `duration`/`apply_count` Buff shape can
   represent honestly.

Either reason alone would be sufficient; together they rule out curating any single branch or tier —
picking one would either overcount (wrong branch for a given player) or understate (only the
guaranteed first tick, silently dropping the escalation the skill is built around). Left as an honest,
fully-documented skip, same treatment as Prayer to Lyssa's random-pick and Twin Moon Sweep's Resonance
blocks.

**Deactivate Otherworldly Bond (71858)**: nothing to curate — "Disable the tether," no wiki facts
beyond Range.

**Also checked (no action needed)**: the tether's own follow-up chain skills, `Otherworldly Attraction`
(71827 ally-release, granting Barrier; 71880 enemy-release, applying Vulnerability) already carry real,
complete API facts today — never part of this bug's candidate set, confirmed working as-is.

No code or data change — documentation-only close-out. `npx tsc`/`npx eslint` clean (nothing touched).
TODO.md's bug entry flipped to `[x]`: **this closes every id in the original 41 (35 unique skill
names)**. Follow-up `Fact`-model capability gaps found along the way by every prior leg (conditional/
gated grants, per-application WvW overrides, `wvwOverrides` threaded through `namedFactsFrom`, etc.)
are catalogued in TODO.md's own entry as a separate, not-yet-scoped future item — none attempted here.

## Session 130 — Empty-effect-facts curation: Twin Moon Sweep cluster

Eighth leg of the 35-skill/41-id empty-effect-facts backlog. Picked the next item off Session 129's
remaining-scope list.

**Twin Moon Sweep (Revenant/Conduit elite, ids 76968/77001 — one wiki page, `id = 76968, 77001`, the
same GroundTargeted/non-GroundTargeted duplicate-id pair shape as the Elixir cluster)**: the skill's
own base cast grants an unconditional self Might (8s/2 stacks, no `game mode=` split present on that
line) alongside a foe-facing bleeding condition and a "Number of Targets per Scythe" reach fact — only
the Might got curated, same `resolveTargetCount`-is-per-skill conflict (self boon vs. foe condition on
one id) as the Elixir/Shadowsquall clusters, plus bleeding/damage belong to already-swept pipelines
regardless.

**New architecture-limit shape found, NOT curated**: the page's real bulk is four mutually-exclusive
"Resonance" bonus blocks (each gated on "if [[Legendary X Stance]] is equipped in the other legend
slot" — Assassin: damage increase + immobilize; Demon: bonus strike damage + confusion; Centaur: heal +
condition cleanse to allies; Dwarf: stability/resistance/resolution + stun) all living on the SAME
skill id with no separate id per stance the way Fox's Fury's Fire-attuned bonus got its own id
(77282). Unlike Fox's Fury's single always-curatable conditional bonus, adding all 4 branches as
simultaneous `Buff` facts would show every cast granting all four legends' bonuses at once — only one
can ever be true for a given build, so this is the same "would overcount" shape as Prayer to Lyssa's
random-pick, an honest skip rather than a wrong answer. No existing `Fact`/gating field (parallel to
`requires_trait`) can express "requires this specific legend in the other slot" — would need a new
gating shape to model at all, same scale of follow-up as the already-noted PrefixedBuff/dodge-roll
gaps, not attempted here.

Also fixed a small pre-existing, unrelated `noUnusedLocals` typecheck failure in
`fetch-target-counts.ts` (an unused `sourceKind` parameter left over from Session 116) found while
verifying `npx tsc` was clean for this leg — prefixed with `_` rather than removed, since the caller
still needs to pass it for the function's own documented 3-tier-resolution shape.

`npx tsc`/`npx eslint` clean. Merged output spot-verified via a standalone script (both ids' `.facts`
show the injected Might Buff alongside the real API Range/Recharge facts, no duration split applied
since the wiki page's Might line carries no `game mode=` tag). Full write-up in TODO.md's own updated
bug entry. **Remaining**: 7 of the original 41 ids (Otherworldly Bond; Tale of the Tortured Mastermind;
Radiant Resolve/Radiant Justice, plus Radiant Resolve's own 3rd unresolved flip-id 78514).

## Session 129 — Empty-effect-facts curation: Fox's Fury cluster

Seventh leg of the 35-skill/41-id empty-effect-facts backlog. Picked up the candidate Session 128's
fresh re-scan surfaced (missed from every prior write-up of "the 41 ids" until that re-scan, not a new
API change).

**Fox's Fury (Elementalist/Evoker meditation, ids 76711/77282 — one wiki page)**: 76711 (base cast) had
zero real API facts at all; its Fire-attuned enhanced cast 77282 (already had a curated Damage
coefficient from an earlier pipeline leg) turned out to also be silently missing its own Might fact
even though it DOES carry real Fury/Burning/Damage/StunBreak facts — a partial gap this scan's
all-zero-facts heuristic can't catch on its own, found only by cross-checking the sibling id per the
Icerazor's Ire cluster's "curate every id sharing the page" precedent. Curated: 76711 gets unconditional
Might (10s/8 stacks pve, wvw+pvp duration override 8s) + Fury (10s pve, wvw+pvp override 8s) + a
synthetic `Number of Allied Targets`=5 (the wiki's own `targets` fact — unambiguous here since the
skill's only foe-facing effect, Burning, is single-target); 77282 gets the same base Might plus a
separate "Fox Bonus" Might (10s/3 stacks pve, only while Fire-attuned) and the same targetCount=5.

**New architecture-limit shape found**: giving 77282's Might a WvW duration override would have been
safe in isolation, but `extractFromFacts` collapses EVERY fact sharing a status once ANY override
exists for that status (built for the common "same application appears twice as a pve/wvw
API-duplicate-fact pair" case) — since 77282 has TWO genuinely different simultaneous Might
applications (base + Fox Bonus), adding an override there silently dropped the Fox Bonus stack
entirely rather than just showing the wrong duration. Caught by spot-verifying the actual merged
`boonConditionFactsForSkill` output before trusting it, not just typecheck/lint. Reverted: 77282's
Might stays unsplit at PvE duration (10s both applications), a documented gap, not modeled wrong;
76711's Might/Fury (only one fact each, no collision) got the override cleanly.

`npx tsc`/`npx eslint` clean. Full write-up in TODO.md's own updated bug entry. **Remaining**: 9 of the
original 41 ids (Otherworldly Bond; Twin Moon Sweep, 2 ids; Tale of the Tortured Mastermind; Radiant
Resolve/Radiant Justice, plus Radiant Resolve's own 3rd unresolved flip-id 78514).

## Session 128 — Empty-effect-facts curation: Icerazor's Ire cluster + 2 unresolved ids resolved

Sixth leg of the 35-skill/41-id empty-effect-facts backlog. Re-ran `scan-empty-effect-facts.ts` fresh
first to confirm the exact remaining scope before picking a cluster (good thing — it surfaced a new
candidate, see below).

**Icerazor's Ire (Revenant/Renegade legendary utility)** — one wiki page, `id = 40485, <!-- enhanced
--> 72359`: 40485 is the base cast, 72359 the "Band Together"-enhanced cast (that inline HTML comment
is the disambiguator). Curated both foe-facing: "Initial Vulnerability" 8s/10 stacks (on-summon),
Torment 6s/3 stacks, a second on-hit Vulnerability 8s/5 stacks (from the skill's 3-projectile attack —
same status name as the first, but a genuinely separate application per the wiki's own two distinct
`{{skill fact}}` lines, not a duplicate to collapse), and Immobilize 2s. 72359 alone adds an unsplit
Chilled 1.5s.

**New architecture-limit shape found**: `WvwFactOverride`/`MANUAL_OVERRIDES` only ever overrides a
Buff fact's `duration` (`baseDuration = typeof wvwOverride === 'number' ? wvwOverride : fact.duration`
in `sources.ts`) — never `apply_count`. Every split curated anywhere in this pipeline so far happened
to be a duration change, so this never came up before. This skill's wiki page splits Torment and
Initial-Vulnerability by STACK COUNT only (duration identical both modes: Torment 3->2, Vulnerability
10->6), which the mechanism has no way to express — left at the PvE stack counts in
`synthetic-facts.json` (an honest gap, not modeled wrong). Immobilize's own split (2s pve -> 1.5s
wvw/pvp) IS a plain duration change, so that one got a real `MANUAL_OVERRIDES` entry (in both
`fetch-wvw-splits.ts` and the committed `wvw-fact-overrides.json` directly, same "no re-fetch needed"
shortcut prior legs used).

**2 of the original 3 unresolved-collision ids resolved, no curation needed for either**:
- **72359** — same wiki page as 40485 (see above), just the enhanced-cast id; already curated above.
- **46409 "Legendary Renegade Stance"** — its wiki page (`id = 41858`, the OTHER id of this
  Legend-swap flip pair) carries no facts template at all, flavor description only. Same "internal
  state-flag effect, no number, no display path renders it anyway" exclusion class already
  established for Legendary Demon Stance/Unsheathe Gunsaber/Unleash Ranger/Unleash Pet — documented,
  not curated.

**New candidate found by the fresh scan, NOT investigated/curated this leg**: `Fox's Fury` (76711,
Elementalist/**Evoker** base Meditation skill — distinct from its own flip skill 77282, which already
has a curated damage coefficient from an earlier pipeline leg). Wiki facts:
`[damage, burning, might, fury, targets, stun break]`; description opens "Grant boons to nearby
allies, then inflict burning..." — the unconditional might/fury ally-grant looks same-shape as
Detonate Elixir H, worth a look next. This id was absent from every prior write-up of "the 41 ids" in
this backlog — missed until this session's fresh re-scan, not a new API change.

`npx tsc`/`npx eslint` clean. Merged output spot-verified via a standalone script (both curated ids'
`.facts` show the injected condition Buff facts alongside the real API Range/Recharge/Radius facts,
plus the correct `wvwFactOverrides.skill[40485/72359].Immobilize = 1.5`). Full write-up in TODO.md's
own updated bug entry. **Remaining**: 9 of the original 41 ids, plus Fox's Fury (Otherworldly Bond;
Twin Moon Sweep, 2 ids; Tale of the Tortured Mastermind; Radiant Resolve/Radiant Justice, plus Radiant
Resolve's own 3rd unresolved flip-id 78514 — likely the same same-page-sibling shape Icerazor's Ire
just resolved; Fox's Fury).

## Session 127 — Empty-effect-facts curation: Necromancer Shroud cluster (Voracious Arc/Devouring
Cut/Anguish)

Fifth leg of the 35-skill/41-id empty-effect-facts backlog. Picked the next cluster off the Session
126 remaining-scope list, again skipping Otherworldly Bond.

**Harbinger Shroud's Voracious Arc (62539)/Devouring Cut (62672) + Ritualist's Shroud's Anguish
(76864)** — all 3 confirmed reachable despite raw `Downed_*` slot labels via `SHROUD_SLOT_SKILLS` in
`bundle-skills.ts`, same shape as the Elixir cluster's own Shroud ids. Unlike every prior cluster,
these are pure foe-facing condition skills with no competing self/ally boon on the same id, so the
usual `resolveTargetCount`-per-skill exclusion never applied — but a different rule mattered instead:
`targetCount` is documented as "only meaningful when `isCondition` is false," so a synthetic
`Number of Allied Targets` fact (Shadowsquall's own new shape) would be dead weight on a foe-only
skill. Skipped it here.

Curated: Voracious Arc Torment 7s/5 stacks, Devouring Cut Torment 5s/5 stacks (each wiki page's single
un-split torment fact line, taken at face value — no WvW override, unlike each skill's own
separately-split damage-coefficient fact just above it), and Anguish's Crippled 4s + Vulnerability
10s/8 stacks (its direct mark-cast line, not the summoned spirit's own follow-up attack).

**Summon Spirits (76607/77191) has nothing curatable**: every fact on its page describes the 3
summoned spirits' own attacks (damage/daze/barrier duration), not a caster-granted boon/condition —
same "no Buff-shaped fact exists" non-actionable shape as 7 of the Weaver cluster's skills. This also
resolves 77191 out of the original 4-unresolved bucket: its page exists (shared with 76607 via the
infobox's own `id = 76607, 77191` line), a title search just missed it — confirmed non-actionable
either way, not a real gap.

`npx tsc`/`npx eslint` clean. Merged output spot-verified via a standalone script (all 3 curated ids'
`.facts` show the injected condition Buff facts alongside the real API Range/Recharge facts). Full
write-up in TODO.md's own updated bug entry. **Remaining**: 10 of the original 41 ids (Otherworldly
Bond; Icerazor's Ire; Twin Moon Sweep; Tale of the Tortured Mastermind; Radiant Resolve/Radiant
Justice; 3 still-unresolved ids).

## Session 126 — Empty-effect-facts curation: Shadowsquall/Malicious Shadowsquall cluster

Fourth leg of the 35-skill/41-id empty-effect-facts backlog. Picked the next cluster off the
Session 125 remaining-scope list, skipping Otherworldly Bond itself (documented as the hardest, not
a good next pick).

**Thief's Specter/Deadeye scepter Stealth Attack pair** (Shadowsquall 63314, Malicious Shadowsquall
69173 — verified against `specializations.json`, 71/58). Fetched raw wikitext for both (`action=raw`,
not a summarized fetch — an initial WebFetch pass came back paraphrased/lossy and was discarded in
favor of `curl`). Both skills split into an enemy-target branch (poison condition) and an ally-target
branch (heal + Regeneration) — same `resolveTargetCount`-is-per-skill conflict the Elixir cluster
already hit, so only the ally-target Regeneration got curated; the enemy-target poison stays excluded
(foe-facing condition, not this bug's territory).

Both pages give an identical `{{skill fact|regeneration|2.5}}` + `{{skill fact|Number of Impacts|8}}`
pair (each page's own "anomaly" note flags "applies Regeneration 8 times, but there is a hard limit of
5 stacks on a single target") — curated at face value as duration 2.5/apply_count 8, the same
multi-hit apply_count convention already used elsewhere in `synthetic-facts.json`; the wiki's own
noted stack cap is an unmodeled simplification, not a parsing gap.

The two ids differ in reach, both requiring a **new shape for this curation effort**: a synthetic
`Number of Allied Targets` fact alongside the synthetic Buff fact (previously only Buff facts had been
added) —
- **Shadowsquall** (63314): base wiki page's own `{{skill fact|allied targets|5}}` (secondary allies
  at reduced 50% effectiveness in a 240 radius around the primary target) → `Number of Allied
  Targets: 5`. The primary-full/50%-secondary split itself isn't representable (no per-recipient
  `Fact` shape exists) — modeled as a flat 5-target reach at the primary's full value.
- **Malicious Shadowsquall** (69173): its own page explicitly states it, unlike base Shadowsquall,
  "does not apply its effects to allies around your main target" — single-recipient, but that
  recipient is the targeted ally, not necessarily the caster → `Number of Allied Targets: 1` rather
  than the implicit self-only default, reusing `TARGET_COUNT_OVERRIDES`' existing Transfusion
  precedent for "one recipient, not self."

`npx tsc`/`npx eslint` clean. Merged output spot-verified via a standalone script (both ids' `.facts`
correctly show the injected Regeneration Buff fact and Number-of-Allied-Targets fact alongside the
real API Range fact). Full write-up in TODO.md's own updated bug entry. **Remaining**: 13 of the
original 41 ids (Otherworldly Bond's escalating-tier tether mechanic; Icerazor's Ire; Voracious
Arc/Devouring Cut; Summon Spirits/Anguish; Twin Moon Sweep; Tale of the Tortured Mastermind; Radiant
Resolve/Radiant Justice; 4 unresolved-collision ids).

## Session 125 — Empty-effect-facts curation: Weaver Pistol/Spear Dual Attacks cluster

Third leg of the 35-skill/41-id empty-effect-facts backlog. User picked this cluster next (per
Session 124's own note — the other big remaining cluster after the Elixirs).

**Fetched live wikitext for all 11 names/ids** (7 Pistol Weapon_2/3, 4 Spear Weapon_3), confirmed all
11 against `skills.json` (each carries only Range/Recharge in the local API, matching the empty-facts
scan) and each name/profession/spec attribution against `specializations.json` directly (all
Elementalist/Weaver, per TODO.md's own prior verification).

**Found a real shape difference from the Elixir cluster, not just more of the same**: every one of
these 11 skills interleaves an elemental-bullet generate/consume mechanic (wiki's own `{{skill
fact|text|When Consuming a(n) X Bullet}}` sections) — the bonus only lands on the cast that consumes a
bullet, not every cast, and bullet availability depends on the surrounding rotation (other pistol
skills in that attunement also produce bullets). This app's `Fact` type has no way to express "only on
some casts, state-dependent" — modeling it as an unconditional flat `Buff` fact would silently
overcount uptime, the same failure shape as Prayer to Lyssa's already-documented honest skip (a
different root cause than the Elixir cluster's `resolveTargetCount`-is-per-skill architecture limit,
new judgment call this session, not previously written down).

**Only 4 of the 11 had a self-target boon/aura on the unconditional BASE cast** (not gated behind a
bullet consume) — those 4 got curated as `Buff` facts, PvE base values:
- **Raging Ricochet** (71828): Might 6s, 1 stack — the wiki's own unconditional "gain might for each
  target struck" base line, separate from its own bullet-consume bonus (excluded)
- **Flowing Finesse** (71960): Regeneration 5s (unsplit) + Stability 5s PvE/3s WvW — WvW split added
  to `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` and directly to `wvw-fact-overrides.json`, same escape
  hatch the Elixir cluster used (candidate discovery never reaches these ids — no real API Buff fact
  to start from)
- **Frostfire Ward** (72916): Frost Aura 3s + Fire Aura 3s
- **Galvanize** (73104): Might 6s/3 stacks + Superspeed 3s

**The other 7 (Dazing Discharge, Shattering Stone, Frostfire Flurry, Molten Meteor, Echoing Erosion,
Shale Storm, Elutriate) have nothing curatable under this bug's mechanism**: their only non-foe-facing
effects are either the bullet-consume-gated bonuses excluded above, an unnamed internal-state
`{{skill fact|effect|<Name> (effect)}}` template naming no recognized boon/condition/aura (same
silent-no-op shape as the already-documented Legendary Demon Stance/Unsheathe Gunsaber exclusion
class — no current fact-rendering path would even display it), or a different fact type entirely
(Echoing Erosion's on-consume Healing/Barrier `AttributeAdjust` facts; Elutriate/Frostfire Ward's
"Conditions Removed" Cleanse-shaped `Number` fact) belonging to already-swept separate pipelines
(`CURATED_HEALING_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`, `CONDITION_CLEANSE_TARGETS`), not this
one. Every foe-facing condition (burning/bleeding/vulnerability/cripple/chilled/daze) excluded for the
same `resolveTargetCount`-per-skill reason as the Elixir cluster's own foe-facing exclusions.

`npx tsc`/`npx eslint` clean. Verified all 4 curated skills' merged facts + the WvW override resolve
to the exact expected PvE/WvW numbers via a standalone script before trusting it. Full write-up in
TODO.md's own updated bug entry. **Remaining**: 15 of the original 41 ids (Otherworldly Bond's
escalating-tier tether mechanic; Shadowsquall/Malicious Shadowsquall; Icerazor's Ire; Voracious
Arc/Devouring Cut; Summon Spirits/Anguish; Twin Moon Sweep; Tale of the Tortured Mastermind; Radiant
Resolve/Radiant Justice; 4 unresolved-collision ids).

## Session 124 — Empty-effect-facts curation: Elixir of ___ cluster (Necromancer/Harbinger)

Second leg of the 35-skill/41-id empty-effect-facts backlog (Session 123 did the first leg). User
picked the Elixir cluster explicitly — the single biggest/richest remaining win per Session 123's
own note.

**Curated all 5 elixirs, both ids of each GroundTargeted/non-GroundTargeted pair (10 ids)**: fetched
live wikitext for all 5 pages directly (not summarized), confirmed via `skills.json`/`skill-variants.ts`
that each pair really is mechanically identical per the wiki's own shared `id=` list (the collapse
logic keeps the non-GroundTargeted id as canonical for the picker, but both ids get the fact so
neither is a silent gap regardless of which one any given code path resolves through). Added
self-cast boon `Buff` facts only, off each page's "Self Effects on Cast" section, PvE base values:
- **Elixir of Bliss** (62514/68132): Resolution 5s
- **Elixir of Risk** (62530/68105): Might 10s/10 stacks, Fury 10s
- **Elixir of Ambition** (62655/68090, Elite): all 12 boons at 5s (Might 25 stacks, Stability 5
  stacks) — the wiki's own `| missing facts =` block spelled these out individually already, more
  reliable than parsing the vague single "Gain All Boons for Base Duration" line
- **Elixir of Anguish** (62662/68113): Swiftness 10s, Quickness 5s
- **Elixir of Promise** (62667/68081, Heal): Regeneration 8s

**WvW splits**: PvE and WvW share the same value for every boon here except two (Risk's Might
10s->6s, Anguish's Quickness 5s->4s — both wiki-confirmed, the wiki's own `pve wvw` combined tag on
every other line rules out further splits). Added both to `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES`
table (that script's existing escape hatch for skills its automated candidate-discovery sweep can't
reach — it starts from a real API Buff fact, which these skills never had before this session) *and*
directly to the committed `wvw-fact-overrides.json`, so the correction is live now rather than
waiting on a future full wiki re-fetch to pick up the `MANUAL_OVERRIDES` entry.

**Deliberately did NOT curate the foe-facing condition facts** (each elixir's damage-impact-area
line: Weakness/Torment on Risk, Bleeding/Burning/Confusion/Poison/Torment on Ambition, Cripple on
Anguish, Poison on Promise). Root cause: `resolveTargetCount` in `sources.ts` computes exactly one
target count per *skill*, applied to every `Buff` fact on it — there's no per-fact self-vs-foe split.
Adding both the self-only boon facts and the 5-foe condition facts to the same skill id would force
one side to read wrong (either the self-boons show as reaching 5 allies, or the foe-conditions
collapse to self-only). This differs from Chaos Storm's already-curated boons-to-allies/
conditions-to-foes case, which only works because the wiki gives both sides the *same* target count
(5) by design — these elixirs don't. Left as a documented gap rather than curated wrong, plus a
TODO.md note that a per-fact (not per-source) target-count model in `sources.ts` might resolve this
properly some day — not attempted here, out of scope for this leg.

**Also out of scope, separate already-swept pipelines**: damage coefficients, target-count/radius
facts, life force generation, Boons-Converted-to-Conditions (corrupt), Conditions-Removed (cleanse)
— none of these are `Buff` facts, so `synthetic-facts.json`'s mechanism doesn't apply; they belong to
`CURATED_DAMAGE_COEFFICIENTS`/`TARGET_COUNT_OVERRIDES`/`CONDITION_CLEANSE_TARGETS` instead, which
already completed their own full sweeps earlier in this pipeline.

`npx tsc`/`npx eslint` clean. Verified the merged facts + WvW overrides resolve to the exact expected
PvE/WvW numbers via a standalone script before considering this done, same "verify before trusting
the output" discipline as every other leg of this pipeline. Full write-up in TODO.md's own updated
bug entry. **Remaining**: 26 of the original 41 ids (Weaver Pistol/Spear Dual Attacks next, per
Session 123's own note — 11 names, the other big cluster; Otherworldly Bond; Shadowsquall/Malicious
Shadowsquall; Icerazor's Ire; Voracious Arc/Devouring Cut; Summon Spirits/Anguish; Twin Moon Sweep;
Tale of the Tortured Mastermind; Radiant Resolve/Radiant Justice; 4 unresolved-collision ids).

## Session 123 — Empty-effect-facts curation: first leg (Detonate Elixir H + 2 exclusion classes)

Started curating the 35-skill/41-id backlog from Session 115's `scan-empty-effect-facts.ts` scan
(TODO.md's "some skills' real effects live entirely outside the GW2 API's `facts` array" bug — the
one remaining item from the whole wiki-extraction pipeline thread). Re-ran the scan fresh first to
confirm the exact id list and per-skill wiki fact labels rather than trusting the 9-day-old writeup
from memory.

**Found the injection point already exists**: `synthetic-facts.json` + `load-game-data.ts`'s
`withSyntheticFacts`, built during the earlier Damage/Healing coefficient pipeline for one skill
(Tale of the Second Scion, id 76695) but actually type-agnostic — any `Fact` shape merged there is
indistinguishable from a real API fact to every downstream consumer, including `Buff` facts, which
flow straight through `extractFromFacts`/`boonConditionFactsForSkill` into both the skill's own
tooltip and the whole-build boon/condition bar with zero new code. Confirmed this is the right
mechanism for the empty-effect-facts case too, not a separate design — extended the doc comment in
both `load-game-data.ts` and `docs/game-data.md` to cover the new use case rather than writing a
duplicate mechanism.

**Curated 1 skill**: **Detonate Elixir H (6119)**, Engineer's underwater-only Elixir-H Toolbelt
skill — live API returns only Range/Recharge, wiki documents Protection 2s/Regeneration
4s/Swiftness 4s to allies on detonation. Added as 3 synthetic `Buff` facts. Verified reachability
concern before trusting it (underwater-only skills are a known "is this even a real gap" question,
same shape as the earlier Downed_*-slot false positive Session 115 caught) — confirmed underwater
ids are already treated as reachable/curated elsewhere in this app (`damage-calc.ts`'s Grenade Kit
underwater ids), so this one's genuine.

**Found and documented 2 exclusion classes while spot-checking, not part of the original count's own
error but a refinement of which of the 41 are actually actionable**:
- **4 ids are wiki-template false positives for "actionable"**: Legendary Demon Stance (28494),
  Unsheathe Gunsaber (62745), Unleash Ranger (63147), Unleash Pet (63344) — each profession-mechanic
  toggle's only non-meta wiki template is a bare `{{skill fact|effect|<InternalStateFlagName>}}`
  (e.g. "Unleashed", "Gunsaber Mode") with no accompanying number. That's an internal state-flag
  name other skills reference, not a boon/condition or numeric value — and critically, no current
  fact-rendering path would even display a synthetic fact here (`factLine` has no generic/`NoData`
  case at all, a separate already-tracked TODO.md bug), so curating one would be a silent no-op, not
  a real fix. Confirmed via live wikitext fetch for all 4 (plus Prayer to Lyssa, below) rather than
  assumed from the scan's summary line.
- **1 id is an honest skip**: Prayer to Lyssa (12362) grants ONE random boon (of 8) to self and ONE
  random condition (of 9) to the target foe per cast, each with its own wiki duration. Modeling all
  17 as simultaneous `Buff` facts would misrepresent every cast as granting all of them at once —
  overcounting boon uptime, actively wrong rather than just incomplete. Left uncurated rather than
  curated wrong; would need a dedicated "random pick from N" `Fact` shape to do properly, out of
  scope for this pass.

`npx tsc`/`npx eslint` both clean. Full reasoning for both exclusion classes lives in
docs/game-data.md's synthetic-facts.json section and TODO.md's own updated bug entry, not
duplicated here.

**Not done**: the other 36 ids (Elixir of ___ cluster — 5 names/10 ids, the single biggest and
richest remaining win; Weaver Pistol/Spear Dual Attacks — 11 names; Otherworldly Bond's own
escalating-tier tether mechanic, genuinely the hardest shape in the whole list since it ramps
through 3 time-gated tiers rather than a flat grant; Shadowsquall/Malicious Shadowsquall; Icerazor's
Ire; Voracious Arc/Devouring Cut; Summon Spirits/Anguish; Twin Moon Sweep; Tale of the Tortured
Mastermind; Radiant Resolve/Radiant Justice; 4 unresolved-collision ids needing a manual wiki look)
are still unstarted. Deliberately stopped after one small, fully-verified leg rather than chaining
into a cluster — this is judgment-heavy per-skill design work, not a mechanical sweep.

## Session 122 — Balance-patch detection extended to target-count/Condition-Cleanse reach

Picked up TODO.md's own note that the "Wiki-sourced data pipeline" section's top-level checkbox
stays unchecked until `fetch-balance-patch-changes.ts` also covers `TARGET_COUNT_OVERRIDES`/
`CONDITION_CLEANSE_TARGETS` (previously only the 3 coefficient tables). User picked this over
curating the 35 empty-facts skills when offered the choice.

**Investigated the wiki phrasing first** (same discipline as every prior leg — survey before
regexing): grepped the already-cached 59 `Category:Balance updates` pages for `from A to B` clauses
near "target"/"condition" wording. Found the unambiguous shape is "(maximum) number of allied
targets (affected) from A to B" (confirmed on Heat Sync, Grace of the Land, a 2021-05-11 Banner
trait change). Deliberately did NOT wire up two look-alike shapes:
- The bare "number of targets from A to B" (no "allied") — same enemy-vs-ally ambiguity
  `fetch-target-counts.ts`'s own doc comment already established for live wiki pages (a skill can
  hit foes and allies off one shared template, e.g. Grinding Stones) — a patch changing this count
  can't be assumed to be the ally-reach value these two tables track.
- "(number of) conditions removed from A to B" — despite the word overlap with Condition Cleanse,
  this is the MAGNITUDE of the `Conditions Removed` fact (how many stacks/types get cleared), a
  completely different field than what `CONDITION_CLEANSE_TARGETS` curates (WHO gets cleansed —
  self vs. an ally count). Out of scope for this "self-vs-party wording" item.

**Built** a second code path in `fetch-balance-patch-changes.ts` (`processReachGroups`/
`ReachOutcomeEntry`/`parseReachClauses`), kept separate from the existing coefficient-table
machinery rather than forced through it: `TARGET_COUNT_OVERRIDES`/`CONDITION_CLEANSE_TARGETS` store
a single `TargetCountOverride` (`number | 'self'`) per (sourceKind, id) — no factText array, and
cover both skills AND traits (the 3 coefficient tables are skill-only, so id resolution now checks
`traits.json` too). Reuses the existing per-line scan pass (no extra wiki fetches) — every line
already visited for `parseChangeClauses` is also passed through `parseReachClauses`. Since the
prose alone never says whether a reach change belongs to the boon-reach table or the cleanse-reach
table, a resolved id is checked against BOTH; a curated `'self'` value has no number to compare, so
a patch showing a numeric allied-target change on a `'self'` entry gets its own `self-conflict`
outcome rather than being silently forced into `match`/`stale`/`mismatch`.

**Live run**: only 2 icon-marker-attributed "allied targets from A to B" clauses found across all
59 patches (Heat Sync 2020-02-25 10->5, Grace of the Land 2020-02-25 10->5) — both correctly
resolved (skill vs. trait) and both `not-curated` (neither table has an entry for them, since both
carry their own direct API `Number of Allied Targets` fact and never needed an override — expected,
not a bug). Zero MATCH/STALE/MISMATCH/SELF-CONFLICT. Low yield is real, not a parsing bug — most
`TARGET_COUNT_OVERRIDES`/`CONDITION_CLEANSE_TARGETS` entries exist specifically because neither the
API nor the wiki state a target count for them at all, so patch notes for those same skills rarely
phrase a change as a numeric "from A to B" either. `npx tsc`/`npx eslint` clean. Output written to
the same `data/game-data/balance-patch-verification.json` (new `reachTotalChangeClausesParsed`/
`reachGroupsCompared`/`reachSummary`/`reachEntries` fields alongside the existing coefficient ones —
same file, not a new one). TODO.md's "Wiki-sourced data pipeline" top-level checkbox now checked
off — all 4 numbered steps done.

## Session 121 — Wiki-extraction pipeline step 4: balance-patch change detection

Picked up the wiki-extraction pipeline's last open step. User said "tackle step 4" directly (no
menu of options needed this time — TODO.md's own step 4 wording already scoped it: wire the
change-detection mechanism via the wiki's `Game_updates` page history).

**Research before writing any code**: the aggregate `Game updates` page and monthly `Game
updates/<Month Year>` pages both turned out to be pure template transclusions (semantic-MediaWiki
queries), not raw diffable prose. The real content lives on dated `Game updates/YYYY-MM-DD`
subpages, and `Category:Balance updates` turned out to be exactly the right scoped index of them —
59 pages, 2022-present, each a real balance patch (confirmed live via the MediaWiki
`list=categorymembers` API, paginated the same way `fetch-elite-spec-skills.ts` already does).
Surveyed all 59 pages' raw wikitext for exact label phrasings before writing any regex (933 "X
coefficient from A to B" occurrences alone) rather than guessing the shape.

**Built** `scripts/fetch-balance-patch-changes.ts` (`npm run fetch-balance-patch-changes`):
- Parses `{{game update icon|Title}}`/`{{skill icon|...}}`/`{{simple icon|...}}`/`{{trait
  icon|...}}` markers (first positional param = the exact current wiki page title — no
  name-collision search-API machinery needed here, unlike `fetch-skill-coefficients.ts`, since the
  patch note already names the exact page) plus `"<label> from A to B[ in <mode>[ only]]"` clauses
  for 7 known label phrasings across the 3 coefficient tables (power/heal/barrier coefficient,
  heal/barrier attribute scaling, base heal/barrier).
- Mode-relevance filtering: curated tables store the WvW-verified value, so a "PvE only"/"PvP only"
  clause (no WvW) can't move it and is excluded from comparison rather than treated as a mismatch.
- Groups by (skill, table, field); only the chronologically LATEST patch per group is compared
  against today's curated value — an older patch's value being neither old-nor-new is expected once
  a later patch changed the same thing again, not itself a red flag.
- Resolves a title to a skill id via a single direct `| id = N` fetch (comma-list pages
  disambiguated only when exactly one listed id has any curated entry in the relevant table).

**Two real bugs caught and fixed before trusting the first run's output** (same instinct as every
prior pilot in this pipeline — see `wiki_pipeline_pilot_next` memory for the pattern):
1. Multi-hit skills' patch notes state the PER-STRIKE coefficient ("Reduced power coefficient per
   strike from 0.24 to 0.16") while `CURATED_DAMAGE_COEFFICIENTS` stores the value already totaled
   across hits — the exact convention `fetch-skill-coefficients.ts` already handles for the live
   wiki page case. Added the same `hit_count` multiplication (from the skill's own local API fact),
   which alone cut false MISMATCHes from 87 to 40.
2. A regex bug: the tail-boundary pattern used to find a trailing "in <mode>" clause stopped at the
   first literal `.` character — including the decimal point inside a number like "0.2" when two
   changes were joined by "and" in one sentence ("Reduced the base barrier from 3,973 to 2,245 and
   increased the healing power coefficient from 0.2 to 1.0 in PvE only."). This truncated the tail
   before it ever saw "in PvE only," misclassifying a PvE-only change as WvW-relevant. Caught by
   spot-checking the first run's 2 "STALE, needs re-curation" hits (Effulgent Stance, Resilient
   Weapon) against raw wikitext before reporting them — both were false positives from this bug, not
   real staleness. Fixed by only terminating the tail on a period NOT followed by a digit. Also found
   a related mislabeling bug the same fix surfaced: "healing power coefficient" (a real, distinct
   phrase for Healing-Power-scaling skills) contains "power coefficient" as a literal substring,
   which the damage-table label was matching without an exclusion — added a negative lookbehind.
3. Added cross-corroboration against the existing `skill-coefficient-verification.json` (damage
   table only, since Healing/Barrier have no live-wiki sweep yet): a `stale`/`mismatch` outcome whose
   (id, factText) is already a live-wiki `match` in that file is flagged as a likely false positive —
   the flagged patch's change was probably reverted or superseded by a later patch outside `Category:
   Balance updates` (that category isn't a guaranteed-complete list, just the wiki's own best index
   of major patches). This is what caught Swoop/Reaver's Rage/Meteor/Falcon's Stoop as non-issues
   rather than presenting them as 4 "needs re-curation" items.

**Final verified run** (against all 3 coefficient tables): 636 (skill, table, field) groups
resolved from 1310 parsed change clauses across 59 patches. 274 MATCH, **4 STALE — all 4
corroborated as false positives, 0 genuinely-actionable staleness found** (a good outcome: the
existing curated tables really are current), 29 MISMATCH (mostly live-wiki-corroborated as
"superseded by a later patch," the handful without corroboration are Healing-table entries with no
live sweep to cross-check against — an honest residual, not chased further), 140 not-curated, 95
not-a-skill, 64 ambiguous-multiple-entries (patch note doesn't say which of a skill's several
factText facts it means), 20 ambiguous-multiple-ids, 10 title-not-found. Writes
`data/game-data/balance-patch-verification.json` (audit-trail only, same "not read by the app"
contract as the other 2 verification files — see `docs/game-data.md`'s updated "Wiki-verification
audit trail" section). `npx tsc`/`npx eslint` clean (one pre-existing unrelated `fetch-target-
counts.ts` unused-param warning confirmed present on `main` before this session, not touched).

**Known limitation, unchanged from the original scoping**: prose-only reworks with no "from A to B"
phrasing produce no diffable signal — still needs a periodic human read. **Deliberately not built**:
the "only touch pages flagged as changed" efficiency angle from TODO.md's original step-4 wording —
skipped since the wiki-cache (step 2) already makes a full re-sweep cheap (cache hits after the
first run) on every subsequent run; this script's real value-add is the dated old-vs-new diff
itself, not fetch-count savings. Target-count/Condition-Cleanse's own curated tables use the same
"from A to B" prose shape but aren't wired into this script — same scripting effort would apply,
not done this pass.

TODO.md's "Wiki-sourced data pipeline" section step 4 now marked done — steps 1-4 are all complete.
The section's own top-level checkbox stays unchecked: target-count/Condition-Cleanse's curated
tables were never wired into a balance-patch change-detector (this session's script only covers the
3 coefficient tables), so the section's full "extend to every fact type" scope isn't 100% closed.

## Session 120 — Wire wiki-pipeline output to data/game-data/ (audit-trail)

Picked up the wiki-extraction pipeline where Session 119 left off. Asked the user which of 3
open follow-ups to do next (data-file output for the damage/target-count pilots; step 4
change-detection wiring; curating the 35 empty-facts skills) — user picked data-file output.

That option itself had a real design fork: `CURATED_DAMAGE_COEFFICIENTS`
(`src/shared/skill-calc/damage-calc.ts`) and `TARGET_COUNT_OVERRIDES`
(`src/shared/boon-calc/sources.ts`) are hand-typed TS literals the running app already computes
from directly — unlike `relic-effects.json` and friends, there was no existing "generated JSON
file the app reads" pattern for these two fact types to slot into. Asked the user to choose among
3 shapes: (a) audit-trail only (a verification-status file per fact type, doesn't change app
behavior), (b) persist just the open gaps as a curation backlog, (c) convert the curated tables
themselves into generated JSON with hand-curated judgment calls layered on top. User picked (a),
the lowest-risk option — the curated tables still carry entries the scripts honestly can't
auto-resolve (12 MISSING / 43 SKIP / 11 UNRESOLVED COLLISION for damage coefficients alone), so
promoting wiki-derived data to the app's source of truth wasn't safe yet.

**Built:**
- `scripts/lib/wiki-verification.ts` — shared writer for both scripts. `WikiVerificationEntry`
  (sourceKind, id, name, optional factText, status bucket, curated/wiki values, wiki
  title+revisionId, optional detail) + `WikiVerificationFile` wrapper (sourceTable, script,
  generatedAt, totalEntries, a `summary` computed from the entries, and the entries themselves).
  `writeVerificationFile(filename, meta, entries)` computes the summary and writes to
  `data/game-data/<filename>`.
- `scripts/lib/wiki-cache.ts` gained `getWikiRevisionId(title)` — the on-disk cache (built Session
  114) already stored each page's MediaWiki revision id but never exposed it to callers; this reads
  it from the in-memory cache for a title already fetched via `fetchWikiPage` in the same run,
  without changing that function's existing return type (every caller destructures it as a bare
  string).
- `fetch-skill-coefficients.ts` and `fetch-target-counts.ts` both now push one
  `WikiVerificationEntry` at every decision point they already had (match, known-gap, mismatch,
  missing, skip, not-found, unresolved-collision, plus the requiresTrait/off-by-one/ambiguous/self
  variants each script has of its own) and call `writeVerificationFile` once at the end of `main()`,
  right after `flushWikiCache()`. No change to either script's actual comparison logic — this is a
  pure output-wiring addition, verified by re-running both against a fresh-ish cache and confirming
  the console numbers are byte-identical to the last-recorded run: damage coefficients (MATCH
  984/1052, MISMATCH 0, MISSING 12, SKIP 43, UNRESOLVED COLLISION 11) and target counts (MATCH 114,
  OFF-BY-ONE 1, MISSING 255, UNRESOLVED COLLISION 9).
- One granularity wrinkle, not a bug: the damage-coefficient script's console counters are
  per-skill (one `unresolvedCollisions.push` per candidate id), but `WikiVerificationEntry` is
  per-curated-value (one record per factText) — so a skill with 2 factText entries that hits
  unresolved-collision contributes 2 records, not 1. Confirmed the JSON's own `summary` still
  reconciles exactly against `totalEntries` (1052 and 379 respectively), just at finer grain than
  the console log. `target-count-verification.json` doesn't have this wrinkle — one curated value
  per candidate there, so console and JSON counts match 1:1.
- `docs/game-data.md`: added the 2 new filenames to "Output files" flagged as **not** app-runtime
  data (every other file in that list is), plus a new "Wiki-verification audit trail" section
  explaining why they exist, what writes them, and that the hand-curated tables remain the sole
  source of truth — these files change zero app behavior.

`npx tsc`/`npx eslint` clean. Not wired into any change-detection mechanism yet (that's TODO.md's
still-separate step 4) — this only makes the diff persist across sessions instead of scrolling off
a terminal.

## Session 119 — Wire CONDITION_CLEANSE_TARGETS into the UI

TODO.md's Condition Cleanse item's last remaining piece: `CONDITION_CLEANSE_TARGETS` (built Session
117) was data-only until now — nothing read it. Wired end to end:
- `BOON_STRIP_CORRUPT_MATCHERS` (`src/shared/boon-calc/sources.ts`) gained a third matcher,
  `Cleanse` (`type: 'Number'` facts matching `/condition.*remov|remov.*condition/i`, the same regex
  `scripts/fetch-condition-cleanse.ts` used to build its candidate list).
- `NamedFactSource` gained a `targetCount: number | null` field, mirroring
  `BoonConditionSource.targetCount`. `resolveTargetCount` was split into a generic
  `resolveTargetCountFrom(facts, sourceKind, sourceId, overrides)` (parametrized over which curated
  override table to fall back to) plus a thin `TARGET_COUNT_OVERRIDES`-bound wrapper kept for every
  existing boon/condition caller. `namedFactsFrom`/`computeNamedFactSources` both gained an optional
  `targetCountTables` param (`Record<matcherName, overrideTable>`) — only matcher names present in
  that map get a resolved `targetCount`; every other name (Control, Miscellaneous, Strip, Corrupt)
  stays `null`, since only Cleanse was ever scoped to need this. A new exported constant,
  `NAMED_FACT_TARGET_COUNT_TABLES = { Cleanse: CONDITION_CLEANSE_TARGETS }`, is what callers pass.
- Icon: no new icon needed — confirmed via a live scan of `skills.json` that `Conditions Removed`
  facts (e.g. Healing Seed) carry the exact same generic `Number`-fact icon (156661) Strip/Corrupt
  already reuses, so `BOON_STRIP_CORRUPT_ICONS` just gained a `Cleanse` entry pointing at the same
  URL.
- UI: the Strip/Corrupt row is relabeled "Strips / Corrupts / Cleanses" everywhere it's rendered —
  the build editor's `BoonConditionSummaryPanel`, the squad editor's per-slot `SlotTile` summary, and
  the party-wide `PartyRow` summary (which also needed `PartyNamedFactContribution` in
  `party-summary.ts` to gain the same `targetCount` field and `computePartyNamedFactSummary` to gain
  the same `targetCountTables` passthrough, since the squad views run their own separate aggregation
  path from the single-build editor). All three now render the boon row's existing "Up to N" badge
  (`formatTargetCount`) next to the source name whenever `targetCount !== null`, i.e. only for
  `Cleanse` entries with a curated party-count, exactly like it already worked for boons.
  `'self'`-classified entries in `CONDITION_CLEANSE_TARGETS` correctly produce no badge (same
  convention `TARGET_COUNT_OVERRIDES` already established: self is the unmarked default, only an
  explicit party reach gets a number).
Verified via `npm run typecheck`/`npm run lint`, both clean (one pre-existing, unrelated
`scripts/fetch-target-counts.ts` typecheck error confirmed via `git stash` to predate this session).
Not verified visually in the running app (Electron sandbox limitation, same standing caveat as every
other UI change this project has made).

## Session 118 — Migrate remaining fetch-*.ts scripts to the shared wiki-cache

TODO.md's "Wiki-sourced data pipeline" step 2 remainder: `scripts/lib/wiki-cache.ts` (built Session
114, wired into `fetch-skill-coefficients.ts` only) is now wired into every other script that
defined its own inline `fetchRawWikitext` — `fetch-wvw-splits.ts`, `fetch-relic-effects.ts`,
`fetch-glyph-forms.ts`, `fetch-tome-chapters.ts`, `fetch-skill-duplicate-resolutions.ts`, and
`fetch-soulbeast-beastmode.ts`. Each script's own local `fetchRawWikitext`/`WIKI_INDEX`/manual
per-page `sleep(REQUEST_DELAY_MS)` was removed in favor of `fetchWikiPage`/`flushWikiCache`; each
script's *other* wiki API calls unrelated to raw-wikitext fetching (category-member listings in
`fetch-wvw-splits.ts`, MediaWiki search in `fetch-soulbeast-beastmode.ts`) were left as-is, since
those aren't page-content fetches the cache covers. `fetchWikiPage` returns `string | null` for a
missing page rather than throwing (unlike the old `fetchRawWikitext`, which threw on any non-ok
response including 404) — every call site was updated to branch on `=== null` as an explicit
"page not found" skip/log line instead of relying on a catch block for that case.
`fetch-elite-spec-skills.ts` and `fetch-gear-upgrades.ts` were named in TODO.md's original scoping
as still needing this migration too, but turned out not to: the former only ever calls the
`categorymembers` generator query (no raw wikitext fetch at all), and the latter is pure GW2-API
data with no wiki calls whatsoever — both left untouched.

Verified every migrated script's behavior is unchanged, not just that it typechecks/lints clean:
ran each one against the shared on-disk cache (a mix of warm-from-prior-sessions and cold-for-these-
scripts) and diffed its regenerated output file against the git-committed version.
`fetch-glyph-forms.ts`, `fetch-tome-chapters.ts`, and `fetch-soulbeast-beastmode.ts` reproduced
byte-identical output. The other three surfaced real diffs, each individually root-caused as
pre-existing staleness rather than a migration regression:
- `fetch-wvw-splits.ts`: lost skill 5862 (Elixir U)'s `"Vigor": 6` override. Live wiki content
  drift, not a bug — Elixir U's page now documents `wvw=4` for its Quickness/Stability/Vigor lines
  (a real balance change since this table was last generated), and `resolveOverride`'s existing
  API-duration cross-check correctly refuses to trust a wiki value (4) absent from the locally-
  cached API's own durations (still `[6, 7]`, since `data/game-data/skills.json` hasn't been
  refreshed via `fetch-game-data` to see the same change) — this is exactly the staleness-detection
  behavior the wiki pipeline is meant to have, not a regression. Left unresolved (needs a
  `fetch-game-data` refresh first, out of scope for a migration pass).
- `fetch-relic-effects.ts` (204 -> 122 ids) and `fetch-skill-duplicate-resolutions.ts` (63 -> 9
  excluded ids): both confirmed unrelated to the migration by checking out each script's exact
  pre-migration version from git and running it standalone (unmodified except for an output-
  filename change to avoid clobbering) — both reproduced the new, smaller counts identically,
  proving the shrink was already latent in the current input data, just never re-generated since.
  `relics.json` has held only 122 entries since a much older commit (6db4ef7) — the committed
  204-id `relic-effects.json` predates that shrink and was never regenerated after. Similarly,
  `skill-variants.ts`'s own in-code dedup signals (attunement/specialization/flip-root/ground-
  target/glyph-form/turret-sub-ability) have grown since `skill-variant-exclusions.json` was last
  generated and now already resolve most of the groups that file used to need a wiki-curated
  exclusion for — neither script had been re-run in a while, independent of this session's work.

## Session 117 — CONDITION_CLEANSE_TARGETS curated table

Built `CONDITION_CLEANSE_TARGETS` (`src/shared/boon-calc/sources.ts`), turning Session
117-precursor's `fetch-condition-cleanse.ts` first-draft classifier output into an actual curated
table — same shape as `TARGET_COUNT_OVERRIDES` (`skill`/`trait` split, `TargetCountOverride` =
`number | 'self'`), reusing that table's default-5-nearby-allies convention rather than inventing a
new one. Data-only for now: `NamedFactSource` (the Strip/Corrupt row's own shape) has no
`targetCount` field the way `BoonConditionSource` does, so nothing reads this table yet — wiring it
in (and relabeling the row "Strips / Corrupts / Cleanses" per TODO.md's original scoping) is a
separate follow-up.

Re-ran the classifier fresh (235 candidates: 193 skill, 42 trait) rather than trusting the prior
session's console output verbatim, then did a full manual review pass rather than a straight
copy — several real corrections came out of it:
- **A classifier bug caught by hand**: `classifyDescription` treats "nearby" alone as ally-evidence,
  which misreads "cure conditions and damage nearby **foes**" (zero ally wording) as PARTY. Found by
  re-reading every one of the script's own 53 PARTY-NO-COUNT entries against real skill knowledge —
  5 were actually self-only (Smite Condition, The Prestige, Flames of War, Cleansing Typhoon,
  Hungering Darkness) and flipped.
- **`requires_trait`-gated facts resolved from local `skills.json` grouping, not wiki lookups**: the
  script's own TRAIT-GATED bucket (75 raw skill ids) correctly flags the base skill's own wiki
  description as untrustworthy for these (a Warrior burst skill's page says nothing about
  conditions) but was going to need ~11 separate granting-trait wiki lookups to resolve. Grouping
  candidates by their own `requires_trait` value in local data instead resolved this to only 8 real
  traits (Cleansing Ire alone gates 66 ids — every burst skill across every Warrior weapon, all
  tiers/splits) AND incidentally resolved 27 of the script's 30 UNRESOLVED COLLISION entries for
  free (18 more Cleansing-Ire split ids, 3 Restorative-Illusions-gated Mesmer shatter-skill split
  ids, 4 same-name sibling ids of an already-classified base skill) — no wiki fetch needed for any of
  them.
- **Reused this file's own existing precedent** rather than re-deriving: Transfusion's established
  "one ally per mark trigger" mechanic (`TARGET_COUNT_OVERRIDES`'s own Chillblains/Reaper's
  Mark/Lesser Chilblains comments) applies identically to Putrid Mark's cleanse (`targetCount: 1`,
  not the usual default 5); Hardening Persistence and Core Value's cleanse verdicts were corroborated
  against those same traits' already-curated boon-reach entries in `TARGET_COUNT_OVERRIDES` rather
  than guessed fresh.
- **3 targeted wiki lookups** (Blurred Inscriptions, Transfusion, Meticulous Custodian — the traits
  local data alone couldn't settle) resolved 2 of 3 cleanly (self, party respectively); the third
  (Meticulous Custodian, gating Zephyrite Sun Crystal) turned up a genuine two-different-mechanics
  ambiguity on the skill's own page and was left uncurated.

Final: **211 curated** (178 skill + 33 trait) + **24 documented exclusions** (15 skill + 9 trait,
same "skip+log rather than guess" rule as every other sweep — mixed self/party-on-one-source shapes
like Virtue of Resolve/Wings of Resolve/Diamond Skin, "rides on a different effect's own reach"
traits like Cleansing Water/Anticorrosion Plating, and a few genuinely ambiguous descriptions) =
**235/235 candidates accounted for**, verified by script (zero missing, zero duplicate keys).
Full reasoning and the exception list are in the table's own doc comment in `sources.ts` — not
duplicated here. `npx tsc --noEmit` and `npx eslint` both clean on the file.

## Session 116 — Wiki-extraction pipeline step 3: target-count self-vs-party leg

Built `scripts/fetch-target-counts.ts` (`npm run fetch-target-counts`), closing the other half of
step 3 that Session 115 left open — validates the 2026-08-06/07 conversational sweep that produced
`TARGET_COUNT_OVERRIDES` (`src/shared/boon-calc/sources.ts`, now exported for this script, same as
`damage-calc.ts`'s `CURATED_DAMAGE_COEFFICIENTS`) against live wiki wikitext, same pilot/diff shape
as `fetch-skill-coefficients.ts`'s damage pilot. Console-report only, no data file touched.

Wiki shape confirmed live: the enemy-facing count uses `{{skill fact|targets|N}}` (never trusted,
ambiguous on skills that hit both foes and allies); the ally-facing count uses either a dedicated
`{{skill fact|allied targets|N}}` template or the generic `targets` template with an `alt=` naming
it explicitly. Trait pages add a third shape found live on Phalanx Strength (trait 1711, the one
curated entry with an explicit wiki count): the infobox's own `| missing facts = {{skill
fact|targets|N}}` field, used by the wiki to flag values the API omits — trusted as an ally count
for TRAIT candidates only, after live-testing the same trust on skill candidates produced 2 false
positives (Lightning Flash's `targets|1` is consistent with self-only, not evidence against it;
"Guard!"'s `targets|5` sits next to an unrelated `effect` template) and was narrowed accordingly.

Candidate-page resolution reused `fetch-skill-coefficients.ts`'s two exact tiers (direct title +
`| id = N` self-verification, then MediaWiki search-API fallback) plus its sibling-attribution
third tier, needed here too: the two-tier version left 44/379 candidates as an unresolved
collision, and several were the exact same multi-id-page shape that tier exists for (`Deploy Jade
Sphere`'s 20 element/tier variants sharing one page; Herald/Conduit's `Call to Anguish` pair) —
`curatedValuesEqual` mirrors `curatedEntriesEqual`, keyed on `TARGET_COUNT_OVERRIDES`'s simpler
`number | 'self'` value. Sibling tier resolved 35 of the 44, leaving 9 genuinely unresolved (same
order of magnitude as the damage pilot's own 11-entry residual).

Final run (379 candidates — 326 skill, 53 trait): **MATCH 4 (numeric) + 110 (self-only, no ally
fact) = 114, MISMATCH 0, AMBIGUOUS 0, OFF-BY-ONE 1** (Phalanx Strength itself — wiki's own "4 other
targets" convention the curated table's comment already documents), **MISSING 255** (no wiki
evidence either way — the sweep's documented default-5/self assumption, unverifiable but not
contradicted), UNRESOLVED COLLISION 9. Zero real mismatches and zero real self-vs-party
contradictions across the whole table — the 2026-08-06/07 sweep is corroborated everywhere the wiki
has evidence to check it against. Condition Cleanse (step 3's originally-paired item, no curated
table built yet) is still unstarted — this script only covers target-count.

## Session 115 — Wiki-extraction pipeline step 3: empty-API-facts red-flag scan

Built `scripts/scan-empty-effect-facts.ts` (`npm run scan-empty-effect-facts`), the "does this page
even carry the template we need" half of TODO.md step 3, sizing the "some skills' real effects live
entirely outside the API's `facts` array" bug (Otherworldly Bond, flagged 2026-08-07). Two passes,
console-report only (no data file written): pass 1 is a local, no-network heuristic over
`skills.json` — a skill is a candidate if it's actually player-equippable (`professions.length > 0`,
excluding ~2200 monster/NPC/environment skills the raw API also returns) AND reachable in a build
this app can construct, its `facts`/`traitedFacts` carry nothing beyond the purely positional/timing
types (`Range`/`Recharge`/`Distance`/`Radius`), and its description is substantive (>=60 chars after
stripping wiki markup). Pass 2 resolves each candidate's wiki page (a simplified 2-tier version of
`fetch-skill-coefficients.ts`'s `resolveSkillPage` — direct title + MediaWiki-search fallback, each
self-verified against the page's own `| id = N` field; no sibling-attribution tier needed for a
report script) and checks whether its `{{skill fact|LABEL|...}}` templates include any LABEL beyond
that same meta set.

Pass 1 alone found 73 candidates, but spot-checking showed it's dominated by a real, well-understood
non-bug pattern (kit-equip/legend-stance/shroud-toggle skills with a genuine, sometimes-long
description but no further numeric effect — their sub-skills carry the facts, not the toggle).
Rather than hand-pattern-matching description text to filter these out, pass 2 does it automatically
and more reliably: those toggle skills' wiki pages *also* carry nothing beyond Range/Recharge — the
wiki agreeing with the API is strong evidence there's genuinely nothing more to model, a much better
signal than description length alone.

**Bug caught by the user, fixed same session**: the first version's "player-equippable" check was
only `professions.length > 0`, which let 2 genuinely unreachable `slot: "Downed_*"` ids (Bandage,
Voracious Dive) into the "actionable" bucket — the user correctly flagged that this app has no
downed-skill concept at all (already an established rule elsewhere, see `sources.ts`'s own note on
the same question for the target-count sweep) and asked whether the write-up's "Vindicator
downed-state skills" claim was even right. It wasn't, on two counts: the skills in question are
Necromancer (Harbinger/Ritualist), not Revenant/Vindicator, and 3 of the 5 flagged ids turned out to
be real, *reachable* Shroud weapon-bar skills (Necromancer's 4 Shroud variants reuse the Downed-bar's
own slot labels for real skills — an already-documented quirk, `bundle-skills.ts`'s own doc comment)
that only look downed-only from the raw `slot` field alone. Fixed by exporting
`bundle-skills.ts`'s `SHROUD_SLOT_SKILLS` and excluding any `Downed_*`-slotted candidate not in it.
Net effect: only the 2 truly-unreachable ids dropped (73 -> 71 candidates); the 3 real Shroud skills
(Voracious Arc, Devouring Cut, Anguish) correctly stayed in as genuine findings. Separately, spot-
checking the "notable clusters" writeup with `specializations.json` (rather than guessing from skill
names) also caught several wrong elite-spec/weapon attributions in the same draft (Deadeye ->
Harbinger, "9 Catalyst Hammer" -> 11 Weaver Pistol/Spear, Willbender -> Luminary) — all corrected in
TODO.md.

Final run: **41 ids / 35 unique skill names DO have a non-meta wiki template the local API data
omits** (the actionable, Otherworldly-Bond-shaped findings — confirmed live for id 71952 itself: 15+
enemy-target/ally-target/vulnerability/crippled/slow/might/fury/duration/interval lines fully
describing the tether mechanic), 26 confirmed non-issues (the toggle pattern above, plus "X:
Backfired" cooldown-placeholder skills), 4 unresolved (no wiki page found/verified). Full, verified
findings (every attribution checked against `skills.json`/`specializations.json`, not assumed from
naming) recorded in TODO.md's "empty-API-facts" bug entry.

Deliberately not done in this pass: no actual `Fact` data was generated or curated for any of the 35
— this script only locates and sizes the gap. Modeling any of them needs per-skill `Fact`-shape
design (dual ally/enemy-target branches, elixir stacking tiers, etc.), scoped as its own follow-up
item in TODO.md, not started. The target-count/Condition-Cleanse self-vs-party half of step 3 is
also still unstarted — this session only closed the empty-API-facts half.

## Session 114 — Wiki-extraction pipeline: shared raw-wikitext cache (TODO.md step 2)

Built `scripts/lib/wiki-cache.ts`: a shared on-disk cache (`.cache/wiki-pages.json`, already
gitignored alongside `fetch-gear-upgrades.ts`'s item dump) that every `fetch-*.ts` wiki-extraction
script can call instead of hand-rolling its own `fetchRawWikitext`. Keyed by exact title +
MediaWiki's own revision id, both fetched in one `action=query&prop=revisions&rvprop=ids|content`
call rather than the old `action=raw`-only shape (which has no way to ask for a revision id in the
same request). `fetchWikiPage(title)` returns cached wikitext immediately on a hit (no network
call, no rate-limit sleep); a real fetch pays the existing 150ms delay, now centralized in the
library rather than duplicated at every call site. `flushWikiCache()` batches all writes from one
run into a single disk write, called once at the end of `main()`.

Wired into `fetch-skill-coefficients.ts` — removed its local `fetchRawWikitext`/`sleep`/
`REQUEST_DELAY_MS`, both call sites in `resolveSkillPage` swapped to `fetchWikiPage`. Validated by
deleting the cache and re-running from scratch: exact same numbers as the last recorded run
(Session 113) — MATCH 950 (wiki) + 30 (requiresTrait) + 4 (known wiki gap) = 984/1052, MISMATCH 0,
MISSING 12, SKIP 43, UNRESOLVED COLLISION 11 — across 1148 real page fetches in 5m41s. Re-ran
immediately after with the now-populated cache: identical numbers again, in 33s (all cache hits,
zero network calls). Confirms both correctness (the API-based `prop=revisions` fetch path returns
the same content the old `action=raw` path did) and the caching payoff the step was built for.

Not done in this pass: the other fetch-*.ts scripts (`fetch-wvw-splits.ts`,
`fetch-relic-effects.ts`, `fetch-glyph-forms.ts`, `fetch-elite-spec-skills.ts`,
`fetch-tome-chapters.ts`, `fetch-soulbeast-beastmode.ts`, `fetch-skill-duplicate-resolutions.ts`)
still each carry their own inline `fetchRawWikitext` — migrating them to the shared cache is
straightforward (same swap this script just got) but unstarted, left for whenever those scripts
are next touched rather than a blanket refactor pass. The stored `revisionId` also isn't consulted
by anything yet — TODO.md step 4 (wiring to Game_updates-page change detection) is what will
actually use it to decide "this page changed, refetch" vs. "unchanged, trust the cache."

## Session 113 — Wiki-extraction pipeline: shrunk MISSING/SKIP/UNRESOLVED, caught a self-introduced bug

User asked what to do about the pilot's remaining MISSING (15) / SKIP (44) / UNRESOLVED COLLISION
(22) buckets. Investigated all 3 rather than assuming they're irreducible; found 3 more general,
safe fixes:

- **Comma-separated `id=` list parsing** (`parseInfoboxSkillIds`, same shape `fetch-relic-effects.ts`
  already uses for relics): several skill pages document a comma-separated id LIST (e.g. "Jade
  Winds" -> `28406,31294`), which the previous single-number regex only ever captured the first
  value of. Alone, this resolved 11 of the 22 unresolved collisions directly.
- **Case/whitespace-normalized factText matching**: the wiki's own `alt=` text and the curated
  table's factText occasionally differ only by casing (e.g. wiki "Final strike damage" vs. curated
  "Final Strike Damage," found on Hundred Blades/14554) — normalizing both sides before the lookup
  fixed 3 of the 15 MISSING entries.
- **Sibling-id attribution** (last-resort tier in `resolveSkillPage`, only after every exact-id check
  — direct title AND every search candidate — has failed): some wiki pages' own id= field lists only
  ONE of two ids the curated table deliberately gives identical values to (e.g. Grenade Kit's land id
  5882 vs. underwater sibling 6171, whose shared page only lists 5882). First attempt compared the
  *local API's* `dmg_multiplier` for equivalence — **caught its own live false positive** before
  landing: Static Field (5732, Lightning Hammer) got wrongly attributed to the unrelated core-Staff
  Static Field's page, and Radiant Arc (69565) to its Holosmith-gated sibling's page — both share one
  PvE dmg_multiplier (a value that's PvE-only per `DamageCoefficient`'s own doc comment) while
  differing in WvW, the exact case damage-calc.ts's own Radiant Arc comment already warns about
  ("note the shared identical PvE side"). Also caught a tier-ordering bug: consulting the sibling
  signal inside the *first* title-fetch loop let a coincidental match short-circuit before the search
  fallback ever ran, stealing a resolution that was otherwise findable exactly (Burning Retreat
  5717 briefly regressed this way). Fixed by (a) requiring sibling equivalence via
  `CURATED_DAMAGE_COEFFICIENTS`'s own already-human-verified equality instead of the API, and (b)
  strictly deferring the sibling tier until after both exact-id tiers are exhausted. Net: 9 of the
  22 originally-unresolved collisions cleared (comma-list + sibling combined), including the newly
  legitimate case this surfaced — 78798 "Call to Anguish" (Conduit's rework, same known wiki gap as
  its sibling 31100) — added to `KNOWN_WIKI_GAPS` alongside it.

Final re-run: MATCH 950 (wiki) + 30 (requiresTrait) + 4 (known wiki gap) = 984/1052, MISMATCH 0,
MISSING 12 (was 15), SKIP 43 (23 ambiguous wiki + 20 requiresTrait, was 44), UNRESOLVED COLLISION 11
(was 22). The residual in all 3 buckets was individually spot-checked and characterized as
genuinely-irreducible without either (a) parsing free-text wiki prose generally (risky to
generalize) or (b) a fundamentally different signal than "one skill's own wiki page" — e.g. the
"Slash" collision (12474/13088) shares its bare wiki title with 36 other same-named skills across
every profession, and `Effulgent Stance`'s Min/Max Damage split exists only in the local API's own
fact labels, never in wiki text at all. Recommended leaving these as the documented judgment tail
rather than chasing further — diminishing returns, and TODO.md's own "shrinking, not eliminating,
the agent-judgment tail" framing already anticipated a residual like this.

## Session 112 — Wiki-extraction pipeline: closed the last 3 MISMATCH entries

Follow-up to Session 111, investigating the 3 remaining MISMATCH entries it deliberately left
unchased (Elemental Blast 27162, Call to Anguish 31100, Refraction Cutter 44110). User offered to
help; resolved all 3 without needing that, via cross-referencing the app's own existing
architecture docs against live wiki data — no domain-knowledge gap remained once traced. **All 3
curated values were already correct** — every one is the same shape: the specific wiki page
`fetch-skill-coefficients.ts` fetches for that id under-documents a split/multiplier that a related
source documents completely, which the original curator had already correctly cross-referenced by
hand:

- **Elemental Blast (27162)**: no `strikes=` param on the Damage fact line, and the local API's own
  `hit_count` is (incorrectly) 1 — but the wiki page's own free-text Notes section states outright
  "This skill hits three times, for a total 4.5 coefficient in PvE and 2.67 in WvW and PvP," exactly
  matching the curated value. Prose, not a template field — confirmed by direct fetch rather than
  parsed generally.
- **Call to Anguish (31100)**: this id's own wiki page ("Call to Anguish (underwater)") documents
  only a single un-split value (1.2). Initially looked like a genuinely deeper issue — is 31100
  really an underwater variant, contradicting the curated comment's "auto-target land variant"
  framing? Cross-checked against `skill-variants.ts`'s own documented "signal 4" (the
  `GroundTargeted` ground-target-vs-auto-target client toggle collapses to one canonical id,
  confirmed same flag pattern as the already-verified Grenade Kit land/underwater pair) — the app's
  own architecture already treats this id as functionally identical to its GroundTargeted sibling
  (27917), whose own separate wiki page has the complete split (1.2/0.01) the curated value
  correctly uses.
- **Refraction Cutter (44110)**: this id's own Holosmith-specific wiki page documents only a single
  un-split "Projectile Damage" value (0.4) — version history shows a 2022-11-29 PvE-only buff
  apparently never re-split into 2 mode-tagged lines on this specific page. Sibling non-holosmith id
  71121's separate page has the full split (0.4/0.275), corroborated by the local API's own traited
  `dmg_multiplier` — already correctly cross-referenced by the original curator.

Added a 3-entry `KNOWN_WIKI_GAPS` table to `fetch-skill-coefficients.ts` (same "small hand-verified
exception list" shape used elsewhere in this codebase, e.g. `skill-variants.ts`'s several constant
tables) so these don't re-surface as false MISMATCHes on future re-runs — each entry documents its
corroborating source inline rather than silently overriding. Re-ran the full 1052-entry diff:
**MISMATCH is now 0** (wiki and requiresTrait both), MATCH 935 (wiki) + 30 (requiresTrait) + 3
(known wiki gap) = 968. Remaining open buckets unchanged from Session 111: 15 MISSING, 44 SKIP (23
ambiguous wiki + 21 requiresTrait unvalidatable-shape), 22 unresolved collisions — none investigated
this session, still console-only.

## Session 111 — Wiki-extraction pipeline: name-collision + requiresTrait handling

Follow-up to Session 110's pilot, picking option (a) of the 3 choices flagged in
[[wiki_pipeline_pilot_next]]: made `fetch-skill-coefficients.ts` production-ready for the two known
gap shapes rather than extending to a new fact type or building the shared cache first.

**Name-collision resolution**: every fetched wiki page is now cross-checked against its own
`{{Skill infobox}}`'s `| id = N` field instead of trusted by title match alone. A mismatch (or an
explicit `{{disambig}}` list page, e.g. "Maul") triggers a MediaWiki search-API fallback that tries
each candidate title in turn until one's own `id=` actually matches the target skill — no fixed
suffix pattern assumed (live examples found: "(thief harpoon gun skill)", "(ranger greatsword
skill)", "(non-holosmith)", "(underwater)", ...). Chosen over a hand-maintained exception list
(`fetch-relic-effects.ts`'s approach) because there's no single fixed disambiguation suffix for
skills the way relics have "(relic)". Self-verifying, so it degrades safely: an honest
`unresolved-collision` skip when no candidate's `id=` matches, never a silent wrong-page parse.

**`requiresTrait` disambiguation**: a curated skill can carry two entries sharing one `factText` (an
ungated base value and a trait-boosted override), which the wiki's skill page never restates as a
second fact line — the bonus lives on the *trait's* page. These are now validated as `sibling base
coefficient × (1 + trait's own Damage-Increase%)`, reading the percent straight from the trait's own
`facts` data (matches the curated table's own documented convention, e.g. id 13084's comment
"0.383*1.10=0.4213") wherever that shape is unambiguous — confirmed clean for Deadly Aim (1299, +10%)
and Empowered Illusions (682, +15%). Other `requiresTrait` ids found live (Infinite Forge/2206 has
two competing Damage-Increase facts; Crack Shot/1329 and Forceful Greatsword/1338 have none, a
different Might/attribute-proc shape instead) don't fit this one pattern — rather than guess, those
are a separately-bucketed, clearly-labeled skip.

Re-ran the full 1052-entry diff after both fixes: MATCH 935 (wiki) + 30 (requiresTrait) = 965,
MISMATCH 3 (wiki) + 0 (requiresTrait), MISSING 15, SKIP 23 (ambiguous wiki) + 21 (requiresTrait,
unvalidatable shape), UNRESOLVED COLLISION 22 skills (down from the prior run's blended 63
MISMATCH/54 MISSING, which conflated real gaps with the two shapes just fixed — 50 skills'
pages were resolved via the search-API fallback along the way, confirming the mechanism carries real
weight, not just edge cases). The remaining 3 MISMATCH entries (Elemental Blast 27162, Call to
Anguish 31100, Refraction Cutter 44110) are flagged but not yet investigated — genuinely small enough
now for a human read, deliberately left for a future session rather than chased immediately
(pacing — see [[pacing_large_sweeps]]). Still doesn't write to `data/game-data/`; still prints a
console report only, per TODO.md's own step numbering (this was step "2a", not step 2/3/4).

## Session 110 — Wiki-extraction pipeline pilot: fetch-skill-coefficients.ts

Built and validated the pilot script scoped in TODO.md's "Wiki-sourced data pipeline" section,
step 1 — the concrete next step [[wiki_pipeline_pilot_next]] flagged for this session, ahead of
starting any new conversational curation sweep the old (token-heavy) way.

`scripts/fetch-skill-coefficients.ts` (`npm run fetch-skill-coefficients`), built on the
`fetch-wvw-splits.ts` skeleton: fetches each candidate skill's raw wikitext, regex-parses every
`{{skill fact|damage|...}}` invocation (`coefficient=`, `alt=` for factText, `strikes=`,
`game mode=`), resolves the WvW-tagged value using the same game-mode-bucketing logic
`fetch-wvw-splits.ts` already uses for boon/condition splits (fail-safe skip+log on anything
ambiguous), totals it correctly (a `strikes=N` param means the coefficient is already totaled;
without one, a `hit_count > 1` fact is a pulsing effect and the wiki value is per-hit, multiplied
by the API's own `hit_count` before comparing — mirrors `damage-calc.ts`'s own documented
convention exactly). Parser was smoke-tested standalone against 3 known pages (Whirling Axe,
Perfect Storm, Rifle Burst) before committing to a full run.

Candidate set was deliberately every id already in `CURATED_DAMAGE_COEFFICIENTS` (888 skills, 1052
entries), not new ground — the point of a pilot is diffing against work already paid for and
independently verified, not extending coverage yet. Full run: 912 MATCH / 63 MISMATCH / 54 MISSING
/ 23 SKIP / 0 NOT FOUND. Spot-checked a sample of the non-matches and confirmed 3 explainable
shapes rather than parser bugs — see TODO.md's own updated entry for the specific examples
(genuine wiki drift since the sweep curated it, the curated table's own `requiresTrait`
duplicate-factText rows this pilot doesn't yet disambiguate, and wiki name-collision/disambiguation
pages the same shape as relics' existing exception list). Approach validated: a scripted
`coefficient=` extraction really does reproduce the hand-curated sweep's work on the cases that
have no special shape, and the pilot's own diff output is what surfaced the exceptions rather than
silently trusting a wrong parse.

Deliberately stopped here per [[pacing_large_sweeps]] rather than chaining into the remaining 3
steps (persisting a shared wikitext cache, building the name-collision/requiresTrait exception
handling, extending to Healing/Barrier/target-count/Condition-Cleanse) — this pilot only prints a
console report, it writes nothing to `data/game-data/` and isn't wired into the app yet.

## Session 109 — Weapon autoattack-chain boon/condition gap (Revenant Scepter report)

User-reported live gap: Revenant Scepter's boon/condition applications weren't showing anywhere in
the app. Traced to the actual root cause rather than patching the symptom: the GW2 API only lists
each weapon slot's *chain-starting* skill id in `/v2/professions` (e.g. Scepter Weapon_1 is "Serene
Slash," 71933) — the chain's later hits, where a boon/condition fact often actually lives (Scepter's
own 2nd hit "Acerbic Cut," 71930, carries the Might; 3rd hit "Motivating Whirl" carries a Barrier),
are only reachable via `Skill.flipSkill`, which the raw API confirmed dual-purposes for both a
channel's release effect AND an autoattack chain's next hit (`next_chain` and `flip_skill` carry the
identical value on every sampled chain skill, e.g. Warrior Greatsword's "Greatsword Swing" 14356 →
`next_chain: 14373` / `flip_skill: 14373`).

`sources.ts` already had a `withFlipChain` walker (used for Revenant's heal/utility/elite/swap ids)
but never applied it to weapon-derived skill ids at all — `weaponSkillIdsForBuild` just used
`weaponSkillIdsForPair`'s raw per-slot id directly. A full scan found 126 weapon-slot
chain-continuation skills across every profession carry a `Buff` fact their chain's starting skill
doesn't — this was never Revenant- or Scepter-specific, just first noticed there. Fixed by walking
`withFlipChain` on every id `weaponSkillIdsForBuild` resolves. Verified via a standalone repro
script (real game data, a bare Revenant/Scepter build, `computeBoonConditionSources`) that Acerbic
Cut's Might now surfaces; typecheck/lint clean.

Also confirmed (not a bug): Guardian Staff's Symbol of Swiftness — the skill's own flavor
*description* text doesn't mention granting Superspeed, but the underlying Fact data does, and this
app's Misc./boon-bar rendering already reads from Facts, not description text, so it was already
showing correctly. No action needed; noted here only so a future session doesn't re-investigate.

Separately flagged, NOT fixed this session (logged in TODO.md pending a scoping decision — too big
to fold into this fix): a second, distinct, likely-larger gap in the same "Revenant boon tooltip"
report. Revenant/Salvation's Serene Rejuvenation (minor trait) adds boons to Legendary Centaur's own
skills via a `type: "PrefixedBuff"` fact shape `extractFromFacts` has never modeled at all (only
`type: "Buff"` is recognized) — a full scan found 263 trait facts + 117 skill facts of this shape
project-wide, all currently invisible.

## Session 108 — Gear Optimizer bug hunt: found and fixed a real food/utility conversion bug

First real diagnosis pass on the "Gear Optimizer doesn't function properly" bug (flagged
2026-08-05, no failure mode captured at the time). Live UI reproduction isn't possible here
(Electron sandbox limitation), so built a standalone Node repro script instead: loaded the real
`data/game-data/*.json` files directly (same shape `loadGameData` produces, without Electron),
constructed a realistic `Build`, and called `optimizeGear` with a range of scenarios (floor-only,
maximize-only, multi-tier lexicographic, infeasible floors, food/utility fixed vs. searched).

Found one genuine, reproducible bug: `optimizeGear`'s final re-derivation step (which its own doc
comment claims re-derives totals "via the same canonical function `StatsPanel` uses") actually
reimplements `computeCharacterStats`'s accumulation by hand, and silently omitted its
`applyConversions(activeConsumableConversions(...))` step — the "Gain X Equal to N% of Your Y"
food/utility conversion mechanic (Superior Sharpening Stone, Tuning Crystals, etc.). Confirmed via
a direct A/B: ran `optimizeGear` on a Guardian with Superior Sharpening Stone equipped as a fixed
utility, then fed the exact same `result.build` into `computeCharacterStats` — the optimizer
reported Power 2384.05 while the Stats panel's own function computed 2485.62 for the identical
build, a ~100-point silent understatement. 69 WvW utility items alone carry this conversion shape,
so this wasn't an edge case.

Fixed by adding the missing `activeConsumableConversions`/`applyConversions` call to the final
re-derivation block, matching `computeCharacterStats`'s own ordering (conversions before trait
bonuses). Re-ran the repro script post-fix: optimizer-reported and `computeCharacterStats`-derived
Power now match exactly for the same test case, and every other scenario (floors, multi-tier
targets, infeasibility, Armor-only maximize) still produces sane, self-consistent results.
Deliberately did NOT extend the fix to the pre-search baseline or the search's own delta scoring —
that already has a documented, intentional limitation for trait conversions (a conversion's source
attribute can itself be a searched metric, so a pre-search value would understate it); the doc
comment was updated to note food/utility conversions share the same limitation, consistent with how
trait conversions were already handled.

Left the TODO.md bug open rather than closed: this is a confirmed, fixed, real bug, but wasn't
necessarily the only issue behind the original report, and — sandbox limitation still applying —
the fix itself hasn't been visually confirmed in the actual running app yet.

## Session 107 — Stationary-sources spot-check for the target-count sweep

Follow-up flagged at the close of the Group A sweep (Session 106): banners/wells/spirits weren't
separately spot-checked against the ambiguous-target-count bucket. Used the API's own `categories`
field (`Turret`/`SpiritWeapon`/`Well`/`Spirit`/`Banner`) to build the candidate list rather than
name-matching — name-matching alone would have produced a false positive (Sea Swell matches `/well/i`
via "Swell") and would miss anything not literally named "Well"/"Spirit".

Result: mostly a non-issue. Warrior's Banners all carry their own direct "Number of Allied Targets"
fact, so `resolveTargetCount` already resolves them correctly without needing a table entry — no gap
there at all. Wells and Spirits were already fully covered by the Necromancer/Mesmer/Thief/Ranger
profession legs (Well of Power's exclusion was already documented from before). One genuine gap
found: Engineer's **Blast Gyro** (31248) — the API categorizes it "Well" but it's actually a
delayed-explosion gadget (fire combo field + its own blast finisher), not a pulsing well. Wiki raw
wikitext has no allies wording anywhere on its Might facts or description — curated self-only,
consistent with the sweep's established "no allies wording anywhere" tell.

## Session 106 — Elementalist leg of the Group A target-count sweep (final leg)

Tenth and final leg of the Group A ambiguous-target-count sweep, closing the sweep out entirely. 51
skills + 5 traits resolved (2 skills deliberately excluded — see below). 20 of the 51 skills are all
"Deploy Jade Sphere" (the Catalyst's jade-sphere-element profession mechanic, one id per element/tier
variant), sharing one description — "granting boons to allies in its radius based on its element" —
and one shared "Number of Targets: 5" fact reused as the ally count, the same reused-label shape as
Healing Rain/Heat Wave.

Corrected a stale claim discovered while curating Heat Wave (5600): this file's own doc comment on
`BoonConditionSource.targetCount` named Heat Wave as an example of a self-only Vigor grant ambiguous
against its enemy-facing target count, but a fresh wiki fetch found the opposite — "grants vigor to
allies" is accurate, backed by a single shared `targets|5` wiki fact. Re-curated it as party-wide and
swapped the doc comment's illustrative self-only example for a real one (Grinding Stones' Stability).
Same fix applied to the analogous example in TODO.md.

Elementalist's three Shouts ("Flash-Freeze!", "Aftershock!", "Feel the Burn!") each name only ONE of
their boons explicitly as ally-facing in the skill's own description (Frost/Magnetic/Fire Aura
respectively), leaving their other boons undescribed — wiki-checked each and confirmed a shout's boons
always share one party-wide reach, the standard GW2 shout mechanic. Six Dual-Attack/utility hammer
skills grant Stability/Regeneration with zero allies wording in their own description; wiki-checked
each individually and found five self-only (Grinding Stones, Lahar, Glacial Drift, Katabatic Wind,
Molten Burst, Lava Skin) — Katabatic Wind's wiki page notably cites an explicit version-history
bug-fix ("caused this skill to grant an improper version of the regeneration boon to allies") as
direct proof the boon was never intended for allies — and one party-wide (Transmute Earth, via an
explicit "Boon Radius(600)" fact distinct from its "Attack Radius(240)").

Two new per-buff-line self/party-wide-split exclusions, extending the gap this table already can't
express (Guardian's Tome of Courage/Holy Reckoning, Revenant's Pain Absorption/Gladiator's Defense):
**Overload Earth** (29618) mixes a self-only base Stability with a party-wide base Protection, both
unconditioned on one source with no gate of any kind distinguishing them. **Hare's Agility** (76583)
mixes a self-only base Swiftness with a party-wide Fury added specifically by Altruistic Aspect (trait
2415, "Meditation skills grant boons to allies") when traited — confirmed via that trait's own wiki
page as a real, documented per-meditation bonus-boon table (Otter's Compassion→Regeneration, Hare's
Agility→Fury, Toad's Fortitude→Stability), not a tooltip bug — but still an unsplittable conflict once
traited. By contrast, Otter's Compassion and Toad's Fortitude (also Altruistic-Aspect-affected
meditations, both curated normally) have base boons that are ALREADY party-wide by their own
description, so the trait's added boon shares rather than conflicts with the base reach.

`npm run typecheck` and a scoped `eslint` pass on the changed file both clean. This closes out the
entire Group A sweep (10 legs across 2026-08-06/07) — see TODO.md for the remaining, separately-scoped
per-buff-line target-count model gap this sweep's exclusions kept surfacing.

## Session 105 — Guardian leg of the Group A target-count sweep

Ninth leg of the Group A ambiguous-target-count sweep — Guardian, the last per-profession bucket
before Elementalist. 45 skills + 3 traits resolved (40 skills + 3 traits party-wide, 5 skills
self-only); 1 trait (Holy Reckoning, 2210) deliberately excluded — see TODO.md's per-buff-line-split
gap bullet.

New recurring pattern this leg: the wiki's own "Symbol" skill-type page states a blanket rule —
every Symbol "delivers a boon to allies that stand on it," except Symbol of Ignition by name. Used to
resolve every "Symbol of X" skill as party-wide even where the individual skill's own tooltip has no
"allies" wording at all (Symbol of Spears, Symbol of Vengeance), and to confirm Symbol of Ignition as
the sole self-only exception on that page's say-so alone, without needing per-skill version-history
digging.

Also confirmed three `requires_trait` gates whose own wording made every fact behind them
unconditionally party-wide: Inspired Virtue (trait 621, "Virtues apply boons to allies when
activated") gates Virtue of Justice/Virtue of Resolve/Wings of Resolve's boon facts — those facts only
exist in the trait-gated form, so no self-only baseline competes with it; Shimmering Stances (trait
2410, "Stances grant protection to affected allies") gates the Luminary spec's Resolute Stance/Daring
Advance/Stalwart Stance/Valorous Stance; Resplendent Weaponry (trait 2330, "Grant boons to nearby
allies when you equip a radiant weapon") gates Luminous Staff/Radiant Bulwark/Dazzling Hammer's bonus
Might/Fury/Alacrity. Same trait-gate-carries-the-reach pattern as prior legs' Specter/Ritualist wells.

Two traps (Test of Faith, Dragon's Maw) share Guardian's "on Trap Trigger" self-reward phrasing with
no allies wording anywhere on either wiki page — resolved self-only, same "no allies wording
anywhere" tell used throughout this sweep (also applied to Roiling Light's "gaining resistance,"
first-person with no allies wording).

Holy Reckoning (trait 2210) excluded: its Might line is party-wide ("grant might to allies") but its
Fury line is self-only ("Gain fury when activating Rushing Justice"), sharing one
Radius(360)/Number-of-Targets(5) fact with no `requires_trait` split between the two lines — the same
per-buff-line gap `TARGET_COUNT_OVERRIDES` already can't express (Guardian's Tome of Courage,
Willbender's Phoenix Protocol, Revenant's Pain Absorption/Gladiator's Defense), now with a fourth
shape (no distinguishing gate of ANY kind, not even a legend/trait choice).

`npm run typecheck` and a scoped `eslint` pass on the changed file both clean. Only Elementalist
remains in the Group A sweep.

## Session 104 — Mesmer leg of the Group A target-count sweep

Eighth leg of the Group A ambiguous-target-count sweep. 22 skills + 12 traits resolved, no exclusions
needed. Fixed a scan-script bug carried over from prior sessions: the brace-matcher was grabbing the
`TARGET_COUNT_OVERRIDES` type annotation's braces instead of the object literal after `=`, so it never
actually excluded already-curated ids from its candidate pool. The corrected rescan found Mesmer (34
remaining) was smaller than Guardian (39), not the other way around as the prior session's rescan had
claimed, so Mesmer was picked instead as the smaller leg.

Two skills needed a wiki raw-wikitext check to resolve a same-shape-as-Heat-Wave ambiguity:
Effervescence's Vigor is self-only (no `allied targets` wiki fact, its stack count matches the skill's
own hit count) while Journey's Regeneration is party-wide (explicit `allied targets|5` wiki fact),
despite both skills using identical "damaging enemies and healing allies" phrasing. Also confirmed
Time Warp's two ids (10311, 10377) share one wiki-documented ally cap of 5 despite 10377's own
game-data Number-of-Targets fact reading 10 — that fact is the enemy-facing/shared count, not the true
ally cap.

(This session's commit, 6fd0f6e, landed without a COMPLETED.md/TODO.md update at the time — logged
retroactively during the following Guardian-leg session.)

## Session 103 — Ranger leg of the Group A target-count sweep

Seventh leg of the Group A (ambiguous `"Number of Targets"`) target-count curation sweep
(`TARGET_COUNT_OVERRIDES` in `src/shared/boon-calc/sources.ts`) — Ranger, the next-smallest
remaining per-profession bucket per a fresh live rescan (37 skills + 6 traits, matching the prior
leg's rescan estimate exactly). All 43 resolved, no exclusions needed: 24 skills + 6 traits
party-wide, 13 skills self-only.

New recurring pattern this leg: several skills grant their tracked boon specifically "to your pet"
(a fixed companion, never a squad member this app tracks) rather than to the ranger or nearby
allies — wiki-confirmed self-only for all three found (Precision Swipe's Might, Feeding Frenzy's
Fury, and specifically Ancestral Grace's Protection line — its separate heal line does reach nearby
allies but Regeneration isn't one of its tracked facts). This is the mirror image of the pre-existing
"Guard!"/Lesser "Guard!" self-only entries from an earlier leg (boon granted to the ranger FROM the
pet's action, rather than TO the pet).

Also confirmed a trap to avoid: Untamed's Let Loose (trait 2271, "Unleashed Ambush skills grant
boons to nearby allies") is a separate, unconditioned bonus layered on top of any Unleashed Ambush
skill use — not a `requires_trait` gate on those skills' own Buff facts. Assuming it gated Unleashed
Thump/Relentless Whirl's own Might/Fury/Stability would have mis-curated them party-wide; both
resolved self-only on their own textual merits instead (first-person phrasing / no allies wording
anywhere), while Solar Brilliance — also an Unleashed Ambush skill — resolved party-wide on its own
explicit "healing nearby allies" wording, unrelated to the trait.

Several skills needed a wiki version-history check rather than a current-description read: Savage
Shock Wave ("This skill now grants protection to the user," self-only), Natural Convergence/
Rejuvenating Tides ("...grants might to nearby allies," party-wide despite the base description
never mentioning allies at all), and Glyph of Equality (both id forms confirmed party-wide via
version history despite ambiguous current wording).

Live rescan (fresh Node scan against `data/game-data/{skills,traits}.json`, filtered to already-
curated/excluded ids) confirms the remaining per-profession pool: Guardian 50, Mesmer 54,
Elementalist 72 — Guardian is next-smallest.

`npm run typecheck` and a scoped `eslint` pass on the changed file both clean.

## Session 102 — Revenant leg of the Group A target-count sweep

Sixth leg of the Group A (ambiguous `"Number of Targets"`) target-count curation sweep
(`TARGET_COUNT_OVERRIDES` in `src/shared/boon-calc/sources.ts`) — Revenant, the next-smallest
remaining per-profession bucket per a fresh live rescan (35 skills + 6 traits). 33 skills + 6 traits
resolved (14 skills + 6 traits party-wide, 18 skills self-only); 2 more excluded as genuine
per-source conflicts the table's one-value-per-source shape can't express (see below). Also folded
in 2 leftover "no profession tag" skills (Invoke Torment, Lesser Chilblains) a fresh rescan turned up
outside the original no-profession-tag leg's scan.

Recurring party-wide pattern: every Facet (Strength/Elements/Light/Chaos/Darkness) states "grant
nearby allies X" directly in its own description. Recurring self-only pattern: Legendary Demon
Stance's Resistance (Banish Enchantment, Call to Anguish, Embrace the Darkness, all split ids) only
exists via Demonic Defiance (trait 1789, "Gain resistance...when you use a Legendary Demon skill" —
first-person) with no unconditioned boon of the skill's own — resolved from the gating trait's own
text alone, same shortcut as the Thief/Engineer legs' trait-gated clusters. Lesser Chilblains repeats
the Necromancer leg's Transfusion (trait 778) one-ally mark-trigger mechanic exactly (`targetCount`
1, not 5 or `'self'`), confirming that pattern generalizes past the original Chillblains/Reaper's
Mark pair.

Two new exclusions added to the table's growing "genuine conflict, left out" list: Pain Absorption
(27322/78505) carries THREE separate unconditioned Resistance/Resolution `Buff` facts of different
durations on one source — the same "Resistance" status both party-wide (base, 3s) and self-only
("additional resistance per condition" bonus, 1s) — the exact same-status per-buff-line conflict as
Well of Power. Gladiator's Defense (77291) is self-only by default but its wiki-documented "Resonance"
note makes its boons party-wide when Legendary Dwarf Stance is equipped specifically — a legend-choice
conditional, not a `requires_trait` gate, so (like Tome of Courage/Phoenix Protocol) it flips between
fully self-only and fully party-wide with no positional split available.

Live rescan (fresh Node scan against `data/game-data/{skills,traits}.json`, filtered to already-
curated/excluded ids) confirms the remaining per-profession pool: Ranger 43, Guardian 49, Mesmer 54,
Elementalist 72 — Ranger is next-smallest.

`npm run typecheck` and a scoped `eslint` pass on the changed file both clean.

## Session 101 — Engineer leg of the Group A target-count sweep

Fifth leg of the Group A (ambiguous `"Number of Targets"`) target-count curation sweep
(`TARGET_COUNT_OVERRIDES` in `src/shared/boon-calc/sources.ts`) — Engineer, the next-smallest
remaining per-profession bucket. 35 skills + 4 traits resolved: 26 skills + 3 traits party-wide, 9
skills + 1 trait self-only. Dropped 2 candidates the scan turned up without researching them —
Holo Leap (42965) and Corona Burst (44530), both `Downed_`-slotted Holosmith skills — per the
standing TODO.md instruction (this app has no downed-skill concept, so they're unreachable
regardless of being real GW2 skills).

Same first-person/no-allies-wording-anywhere self-only tell as the Necromancer/Warrior legs, plus
one new recurring shape: turret overcharge boons gated by the Experimental Turrets trait (1678,
"Turrets... grant boons to allies around them") resolve party-wide even when the base turret
skill's own description never mentions a boon at all (Flame/Thumper/Rocket Turret). Cleansing Burst
(Healing Turret's own overcharge chain skill) had no "allies" wording of its own either, but its
wiki version history confirms Automated Medical Response — an explicit "nearby allies" trait —
affects it, consistent with parent Healing Turret's own explicit party-wide heal; treated as
party-wide on that basis. HGH's Might (gated onto Acid Bomb) was resolved the same way: the trait's
own description has no allies wording, but Acid Bomb's wiki version history states directly "Fixed
a bug that prevented HGH from properly functioning with this skill and granting might to nearby
allies." One multi-profession shared skill (Channeled Agony, 37873, a Weapon_5 skill shared across
all 9 professions) turned up via the Engineer profession-tag filter and was resolved here rather
than deferred to the not-yet-broken-out shared-skill bucket — self-only, no allies wording found.

`npm run typecheck` and a scoped `eslint` pass on the changed file both clean.

## Session 100 — Warrior leg of the Group A target-count sweep

Fourth leg of the Group A (ambiguous `"Number of Targets"`) target-count curation sweep
(`TARGET_COUNT_OVERRIDES` in `src/shared/boon-calc/sources.ts`) — Warrior, the smallest remaining
per-profession bucket (23 skills + 1 trait). No exclusions needed this leg (no dead `Downed_*` ids,
no genuine per-buff-line splits).

Confirmed the same first-person-phrasing tell from the Necromancer leg still holds, and extended it
one step further: 5 skills (Sundering Leap, Wild Blow, Shattering Blow, Gunstinger, Crushing Blow)
don't even mention their boon in the skill's own description text — undocumented tooltip-only procs.
Each one's wiki page was checked individually and none states allies wording either, so "no allies
wording anywhere, on the skill OR its wiki page" was treated as an equally reliable self-only signal
as an explicit first-person "gain X." The rest split cleanly: 15 self-only skills (5 Arcing Slice
duplicate/split ids sharing one pattern, Stomp, Dual Strike, Cyclone Axe, Crushing Blow, Imminent
Threat, Full Counter, plus the 5 undocumented-proc skills above), 8 skills + 1 trait party-wide
(Charge, Call of Valor, "For Great Justice!", Line Breaker, Rampart Splitter, Valiant Leap, "Brace
Yourselves!", "Find Their Weakness!", Empower Allies trait) — all explicit "to allies"/"yourself and
allies" wording, defaulted to 5 per the table's standard.

`npm run typecheck` and `npm run lint` (scoped to the changed file) both clean.

## Session 99 — Fixed 3 unreachable Downed_-slot entries from Session 98's Necromancer leg

The user asked, right after Session 98 landed, whether downed-state skills are excluded from the boon/
condition tables — a question that turned up a real defect. `Build` has no downed-skill concept at all
(no field for it anywhere in `src/shared/types`), and neither `skillIdsForBuild` nor
`bundleContributionsForBuild` (`sources.ts`) ever produce a `slot: "Downed_*"` skill id for any build
UNLESS that id is also a genuine bundle-slot entry point — e.g. Necromancer Reaper Shroud reuses the
`Downed_1`-`Downed_4` labels in the raw API data for its real weapon-bar skills
(`NECRO_SHROUD_SLOT_SKILLS` in `bundle-skills.ts`).

3 of Session 98's 21 "resolved" skill ids — Plague Blast (10690), its flip Dhuumfire (24287), and Life
Reap (30278) — all carry `slot: "Downed_1"` and are NOT in `NECRO_SHROUD_SLOT_SKILLS` (that map
deliberately omits 30278 as a non-entry-point Shroud chain id, per `bundle-skills.ts`'s own comment).
`resolveTargetCount` can never actually be called with these three ids for any real build, so curating
an answer for them was dead weight — harmless (never read) but not real progress on the sweep. Removed
from `TARGET_COUNT_OVERRIDES`, and the leg's comment block corrected to 18 skills (not 21), with a note
explaining why (and contrasting with 29958/Infusing Terror, also raw-labeled `Downed_3` but genuinely
reachable as Reaper Shroud slot 3's real entry point in the same map — not every `Downed_`-slotted id is
dead, only ones absent from a bundle-slot mapping).

A full-game re-scan for this same shape (boon fact + ambiguous Number fact + `Downed_*` slot) found
exactly 2 more sitting in the still-open pool, unaffected by any leg yet: Engineer's Holo Leap (42965)
and Corona Burst (44530), both real Holosmith downed skills. Left untouched (Engineer's leg hasn't
started) but flagged in TODO.md so that leg's scan drops them immediately instead of researching a wiki
answer that could never be displayed. Remaining pool re-estimated at ~243 (~205 skills + 38 traits, down
from the previously-stated ~265 — netting a correction of +3 from Necromancer's overcount against -2 from
excluding the newly-found dead Engineer ids from the baseline all remaining legs draw from, plus 5 total
dead ids retroactively subtracted from the original ~318 count now that the exclusion rule is applied
across the whole game rather than per-leg).

`npm run typecheck` and `npm run lint` both clean.

## Session 98 — Necromancer leg of the Group A target-count sweep

Third leg of Session 96's per-profession split (smallest-first, per the user's stated pacing
preference). A fresh scan (single-profession `professions: ["Necromancer"]` skills plus
Necromancer-elite-spec-locked ones — Reaper/Scourge/Harbinger/Ritualist — excluding the shared-skill
bucket) found exactly the 21 skill ids + 1 trait id estimated in Session 97's leftover note.

A clean pattern emerged across this leg: whenever a skill's own description phrases the grant in first
person ("Gain swiftness," "gain boons for each foe struck") rather than "to allies"/"protects allies,"
the boon turned out self-only every time, even when a Radius/Number-of-Targets fact sat right next to it
governing a separate foe-facing effect instead (the shrimp-siphon range on Deadly Feast, the struck-foe
count on the two elite shouts). Ten skills confirmed self-only this way: Deadly Feast, the two Downed_1
skills sharing Reaper's Might's gating (Plague Blast/Dhuumfire), both Reaper elite shouts ("You Are All
Weaklings!", "Chilled to the Bone!" — wiki infobox confirms "gain boons for each foe you freeze," not an
ally grant), Grasping Darkness, Nightfall (confirmed self via the wiki's own version-history note, since
the current description doesn't mention Protection at all), Life Reap, Desert Shroud, and Extirpate.

Two skills (Chillblains, Reaper's Mark) resolved to a third case the existing `number | 'self'` type
already covers cleanly: their boon only exists via Transfusion (trait 778, "Marks can be triggered by
allies to heal them and provide them with additional benefits") — exactly the ONE ally who steps on and
triggers the mark, not a radius pulse to several at once. `1` is the accurate answer, not `'self'` or the
default `5`.

Seven skills + 1 trait confirmed party-wide with an explicit "(to) allies" reading in their own
description (Well of Blood, Spectral Ring, Trail of Anguish, Serpent Siphon, Desiccate, Oppressive
Collapse, and trait 2405 Empowering Spirits) — all defaulted to 5 (the confirmed-elsewhere-in-this-sweep
"nearby allies" standard) except where a Number-of-Targets fact already matched.

Two skills (Well of Power, ids 10609/10673) and one more (Mark of Blood, 19117) turned out to be genuine
per-buff-line self/party-wide splits — the same shape as Guardian's Tome of Courage and Willbender's
Phoenix Protocol already flagged as an unsupported case: Well of Power's wiki notes are explicit that
"the stability and stun break are only applied to the caster," while its Might pulses to allies; Mark of
Blood's base Regeneration is confirmed party-wide but its Transfusion-gated Vigor is the same
one-ally-only mechanic as Chillblains. `TARGET_COUNT_OVERRIDES` computes one value per source and applies
it to every boon line that source emits, so neither can be expressed — left out of the table entirely,
documented in its top comment alongside the two existing exceptions.

All resolved entries added to `TARGET_COUNT_OVERRIDES` in `sources.ts` under a new "Necromancer leg"
comment block (skill and trait sub-tables). `npm run typecheck` and `npm run lint` both clean; not
spot-checked live (Electron sandbox limitation).

~265 candidates remain, split per-profession, smallest next, per the user's stated pacing preference.

## Session 97 — Thief leg of the Group A target-count sweep

Second leg of Session 96's per-profession split. A fresh scan (single-profession `professions: ["Thief"]`
skills plus Thief-elite-spec-locked ones, excluding the small multi-profession "shared skill" bucket
Session 96 also left aside) found 18 skill ids + 3 trait ids — more than the ~14+3 rough estimate from
Session 96's exploratory pass, mostly because several are the same skill's PvE/underwater/split-mode
id pairs (Grasping Shadows, Dawn's Repose, Holo-Dancer Decoy each have 2 ids).

Three (Infiltrator's Strike, Skirmisher's Shot, Spotter's Shot id 44591) confirmed self-only — both the
API's own description ("grants you a boon(s)") and the wiki agree, with the ambiguous Number fact
matching the skill's own enemy pierce/hit count instead. Fourteen confirmed party-wide, mostly Specter
kit pieces: Shadestep (trait 2289) and Traversing Dusk (trait 2285) each gate a cluster of shroud-skill/
well Buff facts via `requires_trait`, and each gating trait's own facts carry an explicit
Radius(360)/Number-of-Targets(5) that resolved every skill in its cluster at once, rather than needing
a separate wiki lookup per skill. Well of Bounty and Haunt Shot were the two unconditional exceptions in
that same kit, each with its own explicit Number-of-Targets(5). Holo-Dancer Decoy (both ids) confirmed
party-wide via its own wiki page. The three traits (Unrelenting Strikes, Traversing Dusk, Possessive
Hoarder) all read "nearby allies"/"allies" directly in their own description with a backing Number fact.

One skill (Pitfall, 56880) turned out to be neither self nor party-wide: its Might fact only exists in
`traitedFacts` gated on Even the Odds (trait 1169), a trait whose own description has nothing to do with
Might — the wiki flags this exact combination as a confirmed tooltip bug, not a real effect. Left out of
the table entirely (documented in its top comment) rather than force a wrong answer either way.

All resolved entries added to the existing `TARGET_COUNT_OVERRIDES` table in `sources.ts` under a new
"Thief leg" comment block (skill and trait sub-tables). `npm run typecheck` and `npm run lint` both
clean; not spot-checked live (Electron sandbox limitation).

Necromancer (21 skills + 1 trait, per the prior estimate) is next per the user's smallest-first pacing
preference; the rest of the ~270 remaining candidates stay split per-profession after that.

## Session 96 — First leg of the Group A (ambiguous "Number of Targets") target-count sweep

Started the much larger bucket Session 95 left untouched: sources whose only target-count signal is
the ambiguous enemy-facing `"Number of Targets"` fact (no `"Number of Allied Targets"`, no bare-Radius
signal). A scan filtered to sources that actually emit a tracked boon (`BOON_NAMES`) found 318 real
candidates (276 skills + 42 traits) — down from the raw ~399, confirming Session 95's note that not
every raw candidate matters. Asked the user which slice to tackle first given the 10x size vs. Session
95; they picked the smallest self-contained one: the 30 skills with no `professions` tag at all (pet/
mount/racial/trait-proc skills — Ranger pet F2s, racial elites, Mechanist mech skills, Catalyst sphere
procs, etc.).

Wiki-verified all 30 individually, resolving several by exact API `id` match on the wiki infobox (title
search often redirected to a same-named but wrong page, e.g. "Reckless Impact" → wiki's "Reckless
Dodge", "Spiteful Spirit" → wiki's "Spite" trait page — id match confirmed which page was actually
right). 23 confirmed party-wide (mostly 5, one 10 — Norn racial "Howl"/Become the Wolf); 7 confirmed
self-only despite the Radius/Number facts (Lightning Leap, Magnetic Shield, Reckless Impact, Lesser
Cleansing Fire, Spiteful Spirit, Call of the Assassin, and Siege Turtle's "Spotter's Shot" — the last of
these has no "allies" wording anywhere on the wiki, unlike every confirmed entry, so treated as
self-only pending stronger evidence rather than assumed party-wide from the Radius fact alone). All 30
added to `TARGET_COUNT_OVERRIDES` in `src/shared/boon-calc/sources.ts` under a new "Group A sweep"
comment block. `npm run typecheck` and lint both clean; not spot-checked live (Electron sandbox
limitation).

288 candidates remain: 246 skills (276 minus this leg's 30) + 42 traits, split per-profession (plus a
small multi-profession "shared skill" bucket) for future legs — see TODO.md.

## Session 95 — Curated the no-Number-fact-but-confirmed-party-wide bucket from Session 94's TODO

Picked up the smaller of Session 94's two follow-up buckets: sources with a tracked boon (`BOON_NAMES`)
and a `Radius` fact but no `Number` fact of any kind. A fresh scan (fixing the prior session's own
count — `Radius` facts use `type: "Distance"`, not `type: "Radius"`) found 33 real candidates (20
skills + 13 traits), not the ~25 Session 94 estimated from a handful of examples.

Wiki-verified every one individually rather than trusting the `Radius` fact's presence — several
turned out to be false positives, self-only boons that merely happen to share a facts array with an
unrelated `Radius` (a trap's foe-trigger zone, a gadget's knockdown puddle, a teleport's landing
circle, Ranger's "Guard!" pet-guard radius vs. its actually-self-only Might): Lightning Flash,
"Guard!"/Lesser "Guard!", Infusing Terror, Purification, Procession of Blades, Light's Judgment, and
both Slick Shoes ids confirmed self-only. The remaining 21 (7 skills, incl. both Infusion Bomb ids,
Healing Turret, Lesser Chaos Storm, Tidal Surge, Transmute Fire, Bandage Self; 12 traits, e.g. Phalanx
Strength, Master of Manipulation, Heat the Soul) confirmed genuinely party-wide, mostly at the
game's standard "nearby allies" cap of 5 (explicit on the wiki for Healing Turret/Phalanx
Strength/Tidal Surge/Chaos Storm; used as the documented default elsewhere none stated a number).

New `TARGET_COUNT_OVERRIDES` table in `src/shared/boon-calc/sources.ts` (shaped like the existing
curated-coefficient tables, e.g. `CURATED_BARRIER_COEFFICIENTS`) holds the decision — a number for
confirmed party-wide, `'self'` to document a confirmed self-only source so a future sweep doesn't
re-research it. `resolveTargetCount` now falls back to it only when the fact data has no signal of
its own; the "Number of Allied Targets"/ambiguous-fact fact-reading logic is unchanged.

Found two concrete examples of the "self-only and party-wide boon in the same facts array" gap
`BoonConditionSource.targetCount`'s doc comment previously said had no known instance: Guardian's Tome
of Courage (Aegis stays self unless Inspired Virtue/Indomitable Courage are also chosen; Stability/
Protection are party-wide only via those traits) and Willbender's Phoenix Protocol trait (self-only
unless Battle Presence is also traited). Left both out of the override table rather than force a
wrong uniform value — logged in TODO.md and in the table's own doc comment. `npm run typecheck` and
`npm run lint` both clean; not spot-checked live (Electron sandbox limitation).

The other, much larger bucket from Session 94 — the ~399 (not 276; corrected count) skills/traits
with only the ambiguous enemy-facing `"Number of Targets"` fact — is still untouched, left for its own
future sweep per the user's explicit pacing choice this session.

## Session 94 — Boon tab / Squad tab: self vs. party-wide boon target counts

Picked up the TODO item to distinguish self-only vs. party-wide boon sources. The TODO's own
premise (absence of a target-count fact ⇒ self-only) didn't survive a full scan of
`data/game-data/skills.json`: 25+ skills with a boon and a Radius fact but **no** Number fact of
any kind turned out to be confirmed party-wide by their own kit/description (Engineer's Healing
Turret, Guardian's Symbol of Protection, Warrior's "Guard!", Mesmer's Lesser Chaos Storm, and
more) — the API simply omits the target-count fact inconsistently, it doesn't reserve omission for
truly self-only skills. The enemy-facing `"Number of Targets"` fact (276 boon-bearing skills) is
similarly unusable as a fallback — confirmed real counterexamples on both sides (self-only boon +
separately-counted enemies on Heat Wave/Convergence/Lightning Leap, vs. the same label actually
meaning an ally count on Healing Rain/Healing Seed).

Given that, shipped only what the API states unambiguously: `BoonConditionSource.targetCount`
(`src/shared/boon-calc/sources.ts`) reads the explicit `type: "Number", text: "Number of Allied
Targets"` fact (88 skills) — `null` for everything else, meaning "unknown," never "self." Firebrand
Tome chapters get the same treatment from the wiki's own `"allied targets"` fact line
(`tomeChapterBoonSources`, 7 of 15 chapters). Resolved once per skill/trait's flat facts array and
applied uniformly to every boon emitted from that call (same known per-buff-line-binding limit
already documented on `BoonConditionSource`).

Wired into every existing boon-source display for consistency: the build editor's Boon tab
(`BoonConditionSummaryPanel.tsx`), in-skill-bar/picker tooltips (`SkillsEditor.tsx`'s
`factsBlock`), and both squad-editor surfaces (`SlotTile.tsx`'s per-build summary,
`PartyRow.tsx`'s party-wide aggregate — `PartyBoonConditionContribution` gained the same
`targetCount` field). New shared `formatTargetCount` (`src/shared/boon-calc/format.ts`) renders
`"Up to N"` or nothing. Gated to `category === 'boon'` (`!entry.isCondition` in the party-summary
path) everywhere — conditions/auras never show it, out of scope for this pass. `npm run typecheck`
and `npm run lint` both clean; no test suite exists for this repo (Electron sandbox limitation —
not spot-checked live).

Left as a follow-up curation sweep (logged in TODO.md): resolving the ambiguous 276-skill
"Number of Targets"-only bucket and the 25+-skill no-Number-fact-but-confirmed-party-wide bucket
needs a wiki-verified override table shaped like `wvwFactOverrides`, same pacing as the
Healing/Damage coefficient sweeps — explicitly scoped out of this pass per a direct question to the
user (chose "leave unresolved for now" over "default ambiguous to self" or a full sweep up front).

## Session 93 — Closed both `fetch-wvw-splits.ts` follow-ups from Session 92

Picked up the two open items logged at the end of the "WvW-fact-override follow-ups" section.
Both turned out to be resolvable — the prior session's "genuinely unexplained" verdict on the first
one held up against its own evidence, but a look at the raw wikitext (not just the summary already
in TODO.md) turned up the missing piece.

**Overwhelming Celerity (41988) / Potent Haste (42983) Quickness — the GW2 API rounds half-second
Buff durations up to the next whole second.** Live-refetched both pages' raw wikitext and version
history: Potent Haste's PvE Quickness has been wiki-documented as 2.5s since 2018-12-11 (untouched
since — matches the prior session's "stable, not a caching lag" finding), yet `/v2/skills` returns
`{3, 1}` for its Quickness facts today — `3` standing in for that `2.5`, `1` matching the wiki's
WvW/PvP value exactly. Overwhelming Celerity's WvW Quickness was nerfed from 4s to 2.5s by the
2025-04-15 patch (per its own version-history table), yet `/v2/skills` returns `{5, 4, 3}` — again
`3` standing in for the `2.5`, with PvE (5) and PvP (4, unused by this app) matching exactly. Same
substitution on two skills with unrelated patch histories rules out coincidence — the "3"s that
"don't match ANY value in either skill's documented version history" (Session 92's finding) aren't
a real duration at all, they're the API's rounding of a value the wiki has always gotten right.
Since `resolveOverride`'s design deliberately requires a wiki value to appear verbatim in the raw
API set before trusting it (and rightly so — that's what caught the actual drift bugs elsewhere),
neither skill's true WvW value can ever pass that check on its own. Added a small
`MANUAL_OVERRIDES` layer to `fetch-wvw-splits.ts`, merged into the automated result after the sweep
(survives re-runs, unlike a hand-edit of the generated JSON) — `Quickness: 2.5` for 41988,
`Quickness: 1` for 42983 (the latter needed even though `1` already matches raw API data, just to
collapse the `{3, 1}` duplicate-fact pair down to one displayed row).

**Martial Cadence's Quickness (trait 1667) / Kinetic Accelerators' Fury (trait 2052) — pvp-only tag
means omit, not "unknown."** Both traits' raw wikitext tags the boon in question `game mode=pvp`
with no separate pve/wvw line — Martial Cadence's own version history confirms why: *"This trait
now grants stability instead of quickness in WvW only"* (2025-04-15), i.e. the WvW variant grants a
different boon entirely, not a reduced/omitted Quickness. `resolveOverride` already had the
symmetric case solved (a *pve*-only tag with no wvw line resolves to `'omit'` — that's exactly how
Kinetic Accelerators' own Quickness auto-resolved last sweep) but had no branch for "every tagged
line exists, none of them pve or wvw" — it fell through to `unhandled combination` and got skipped.
Added that branch (this app never displays PvP, so pvp-only and pve-only-without-wvw both mean
"omit here"). Re-ran the full ~1100-page sweep with both fixes in place: diff against the previous
`wvw-fact-overrides.json` is exactly these 4 additions (`41988.Quickness`, `42983.Quickness`,
`1667.Quickness`, `2052.Fury`) — nothing else in the existing 444 entries shifted, so the new
`'omit'` branch didn't have unintended reach beyond the 2 known cases. `npm run typecheck` and
`npm run lint` both clean.

## Session 92 — Firebrand Mantra tooltip found the real "last charge" example, and a real boon-calc over-counting bug

User's screenshots of Firebrand's Rejuvenating Respite/Overwhelming Celerity ("Final Charge" mantra
attacks) confirmed the TODO.md "unconfirmed last-charge edge case" is real (Firebrand Mantras'
final charge grants extra boons no earlier charge does — already displayed correctly), but also
surfaced a genuine, previously-undiscovered bug: the same tooltips showed some boons duplicated
2-3x at different durations (e.g. "Quickness: 9.62s / 7.69s / 5.77s").

**Root cause (verified against the live API, not assumed):** `/v2/skills`' `facts` array has no
`game mode` tag. For most skills that's harmless (one value = the only value), but a handful of
ids — confirmed via raw wikitext — bake 2-3 raw Buff facts for the SAME status into the array, one
per PvE/PvP/WvW value, with nothing distinguishing them. `extractFromFacts` (`boon-calc/sources.ts`)
walked every Buff fact unconditionally, so these ids showed (and *counted*, in the real boon-uptime
calculator, not just the tooltip) each mode's value as if it were a separate simultaneous
application from one cast.

**Scope check before fixing anything:** a full local scan found this same "N facts, same status"
shape on ~550 other skill/trait ids — but confirmed (by wiki-checking a sample) that the vast
majority are genuine multi-hit/multi-pulse mechanics (a 4-shot volley applying Bleeding on each
hit) where showing every application separately is correct, not a bug. Firebrand's Mantra
final-charge/charge-attack family (12 ids: 6 mantras × normal-charge + final-charge) is a confirmed,
narrow exception — user chose to fix just this family this session, not attempt the full 550.

- **Fix, `sources.ts`:** `extractFromFacts` now collapses same-status facts to a single emitted row
  whenever a curated `wvwFactOverrides` entry exists for that status — since an override only ever
  gets curated for a genuine mode-split, never a real multi-hit skill (see below). Every other
  (uncurated) duplicate-status skill is completely unaffected — still emits one row per raw fact,
  unchanged.
- **Fix, `fetch-wvw-splits.ts`:** extended `resolveOverride`/`collectCandidates` to resolve the
  `factCount > 1` case at all (previously an unconditional skip) — only when BOTH the wiki's
  PvE-tagged and WvW-tagged values for that status can be found among the id's actual raw API
  durations, which doubles as protection against curating a stale/mismatched value (Overwhelming
  Celerity's and Potent Haste's Quickness both correctly stay un-curated: neither's wiki-current
  WvW value appears in its cached API duration set at all). Initially assumed this meant the cached
  API data just hadn't caught up to a recent balance patch — checked that against the wiki's own
  edit-history API afterward and it doesn't hold up (both pages' facts have been stable 15+ months,
  since well before this session), so the real cause is genuinely unexplained; corrected in
  TODO.md rather than left as a wrong guess. Also fixed a real pre-existing bug the investigation
  surfaced: wiki lines were bucketed "wvw" vs.
  "not wvw" instead of explicit "pve" vs. "wvw" tokens, so any genuine 3-way pve/wvw/pvp split (3
  separate fact lines, common on these Mantra pages) always tripped the "ambiguous multi-entry"
  check even when perfectly resolvable. Also added 2 wiki-shorthand aliases ("Blind"->Blinded,
  "immobilized"->Immobile) found missing while tracing why 2 of the 12 pages weren't resolving.
- **Re-ran `fetch-wvw-splits`** (full ~1100-page sweep — this script is specifically designed to be
  safely re-run after a balance patch, its whole documented purpose). Diffed the full output
  before/after: 97 skills + 60 traits gained entries, 13 skills + 14 traits gained additional keys
  on an already-curated id, **zero previously-curated values changed or were removed** except 2
  traits (Martial Cadence/Kinetic Accelerators) that lost an accidentally-correct `'omit'` the old,
  looser bucketing had produced for a `game mode=pvp`-only line with no pve/wvw line at all — the
  new code correctly declines to guess there instead of trusting a coincidence; logged as a known,
  very-low-priority gap in TODO.md rather than special-cased for 2 ids.
- End result for the 12 Mantra-family ids: Overwhelming Celerity's Might, Flame Surge/Rush's
  Burning, Echo of Truth's Crippled/Weakness/Blinded, and Voice of Truth's Vulnerability/Immobile/
  Weakness/Blinded all now collapse to one correct WvW-scaled row instead of showing duplicates.
  Rejuvenating Respite/Potent Haste/Opening Passage/Clarified Conclusion's boons turned out to have
  no real split at all (verified against the wiki) — their only remaining oddity is a duplicated
  "Charge Recovery" cosmetic field (10s/12s, sometimes a 3rd "18s") the wiki doesn't document a
  split for at all; left alone since it's Time-type (never read by boon-calc, cosmetic only) and
  genuinely unexplained — not worth guessing at.
- `npm run typecheck`/`npm run lint` both clean. Verified end-to-end with a standalone script
  reproducing `extractFromFacts`' new logic against the real post-refetch data before trusting it.
  Not visually spot-checked in the running app (Electron sandbox limitation).

## Session 91 — Resolved the last "Skill picker follow-ups" item: Ranger's Eternal Bond (Profession_4)

User asked to finish the "skill picker follow-ups" TODO section. Re-checked the "Eternal Bond"
bullet's premise (F4 "stays unresolved — no per-pet data exists for it") against the raw data rather
than trusting the earlier note: it turned out to already be a clean single-candidate case, no
per-pet table needed at all.

- `data/game-data/skills.json` has exactly one skill named "Eternal Bond" (id 59554), and it's the
  *only* `Profession_4` entry in all of Ranger's `professionSkills` — not just Soulbeast's. Its
  tooltip ("Meld with your other pet. This counts as swapping pets.") describes pet-dependent
  in-game behavior, but the skill id/name/icon itself never varies by pet — unlike F1-F3, which are
  genuinely different named skills per pet family/archetype and do need
  `soulbeast-beastmode.json`'s per-pet table.
  `profession-mechanic.ts`'s `resolveMechanicSlot` already special-cases the single-candidate case
  (returns it immediately), and the generic resolver's step 5 already drops a chosen skill's slot
  entirely when its `specializationId` isn't in the build's equipped specs — so Eternal Bond was
  already resolvable by the *existing* generic per-spec resolver, correctly gated to only show when
  Soulbeast (spec 55) is equipped. It just needed to stop being unconditionally excluded.
- Fix: removed `'Profession_4'` from `RANGER_BEASTMODE_EXCLUDED_SLOTS` in `profession-mechanic.ts`
  (was `['Profession_1', 'Profession_2', 'Profession_3', 'Profession_4']`, now just the first 3).
  Updated both of that file's doc comments (`RANGER_BEASTMODE_EXCLUDED_SLOTS` and
  `soulbeastBeastmodeBar`) plus `docs/game-data.md`'s Ranger section to match. No changes needed to
  `ProfessionMechanicBar.tsx` — `soulbeastBeastmodeBar`'s F1-F3 entries are already prepended ahead
  of the generic resolver's own entries, so F4 now lands between F3 and F5 in the rendered bar with
  no ordering change needed.
- Removed the resolved bullet from TODO.md's "Skill picker follow-ups" section, leaving only the
  unconfirmed last-charge-effect edge case (no concrete example exists yet to investigate against).
  `npm run typecheck`/`npm run lint` both clean. Not visually spot-checked in the running app
  (Electron sandbox limitation) — worth confirming live that equipping Soulbeast shows an "Eternal
  Bond" F4 button on the mechanic bar.

## Session 90 — Closed out the last 4 "no resolving signal" duplicate-name skill groups

User asked to work through the remaining duplicate-named skill groups (TODO.md's "4 duplicate-named
Heal/Utility/Elite skill groups still show duplicate entries" bullet: Throw Mine, Mist Form,
Protective Solace, Jade Winds). Re-investigated all 4 with fresh wiki/API pulls rather than trusting
the earlier "no signal found" conclusion, and it turned out wrong for half of them.

- **Protective Solace/Jade Winds were never live picker bugs**: both are Revenant skills, and
  `RevenantSkillsEditor` builds its bar from `legends.json`'s fixed ids, never calling
  `visibleSkillsForSlot` at all — the second id of each pair is a structurally-unreachable orphan,
  same shape as Session 88's Vindicator finding. Confirmed no curated coefficient is mis-keyed to
  either orphan (Jade Winds' damage curation already covers both ids identically; Protective Solace
  isn't curated anywhere). No code change needed for these two.
- **Mist Form is a real PvE/WvW/PvP recharge split** (30/60/75, confirmed via raw wikitext), not an
  unresolvable duplicate — but the WvW-recharge id (`15795`) is missing a `traitedFacts` entry
  (Soothing Disruption's Stability grant) its sibling `5554` has, a real API data gap. Since
  `Recharge` facts are cosmetic-only in this app (never read by any calc) while `traitedFacts` feeds
  real boon-calc totals, added `15795` to a new `INCOMPLETE_DATA_DUPLICATE_SKILL_IDS` constant in
  `skill-variants.ts` so the picker always resolves to `5554` instead — trading a cosmetically-wrong
  displayed recharge for never silently losing the Stability contribution.
- **Throw Mine is a confirmed Gadgeteer-trait-gated pair** — this time backed by a real structural
  diff (differing `description` and `flip_skill` target between `6161`/`30337`), not just wiki
  prose. Resolving it needed the picker to know the build's chosen traits, which turned out to
  already exist nearby: `StandardSkillsEditor` already computes `activeIds` for tooltip fact-gating.
  Threaded it through as a new `chosenTraitIds` parameter (`skillsForProfessionAndSlot` ->
  `visibleSkillsForSlot` -> `resolveGroup`, defaulted to empty everywhere else, so both standalone
  scripts and every other call site are unaffected) plus new `GADGETEER_GATED_SKILL_IDS`/
  `GADGETEER_TRAIT_ID` constants that resolve to `30337` when trait `1679` is active, `6161`
  otherwise.
- Removed the now-resolved TODO.md bullet; full writeup in `docs/game-data.md`'s Session 90 entry.
  `npm run typecheck`/`npm run lint` both clean. Not visually spot-checked in the running app
  (Electron sandbox limitation) — worth confirming live that equipping Gadgeteer swaps the Throw
  Mine picker entry.

## Session 89 — Closed out the last item from the 2026-07-31 skill-bar feedback pass: Engineer Kit toggle row

User asked to work through the "Engineer issues"; several were scattered across TODO.md (skill-bar
kit-swap edge case, Hematic Focus's Fury crit-chance value, the Throw Mine duplicate-id picker gap,
and two parked Healing-coefficient exceptions) — picked the skill-bar kit-swap edge case, the last
remaining profession from the 2026-07-31 skill-bar UI/UX feedback pass (every other profession's
section was already resolved in Sessions 35-40).

- **Confirmed the deferred reasoning was correct, not just re-read it**: traced why Firebrand
  Tomes/Necromancer Shroud/Druid's Celestial Avatar/Bladesworn's Gunsaber could all migrate to a
  clickable F-bar icon in `ProfessionMechanicBar` (Sessions 35-36) but Engineer Kits couldn't —
  those 4 each have a *fixed* F-slot baked into their spec (Firebrand always has F1-F3 Tomes), while
  a Kit is just whatever the player equipped in Heal/Utility1-3, occupying 0-4 different positions
  depending on loadout. Worse, the F-slot a Kit's loadout choice maps to is already showing a
  DIFFERENT skill — that slot's Toolbelt skill (`engineerToolbeltBar`, e.g. Grenade Kit's own
  "Grenade Barrage") — so repurposing that icon as the kit-swap click target would show the wrong
  icon for the wrong action, a real game-accuracy regression. The true in-game click target (the
  equipped Utility skill's own icon) is already claimed in this app for reopening the Heal/Utility
  picker, so overloading it with a second click meaning would conflict too. No architecture change
  taken.
- **What WAS a real, self-contained gap**: the kit-toggle row (`WeaponSkillBar.tsx`'s `toggleRowIds`)
  still rendered plain text pills ("Weapon"/"Grenade Kit"/"Elixir Gun", `.legend-toggle-button` — a
  stale name left over from before Revenant's own Legend toggle was replaced with an icon-based
  picker) while every other bundle toggle in the app now shows as an accent-bordered icon button.
  Converted it to reuse the same `.skill-slot-button` icon treatment (kit's own icon, tooltip on
  hover, accent border while active) as the F-bar bundle icons, and added the same "click the active
  one again to revert to Weapon" behavior those already have (previously only the separate "Weapon"
  button could revert). Removed the now-dead `.legend-bar-toggle`/`.legend-toggle-button` CSS.
- Fixed a stale doc comment in `bundle-skills.ts` that still said "only Kits and Celestial Avatar
  still use the separate toggle row" — Celestial Avatar migrated to the F-bar in Session 36; only
  Kits remain, for the structural reason above (not an oversight).
- `npm run typecheck`/`npm run lint` both clean (no test runner in this project). Not visually
  spot-checked in the running app (Electron sandbox limitation).

## Session 88 — Resolved the Vindicator Legendary Alliance orphan-id TODO item: not a picker bug, a mis-keyed curated coefficient

User asked to work through the "skill picker duplicate id issue"; picked the still-open Vindicator
orphan thread over the 4 no-signal groups (Throw Mine/Mist Form/Protective Solace/Jade Winds, still
open).

- **Corrected the TODO bullet's premise first**: a full `skills.json` name-search found Nomad's
  Advance (`62832`) and Reaver's Rage (`62878`) each have exactly **one** id — no duplicate exists for
  either, contrary to what the bullet claimed. Only Scavenger Burst (`62841`/`62962`) and Tree Song
  (`62793`/`62941`) actually have a second id.
- **The orphans (`62841`, `62793`) are structurally unreachable in the live app**, independent of
  whatever `visibleSkillsForSlot`'s `GroundTargeted`-collapse signal would resolve them to: traced
  `SkillsEditor.tsx`'s branch — Revenant always renders via `RevenantSkillsEditor`, which builds its
  bar directly from `legends.json`'s fixed `heal`/`utilities`/`elite` ids (`62962`/`62941` for this
  pair) plus `vindicatorAspectSkillId`'s 1-hop flip, and never calls `skillsForProfessionAndSlot`/
  `visibleSkillsForSlot` at all — that path is exclusively `StandardSkillsEditor`'s, used for every
  *other* profession. So even though hand-tracing `resolveGroup` confirms it would (incorrectly) pick
  the non-`GroundTargeted` orphan for this one family — the opposite of every other `GroundTargeted`
  group, where the non-ground id really is canonical — the real UI never asks. The
  `audit-skill-picker-duplicates.ts` script flags this family because its synthetic per-(profession,
  slot) sweep calls `visibleSkillsForSlot` directly with no notion that Revenant bypasses it — a blind
  spot in the standalone script, not a live bug. Live `/v2/skills/62841` and `/62793` pulls
  byte-match the local cache (not a stale-cache issue either), and their facts don't cleanly match any
  single point in the wiki's documented version history for this skill pair (`62841`'s `dmg_multiplier`
  2.5 never appears in Scavenger Burst's history at all, which only starts at 2021's beta) — consistent
  with a frozen pre-launch beta leftover, though what they precisely are no longer matters once
  confirmed unreachable.
- **The actual bug this investigation found**: `CURATED_DAMAGE_COEFFICIENTS` had a real, wiki-correct
  entry (`coefficient: 1.25`, matching Scavenger Burst's wiki-documented WvW+PvP value) keyed to the
  unreachable orphan `62841` instead of `62962` — the id `legends.json`/`RevenantSkillsEditor` actually
  renders — so live Vindicator builds showed no Damage line for Legend7's first utility skill at all.
  Re-keyed to `62962` in `damage-calc.ts` (content unchanged, still wiki-correct; confirmed `62962`
  carries its own single unambiguous `'Damage'` fact for the `factText` matcher to hit). Tree Song's
  `healing-calc.ts` entry needed no equivalent fix — it already curates *both* `62793` and `62941`
  defensively, noted at the time as "confirmed byte-identical Healing facts via direct API pulls,"
  which holds up (unlike Scavenger Burst's Damage facts, which genuinely differ between the two ids —
  `62841`'s own `dmg_multiplier` doesn't match `62962`'s, another tell that `62841` was never checked
  against its own raw data during curation, just assumed reachable).
- Deliberately did **not** add `62841`/`62793` to `skill-variant-exclusions.json` — that file only
  feeds `visibleSkillsForSlot`, which Revenant never consults, so an entry there would affect nothing
  live and could misleadingly suggest this family's resolution lives in the picker layer when it
  doesn't. TODO.md's bullet removed outright (resolved, not deferred) rather than reworded again.
- `npm run typecheck`/`npm run lint` both clean. Not visually confirmed in a running window (standing
  Electron-sandbox limitation) — the only observable effect is Legend7's Scavenger Burst utility
  tooltip now showing a Damage line where before it showed none.

## Session 87 — Skill-picker "Tale"/"Deception"/"Minion" category miscategorization fix

User asked to work through remaining fix-it items in TODO.md before new features/the Gear
Optimizer bug; picked the two skill-bar-feedback-pass category-grouping bugs to start.

- Root cause (confirmed against raw `skills.json`, not guessed): Troubadour's 6 "Tale of..."
  skills, Mirage's "Mirage Mirror"/"Mirage Retreat", and Necromancer's "Necrotic Traversal" all
  come back from the GW2 API with an empty `categories` array, so `groupSkillsByCategory` (driven
  by `categories[0]`) dumped them into the catch-all uncategorized bucket — not a bug in the
  grouping logic itself, a real data gap. "Leaks into other Mesmer specs' pickers too" from the
  original report matches: every Mesmer spec's uncategorized bucket is a shared catch-all, so this
  wasn't unique to Troubadour/Mirage's own pickers.
- New `src/shared/skill-calc/skill-category-overrides.ts` — small curated id→category override
  table, `skillPickerCategory()`, following this codebase's usual per-entry-verified curation
  style rather than a blanket guess: Tale skills get `"Tale"` (no sibling to borrow from, but
  every description literally starts "Tale.", same self-naming convention as Celestial Avatar's
  skills); Mirage Mirror/Retreat get `"Deception"` (verified: every *other* Mirage Heal/Utility/
  Elite skill is already tagged `["Deception"]`, a real sibling tag, not a guess); Necrotic
  Traversal gets `"Minion"` (matches Summon Flesh Wurm's own category, satisfying the original
  ask to group it near its source skill despite no `flipSkill`/`bundleSkills` link existing in the
  raw data to resolve it automatically).
- `SkillsEditor.tsx`'s `groupSkillsByCategory` now calls `skillPickerCategory()` instead of reading
  `categories[0]` directly. `npm run typecheck`/`npm run lint` both clean.

## Session 86 — v0.3.0 release

- Bumped `package.json`/`package-lock.json` to 0.3.0 and wrote `CHANGELOG.md`, covering the 14
  commits since 0.2.0: Favorites (middle-click pin for builds/squads/food/utility), auto-save on
  editor back-navigation + Builds/Squads staying mounted across tab switches, Settings toggles for
  underwater and racial skills, Weaver's dual-attunement weapon-skill-3 fix, `#stat`/keyword
  search in the gear-upgrade pickers, sigils now counting toward the Stats panel, the Utility
  "Gain X Equal to N% of Your Y" conversion-parsing bug fix, and the Feast/Station
  shared-buff-resolution fix (including the hand-curated Ascended Gourmet Feast tier).
  `npm run typecheck`/`npm run lint` both clean before tagging.
- Judgment call on version bump: minor (0.3.0) rather than patch, given the mix of new
  user-facing features (Favorites, 2 Settings toggles, keyword search) alongside the bug fixes,
  matching the 0.2.0 precedent of minor-bumping for a commit batch of this size/shape.
- Published via the same pre-created-draft-release workaround as 0.2.0 (see [[electron_builder_github_publish_race]]).

## Session 85 — Stat/keyword search in the gear-upgrade pickers

Feature request 2026-08-06: search by stat (e.g. "which stat prefixes affect Power") for gear stat
prefixes/food/utility/runes, and tooltip-text keyword search (e.g. "Stun", "Heal") for relics/
sigils. Landed as one shared-engine change rather than 6 separate ones — every one of these
categories already renders through `UpgradePicker`'s one search box.

- `UpgradePicker.tsx`'s search box now has two modes on the same input: plain text matches `name`
  OR `description` (description already carries the full tooltip text for every category — runes'
  bonus lines, sigils'/relics' effect text, food/utility buff text — so this alone satisfies the
  relic/sigil keyword-search ask, no separate wiring needed there); a leading `#` (e.g. "#power")
  instead matches only the new `UpgradeOption.statKeywords` field.
- `attribute-totals.ts` gained `bonusStatDisplayNames(bonus)` — resolves one `AttributeBonusText`
  line to the stats-panel display name(s) it affects (mirrors `addBonus`'s alias resolution: flat/
  percent single-attribute, "+N to All Stats", and — new — a "Gain X Equal to N% of Your Y"
  conversion line's *both* target and source names). This is why `#` needed to be a distinct mode
  from plain-text search rather than folded into it: a rune's raw bonus text says "Boon Duration"
  where the Stats panel (and this app's own `ATTRIBUTE_DISPLAY_NAME` convention) says
  "Concentration", and a "+N to All Stats" rune (e.g. Divinity) affects Power without the word
  "Power" appearing in its text at all — no substring search over tooltip text catches either case.
- `EquipmentEditor.tsx` wires `statKeywords` per category: stat prefixes/`templateStatOptions` from
  `ItemStat.attributes` directly (already resolved via `ATTRIBUTE_DISPLAY_NAME`); runes/food/
  utility/sigils via a new local `bonusesStatKeywords(bonuses)` (deduped `bonusStatDisplayNames`
  across every bonus line); infusions from their single flat `attribute` field. Relics get no
  `statKeywords` at all (deliberate — relic effects are procs, not stat levers; `#` search on them
  correctly matches nothing, per the request's own scoping).
- Infusions (8 items) fall under the picker's existing `options.length > 12` threshold for even
  showing a search box — no separate exclusion needed, the "#" feature just never surfaces there in
  practice.
- Verified via `npm run typecheck` and `npm run lint` (both clean) — Electron sandbox limitation
  (see memory) means this wasn't visually smoke-tested live.

## Session 84 — Settings toggle for racial skills

Second of the two toggles requested 2026-08-06 (underwater was Session 83). TODO.md had flagged
this as new scope requiring a `race` data model — turned out not to be true: racial skills already
carry one exact, verifiable signature in the existing `skills.json` (no new data needed).

- `src/shared/skill-calc/racial-skills.ts` — new `isRacialSkill(skill)`. Confirmed via a full
  `skills.json` scan (2026-08-06): grouping every `specializationId: null` skill by its exact
  `professions` set yields exactly one group matching "all 8 professions except Revenant" (36 ids —
  every Human/Charr/Asura/Norn/Sylvari Heal/Utility/Elite skill, including "Release the X" flip
  targets), and no other group in that profession-count range at all — a single boolean check, no
  hand-curated id list, no false positives to guard against.
- `app-settings-store.tsx` gained `showRacialSkills` (off by default, same reasoning as
  `showUnderwater`: racial skills don't see competitive WvW use). `SettingsView.tsx`'s Display panel
  gained the matching checkbox.
- `SkillsEditor.tsx`'s `StandardSkillsEditor` filters `isRacialSkill` matches out of the Heal/
  Utility/Elite picker's option list only when the setting is off — an already-equipped racial
  skill from before the toggle was flipped off still resolves via `skillsById` and renders normally
  in the bar/tooltip, same non-destructive pattern as `showUnderwater`.
- Revenant's Legend-based skill bar needs no equivalent change — Legends have fixed skill sets and
  the racial-skill profession set already excludes Revenant (accurate to the game: Revenant can't
  use racial skills either).
- Verified via `npm run typecheck` and `npm run lint` (both clean).

## Session 83 — Settings toggle for underwater equipment/skills

Built the first of two Settings toggles requested 2026-08-06 (racial skills is the other, tracked
separately in TODO.md) — this one matches the spec already noted in TODO.md 2026-07-31: off by
default, hides underwater editing UI, and the boon/condition calculator treats underwater weapon
skills as unequipped while it's off.

- New `AppSettingsProvider`/`useAppSettings` (`src/renderer/state/app-settings-store.tsx`) — plain
  `localStorage`-backed context, not `gw2Storage`'s IPC/SQLite path, since this is a per-install
  display preference, not build/squad data. Wraps the whole app in `App.tsx` (outermost provider).
- `SettingsView.tsx` gained a "Display" panel with the checkbox.
- New `Build.withUnderwaterSetting(build, showUnderwater)` (`shared/types/build.ts`) — the single
  seam every read site uses: returns `build` unchanged when the toggle is on, else a shallow copy
  forced to `environment: 'land'`. Never used on a build about to be saved (would silently clobber a
  real underwater build's own environment) — display/calc only.
- `BuildEditorView.tsx` computes one `displayBuild = withUnderwaterSetting(draft, showUnderwater)`
  and passes it (not `draft`) to `StatsPanel`/`BoonConditionSummaryPanel`/`SkillsEditor` — cascades
  automatically into `WeaponSkillBar`/`ProfessionMechanicBar` (they just forward whatever `build`
  prop they're given), so every one of `sources.ts`'s `environment`-branching functions
  (`weaponSkillIdsForBuild` inside `computeBoonConditionSources`/`computeAuraSources`/
  `computeComboSources`/`computeNamedFactSources`) and `computeGearAttributeTotals`'s
  `isActiveWeaponSlot` already treat underwater as unequipped, with no per-function threading
  needed. Edits still flow through the real `draft` (`onBuildChange` closes over it, not
  `displayBuild`), so this is a pure read-side mask — an existing build saved with
  `environment: 'underwater'` isn't mutated, just displayed/calculated as if it were land.
- `WeaponSkillBar.tsx`'s `env` section (the Land/Underwater switch icon) and
  `EquipmentEditor.tsx`'s weapon-panel toggle button both hide outright when the setting is off
  (`EquipmentEditor` also forces its own local `weaponMode` state to `'land'` via a computed
  `effectiveWeaponMode`, so a stale `'underwater'` pick from before the toggle was flipped off can't
  leave the panel showing nothing).
- Squad editor: `PartyRow.tsx` builds one `effectiveBuildsById` (same `withUnderwaterSetting` map)
  and feeds it to every `computePartyXSummary` call AND each `SlotTile`'s `build` prop — covers
  `SlotTile.tsx`'s own `computeBoonConditionSources`/etc. calls without touching that file at all.
- Deliberately left untouched: `GearOptimizerPanel.tsx` still reads raw `draft` (already flagged
  separately in TODO.md as early-stage/experimental — not worth compounding scope here).
- Verified via `npm run typecheck` and `npm run lint` (both clean) — Electron sandbox limitation
  means no live screenshot verification this session, see memory.

## Session 82 — Weaver dual-attunement weapon-skill-3 gap resolved

Closed the long-standing documented limitation (TODO.md's "Skill picker follow-ups" + "Elementalist"
UI-feedback-pass items, first flagged Session 32): Weaver's weapon-skill-3 "Dual Attack" replacements
couldn't be disambiguated because the raw GW2 API's `attunement` field on a Dual Attack skill only
ever encodes *one* of its two elements (e.g. Dagger's "Steam Surge"/"Plasma Burst"/"Ashen Blast" —
Fire+Water/Fire+Air/Fire+Earth — are all tagged plain `Fire`), and the app had no concept of Weaver's
second, "previous" attunement axis at all.

- User explained the real mechanic (matches the wiki): Weaver tracks a **current** attunement
  (weapon skills 1-2) and a **previous** one (weapon skills 4-5) simultaneously; weapon skill 3 is a
  "Dual Attack" determined by the unordered pair of the two (order-independent — Fire+Water and
  Water+Fire are the same skill), collapsing to the normal single-attunement skill 3 when attuned to
  the same element twice.
- Hand-verified, not guessed: cross-referenced the wiki's own Dual Attack skill table against
  `data/game-data/skills.json`/`professions.json` to build a complete, real-id mapping — every
  Weaver-usable weapon with a Weapon_3 slot (Dagger, Staff, Scepter, Sword, Hammer, Pistol, Spear,
  Trident — the last 4 reachable via Weaponmaster Training, confirmed each still carries its own full
  6-combo Dual Attack set) × 6 differing-element combos + 4 same-element defaults = 80 entries.
  Discovered along the way: Sword's 4 same-element ids are themselves Weaver-exclusive (Sword has no
  non-Weaver form), and Hammer's are Catalyst-spec-tagged but confirmed not actually Catalyst-gated
  in-game (shared kit, just tagged with the spec that "owns" Hammer). New `WEAVER_WEAPON_3_SKILLS`
  table + `weaverWeaponThreeSkillId` lookup in `weapon-calc/weapon-skills.ts`, bypassing
  `resolveSkillBarIds`'s generic per-slot resolution for Weapon_3 specifically — that resolver's
  `specializationId`-match step was actively picking a *wrong* id once Weaver's spec id was equipped,
  even for the same-element case, since 2-3 Dual Attack ids usually share that element's tag too.
- New `Build.weaverPreviousAttunement` field (`null` except when Weaver's equipped), same
  "display-only, doesn't gate boon/condition totals" pattern as every other build-state toggle.
  `weaponSkillIdsForPair` gained an optional `previousAttunement` param: when set, skills 1-2 resolve
  off `attunement` (current) as before, skills 4-5 resolve off `previousAttunement` instead of
  `attunement`, and skill 3 comes from the new table lookup.
- New "Previous Attunement" toggle row in `WeaponSkillBar.tsx`'s `extras` section (Weaver-only, same
  4 Fire/Water/Air/Earth icons as `ProfessionMechanicBar`'s existing F1-F4 "current" row), defaulting
  to match `activeAttunement` (current === previous) whenever Weaver is newly equipped —
  `BuildEditorView.tsx`'s profession-change and elite-spec-change handlers, `builds-store.tsx`'s
  default-build factory, and its `normalizeBuild` backfill (for pre-existing saved Weaver builds)
  all seed/reset it the same way `familiarId`/`thiefStolenSkillId` already do for their own specs.
- `boon-calc/sources.ts`'s `weaponSkillIdsForBuild` now loops all 16 current×previous pairs for
  Weaver (not just 4 single attunements) so boon/condition totals include every reachable Dual Attack
  skill's facts, same "every reachable state contributes" reasoning already used for the 4-attunement
  core-Elementalist loop and the land/underwater weapon-set loops — deduplicated (`[...new Set(...)]`)
  since a differing-element pair's Dual Attack id is reachable via 2 orderings.
- Verified via a standalone script (not committed): order-independence, 11 hand-picked combos across
  all 8 weapons resolving to their correct wiki-verified names, and 3 full 5-slot bar resolutions
  (Dagger/Dagger Fire+Water, Dagger/Dagger Fire+Fire, Staff Air+Earth) spot-checked against known
  Fire/Water/Earth skill names on slots 1-2/4-5 — all passed. `typecheck`/`lint`/`build` all clean.

## Session 81 — Hand-curated the "Ascended Gourmet Feast" tier Session 80 flagged as unresolvable

- User spotted, via an in-game screenshot: "Bowl of Fruit Salad with Mint Garnish" still showed its
  raw item flavor text ("Double-click to serve Bowls of Fruit Salad with Mint Garnish to anyone
  nearby...") instead of stat bonuses, guessing correctly that it was the "Ascended" tier flagged in
  Session 80/TODO.md as needing hand-curation (68 items, not just this one).
- Confirmed via the raw item dump that this whole tier genuinely has zero buff data anywhere in the
  API — not on the item itself, and not on any "same stats as" sibling the wiki names either (e.g.
  "Bowl of Mists-Infused Fruit Salad with Mint Garnish" comes back equally empty) — so
  `borrowSharedContainerBonuses` structurally can't resolve these; they need the actual numbers from
  the wiki, hardcoded.
- Given the stakes of getting exact numbers wrong across 68 items, deliberately did NOT trust a
  rendered/summarized wiki table (same lesson as [[healing_damage_coefficient_curation]]) — fetched
  raw wikitext for the "Ascended feast" recipe page and 10 individual item pages, cross-checking the
  recipe table's stated formula against each item's own literal bonus list before trusting it.
- The formula: a "food type" (from the recipe's base ingredient, identifiable in the item's own
  name, e.g. "Sous-Vide Steak") fixes a major/minor attribute pair; a "herb" (e.g. "Mint") fixes one
  more bonus effect; 5 fixed lines (`+10% Karma`, `+5% All Experience Gained`, `+20% Magic Find`,
  `+20% Gold Find`, `+10% WXP Gained`) are appended to every one. End of Dragons added 5 more that
  swap the herb slot for `+150 Fishing Power`, verified individually since they don't fit the
  12-food-type table. A few names don't spell out their food-type/herb word literally ("Salsa" =
  Cilantro, "Spiced"/"Peppered" = Peppercorn) — confirmed via each one's own raw wikitext bonus list
  matching the herb's known effect, not guessed from the name.
- New `applyAscendedFeastFormula` (`fetch-gear-upgrades.ts`), gated on the item's own `"Gourmet
  Feast:"` flavor-text prefix (verified to match all and only these 68) so it can never misfire on
  an unrelated item that happens to share a food-type/herb keyword. Runs after
  `borrowSharedContainerBonuses`, touching only items still left buffless. All 68 resolved; verified
  the generated `bonuses`/`description` against the wiki-confirmed text for a sample spanning every
  category (core food types, all 5 herbs, the "Salsa"/"Spiced"/"Peppered" naming exceptions, and all
  5 End of Dragons items) before trusting the full run. 76 Food entries remain genuinely buffless
  (Mastery-point currency, crafting materials, achievement rewards) — TODO.md's open question on
  filtering those out of the picker is unchanged.
- Ran the real `npm run fetch-gear-upgrades` (cached raw dump, no network); diffed output before
  trusting it — only `food.json` changed. Restored `itemstat-icons.json` from git per the known
  gotcha. `typecheck`/`lint`/`build` all clean.

## Session 80 — Session 79's tooltip fix was wrong: Feasts/Stations are the real WvW play, not dead weight

- User correction, same day as Session 79: excluding no-buff Food/Utility catalog entries from the
  pickers was "absolutely the wrong play" — Feasts and Stations are what a *majority* of WvW players
  actually run for Food/Utility, specifically **because** more than one player can benefit from a
  single placed item. Session 79 had misread "no buff data on this item's own API record" as "this
  item does nothing," when the real mechanic is a placed, shareable object that grants the identical
  buff as an individually-eaten/carried sibling item.
- Confirmed via the wiki's raw text (not assumed): "Feast of Rare Veggie Pizzas" — *"Provides same
  effect as Rare Veggie Pizza"*; "Tray of Strawberry Cookies" — *"Same nourishment effect as
  Strawberry Cookie but lasts for 1 hour."* Same pattern confirmed on 3 sampled items before trusting
  it as the general mechanic.
- **Food fix** — new `borrowSharedContainerBonuses` (`fetch-gear-upgrades.ts`): for every Food item
  with no buff of its own, strips the container word ("Feast of X(s)"/"Tray of X(s)"/"Pot of X"/
  "Plate of X"/"Pile of X"/"Giant X"/"Complete X"/"Bottle of X"), re-singularizes the trailing plural
  every plausible way (English pluralization is ambiguous from the suffix alone — "Cookies" could
  singularize to "Cookie" or "Cooky", only one is real), and re-prefixes every plausible individual-
  item container word ("", "Bowl of ", "Plate of ", "Cup of ", "Mug of ", "Demitasse of ", "Slice of
  ", "Piece of ") to build a candidate list, checked against every other Food item's exact name.
  Deliberately only borrows on an UNAMBIGUOUS match (exactly one candidate hits a real buffed item) —
  confirmed live this session that all 174 real matches in the current catalog are unambiguous (zero
  naming collisions), so this costs nothing today but guards against a future patch introducing one.
  174/318 previously-buffless Food entries now resolve; the other 144 are a mix of Mastery-point
  currency, achievement/collection rewards, and a distinct "Ascended Gourmet Feast" tier (Cilantro
  Lime Sous-Vide Steak etc.) that has no separate individual sibling to borrow from at all — flagged
  in TODO.md for hand-curation rather than force-matched. New `Consumable.sharedBuffSource` records
  what was borrowed from; surfaced in the tooltip via `formatConsumableDescription` ("(Same effect as
  X)"). `durationMs`/`applyCount` deliberately NOT borrowed (the shared version's duration usually
  differs and wasn't individually re-verified per item).
- **Utility fix — a different root cause entirely**: "Station" items (Sharpening Stone Station,
  Tuning Crystal Station, Maintenance Oil Station, and 11 more/tiered variants — exactly what the
  user meant by "Stations") were never missing buff data at all; they simply were never fetched into
  `utility.json` in the first place. Confirmed against the cached raw item dump
  (`.cache/items-raw.json`) that they carry a complete `details.{name,duration_ms,apply_count,
  description}`, identical in shape to an ordinary Utility item — just filed under `details.type:
  'Generic'` instead of `'Utility'`, for reasons the API doesn't explain. `bucketItem` now also
  routes `Generic`-type items into the Utility bucket when the name ends in `"Station"` AND the
  top-level description starts with `"Utility Station:"` — tight enough to exclude the ~125 other
  unrelated `Generic`-type items that bucket also holds (Guild bank boosts, Fractal potions,
  Mist-attunement potions — a different consumable category, not a per-character equipment-slot
  pick). `utility.json` grew from 246 to 260 items.
- Reverted Session 79's picker exclusion in `EquipmentEditor.tsx` entirely — back to the full,
  unfiltered catalog for both Food and Utility, matching the original (correct) "not pre-filtered to
  a WvW meta subset" design intent.
- Actually ran `npm run fetch-gear-upgrades` this session (using the cached raw item dump, no
  network) rather than another hand-written one-off reparse script, since the Station fix needed a
  real re-bucketing pass over the full 73,989-item raw dump, not just a re-parse of already-extracted
  text. Diffed every output file before committing: `itemstats.json`/`itemstat-legal-ids.json`/
  `infusions.json`/`relics.json` unchanged; `runes.json`/`sigils.json` only gained the new
  `sourceAttribute: null` field (pure formatting, zero semantic change — same rune/sigil membership
  and counts as before); `itemstat-icons.json` reverted from git per the known
  fetch-gear-upgrades-reverts-it gotcha (see memory). Only `food.json`/`utility.json` carry
  substantive new content.
- Verified end-to-end via a standalone `tsx` script (not committed) against the real
  `computeCharacterStats`: Sharpening Stone Station moves Power 1000→1030 (matches Session 79's
  already-verified Superior Sharpening Stone number, confirming the Station correctly reuses the
  same conversion path); Feast of Rare Veggie Pizzas moves Expertise/Condition Damage from 0 to
  exactly 100/70, matching its borrowed source's own bonuses exactly. `npm run
  typecheck`/`lint`/`build` all clean.

## Session 79 — Food/utility bug: Utility's dominant WvW shape wasn't computed at all; tooltip cleanup

- Fixed the bug flagged in TODO.md (user report 2026-08-01, reproduced concretely 2026-08-06).
  Root cause was Utility-specific, not a food-vs-utility wiring bug as originally suspected: Food
  items are almost all flat `"+N Attribute"` lines and already worked correctly (verified live:
  Bowl of Butternut Squash Soup's +80 Precision/+60 Ferocity moved the Stats panel exactly as
  expected). Utility items are overwhelmingly (~43% of the 246-item catalog — Superior Sharpening
  Stone, every tier of Tuning Crystal, i.e. the items any real WvW player actually equips) a
  different shape entirely: `"Gain <target> Equal to N% of Your <source>"`, e.g. "Gain Condition
  Damage Equal to 3% of Your Precision". `parseAttributeBonusText` only recognized `"+N[%]
  Attribute"`, so every one of these lines fell through to `{attribute: null, value: null}` and
  silently contributed nothing — from the user's perspective, picking almost any realistic Utility
  item visibly did nothing to the Stats panel.
- `AttributeBonusText` (`game-data.ts`) gained `sourceAttribute: string | null`.
  `parseAttributeBonusText` (`fetch-gear-upgrades.ts`) now recognizes the "Gain X Equal to N% of
  Your Y" shape and parses it into `{attribute: target, value: percent, sourceAttribute: source}`.
  Regenerated `data/game-data/food.json`/`utility.json`'s `bonuses` arrays with a one-off,
  no-network script that re-ran the updated parser over each item's already-stored `bonuses[].raw`
  text — deliberately did NOT re-run `fetch-gear-upgrades --refresh` (silently reverts
  `itemstat-icons.json`, see memory/TODO.md). 109 Utility bonus lines now parse as conversions; 0
  Food lines do (Food's own "Gain " lines are all non-conversion procs — "Gain Health Every
  Second", "Gain Might When Using a Heal Skill" — correctly still unmapped).
- This needed the *final* source-attribute value (after base/gear/rune/food/utility/combat), which
  a single-pass `addBonus` call can't see — same problem `trait-attributes.ts`'s `BuffConversion`
  facts (e.g. Life Attunement) already solved. Extracted that solution into a shared, reusable
  shape instead of writing a second parallel one: `AttributeConversion`/`applyConversions` now live
  in `attribute-totals.ts`, and `trait-attributes.ts`'s `TraitConversion` extends the shared
  interface. New `activeConsumableConversions(build, foodById, utilityById)` resolves the build's
  current food/utility picks' conversion lines (via a new exported `resolveFlatAttributeKey`, the
  same alias table `addBonus` already used) into that shape. `addBonus` itself now no-ops on a
  bonus with a truthy `sourceAttribute` (a truthy check, not `!== null`, so it stays
  backward-compatible with rune/sigil bonus data that predates this field entirely). Wired into
  `computeCharacterStats` (`derived-stats.ts`): conversions apply against the base+gear+combat
  snapshot, before trait bonuses stack on top.
- **Tooltip pass** (second half of the ask): the Food/Utility pickers (`EquipmentEditor.tsx`) were
  still listing catalog entries with no buff at all (`effectName === null` — ~318 Food "Feast"
  reagents meant to be placed down for a group rather than eaten directly, ~10 Utility cosmetic
  transformation tonics; confirmed `effectName === null` is exactly equivalent to `bonuses.length
  === 0`, not merely correlated). Picking one of these did nothing (no buff to apply) and its
  `formatConsumableDescription` fell back to the item's own raw flavor/usage text ("Double-click to
  set out a Tray of Chocolate Bananas...") rather than a Nourishment/Enhancement buff tooltip —
  read exactly like "displaying the item's tooltip instead of the buff's," which was the reported
  symptom. Both `foodOptions`/`utilityOptions` now filter these out; genuine buff items were
  already using the correct buff-sourced `description` since Session 53, no further tooltip work
  needed there.
- Verified end-to-end (not just unit-level) via a standalone `tsx` script (not committed) that
  calls the real `computeCharacterStats` against the real committed game-data JSON: Superior
  Sharpening Stone ("Gain Power Equal to 3% of Your Precision" + "...6% of Your Ferocity") on an
  otherwise-empty build moved Power from 1000 to 1030, matching hand math exactly (3% of base 1000
  Precision). `npm run typecheck`/`lint`/`build` all clean.

## Session 78 — Sigils weren't factored into the Stats panel

- Fixed the bug flagged in TODO.md (user report 2026-08-01, reproduced concretely 2026-08-06 with
  Superior Sigil of Concentration's "+10% Boon Duration" not moving the panel). Root cause: the
  `Sigil` type had no structural `bonuses` field at all — only free-text `description`, unlike
  Rune/Consumable — so `computeGearAttributeTotals` had nothing to read for sigils except the 8
  on-kill stacking sigils' separate `STACKING_SIGILS` mechanic (`combat-state.ts`, a live-simulation
  input, not a static gear bonus).
- `Sigil` gained `bonuses: AttributeBonusText[]`, parsed line-by-line from `description` using the
  exact same `parseAttributeBonusText` regex Rune/Consumable bonus lines already use (both in
  `scripts/fetch-gear-upgrades.ts`'s `normalizeSigil` for future refetches, and applied directly to
  the committed `data/game-data/sigils.json` without hitting the live API — that fetch is a slow
  ~74k-item bulk pull with side effects on other files, see memory). Of 81 sigils, only 6 lines even
  match the "+N[%] Attribute" shape at all, and only 2 map to a tracked core attribute: Superior
  Sigil of Concentration ("+10% Boon Duration") and Superior Sigil of Malice ("+10% condition
  duration.") — the other 4 (Force/Damage, Accuracy/Crit Chance, Paralyzation/Stun Duration,
  Bursting's percent-based Condition Damage) parse but don't match any tracked attribute alias, so
  they correctly stay display-only, same as before. Malice's description turned out to be a live API
  quirk — lowercase and period-terminated, unlike every sibling sigil's `"+N% Attribute"` styling —
  so `parseAttributeBonusText` now strips a trailing period off the captured attribute name before
  the alias-table lookup.
- Wired into `computeGearAttributeTotals` (`attribute-totals.ts`) inside the existing per-weapon-slot
  loop, gated by the same `isActiveWeaponSlot`/`weaponEquipped` checks the itemStat and infusion
  contributions already use — a sigil on the currently-stowed weapon set doesn't contribute, same
  active-set-only treatment as every other per-weapon-slot bonus this function computes. Confirmed
  correct directly by the user right after landing this: inactive weapons do NOT apply their passive
  sigil bonus in-game — only stacking sigils (e.g. Bloodlust) persist their accrued stacks across a
  weapon swap, an already-separate mechanic (`STACKING_SIGILS`/`combatStatePoints`).
- Every inline `gameData` parameter type across the codebase that already listed `runes` needed
  `sigils` added alongside it to keep passing the (unchanged, still just `gameData`) argument at each
  call site: `computeBoonConditionSources`/`sources.ts`, `computeCharacterStats`/`derived-stats.ts`,
  `optimizeGear`/`gear-optimize.ts` (both `Pick<GameData, …>` signatures), and
  `computePartyBoonConditionSummary`/`party-summary.ts`'s own inline object type. `npm run
  typecheck`/`npm run lint` both clean.

## Session 77 — v0.2.0 release

- Bumped `package.json`/`package-lock.json` to 0.2.0 and wrote `CHANGELOG.md`, covering all
  four releases to date (0.1.0/0.1.1/0.1.2 pulled from their existing GitHub release notes;
  0.2.0 summarizing the ~70 commits since 0.1.2 — Gear Optimizer, trait-granted stat bonuses,
  real Healing/Damage/Barrier tooltip numbers, the full curated-coefficient sweep across all 9
  professions, flip-skill stacked icons, toggle-form display fixes, the Builds/Squads card-grid
  rework, and the skill-picker duplicate-id audit). `npm run typecheck`/`npm run lint` both
  clean before tagging.
- Published via the pre-created-draft-release workaround: `gh release create` a draft first so
  `electron-builder --win --publish always`'s concurrent asset uploads find it instead of
  racing to create duplicates (hit the duplicate-release failure mode publishing 0.1.0; not
  re-litigated here).

## Session 76 — Fixed 2 bugs surfaced by the Session 75 mechanic-bar consolidation: Evoker's F5 empty, Catalyst's Jade Sphere tooltip duplicating

- Evoker's F5 "Familiar" button was rendering nothing until a familiar was ever chosen
  (`Build.familiarId` starts `null`, and `evokerFamiliarBar` returns no entry at all for a `null`
  id) — with the old standalone `EvokerFamiliarSelect` picker row already removed (Session before
  last), there was no way left to make the *first* pick at all. Fixed by rendering a bare
  "Familiar" placeholder button in that gap (`ProfessionMechanicBar.tsx`), same pattern already
  used for Thief's Stolen Skill slot, wired to the same `cycleFamiliar` click handler (which
  already handled a `null` `familiarId` correctly — `findIndex` returns -1, `(-1+1) % length`
  lands on the first familiar).
- Catalyst's F5 "Deploy Jade Sphere" tooltip was repeating the current attunement's facts several
  times over instead of showing them once. Root cause: `ProfessionMechanicBar`'s tooltips were
  built via `SkillsEditor`'s shared `skillTooltipContent`, which also appends
  `relatedVariantSkills` — every other skill sharing the same name with a non-null `attunement`,
  designed for a genuinely-picked skill like a Glyph whose per-attunement effects the player can't
  otherwise see. Every entry in this bar is already the one currently-relevant form, so that block
  was always redundant here — and actively broken for Jade Sphere specifically, since Catalyst's
  raw ~24-candidate pool (see `CATALYST_SPEC_ID`'s doc comment) has several near-identical orphaned
  duplicate ids per attunement, all matched and rendered by name alone. Fixed by giving
  `ProfessionMechanicBar` its own plain title+description+facts tooltip builder instead of reusing
  `skillTooltipContent` — nothing in this bar is ever a genuinely-picked multi-form skill (Druid
  Glyphs only ever appear in the Heal/Utility/Elite picker), so dropping the variant block is safe
  bar-wide, not just a Catalyst-specific patch. Typecheck and lint both clean.

## Session 75 — Elementalist attunement toggle merged into the F1-F4 profession-mechanic row

Removed the standalone Fire/Water/Air/Earth attunement-toggle row `WeaponSkillBar.tsx`'s `extras`
section used to render above the whole skill bar for every Elementalist form — it was pure
duplication of the profession-mechanic bar's own F1-F4 icons (`ProfessionMechanicBar.tsx`), which
already show the same 4 Attunement ids (read-only) directly below it. `ProfessionMechanicBar`'s F1-F4
buttons are now clickable for Elementalist, setting `Build.activeAttunement` (new
`ELEMENTALIST_ATTUNEMENT_SLOTS` map in `profession-mechanic.ts`, keying off the fixed
Profession_1-4 -> Fire/Water/Air/Earth slot order) and showing the `active` state — same "click sets
a display-only build field, both/all states still contribute to totals" shape as every other clickable
mechanic-bar entry (bundle toggles, Vindicator's Alliance Tactics, Evoker's familiar cycle). Works
unchanged under Tempest, whose F1-F4 icons already swap to the Overload variant for display
(`professionMechanicBar`'s own `TEMPEST_SPEC_ID` branch) — clicking still sets the underlying
Attunement, since the slot->Attunement mapping is independent of which icon is shown. Typecheck and
lint clean.

## Session 74 — `CURATED_DAMAGE_COEFFICIENTS` full category sweep COMPLETE across all 9 professions (Heal/Elite/Utility/Weapon-slot)

Finished the last leg (Weapon-slot's Mesmer profession) of the sweep started 2026-08-04, closing out
the whole `CURATED_DAMAGE_COEFFICIENTS` category sweep alongside the earlier `CURATED_HEALING_COEFFICIENTS`
and `CURATED_BARRIER_COEFFICIENTS` sweeps. Final scope: Heal-slot (7 raw candidates, 5 curated),
Elite-slot (48 raw, all curated), Utility-slot (220 raw, curated across all 9 professions), Weapon-slot
(919 raw, by far the largest — swept one profession at a time per explicit user pacing request, landing
and checking in after each leg rather than chaining background agents leg-to-leg). Full per-profession
counts, exclusions, and the many wiki/API traps surfaced along the way (duplicate-id picker bugs,
non-player-scaling turret/pet/minion/spirit exclusions, flip-architecture gaps, trait-duplicated-fact
collisions, PvE/WvW/PvP split shapes) are preserved permanently in each file's own block comments
(`damage-calc.ts`, `healing-calc.ts`) rather than restated here — TODO.md's superseded writeup for this
item has been removed now that the sweep is done.

Mesmer's own Weapon-slot leg (this session): 56 raw candidate ids from `professions.json`'s weapon
lists, expanded to 77 via full `flipSkill` chain walks, 67 carrying a genuine Damage fact; 1 already
seeded (Illusionary Wave, re-verified unchanged); 69 curated total after finding 2 more real candidates
(Mind Spike id `10172`, Mind Pierce id `73095`) that are missing from both `professions.json`'s own
weapon list *and* unreachable via `flipSkill` — the 2nd-stage skill in each of their 3-stage chains has a
null `flipSkill` in this app's game-data despite the wiki confirming a real 3rd stage exists, found only
by cross-checking each fetched chain's own wiki `chain3=` param against the candidate set. New mechanic
this leg: **Mesmer phantasm weapon strength** — phantasms use their own fixed weapon-strength tier
(`phantasm high`/`medium`/`low` = 2877.0/2615.5/2553.5, 3 new `WEAPON_STRENGTH_MIDPOINTS` entries sourced
from the wiki's own `Template:Damage_calculation`, which the public Weapon Strength page omits entirely)
while still scaling off the caster's own Power, unlike Ranger Spirits/Necromancer minions' non-player-
scaling case — confirmed by reproducing several skills' own wiki-quoted totals under this table's
standard formula. Also applied Infinite Forge (2206, Virtuoso's "blade attacks deal more damage" trait,
+7% PvE/+10% WvW+PvP) to every Dagger/Greatsword blade-tagged fact, and Empowered Illusions (682, flat
+15% phantasm damage, already used in the Utility-slot sweep) to this leg's phantasm-summon facts. Left
a known loose end in TODO.md: the Utility-slot sweep's own Phantasmal Disenchanter/Defender entries used
`weapon: 'unequipped'` for the same no-`weapon=`-key shape this leg's phantasms exhibit, without the
back-calculation check that would have caught the real phantasm tier — likely wrong, not revised here
since it's outside this leg's own scope. Typecheck and lint both clean; verified all 69 ids present with
no duplicate keys via a throwaway script before committing.

## Session 73 — Fixed the skill-variants picker gap: Elementalist's "Lesser Fiery Eruption" was reaching the live Elite picker as its own bindable skill

TODO.md's open item (found 2026-08-04 during the `CURATED_DAMAGE_COEFFICIENTS` Elite-slot sweep)
flagged that `skill-variants.ts`'s existing filters (`stripNonEquippableSubAbilities`,
`stripFlipTargets`) don't catch every non-equippable "sub-skill" — Elementalist's Conjure Fiery
Greatsword has an auto-triggered passive proc, "Lesser Fiery Eruption" (id `44918`), with neither a
`toolbeltSkill` link back to its parent nor a `flipSkill` link, so neither existing signal recognized
it as non-equippable.

Verified live via a throwaway tsx script calling the real `visibleSkillsForSlot` (not a
reimplementation): confirmed `44918` reached the Elementalist Elite picker output before this fix,
and no longer does after. Confirmed via wiki raw wikitext that `44918` carries `parent = Conjure
Fiery Greatsword` and `[[Category:Lesser skills]]`. Scanned `skills.json` for every `name` starting
with `"Lesser "` (37 ids total) and found `44918` is the only one with a Heal/Utility/Elite `slot`
today — every other "Lesser "-prefixed id is either `slot: ""` (trait/proc-only, already outside the
picker's candidate filter) or `slot: "Weapon_5"` (Catalyst jade sphere overloads, a separate picker)
— so this is a one-off today, not a whole name-prefix category worth excluding, matching the TODO's
own caution that "Lesser" doesn't guarantee non-equippable.

Fixed by adding a new hardcoded, wiki-verified `NON_EQUIPPABLE_SKILL_IDS` constant (signal 9) in
`skill-variants.ts`, applied as a pre-pass alongside `skillVariantExclusions` — deliberately NOT
added to `skill-variant-exclusions.json` itself, since that file is regenerated wholesale by
`fetch-skill-duplicate-resolutions.ts` from *still-ambiguous duplicate-name groups* only; `44918`
isn't part of any duplicate-name group, so an entry there would be silently dropped on the next
fetch-script run (same class of landmine as the `itemstat-icons.json` revert risk noted elsewhere).
Same "small, documented constant table for a real API gap" pattern already used for
`EXCLUDED_MECHANIC_SKILL_IDS` in `profession-mechanic.ts`. Typecheck and lint both clean. See
`docs/game-data.md`'s skill-variants section for the full writeup.

## Session 72 — Closed the last `CURATED_BARRIER_COEFFICIENTS` loose end (Elementalist's Glyph of Elemental Power): not an architecture gap, just an uncurated reachable id

TODO.md's last open Barrier-sweep item described Glyph of Elemental Power (equipped id `5506`, zero
local facts) as a 4th instance of the flip-architecture gap Sessions 65/68/71 fixed for Chaotic
Release/Tailored Victory/Photon Wall/Evoker's Meditations — the Earth-attunement-tagged variant `34714`
that actually carries the Barrier fact looked unreachable from the equipped skill's tooltip the same
way those flip targets were.

It isn't the same shape. `multi-effect.ts`'s `relatedVariantSkills` already surfaces every attunement
variant of an equipped Elementalist Glyph as its own tooltip block, independent of the flip-stack
mechanism — confirmed live via a throwaway tsx script: `relatedVariantSkills(skill 5506, allSkills)`
returns all 4 attunement variants (Air `34637`, Earth `34714`, Fire `34736`, Water `34772`) by name+
attunement match, and this exact code path already renders this same skill's Air/Fire variants' curated
Damage facts (`CURATED_DAMAGE_COEFFICIENTS`, from the 2026-08-04 Damage Utility-slot sweep) — no new UI
plumbing needed. The Barrier sweep's own doc comment (Session 69) had mis-filed this as unreachable;
corrected.

Fetched the wiki's `Glyph of Elemental Power (earth)` sub-page directly (raw wikitext, not summarized):
single `{{skill fact|barrier|2100|coefficient=0.8}}` template, no PvE/WvW split. Added `34714:
[{ factText: 'Barrier', baseValue: 2100, coefficient: 0.8 }]` to `CURATED_BARRIER_COEFFICIENTS`
(`barrier-calc.ts`), updated the file's top block comment (candidate count 48 → 49, gap description
replaced with the resolution), and re-verified via a second throwaway tsx script that
`barrierLinesForSkill(skill 34714, healingPower 1000, activeIds ∅)` now returns `Barrier: 2900` (2100 +
0.8 * 1000, correct). `npm run typecheck` passes clean. `CURATED_BARRIER_COEFFICIENTS` now has no open
loose ends — the TODO item is removed, not deferred.

## Session 71 — Replicated the `requiresTrait` fix into Damage/Healing, closing the "Trait-duplicated-fact representation" TODO item

Extended Session 70's `barrier-calc.ts` fix (`requiresTrait` field + match-predicate change) into
`damage-calc.ts` and `healing-calc.ts`, then investigated every candidate the sweeps had flagged for it.

**`CURATED_DAMAGE_COEFFICIENTS` — 5 Mesmer entries fixed and curated**, all previously left
unrepresented by the Utility-slot sweep (2026-08-04): Phantasmal Disenchanter (id 10267), Phantasmal
Defender (10341), Sword of Decimation (35637), Rain of Swords (62553), Psychic Force (62573). Added
`DamageCoefficient.requiresTrait` and taught `damageLinesForSkill`'s match predicate to also compare
`requires_trait`, mirroring Barrier's fix exactly. 2 traits involved: Empowered Illusions (id 682,
Domination, Mesmer core) grants a flat, unsplit +15% to Phantasm damage, wiki-quoted via its own
`{{skill fact|damage increase|15}}`; Infinite Forge (id 2206, Virtuoso Grandmaster) grants +7% PvE/+10%
WvW+PvP to Blade attacks (itself nerfed from +10%/+10% by a 2025-02-11 PvE-only patch), wiki-quoted via
`{{skill fact|damage increase|7|game mode=pve}}`/`{{skill fact|damage increase|10|game mode=wvw pvp}}`.
Every trait-gated coefficient below was computed as `baseCoefficient * (1 + trait%)` using the
already-curated WvW-correct base coefficient and the trait's own wiki percentage, then independently
cross-checked against a live `/v2/skills/<id>` pull's `traited_facts[].dmg_multiplier` — **exact match
in all 5 cases** (e.g. Sword of Decimation: 1.0 * 1.10 = 1.10, live API traited fact also 1.1), giving
high confidence despite the trait-bonus number not being wiki-quoted on the skill's own page.

**Re-investigated Necromancer's Reaper shouts' "damage increase" facts**, which TODO.md had originally
lumped in with the Mesmer skills above as the same problem. They're not: pulled each shout's local
facts (You Are All Weaklings!/Nothing Can Save You!/Suffer!/Rise!, ids 29414/29666/30670/30772) and
found the "Damage Increase" fact is `type: 'Percent'` (not `type: 'Damage'`), carries no `requires_trait`
at all, and lives in the base `facts` array only (`traitedFacts: []` for all 4) — it's a melee-range
conditional bonus (100% at melee range, 50% at max range, per each skill's own description), an
unrelated and still entirely unmodeled mechanic (this app has no melee-vs-range distance concept). Left
exactly as documented pre-session; TODO.md's wording corrected to stop conflating the two.

**`CURATED_HEALING_COEFFICIENTS` — got the same type/matching fix, but no entry qualified.** Grepped
every existing `requires_trait` mention in the file: Rectifier Signet's trait pulse (2298, no wiki
skill-fact template at all — unchanged, already correctly left uncurated), Signet of the Ether's Blurred
Inscriptions heal (752, only in Mechanics prose with a non-standard template shape — unchanged), Thief's
Signet of Malice (not actually trait-gated — its passive/active heals just coincidentally share the
exact text "Healing" with no `requires_trait` on either side, a same-text collision this fix can't help
since gating on `requires_trait ?? null` would match both identically — unchanged), and Necromancer's
Chillblains/Transfusion (778, the already-tracked shared-formula case, out of scope by design —
unchanged). One genuinely new attempt: Guardian's Signet of Courage (id 30461/68676) — Perfect
Inscriptions (trait 579) has a clean wiki-quoted `{{skill fact|percent|20}}` and its own Notes table
even names the skill directly ("Signet of Courage: Passive Healing increased by 20%"), but 202 * 1.2 =
242.4 doesn't reconcile closely enough with the live API's own traited value (240) to trust — a small,
unexplained discrepancy, not confidently rounding. Left uncurated rather than guess which of
baseValue/coefficient the 20% applies to. `HealingCoefficient.requiresTrait` is now in place for
whenever a future candidate's numbers actually reconcile cleanly.

`npm run typecheck` passes clean; all 5 new Damage entries verified via a throwaway tsx script calling
`damageLinesForSkill` with and without each trait id in `activeIds` — confirmed the trait-gated line
only appears once its trait is active, at the expected computed value, and the base line is unaffected
either way (same dual-display convention `numericFactLines` already uses elsewhere in this codebase for
base+trait-conditional fact pairs — not a new UI pattern).

## Session 70 — Closed out the 3 Barrier-sweep loose ends from Session 69

All 3 items from TODO.md's "Loose ends from the `CURATED_BARRIER_COEFFICIENTS` sweep" investigated;
1 fixed and curated, 2 confirmed as genuine leave-uncurated cases (not app-side bugs):

- **Engineer's Utility Goggles (id 29591)**: a fresh live `/v2/skills/29591` pull confirmed this app's
  cached data is current and byte-identical to the API's live response — not stale. The real finding is
  a genuine, confirmed API/wiki mismatch: fetched the wiki's raw wikitext (infobox facts, Mechanics
  section, and every version-history entry back to the 2016 release) and none of it ever mentions a
  Barrier effect on this skill, despite the API carrying a real `Barrier` fact (2122, `target: 'Healing'`
  — the usual mislabeling) on `29591` only, not its same-wiki-page sibling `5865`. Treated as an orphaned
  API artifact with no current documented basis — left uncurated, same "genuine unresolved mismatch"
  call already made for Revenant's Energy Expulsion (29114) in `CURATED_HEALING_COEFFICIENTS`.
- **Engineer's Hard Light Arena (id 44646)**: confirmed via raw wikitext — the skill-fact template gives
  a base value (`{{skill fact|barrier|2900|alt=Barrier Applied above 50% Heat}}`) with no `coefficient=`
  param at all, so there's no Healing-Power scaling documented to curate. Left uncurated, unchanged from
  Session 69's finding.
- **Elementalist's Lava Skin (id 46447), "Initial Barrier" fact — fixed.** This was the motivating case
  for the "Trait-duplicated-fact representation" architecture gap (TODO.md): the skill carries two
  same-text "Initial Barrier" facts (an untraited 650 in `skill.facts`, and a `requires_trait: 2077`
  fact worth 1018 in `skill.traitedFacts`, its own `overrides` index confirming it replaces the same
  quantity rather than adding to it — 2077 is "Elemental Refreshment," an Arcane trait granting "barrier
  to yourself when using Dual Attack skills," and Lava Skin's own wiki infobox is `type = Dual Attack`),
  but the wiki only documents the TRAITED value (1018, `coefficient=0.2`) — no untraited number exists
  anywhere on the page. `barrierLinesForSkill`'s old `.find()`-by-`factText`-alone always resolved to
  the ungated 650 fact (facts sorts before traitedFacts in the merged lookup array), so there was no way
  to bind the curated 1018/0.2 to the correct fact without also matching every other skill's untraited
  fact by coincidence. Fixed by adding an optional `requiresTrait?: number` field to
  `BarrierCoefficient` and extending `barrierLinesForSkill`'s match predicate to also require
  `(f.requires_trait ?? null) === (entry.requiresTrait ?? null)` — verified directly via a throwaway
  tsx script calling `barrierLinesForSkill` with and without trait 2077 in `activeIds`: "Initial Barrier"
  now only appears once Elemental Refreshment is actually chosen, at the wiki-correct value, and
  "Barrier per Pulse" (the skill's other, already-curated fact) is unaffected either way. `CURATED_
  BARRIER_COEFFICIENTS[46447]` now curates both facts.

This fix only touched `barrier-calc.ts` — the identical bug exists in `damage-calc.ts`'s
`damageLinesForSkill`/`CURATED_DAMAGE_COEFFICIENTS` and `healing-calc.ts`'s `healingLinesForSkill`/
`CURATED_HEALING_COEFFICIENTS` (same merged-array-`.find()`-by-text shape) but replicating it there was
kept out of scope for this session — that's the larger, separately-tracked "Trait-duplicated-fact
representation" TODO item, which also needs ~10 new wiki-verified entries added (Mesmer's Phantasmal
Disenchanter/Phantasmal Defender/Sword of Decimation/Rain of Swords/Psychic Force, Necromancer's Reaper
shouts) rather than just the type/matching-logic change. `npm run typecheck` passes clean.

## Session 69 — Built `CURATED_BARRIER_COEFFICIENTS` + `barrierLinesForSkill`, a new Barrier tooltip line

Scoped 2026-08-04 (product decision to build it, same session as the Weapon-slot Damage sweep pause),
built 2026-08-05. Barrier scales off
Healing Power with the exact same `base + coefficient * HealingPower` shape as a real heal, but is a
different resource bar than Health — this app had no Barrier UI/formula at all until now, and every
Barrier-mislabeled-as-Healing fact was simply excluded from `CURATED_HEALING_COEFFICIENTS` across the
whole Healing sweep. Built as `src/shared/skill-calc/barrier-calc.ts`, mirroring `healing-calc.ts`'s
exact shape (`CURATED_BARRIER_COEFFICIENTS: Record<number, BarrierCoefficient[]>`,
`barrierLinesForSkill` with the same `requires_trait`/`activeIds` gating), wired into
`skill-fact-lines.ts`'s `skillFactLines` as its own tooltip line — checked before the Healing lookup
since both match on `AttributeAdjust`/`target: 'Healing'` facts (the API mislabels Barrier's `target`
too) and are only actually distinguished by `factText`.

Scanned `data/game-data/skills.json` for every skill carrying a Barrier-text `AttributeAdjust` fact
(regardless of slot, not just Heal/Utility/Elite — Weapon/profession-mechanic/Toolbelt facts included
too, since those resource-bar sources matter for WvW theorycrafting just as much): 58 distinct skill
ids, confirmed every single one is tagged `target: 'Healing'` by the API, none `target: 'Barrier'` —
total confirmation of the mislabeling pattern first spotted in the Utility-slot Healing sweep. Treated
as one bounded full-category pass (not legged by profession like the still-open Damage Weapon-slot
sweep) since the total size is comparable to a single Healing sub-category (Utility's 40).

Research was parallelized 8 ways (one agent per profession/pair), each fetching raw wikitext directly
via curl — same never-paraphrase rule as every prior sweep. 6 of the 8 agents were cut short mid-run by
an account session-limit error before producing any output; rather than re-queue into the same limit,
the remaining ~40 skills were researched directly in the orchestrating session via the same curl-raw-
wikitext method. 2 agents (Engineer, Thief) completed normally and their findings were used as-is.

Before any wiki research, resolved a 7-skill "shared/`professions: []`" bucket directly by fetching
each skill's own wiki page, since `professions: []` turned out to mean several different things
requiring individual judgment, not one pattern: 2 (Magnetic Shield, Stone Sheath) are Elementalist's
Conjure Earth Shield bundle skills (professions field just doesn't get populated for bundle skills) —
folded into the Elementalist section; 1 (Barrier Burst) is Engineer's Mechanist F3 mech-command skill,
trait-gated behind "Mech Core: Barrier Engine" — folded into Engineer; 4 (Saint's Shield, Lesser
Utility Goggles, Lesser Stone Resonance, Call of the Dwarf) are all **trait-only procs with no
independently-equippable base skill** (each one's wiki infobox literally declares `slot = trait`) — a
new exclusion family distinct from every previous sweep's non-player-scaling trap, since these ARE
player-Healing-Power-scaling, they're just never bound to a skill slot at all, so a per-`skill.id`
table can never be reached for them. Logged as its own family in `barrier-calc.ts`'s top comment
rather than 4 one-off exclusions.

Also resolved 3 duplicate-id pairs directly via each wiki page's own `id=` infobox field before
delegating research, to save agent effort: Warrior's Banner of Defense (14528 GroundTargeted/wiki-
documented-canonical vs. 14570 non-ground) — curated under 14570 anyway, since `skill-variants.ts`'s
own coded rule collapses every Warrior Banner to the non-ground-targeted id regardless of which one the
wiki calls canonical, and this app's tooltip lookup only ever reaches whichever id the real picker
resolves to; Revenant's Release Potential: Warrior (77896 wiki-canonical vs. 78895 stale ground-
targeted duplicate); Thief's Dawn's Repose (63220 wiki-canonical vs. 63227, an undocumented duplicate
whose own local facts show a same-text "Minimum Barrier" collision at two different values with no
"Maximum Barrier" fact at all — a data-quality tell independently confirming it's the one to drop).

Of the 58 raw candidates: **48 distinct skill ids curated**, 4 excluded as the new trait-proc family
above, 3 excluded as stale/non-canonical duplicate ids (the pairs above), 2 left uncurated (Engineer's
Utility Goggles — wiki documents no Barrier fact for this skill at all, and its own same-page sibling
id carries no local Barrier fact either, strong evidence this app's cached `29591` API data is stale;
Hard Light Arena — wiki gives a base value with no `coefficient=` param), and 1 fact of Elementalist's
Lava Skin left unrepresented (a trait-duplicated-text collision — the wiki's only documented "Initial
Barrier" number corresponds to the trait-boosted fact, not the ungated one this table's `factText`
lookup would actually resolve to, same open architecture gap as `CURATED_HEALING_COEFFICIENTS`'s
already-tracked "Trait-duplicated-fact representation" TODO item).

New mechanics/traps this sweep surfaced beyond every established Healing/Damage-sweep trap:
- **WvW as a genuinely standalone third value** (neither grouped with PvE nor PvP) turned out far more
  common here than in any prior sweep — Bulwark Gyro, Essence of Animated Sand, Effulgent Stance, Sand
  Flare/Cascade, Sandstorm Shroud, Shadow Sap, Call of Valor all have this shape, vs. only 1-2 isolated
  instances across the entire Healing sweep. Worth treating as an expected default to check for, not an
  edge case, on any future Barrier-adjacent curation.
- **A wiki-documented "the skill fact is wrong" correction**: Molten Burst's page states outright in
  its own Notes section that the `{{skill fact|barrier|...}}` template value is incorrect and gives the
  actually-applied number separately — the corrected number was used, not the template's own value, a
  new twist not seen in any prior sweep (previous "wiki disagrees with itself" cases were all stub/
  unverified-tag maintenance markers, not an explicit inline correction).
- **New flip-architecture-gap instance**: Elementalist's Glyph of Elemental Power — unlike
  `CURATED_HEALING_COEFFICIENTS`'s Glyph of Elemental Harmony (whose attunement-agnostic base id
  carries its own identical fact directly, so curating it works), this skill's actually-equipped base
  id carries zero facts at all; only the never-independently-equippable Earth-attunement-tagged variant
  carries the Barrier fact. Left uncurated rather than defining an entry the tooltip can never reach.
- **Trait-swapped mechanic-slot skills** confirmed as a real, recurring shape, not a one-off: Engineer's
  Barrier Burst (Mechanist F3, trait-gated behind "Mech Core: Barrier Engine") and Necromancer's
  Sandstorm Shroud (Harbinger F5, trait-gated behind "Herald of Sorrow") are both genuine equippable-
  in-effect skills reachable by choosing a specific trait, not trait-only procs like the 4 exclusions
  above — curated normally, same treatment as Necromancer's already-curated Desert Shroud.

Typecheck and lint both pass. Not visually spot-checked in the running app (Electron sandbox
limitation, same as prior sessions).

## Session 68 — Fixed Druid Glyph equipped-slot icon not swapping with Celestial Avatar toggle

User reported (with 2 screenshots) that Glyph of Alignment's tooltip facts correctly swapped between
Damage (normal form) and Healing (celestial form) when toggling Celestial Avatar, but "the icon isn't
swapping" — the slot button kept showing the same icon either way. Root cause: `glyph-forms.ts`'s
`glyphFormFactSourceSkill` (Session 64) only ever got threaded into `skillTooltipContent`'s fact
lookup, never into the `<img>` render for the equipped slot button in `SkillsEditor.tsx`'s
`StandardSkillsEditor`, which was still always rendering `chosen.icon` — the canonical/normal-form
skill's own icon, unconditionally. Confirmed via `skills.json` that the celestial-form variant ids
really do carry distinct icon assets (different `render.guildwars2.com` hash) from their
normal-form/canonical counterparts, e.g. Glyph of Alignment's celestial-form id 31348 vs. its
canonical/normal-form id 31322/31607 — so this was a real gap, not a false report.

Added `glyphFormDisplayIcon` to `glyph-forms.ts` (same resolution as `glyphFormFactSourceSkill`,
falls back to `skill.icon` for every non-Glyph skill) and wired it into the equipped-slot `<img
src>` in `SkillsEditor.tsx`. Checked for other equipped-utility-icon render sites (`BuildEditorView.tsx`,
the picker's own option-list icons) — none exist; the slot button was the only gap. Typecheck clean.

## Session 67 — Curated Ranger's 3 Druid Glyphs' non-celestial-form Damage coefficients

Landed the TODO item Session 66 split out ("the one piece the flip-target curation pass didn't
cover"). Glyph of the Tides/Glyph of Alignment/Glyph of Equality each have a non-celestial-form cast
whose real Damage fact lives on a `glyphFormVariants` variant id, not the canonical equippable id
(which carries only a sparse, generic fact set) — the rendering gap was already fixed (Session 64),
this just needed the wiki-verification pass. Each variant id has its own wiki page, titled
`"<Glyph name> (non-celestial)"`, findable via `insource:"<id>"` search; fetched raw wikitext with
`curl -G ... --data-urlencode` (never WebFetch's summarizing model) and cross-checked the version
history for each (Tides/Equality's history entries explicitly confirm the "reduced power coefficient
from 1.5 to 0.01" 2020-02-25 competitive split, corroborating the fact-tag value independent of the
infobox read):

- Glyph of the Tides, non-celestial cast (id 30448, canonical 30238). Page's `split` header lists a
  3-way pve/wvw/pvp split, but the damage fact tag itself only splits `game mode = pve` (1.5) vs.
  `game mode = pvp wvw` (0.01) — WvW value used, same "fact tag's own grouping wins over the header"
  convention as Frost Trap earlier in the sweep.
- Glyph of Alignment, non-celestial cast (id 31607, canonical 31322). No split at all — the damage
  fact tag carries no `game mode=` param (only its Bleeding-duration fact does). Coefficient 0.5.
- Glyph of Equality, non-celestial cast (id 31658, canonical 31746). Same shape as Tides: 3-way
  header, `game mode=pve` (1.5) vs. `game mode=wvw pvp` (0.01) fact tag — WvW value used.

All 3 added to `CURATED_DAMAGE_COEFFICIENTS` in `damage-calc.ts`, `factText: 'Damage'`,
`weapon: 'unequipped'` (matches every other Ranger Utility-slot entry). Typecheck clean. Removed from
TODO.md.

## Session 66 — Curated the flip-target Damage coefficients the stacked-icon display unblocked

Landed the TODO item split out 2026-08-04 ("curate the already-reachable flip-target Damage/Healing
coefficients") — the flip-skill stacked-icon display (Session 65) gives every `flipSkill` target its
own icon + independently-computed tooltip keyed on its own id (`skillTooltipContent(f.skill, ...)` in
`FlipSkillStack`, confirmed by reading `SkillsEditor.tsx` directly rather than assuming), so every
skill the Damage sweep had previously left uncurated as "real fact, dead data no UI path reaches" is
now reachable. Removed from TODO.md; the one piece this pass didn't cover (Ranger's 3 Glyph forms'
non-celestial-form casts) got its own new TODO item instead of a dangling reference.

- **9 ids curated in `CURATED_DAMAGE_COEFFICIENTS`** (`damage-calc.ts`), each wiki-verified via raw
  wikitext (`curl -G ... --data-urlencode`, never WebFetch's summarizing model) and cross-checked
  against the real local `skills.json` fact set, then spot-run through `damageLinesForSkill` via a
  throwaway tsx script (not just assumed correct from the wikitext read) before landing:
  - Revenant's Chaotic Release (28075, Legendary Dragon Stance's elite facet release) — PvE/WvW+PvP
    split 4.0/0.01, WvW used.
  - Elementalist's Tailored Victory (44637, Weave Self's release) — split 0.75/0.01, WvW used.
  - Engineer/Holosmith's Launch Wall (40533, Photon Wall's flip target) — split 1.5/0.5, WvW used.
  - Elementalist/Evoker's 3 Meditations, curated under their flip-target ids: Hare's Agility (76583,
    split 0.4/0.5 — a rare *inverted* split, competitive higher than PvE, matching this table's
    existing Arcane Wave entry), Toad's Fortitude (77247, split 1.5/0.5), Fox's Fury (77282, no
    PvE/WvW/PvP split but 3 independently-split-by-Might-stacks facts, 3.0/2.25/1.5 — the API's
    "10–20 Might" fact label uses an en dash, matched verbatim).
  - Thief's 2 Preparation skills' flip targets, re-confirmed (not assumed from the original sweep
    note) to actually carry Damage facts before curating: Pitfall (56880, 2 independently-split
    facts — "Initial Impact Damage" 1.25/0.01, "Pulse Damage" 0.5/0.3, WvW used for both) and
    Thousand Needles (56898, no split — "Damage" 0.5, "Pulsing Damage" 0.2).
  - Deadeye's Shadow Swap (45672, Shadow Flare's flip target) — spotted as a related case while
    verifying the Thief Preparation pair (Shadow Flare, already equippable and curated, has its own
    `flipSkill` hop to Shadow Swap, which was left excluded in the original sweep); no split, 1.0.
- None of these 9 ids carry a Healing fact (checked each skill's full fact list directly), so no
  `CURATED_HEALING_COEFFICIENTS` additions were needed despite the TODO item's title mentioning both
  tables.
- **TODO.md's historical Damage-sweep write-up updated in place** everywhere these 9 skills were
  previously described as excluded/uncurated ("dead data," "no substitute id to curate under," etc.)
  so a future session resuming the still-open Weapon-slot leg doesn't re-read stale status.
- **New standalone TODO item added**: Ranger's 3 Glyph forms (Glyph of the Tides/Alignment/Equality)
  hit the same architecture-gap shape via `glyphFormVariants` rather than `flipSkill`, and the
  rendering side was fixed back in Session 64, but the actual wiki-coefficient curation for their 3
  non-celestial-form variant ids was never done and had become a dangling "see the item near the top
  of this file" reference once the old umbrella item was removed — restored as its own item rather
  than left broken.
- Verified with `npm run typecheck` and `npm run lint`, both clean.

## Session 65 — Flip-skill stacked-icon display

Implemented sub-item 1 ("gw2skills-style stacked icons for genuine flip pairs") of the "Flip-skill /
facet display" TODO item scoped 2026-08-04 — the user provided the reference screenshot this item
was blocked on. Sub-item 2 (Druid Glyph forms' swap-not-stack toggle) landed in Session 64. This item
is now fully done; removed from TODO.md.

- **`multi-effect.ts` split in two**: `relatedVariantSkills` now only returns attunement variants
  (documentation-style, never simultaneously active — unchanged shape, just narrower). A new
  `flipTargetSkills(skill, skillsById)` walks the `flipSkill` chain plus a Firebrand mantra's
  hand-curated Final Charge hop (`MANTRA_FINAL_CHARGE_IDS`) — the same walk `relatedVariantSkills`
  used to do inline, extracted so it can drive its own icon stack instead of nested tooltip text.
  Same Vindicator Aspect exception preserved (Legend7's 5 Archemorus ids return empty — that's a
  toggle, not a stack, already exposed by its own button).
- **`SkillsEditor.tsx`'s `skillTooltipContent`** no longer nests a flip target's facts as text inside
  the base skill's own tooltip — only attunement variants still render that way. Flip targets get
  their own icon now (see below), each with an independently-computed tooltip via the same
  `skillTooltipContent`/`boonConditionFactsForSkill` path the base skill uses.
- **New exported `FlipSkillStack` component** (`SkillsEditor.tsx`): given a skill, renders a small
  vertical stack of icons — one per `flipTargetSkills` entry — below the base skill's slot, each
  wrapped in its own `Tooltip`. Renders `null` for the overwhelming majority of skills (no flip
  target) or an empty slot.
- **Wired into all 3 places a skill icon renders in the skill bar**: `StandardSkillsEditor`'s
  Heal/Utility/Elite slots, `RevenantSkillsEditor`'s legend bar, and `WeaponSkillBar`'s weapon-skill
  row (both the plain weapon-skill branch and the kit/bundle branch — tome chapters skipped, they're
  a different type with no `flipSkill` field). Each slot's `<Tooltip><button>...</button></Tooltip>`
  pair is now wrapped in a `.skill-slot-stack` div alongside its `FlipSkillStack`, so `.skill-bar`'s
  existing flex-row layout keeps working unchanged (a skill with no flip target is a no-op wrapper).
- **New CSS**: `.skill-slot-stack` (flex column wrapper), `.skill-slot-flip-stack` (the icon column
  itself), `.skill-slot-flip-icon` (26px, down from the 48px `.skill-slot-button`, plain `--border`
  treatment — deliberately not `--accent`, which already means "currently selected/open" elsewhere
  in this bar).
- Verified with `npm run typecheck` and `npm run lint`, both clean. Not visually verified in the
  running app (Electron sandbox limitation, see `electron_sandbox_limitation` memory) — worth a
  live look next session to confirm the stacked icons land close to the reference screenshot's
  sizing/spacing.
- Housekeeping: `tsc --build tsconfig.json` (not this repo's `npm run typecheck`, which correctly
  uses `--noEmit`) clobbers `src/preload/index.d.ts` down to a stub and litters ~220 stray
  `.js`/`.d.ts` files across `src/`/`scripts/` — don't run bare `tsc --build` in this repo again,
  `npm run typecheck` is the right command.
- **Follow-up same session, after the user saw it live**: flip icons resized from 26px to the full
  48px `skill-slot-button` footprint (matches better than a shrunk secondary icon). To keep that
  from growing the 3-column row's overall height, the "Skills" section (`BuildEditorView.tsx`)
  stopped using `.build-editor-column-pushed` (which pushed it flush to the column's bottom via
  `margin-top: auto`) and now sits in normal flow right after the Boons/Conditions divider — the
  taller icon stack eats into what used to be blank push-down space above Skills instead of
  extending past the box; any leftover slack now lands below Skills, out of view. Traits (column 1)
  still uses the pushed treatment, unaffected.

## Session 64 — Druid Glyph forms: swap-not-stack fact rendering

Implemented sub-item 2 ("Form-toggle-dependent skills") of the "Flip-skill / facet display" TODO
item scoped 2026-08-04 — the `Build.activeBundleSkillId`-driven "swap, not stack" toggle read the
item asked for, reusing the same shape Session 63's Vindicator Aspect-swap toggle just established.
Sub-item 1 (gw2skills-style stacked icons for genuine flip pairs, e.g. Legendary Stance facets) is
still open, blocked on the user's reference screenshot for the exact layout. Full writeup in
`docs/game-data.md`'s "Druid Glyph forms" addendum; summary:

- **The picker-collapse fix (`glyph-form-variants.json`, an earlier session) only hid the 2
  non-equippable form-variant ids — it never stitched their real facts back onto the canonical id's
  tooltip**, so every Druid Glyph's tooltip always showed the canonical id's own sparse, generic
  fact set regardless of which form (normal / Celestial Avatar) was actually active. Flagged as a
  real architecture gap during the 2026-08-04 Damage sweep (Ranger/Elementalist Utility-slot legs).
- **`GlyphFormVariantMap`'s value changed from a bare canonical id to `{ canonicalId, form: 'normal'
  | 'celestial' }`** — the wiki page titles the fetch script already visits ("<name>
  (non-celestial)" / "<name> (Celestial Avatar)") always said which form each variant was; the
  script was just discarding that half of the information. `scripts/fetch-glyph-forms.ts` now
  classifies by title suffix and fails the group (logged, unresolved) on a title matching neither —
  same fail-safe posture as everywhere else in that script. All 6 known groups still resolve
  cleanly on a live re-run.
- **New `skill-calc/glyph-forms.ts`'s `glyphFormFactSourceSkill`**: given a skill and whether the
  build's Celestial Avatar toggle is on, resolves to the matching form-variant `Skill` to read facts
  from, or `null` for every non-Glyph skill (fails open, unchanged behavior for everything else).
- **`SkillsEditor.tsx`'s `skillTooltipContent`** now swaps its *entire* rendered tooltip
  (description + curated Damage/Healing numeric lines + generic boon/condition facts) to the
  resolved variant's own when one is found — not just the curated number, since the 2 forms are
  different underlying skills with different generic fact sets too, not just different values on
  the same fact.
- Toggle read is `build.activeBundleSkillId === CELESTIAL_AVATAR_SKILL_ID`, the same field
  `WeaponSkillBar` already flips on the Celestial Avatar F5 click — that constant is now exported
  from `bundle-skills.ts` instead of being module-private.
- `SkillVariantContext` gained `glyphFormVariants`/`celestialAvatarActive` fields; every
  construction site (`SkillsEditor.tsx` x2, `ProfessionMechanicBar.tsx`, `WeaponSkillBar.tsx`,
  `PetsEditor.tsx`) now passes them — harmless everywhere a Glyph can never appear (Revenant's
  Legend bar, the F-bar, pet skills), verified by what `glyphFormFactSourceSkill` actually matches
  on, not assumed safe.
- Verified end-to-end via a throwaway script (not committed): all 6 canonical ids resolve to the
  wiki-correct normal/celestial variant in both toggle states, and `CURATED_HEALING_COEFFICIENTS`'s
  2 pre-existing celestial-form entries (31348 Glyph of Alignment, 31888 Glyph of Burgeoning,
  seeded 2026-08-02 before this gap was even known) are confirmed reachable now, not still dead
  data. `npm run typecheck`/`lint` both clean. Not visually confirmed in a running window (standing
  Electron-sandbox limitation).
- **Not done this session**: the 6 non-celestial-form Damage coefficients this gap was blocking
  (`damage-calc.ts`'s Ranger Utility-slot block comment) still need their own wiki-verification
  pass — this only removed the architecture blocker. The picker/bar icon also still always shows
  the canonical id's icon rather than swapping to the celestial-form's distinct one while the
  toggle is on — a cosmetic gap, not a facts gap, left as a documented known limitation.

## Session 63 — Vindicator's Aspect-swap toggle (Legendary Alliance Stance)

Implemented the display-side fix the "Legendary Alliance Stance" item under "Profession-mechanic
data" flagged as future work: Legend7's heal/utility/elite bar previously always showed the
"Aspect of the Archemorus" ids with the "Aspect of Saint Viktor" counterparts only visible as a
stacked tooltip variant (`relatedVariantSkills`' flip-chain walk). Live-verified against the wiki's
"Alliance Tactics" page (F3, "Swap your Legendary Alliance Stance skills", 3s recharge) that this is
actually a real in-combat manual toggle swapping all 5 slots at once — the same "hit a button, the
whole kit's display swaps" shape as a Kit/Tome/Celestial Avatar toggling the weapon bar
(`Build.activeBundleSkillId`), not an on/release pair like every other Legend's own `flipSkill` link
(which touches only 1 of 5 slots, and correctly stays a stacked tooltip variant).

- **Alliance Tactics (62729) was a 6th instance of the "real F-button missing from
  `professionSkills` entirely" API gap** already seen for Guardian Dragonhunter's virtues and
  Thief Specter's F1/F2 (`profession-mechanic.ts`) — confirmed live it's correctly tagged
  `specializationId: 69` (Vindicator)/`slot: "Profession_3"` in `/v2/skills` but absent from
  Revenant's `professionSkills` array, so Vindicator's F3 slot silently showed nothing before this.
  Hand-injected via a new `VINDICATOR_MECHANIC_SKILLS` constant, same pattern as
  `DRAGONHUNTER_VIRTUE_SKILLS`/`SPECTER_MECHANIC_SKILLS`.
- **New `Build.vindicatorAspectFlipped` boolean** (display-only, same "both states always
  contribute to totals" convention as `rangerUnleashed`/`activeLegendIndex` — boon/condition totals
  were already correct via `sources.ts`'s `withFlipChain`, fixed in Session 31, well before this
  toggle existed). Toggled by clicking the newly-surfaced F3 icon in `ProfessionMechanicBar`
  (5th clickable case there, alongside the Kit/Tome/Celestial-Avatar bundle toggle, Evoker's
  familiar cycle, and Thief's Stolen Skill picker).
- **New `skill-calc/vindicator-aspect.ts`**: `VINDICATOR_ASPECT_ARCHEMORUS_IDS` (the 5 canonical
  `legends.json` ids for Legend7 — `62719` Selfish Spirit, `62832` Nomad's Advance, `62962`
  Scavenger Burst, `62878` Reaver's Rage, `62942` Spear of Archemorus) and
  `vindicatorAspectSkillId(baseId, flipped, skillsById)`, a 1-hop `flipSkill` lookup (not a chain
  walk — the elite's own further hop, `62687` Urn of Saint Viktor -> `62738` Drop Urn of Saint
  Viktor, is the urn's own follow-up cast, a different kind of link, not a third aspect).
  `RevenantSkillsEditor`'s `bar` section (`SkillsEditor.tsx`) now resolves each of Legend7's 5 slots
  through this helper instead of always rendering the raw `legends.json` id.
- **`relatedVariantSkills` (`multi-effect.ts`) now skips its flip-chain walk for the 5 canonical
  Archemorus ids specifically** — otherwise the tooltip would double-signal the same swap (once as
  the toggle button, once as a stacked variant), the exact "stack vs. swap" distinction the
  `exception_handling_decisions_2026-08-04` memory's flip-skill-display item called for but hadn't
  been applied to this family yet. Verified the exclusion doesn't break the elite's legitimate
  further hop: `relatedVariantSkills` on the Archemorus elite id now returns `[]`, while calling it
  on the Saint Viktor id (once resolved via the toggle) still correctly returns `[Drop Urn of Saint
  Viktor]`.
- Narrowed (not resolved) the adjacent open TODO item about Scavenger Burst/Tree Song's other
  duplicate ids (`62841`/`62793`) — confirmed those aren't part of this Aspect-swap family at all
  (no `legends.json` reference, no `flipSkill` link to anything), so whatever they are remains a
  separate, still-open mystery; updated that bullet's framing since it previously (incorrectly)
  attributed the Aspect mechanic itself to "legend swap mid-cast."
- Verified via a standalone script (not committed): `professionMechanicBar` surfaces Alliance
  Tactics as F3 only when Vindicator's specialization id is in the equipped set; all 5 slots'
  `vindicatorAspectSkillId` outputs match the hand-verified wiki mapping in both toggle states;
  `relatedVariantSkills`'s exclusion behaves as described above. `npm run typecheck`/`lint`/`build`
  all clean. Not visually confirmed in a running window (standing Electron-sandbox limitation) —
  recommend `npm run dev` locally to eyeball a Vindicator/Legend7 build's F3 icon and the
  heal/utility/elite bar swapping on click.

## Session 62 — Full skill-picker duplicate-id audit

Built the audit bumped ahead of the Weapon-slot Damage sweep 2026-08-04 (see
`exception_handling_decisions_2026-08-04` memory). New `scripts/audit-skill-picker-duplicates.ts`
(`npm run audit-skill-picker-duplicates`) supersedes `fetch-skill-duplicate-resolutions.ts`'s coverage
gap: that script only wiki-checks a same-name group when `visibleSkillsForSlot` still returns >1 id
for it, but an in-code signal (GroundTargeted collapse, specialization-match) can already narrow a
group to exactly 1 id *before* any wiki cross-check runs, so a stale/defunct id can silently win. The
new script checks every same-name group with >1 raw candidate id across every (profession, slot,
elite-spec-state) combination — a spec-less baseline plus each profession's 4 elite specs individually
— and verifies whatever id(s) the real `visibleSkillsForSlot` resolved to against the skill's own wiki
infobox `id=` field.

**First run found 36 candidate mismatches; about a third turned out to be false positives**, caught by
hand before writing anything: wiki pages routinely document only a skill's spec-less base id and say
nothing about a same-name elite-spec rework living under its own id (Dragonhunter's Renewed Focus
`68666`, Conduit's Call to Anguish `78798`/Banish Enchantment `78587`, etc.) — both real, confirmed via
live `/v2/skills` pulls (differing `traited_facts`, or a `flipSkill` link from the base id to the
"missing" one) and in several cases already correctly curated under both ids in
`CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS` with a comment explaining why. Reverted
those 8 ids from exclusion (Renewed Focus, "Feel My Wrath!", Signet of Courage, Pain Absorption,
Empowering Misery, Banish Enchantment, Call to Anguish ×2) plus 2 more in the same Vindicator
Legendary-Alliance legend-swap family (Tree Song, Scavenger Burst — `62962`'s own `flipSkill` points at
Tree Song's `62941`, the in-game "casting Scavenger Burst turns into Tree Song" legend swap; too
entangled to resolve confidently from data alone, left alone pending a dedicated look).

Hardened the script itself so a future re-run can't silently reintroduce this class of false positive:
an id is now only auto-excluded when it (1) shares the resolved-good id's own `specializationId`, (2)
has no `flipSkill` link to/from another id in the same raw group, and (3) isn't already a
`CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS` key — anything failing one of those is
logged as "needs manual review" instead of excluded. Re-running against the final state confirms
convergence: 0 new bugs, the same 10 ids (the 8 reverted above, corroborated a second way this run) all
correctly flagged as needing manual review rather than re-excluded.

**28 ids added to `skill-variant-exclusions.json`** (34 → 62 total) for genuine bugs, in 3 evidence
tiers: (1) confirmed via a dedicated wiki "(underwater)" sibling page carrying the exact excluded id —
Banner of Strength/Discipline/Tactics/Defense, Battle Standard, Supply Crate (6 ids) — these aren't a
land ground-target-toggle pair at all, the non-ground id is a different, non-land skill entirely; (2)
confirmed via a dedicated newest-elite-spec wiki page (`specialization = Galeshot/Evoker` +
its own `id=`) naming the other id as canonical — Perfect Storm, Elemental Procession, Otter's
Compassion (3 ids); (3) confirmed via zero wiki full-text search hits anywhere (`insource:"id = N"`),
matching the original Lightning Flash/Ranger Mistral precedent — Signet of Mercy, Purging Flames,
Storm/Stone/Frost/Sun Spirit, Spirit of Nature, Water Spirit, Veil, Null Field, Illusion of Life,
Feedback, Signet of Undeath, Bow of Truth's auto-target pair (a 4th Guardian Spirit Weapon nobody had
found yet), Embrace the Darkness, Sanctuary (19 ids). Re-keyed 5 `CURATED_DAMAGE_COEFFICIENTS`/
`CURATED_HEALING_COEFFICIENTS` entries that were pointed at a now-excluded id onto its real sibling
(Banner of Strength/Discipline, Elemental Blast, Inspiring Reinforcement, Water Spirit) and removed 2
now-unreachable duplicate entries (Bow of Truth's `46600`/`46750`).

The 4 groups with no signal at all (Engineer "Throw Mine," Elementalist "Mist Form," Revenant
"Protective Solace"/"Jade Winds") stayed unresolved — this audit's wiki-id= method doesn't apply since
their own wiki pages list every local id together with no distinguishing field, unchanged from before.
`typecheck`/`lint` both pass clean; not visually spot-checked in the running app (Electron sandbox
limitation).

## Session 61 — Synthetic-fact injection for skills the API returns with no usable facts at all

`CURATED_HEALING_COEFFICIENTS`/`CURATED_DAMAGE_COEFFICIENTS` only ever render a number when a real
matching `Fact` object exists on the skill for the tooltip-line renderers (`skillFactLines`,
`healingLinesForSkill`) to gate on — the fact's own `value` is never read, it's purely a presence
check. Mesmer's Tale of the Second Scion (id 76695, Troubadour's Heal skill) has zero
`AttributeAdjust`/Healing facts in a live API pull, confirmed not a stale-cache issue — no curated
table entry could ever render, no matter how good the wiki-sourced coefficient was.

Built the fix flagged in TODO.md 2026-08-02: `data/game-data/synthetic-facts.json`, a hand-maintained
`{ [skillId]: Fact[] }` map merged into each matching skill's `.facts` once, at load time
(`load-game-data.ts`'s new `withSyntheticFacts`) — same shape/spirit as `wvw-fact-overrides.json` but
insertion instead of value-override. Once merged, an injected fact is indistinguishable from a real
API one to every consumer (tooltip rendering, curated-coefficient gating, generic fallback), so no
special-casing was needed anywhere outside the loader. Documented in docs/game-data.md alongside the
`wvw-fact-overrides.json` writeup, including when/how to add a future entry.

Pulled Tale of the Second Scion's raw wikitext (`action=raw`, not a summarized fetch) and added the
first entries: "Self-Healing" (base 3535, no PvE/WvW split) and "Ally Healing" (base 2250,
coefficient-only split — PvE 1.0, WvW/PvP 0.5, WvW value used). Confirmed via the wiki's own version
history that this skill's Ally Healing coefficient was nerfed 1.0 → 0.5 in WvW/PvP as recently as
2026-01-13, a real example of the balance-patch-tracking gap discussed the same session. Left the
skill's separate "Scion's Reprieve" self-buff (+15%/+20% Heal Effectiveness) unmodeled — this app has
no general outgoing/incoming-heal-modifier concept yet, a distinct and larger gap, tracked as its own
new TODO item. `typecheck` and `lint` both pass clean; not visually spot-checked in the running app
(Electron sandbox limitation, same caveat as every prior session touching these tables).

## Session 60 — Full Weapon-slot category sweep for `CURATED_HEALING_COEFFICIENTS` (last category)

Completed the category-sweep plan from Sessions 57-59 (Heal → Utility → Elite → Weapon skills).
Enumerated every distinct weapon-skill id across all professions' weapons (main-hand, off-hand,
two-handed, underwater, every elite-spec weapon including the newer Janthir Wilds Spear) via
`professions.json`'s `weapons[].skills` — 648 distinct ids, the largest surface of any category so
far. Of those, 110 carry a Healing-type `AttributeAdjust` fact.

Two known traps plus one newly-discovered one narrowed the field before any wiki research started:
- 17 were the familiar Barrier-mislabeling trap (API tags Barrier facts `target: 'Healing'` too).
- 38 — nearly every initiative-costing Thief weapon skill — turned out to all be the same shared
  trait, Assassin's Reward (id 1238, "heal yourself...for each point of initiative spent"),
  duplicated onto each skill's own facts as a `requires_trait`-gated entry. This is a trait formula,
  not a per-skill design, so none of these belong in a per-skill coefficient table — flagged as its
  own new TODO item (a future generic trait-bonus table, mirroring `FURY_CRIT_CHANCE_TRAIT_BONUSES`,
  would be the right home for it).
- A local-data cross-check (comparing every "genuine" candidate's `requires_trait` field against
  `skills.json`, not just the raw candidate scan) caught a one-off instance of the same shape:
  Necromancer's Chillblains (id 10605) has no unconditional Healing fact at all — its only one
  requires trait 778 (Transfusion) — excluded the same way.

That left 55 genuine candidates across 8 professions (Elementalist 20, Guardian 8, Necromancer 9,
Mesmer 3, Ranger 5, Revenant 5, Thief 1, Warrior 3, Engineer 1). Dispatched one research agent per
profession in parallel (small professions batched into one agent), each fetching raw wikitext
directly via curl — same methodology as every prior sweep, never a summarizing WebFetch. 49 of the
55 landed in `healing-calc.ts`'s new "Weapon-slot skills" section; 6 stayed uncurated after
investigation (see TODO.md for the per-skill writeup: Etching: Jökulhlaup's missing coefficient,
Death Spiral's wiki stub tag, Life Siphon's genuine wiki/API base-value conflict, Astral Wisp's
post-rework pulse-count ambiguity, Shadow Veil's unresolvable factText collision, and Chillblains'
trait-only gating).

`CURATED_HEALING_COEFFICIENTS` is now a complete pass over Heal + Utility + Elite + Weapon slots
across every profession — the full category-sweep plan from Session 57 is done. `typecheck` and
`lint` both pass clean on the new entries; not visually spot-checked in the running app (Electron
sandbox limitation, same caveat as every prior session touching this table).

## Session 59 — Full Elite-skill category sweep for `CURATED_HEALING_COEFFICIENTS`

Continuation of Sessions 57-58's category-sweep plan (Heal → Utility → Elite → weapon skills, now the
last one remaining). Scanned `data/game-data/skills.json` for every `slot: 'Elite'` skill with a
qualifying `AttributeAdjust`/`target: 'Healing'` fact: only 12 candidates, a far smaller surface than
Heal (85) or Utility (40). Of those, 1 (Warrior's "We Will Never Yield!", id 76562) was the same API
Barrier-mislabeling trap already logged in the Barrier TODO item — its 2 Healing-tagged facts are
literally named "Minimum Barrier"/"Maximum Barrier" — excluded, not added to that TODO list again
since it's the same known issue.

That left 11 genuine Healing candidates across 6 professions (Elementalist, Guardian, Necromancer,
Ranger, Revenant, plus none for Engineer/Mesmer/Thief/Warrior at this slot). Small enough to fetch
directly via `curl` against raw wikitext in the main session rather than dispatching per-profession
research agents. 10 of 11 landed in `CURATED_HEALING_COEFFICIENTS`; 1 stayed uncurated — Revenant's
Energy Expulsion (id 29114): a fresh live `/v2/skills/29114` pull confirmed the GW2 API itself still
returns a completely different fact set (a "Healing Fragment"/"Number of Fragments"/"Knockback"
mechanic) than the wiki's current page describes (a single knockdown+heal, no fragments at all) — a
genuine unresolved API/wiki mechanic mismatch, not a stale local cache, left uncurated rather than
guessing which source to trust.

Notable findings during curation:
- Guardian's Signet of Courage has a 4th Healing fact sharing the exact same text ("Passive Healing")
  as its base passive heal — this one is the Perfect Inscriptions trait's (+20%) boosted variant
  (`requires_trait` 579), not a game-mode split. Same identical-text collision already documented on
  Thief's Signet of Malice (Session 57) — only the untraited baseline is curated, the trait-boosted
  number isn't reflected in this app yet.
- Ranger's two "Glyph of the Stars" ids are genuinely different sub-skills (the wiki's own
  "(Celestial Avatar)" vs. "(non-celestial)" cast-form sub-pages), each with its own base
  value/coefficient — not duplicates and not a game-mode split.
- Revenant's Soulcleave's Summit and Necromancer's Xinrae's Weapon both split PvE/WvW/PvP by
  coefficient as well as base value on their Life Siphon Healing facts, but the WvW grouping direction
  differs between them (Soulcleave's Summit: WvW groups with PvE; Xinrae's Weapon: WvW groups with
  PvP) — confirms this has to be checked per-skill, never assumed from another skill's precedent.

Typecheck and lint both pass. Not visually spot-checked in the running app (Electron sandbox
limitation, same as prior sessions). Weapon skills are next and last in the category-sweep plan — the
largest remaining surface (every weapon × profession × spec-driven skill-3 replacement etc.).

## Session 58 — Full Utility-skill category sweep for `CURATED_HEALING_COEFFICIENTS`

Continuation of Session 57's category-sweep plan (Heal → Utility → Elite → weapon skills). Scanned
`data/game-data/skills.json` for every `slot: 'Utility'` skill with a qualifying `AttributeAdjust`/
`target: 'Healing'` fact: 40 candidates found. Of those, 17 turned out to actually be Barrier facts —
the GW2 API mislabels Barrier's `target` as "Healing" too, not just genuine heals (e.g. Barrier
Signet, Banner of Defense, Bulwark Gyro, Utility Goggles, Serpent Siphon). Barrier is a separate
resource bar this app doesn't model at all (same exclusion already made for Necromancer's Sand Flare
in the Heal-slot sweep) — logged as its own new TODO.md item since the Utility category made clear
just how common it is (nearly half the candidates), worth a dedicated `CURATED_BARRIER_COEFFICIENTS`
scoping pass at some point.

That left 23 genuine Healing candidates across 8 professions (no Mesmer Utility skill heals at all).
8 parallel research agents, one per profession, each fetched every skill's raw wikitext directly via
`curl` (never WebFetch, same rigor as Session 57) and cross-checked the wiki's PvE value against this
app's own API base value before trusting a coefficient. 20 of 23 landed in
`CURATED_HEALING_COEFFICIENTS`; 3 stayed uncurated — Guardian's underwater Sanctuary variant (id
31295, no wiki-documented coefficient exists for it), Guardian's Repose (id 62669, the wiki's own
coefficient field is a literal unfilled "?" stub), and Revenant's Natural Harmony (id 29082, wiki base
1124 vs. this app's own live API base 1620 — independently reconfirmed against a fresh
`/v2/skills/29082` pull, a genuine disagreement not a stale read). See TODO.md for the per-skill
reasoning.

Notable findings during curation:
- Several duplicate same-name-but-different-value ids resolved to real distinct mechanics, not
  errors: Guardian's two "Sanctuary" ids are a ground-targeted skill vs. a frozen pre-2016-balance
  underwater/self-cast copy; Ranger's two "Glyph of Burgeoning" ids are the same skill's
  non-Celestial-Avatar-form (heals) vs. Celestial-Avatar-form (grants Barrier instead) casts.
- Guardian's Merciful Intervention and Necromancer's Nightmare Weapon both have two `AttributeAdjust`
  facts sharing the *exact same* fact text ("Healing" / "Life Siphon Healing" respectively) on the
  wiki itself, not just in this app's data — confirmed these are PvE-vs-WvW/PvP game-mode splits the
  API flattens into duplicate-labeled facts (same shape as Thief's Signet of Malice from Session 57),
  so only the WvW-correct pair was curated for each.

Typecheck and lint both pass. Not visually spot-checked in the running app (Electron sandbox
limitation, same as prior sessions) — still worth doing before the next category (Elite skills).

## Session 57 — Full Heal-skill category sweep for `CURATED_HEALING_COEFFICIENTS`; Firebrand mantra Final Charge fix

User pushed back on continuing to curate Healing coefficients build-by-build: "the spirit of
theorycrafting is scouting all classes for unique optimizations, not just through builds — but
through class combinations as well." Agreed strategy going forward: full category sweep across every
profession before moving to the next category (Heal → Utility → Elite → weapon skills, weapon skills
saved for last since that's the largest surface area). See `heal_coefficient_curation_strategy`
memory.

Swept all 85 candidate Heal-slot skills found via a full `data/game-data/skills.json` scan (every
skill with `slot: 'Heal'` and a qualifying `AttributeAdjust`/`target: 'Healing'` fact) — 9 parallel
research agents, one per profession, each fetched every skill's raw wikitext directly via `curl`
(never through WebFetch's summarizing model — a prior session's WebFetch summary produced a real
wrong number, see `healing_damage_coefficient_curation` memory) and cross-checked the wiki's PvE
value against this app's own API base value before trusting a coefficient. 81 of 85 skills landed in
`CURATED_HEALING_COEFFICIENTS`; 4 stayed uncurated where the wiki and this app's own API data
genuinely disagree (Elementalist Aquatic Stance, Engineer Mitotic State, Necromancer Summon Blood
Fiend, Necromancer's second Well of Blood id) — see TODO.md for the per-skill reasoning, not guessed.

Caught two real bugs during review, both fixed before landing:
- Had written placeholder Revenant coefficients into the file before that profession's research
  agent had actually returned — caught on review and corrected against the real report. A reminder
  that even inside a otherwise-rigorous pipeline, a rushed edit can reintroduce exactly the guessing
  the rigor exists to prevent.
- Thief's Signet of Malice has two `AttributeAdjust`/Healing facts that share the *exact same* fact
  `text` ("Healing") — this table's lookup matches by that string, so curating both under one label
  would let the second silently overwrite the first everywhere it's read (`skillFactLines`'s
  `Map`-based lookup keeps only the last of any duplicate key). Fixed to curate only the active heal,
  same reasoning `CURATED_HEALING_COEFFICIENTS`'s Healing Signet entry already documents for its own
  passive-tick exclusion.

Also fixed several elite-specialization names in existing/new curated-table comments that didn't
match this app's own `specializations.json` (e.g. Firebrand's Mantra of Solace charges were labeled
"Willbender", Revenant's Conduit variant was labeled "Vindicator") — comments only, no data changes.

Separately, user spot-checked the app against gw2skills.net and reported two more gaps:
1. Mesmer Troubadour's "Tale of the Second Scion" heal skill shows no numbers at all — root-caused to
   the GW2 API returning zero `AttributeAdjust` facts for this skill (unlike every other Heal skill
   checked this session), not a missing curated-table entry. Logged in TODO.md as its own follow-up
   (needs a wiki-only synthetic-fact mechanism, an architecture change).
2. Firebrand's Heal mantra ("Mantra of Solace") was missing its "Final Charge" sub-skill
   (Rejuvenating Respite) from the combined tooltip. Root cause: a mantra's `flipSkill` chain only
   ever reaches the regular charge — the API has no field linking the regular charge (or the mantra
   itself) forward to the Final Charge skill at all. Fixed by hand-curating the link for all 6
   Firebrand mantras (`src/shared/skill-calc/mantra-final-charge.ts`, `MANTRA_FINAL_CHARGE_IDS`,
   matched by shared `specializationId` 62 plus each Final Charge skill's `description` starting
   "Final Charge." and its thematic effect matching the regular charge) and wiring it into
   `multi-effect.ts`'s `relatedVariantSkills` as one more hop after the `flipSkill` walk ends.

Typecheck and lint both pass. Not visually spot-checked in the running app (Electron sandbox
limitation, same as Sessions 54-56) — still worth doing before the next category (Utility skills).

## Session 56 — Healing/Damage real numbers moved from the summary row into each skill's own tooltip

User feedback right after Session 55 landed: the standalone "Damage" row (mirroring the "Healing"
row from Session 54) was hard to read — a single icon whose tooltip lists every curated skill's
number, disconnected from the skill it belongs to, rather than the number showing up where you'd
naturally look for it (on the skill itself, next to its icon). Asked whether Healing should move the
same way for consistency rather than leaving two different UI patterns for near-identical data — user
agreed. Both rows are gone; both curated tables (`CURATED_HEALING_COEFFICIENTS`/
`CURATED_DAMAGE_COEFFICIENTS`) are unchanged, only where their numbers render moved.

New `src/shared/skill-calc/skill-fact-lines.ts` (`skillFactLines`) is the skill-tooltip counterpart
to `fact-numbers.ts`'s `numericFactLines`: same per-fact walk and `requires_trait` gating, but a
`Damage`/`AttributeAdjust`-Healing fact this skill has a curated coefficient for renders its real
current-build-scaled number (labeled by the fact's own `text`, e.g. "Front Damage"/"Back damage")
instead of the generic hit-count/reference-base-value placeholder every other skill still falls back
to (`fact-numbers.ts`'s `factLine` was exported so this new module can reuse it as that fallback
without duplicating the per-fact-type switch). `SkillsEditor.tsx`'s `skillTooltipContent` — the one
function every skill tooltip in the app already routed through (Heal/Utility/Elite slots, weapon
skills, profession-mechanic F-skills, Revenant legends, pets) — now calls this instead of
`numericFactLines`; traits (`TraitsEditor.tsx`) are untouched, since neither curated table has a
trait entry yet.

Real numbers need the build's current Power/Healing Power (for consistency with `StatsPanel`, not a
recomputed-from-scratch value) and the target-armor combat-state toggle, none of which
`skillTooltipContent`'s callers previously had — `useDurationContext` (shared by `SkillsEditor`,
`WeaponSkillBar`, `ProfessionMechanicBar`, `PetsEditor`) now takes an optional `combatState` param
and returns `characterAttributes`/`targetArmor` alongside its existing `activeIds`/`durationPercent`,
threaded through `SkillVariantContext`. Mechanical but real prop-drilling: `combatState` is now a
prop on `SkillsEditor`, `WeaponSkillBar`, `ProfessionMechanicBar`, and `PetsEditor`, sourced from
`BuildEditorView`'s existing combat-state (previously only reached `StatsPanel`/
`BoonConditionSummaryPanel`). `BoonConditionSummaryPanel` lost its `combatState` prop entirely —
after removing the Healing/Damage rows nothing left in it reads combat state.

`sources.ts`'s `computeHealingSources`/`computeDamageSources` (and their `HealingSource`/
`DamageSource` types) were deleted rather than left unused — the per-skill walk they did is now
redundant with each tooltip's own call site already iterating equipped skills. `HEALING_ICON` was
deleted from `icons.ts` too (nothing references it anymore); `DAMAGE_ICON` stays, still used by
`CombatStatePanel`'s target-armor row.

Typecheck and lint both pass clean. Not visually verified in the running app (Electron sandbox
limitation, see memory) — this is now the second time that verification has been deferred across
Sessions 54-56; strongly worth doing before extending either curated table further.

## Session 55 — Damage tooltip breakdown: new "Damage" row on the Boon-Condition summary bar

Second half of the Healing/Damage tooltip-breakdown TODO item (Healing landed Session 54). Scoping
turned out bigger than Healing's: Healing only needed a wiki coefficient because the API already
told us *which skill*; Damage needed the real GW2 damage formula too, since the app tracks Power but
not the *target's* Armor (the other half of `Damage = weaponStrength * coefficient * Power /
targetArmor`, confirmed via wiki.guildwars2.com/wiki/Damage's own stated formula).

Three curation pieces, all wiki-sourced (fetched raw wikitext per skill, not paraphrased, same rigor
as `CURATED_RELIC_DAMAGE_BONUSES`/`CURATED_HEALING_COEFFICIENTS`):

- **Per-skill coefficient** (`CURATED_DAMAGE_COEFFICIENTS` in new `src/shared/skill-calc/
  damage-calc.ts`) — confirmed the API's own `Damage` fact `dmg_multiplier` only ever reflects PvE
  (same PvE-vs-WvW gap Healing found), sometimes by a lot (Mesmer's Illusionary Wave: PvE 0.3 vs
  WvW/PvP 0.01). Also found the wiki's coefficient is sometimes per-hit and sometimes pre-totaled
  across a fact's `hit_count`, distinguished by whether the wiki's own template carries a `strikes=N`
  parameter (confirmed via Whirling Axe: `strikes=15|coefficient=8.388` PvE ÷ 15 = 0.5592/hit, exactly
  matching the API's PvE `dmg_multiplier` for that fact) — entries needing the per-hit case are
  pre-multiplied by hit count before being stored, so the runtime function never needs `hit_count` at
  all. Seeded with 1 common WvW weapon skill per base profession (9 entries), each cross-checked
  against `professions.json`'s own weapon-skill-slot list to curate the actually-equippable skill id
  (not just name-matched — several names collide across multiple near-duplicate ids, e.g. Ranger's
  "Maul" has 6 in skills.json; 2 candidate skills, Zealot's Defense and Blurred Frenzy, were dropped
  after their API facts and wiki infobox didn't reconcile cleanly and swapped for a cleaner pick
  rather than guessing).
- **Weapon-strength constants** (`WEAPON_STRENGTH_MIDPOINTS`, same file) — midpoint of each weapon
  type's min-max range from wiki.guildwars2.com/wiki/Weapon_strength, the same convention
  gw2skills.net-style calculators use. Verified against a real documented number rather than trusted
  blind: Judge's Intervention (`weapon=trait skill` → `unequipped`, 690.5) × PvE coefficient 0.5 ×
  1000 Power ÷ 2597 reference Armor ≈ 133, matching the wiki's own quoted tooltip damage for that
  skill exactly — this is also why `fact-numbers.ts`'s older "20-30% off in every attempt" note no
  longer applies to this curated path (that note was about the API's `dmg_multiplier` alone, with no
  weapon-strength table backing it).
- **Target armor** — armor is the *enemy's* stat, which this app has never modeled since it only
  builds one side of a fight. Asked the user rather than guessing a single number: they pointed at
  gw2skills.net's own WvW convention (a Light/Medium/Heavy toggle, 2000/2200/2681 armor
  respectively) as the reference to match. Landed as `CombatState.targetArmorClass` (new field,
  defaults to `'Medium'`) plus a `TARGET_ARMOR_VALUES` constant in `combat-state.ts` — it rides along
  with the other ephemeral "what-if" combat inputs since it has no other natural home on a
  single-build editor, with a new 3-option dropdown in `CombatStatePanel.tsx` (icon-reused from
  `DAMAGE_ICON`, since there's no dedicated "target armor" icon in the API).

Wiring mirrors Healing exactly: `boon-calc/sources.ts` gained `computeDamageSources` (same
equipped-skill walk, traits excluded), `BoonConditionSummaryPanel` got a new single-icon "Damage" row
computed from `computeCharacterStats(...).attributes.power` and the new target-armor combat-state
value.

Typecheck and lint both pass clean. Not visually verified in the running app (Electron sandbox
limitation, see memory) — worth a live spot-check against gw2skills.net next session, same as
Healing's outstanding item, before extending either curated table further. The tooltip-visual-pass
follow-up item in TODO.md is now unblocked (both Healing and Damage content have landed).

## Session 54 — Healing tooltip breakdown: new "Healing" row on the Boon-Condition summary bar

First half of the bumped-priority Healing/Damage tooltip-breakdown TODO item (Damage still open,
see TODO.md — it needs a separate scoping pass). Discovered along the way that the item's original
assumption ("Healing is more tractable — reuse `numericFactLines`") didn't hold: the GW2 API's
`AttributeAdjust`/`target: 'Healing'` fact `value` is only the heal amount at the API's reference
build (0 bonus Healing Power), with no scaling coefficient exposed anywhere — confirmed by fetching
`api.guildwars2.com/v2/skills/5503` raw and cross-checking against the wiki's own
`{{skill fact|healing|...|coefficient=...}}` template source (not a summarized/paraphrased fetch,
after one paraphrase mismatched this app's own data for one skill). Real scaling needed a
wiki-sourced per-skill coefficient, same curation rigor as `CURATED_RELIC_DAMAGE_BONUSES`/
`FURY_CRIT_CHANCE_TRAIT_BONUSES` — new `src/shared/skill-calc/healing-calc.ts` module
(`CURATED_HEALING_COEFFICIENTS`, `healingLinesForSkill`), seeded 2026-08-02 with one common WvW heal
skill per base profession (10 entries total — Elementalist/Signet of Restoration,
Engineer/Healing Turret, Guardian/Shelter, Mesmer/Ether Feast, Necromancer/Well of Blood,
Ranger/Water Spirit, Revenant/Empowering Misery, Thief/Withdraw, Warrior/Healing Signet+Mending),
not a bulk pass over the 85 Heal-slot skills a full scan found with a qualifying fact — extend
incrementally as specific builds get tested, per that file's doc comment.

Also surfaced a real, separate WvW-value gap: several curated skills' wiki pages split healing
between a "pve" mode and a "pvp wvw" mode with *different* numbers, and WvW groups with PvP here —
the opposite of how this app's existing `wvwFactOverrides` mechanism defaults Buff-duration facts to
PvE-unless-a-verified-WvW-override-exists. `data/game-data/skills.json` only ever captured the API's
PvE-default value for these facts, so `healing-calc.ts`'s curated table stores the WvW-correct
number directly (`baseValue`/`coefficient` sourced from the wiki's "pvp wvw" split, matched against
a skill's own fact by `text` presence only, not by re-checking `fact.value`) rather than trusting the
underlying data file. The underlying data/other tooltips (skill picker, etc.) still show the PvE
number for those same facts — out of scope here, noted in TODO.md.

Wiring: `boon-calc/sources.ts` gained `computeHealingSources` (same equipped-skill walk as
`computeComboSources`, traits deliberately excluded — the curated table only covers skill-cast
heals, not trait procs) and a `HEALING_ICON` constant in `icons.ts`. `BoonConditionSummaryPanel` got
a new single-icon "Healing" row (list-per-source tooltip, same shape as the existing Combo row)
computed from `computeCharacterStats(...).attributes.healingPower` — the same Healing Power value
already shown in `StatsPanel`, so both panels agree. `BoonConditionSummaryPanel` now takes an
optional `combatState` prop (`BuildEditorView` threads its existing state through) since Healing
Power can be affected by combat-state toggles the same way other derived stats are.

Typecheck and lint both pass clean. Not visually verified in the running app (Electron sandbox
limitation, see memory) — worth a live spot-check against gw2skills.net or in-game tooltips next
session before extending the curated table further.

## Session 53 — Trait and food/utility tooltips now show structured content, not raw description

Bumped-to-priority TODO item: traits and food/utility consumables previously showed only the raw
API `description` sentence. Reused two patterns already proven elsewhere instead of inventing new
ones:

- **Traits** (`TraitsEditor.tsx`): both minor and major trait tooltips now append
  `numericFactLines(trait.facts, trait.traitedFacts, activeIds)` via `factsBlock` (imported from
  `SkillsEditor.tsx`), the same Recharge/Damage-hits/AttributeAdjust/Number/Range/Distance/Time
  formatter the skill picker already used. `activeIds` is computed locally in `TraitsEditor` from
  its own `TraitLineSlots` value (minors auto-active per equipped spec, majors per chosen id) —
  mirrors `boon-calc/sources.ts`'s `activeTraitIds` but doesn't need a full `Build`, which
  `TraitsEditor` never receives.
- **Food/utility** (`EquipmentEditor.tsx`): `foodOptions`/`utilityOptions` now build their
  description via a new `formatConsumableDescription` (`format-description.ts`), which joins
  `bonuses[].raw` lines the same way runes already do, plus a `Duration: Xm Ys` line derived from
  `durationMs`/`applyCount`. Falls back to the raw `description` untouched for buff-less
  consumables (e.g. "Feast" reagents meant to be served rather than eaten — `bonuses` is empty and
  `durationMs` is null for those). `effectName` was deliberately left unused — it's just the buff
  category label ("Nourishment"/"Enhancement") and added no information the bonus lines don't
  already convey.

Typecheck and lint both pass clean. The follow-up "visual pass over every tooltip" TODO item is
still blocked on the separate Healing/Damage tooltip breakdown item, not on this work.

## Session 52 — Two-handed weapon tooltip used the one-handed constant, not a true 2x/rounding bug

Follow-up to Session 51: the user confirmed two-handed weapons were still off and specifically
flagged that it's *not* a plain "double the one-handed number" relationship because of rounding.
That's correct — `weaponOneHanded.ascended * 2 === weaponTwoHanded.ascended` exactly (358.512 * 2 =
717.024), so `computeGearAttributeTotals`'s mirror-onto-both-slots-and-sum-raw-floats approach for
the *Stats panel total* was already exact and needed no change. The bug was narrower: `renderSlot`'s
hover tooltip (new this session-cluster) only renders on a two-handed weapon's main-hand slot (the
off-hand shows a locked "(2-handed)" placeholder, no picker), but `statOptionsFor` always resolved
the adjustment key via `weaponAdjustmentKey(slotKey)`, which is slot-based and always returns
`weaponOneHanded` for land weapon slots regardless of whether the equipped weapon is actually 1H or
2H — so the one tooltip a user sees for a 2H weapon showed the *halved* one-handed number (e.g.
Minstrel's Toughness: `round(107.5536) = 108`) instead of gw2skills' single "whole item" number
(`round(215.1072) = 215`) — and `108 * 2 = 216 ≠ 215` is exactly the "not strictly 2x" rounding
artifact the user described.

- `EquipmentEditor.tsx`: `statOptionsFor` gained an optional `adjustmentKeyOverride` param;
  `renderWeaponPair` passes `'weaponTwoHanded'` for the main-hand slot when `isTwoHanded`, so the
  tooltip shows the real two-handed value directly rather than a mirrored/halved one-handed value.
- Confirmed no other code path had this issue: `gear-optimize.ts`'s optimizer already builds one
  combined slot using `'weaponTwoHanded'` directly for a 2H weapon (never mirrors), and underwater
  weapon slots (`weaponU1/U2`) already resolve to `'weaponTwoHanded'` unconditionally since every
  aquatic weapon is confirmed two-handed — only the land main-hand tooltip needed the fix.

## Session 51 — Root cause found: stat-prefix picker saved the wrong id for armor/weapon slots

Session 50 shipped per-item hover tooltips and re-verified the `adjustment * multiplier + value`
formula was correct — but confirmed correct using `Array.find()` on a raw JSON array, which happens
to return an item's *first* matching entry, not what the app's actual dedup code path picks. The
user then sent gw2skills.net tooltip screenshots for **every single equipped piece** (both weapons,
all 6 armor pieces, all 6 trinkets), which is what actually cracked it: comparing those numbers to
what the new hover-tooltip feature displayed in-app showed every armor and weapon value was wrong,
while every trinket value happened to be right.

**Root cause**: `/v2/itemstats` returns *two different API entries* for a combo name that has both
an armor/weapon and a trinket variant (e.g. "Minstrel's" is ids 1123 *and* 1134) — same
`multiplier`, but the trinket entry has an extra flat `value` (e.g. `+25` Toughness/Healing, `+12`
Vitality/Concentration) that the armor/weapon entry doesn't. `EquipmentEditor.tsx`'s stat-prefix
picker (`dedupedStats`/`pickCanonicalStat`) deduped **both categories together** into one shared id
per name, and the "prefer fully-specified" tiebreak (nonzero `value` scores higher) always picked
the trinket entry — so picking "Minstrel's" on a helm or weapon silently saved the *trinket* id,
inflating Toughness/Vitality/Concentration/Healing Power (and any other combo with this shape) on
every armor and weapon slot in the app. Verified with a script reproducing the real dedup logic
against every one of the user's screenshotted pieces (Staff, Scepter, Shield, Helm, Shoulders,
Coat, Gloves, Leggings, Boots, Amulet, Ring, Accessory, Back) — every value now matches gw2skills
exactly after the fix, none did before.

- **`ItemStatLegalIds.armorWeapon`/`.trinket` are disjoint** (confirmed in `game-data.ts`'s existing
  doc comment) — the fix is to never merge them before deduping. `EquipmentEditor.tsx`:
  `dedupedStats` split into `dedupedStatsForCategory` (takes one category's id list), called
  separately into `armorWeaponStats`/`trinketStats`; `statOptionsFor` now takes a slot key and
  picks the right list via `itemStatCategoryForSlot`.
- **Self-healing, not a migration**: already-saved builds have the wrong id sitting in
  `equipment[slot].itemStatId` for any affected armor/weapon slot — rather than a one-time data
  migration, `attribute-totals.ts` gets `resolveItemStatId(id, statsById, legalIds, category)`: if
  a stored id isn't legal for its slot's category, look up its same-named counterpart in the
  correct category and use that instead. Wired into `computeGearAttributeTotals` (so every
  stats/boon-duration/party-summary consumer self-corrects automatically) and into
  `EquipmentEditor`'s own `chosenId` display (so a legacy build's stat prefix still shows as
  selected instead of appearing blank now that the picker's options are category-scoped). Nothing
  is ever written back to the stored build — picking a fresh value from the now-correct picker
  naturally overwrites the old id going forward.
- **Copy/paste ("Apply to All") and drag-and-drop both had the same latent issue** and got the same
  category-aware fix: `applyStatToAll` now resolves the chosen template's *name* to each category's
  own correct id before broadcasting (previously spread one raw id across every slot type
  unconditionally); `UpgradePicker`'s drag payload (`gear-drag-payload.ts`) gained an optional
  `name` field so dropping a stat prefix from one slot onto a different-category slot resolves by
  name against the target's own (already category-scoped) option list instead of reusing the
  source id verbatim.
- `computeGearAttributeTotals`'s and `computeCharacterStats`'s `gameData` params widened to require
  `itemStatLegalIds` (previously only `itemStats`) — propagated through `sources.ts` and
  `party-summary.ts`'s inline gameData param shapes, which construct a narrower object than the
  full `GameData` type.
- `gear-optimize.ts` was **never affected** — it already looked up `legalArmorWeapon`/`legalTrinket`
  separately per slot category before deduping, confirmed by reading through its `statOptionsFor`.

## Session 50 — Per-item numeric stat tooltips; formula re-verified byte-exact against gw2skills

User followed up Session 49's trait-bonus fix with a second gw2skills.net cross-check (same build,
same gear/traits/food/utility) and Toughness/Vitality/Concentration/Healing Power still didn't
match — asked directly whether the per-item gear math itself was correct, and separately asked for
a feature we didn't have: hovering an equipped item to see its numeric attribute contribution
(gw2skills shows this on every item, e.g. "Scepter [Minstrel]: +108 Toughness, +59 Vitality, +59
Concentration, +108 Healing Power").

- **Per-item formula re-verified, confirmed correct.** Ran `statComboContribution` for Minstrel's
  against both `weaponOneHanded` and `armorHelm` adjustment keys and compared to the user's own
  gw2skills tooltip screenshots: weapon slot gave exactly +108/+59/+108/+59, helm slot gave exactly
  +54/+30/+54/+30 — byte-for-byte matches on every value. The `adjustment * multiplier + value`
  math and the `ATTRIBUTE_ADJUSTMENT` constants are not the source of the remaining mismatch.
- **Added the missing hover-tooltip feature** (`EquipmentEditor.tsx`): the gear-slot stat-prefix
  picker's existing `Tooltip` previously only listed attribute *names* ("Toughness / Vitality /
  Concentration / Healing"); `statOptionsFor(adjustmentKey)` now computes each combo's actual point
  contribution *for that specific slot* (armor/weapon/trinket slots each use a different
  `ATTRIBUTE_ADJUSTMENT` constant, so this couldn't be one shared list) via the already-exported
  `statComboContribution`, and renders it as "+N AttributeName" per line. New
  `ATTRIBUTE_DISPLAY_NAME` export on `attribute-totals.ts` maps raw keys to the Stats-panel's
  player-facing names (`CritDamage`→Ferocity, `Healing`→Healing Power, `BoonDuration`→Concentration,
  `ConditionDuration`→Expertise) for this. The copy/paste template picker (broadcasts one stat
  prefix across every slot at once, so has no single slot context) keeps a name-only description.
- **Conclusion / still open**: since individual item math is proven correct, the remaining
  Toughness/Vitality/Concentration/Healing Power gap is most likely more unmodeled traits in the
  same category as Session 49's Life Attunement fix — the user's build separately confirmed
  Vindicator's "Empire Divided" (+240 Power / +240 Healing Power, but conditional on a health
  threshold) is also missing, which explains the Power gap but not Toughness/Vitality/Concentration.
  Asked the user for the build's exact trait selections (or a gw2skills chat code/link) to identify
  the specific trait(s) still missing rather than guessing from screenshots — logged as a TODO
  follow-up (`trait-attributes.ts` curation) once identified.

## Session 49 — Trait attribute bonuses (flat + conversion): a real, previously-unmodeled gap

User cross-checked a Revenant/Salvation build (all-Minstrel gear) against gw2skills.net and found
our Stats panel numbers didn't match. Root cause: GW2 traits can grant a flat attribute bonus
(`AttributeAdjust` fact, e.g. Salvation's minor "Life Attunement": "+120 Healing Power") or convert
a % of one attribute into another (`BuffConversion` fact, e.g. that same trait's "7% of Healing
Power becomes Concentration") — and `computeGearAttributeTotals`/`computeCharacterStats` never
looked at `build.specializations` at all, so every such trait was silently contributing nothing.
A full `traits.json` scan found this is **not a one-off**: 193 traits across every profession carry
at least one of these facts.

- **`src/shared/gear-calc/trait-attributes.ts`** (new): `activeTraitFlatBonuses`,
  `activeTraitConversions`, `applyTraitBonuses` — resolves which traits are active on a build
  (every Minor of an equipped spec line, auto-granted; Major only if actually chosen) and applies
  a **hand-curated whitelist** of flat bonuses/conversions, same pattern as
  `CURATED_RELIC_DAMAGE_BONUSES`/`FURY_CRIT_CHANCE_TRAIT_BONUSES`. Conversions are applied from the
  *final* combined totals (base+gear+runes+food+utility+combat state+trait flat bonuses), not
  chained/compounding, matching how the game computes simultaneous conversions.
- **Important correction mid-implementation**: the first pass tried to auto-apply every trait fact
  whose raw value was unambiguous (single distinct number), only flagging *multi-value* facts as
  needing curation — this looked safe (119/168 `AttributeAdjust` + 17/25 `BuffConversion` facts
  have exactly one value) but was wrong. Verified live: "Healer's Gift" (Revenant/Salvation minor,
  "The end of your dodge roll heals nearby allies") has a perfectly unambiguous single-value
  `AttributeAdjust` fact (197 Healing) that is **not a stat grant** — it's the base-heal amount for
  that trait's own proc, reusing the same fact type as a genuine passive bonus. A synthetic test
  build caught this immediately (expected +120 Healing, got +317). There's no reliable signal in
  the fact data alone to tell "passive gain" from "skill-effect coefficient" apart — only the
  trait's own description text does, and that requires a human (or wiki-cross-referencing) read
  per trait. Reworked to a strict opt-in whitelist: nothing applies unless individually verified
  and added, same rigor as every other curated table in this codebase. Only Life Attunement is
  curated so far (both its flat bonus and its 7%-not-4% conversion percent verified via
  wiki.guildwars2.com/wiki/Life_Attunement); the other ~190 candidate traits are listed in TODO.md
  for incremental follow-up as specific builds surface a need.
- Wired into `derived-stats.ts`'s `computeCharacterStats` (single unified totals object, trait
  bonuses applied last) and `gear-optimize.ts` (flat bonuses folded into the search's fixed
  baseline — gear-independent, safe; conversions applied only to the final reported `metricValues`
  after the actual result is known, since a conversion's source attribute, e.g. Healing, can itself
  be a floor/target the search is varying — documented as a narrow known limitation: the search
  itself doesn't yet credit a conversion's benefit while deciding gear, only the final numbers
  shown are fully accurate).
- Verified with a throwaway script (not committed): a synthetic all-Minstrel Revenant build with
  vs. without Salvation equipped showed exactly the expected deltas (+120 Healing Power, and a
  Concentration delta matching `7% × (post-bonus Healing)` to the fraction).

## Session 48 — Gear Optimizer rework: embedded in build editor, translated stats, lexicographic tiers

Follow-up to Session 47 after the user tried it, with four pieces of feedback:

- **Moved into the build editor** (`GearOptimizerPanel.tsx`, a collapsible section inside
  `BuildEditorView.tsx`), not a separate nav tab — `GearOptimizerView.tsx`/the `'optimizer'`
  `ViewKey` are gone. Operates directly on the build being edited (no build picker needed), and
  reuses the editor's existing `combatState` (the Stats panel's Fury/Might toggles) instead of a
  duplicate `CombatStatePanel` instance, so both stay in sync. "Apply" only patches the in-memory
  draft via a callback — it never saves on its own, same as every other editor sub-panel.
- **Metric set changed to translated stats**: Magic Find removed entirely (no gear-legal source,
  so it could never be a real search variable), and raw Vitality/Toughness/Precision/Ferocity
  replaced with their derived Health/Armor/Critical Chance/Critical Damage equivalents — nobody
  thinks in raw Precision, they think in Critical Chance %. `derived-stats.ts` gained a few new
  exports (`fullArmorDefense`, `BASE_HEALTH_BY_PROFESSION`, etc.) so `gear-optimize.ts` could reuse
  the exact same formulas rather than re-deriving them.
- **Up to 3 ordered "maximize" tiers** instead of one target — lexicographic, not a weighted
  blend: tier 2 can never trade away any of tier 1's achieved value to improve itself. Implemented
  by solving tier 1 normally, then re-solving with tier 1's exact achieved value pinned in as an
  additional floor before tier 2 runs, and so on.
- **Search-quality bug**: multi-attribute stat prefixes (e.g. Minstrel's
  Healing/Toughness/Vitality/Concentration) were being systematically passed over even when
  clearly optimal for several simultaneous floors. Root cause was the greedy warm start scoring
  options against whichever single floor had the largest absolute gap, in isolation — a combo
  strong across 4 floors at once always lost to a combo that maxes out just one. Rewrote it to
  score every option by *combined* proportional progress across all unmet floors at once (each
  floor's credit capped at 1), and applied the same scoring to branch-and-bound's per-node option
  ordering (previously pure target-first, which could spend the entire node budget chasing the
  target while never finding a single feasible leaf when the target metric didn't itself help the
  floors). Also found and fixed a real perf regression introduced mid-session: option dedup had
  briefly moved to the full 9-metric space "for simplicity" ahead of the tiers work, which barely
  dedupes anything in practice and blew the search space up enough to truncate even single-floor
  cases; reverted to deduping only over the metrics actually in play (every floor ∪ every tier,
  fixed before any tier starts solving). Verified with a throwaway script: found the true
  infeasibility boundary on a 4-simultaneous-floor case (a floor 95pts above the actual achievable
  max correctly reported infeasible; lowering it 1 unit inside the boundary found a solution in
  ms), confirming both correctness and that NODE_LIMIT (raised 200k → 500k) has real headroom.

## Session 47 — Gear Optimizer

Implemented the net-new Gear Optimizer feature scoped in TODO.md, with the scope widened per
2026-08-01 follow-up direction: it operates on an existing saved build (not a blank
profession-only slate) — weapon types, runes, sigils, and the relic stay exactly as that build has
them, floors/target account for their real contribution, and the search only chooses
`itemStatId` per slot (plus food/utility, if toggled on).

- **`src/shared/gear-calc/gear-optimize.ts`** (new): the search itself. Every "thing that can be
  assigned" (a gear slot's stat combo, or food/utility when toggled on) is a search slot with a
  finite, per-slot-deduped option list; each option's contribution is precomputed against only the
  metrics actually in play (the floors + the maximize target), reducing the problem to a small
  multiple-choice-knapsack rather than the full 9-attribute space. Solved via a greedy warm start
  (closes the largest floor gap first, using whichever remaining slot helps most) feeding an
  admissible-bound branch-and-bound refinement, capped by a node budget (`truncated: true` if hit).
  `optimizeGear()` re-derives the final numbers by applying the winning choice to a cloned `Build`
  and calling the same `computeGearAttributeTotals`/`computeCharacterStats` path `StatsPanel`
  already uses, so the preview is guaranteed to match what the Stats panel would show — no
  duplicated math to drift.
- **11 selectable metrics** (`OPTIMIZER_METRICS`): the 7 point-based core attributes plus 4
  percent-based derived metrics (Boon/Condition Duration, Magic Find, Critical Chance) — the
  percent group entered/displayed in the same unit `StatsPanel` shows, needed because Magic Find
  has no raw-point form and Critical Chance has a non-linear Fury add-on a raw-points floor would
  miss entirely.
- **Fury-boosted Critical Chance** (`combat-state.ts`'s new `FURY_CRIT_CHANCE_TRAIT_BONUSES` +
  `furyCritChanceTraitBonus`): user flagged that some profession traits further increase crit
  chance while under Fury (e.g. Revenant's Roiling Mists) on top of Fury's own flat bonus. Seeded
  with trait id 1719 (Roiling Mists, Revenant/Invocation, Major tier 3) at 20% — confirmed via
  wiki.guildwars2.com/wiki/Roiling_Mists 2026-08-01 that the raw API `facts` array conflates PvE
  (25%) and WvW/PvP (20%) values with no mode tag; this app is WvW-only, so 20 is correct. A scan
  of `traits.json` found 6 more professions with similarly-shaped fury-crit traits, left uncurated
  for now (extensible table, same pattern as `CURATED_RELIC_DAMAGE_BONUSES`). Threaded into
  `derived-stats.ts`'s `computeCharacterStats`, so `StatsPanel`'s own Critical Chance reading also
  became more accurate as a side effect, not just the optimizer's.
- **`GearOptimizerView.tsx`** (new nav tab, `NavBar`/`App.tsx`): build picker, per-metric floor
  inputs, a maximize-target select, a "also optimize food & utility" checkbox, the existing
  `CombatStatePanel` reused as-is for Fury/Might/sigil context, a results readout, and an
  "Apply to Build" action that writes the result straight onto the selected build via
  `updateBuild` (never auto-saves).
- Verified with a throwaway script exercising `optimizeGear` directly against real game data
  (unconstrained max, a Toughness-floor case that found a zero-Power-cost solution, an
  intentionally-impossible floor, floor-and-target-on-the-same-metric, Magic-Find-via-food, and a
  Fury-gated Critical Chance floor) — all matched hand-computed expectations before the script was
  discarded (not committed).

## Session 46 — Legendary-Armory-derived stat-combo legality; EquipmentEditor stat picker cleanup

Scoping the Gear Optimizer's still-open "curated vs. full combo pool" question (TODO.md) surfaced
a cleaner answer than either option: `itemstats.json` (raw `/v2/itemstats` dump) has no
"obtainable/current" flag at all, but every Legendary item's `details.stat_choices` field IS
exactly that — the Legendary Armory stat-selector list, straight from the API. Confirmed live
2026-08-01 (Frostfang/Triumphant Hero's Warhelm/Warbringer/Conflux/Aurora/Transcendence) that
Legendary armor and Legendary weapons share one identical list, and every Legendary trinket
(back/ring/accessory/amulet) shares a separate, entirely disjoint list.

- **`deriveLegalItemStatIds`** (`scripts/fetch-gear-upgrades.ts`): unions `stat_choices` across
  every Legendary item, bucketed by `armorWeapon` (39 ids) vs. `trinket` (43 ids), written to the
  new `data/game-data/itemstat-legal-ids.json`. Wired through `ItemStatLegalIds`
  (`shared/types/game-data.ts`) → `GameData` → `load-game-data.ts` → `game-data-store.tsx`, same
  pattern as every other static data file.
- **`EquipmentEditor.tsx`'s `dedupedStats`** now filters to this legal-id set before its existing
  per-name canonicalization, so dead 1-2 attribute-line legacy combos (Vital, Vigorous, etc. — ~110
  of the 191 raw `itemstats.json` entries) no longer show up in the stat-prefix picker. 43 real,
  current prefix names remain.
- **Resolves the Gear Optimizer combo-pool question**: no curated "common ~8" allowlist — a fixed
  shortlist doesn't fit how stat-mixing actually works (user direction: better players mix in
  Assassin's/Demolisher's/Dragon's etc. alongside Berserker's/Marauder's per-build, not from a
  fixed set). The optimizer should search the full legal pool per slot, not a pre-filtered subset.
- **Caution for future `fetch-gear-upgrades` runs**: re-running the script also regenerates
  `itemstat-icons.json` via `deriveItemStatIcons` (live `render.guildwars2.com` insignia-icon
  URLs), which silently overwrites the gw2skills.net-licensed local icon paths manually wired in
  commit `d205a01` — that file is not currently reproducible by the script and must be restored
  from git (or re-applied by hand) after any future gear-upgrades refetch.

## Session 45 (continued) — Tag-filter UI rework: profession/elite-spec picker, custom-tag dropdown, OR semantics

Follow-up to the tags+filter/search work just below, after user feedback on the first pass: the
flat button row of every tag (auto + custom mixed together) was unintuitive, and selecting 2+ tags
used AND semantics (impossible to satisfy for 2 professions at once — a build can only be one
profession — so multi-selecting professions always showed zero results).

- **OR, not AND**: `useTagFilter`'s `filtered` now keeps a record if it has *any* selected tag
  (`.some()`), not *every* selected tag. Fixes the "select 2 professions, see nothing" bug directly.
- **Profession/elite-spec picker**: new `ProfessionTagPicker.tsx`, visually identical to the build
  editor's `ProfessionSpecPicker` (same `.spec-icon-button`/`.profession-picker-row`/
  `.elite-spec-picker-grid` CSS, per explicit user request) but toggle-multi-select instead of
  single-select — clicking an icon toggles that profession/elite-spec name in/out of
  `selectedTags` rather than switching a build's own profession. Reuses the exact tag strings
  `shared/tags/auto-tags.ts` already produces, so no new tag vocabulary. Shown on `BuildsView` only
  (`TagFilterBar`'s `showProfessionPicker` prop) — not `BuildsSidebar`, whose fixed 200px width
  can't fit the elite-spec grid's per-profession-column layout.
- **Custom-tag dropdown**: new `TagChipDropdown.tsx` replaces the old flat "every tag is a button"
  row for user-created tags — a `<select>` of tags not yet active (choosing one adds it to the
  filter) plus the currently-active ones as removable chips below, reusing the same `.tag-chip`/
  `.tag-chip-remove` styling the editor's `TagInput` already established. `BuildsView`/`SquadsView`/
  `BuildsSidebar` each compute their own `customTags` list (unique `tags` values in use) and pass
  it in; `useTagFilter` no longer computes a merged `allTags` itself (it doesn't need to distinguish
  auto vs. custom tags for matching, only the UI does, and the UI now sources each facet
  separately).

## Session 45 (continued) — Drag-to-reorder cards; Tags + filter/search; last-updated display

- **Drag-to-reorder**: `Build`/`SquadComp` gained an `order: number` field (`src/shared/types/`).
  Legacy records backfill `order ?? Date.parse(createdAt)` in `builds-store.tsx`/
  `squad-comps-store.tsx` (same no-migration pattern as `tags` below); both stores now sort by
  `order` on every `refresh()` instead of relying on the SQLite row's own `updated_at DESC` (which
  would otherwise reshuffle cards on every edit, fighting a manually-arranged order). `BuildsView`/
  `SquadsView` cards are `draggable`; dropping one only ever rewrites *its own* `order` to a new
  midpoint value between its new neighbors (`renderer/lib/reorder.ts`'s `reorderBefore`/
  `computeOrderBetween`) — no other record's fields change, and specifically `updatedAt` is left
  untouched by a reorder (see the "last updated" item below for why that separation matters).
  Reordering works against whatever's currently filtered/searched (drop position is read from the
  visible neighbors), not just the unfiltered list. `BuildsSidebar.tsx` picks up the same order
  automatically (via the store) but has no drag-reorder UI of its own — out of scope, it already
  has a different drag purpose (assigning a build to a squad slot).
- **Tags + filter/search**, per the 2026-08-01 TODO scoping note: `Build`/`SquadComp` gained
  `tags: string[]` (same backfill-on-read pattern as `order`, no storage migration).
  `TagInput` (`components/common/TagInput.tsx`) is the chip-row + autocomplete editor wired into
  `BuildEditorView`/`SquadCompEditorView`, suggesting every tag already used on any of the user's
  other builds/squads. `TagFilterBar` (`components/common/TagFilterBar.tsx`) + the shared
  `useTagFilter` hook (`state/use-tag-filter.ts`, name-substring search AND tag-combination
  filter) are reused identically by `BuildsView`, `SquadsView`, and `BuildsSidebar` — the sidebar
  now has the same search+tag row above its build list.
  - Per user direction: every build automatically carries its profession + (if any) elite spec as
    non-removable tags (e.g. "Mesmer" + "Chronomancer"), shown in the tag editor and folded into
    the same filterable tag vocabulary as user tags. These are **computed, not stored** —
    `shared/tags/auto-tags.ts`'s `getBuildAutoTags` derives them from `Build.profession`/
    `specializations` on the fly, so they can never go stale if the build's profession/spec
    changes later (unlike a persisted string, which would). `SquadComp` gets no equivalent — a
    squad spans multiple professions, so there's no single "class" tag to derive.
- **Last updated**: each card now shows a relative "Updated 3 days ago"-style line
  (`renderer/lib/format-relative-time.ts`, built on `Intl.RelativeTimeFormat` — no new dependency;
  hovering shows the exact timestamp) sourced from the record's own `updatedAt`, which only
  changes on a real content save (`handleSave` in both editor views), never on a drag-reorder — see
  above. Per user request this was meant to ideally be relative to GW2 balance patches rather than
  wall-clock time; deferred (see TODO.md) because that needs the GW2 API build-number-polling
  mechanism the existing "Automatic game-data refresh" TODO item already flags as undecided —
  didn't want to build a second, parallel patch-detection path to answer a smaller question.

## Session 45 — Compact Builds/Squads card grid

- `BuildsView.tsx`/`SquadsView.tsx` now render saved records as a responsive card grid
  (`.record-list` switched from a `flex column` of full-width rows to `display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`) instead of one row per record.
  Build cards show the profession icon (sourced from `useGameData()`, same lookup
  `BuildsSidebar.tsx` already used) + name + profession name, matching the sidebar's existing
  compact-card info level per the 2026-08-01 scoping note; squad cards show name + party count
  (no icon — `SquadComp` isn't tied to a single profession). New shared CSS classes
  `.record-open-icon`/`.record-open-text` in `global.css` support the icon+stacked-text card
  layout; `.record-open`/`.record-list li` were restyled in place (only consumers were these two
  views) rather than adding parallel classes.
- Confirmed the "Not affiliated with ArenaNet/NCSOFT" disclaimer TODO item was already done
  (present in `SettingsView.tsx`) — removed from TODO.md, no code change needed.

## Session 44 — Beta release prep: in-app auto-update (Settings tab), repo flipped public

User wants to start distributing beta builds to people they know, with two hard requirements:
Windows-only for now, and updates delivered inside the app rather than "download the new .exe from
GitHub each time."

- **Repo visibility**: electron-updater's GitHub provider needs release assets to be publicly
  downloadable; `vanwheels/GW2-Squaded` was private. Asked the user how to reconcile that (make the
  repo public / keep it private behind a shipped token / host updates on our own public endpoint
  instead) rather than deciding unilaterally — a shipped GitHub token is extractable from any
  installed copy of the app, so this had real security tradeoffs. User chose to make the repo
  public. Checked git history and the tracked `worker/wrangler.toml` for secrets first (none found —
  `.env`/`.wrangler` are gitignored, the only tracked worker file is a KV namespace *id*, not a
  credential) before running `gh repo edit --visibility public`.
- **`electron-updater` added** (`^6.8.9`, matches Electron 43). `electron-builder.yml` gained a
  `publish` block (`provider: github`, owner/repo) — this is what makes NSIS builds emit
  `latest.yml` and is also what `electron-updater` reads from at runtime, same config driving both
  directions. New `package:win:publish` script (`electron-builder --win --publish always`) for
  cutting a release; requires a `GH_TOKEN` env var with repo access on whoever runs it (not
  something this session could set up — noted for the user).
- **New seam, mirroring the existing `CaptureProvider`/`StorageAdapter` pattern**:
  `src/shared/updater/` (`UpdaterProvider` interface + `UpdateStatus` union, `ipc-channels.ts`) →
  `src/main/updater/auto-updater.ts` (wraps electron-updater's `autoUpdater`, forwards its events to
  the renderer as one `updater:status` push) → `window.gw2Updater` preload bridge. `autoDownload`
  and `autoInstallOnAppQuit` are both off — check/download/install are 3 explicit user-triggered
  steps (`checkForUpdates`/`downloadUpdate`/`quitAndInstall`), not a silent background flow, matching
  the same "user stays in control of when the fetch runs" philosophy TODO.md already documents for
  game-data refreshes.
- **Windows-only, enforced in the main process, not just the UI**: `auto-updater.ts` gates every
  handler on `process.platform === 'win32'` (only NSIS has auto-update wired up — mac's
  Squirrel.Mac path needs a signed app, which this project doesn't have) plus `app.isPackaged` (so
  it's inert in dev, where electron-updater has nothing to diff against). A new `isSupported` IPC
  call lets the renderer show a plain "not available in this build" message instead of dead buttons
  on any other platform.
- **New Settings tab** (`NavBar`'s `ViewKey` gained `'settings'`, routed in `App.tsx`) →
  `SettingsView.tsx`: shows the running app version (`app.getVersion()` round-tripped over IPC) and
  an `UpdateControls` block that switches on `UpdateStatus['state']` — idle/checking/not-available/
  available/downloading (with a progress bar)/downloaded/error, each with its own action button
  where relevant. New `.settings-panel`/`.settings-update-row`/`.progress-bar`/`.error-text` CSS,
  reusing the existing `--accent`/`--surface`/`--border`/`--muted` custom properties rather than
  introducing new colors.
- Verified `electron-updater` actually lands inside the packaged app: ran `npm run package:dir`
  after the changes (still succeeds — better-sqlite3's native rebuild and asar packing both
  unaffected) and inspected the output `app.asar` directly (`@electron/asar`'s `listPackage`) to
  confirm `node_modules/electron-updater` is bundled, since `electron.vite.config.ts`'s
  `externalizeDepsPlugin` means the main bundle `require()`s it at runtime rather than inlining it —
  electron-builder's automatic production-dependency inclusion (driven by `package.json`
  `dependencies`, independent of the `files` allowlist) picked it up with no config change needed.
  `npm run typecheck`/`lint` both clean. Not visually confirmed in a running window (standing
  Electron-sandbox limitation) — recommend `npm run package:win:publish` (with `GH_TOKEN` set) for a
  real first release, then `npm run dev`/an installed copy to eyeball the new Settings tab and click
  through Check → Download → Restart-and-install against a real GitHub release.

## Session 44 (continued) — First beta release published: v0.1.0

Published the actual first beta immediately after landing the auto-update work above, using the
`gh` CLI's already-authenticated token (`gh auth token`, scopes include `repo`) as `GH_TOKEN` for
`electron-builder`'s GitHub publisher — no separate PAT needed.

- **Found and worked around a real electron-builder bug**: `package:win:publish` uploads the
  `.exe` and `.exe.blockmap` concurrently, and on a brand-new tag both uploads independently raced
  to create the GitHub release, producing **two duplicate draft releases** with assets split
  between them (one got the `.exe`, the other got the `.exe.blockmap`/`latest.yml`) —
  `gh release view <tag>` only surfaced one by name-match, hiding the split; `gh api
  repos/OWNER/REPO/releases` was needed to see both. Deleted both broken drafts, then avoided the
  race by pre-creating the draft release myself (`gh release create v0.1.0 --draft`) before
  re-running the publish, so electron-builder found the existing release instead of racing to
  create it. Verified via the API that all 3 assets landed on the one release, then un-drafted it.
- Live at https://github.com/vanwheels/GW2-Squaded/releases/tag/v0.1.0, confirmed publicly
  downloadable without auth (`curl`'d `latest.yml` unauthenticated, correct version/hash).
- Documented the race + the pre-create workaround for future releases (see this session's earlier
  entry and TODO.md is not the place for it since it's a recurring release-process note, not a
  product feature — captured in project memory instead).

## Session 43 — Elite-spec grid column-alignment fix; full Control CC set, Miscellaneous, Strip/Corrupt rows

Two follow-ups from Session 42's feedback pass.

- **Fixed the elite-spec grid not actually column-aligning under its profession portrait.**
  Root cause: `Tooltip` wraps its trigger in a `<span>`, and that span — not the `<button>` inside
  it — is the real CSS Grid item inside `.elite-spec-picker-grid`. `gridColumn`/`gridRow` had been
  set as an inline style on the button (a grandchild, not a grid item), so it had zero effect and
  every icon fell back to sequential auto-placement. Added a `style` passthrough prop to `Tooltip`
  and moved the placement there.
- **Control got a real fact-shape investigation, not a guess.** The Buff-status-based Control
  detection from Session 42 (`isControlName`, Stun/Daze only) turned out to be reading a minority
  signal — a full scan of data/game-data/{skills,traits}.json found Stun/Daze mostly appear as
  `type: "Time", text: "Stun"/"Daze"` facts (104/74 occurrences) rather than `type: "Buff", status:
  "Stun"/"Daze"` (16/3) — and Knockdown/Knockback/Launch/Pull are genuine, clean, exact-match facts
  too (`Time`/`Distance`/`Number` typed respectively, e.g. Bull's Charge → `{type:"Time",
  text:"Knockdown"}`, Spectral Grasp → `{type:"Number", text:"Pull"}`) — an earlier broad scan of
  `Distance`-type facts had been misleading (`text` there is mostly free-form AoE-radius flavor
  text, not a CC signal; the *specific* exact-text-match facts turned out totally reliable once
  found). Float/Sink excluded (underwater-only, out of scope per the app's WvW focus).
  - Replaced the old Buff-status Control classifier with `CONTROL_MATCHERS` in
    `boon-calc/sources.ts` — a `name -> (fact) => boolean` table checked against every equipped
    skill/trait's raw facts, via a new generic `computeNamedFactSources` (parallel to
    `computeAuraSources`/`computeComboSources` for facts that don't share boons/conditions/auras'
    `Buff`-with-`status` shape).
  - Added a **Miscellaneous** row (`MISCELLANEOUS_MATCHERS`): Stealth, Superspeed (both genuine
    `Buff` statuses), Evade (`type:"Time", text:"Evade"`), Breaks Stun (`type:"StunBreak"` OR
    `type:"NoData", text:"Breaks Stun"` — both shapes appear in real data, unioned), and Barrier
    (`type:"AttributeAdjust"` facts whose `text` contains "Barrier" — ~15 distinct exact labels,
    confirmed all consistently substring-matchable). Healing was explicitly requested but deferred
    per user direction — see TODO.md.
  - Added a **Strip / Corrupt** row (`BOON_STRIP_CORRUPT_MATCHERS`) — not part of gw2skills' own
    bar, added on request: `type:"Number"` facts matching "Boons Removed"/"Boons Stolen" (Strip) or
    "Boons Converted" (Corrupt), confirmed exhaustive via a full scan of every `Number` fact's
    `text`; deliberately excludes the much larger "Conditions Removed" family (self/ally condition
    cleanse — an unrelated concept). Both share the same generic API icon (no per-type icon exists),
    distinguished by row label instead, like `COMBO_ICONS`.
  - `constants.ts`'s old `CONTROL_NAMES`/`isControlName` (Buff-status-only, now provably incomplete)
    were removed rather than left as dead/misleading code; `computeControlAuraSources` was split
    into `computeAuraSources` (auras only, still Buff-status-based — that part was correct) plus the
    new generic mechanism for everything else.

## Session 42 — Build editor 3-column layout: single-click profession/elite-spec picker, relocated Boons/Conditions summary + Control/Auras/Combo

Feedback pass aimed at fitting the whole build editor in one window without scrolling.

- **Profession + elite specialization: one combined click instead of two.** Replaced
  `ProfessionSelect` + `EliteSpecSelect` (2 separate rows: pick profession, then separately pick its
  elite spec) with a single new `ProfessionSpecPicker`: a profession-portrait row plus one flat grid
  of every elite specialization across every profession. Clicking an elite-spec icon switches to its
  owning profession AND equips that spec in one click (each icon uniquely identifies both), instead
  of needing a profession click first when the target elite spec belongs to a different profession
  than the one currently equipped. `BuildEditorView.handleProfessionChange` gained an
  `initialEliteSpecId` param so the profession-reset and elite-spec-seed happen in one `setDraft`
  call (two separate calls in the same handler would have the second read stale `draft`). Bumped
  `.spec-icon-button` from 30px to 36px per feedback ("a tiny bit bigger... more evenly fit the
  width"). Deleted the old 2 files, nothing else referenced them.
- **3-column equal-height layout**: `build-editor-columns` went from a 2-column grid (Traits+Equipment
  stacked above a full-width Skills row, Stats as a 2nd column) to a flat 3-column flex row —
  Traits | Equipment | Stats+BoonConditionSummary+Skills — all stretched to match the tallest
  (Equipment). Traits and Skills are each wrapped in a `.build-editor-column-pushed` block
  (`margin-top: auto`) inside a `.build-editor-column-stretch` (flex-column) parent, so both sit
  flush against the bottom of their column — Traits bumped down per feedback, and Traits/Equipment/
  Skills now all end at the same height.
- **Boons/Conditions summary relocated + expanded**: moved out of `SkillsEditor`'s inline
  `.ingame-skill-bar-boons`/`-conditions` grid rows (removed those, plus the now-unused `divider2`
  grid area) into a new standalone `BoonConditionSummaryPanel`, rendered directly beneath
  `StatsPanel` in the right column. Same underlying `computeBoonConditionSources` data, now also
  joined by 2 new categories:
  - **Control** (Stun/Daze) and **Auras** (all 7) via new `computeControlAuraSources` in
    `boon-calc/sources.ts` — reuses `extractFromFacts`'s existing Buff-fact extraction, now
    parameterized by a `classify` callback (`classifyBoonCondition` default, `classifyControlAura`
    new) instead of hardcoding `isBoonName`/`isConditionName`. Deliberately a *separate* exported
    function rather than folded into `computeBoonConditionSources` itself: that function's output
    feeds the Squad tab's party-wide summary and per-slot icon rows, which assume every entry is a
    real boon/condition — mixing control/aura in would've broken those (undefined icon lookups).
    `BoonConditionSource` gained a `category` field (`'boon'|'condition'|'control'|'aura'`) alongside
    the pre-existing `isCondition` boolean, which every existing caller still reads unchanged.
    Confirmed exhaustive via a full scan of every `Buff`-type fact's `status` across
    data/game-data/{skills,traits}.json: Stun/Daze are the only 2 non-boon/condition Buff facts with
    a `duration`, and all 7 real auras are present. Not duration-scaled (Concentration/Expertise only
    affect boons/conditions).
  - **Combo** (Field/Finisher) via new `computeComboSources`, reading the API's own `ComboField`/
    `ComboFinisher` fact types directly (a different shape — no `status`/`duration` — so it doesn't go
    through `extractFromFacts`). The API only exposes one generic icon per fact type (not per
    `field_type`/`finisher_type`, confirmed via a skills.json scan), so this renders as exactly 2
    icons (Field, Finisher) with the specific types produced listed in the tooltip rather than as
    distinct per-type icons.
  - **Miscellaneous was left out** — no equivalent structural fact shape exists in the ingested data
    for it (unlike Control/Auras/Combo, which all map onto real, scannable API fact shapes); see
    TODO.md.
- Not visually verified in a running window — this shell can't launch the Electron app (see memory);
  verified via `npm run typecheck`/`lint`/`build` and careful code review instead.

## Session 41 — "Combat state" simulation inputs (Might, Fury, stacking sigil, relic)

Implemented the TODO item mapped out 2026-08-01: ephemeral what-if mid-fight inputs rendered
inline inside `StatsPanel`, to the right of the stat grid behind a vertical divider (revised from
an initial separate-panel layout per feedback) — icon-based controls (boon/sigil/relic icons from
`BOON_CONDITION_ICONS`/`gameData.sigils`/`gameData.relics`) rather than text-labeled inputs. Might
and the stacking-sigil stepper are `<select>` dropdowns in 5-stack increments (0/5/10/15/20/25);
Fury and the relic bonus are click-to-toggle icons (greyed out via `combat-state-icon-inactive`
when off, same visual language as `SkillsEditor`'s inactive boon/condition icons).

- New `src/shared/gear-calc/combat-state.ts`: `CombatState` (mightStacks 0-25, furyActive,
  stackingSigilStacks 0-25, relicActive), never persisted on `Build` — lives as local `useState` in
  `BuildEditorView`, so it resets whenever the editor unmounts (leaving to the builds list),
  matching the "what-if snapshot, not a build choice" design.
- Might: flat +34 Power / +34 Condition Damage per stack, folded into `computeCharacterStats` via a
  new `combatStatePoints` helper merged alongside `computeGearAttributeTotals`'s points before the
  attribute totals are computed.
- Fury: flat +20% Critical Chance added directly to `derived.criticalChance`. Per-skill/trait Fury
  conditionals remain unmodeled (explicit stretch goal, not attempted).
- Stacking sigil: auto-detected from the active weapon set's equipped `sigilIds` (no separate
  picker) via `detectActiveStackingSigil`, reusing `attribute-totals.ts`'s `isActiveWeaponSlot`
  (now exported). Hardcoded all 8 real stacking-sigil ids from `data/game-data/sigils.json` —
  Bloodlust/Power, Corruption/Condition Damage, Perception/Precision, Life/Healing,
  Momentum/Toughness, Cruelty/Ferocity, Bounty/Concentration, and the Stars sigil (+2 all 9 core
  attributes/stack, via the now-exported `ALL_CORE_ATTRIBUTE_KEYS`). Note these names/attributes
  differ from the TODO's original write-up, which had gone stale — verified directly against
  current `sigils.json` description text instead. Stepper only renders when a stacking sigil is
  actually equipped.
- Relic: curated lookup (`CURATED_RELIC_DAMAGE_BONUSES`) of relics whose full proc is a flat,
  unconditional outgoing-damage-%. Only Relic of Fireworks (7%) is verified so far — both its
  duplicate `relics.json` ids (100262/100947, same relic listed twice) are mapped. Toggle only
  renders when the build's equipped relic is in this table. Added a new `outgoingDamagePercent`
  field to `DerivedStats` and a matching "Outgoing Damage" row in `StatsPanel` — no such concept
  existed anywhere in the app before this.
- `StatsPanel`/`computeCharacterStats` both take an optional `combatState` param (defaulting to
  all-zero/off) so every other caller is unaffected.

## Session 40 — Thief skill-bar feedback pass (Specter Siphon/Shroud, manual Stolen Skill picker)

Worked through both open Thief items from the 2026-07-31 skill-bar feedback pass.

- **Specter's F1 "Siphon" and F2 "Enter Shadow Shroud"**: both ids (63067/63155, plus the Shroud
  exit id 63251) exist correctly in `/v2/skills`, correctly tagged `specializationId: 71`, but are
  missing from Thief's `professionSkills` entirely — same data-gap class as Guardian Dragonhunter's
  virtue skills. Hand-injected via a new `SPECTER_MECHANIC_SKILLS` table in `profession-mechanic.ts`
  (same pattern as `DRAGONHUNTER_VIRTUE_SKILLS`), so the existing generic per-spec resolver picks
  them correctly once Specter is equipped, with no other resolver changes needed. F2's Shroud toggle
  reuses the exact bundle mechanism Necromancer's own Shroud already uses (`bundle-skills.ts`) — a
  new `SPECTER_SHROUD_SLOT_SKILLS` entry (`63155: [63362, 63107, 63227, 63160, 63249]`, hand-verified
  against `/v2/skills`, none of which are part of Scepter's own weapon bar) merged into a combined
  `SHROUD_SLOT_SKILLS` lookup so `ProfessionMechanicBar`'s existing click-to-toggle-bundle logic
  (`isMechanicBarBundleId`) picks it up automatically.
- **Removed the old `SKIPPED_SLOTS: { Thief: ['Profession_2'] }` blanket skip** (it would have
  dropped Specter's real F2 alongside the stolen-skill candidates it was meant for) in favor of
  excluding all 22 raw stolen-skill ids individually via `EXCLUDED_MECHANIC_SKILL_IDS` — corrected
  that constant's stale doc comment along the way: live-verified there's no `source`-profession
  field on these ids at all (contra the old comment), they're themed by enemy weapon/monster type
  instead (e.g. "Mace Head Crack", "Skull Fear").
- **Thief's F2 "Stolen Skill" is now a real manual picker**: since which stolen skill is "live"
  depends on who you steal from in combat (no build-derivable signal exists), added
  `Build.thiefStolenSkillId` (null for every other profession, same shape as `familiarId`) and a new
  `thief-stolen-skill.ts` with the 19 canonical candidate ids (deduped from the raw 22 — 3 pairs are
  same-named orphan duplicates, lower id kept). Clicking the F2 icon in `ProfessionMechanicBar` now
  opens an inline picker (flat icon grid, same visual pattern as Heal/Utility/Elite's own picker,
  just without category columns since these ids carry no `categories`); only shown for Thief
  builds without Specter equipped (Specter's own F2 already covers that slot). The picked skill's
  facts now feed `sources.ts`'s boon/condition calculator directly, closing out the "how should this
  feed the calculator" question the original TODO item left open. Field is cleared automatically on
  profession change or when Specter gets equipped (`BuildEditorView`'s existing clear-on-change
  handlers, same pattern as `familiarId`/pets).
- Added `.ingame-skill-bar-mechanic .skill-picker` (absolute overlay, mirroring
  `.legend-slot .skill-picker`'s existing fix) since the mechanic bar shares a grid row with `env` —
  without it, opening the Stolen Skill picker would grow that row and shove the weapon-skill row
  below it down.

## Session 39 — Elementalist skill-bar feedback pass (attunement toggle, Tempest/Catalyst/Evoker F-bar, Staff bug)

Worked through the full Elementalist section of the 2026-07-31 skill-bar feedback pass.

- **Root-caused the "Staff skill 4-5 stuck" bug** (`weapon-calc/weapon-skills.ts`) — turned out to
  be much broader than Staff or Weaver: every Elementalist weapon's `Weapon_4`/`Weapon_5`
  candidates (Dagger, Focus, Hammer, Spear, Staff, Trident, Warhorn — confirmed live against
  `/v2/skills`) come back with `attunement: null` and a mistagged `specialization: 56` (Weaver),
  even for core skills needing no elite spec at all (e.g. "Ride the Lightning"). With `attunement`
  null, `resolveSkillBarIds`'s attunement-filter signal silently no-ops for these slots and
  resolution falls all the way to the deterministic `candidates[0]` fallback — the same fixed skill
  regardless of active attunement or equipped spec, on every Elementalist form, not just Weaver.
  Fixed with a hand-verified `ELEMENTALIST_WEAPON_4_5_ATTUNEMENT` id→attunement override table (56
  ids, name-verified — e.g. Staff's iconic Meteor Shower/Healing Rain/Static Field/Shock Wave are
  its Fire/Water/Air/Earth skill 5s) consulted by the attunement filter before it gives up; the
  `specialization: 56` mistag is never reached once attunement alone narrows to 1, so left as-is.
- **Attunement toggle restyled as an F-icon click-toggle** (`WeaponSkillBar.tsx`'s "extras" row):
  replaced the Fire/Water/Air/Earth text-button row with `skill-slot-button` icon buttons using the
  real Attunement skill icons (5492-5495), same visual/interaction pattern as Tomes/Shroud/Celestial
  Avatar. Kept in its own location in `WeaponSkillBar` rather than merged into
  `ProfessionMechanicBar` — that bar's F1-F4 read-only Attunement icons (which already exist there,
  informational/non-interactive, mirroring the real HUD) are unchanged and coexist alongside this
  interactive toggle.
- **Tempest's F1-F4 now show Overload icons**: each base Attunement id's own `flipSkill` field
  already points at the matching "Overload Fire/Water/Air/Earth" id, so `professionMechanicBar`
  swaps in the flip target whenever Tempest (spec 48, `TEMPEST_SPEC_ID`) is equipped — no new data
  needed.
- **Catalyst's F5 "Deploy Jade Sphere" now reflects the active attunement**: the raw slot has ~24
  candidates (an old 3-per-attunement set with a `GroundTargeted`/`NoUnderwater` flag split, plus a
  newer 2-per-attunement set of fully-identical duplicate ids). Resolved via new
  `catalystJadeSphereBar`, filtering to the `GroundTargeted`+`NoUnderwater` (land) variant tagged
  for `Build.activeAttunement`, then the highest remaining id as a best-effort "most recent" pick —
  no hardcoded id table needed. Catalyst's own ids are excluded from the generic per-slot resolver
  whenever Catalyst is equipped so nothing arbitrary leaks through first.
- **Evoker's F5 is now the familiar-swap control itself**: removed the standalone
  `EvokerFamiliarSelect` picker row entirely; clicking the F5 icon in `ProfessionMechanicBar` now
  cycles `Build.familiarId` through `gameData.familiars` in order, and the icon shows that
  familiar's actual F5 skill (new `evokerFamiliarBar`, keyed by the familiar's `element` field
  against a small 4-entry map — Fox→Conflagration, Otter→Buoyant Deluge, Hare→Lightning Blitz,
  Toad→Seismic Impact). Found and excluded one orphaned duplicate id along the way ("Ignite",
  76643 — blank description, no-flip, same slot/spec as the real Fire pick). `Build.familiarId`
  itself is unchanged, still also driving which Heal-skill "Rejuvenate" icon variant is bound.

## Session 38 — Fix Revenant Conduit's Release Potential (F2) legend-dependence

Fixed the TODO.md item filed as "Conduit's F1 ... always shows the base core-Revenant profession
skill regardless of active Legend." The literal `Profession_1` slot was already correctly hidden
(it's just every Legend's own swap id, already surfaced by `RevenantSkillsEditor`) — the reporter's
"F1" meant the first *visible* icon in the mechanic bar, which for Conduit was `Profession_2`
("Release Potential"), previously excluded outright on the assumption it depended on a
player-chosen "Vestige" build axis this app doesn't model, silently falling back to core Revenant's
"Ancient Echo" — a single fixed id, hence "never changes regardless of active Legend."

- WebFetch against wiki.guildwars2.com/wiki/Cosmic_Wisdom and /wiki/Release_Potential (Conduit is
  post-cutoff content) confirmed there's no "Vestige" axis at all: Release Potential and Cosmic
  Wisdom (`Profession_3`, already correctly resolved as a single id) both change based on which
  Legend is *currently active*, Razah channeling one of 5 GW1-profession "forms"
  (Assassin/Monk/Mesmer/Warrior/Dervish) per Legend. Since Conduit occupies the elite-spec line
  itself, only the 4 core Legends + Razah's own Legendary Entity Stance can ever be equipped
  alongside it — a clean 1:1 map onto the 5 forms (`Cosmic_Wisdom`'s own per-form text names each
  Legend directly), no ambiguity left over.
- Added `conduitReleasePotentialBar` (`profession-mechanic.ts`), keyed off `Build`'s
  `activeLegendIndex` the same "display-only" way `RevenantSkillsEditor`'s own Heal/Utility/Elite
  bar already reads it — doesn't feed boon/condition totals, since mechanic-bar skills never do
  (only bundle-capable ones like Tomes/Shroud do). `Profession_2` is now unconditionally dropped
  from the generic per-spec resolver whenever Conduit is equipped
  (`CONDUIT_RELEASE_POTENTIAL_EXCLUDED_SLOTS`, same shape as Ranger Soulbeast's Beastmode slots) so
  nothing leaks through before the dedicated bar's entry is prepended in `ProfessionMechanicBar.tsx`.
- One data wrinkle caught along the way: "Release Potential: Warrior" has a same-named orphaned id
  (77896) present in `/v2/skills` but never referenced by Revenant's `professionSkills` at all —
  same class of leftover pre-rework id as the Warrior Spellbreaker Full Counter duplicates already
  documented in this file; confirmed via a direct `professionSkills` membership check (not just a
  flat `skills.json` scan) that 78895 is the real, currently-equippable one.

## Session 37 — Skill bar feedback pass: Warrior (Bladesworn Gunsaber/Dragon Trigger)

Unblocked the Bladesworn item deferred in Session 35 with the user's help: they supplied real
in-game tooltip screenshots (F1/F2 icons, all 5 Gunsaber weapon-bar skills), which turned out to
reveal a different and more precise gap than the original wiki-only investigation had found.

- F1 "Unsheathe Gunsaber"/"Sheathe Gunsaber" (62745/62861) and F2 "Dragon Trigger" (62803) were
  already present in `data/game-data/skills.json` with full, correctly-tagged data
  (`specializationId: 68`, `Profession_1`/`_2` slots) — the original investigation's "no
  professions/specialization/slot fields at all" finding didn't apply to these; they resolve
  through the existing generic `professionMechanicBar` resolver with zero special-casing needed.
  One real bug found in that resolver along the way: Warrior's `Profession_1` slot has a
  weapon-type filter (`candidates.filter((s) => s.weaponType === mainHandWeaponType)`) built for
  Burst Skill's per-weapon variants, which was silently excluding Gunsaber's F1 entirely (its
  `weaponType` is the literal string `"None"`, never equal to any real weapon type) — fixed by
  letting `null`/`"None"`-weaponType candidates through regardless of equipped weapon.
- The actual Gunsaber weapon-skill-bar (1-5) was the genuinely hard part. The user's tooltips gave
  exact slot assignments (1: Swift Cut→Steel Divide→Explosive Thrust auto-attack chain, 2: Blooming
  Fire, 3: Artillery Slash, 4: Cyclone Trigger, 5: Break Step) with description text that let every
  id be nailed down precisely via the wiki. Along the way, caught the earlier investigation's ids
  (66473/65618/63841/64766) as flat-out wrong — a coincidental same-name collision with unrelated
  Cantha Living World NPC boss skills (e.g. the found "Artillery Slash" was actually Minister Li's
  attack, with completely different numbers from the user's screenshot). The REAL ids (Swift Cut
  62966, Blooming Fire 62930, Artillery Slash 62732, Cyclone Trigger 62789, Break Step 62885) are
  wiki-confirmed (description text matches the screenshots word-for-word) but — confirmed via a
  fresh direct query, not stale cache — don't resolve through the public `/v2/skills` endpoint at
  all ("all ids provided are invalid"), even though the bare id index shows no gap around them.
  Genuinely excluded from the public API, apparently deliberately on ArenaNet's side.
- Confirmed with the user: hand-author these 5 as `Skill` objects (new `gunsaber-skills.ts`) merged
  into `skillsById` at load time (`game-data-store.tsx`), same idea as Tome chapters being sourced
  outside the normal API pipeline. Icons use the wiki's own hosted images (no official CDN render
  exists for these) — the one deliberate icon-sourcing inconsistency in the app, called out
  explicitly rather than silently introduced. Facts are limited to non-damage structural data
  (Range/Recharge/Targets/Combo Finisher) plus the 2 real self-buffs that matter for this app's
  core purpose (Cyclone Trigger's 3s Aegis, Break Step's 5s Fury) — raw damage numbers from a
  screenshot are a function of the viewer's own power stat, not portable data, matching this app's
  existing, deliberate policy of never reconstructing those (`skill-calc/fact-numbers.ts`).
- Wired through the same "F1 click-toggle swaps the weapon bar to 5 fixed skills" bundle mechanism
  as Necromancer's Shroud (`GUNSABER_SLOT_SKILLS` in `bundle-skills.ts`, keyed by the Unsheathe
  Gunsaber id). Verified end-to-end with standalone trace scripts (not committed): Bladesworn's
  F-bar resolves to the right F1/F2 ids, the F1 icon is clickable, activating it resolves the
  weapon bar to exactly Swift Cut/Blooming Fire/Artillery Slash/Cyclone Trigger/Break Step in the
  right slot order with working wiki icon URLs, the boon extractor correctly picks up Aegis/Fury
  from the right 2 skills, and a base Warrior (no elite spec) still sees a normal per-weapon Burst
  Skill at F1 rather than Gunsaber — confirming the weapon-type-filter fix didn't regress the
  normal case.
- Closed out the last open Ranger item from Session 36 (core Ranger/Druid's missing F1/F3
  pet-command icons): confirmed with the user those two skills ("Attack My Target"/"Return To Me")
  are pure pet-movement commands with no combat effect, so this app (scoped to boon/condition
  tracking) has no reason to model them — removed from TODO.md rather than left open.

## Session 36 — Skill bar feedback pass: Ranger

Continuing the 2026-07-31 skill-bar UI/UX feedback pass (TODO.md), working through Ranger's items.

- Pet-swap (`PetsEditor.tsx`) and Untamed's Normal/Unleashed toggle (`WeaponSkillBar.tsx`'s
  "extras" section) both replaced their named text-toggle buttons with the same small cycle-icon
  button already used for weapon-set-swap/Legend-swap (`SkillBarIcon` `kind="cycle"`). Pet-swap's
  two picker slots now sit either side of the cycle button in one row (matching
  `RevenantSkillsEditor`'s Legend-slot layout exactly) instead of a separate row below.
- Fixed "Unflinching Fortitude" (id 45797) incorrectly showing on every non-Soulbeast Ranger form's
  F3. Root cause: it's one of the 5 per-pet-archetype Soulbeast Beastmode F3 ids (confirmed present
  in `data/game-data/soulbeast-beastmode.json`'s `f3SkillId` values, description starts "Beast."
  exactly like the rest of that kit) but its raw `specialization` field is null — same class of gap
  as "Worldly Impact" already excluded in `profession-mechanic.ts`. Added to
  `EXCLUDED_MECHANIC_SKILL_IDS` alongside it.
- Pet F2 display scope: confirmed with the user that core Ranger/Druid/Untamed should keep showing
  the active pet's F2 skill (real GW2 mechanic whenever you have a separate, un-merged pet) and
  only Soulbeast should hide it (Beastmode fully replaces it). `PetsEditor` now takes
  `equippedSpecializationIds` and skips its own skill-bar row when `RANGER_BEASTMODE_SPEC_ID` is
  equipped.
- Druid's Celestial Avatar now click-toggles from its own F5 icon in `ProfessionMechanicBar`, same
  pattern as Firebrand Tomes/Necromancer Shroud, replacing its "Weapon/Celestial Avatar"
  text-toggle row entry (Engineer Kits keep the row). `isMechanicBarBundleId` extended to include
  `CELESTIAL_AVATAR_SKILL_ID`.
- Found and fixed a real data-identification bug while investigating the "wrong icons" part of
  that same TODO item: `celestialAvatarSlotSkillIds` (`bundle-skills.ts`) was filtering on
  `specializationId === 5` (Druid), which only proves "gated to Druid" — true of BOTH Celestial
  Avatar's real transformation skills AND Ranger's normal (non-transformed) Staff weapon bar
  (`profession.weapons.Staff.skills`: Solar Beam/Astral Wisp/Ancestral Grace/Vine Surge/Sublime
  Conversion, tagged `specializationId: 5` at the weapon level since Staff was originally
  Druid-exclusive — a damage/heal hybrid kit used to build Astral Force, not what you see once
  transformed). Toggling Celestial Avatar on previously showed those same Staff icons unchanged,
  which is what the TODO's "showing Ranger staff weapon-skill icons instead of the real Astral
  skill icons" was actually describing. The real transformation skills (Cosmic Ray/Seed of
  Life/Lunar Impact/Rejuvenating Tides/Natural Convergence) are a separate, heal-focused set
  live-verified via `categories.includes('CelestialAvatar')` plus descriptions that all literally
  start "Celestial Avatar." (same naming-convention tell as Soulbeast's "Beast."-prefixed kit).
  Each slot has 2 near-identical duplicate ids (a `GroundTargeted`/`NoUnderwater` flag pair with no
  other distinguishing field, same shape as Ritualist's Shroud slots) — falls back to the lower id
  deterministically, a documented known limitation, not a guessed land/underwater split. Verified
  end-to-end with a standalone trace script (not committed) before shipping: resolves to Cosmic
  Ray/Seed of Life/Lunar Impact/Rejuvenating Tides/Natural Convergence, in slot order.
- Remaining Ranger item from the feedback pass (core Ranger/Untamed F1/F3 pet-command icons) is
  blocked on a real data gap, not UI — see TODO.md.

## Session 35 — Skill bar feedback pass: General, Guardian, Necromancer

Working through the 2026-07-31 skill-bar UI/UX feedback pass (TODO.md), starting with the two
profession-agnostic "General" items, then Guardian's two, then Necromancer's Shroud toggle.

- Weapon-skill-bar empty-state placeholder ("Choose a weapon in the Equipment panel...") now has a
  fixed width matching a full 5-slot skill row (272px = 5 × 48px buttons + 4 × 8px gaps), so the
  bar no longer changes width switching between the placeholder and real skill icons, land or
  underwater. New `.weapon-bar-empty-placeholder` CSS class in `global.css`.
- "Weaponmaster Training" is now always-on: `EquipmentEditor.tsx`'s `weaponOptions` no longer
  gates a weapon type behind its `specializationId` being in the build's equipped specs — every
  weapon type an elite spec unlocks for a profession (e.g. Renegade's offhand Shield on
  Revenant, Deadeye's main-hand Scepter on Thief) is now equippable regardless of which spec is
  active. Removed the now-unused `equippedSpecializationIds` prop from `EquipmentEditor`
  accordingly (only that one gating check read it). Left `weapon-calc/weapon-skills.ts`'s
  spec-matched-skill-variant resolution (e.g. Engineer Sword's Holosmith-vs-base "Sun Edge") as-is
  — it already falls back correctly to the spec-less variant when the gating spec isn't equipped,
  just updated its doc comment since it no longer references EquipmentEditor gating as the reason
  spec-matched always wins.
- Dragonhunter's F1-F3 Virtue icons ("Spear of Justice"/"Wings of Resolve"/"Shield of Courage")
  now actually differ from core Guardian's, as they should. Root cause (live-verified against both
  the wiki and the live `/v2/professions/Guardian` API response): a genuine gap in that endpoint —
  Dragonhunter's virtue-rework ids are simply absent from Guardian's `professionSkills` array,
  unlike every other Guardian elite spec's virtue rework (Firebrand/Willbender/Luminary), even
  though the 5 ids involved (29887, 30783/30225, 30039/30029) do exist in `/v2/skills` correctly
  tagged `specialization: 27` and the right `Profession_1`/`_2`/`_3` slot — same class of gap as
  Ranger's "Worldly Impact" already documented in `profession-mechanic.ts`. Fixed by hand-injecting
  those 5 ids (`DRAGONHUNTER_VIRTUE_SKILLS`) into `professionMechanicBar`'s candidate list for
  Guardian specifically; the existing flip-chain/spec-match resolver logic handles picking the
  right one per slot with no further changes needed.
- Firebrand's F1-F3 Tome icons in `ProfessionMechanicBar` are now clickable, replacing the separate
  "Weapon / Tome of Justice / Tome of Resolve / Tome of Courage" text-toggle row for Tomes
  specifically: click a Tome icon to swap `WeaponSkillBar`'s displayed 1-5 row to that Tome's
  chapters, click the active one again to revert to Weapon, click a different Tome while one's
  active to switch directly to it — all still driving the same `Build.activeBundleSkillId` field
  the old row used, so the boon/condition calc and `WeaponSkillBar`'s "weapon" section needed no
  changes. Engineer Kits and Druid's Celestial Avatar keep using the old text-toggle row unchanged
  (`WeaponSkillBar`'s new `toggleRowIds` excludes only the ids `ProfessionMechanicBar` now handles
  itself) — Druid's own click-toggle conversion is a separate, still-open TODO item (it also needs
  an icon fix Firebrand didn't). New `.skill-slot-button.active` CSS class for the highlighted
  state.
- Necromancer's Shroud (core Death Shroud, Reaper's, Harbinger, Ritualist's — not Scourge, which
  uses the unrelated Shade mechanic) now works the same way: F1 is clickable, swapping the weapon
  row to Shroud's 5 skills. This one needed real data archaeology, not just a UI change: Shroud's
  slots 1-4 are tagged `slot: "Downed_1"`-`"Downed_4"` in the raw API (reusing the Downed-state
  bar's own labels, confirmed against the wiki for all 4 variants — not a guess), with only slot 5
  tagged `"Weapon_5"`; Reaper's slot 1 is itself a 3-hit chain and slot 3 has a flip target,
  resolved the same "keep the entry point, drop the flip target" way `weapon-calc/weapon-skills.ts`
  already does; Ritualist's slots 3 and 5 each have 2 near-identical duplicate ids with no
  distinguishing field (documented known limitation, falls back to the lower id, same shape as the
  Weaver Dual Attack case). New `NECRO_SHROUD_SLOT_SKILLS` map in `bundle-skills.ts`, hooked into
  the existing `bundleCapableSkillIds`/`resolveActiveBundle`/`bundleSkillIdsForBuild` functions
  alongside Kits/Tomes/Celestial Avatar (Shroud always contributes to boon/condition totals
  regardless of display state, same "could be entered at will" reasoning as every other bundle).
  Generalized the Firebrand-only "is this clickable in the F-bar" check from a literal
  `id in tomeChapters` into a shared `isMechanicBarBundleId` helper (Tomes ∪ Shroud) so both
  `ProfessionMechanicBar` and `WeaponSkillBar`'s `toggleRowIds` stay in sync automatically as more
  professions get this treatment.
- Follow-up bug found immediately after the above landed (user report: Reaper/Harbinger/Ritualist
  were all displaying core Death Shroud's skills instead of their own): the F1 "which Shroud is
  this" resolution in `profession-mechanic.ts` was the culprit, not `NECRO_SHROUD_SLOT_SKILLS`
  itself — Reaper's Shroud/Harbinger Shroud/Ritualist's Shroud are, unlike every other elite spec's
  mechanic-skill rework already handled in this file, tagged `specializationId: null` in the raw
  API (verified live), so the generic resolver's spec-match step couldn't tell them apart from core
  and its "lowest id" tie-break always silently picked Death Shroud (10574) regardless of equipped
  spec. Fixed with a small `NECRO_SHROUD_SPEC_OVERRIDE` map feeding the resolver a corrected
  `specializationId` per id, so the existing spec-match/flip-chain logic resolves each case
  correctly unmodified — confirmed against all 4 (no elite spec / Reaper / Harbinger / Ritualist)
  plus Scourge (unaffected, already correctly tagged) with a standalone trace script before
  shipping.
- Investigated Warrior Bladesworn's Dragon Trigger (F2) per the TODO item, but it turned out to
  need its own innate-weapon foundation first ("Gunsaber") that doesn't exist in this app at all —
  bigger than the TODO's framing assumed. Deliberately stopped short of implementing rather than
  shipping unverified data: Gunsaber's core skills come back from the live API with no
  profession/spec/slot fields whatsoever (worse than Dragonhunter's gap), and two wiki fetches for
  its slot 4-5 skills gave contradictory names. Full findings and the ruled-out red herring
  ("Gunstinger"/"Dragon's Roar" are Bladesworn's off-hand-Pistol Weaponmaster-Training unlock, not
  Gunsaber) are written up in TODO.md's Warrior section for whoever picks this up next.
- Verified via `npm run typecheck` and `npm run lint` (both clean); no test suite exists yet to run.

## Session 34 — Thin backend: shareable build/squad links, deployed live

Picked up the next item in the 2026-07-31 roadmap priority order (Electron packaging → thin
backend → whatever follows). Two scoping questions were asked before starting, since the app is a
desktop Electron app rather than a website: how does someone actually "view" a shared link, and
should the Worker get deployed live this session or just scaffolded. Answers: no public web viewer
for v1 (an in-app "Import from link" paste box instead, plus a separate screenshot-to-clipboard
feature for sharing a look with non-users), and deploy it live together this session rather than
leaving deployment for later.

- **`worker/`**: a new, self-contained npm project (own `package.json`/`tsconfig.json`, deliberately
  outside the root TypeScript project references and `npm run typecheck`/`lint`, though
  `eslint.config.js` gained `worker/.wrangler/**`/`worker/dist/**` ignores since flat-config ESLint
  would otherwise lint wrangler's own local-dev build artifacts). `worker/src/index.ts` is a single
  hand-rolled fetch handler (no framework — matches this codebase's established preference for
  hand-rolling interactive/small pieces over adding a dependency) over a Cloudflare KV namespace:
  `POST /shares` (`{kind: 'build'|'squadComp', data}`, ~256KB cap, stored under a fresh
  `crypto.randomUUID()`, no TTL — shares are meant to persist indefinitely, matching `SquadComp`'s
  pre-existing "Immutable-snapshot-on-share by design" doc comment) and `GET /shares/:id` (404 if
  missing). Validates only "plausible kind + object", not the full `Build`/`SquadComp` shape — real
  shape checking happens client-side on import (`src/shared/share/validate.ts`), keeping the
  backend an intentionally dumb opaque-blob store.
- **Deployed live, walked through together**: `npx wrangler login` (interactive OAuth via a URL
  handed to the user — the first attempt timed out waiting for them to click through, which
  incidentally confirmed this shell's backgrounded processes really do stay alive and listening,
  unlike the Electron GUI launches documented elsewhere as silently dying; a second attempt
  succeeded), `npx wrangler kv namespace create SHARES`, `npx wrangler deploy` → live at
  `https://gw2-squaded-share.vanwheelstheman.workers.dev`. Verified with a real create+get roundtrip
  against the live URL via both `curl` and PowerShell's `Invoke-RestMethod`.
  **Environment finding**: this shell's `curl` intermittently returned a Cloudflare edge error
  (1042) or hung on repeated rapid requests against the live `*.workers.dev` URL, while the exact
  same requests via PowerShell's `Invoke-WebRequest`/`Invoke-RestMethod` succeeded cleanly every
  time — treated as a `curl`-in-this-shell networking quirk (verified via a different network
  stack, not the Worker), not a deployment problem. Worth remembering if a future session sees
  flaky `curl` results against a real external HTTPS endpoint from this shell.
- **Squad comps share as a self-contained snapshot, not build-id references**: `SquadCompSharePayload`
  bundles every build referenced by any roster slot (looked up from the sharer's local
  `buildsById`) alongside the `SquadComp` itself, since bare `buildId`s only resolve in the
  sharer's own local database. On import, every bundled build is recreated locally under a fresh id
  first, then slot `buildId`s are remapped onto the new ids before the squad comp itself saves.
- **Client wiring**: `src/renderer/share/share-client.ts` (`createShare`/`fetchShare`) calls the
  Worker directly via `fetch` in the renderer — no IPC round-trip through main, since it's a plain
  public HTTPS API — but `index.html`'s CSP gained `connect-src 'self' https://*.workers.dev` to
  actually allow it. New shared `SharePanel`/`ImportFromLinkButton` components
  (`src/renderer/components/common/`), wired into `BuildEditorView`/`SquadCompEditorView` (Share
  button) and `BuildsView`/`SquadsView` (Import-from-link button). The deployed URL is baked in as
  a hardcoded default in `share-client.ts` — not secret, a public unauthenticated API — so sharing
  works out of the box with no `.env` required; `VITE_SHARE_API_BASE_URL` still exists as an
  override (e.g. to point a dev build at a local `wrangler dev` instance).
- **Screenshot option** (replacing a web viewer for v1, per the scoping answer above): new
  `ScreenshotButton` copies a screenshot of the build/squad editor's visible area straight to the
  OS clipboard — `Element.getBoundingClientRect()` in the renderer feeds a new `capture:region` IPC
  channel (`src/main/ipc/capture-ipc.ts`) that calls `webContents.capturePage(rect)` then
  `clipboard.writeImage()` in the main process, exposed via a new `window.gw2Capture` preload
  bridge (`CaptureProvider`, mirrors the `StorageAdapter`/`GameDataProvider` seam pattern, but
  documented as desktop-only — no Capacitor-mobile equivalent, unlike those two). Known v1
  limitation, documented in code: only the currently-visible (unscrolled) portion of the target
  element is captured, since `capturePage` grabs from the rendered window surface rather than the
  full scrollable DOM — no full-page stitching attempted.
- Verified: `npm run typecheck`/`lint`/`build` all clean (including the worker's own `tsc --noEmit`,
  run separately since it's outside the root TS project). Not visually confirmed in a running
  window (standing Electron-sandbox limitation) — recommend `npm run dev` locally to eyeball the
  new Share/Import/Screenshot buttons.
- **Unblocks the Discord bot roadmap item** (was waiting on this).

## Session 33 — Electron packaging/distribution config

Picked up the roadmap item TODO.md flagged as top priority (2026-07-31 decision: "Electron
packaging first — nothing else meaningfully ships without it"). Landed `electron-builder.yml`
(appId `net.torastar.gw2squaded`, `productName: GW2-Squaded`, nsis/dmg/AppImage targets for
win/mac/linux, output to `dist/`) and 4 new `package.json` scripts
(`package:dir`/`package:win`/`package:mac`/`package:linux`).

Two real gaps surfaced and got fixed, not just config plumbing:

- **better-sqlite3's native binding can't load from inside an asar archive.** Added
  `asarUnpack: ['**/*.node']`. Confirmed by inspecting a real `package:dir` build's output tree:
  the platform prebuild `.node` files landed correctly at
  `dist/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3/prebuilds/`, outside
  the archive, where Node's `dlopen` can actually reach them.
- **`load-game-data.ts`'s `DATA_DIR` resolution only ever handled the unpackaged case** — its own
  doc comment already flagged this ("packaging this as an extraResources entry ... is still
  pending"). Added an `app.isPackaged` branch resolving to `process.resourcesPath/data/game-data`,
  paired with a new `extraResources` entry in `electron-builder.yml` shipping `data/game-data/`
  outside the asar at that exact path. Confirmed via the same real build: all 23 game-data JSON
  files landed at `dist/win-unpacked/resources/data/game-data/`.

No custom app icon — nothing resembling app branding/icon assets exists anywhere in this repo,
so electron-builder falls back to its own default Electron icon. Left as optional future polish
rather than guessed at.

**Environment finding, extends the standing Electron-sandbox limitation**: tried to launch the
real packaged `.exe` (not `electron-vite dev`'s spawn, which was already known-broken here) to
visually confirm the packaged app actually boots. It exits silently within ~1s — empty stdout and
stderr, no crash log — regardless of launch method (Git Bash, PowerShell `Start-Process`, with or
without `--disable-gpu`), and a pre-existing `gw2-squaded.sqlite` in `%APPDATA%\gw2-squaded` never
picked up a new mtime across any attempt, meaning the process never reaches `app.whenReady()` at
all — dying even earlier than the previously-documented dev-mode `isPackaged`-undefined crash,
most likely because this shell has no attachable interactive Windows desktop session for a GUI
process to open a window on. Not a code regression from this session's changes. Verified the
packaging work instead by inspecting the actual build output tree for both fixed gaps (see above)
plus `npm run typecheck`/`npm run lint` (both clean) and a full successful `npm run package:dir`
run (electron-rebuild for better-sqlite3, asar packing, unsigned local signtool pass, all
completed without error). Recommend `npm run package:dir` (or `:win`) locally and launching
`dist/win-unpacked/GW2-Squaded.exe` directly to confirm the packaged app boots, loads game data,
and persists builds/squad comps to its own userData SQLite file correctly.

## Session 32 — Weapon duplicate-skill-slot edge cases resolved (Revenant/Guardian/Engineer/Thief/Elementalist)

Picked up TODO.md's "New, discovered this session" weapon-skill-duplication item (originally spotted
2 cases: Revenant Sword's 6-entry off-hand slot, Elementalist's up to-26-entry per-attunement sets) and
did a full pass across every profession's raw `/v2/professions` weapon-skill data, not just those 2.
Found 5 distinct causes total, each resolved via a real signal (wiki-verified where the API alone
doesn't say enough) rather than left as an unexplained fallback:

- **Revenant Sword off-hand Weapon_4** — added a flip-root signal to `resolveSkillBarIds`
  (`weapon-calc/weapon-skills.ts`), the same one `skill-calc/skill-variants.ts` already used for
  Heal/Utility/Elite but never applied to weapon skills: "Duelist's Preparation" (`28571`) flips into
  "Shackling Wave" (`28472`) on a successful block, both raw candidates for the same slot — dropping
  whichever candidate is another same-slot candidate's `flipSkill` target now resolves this to `28571`
  (the id a player actually binds).
- **Guardian Shield "Shield of Judgment" (2 ids)** — confirmed via a full field diff both ids are
  byte-for-byte identical (legacy duplicate id). No code change; documented as confirmed-identical
  rather than an open limitation.
- **Engineer Sword (all 3 slots)** — wiki-confirmed a Holosmith-vs-"Weaponmaster Training" split (one
  id scales with Holosmith's Heat mechanic, the other doesn't). Added a `specializationId`-match
  signal to `resolveSkillBarIds` (mirroring `skill-variants.ts`/`profession-mechanic.ts`'s existing
  rule) — resolves cleanly since this app's weapon-type picker already requires Holosmith equipped
  before Sword is selectable at all.
- **Thief's 5 main-hand weapons' Weapon_3 "Dual Wield" triples** (Dagger/Axe/Pistol/Scepter/Sword) —
  the genuine hand-context case the old doc comment had flagged as unmodeled: which id fires depends
  on the *off-hand* weapon paired with that main-hand. No API field encodes this, so wiki-verified
  (one page per candidate id) a flat id -> required-off-hand-type table
  (`THIEF_DUAL_WIELD_OFFHAND`), including each weapon's "off hand empty" default. New `offWeaponType`
  parameter on `resolveSkillBarIds`; `weaponSkillIdsForPair` now passes each hand's weapon-type name
  to the *other* hand's resolution call.
- **Elementalist's per-attunement duplication** — reframed from "ambiguous ids" to what it actually
  is: 4 live, simultaneously-equipped attunement skill bars per weapon, same shape as Revenant's 2
  legends or the land/underwater Environment toggle. New `Build.activeAttunement` field (display-only,
  doesn't gate boon/condition totals — all 4 always contribute), a new attunement toggle row in
  `WeaponSkillBar.tsx` (Elementalist-only), and an `attunement` parameter on `resolveSkillBarIds` that
  filters to the selected attunement (every Elementalist weapon skill carries a non-null
  `Skill.attunement`; every other profession's is `null`, so this is a no-op elsewhere).
  `sources.ts`'s `weaponSkillIdsForBuild` now loops all 4 attunements for Elementalist when computing
  boon/condition sources. **Known remaining gap**: Weaver's "Dual Attack" weapon-3 replacements (e.g.
  3 different Fire-tagged ids all sharing `specializationId: 56`) can't be told apart by any signal
  this app has — which one is live depends on Weaver's *second* active attunement, a combat-state axis
  with no equivalent in this app's static loadout model. Falls back to the first candidate
  deterministically, documented not guessed.

Verified via `npm run typecheck`/`lint`/`build` (all clean) and a standalone script (not committed)
asserting 20 hand-derived expected ids across all 5 cases (including all Thief hand-context combos and
Engineer Sword's Holosmith gating), plus a direct check confirming the Weaver gap resolves to a valid
id rather than crashing. Not visually confirmed in a running window (standing Electron-sandbox
limitation) — recommend `npm run dev` locally to eyeball the new Elementalist attunement toggle and
the corrected Revenant/Engineer/Thief weapon skill bars.

## Session 31 — Ranger Untamed Unleash-Pet premise corrected; Vindicator Legend7 boon-calc gap fixed

Continued through TODO.md's next 2 open items in order: the Ranger Untamed "pet-family Unleash-Pet
skill set" gap, and the Vindicator Legendary Alliance Stance aspect-pair item.

- **Ranger Untamed: no code gap, only a wrong premise.** The open item assumed "Unleash Pet" grants
  the pet a 3-skill set that varies by pet family (e.g. Bear/Ursine), based on a screenshot, and
  queued up a `fetch-soulbeast-beastmode.ts`-shaped wiki-lookup script to resolve every family's ids.
  Live-checked the `Unleash_Ranger`/`Unleash_Pet` wiki pages' raw wikitext directly instead of
  re-reading the screenshot: "Unleash Pet" (id 63344) grants a **fixed** 3-skill set (Venomous
  Outburst/Rending Vines/Enveloping Haze), not a family-varying one — the screenshot was almost
  certainly showing the pet's own pre-existing, Untamed-*unrelated* default attack kit (documented on
  the wiki's general `Pet` page: every pet's 3 basic attacks are shared by its family, unrelated to
  Unleash). Also corrected the toggle direction, which an earlier session's note had backwards:
  "Unleash Ranger" (63147) is what empowers the Ranger's own autoattack (already correctly
  implemented, `untamed-unleash.ts`). Checked the code directly rather than assuming a gap: the fixed
  Venomous Outburst/Rending Vines/Enveloping Haze set already has exactly 1 unambiguous candidate id
  per slot (`specializationId: 72`, no competing candidate), so `professionMechanicBar`'s existing
  generic resolver already surfaces all 3 whenever Untamed is equipped and they already flow into the
  boon calculator — and `Build.rangerUnleashed`'s toggle UI (`WeaponSkillBar.tsx`) already existed too
  (landed in an earlier session, just not cross-referenced when this item was last touched). **No code
  changes** — updated `docs/game-data.md` (new "Untamed's Unleash mechanic, resolved" section),
  `profession-mechanic.ts`'s stale exclusion comment, and `Familiar`'s doc comment (dropped its wrong
  comparison to this "gap") so a future session doesn't re-queue the wiki-lookup script.
- **Vindicator Legendary Alliance Stance: real boon-calc undercounting bug, fixed.** The item's own
  prior-session scoping had already narrowed this to "confirm the `flip_skill`-or-equivalent link
  live" — confirmed directly against `skills.json`/`legends.json`: every one of Legend7's heal/
  utility/elite ids does carry a real `flipSkill` to its opposite-aspect (Saint Viktor vs. Archemorus)
  counterpart, 2-deep for Elite (Spear of Archemorus -> Urn of Saint Viktor -> Drop Urn of Saint
  Viktor). `RevenantSkillsEditor`'s tooltip already renders these via the existing
  `relatedVariantSkills` flip-chain walk — no "legend form" concept or display code needed, confirming
  the item's own lean. The real gap was in `sources.ts`: `skillIdsForBuild`'s Revenant branch only
  ever fed the boon calculator each legend's *base* ids, never their `flipSkill` targets, so every
  Saint-Viktor-side boon grant (Resistance/Regeneration/Protection/Stability — all real, confirmed via
  each id's own `Fact` data) was silently missing from any Legendary-Alliance build's totals. Widened
  the fix beyond just this one legend once a quick scan showed the same `flipSkill` pattern exists on
  nearly every other legend's channeled skill too (e.g. Herald's Facet of Chaos -> Chaotic Release
  granting Superspeed) — new `withFlipChain` helper folds each legend skill's full flip chain into the
  boon-calc id list generically, same "every equipped alternate always contributes" convention used
  everywhere else in this codebase (weapon-swap sets, both Ranger pets, Soulbeast Beastmode, Untamed's
  Unleashed autoattack). Verified via a standalone script (not committed): built a Vindicator test
  build with Legend7 equipped, confirmed all 5 previously-missing Saint-Viktor-side sources now appear
  with correct boon/condition grants, and the 2 that correctly stay absent do so for a legitimate
  reason (Selfless Spirit has no `Buff`-type facts at all; "Urn of Saint Viktor" grants only a
  self-tracking non-boon status effect, correctly filtered).
- `npm run typecheck`/`lint`/`build` all clean for both items. Not visually confirmed in a running
  window (standing Electron-sandbox limitation, see below) — recommend `npm run dev` locally to
  eyeball a Vindicator build's Legend7 tooltip showing both aspects per slot.

## Session 30 — Elite-spec skill gating: resolved all ~36 ambiguous / ~16 unmatched wiki pages

Picked up the last open sub-item under "Elite-spec skill gating for the Heal/Utility/Elite
pickers" — the ~36 skill names that matched multiple `skills.json` ids per wiki page (left
ungated, fail-safe) and the ~16 wiki pages that matched none at all.

- **Ambiguous-match rule**: every candidate id in an ambiguous match already carries its own
  `Skill.specializationId` field (already fetched from `/v2/skills`, not new data). Sanity-checked
  against the 211 previously-clean mappings first: 211/212 already agreed with `specializationId`
  exactly (the 1 exception has `specializationId: null` — a base skill the wiki category alone
  caught). That gave confidence to extend `fetch-elite-spec-skills.ts`: when a wiki title matches
  multiple ids and *every one* of them independently carries the current elite spec's own id (not
  a different spec's, not null), gate all of them instead of excluding the page. Dedup
  (`skill-variants.ts`) still decides which single id reaches the picker — this only had to
  guarantee whichever one that is comes out correctly gated. All ~36 groups turned out to be
  exactly this shape: ground-targeted/auto-target pairs and `flip_skill` chains living entirely
  within one elite spec (Herald's "Elemental Blast", Harbinger's 6 Elixirs, Evoker's Rejuvenate/
  Fox's Fury/Otter's Compassion/Hare's Agility/Toad's Fortitude/Elemental Procession, Conduit's
  4-id "Beguiling Haze", etc.), plus the Druid Glyph 3-way non-celestial/Celestial-Avatar forms.
- **Unmatched-page fix**: added a trailing `" (...)"` strip to `titleVariants` for MediaWiki
  disambiguation suffixes the API's own skill name never carries (e.g. wiki "Uppercut (Daredevil
  skill)" vs API `Uppercut`) — resolved the one unmatched page (of ~16) that wasn't already covered
  by the ambiguous-match fix above (the Druid Glyph "(non-celestial)"/"(Celestial Avatar)"
  sub-pages and Antiquary's "(backfired)" flavor pages were already redundant with their
  already-resolved base page).
- **Net result**: 295 skill→specialization mappings, 0 unmatched, 0 ambiguous (up from 212/16/36).
  `npm run typecheck`/`lint` both clean. Not visually confirmed in a running window (standing
  Electron-sandbox limitation) — recommend `npm run dev` locally; e.g. Evoker's utility skills
  (Fox's Fury etc.) should now only appear in the picker with Evoker equipped, not for every
  Elementalist build.

## Session 29 — Elementalist Evoker's familiar concept + Rejuvenate dedup

Picked up the "full modeling pass" TODO item for Elementalist's new Evoker elite spec, decided
2026-07-31 to be scoped like the earlier Legend/Pet work: model the "familiar" companion concept
enough to resolve the Heal skill "Rejuvenate"'s 4-id ambiguity (the last unresolved entry in the
multi-session duplicate-skill-id dedup list).

- **Corrected the original scoping note along the way**: it assumed Rejuvenate's 4 ids were "one
  per attunement" — live data shows all 4 actually share `attunement: null`; they differ by
  *familiar* instead. Confirmed via the skill's own wiki infobox, which annotates each id in an
  HTML comment: `id = 79323 <!-- fire -->, 76634 <!-- water-->, 79315 <!-- air -->, 79314 <!--
  earth -->`, cross-referenced against the `Evoker` wiki page's own Fox=Fire/Otter=Water/Hare=Air/
  Toad=Earth familiar-to-element mapping. All 4 ids share identical facts/recharge/description — an
  icon-only difference, not a gameplay one.
- **`Profession`/`Specialization` data already had Evoker** (`specializationId 80`) from a prior
  session's live fetch — no re-fetch gap there after all, just needed noticing.
- **New `Familiar` type** (game-data.ts): `{id, name, element, icon, rejuvenateSkillId}`. Sourced
  from a hand-verified 4-entry constant table in `fetch-game-data.ts` (`FAMILIARS`, same pattern as
  `LEGEND_SPECIALIZATION_ID`) rather than a new wiki-scrape script — the one Rejuvenate page already
  checked gave the complete mapping. `icon` is borrowed from the matching Rejuvenate variant's own
  icon (same "no dedicated portrait endpoint" reasoning as `Legend.icon`). New `familiars.json`
  output, wired into `load-game-data.ts` and `game-data-store.tsx` (`familiarsById`,
  `familiarIdBySkillId`).
- **New `Build.familiarId` field** (Elementalist Evoker-only — mirrors `rangerUnleashed`'s
  "meaningless for every other profession" shape). `BuildEditorView.tsx` resets it to `null` on a
  profession change away from Elementalist or on dropping the Evoker trait line, same pattern as
  the existing pet-id reset logic.
- **New `skill-variants.ts` signal (8th)**: `visibleSkillsForSlot`/`resolveGroup` gained
  `familiarIdBySkillId`/`selectedFamiliarId` params. Since all 4 Rejuvenate ids share
  `specializationId: 80`, the existing per-spec signal can't tell them apart (matches all 4, not
  useful) — the new signal picks the id matching the build's currently-chosen familiar, falling
  back to the lowest id when none is chosen yet, so the picker always collapses to exactly 1 entry.
  Same "functionally identical, cosmetic-only difference" shape as the existing `GroundTargeted`
  signal, just resolved by a `Build` field instead of always collapsing to one fixed id.
- **New `EvokerFamiliarSelect.tsx`**: single-pick icon row, same template as `EliteSpecSelect`.
  Wired into `SkillsEditor.tsx`, rendered only when Elementalist + Evoker are both equipped.
- **Deliberately not modeled**: the familiar's own passive combat bonus and active F5 skill (a
  6-charge accumulation + "empowered after 3 casts" state machine — confirmed via the wiki's
  `Evoker`/`Familiar` pages — that this app's static loadout model has no equivalent for; no
  `/v2/familiars` API endpoint exists either). Documented in `Familiar`'s doc comment as the scope
  boundary, same shape as Untamed's still-unmodeled pet-family Unleash-Pet skill set.
- **Verified**: a standalone script (not committed) confirmed 4 familiars with unique
  elements/icons, confirmed `visibleSkillsForSlot` resolves each of the 4 familiar choices to
  exactly its own Rejuvenate id and defaults to the lowest id (76634) with no familiar chosen, and
  confirmed an unrelated duplicate-name group (Mist Form) is untouched by the new signal. `npm run
  typecheck`/`lint`/`build` all clean. Not visually confirmed in a running window (standing
  Electron-sandbox limitation, see below) — recommend `npm run dev` locally to eyeball the new
  Familiar picker row.

## Session 28 — Soulbeast's Beastmode F1-F3 (per-pet-family/archetype skills)

Picked up the "Soulbeast's real Beastmode gap" TODO item left open since Session 23/25: Beastmode's
F1/F2 skills depend on the merged pet's *family* and F3 on its *archetype*, neither of which
`professionMechanicBar`'s generic per-spec resolver (nor anything else in this app) had any way to
know — the slot was simply dropped for Soulbeast builds.

- **No API field links a pet to a Beastmode skill at all** — sourced entirely from the wiki's
  `Soulbeast` page's `== Pet Family ==` (26 rows: single-species families like Phoenix/Warclaw/
  Wallow as direct `[[Juvenile X|X]]` links, or shared multi-species families like Bear/Feline/
  Canine as bare `[[Bear]]`-style links, each giving F1/F2 skill titles; Feline's row also carries
  one inline `<small>(...)</small>`-tagged White-Tiger-only F2 override) and `== Pet Archetypes ==`
  (F3 title per archetype in a fixed Stout/Deadly/Versatile/Ferocious/Supportive column order, plus
  every individual pet species enumerated as a real `[[Juvenile X|X]]` link per family+archetype
  cell) tables. New `scripts/fetch-soulbeast-beastmode.ts` (`npm run fetch-soulbeast-beastmode`)
  parses both live and resolves every title to a real skill id: unique (name, slot) matches resolve
  directly against the local Ranger `Profession_1`/`_2`/`_3` candidate pool; the 4 real same-name-
  same-slot collisions found ("Bite" ×2, "Tail Lash" ×2, "Brutal Charge" ×2, "Worldly Impact" ×2 —
  the latter already a known legacy-duplicate-id gap, see `EXCLUDED_MECHANIC_SKILL_IDS`) are
  disambiguated by fetching that specific title's own wiki page for its `id=`, same shape of
  per-page resolution `fetch-elite-spec-skills.ts`/`fetch-skill-duplicate-resolutions.ts` already
  use.
- **Real finding: the wiki's aggregate tables lag actual game content.** Live-verified 2026-07-30
  that after fully resolving both tables, 4 local `Profession_1`/`_2` Soulbeast (`specializationId
  === 55`) skill ids remained unaccounted for: "Jet"/"Tail Whip" (a brand-new pet, Juvenile River
  Otter — its own `{{Pet infobox}}` confirmed `family = River Otter`, a family that doesn't appear
  in either wiki table at all) and "Saurian Might"/"Leaping Lizard" (an undocumented per-species F1/
  F2 override for Juvenile Raptor Swiftwing, which shares the Avian archetype family — confirmed via
  its own infobox — but not Avian's shared "Bird" F1/F2, and has no dedicated override row the way
  Phoenix/Warclaw do). Rather than hand-pinning these two cases, the script resolves any leftover id
  generically: wiki-search `"<skill name>" soulbeast`, fetch the first result whose own `{{Skill
  infobox}}` `id=` matches, and read that page's `pet=`/`mechanic slot=` fields directly — every
  Beastmode F1/F2 skill's own page carries these, a *more* authoritative per-skill signal than the
  aggregate table, and this makes the resolution self-healing against future new-pet content lag
  rather than a one-time hand-patch. New pets found only via this leftover sweep (no archetype table
  entry) get their `archetype=` read straight from their own infobox page as a final step (River
  Otter: `Supportive`).
- **Net result**: all 66 pets in `pets.json` resolve to a complete, real `{f1SkillId, f2SkillId,
  f3SkillId}` triplet, written to `data/game-data/soulbeast-beastmode.json` (new
  `SoulbeastBeastmodeMap` type, keyed by `Pet.id` — no new field needed on `Pet` itself, since the
  fetch script resolves family/archetype down to a flat per-pet triplet once rather than the app
  needing to reason about pet families anywhere else). Only 1 log line: the wiki's own "Vampiric
  Bite (soulbeast)" title for Wallow's F1 turned out to document a skill removed from the game in a
  2023-11-28 patch (its own `status = historical` field says so) and replaced by the generic Porcine
  family's shared "Maul" — the script's own family-default fallback (used whenever a species' own
  row leaves a slot unresolved) already produces the correct current answer without needing that
  case special-cased.
- **Wiring**: new `soulbeastBeastmodeBar` in `profession-mechanic.ts` resolves the *active* equipped
  pet's (`Build.equippedPetIds[activePetIndex]`) F1-F3 from the new map (`Profession_4`, "Eternal
  Bond", stays unresolved — no per-pet data exists for it, unchanged from before); wired into
  `ProfessionMechanicBar.tsx` ahead of the generic resolver's own output whenever Soulbeast (spec
  55) is equipped, same prepend pattern the Engineer Toolbelt already uses. `RANGER_BEASTMODE_SPEC_
  ID` exported from `profession-mechanic.ts` (was a private const) so both the UI and `sources.ts`
  share one definition instead of a second hardcoded `55`. `sources.ts`'s `skillIdsForBuild` folds
  in *both* equipped pets' full F1/F2/F3 triplets unconditionally whenever Soulbeast is equipped —
  same "both always contribute regardless of which is currently active" reasoning as every other bar
  toggle (`activeWeaponSet`/`activeLegendIndex`/`activePetIndex` itself) — so the boon/condition
  calculator now correctly picks up boon-granting Beastmode skills (e.g. a merged pet's kit) instead
  of silently missing them. `computeBoonConditionSources`'s and `computePartyBoonConditionSummary`'s
  inline `gameData` parameter types both grew a `soulbeastBeastmode` field; every call site already
  passes the full `useGameData()` store, so no call-site changes were needed beyond the type.
- **Verified**: a standalone script (not committed) confirmed the active pet's bar resolves
  correctly and swaps when `activePetIndex` flips (specifically checked White Tiger's Phase Pounce
  F2 override), the generic `professionMechanicBar` still excludes `Profession_1`-`_4` for
  Soulbeast, boon/condition calculator output is byte-identical regardless of `activePetIndex`
  (both pets always contribute), a build with no Soulbeast spec equipped leaks no Soulbeast-gated
  id, and all 66 pets resolve to a complete triplet. `npm run typecheck`/`lint`/`build` all clean.
  Not visually confirmed in a running window (standing Electron-sandbox limitation, see below) —
  recommend `npm run dev` locally to eyeball the new Soulbeast F1-F3 buttons in the
  profession-mechanic bar.

## Session 27 — Remaining duplicate-skill groups: turret sub-abilities + wiki exclusion

Continued down the list of ~17 remaining ambiguous duplicate-name Heal/Utility/Elite skill groups
Session 26 left after resolving the 6 Druid Glyphs. Investigated all 17 by hand (11 Engineer,
Ranger's Spike Trap, Elementalist's Rejuvenate/Mist Form, Mesmer's Mirage Advance, Revenant's
Protective Solace/Jade Winds) and found two more real, verifiable signals rather than guessing at
any of them.

- **Turret/gadget/elixir context-menu sub-abilities aren't a dedup problem at all — they were never
  independently equippable to begin with.** "Automatic Fire", "Detonate Rocket Turret", "Overcharge
  Supply Crate", etc. appear once you place the parent turret/gadget/elixir; you never bind them to
  a Heal/Utility/Elite slot directly. Found a clean, local-data-only signal distinguishing these
  from real picks: every genuinely-equippable skill in the 745-skill Heal/Utility/Elite dataset
  carries a non-empty `categories` (`Kit`/`Gadget`/`Turret`/`Elixir`/...); every sub-ability instead
  has `categories: []` while sharing its `toolbeltSkill` value with the real equippable skill that
  generates it. Verified against all 256 empty-`categories` skills in the dataset with zero false
  positives (plenty of legitimate skills like "Med Kit" also lack a category — only the ones
  sharing a `toolbeltSkill` with a *categorized* sibling are sub-abilities). New
  `stripNonEquippableSubAbilities` in `skill-variants.ts`, an unconditional pre-pass (no wiki fetch
  needed) — empties "Automatic Fire"/"Detonate Rocket Turret"/"Detonate Supply Crate
  Turrets"/"Overcharge Supply Crate" entirely and resolves "Grenade Kit" to 1 id for free.
- **New `scripts/fetch-skill-duplicate-resolutions.ts`** (`npm run fetch-skill-duplicate-resolutions`)
  for whatever's left after that: imports and calls the real `visibleSkillsForSlot` (not a
  reimplementation) to re-derive what's still ambiguous today, then per group fetches that skill
  name's wiki page and excludes any local id absent from its `id=` field — same "wiki main page is
  authoritative" trust level as `fetch-glyph-forms.ts`, requiring at least one local id to overlap
  before trusting the page match. Fully resolved Rocket Turret (drops a `GroundTargeted` duplicate
  plus an undocumented legacy id `22574`), Elixir X and Spike Trap (each drops a dedicated
  "(underwater)" sibling page's id — Spike Trap's original "stun vs. launch" TODO note turned out to
  be a wrong guess: the wiki's own version history says plainly this is an environment split, not a
  trait rework), and Mirage Advance (drops an undocumented legacy id). Narrowed Slick Shoes and
  Rocket Boots from 4 ids to 2 (drops each one's confirmed underwater pair; their land pairs remain
  ambiguous, likely old-vs-reworked with no distinguishing field). Left Throw Mine, Mist Form,
  Protective Solace, and Jade Winds fully untouched — wiki lists every local id together with either
  no distinguishing field (Mist Form/Jade Winds/Protective Solace) or a confirmed Gadgeteer-trait
  gate this app's picker has no way to act on today (Throw Mine, would need trait-aware picker
  logic, an architecture change out of scope here).
- **New finding, out of scope but flagged**: Elementalist's "Rejuvenate" (Heal skill, 4 ids) turned
  out to belong to a brand-new elite spec never seen in this project before —
  `specialization = Evoker` per the wiki — whose Heal skill varies by a new "familiar" companion
  concept with no model anywhere in this app (no `Familiar` type, nothing on `Build`). Left
  completely alone and flagged as its own future item (same shape as the Legend/Pet additions),
  since actually resolving it needs new-feature work, not a dedup fix.
- `GameData` gained `skillVariantExclusions: number[]` (`load-game-data.ts`,
  `game-data-store.tsx`'s `EMPTY_GAME_DATA` and the `skillsForProfessionAndSlot` call site,
  `fetch-game-data.ts`'s `Omit<GameData, ...>` summary type). `visibleSkillsForSlot` gained a 4th
  parameter consuming it as a pre-pass.
- Verified via a standalone script (not committed) asserting the exact expected id set for all 16
  investigated groups (4 fully resolved, 2 narrowed, 4 emptied by the sub-ability signal, 1
  full-resolved-for-free by the sub-ability signal, 5 left intentionally unchanged) — caught and
  fixed one real ordering bug in the process: `stripNonEquippableSubAbilities` must run on the
  *full* candidate set before `skillVariantExclusions` removes anything, since "Detonate Rocket
  Turret" `38748` only recognizes itself as non-equippable by finding its categorized sibling
  Rocket Turret `22574` still present — and `22574` is itself one of the ids
  `skillVariantExclusions` removes. Fixed by reordering the pre-passes in `visibleSkillsForSlot`.
  `npm run typecheck`/`lint`/`build` all clean. Not visually confirmed in a running window (standing
  Electron-sandbox limitation, see below) — recommend `npm run dev` locally to eyeball the
  now-shorter Engineer Utility/Elite picker lists. See docs/game-data.md for the full per-group
  writeup with wiki citations.

## Session 26 — Druid Glyph duplicate-skill disambiguation

Picked up one of the ~23 remaining genuinely-ambiguous duplicate-name skill groups
`skill-variants.ts` left unresolved: Druid's 6 duplicate-named Glyph skills (Glyph of
Rejuvenation/the Tides/Alignment/Equality/Burgeoning/the Stars), each with 3 API ids that the
existing `specializationId` signal can't tell apart (every id in a group shares the same
`specializationId: 5`, since the whole skill — not one variant of it — is Druid-gated).

- **Live-verified the resolving pattern via the wiki, not guessed**: each Glyph has one "parent"
  wiki page whose own `{{Skill infobox}}` `id=` is the id a player actually binds to a
  Heal/Utility/Elite slot — its effect changes automatically with current Celestial Avatar form,
  the same "one id, context-dependent effect" shape `Skill.attunement` already models for
  Elementalist glyphs (e.g. Glyph of Lesser Elementals) — plus 2 purely-descriptive child pages
  ("Glyph of Equality (non-celestial)" / "Glyph of Equality (Celestial Avatar)") that exist only so
  the wiki can document each form's effect separately and whose ids were never independently
  equippable at all. This overturns the TODO item's original premise (that a future CA-form toggle
  would need to swap between base/CA picker entries) — there's nothing to toggle in the picker,
  since the one canonical id already handles both forms live in-game.
- New `scripts/fetch-glyph-forms.ts` (`npm run fetch-glyph-forms`, after `fetch-game-data`):
  discovers every duplicate-named Ranger `categories: ["Glyph"]` group live from
  `data/game-data/skills.json` (not a hand-typed name list, so it's self-updating if the API/wiki
  ever adds a 7th), fetches each parent + child wiki page, and only records a mapping when the
  parent id is a member of the local group AND the child ids together with the parent id exactly
  account for every id in the group — any mismatch is logged and the group left unresolved, same
  fail-safe posture as every other fetch script in this project. All 6 known groups resolved
  cleanly on a live run; output is the new `GlyphFormVariantMap` type
  (`data/game-data/glyph-form-variants.json`, variant id -> canonical id).
- Wired into `skill-variants.ts`'s `visibleSkillsForSlot` as a new 5th pre-pass signal (alongside
  attunement/specialization/flip-root/ground-target), consumed as an optional
  `glyphFormVariants` parameter — dropped before per-name grouping runs, same treatment
  `stripFlipTargets` already gives flip targets. `GameData` gained a `glyphFormVariants` field
  (`game-data.ts`, `load-game-data.ts`, `game-data-store.tsx`'s `EMPTY_GAME_DATA` and the
  `skillsForProfessionAndSlot` call site); `fetch-game-data.ts`'s `Omit<GameData, ...>` summary type
  updated to exclude it, matching how `eliteSpecSkills`/`wvwFactOverrides`/etc. are already excluded
  there (produced by separate wiki-sourced scripts, not the main API fetch).
- Verified via a standalone script (not committed): resolved Heal/Utility/Elite picker candidates
  for a Druid-specialized Ranger build and confirmed all 6 groups now collapse to exactly 1
  picker-visible id each, matching the wiki-verified canonical id (e.g. "Glyph of Equality" -> only
  `31746` shown, `31401`/`31658` dropped). `npm run typecheck`/`lint`/`build` all clean. Brings the
  TODO's "~23 remaining ambiguous groups" count down to 17. Not visually confirmed in a running
  window (standing Electron-sandbox limitation, see below) — recommend `npm run dev` locally to
  eyeball the now-shorter Druid Utility/Elite picker lists.

## Session 25 — Celestial Avatar / Untamed weapon-bar swap

Picked up the "Celestial Avatar / Untamed weapon-bar swap" TODO item Session 24 left deferred
("needs scope/priority decision" — unknown whether Celestial Avatar's 5 Astral skills have real API
ids like Kits, or need a wiki scrape like Tomes). Both halves resolved entirely from already-fetched
data — no new fetch script needed, and one of the item's own assumptions turned out wrong (same
"investigation overturns the premise" shape as Session 24's Soulbeast finding).

- **Celestial Avatar (Druid) has real API ids** — live-verified: every skill tagged
  `specializationId === 5` (Druid) with a `Weapon_1`-`Weapon_5` slot is exactly one of the 5 Astral
  skills (Solar Beam/Astral Wisp/Ancestral Grace/Vine Surge/Sublime Conversion), a clean 1-per-slot
  set with no land/underwater duplication (Celestial Avatar has no underwater variant, matching that
  it can't be entered underwater in-game). Implemented as a straight extension of Session 24's
  bundle-skill machinery: `bundle-skills.ts` gained `celestialAvatarSlotSkillIds` (resolves the 5 ids
  live from `skillsById` rather than a hand-maintained list — self-updating if the API changes) and
  `CELESTIAL_AVATAR_SKILL_ID` (31869, Druid's `Profession_5` mechanic skill, same id
  `professionMechanicBar` already resolves onto F5); `bundleCapableSkillIds`/`resolveActiveBundle`/
  `bundleSkillIdsForBuild` all special-case this one id alongside Kits/Tomes. No `WeaponSkillBar.tsx`
  changes needed beyond a doc-comment update — the existing "Weapon"/kit/tome toggle row and
  bundle-slot rendering already handle any bundle-capable id generically.
- **New finding, overturns part of the item's own premise**: Untamed's Unleash mechanic does **NOT**
  replace the full weapon bar (1-5) the way Kits/Tomes/Celestial Avatar do — live-checked the wiki's
  own Unleash Ranger/Unleash Pet pages 2026-07-30, which state the mechanic is a single toggle
  cycling the Ranger between two states on a 1-second cooldown: "Unleash Pet" swaps the *pet's*
  F1-F3 command skills to Venomous Outburst/Rending Vines/Enveloping Haze (already wired, Session
  23), and "Unleash Ranger" empowers the Ranger's own weapon **autoattack only** (slot 1) — e.g.
  "Hammer's turns into Relentless Whirl, Mace's becomes Rampant Growth." Confirmed this isn't
  Hammer/Mace-specific flavor text: live data search found a `specializationId === 72` (Untamed)
  alternate Weapon_1 skill for every Ranger weapon type except Torch/Warhorn (which have no Weapon_1
  at all, being offhand-only) — Axe/Sword/Greatsword/Longbow/Shortbow/Staff/Dagger/Speargun/Spear all
  have one too, Spear's split further by land (Ravager's Abandon) vs. underwater (Vicious Pike) via
  the same `NoUnderwater`-flag convention weapon land/underwater variants already use. Confirmed this
  matters for the boon/condition calculator, not just cosmetics: Relentless Whirl's facts include a
  3s Stability application (a real boon) that Hammer Strike's plain-damage facts don't have.
  New `src/shared/skill-calc/untamed-unleash.ts` (`unleashedWeaponOneId`): finds a weapon type's
  Untamed-alternate Weapon_1 skill by excluding the base weapon's own autoattack chain (walked via
  `Skill.flipSkill`, needed because Hammer's *entire* chain carries `specializationId === 72` too —
  Hammer itself is Untamed-exclusive — so a naive "any spec-72 Weapon_1 skill" filter would wrongly
  match the chain's own middle/end hits as if they were the alternate) then applying the same
  land/underwater `NoUnderwater`-flag disambiguation `resolveSkillBarIds` already uses. New
  `Build.rangerUnleashed: boolean` (display-only, same "both states always contribute" reasoning as
  every other bar toggle — Unleashed cycles too fast in real combat to model as a deliberate,
  long-lived choice); `WeaponSkillBar.tsx` grew a Normal/Unleashed toggle row (only shown when an
  alternate exists for the current main-hand weapon) that swaps slot 1's displayed skill;
  `sources.ts`'s `weaponSkillIdsForBuild` now always includes both the base and Unleashed alternate
  id for an Untamed build's main-hand weapon, regardless of the toggle. This also means the "Ranger
  pet's 3-more-skills-per-pet-category" bullet the TODO grouped alongside this one is a *separate*,
  still-fully-open gap (Untamed's "Unleash Pet" pet-family skill set, not a weapon-bar-replacement at
  all) — left as its own TODO line, not touched this session.
- Verified via a standalone script (not committed): resolved Celestial Avatar's bar for a
  Druid-specialized build and confirmed all 5 names/order match the prediction above; resolved every
  Ranger weapon type's base-vs-Unleashed Weapon_1 pair and confirmed Hammer/Mace match the wiki's own
  named examples exactly, Spear correctly splits by environment, and Torch/Warhorn correctly resolve
  to no autoattack at all. `npm run typecheck`/`lint`/`build` all clean. Not visually confirmed in a
  running window (standing Electron-sandbox limitation, see below) — recommend `npm run dev` locally
  to eyeball the new Celestial Avatar bundle toggle and the Untamed Normal/Unleashed toggle.

## Session 24 — Engineer Kits and Firebrand Tomes replace the weapon skill bar

Picked up the "Tomes/Kits/Beastmode replacing the weapon skill bar (1-5) while active" TODO item
left open after Session 23's F-bar work, scoped by the user as a "full pass" (do Kits, Tomes, AND
Beastmode in one go, including the Firebrand wiki cross-check). Investigation partway through
overturned one of the item's own assumptions — see below.

- **Engineer Kits**: real API ids the whole way. Added `Skill.bundleSkills` (the API's
  `bundle_skills` field, previously uncaptured) and re-ran `npm run fetch-game-data`; live-confirmed
  a kit (Grenade Kit, id 5805) lists 10 bundle skill ids — 5 land + 5 underwater, same
  `Weapon_1`-`Weapon_5` slot + `NoUnderwater`-flag disambiguation weapon types already use.
  `weapon-calc/weapon-skills.ts`'s `resolveWeaponSkillIds` generalized to `resolveSkillBarIds`
  (takes a bare `{id, slot}[]` instead of requiring a `ProfessionWeapon`) so both weapons and kits
  share one resolver — no logic duplicated.
- **Firebrand Tomes**: confirmed live 2026-07-30 the 15 chapter skills (5 per tome — e.g. Tome of
  Justice's "Chapter 1: Searing Spell" through "Epilogue: Ashes of the Just") have **no id anywhere
  in the public API**, even though each chapter's own wiki page lists one in its `{{Skill infobox}}`
  (`/v2/skills?ids=41258` returns "all ids provided are invalid" for the id the wiki names). New
  `scripts/fetch-tome-chapters.ts` (`npm run fetch-tome-chapters`) scrapes all 15 chapter pages:
  each tome's page lists its 5 chapters via `{{Weapon skill table row|<name>}}` in slot order; each
  chapter's own page has `description`/`facts=`/`weapon slot=` fields, the `facts=` using the exact
  same `{{skill fact|...}}` template relics use — so `fetch-relic-effects.ts`'s parser
  (`RelicFactLine`, pipe-protection, WvW-line selection) was reused verbatim via a duplicated copy
  (these are standalone scripts, no shared script-lib module exists yet) rather than rewritten.
  Hit one real bug copying it: the pipe-protection placeholder is a private-use-area Unicode
  character (``) invisible in a text editor — a naive retype produced a real empty string,
  silently turning every `split('|')` into a per-character split. Caught immediately by inspecting
  the first fetch's output (garbled single-character "facts") rather than trusting a clean-looking
  run; fixed by writing the exact codepoint via a small Node script instead of retyping it.
  New `TomeChapter`/`TomeChaptersByTomeId` types; no per-chapter icon exists on the wiki infobox, so
  every chapter falls back to its parent tome's own icon (documented simplification, not a guess at
  an icon this app has no source for).
- **Shared plumbing**: new `Build.activeBundleSkillId: number | null` — display-only, same "every
  equipped option always contributes to boon/condition totals regardless of which is shown"
  reasoning as `activeWeaponSet`/`activeLegendIndex`/`activePetIndex` (a kit/tome can be opened at
  will mid-fight, so gating boon-calc inclusion on which one is currently *displayed* would
  undercount). New `src/shared/skill-calc/bundle-skills.ts` (`bundleCapableSkillIds`/
  `resolveActiveBundle`/`bundleSkillIdsForBuild`) resolves which equipped skills are bundle-capable
  (Kits from `build.skills.utility`; Tomes from Firebrand's always-present F1-F3, found via the
  existing `professionMechanicBar`) and what their 5 slots show for a given environment.
  `WeaponSkillBar.tsx` grew a toggle row (one button per bundle-capable skill, plus "Weapon") that
  swaps the displayed 1-5 bar; Kit slots reuse the existing `Skill`-based tooltip machinery for free
  (real ids, real `Fact`s); Tome slots get a small dedicated path (`tomeChapterBoonSources`, new
  export in `sources.ts`, plus `factsBlock` exported from `SkillsEditor.tsx` for reuse) since
  chapters have no `Skill.facts` to read — it interprets each chapter's wiki-sourced
  `RelicFactLine`s the same way `extractFromFacts` reads API `Fact`s (first bare value = duration,
  `stacks=` = `apply_count`) for any label matching a boon/condition name. Both Kit skills' and Tome
  chapters' contributions are folded into `computeBoonConditionSources`'s output unconditionally,
  closing the "doesn't factor into the boon/condition calculator" gap the TODO item also flagged.
- **New finding, overturns part of the item's own premise**: Ranger Soulbeast's Beastmode does
  **NOT** replace the weapon-skill bar at all — live-checked the wiki's "Beastmode" page, which
  states plainly the F1-F2 skills depend on the merged pet's *family* and F3 on its *archetype*
  (i.e. it changes the *profession-mechanic* F1-F4 bar, the same slot shape `professionMechanicBar`
  already resolves for every other profession's mechanic), plus a short list of *existing*
  weapon/heal/utility/elite skills gaining a bonus secondary effect while merged — not a bar swap.
  Session 23's "Beastmode has real ids, same shape of work as Kits" framing was written before
  checking the wiki; corrected in TODO.md. Descoped from this pass — Soulbeast's F1-F4 stay
  intentionally absent (pre-existing `RANGER_BEASTMODE_EXCLUDED_SLOTS` exclusion), since resolving
  them for real needs a pet-family/archetype → skill-id wiki mapping (partially scoped in TODO.md
  as its own new item: the wiki's family/archetype tables are mostly clean but a few skill *names*
  are shared across different families, e.g. "Bite" for both Bear and Feline, needing disambiguated
  per-page id lookups the same shape `fetch-elite-spec-skills.ts` already does).
- **Verified**: a standalone script (not committed) built a Firebrand test build and confirmed the
  Tome of Justice's Epilogue chapter correctly yields Burning (3s) + Might (8s ×5 stacks — the
  WvW-tagged values, not the PvE-only 2s/8-stack ones sitting right next to them in the wikitext);
  and an Engineer test build with Grenade Kit equipped resolves to the `NoUnderwater`-flagged ids on
  land and the plain ids underwater, matching hand verification exactly. `npm run typecheck`/`lint`/
  `build` all clean. Not visually confirmed in a running window (standing Electron-sandbox
  limitation, see earlier sessions) — recommend `npm run dev` locally to eyeball the new Weapon/
  Kit/Tome toggle row and chapter tooltips.

## Session 23 — Trait tier alignment fix, full F1-F5 profession-mechanic bar

Two pieces of follow-up on Session 22's F-skill investigation, plus an unrelated trait-layout fix
requested at the start of this session.

- **Trait tiers: minor centered beside a vertical column of 3 majors, not on top of a horizontal
  row.** Session 22 made each trait line a horizontal row (Zeal/Virtues/Firebrand stacked), but
  within each of the 3 tiers the minor trait sat above a horizontal row of 3 majors — not quite the
  gw2skills.net reference the user pointed at, where the minor sits centered to the *side* of the 3
  majors stacked *vertically*. Fixed in CSS only (no JSX change needed — `TraitsEditor.tsx` already
  rendered the minor before the major group per tier): `.trait-tier-group` flipped from a column to
  a row (minor left, majors right, `align-items: center` so the minor centers against the 3-row
  column's full height), and `.major-trait-tier` flipped from a row to a column.
- **F1-F5 profession-mechanic ("F-skill") bar — the "broad" scope from Session 22's deferred
  decision.** Session 22 landed the data layer and a resolver but explicitly didn't wire any UI,
  flagging a scoping decision: build genuine per-profession special-casing for Warrior/Engineer/
  Ranger, or only show the bar where it's already a simple per-spec fact. Asked the user; they chose
  broad. Before writing any code, live-verified the real API across all 9 professions (not just
  Guardian) to find every wrinkle up front:
  - **Guardian/Necromancer/Mesmer/Elementalist(F1-F4)/Thief(F1 only)** — clean, the existing generic
    resolver already handles these (Thief's F2 "stolen skill" is explicitly skipped — its
    candidates are tagged per enemy `source` profession, i.e. it depends on who you steal from in a
    live fight, not on anything in the build).
  - **Warrior** — Burst Skill (F1) has dozens of same-slot candidates with no `specializationId` at
    all, varying by equipped weapon type instead; `professionMechanicBar` gained an optional
    `mainHandWeaponType` param used only for this one slot, reusing `WeaponSkillBar.tsx`'s existing
    main-hand lookup. Spellbreaker's F2 had 6 legacy `categories:["Burst"]` duplicate ids alongside
    the real "Full Counter" — pinned via exclusion.
  - **Engineer** — the base Toolbelt (F1-F4) isn't in `professionSkills` at all; it's generated per
    equipped Heal/Utility choice instead. Added `Skill.toolbeltSkill` (the API's `toolbelt_skill`
    field, previously uncaptured) and a new `engineerToolbeltBar` function, independent of the
    slot-based resolver. F5 elite-spec sub-mechanics: Holosmith clean; Scrapper's "Function Gyro"
    had 2 orphaned duplicate ids (pinned to the highest, best-effort); Mechanist and the newest
    Engineer elite spec ("Amalgam") are excluded entirely — genuinely ambiguous/dynamically-chosen
    data, not worth guessing at.
  - **Ranger** — turned out to need an entirely different concept than the original TODO assumed.
    `/v2/pets` gives exactly one real, always-equippable skill per pet — that's the whole
    per-build-determinable Ranger mechanic. Added `Pet` (`pets.json`, mirroring `Legend`'s fetch
    pattern) plus new `Build.equippedPetIds`/`activePetIndex` fields (top-level, NOT folded into
    `SkillSelection` — a Ranger's pets are additive to its normal skill picks, not a full-kit
    replacement like a Revenant's legends) and a `PetsEditor` component mirroring
    `RevenantSkillsEditor`'s 2-slot-picker-plus-active-toggle shape. The large `Profession_1`/`_2`
    id list this app's existing `professionSkills` data already had for Ranger (e.g. "Swoop"/"Bite")
    turned out to be Soulbeast's Beastmode skill-bar replacement, not this mechanic at all — same
    shape as Firebrand Tomes/Engineer Kits, folded into that existing separate TODO item instead of
    treated as part of this one.
  - **Revenant** — deliberately still gets no F-bar: confirmed live its `Profession_2` candidates
    are exactly each legend's own `swap` skill id, already fully shown by the existing Legend
    picker.
  - Also fixed a latent correctness gap in the resolver itself while wiring all this in: a slot
    whose only candidates require an unequipped elite spec (e.g. a newest-spec-only F4/F5) would
    previously still resolve to that spec's skill by default (via the "if nothing matches, use
    every candidate" last-resort fallback) even when the build has no elite spec at all equipped —
    now the resolved skill's `specializationId` is checked against the build's equipped specs and
    the slot is dropped entirely if it doesn't match, rather than shown wrong.
  - `EXCLUDED_MECHANIC_SKILL_IDS` in `profession-mechanic.ts` holds every hand-verified pin/
    exclusion above with its own reasoning comment, same pattern as `LEGEND_SPECIALIZATION_ID` in
    `fetch-game-data.ts`. New `ProfessionMechanicBar.tsx` renders the resulting read-only bar
    (same visual pattern as `WeaponSkillBar`'s disabled buttons) inside `SkillsEditor.tsx`, above
    the Heal/Utility/Elite (or Legend) bar, for every profession except Revenant/Ranger.
  - Ran `npm run fetch-game-data` live to pick up the new `toolbelt_skill`→`toolbeltSkill` field
    and the new `pets.json` file. Full writeup of every live-verified finding (including the exact
    ids excluded/pinned and why) in docs/game-data.md's "Profession-mechanic ('F-skill') data" and
    new "Ranger pets" sections. See TODO.md for the still-open follow-up (Tomes/Kits/Beastmode
    actually replacing the weapon skill bar while active).
  - **Verified**: `npx tsc --noEmit` clean after each phase. Not visually confirmed in a running
    window (standing Electron-sandbox limitation in this shell, see prior sessions) — recommend
    `npm run dev` locally to eyeball the new F-bar/pet picker across a few professions.

## Session 22 — Follow-up build-editor feedback: horizontal traits, weapon/spec pickers, gear copy/paste, F-skill investigation

Picked up a fresh round of user feedback (with reference screenshots) on the build editor, given
after an earlier same-day pass (commit `6db4ef7`, backfilled below — it landed before this session
started but was never written up in these docs) had already redesigned the trait lines into
condensed rows and swapped the Heal/Utility/Elite picker and itemstat combos to icons.

- **Traits: fixed the macro layout, not just the per-line content.** The `6db4ef7` pass condensed
  each line's content but left `.traits-editor` as a 3-side-by-side-columns CSS grid — the user's
  screenshots showed gw2skills.net's real layout is 3 stacked *horizontal* rows (Zeal/Virtues/
  Firebrand, each reading left-to-right). `TraitsEditor.tsx` rewritten: `.traits-editor` is now a
  vertical flex stack, each `.trait-line` a horizontal flex row.
- **Removed the per-line expand/collapse, adopted the picker pattern more broadly instead.** The
  user clarified the part of the gw2skills reference actually worth keeping is the specialization
  *picker* (small button, current pick shown, click opens an overlay, pick-and-close) — not hiding
  a line's tiers. Deleted the `expandedLines`/`condensedSummary`/`expandedTiers` split; tiers now
  always render once a spec is chosen. The spec picker itself now reuses the existing
  `UpgradePicker` component (already used everywhere for runes/sigils/infusions/relics/food/
  utility) instead of an always-visible row of every available spec icon.
- **Same picker tech applied to weapon-type selection**, per explicit request: `EquipmentEditor`'s
  `weaponTypeRow` (previously an always-visible row of every weapon-type icon) now renders a single
  `UpgradePicker` instead.
- **Gear copy/paste**, built to the user's own proposed design (confirmed, not redesigned): a new
  "copy/paste bar" at the top of `EquipmentEditor` with 4 template slots (Stat Prefix/Rune/Sigil/
  Infusion), each a local-state-only `UpgradePicker` (not part of the `Build`). `UpgradePicker`
  gained a `dragCategory` prop (`gear-drag-payload.ts`, native HTML5 DnD, same approach as the
  squad editor's existing drag-and-drop — no new dependency): any picker sharing a `dragCategory`
  string can drag its value out and accept a same-category drop, so an ordinary gear slot can also
  copy directly from another ordinary slot, not just from a template. Each template also has an
  "Apply to All" button (`applyStatToAll`/`applyRuneToAll`/`applySigilToAll`/`applyInfusionToAll`)
  that bulk-fills every eligible slot for that category at its own existing capacity.
- **F1-F6 profession-mechanic skills (Tomes, Kits, etc.) — investigated, data layer landed, UI
  deliberately deferred.** This looked like a small "also show F1-F5" addition but turned out to be
  one of the deepest remaining mechanics in the game to model correctly. Added
  `Profession.professionSkills` (raw `/v2/professions` `skills` array, filtered to `type ===
  'Profession'`) and `src/shared/skill-calc/profession-mechanic.ts` (`professionMechanicBar`),
  which resolves a mechanic slot's raw candidates down to the one id that applies for a build's
  equipped specs — verified correct across all of Guardian's base/Dragonhunter/Firebrand/
  Willbender/Luminary combinations, including a real wrinkle (Firebrand's F1 slot lists 3 ids for
  "Tome of Justice" alone — the real skill, a wiki-documented "dormant" duplicate, and its "Stow
  Tome" close button — resolved via a `flipSkill`-chain-aware tiebreak, see the file's doc comment).
  **Did not wire this into any UI**: live-checking all 9 professions showed the mechanic is
  genuinely multi-axis for most of them — Warrior's Burst Skill depends on equipped *weapon type*,
  Engineer's Toolbelt depends on equipped *Utility skill choice*, Ranger's F2-F5 depend on equipped
  *pet* (not modeled anywhere in this app), and Revenant's duplicates the already-separate Legend
  system — so a generic bar built only on this resolver would be flat wrong for most professions.
  Full findings in docs/game-data.md's new "Profession-mechanic ('F-skill') data" section and
  TODO.md (2 follow-up items: scoping the F-bar display itself, and separately the much deeper gap
  of Tomes/Kits actually *replacing* the weapon skill bar 1-5 while active — confirmed live that the
  replacement skills, e.g. Tome of Justice's 5 "Chapter" skills, have no id anywhere in the public
  API at all, only unlinked names on the wiki page).
- **Mantra/charge-based multi-effect tooltips — confirmed already covered, no code change.**
  Verified the `6db4ef7` pass's flip-chain tooltip work (`skill-calc/multi-effect.ts`'s
  `relatedVariantSkills`) already handles this: a Mesmer "Mantra of Pain" tooltip already shows its
  own ammo-count fact ("Number of Casts: 2") plus an appended sub-block for its charged cast
  ("Power Spike") with that skill's own distinct facts. Documented in TODO.md so this specific
  complaint isn't mistaken for an open gap later.
- **Backfilling commit `6db4ef7`** ("Fix stats/tooltip bugs; redesign traits, skill picker, and
  equipment icons"), landed earlier the same day but never written up here: fixed the stats panel
  double-counting inactive weapon sets, stripped raw GW2 markup from tooltips, clamped tooltips to
  stay on-screen, dropped the itemstat possessive ("Wanderer" not "Wanderer's"), dropped Legendary-
  tier duplicate runes/sigils/relics from pickers, gave squad slots the equipped elite spec's icon
  plus ghost placeholders for empty slots, added the flip-chain/attunement "additional effects"
  tooltip work this session builds on, redesigned the Heal/Utility/Elite picker into icon-only
  category columns, and switched the itemstat-combo picker to real per-stat icons. See that
  commit's message for the full list — not independently re-verified here, just recorded so the
  history isn't silently missing a real landed pass.
- **Verified**: `npm run typecheck`, `npm run lint`, `npm run build` all clean. Not visually
  confirmed in a running window — re-attempted via the `run` skill this session and re-confirmed
  the standing Electron-sandbox limitation still applies in this shell (`npm run dev`'s spawned
  Electron process crashes on `electron.app.isPackaged` being undefined, same root cause as every
  prior session, unrelated to these changes); recommend `npm run dev` locally to eyeball the new
  horizontal trait rows, the click-to-open spec/weapon-type pickers, and the copy/paste bar.
- **Also refreshed `data/game-data/{professions,skills,meta}.json`** via a live `npm run
  fetch-game-data` run (needed to pick up the new `professionSkills` field) — incidental small
  live-data drift in `skills.json` (a handful of ids' `type`/`slot`/`specializationId`/`flipSkill`
  fields changed since the last fetch) reviewed and is normal upstream data movement, not a
  regression.

## Session 21 — Squad preview builder (party grid, drag-and-drop, boon/condi summaries)

Picked up TODO.md's next unstarted major feature after the build-editor overhaul was judged
essentially complete. User provided a hand sketch ("Squad Manager") and answered follow-up
questions to nail down scope before any code was written (see TODO.md's squad-preview-builder item
for the full confirmed-decisions writeup: both click and drag for slot assignment, per-slot
editable placeholder labels, a 10-party hard cap built to comfortably show ~5, presence-only party
summary for v1).

- **Key discovery before writing any code**: `SquadComp`/`Party`/`PartySlots`/`SquadSlot`
  (`src/shared/types/squad-comp.ts`) and the full SQLite/IPC/`window.gw2Storage.squadComps`
  persistence stack already existed, apparently scaffolded ahead of this feature in an earlier
  session and never wired to any UI (`SquadsView.tsx` was a one-line stub). This meant the whole
  feature landed as renderer + one shared calc module, with zero schema/IPC changes.
- **New `src/renderer/state/squad-comps-store.tsx`**: mirrors `builds-store.tsx` exactly
  (`SquadCompsStoreProvider`/`useSquadCompsStore` over `window.gw2Storage.squadComps`), plus
  `makeBlankParty`/`makeBlankSquadComp` helpers. Wired into `App.tsx` alongside the existing
  `BuildsStoreProvider` (the squad editor needs `useBuildsStore()` too, to resolve `buildId → Build`
  and populate the builds sidebar).
- **New `src/shared/squad-calc/party-summary.ts`** (`computePartyBoonConditionSummary`): for each
  assigned slot in a party, calls the existing (unchanged) `computeBoonConditionSources` and merges
  every source into a map keyed by boon/condition name, each entry keeping per-contribution
  `{slotIndex, buildName, sourceName, sourceIcon, scaledDurationSeconds, applyCount}` for hover-tooltip
  attribution. Deliberately a presence union, not a merged-uptime %, per the user's confirmed v1
  scope and the existing "combined/ideal uptime" stretch goal already noted under the boon-calc
  TODO item — modeling true combined uptime would need cooldown/rotation-overlap reasoning this app
  doesn't do anywhere. A slot whose `buildId` doesn't resolve (empty, or a deleted build a squad
  still references) is silently skipped, same fail-safe pattern used throughout this codebase.
- **New `src/renderer/components/squad-editor/` directory**:
  - `SquadCompEditorView.tsx` — top-level editor (parallels `BuildEditorView.tsx`'s `draft`/
    `onSave`/`onCancel`/`isNew` contract). Owns all party/slot mutation logic: `assignBuild`,
    `changeLabel`, `dropBuild` (the drag-drop swap/move logic, see below), `renameParty`,
    `addParty`/`removeParty` (capped at 10 parties, minimum 1).
  - `BuildsSidebar.tsx` — every saved build, each card `draggable` via the native HTML5 drag API.
  - `PartyRow.tsx` — one "Line": party name input, an expand/collapse toggle (local `useState`,
    intentionally *not* persisted on the squad comp — it's a pure display affordance) controlling
    whether each slot's own boon/condi rows render, 5 `SlotTile`s, and the always-visible
    party-wide summary column built from `computePartyBoonConditionSummary`.
  - `SlotTile.tsx` — the big per-slot box. Reuses the existing generic `UpgradePicker` component for
    the click-to-assign path (see below); shows an editable free-text role label
    (`SquadSlot.placeholderLabel`) only while empty, replaced by the build's name once assigned;
    always a drop target, and draggable itself (to move/swap an already-assigned build) when
    occupied; when the row's toggle is expanded, renders the build's own boon/condition icon
    summary via the exact data `BoonUptimePanel` already computes.
  - `BoonConditionIconRow.tsx` — shared minimal icon+tooltip row, taking a generic
    `{key, icon, tooltip}[]` shape. Used by both `SlotTile` (per-build groups from
    `groupBoonConditionSources`) and `PartyRow` (party-wide entries from the new calc module) — no
    calc logic duplicated, just a shared icon-list view each caller feeds independently.
  - `drag-payload.ts` — tiny helper pair (`setBuildDragData`/`readBuildDragData`) encoding
    `{buildId, sourcePartyIndex, sourceSlotIndex}` (the latter two `null` when dragging from the
    sidebar) into `dataTransfer` under a custom MIME type.
- **Drag-and-drop implemented natively (HTML5 `draggable`/`onDragOver`/`onDrop`), no new
  dependency**: no DnD library (`@dnd-kit`, `react-dnd`, etc.) was installed, and this codebase's
  established convention is to hand-roll interactive widgets rather than pull a library —
  `Tooltip.tsx`'s own doc comment explicitly rejects a library approach for the same reason. The
  interaction needed (drag a build card, drop on a slot) is simple enough that native HTML5 DnD
  covers it fully. `SquadCompEditorView.dropBuild` reassigns the target slot's `buildId` to the
  dragged build, and — only when the drag originated from another slot, not the sidebar — writes
  the target slot's *previous* `buildId` back into the source slot, so dragging one assigned slot
  onto another performs a real swap rather than clobbering the destination silently.
- **`UpgradePicker` generalized to a generic component** (`UpgradePicker<T extends number | string =
  number>`, `src/renderer/components/build-editor/UpgradePicker.tsx`) so the squad-slot build picker
  (`SlotTile`) could reuse it directly instead of writing a near-duplicate grid component — build
  ids are UUID strings, but every existing gear-upgrade category (runes/sigils/infusions/relics/
  food/utility) uses numeric item ids. Defaulting `T` to `number` means both existing callers
  (`ConsumablesEditor.tsx`/`EquipmentEditor.tsx`) needed no changes; `SlotTile` instantiates it with
  `UpgradeOption<string>[]`.
- **`SquadsView.tsx` rewritten** from its one-line stub to mirror `BuildsView.tsx`'s list/create/
  edit/delete pattern exactly, using the new store.
- **New CSS** appended to `src/renderer/styles/global.css` (`.squad-editor`, `.builds-sidebar`,
  `.party-row`, `.slot-tile`, `.party-summary-column`, `.boon-icon-row`, etc.), reusing existing
  sizing/color conventions (`--border`/`--surface`/`--accent`, `.skill-slot-button`'s icon-button
  pattern enlarged for the bigger slot tiles) rather than inventing a new visual language.
- **Verified**: `npm run typecheck`, `npm run lint`, `npm run build` all clean. A standalone script
  (not committed) built two Firebrand builds sharing one heal skill (Restoring Reprieve) across 2
  slots of a test party, plus an empty slot and a slot referencing a nonexistent build id, and
  confirmed `computePartyBoonConditionSummary` merges the 2 Aegis contributions with correct
  per-build (`buildName`) attribution, correctly omits the PvE-only Protection/Resolution facts
  (existing WvW-override machinery, unchanged), and silently skips the empty/missing-build slots
  rather than erroring — matching the same "Restoring Reprieve" case hand-verified in Session 8's
  WvW-split work. Not visually confirmed in a running window — standing Electron-sandbox limitation
  (this shell's spawned Electron process crashes on `electron.app.isPackaged` being undefined, see
  every prior session's note); recommend `npm run dev` locally to eyeball assigning builds via both
  click and drag-and-drop, editing placeholder labels, toggling each Line's boon/condi summary, and
  hovering the party-wide summary icons to see per-character source/duration attribution.
- **Left open, noted in TODO.md, not forgotten**: a "Favorites" pin for the builds sidebar once
  rosters get large; the build-picker's `description` text is just the profession name today, not a
  fuller spec/gear summary; native HTML5 drag-and-drop has no touch-input equivalent, worth
  revisiting only if/when the Capacitor mobile port needs squad editing on a tablet.

## Session 20 — Relic numeric effects via a wiki `{{skill fact}}` cross-check

Continuation of "Build editor UI/UX overhaul" → the character-stats-panel item's relic sub-item,
picking up the "scoping question for whoever picks this back up" Session 15 left open: relic
tooltips only showed prose `description` text (the public API exposes nothing structured for
relics, confirmed in Session 14) — inert-text-forever vs. investing in a ~211-page wiki
cross-check, the same shape of effort as `fetch-wvw-splits.ts`. User chose the wiki cross-check.

- **Confirmed live (not assumed) that relic wiki pages reuse the exact `{{skill fact|...}}`
  template skills/traits use**, inside a `{{Relic infobox}}`'s `facts=` field — e.g. Relic of the
  Warrior's page literally contains `{{skill fact|Weapon Swap Recharge Reduction|25%}}`, matching
  the "25%" a screenshot had predicted 2 sessions ago but the API couldn't confirm. Checked ~10
  relic pages by hand first (a Buff/boon-shaped one, a damage-coefficient one, a multi-fact
  "effect"-wrapped one, a plain-recharge-only "summon a creature" one) before writing any parsing
  code, same discipline as every prior wiki-sourced fetch script in this project.
- **New `scripts/fetch-relic-effects.ts`** (`npm run fetch-relic-effects`, after
  `fetch-gear-upgrades`): fetches each of the 113 unique relic *names* (not all 211 ids — see
  below) via `action=raw`, extracts the `{{Relic infobox}}` block, and parses every `{{skill
  fact|...}}` invocation inside its `facts=` field into a generic `{label, values, params}` shape
  (not modeled semantically per fact "type" the way skill/trait Buff facts partially are — too
  varied: damage coefficients, boon names, stack counts, min/max duration pairs, flat percentages).
  Lines split by `game mode=` are resolved to the WvW-relevant one before storing (PvE-only/PvP-only
  siblings for the same label are dropped). Also captures a relic's internal cooldown from the
  infobox's own `recharge=`/`recharge wvw=`/`recharge pvp=` fields — discovered live that 7 relics
  have a WvW-specific recharge distinct from PvE (e.g. Relic of the Lich: `recharge=60`, `recharge
  wvw=120`), a real WvW-vs-PvE split in a place this app hadn't looked before (recharge time, not a
  boon/condition duration).
- **Two real wrinkles found and handled, not guessed around:**
  - **113 unique relic names cover 211 ids, but MediaWiki has one page per exact title.** A live
    check of every name-sharing id's API `description` text found 106 names where every id's
    description is byte-identical (safe to apply one page's facts to all of them — re-releases,
    level-80-boost variants, etc.) but **7 names where the ids' descriptions genuinely differ**
    (e.g. "Relic of the Pack": one id grants "superspeed, might, and fury", another grants only
    "superspeed" — an old pre-rework version and a newer one coexisting under one display name).
    For those 7, facts are attributed *only* to the id(s) the wiki page's own `id=` field
    explicitly lists (7 ids excluded, each logged) rather than guessed to apply everywhere.
  - **Naive `|`-splitting breaks on a piped wikilink or nested template inside a later field** — a
    full scan found 8 fact lines across the whole catalog with a `[[Link|text]]` or `{{template|
    arg}}` pipe embedded in a `desc=`/`alt=` value. `protectPipes`/`restorePipes` swap one level of
    such pipes for a placeholder before splitting, resolving 7 of the 8; the 8th (a `{{sic|...}}`
    nested inside a link's own `desc=`, on "Relic of the Living City") is caught by a
    bracket-balance check on each split segment and the whole fact line is dropped+logged rather
    than stored corrupted — no independent API value exists here to cross-validate against (unlike
    `fetch-wvw-splits.ts`), so this balance check is the only safety net, and it's deliberately
    conservative (drop on any doubt, never guess).
  - Also handled: a disambiguation-page retry (2 relic names — "Relic of Dwayna" collides with an
    unrelated back-item page — retried as `"<name> (relic)"`), and 5 relic names (all "summon a
    creature while in combat" relics, e.g. Relic of the Lich/Ogre/Golemancer/Privateer) that have
    no `{{skill fact}}` lines at all — just a recharge, correctly left with an empty `facts` array
    rather than treated as a parse failure.
- **New types** (`src/shared/types/game-data.ts`): `RelicFactLine`, `RelicEffect`,
  `RelicEffectsById`; `GameData` gained `relicEffects`, threaded through `load-game-data.ts` →
  `game-data-store.tsx` (plain pass-through, same as every other lookup-by-id field — no new store
  method needed since it's already keyed by relic id).
- **New `src/shared/gear-calc/relic-effects-format.ts`** (`formatRelicDescription`): renders each
  fact as `Label: value` (title-cased), with two special cases — an `effect`-type fact shows its
  `desc=` payload plus duration in seconds (e.g. "+1% Healing Increase to Others (3s)"), and `alt=`
  overrides the display label when present (disambiguates a relic with two same-label facts, e.g.
  Relic of the Zephyrite's separate `alt=Minimum Duration`/`alt=Maximum Duration` pair; also
  corrects at least one wiki mislabeling, Relic of the Necromancer's "movement speed increase"
  fact whose `alt=Movement Speed Decrease` reveals it's actually a debuff applied to enemies).
  Wired into `ConsumablesEditor.tsx`'s relic option list via `UpgradePicker`'s existing
  `description` prop — no UI component changes needed, since `.tooltip-description` already
  renders `white-space: pre-line` for food/utility's multi-line stat text.
- **Deliberately NOT wired into `sources.ts`'s boon/condition uptime calculator**, despite some
  relics' facts literally being boon names (e.g. "might", "protection" appear as fact labels on
  several relics). A skill's Buff fact is a guaranteed on-cast effect, fully within player control;
  a relic's fact fires on a conditional in-combat trigger ("after granting a boon to an ally",
  "upon dealing damage with a 20s+-recharge skill") with no fixed per-rotation frequency this app
  models anywhere — aggregating it into an uptime total would invent a number the app doesn't
  actually have, unlike every other source `sources.ts` currently reads. Scoped as a
  display-layer-only enrichment; documented in TODO.md/docs/game-data.md as an explicit boundary,
  not an oversight, for whoever next considers modeling proc frequency.
- **Result**: 204 of 211 relic ids got a real `RelicEffect` entry (108 relic names have at least
  one fact line; 5 have none, just a recharge; 7 ids excluded per the differing-description rule
  above; 1 fact line dropped as unparseable).
- **Verified**: `npm run typecheck`, `npm run lint`, `npm run build` all clean (one lint fix along
  the way — swapped a literal `\x00` placeholder for a Private-Use-Area character, since ESLint's
  `no-control-regex` flags literal control characters in a regex). Rendered `formatRelicDescription`
  output for 8 hand-picked relics spanning every case (a plain single-fact relic, a multi-fact
  relic with a WvW-specific recharge override, an `effect`-wrapped boon-duration fact, a
  game-mode-split fact, a "summon a creature" relic with no facts, the min/max-duration
  `alt=`-disambiguation case, and the mislabeled-direction `alt=` case) against the source
  wikitext by hand — all matched. Not visually confirmed in a running window (standing
  Electron-sandbox limitation, see below) — recommend `npm run dev` locally to eyeball the new
  relic tooltip text in `ConsumablesEditor`.

## Session 19 — Multi-step skill collapsing via the `flip_skill` field

Picked up the "multi-step skills" TODO item left open after Session 18 (which explicitly
considered `flip_skill` and dropped it, concluding the `GroundTargeted` signal alone covered
every case it found — that conclusion turned out to be incomplete once checked against the
Heal/Utility/Elite pool specifically rather than the ground-target duplicates alone).

- **Live-verified `/v2/skills`' `flip_skill`/`next_chain`/`transform_skills`/`bundle_skills`/
  `subskills` fields against real examples** (Engineer kits, Guardian Spirit Weapons, a Thief
  Elite chain skill) before writing any code, same "confirm against the primary source" approach
  as `fetch-wvw-splits.ts`. Key finding: `flip_skill` is the id a skill becomes after being
  activated — e.g. "Med Kit" (id `5802`) flips to "Stow Med Kit" (`6109`) once equipped, "Healing
  Turret" flips to "Detonate Healing Turret", a Thief Elite chains "Impact Strike" → "Uppercut" →
  "Finishing Blow" three ids deep via `flip_skill` alone (confirmed live: its `next_chain` field
  carries the exact same id at each step, so `flip_skill` is sufficient — `next_chain` wasn't
  worth capturing separately). None of these targets are independently equippable in-game (you
  can't bind "Stow Med Kit" as your heal skill), yet `skillsForProfessionAndSlot`'s filter
  (`s.slot === slot && s.professions.includes(profession)`) had no way to know that and offered
  them as if they were — a real, previously-undiscovered bug distinct from the same-name-duplicate
  problem Session 18 solved. A live scan across all 4702 skills found 84 such different-named
  Heal/Utility/Elite flip pairs (kits, turrets, mantras, Ranger spirits, Revenant facets, plus the
  3-step Thief chain) and 35 same-named ones.
- **New `Skill.flipSkill: number | null`** (`src/shared/types/game-data.ts`, `scripts/
  fetch-game-data.ts`'s `normalizeSkill`) — straight from the already-fetched `/v2/skills`
  response, no new endpoint.
- **`src/shared/skill-calc/skill-variants.ts` gained two additions**: `stripFlipTargets`, a new
  pre-pass in `visibleSkillsForSlot` that runs before the existing per-name grouping and removes
  any candidate that's another *different-named* candidate's `flip_skill` target globally (kits/
  turrets/mantras/chains never landed in the same name-group to begin with, so the existing
  per-name signals could never have caught them) — and a 4th per-group signal in `resolveGroup`
  ("flip-root": among same-named candidates, drop whichever is pointed to by another's
  `flip_skill`), inserted between the existing specialization and ground-target signals. The
  flip-root signal specifically fixes same-name flip pairs Session 18 left ambiguous because
  neither `specializationId` nor (alone) `GroundTargeted` distinguished them, e.g. Guardian Spirit
  Weapons — verified live that "Hammer of Wisdom" is actually a **4-id** group (a ground-targeted
  flip pair `9125`→`46170` plus a separate auto-target flip pair `55040`→`55053`, all 4 sharing one
  name and no `specializationId`): flip-root first collapses each pair down to its root (`9125`,
  `55040`), then the pre-existing `GroundTargeted` signal picks `55040` as the one canonical id —
  the two signals compounding to resolve a group neither could resolve alone.
- **Re-verified specialization-gated flip pairs aren't broken by the new pre-pass**: same-name
  pairs like "Renewed Focus" (`9154` base / `68666` Dragonhunter-reworked) still resolve correctly
  via the existing `specializationId` signal, since `stripFlipTargets` only removes
  *different*-named targets — same-named flip targets stay in their name-group specifically so the
  specialization/flip-root signals can still choose between them. Also handles a subtler case
  correctly: some flip pairs (e.g. Vindicator's "Icerazor's Ire" family) have the *same*
  `specializationId` on both ends, so the specialization filter alone can't narrow them down to 1
  even when that spec is equipped — flip-root does, since it doesn't depend on spec context at all.
- **Net effect, verified by an exhaustive before/after scan across every profession's
  Heal/Utility/Elite pool**: the ~47 same-name groups Session 18 left ambiguous (with no spec
  equipped) drops to **23** — the other 24 resolve cleanly via the new flip-root signal, on top of
  hiding 84 previously-wrongly-offered different-named flip targets from the pickers entirely
  (these weren't part of the "duplicate name" count at all, since each had its own unique name and
  so silently looked like a legitimate independent choice rather than an obvious duplicate — arguably
  the more harmful bug of the two, since a user could have genuinely picked "Stow Med Kit" as their
  heal skill by mistake with no visual hint anything was wrong). The remaining 23 groups (Engineer
  "Deploy Mine", Ranger "Spike Trap", several Glyph/Mist-Form/Jade-Winds groups, etc.) still need a
  per-skill wiki cross-check per Session 18's note — unchanged by this session, full list in
  TODO.md.
- **Verified**: a standalone script (not committed) re-implemented the updated
  `visibleSkillsForSlot`/`resolveGroup` logic against the live-refetched `data/game-data/
  skills.json` and checked 10 hand-picked cases spanning both new mechanisms plus 2 regression
  checks (Renewed Focus with and without Dragonhunter equipped) — all 10 passed, including the
  compounding Hammer-of-Wisdom case above. A second script did the exhaustive before/after
  ambiguous-group-count scan (47 → 23) referenced above. `npm run typecheck`/`lint`/`build` all
  clean; not visually confirmed in a running window (standing Electron-sandbox limitation, see
  below) — recommend `npm run dev` locally to eyeball the now-shorter Engineer/Guardian/Mesmer/
  Necromancer/Ranger/Revenant/Thief picker lists.

## Session 18 — Duplicate-name skill collapsing (attunement/specialization/ground-target signals)

Continuation of "Build editor UI/UX overhaul" — picked up Session 17's explicitly-scoped next
step: the skill-variant-collapsing investigation it recommended as "its own dedicated session."

- **Re-fetched `/v2/skills` live to check what fields Session 17 guessed might exist**: confirmed
  `attunement` and `specialization` are both real, populated fields the app wasn't capturing
  (`next_chain`/`flip_skill`/`transform_skills`, also guessed at, weren't checked this session —
  left for the still-open multi-step-skill item). Verified against exact examples: "Glyph of
  Lesser Elementals" id `5502` has `attunement: null` (the real, equippable id) while `25486`/
  `25487`/`25495`/`25497` carry `attunement: "Fire"/"Water"/"Air"/"Earth"` (not independently
  equippable — the API/wiki uses them to describe each attunement's effect, a player only ever
  takes the base id and its effect varies live with current attunement); "Renewed Focus" id
  `9154` has no `specialization` while `68666` carries `specialization: 27` (Dragonhunter) — the
  Dragonhunter-reworked variant, auto-substituted whenever that spec is equipped, not a user pick.
- **Session 17's "trait-dependent variant" framing turned out to not need the user-confirmed
  cycling UX (small prev/next arrows / numbered tabs) at all**: every one of the 117 duplicate-name
  groups that turned out to be cleanly resolvable resolves via automatic selection (current
  attunement, currently-equipped spec, or "the two ids are functionally identical anyway") — not a
  manual choice, so there's nothing to cycle through. A 3rd signal, the already-captured
  `GroundTargeted` flag, resolved the largest chunk (~54 of 117 groups): GW2 exposes its
  client-side ground-target-vs-auto-target casting toggle (a Settings option, not a build choice)
  as two separate skill ids with an otherwise-identical effect (e.g. "Lightning Flash" `5536`
  ground-targeted / `50447` auto-target; every Necromancer Well; every Warrior Banner) —
  functionally identical for this app's purposes (boon/condition facts, tooltip text), so these
  collapse to the non-ground-targeted id.
- **New `src/shared/skill-calc/skill-variants.ts`** (`visibleSkillsForSlot`): groups same-name
  candidates and applies the 3 signals in order (attunement → specialization → ground-target),
  returning whichever id(s) remain after each stage — a group that's still ambiguous after all 3
  stays as multiple entries rather than guessing. Wired into `skillsForProfessionAndSlot`
  (`src/renderer/state/game-data-store.tsx`) — every consumer (skill-bar tooltips, the picker grid,
  in both `StandardSkillsEditor` and the Revenant editor's underlying data) gets the collapsed list
  for free, since dedup happens before the picker ever sees the candidate list. No UI changes
  needed — confirmed by reading `SkillsEditor.tsx` first, since Revenant legend kits resolve their
  skill ids directly from `Legend` records (already the real/canonical ids from `/v2/legends`,
  never routed through `skillsForProfessionAndSlot`), so they were never affected by this bug.
- **`Skill` type gained `attunement: string | null` and `specializationId: number | null`**
  (`src/shared/types/game-data.ts`), populated by `scripts/fetch-game-data.ts`'s `normalizeSkill`
  directly from the same `/v2/skills` response the app already fetches — no new script/endpoint
  needed, unlike `eliteSpecSkills`/`wvwFactOverrides` (both wiki-sourced, since the API has no
  equivalent field for those).
  Considered adding `flipSkill` too (`/v2/skills`' `flip_skill` field, which links some
  ground-target/auto-target pairs to each other) but dropped it — the `GroundTargeted` flag alone
  resolves every ground-target case found, and `flip_skill` isn't populated symmetrically on all of
  them (confirmed live: some auto-target ids have no `flip_skill` pointing back at their
  ground-targeted counterpart), so it would've been unused dead data on the type.
- **~47 groups remain genuinely ambiguous** (re-counted per-profession scan after collapsing, vs.
  Session 17's 117 which was counted once per name across all professions combined — different
  counting basis, not a discrepancy). No `attunement`/`specialization`/`GroundTargeted` signal
  distinguishes their members — e.g. Engineer "Deploy Mine" (`6163` "deploy a mine" vs `30893`
  "deploy two mines", almost certainly a trait rework with no `specialization` id set: both ids
  share the same profession/slot/flags and differ only in effect text), Ranger "Spike Trap"
  (differs in stun-vs-launch), several Guardian "Utility" duplicate groups shaped like
  Elementalist's per-attunement pattern but for a different, unconfirmed mechanic (e.g. "Hammer of
  Wisdom" ×4, all sharing one `specializationId` so the spec signal can't narrow further). Left
  un-collapsed and shown as-is, fail-safe rather than guessed — would need a per-skill wiki
  cross-check to resolve correctly, same shape of effort as `scripts/fetch-wvw-splits.ts`, not
  attempted this session. Full list documented in TODO.md.
- **Verified**: a standalone `tsx` script (not committed) checked 7 hand-picked cases spanning all
  3 signals — Glyph of Lesser Elementals collapsing to its 1 real id, Renewed Focus resolving to
  `9154` with no specs equipped and to `68666` with Dragonhunter equipped, Lightning Flash
  collapsing to the auto-target id, Call to Anguish (a 4-id group needing BOTH the specialization
  AND ground-target signals to fully resolve) collapsing correctly with and without Conduit
  equipped, and Deploy Mine correctly left as 2 un-collapsed ids — all 7 passed. Also ran a
  full-catalog scan confirming the picker list shrinks wherever a group collapses (e.g.
  Elementalist Utility: 76 raw skill ids → 61 visible with no specs equipped) and printed the 47
  remaining ambiguous group names for TODO.md. `npm run typecheck`/`lint`/`build` all clean; not
  visually confirmed in a running window (standing Electron-sandbox limitation, see below) —
  recommend `npm run dev` locally to eyeball the now-shorter picker lists (e.g. Elementalist
  Utility should show noticeably fewer duplicate-looking entries than before).

## Session 17 — Item-rarity color coding + skill-variant-collapsing scoping investigation

Picked up the "Build editor UI/UX overhaul" item's remaining open sub-items. Landed the
item-rarity color coding sub-item; investigated (but deliberately did not implement) the
skill-variant-collapsing sub-item once it turned out to need its own dedicated wiki-research
session, same shape as `fetch-wvw-splits.ts`/`fetch-elite-spec-skills.ts` before it.

- **Skill-variant-collapsing scoping**: confirmed via a live scan of `data/game-data/skills.json`
  that 117 duplicate-skill-name groups exist across Heal/Utility/Elite slots (e.g. Elementalist
  "Glyph of Lesser Elementals" ×5, "Lightning Flash" ×2 matching the trait-variant shape the TODO
  item describes). Neither the currently-fetched `Skill` fields nor `scripts/fetch-game-data.ts`'s
  `RawSkill` normalization carry any canonical/variant grouping signal — collapsing these
  correctly needs re-fetching `/v2/skills` for fields this app doesn't currently pull
  (`attunement`, possibly chain/transform fields) and a verification pass per TODO.md's notes, not
  a same-session implementation. Documented in TODO.md rather than guessed at or silently
  deferred, so the next session doesn't have to rediscover this from scratch.
- **Item-rarity color coding**: this app has no real per-item icons for armor/weapon/trinket
  slots (those slots store a stat *combo*, not a concrete item), so the border lands on the
  visible slot chrome instead — `.gear-slot-icon` and the stat-combo `<select>` turn
  `--rarity-ascended` (pink/magenta) once a stat combo is chosen, across all 4 places a stat combo
  gets picked (`renderSlot`, both hands of `renderWeaponPair`, `renderUnderwaterSlot` in
  `EquipmentEditor.tsx`). `UpgradePicker` (already shared by runes/sigils/infusions/relics/food/
  utility) gained a `rarity?: 'ascended' | 'fine'` prop, wired to `'fine'` (blue) for the relic
  slot (`ConsumablesEditor`) and every infusion badge — the two categories with a single
  confirmed native GW2 rarity per the TODO scoping notes; runes/sigils/food/utility intentionally
  left unstyled (no single confirmed rarity). New `--rarity-ascended`/`--rarity-fine` CSS custom
  properties in `global.css`, using GW2's own well-known rarity colors. `npm run
  typecheck`/`lint`/`build` all clean; not visually confirmed in a running window (standing
  Electron-sandbox limitation, see below) — recommend `npm run dev` locally to eyeball the new
  borders.

## Session 16 — Character-stats panel: stats-calc math + UI

Continuation of "Build editor UI/UX overhaul" → the character-stats-panel item, picking up
exactly where Session 15 left off ("deliberately NOT done this session: merging rune/food/utility
attribute-bonus text into `AttributeTotals`... and the crit%/armor/health derived-stat formulas —
those need their own wiki-verification pass"). This session did that verification pass and built
the actual panel UI, closing out the item's core scope (relic numeric effects, item-rarity color
coding, and the bottom Conditions/Boons/Control/Auras/Misc/Combo icon bar remain separately open,
see TODO.md).

- **Wiki research first, same discipline as gear-scaling/WvW-splits**: fetched raw wikitext for
  Precision, Ferocity, Toughness, Health, Armor (attribute), Armor class, Profession, and Magic
  Find. Every formula below is a direct quote, not reconstructed from memory:
  - Critical Chance % = `5 + (Precision - 1000) / 21` (wiki.guildwars2.com/wiki/Precision).
  - Critical Damage % = `150 + Ferocity / 15` (wiki.guildwars2.com/wiki/Ferocity +
    wiki.guildwars2.com/wiki/Critical_hit for the 150% base).
  - Armor = Toughness + Defense, where Defense is a fixed per-armor-piece rating by weight class
    (Light/Medium/Heavy) and rarity, quoted verbatim from the wiki's "Armor class" defense-rating
    table (Ascended totals: Light 967, Medium 1118, Heavy 1271, matching this app's existing
    Ascended-only assumption — see `RARITY` in `attribute-totals.ts`).
  - Health = base health (by profession tier: Warrior/Necromancer 9,212; Revenant/Engineer/
    Ranger/Mesmer 5,922; Guardian/Thief/Elementalist 1,645) + Vitality × 10.
  - Profession → armor weight class confirmed via wiki.guildwars2.com/wiki/Profession ("scholars
    wear light armor, adventurers wear medium armor, soldiers wear heavy armor": Scholars =
    Elementalist/Mesmer/Necromancer, Adventurers = Engineer/Ranger/Thief, Soldiers = Guardian/
    Revenant/Warrior).
  - Magic Find has no equippable core-attribute form in GW2 at all — every point comes from rune/
    food/utility bonus text already expressed as a direct percentage, so it needed no
    points-to-percent conversion, unlike Boon/Condition Duration.
  - **Two old reference-screenshot numbers (from a prior session, screenshots not saved to the
    repo) turned out to disagree with each other and with the verified formula**: two
    independently-sourced before/after pairs in TODO.md both showed Precision 1960 but different
    crit chance (83.71% vs. 50.71%). The wiki formula matches the second pair exactly
    (`5 + 960/21 = 50.71%`) and the first is unexplained — treated as an unreliable transcription
    rather than a target to reverse-engineer, and documented as such in TODO.md rather than
    silently ignored.
- **`src/shared/gear-calc/attribute-totals.ts` restructured**: `AttributeTotals` is now
  `{ points, bonusPercent }` instead of a flat `Record<string, number>` — `points` holds the 9 core
  GW2 attributes (by `ItemStat`/API key, e.g. `BoonDuration` = raw Concentration points), while
  `bonusPercent` holds rune/food/utility bonus text already expressed as a direct percentage (e.g.
  "+5% Boon Duration") so it adds on top of the points-derived percentage instead of being
  reconverted through the 15-points-per-1% rule a second time. `computeGearAttributeTotals` now
  takes the relevant `GameData` slice directly (`itemStats`/`infusions`/`runes`/`food`/`utility`)
  instead of separate positional array params — simpler at all 3 call sites
  (`sources.ts`/`BoonUptimePanel.tsx`/`SkillsEditor.tsx`), which already had the whole `gameData`
  object in scope. New `magicFindPercent` alongside the existing `boonDurationPercent`/
  `conditionDurationPercent`.
- **Free-text attribute-bonus merging** (`addBonus` in `attribute-totals.ts`): a small
  case-insensitive alias table maps rune/food/utility bonus text (confirmed via a full scan of
  `data/game-data/{runes,food,utility}.json` this session) to the matching `ItemStat` key —
  "Ferocity"→`CritDamage`, "Concentration"→`BoonDuration`, "Expertise"→`ConditionDuration`,
  "Healing"/"Healing Power"→`Healing`, plus the 5 attributes that already share their name. "+N to
  All Stats"/"to All Attributes" (e.g. Superior Rune of Divinity/Traveler) distributes across all 9
  core attributes. Percent-typed bonuses use an exact-match (not substring) table for exactly
  "Boon Duration"/"Condition Duration"/"Magic Find", so conditional variants like "Magic Find while
  under the Effect of a Boon" or "Magic Find during Lunar New Year" are correctly excluded.
  Everything else scanned (Karma, Gold from Monsters, ~15 per-faction damage bonuses, "on Kill"/
  "while Health below 50%" conditional procs, Fishing Power, per-condition durations like "Burning
  Duration") is intentionally left unmapped — outside the stats panel's confirmed scope (aggregate
  Boon/Condition Duration only), stays display-only same as before this session.
- **Rune stage-gating** (`addRuneBonuses`): counts same-rune-id occurrences across the 6 armor
  slots (`RUNE_SLOT_KEYS`) and applies `bonuses[0..count-1]` — i.e. equipping a rune on 3 pieces
  activates stages 1-3 once each, not stage 3 three times, the standard GW2 mechanic. Food/utility
  (build-level, at most 1 each) apply all their bonuses unconditionally, no stage gating.
- **New `src/shared/gear-calc/derived-stats.ts`**: `computeCharacterStats(build, gameData)` returns
  base-character-value + gear/rune/food/utility totals for the 9 raw attributes, plus the 7 derived
  values (Armor, Health, Critical Chance/Damage %, Boon/Condition Duration %, Magic Find %) per the
  formulas above. Armor's Defense component is gated per-armor-slot on `itemStatId !== null` (the
  slot has *some* stat combo chosen) rather than depending on which combo — Defense is a property
  of the physical armor piece's weight class, not the chosen stat allocation, so this differs from
  how `Toughness` itself is gated (same condition, different reason) but keeps the "nothing
  contributes until the user has put something in that slot" pattern consistent with the rest of
  the gear calc.
- **New `StatsPanel.tsx`**: the two-column layout confirmed via screenshots in a prior session
  (left = raw attributes, right = derived %/values), wired into `BuildEditorView`'s 3rd column
  above `BoonUptimePanel`. `BoonUptimePanel`'s caveat text updated to mention runes/food/utility are
  now factored into its gear-derived duration %, not just Concentration/Expertise on stat combos.
- **Verified**: `npm run typecheck`, `npm run lint`, `npm run build` all clean. Numerically verified
  via a standalone `tsx` script (not committed) against 3 hand-calculated scenarios: (1) a fully
  empty build — every value matched the expected base-character constants exactly; (2) a Guardian
  in full Diviner's armor+weapon, Superior Rune of the Scholar on all 6 armor pieces (all 6 stages
  active), a food item, and a Concentration infusion — every attribute and derived stat matched
  hand math (the one initial "mismatch" was my own arithmetic slip, not a code bug — rechecked and
  the code was right); (3) Superior Rune of the Traveler on 4/6 armor pieces (partial stage-gating,
  exercising "to All Stats" flat bonuses interleaved with percent Boon Duration bonuses) plus a
  Magic Find utility — again matched exactly, confirming stage-gating, the all-stats distribution,
  and the percent-bonus path all work correctly together. Not visually confirmed in a running
  window — standing Electron-sandbox limitation (see below); recommend `npm run dev` locally to
  eyeball the new Stats panel.

## Session 15 — Gear-upgrade/consumable picker UI (runes, sigils, infusions, relics, food, utility)

Continuation of "Build editor UI/UX overhaul" → the character-stats-panel item, picking up right
where Session 14 left off ("data layer only... deliberately not the picker UI or stats-calc
math"). This session landed the picker UI for all 6 categories plus one piece of stats-calc math
that turned out to be free (infusions); the rest of the stats-calc math (rune stage counting,
free-text-attribute-name mapping, food/utility merging, and the full crit%/armor/health derived-
stat panel) remains open, tracked in TODO.md, same "data layer → picker UI → stats calc" 3-pass
split the weapon-selection item used across Sessions 11/13.

- **Data model** (`src/shared/types/build.ts`): `EquipmentSlot` gained `runeId` (armor slots
  only), `sigilIds`/`infusionIds` (arrays sized to each slot's real capacity). `Build` gained
  build-level `relicId`/`foodId`/`utilityId` (exactly 1 relic, at most 1 food, at most 1 utility
  per build — not per-slot, unlike runes/sigils/infusions).
- **New `src/shared/gear-calc/upgrade-slots.ts`**: encodes the exact per-slot capacity numbers the
  user confirmed directly in a prior session (rings 3, backpiece 2, other armor/accessories 1,
  amulet 0; a two-handed weapon has 2 sigil AND 2 infusion slots on that one item, a one-handed
  weapon has 1 of each) as small lookup/helper functions (`armorTrinketInfusionCapacity`,
  `weaponUpgradeCapacity`), plus `resizeUpgradeIds` to safely grow/shrink a stored id array to a
  slot's current capacity (e.g. when a weapon slot flips between one- and two-handed).
- **New shared `UpgradePicker` component** (`src/renderer/components/build-editor/
  UpgradePicker.tsx`): one generic icon+name+search grid reused for all 6 categories (rune, sigil,
  infusion, relic, food, utility), parameterized over a plain `{id, name, icon, description}`
  shape rather than duplicating the skill/legend picker pattern 6 times. Grows a search box
  automatically past 12 options (food has 859, utility 246 — the full unfiltered catalogs per
  explicit user direction, not a "WvW meta" subset). Two visual variants: a small circular
  `badge` (per-item upgrade slots on the paperdoll) and the larger square `slot` style already
  used by the skill bar (build-level relic/food/utility picks).
- **`EquipmentEditor.tsx` rewired**: every armor slot gets a rune badge (6 armor pieces only,
  `RUNE_SLOT_KEYS`) plus N infusion badges per the capacity table; every weapon slot (main/off/
  underwater) gets sigil + infusion badge rows sized to that slot's live handedness. Fixed a
  latent bug this surfaced: `setItemStat`/`setMainItemStat`/`setOffItemStat`/underwater's
  `setStat` previously constructed a *fresh* `EquipmentSlot` object on every stat-combo change,
  which would have silently wiped a slot's rune/sigil/infusion picks the next time its stat combo
  was changed — fixed to spread the existing slot first. Weapon-type changes still intentionally
  reset sigil/infusion picks (capacity may have changed, e.g. 1H→2H), which was already the
  existing (correct) behavior for `itemStatId`/`weaponType` on that path.
- **New `ConsumablesEditor.tsx`**: build-level Relic/Food/Utility row using the same
  `UpgradePicker` (`slot` variant), wired into `BuildEditorView` under a new "Consumables" heading
  below Equipment.
- **`attribute-totals.ts`**: infusions now feed `AttributeTotals` — confirmed live that all 8
  core-attribute WvW infusions' `attribute` field matches an `ItemStat` attribute name verbatim
  (`Power`/`Toughness`/`Vitality`/`Precision`/`Healing`/`ConditionDamage`/`BoonDuration`/
  `ConditionDuration`), so no name-mapping table was needed, unlike runes (see below). This means
  an equipped Concentration or Expertise WvW infusion now correctly raises the boon/condition
  duration % shown in `BoonUptimePanel` — a real, if small, accuracy improvement to the app's core
  existing feature, not just new UI. `computeGearAttributeTotals` gained an optional `infusions`
  parameter (default `[]`, so the 2 call sites that don't have it handy yet don't break) but all 3
  real call sites (`sources.ts`, `BoonUptimePanel.tsx`, `SkillsEditor.tsx`) were updated to pass
  `gameData.infusions` through.
- **Explicitly NOT done this session** (documented inline in TODO.md, not silently dropped):
  merging rune/food/utility `AttributeBonusText` bonuses into `AttributeTotals`. Two real blockers
  found while scoping it, left for whoever picks up the stats-calc pass: (1) rune/food bonus text
  uses free-text attribute names that don't match `ItemStat`'s internal keys 1:1 (e.g. a rune
  bonus literally reads `"Ferocity"` but the itemstat/infusion convention calls that attribute
  `CritDamage`; similarly `"Boon Duration"` vs. `BoonDuration`, `"Healing Power"` vs. `Healing`) —
  confirmed live via a full scan of `data/game-data/runes.json`'s bonus attribute strings, which
  also turned up several duration-type bonuses (Bleeding/Burning/Chill/... Duration) with no
  `ItemStat` equivalent at all, and one `"to All Stats"` outlier; (2) runes are stage-gated by
  same-rune-id count across the 6 armor slots (not just "sum every equipped rune's bonuses"),
  which the current per-slot iteration in `computeGearAttributeTotals` doesn't attempt. Also not
  done: the full crit%/armor/health/Magic Find derived-stat sidebar (`Add a full character-stats
  panel` — design was confirmed via screenshots in a prior session, math/formulas not yet even
  started) and relic numeric effects (would need a ~211-page wiki cross-check, `Relic.description`
  stays display-only text).
- **Verified**: `npm run typecheck`, `npm run lint`, `npm run build` all clean. Not visually
  confirmed in a running window — standing Electron-sandbox limitation (see below); recommend
  `npm run dev` locally to eyeball the new rune/sigil/infusion badges on the paperdoll and the new
  Consumables row.

## Session 14 — Gear-upgrade/consumable data layer (runes, sigils, infusions, relics, food, utility)

Continuation of "Build editor UI/UX overhaul" → the character-stats-panel item, picking up its
largest remaining gap: runes/sigils/infusions/relics/food/utility didn't exist as concepts
anywhere in the codebase. Scoped this session to the data layer only (fetch + types + store
wiring), same "data layer first, picker UI later" split as the weapon-selection item's Session
11/13 pattern — the picker UI and stats-calc math are still open, tracked in TODO.md.

- **New `scripts/fetch-gear-upgrades.ts`** (`npm run fetch-gear-upgrades`). Unlike every other
  `fetch-game-data.ts` endpoint, there's no dedicated `/v2/runes` or `/v2/relics` collection —
  Superior runes, Superior sigils, WvW infusions, relics, and food/utility consumables are all
  just `/v2/items` entries (73,989 total, confirmed via a live count) distinguished by `type`/
  `details.type`, with no server-side subtype filter. The only reliable path is a full-catalog
  bulk fetch (370 batches of 200) filtered client-side — same order of magnitude as
  `fetch-wvw-splits.ts`'s ~2,200 wiki-page fetches, just against the official API instead.
  Because every filter-logic tweak would otherwise cost a multi-minute refetch, the script caches
  the raw dump to `.cache/items-raw.json` (gitignored, separate from the committed
  `data/game-data/*.json` normalized output) and reuses it unless `--refresh` is passed — this
  cache is what made iterating on the bugs below cheap instead of costing another 10-minute fetch
  each time.
- **Two real API-shape assumptions from the 2026-07-25 scoping session turned out wrong once
  fetched live** (both documented in docs/game-data.md's new "Gear upgrades and consumables"
  section, not silently corrected):
  - **Infusions**: assumed `details.type === 'Infusion'` would identify them. Live data showed
    that field is `'Default'` for *every* infusion, WvW and Agony alike (verified against both a
    known WvW infusion id and a known Agony infusion id fetched directly). The real infusion-slot
    marker is `details.infusion_upgrade_flags` containing `'Infusion'`; there's no API field at
    all distinguishing WvW from Agony infusions, so the `"... WvW Infusion"` name suffix ended up
    being the only usable filter. Fixed and re-verified: exactly the 8 expected core-attribute WvW
    infusions (Healing/Resilient/Vital/Malign/Mighty/Precise/Concentration/Expertise) came back,
    each a flat +5 to one attribute.
  - **Relics**: TODO.md assumed relics use the same `Fact` system as skills/traits (based on a
    screenshot showing "Weapon Swap Recharge Reduction: 25%" as a distinct tooltip line) and
    flagged `extractFromFacts` as possibly needing to widen to handle a new fact shape. Live data
    showed relics carry **no `details` object at all** via the public API — `Relic of the
    Warrior`'s raw response is just `{ description: "Weapon swap recharge time is reduced." }`,
    with no "25%" anywhere. `extractFromFacts` doesn't need touching (it was never going to see
    relic data in `Fact` shape); the real gap is that exact relic numbers aren't derivable from
    this endpoint at all — would need a per-relic wiki cross-check (~211 pages) to get real values,
    not attempted this session. `Relic.description` is stored as-is for display, not parsed.
  - Both bugs were caught (not shipped silently wrong) via the fetch script's own diagnostic
    logging: a raw `type`/`details.type` frequency dump plus a check for any "Relic of ..."-named
    item that *didn't* match the relic filter (12 hits — all turned out to be unrelated legendary
    *backpack* items from an older release sharing the naming pattern, `type: 'Back'`, correctly
    excluded, not a bug).
- **New types** in `src/shared/types/game-data.ts`: `Rune`, `Sigil`, `Infusion`, `Relic`,
  `Consumable` (`kind: 'Food' | 'Utility'`), plus a shared `AttributeBonusText` (`{raw, attribute,
  value, isPercent}`) used for both rune per-stage bonuses and food/utility effect text — both
  turned out to be the same shape (freeform text lines, not a `Fact[]` array), parsed by one
  `parseAttributeBonusText` function. Verified against the exact numbers TODO.md had predicted
  from screenshots: Superior Rune of the Scholar's 6 stages came back as literally `+25 Power /
  +35 Ferocity / +50 Power / +65 Ferocity / +100 Power / +125 Ferocity` (confirming the "not a
  fixed alternating formula" finding from the prior session), and Plate of Truffle Steak's
  `details.description` (`"+100 Power\n+70 Precision\n+10% Experience from Kills"`) parsed
  correctly line-by-line, including the non-attribute "Experience from Kills" line staying
  correctly unparsed-into-an-attribute (it still gets a `value`/`isPercent` since it matches the
  `+N%` shape, but `attribute` is just the literal text — deliberately not filtered against a
  known-attribute allowlist, since consumers can do that check themselves).
- **Discovered mid-session**: food/utility consumables' buff data lives at a single flattened
  `details.{name, duration_ms, apply_count, description}` descriptor, not a `Fact[]` — richer
  than originally planned (`effectName`/`durationMs`/`applyCount` all captured, not just a
  description string). ~37% of fetched Food entries (e.g. "Feast" reagents meant to be served to
  a group rather than eaten directly) have no buff at all — `bonuses` empty and the three new
  fields `null` for those, by design.
- **Wiring**: `GameData`/`load-game-data.ts` (main process)/`game-data-store.tsx` (renderer) all
  extended with the 6 new arrays plus lookup maps (`runesById`, `sigilsById`, `infusionsById`,
  `relicsById`, `foodById`, `utilityById`), mirroring the existing `skillsById`/`legendsById`
  pattern — no `Build`/picker/stats-calc consumer exists yet, so these are unused outside the
  store for now (next session's job).
- **Final counts**: 198 runes, 162 sigils, 8 infusions, 211 relics, 859 food, 246 utility.
- **Verified**: `npm run typecheck` and `npm run lint` both clean. Every category's normalized
  output spot-checked against a real, independently-known example (Scholar rune, Force sigil,
  Mighty WvW Infusion, Relic of the Warrior, Plate of Truffle Steak) — not just checked for
  non-empty arrays. No UI changed this session, so no visual check was needed/attempted.

## Session 13 — Weapon selection (type picker, hand filtering, 2H merge, underwater, ENVIRONMENT toggle)

Closed out every remaining sub-item of the "Weapon selection" TODO entry (data layer had already
landed in a prior session — `Profession.weapons`, sourced from `/v2/professions`).

- **Data model** (`src/shared/types/build.ts`): `EquipmentSlot` gained `weaponType?: string | null`
  (a key into `Profession.weapons`); `EquipmentSlotKey` gained `weaponU1`/`weaponU2` (underwater
  swap sets — confirmed via a live check that every aquatic weapon across all 9 professions carries
  `TwoHand`, so underwater is always a single logical slot per set, never a main/off pair); `Build`
  gained `environment: 'land' | 'underwater'` plus `activeWeaponSet`/`activeUnderwaterSet`
  (display-only, mirroring `RevenantSkillSelection.activeLegendIndex`'s "both sets always
  contribute to the boon calc" reasoning).
- **Land/underwater skill disambiguation resolved properly, not guessed**: added `flags: string[]`
  to `Skill` and re-ran `npm run fetch-game-data`. Verified against Guardian `Spear`'s 10 skill
  entries (5 slots × 2) that the GW2 API tags each slot's land variant with `"NoUnderwater"` — the
  earlier session's "presumably order-distinguished" guess was correct in practice but not a real
  contract; this is the actual field. New `src/shared/weapon-calc/weapon-skills.ts`
  (`resolveWeaponSkillIds`/`weaponSkillIdsForPair`) implements the rule, with a documented fallback
  (first entry) for duplicate-slot cases unrelated to land/water that this app doesn't model —
  Revenant `Sword`'s 6 entries (likely a hand-context split) and Elementalist's per-attunement
  weapons (up to 26 entries) — flagged as a known limitation in TODO.md, not silently guessed.
- **`EquipmentEditor.tsx` rewritten**: a horizontal weapon-type icon-button row (same visual
  pattern as `EliteSpecSelect`, icon borrowed from the weapon type's first skill since
  `ProfessionWeapon` has none of its own) per hand slot, filtered by `flags`
  (`Mainhand`/`TwoHand` for main-hand, `Offhand` for off-hand, `Aquatic` for underwater) and gated
  by equipped specializations. A two-handed main-hand pick mirrors `weaponType`+`itemStatId` onto
  the off-hand slot and locks it (renders "(2-handed)" instead of its own picker); switching back
  to one-handed clears the mirrored data rather than leaving it stale. Added a 3rd always-visible
  "Underwater" section alongside "Weapon I"/"Weapon II". `BuildEditorView.tsx` now passes
  `profession`/`equippedSpecializationIds` in, clears all weapon slots on profession change, and
  extends the existing spec-change invalidation pass to also clear now-ungated weapon types.
- **`attribute-totals.ts`**: weapon slots now use the real one-/two-handed constant instead of
  always one-handed, via a small identity worth documenting — `weaponOneHanded.ascended * 2 ===
  weaponTwoHanded.ascended` exactly (same for exotic), so crediting the one-handed constant to each
  of the two mirrored slots of a two-handed weapon already sums to the correct total for free, no
  special-casing needed. Underwater slots (single, always-two-handed) use the two-handed constant
  directly. Also fixed a latent bug this newly exposed: the old code credited the one-handed
  constant for every *present* weapon slot key regardless of whether a weapon was actually equipped
  there (there was previously no way to represent "empty") — now skipped when `weaponType` is null.
- **New `WeaponSkillBar.tsx`**, rendered by `SkillsEditor.tsx` for every profession (weapon skills
  are orthogonal to Heal/Utility/Elite or Legend kits): a Land/Underwater `ENVIRONMENT` toggle plus
  a second, display-only toggle for the active weapon-swap set, both reusing the existing
  `.legend-bar-toggle` CSS from the Revenant editor. The read-only 5-icon bar below is built from
  `weaponSkillIdsForPair` against the active set's equipped weapon type(s) and environment.
- **`sources.ts`**: `skillIdsForBuild` now also resolves weapon-derived skill ids — both land sets
  (A+B) or both underwater sets (U1+U2) depending on `build.environment`, always both regardless of
  which is currently displayed (same reasoning as the Revenant legend kits) — so the boon/condition
  calculator picks up weapon-skill boons/conditions for the first time.
- Verified: `npm run typecheck` and `npm run lint` both clean; a standalone `tsx` spot-check against
  the regenerated `skills.json` confirmed `resolveWeaponSkillIds` produces the correct 5 distinct
  skill names for both Guardian Spear's land and underwater variants, and for Trident. Not visually
  confirmed in a running window (standing Electron-sandbox limitation) — recommend `npm run dev`
  locally to eyeball the new weapon pickers and toggles.
- Still open, tracked in TODO.md: per-weapon-slot sigil/infusion pickers (absorbed into the
  stats-panel item), and the duplicate-skill-slot known limitation noted above.

## Session 12 — Revenant dual-legend skill bar

Continuation of "Build editor UI/UX overhaul" — picked up the next well-specified open item
(Revenant's legend-swap mechanic), which Session 9's survey had already flagged as needing new
modeling rather than a tweak (`SkillSelection` had no legend concept at all).

- **New `/v2/legends` fetch** in `scripts/fetch-game-data.ts`: the endpoint returns each legend's
  `swap`/`heal`/`elite`/`utilities` skill ids but no `name`, `icon`, or elite-spec-gating info.
  `name`/`icon` are borrowed from the legend's own `swap` skill (already fetched into
  `skills.json` in the same run — that skill *is* the legend visually in-game). The elite-spec
  gating (`specializationId`) isn't derivable from the API at all (`/v2/professions/Revenant` has
  no `legends` field, confirmed by direct inspection) — resolved instead via a small hand-verified
  constant table, cross-checking each legend's `swap` skill name (live API) against the wiki's
  "Legend" page: 4 core (Dwarf/Assassin/Centaur/Demon) + 4 elite-gated (Dragon→Herald,
  Renegade→Renegade, Alliance→Vindicator, Entity→Conduit — the last a legend/elite-spec pairing
  from an expansion released after this assistant's training cutoff, confirmed live rather than
  assumed). The fetch script logs a warning rather than guessing if a future legend id isn't in
  the table. Live run matched all 8/8 legends cleanly, no warnings.
- **`SkillSelection` is now a discriminated union** (`src/shared/types/build.ts`):
  `StandardSkillSelection` (the old shape, every non-Revenant profession) vs
  `RevenantSkillSelection` (`{ legends: [string|null, string|null], activeLegendIndex }`) — a
  legend's kit is fixed, not picked skill-by-skill, so there's nothing to independently choose
  beyond which 2 legends are equipped. `BuildEditorView`'s profession-change handler now
  constructs the right shape per profession; its specialization-change handler branches on
  `skills.kind` to gate either elite-spec-locked individual skills (unchanged) or elite-spec-
  locked legends (new — e.g. dropping the Herald line clears an equipped Legendary Dragon Stance).
- **`SkillsEditor.tsx` split into `StandardSkillsEditor`/`RevenantSkillsEditor`**, dispatched by
  `value.kind`. The Revenant editor renders 2 legend-picker slots (icon buttons opening an
  icon+name grid, filtered to legends available given equipped specializations, can't equip the
  same legend in both slots) plus a toggle row switching which equipped legend's *read-only*
  heal/3-utility/elite bar is currently displayed — matching the in-game single-visible-bar-at-a-
  time swap UX the TODO item asked for. Each fixed skill still shows its boon/condition tooltip
  via the existing `boonConditionFactsForSkill`, unchanged from the standard editor.
- **`sources.ts` boon/condition calc updated for Revenant**: new `skillIdsForBuild` helper resolves
  a build's full equipped-skill-id list — the old heal/utility/elite triplet for standard
  professions, or both equipped legends' complete kits (swap+heal+3 utilities+elite) for Revenant
  — used by `computeBoonConditionSources` so `BoonUptimePanel` totals correctly include a
  Revenant's legend skills without needing them individually equipped in a heal/utility/elite
  sense.
- **Verification**: `npm run typecheck` and `npm run lint` both pass clean. `npm run fetch-game-data`
  re-run live to produce `data/game-data/legends.json` (8 legends, all matched the verification
  table). No visual check attempted — see the standing Electron-sandbox launch limitation noted in
  prior sessions; recommend `npm run dev` locally to eyeball the new Revenant editor path.

## Session 11 — Weapon-selection reference screenshots digested; per-profession weapon data fetched

User re-took the weapon-selection/stats-panel reference screenshots lost from the 2026-07-25
session (11 images this time, still not saved to the repo) and answered a few follow-up questions.
This session's job was mostly digestion — writing every confirmed detail into TODO.md so it isn't
lost again — plus landing the one piece of new scope that was cleanly actionable without any
further UI design decisions: real per-profession weapon availability data.

- **New `Profession.weapons` field** (`src/shared/types/game-data.ts`): `Record<string,
  ProfessionWeapon>`, where `ProfessionWeapon` is `{ flags: WeaponFlag[], specializationId: number
  | null, skills: {id, slot}[] }`. Sourced directly from `/v2/professions`' own `weapons` object
  (confirmed live, not hand-rolled) — `scripts/fetch-game-data.ts` updated to capture it, and
  `data/game-data/professions.json` re-fetched. Sanity-checked against known GW2 facts: Guardian's
  `Axe` carries `specializationId: 62` (Firebrand) and `Longbow` carries `27` (Dragonhunter) — both
  correct. Also discovered, and left documented in TODO.md for whoever builds the weapon picker:
  `Spear` is dual-use (`flags: ['TwoHand', 'Aquatic']`, 10 skill entries = 5 land + 5 underwater),
  while `Trident` is underwater-only (same flags, only 5 entries) — the `Aquatic` flag is what
  actually distinguishes underwater-eligible weapons, there's no separate "underwater weapon type"
  list to maintain by hand. This is data-layer only; no UI consumes it yet.
- **Screenshots fully transcribed into TODO.md**, replacing several previously-vague or
  "unconfirmed" notes with hard specifics: the off-hand picker's real filtered-list example, the
  `WEAPON I` / `WEAPON II` / `UNDERWATER` sections being always-visible (not tabs), the separate
  `ENVIRONMENT` (land/water) toggle confirmed to actually switch the rendered weapon-skill bar,
  per-slot infusion counts per equipment-panel row, fully confirmed by the user after an initial
  mis-read flattened this to "2 per weapon, 1 per trinket" (a 2-handed weapon has 2 infusion slots
  on that one item, each 1-handed weapon has 1; rings have 3 each; the backpiece has 2; every other
  armor piece and the remaining two trinkets have 1 each; the amulet has 0), a real Superior Rune
  tooltip proving the per-stage attribute list isn't a fixed
  alternating formula (Scholar: Power/Ferocity/Power/Ferocity/Power/Ferocity at different values
  each stage), and a Relic tooltip (Relic of the Warrior) showing a passive-modifier fact shape
  (`Weapon Swap Recharge Reduction: 25%`) that today's Buff-focused `extractFromFacts` doesn't yet
  handle — flagged so the relic work doesn't assume every relic looks like the earlier
  Relic-of-Agony example.
- **Dropped/downgraded two items** based on follow-up answers: the 1-handed weapon yellow/orange
  tint is no longer a requirement (user doesn't have it confirmed and said the color doesn't
  matter as long as hand/profession restrictions are correct); the itemstat-combo-picker "two
  filter tabs" note from the original survey couldn't be reproduced by the user this time, so it's
  now marked unconfirmed/possibly mistaken rather than a real gap.
- **New, out-of-scope-for-now observation** worth remembering for a later polish pass: gw2skills.net
  shows each trait line as a condensed one-row summary (spec icon + compact trait-icon grid) with
  an expand arrow, rather than this app's always-expanded `TraitsEditor` grid.
- **Verification**: `npm run typecheck` and `npm run lint` pass clean after the `Profession` type
  change and fetch-script update. No UI changed this session, so no visual check was attempted.

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
