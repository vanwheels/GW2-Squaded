# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Path to 1.0 (target: ship this week for community testing/feedback)

User's explicit goal, stated 2026-08-12: cut a 1.0 release this week so the community can start using
it and giving feedback — the user isn't deeply familiar with every profession's own meta/quirks and is
relying on wider playtesting to catch what solo curation can't. 1.0 scope = README roadmap items 1-4
(scaffolding, build editor + boon/condition calculator, squad preview builder, sync/share backend) —
the Discord bot and the Capacitor mobile port are explicitly OUT of 1.0 scope (later roadmap stages,
own sub-projects). Already shipping releases (v0.1.0-v0.3.0 tagged, electron-builder + auto-update
live) — the app is feature-complete for this scope; the open question is correctness confidence, not
missing features.

Both gaps that stood between here and 1.0 are now closed:
1. ~~**Never visually verified in a running app.**~~ **DONE 2026-08-13** — user did a manual
   click-through pass. Found one real bug along the way: Revenant's skill bar was showing phantom
   duplicate icon rows for skills with no real secondary action — fixed same day (COMPLETED.md
   Session 165), including its non-Revenant sibling sweep (Session 166) and its last curation
   loose end, Breakrazor's Bastion (Session 167) — fully closed.
2. ~~**Zero automated tests.**~~ **DONE 2026-08-13** — 108 tests across 3 completeness scans + 3
   value-correctness tiers; full history in COMPLETED.md (Sessions 158-164). Also found and fixed 7
   real bugs as a byproduct (stale `factText` matches, missing health-threshold/full-endurance combat
   state dimensions, one live ArenaNet API data bug) — see COMPLETED.md for details.

**1.0 is otherwise unblocked** — what's left in this file below is post-1.0 polish, deliberately
deferred features (Discord bot, Capacitor port — always out of 1.0 scope), and open curation gaps
that don't block a release.

## Scoped features, not yet built

- [ ] **Same-name "enhanced" flip targets should merge into one tooltip with a "When Enhanced"
      divider instead of a 2nd stacked icon** — flagged by the user 2026-08-13 looking at Icerazor's
      Ire's skill bar (still shows 2 icons even after the flip-duplicate sweep, since its enhanced
      cast DOES carry genuinely new content — Chilled — so the existing `isNonActionableFlipTarget`
      mechanism correctly leaves it as a separate icon per its own design). User's proposal: for this
      specific shape (flip target shares the exact same skill name as its source, i.e. "same skill,
      conditionally enhanced" rather than a genuinely different action), render ONE tooltip — base
      facts, then a divider, then "When Enhanced"/the triggering condition, then only the target's
      NEW facts — instead of a full 2nd icon+tooltip.
      **User chose the full-classification-first option** over "just ship the 2 already-confirmed
      families now": every same-name flip pair in the game must be individually classified before any
      rendering changes land, since a blanket "same name → merge" rule would be wrong for many of
      them (see below).
      **Scan** (2026-08-13): every `flipSkill` pair in `data/game-data/skills.json` where source and
      target share the exact same `name`, filtered against the existing
      `NON_ACTIONABLE_REVENANT_FLIP_TARGET_IDS`/`NON_ACTIONABLE_OTHER_PROFESSION_FLIP_TARGET_IDS`
      exclusion tables (already-hidden pure duplicates) — found ~50 pairs, NOT all the same shape:
        - Warrior adrenaline-tier bursts (Eviscerate, Kill Shot ×3-deep chain, Earthshaker, Arcing
          Slice, Skull Crack, Whirling Strike, Combustive Shot, Forceful Shot, Breaching Strike, Path
          to Victory, Harrier's Toss, Bloodthirster, Berserk — 14 pairs) — mutually EXCLUSIVE power
          tiers gated by current adrenaline, not additive. A divider merge would misrepresent them as
          stacking; needs its own classification pass (not started) to confirm this reading per-skill
          before deciding a treatment (may just need a different render shape entirely, e.g. "Tier 2"
          labels, not a same/enhanced divider).
        - Guardian Tome/Virtue/Spirit Weapon chains (Shield of Absorption, Virtue of Courage, Virtue
          of Resolve, Shield of Courage, Wings of Resolve, Tome of Resolve, Tome of Courage, Tome of
          Justice, Crashing Courage ×2, Glaring Burst chain, Radiant Courage, Radiant Resolve — 13
          pairs) — not yet classified, likely a mix of sequential-page/recharge-triggered shapes.
        - Mesmer (Mind Wrack, Axes of Symmetry, Split Second, Bladesong Harmony — 4 pairs) — not yet
          classified.
        - **Classified this session**:
          - **Additive enhancement** (the target shape, real divider-merge candidates once rendering
            is built): Revenant's Band Together family (Icerazor's Ire, Darkrazor's Daring,
            Razorclaw's Rage, Breakrazor's Bastion) + Elementalist's 4 attunement-conditional
            familiars (Fox's Fury, Otter's Compassion, Toad's Fortitude, Hare's Agility, all 4 now
            individually wiki-confirmed, not just "assumed" — see `other-profession-flip-
            duplicates.ts`). 8 pairs total, 0 rendering built yet.
          - **Genuine sequential chain, correctly left as-is**: Thief's Deathstrike (27074→28625,
            "quick attack, then a second devastating blow if it hits" — 2nd hit conditional on the
            1st landing, not an unconditional addition, same shape as any multi-hit autoattack chain).
          - **Out of scope, not a combat-facts case**: Revenant's Legendary Renegade Stance
            (46409→41858) — a Legend-select mechanic-bar button, differs only by a `StunBreak` flag,
            not a boon/condition/damage duplicate in the sense this item is about.
          - **Zero new content, now excluded** (added to `NON_ACTIONABLE_OTHER_PROFESSION_FLIP_
            TARGET_IDS` this session, same mechanism as the original sweep — these were STILL showing
            a pointless 2nd icon until now): Ranger's Maul, Thief's Repeater/Spinning Axe/Death's
            Advance, Necromancer's 3 Charged Souls "Innervate" mechanic-slot skills. 7 pairs fixed.
      **Next leg**: classify Warrior (14 pairs, likely needs its own "tiered, not additive" render
      treatment decided) and Guardian (13 pairs) — largest remaining pools. Once the full ~50-pair
      classification is done, THEN design+build the actual divider rendering for the confirmed-
      additive family (`skillTooltipContent`/`FlipSkillStack` in `SkillsEditor.tsx`).

