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
(Zephyrite) reshaped into a full relic-integration sweep — see "Relic proc integration sweep"
below.

## Relic proc integration sweep

Grew out of the Zephyrite bug report above (2026-08-16). Investigating Zephyrite surfaced that this
isn't a one-relic gap: `RelicEffect`'s own doc comment (`src/shared/types/game-data.ts`) documents,
as deliberate policy, that **no** relic proc is modeled anywhere in this codebase — every relic's
tooltip is plain wiki-quoted text (`formatRelicDescription`/`formatFactLine`, no icon-row treatment
like a skill's boon facts get), and NO relic feeds `computeBoonConditionSources` (confirmed by a
full grep of `sources.ts`, zero relic-id references anywhere in that file). The stated reasoning:
most relic procs are conditional on a player action with no fixed frequency this app could assume
without inventing one (same reasoning the 2026-08-15 dodge-relic sweep used to deliberately exclude
`DODGE_RELIC_IDS` from this same calculator).

The user's call (2026-08-16): stop treating that as a closed policy and instead re-look at all 112
relics (`data/game-data/relics.json` / `relic-effects.json`) as a proper integration pass, the same
shape as the other per-category sweeps logged elsewhere in this file/COMPLETED.md — not a Zephyrite
one-off.

- [x] Audit all 112 relics and classify each proc's trigger by whether this app already models a
      deterministic frequency/timing for it. **DONE 2026-08-16** — full classification in
      `docs/relic-trigger-classification.md`. Turned out broader than scoped: `Skill.categories`
      already carries GW2's profession-mechanic category strings (Meditation/Signet/Consecration/
      etc.) for every equipped Heal/Utility/Elite skill, so ability-type-gated relics ("upon using a
      well/signet/mantra/cantrip/... skill") are just as deterministic as the elite/heal-skill case,
      not merely "possible" — that widened the deterministic bucket. Of 112 relics, 19 land in a
      deterministic-trigger bucket AND grant a real ally/self boon or aura payload (the only ones
      worth wiring into `computeBoonConditionSources`) — full list + full 112-row table in the doc.
      Dodge exclusion kept as-is, not re-litigated.
- [x] Design a general "relic effects gated on an already-modeled trigger" mechanism (rather than a
      one-off special case per relic, like `branchConditionalFacts`' skill-id dispatch) that
      `computeBoonConditionSources` can consult, sized for the 19 candidates in
      `docs/relic-trigger-classification.md`. **DONE 2026-08-16** — `RELIC_TRIGGER_GATES` +
      `relicSources`/`extractFromRelicFacts` in `sources.ts`, 2 of the 3 scoped shapes built (single-
      slot Elite/Heal, category-matched ability-type via a new `healUtilityEliteSkillIds` helper);
      the 3rd (mantra-final-charge) turned out to have no real candidate — Relic of the Firebrand's
      payload is a "+20% Boon Duration" passive modifier, not a discrete boon status, so it doesn't
      fit this table's shape regardless of trigger. Wired into both `computeBoonConditionSources`
      AND `computeAuraSources` (auras needed their own pass — see that field's "'aura' entries only
      ever come from `computeAuraSources`" contract). Went further than "design" alone: also curated
      and wired 10 of the 19 candidates whose facts were unambiguous (Surging, Earth, Pack, Centaur,
      Durability, Resistance, Febe, Reunification, Altruism, Fire, Chronomancer, Phenom, Sacred
      Grounds — see `RELIC_TRIGGER_GATES`'s doc comment for the exact list and per-relic payload).
      9 tests in `relic-sources.test.ts`.
- [x] Relic of the Zephyrite (100893) — the sweep's own motivating case — is now fully curated AND
      wired. **DONE 2026-08-16.** Two parts: (1) the wiki's stepped crystal-duration table (0s→4s,
      1-20s→5s, 21-40s→6s, 41-60s→7s, ≥61s→8s) lives in wiki prose, not the `{{skill fact}}` infobox
      `fetch-relic-effects.ts` parses, so it's hand-curated via a new `CURATED_RELIC_FACT_OVERRIDES`
      table in `relic-effects-format.ts` (survives a `fetch-relic-effects` re-run, unlike editing
      `relic-effects.json` directly) — also fixes the stale Max (was 7, wiki now says 8). (2) added to
      `RELIC_TRIGGER_GATES`; unlike every other entry, its duration isn't a flat pass-through of
      `relic-effects.json`'s facts (those are the crystal's 1s per-pulse tick, not its lifetime) —
      `relicSources` reads the build's actual equipped elite skill's own `Recharge` fact and maps it
      through the same stepped table (`ZEPHYRITE_CRYSTAL_DURATION_TIERS` in `sources.ts`); Revenant
      (2 legends, no single "active" elite skill by design) takes the shorter of the two rather than
      guessing. See `docs/relic-trigger-classification.md`'s "Leg 3" section for the full writeup.
- [x] Relic of Sorrow (103424) — **CLOSED 2026-08-16.** Wiki re-check confirms leg 2's correction
      word for word: its "protects allies" effect is a custom damage-reduction/reflect zone plus
      pulsing healing (`Healing` 660@0.25, `Duration` 4, `Radius` 240, `Damage reduced` 20% — all
      already-rendered plain tooltip facts via `formatRelicDescription`), never the Protection boon
      or any other boon/aura. Permanently excluded from `RELIC_TRIGGER_GATES`, not deferred — no
      code change needed, `relic-sources.test.ts` already covers it. See
      `docs/relic-trigger-classification.md`'s "Leg 4" section.
- [ ] 4 relics still need real follow-up work before they can join `RELIC_TRIGGER_GATES` (found/
      re-confirmed while building the mechanism above — see that table's doc comment for the full
      per-relic reasoning):
      - Relic of Leadership (100625): "Convert conditions into boons" doesn't name which boon(s) —
        would need a wiki check of whether the conversion is deterministic enough to model at all.
      - Relic of the Twin Generals (101767): base Might (6 stacks) is safe, but its "Might per Hit"
        bonus scales with enemies struck — needs a real decision on whether/how to bound that before
        it can be wired without inventing a number.
      - Relic of the Firebrand (100453): "+20% Boon Duration" is a passive attribute-style modifier,
        not a discrete boon — would need new infra shaped like
        [[new_attribute_bonus_infra_2026-08-15]]'s Power Overwhelming, not `RELIC_TRIGGER_GATES`.
      - Relic of the Astral Ward (100388): 2-step signet mechanic (spawns on one signet use,
        consumed by the next) — already flagged in `docs/relic-trigger-classification.md` as complex
        enough to design separately.
- [ ] Smaller follow-up noticed while wiring the 10 above: Relic of the Pack's Superspeed and Relic
      of Febe's condition-removal are real, deterministic-trigger facts, but `Superspeed`/cleanse
      are tracked via the separate `computeNamedFactSources`/`MISCELLANEOUS_MATCHERS` pipeline
      (`NamedFactSource` already supports a `'sigil'` `sourceKind` as precedent for a non-skill/trait
      equipment source) — extending relics into that pipeline too is unscoped, not attempted this
      leg.

## Scoped features, not yet built

Paragon's Motivation-tiered Chants (flagged by the user 2026-08-14) is now **FULLY DONE 2026-08-15**
— the 3 Chant skills themselves (COMPLETED.md, same day) plus the 5 traits that further modify them
(Enduring Refrain, Feverish Pulse, Calming Tongue, Liberating Liaise, Strengthening Stanzas — see
COMPLETED.md for the per-trait writeup) are all curated. One genuine gap fell out of that pass, since
fixed — see COMPLETED.md's 2026-08-15 `MISCELLANEOUS_MATCHERS` WvW-override entry.

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
