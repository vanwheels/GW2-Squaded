# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## 1.0 shipped 2026-08-15

v1.0.0 released (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) are all implemented and
released; Discord bot and Capacitor mobile port remain later roadmap stages, out of scope. What's
left in this file below is post-1.0 polish and open curation gaps — none of it blocks the release
that already shipped.

## Bugs found in testing (2026-08-16)

User-flagged during personal testing. 3 of 4 fixed same day (COMPLETED.md Session 220): the Flock
relic duplicate (a systemic `relics.json` dedup, ~10 pairs), and Luminary's F1-F4 gap (both the
Virtue tooltip facts AND the F4 Radiant Forge Shroud-style bundle wiring). The 4th finding
(Zephyrite) reshaped into a full relic-integration sweep across all 112 relics, 7 legs, now **FULLY
DONE** — see COMPLETED.md Sessions 221-227 (leg 1 through leg 7) and
`docs/relic-trigger-classification.md` for the full writeup.

## Scoped features, not yet built

Paragon's Motivation-tiered Chants (flagged by the user 2026-08-14) is now **FULLY DONE 2026-08-15**
— the 3 Chant skills themselves (COMPLETED.md, same day) plus the 5 traits that further modify them
(Enduring Refrain, Feverish Pulse, Calming Tongue, Liberating Liaise, Strengthening Stanzas — see
COMPLETED.md for the per-trait writeup) are all curated. One genuine gap fell out of that pass, since
fixed — see COMPLETED.md's 2026-08-15 `MISCELLANEOUS_MATCHERS` WvW-override entry.