- [ ] Dodge-roll-sourced boons/conditions/heals/damage aren't tracked as their own category —
      flagged by the user 2026-08-07 (Vindicator and Mirage in particular build entire kits around
      dodging). Splits into two different problems on investigation:
      1. Trait procs already modeled as ordinary facts on the trait itself (e.g. Guardian's Selfless
         Daring, "the end of your dodge roll heals nearby allies" — real `AttributeAdjust`+Number(5)+
         Radius facts) likely already flow into totals today, since this app treats any chosen
         trait/skill with real facts as always-contributing regardless of its specific trigger
         condition — not a calc gap, just nothing labels it "from dodging" anywhere in the UI.
      2. Whole alternate dodge-replacement mechanics (Vindicator's Legendary Alliance dodge, Mirage's
         Mirage Cloak) have no skill id in `skills.json` at all and nothing in `src` references them
         by name — the GW2 API doesn't expose the dodge button as an activatable skill the way it
         does weapon/utility skills. Same "API gives nothing to render" shape as Revenant's
         Otherworldly Bond (see COMPLETED.md Session 131), not a wiring bug — would need hand-curated
         content.
      Also flagging: relics can grant dodge-triggered effects too (e.g. Relic of Rivers, "alacrity
      and regeneration at the end of your dodge roll") with only flavor text — same empty-facts
      problem again. User's proposed UI treatment once data exists: a small visual indicator above the
      skill bar (not a real skill slot) with its own custom tooltip for whatever a build's dodge
      grants beyond the normal evade frames.

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

- [ ] Stretch, deferred 2026-08-01: frame a build's "last updated" (shown today as a plain relative
      timestamp) relative to GW2 balance patches instead — e.g. "not reviewed since the last patch."
      Was blocked on a `/v2/build`-polling mechanism not existing yet; that's no longer true as of
      2026-08-11's in-app game-data refresh (`src/main/game-data/data-update.ts` now fetches and
      compares `/v2/build` via `meta.json`'s `gw2Build` — see `docs/game-data.md`'s "In-app
      game-data refresh" section). Not itself built — this stretch item can now reuse that same
      `gw2Build` value (the currently-loaded local `meta.json`'s, via `getLocalMeta()`) instead of
      polling a second, parallel patch-tracking path.

## New attribute-bonus gaps needing new CombatState infra

Spun off by the trait-attribute-bonus sweep (`trait-attributes.ts`, COMPLETED.md Session 148), its
8-family conditional follow-on sweep (Sessions 149-156), and the trait attribute-bonus completeness
scan (2026-08-12, TODO's now-closed "Automated testing strategy" section) — all now-closed sweeps that
don't have their own open-items table to hold these. Each is a genuine, wiki-confirmed character-stat
grant, not a proc/skill-tooltip coefficient, but needs a conditional-gate shape this codebase doesn't
have infra for yet, so none are rushed into an existing curated table:

- [ ] **Power Overwhelming (Elementalist, id 334) — might-stack-THRESHOLD-gated Power, doubled by
      attunement.** "While at or above the might threshold, gain increased power. Power bonuses are
      doubled while attuned to fire." Wiki-verified 2026-08-12: +150 Power once `mightStacks >= 8`
      (WvW/PvP threshold; PvE is 10), doubled to +300 while `activeAttunement === 'Fire'`. Distinct
      from `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`'s continuous per-stack scaling (this is a binary
      on/off at a threshold) AND distinct from `ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES`'s flat
      attunement-gated bonus (this is a *multiplier* on an already-conditional bonus, same
      "doubling isn't its own fact" shape `WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES`'s Forceful
      Greatsword/Blood Reaction comments already flag) — needs its own combined-gate table, not a fit
      for any existing one.
- [ ] **Deadly Strength (Necromancer/Harbinger, id 855) — per-Death's-Carapace-stack
      Power/ConditionDamage.** "Carapace stacks grant power and condition damage." Wiki-verified
      2026-08-12: +10 Power / +10 ConditionDamage per stack, no game-mode split (`{{skill
      fact|attribute|Power|10}}` + `{{skill fact|attribute|Condition Damage|10}}`). No `CombatState`
      field tracks stacks of this resource today (`mightStacks`/`kallaFervorStacks` are the only
      stack counters that exist). Needs a new `CombatState.deathsCarapaceStacks` field (same UI shape
      as `kallaFervorStacks`'s Renegade-gated stepper) before this can be curated. **Not
      Harbinger-exclusive**, found 2026-08-14 while scoping the trait-granted-boons-on-skills
      sweep's Necromancer leg: "Death's Carapace" is a real API `Buff` fact (`status: "Death's
      Carapace"`, decays like a boon, grants Toughness per stack — its own `desc=` differs pve+wvw
      vs pvp, another number this app doesn't model yet) built by Death Magic core traits too, not
      just Harbinger's Blight — **Soul Comprehension** (839, "kills grant carapace; gain life force
      per stack when you enter shroud" — the actual grant is on-kill, not skill-use), **Armored
      Shroud** (856, "gain carapace when entering shroud," would mirror onto Death
      Shroud/Reaper's/Desert/Sandstorm/Harbinger/Ritualist's Shroud the same way this leg's other
      shroud-entry traits did), and **Dark Defense** (860, "gain carapace and protection when you
      use a healing skill" — the Protection half is already curated onto all 13 Necromancer heal
      skills this leg, `synthetic-facts.json`, trait 860; only the Carapace half is blocked here).
      "Death's Carapace" is also not in `BOON_NAMES`/`CONDITION_NAMES`
      (`src/shared/boon-calc/constants.ts`) — user-confirmed 2026-08-14 this should be modeled as a
      `CombatState`-tracked stat-stepper resource (Kalla's-Fervor shape), NOT added to the generic
      boon-tooltip name list, so don't just add it there as a shortcut. Once `deathsCarapaceStacks`
      exists, Deadly Strength/Soul Comprehension/Armored Shroud/Dark Defense's granting+consuming
      sides can all be wired against the same field.
- [ ] Pinnacle of Strength's flat, unconditional +5% critical-hit chance fact is NOT curated
      anywhere — no unconditional flat-crit-chance table exists yet in this codebase (only the
      Fury-gated `FURY_CRIT_CHANCE_TRAIT_BONUSES`). Worth a future small sweep if more unconditional
      flat-crit traits turn up.

## Trait-granted boons not shown on the triggering skill

Spun off 2026-08-12 from the Renegade tooltip gap pass (Notoriety/Rapid Flow, both already curated
that session — see `synthetic-facts.json`/`healing-calc.ts`). Same shape as the (now-closed)
buff-instance-label sweep: `Skill.traitedFacts`/`requires_trait` is a real API mechanism, but the API
only populates it for a handful of skills — most traits that grant a boon "when you use [a heal
skill/shroud/kit/etc.]" need the grant hand-mirrored onto the actual triggering skill(s) via
`synthetic-facts.json`, or the boon never shows on that skill's own tooltip. Scoped 2026-08-14: 470
traits carry a direct Buff fact, 389 have zero skills referencing them via `requires_trait`, narrowed
to **48 candidates across all 9 professions** whose description names an identifiable skill/skill-
category trigger (heal skill, elite skill, shroud, kit, banner, spirit, shout, glyph, signet, etc.) —
run leg-by-leg like the buff-instance-label sweep, one profession per leg, checking in between (see
[[pacing_large_sweeps]]).

- [x] **Necromancer leg (1st leg) done 2026-08-14.** 14 raw candidates. 5 traits cleanly curated
      (Weakening Shroud/813, Speed of Shadows/888, Eternal Life/889, Awaken the Pain/915, Implacable
      Foe/2192's Stability) mirrored onto the 6 "entering shroud" skills (Death Shroud/Reaper's/
      Desert/Sandstorm/Harbinger's/Ritualist's Shroud); Dark Defense (860)'s Protection half mirrored
      onto all 13 Necromancer heal skills. 3 redirected to the new "Death's Carapace" bullet above
      (Soul Comprehension/839, Armored Shroud/856, Dark Defense/860's other half) — blocked on
      `CombatState.deathsCarapaceStacks` infra, not a skill-tooltip fix. Left open: **Empowering
      Spirits** (2405, Ritualist/spirit-summon mechanic — 4 different boons across 3 different
      "Innervate [Spirit]" trigger skills plus a mode-dependent different-boon-per-mode split
      [Quickness pve / Vigor wvw+pvp], too much uncertainty about exact linked-skill ids to curate
      confidently without deeper live-game verification this session didn't have). Also found and
      fixed a fresh unlabeled-duplicate-row collision this leg's own Eternal Life mirror introduced
      on Sandstorm Shroud (`BUFF_INSTANCE_LABELS`, sources.ts) — worth re-running that same
      same-tuple collision check after every future leg here, not just this one.
- [x] **Elementalist leg (2nd leg) done 2026-08-14.** Rescanned fresh (41 raw zero-linkage-with-a-
      Buff-fact candidates, wider than the original 48-count estimate's "5" since that scan didn't
      fully enumerate this profession). 6 cleanly curated via `synthetic-facts.json`: Earth's
      Embrace (282, Resistance), Soothing Ice (348, Regeneration + Frost Aura), and Gale Song (1952,
      Protection) all mirrored onto all 16 Elementalist heal skill ids (heal-skill-category
      trigger, same shape as Necromancer's Dark Defense); One with Air (224, Superspeed) onto both
      Air Attunement skill ids (base + Weaver's 2nd bar); Rock Solid (281, Stability) onto both
      Earth Attunement skill ids; Hardy Conduit (1948, Protection) onto all 4 Overload skills. Found
      and fixed 4 fresh same-tuple collisions this leg's own mirrors introduced (`BUFF_INSTANCE_LABELS`
      in `sources.ts`): Signet of Restoration's Frost Aura (vs. Written in Stone/trait 287),
      Prayer to Dwayna's and Healing Seed's Protection (vs. Dark Defense/trait 860, already mirrored
      there from the Necromancer leg), and Glyph of Elemental Harmony's Protection (vs. its own base
      self-effect). Deliberately left uncurated as not fitting this sweep's "single identifiable
      trigger skill" shape: Electric Discharge (222, foe-facing Vulnerability+damage proc, not an
      ally-boon mirror), Arcane Prowess (268, Might+Fury on ANY attunement swap — 8 skill ids across
      all 4 elements × base+Weaver, plus a genuine WvW-relevant PvE-Might+Fury-vs-WvW/PvP-Fury-only
      mode split, too much surface for one session), Earthen Blast (279, Barrier+foe-Cripple, not a
      recognized boon), Bountiful Power (1511, attunement-swap charge-accumulator, same complexity
      class as the still-open Empowering Spirits from the Necromancer leg), and Elemental Bastion
      (1986, health-threshold trigger, not a skill trigger at all). The other ~30 raw candidates are
      on-crit/on-dodge/on-combo/on-aura-grant mechanics (Elemental Empowerment family, Invigorating
      Torrents, Elements of Rage, etc.) that don't name a single triggering skill either — not
      itemized individually, same reasoning as Elemental Bastion.
- [x] **Engineer leg (3rd leg) done 2026-08-14.** Rescanned fresh (40 raw zero-linkage-with-a-
      Buff-fact candidates). 8 cleanly curated via `synthetic-facts.json`: Reconstruction Enclosure
      (508, Protection) mirrored onto all 15 Engineer heal skill ids (heal-skill-category trigger,
      same shape as Necromancer's Dark Defense/Elementalist's trio); Streamlined Kits (512,
      Swiftness) onto all 7 Engineering Kit equip ids (Med/Grenade/Bomb/Tool Kit, Flamethrower,
      Elixir Gun, Elite Mortar Kit — identified via each skill's `flipSkill` field pointing at its
      "Stow ___" counterpart, which was excluded); Grand Entrance (1541, Resistance + its own
      "Grand Entrance" self-buff) onto Explosive Entrance (59562, Holosmith's Photon-Forge-entry
      sub-skill); Automated Medical Response (1901, Regeneration) onto the 9 heal skills' own
      tool-belt skill ids (a NEW category shape for this sweep — mirrors onto the tool-belt id, not
      the heal skill itself); Optimized Activation (1979, Vigor) onto all 56 Engineer tool-belt
      skill ids game-wide (every utility/heal/elite skill's toolbelt id, incl. racial utilities —
      broad but mechanically well-defined, same "whole category" precedent as Elementalist's Overload
      skills); Juggernaut (1984, Stability + Fire Aura, NOT its "might while wielding" passive half)
      onto Napalm (5929, the shared Flamethrower-kit skill 5); Mech Core: Jade Dynamo (2292,
      Quickness) onto Jade Mortar (63121) — the one Mech Command skill this same trait unlocks, safe
      since the tier's 4 Mech Command traits are mutually exclusive. Also the first leg to target
      skill ids with empty `professions`/`slot` in `skills.json` (Explosive Entrance, Jade Mortar —
      real ids the API just doesn't tag; synthetic-fact merging is purely id-keyed so this works).
      Found and fixed 1 fresh same-tuple collision this leg's own mirror introduced
      (`BUFF_INSTANCE_LABELS`, sources.ts): Reconstruction Enclosure's Protection on Prayer to
      Dwayna/Healing Seed (12360/12440) was a 3rd same-tuple copy, not a 2nd, since the Necromancer
      and Elementalist legs' own mirrors already occupy occurrences 1-2 there. Also noticed (not
      fixed, unrelated to this leg): Elixir H (5834) has a genuine pre-existing Protection@2@1
      raw-duplicate between its base fact and an HGH-gated (trait 473) traitedFacts copy with no
      wiki-quotable distinction — same "nothing to quote" shape as Water's Resolution/Earth's
      Protection from the Elementalist leg, left unlabeled. Left open, not fitting this sweep's
      single-triggering-skill shape: Mecha Legs (445) and Thermal Release Valve (2066), both
      dodge-triggered (dodge has no skill id of its own to mirror onto); Mass Momentum (1867,
      Stability — "Your Function Gyro applies stability to allies when cast") deferred, genuine
      uncertainty over which 2 of Function Gyro's 4 raw skill ids (56920/56921/72103/72114) the
      trait's 2 differently-valued Stability facts actually correspond to; Mech Frame: Channeling
      Conduits (2276, "when you or your mech apply barrier, grant a boon" — barrier-application
      trigger is too broad/ambiguous-source, same complexity class as Bountiful Power); Willing Host
      (2356), Carbolic Composition (2383), and New Genes (2387) all key off "morph"/"Amalgam" skills
      — a very recently added Engineer elite spec mechanic this session has no deep prior knowledge
      of, same reasoning as the Necromancer leg's Empowering Spirits/Ritualist deferral. The
      remaining ~25 raw candidates are on-crit/on-dodge/on-disable/on-combo procs with no single
      triggering skill (Shrapnel, Sapping Device, Equal and Opposite Reaction, etc.) — not itemized
      individually, same reasoning as prior legs.
- [x] **Guardian leg (4th leg) done 2026-08-14.** Rescanned fresh (34 raw candidates). 8 cleanly
      curated via `synthetic-facts.json`: Healer's Resolution (574, Resolution), Liberator's Vow
      (2101, Quickness), and Purging Light (2401, Light Aura) all mirrored onto all 12 Guardian heal
      skill ids (heal-skill-category trigger, same shape as prior legs' heal-skill traits); Monk's
      Focus (586, Fury + Resolution) onto all 7 Guardian Meditation-category skill ids; Restorative
      Virtues (2197, Vigor) and Holy Reckoning (2210, Fury) onto the one Willbender virtue skill each
      names ("activating Flowing Resolve"/"activating Rushing Justice"); Righteous Sprint (2222,
      Swiftness) onto all 3 Willbender virtue-activation skills (Rushing Justice/Flowing Resolve/
      Crashing Courage's 4 raw ids) — none of these onto their same-page "Willbender Flames" flip-skill
      ids, a separate named follow-up skill, not the virtue re-activating. Focus Mastery (633,
      Protection + Resolution) onto both Focus skills, but Protection only on Shield of Wrath (its
      2024-03-19 patch note ties it to that skill's own block-window expiry specifically), Resolution
      on both. First leg where the same-tuple collision re-check came back completely clean (no fresh
      collisions introduced). First leg needing more than one `WvwFactOverrides` addition for its own
      new mirrors: Liberator's Vow's Quickness (pve/pvp 2s, wvw 1s) onto all 12 heal ids, and Focus
      Mastery's Protection (pve 4s, wvw/pvp 2s) onto Shield of Wrath alone — both mirror trait
      2101/633's own already-auto-detected overrides (`scripts/fetch-wvw-splits.ts`'s
      `MANUAL_OVERRIDES`). Holy Reckoning's other boon, Might, deliberately NOT curated — its own
      Mechanics note confirms the trigger is any virtue's passive effect firing (crit/block/ally-heal),
      explicitly not virtue activation, so no single skill id to mirror onto (same shape as the already-
      excluded Arcane Prowess/Heavy Light family). ~26 other raw candidates left open: on-crit/on-block/
      on-disable/on-dodge/equip-triggers (Empowering Might, Valorous Defense, Might of the Protector,
      Communal Defenses, Heavy Light, Empowered Armaments, etc.), foe-facing debuffs not ally boons
      (Symbolic Exposure, Zealot's Aggression, Dulled Senses, Unrelenting Criticism, Weighty Terms),
      and Luminary's very recently added elite-spec mechanics (Light's Gift/Radiant Armaments, equip-a-
      radiant-weapon triggers) — no deep prior knowledge, same reasoning as Ritualist's Empowering
      Spirits/Engineer's morph-skill cluster.
- [x] **Mesmer leg (5th leg) done 2026-08-14.** Rescanned fresh (52 raw candidates). 13 cleanly curated
      via `synthetic-facts.json`: Metaphysical Rejuvenation (666, Regeneration) onto all 11 Mesmer heal
      skill ids (heal-skill-category trigger, same shape as every prior leg). A "Shatter skills"
      category cluster — Rending Shatter (687, Vulnerability), Maim the Disillusioned (1690, Torment),
      Illusionary Reversion (1913, Alacrity), Flow of Time (1927, Alacrity), and Nomad's Endurance
      (2069, Vigor) — mirrored onto all 5 base shatter skill ids (Mind Wrack's 2 ids, Cry of
      Frustration, Diversion, Distortion) PLUS all 6 Virtuoso Bladesong ids, since Rending Shatter's own
      wiki `improves type = Shatter, Bladesong, Instrument` field confirms Bladesongs mechanically count
      as Shatters (Instrument/Troubadour ids deliberately excluded, too recent/no deep prior knowledge).
      2 "Shatter skill 2"-only traits (Illusionary Membrane/667 Chaos Aura, Blinding Dissipation/1889
      Blinded) onto Cry of Frustration + Bladesong Sorrow (its Virtuoso equivalent); 2 "Shatter skill
      4"-only traits (Inspiring Distortion/1852 Aegis, Mental Defense/2005 Resistance) onto Distortion +
      Bladesong Distortion. Bladeturn Refrain (2212, Aegis) onto all 6 Bladesong ids (wiki-confirmed via
      the Bladesong skills category page, including Bladeturn Requiem). Master of Manipulation (677,
      Aegis) onto all 6 Manipulation-category skills (wiki-confirmed list: Mirror, Arcane Thievery,
      Blink, Illusion of Life, Mass Invisibility, Mimic). Temporal Enchanter (1980, Superspeed +
      Resistance) onto all Glamour-category skills EXCEPT Portal Exeunt (wiki: "does not grant allies
      these boons" despite being tagged Glamour) — also added a bonus `WvwFactOverrides` fix (trait
      1980's own Superspeed split wasn't manually curated before, unlike its Resistance sibling).
      Found and fixed 1 fresh same-tuple collision (`BUFF_INSTANCE_LABELS`): Time Warp's own
      unconditional Superspeed@2@1 vs. Temporal Enchanter's wvw-tagged copy (same numeric value by
      coincidence). Flow of Time's pre-existing "2 raw-identical Alacrity facts, nothing to distinguish"
      quirk (already documented in the OTHER buff-instance-label sweep) propagates unlabeled onto all 11
      mirrored ids too — not a new problem, the trait's own already-accepted shape. **New failure mode
      this leg**: 2 planned `WvwFactOverrides` additions were dropped after finding they'd corrupt an
      UNRELATED pre-existing same-status fact on the same skill (not just a same-tuple collision) —
      Healing Seed's own unconditional Regeneration@3@1 (would get silently overridden to the trait's
      wvw value even when the trait isn't equipped), and Nomad's Endurance's Vigor onto Cry of
      Frustration/Bladesong Sorrow specifically (already carry Phantasmal Force's own Vigor override at
      a different value — the override table can't hold 2 values for one status on one skill, so those
      2 ids skip Nomad's Endurance's mirror entirely rather than risk showing the wrong number). Same
      reasoning applied to Bladesong Distortion's Aegis (carries both Inspiring Distortion's unsplit and
      Bladeturn Refrain's wvw-split Aegis; only the wvw-split entry was dropped, both facts still
      mirrored, both just render their raw PvE-ish duration when co-equipped). Deliberately left open,
      too complex for one session: **Stretched Time** (1942) and **Seize the Moment** (2022) — both
      dual-trigger (shatter clone-count AND phantasm-spawn), and both a genuine mode-dependent
      DIFFERENT-boon swap (Alacrity in pve/pvp vs. Might in wvw for Stretched Time) — the OTHER
      (BUFF_INSTANCE_LABELS) sweep had already independently investigated and decoded both down to the
      per-concept wiki breakdown (see `sources.ts`'s own trait-side comments on 1942/2022), which is
      what surfaced the mode-swap complexity in the first place; a future session could pick these up
      quickly starting from that existing writeup. Also deferred: Phantasmal Haste (729, Quickness) —
      its "3 raw facts" turned out to be 2 DIFFERENT targets (the summoned phantasm gets 3s Quickness,
      the player gets a separate 1.5s/1s split), and only the player-facing half would even belong in
      this sweep, but mirroring just that half risks the same "swallows an unrelated fact" hazard as
      the Healing Seed/Nomad's Endurance cases above depending on trait combination — deferred rather
      than risk it without deeper live-game verification. Illusionary Defense (675, Protection) —
      genuine 2-tier "base + additional per clone shattered" mechanic (wiki: 4 raw facts, base+per-clone
      × pve/wvw-vs-pvp) that doesn't fit the flat single-duration `Buff` fact/`WvwFactOverride` shape at
      all. ~30 other raw candidates left open, not fitting this sweep's single-triggering-skill shape:
      on-crit/on-dodge/on-interrupt/on-block procs (Illusion of Vulnerability, Dazzling, Mental
      Gymnastics, Critical Infusion, Master Fencer, Furious Interruption, Malicious Sorcery, Power
      Block, Wandering Mind, Ineptitude, Duelist's Reversal, etc.), foe-facing conditions on-crit
      (Sharper Images, Jagged Mind, Deadly Blades), boons granted to summoned illusions/phantasms rather
      than the player (Phantasmal Fury, Escape Artist, Time Catches Up, Phantasmal Blades — this app has
      no illusion-entity boon tracking, same class of exclusion as pet/mech boons elsewhere), self-stat
      custom effects not real `BOON_NAMES` entries (Fencer's Finesse, Compounding Power, Time Bomb,
      Mirage Cloak, Dune Cloak, Phantom Pain, Quiet Intensity), Mirage-dodge/Ambush-category mechanics
      too broad for one session (Renewing Oasis, Riddle of Sand, Mirage Mantle — same complexity class
      as the already-excluded Arcane Prowess), and Troubadour's very-recently-added elite-spec mechanics
      (Raconteur/Tales, Symphonic Resonance, Mayhem/Flustering Flute) — no deep prior knowledge, same
      reasoning as every other very-recent-elite-spec deferral this sweep.
- [x] **Ranger leg (6th leg) done 2026-08-14.** 27 raw zero-linkage-with-a-Buff-fact candidates
      (again undercounting the original "5" estimate). 11 traits cleanly curated: Wellspring (978,
      Regeneration) onto all 14 heal skill ids; Stoneform (1021, Fury+Might) onto all 4 signets;
      Wilderness Knowledge (1699, Fury) onto all 6 Survival skills; Let Loose (2271, Quickness+
      Might) onto the 12 Soulbeast Unleashed Ambush skill ids; Fang and Claw (1016, Fury)/
      Rejuvenation (1055, Regeneration)/Live Fast (2071, Fury+Quickness)/Flock Together (2408,
      Quickness) — all "Beast skills grant ___" — onto all 76 Ranger pet skill ids game-wide at
      once (5 of those 76 excluded from an override on just their one already-real-fact status,
      synthetic fact still added unsplit); Unstoppable Union (2072, Protection) onto Beastmode
      entry/exit; Celestial Shadow (2053, Stealth+Superspeed) onto Release Celestial Avatar —
      found a genuinely new wiki-confirmed Stealth pve/wvw split the automated scan never resolved,
      added by hand to `fetch-wvw-splits.ts`; Jetstream (2341, Superspeed) onto Hawkeye. Fixed one
      fresh same-tuple collision (`BUFF_INSTANCE_LABELS`): Wellspring's Regeneration@6@1 vs. the
      Mesmer leg's Metaphysical Rejuvenation mirror, both on the shared racial heals Prayer to
      Dwayna/Healing Seed. Left open: Grace of the Land (2001) — a genuine mode-dependent
      DIFFERENT-boon swap (PvE Alacrity vs. WvW/PvP Might) unresolved even at the trait's own
      tooltip level, needs a base-trait fix before any skill mirror is meaningful, same shape as
      the Mesmer leg's Stretched Time/Seize the Moment; Spirited Arrival/Quick Draw/Tail Wind/
      Furious Grip (pet-swap/weapon-swap triggers, no skill id to mirror onto); Fortifying Bond/
      Fresh Reinforcement (share/gain your PET's current dynamic boons, not a fixed grant); Verdant
      Etching (2016) — each Ranger Glyph has 3 separate skill ids for different form states, not
      confidently distinguishable this session. See `docs/game-data.md`'s synthetic-facts.json
      section (case 3) for the full writeup.
- [ ] Revenant, Thief, Warrior legs (3 remaining). Revenant's own 5 candidates from the ORIGINAL
      48-count scan are worth a second look even though Notoriety/Rapid Flow were already done —
      every leg so far (Elementalist 5→41, Engineer 4→40, Guardian ~5→34, Mesmer 6→52, Ranger
      5→27) has badly undercounted that original scan, so treat its "expected count" as a floor,
      not a ceiling; rescan fresh.

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
that before extending either further, and before the tooltip visual-pass item below.

- [ ] Mesmer's Tale of the Second Scion (id 76695) also grants "Scion's Reprieve," a self-buff
      (+15% WvW/PvP Heal Effectiveness) that nothing in the app accounts for — not a Healing fact
      itself, it modifies *other* incoming/outgoing heals. App has no general outgoing/incoming
      heal-modifier concept yet (distinct from the boon/condition uptime system); needs scoping, not
      a one-off patch for this skill.

- [ ] Dedicated visual pass over every tooltip type — icon-next-to-title and rarity-colored name
      header now landed (Session 141, visually confirmed live) for traits, skills, gear stat
      prefixes, runes, sigils, relics, and infusions, via `TooltipBody`'s new `icon`/`rarity` props
      in `Tooltip.tsx` + `.tooltip-header`/`.tooltip-icon`/`.tooltip-title.rarity-*` in
      `global.css`. Divider, tidy-list stat lines, and muted-vs-bright text were already in place
      from earlier work. Still open: **food/utility** — no icon-header work needed (already
      inherited via the shared `UpgradePicker`), but their real GW2 rarity varies per item (unlike
      every other category's single fixed tier), so they still render title-only, no rarity color.
      Needs each food/utility item's actual rarity plumbed from game data into `UpgradePicker`'s
      per-option tooltip (not just its single fixed `rarity` prop) before extending
      `.tooltip-title.rarity-*` to them.

- [ ] 76 Food catalog entries still have no buff data after `borrowSharedContainerBonuses` +
      `applyAscendedFeastFormula` (`fetch-gear-upgrades.ts`) — genuinely buff-less items that don't
      belong being offered as a "Food" pick at all: Mastery-point currency ("Elixir/Draught of X
      Mastery"), crafting materials ("Gift of Quartz"/"Pile of Golden Sand"), and achievement/
      collection rewards ("Threat Report: ..."). These came back in the picker when the (wrong)
      blanket exclusion was reverted 2026-08-06; whether to filter them back out by a narrower,
      verified rule (not the blanket `effectName === null` check that wrongly caught Feasts too) is
      an open question, not decided either way yet.

## Stats panel / boon-condition bar polish

- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Nice-to-haves

- [ ] Equipment editor: a "clear all" button per row (weapons, sigils, armor, runes, accessories,
      infusions, relic, food, utility) — flagged by the user 2026-08-11, not scoped yet (which rows
      count as one "row" vs. several, e.g. armor is 6 slots/trinkets are 6 slots — needs a UI pass to
      decide grouping before implementing).

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
