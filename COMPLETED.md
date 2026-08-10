# Completed

Entries are added as work lands, most recent first.

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
