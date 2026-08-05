import type { Fact, Skill } from '../types'

/**
 * A single wiki-verified `AttributeAdjust` Barrier fact: `Barrier = baseValue + coefficient *
 * HealingPower`, quoted from the skill's own wiki `{{skill fact|barrier|...|coefficient=...}}`
 * template — same shape and same rigor bar as `CURATED_HEALING_COEFFICIENTS` (see
 * `healing-calc.ts`'s own doc comment, which this mirrors exactly). Barrier is a *different resource
 * bar* than Health, so it gets its own curated table and its own tooltip line rather than being
 * folded into the Healing one — but the GW2 API mislabels every Barrier `AttributeAdjust` fact's
 * `target` as `'Healing'` too (confirmed across all 58 raw candidates found scanning
 * `data/game-data/skills.json` for a Barrier-text `AttributeAdjust` fact — every single one carries
 * `target: 'Healing'`, none `target: 'Barrier'`), which is exactly why this table was scoped
 * separately from Healing in the first place (see TODO.md/COMPLETED.md, decided 2026-08-04): several
 * skills excluded from `CURATED_HEALING_COEFFICIENTS` for "being Barrier, not Healing" are the seed
 * set here.
 *
 * `factText` matches a fact's `text` field the same way `HealingCoefficient.factText` does — by
 * presence only, not by cross-checking `fact.value` — since several of these skills split their
 * Healing Power coefficient (and/or base value) by game mode, and WvW doesn't consistently group
 * with either PvE or PvP (checked per-skill via raw wikitext, never assumed): most often WvW groups
 * with PvP, but several entries below group WvW with PvE instead, and a few have WvW as a genuinely
 * standalone third value equal to neither (Bulwark Gyro, Essence of Animated Sand, Effulgent Stance,
 * Sand Flare/Cascade, Sandstorm Shroud) — each documented inline.
 */
export interface BarrierCoefficient {
  factText: string
  baseValue: number
  coefficient: number
  /**
   * Set only when the wiki-documented value corresponds to a `requires_trait`-gated fact rather than
   * the skill's ungated one — needed because a skill can carry two facts sharing the exact same
   * `factText` (an ungated base value and a trait-boosted override of the same quantity), and without
   * this, `barrierLinesForSkill`'s fact lookup always resolves to whichever sorts first in
   * `[...skill.facts, ...skill.traitedFacts]` (always the ungated one) regardless of which value the
   * curated entry actually means. See Elementalist's Lava Skin below for the motivating case.
   */
  requiresTrait?: number
}

