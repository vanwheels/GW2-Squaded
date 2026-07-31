# Completed

Entries are added as work lands, most recent first.

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
