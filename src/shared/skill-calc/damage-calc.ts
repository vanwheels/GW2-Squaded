import type { Fact, Skill } from '../types'

/**
 * Wiki-quoted weapon-strength constants at level 80 — the midpoint of each weapon type's min-max
 * range from the wiki's own Weapon Strength page (same "take the midpoint" convention gw2skills.net-
 * style calculators use). Combined with a skill's own coefficient (see `CURATED_DAMAGE_COEFFICIENTS`)
 * this reproduces GW2's own damage formula: `Damage = weaponStrength * coefficient * Power /
 * target's Armor`. Verified against a real documented example: Judge's Intervention (weapon
 * `unequipped`, PvE coefficient 0.5) at the wiki's own reference Power 1000 / Armor 2597 computes to
 * 690.5 * 0.5 * 1000 / 2597 ≈ 133 — the wiki's own quoted PvE tooltip damage for that skill,
 * confirming both this table and the formula rather than assuming.
 * Keys match the lowercased `weapon=` parameter this app's curation quotes from each skill's own
 * `{{skill fact|damage|...}}` wikitext.
 */
export const WEAPON_STRENGTH_MIDPOINTS: Record<string, number> = {
  axe: 1000,
  dagger: 1000,
  mace: 1000,
  pistol: 1000,
  scepter: 1000,
  sword: 1000,
  focus: 900,
  shield: 900,
  torch: 900,
  warhorn: 900,
  greatsword: 1100,
  hammer: 1100,
  longbow: 1050,
  rifle: 1150,
  shortbow: 1000,
  staff: 1100,
  aquatic: 1000,
  // Non-weapon-skill damage (utility/trait procs) — the wiki's `weapon=trait skill` template param.
  unequipped: 690.5
}

/**
 * A single wiki-verified `Damage` fact's coefficient, WvW-verified (NOT the API's own
 * `dmg_multiplier`, which only ever reflects the PvE value — confirmed via 9 skills this session,
 * several with a materially different WvW/PvP number, e.g. Illusionary Wave PvE 0.3 vs WvW/PvP
 * 0.01). `coefficient` is always the TOTAL across the fact's `hit_count`, matching how the wiki's own
 * template presents it: skills with an explicit `strikes=N` parameter already give a totaled
 * coefficient (confirmed: Whirling Axe `strikes=15|coefficient=8.388` PvE / 15 = 0.5592/hit, exactly
 * matching the API's own PvE `dmg_multiplier`); skills without `strikes=` but with `hit_count > 1`
 * (a pulsing effect, e.g. Symbol of Blades' 5 pulses) give a PER-HIT coefficient instead, so those
 * entries below are pre-multiplied by `hit_count` rather than storing the wiki's raw per-pulse number
 * — see each entry's comment for which case it is.
 */
export interface DamageCoefficient {
  factText: string
  coefficient: number
  weapon: keyof typeof WEAPON_STRENGTH_MIDPOINTS
}

/**
 * Seeded 2026-08-02 with one common WvW weapon skill per base profession; extended 2026-08-04 to a
 * full category sweep, same policy as `CURATED_HEALING_COEFFICIENTS` (see `healing-calc.ts` and
 * TODO.md) — Heal-slot skills swept first (smallest category, only 7 candidates), then Elite,
 * Utility, Weapon last (largest — 919 candidates). Only skills confirmed to be the
 * *actually-equippable* skill id (cross-checked against `professions.json`'s own weapon-skill lists,
 * not just matched by name — several skill names have multiple near-duplicate ids in skills.json,
 * e.g. Ranger's "Maul" has 6) are curated here.
 */