- [ ] Party-wide-only filter for boon/condition/effect summaries (flagged 2026-08-16) — a new toggle
      on the build editor (`BoonConditionSummaryPanel`) and squad editor (`SlotTile`/`PartyRow`) that,
      when on, only shows boons/auras/miscellaneous effects (stealth, superspeed, etc.) and cleanses
      whose `targetCount` reaches the full party: **`targetCount !== null && targetCount >= 5`**
      (user-confirmed 2026-08-16: "just the buffs that target 5+ players, a full party" — a squad-wide
      10-target effect still counts, since it covers the party as a subset; self-only (1) and
      small-group (2-4) sources don't). Sources with unresolved/uncurated `targetCount` (`null`) are
      **hidden** when the filter is on (conservative — don't claim party-wide for uncurated data).
      Scope is the ally-facing categories only (Boons, Auras, Miscellaneous, and the Cleanse line of
      Strips/Corrupts/Cleanses) — Conditions/Control/Strip/Corrupt are enemy-facing and "party wide"
      doesn't apply the same way to them, unaffected by this toggle. Filtering happens per-source
      within each group (a group with a mix of qualifying and non-qualifying sources still shows, just
      with only the qualifying sources listed in its tooltip); a group hides entirely only when NONE of
      its sources qualify. Needs a new `useAppSettings`-style boolean (or per-view local state — decide
      whether this should persist like `showUnderwater`/`showRacialSkills` or reset per session) wired
      through `computeBoonConditionSources`/`computeNamedFactSources`'s existing `targetCount` field —
      no new data modeling needed, the field already exists on every source.

- [ ] Exclusion filter on the Builds tab (flagged 2026-08-16) — extend `useTagFilter`
      (`src/renderer/state/use-tag-filter.ts`, shared by `BuildsView`/`SquadsView`/`BuildsSidebar`)
      from OR-inclusion-only to support excluding specific tags/professions too. User-confirmed
      interaction (2026-08-16): click-cycle the same chip through off → include → exclude → off, no
      new UI controls — reuses `TagChipDropdown`/`ProfessionTagPicker`'s existing chip click handlers,
      just needs a 3-state model (`Map<string, 'include' | 'exclude'>` instead of `Set<string>`) and a
      visual "excluded" chip state (e.g. a strike-through or red outline) distinct from "selected."
      Filter logic: keep OR-across-includes, AND NOT any excluded tag/profession present. Scoped to
      the Builds tab per the user's request — decide separately whether `BuildsSidebar`/`SquadsView`
      should get the same treatment since they share the hook (likely yes, low extra cost once the
      hook itself supports it).

- [ ] Discord bot — a guild-scoped, curated build/squad board (slash-command add/edit/remove/move,
      profession-sectioned board messages the bot keeps in sync, optional Manual-approval workflow
      with role-gated buttons) mapped out in full 2026-08-12, not started. Full design-of-record —
      command list, D1 schema, approval workflow, architecture decisions, explicit v1 non-goals —
      now lives in `docs/discord-bot.md` rather than here; read that first before picking this up.

- [ ] Capacitor port for iOS/Android — scoped 2026-08-01, two-part seam: (1)
      `StorageAdapter`/`Repository<T>` (`src/shared/storage/storage-interface.ts`) is already
      backend-agnostic — needs a new implementation (e.g. `@capacitor-community/sqlite`) replacing
      `sqlite-storage.ts`; (2) the renderer never calls that interface directly — it goes through the
      Electron-only preload bridge (`window.gw2Storage`, wired in `src/preload/index.ts` +
      `src/main/ipc/storage-ipc.ts`), which has no Capacitor equivalent — needs a platform-neutral
      seam or a Capacitor-side shim. Also: native HTML5 drag-and-drop in the squad editor has no
      touch-input fallback yet.

## Coefficient curation — remaining exceptions

`CURATED_HEALING_COEFFICIENTS` and `CURATED_DAMAGE_COEFFICIENTS` are now complete sweeps across all
9 professions and all 4 skill slots (see COMPLETED.md Sessions 57-74 for the full sweep history).
What's left below is specific skills/traits that were investigated and deliberately left uncurated —
don't re-guess a coefficient for these without a fresh look at the source conflict.

**Healing — Utility (2):**
- Guardian 31295 (Sanctuary, underwater variant): a frozen pre-2016-balance-pass copy of id 9128 —
  no wiki coefficient documented for it specifically (underwater is out of scope for WvW anyway).
  Re-checked 2026-08-13: 9128's own wiki coefficient (522/0.1375) is unchanged and still the only one
  curated (id 31295 above); no separate documentation for 31295 has appeared, no change.
- Guardian 62669 (Repose): the wiki page itself is tagged stub — coefficient is an unfilled `?`.
  Re-checked 2026-08-13: still `?` — coefficient itself is still undocumented, no change. Note for
  whoever eventually fills this in: the wiki's Version History now shows a 2025-11-18 balance patch
  that dropped the WvW/PvP base value from 2595 to 1635 (PvE unaffected) — don't reuse the older 2595
  figure from before that patch if it surfaces anywhere stale.

**Healing — Heal-slot (4):** Engineer 63049 (Rectifier Signet's trait-upgraded pulse heal — no wiki
fact template at all); Necromancer 10547 (Summon Blood Fiend — pet's own fixed-0 Healing Power, no
coefficient param on wiki, expected non-scaling); Necromancer 10670 (2nd Well of Blood id — API
values don't match either PvE/WvW reading of the shared wiki page, likely an undocumented
Scourge-context variant); Revenant 26937 (Enchanted Daggers — wiki 1640 vs. API 1560, same +80
offset also shows up on its Siphon Damage facts). All 4 re-checked 2026-08-13 against fresh wiki/API
pulls — same conflicts persist unchanged, still genuinely uncurated.

Closed 2026-08-13 (re-investigated, now curated in `CURATED_HEALING_COEFFICIENTS`): Elementalist
44239 (Aquatic Stance — the wiki's own dated Version History prose and the live API now agree on
6480; only the infobox's isolated template param was stale, off by 80) and Engineer 76738 (Mitotic
State — the "API 305" was confirmed to be a per-pulse value, 305 × 25 pulses over its 5s duration =
7625, matching the wiki's summed total exactly; not a real conflict).

**Healing — Weapon-slot (4):** Elementalist 72982 (Etching: Jökulhlaup, Spear — no `coefficient=`
param on wiki); Necromancer 30860 (Death Spiral — wiki stub, missing siphon coefficients);
Necromancer 69302 (Life Siphon — wiki 450/300 vs. API 537/238, unexplained); Thief 72991 (Shadow
Veil, Spear — two facts share identical factText with only one wiki-documented coefficient; the
table matches by factText alone so curating risks binding to the wrong fact). All 4 re-checked
2026-08-13 against fresh wiki/API pulls — same conflicts persist unchanged, still genuinely
uncurated.

Closed 2026-08-13 (re-investigated, now curated in `CURATED_HEALING_COEFFICIENTS`): Ranger 31889
(Astral Wisp, post-rework — same per-pulse-vs-total shape as Mitotic State above: wiki's one total
value (1288) ÷ its now-4 pulses = 322, matching the API's duplicate-text facts exactly; safe to bind
since, unlike Shadow Veil below, both duplicate facts share the same value).

Closed 2026-08-13 (re-investigated, resolved): **Healing — Thief's Assassin's Reward trait (id
1238)**, originally investigated 2026-08-05 and blocked on "this app has no initiative-cost field
anywhere ... so a generic per-point trait-bonus table can't render without new data modeling
first." Turned out no new data modeling was needed — the GW2 API itself exposes per-skill
initiative cost (`skill.initiative`), the original blocker was about this app's own stored data,
not the API. The trait's own wiki page gives a flat, unconditional rate (151 base + 0.085
coefficient per point of initiative spent, no PvE/WvW split), so each of the 45 candidate skills
just needed `baseValue = 151*N` / `coefficient = 0.085*N` with N wiki/API-confirmed per skill —
22 landed cleanly, plus 6 more (Spear/underwater-weapon skills) that carry a genuine, still-live
ArenaNet bug baking their Healing fact at the pre-2023-06-27 rate (102/point) instead of the
current 151 — reproduced as-is (that's what the live tooltip actually shows) rather than
"corrected." 17 stayed uncurated: 14 for the familiar `Array.find`-binds-to-array-order duplicate-
fact trap (a genuine PvE/WvW/PvP initiative-cost split materialized as 2-3 identical-factText facts
this table can't disambiguate — same shape as Shadow Veil), Black Powder (only its PvE/PvP-grouped
value is exposed, no sourced number for its separate WvW cost), and Measured Shot/Repeater(13111)
(each bakes an older, pre-patch initiative cost into its Healing fact — unlike the Spear group,
here it's N itself that's stale, so there's no way to know which N the HP-scaling coefficient
would use without live-testing). See `healing-calc.ts`'s Weapon-slot Thief block for the full
per-skill breakdown. (Necromancer's equivalent case, Chillblains/Transfusion trait 778, was
resolved 2026-08-05 as a genuine per-skill design, not this shape — already curated.) Still worth
checking other professions for the same "heal on X while this trait is active" shape someday.

**Damage** — condition-damage skills (coefficient against Condition Damage rather than Power) were
never in scope for the sweep; would need their own wiki-verification pass
(condition-per-stack-per-second base values are a separate documented constant table) before
extending `CURATED_DAMAGE_COEFFICIENTS` to cover one.

**Both tables**: never visually spot-checked in the running app (Electron sandbox limitation) — do
that before extending either further.

- [ ] Mesmer's Tale of the Second Scion (id 76695) also grants "Scion's Reprieve," a self-buff
      (+15% WvW/PvP Heal Effectiveness) that nothing in the app accounts for — not a Healing fact
      itself, it modifies *other* incoming/outgoing heals. App has no general outgoing/incoming
      heal-modifier concept yet (distinct from the boon/condition uptime system); needs scoping, not
      a one-off patch for this skill.

## Stats panel / boon-condition bar polish

- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Nice-to-haves

- [ ] Gear Optimizer's rune/infusion search (2026-08-11, see COMPLETED.md) adds up to ~18 extra
      per-slot infusion search variables + 1 rune slot on top of the existing ~12-14 gear/food/
      utility slots — a synthetic stress case (2 floors, 3 maximize tiers, food/utility AND
      runes/infusions all on at once, 35 total slots) hit the search's `NODE_LIMIT` truncation
      (still returned a feasible, reasonable-looking result in ~1s — not a hang — and the UI already
      surfaces "truncated" transparently) where the same query without rune/infusion search stays
      well within budget. Not itself a bug, just a real trade-off worth watching: if truncated
      results turn out to look meaningfully suboptimal in practice, look at raising `NODE_LIMIT`,
      tightening the branch-order heuristics for infusion-shaped (single-attribute, low-spread)
      slots specifically, or collapsing same-key infusion slots that end up with identical option
      sets before they hit the solver.