/**
 * Seeded 2026-08-05 as a full category sweep across every profession in one pass (not build-by-build
 * — same theorycrafting-first reasoning as the Healing/Damage sweeps), rather than legged by category
 * the way Healing/Damage were, since Barrier's total candidate surface (58, across every skill slot:
 * Heal/Utility/Elite/Weapon/profession-mechanic/Toolbelt) is a single bounded pass, not a multi-leg
 * sweep. Researched by 8 parallel profession-scoped agents (2 completed: Engineer, Thief) plus direct
 * wikitext curation for the rest after the other 6 agents were cut short by a session limit — same
 * "orchestrating session does all file writes" methodology as every prior sweep, raw wikitext only,
 * never a paraphrased fetch.
 *
 * Of the 58 raw candidates: 48 distinct skill ids landed here, 4 were excluded as trait-only procs
 * with no independently-equippable base skill (Necromancer's Sandstorm Shroud is NOT one of these —
 * it's a real Harbinger Shroud-5 replacement; the 4 genuine trait-proc exclusions are Revenant's
 * Saint's Shield (Vindicator's "Saint of zu Heltzer" trait), Engineer's Lesser Utility Goggles
 * (Mechanist's "Reactive Lenses" trait), Elementalist's Lesser Stone Resonance (Weaver's "Bolstered
 * Elements" trait), and Revenant's Call of the Dwarf (Legendary Dwarf Stance's "Song of the Mists"
 * trait) — none of these are ever independently bound to a skill slot, so none belong in a per-skill
 * table gated by `skill.id`), 3 were stale/non-canonical duplicate ids excluded in favor of their
 * sibling (Warrior's Banner of Defense `14528`, Revenant's Release Potential: Warrior `78895`, and
 * Thief's Dawn's Repose `63227` — see each profession's block comment below for the wiki `id=`
 * cross-check), and 2 were left uncurated (Engineer's Utility Goggles `29591` — a fresh live
 * `/v2/skills/29591` pull 2026-08-05 confirmed this app's cached data is current, not stale, so the
 * real finding is a genuine API/wiki mismatch: the wiki's infobox, mechanics section, and full
 * version history never mention a Barrier effect on this skill at all despite the API carrying a real
 * `Barrier` fact (2122) on `29591` only, not its sibling `5865` — treated as an orphaned API artifact
 * with no current basis, same "leave uncurated" call as Revenant's Energy Expulsion in
 * `CURATED_HEALING_COEFFICIENTS`; Engineer's Hard Light Arena `44646` — wiki gives a base value with
 * no `coefficient=` param, scaling undocumented). Elementalist's Lava Skin originally had 1 of its 2
 * Barrier facts left unrepresented for the trait-duplicated-text reason also documented in
 * `CURATED_HEALING_COEFFICIENTS` (Signet of Courage, Signet of Malice, etc.) — **fixed 2026-08-05** by
 * adding `BarrierCoefficient.requiresTrait` (see its own doc comment) and curating the trait-gated
 * fact directly; see that skill's own comment below.
 *
 * One new architecture gap surfaced this sweep, not seen in the Healing/Damage sweeps: Elementalist's
 * Glyph of Elemental Power (id `34714`, the Earth-attunement-tagged variant carrying the only local
 * Barrier fact, value 2100) is never independently equippable — same "attunement-tagged id, not a
 * real pick" shape `skill-variants.ts`'s own doc comment describes for its signal 1 — and unlike
 * `CURATED_HEALING_COEFFICIENTS`'s Glyph of Elemental Harmony entry (whose attunement-agnostic base
 * id `5569` carries its own identical Healing fact directly, so curating it works), this skill's own
 * attunement-agnostic base id `5506` (the one actually equipped and rendered) carries ZERO facts at
 * all — curating `34714` would define an entry this app's tooltip code can never reach. Left
 * uncurated, same bucket as Chaotic Release/Tailored Victory/Photon Wall/Evoker's Meditations.
 */