export const CURATED_DAMAGE_COEFFICIENTS: Record<number, DamageCoefficient[]> = {
  // --- one-per-profession seed (2026-08-02) ---
  // Warrior — Axe 5, Whirling Axe. `strikes=15` present -> wiki coefficient already totaled.
  14399: [{ factText: 'Damage', coefficient: 4.47, weapon: 'axe' }],
  // Guardian — Sword 2, Symbol of Blades. No `strikes=` param despite 5 pulses -> wiki's 0.45 is
  // per-pulse; totaled here as 0.45 * 5.
  9097: [{ factText: 'Damage', coefficient: 2.25, weapon: 'sword' }],
  // Revenant — Hammer 2, Coalescence of Ruin. Single hit, no split needed.
  28253: [{ factText: 'Damage', coefficient: 0.91, weapon: 'hammer' }],
  // Ranger — Greatsword 5, Maul. Single hit (the API lists 2 identical `Damage` facts for this id;
  // both share the same value so matching the first is equivalent).
  12525: [{ factText: 'Damage', coefficient: 1.5, weapon: 'greatsword' }],
  // Thief — Dagger 4, Dancing Dagger. Single hit, WvW and PvP share one wiki entry.
  13019: [{ factText: 'Damage', coefficient: 0.45, weapon: 'dagger' }],
  // Engineer — Rifle 2, Blunderbuss. Max Damage shares a combined "pvp wvw" wiki entry; Min Damage
  // has a WvW-specific split from PvP (0.87 WvW vs 1.1 PvP) - the WvW value is used.
  6153: [
    { factText: 'Maximum Damage', coefficient: 1.31, weapon: 'rifle' },
    { factText: 'Minimum Damage', coefficient: 0.87, weapon: 'rifle' }
  ],
  // Necromancer — Axe 2, Ghastly Claws. `strikes=8` present -> wiki coefficient already totaled.
  10528: [{ factText: 'Damage', coefficient: 2.664, weapon: 'axe' }],
  // Elementalist — Dagger 5 (Fire), Fire Grab. Single hit; "vs. Burning" is a separate always-listed
  // fact (not gated behind a real Burning-detection this app can evaluate), shown as its own line.
  5557: [
    { factText: 'Damage', coefficient: 1.0, weapon: 'dagger' },
    { factText: 'Damage vs. Burning', coefficient: 2.0, weapon: 'dagger' }
  ],
  // Mesmer — Greatsword 5, Illusionary Wave. Single hit; heavily reduced in WvW/PvP vs. its PvE 0.3
  // (this skill is primarily a CC/combo-finisher pick, not a damage skill, in competitive modes).
  10220: [{ factText: 'Damage', coefficient: 0.01, weapon: 'greatsword' }],

  // --- Heal-slot skills (category sweep 2026-08-04, see TODO.md/COMPLETED.md) ---
  // Of 7 equippable Heal-slot skills with a `Damage` fact (full `skills.json` scan), 2 are excluded:
  // Engineer's Detonate Healing Turret (id 5961, wiki `{{skill fact|damage|weapon=utility|power=2389|
  // coefficient=2.0}}` — the `power=` override plus the wiki's own note "damage...does not scale with
  // player stats" mean this is the turret's own fixed damage, not Power-scaled) and Necromancer's
  // Summon Blood Fiend (id 10547, wiki: "damage and healing scale with the power...of the Blood
  // Fiend. However, it has 0 healing power and cannot be increased" — the pet's own fixed stats, not
  // the player's, same exclusion already applied to this skill's Healing fact, see TODO.md). Per the
  // wiki's own Weapon Strength page: "Slot skills, which consist of healing skills, utility skills,
  // and elite skills...all use unequipped weapon strength" regardless of what each skill's own wiki
  // template `weapon=` param literally says (several below say `weapon=utility`, which per that page
  // isn't itself a weapon-strength category) — so every entry here uses `unequipped`. None of these 5
  // skills' Damage facts have a PvE/WvW coefficient split (unlike some of their Healing facts).
  // Elementalist — Arcane Brilliance. `type=Critical Damage` on the wiki template, but the API's own
  // fact text is plain "Damage" — matched on that.
  21656: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Guardian/Dragonhunter — Purification (trap heal). No split.
  30025: [{ factText: 'Damage', coefficient: 0.1875, weapon: 'unequipped' }],
  // Necromancer/Reaper — "Your Soul Is Mine!". No split (separate "damage increase" melee-range fact,
  // PvE 100%/WvW+PvP 50%, isn't a weapon-strength-scaled Damage fact and isn't modeled here).
  30488: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Mesmer/Virtuoso — Twin Blade Restoration. `strikes=2` present -> wiki's 0.7 already totaled
  // (API confirms: hit_count 2, dmg_multiplier 0.35/hit, 0.35 * 2 = 0.7).
  62522: [{ factText: 'Damage', coefficient: 0.7, weapon: 'unequipped' }],
  // Revenant/Vindicator — Selfish Spirit. Single value despite "Number of Casts: 4" (no `strikes=`
  // param, and the API's own hit_count is 1) — the 4 casts are 4 separate skill activations of the
  // channel, not 4 pulses of one cast, so no totaling needed.
  62719: [{ factText: 'Damage', coefficient: 0.222, weapon: 'unequipped' }],

  // --- Elite-slot skills (category sweep 2026-08-04, see TODO.md/COMPLETED.md; done
  // profession-by-profession per user request rather than all at once — 48 raw candidates, larger
  // than Healing's equivalent 12). COMPLETE: Warrior, Guardian, Revenant, Ranger, Thief, Engineer,
  // Necromancer, Elementalist, Mesmer.
  // Warrior — Battle Standard. 2 API ids share this name (14419/14569); the wiki infobox's own
  // `id =` field confirms 14419 is canonical (GroundTargeted, matches the live ground-target cast),
  // 14569 discarded as a stale duplicate. PvE/WvW+PvP coefficient split (4.0/1.5) — WvW value used.
  // The API duplicates the "Damage" fact text once per mode here; harmless since `damageLinesForSkill`
  // never reads a matched fact's own value, only checks a same-text match exists.
  14419: [{ factText: 'Damage', coefficient: 1.5, weapon: 'unequipped' }],
  // Warrior/Berserker — Head Butt. PvE/WvW+PvP split (4.5/0.01) — WvW value used (a steep nerf vs PvE,
  // consistent with this being a stun-into-burst combo piece competitive modes deliberately blunt).
  30343: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Warrior/Spellbreaker — Winds of Disenchantment. "pve wvw" grouped vs. a separate lower "pvp" value
  // (0.45/0.20) — WvW groups with PvE here, 0.45 used.
  45333: [{ factText: 'Damage', coefficient: 0.45, weapon: 'unequipped' }],
  // Guardian — Artillery Barrage. No PvE/WvW split (single wiki coefficient covers all modes).
  12343: [{ factText: 'Damage', coefficient: 1.5, weapon: 'unequipped' }],
  // Guardian/Dragonhunter — Dragon's Maw. 2 API ids share this name (30273/68686, both reporting the
  // PvE-only 3.6 multiplier); the wiki infobox's own `id =` field confirms 30273 is canonical, 68686
  // discarded as a stale duplicate. PvE/WvW+PvP split (3.6/0.01) — WvW value used.
  30273: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Guardian/Willbender — Heaven's Palm. PvE/WvW+PvP split (3.0/0.01) — WvW value used.
  62561: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Guardian/Luminary — Daring Advance. 2 API ids share this name (76687/77198); the wiki infobox's
  // own `id =` field lists both, but only 76687 carries the `GroundTargeted` flag matching the
  // infobox's own "ground target = circle" param and the live leap-to-area cast, so 77198 is treated
  // as a stale duplicate (same reasoning as Dragon's Maw/Battle Standard above). PvE/WvW+PvP split
  // (3.0/0.01) — WvW value used.
  76687: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Revenant — 5 raw candidates, 4 curated. NOT curated: Legendary Dragon Stance's "Facet of Chaos"
  // (id 27760, the actually-equipped elite-slot id per legends.json) carries zero Damage fact of its
  // own — the fact lives only on "Chaotic Release" (id 28075, PvE 4.0/WvW 0.01), reachable exclusively
  // via `flipSkill` (27760 -> 28075, the toggle's "consume" release). `skillFactLines`/`SkillsEditor`
  // never follow `flipSkill` for Damage-fact rendering (only `boon-calc/sources.ts` does, for its own
  // boon-aggregation purpose via `withFlipChain`), so curating 28075 here would be dead data no UI
  // path currently reaches — an architecture gap, not a data gap, same bucket as the Mesmer Troubadour
  // Heal-skill follow-up in TODO.md. Left uncurated pending that fix rather than added inert.
  // Revenant/Herald — Jade Winds. 2 API ids share this name (28406/31294); unlike other duplicate-id
  // cases above, the wiki infobox itself lists both together (`id = 28406,31294`) with no resolving
  // field, and this is a previously-documented unresolvable picker duplicate (see TODO.md's Skill
  // picker follow-ups) — both curated identically since one wiki page/formula covers both. 3-way
  // split (PvE 3.0/WvW 2.0/PvP 0.01, added 2025-02-11 when WvW was un-nerfed from parity with PvP) —
  // WvW value used. The API's own `dmg_multiplier` is stale on both ids (1.5, pre-2022-11-29 PvE
  // value) — expected, since it's PvE-only and doesn't track the coefficient used here anyway.
  28406: [{ factText: 'Damage', coefficient: 2.0, weapon: 'unequipped' }],
  31294: [{ factText: 'Damage', coefficient: 2.0, weapon: 'unequipped' }],
  // Revenant/Legendary Demon Stance — Embrace the Darkness. 2 API ids share this name (28287/78191);
  // the wiki infobox's own `id =` field confirms 28287 (matches legends.json's Legend4 `elite`),
  // 78191 discarded as a stale duplicate. No PvE/WvW/PvP split.
  28287: [{ factText: 'Damage', coefficient: 0.3, weapon: 'unequipped' }],
  // Revenant/Legendary Renegade Stance — Soulcleave's Summit. No split. Fact text is "Additional
  // Strike Damage", not the generic "Damage" label the other entries here match on.
  45773: [{ factText: 'Additional Strike Damage', coefficient: 0.8, weapon: 'unequipped' }],
  // Revenant/Vindicator — Spear of Archemorus. 3-way split (PvE 5.0/WvW 2.67/PvP 2.33) — WvW value
  // used.
  62942: [{ factText: 'Damage', coefficient: 2.67, weapon: 'unequipped' }],
  // Ranger — 4 raw candidate ids, 3 distinct skills curated (a 4th raw id, Artillery Barrage/12343,
  // is a cross-profession shared golem-summon skill already curated above under Guardian, so isn't a
  // new Ranger entry). Entangle — `strikes=4` present -> wiki's 0.8 already totaled; no PvE/WvW split
  // despite the page's own `split = pve, wvw pvp` (that split only affects recharge, not this fact).
  12580: [{ factText: 'Damage', coefficient: 0.8, weapon: 'unequipped' }],
  // Ranger/Soulbeast — One Wolf Pack. PvE/WvW+PvP split (0.95/0.5) — WvW value used.
  45717: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Ranger/Galeshot — Perfect Storm. 2 API ids share this name (76979/79309, both reporting identical
  // PvE-only dmg_multiplier values); only 76979 carries the `GroundTargeted` flag matching the wiki
  // infobox's own `ground target = circle` param, so 79309 is treated as a stale duplicate (same
  // reasoning as Dragon's Maw/Daring Advance above). Two independently-split Damage facts: Traveling
  // Tornado Damage (PvE 2.0/WvW+PvP 0.01) and Stationary Tornado Damage (`strikes=12`, already
  // totaled: PvE 8.4/WvW+PvP 6.0) — WvW values used for both.
  76979: [
    { factText: 'Traveling Tornado Damage', coefficient: 0.01, weapon: 'unequipped' },
    { factText: 'Stationary Tornado Damage', coefficient: 6.0, weapon: 'unequipped' }
  ],
  // Thief — 6 raw candidate ids, 5 distinct new skills curated (the 6th raw id, Artillery Barrage/
  // 12343, is the same cross-profession shared golem-summon skill already curated above under
  // Guardian, not a new Thief entry). No duplicate-name id collisions among the 5 (each resolves to
  // exactly one skill.json id with profession Thief/slot Elite). All 5 have a PvE/WvW+PvP split, WvW
  // value used in every case; all single-hit (`hit_count: 1`, no wiki `strikes=` param).
  // Dagger Storm. PvE/WvW+PvP split 1.33/0.4.
  13085: [{ factText: 'Damage', coefficient: 0.4, weapon: 'unequipped' }],
  // Daredevil — Impact Strike. PvE/WvW+PvP split 1.75/0.75.
  29516: [{ factText: 'Damage', coefficient: 0.75, weapon: 'unequipped' }],
  // Daredevil — Finishing Blow (Impact Strike's follow-up chain skill). PvE/WvW+PvP split 4.0/2.5.
  29639: [{ factText: 'Damage', coefficient: 2.5, weapon: 'unequipped' }],
  // Daredevil — Uppercut (Impact Strike's other follow-up chain skill). Wiki page title
  // "Uppercut (Daredevil skill)" — the bare "Uppercut" title is a disambiguation redirect to the
  // unrelated Warrior Rampage transform skill (id 14487, coefficient 2.4/1.36, NOT this skill).
  // PvE/WvW+PvP split 2.25/0.01 — a steep competitive-mode nerf like several other Elite-slot skills
  // above.
  30077: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Specter — Shadowfall. PvE/WvW+PvP split 1.5/0.01. Wiki's own `weapon=unequipped` param here
  // (unlike the other 4 Thief entries' `weapon=utility`) already matches the Elite-slot convention
  // directly.
  63275: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Engineer — 8 raw candidate ids, 3 distinct new skills curated. 2 stale duplicate ids discarded
  // (6183, a duplicate of Supply Crate 5868 missing the `GroundTargeted` flag the wiki infobox's own
  // `id =` field confirms as canonical; 38750, a duplicate of Detonate Supply Crate Turrets 29518,
  // excluded anyway — see below). 1 raw id, Artillery Barrage (12343), is the same cross-profession
  // golem-summon skill already curated above under Guardian, not a new Engineer entry. 2 more excluded
  // as non-player-scaling: Detonate Supply Crate Turrets (29518, wiki `power=2389` override plus its
  // own note "damage...does not scale with player stats" — same reasoning as the Heal-slot sweep's
  // Detonate Healing Turret exclusion) and Jade Buster Cannon (63374, the Mechanist's auto-triggered
  // mech follow-up to Overclock Signet — wiki `weapon=pet|power=1250` override means this is the mech's
  // own fixed Power stat, not the player's; same non-player-scaling trap as Detonate Supply Crate
  // Turrets, just discovered on an Elite-slot skill instead of Heal-slot).
  // Supply Crate. PvE/WvW+PvP split 1.0/0.01 — WvW value used.
  5868: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Holosmith — Prime Light Beam. 3-way split (PvE 3.0/WvW 1.0/PvP 1.5) — WvW value used. Separate
  // "Field Damage" fact (PvE/PvP grouped 0.5, WvW 0.4) — WvW value used; API's own fact text carries
  // wiki markup (`<c=@abilitytype>Field Damage</c>`), matched verbatim.
  42009: [
    { factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' },
    { factText: '<c=@abilitytype>Field Damage</c>', coefficient: 0.4, weapon: 'unequipped' }
  ],
  // Amalgam (new elite spec, `requires = voe`) — Flux State. PvE/WvW+PvP split 2.0/0.01 — WvW value
  // used. Separate `strikes=12` "Storm Damage" fact, already totaled per the usual convention
  // (PvE 9.0/WvW+PvP 4.8) — WvW value used.
  76993: [
    { factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' },
    { factText: 'Storm Damage', coefficient: 4.8, weapon: 'unequipped' }
  ],
  // Necromancer — 6 raw candidate ids, 3 distinct new skills curated. 1 raw id, Artillery Barrage
  // (12343), is the same cross-profession golem-summon skill already curated above under Guardian,
  // not a new Necromancer entry. 2 more excluded as non-player-scaling: Summon Flesh Golem (10646)
  // and its chain follow-up Charge (10647) are both `type = minion` skills whose Damage facts scale
  // off the Flesh Golem's own attributes — the wiki's Minion page confirms minions "only inherit the
  // player's Condition Damage, Condition Duration, and Boon Duration attributes... All other
  // attributes, such as health, are determined by the minion type," which by the same logic as the
  // Heal-slot sweep's Summon Blood Fiend exclusion means Power isn't inherited either.
  // Plaguelands. No split. Wiki's own `weapon=utility` param normalized to the Elite-slot convention.
  10549: [{ factText: 'Damage', coefficient: 0.39, weapon: 'unequipped' }],
  // Reaper — "Chilled to the Bone!". PvE/WvW+PvP split 3.0/0.01 — WvW value used.
  30105: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Scourge — Ghastly Breach. No split. `strikes=5` present -> wiki's 3.5 already totaled (verified
  // against API's own hit_count 5 * dmg_multiplier 0.7 = 3.5).
  42355: [{ factText: 'Damage', coefficient: 3.5, weapon: 'unequipped' }],
  // Elementalist — 8 raw candidate ids, 3 distinct new skills curated. 1 raw id, Artillery Barrage
  // (12343), is the same cross-profession golem-summon skill already curated above under Guardian,
  // not a new Elementalist entry. 4 more excluded: Crashing Waves (25492) and Flame Barrage (25499)
  // are the Water/Fire Glyph of Elementals' summoned-elemental "command" follow-ups — both wiki pages
  // explicitly note "the direct damage is unaffected by any modifiers such as power or might," the
  // same non-player-scaling exclusion as the Heal/Utility-sweep turret and minion cases, just phrased
  // as prose instead of a `power=` override this time. Tailored Victory (44637) is Weave Self's
  // `flipSkill` "release" effect (Weave Self itself, 43638, carries zero Damage fact of its own) —
  // same "Damage fact unreachable via the current UI, architecture gap not a data gap" bucket as
  // Revenant's Chaotic Release above, left uncurated pending that fix. Lesser Fiery Eruption (44918)
  // is Conjure Fiery Greatsword's auto-triggered passive proc (wiki `parent = Conjure Fiery
  // Greatsword`, `Category:Lesser skills`) — not independently equippable, but unlike Tailored
  // Victory this one ISN'T caught by `skill-variants.ts`'s existing filters (no `toolbeltSkill`/
  // `flipSkill` link back to its parent for `stripNonEquippableSubAbilities`/`stripFlipTargets` to
  // key off), so it likely still leaks into the live Elite picker as if it were its own bindable
  // skill — see TODO.md for a follow-up on generalizing the "Lesser"-skill exclusion.
  // Conjure Fiery Greatsword. No split. Wiki's own `weapon=utility` param normalized to `unequipped`
  // per the Elite-slot convention.
  5516: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Tornado. PvE/WvW+PvP split 1.1/0.01 — WvW value used.
  5534: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Whirlpool (Tornado's underwater replacement — a separately-named id, so it isn't collapsed by
  // `skill-variants.ts`'s same-name dedup and appears as its own Elite pick). PvE/WvW+PvP split
  // 2.2/0.01 — WvW value used.
  5602: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Mesmer — 4 raw candidate ids, 3 distinct new skills curated (the 4th raw id, Artillery Barrage/
  // 12343, is the same cross-profession golem-summon skill already curated above under Guardian, not
  // a new Mesmer entry). This is the last profession in the Elite-slot sweep — Elite-slot is now
  // COMPLETE across all 9 professions.
  // Virtuoso — Thousand Cuts. No split. `strikes=10` present -> wiki's 5.0 already totaled (API
  // confirms: hit_count 10 * dmg_multiplier 0.5 = 5.0).
  24755: [{ factText: 'Damage', coefficient: 5.0, weapon: 'unequipped' }],
  // Chronomancer — Gravity Well. Two independently-split Damage facts, both steeply nerfed in
  // competitive modes like several other Elite-slot skills above: Pulse Damage (PvE 1.1/WvW+PvP
  // 0.01) and Final Damage (PvE 2.1/WvW+PvP 0.01) — WvW values used for both.
  30359: [
    { factText: 'Pulse Damage', coefficient: 0.01, weapon: 'unequipped' },
    { factText: 'Final Damage', coefficient: 0.01, weapon: 'unequipped' }
  ],
  // Mirage — Jaunt. PvE/WvW+PvP split 1.0/0.5 — WvW value used. The API lists this as two identical-
  // text "Damage" facts (one per mode); harmless since `damageLinesForSkill` only checks a same-text
  // match exists, same as several other split entries above.
  45449: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],

  // --- Utility-slot skills (category sweep 2026-08-04, see TODO.md/COMPLETED.md; done
  // profession-by-profession per user request — 220 raw candidates, the largest category swept so
  // far besides Weapon. Warrior, Guardian, Revenant, Ranger done.
  // Racial Utility skills carrying a Damage fact (professions.length === 8, specializationId null —
  // same shared-across-professions shape as Artillery Barrage in the Elite-slot sweep) are curated
  // once here, under Warrior, and referenced (not re-curated) under every later profession they
  // recur in. Of 6 racial candidates, 4 curated; 2 excluded as non-player-scaling: Seed Turret
  // (12456, wiki's own note: "damage...is not affected by the creator's stats" — same trap as the
  // Heal/Elite-slot sweeps' turret exclusions) and Grasping Vines (12453) — its wiki fact has no
  // `weapon=` param at all (`{{skill fact|damage|127|coefficient=0.2}}`), the same template shape as
  // Seed Turret's own fact (`{{skill fact|damage|318|coefficient=0.5}}`) and unlike every other
  // candidate in this sweep (all of which carry an explicit `weapon=` param); the flat "127" doesn't
  // reproduce from this app's own formula at any reference stat, consistent with it being a
  // precomputed non-scaling number like Seed Turret's "318" rather than a real weapon-strength base.
  // Asura — Radiation Field. No split.
  12319: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Charr — Shrapnel Mine. No split. Wiki's own `weapon=unequipped` param already matches.
  12337: [{ factText: 'Damage', coefficient: 1.5, weapon: 'unequipped' }],
  // Charr — Hidden Pistol. No split. Wiki's own `weapon=unequipped` param already matches.
  12339: [{ factText: 'Damage', coefficient: 0.6, weapon: 'unequipped' }],
  // Norn — Call Owl. No split.
  12387: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Warrior — Throw Bolas. No split.
  14354: [{ factText: 'Damage', coefficient: 0.25, weapon: 'unequipped' }],
  // Warrior — Stomp. PvE/WvW+PvP split 0.75/0.01 — WvW value used.
  14388: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Warrior — Kick. PvE/WvW+PvP split 1.0/0.01 — WvW value used. Wiki page title
  // "Kick (warrior utility skill)" — the bare "Kick" title is a disambiguation page (this app's own
  // `skill-variants.ts` resolves the 6 same-named "Kick" ids across different professions/slots by
  // profession+slot, not name alone, same as this curation's own id-based lookup).
  14502: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Warrior — Bull's Charge. PvE/WvW+PvP split 2.0/0.01 — WvW value used.
  14516: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Warrior — Banner of Discipline. 2 API ids share this name (14407 GroundTargeted/14571 not);
  // `skill-variants.ts`'s own doc comment names "every Warrior Banner" as a case its GroundTargeted
  // signal resolves automatically to the non-ground-targeted id, so 14571 (not 14407) is the id this
  // app's picker actually shows — confirmed both ids carry an identical Damage fact (dmg_multiplier
  // 0.5) since the two are otherwise-identical ground-target-toggle variants of one in-game skill. No
  // PvE/WvW split on the Damage fact itself (the wiki's "fury" fact has a split, this doesn't).
  14571: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Warrior — Banner of Strength. Same GroundTargeted duplicate-id shape as Banner of Discipline
  // above (14405 GroundTargeted/14572 not) — 14572 is the canonical id. No split.
  14572: [{ factText: 'Damage', coefficient: 2.0, weapon: 'unequipped' }],
  // Berserker — Sundering Leap. PvE/WvW+PvP split 2.5/2.0 — WvW value used (the page's own
  // `split = pve, wvw, pvp` header is about `recharge pvp` differing, not this Damage fact, which
  // only splits PvE from a WvW+PvP-grouped value).
  29613: [{ factText: 'Damage', coefficient: 2.0, weapon: 'unequipped' }],
  // Berserker — Wild Blow. PvE/WvW+PvP split 2.5/1.7 — WvW value used.
  29941: [{ factText: 'Damage', coefficient: 1.7, weapon: 'unequipped' }],
  // Berserker — Shattering Blow. PvE/WvW+PvP split 1.5/0.5 — WvW value used.
  30074: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Spellbreaker — Break Enchantments. 3-way split PvE/WvW/PvP 1.5/0.7/0.1 — WvW value used. Local
  // `skills.json` carries all 3 as separate same-text "Damage" facts (dmg_multiplier 1.5/0.1/0.7);
  // harmless since `damageLinesForSkill` only checks a same-text match exists, same as several
  // Elite-slot split entries above.
  43123: [{ factText: 'Damage', coefficient: 0.7, weapon: 'unequipped' }],
  // Bladesworn — Dragonspike Mine. PvE/WvW+PvP split 1.5/0.6 — WvW value used.
  62960: [{ factText: 'Damage', coefficient: 0.6, weapon: 'unequipped' }],
  // Paragon — "Find Their Weakness!". PvE/WvW+PvP split 2.0/1.0 — WvW value used.
  77040: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Paragon — "On Your Knees!". PvE/WvW+PvP split 1.5/0.8 — WvW value used.
  77114: [{ factText: 'Damage', coefficient: 0.8, weapon: 'unequipped' }],

  // Guardian — 26 raw candidate ids (of which the 6 racial ones above are shared with Warrior, not
  // re-curated here), 20 distinct Guardian-only skills curated. 3 of the 20 are Guardian's Spirit
  // Weapons, whose actually-equippable ids required fixing a `skill-variant-exclusions.json` gap
  // first (see docs/game-data.md's "blind spot" writeup, 2026-08-04) — the app's own picker
  // resolution was silently landing on a stale/defunct duplicate id for each (`55027`/`55037`/
  // `55040`) instead of the real one (`9168`/`9182`/`9125`), so those 3 are keyed under the
  // corrected id, not the id skills.json's raw duplicate-name scan would first suggest.
  // Bane Signet. PvE/WvW+PvP split 1.0/0.01 — WvW value used.
  9093: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Signet of Judgment. No split.
  9150: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Signet of Wrath. No split on the Damage fact itself (other facts on this skill do split by mode).
  9151: [{ factText: 'Damage', coefficient: 0.25, weapon: 'unequipped' }],
  // Smite Condition. Two independently-split Damage facts — WvW values used for both.
  9245: [
    { factText: 'Damage With No Conditions', coefficient: 0.2, weapon: 'unequipped' },
    { factText: 'Damage With Condition', coefficient: 0.3, weapon: 'unequipped' }
  ],
  // Judge's Intervention. PvE/WvW+PvP split 0.5/0.1 — WvW value used. Wiki's own `weapon=trait skill`
  // param normalized to `unequipped` per the slot-skill convention.
  9247: [{ factText: 'Damage', coefficient: 0.1, weapon: 'unequipped' }],
  // Spirit Weapon — Sword of Justice (id fixed, see block comment above). `strikes=4` present -> wiki
  // coefficient already totaled. 3-way split PvE/WvW/PvP 3.2/1.8/2.88 — WvW value used. The API
  // duplicates the "Damage" fact text 3 times on this id (stale historical values from past balance
  // passes); harmless, `damageLinesForSkill` only checks a same-text match exists.
  9168: [{ factText: 'Damage', coefficient: 1.8, weapon: 'unequipped' }],
  // Spirit Weapon — Shield of the Avenger (id fixed, see block comment above). No split.
  9182: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Spirit Weapon — Hammer of Wisdom (id fixed, see block comment above). PvE/WvW+PvP split
  // 1.2/0.01 — WvW value used.
  9125: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Dragonhunter — Test of Faith. Two independently-split Damage facts: Initial Damage (PvE 1.4,
  // WvW+PvP grouped 0.1) and Damage (3-way split PvE 2.8/WvW 1.88/PvP 0.833) — WvW values used for
  // both.
  29786: [
    { factText: 'Initial Damage', coefficient: 0.1, weapon: 'unequipped' },
    { factText: 'Damage', coefficient: 1.88, weapon: 'unequipped' }
  ],
  // Dragonhunter — Procession of Blades. `strikes=10` present -> wiki coefficient already totaled.
  // PvE+WvW grouped 4.4 vs. a lower PvP-only 2.5 — WvW groups with PvE here, 4.4 used.
  30364: [{ factText: 'Damage', coefficient: 4.4, weapon: 'unequipped' }],
  // Dragonhunter — Fragments of Faith. PvE/WvW+PvP split 1.5/1.0 — WvW value used.
  30553: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Dragonhunter — Light's Judgment. No split.
  30871: [{ factText: 'Damage', coefficient: 0.1875, weapon: 'unequipped' }],
  // Firebrand — Flame Surge. PvE/WvW+PvP split 0.7/0.3 — WvW value used.
  42924: [{ factText: 'Damage', coefficient: 0.3, weapon: 'unequipped' }],
  // Firebrand — Voice of Truth. PvE/WvW+PvP split 0.7/0.3 on the Damage fact (this skill's other
  // facts split 3-way PvE/WvW/PvP, but Damage itself groups WvW with PvP) — WvW value used.
  44008: [{ factText: 'Damage', coefficient: 0.3, weapon: 'unequipped' }],
  // Willbender — Roiling Light. PvE/WvW+PvP split 0.33/0.1 — WvW value used.
  62521: [{ factText: 'Damage', coefficient: 0.1, weapon: 'unequipped' }],
  // Willbender — Heel Crack. PvE/WvW+PvP split 0.75/0.01 — WvW value used.
  62549: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Willbender — Whirling Light. `strikes=4` present -> wiki coefficient already totaled. 3-way split
  // PvE/WvW/PvP 4.0/2.67/2.3 — WvW value used.
  62565: [{ factText: 'Damage', coefficient: 2.67, weapon: 'unequipped' }],
  // Willbender — Flash Combo. `strikes=5` present -> wiki coefficient already totaled. PvE/WvW+PvP
  // split 4.5/2.0 — WvW value used.
  62608: [{ factText: 'Damage', coefficient: 2.0, weapon: 'unequipped' }],
  // Luminary — Effulgent Stance. Two independently-split Damage facts, API-labeled Minimum/Maximum
  // Damage: Maximum Damage (PvE 4.0/WvW+PvP 2.1) and Minimum Damage (no split, 0.5) — WvW value used
  // for Maximum.
  76813: [
    { factText: 'Maximum Damage', coefficient: 2.1, weapon: 'unequipped' },
    { factText: 'Minimum Damage', coefficient: 0.5, weapon: 'unequipped' }
  ],
  // Luminary — Piercing Stance. PvE/WvW+PvP split 2.0/0.25 — WvW value used.
  77078: [{ factText: 'Damage', coefficient: 0.25, weapon: 'unequipped' }],

  // Revenant — 27 raw candidate ids, resolved via the real (not reimplemented)
  // `visibleSkillsForSlot` (a throwaway tsx script confirmed which ids the picker actually
  // surfaces, same verification approach as Guardian's Spirit Weapons blind spot above) down to 12
  // distinct in-game skills, 3 of which stay uncurated (see below). A recurring shape this
  // profession's legends create that no earlier category hit: several skills exist as a
  // spec-less id AND a separately-numbered id gated behind a *later* elite spec that reworks the
  // same skill (`specializationId` signal, not `GroundTargeted` — e.g. Legendary Demon Stance's
  // Banish Enchantment/Call to Anguish get Conduit-specific ids, 78587/78798) — both ids are
  // genuinely equippable (whichever the build's specs resolve to) and share one wiki page/
  // coefficient, so both are curated identically, same treatment as Jade Winds' unresolvable
  // same-page duplicate in the Elite-slot sweep. One duplicate-id pair (Call to Anguish's
  // GroundTargeted/auto-target ids) surfaced a stale-cache gap: the auto-target id this app's
  // picker actually shows (31100/78798) carries only ONE local "Damage" fact (PvE 1.2, missing the
  // WvW+PvP 0.01 split its GroundTargeted sibling 27917/78203 correctly carries both of) — harmless
  // for curation purposes since `damageLinesForSkill` only needs a same-text "Damage" fact to exist
  // locally to key off, not for its value to be current; the curated coefficient here (0.01) is the
  // wiki-verified WvW one regardless of what the stale local fact shows.
  // Legendary Dwarf — Vengeful Hammers. No split.
  26557: [{ factText: 'Damage', coefficient: 0.2, weapon: 'unequipped' }],
  // Legendary Dwarf — Forced Engagement. PvE/WvW+PvP split 0.5/0.01 — WvW value used.
  26679: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Legendary Assassin — Impossible Odds. 3-way split PvE/WvW/PvP 0.65/0.55/0.45 — WvW value used.
  27107: [{ factText: 'Damage', coefficient: 0.55, weapon: 'unequipped' }],
  // Herald — Elemental Blast. No `strikes=` param despite hitting 3 times; wiki's own note states
  // the per-strike PvE/WvW+PvP split (1.5/0.89) totals to 4.5/2.67 — the already-totaled WvW value
  // (2.67) used directly per that note rather than re-deriving.
  51698: [{ factText: 'Damage', coefficient: 2.67, weapon: 'unequipped' }],
  // Legendary Demon — Banish Enchantment. `strikes=3` present -> wiki coefficient already totaled.
  // PvE/WvW+PvP split 1.2/0.3 — WvW value used. Conduit reworks this skill under a separate id
  // (78587) sharing the same wiki page/values — both curated (see block comment above).
  27505: [{ factText: 'Damage', coefficient: 0.3, weapon: 'unequipped' }],
  78587: [{ factText: 'Damage', coefficient: 0.3, weapon: 'unequipped' }],
  // Legendary Demon — Call to Anguish. No `strikes=` param, single hit. PvE/WvW+PvP split 1.2/0.01
  // — WvW value used. Conduit reworks this skill under a separate id (78798) sharing the same wiki
  // page/values — both curated (see block comment above re: the stale-local-fact gap on these ids).
  31100: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  78798: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Legendary Assassin — Phase Traversal. PvE/WvW+PvP split 2.0/1.0 — WvW value used.
  28231: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Legendary Dwarf — Inspiring Reinforcement. PvE+PvP grouped 1.5 vs. a lower WvW-only 0.75 (the
  // reverse of the usual "WvW groups with PvP" pattern seen elsewhere in this table) — WvW value
  // used.
  50383: [{ factText: 'Damage', coefficient: 0.75, weapon: 'unequipped' }],
  // Vindicator/Legendary Alliance — Nomad's Advance. 3-way split PvE/WvW/PvP 4.0/2.3/2.0 — WvW
  // value used.
  62832: [{ factText: 'Damage', coefficient: 2.3, weapon: 'unequipped' }],
  // Vindicator/Legendary Alliance — Scavenger Burst. PvE/WvW+PvP split 2.25/1.25 — WvW value used.
  62841: [{ factText: 'Damage', coefficient: 1.25, weapon: 'unequipped' }],
  // Vindicator/Legendary Alliance — Reaver's Rage. 3-way split PvE/WvW/PvP 2.22/1.25/1.0 — WvW
  // value used.
  62878: [{ factText: 'Damage', coefficient: 1.25, weapon: 'unequipped' }],
  // Conduit/Legendary Entity — Beguiling Haze. Only the "Follow-Up Damage" fact is curated here (no
  // split, coefficient 0.6, verified: 690.5*0.6*1000/2597 ≈ 160 matches the wiki's quoted value
  // exactly) — the main "Damage" fact's PvE side is clearly stated (coefficient 2.2, verified ≈585)
  // but its WvW+PvP side gives only a raw tooltip value (286) with NO `coefficient=` param to read at
  // all; back-solving via this app's own verified Power1000/Armor2597 formula yields ≈1.076, which
  // doesn't cleanly match any value in this skill's own version history (last touched 2025-11-18,
  // PvE-only). Conduit is this app's newest-added elite spec (released 2025-08-19) and its other two
  // Legendary Entity Utility skills are both wiki `{{stub|damage coefficient}}`-tagged outright (see
  // Hex-Eater Vortex/Gladiator's Defense below) — consistent with the wiki simply not having caught
  // up on this mode's exact number yet, same "unfilled coefficient, not something this app can
  // derive" bucket as Guardian's Repose (Heal-slot sweep). Left uncurated pending a cleaner source.
  76805: [{ factText: 'Follow-Up Damage', coefficient: 0.6, weapon: 'unequipped' }],
  // Conduit/Legendary Entity — Hex-Eater Vortex (77243) and Gladiator's Defense (77291) excluded
  // entirely: both wiki pages are explicitly tagged `{{stub|damage coefficient}}`/
  // `{{stub|gamemode split, missing dmg coeff}}`, quoting only a bare tooltip value with no
  // `coefficient=` param at all — same "wiki hasn't documented the coefficient" gap as Repose, just
  // on brand-new Conduit skills instead of an old stub.

  // Ranger — 25 raw candidate ids (6 shared racial ones already curated under Warrior, not
  // re-curated here). Verified against the real `visibleSkillsForSlot` (same throwaway-tsx-script
  // approach as Guardian's Spirit Weapons/Revenant's leg above) — surfaced a fresh instance of that
  // exact bug: "Mistral" (Galeshot) has 2 API ids sharing one name (76757 GroundTargeted/79324 not);
  // the wiki's own infobox documents only 76757 (`id = 76757`, `ground target = line`) and a
  // full-text id search turns up zero hits for 79324 anywhere on the wiki — the app's default
  // GroundTargeted-collapse signal was picking 79324 (the undocumented stale duplicate) as the
  // picker's shown id, same shape as Daring Advance's ground-targeted-is-actually-canonical case in
  // the Elite-slot sweep. Fixed by adding 79324 to `skill-variant-exclusions.json` directly and
  // re-verified against the real `visibleSkillsForSlot`, which now correctly resolves to 76757 — see
  // TODO.md for the writeup. 1 excluded as non-player-scaling: Call Lightning (12598) — its own wiki
  // page's Mechanics section states the damage "uses the [Storm Spirit]'s power (1580) and weapon
  // strength (2426-2681)", the summoned spirit's own fixed stats, not the player's, same trap as the
  // turret/pet/minion exclusions elsewhere in this sweep. 6 more left uncurated (Glyph of the Tides,
  // Glyph of Alignment, Glyph of Equality's damage-dealing casts) — same "Damage fact unreachable via
  // the current UI" architecture gap as Revenant's Chaotic Release/Elementalist's Tailored Victory
  // above, just via `glyphFormVariants` instead of `flipSkill`: each Glyph's actually-equippable
  // canonical id (30238/31322/31746) carries zero facts of its own, since the wiki-sourced
  // `glyphFormVariants` map (see `skill-variants.ts` signal 5) strips its two context-dependent
  // "cast while not/while in Celestial Avatar form" ids (which DO carry the real facts, e.g. 31607's
  // Damage fact for Glyph of Alignment's non-celestial cast) out of the picker entirely, and no
  // rendering path (`relatedVariantSkills` only follows `flipSkill`/attunement, not
  // `glyphFormVariants`) stitches those facts back onto the canonical id's tooltip. Note:
  // `CURATED_HEALING_COEFFICIENTS` already curated 2 of this same family's celestial-form casts
  // (Glyph of Alignment's 31348, Glyph of Burgeoning's 31888, both Healing-slot) during the 2026-08-02
  // Healing sweep without flagging this gap — those entries are almost certainly equally unreachable
  // dead data, worth revisiting alongside a real fix rather than guessing a patch here.
  // Spike Trap. PvE/WvW+PvP split 0.2/0.01 — WvW value used.
  12476: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Signet of the Wild. No split. `strikes=4` present -> wiki's 0.8 already totaled.
  12491: [{ factText: 'Damage', coefficient: 0.8, weapon: 'unequipped' }],
  // Frost Trap. `strikes=5` present -> wiki coefficients already totaled. PvE 5.0 vs. a
  // "pvp"-labeled 2.5 that per the page's own `split = pve, wvw pvp` header groups WvW with PvP
  // (the fact tag's bare `game mode=pvp` label is shorthand for that grouping, same convention seen
  // elsewhere in this sweep) — WvW value (2.5) used.
  12492: [{ factText: 'Damage', coefficient: 2.5, weapon: 'unequipped' }],
  // Lightning Reflexes. PvE/WvW+PvP split 1.0/0.1 — WvW value used.
  12494: [{ factText: 'Damage', coefficient: 0.1, weapon: 'unequipped' }],
  // Viper's Nest. No split. `strikes=3` present -> wiki's 0.9 already totaled.
  12496: [{ factText: 'Damage', coefficient: 0.9, weapon: 'unequipped' }],
  // Flame Trap. No split. Local fact text "Damage per Pulse" (`hit_count: 1` locally, matching the
  // wiki's own `alt=Damage per pulse` label) — a genuinely per-pulse number, not totaled across its
  // 5 pulses, unlike Guardian's Symbol of Blades above (whose plain "Damage" fact label would
  // otherwise understate a 5-pulse total).
  12499: [{ factText: 'Damage per Pulse', coefficient: 0.3, weapon: 'unequipped' }],
  // Untamed — Exploding Spores. `strikes=6` present -> wiki coefficients already totaled. PvE 3.498
  // vs. WvW+PvP grouped 2.64 — WvW value used.
  63157: [{ factText: 'Damage', coefficient: 2.64, weapon: 'unequipped' }],
  // Galeshot — Mistral (id fixed, see block comment above). No split. The API duplicates the
  // "Damage" fact text twice on this id; harmless, `damageLinesForSkill` only checks a same-text
  // match exists.
  76757: [{ factText: 'Damage', coefficient: 0.3, weapon: 'unequipped' }],
  // Galeshot — Wind Shear. PvE/WvW+PvP split 1.0/0.01 — WvW value used.
  77211: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Galeshot — Piercing Gales. `strikes=5` present -> wiki coefficients already totaled. PvE 3.5 vs.
  // WvW+PvP grouped 1.75 — WvW value used.
  77264: [{ factText: 'Damage', coefficient: 1.75, weapon: 'unequipped' }]
}

export interface DamageLine {
  label: string
  value: number
}

/**
 * Real, current-build-scaled damage lines for one skill — `Damage = weaponStrength * coefficient *
 * Power / targetArmor` per curated entry (see `WEAPON_STRENGTH_MIDPOINTS`/
 * `CURATED_DAMAGE_COEFFICIENTS`), gated the same `requires_trait` way as `numericFactLines`/
 * `healingLinesForSkill`. Returns `[]` for any skill with no curated entry rather than falling back
 * to an unscaled/wrong number.
 */
export function damageLinesForSkill(skill: Skill, power: number, targetArmor: number, activeIds: ReadonlySet<number>): DamageLine[] {
  const entries = CURATED_DAMAGE_COEFFICIENTS[skill.id]
  if (!entries) return []

  const allFacts: Fact[] = [...skill.facts, ...skill.traitedFacts]
  const lines: DamageLine[] = []
  for (const entry of entries) {
    const fact = allFacts.find((f) => f.type === 'Damage' && f.text === entry.factText)
    if (!fact) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    const weaponStrength = WEAPON_STRENGTH_MIDPOINTS[entry.weapon]
    lines.push({ label: entry.factText, value: Math.round((weaponStrength * entry.coefficient * power) / targetArmor) })
  }
  return lines
}