export const CURATED_BARRIER_COEFFICIENTS: Record<number, BarrierCoefficient[]> = {
  // --- Elementalist ---
  // Armor of Earth. PvE/WvW+PvP base-value split (PvE 655 vs WvW+PvP 444, same 0.1 coefficient) — WvW
  // value used. Local fact text is "Barrier per Boon" (app's own API label), the wiki's plain
  // untitled `{{skill fact|barrier|...}}` template just supplies the numbers.
  5639: [{ factText: 'Barrier per Boon', baseValue: 444, coefficient: 0.1 }],
  // Rock Barrier (Focus 4). No PvE/WvW split.
  5695: [{ factText: 'Barrier', baseValue: 1753, coefficient: 0.4 }],
  // Stone Resonance (Weaver Utility). PvE+WvW grouped (1069/0.15) vs PvP-only (789/0.15, raised from
  // 535 by the 2026-07-15 patch) — WvW value used. Not to be confused with the same-named "Lesser
  // Stone Resonance" (id 42913), a Bolstered Elements trait proc — excluded, see this table's own
  // top comment.
  44926: [{ factText: 'Barrier', baseValue: 1069, coefficient: 0.15 }],
  // Molten Burst (Weaver dagger/trident). Wiki's own skill-fact template (1418/0.33) is flagged
  // incorrect in the page's own Notes section: "The barrier skill fact is incorrect, the applied
  // barrier is: {{skill fact|barrier|2123|coefficient=0.3795}}" — the corrected value used instead,
  // no game-mode split on either the template or its correction.
  46185: [{ factText: 'Barrier', baseValue: 2123, coefficient: 0.3795 }],
  // Lava Skin (Weaver sword). "Barrier per Pulse" splits PvE (379/0.1) vs PvP+WvW (227/0.115,
  // coefficient itself differs, not just base) — WvW value used. "Initial Barrier" has two same-text
  // facts locally (an untraited 650 and a requires_trait-gated 1018, `traitedFacts`' own `overrides`
  // index confirms 2077/"Elemental Refreshment" replaces the same quantity, not an additive bonus) but
  // the wiki documents only the TRAITED value (1018/0.2), no untraited number anywhere on the page —
  // curated via `requiresTrait` (see `BarrierCoefficient`'s doc comment) so this line only shows once
  // Elemental Refreshment is actually chosen, rather than binding 1018 to every player regardless.
  46447: [
    { factText: 'Barrier per Pulse', baseValue: 227, coefficient: 0.115 },
    { factText: 'Initial Barrier', baseValue: 1018, coefficient: 0.2, requiresTrait: 2077 }
  ],
  // Fortified Earth (Catalyst Utility). PvE/WvW+PvP base-value split (PvE 3000 vs WvW+PvP 1254, same
  // 0.1 coefficient) — WvW value used.
  62826: [{ factText: 'Barrier', baseValue: 1254, coefficient: 0.1 }],
  // Immutable Stone (Catalyst hammer). No PvE/WvW split.
  62992: [{ factText: 'Barrier', baseValue: 2919, coefficient: 0.5 }],
  // Harden (spear). PvE 3009/0.5 vs WvW+PvP 2010/0.5 (page's own `split = pve, wvw pvp` header, only
  // 2 fact lines given — wvw doubles as the pvp value) — WvW value used.
  73019: [{ factText: 'Barrier', baseValue: 2010, coefficient: 0.5 }],
  // Magnetic Shield (Conjure Earth Shield bundle skill 4). PvE+WvW grouped (778/0.18) vs PvP-only
  // (506/0.18) — WvW value used. Wiki page is a disambiguation between this (the elementalist
  // conjure-bundle skill) and an unrelated Engineer shield skill (id 6053, not in this app's local
  // Barrier candidate set) — confirmed this app's own id 5747 matches the elementalist version's
  // infobox (`id = 5747`).
  5747: [{ factText: 'Barrier', baseValue: 778, coefficient: 0.18 }],
  // Stone Sheath (Conjure Earth Shield bundle skill 2). Same split/value as Magnetic Shield above —
  // both are Conjure Earth Shield's own skills sharing one formula.
  21647: [{ factText: 'Barrier', baseValue: 778, coefficient: 0.18 }],

  // --- Engineer ---
  // Shock Shield (Holosmith Focus 4). No PvE/WvW split.
  29840: [{ factText: 'Barrier per Hit', baseValue: 213, coefficient: 0.06 }],
  // Bulwark Gyro (Scrapper Utility). Both facts have WvW as a genuinely standalone third value (not
  // grouped with either PvE or PvP): Initial Barrier PvE+PvP 1620/0.8 vs WvW 740/0.5; Pulse Barrier
  // PvE+PvP 810/0.4 vs WvW 410/0.1 — WvW values used for both (confirmed via a 2025-02-11 WvW-only
  // balance patch). This app's own local API base values (1620/810) are the PvE+PvP figures, not
  // WvW-correct.
  30101: [
    { factText: 'Initial Barrier', baseValue: 740, coefficient: 0.5 },
    { factText: 'Pulse Barrier', baseValue: 410, coefficient: 0.1 }
  ],
  // Energizing Slam (Amalgam Hammer). PvE 648/0.8 vs WvW+PvP 516/0.5 (confirmed via a 2024-10-08
  // patch note) — WvW value used. Local API base value (648) is the PvE figure.
  63169: [{ factText: 'Barrier', baseValue: 516, coefficient: 0.5 }],
  // Essence of Animated Sand (spear). WvW is a standalone third value again (PvE 1285/1.0, WvW
  // 645/0.5, PvP 805/1.0, confirmed via two separate single-mode patches) — WvW value used. Local API
  // base value (1285) is the PvE figure.
  72052: [{ factText: 'Barrier', baseValue: 645, coefficient: 0.5 }],
  // Symbiotic Shielding (Mechanist's Overclock Signet toolbelt skill). No PvE/WvW split.
  76613: [{ factText: 'Barrier', baseValue: 2250, coefficient: 0.5 }],
  // Barrier Signet (Mechanist). No PvE/WvW split.
  63262: [{ factText: 'Barrier per Pulse', baseValue: 326, coefficient: 0.4 }],
  // Barrier Burst (Mechanist F3 mech-command skill, trait-gated behind "Mech Core: Barrier Engine" —
  // replaces the mech's default F3 command when that trait is chosen, same "trait-swapped mechanic
  // slot skill" shape as Necromancer's Desert Shroud/Sandstorm Shroud below). PvE 454/0.575 vs
  // WvW+PvP 260/0.2875 — WvW value used.
  63141: [{ factText: 'Barrier per Pulse', baseValue: 260, coefficient: 0.2875 }],

  // --- Guardian ---
  // Zealot's Embrace (hammer). No PvE/WvW split on either fact.
  9260: [
    { factText: 'First Hit Barrier', baseValue: 1513, coefficient: 0.2 },
    { factText: 'Additional Hit Barrier', baseValue: 625, coefficient: 0.05 }
  ],
  // Effulgent Stance (Luminary Utility). WvW is a standalone third value, unusually with a HIGHER
  // base but LOWER coefficient than PvE (PvE 2245/1.0, WvW 3973/0.2, PvP 2053/0.2) — WvW value used.
  76813: [{ factText: 'Barrier', baseValue: 3973, coefficient: 0.2 }],

  // --- Mesmer ---
  // Singularity Shot (rifle). PvE 2346/1.6 vs WvW+PvP 2346/1.35 (base unchanged, coefficient splits)
  // — WvW value used.
  72008: [{ factText: 'Barrier', baseValue: 2346, coefficient: 1.35 }],
  // Crescendo (Troubadour F5 mechanic skill). No PvE/WvW split.
  76931: [{ factText: 'Barrier', baseValue: 2565, coefficient: 1.35 }],

  // --- Necromancer (all Scourge, specializationId 60) ---
  // Serpent Siphon (Utility). No PvE/WvW split.
  41615: [{ factText: 'Barrier', baseValue: 1295, coefficient: 1.0 }],
  // Sand Swell (Utility). No PvE/WvW split.
  42917: [{ factText: 'Barrier', baseValue: 1618, coefficient: 0.75 }],
  // Sand Flare (Heal slot). Both Barrier facts have WvW as a standalone third value (Self Barrier
  // PvE 2420/2.0, WvW 2420/1.5, PvP 2420/0.9; Ally Barrier PvE 1220/2.0, WvW 1220/1.5, PvP 1220/0.9 —
  // same base across all 3 modes, only the coefficient splits) — WvW coefficients used for both. This
  // skill's separate "Self Heal" fact is already curated in `CURATED_HEALING_COEFFICIENTS` (3230/0.75)
  // — these are the Barrier-side facts deliberately excluded from that table.
  43148: [
    { factText: 'Self Barrier', baseValue: 2420, coefficient: 1.5 },
    { factText: 'Ally Barrier', baseValue: 1220, coefficient: 1.5 }
  ],
  // Sand Cascade (F3 Shade skill). WvW standalone third value (PvE 1188/2.0, WvW 1188/1.0, PvP
  // 932/1.5 — WvW shares PvE's base but not its coefficient) — WvW value used.
  43448: [{ factText: 'Barrier', baseValue: 1188, coefficient: 1.0 }],
  // Desert Shroud (F5 Shroud skill). PvE+WvW grouped (2188/1.25) vs PvP-only (2028/1.25) — WvW value
  // used. Local data carries a second same-text "Barrier" fact gated by requires_trait at a much
  // SMALLER value (323) the wiki doesn't document at all — only the untraited baseline is curated,
  // same convention as every other trait-duplicated-fact case in this app.
  44663: [{ factText: 'Barrier', baseValue: 2188, coefficient: 1.25 }],
  // Sandstorm Shroud (Harbinger's F5 Shroud-5 replacement, trait-gated behind "Herald of Sorrow" —
  // same trait-swapped-mechanic-slot shape as Engineer's Barrier Burst above). Both facts have WvW as
  // a standalone third value (Barrier per Pulse: PvE 325/0.3, WvW 543/0.35, PvP 543/0.32 — WvW shares
  // PvP's base but not its coefficient; Barrier on Detonation: PvE 650/0.6, WvW 1079/0.7, PvP
  // 1079/0.64) — WvW values used for both.
  54870: [
    { factText: 'Barrier per Pulse', baseValue: 543, coefficient: 0.35 },
    { factText: 'Barrier on Detonation', baseValue: 1079, coefficient: 0.7 }
  ],

  // --- Ranger ---
  // "Protect Me!" (Utility). PvE+WvW grouped (3973/0.24) vs PvP-only (3377/0.24) — WvW value used.
  12631: [{ factText: 'Barrier', baseValue: 3973, coefficient: 0.24 }],
  // Glyph of Burgeoning (Druid, Celestial Avatar-form cast; id 31888, the non-Celestial-Avatar-form
  // cast, grants Healing instead and is already curated in `CURATED_HEALING_COEFFICIENTS`). No
  // PvE/WvW split.
  31740: [{ factText: 'Barrier', baseValue: 2585, coefficient: 1.25 }],
  // Overbearing Smash (Untamed hammer). 2 ids (63075 specializationId 72/Untamed, 69262
  // specializationId null) — wiki infobox lists both as canonical (`id = 63075, 69262`), same
  // "reworked-by-a-later-elite-spec, both real, both curate identically" shape as this app's existing
  // Jade Winds/Legendary Demon Stance entries. No PvE/WvW split.
  63075: [{ factText: 'Barrier', baseValue: 2017, coefficient: 0.2 }],
  69262: [{ factText: 'Barrier', baseValue: 2017, coefficient: 0.2 }],
  // Wild Swing (Untamed hammer). Same 2-id shape as Overbearing Smash above (`id = 63366, 69167` per
  // the wiki infobox). No PvE/WvW split on either fact.
  63366: [
    { factText: 'First Hit Barrier', baseValue: 1194, coefficient: 0.2 },
    { factText: 'Additional Hit Barrier', baseValue: 198, coefficient: 0.05 }
  ],
  69167: [
    { factText: 'First Hit Barrier', baseValue: 1194, coefficient: 0.2 },
    { factText: 'Additional Hit Barrier', baseValue: 198, coefficient: 0.05 }
  ],
  // Thistleguard (offhand mace). Both facts split PvE vs WvW+PvP by base value (Barrier: PvE
  // 3210/0.8, WvW+PvP 1610/0.8; Barrier on hit: PvE 1610/0.4, WvW+PvP 1410/0.4) — WvW values used.
  71903: [
    { factText: 'Barrier', baseValue: 1610, coefficient: 0.8 },
    { factText: 'Barrier on hit', baseValue: 1410, coefficient: 0.4 }
  ],

  // --- Revenant ---
  // Blossoming Aura (scepter). PvE+WvW grouped (504/0.3) vs PvP-only (504/0.4) — WvW value used. Wiki
  // page carries its own `{{stub|skill|check PvP/WvW values, check barrier scaling}}` maintenance
  // tag, but the base value (504) matches this app's own independently-sourced API value exactly —
  // trusted despite the stub tag, same call already made for Guardian's Resolute Stance in
  // `CURATED_HEALING_COEFFICIENTS`.
  71816: [{ factText: 'Barrier', baseValue: 504, coefficient: 0.3 }],
  // Otherworldly Attraction (scepter, the "(ally)" flip-target half of Otherworldly Bond — the wiki
  // disambiguates "(ally)" from an unrelated "(enemy)" pull-effect page sharing the same base name;
  // this app's id 71827 matches the "(ally)" infobox exactly). No PvE/WvW split.
  71827: [{ factText: 'Barrier', baseValue: 1615, coefficient: 1.0 }],
  // Motivating Whirl (scepter chain finisher). PvE 251/0.3 vs WvW+PvP 251/0.15 (base unchanged,
  // coefficient splits) — WvW value used.
  71942: [{ factText: 'Barrier', baseValue: 251, coefficient: 0.15 }],
  // Release Potential: Warrior (Conduit F2 mechanic skill). 2 ids share this name (77896
  // specializationId 79/no GroundTargeted flag, 78895 same spec/GroundTargeted flag) — wiki infobox
  // documents only 77896 as canonical (`id = 77896`); 78895 excluded as the stale/non-canonical
  // ground-targeted duplicate. PvE 1615/0.2 vs WvW+PvP 975/0.2 — WvW value used. A separate "Barrier
  // increase per Affinity" fact (a flat +15%-per-stack passive bonus, not Healing-Power-scaled) isn't
  // modeled here, same reasoning as Elementalist's Arcane Brilliance leaving its non-scaling "Combo
  // Healing" bonus out of `CURATED_HEALING_COEFFICIENTS`.
  77896: [{ factText: 'Barrier', baseValue: 975, coefficient: 0.2 }],

  // --- Thief ---
  // Enter Shadow Shroud (Specter F2 mechanic skill). No PvE/WvW split, despite the page's own
  // `split = pve, wvw pvp` infobox declaration (that only applies to two other, non-Barrier facts on
  // this skill).
  63155: [{ factText: 'Barrier', baseValue: 1428, coefficient: 0.5 }],
  // Dawn's Repose (Specter Shadow Shroud weapon skill 3). 2 ids share this name — 63220
  // (GroundTargeted) is wiki-canonical (`id = 63220` in the infobox); 63227 (auto-target, no
  // GroundTargeted flag) is excluded as a non-canonical/legacy duplicate not documented by the wiki
  // at all (its own local facts carry a same-text "Minimum Barrier" collision at two different values
  // with no "Maximum Barrier" fact, a data-quality tell consistent with it being stale) — the wiki
  // page separately documents an "(underwater)" sibling page this app doesn't model as its own pick
  // (only the weapon bar's own Environment toggle covers that, per `skill-variants.ts`'s doc comment
  // signal 7). No PvE/WvW split on either fact.
  63220: [
    { factText: 'Minimum Barrier', baseValue: 1605, coefficient: 0.5 },
    { factText: 'Maximum Barrier', baseValue: 6405, coefficient: 0.5 }
  ],
  // Shadow Sap (Specter dagger). Genuine 3-way split with WvW as its own standalone value, not
  // grouped with either PvE or PvP (PvE 1420/0.5, PvP 812/0.25, WvW 652/0.25 — confirmed via a
  // WvW-only balance patch note) — WvW value used. Local API base value (1420) is the PvE figure.
  63351: [{ factText: 'Barrier', baseValue: 652, coefficient: 0.25 }],
  // Chak Shield (main-hand skill 1). PvE+WvW grouped (394/0.06) vs PvP-only (196/0.06) — WvW value
  // used, matches this app's own local API base value directly.
  76816: [{ factText: 'Barrier', baseValue: 394, coefficient: 0.06 }],

  // --- Warrior ---
  // Call of Valor (warhorn). Genuine 3-way split, all sharing the same base value but a distinct
  // coefficient per mode (PvE 1.0, WvW 1.2, PvP 1.5) — WvW value used.
  14394: [{ factText: 'Barrier', baseValue: 2580, coefficient: 1.2 }],
  // Pommel Bash (mace). No PvE/WvW split.
  14503: [{ factText: 'Barrier', baseValue: 1359, coefficient: 0.2 }],
  // Banner of Defense (Utility). 2 ids share this name — 14528 (GroundTargeted) is wiki-canonical
  // (`id = 14528` in the infobox), but `skill-variants.ts`'s own coded rule collapses "every Warrior
  // Banner" to the non-ground-targeted id (14570) as the one this app's picker actually surfaces —
  // curated under 14570 to match what the real UI resolves to, not the wiki's headline id (same
  // divergence already documented for the other Banners in `CURATED_HEALING_COEFFICIENTS`). Both ids
  // carry byte-identical values either way, so this only matters for which id the tooltip lookup can
  // actually reach. No PvE/WvW split.
  14570: [{ factText: 'Barrier', baseValue: 3412, coefficient: 1.0 }],
  // Imminent Threat (Spellbreaker Utility). No PvE/WvW split on either fact.
  41919: [
    { factText: 'First Hit Barrier', baseValue: 2261, coefficient: 0.2 },
    { factText: 'Additional Hit Barrier', baseValue: 625, coefficient: 0.05 }
  ],
  // "We Will Never Yield!" (Paragon Elite). No PvE/WvW split on either fact, despite the page's own
  // `split = pve, wvw pvp` header (only the separate Superspeed fact actually splits).
  76562: [
    { factText: 'Minimum Barrier', baseValue: 1940, coefficient: 0.7 },
    { factText: 'Maximum Barrier', baseValue: 3880, coefficient: 1.4 }
  ],
  // "Brace Yourselves!" (Paragon Utility). Both facts split PvE vs WvW+PvP by base value (Barrier: PvE
  // 1945/0.7, WvW+PvP 1305/0.5; Echo Barrier: PvE 980/0.6, WvW+PvP 660/0.3) — WvW values used.
  76934: [
    { factText: 'Barrier', baseValue: 1305, coefficient: 0.5 },
    { factText: 'Echo Barrier', baseValue: 660, coefficient: 0.3 }
  ]
}

export interface BarrierLine {
  label: string
  value: number
}

/**
 * Real, current-build-scaled Barrier lines for one skill — `Barrier = baseValue + coefficient *
 * healingPower` per curated entry, gated the same `requires_trait` way as `healingLinesForSkill`/
 * `numericFactLines`. Returns `[]` for any skill with no curated entry rather than falling back to an
 * unscaled/wrong number. Matched against `AttributeAdjust`/`target: 'Healing'` facts, same as
 * `healingLinesForSkill` — the GW2 API mislabels Barrier's `target` as `'Healing'` too, see this
 * file's own top comment — `factText` is what actually distinguishes a Barrier line from a real
 * Healing line for the same skill, not `target`.
 */
export function barrierLinesForSkill(skill: Skill, healingPower: number, activeIds: ReadonlySet<number>): BarrierLine[] {
  const entries = CURATED_BARRIER_COEFFICIENTS[skill.id]
  if (!entries) return []

  const allFacts: Fact[] = [...skill.facts, ...skill.traitedFacts]
  const lines: BarrierLine[] = []
  for (const entry of entries) {
    const fact = allFacts.find(
      (f) =>
        f.type === 'AttributeAdjust' &&
        f.target === 'Healing' &&
        f.text === entry.factText &&
        (f.requires_trait ?? null) === (entry.requiresTrait ?? null)
    )
    if (!fact) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    lines.push({ label: entry.factText, value: Math.round(entry.baseValue + entry.coefficient * healingPower) })
  }
  return lines
}
