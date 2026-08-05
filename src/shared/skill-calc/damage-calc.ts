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
  // Spear (land AND underwater, same weapon type/wiki page since the 2025-08-19 Janthir Wilds
  // "Weaponmaster Training" update added land usability) and Speargun both use the wiki's own
  // `weapon=spear`/`weapon=harpoon gun` template values verbatim rather than the generic `aquatic`
  // bucket — kept as separate keys purely to match what each skill's own wikitext literally says,
  // even though the wiki's Weapon Strength page footnote confirms all 3 aquatic weapon types
  // (harpoon gun, spear, trident) share this exact same 1000 midpoint.
  spear: 1000,
  'harpoon gun': 1000,
  // Trident — same 1000 midpoint as every other aquatic weapon (see comment above), added for the
  // Guardian Weapon-slot leg (2026-08-05), the first profession curated so far with actual Trident
  // weapon skills as damage candidates.
  trident: 1000,
  // Non-weapon-skill damage (utility/trait procs) — the wiki's `weapon=trait skill` template param.
  unequipped: 690.5,
  // Engineer Kit weapon-bar skills — the wiki's own `weapon=kit` template param (distinct from
  // `weapon=unequipped`; NOT every Kit skill uses it, see the Weapon-slot sweep's Engineer leg block
  // comment below for the per-skill split), confirmed 690.5 is wrong for these: the wiki's Weapon
  // Strength page states "most bundles, kits, conjures etc. share the same unique weapon strength,
  // which scales with the rarity of the equipped mainhand weapon" and its own non-weapon table gives
  // Ascended Bundle a distinct 968.5 midpoint (656/725/690.5 is the separate "Unequipped" row) — this
  // app displays Ascended/Legendary-tier numbers everywhere else (e.g. `rifle: 1150` above is the
  // table's Ascended/Legendary Rifle value, not its lower-tier ones), so 968.5 is used here too.
  kit: 968.5
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
  /**
   * Set only when the wiki-documented value corresponds to a `requires_trait`-gated fact rather than
   * the skill's ungated one — needed because a skill can carry two facts sharing the exact same
   * `factText` (an ungated base value and a trait-boosted override of the same quantity), and without
   * this, `damageLinesForSkill`'s fact lookup always resolves to whichever sorts first in
   * `[...skill.facts, ...skill.traitedFacts]` (always the ungated one) regardless of which value the
   * curated entry actually means. See the Mesmer Utility-slot block below for the motivating cases.
   */
  requiresTrait?: number
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
  // per-pulse; totaled here as 0.45 * 5. Also the Weapon-slot sweep's one Guardian Symbol skill that
  // needed this same manual totaling (see that section's block comment) — every other Guardian
  // Symbol skill's local `hit_count` is 1, confirming their per-pulse wiki value should NOT be
  // totaled (same "don't total a variable/uncertain hit count" rule as Warrior's Whirlwind Attack).
  9097: [{ factText: 'Damage', coefficient: 2.25, weapon: 'sword' }],
  // Revenant — Hammer 2, Coalescence of Ruin. Single hit, no split needed.
  28253: [{ factText: 'Damage', coefficient: 0.91, weapon: 'hammer' }],
  // Ranger — Greatsword 2, Maul (comment previously mislabeled this Greatsword 5; corrected during the
  // Weapon-slot sweep's Ranger leg, 2026-08-05 — the id/coefficient were always correct). Single hit
  // (the API lists 2 identical `Damage` facts for this id; both share the same value so matching the
  // first is equivalent).
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
  // Revenant — 5 raw candidates, all 5 now curated. Legendary Dragon Stance's "Facet of Chaos" (id
  // 27760, the actually-equipped elite-slot id per legends.json) carries zero Damage fact of its own
  // — the fact lives only on its `flipSkill` target "Chaotic Release" (id 28075, the toggle's
  // "consume" release). This used to be dead data (`skillFactLines`/`SkillsEditor` never followed
  // `flipSkill` for Damage-fact rendering) but the gw2skills.net-style stacked flip-icon treatment
  // (2026-08-04, `multi-effect.ts`'s `flipTargetSkills` + `SkillsEditor`'s `FlipSkillStack`) gives the
  // flip target its own icon + independent tooltip keyed on its own id, so 28075 is now reachable —
  // curated directly under its own id, not under 27760. PvE/WvW+PvP split 4.0/0.01 — WvW value used.
  28075: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
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
  // as prose instead of a `power=` override this time. Lesser Fiery Eruption (44918) is Conjure Fiery
  // Greatsword's auto-triggered passive proc (wiki `parent = Conjure Fiery Greatsword`,
  // `Category:Lesser skills`) — not independently equippable, but unlike Tailored Victory below this
  // one ISN'T caught by `skill-variants.ts`'s existing filters (no `toolbeltSkill`/`flipSkill` link
  // back to its parent for `stripNonEquippableSubAbilities`/`stripFlipTargets` to key off), so it
  // likely still leaks into the live Elite picker as if it were its own bindable skill — see TODO.md
  // for a follow-up on generalizing the "Lesser"-skill exclusion.
  // Conjure Fiery Greatsword. No split. Wiki's own `weapon=utility` param normalized to `unequipped`
  // per the Elite-slot convention.
  5516: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Tailored Victory, Weave Self's `flipSkill` "release" effect (Weave Self itself, 43638, carries
  // zero Damage fact of its own) — curated under its own id now that the stacked flip-icon treatment
  // (see Revenant's Chaotic Release above) gives it a reachable, independent tooltip. PvE/WvW+PvP
  // split 0.75/0.01 — WvW value used.
  44637: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
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
  // originally assumed (like every other Warrior Banner) to be a ground-target-toggle pair of one
  // land skill, so this table keyed off 14571 (the id the picker used to show). The full
  // skill-picker duplicate-id audit (2026-08-04) found this assumption wrong specifically for
  // Banners: 14571 is actually "Banner of Discipline (underwater)"'s own dedicated id (confirmed via
  // wiki full-text search), not a land toggle variant — moved to `skill-variant-exclusions.json` so
  // the picker no longer shows it, and this entry re-keyed to 14407 (the real land id, confirmed
  // identical Damage fact, dmg_multiplier 0.5). No PvE/WvW split on the Damage fact itself (the
  // wiki's "fury" fact has a split, this doesn't).
  14407: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Warrior — Banner of Strength. Same underwater-sibling-id mixup as Banner of Discipline above
  // (14405 land/14572 "Banner of Strength (underwater)") — re-keyed to 14405, the real land id. No
  // split.
  14405: [{ factText: 'Damage', coefficient: 2.0, weapon: 'unequipped' }],
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
  // (2.67) used directly per that note rather than re-deriving. Originally keyed to 51698 (the id the
  // picker's GroundTargeted signal picked), but the full skill-picker duplicate-id audit (2026-08-04)
  // found 51698 isn't the wiki-documented id for this Herald-gated pair (27162 is) — re-keyed to
  // 27162, 51698 moved to `skill-variant-exclusions.json`.
  27162: [{ factText: 'Damage', coefficient: 2.67, weapon: 'unequipped' }],
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
  // used. Originally keyed to 50383 (the id the picker's GroundTargeted signal picked), but the full
  // skill-picker duplicate-id audit (2026-08-04) found 50383 isn't the wiki-documented id (28516 is)
  // — re-keyed to 28516, 50383 moved to `skill-variant-exclusions.json`.
  28516: [{ factText: 'Damage', coefficient: 0.75, weapon: 'unequipped' }],
  // Vindicator/Legendary Alliance — Nomad's Advance. 3-way split PvE/WvW/PvP 4.0/2.3/2.0 — WvW
  // value used.
  62832: [{ factText: 'Damage', coefficient: 2.3, weapon: 'unequipped' }],
  // Vindicator/Legendary Alliance — Scavenger Burst. PvE/WvW+PvP split 2.25/1.25 — WvW value used.
  // Note (2026-08-04 skill-picker duplicate-id audit): this skill also has a `62962` id sharing a
  // `flip_skill` chain with Tree Song's own `62941` (the Vindicator legend-swap that turns "Scavenger
  // Burst" into "Tree Song" mid-cast) — left un-investigated, not excluded from the picker, pending a
  // dedicated look at the whole Legendary Alliance legend-swap id family (see TODO.md).
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
  // turret/pet/minion exclusions elsewhere in this sweep. 3 Druid Glyphs' non-celestial-form casts
  // (Glyph of the Tides, Glyph of Alignment, Glyph of Equality) also curated here, keyed by their
  // `glyphFormVariants` variant id (e.g. 31607 for Glyph of Alignment), not the canonical equippable
  // id (31322 for Glyph of Alignment), which itself carries only a sparse, generic fact set — same
  // "curate under the variant id directly" treatment as Thief's Pitfall/Thousand Needles flip targets
  // below. The rendering gap this used to be blocked on is fixed (2026-08-04, `glyph-forms.ts`'s
  // `glyphFormFactSourceSkill` + `SkillsEditor.tsx`'s `skillTooltipContent` — reads the build's
  // Celestial Avatar toggle, same field `WeaponSkillBar` already reads, and swaps in whichever form's
  // real skill/facts match, "swap not stack" unlike `relatedVariantSkills`'s flip-chain stacking);
  // wiki-verified each of the 3 non-celestial variant ids directly (search `insource:"<id>"` finds
  // each one's own page, titled "<Glyph name> (non-celestial)") 2026-08-04.
  // `CURATED_HEALING_COEFFICIENTS`'s 2 celestial-form-cast entries (Glyph of Alignment's 31348, Glyph
  // of Burgeoning's 31888) are confirmed reachable the same way.
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
  // Glyph of the Tides, non-celestial-form cast (id 30448, canonical equippable id 30238 — see
  // `glyph-forms.ts`). Page's infobox `split` header lists a 3-way pve/wvw/pvp split, but the damage
  // fact tag itself only splits two ways, `game mode = pve` (1.5) vs. `game mode = pvp wvw` (0.01) —
  // same "fact tag's own grouping wins over the header" convention as Frost Trap above — WvW value
  // used.
  30448: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Glyph of Alignment, non-celestial-form cast (id 31607, canonical equippable id 31322). No split —
  // the wiki's damage fact tag carries no `game mode=` param at all (only its Bleeding-duration fact
  // does).
  31607: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Glyph of Equality, non-celestial-form cast (id 31658, canonical equippable id 31746). Same shape
  // as Glyph of the Tides above: 3-way `split` header, but the damage fact tag itself splits
  // `game mode=pve` (1.5) vs. `game mode=wvw pvp` (0.01) — WvW value used.
  31658: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
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
  77264: [{ factText: 'Damage', coefficient: 1.75, weapon: 'unequipped' }],

  // Thief — 20 raw candidate ids (6 shared racial ones already curated under Warrior, not
  // re-curated here), 14 distinct Thief-only skills curated. All carry a wiki `weapon=utility`
  // param, normalized to `unequipped` per the slot-skill convention (Well of Sorrow/Well of Tears
  // already use `weapon=unequipped` directly on the wiki). **"Priming" architecture-gap variant**:
  // Thief's 2 Preparation skills (Prepare Pitfall id 13057, Prepare Thousand Needles id 13026) are
  // the *actually-equippable* ids — `skill-variants.ts`'s `stripFlipTargets` removes their
  // differently-named `flipSkill` targets (Pitfall 56880, Thousand Needles 56898) from the picker
  // entirely — and unlike every other flip-architecture gap this sweep hit (Chaotic Release,
  // Tailored Victory, Launch Wall), the equippable id here carries ZERO facts of its own at all (only
  // Duration/Unblockable), not even a non-Damage placeholder. But the flip targets themselves *do*
  // carry real Damage facts (re-confirmed directly against local `skills.json`, not assumed from the
  // earlier sweep's note) and, same as the other flip-gap skills above, are now independently
  // reachable via their own stacked flip-icon tooltip — curated under 56880/56898 directly.
  // Prepare Pitfall's flip target, Pitfall. 2 independently-split Damage facts: "Initial Impact
  // Damage" (PvE/WvW+PvP 1.25/0.01 — WvW used) and "Pulse Damage" (PvE/WvW+PvP 0.5/0.3 — WvW used).
  // The API represents each split as 2 identical-text facts rather than distinct names, same shape as
  // Mesmer's Jaunt/Ritualist's Splinter Weapon earlier in this sweep.
  56880: [
    { factText: 'Initial Impact Damage', coefficient: 0.01, weapon: 'unequipped' },
    { factText: 'Pulse Damage', coefficient: 0.3, weapon: 'unequipped' }
  ],
  // Prepare Thousand Needles' flip target, Thousand Needles. No split (wiki page has no `split`
  // param at all). 2 independently-split-by-name Damage facts: "Damage" (the initial impact) and
  // "Pulsing Damage".
  56898: [
    { factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' },
    { factText: 'Pulsing Damage', coefficient: 0.2, weapon: 'unequipped' }
  ],
  // Deadeye's Shadow Flare (41158) hits a related but survivable case: it also has a differently-
  // named `flipSkill` target (Shadow Swap, 45672, "reactivate to swap places with the orb") stripped
  // by the same signal, but Shadow Flare itself already carries its own Damage fact (the initial
  // throw) independent of the swap-back detonation, so it's curated normally below. Shadow Swap's own
  // separate Damage fact used to be the one excluded unreachable fact in this pair — now curated too,
  // reachable the same way as Pitfall/Thousand Needles above since Shadow Flare is itself equippable
  // (`FlipSkillStack` renders Shadow Swap's own icon+tooltip off of it). No split.
  45672: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Scorpion Wire. PvE/WvW+PvP split 0.5/0.01 — WvW value used.
  13020: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Daredevil — Impairing Daggers. `strikes=3` present -> wiki coefficient already totaled. No
  // split (the page's `split = pve, wvw pvp` header covers other facts on this skill, not Damage).
  30369: [{ factText: 'Damage', coefficient: 2.25, weapon: 'unequipped' }],
  // Daredevil — Reflexive Strike. PvE/WvW+PvP split 0.75/0.01 — WvW value used.
  30519: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Daredevil — Distracting Daggers. PvE/WvW+PvP split 0.55/0.25 — WvW value used.
  30568: [{ factText: 'Damage', coefficient: 0.25, weapon: 'unequipped' }],
  // Daredevil — Palm Strike. Two independently-split Damage facts: "Damage" (PvE/WvW+PvP 1.75/0.01
  // — WvW used) and "Second Strike Damage" (no split, 3.28).
  30693: [
    { factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' },
    { factText: 'Second Strike Damage', coefficient: 3.28, weapon: 'unequipped' }
  ],
  // Daredevil — Fist Flurry. `strikes=5` present -> wiki coefficients already totaled. PvE 3.75 vs.
  // WvW+PvP grouped 2.5 — WvW value used.
  30868: [{ factText: 'Damage', coefficient: 2.5, weapon: 'unequipped' }],
  // Deadeye — Shadow Flare (id fixed, see block comment above). No split on this fact.
  41158: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Deadeye — Binding Shadow. PvE/WvW+PvP split 1.0/0.01 — WvW value used.
  41205: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Deadeye — Shadow Gust. PvE/WvW+PvP split 0.4/0.01 — WvW value used.
  46335: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Specter — Well of Sorrow. No split. Wiki's own `weapon=unequipped` param already matches; no
  // `strikes=` param despite a separate "Number of Impacts: 5" fact — that fact tracks how many
  // times this well pulses conditions (confirmed by its own Mechanics note, which only describes a
  // condition-pulse order, never a repeated direct-damage strike), not the Damage fact's hit count,
  // consistent with the local API's hit_count: 1 exactly matching the wiki's un-totaled coefficient.
  63276: [{ factText: 'Damage', coefficient: 0.222, weapon: 'unequipped' }],
  // Specter — Well of Tears. No split. Same "Number of Impacts" reasoning as Well of Sorrow above
  // — local hit_count: 1 matches the wiki's un-totaled coefficient directly.
  63294: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],

  // Engineer — 49 raw candidate ids (6 shared racial ones already curated/excluded under Warrior,
  // not re-curated here). The 43 Engineer-only raw ids resolved via the real (not reimplemented)
  // `visibleSkillsForSlot` — same throwaway-tsx-script verification as earlier legs, run once per
  // Engineer elite spec (Scrapper/Holosmith/Mechanist/Amalgam) plus a spec-less baseline — down to
  // 17 distinct in-game skills: 12 curated below (11 plus Launch Wall, now reachable — see below), 5
  // excluded as non-player-scaling.
  // **New non-player-scaling category found, generalizing a trap this sweep had only seen as
  // one-off exclusions before**: every base turret-*deploy* skill's own Damage fact carries the
  // exact same `power=2389` override — Rifle Turret (5818), Flame Turret (5836), Thumper Turret
  // (5838), Rocket Turret (5912), Harpoon Turret (6093). The wiki's general "Turret" page's own
  // Mechanics section confirms this isn't per-skill: "Boons and conditions applied by turrets use
  // the character's attributes, but otherwise turrets are unaffected by character's stats and
  // cannot critically hit" — the same fixed-Power shape already excluded one skill at a time for
  // Detonate Supply Crate Turrets (Elite-slot sweep) and Jade Buster Cannon (Elite-slot sweep), now
  // confirmed to cover the entire turret family's own attacks, not just their detonate/overcharge
  // sub-abilities. All 5 excluded; worth treating any *other* profession's future turret-shaped
  // summon the same way if one ever appears.
  // Holosmith's Photon Wall (43739, the actually-equippable id per `visibleSkillsForSlot`) carries
  // zero Damage fact of its own (only Recharge/Heat Threshold/Duration/Blocks Missiles/Reflects
  // Missiles) — its Damage fact lives only on its `flipSkill` target, Launch Wall (40533). Curated
  // directly under 40533 now that the stacked flip-icon treatment makes it reachable (same reasoning
  // as Revenant's Chaotic Release/Elementalist's Tailored Victory above). PvE/WvW+PvP split 1.5/0.5 —
  // WvW value used.
  40533: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Personal Battering Ram (id fixed via flip-root — wiki's own `id = 5811,29991` confirms both
  // belong to this one skill; 29991 is the flip target `visibleSkillsForSlot` strips). PvE/WvW+PvP
  // split 1.25/0.01 — WvW value used.
  5811: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Rocket Boots. 2 ids remain genuinely ambiguous per docs/game-data.md's own prior investigation
  // (5910/29522, an old-vs-reworked pair with no distinguishing API field at all, unlike the already-
  // resolved underwater-sibling pair 50438/50441) — both curated identically, same "can't tell which
  // the picker shows, so cover both" treatment as this sweep's other unresolvable duplicate pairs
  // (Jade Winds, Banish Enchantment/Call to Anguish). PvE/WvW+PvP split 1.25/0.5 — WvW value used.
  5910: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  29522: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Throw Mine. 2 ids remain genuinely ambiguous too — per docs/game-data.md, a Gadgeteer-trait-gated
  // pair (6161/30337) the wiki documents as both real, not a legacy/environment split; both curated
  // identically for the same reason as Rocket Boots above. PvE/WvW+PvP split 3.0/0.01 — WvW value
  // used.
  6161: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  30337: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Scrapper — Shredder Gyro. `strikes=12` present -> wiki's 4.8 already totaled (verified: local
  // hit_count 12 * dmg_multiplier 0.4 = 4.8). No split.
  29921: [{ factText: 'Damage', coefficient: 4.8, weapon: 'unequipped' }],
  // Scrapper — Blast Gyro. PvE/WvW+PvP split 2.75/0.01 — WvW value used.
  31248: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Holosmith — Laser Disk. No split.
  42842: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Mechanist — Superconducting Signet. `strikes=6` present -> wiki's 2.4 already totaled (verified:
  // local hit_count 6 * dmg_multiplier 0.4 = 2.4). No split.
  63113: [{ factText: 'Damage', coefficient: 2.4, weapon: 'unequipped' }],
  // Mechanist — Force Signet. PvE/WvW+PvP split 1.0/0.01 — WvW value used.
  63253: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Amalgam — Liquid State. `strikes=4` present -> wiki's 0.8 already totaled (verified: local
  // hit_count 4 * dmg_multiplier 0.2 = 0.8). No split.
  76908: [{ factText: 'Damage', coefficient: 0.8, weapon: 'unequipped' }],
  // Amalgam — Solid State. PvE/WvW+PvP split 3.0/0.01 — WvW value used.
  77069: [{ factText: 'Damage', coefficient: 0.01, weapon: 'unequipped' }],
  // Amalgam — Plasmatic State. `strikes=2` present -> wiki coefficients already totaled (verified:
  // local hit_count 2 * dmg_multiplier 2.25 = 4.5, matching the wiki's PvE side exactly). PvE/WvW+PvP
  // split 4.5/2.0 — WvW value used.
  77209: [{ factText: 'Damage', coefficient: 2.0, weapon: 'unequipped' }],

  // Necromancer — 24 visible ids carry a Damage fact (6 shared racial ones, already curated under
  // Warrior, not re-curated here), resolved via the real `visibleSkillsForSlot` run once per
  // Necromancer elite spec (Reaper/Scourge/Harbinger/Ritualist) plus a spec-less baseline, same
  // throwaway-tsx-script verification as earlier legs — all 4 spec runs returned the identical 49-id
  // visible set, so no spec-gated duplicate-id groups exist for this profession's Utility slot. 18
  // Necromancer-only ids: 14 curated below, 4 excluded as non-player-scaling.
  // **New minion sub-case of the established non-player-scaling trap**: all 4 of the profession's
  // base minion-summon skills (Summon Bone Fiend 10533, Summon Bone Minions 10541, Summon Flesh Wurm
  // 10543, Summon Shadow Fiend 10589) are `type = minion` per their own wiki infobox and each carries
  // an explicit note stating the summoned minion's own fixed Power at level 80 (e.g. Bone Fiend
  // "has a base Power of 1,500", Flesh Wurm "~1,650") — the same "minion's own stats, not the
  // player's" reasoning already applied to Summon Flesh Golem/Charge in the Elite-slot sweep and the
  // wiki's general Minion page. All 4 excluded outright.
  // Blood Is Power. No split.
  10544: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Epidemic. No split. Notes confirm this is a real (non-critable, unblockable) direct strike
  // alongside the condition-spread effect, not just a condition-application trigger.
  10606: [{ factText: 'Damage', coefficient: 0.1, weapon: 'unequipped' }],
  // Signet of the Locust. No split. Wiki template names this fact "life siphon damage|alt=Damage",
  // but the local API fact's own `text` is plain "Damage" — matched on that.
  10612: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Signet of Spite. No split.
  10622: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Well of Corruption (id fixed — wiki's own `id = 10545, 10671` confirms 10671 is the
  // GroundTargeted-collapsed visible id; 10545 is the auto-target duplicate `visibleSkillsForSlot`
  // strips). `strikes=6` present -> wiki's PvE 3.0 already totaled (verified: local hit_count 6 *
  // dmg_multiplier 0.5 = 3.0). 3-way PvE/WvW/PvP split 3.0/1.68/2.7 — WvW value used.
  10671: [{ factText: 'Damage', coefficient: 1.68, weapon: 'unequipped' }],
  // Well of Suffering (id fixed the same way — wiki's `id = 10546, 10674`, 10674 is the visible id).
  // `strikes=6` present -> wiki's PvE 6.0 already totaled (verified: local hit_count 6 *
  // dmg_multiplier 1.0 = 6.0). 3-way PvE/WvW/PvP split 6.0/4.5/5.4 — WvW value used.
  10674: [{ factText: 'Damage', coefficient: 4.5, weapon: 'unequipped' }],
  // Reaper — "You Are All Weaklings!". PvE/WvW+PvP split 2.5/0.4 — WvW value used. Separate "damage
  // increase" facts (PvE 100%/WvW+PvP 50%, melee-range bonus) aren't weapon-strength-scaled Damage
  // facts and aren't modeled here, same treatment as this table's existing "Your Soul Is Mine!" entry.
  29414: [{ factText: 'Damage', coefficient: 0.4, weapon: 'unequipped' }],
  // Reaper — "Nothing Can Save You!". PvE/WvW+PvP split 2.0/0.7 — WvW value used. Same unmodeled
  // "damage increase" bonus fact as above.
  29666: [{ factText: 'Damage', coefficient: 0.7, weapon: 'unequipped' }],
  // Reaper — "Suffer!". PvE/WvW+PvP split 1.5/0.3 — WvW value used. Same unmodeled "damage increase"
  // bonus fact as above.
  30670: [{ factText: 'Damage', coefficient: 0.3, weapon: 'unequipped' }],
  // Reaper — "Rise!". PvE/WvW+PvP split 0.8/0.4 — WvW value used. Same unmodeled "damage increase"
  // bonus fact as above.
  30772: [{ factText: 'Damage', coefficient: 0.4, weapon: 'unequipped' }],
  // Scourge — Trail of Anguish. No split.
  40274: [{ factText: 'Damage', coefficient: 0.55, weapon: 'unequipped' }],
  // Scourge — Sand Swell. No split. A separate Barrier fact on this skill is its own healing-side
  // number (out of scope here, not a Damage fact).
  42917: [{ factText: 'Damage', coefficient: 1.4, weapon: 'unequipped' }],
  // Scourge — Desiccate. No split.
  42935: [{ factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' }],
  // Ritualist (this app's newest elite spec, released 2025-08-19) — Splinter Weapon. Genuine 3-way
  // PvE/WvW/PvP split 0.4/0.25/0.5 (independently split values, not the usual PvE-vs-WvW+PvP-grouped
  // shape) — WvW value used. API represents the split as 3 separate identical-text "Damage" facts
  // rather than distinct fact names, same shape as Mesmer's Jaunt earlier in this sweep.
  76975: [{ factText: 'Damage', coefficient: 0.25, weapon: 'unequipped' }],

  // Elementalist — 19 visible ids carry a Damage fact after fixing 2 real picker bugs surfaced by
  // this leg (see below); 6 are the shared racial ones already curated/excluded under Warrior, not
  // re-curated here. All 5 spec runs (baseline + Tempest/Weaver/Catalyst/Evoker) returned the
  // identical visible set, no spec-gated duplicate-id groups for this profession's Utility slot.
  // **Bug #1 — stale duplicate ids surviving the GroundTargeted-collapse signal**: Lightning Flash
  // and Signet of Water each have 2 API ids sharing one name, and unlike every other GroundTargeted
  // pair in this sweep, only ONE side is real — the *ground-targeted* id (5536, 5570) is the wiki's
  // own documented `id =` field for each skill's page, while the other, auto-target-flagged id
  // (50447, 49056) returns zero wiki search hits anywhere, the same "confirmed-stale, not just
  // undocumented" signal used for the Guardian Spirit Weapons/Ranger Mistral picker-bug fixes
  // earlier in this sweep — except this time the app's default auto-target-preferred signal picked
  // the *wrong side* of the pair (the fake one), the reverse of every prior instance. Fixed by adding
  // 50447/49056 to `skill-variant-exclusions.json` directly, re-verified against the real
  // `visibleSkillsForSlot`. (Arcane Wave's own 5638/22572 GroundTargeted pair is a genuine dual-id
  // skill per the wiki's `id = 5638, 22572` field documenting both — the existing auto-target pick,
  // 22572, needed no fix.)
  // **Bug #2 — differently-named attunement variants leaking into the picker**: `skill-variants.ts`'s
  // attunement-collapse signal only fires when a group of same-named ids includes a real
  // attunement-agnostic sibling (e.g. "Glyph of Lesser Elementals" correctly collapses this way,
  // its 4 attunement variants share its exact name) — but Glyph of Storms (5734) and Glyph of
  // Renewal (5573) each describe their 4 attunement variants under their own distinct flavor names
  // (Ice Storm/Firestorm/Lightning Storm/Sandstorm; Renewal of Air/Earth/Fire/Water, the latter with
  // 2 generations of ids each), and Glyph of Elemental Power (5506) partially does the same (Air/
  // Fire variants named "Glyph of Elemental Power" but tagged `attunement`, non-null). None of these
  // 16 ids share their base skill's name, so each lands in the picker as its own singleton group,
  // bypassing the attunement filter entirely — of them, 4 (Ice Storm/Firestorm/Lightning
  // Storm/Sandstorm) and 2 (Glyph of Elemental Power's Air/Fire variants, 34637/34736) carry a
  // Damage fact and were about to be curated as if independently equippable. Fixed the same way as
  // Bug #1, adding all 16 non-equippable variant ids (the 6 Damage-bearing ones plus the other 10
  // Renewal/Elemental-Power variants with no Damage fact, for full consistency) to
  // `skill-variant-exclusions.json`; Glyph of Elementals (Elite-slot, already curated) shares its
  // variants' exact name like Glyph of Lesser Elementals and was unaffected.
  // Lightning Flash (id-fixed, see Bug #1). PvE/WvW+PvP split 1.5/0.3 — WvW value used.
  5536: [{ factText: 'Damage', coefficient: 0.3, weapon: 'unequipped' }],
  // Arcane Blast. PvE/WvW+PvP split 1.4/0.6 — WvW value used.
  5539: [{ factText: 'Damage', coefficient: 0.6, weapon: 'unequipped' }],
  // Signet of Fire. No split.
  5542: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Signet of Water (id-fixed, see Bug #1). No split (separate Healing fact out of scope here).
  5570: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Signet of Earth. No split.
  5571: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Signet of Air. No split.
  5572: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Arcane Wave (both 5638/22572 real per the wiki's own dual-id field, 22572 is the visible
  // auto-target one). PvE/WvW+PvP split 1.4/1.7 — a rare *inverted* split, WvW higher than PvE
  // (same reverse-of-usual shape as this table's existing Inspiring Reinforcement entry) — WvW
  // value 1.7 used.
  22572: [{ factText: 'Damage', coefficient: 1.7, weapon: 'unequipped' }],
  // Arcane Shield. No split.
  5641: [{ factText: 'Damage', coefficient: 1.5, weapon: 'unequipped' }],
  // Tempest — "Flash-Freeze!". PvE/WvW+PvP split 0.7/0.1 — WvW value used.
  29948: [{ factText: 'Damage', coefficient: 0.1, weapon: 'unequipped' }],
  // Tempest — "Aftershock!". `strikes=2` present -> both PvE 1.5 and WvW+PvP 0.1 already totaled
  // (verified: wiki's own per-strike values 0.75/0.05 * 2). WvW value used.
  30432: [{ factText: 'Damage', coefficient: 0.1, weapon: 'unequipped' }],
  // Tempest — "Feel the Burn!". PvE/WvW+PvP split 2.5/0.1 — WvW value used.
  30662: [{ factText: 'Damage', coefficient: 0.1, weapon: 'unequipped' }],
  // Weaver — Primordial Stance. No split.
  40183: [{ factText: 'Damage', coefficient: 0.33, weapon: 'unequipped' }],
  // Catalyst — Shattering Ice. PvE/WvW+PvP split 0.6/0.3 — WvW value used. Wiki's `id = 62698, 62909`
  // lists a second id described as "the damage effect on targets that were hit" — not a distinct
  // equippable skill (absent from `skills.json` under this profession/slot), so not curated
  // separately.
  62698: [{ factText: 'Damage', coefficient: 0.3, weapon: 'unequipped' }],
  // Evoker (this app's newest elite spec, released 2025-08-19) — all 3 Meditations (Hare's Agility,
  // Toad's Fortitude, Fox's Fury) hit a confirmed-correct instance of the established flip-
  // architecture gap (Chaotic Release/Tailored Victory/Launch Wall/Thief's Preparation skills): each
  // name has 2 API ids in a `flipSkill` relationship, and the app's flip-root selection exactly
  // matches the wiki's own documented `id =` field in all 3 cases (Hare's Agility -> 77038, Toad's
  // Fortitude -> 77320, Fox's Fury -> both 76711 and 77282 per the wiki, 76711 the flip-root/visible
  // one) — but the equippable id's own local facts are sparse (Recharge/Number only) and never
  // include the skill's real Damage fact(s), which the API instead attaches to the flip target id
  // (76583, 77247, 77282 respectively). Now curated directly under those flip-target ids, same
  // reachability fix as Chaotic Release/Tailored Victory/Launch Wall above.
  // Hare's Agility. PvE/WvW+PvP split 0.4/0.5 — a rare *inverted* split (competitive higher than PvE,
  // same reverse-of-usual shape as this table's Arcane Wave entry) — WvW value 0.5 used. Wiki's own
  // note: "the tooltip incorrectly uses a coefficient of 1 while the true coefficient is 0.4" (PvE
  // side).
  76583: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Toad's Fortitude. PvE/WvW+PvP split 1.5/0.5 — WvW value used.
  77247: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Fox's Fury. No PvE/WvW/PvP split, but 3 independently-split Damage facts by the caster's own
  // Might stacks at cast time — the API represents these with an en dash in "10–20 Might", not a
  // hyphen, matched verbatim.
  77282: [
    { factText: 'Damage (over 20 Might)', coefficient: 3.0, weapon: 'unequipped' },
    { factText: 'Damage (10–20 Might)', coefficient: 2.25, weapon: 'unequipped' },
    { factText: 'Damage (under 10 Might)', coefficient: 1.5, weapon: 'unequipped' }
  ],

  // Mesmer — the last profession in the Utility-slot sweep. 61 raw candidate ids (6 shared racial
  // ones already curated/excluded under Warrior, not re-curated here) resolved via the real
  // `visibleSkillsForSlot` (same throwaway-tsx-script verification as every earlier leg), run once
  // per Mesmer elite spec (Chronomancer/Mirage/Virtuoso/Troubadour — this app's newest elite spec,
  // released 2025-08-19) plus a spec-less baseline — all 5 runs returned the identical 49-id visible
  // set, no spec-gated duplicate-id groups this profession's Utility slot. 17 visible ids carry a
  // Damage fact; 11 Mesmer-only ones curated below, all confirmed via each wiki page's own
  // `| id = ` field. Rain of Swords' wiki page itself flags a `<!-- GroundTargeted Version: 45425 -->`
  // sibling id — same shape as every other GroundTargeted duplicate pair this sweep has resolved,
  // `visibleSkillsForSlot` already collapses to the non-ground-targeted 62553 on its own, no picker
  // fix needed. **Trait-duplicated-fact wrinkle, distinct from the Healing sweep's Assassin's
  // Reward/Transfusion trap**: 5 of these 11 (Phantasmal Disenchanter, Phantasmal Defender, Sword of
  // Decimation, Rain of Swords, Psychic Force) each carry 2-4 EXTRA same-text "Damage" facts gated by
  // `requires_trait` (682, Empowered Illusions — a flat +15% phantasm-damage trait, no PvE/WvW split —
  // for the 2 Phantasms; 2206, Infinite Forge — a Virtuoso blade-damage trait, +7% PvE/+10% WvW+PvP,
  // itself patched down from +10%/+10% on 2025-02-11 PvE-only — for the other 3), representing that
  // trait's own damage bonus, not a distinct skill design; unlike the Healing sweep's trap this isn't
  // a *shared* formula reused verbatim across dozens of unrelated skills, it's a per-skill alternate
  // value. **Fixed 2026-08-05** (see `DamageCoefficient.requiresTrait`'s own doc comment, same
  // `requiresTrait`-matching fix built for `CURATED_BARRIER_COEFFICIENTS`'s Lava Skin) — all 5 skills'
  // trait-gated coefficients below are computed as `baseCoefficient * (1 + trait%)` using each trait's
  // own wiki-quoted `{{skill fact|damage increase|...}}` percentage (not reverse-engineered from the
  // API alone), then cross-confirmed against a live `/v2/skills/<id>` pull's own `traited_facts`
  // `dmg_multiplier` — exact match in every case tested. Necromancer's Reaper shouts' "damage
  // increase" facts (mentioned in TODO.md alongside these 5 before this investigation) turned out to
  // be an unrelated, still-unmodeled mechanic on closer look: a `type: 'Percent'` melee-range damage
  // bonus with no `requires_trait` gating at all, not a same-text `Damage`-fact collision — left as-is,
  // out of scope for this fix.
  // Phantasmal Disenchanter. Two independently-split Damage facts, "Damage without Boons" (PvE
  // 1.0/WvW+PvP 0.5) and "Damage with Boons" (PvE 0.4/WvW+PvP 0.2) — WvW values used for both.
  // Empowered Illusions (682) trait-gated variants: 0.5*1.15=0.575, 0.2*1.15=0.23.
  10267: [
    { factText: 'Damage without Boons', coefficient: 0.5, weapon: 'unequipped' },
    { factText: 'Damage with Boons', coefficient: 0.2, weapon: 'unequipped' },
    { factText: 'Damage without Boons', coefficient: 0.575, weapon: 'unequipped', requiresTrait: 682 },
    { factText: 'Damage with Boons', coefficient: 0.23, weapon: 'unequipped', requiresTrait: 682 }
  ],
  // Phantasmal Defender. PvE/WvW+PvP split 0.4/0.2 — WvW value used. Empowered Illusions (682)
  // trait-gated variant: 0.2*1.15=0.23.
  10341: [
    { factText: 'Damage', coefficient: 0.2, weapon: 'unequipped' },
    { factText: 'Damage', coefficient: 0.23, weapon: 'unequipped', requiresTrait: 682 }
  ],
  // Well of Senility. No split.
  29856: [{ factText: 'Damage', coefficient: 1.5, weapon: 'unequipped' }],
  // Well of Calamity. Two independently-split Damage facts, both per-pulse/per-instance (no
  // `strikes=` param, local `hit_count: 1` on each, same "per pulse, not totaled" shape as Ranger's
  // Flame Trap rather than Guardian's Symbol of Blades): "Pulse Damage" (PvE 1.3/WvW+PvP 0.75) and
  // "Final Damage" (PvE 2.1/WvW+PvP 3.0 — a rare *inverted* split, WvW higher than PvE, same reverse-
  // of-usual shape as this table's existing Arcane Wave/Inspiring Reinforcement entries) — WvW values
  // used for both.
  30525: [
    { factText: 'Pulse Damage', coefficient: 0.75, weapon: 'unequipped' },
    { factText: 'Final Damage', coefficient: 3.0, weapon: 'unequipped' }
  ],
  // Well of Action. "Pulse Damage", per-pulse/not totaled (same reasoning as Well of Calamity above).
  // PvE/WvW+PvP split 1.5/0.7 — WvW value used.
  30814: [{ factText: 'Pulse Damage', coefficient: 0.7, weapon: 'unequipped' }],
  // Virtuoso — Sword of Decimation. PvE/WvW+PvP split 1.5/1.0 — WvW value used. Infinite Forge (2206)
  // trait-gated WvW+PvP variant: 1.0*1.10=1.10 (using the still-current +10% WvW+PvP trait percentage,
  // unaffected by the 2025-02-11 PvE-only nerf).
  35637: [
    { factText: 'Damage', coefficient: 1.0, weapon: 'unequipped' },
    { factText: 'Damage', coefficient: 1.1, weapon: 'unequipped', requiresTrait: 2206 }
  ],
  // Mirage — Crystal Sands. `strikes=6` present -> wiki's 2.4 already totaled (verified: local
  // hit_count 6 * dmg_multiplier 0.4 = 2.4). No split.
  41065: [{ factText: 'Damage', coefficient: 2.4, weapon: 'unequipped' }],
  // Mirage — Mirage Advance. No split.
  42851: [{ factText: 'Damage', coefficient: 1.5, weapon: 'unequipped' }],
  // Mirage Mirror (spec-less, id 44677). No split.
  44677: [{ factText: 'Damage', coefficient: 0.6, weapon: 'unequipped' }],
  // Virtuoso — Rain of Swords (id-confirmed, see block comment above). PvE/WvW+PvP split 1.2/0.8 —
  // WvW value used. Infinite Forge (2206) trait-gated WvW+PvP variant: 0.8*1.10=0.88.
  62553: [
    { factText: 'Damage', coefficient: 0.8, weapon: 'unequipped' },
    { factText: 'Damage', coefficient: 0.88, weapon: 'unequipped', requiresTrait: 2206 }
  ],
  // Virtuoso — Psychic Force. No split (this skill's own change history shows its former PvP/WvW
  // split, 0.01, was since raised to match PvE's 1.5 uniformly across all modes). Infinite Forge
  // (2206) trait-gated variant: 1.5*1.10=1.65.
  62573: [
    { factText: 'Damage', coefficient: 1.5, weapon: 'unequipped' },
    { factText: 'Damage', coefficient: 1.65, weapon: 'unequipped', requiresTrait: 2206 }
  ],
  // **Utility-slot sweep is now COMPLETE across all 9 professions.**

  // --- Weapon-slot sweep (started 2026-08-05, see TODO.md/heal-coefficient-curation-strategy memory)
  // --- Warrior done: 63 raw candidate ids (real, currently-equippable Weapon_1-5 ids resolved via
  // the app's own `resolveSkillBarIds`/`weaponSkillIdsForPair`, not `visibleSkillsForSlot` — weapon
  // skills use a completely separate resolution path, see weapon-calc/weapon-skills.ts), 62 curated
  // here (the 63rd, Whirling Axe id 14399, was already seeded 2026-08-02). Includes both the classic
  // aquatic-only Spear autoattack chain (Stab/Mariner's Frenzy/Parry/Barbed Pull/Tsunami Slash) and
  // the new land Spear kit added by the 2025-08-19 Janthir Wilds "Weaponmaster Training" update
  // (Mighty Throw/Maiming Spear/Disrupting Throw/Spearmarshal's Support/Spear Swipe) — both
  // land/underwater variants of the same `weapons.Spear` entry, disambiguated the same
  // `NoUnderwater`-flag way as every other dual-environment weapon. New per-skill trait-duplicated-
  // fact wrinkle: 6 Spear/Rifle skills (Stab, Mariner's Frenzy, Parry, Barbed Pull, Tsunami Slash,
  // Fierce Shot) carry a `requires_trait`-gated alternate Damage value — 5 via trait 1338 (Forceful
  // Greatsword, Strength line; its live tooltip no longer states a percentage since a 2018-12-11
  // rework replaced the bonus with flat Power, but the live API's `dmg_multiplier` for every gated
  // fact still empirically matches the old wiki-quoted +10%, `base * 1.10`, exactly — used as
  // confirmed-correct despite the stale/absent tooltip text) and 1 via trait 1329 (Crack Shot,
  // Discipline line, current tooltip explicitly still quotes +10% for Fierce Shot specifically).
  // Chop 1's chain follow-ups (Stab→Jab→Impale is a 3-hit autoattack chain sharing one Weapon_1 bar
  // slot) aren't independently curated — only the chain-starter id is ever bar-bound/reachable via
  // the weapon skill bar's tooltip, same as every other multi-hit auto-chain in this app already.
  // Warrior — Greatsword 1, Greatsword Swing. PvE/WvW+PvP split (0.8/0.469).
  14356: [{ factText: 'Damage', coefficient: 0.469, weapon: 'greatsword' }],
  // Warrior — Hammer 1, Hammer Swing. PvE/WvW+PvP split (0.9/0.6).
  14358: [{ factText: 'Damage', coefficient: 0.6, weapon: 'hammer' }],
  // Warrior — Hammer 4, Staggering Blow. PvE/WvW+PvP split (1.5/0.01) — steep competitive nerf.
  14359: [{ factText: 'Damage', coefficient: 0.01, weapon: 'hammer' }],
  // Warrior — Rifle 5, Rifle Butt. PvE/WvW+PvP split (1.0/0.01) — steep competitive nerf.
  14360: [{ factText: 'Damage', coefficient: 0.01, weapon: 'rifle' }],
  // Warrior — Shield 4, Shield Bash. PvE/WvW+PvP split (1.0/0.01) — steep competitive nerf.
  14361: [{ factText: 'Damage', coefficient: 0.01, weapon: 'shield' }],
  // Warrior — Sword 1, Sever Artery. PvE/WvW+PvP split (0.8/0.4).
  14364: [{ factText: 'Damage', coefficient: 0.4, weapon: 'sword' }],
  // Warrior — Sword 2, Savage Leap. PvE/WvW+PvP split (2.0/1.35).
  14366: [{ factText: 'Damage', coefficient: 1.35, weapon: 'sword' }],
  // Warrior — Axe 1, Chop. PvE/WvW+PvP split (0.7/0.47).
  14369: [{ factText: 'Damage', coefficient: 0.47, weapon: 'axe' }],
  // Warrior — Mace 1, Mace Smash. PvE/WvW+PvP split (0.8/0.533).
  14376: [{ factText: 'Damage', coefficient: 0.533, weapon: 'mace' }],
  // Warrior — Longbow 3, Arcing Arrow. PvE/WvW+PvP split (2.5/1.5).
  14381: [{ factText: 'Damage', coefficient: 1.5, weapon: 'longbow' }],
  // Warrior — Hammer 2, Fierce Blow. Base Damage PvE/WvW+PvP split (1.8/1.2); a SEPARATE
  // always-listed "Damage to Controlled or Defiant Foes" fact also PvE/WvW+PvP split (2.7/1.82) —
  // not trait-gated, just the API's own dual-mode duplication of a same-named fact.
  14386: [
    { factText: 'Damage', coefficient: 1.2, weapon: 'hammer' },
    { factText: 'Damage to Controlled or Defiant Foes', coefficient: 1.82, weapon: 'hammer' }
  ],
  // Warrior — Axe 3, Throw Axe. No split (0.85 applies to all modes; only the health-threshold
  // damage-increase bonuses split by mode, not modeled here).
  14398: [{ factText: 'Damage', coefficient: 0.85, weapon: 'axe' }],
  // Warrior — Sword 5, Riposte. No split.
  14400: [{ factText: 'Damage', coefficient: 1.0, weapon: 'sword' }],
  // Warrior — Mace 5, Tremor. PvE/WvW+PvP split (1.25/0.01) — steep competitive nerf.
  14415: [{ factText: 'Damage', coefficient: 0.01, weapon: 'mace' }],
  // Warrior — Rifle 2, Volley. `strikes=5` present -> wiki totaled. PvE/WvW+PvP split (4.0/2.5).
  14416: [{ factText: 'Damage', coefficient: 2.5, weapon: 'rifle' }],
  // Warrior — Axe 4, Dual Strike. `strikes=2` present -> wiki totaled. Infobox declares
  // "split = pve, wvw pvp" but the damage fact itself only tags "pve"/"pvp" (2.35/2.0) — WvW groups
  // with the pvp-tagged value per the infobox's own split declaration.
  14418: [{ factText: 'Damage', coefficient: 2.0, weapon: 'axe' }],
  // Warrior — Axe 2, Cyclone Axe. `strikes=2` present -> wiki totaled. PvE/WvW+PvP split (1.76/1.5).
  14421: [{ factText: 'Damage', coefficient: 1.5, weapon: 'axe' }],
  // Warrior — Longbow 1, Dual Shot. `strikes=2` present -> wiki totaled. PvE/WvW+PvP split
  // (1.05/0.586).
  14431: [{ factText: 'Damage', coefficient: 0.586, weapon: 'longbow' }],
  // Warrior — Rifle 1, Fierce Shot. PvE/WvW+PvP split (1.0/0.46). Trait 1329 (Crack Shot, Discipline)
  // gives Fierce Shot its own explicit wiki-quoted +10% damage bonus — trait-gated WvW variant:
  // 0.46*1.10=0.506 (matches API's own traited `dmg_multiplier` exactly).
  14432: [
    { factText: 'Damage', coefficient: 0.46, weapon: 'rifle' },
    { factText: 'Damage', coefficient: 0.506, weapon: 'rifle', requiresTrait: 1329 }
  ],
  // Warrior — Spear 1 (aquatic autoattack), Stab. No split. Trait 1338 (Forceful Greatsword,
  // Strength) gated variant: 0.8*1.10=0.88 (matches API exactly) — see block comment above re: 1338.
  14437: [
    { factText: 'Damage', coefficient: 0.8, weapon: 'spear' },
    { factText: 'Damage', coefficient: 0.88, weapon: 'spear', requiresTrait: 1338 }
  ],
  // Warrior — Spear 2, Mariner's Frenzy. No split. Trait 1338 variants: 0.35*1.10=0.385,
  // 0.5*1.10=0.55 (both match API exactly).
  14440: [
    { factText: 'Damage', coefficient: 0.35, weapon: 'spear' },
    { factText: 'Final Strike Damage', coefficient: 0.5, weapon: 'spear' },
    { factText: 'Damage', coefficient: 0.385, weapon: 'spear', requiresTrait: 1338 },
    { factText: 'Final Strike Damage', coefficient: 0.55, weapon: 'spear', requiresTrait: 1338 }
  ],
  // Warrior — Spear 4, Parry. No split. Trait 1338 variant: 2.0*1.10=2.2 (matches API exactly).
  14441: [
    { factText: 'Damage', coefficient: 2.0, weapon: 'spear' },
    { factText: 'Damage', coefficient: 2.2, weapon: 'spear', requiresTrait: 1338 }
  ],
  // Warrior — Greatsword 5, Rush. PvE/WvW+PvP split (2.5/1.36).
  14446: [{ factText: 'Damage', coefficient: 1.36, weapon: 'greatsword' }],
  // Warrior — Greatsword 3, Whirlwind Attack. PvE/WvW+PvP split (0.665/0.333). Per-hit value
  // (variable actual hit count depending on target distance/size, API hit_count=1) — not totaled.
  14447: [{ factText: 'Damage', coefficient: 0.333, weapon: 'greatsword' }],
  // Warrior — Spear 3, Barbed Pull. No split. Trait 1338 variant: 1.0*1.10=1.1 (matches API exactly).
  14448: [
    { factText: 'Damage', coefficient: 1.0, weapon: 'spear' },
    { factText: 'Damage', coefficient: 1.1, weapon: 'spear', requiresTrait: 1338 }
  ],
  // Warrior — Speargun 5, Repeating Shot. `strikes=4` present -> wiki totaled (3.0). No split.
  14465: [{ factText: 'Damage', coefficient: 3.0, weapon: 'harpoon gun' }],
  // Warrior — Speargun 2, Puncture Shot (warrior). No split.
  14466: [{ factText: 'Damage', coefficient: 0.5, weapon: 'harpoon gun' }],
  // Warrior — Speargun 4, Knot Shot. No split.
  14467: [{ factText: 'Damage', coefficient: 0.5, weapon: 'harpoon gun' }],
  // Warrior — Rifle 3, Explosive Shell. PvE/WvW+PvP split (1.6/1.09).
  14472: [{ factText: 'Damage', coefficient: 1.09, weapon: 'rifle' }],
  // Warrior — Spear 5, Tsunami Slash. No split. No `strikes=` param despite multiple possible
  // strikes (API hit_count=1, "Number of Strikes" is a separate variable-hit-count fact) — per-hit
  // value used as-is, not totaled. Trait 1338 variant: 0.4*1.10=0.44 (matches API exactly).
  14480: [
    { factText: 'Damage per Strike', coefficient: 0.4, weapon: 'spear' },
    { factText: 'Damage per Strike', coefficient: 0.44, weapon: 'spear', requiresTrait: 1338 }
  ],
  // Warrior — Speargun 3, Split Shot. No split.
  14481: [{ factText: 'Damage', coefficient: 0.2, weapon: 'harpoon gun' }],
  // Warrior — Hammer 3, Hammer Shock. PvE/WvW+PvP split (1.8/1.13).
  14482: [{ factText: 'Damage', coefficient: 1.13, weapon: 'hammer' }],
  // Warrior — Sword 4, Impale (warrior sword skill, id 14498 — distinct from the spear-chain
  // Impale, id 14439, which is not a bar-bound skill). PvE+WvW grouped vs. a lower PvP value
  // (1.5/1.2) — the PvE+WvW value is used.
  14498: [{ factText: 'Damage', coefficient: 1.5, weapon: 'sword' }],
  // Warrior — Mace 3, Pommel Bash. No split.
  14503: [{ factText: 'Damage', coefficient: 0.4, weapon: 'mace' }],
  // Warrior — Longbow 5, Pin Down. No split.
  14504: [{ factText: 'Damage', coefficient: 0.44, weapon: 'longbow' }],
  // Warrior — Longbow 4, Smoldering Arrow. No split.
  14505: [{ factText: 'Damage', coefficient: 0.2, weapon: 'longbow' }],
  // Warrior — Mace 2, Counterblow. PvE/WvW+PvP split (2.0/1.35) — the 2 identical-text base facts
  // the API exposes are just this same PvE/WvW duplication, not 2 distinct mechanics.
  14507: [{ factText: 'Damage', coefficient: 1.35, weapon: 'mace' }],
  // Warrior — Greatsword 4, Bladetrail. PvE/WvW+PvP split (1.5/0.75).
  14510: [{ factText: 'Damage', coefficient: 0.75, weapon: 'greatsword' }],
  // Warrior — Hammer 5, Backbreaker. PvE/WvW+PvP split (2.25/0.01) — steep competitive nerf.
  14511: [{ factText: 'Damage', coefficient: 0.01, weapon: 'hammer' }],
  // Warrior — Mace 4, Crushing Blow. PvE/WvW+PvP split (2.25/1.75).
  14518: [{ factText: 'Damage', coefficient: 1.75, weapon: 'mace' }],
  // Warrior — Longbow 2, Fan of Fire. `strikes=3` present -> wiki totaled (1.32). No split.
  14519: [{ factText: 'Damage', coefficient: 1.32, weapon: 'longbow' }],
  // Warrior — Greatsword 2, Hundred Blades. `strikes=8` present -> wiki totaled. 3-way split
  // pve/wvw/pvp (6.2/2.8/3.2) — WvW value used. Final Strike Damage also 3-way split (1.5/0.8/1.0),
  // single hit, no totaling — WvW value used.
  14554: [
    { factText: 'Damage', coefficient: 2.8, weapon: 'greatsword' },
    { factText: 'Final Strike Damage', coefficient: 0.8, weapon: 'greatsword' }
  ],
  // Warrior/Berserker — Torch 4, Blaze Breaker. `strikes=5` present -> wiki totaled (2.0). No split.
  29845: [{ factText: 'Damage', coefficient: 2.0, weapon: 'torch' }],
  // Warrior/Berserker — Torch 5, Flames of War. No split.
  29940: [{ factText: 'Damage', coefficient: 1.0, weapon: 'torch' }],
  // Warrior — Rifle 4, Brutal Shot. PvE/WvW+PvP split (1.0/0.4) — the 2 identical-text base facts
  // are this same duplication, not a distinct mechanic.
  34296: [{ factText: 'Damage', coefficient: 0.4, weapon: 'rifle' }],
  // Warrior/Spellbreaker — Dagger 1, Precise Cut. PvE/WvW+PvP split (0.6/0.32).
  42745: [{ factText: 'Damage', coefficient: 0.32, weapon: 'dagger' }],
  // Warrior/Spellbreaker — Dagger 4, Wastrel's Ruin. PvE/WvW+PvP split (1.5/1.0).
  44004: [{ factText: 'Damage', coefficient: 1.0, weapon: 'dagger' }],
  // Warrior/Spellbreaker — Dagger 3, Disrupting Stab. PvE/WvW+PvP split (1.2/0.4).
  44937: [{ factText: 'Damage', coefficient: 0.4, weapon: 'dagger' }],
  // Warrior/Spellbreaker — Dagger 5, Hushblade. PvE/WvW+PvP split (1.5/1.0).
  45160: [{ factText: 'Damage', coefficient: 1.0, weapon: 'dagger' }],
  // Warrior/Spellbreaker — Dagger 2, Aura Slicer. 3-way split pve/wvw/pvp (1.8/1.32/1.45) — WvW used.
  46233: [{ factText: 'Damage', coefficient: 1.32, weapon: 'dagger' }],
  // Warrior/Bladesworn — Pistol 4, Gunstinger. No split on the damage fact itself.
  62697: [{ factText: 'Damage', coefficient: 0.9, weapon: 'pistol' }],
  // Warrior/Bladesworn — Pistol 5, Dragon's Roar. PvE/WvW+PvP split (0.75/0.333) on the per-bullet
  // value; an ammo-consumption mechanic (up to 6 bullets), not a `strikes=` multi-hit — API
  // hit_count=1, so not totaled, used per-bullet as-is.
  62800: [{ factText: 'Damage per Bullet', coefficient: 0.333, weapon: 'pistol' }],
  // Warrior — Staff 2, Valiant Leap. PvE/WvW+PvP split (1.25/0.75).
  72002: [{ factText: 'Damage', coefficient: 0.75, weapon: 'staff' }],
  // Warrior — Staff 1, Balanced Strike. PvE/WvW+PvP split (0.7/0.5).
  72024: [{ factText: 'Damage', coefficient: 0.5, weapon: 'staff' }],
  // Warrior — Staff 4, Snap Pull. PvE/WvW+PvP split (1.5/0.01) — steep competitive nerf.
  72026: [{ factText: 'Damage', coefficient: 0.01, weapon: 'staff' }],
  // Warrior — Spear 2 (land, Janthir Wilds), Maiming Spear. 3-way split pve/wvw/pvp on both facts:
  // Initial Strike Damage (1.1/0.7/1.0), Aftershock Damage (0.75/0.3/0.5) — WvW used.
  72897: [
    { factText: 'Initial Strike Damage', coefficient: 0.7, weapon: 'spear' },
    { factText: 'Aftershock Damage', coefficient: 0.3, weapon: 'spear' }
  ],
  // Warrior — Spear 1 (land), Mighty Throw. PvE/WvW+PvP split on both facts: Spear Damage
  // (1.2/0.45), Shard Damage (0.9/0.37) — WvW used.
  72958: [
    { factText: 'Spear Damage', coefficient: 0.45, weapon: 'spear' },
    { factText: 'Shard Damage', coefficient: 0.37, weapon: 'spear' }
  ],
  // Warrior — Spear 3 (land), Disrupting Throw. PvE/WvW+PvP split (2.0/1.5).
  72959: [{ factText: 'Damage', coefficient: 1.5, weapon: 'spear' }],
  // Warrior — Spear 4 (land), Spearmarshal's Support. `strikes=7` present -> wiki totaled. 3-way
  // split pve/wvw/pvp (2.8/1.5/1.75) — WvW used.
  72992: [{ factText: 'Damage', coefficient: 1.5, weapon: 'spear' }],
  // Warrior — Spear 5 (land), Spear Swipe. PvE/WvW+PvP split (1.5/0.01) — steep competitive nerf.
  73009: [{ factText: 'Damage', coefficient: 0.01, weapon: 'spear' }],
  // Warrior — Sword 3, Rend (formerly Final Thrust). Base Damage no split (0.5). Follow-Up Damage
  // PvE/WvW+PvP split (2.5/1.25) — WvW used. The 2 "Follow-Up Damage" facts are this same PvE/WvW
  // duplication, not trait-gated (confirmed via live API: no requires_trait on either).
  80247: [
    { factText: 'Damage', coefficient: 0.5, weapon: 'sword' },
    { factText: 'Follow-Up Damage', coefficient: 1.25, weapon: 'sword' }
  ],

  // --- Guardian done: 60 raw candidate ids resolved via the app's own `resolveSkillBarIds`/
  // `weaponSkillIdsForPair` (brute-forced across every main/off weapon pairing, both environments,
  // and all 4 elite specs — Dragonhunter, Firebrand, Willbender, Luminary), 54 carry a Damage fact;
  // 53 curated here (the 54th, Symbol of Blades id 9097, was already seeded 2026-08-02 — see the
  // one-per-profession seed block above). 6 excluded as non-damage (Shield of Absorption, Zealot's
  // Flame, Line of Warding, Ring of Warding, Refraction, Empower — block/CC/buff skills with no
  // Damage fact at all). Surfaced a fresh duplicate-id bug matching the skill-picker duplicate-id
  // audit's known shape (2026-08-04): Shield's Weapon_4 has 2 identical-fact ids (15834/9087) with
  // nothing to disambiguate them, and `resolveSkillBarIds`'s `candidates[0]` fallback was picking
  // 15834 (not the wiki-documented 9087) — 15834 moved to `skill-variant-exclusions.json`, curated
  // here under 9087. Added a `trident` key to `WEAPON_STRENGTH_MIDPOINTS` (Guardian is the first profession
  // swept with real Trident weapon-skill damage candidates; 1000 midpoint, same as every other
  // aquatic weapon type per the wiki's own footnote — see that map's comment).
  //
  // Note on Guardian's Symbol family (Symbol of Punishment/Blades/Faith/Swiftness/Resolution/
  // Spears/Light/Vengeance/Ignition/Luminance): the local API's `traitedFacts` carries an alternate,
  // higher Damage value on all of these gated by `requires_trait: 649` (Symbolic Avenger). Unlike
  // every other `requiresTrait` entry elsewhere in this table (a flat, deterministic "if this trait
  // is chosen, this bonus always applies" bump — e.g. Warrior's Forceful Greatsword), Symbolic
  // Avenger is a **Minor** Zeal trait granting a *stacking combat buff* ("deal increased damage per
  // stack [of a buff also named Symbolic Avenger], up to 5 stacks") — its traitedFacts values don't
  // correspond to a build-choice bonus this app's static loadout model can represent, they're an
  // API preview assuming some unspecified stack count of a runtime buff (confirmed non-flat: the
  // traited/base ratio varies per skill — 1.2x, 1.3x — where a real flat-bonus trait like Forceful
  // Greatsword is a consistent 1.10x everywhere it appears). Deliberately NOT modeled as
  // `requiresTrait` entries here — same "documented known limitation, not a silent guess" bucket as
  // Weaver's dual-attunement gap and the Familiar/Legend items. Only the base (untraited) coefficient
  // is curated for these skills.
  // Guardian — Greatsword 3, Leap of Faith. PvE/WvW+PvP split (2.0/1.25).
  9080: [{ factText: 'Damage', coefficient: 1.25, weapon: 'greatsword' }],
  // Guardian — Greatsword 2, Whirling Wrath. Base Damage PvE/WvW+PvP split (2.45/2.8), strikes=7.
  // Projectile Damage PvE/WvW+PvP split (0.275/0.1).
  9081: [
    { factText: 'Damage', coefficient: 2.8, weapon: 'greatsword' },
    { factText: 'Projectile Damage', coefficient: 0.1, weapon: 'greatsword' }
  ],
  // Guardian — Focus 5, Shield of Wrath. PvE/WvW+PvP split (2.5/1.66).
  9082: [{ factText: 'Damage', coefficient: 1.66, weapon: 'focus' }],
  // Guardian — Mace 3, Protector's Strike. PvE/WvW+PvP split (2.0/1.5).
  9086: [{ factText: 'Damage', coefficient: 1.5, weapon: 'mace' }],
  // Guardian — Shield 4, Shield of Judgment (id fixed, see block comment above). PvE/WvW+PvP split
  // (1.0/0.67).
  9087: [{ factText: 'Damage', coefficient: 0.67, weapon: 'shield' }],
  // Guardian — Torch 5, Cleansing Flame. strikes=10 present -> wiki totaled. PvE/WvW+PvP split
  // (4.0/2.8).
  9088: [{ factText: 'Damage', coefficient: 2.8, weapon: 'torch' }],
  // Guardian — Scepter 2, Symbol of Punishment. Base Damage 3-way split (0.2/0.28/0.33), uses wvw
  // (0.28). Symbol Damage 3-way split (0.5/0.28/0.45), uses wvw (0.28).
  9090: [
    { factText: 'Damage', coefficient: 0.28, weapon: 'scepter' },
    { factText: 'Symbol Damage', coefficient: 0.28, weapon: 'scepter' }
  ],
  // Guardian — Sword 2, Symbol of Blades. Already curated in the one-per-profession seed above
  // (id 9097) — local API `hit_count: 5` despite the current wiki page carrying no `strikes=` param
  // on the fact (an older wiki edit apparently dropped it); seed entry already totals the WvW value
  // by 5 correctly (0.45*5=2.25), not re-curated here to avoid a duplicate object key.
  // Guardian — Scepter 1, Orb of Wrath. PvE/WvW+PvP split (0.6/0.444).
  9098: [{ factText: 'Damage', coefficient: 0.444, weapon: 'scepter' }],
  // Guardian — Scepter 3, Chains of Light. No split (0.25).
  9099: [{ factText: 'Damage', coefficient: 0.25, weapon: 'scepter' }],
  // Guardian — Sword 1, Sword of Wrath. PvE/WvW+PvP split (0.75/0.444). Chain-starter (chain1=Sword
  // of Wrath).
  9105: [{ factText: 'Damage', coefficient: 0.444, weapon: 'sword' }],
  // Guardian — Sword 3, Zealot's Defense. strikes=8 present -> wiki totaled. PvE/WvW+PvP split
  // (4.8/1.76).
  9107: [{ factText: 'Damage', coefficient: 1.76, weapon: 'sword' }],
  // Guardian — Mace 1, True Strike. PvE/WvW+PvP split (0.8/0.533). Chain-starter (chain1=True
  // Strike).
  9109: [{ factText: 'Damage', coefficient: 0.533, weapon: 'mace' }],
  // Guardian — Mace 2, Symbol of Faith. strikes=5 present -> wiki totaled. PvE/WvW+PvP split
  // (3.25/2.25).
  9111: [{ factText: 'Damage', coefficient: 2.25, weapon: 'mace' }],
  // Guardian — Focus 4, Ray of Judgment. strikes=6 present -> wiki totaled. PvE/WvW+PvP split
  // (4.05/1.26).
  9112: [{ factText: 'Damage', coefficient: 1.26, weapon: 'focus' }],
  // Guardian — Staff 1, Bolt of Wrath. PvE/WvW+PvP split (0.65/0.366). Chain-starter (chain1=Bolt of
  // Wrath).
  9122: [{ factText: 'Damage', coefficient: 0.366, weapon: 'staff' }],
  // Guardian — Hammer 4, Banish. PvE/WvW+PvP split (3.0/0.01).
  9124: [{ factText: 'Damage', coefficient: 0.01, weapon: 'hammer' }],
  // Guardian — Greatsword 1, Strike. PvE/WvW+PvP split (1.0/0.533). Chain-starter (chain1=Strike).
  9137: [{ factText: 'Damage', coefficient: 0.533, weapon: 'greatsword' }],
  // Guardian — Staff 2, Holy Strike. 3-way split (1.8/0.73/1.25), uses wvw (0.73).
  9140: [{ factText: 'Damage', coefficient: 0.73, weapon: 'staff' }],
  // Guardian — Staff 3, Symbol of Swiftness. strikes=5 present -> wiki totaled. 3-way split
  // (2.5/1.25/2.0), uses wvw (1.25).
  9143: [{ factText: 'Damage', coefficient: 1.25, weapon: 'staff' }],
  // Guardian — Greatsword 4, Symbol of Resolution. Initial Damage no split (0.8). Symbol Damage
  // strikes=4 present -> wiki totaled, PvE/WvW+PvP split (2.60/1.60).
  9146: [
    { factText: 'Initial Damage', coefficient: 0.8, weapon: 'greatsword' },
    { factText: 'Symbol Damage', coefficient: 1.6, weapon: 'greatsword' }
  ],
  // Guardian — Greatsword 5, Binding Blade. PvE/WvW+PvP split (2.5/0.01).
  9147: [{ factText: 'Damage', coefficient: 0.01, weapon: 'greatsword' }],
  // Guardian — Hammer 1, Hammer Swing. PvE/WvW+PvP split (0.8/0.533). Chain-starter
  // (chain1=Hammer Swing (guardian skill)).
  9159: [{ factText: 'Damage', coefficient: 0.533, weapon: 'hammer' }],
  // Guardian — Spear 1 (aquatic autoattack), Spear of Light. No split; Maximum Damage (1.0),
  // Minimum Damage (0.6).
  9189: [
    { factText: 'Maximum Damage', coefficient: 1.0, weapon: 'spear' },
    { factText: 'Minimum Damage', coefficient: 0.6, weapon: 'spear' }
  ],
  // Guardian — Spear 2 (aquatic), Zealot's Flurry. `strikes=8` present -> wiki totaled. No split
  // (2.4).
  9190: [{ factText: 'Damage', coefficient: 2.4, weapon: 'spear' }],
  // Guardian — Spear 3 (aquatic), Brilliance. No split (2.0).
  9191: [{ factText: 'Damage', coefficient: 2.0, weapon: 'spear' }],
  // Guardian — Spear 4 (aquatic), Symbol of Spears. No split (0.8).
  9192: [{ factText: 'Damage', coefficient: 0.8, weapon: 'spear' }],
  // Guardian — Spear 5 (aquatic), Wrathful Grasp. No split (1.0).
  9193: [{ factText: 'Damage', coefficient: 1.0, weapon: 'spear' }],
  // Guardian — Hammer 2, Mighty Blow. 3-way split (2.4/1.82/1.65), uses wvw (1.82).
  9194: [{ factText: 'Damage', coefficient: 1.82, weapon: 'hammer' }],
  // Guardian — Trident 1, Light Ball. No split (0.5). Chain-starter (chain1=Light Ball).
  9205: [{ factText: 'Damage', coefficient: 0.5, weapon: 'trident' }],
  // Guardian — Trident 5, Weight of Justice. strikes=4 present -> wiki totaled. No split (2.0).
  9206: [{ factText: 'Damage', coefficient: 2.0, weapon: 'trident' }],
  // Guardian — Trident 2, Purify. No split (1.25).
  9207: [{ factText: 'Damage', coefficient: 1.25, weapon: 'trident' }],
  // Guardian — Trident 3, Symbol of Light. strikes=6 present -> wiki totaled. No split (2.4).
  9208: [{ factText: 'Damage', coefficient: 2.4, weapon: 'trident' }],
  // Guardian — Hammer 3, Zealot's Embrace. 3-way split (2.25/1.2/1.0), uses wvw (1.2).
  9260: [{ factText: 'Damage', coefficient: 1.2, weapon: 'hammer' }],
  // Guardian — Longbow 3, Deflecting Shot. PvE/WvW+PvP split (1.8/0.01).
  29630: [{ factText: 'Damage', coefficient: 0.01, weapon: 'longbow' }],
  // Guardian — Longbow 4, Symbol of Energy. Initial Damage PvE/WvW+PvP split (1.38/0.86). Symbol
  // Damage PvE/WvW+PvP split (0.5175/0.43).
  29789: [
    { factText: 'Initial Damage', coefficient: 0.86, weapon: 'longbow' },
    { factText: 'Symbol Damage', coefficient: 0.43, weapon: 'longbow' }
  ],
  // Guardian — Longbow 2, True Shot. PvE/WvW+PvP split (2.8/1.7).
  30229: [{ factText: 'Damage', coefficient: 1.7, weapon: 'longbow' }],
  // Guardian — Longbow 1, Puncture Shot. PvE/WvW+PvP split (1.0/0.566).
  30471: [{ factText: 'Damage', coefficient: 0.566, weapon: 'longbow' }],
  // Guardian — Longbow 5, Hunter's Ward. Initial Damage PvE/WvW+PvP split (0.75/0.1). Final Impact
  // Damage 3-way split (2.5/1.333/1.666), uses wvw (1.333).
  30628: [
    { factText: 'Initial Damage', coefficient: 0.1, weapon: 'longbow' },
    { factText: 'Final Impact Damage', coefficient: 1.333, weapon: 'longbow' }
  ],
  // Guardian — Axe 2, Symbol of Vengeance. strikes=5 present -> wiki totaled. PvE/WvW+PvP split
  // (3.0/2.25).
  40624: [{ factText: 'Damage', coefficient: 2.25, weapon: 'axe' }],
  // Guardian — Axe 1, Core Cleave. strikes=2 present -> wiki totaled. PvE/WvW+PvP split
  // (0.72/0.48). Chain-starter (chain1=Core Cleave).
  45047: [{ factText: 'Damage', coefficient: 0.48, weapon: 'axe' }],
  // Guardian — Axe 3 (Firebrand), Blazing Edge. Infobox declares a 3-way split but the Damage fact
  // itself only tags PvE/WvW+PvP grouped (0.8/0.01) — WvW value used.
  45402: [{ factText: 'Damage', coefficient: 0.01, weapon: 'axe' }],
  // Guardian — Sword 4, Executioner's Calling. Base Damage PvE/WvW+PvP grouped split (1.25/0.4).
  // Secondary Attacks strikes=4 present -> wiki totaled, 3-way split (2.5/1.6/1.32), uses wvw (1.6).
  62525: [
    { factText: 'Damage', coefficient: 0.4, weapon: 'sword' },
    { factText: 'Secondary Attacks', coefficient: 1.6, weapon: 'sword' }
  ],
  // Guardian — Sword 5, Advancing Strike. strikes=2 present -> wiki totaled. 3-way split
  // (3.5/1.0/0.9), uses wvw (1.0).
  62650: [{ factText: 'Damage', coefficient: 1.0, weapon: 'sword' }],
  // Guardian — Pistol 5, Jurisdiction. PvE/WvW+PvP split (3.0/0.01).
  71817: [{ factText: 'Damage', coefficient: 0.01, weapon: 'pistol' }],
  // Guardian — Pistol 4, Hail of Justice. strikes=5 present -> wiki totaled. No split (1.5).
  71918: [{ factText: 'Damage', coefficient: 1.5, weapon: 'pistol' }],
  // Guardian — Pistol 2, Peacekeeper. strikes=5 present -> wiki totaled. No split (1.25).
  71968: [{ factText: 'Damage', coefficient: 1.25, weapon: 'pistol' }],
  // Guardian — Pistol 3, Symbol of Ignition. strikes=5 present -> wiki totaled. No split (2.0).
  71987: [{ factText: 'Damage', coefficient: 2.0, weapon: 'pistol' }],
  // Guardian — Pistol 1, Through the Heart. PvE/WvW+PvP split (0.6/0.35).
  72031: [{ factText: 'Damage', coefficient: 0.35, weapon: 'pistol' }],
  // Guardian — Spear 2 (land, Janthir Wilds Weaponmaster Training kit), Helio Rush. Infobox
  // declares a 3-way split but the Damage fact itself only tags PvE/WvW+PvP grouped (1.5/0.8) —
  // WvW value used.
  72940: [{ factText: 'Damage', coefficient: 0.8, weapon: 'spear' }],
  // Guardian — Spear 3 (land, Janthir Wilds), Gleaming Disc. Base Damage 3-way split
  // (1.5/1.0/0.7) — WvW used. Shock-Wave Damage PvE/WvW+PvP split (1.5/1.0).
  72978: [
    { factText: 'Damage', coefficient: 1.0, weapon: 'spear' },
    { factText: 'Shock-Wave Damage', coefficient: 1.0, weapon: 'spear' }
  ],
  // Guardian — Spear 1 (land, Janthir Wilds), Daybreaking Slash. PvE/WvW+PvP split (0.7/0.5).
  73055: [{ factText: 'Damage', coefficient: 0.5, weapon: 'spear' }],
  // Guardian — Spear 4 (land, Janthir Wilds), Solar Storm. Base Damage 3-way split
  // (1.5/0.65/0.85) — WvW used. Minimum Damage PvE/WvW+PvP split (0.12/0.10).
  73094: [
    { factText: 'Damage', coefficient: 0.65, weapon: 'spear' },
    { factText: 'Minimum Damage', coefficient: 0.1, weapon: 'spear' }
  ],
  // Guardian — Spear 5 (land, Janthir Wilds), Symbol of Luminance. Initial Damage PvE/WvW+PvP split
  // (1.5/0.01). Symbol Damage PvE/WvW+PvP split (0.5/0.4).
  73132: [
    { factText: 'Initial Damage', coefficient: 0.01, weapon: 'spear' },
    { factText: 'Symbol Damage', coefficient: 0.4, weapon: 'spear' }
  ],

  // --- Revenant done: 68 raw candidate ids resolved via the app's own `resolveSkillBarIds`/
  // `weaponSkillIdsForPair` (Core plus Herald/Renegade/Vindicator, both environments, including the new
  // land Spear kit added by the 2025-08-19 Janthir Wilds "Weaponmaster Training" update) — 58 assigned
  // for wiki verification this leg, 9 confirmed locally as real non-damage skills with no Damage-type
  // fact at all (block/heal/boon/toggle: Crystal Hibernation 28262, Duelist's Preparation 28571,
  // Renewing Wave 29321, Envoy of Exuberance 29386, Imperial Guard 62921, Deactivate Otherworldly Bond
  // 71858, Otherworldly Bond 71952, Detonate Blossoming Aura 72109, Abyssal Blitz 72938), and 1 already
  // seeded (Coalescence of Ruin, id 28253, one-per-profession seed block above). Of the 58, 57 curated
  // here; Scorchrazor (id 41820) is the 1 exclusion — its wiki page (title "Scorchrazor", last edited
  // 2025-07-15) quotes a PvE coefficient of 0.3, but both the live and local API's own PvE
  // `dmg_multiplier` is 1 (every other candidate this leg's local PvE value matches its wiki-quoted PvE
  // number exactly, ruling out a fetch/transcription error here) — the wiki page is simply stale, and
  // since its WvW-tagged 0.01 can't be independently trusted either, this one is left uncurated rather
  // than guessed (same "documented gap, not a silent guess" policy as this table's other known
  // limitations).
  //
  // This leg introduced 3-stage flip chains (chainDepth 0/1/2, not just the 2-stage flips seen so far):
  // Mace 1 (Misery Swipe -> Anguish Swipe -> Manifest Toxin), Sword 1 (Preparation Thrust -> Brutal
  // Blade -> Rift Slash), Staff 1 (Rapid Swipe -> Forceful Bash -> Rejuvenating Assault), Scepter 1
  // (Serene Slash -> Acerbic Cut -> Motivating Whirl), and Greatsword 1 (Mist Swing -> Mist Slash ->
  // Arcing Mists) — every stage gets its own independently wiki-verified entry below, per this leg's
  // task instructions (the app's `FlipSkillStack` gives each depth its own always-visible tooltip).
  // Two Deathstrike ids (27074 "Initial Damage"/stage 1, 28625 "Final Strike Damage"/stage 2) share one
  // display name but are 2 separate wiki pages ("Deathstrike" and "Deathstrike (second skill)"), each
  // with its own coefficient — both curated separately below. True Strike (id 62828, Vindicator
  // Greatsword, flip-target of the excluded Imperial Guard) is a *different* skill from Guardian's
  // Mace 1 True Strike (id 9109, already curated above) — landed on the wiki's own disambiguated "True
  // Strike (vindicator)" page via id search, confirmed distinct via its own otheruses hatnote pointing
  // back at Guardian's page. Unrelenting Assault (26699) confirmed via id search to be the real player
  // Revenant Sword 3 skill, not one of the several non-player enemy-skill-id collisions sharing its
  // name in the raw data (Mai Trin's and Zane's versions, both disambiguated on-wiki). 4 ids here
  // (Manifest Toxin, Unrelenting Assault, Rift Slash, Surge of the Mists) surfaced the same "2 facts
  // sharing one factText are just the API's own PvE/WvW duplication, not 2 distinct mechanics" pattern
  // already documented in the Warrior/Guardian blocks above — one curated entry per distinct factText,
  // not two. Abyssal Blot (72954) needed a similar derivation: its wiki page only tags a WvW/PvP value
  // for the split-out "Initial Attack Damage"/"Pulse Damage" facts (added in a 2024-09-10 edit), not
  // for the older un-split "Damage" (5-hit total) fact it still carries in PvE — that fact's WvW value
  // is derived as Initial Attack Damage + Pulse Damage total (0.01+0.90=0.91), the same identity
  // confirmed exactly in PvE (0.4+1.6=2.0 matches the wiki's own pve Damage=2.0).
  // Revenant — Mace 1 (chain depth 0), Misery Swipe. PvE/WvW+PvP split (0.35/0.233).
  27066: [{ factText: 'Damage', coefficient: 0.233, weapon: 'mace' }],
  // Revenant — Mace 1 (chain depth 1), Anguish Swipe. PvE/WvW+PvP split (0.4/0.266).
  26730: [{ factText: 'Damage', coefficient: 0.266, weapon: 'mace' }],
  // Revenant — Mace 1 (chain depth 2), Manifest Toxin. 2 distinct facts, each PvE/WvW+PvP split: Damage
  // (0.6/0.4), Chaining Damage (0.3/0.2) — WvW used for each (duplicate-fact pattern, see block comment
  // above).
  26666: [
    { factText: 'Damage', coefficient: 0.4, weapon: 'mace' },
    { factText: 'Chaining Damage', coefficient: 0.2, weapon: 'mace' }
  ],
  // Revenant — Mace 2, Searing Fissure. Initial Strike no split (0.5). Additional Strikes no split; no
  // `strikes=` param despite 3 additional pulses (API/local hit_count=3, "Pulses" fact=4 total = 1
  // initial + 3 additional) — per-hit value totaled here: 0.25*3=0.75.
  28357: [
    { factText: 'Initial Strike', coefficient: 0.5, weapon: 'mace' },
    { factText: 'Additional Strikes', coefficient: 0.75, weapon: 'mace' }
  ],
  // Revenant — Mace 3, Echoing Eruption. No split (1.0).
  27964: [{ factText: 'Damage', coefficient: 1.0, weapon: 'mace' }],
  // Revenant — Sword 1 (chain depth 0), Preparation Thrust. PvE/WvW+PvP split (0.75/0.466).
  29057: [{ factText: 'Damage', coefficient: 0.466, weapon: 'sword' }],
  // Revenant — Sword 1 (chain depth 1), Brutal Blade. PvE/WvW+PvP split (0.8/0.535).
  29256: [{ factText: 'Damage', coefficient: 0.535, weapon: 'sword' }],
  // Revenant — Sword 1 (chain depth 2), Rift Slash. 2 distinct facts, each PvE/WvW+PvP split: Damage
  // (0.9/0.7), Rift Damage (0.2175/0.145) — WvW used for each (duplicate-fact pattern, see block
  // comment above).
  28964: [
    { factText: 'Damage', coefficient: 0.7, weapon: 'sword' },
    { factText: 'Rift Damage', coefficient: 0.145, weapon: 'sword' }
  ],
  // Revenant — Sword 2, Chilling Isolation. Base Damage PvE/WvW+PvP split (0.8/0.7). Isolated Damage
  // PvE/WvW+PvP split (1.6/0.9).
  29233: [
    { factText: 'Damage', coefficient: 0.7, weapon: 'sword' },
    { factText: 'Isolated Damage', coefficient: 0.9, weapon: 'sword' }
  ],
  // Revenant — Sword 3, Unrelenting Assault. PvE/WvW+PvP split (0.7865/0.38) — the 2 identical-text
  // base facts the API exposes are this same duplication (see block comment above).
  26699: [{ factText: 'Damage', coefficient: 0.38, weapon: 'sword' }],
  // Revenant — Sword 4, Shackling Wave. Initial Damage PvE/WvW+PvP split (1.2/0.1). Additional Strikes
  // `strikes=5` present -> wiki totaled, PvE/WvW+PvP split (2.0/1.0).
  28472: [
    { factText: 'Initial Damage', coefficient: 0.1, weapon: 'sword' },
    { factText: 'Additional Strikes', coefficient: 1.0, weapon: 'sword' }
  ],
  // Revenant — Sword 5 (chain depth 0), Deathstrike. "Initial Damage" fact; split header declares
  // pve/wvw+pvp but the fact itself only tags pve/pvp explicitly (0.45/0.1) — wvw groups with the
  // pvp-tagged value per the header's own split declaration (same reasoning as Warrior's Dual Strike
  // precedent).
  27074: [{ factText: 'Initial Damage', coefficient: 0.1, weapon: 'sword' }],
  // Revenant — Sword 5 (chain depth 1), Deathstrike (second skill, distinct wiki page — see block
  // comment above). "Final Strike Damage" fact, PvE/WvW+PvP split (2.67/1.7).
  28625: [{ factText: 'Final Strike Damage', coefficient: 1.7, weapon: 'sword' }],
  // Revenant — Hammer 1, Hammer Bolt. PvE/WvW+PvP split (0.9/0.5).
  28549: [{ factText: 'Damage', coefficient: 0.5, weapon: 'hammer' }],
  // Revenant — Hammer 3, Phase Smash. 3-way split (2.2/1.1/1.36), uses wvw (1.1).
  27976: [{ factText: 'Damage', coefficient: 1.1, weapon: 'hammer' }],
  // Revenant — Hammer 4, Field of the Mists. PvE/WvW+PvP split (1.8/1.1).
  27665: [{ factText: 'Damage', coefficient: 1.1, weapon: 'hammer' }],
  // Revenant — Hammer 5, Drop the Hammer. PvE/WvW+PvP split (3.2/0.01) — steep competitive nerf.
  28110: [{ factText: 'Damage', coefficient: 0.01, weapon: 'hammer' }],
  // Revenant — Axe 4, Frigid Blitz. No split on either fact: Pass-Through Damage (0.15), Final Damage
  // (1.5).
  28029: [
    { factText: 'Pass-Through Damage', coefficient: 0.15, weapon: 'axe' },
    { factText: 'Final Damage', coefficient: 1.5, weapon: 'axe' }
  ],
  // Revenant — Axe 5, Temporal Rift. PvE/WvW+PvP split (0.75/0.01) — steep competitive nerf.
  28409: [{ factText: 'Damage', coefficient: 0.01, weapon: 'axe' }],
  // Revenant — Staff 1 (chain depth 0), Rapid Swipe. PvE/WvW+PvP split (0.65/0.433).
  29180: [{ factText: 'Damage', coefficient: 0.433, weapon: 'staff' }],
  // Revenant — Staff 1 (chain depth 1), Forceful Bash. PvE/WvW+PvP split (0.75/0.5).
  29331: [{ factText: 'Damage', coefficient: 0.5, weapon: 'staff' }],
  // Revenant — Staff 1 (chain depth 2), Rejuvenating Assault. `strikes=2` present -> wiki totaled.
  // PvE/WvW+PvP split (1.0/0.666).
  29002: [{ factText: 'Damage', coefficient: 0.666, weapon: 'staff' }],
  // Revenant — Staff 2, Mender's Rebuke. PvE/WvW+PvP split (1.5/1.09).
  29145: [{ factText: 'Damage', coefficient: 1.09, weapon: 'staff' }],
  // Revenant — Staff 3, Warding Rift. PvE/WvW+PvP split (0.4/0.1).
  29288: [{ factText: 'Damage', coefficient: 0.1, weapon: 'staff' }],
  // Revenant — Staff 5, Surge of the Mists. `strikes=9` present -> wiki totaled. PvE/WvW+PvP split
  // (3.24/0.009) — steep competitive nerf; the 2 identical-text base facts the API exposes are this
  // same duplication (see block comment above).
  28978: [{ factText: 'Damage', coefficient: 0.009, weapon: 'staff' }],
  // Revenant/Renegade — Shortbow 1, Shattershot. PvE/WvW+PvP split (0.65/0.44).
  40497: [{ factText: 'Damage', coefficient: 0.44, weapon: 'shortbow' }],
  // Revenant/Renegade — Shortbow 2, Bloodbane Path. `strikes=3` present -> wiki totaled. PvE/WvW+PvP
  // split (1.2/1.5) — WvW higher than PvE here (a real buff, not a typo).
  40175: [{ factText: 'Damage', coefficient: 1.5, weapon: 'shortbow' }],
  // Revenant/Renegade — Shortbow 3, Sevenshot. `strikes=7` present -> wiki totaled. PvE/WvW+PvP split
  // (2.17/1.855).
  41829: [{ factText: 'Damage', coefficient: 1.855, weapon: 'shortbow' }],
  // Revenant/Renegade — Shortbow 4, Spiritcrush. No split on either fact. Initial Damage `strikes=1`
  // present -> wiki totaled (1.25, same as per-hit). Damage `strikes=3` present -> wiki totaled (0.75).
  43993: [
    { factText: 'Initial Damage', coefficient: 1.25, weapon: 'shortbow' },
    { factText: 'Damage', coefficient: 0.75, weapon: 'shortbow' }
  ],
  // Revenant/Renegade — Shortbow 5, Scorchrazor — EXCLUDED, see block comment above (wiki page stale,
  // PvE value contradicts the live API).
  // Revenant/Vindicator — Greatsword 1 (chain depth 0), Mist Swing. PvE/WvW+PvP split (0.7/0.6).
  62913: [{ factText: 'Damage', coefficient: 0.6, weapon: 'greatsword' }],
  // Revenant/Vindicator — Greatsword 1 (chain depth 1), Mist Slash. PvE/WvW+PvP split (0.8/0.6).
  62688: [{ factText: 'Damage', coefficient: 0.6, weapon: 'greatsword' }],
  // Revenant/Vindicator — Greatsword 1 (chain depth 2), Arcing Mists. PvE/WvW+PvP split (1.2/0.85).
  62752: [{ factText: 'Damage', coefficient: 0.85, weapon: 'greatsword' }],
  // Revenant/Vindicator — Greatsword 2, Mist Unleashed. PvE/WvW+PvP split (1.6/1.36).
  62692: [{ factText: 'Damage', coefficient: 1.36, weapon: 'greatsword' }],
  // Revenant/Vindicator — Greatsword 3, Phantom's Onslaught. 3-way split (1.6/1.33/1.18) — uses wvw
  // (1.33). (Infobox lists the wvw value ahead of pvp; both explicitly tagged, not a duplication.)
  62895: [{ factText: 'Damage', coefficient: 1.33, weapon: 'greatsword' }],
  // Revenant/Vindicator — Greatsword 4 (chain depth 1, flip-target of the excluded Imperial Guard),
  // True Strike — Vindicator's, distinct from Guardian's Mace 1 skill of the same name (see block
  // comment above). Base Damage PvE/WvW+PvP grouped split (1.5/1.0). Damage per Block 3-way split
  // (0.5/0.05/0.15) — uses wvw (0.05).
  62828: [
    { factText: 'Damage', coefficient: 1.0, weapon: 'greatsword' },
    { factText: 'Damage per Block', coefficient: 0.05, weapon: 'greatsword' }
  ],
  // Revenant/Vindicator — Greatsword 5, Eternity's Requiem. Base Damage PvE/WvW+PvP split (1.0/0.9).
  // Minimum Damage PvE/WvW+PvP split (0.3/0.1).
  62929: [
    { factText: 'Damage', coefficient: 0.9, weapon: 'greatsword' },
    { factText: 'Minimum Damage', coefficient: 0.1, weapon: 'greatsword' }
  ],
  // Revenant — Scepter 1 (chain depth 0), Serene Slash. PvE/WvW+PvP split (0.533/0.475).
  71933: [{ factText: 'Damage', coefficient: 0.475, weapon: 'scepter' }],
  // Revenant — Scepter 1 (chain depth 1), Acerbic Cut. PvE/WvW+PvP split (0.533/0.475).
  71930: [{ factText: 'Damage', coefficient: 0.475, weapon: 'scepter' }],
  // Revenant — Scepter 1 (chain depth 2), Motivating Whirl. PvE/WvW+PvP split (1.0/0.667).
  71942: [{ factText: 'Damage', coefficient: 0.667, weapon: 'scepter' }],
  // Revenant — Scepter 2, Blossoming Aura. Pulsing Damage `strikes=4` present -> wiki totaled,
  // PvE/WvW+PvP split (1.2/0.8). Final Damage PvE/WvW+PvP split (1.0/0.5).
  71816: [
    { factText: 'Pulsing Damage', coefficient: 0.8, weapon: 'scepter' },
    { factText: 'Final Damage', coefficient: 0.5, weapon: 'scepter' }
  ],
  // Revenant — Spear 1 (aquatic autoattack), Spear of Anguish. No split (0.8).
  28714: [{ factText: 'Damage', coefficient: 0.8, weapon: 'spear' }],
  // Revenant — Spear 2 (aquatic), Rapid Assault. `strikes=8` present -> wiki totaled. No split (3.0).
  28915: [{ factText: 'Damage', coefficient: 3.0, weapon: 'spear' }],
  // Revenant — Spear 3 (aquatic, chain depth 0), Venomous Sphere. No split (0.2).
  28827: [{ factText: 'Damage', coefficient: 0.2, weapon: 'spear' }],
  // Revenant — Spear 3 (aquatic, chain depth 1), Frigid Discharge. No split (2.0).
  28797: [{ factText: 'Damage', coefficient: 2.0, weapon: 'spear' }],
  // Revenant — Spear 4 (aquatic, chain depth 0), Igniting Brand. No split (1.25).
  28692: [{ factText: 'Damage', coefficient: 1.25, weapon: 'spear' }],
  // Revenant — Spear 4 (aquatic, chain depth 1), Devour Brand. No split (1.5).
  28815: [{ factText: 'Damage', coefficient: 1.5, weapon: 'spear' }],
  // Revenant — Spear 5 (aquatic), Rift Containment. Wiki's own `strikes=5` param doesn't match its
  // hit-for-hit math (1.32/5=0.264, not the local per-hit 0.33) — the local API's hit_count=4 is what
  // actually reconciles (0.33*4=1.32 exactly) — the totaled coefficient itself (1.32) is correct either
  // way, used as-is. No split.
  28930: [{ factText: 'Damage', coefficient: 1.32, weapon: 'spear' }],
  // Revenant — Trident 1, Mistsfire. No split (0.6).
  50395: [{ factText: 'Damage', coefficient: 0.6, weapon: 'trident' }],
  // Revenant — Trident 2, Portal Fire. `strikes=8` present -> wiki totaled. No split (2.64).
  50456: [{ factText: 'Damage', coefficient: 2.64, weapon: 'trident' }],
  // Revenant — Trident 3, Rift of Pain. No split (0.25).
  50390: [{ factText: 'Damage', coefficient: 0.25, weapon: 'trident' }],
  // Revenant — Trident 4, Reckoning Blast. `strikes=2` present -> wiki totaled. No split (0.4).
  50410: [{ factText: 'Damage', coefficient: 0.4, weapon: 'trident' }],
  // Revenant — Trident 5, Torrential Mists. `strikes=22` present -> wiki totaled. No split (4.84).
  50483: [{ factText: 'Damage', coefficient: 4.84, weapon: 'trident' }],
  // Revenant — Spear 1 (land, Janthir Wilds, chain depth 0), Abyssal Strike (melee half of the
  // autoattack, separated from the ranged half in a 2024-08-20 update). PvE/WvW+PvP split (0.85/0.45).
  73015: [{ factText: 'Damage', coefficient: 0.45, weapon: 'spear' }],
  // Revenant — Spear 1 (land, Janthir Wilds, chain depth 1), Abyssal Fire (ranged half of the
  // autoattack). 3-way split (0.85/0.45/0.3) — uses wvw (0.45).
  72931: [{ factText: 'Damage', coefficient: 0.45, weapon: 'spear' }],
  // Revenant — Spear 2 (land, Janthir Wilds), Abyssal Force. No split (0.8).
  72972: [{ factText: 'Damage', coefficient: 0.8, weapon: 'spear' }],
  // Revenant — Spear 4 (land, Janthir Wilds), Abyssal Blot. 3 distinct facts. Initial Attack Damage
  // PvE (implicit, un-tagged)/WvW+PvP split (0.4/0.01). Pulse Damage `strikes=4` present -> wiki
  // totaled, PvE(implicit)/WvW/PvP 3-way (1.6/0.9/0.75) — uses wvw (0.9). Damage (the older, un-split
  // 5-hit total fact) has no wiki-tagged WvW value post-split — derived as Initial Attack Damage +
  // Pulse Damage total (0.01+0.9=0.91), see block comment above.
  72954: [
    { factText: 'Initial Attack Damage', coefficient: 0.01, weapon: 'spear' },
    { factText: 'Pulse Damage', coefficient: 0.9, weapon: 'spear' },
    { factText: 'Damage', coefficient: 0.91, weapon: 'spear' }
  ],
  // Revenant — Spear 5 (land, Janthir Wilds), Abyssal Raze. No split on the Damage fact itself (1.0);
  // only the per-stack damage-increase bonus splits by mode, not modeled here.
  73059: [{ factText: 'Damage', coefficient: 1.0, weapon: 'spear' }],

  // --- Ranger done: 62 raw candidate ids resolved via the app's own `resolveSkillBarIds`/
  // `weaponSkillIdsForPair` (Core plus Druid/Soulbeast/Untamed/Galeshot, both environments, including
  // both the new land Spear kit and the classic aquatic-only Spear autoattack chain from the
  // 2025-08-19 "Weaponmaster Training" update), 56 carry a Damage fact — 6 confirmed locally as real
  // non-damage skills with no Damage-type fact at all (Counterattack, Call of the Wild, Sublime
  // Conversion, Ancestral Grace, Astral Wisp, Panther's Prowl — buff/heal/CC/leap skills), and 1
  // already seeded (Maul, id 12525, one-per-profession seed block above — its comment mislabeled the
  // bar slot as Greatsword 5 instead of Greatsword 2, corrected in place this leg). Of the 55 assigned
  // for wiki verification, 54 curated here; Slash (Sword 1, id 12471) is the 1 exclusion — its wiki
  // page quotes PvE 0.8 with no changelog entry past 2022-06-30, but both the live and local API's own
  // PvE `dmg_multiplier` is 0.9, an undocumented buff the wiki never picked up (ruled out as a
  // fetch/transcription error: every other candidate this leg's local PvE value matched its
  // wiki-quoted PvE number exactly) — left uncurated rather than guessed, same policy as Revenant's
  // Scorchrazor. New wrinkles this leg: (1) 4 of the 5 Untamed Hammer skills (Wild Swing, Overbearing
  // Smash, Savage Shock Wave, Thump — every one but the chain-starter, Hammer Strike) live on wiki
  // pages carrying 2 ids apiece (a pre-/post-"hammer for all specs" pair added by a 2024-03-19 update),
  // identical facts either way, so the app's actual candidate id was simply matched to the right page
  // by content rather than by a literal id-template search; (2) all 5 classic aquatic Spear
  // autoattack-chain skills (Stab/Swirling Strike/Surging Maw/Counterstrike/Man O' War) carry a
  // `requires_trait: 1047` (Bestial Rage, Beastmastery Major) alternate Damage value whose ratio to
  // base varies per skill — 0.84x (an actual decrease, on Stab) up to 1.1x (on Counterstrike) — the
  // same "stacking combat buff preview, not a flat bonus" shape as Guardian's Symbolic Avenger,
  // deliberately omitted on all 5; (3) 5 skills (Falcon's Stoop, Warclaw's Engage, Flourish, Wild
  // Strikes, Pounce) are 3-way PvE/WvW/PvP splits (WvW used, same as every other 3-way split
  // elsewhere in this table); (4) 4 skills (Stalker's Strike, Falcon's Stoop, Warclaw's Engage,
  // Pounce) carry an unmodeled flat "Damage Increase" percentage fact alongside their real Damage
  // fact(s) — a `Percent`-type fact, not Damage-type, so not curated, same as this table's other
  // unmodeled conditional-bonus facts; (5) the id 12474/12471 "Slash" name collision (Greatsword 1 vs
  // Sword 1) resolved cleanly via each page's own `id =` infobox param and otheruses hatnote — 12474
  // confirmed correct and curated below, 12471 is the exclusion above. See this comment block for the
  // full writeup; no new `WEAPON_STRENGTH_MIDPOINTS` keys were needed (Ranger's aquatic Speargun kit
  // reuses the existing `harpoon gun` key).
  // Ranger — Axe 1, Ricochet. PvE/WvW+PvP split (0.9/0.533).
  12466: [{ factText: 'Damage', coefficient: 0.533, weapon: 'axe' }],
  // Ranger — Axe 2, Splitblade. `strikes=5` present -> wiki totaled. PvE/WvW+PvP split (2.5/0.5).
  12480: [{ factText: 'Damage', coefficient: 0.5, weapon: 'axe' }],
  // Ranger — Axe 3, Winter's Bite. PvE/WvW+PvP split (1.8/1.0).
  12490: [{ factText: 'Damage', coefficient: 1.0, weapon: 'axe' }],
  // Ranger — Axe 4, Path of Scars. PvE/WvW+PvP split (1.2/0.01) — steep competitive nerf.
  12638: [{ factText: 'Damage', coefficient: 0.01, weapon: 'axe' }],
  // Ranger — Axe 5, Whirling Defense. `strikes=12` present -> wiki totaled. PvE/WvW+PvP split
  // (7.92/5.28).
  12639: [{ factText: 'Damage', coefficient: 5.28, weapon: 'axe' }],
  // Ranger/Soulbeast — Dagger 1 (chain-starter: Groundwork Gouge -> Leading Swipe -> Serpent Stab).
  // PvE/WvW+PvP split (0.4/0.32).
  45426: [{ factText: 'Damage', coefficient: 0.32, weapon: 'dagger' }],
  // Ranger/Soulbeast — Dagger 2, Double Arc. `strikes=2` present -> wiki totaled. PvE/WvW+PvP split
  // (1.6/1.0).
  43536: [{ factText: 'Damage', coefficient: 1.0, weapon: 'dagger' }],
  // Ranger/Soulbeast — Dagger 3, Instinctive Engage. PvE/WvW+PvP split (2.0/1.0).
  46123: [{ factText: 'Damage', coefficient: 1.0, weapon: 'dagger' }],
  // Ranger — Dagger 4, Stalker's Strike. No split (0.6). Also carries a separate "Damage Increase"
  // fact (a flat +100% conditional buff), not itself a Damage-type fact — not modeled, same as other
  // legs' unmodeled health-threshold/conditional damage-increase facts.
  12478: [{ factText: 'Damage', coefficient: 0.6, weapon: 'dagger' }],
  // Ranger — Dagger 5, Crippling Talon. PvE/WvW+PvP split (0.9/0.5).
  12477: [{ factText: 'Damage', coefficient: 0.5, weapon: 'dagger' }],
  // Ranger — Greatsword 1, Slash. Distinct wiki page from Sword 1's identically-named "Slash" (id
  // 12471, excluded above) — confirmed via each page's own otheruses hatnote. PvE/WvW+PvP split
  // (0.88/0.5).
  12474: [{ factText: 'Damage', coefficient: 0.5, weapon: 'greatsword' }],
  // Ranger — Greatsword 3, Swoop. PvE/WvW+PvP split (2.4/1.0) — the 2 identical-text base facts the
  // local API exposes are this same PvE/WvW duplication (see Warrior/Guardian/Revenant block
  // comments), not 2 distinct mechanics.
  12521: [{ factText: 'Damage', coefficient: 1.0, weapon: 'greatsword' }],
  // Ranger — Greatsword 5, Hilt Bash. PvE/WvW+PvP split (2.5/0.01) — steep competitive nerf.
  12475: [{ factText: 'Damage', coefficient: 0.01, weapon: 'greatsword' }],
  // Ranger/Untamed — Hammer 1, Hammer Strike (chain-starter: Hammer Strike -> Hammer Slam -> Heavy
  // Smash). PvE/WvW+PvP split (0.8/0.533).
  63118: [{ factText: 'Damage', coefficient: 0.533, weapon: 'hammer' }],
  // Ranger — Hammer 2, Wild Swing. PvE/WvW+PvP split (1.5/1.1).
  69167: [{ factText: 'Damage', coefficient: 1.1, weapon: 'hammer' }],
  // Ranger — Hammer 3, Overbearing Smash. Base Damage PvE/WvW+PvP split (0.4/0.3). Follow-Up Damage no
  // split (1.0).
  69262: [
    { factText: 'Damage', coefficient: 0.3, weapon: 'hammer' },
    { factText: 'Follow-Up Damage', coefficient: 1.0, weapon: 'hammer' }
  ],
  // Ranger — Hammer 4, Savage Shock Wave. PvE/WvW+PvP split (0.5/0.45).
  69340: [{ factText: 'Damage', coefficient: 0.45, weapon: 'hammer' }],
  // Ranger — Hammer 5, Thump. PvE/WvW+PvP split (1.25/0.01) — steep competitive nerf.
  69212: [{ factText: 'Damage', coefficient: 0.01, weapon: 'hammer' }],
  // Ranger — Spear 1 (land, Janthir Wilds), Drake's Swipe. PvE/WvW+PvP split (1.1/0.495).
  72922: [{ factText: 'Damage', coefficient: 0.495, weapon: 'spear' }],
  // Ranger — Spear 2 (land, Janthir Wilds), Mongoose's Frenzy. `strikes=2` present -> wiki totaled.
  // PvE/WvW+PvP split (2.5/1.55).
  73110: [{ factText: 'Damage', coefficient: 1.55, weapon: 'spear' }],
  // Ranger — Spear 3 (land, Janthir Wilds), Falcon's Stoop. 3-way split pve/wvw/pvp (1.95/1.25/1.15) —
  // WvW used. Also carries an unmodeled "Damage Increase" (+20%) conditional fact, same as Dagger 4
  // above.
  72928: [{ factText: 'Damage', coefficient: 1.25, weapon: 'spear' }],
  // Ranger — Spear 4 (land, Janthir Wilds), Warclaw's Engage. 3-way split pve/wvw/pvp (2.75/1.4/1.3) —
  // WvW used. Same unmodeled "Damage Increase" fact as Falcon's Stoop.
  73020: [{ factText: 'Damage', coefficient: 1.4, weapon: 'spear' }],
  // Ranger — Spear 1 (aquatic, classic chain), Stab. No split (1.0). Trait 1047 (Bestial Rage) alt
  // value (0.84) omitted — stacking Might-buff preview, not a flat bonus; see block note above.
  12553: [{ factText: 'Damage', coefficient: 1.0, weapon: 'spear' }],
  // Ranger — Spear 2 (aquatic), Swirling Strike. No split (1.75). Trait 1047 alt (1.8375) omitted,
  // same reasoning.
  12559: [{ factText: 'Damage', coefficient: 1.75, weapon: 'spear' }],
  // Ranger — Spear 3 (aquatic), Surging Maw. No split (1.2). Trait 1047 alt (1.26) omitted, same
  // reasoning.
  12557: [{ factText: 'Damage', coefficient: 1.2, weapon: 'spear' }],
  // Ranger — Spear 4 (aquatic), Counterstrike. No split (1.75). Trait 1047 alt (1.925) omitted, same
  // reasoning.
  12561: [{ factText: 'Damage', coefficient: 1.75, weapon: 'spear' }],
  // Ranger — Spear 5 (aquatic), Man O' War. Damage `strikes=7` present -> wiki totaled (2.31); Final
  // Attack no split (1.25). Trait 1047 alt values on both facts omitted, same reasoning.
  12552: [
    { factText: 'Damage', coefficient: 2.31, weapon: 'spear' },
    { factText: 'Final Attack', coefficient: 1.25, weapon: 'spear' }
  ],
  // Ranger — Longbow 1, Long Range Shot. Maximum Damage PvE/WvW+PvP split (1.5/0.6). Minimum Damage
  // PvE/WvW+PvP split (1.33/0.466).
  12510: [
    { factText: 'Maximum Damage', coefficient: 0.6, weapon: 'longbow' },
    { factText: 'Minimum Damage', coefficient: 0.466, weapon: 'longbow' }
  ],
  // Ranger — Longbow 2, Rapid Fire. `strikes=10` present -> wiki totaled. PvE/WvW+PvP split
  // (6.0/2.75).
  12509: [{ factText: 'Damage', coefficient: 2.75, weapon: 'longbow' }],
  // Ranger — Longbow 3, Hunter's Shot. No split (0.4).
  12573: [{ factText: 'Damage', coefficient: 0.4, weapon: 'longbow' }],
  // Ranger — Longbow 4, Point-Blank Shot. PvE/WvW+PvP split (0.8/0.01) — steep competitive nerf.
  12511: [{ factText: 'Damage', coefficient: 0.01, weapon: 'longbow' }],
  // Ranger — Longbow 5, Barrage. `strikes=12` present -> wiki totaled. PvE/WvW+PvP split (6.0/4.572).
  12469: [{ factText: 'Damage', coefficient: 4.572, weapon: 'longbow' }],
  // Ranger — Mace 1, Germinate. PvE/WvW+PvP split (0.9/0.6).
  72088: [{ factText: 'Damage', coefficient: 0.6, weapon: 'mace' }],
  // Ranger — Mace 2, Flourish. 3-way split pve/wvw/pvp on both facts: Initial Damage (0.85/0.75/0.6),
  // Delayed Damage (1.275/1.0/0.9) — WvW used for each.
  71999: [
    { factText: 'Initial Damage', coefficient: 0.75, weapon: 'mace' },
    { factText: 'Delayed Damage', coefficient: 1.0, weapon: 'mace' }
  ],
  // Ranger — Mace 3, Oaken Cudgel. PvE/WvW+PvP split (2.0/0.01) — steep competitive nerf.
  71963: [{ factText: 'Damage', coefficient: 0.01, weapon: 'mace' }],
  // Ranger — Mace 4, Thistleguard. PvE/WvW+PvP split (1.2/0.8).
  71903: [{ factText: 'Damage', coefficient: 0.8, weapon: 'mace' }],
  // Ranger — Mace 5, Wild Strikes. 3-way split pve/wvw/pvp on both facts: Damage (0.85/0.48/0.4),
  // Final Slam Damage (1.7/0.96/0.8) — WvW used for each.
  71841: [
    { factText: 'Damage', coefficient: 0.48, weapon: 'mace' },
    { factText: 'Final Slam Damage', coefficient: 0.96, weapon: 'mace' }
  ],
  // Ranger — Shortbow 1, Crossfire. PvE/WvW+PvP split (0.5/0.266).
  12470: [{ factText: 'Damage', coefficient: 0.266, weapon: 'shortbow' }],
  // Ranger — Shortbow 2, Poison Volley. `strikes=5` present -> wiki totaled. PvE/WvW+PvP split
  // (1.5/1.25).
  12468: [{ factText: 'Damage', coefficient: 1.25, weapon: 'shortbow' }],
  // Ranger — Shortbow 3, Quick Shot. No split (0.5).
  12517: [{ factText: 'Damage', coefficient: 0.5, weapon: 'shortbow' }],
  // Ranger — Shortbow 4, Crippling Shot. No split (0.8).
  12507: [{ factText: 'Damage', coefficient: 0.8, weapon: 'shortbow' }],
  // Ranger — Shortbow 5, Concussion Shot. PvE/WvW+PvP split (0.4/0.01) — steep competitive nerf.
  12508: [{ factText: 'Damage', coefficient: 0.01, weapon: 'shortbow' }],
  // Ranger — Speargun 1, Splinter Shot. No split (0.55).
  12526: [{ factText: 'Damage', coefficient: 0.55, weapon: 'harpoon gun' }],
  // Ranger — Speargun 2, Coral Shot. No split (1.25).
  12529: [{ factText: 'Damage', coefficient: 1.25, weapon: 'harpoon gun' }],
  // Ranger — Speargun 3, Feeding Frenzy. No split. `strikes=11` present -> wiki totaled (4.4).
  12528: [{ factText: 'Damage', coefficient: 4.4, weapon: 'harpoon gun' }],
  // Ranger — Speargun 4, Mercy Shot. No split. 3 distinct health-threshold facts, each its own line
  // (same "always-listed conditional fact" pattern as Elementalist's Fire Grab "Damage vs. Burning").
  12527: [
    { factText: 'Base Damage', coefficient: 1.0, weapon: 'harpoon gun' },
    { factText: 'Less than 66% Health', coefficient: 1.75, weapon: 'harpoon gun' },
    { factText: 'Less than 33% Health', coefficient: 2.5, weapon: 'harpoon gun' }
  ],
  // Ranger — Speargun 5, Ink Blast. No split. `strikes=7` present -> wiki totaled (1.4).
  12530: [{ factText: 'Damage', coefficient: 1.4, weapon: 'harpoon gun' }],
  // Ranger/Druid — Staff 1, Solar Beam. PvE/WvW+PvP split (0.3/0.25).
  31710: [{ factText: 'Damage', coefficient: 0.25, weapon: 'staff' }],
  // Ranger/Druid — Staff 4, Vine Surge. No split (0.5).
  31700: [{ factText: 'Damage', coefficient: 0.5, weapon: 'staff' }],
  // Ranger — Sword 2, Pounce. 3-way split pve/wvw/pvp (2.0/1.7/1.05) — WvW used. Also carries an
  // unmodeled "Damage Increase" (+20%) conditional fact, same pattern as the land Spear skills above.
  69203: [{ factText: 'Damage', coefficient: 1.7, weapon: 'sword' }],
  // Ranger — Sword 3, Serpent's Strike. PvE/WvW+PvP split (3.0/1.5).
  12482: [{ factText: 'Damage', coefficient: 1.5, weapon: 'sword' }],
  // Ranger — Torch 4, Throw Torch. No split (0.666).
  12635: [{ factText: 'Damage', coefficient: 0.666, weapon: 'torch' }],
  // Ranger — Torch 5, Bonfire. No split. `strikes=9` present -> wiki totaled (0.9).
  12504: [{ factText: 'Damage', coefficient: 0.9, weapon: 'torch' }],
  // Ranger — Warhorn 4, Hunter's Call. `strikes=16` present -> wiki totaled. PvE/WvW+PvP split
  // (2.4/1.92).
  12620: [{ factText: 'Damage', coefficient: 1.92, weapon: 'warhorn' }],

  // --- Thief done: 54 raw candidate ids (real, currently-equippable Weapon_1-5 ids resolved via the
  // app's own `resolveSkillBarIds`/`weaponSkillIdsForPair`, brute-forced across every legal
  // mainhand/offhand pairing — Axe/Sword/Scepter mainhand-only paired with Dagger/Pistol offhand,
  // Dagger/Pistol usable in either hand, plus Rifle/Staff/Shortbow/Speargun/Spear two-handed — both
  // environments, and all 3 elite specs (Daredevil/Deadeye/Specter) plus the spec-less baseline;
  // `THIEF_DUAL_WIELD_OFFHAND` correctly resolved every Dual Wield Weapon_3 skill per hand-context, one
  // bar id per mainhand/offhand combo). Unlike every earlier Weapon-slot leg, walked each raw
  // candidate's full `flipSkill` chain (the same walk `multi-effect.ts`'s `flipTargetSkills` performs
  // for the live `FlipSkillStack` UI) all the way to its end rather than stopping at the bar-bound
  // starter — this leg follows Revenant's fuller "every stage independently wiki-verified" convention
  // rather than Warrior/Guardian/Ranger's "chain-starter only" shorthand, since Thief's kit has several
  // 2-4 stage `flipSkill` chains well beyond simple 2-3 hit autoattacks (e.g. Rifle 1's Brutal Aim ->
  // Malicious Death's Judgment -> Death's Judgment burst combo; Staff 1's 4-hit Staff Strike -> Staff
  // Bash -> Punishing Strikes -> Hook Strike chain). Expanded this way, the 54 raw ids' chains cover 88
  // total distinct skill ids; 71 carry a genuine Damage-type fact (1 already seeded, Dancing Dagger id
  // 13019 — one-per-profession seed block above), 70 curated below. 17 confirmed locally as real
  // non-damage skills with no Damage-type fact at all: Infiltrator's Arrow (13025, Shortbow 5),
  // Smoke Trail (13078, Ink Shot's flip target), Break Stance (13130, Nine-Tailed Strike's flip
  // target), Kneel (40600, Rifle 5), Sniper's Cover/Death's Advance x2 (68600/40436/80278, Death's
  // Retreat's movement-only flip chain), Shadow Bolt/Shadowsquall (63066/63314, Specter Scepter 1's
  // condition-only autoattack), Triple Threat/Measured Shot/Endless Night (63154/63267/63128, Specter
  // Scepter 3 paired with Pistol offhand), Twilight Combo (63254, Specter Scepter 3 paired with Dagger
  // offhand), Recall Axes/Harrowing Storm (71895/71864, Axe 3 paired with Dagger offhand), Orchestrated
  // Assault (71965, Axe 3 paired with Pistol offhand). Every curated skill below has a PvE/WvW+PvP
  // split unless noted "no split" — WvW value used per this table's fixed policy — and no
  // wiki-documented coefficient gaps turned up this leg (unlike Revenant's Scorchrazor/Ranger's Slash).
  //
  // **Deadly Aim wrinkle**: 15 of the 70 (every Pistol- and Harpoon Gun-weapon-typed fact — every
  // Pistol skill, every Speargun skill, and Flawless Execution's off-hand-pistol "Projectile Damage"
  // fact) carry a `requires_trait: 1299` (Deadly Aim, Critical Strikes Master) alternate Damage value —
  // confirmed via the trait's own wiki page as a genuine flat +10% ("no longer reduces damage and now
  // increases damage from pistol and harpoon gun attacks by 10%", 2024-03-19 rework), the same
  // flat-bonus shape as Warrior's Forceful Greatsword rather than a stacking-buff preview — curated as
  // `requiresTrait: 1299` variants (`base * 1.10`), cross-checked exactly against each skill's own live
  // `traited_facts` `dmg_multiplier`. One exception: Unload (13011)'s local `traited_facts` don't
  // resolve to a clean `base * 1.10` against either of its 2 base facts under any pairing tried — left
  // without a trait-gated variant rather than guessed.
  //
  // Other wrinkles: (1) "Repeater" is 2 separate ids (13111, 59526) sharing one wiki page/values — a
  // 2-stage ammo-reload loop off Pistol-mainhand-with-Dagger-offhand's Shadow Strike, both curated
  // identically, same unresolvable-shared-page treatment as Revenant's Jade Winds; (2) Axe 1's
  // "Spinning Axe" is likewise 2 ids (71967, 71854) sharing one page/values, curated identically;
  // (3) Rifle 2's Skirmisher's Shot groups PvE with WvW instead of the usual WvW+PvP grouping
  // (`split = pve wvw, pvp`) — the WvW value used is therefore identical to PvE (1.0), a rarer variant
  // of the "PvE+WvW grouped" shape already seen a few times elsewhere in this table; (4) a couple of
  // multi-hit pulsing facts carry no wiki `strikes=` param despite a real multi-hit local `hit_count`
  // (Detonate Cluster's "Small Explosion", hit_count=4) — manually totaled per this table's usual rule.
  // Thief — Dagger 1 (chain depth 0), Double Strike. `strikes=2` present -> wiki totaled. PvE/WvW+PvP
  // split (0.8/0.4).
  13004: [{ factText: 'Damage', coefficient: 0.4, weapon: 'dagger' }],
  // Thief — Dagger 1 (chain depth 1), Wild Strike. PvE/WvW+PvP split (0.8/0.433).
  13087: [{ factText: 'Damage', coefficient: 0.433, weapon: 'dagger' }],
  // Thief — Dagger 2, Heartseeker. 3 independently-split health-threshold facts (same "always-listed
  // conditional fact" pattern as Ranger's Speargun Mercy Shot): Above 50% Health (no split, 1.0),
  // Below 50% Health (PvE/WvW+PvP 1.6/1.5), Below 25% Health (PvE/WvW+PvP 2.2/2.0) — WvW used.
  13097: [
    { factText: 'Above 50%', coefficient: 1.0, weapon: 'dagger' },
    { factText: 'Below 50%', coefficient: 1.5, weapon: 'dagger' },
    { factText: 'Below 25%', coefficient: 2.0, weapon: 'dagger' }
  ],
  // Thief — Dagger 3 (paired with Dagger offhand), Death Blossom. `strikes=3` present -> wiki totaled.
  // No split (0.63).
  13006: [{ factText: 'Damage', coefficient: 0.63, weapon: 'dagger' }],
  // Thief — Dagger 3 (paired with Pistol offhand), Shadow Shot. PvE/WvW+PvP split (1.8/1.3125) — the 2
  // identical-text base facts the local API exposes are this same duplication (see Warrior/Guardian
  // block comments above), not 2 distinct mechanics.
  13040: [{ factText: 'Damage', coefficient: 1.3125, weapon: 'dagger' }],
  // Thief — Dagger 4, Dancing Dagger. Already curated in the one-per-profession seed above (id 13019).
  // Thief — Dagger 5, Cloak and Dagger. PvE/WvW+PvP split (1.6/1.25).
  16432: [{ factText: 'Damage', coefficient: 1.25, weapon: 'dagger' }],
  // Thief — Pistol 1, Vital Shot. PvE/WvW+PvP split (0.575/0.383). Deadly Aim (1299) trait-gated
  // variant: 0.383*1.10=0.4213 (matches API exactly).
  13084: [
    { factText: 'Damage', coefficient: 0.383, weapon: 'pistol' },
    { factText: 'Damage', coefficient: 0.4213, weapon: 'pistol', requiresTrait: 1299 }
  ],
  // Thief — Pistol 2, Bola Shot. No split (0.25). Deadly Aim (1299) trait-gated variant:
  // 0.25*1.10=0.275 (matches API exactly).
  13008: [
    { factText: 'Damage', coefficient: 0.25, weapon: 'pistol' },
    { factText: 'Damage', coefficient: 0.275, weapon: 'pistol', requiresTrait: 1299 }
  ],
  // Thief — Pistol 3 (paired with Pistol offhand), Unload. `strikes=8` present -> wiki totaled.
  // PvE/WvW+PvP split (3.36/2.16). Deadly Aim (1299) trait-gated values are present locally
  // (`traited_facts` 0.297/0.495) but don't resolve to a clean `base * 1.10` against either base
  // fact — left without a trait-gated variant, see block comment above.
  13011: [{ factText: 'Damage', coefficient: 2.16, weapon: 'pistol' }],
  // Thief — Pistol 3 (paired with Dagger offhand), Shadow Strike. 2 distinct facts, neither split by
  // mode: Damage (dagger, 0.315), Shot Damage (pistol, 1.3125). Deadly Aim (1299) trait-gated variant
  // on Shot Damage only (pistol-weapon fact): 1.3125*1.10=1.44375 (matches API exactly) — Damage
  // (dagger) is unaffected, Deadly Aim only boosts pistol/harpoon gun facts.
  13010: [
    { factText: 'Damage', coefficient: 0.315, weapon: 'dagger' },
    { factText: 'Shot Damage', coefficient: 1.3125, weapon: 'pistol' },
    { factText: 'Shot Damage', coefficient: 1.44375, weapon: 'pistol', requiresTrait: 1299 }
  ],
  // Thief — Repeater (Shadow Strike's flip target, 2-stage ammo-reload loop sharing one wiki
  // page/values under 2 ids — see block comment above). `strikes=5` present -> wiki totaled. No split
  // (1.5). Deadly Aim (1299) trait-gated variant: 1.5*1.10=1.65 (matches API exactly).
  13111: [
    { factText: 'Damage', coefficient: 1.5, weapon: 'pistol' },
    { factText: 'Damage', coefficient: 1.65, weapon: 'pistol', requiresTrait: 1299 }
  ],
  59526: [
    { factText: 'Damage', coefficient: 1.5, weapon: 'pistol' },
    { factText: 'Damage', coefficient: 1.65, weapon: 'pistol', requiresTrait: 1299 }
  ],
  // Thief — Pistol 4, Head Shot. PvE/WvW+PvP split (1.0/0.25). Deadly Aim (1299) trait-gated variant:
  // 0.25*1.10=0.275 (matches API exactly).
  13012: [
    { factText: 'Damage', coefficient: 0.25, weapon: 'pistol' },
    { factText: 'Damage', coefficient: 0.275, weapon: 'pistol', requiresTrait: 1299 }
  ],
  // Thief — Sneak Attack (Vital Shot's flip target). `strikes=5` present -> wiki totaled. PvE/WvW+PvP
  // split (1.8/1.5). Deadly Aim (1299) trait-gated variant: 1.5*1.10=1.65 (matches API exactly).
  13115: [
    { factText: 'Damage', coefficient: 1.5, weapon: 'pistol' },
    { factText: 'Damage', coefficient: 1.65, weapon: 'pistol', requiresTrait: 1299 }
  ],
  // Thief — Pistol 5, Black Powder. No split (0.25). Deadly Aim (1299) trait-gated variant:
  // 0.25*1.10=0.275 (matches API exactly).
  13113: [
    { factText: 'Damage', coefficient: 0.25, weapon: 'pistol' },
    { factText: 'Damage', coefficient: 0.275, weapon: 'pistol', requiresTrait: 1299 }
  ],
  // Thief — Sword 1 (chain depth 0), Slice (thief sword skill — distinct wiki page from Ranger's
  // identically-named Sword 1 "Slash"/"Slice" entries elsewhere in this table). PvE/WvW+PvP split
  // (0.85/0.4). Wiki's own `chain3 = Crippling Strike` field is stale — the local API's `flipSkill`
  // terminates this chain at Slash (2-hit chain, not 3), trusted over the wiki here per this table's
  // "trust live API over stale wiki text" policy (same reasoning as Revenant's Scorchrazor/Ranger's
  // Slash).
  13009: [{ factText: 'Damage', coefficient: 0.4, weapon: 'sword' }],
  // Thief — Sword 1 (chain depth 1), Slash (thief sword skill — distinct wiki page from Ranger's
  // Greatsword 1 "Slash", id 12474, and excluded Sword 1 "Slash", id 12471, elsewhere in this table).
  // PvE/WvW+PvP split (0.85/0.4).
  13088: [{ factText: 'Damage', coefficient: 0.4, weapon: 'sword' }],
  // Thief — Sword 2, Infiltrator's Strike. PvE/WvW+PvP split (1.8/0.5).
  13015: [{ factText: 'Damage', coefficient: 0.5, weapon: 'sword' }],
  // Thief — Sword 3 (paired with Dagger offhand), Flanking Strike. PvE/WvW+PvP split (1.0/0.5).
  13016: [{ factText: 'Damage', coefficient: 0.5, weapon: 'sword' }],
  // Thief — Larcenous Strike (Flanking Strike's flip target). PvE/WvW+PvP split (2.17/1.4) — the 2
  // identical-text base facts the local API exposes are this same duplication, not 2 distinct
  // mechanics.
  13007: [{ factText: 'Damage', coefficient: 1.4, weapon: 'sword' }],
  // Thief — Sword 3 (paired with Pistol offhand), Flawless Execution. Damage `strikes=3` present ->
  // wiki totaled, PvE/WvW+PvP split (1.59/0.9). Final Slash Damage no split (1.25). Projectile Damage
  // (the off-hand pistol throw) `strikes=6` present -> wiki totaled, PvE/WvW+PvP split (1.5/0.9) —
  // Deadly Aim (1299) trait-gated variant on this fact only: 0.9*1.10=0.99 (matches API exactly, the
  // other 2 facts are sword-weapon and unaffected by the pistol-only trait).
  80244: [
    { factText: 'Damage', coefficient: 0.9, weapon: 'sword' },
    { factText: 'Final Slash Damage', coefficient: 1.25, weapon: 'sword' },
    { factText: 'Projectile Damage', coefficient: 0.9, weapon: 'sword' },
    { factText: 'Projectile Damage', coefficient: 0.99, weapon: 'sword', requiresTrait: 1299 }
  ],
  // Thief — Axe 1 (chain depth 0), Spinning Axe. Shares one wiki page/values with its own flip-target
  // id (71854, same name) — a 2-hit chain, both ids curated identically, same unresolvable-shared-page
  // treatment as Revenant's Jade Winds. PvE/WvW+PvP split (0.8/0.35).
  71967: [{ factText: 'Damage', coefficient: 0.35, weapon: 'axe' }],
  // Thief — Axe 1 (chain depth 1), Spinning Axe (id-distinct flip target, see above). Same page/values.
  71854: [{ factText: 'Damage', coefficient: 0.35, weapon: 'axe' }],
  // Thief — Axe 2, Venomous Volley. `strikes=3` present -> wiki totaled. PvE/WvW+PvP split (1.2/0.9).
  71852: [{ factText: 'Damage', coefficient: 0.9, weapon: 'axe' }],
  // Thief/Specter — Scepter 2, Shadow Sap. No split (0.77).
  63351: [{ factText: 'Damage', coefficient: 0.77, weapon: 'scepter' }],
  // Thief/Deadeye — Rifle 1, Brutal Aim. PvE/WvW+PvP split (0.75/0.4).
  41422: [{ factText: 'Damage', coefficient: 0.4, weapon: 'rifle' }],
  // Thief/Deadeye — Malicious Death's Judgment (Brutal Aim's flip target). Damage PvE/WvW+PvP split
  // (2.67/1.339). Damage on Untargeted Foes PvE/WvW+PvP split (1.32/0.165) — WvW used for both.
  44087: [
    { factText: 'Damage', coefficient: 1.339, weapon: 'rifle' },
    { factText: 'Damage on Untargeted Foes', coefficient: 0.165, weapon: 'rifle' }
  ],
  // Thief/Deadeye — Death's Judgment (Malicious Death's Judgment's own flip target — a 2-stage loop
  // sharing the exact same wiki-quoted values, same reachable-flip-target treatment as Repeater above).
  69316: [
    { factText: 'Damage', coefficient: 1.339, weapon: 'rifle' },
    { factText: 'Damage on Untargeted Foes', coefficient: 0.165, weapon: 'rifle' }
  ],
  // Thief/Deadeye — Rifle 2, Skirmisher's Shot. Rare *inverted* grouping: `split = pve wvw, pvp` groups
  // PvE with WvW (not the usual WvW+PvP grouping) — WvW value used is therefore identical to PvE (1.0).
  41494: [{ factText: 'Damage', coefficient: 1.0, weapon: 'rifle' }],
  // Thief/Deadeye — Spotter's Shot (Skirmisher's Shot's flip target). PvE/WvW+PvP split (1.3/0.4).
  44591: [{ factText: 'Damage', coefficient: 0.4, weapon: 'rifle' }],
  // Thief/Deadeye — Rifle 3, Double Tap. `strikes=2` present -> wiki totaled. PvE/WvW+PvP split
  // (1.4/1.0).
  43916: [{ factText: 'Damage', coefficient: 1.0, weapon: 'rifle' }],
  // Thief/Deadeye — Three Round Burst (Double Tap's flip target). `strikes=3` present -> wiki totaled.
  // PvE/WvW+PvP split (2.25/1.5).
  44695: [{ factText: 'Damage', coefficient: 1.5, weapon: 'rifle' }],
  // Thief/Deadeye — Rifle 4, Death's Retreat. No split (0.3). Its own flip chain (Sniper's Cover ->
  // Death's Advance x2) is movement-only, no Damage fact — see block comment above.
  41937: [{ factText: 'Damage', coefficient: 0.3, weapon: 'rifle' }],
  // Thief/Daredevil — Staff 1 (chain depth 0), Staff Strike. PvE/WvW+PvP split (0.85/0.444).
  30614: [{ factText: 'Damage', coefficient: 0.444, weapon: 'staff' }],
  // Thief/Daredevil — Staff 1 (chain depth 1), Staff Bash. PvE/WvW+PvP split (0.9/0.444).
  30135: [{ factText: 'Damage', coefficient: 0.444, weapon: 'staff' }],
  // Thief/Daredevil — Staff 1 (chain depth 2), Punishing Strikes. `strikes=4` present -> wiki totaled.
  // PvE/WvW+PvP split (2.1/1.114).
  30434: [{ factText: 'Damage', coefficient: 1.114, weapon: 'staff' }],
  // Thief/Daredevil — Staff 1 (chain depth 3), Hook Strike. PvE/WvW+PvP split (0.65/0.01) — steep
  // competitive nerf.
  30210: [{ factText: 'Damage', coefficient: 0.01, weapon: 'staff' }],
  // Thief/Daredevil — Staff 2, Weakening Whirl. `strikes=3` present -> wiki totaled. PvE/WvW+PvP split
  // (2.22/1.35).
  29911: [{ factText: 'Damage', coefficient: 1.35, weapon: 'staff' }],
  // Thief/Daredevil — Staff 3, Debilitating Arc. PvE/WvW+PvP split (1.0/0.5).
  30520: [{ factText: 'Damage', coefficient: 0.5, weapon: 'staff' }],
  // Thief/Daredevil — Helmet Breaker (Debilitating Arc's flip target). PvE/WvW+PvP split (1.25/1.1).
  71802: [{ factText: 'Damage', coefficient: 1.1, weapon: 'staff' }],
  // Thief/Daredevil — Staff 4, Dust Strike. PvE/WvW+PvP split (1.8/1.05).
  30775: [{ factText: 'Damage', coefficient: 1.05, weapon: 'staff' }],
  // Thief/Daredevil — Staff 5, Vault. PvE/WvW+PvP split (2.25/1.82).
  30597: [{ factText: 'Damage', coefficient: 1.82, weapon: 'staff' }],
  // Thief — Shortbow 1 (chain depth 0), Trick Shot. PvE/WvW+PvP split (0.55/0.366).
  13022: [{ factText: 'Damage', coefficient: 0.366, weapon: 'shortbow' }],
  // Thief — Shortbow 1 (chain depth 1), Surprise Shot. No split (0.6).
  13129: [{ factText: 'Damage', coefficient: 0.6, weapon: 'shortbow' }],
  // Thief — Shortbow 2, Cluster Bomb. "Large Explosion" fact, PvE/WvW+PvP split (2.25/1.45).
  13041: [{ factText: 'Large Explosion', coefficient: 1.45, weapon: 'shortbow' }],
  // Thief — Detonate Cluster (Cluster Bomb's flip target). "Small Explosion" fact; no wiki `strikes=`
  // param despite a real local `hit_count: 4` (pulsing) — per-hit PvE/WvW+PvP split (0.5/0.375)
  // manually totaled by 4: PvE 2.0, WvW+PvP 1.5 used.
  13043: [{ factText: 'Small Explosion', coefficient: 1.5, weapon: 'shortbow' }],
  // Thief — Shortbow 3, Disabling Shot. No split (0.5).
  13083: [{ factText: 'Damage', coefficient: 0.5, weapon: 'shortbow' }],
  // Thief — Shortbow 4, Choking Gas. No split (0.6).
  13024: [{ factText: 'Damage', coefficient: 0.6, weapon: 'shortbow' }],
  // Thief — Speargun 1 (aquatic autoattack, chain depth 0), Piercing Shot. No split (0.55). Deadly Aim
  // (1299) trait-gated variant: 0.55*1.10=0.605 (matches API exactly).
  13072: [
    { factText: 'Damage', coefficient: 0.55, weapon: 'harpoon gun' },
    { factText: 'Damage', coefficient: 0.605, weapon: 'harpoon gun', requiresTrait: 1299 }
  ],
  // Thief — The Ripper (Piercing Shot's flip target, chain depth 1). No split (1.5). Deadly Aim (1299)
  // trait-gated variant: 1.5*1.10=1.65 (matches API exactly).
  13126: [
    { factText: 'Damage', coefficient: 1.5, weapon: 'harpoon gun' },
    { factText: 'Damage', coefficient: 1.65, weapon: 'harpoon gun', requiresTrait: 1299 }
  ],
  // Thief — Speargun 2 (aquatic), Deluge. No split (0.7). Deadly Aim (1299) trait-gated variant:
  // 0.7*1.10=0.77 (matches API exactly).
  13073: [
    { factText: 'Damage', coefficient: 0.7, weapon: 'harpoon gun' },
    { factText: 'Damage', coefficient: 0.77, weapon: 'harpoon gun', requiresTrait: 1299 }
  ],
  // Thief — Speargun 3 (aquatic), Escape. 2 distinct facts, neither split by mode: Missile Damage
  // (1.33), Damage (0.33). Deadly Aim (1299) trait-gated variants: 1.33*1.10=1.463,
  // 0.33*1.10=0.363 (both match API exactly).
  13074: [
    { factText: 'Missile Damage', coefficient: 1.33, weapon: 'harpoon gun' },
    { factText: 'Damage', coefficient: 0.33, weapon: 'harpoon gun' },
    { factText: 'Missile Damage', coefficient: 1.463, weapon: 'harpoon gun', requiresTrait: 1299 },
    { factText: 'Damage', coefficient: 0.363, weapon: 'harpoon gun', requiresTrait: 1299 }
  ],
  // Thief — Speargun 4 (aquatic), Crippling Shot. No split (1.75). Deadly Aim (1299) trait-gated
  // variant: 1.75*1.10=1.925 (matches API exactly).
  13075: [
    { factText: 'Damage', coefficient: 1.75, weapon: 'harpoon gun' },
    { factText: 'Damage', coefficient: 1.925, weapon: 'harpoon gun', requiresTrait: 1299 }
  ],
  // Thief — Speargun 5 (aquatic, chain depth 0), Ink Shot. No split (0.75). Deadly Aim (1299)
  // trait-gated variant: 0.75*1.10=0.825 (matches API exactly). Its flip target, Smoke Trail, has no
  // Damage fact — see block comment above.
  13076: [
    { factText: 'Damage', coefficient: 0.75, weapon: 'harpoon gun' },
    { factText: 'Damage', coefficient: 0.825, weapon: 'harpoon gun', requiresTrait: 1299 }
  ],
  // Thief — Spear 1 (land, Janthir Wilds, chain depth 0), Barbed Spear. No split (0.375).
  73145: [{ factText: 'Damage', coefficient: 0.375, weapon: 'spear' }],
  // Thief — Spear 1 (land, chain depth 1), Ashen Assault. `strikes=6` present -> wiki totaled.
  // PvE/WvW+PvP split (1.8/1.5).
  73005: [{ factText: 'Damage', coefficient: 1.5, weapon: 'spear' }],
  // Thief — Spear 1 (land, chain depth 2), Malicious Ashen Assault (same wiki-quoted values as Ashen
  // Assault — a 2-stage loop, same reachable-flip-target treatment as Repeater/Death's Judgment above).
  // `strikes=6` present -> wiki totaled. PvE/WvW+PvP split (1.8/1.5).
  72924: [{ factText: 'Damage', coefficient: 1.5, weapon: 'spear' }],
  // Thief — Spear 2 (land), Mantis Sting. PvE/WvW+PvP split (1.0/0.4).
  73041: [{ factText: 'Damage', coefficient: 0.4, weapon: 'spear' }],
  // Thief — Entangling Asp (Mantis Sting's flip target). PvE/WvW+PvP split (1.2/0.6).
  72896: [{ factText: 'Damage', coefficient: 0.6, weapon: 'spear' }],
  // Thief — Spear 3 (land, chain depth 0), Unsuspecting Strike. PvE/WvW+PvP split (0.8/0.3).
  72986: [{ factText: 'Damage', coefficient: 0.3, weapon: 'spear' }],
  // Thief — Vampiric Slash (Unsuspecting Strike's flip target, chain depth 1). PvE/WvW+PvP split
  // (1.0/0.8).
  73063: [{ factText: 'Damage', coefficient: 0.8, weapon: 'spear' }],
  // Thief — Spear 4 (land), Distracting Throw. PvE/WvW+PvP split (0.5/0.25).
  72927: [{ factText: 'Damage', coefficient: 0.25, weapon: 'spear' }],
  // Thief — Spear 1 (aquatic, classic chain, chain depth 0), Stab (thief spear skill). No split (1.05).
  13119: [{ factText: 'Damage', coefficient: 1.05, weapon: 'spear' }],
  // Thief — Spear 1 (aquatic, chain depth 1), Jab (thief skill). No split (1.15).
  13120: [{ factText: 'Damage', coefficient: 1.15, weapon: 'spear' }],
  // Thief — Spear 1 (aquatic, chain depth 2), Poison Tip Strike. No split (1.33).
  13121: [{ factText: 'Damage', coefficient: 1.33, weapon: 'spear' }],
  // Thief — Spear 2 (aquatic), Flanking Dive. No split on either fact: Damage (1.75), Damage When
  // Flanking (2.625).
  13069: [
    { factText: 'Damage', coefficient: 1.75, weapon: 'spear' },
    { factText: 'Damage When Flanking', coefficient: 2.625, weapon: 'spear' }
  ],
  // Thief — Spear 3 (aquatic, chain depth 0), Nine-Tailed Strike. `strikes=8` present -> wiki totaled,
  // no split (2.0). Final Strike Damage no split (0.5). Its flip target, Break Stance, has no Damage
  // fact — see block comment above.
  13122: [
    { factText: 'Damage', coefficient: 2.0, weapon: 'spear' },
    { factText: 'Final Strike Damage', coefficient: 0.5, weapon: 'spear' }
  ],
  // Thief — Spear 4 (aquatic, chain depth 0), Tow Line. No split (0.5).
  13070: [{ factText: 'Damage', coefficient: 0.5, weapon: 'spear' }],
  // Thief — Hooked Spear (Tow Line's flip target, chain depth 1). No split (1.25).
  50379: [{ factText: 'Damage', coefficient: 1.25, weapon: 'spear' }],
  // Thief — Spear 5 (aquatic), Shadow Assault. `strikes=3` present -> wiki totaled, no split (2.4).
  13068: [{ factText: 'Damage', coefficient: 2.4, weapon: 'spear' }],

  // --- Engineer done: this leg is the first in the sweep to cover Kit bundle-skills (the 5-skill
  // bars a Heal/Utility/Elite-slotted Kit swaps in for the weapon bar while active, resolved by
  // `bundle-skills.ts`'s `resolveActiveBundle`/`weapon-skills.ts`'s `resolveSkillBarIds` off each
  // Kit's own `Skill.bundleSkills` field — the exact same 5-slot resolver real weapons use). 106 raw
  // candidate ids (both the profession's 9 real weapon types' Weapon_1-5 entries AND all 9 Kits'
  // `bundleSkills`, already fully flip-chain-expanded — no further expansion needed this leg), 18
  // confirmed non-damage (Air Blast, 3 Super Elixir ids, Box of Nails, Magnet, Gear Shield, Box of
  // Piranhas, Bandage Blast, Elixir Shell, 2 Med Blaster ids, Cleansing Field, Vital Burst, 2
  // Infusion Bomb ids — Med Kit's entire kit plus a few scattered Tool Kit/Flamethrower/Elixir Gun
  // utility skills, no local `Damage`-type fact at all), 1 already seeded (Blunderbuss id 6153,
  // one-per-profession seed block above). That leaves 87 curated below, all wiki-verified, no
  // uncurated gaps this leg.
  //
  // **`weapon=kit` vs `weapon=unequipped` wrinkle (new this leg)**: every Kit's own skills use the
  // wiki's `weapon=kit` template param (a distinct 968.5 `WEAPON_STRENGTH_MIDPOINTS` entry, added for
  // this leg — see that map's own comment) EXCEPT Charrzooka, whose 5 skills all use
  // `weapon=unequipped` (690.5) instead — confirmed individually per skill via curl, not assumed from
  // the container Kit's own identity, since Elite Mortar Kit (also an Elite-slot Kit, same shape as
  // Charrzooka) uses `kit` like every other Kit. No pattern found that predicts which bucket a Kit
  // falls into from its slot/rarity/spec-gating; this was checked per-skill, not inferred.
  //
  // **Other new mechanics this leg surfaced**: (1) Grenade Kit's 5 skills each have 2 ids sharing one
  // name/wiki page — not the usual GroundTargeted-picker-duplicate shape seen elsewhere in this
  // sweep, but a genuine land (GroundTargeted+NoUnderwater) vs. underwater (auto-target) environment
  // split `resolveSkillBarIds`'s own land/water disambiguation signal correctly resolves — both ids
  // curated identically. (2) Sword's 4 skills (Sun Edge, its flip target Sun Ripper, Refraction
  // Cutter, Radiant Arc) each have a Holosmith-gated id and a spec-less Weaponmaster-Training id; the
  // task's initial assumption that these pairs "likely share one wiki page/values" turned out WRONG —
  // each has its own dedicated "(non-holosmith)" wiki page with genuinely different coefficients (not
  // just a naming split), corrected via individual fetches for all 4 non-holosmith pages. (3)
  // Refraction Cutter's Holosmith page (44110) itself under-documents a real PvE/WvW+PvP split on its
  // "Projectile Damage" fact — the page's own version history states a 2022-11-29 "PvE only" buff
  // that was apparently never re-split into 2 mode-tagged fact lines, but the local live API still
  // carries both values (0.4/0.275) and the sibling non-holosmith page (71121) explicitly documents
  // the identical split — used 0.275 (WvW), well-corroborated rather than guessed. (4) Two name
  // collisions with pages outside this profession: Mace Smash (63077, Mechanist) collides with
  // Warrior's own "Mace Smash" (already curated, id 14376) — resolved via the Mechanist id's own
  // otheruses hatnote pointing to "Mace Smash (mechanist)"; Lightning Rod (73002, Spear 3) collides
  // with the Elementalist trait of the same name, whose bare wiki title has NO disambiguation hatnote
  // at all (just redirects straight to the trait page) — resolved via an `insource:"73002"` full-text
  // search turning up "Lightning Rod (engineer spear skill)". (5) 5 multi-stage `flipSkill` chains
  // this leg: Tool Kit 1 (Smack -> Whack -> Thwack, 3 depths), Hammer/Scrapper 1 (Positive Strike ->
  // Negative Bash -> Equalizing Blow, 3 depths),
  // Mace/Mechanist 1 (Mace Strike -> Mace Smash -> Mace Blast, 3 depths), Rifle 1 (Rifle Burst ->
  // Rifle Burst Grenade, 2 depths, stays `weapon=rifle` throughout despite the "Grenade" name), and
  // land Spear's 3 independent chains (Puncturing Jab -> Rending Strike -> Amplifying Slice; Lightning
  // Rod -> Electric Artillery; Devastator -> Focused Devastation) — every stage curated under its own
  // id per this sweep's established convention. (6) Shield's Weapon_4/5 (Magnetic Shield/Static
  // Shield) both carry zero Damage fact of their own, same flip-architecture gap as Revenant's Chaotic
  // Release/Elementalist's Tailored Victory — their flip targets (Magnetic Inversion/Throw Shield)
  // carry the real Damage facts and are curated directly. (7) One `requires_trait` candidate
  // investigated and rejected: Pry Bar (Tool Kit 3) carries a `requires_trait: 531` (Power Wrench)
  // alternate Damage value that's LOWER than its base value — Power Wrench's own wiki description is
  // an unrelated elite-recharge-on-dodge effect with no damage bonus at all, so this isn't a real flat
  // bonus and isn't modeled (same documented-limitation bucket as Guardian's Symbolic Avenger) — no
  // other Engineer Weapon-slot candidate carried any `requires_trait`-gated Damage fact at all.
  // Engineer — Grenade Kit 1 (land, GroundTargeted), Grenade. PvE+WvW grouped vs. lower PvP
  // (0.33/0.25) — WvW value used. Shares this same wiki page/values with its underwater auto-target
  // sibling id 6171 (both genuinely reachable — `resolveSkillBarIds`'s land/water disambiguation
  // cleanly splits this GroundTargeted+NoUnderwater id from the flagless one).
  5882: [{ factText: 'Damage', coefficient: 0.33, weapon: 'kit' }],
  // Engineer — Grenade Kit 1 (underwater, auto-target), Grenade. Same wiki page/values as land id
  // 5882 above.
  6171: [{ factText: 'Damage', coefficient: 0.33, weapon: 'kit' }],
  // Engineer — Grenade Kit 2 (land), Shrapnel Grenade. PvE+WvW grouped vs. lower PvP (0.63/0.567) —
  // WvW value used. Same land/water dual-id shape as Grenade above.
  5807: [{ factText: 'Damage', coefficient: 0.63, weapon: 'kit' }],
  // Engineer — Grenade Kit 2 (underwater), Shrapnel Grenade. Same wiki page/values as land id 5807
  // above.
  6170: [{ factText: 'Damage', coefficient: 0.63, weapon: 'kit' }],
  // Engineer — Grenade Kit 3 (land), Flash Grenade. No split (0.1). Same land/water dual-id shape as
  // Grenade above.
  5808: [{ factText: 'Damage', coefficient: 0.1, weapon: 'kit' }],
  // Engineer — Grenade Kit 3 (underwater), Flash Grenade. Same wiki page/values as land id 5808
  // above.
  6169: [{ factText: 'Damage', coefficient: 0.1, weapon: 'kit' }],
  // Engineer — Grenade Kit 4 (land), Freeze Grenade. PvE/PvP+WvW split (0.75/0.5) — WvW value used.
  // Same land/water dual-id shape as Grenade above.
  5809: [{ factText: 'Damage', coefficient: 0.5, weapon: 'kit' }],
  // Engineer — Grenade Kit 4 (underwater), Freeze Grenade. Same wiki page/values as land id 5809
  // above.
  6168: [{ factText: 'Damage', coefficient: 0.5, weapon: 'kit' }],
  // Engineer — Grenade Kit 5 (land), Poison Grenade. 3-way PvE/WvW/PvP split (0.75/0.5/0.2) — WvW
  // value used. Same land/water dual-id shape as Grenade above.
  5806: [{ factText: 'Damage', coefficient: 0.5, weapon: 'kit' }],
  // Engineer — Grenade Kit 5 (underwater), Poison Grenade. Same wiki page/values as land id 5806
  // above.
  6167: [{ factText: 'Damage', coefficient: 0.5, weapon: 'kit' }],
  // Engineer — Bomb Kit 1, Bomb. 3-way PvE/WvW/PvP split (1.2/0.7/0.9) — WvW value used.
  5842: [{ factText: 'Damage', coefficient: 0.7, weapon: 'kit' }],
  // Engineer — Bomb Kit 2, Fire Bomb. No split (0.25).
  5823: [{ factText: 'Damage', coefficient: 0.25, weapon: 'kit' }],
  // Engineer — Bomb Kit 3, Galvanic Bomb. 3-way PvE/WvW/PvP split (2.5/1.4/1.7) — WvW value used.
  5822: [{ factText: 'Damage', coefficient: 1.4, weapon: 'kit' }],
  // Engineer — Bomb Kit 4, Magnetic Bomb. PvE/WvW+PvP split (1.5/0.01) — steep competitive nerf, WvW
  // value used.
  76530: [{ factText: 'Damage', coefficient: 0.01, weapon: 'kit' }],
  // Engineer — Bomb Kit 5, Big Ol' Bomb. PvE/PvP+WvW split (3.0/0.01) — steep competitive nerf, WvW
  // value used.
  5813: [{ factText: 'Damage', coefficient: 0.01, weapon: 'kit' }],
  // Engineer — Tool Kit 3, Pry Bar. PvE/PvP+WvW split (2.5/2.0) — WvW value used. Local
  // `traitedFacts` carries a `requires_trait: 531` (Power Wrench) alternate value (2.2, LOWER than
  // base) — Power Wrench's own wiki description is purely an elite-recharge-on-dodge effect with no
  // damage bonus at all, and the number doesn't fit any clean `base*(1+bonus)` formula — not a real
  // flat damage bonus, deliberately NOT modeled as `requiresTrait` (same documented-limitation
  // bucket as Guardian's Symbolic Avenger).
  5905: [{ factText: 'Damage', coefficient: 2, weapon: 'kit' }],
  // Engineer — Tool Kit 1 (chain depth 0), Smack. No split (0.8).
  5992: [{ factText: 'Damage', coefficient: 0.8, weapon: 'kit' }],
  // Engineer — Tool Kit 1 (chain depth 1), Whack. No split (0.8).
  5993: [{ factText: 'Damage', coefficient: 0.8, weapon: 'kit' }],
  // Engineer — Tool Kit 1 (chain depth 2), Thwack. No split (1.75).
  5994: [{ factText: 'Damage', coefficient: 1.75, weapon: 'kit' }],
  // Engineer — Flamethrower 1, Flame Jet. `strikes=10` present -> wiki totaled. 3-way PvE/WvW/PvP
  // split (2.5/1.2/1.5) — WvW value used.
  5928: [{ factText: 'Damage', coefficient: 1.2, weapon: 'kit' }],
  // Engineer — Flamethrower 2, Flame Blast. PvE+PvP grouped vs. WvW-only lower value (1.3/1.1) — WvW
  // value used.
  5931: [{ factText: 'Damage', coefficient: 1.1, weapon: 'kit' }],
  // Engineer — Flamethrower 5, Napalm. `strikes=10` present -> wiki totaled. 3-way PvE/PvP/WvW split
  // (5.0/2.8/2.4) — WvW value used.
  5929: [{ factText: 'Damage', coefficient: 2.4, weapon: 'kit' }],
  // Engineer — Flamethrower 4, Stoke the Flames. No split (0.5).
  76493: [{ factText: 'Damage', coefficient: 0.5, weapon: 'kit' }],
  // Engineer — Elixir Gun 1, Tranquilizer Dart. No split (0.4).
  5934: [{ factText: 'Damage', coefficient: 0.4, weapon: 'kit' }],
  // Engineer — Elixir Gun 2, Glob Shot. No split (0.75).
  5935: [{ factText: 'Damage', coefficient: 0.75, weapon: 'kit' }],
  // Engineer — Elixir Gun 3, Fumigate. `strikes=5` present -> wiki totaled. No split (0.4).
  5965: [{ factText: 'Damage', coefficient: 0.4, weapon: 'kit' }],
  // Engineer — Elixir Gun 4, Acid Bomb. Two distinct facts, both PvE+PvP grouped vs. WvW-only lower
  // value: Damage (0.85/0.7), Initial Damage (1.35/1.0) — WvW values used for both.
  5936: [
    { factText: 'Damage', coefficient: 0.7, weapon: 'kit' },
    { factText: 'Initial Damage', coefficient: 1, weapon: 'kit' }
  ],
  // Engineer — Charrzooka 1, Fire Rocket. No split (0.8). Wiki's own `weapon=unequipped` param (NOT
  // `weapon=kit` — Elite Mortar Kit below, also Elite-slot, uses `kit`; this genuinely differs
  // per-skill, not by slot type).
  12345: [{ factText: 'Damage', coefficient: 0.8, weapon: 'unequipped' }],
  // Engineer — Charrzooka 2, Rocket Spray. No split (0.5). `weapon=unequipped`.
  12348: [{ factText: 'Damage', coefficient: 0.5, weapon: 'unequipped' }],
  // Engineer — Charrzooka 3, Heat Seeker. No split (2.0). `weapon=unequipped`.
  12349: [{ factText: 'Damage', coefficient: 2, weapon: 'unequipped' }],
  // Engineer — Charrzooka 4, Rocket Jump. No split (0.1). `weapon=unequipped`.
  12347: [{ factText: 'Damage', coefficient: 0.1, weapon: 'unequipped' }],
  // Engineer — Charrzooka 5, Fire Rocket Barrage. `strikes=5` present -> wiki totaled. No split
  // (7.5). `weapon=unequipped`.
  12346: [{ factText: 'Damage', coefficient: 7.5, weapon: 'unequipped' }],
  // Engineer — Elite Mortar Kit 1, Mortar Shot. PvE+WvW grouped vs. lower PvP-only value (1.0/0.85)
  // — WvW value used, equals PvE here. `weapon=kit`.
  30371: [{ factText: 'Damage', coefficient: 1, weapon: 'kit' }],
  // Engineer — Elite Mortar Kit 2, Poison Gas Shell. PvE+WvW grouped vs. lower PvP-only value
  // (1.0/0.5) — WvW value used, equals PvE here. `weapon=kit`. Local API's own fact text is "Initial
  // Damage" despite the wiki template carrying no `alt=` param — matched on the API's text per this
  // table's usual rule.
  30885: [{ factText: 'Initial Damage', coefficient: 1, weapon: 'kit' }],
  // Engineer — Elite Mortar Kit 3, Endothermic Shell. Same PvE+WvW-grouped shape as Poison Gas Shell
  // above (1.0/0.5) — WvW value used. `weapon=kit`. Local API fact text "Initial Damage" (same
  // wiki/API-text mismatch as Poison Gas Shell).
  30307: [{ factText: 'Initial Damage', coefficient: 1, weapon: 'kit' }],
  // Engineer — Elite Mortar Kit 4, Flash Shell. Same PvE+WvW-grouped shape as Poison Gas Shell above
  // (1.0/0.5) — WvW value used. `weapon=kit`. Local API fact text "Initial Damage" (same
  // wiki/API-text mismatch as Poison Gas Shell).
  30121: [{ factText: 'Initial Damage', coefficient: 1, weapon: 'kit' }],
  // Engineer — Pistol 1, Fragmentation Shot. PvE/PvP+WvW split (0.4/0.266) — WvW value used.
  5827: [{ factText: 'Damage', coefficient: 0.266, weapon: 'pistol' }],
  // Engineer — Pistol 2, Poison Dart Volley. `strikes=5` present -> wiki totaled. PvE/PvP+WvW split
  // (2.0/1.0) — WvW value used.
  5828: [{ factText: 'Damage', coefficient: 1, weapon: 'pistol' }],
  // Engineer — Pistol 3, Static Shot. PvE/PvP+WvW split (0.4/0.3) — WvW value used.
  5829: [{ factText: 'Damage', coefficient: 0.3, weapon: 'pistol' }],
  // Engineer — Pistol 4, Blowtorch. Two independently-split facts: Maximum Damage (PvE/PvP+WvW
  // 2.0/1.0) and Minimum Damage (PvE/PvP+WvW 1.0/0.33) — WvW values used for both.
  5831: [
    { factText: 'Maximum Damage', coefficient: 1, weapon: 'pistol' },
    { factText: 'Minimum Damage', coefficient: 0.33, weapon: 'pistol' }
  ],
  // Engineer — Pistol 5, Glue Shot. PvE/PvP+WvW split (2.5/1.5) — WvW value used.
  5830: [{ factText: 'Damage', coefficient: 1.5, weapon: 'pistol' }],
  // Engineer — Rifle 1 (chain depth 0), Rifle Burst. PvE/PvP+WvW split (0.6/0.165) — WvW value used.
  6003: [{ factText: 'Damage', coefficient: 0.165, weapon: 'rifle' }],
  // Engineer — Rifle Burst's flip target (chain depth 1), Rifle Burst Grenade. PvE/PvP+WvW split
  // (0.8/0.22) — WvW value used. Still `weapon=rifle` despite the "Grenade" name — this is Rifle's
  // own follow-up, not a Kit skill.
  68079: [{ factText: 'Damage', coefficient: 0.22, weapon: 'rifle' }],
  // Engineer — Rifle 3, Net Shot. PvE/PvP+WvW split (1.25/0.3) — WvW value used.
  6004: [{ factText: 'Damage', coefficient: 0.3, weapon: 'rifle' }],
  // Engineer — Rifle 5, Jump Shot. Two independently-split facts: Leap Damage (PvE/PvP+WvW 0.3/0.1)
  // and Landing Damage (3-way PvE/WvW/PvP 2.4/1.45/1.74) — WvW values used for both. Wiki's own `id
  // = 6005, 5817` dual-id note is the usual GroundTargeted-pair shape, not a distinct second skill.
  6005: [
    { factText: 'Leap Damage', coefficient: 0.1, weapon: 'rifle' },
    { factText: 'Landing Damage', coefficient: 1.45, weapon: 'rifle' }
  ],
  // Engineer — Rifle 4, Overcharged Shot. PvE/PvP+WvW split (1.0/0.01) — steep competitive nerf, WvW
  // value used.
  6154: [{ factText: 'Damage', coefficient: 0.01, weapon: 'rifle' }],
  // Engineer — Shield's flip target (Static Shield's own follow-up), Throw Shield. No split (0.5).
  // Static Shield itself (6054) carries no Damage fact — reachable via the stacked flip-icon
  // treatment, same as this sweep's other flip-architecture-gap skills (e.g. Revenant's Chaotic
  // Release).
  6057: [{ factText: 'Damage', coefficient: 0.5, weapon: 'shield' }],
  // Engineer — Shield's other flip target (Magnetic Shield's own follow-up), Magnetic Inversion. No
  // split (0.25). Magnetic Shield itself (6053) carries no Damage fact — same reachable-flip-target
  // treatment as Throw Shield above.
  6126: [{ factText: 'Damage', coefficient: 0.25, weapon: 'shield' }],
  // Engineer — Speargun 5, Net Wall. No split (0.2).
  6145: [{ factText: 'Damage', coefficient: 0.2, weapon: 'harpoon gun' }],
  // Engineer — Speargun 2, Scatter Mines. `strikes=5` present -> wiki totaled. No split (4.2).
  6147: [{ factText: 'Damage', coefficient: 4.2, weapon: 'harpoon gun' }],
  // Engineer — Speargun 1, Homing Torpedo. No split (1.0).
  6148: [{ factText: 'Damage', coefficient: 1, weapon: 'harpoon gun' }],
  // Engineer — Speargun 4, Timed Charge. "Explosion Damage" fact, PvE/WvW+PvP split (3.5/1.75) — WvW
  // value used.
  6149: [{ factText: 'Explosion Damage', coefficient: 1.75, weapon: 'harpoon gun' }],
  // Engineer — Speargun 3, Capture Line. No split (0.4).
  50380: [{ factText: 'Damage', coefficient: 0.4, weapon: 'harpoon gun' }],
  // Engineer/Scrapper — Hammer 1 (chain depth 0), Positive Strike. PvE/PvP+WvW split (0.7/0.533) —
  // WvW value used.
  30501: [{ factText: 'Damage', coefficient: 0.533, weapon: 'hammer' }],
  // Engineer/Scrapper — Hammer 1 (chain depth 1), Negative Bash. PvE/PvP+WvW split (1.0/0.666) — WvW
  // value used.
  29785: [{ factText: 'Damage', coefficient: 0.666, weapon: 'hammer' }],
  // Engineer/Scrapper — Hammer 1 (chain depth 2), Equalizing Blow. PvE/PvP+WvW split (1.4/0.933) —
  // WvW value used.
  30489: [{ factText: 'Damage', coefficient: 0.933, weapon: 'hammer' }],
  // Engineer/Scrapper — Hammer 4, Shock Shield. `strikes=5` present -> wiki totaled. PvE/PvP+WvW
  // split (1.25/0.5) — WvW value used.
  29840: [{ factText: 'Damage', coefficient: 0.5, weapon: 'hammer' }],
  // Engineer/Scrapper — Hammer 2, Electro-whirl. `strikes=2` present -> wiki totaled. 3-way
  // PvE/WvW/PvP split (3.0/1.36/1.5) — WvW value used.
  30088: [{ factText: 'Damage', coefficient: 1.36, weapon: 'hammer' }],
  // Engineer/Scrapper — Hammer 3, Rocket Charge. `strikes=3` present -> wiki totaled. PvE/PvP+WvW
  // split (3.6/2.22) — WvW value used.
  30665: [{ factText: 'Damage', coefficient: 2.22, weapon: 'hammer' }],
  // Engineer/Scrapper — Hammer 5, Thunderclap. `strikes=5` present -> wiki totaled. PvE/PvP+WvW
  // split (4.0/2.25) — WvW value used.
  30713: [{ factText: 'Damage', coefficient: 2.25, weapon: 'hammer' }],
  // Engineer/Holosmith — Sword 1 (chain depth 0), Sun Edge. PvE/PvP+WvW split (0.88/0.586) — WvW
  // value used. Also carries a Percent-type "Damage Increase above 50% Heat" fact (20%/10% split),
  // not weapon-strength-scaled, not modeled here. Spec-less Weaponmaster-Training variant is id
  // 70514 below — its own dedicated wiki page quotes DIFFERENT numbers (0.96/0.61), not a shared
  // page as initially assumed — both curated independently.
  43476: [{ factText: 'Damage', coefficient: 0.586, weapon: 'sword' }],
  // Engineer/Holosmith — Sword 1 (chain depth 1), Sun Ripper. PvE/PvP+WvW split (0.93/0.62) — WvW
  // value used. Spec-less variant is id 69906 below, with its own different numbers (see Sun Edge
  // block comment above).
  45581: [{ factText: 'Damage', coefficient: 0.62, weapon: 'sword' }],
  // Engineer (spec-less, Weaponmaster Training) — Sword 1 (chain depth 0), Sun Edge. PvE/PvP+WvW
  // split (0.96/0.61) — WvW value used. Own dedicated "Sun Edge (non-holosmith)" wiki page with
  // values distinct from the Holosmith version (id 43476 above) — see that entry's block comment.
  70514: [{ factText: 'Damage', coefficient: 0.61, weapon: 'sword' }],
  // Engineer (spec-less, Weaponmaster Training) — Sword 1 (chain depth 1), Sun Ripper. PvE/PvP+WvW
  // split (1.02/0.65) — WvW value used. Own dedicated "Sun Ripper (non-holosmith)" page, values
  // distinct from the Holosmith version (id 45581 above).
  69906: [{ factText: 'Damage', coefficient: 0.65, weapon: 'sword' }],
  // Engineer/Holosmith — Sword 2, Refraction Cutter. Damage fact PvE/PvP+WvW split (1.4/0.75) — WvW
  // value used. Projectile Damage fact: the currently-cached wiki page shows only a single un-split
  // 0.4 (its own version history states a 2022-11-29 change "Increased projectile power coefficient
  // from 0.275 to 0.4 in PvE only" that was apparently never re-split into two mode-tagged facts on
  // this page), but the local API still carries 2 separate "Projectile Damage" facts (0.4 and 0.275)
  // and the sibling non-holosmith page (id 71121 below) explicitly documents this exact same
  // 0.4/0.275 PvE/WvW+PvP split for the identical fact — WvW value 0.275 used, well-corroborated
  // despite this page's own incomplete split.
  44110: [
    { factText: 'Damage', coefficient: 0.75, weapon: 'sword' },
    { factText: 'Projectile Damage', coefficient: 0.275, weapon: 'sword' }
  ],
  // Engineer (spec-less, Weaponmaster Training) — Sword 2, Refraction Cutter. Damage fact
  // PvE/PvP+WvW split (1.4/0.75) — WvW value used. Projectile Damage fact PvE/PvP+WvW split
  // (0.4/0.275) — WvW value used. Own dedicated "Refraction Cutter (non-holosmith)" page — see
  // Holosmith entry (44110) above for how its incomplete split was corroborated against this page.
  71121: [
    { factText: 'Damage', coefficient: 0.75, weapon: 'sword' },
    { factText: 'Projectile Damage', coefficient: 0.275, weapon: 'sword' }
  ],
  // Engineer/Holosmith — Sword 3, Radiant Arc. PvE/WvW+PvP split (2.5/1.65) — WvW value used.
  // Spec-less variant is id 69565 below, with a different WvW-side number (see that entry).
  40160: [{ factText: 'Damage', coefficient: 1.65, weapon: 'sword' }],
  // Engineer (spec-less, Weaponmaster Training) — Sword 3, Radiant Arc. PvE/WvW+PvP split (2.5/1.5)
  // — WvW value used, differs from the Holosmith version's 1.65 (id 40160 above) despite an
  // identical PvE side. Own dedicated "Radiant Arc (non-holosmith)" page.
  69565: [{ factText: 'Damage', coefficient: 1.5, weapon: 'sword' }],
  // Engineer/Mechanist — Mace 1 (chain depth 0), Mace Strike. PvE/WvW+PvP split (1.0/0.533) — WvW
  // value used.
  63186: [{ factText: 'Damage', coefficient: 0.533, weapon: 'mace' }],
  // Engineer/Mechanist — Mace 1 (chain depth 1), Mace Smash. PvE/WvW+PvP split (1.2/0.6) — WvW value
  // used. Name collision: the bare "Mace Smash" wiki title is Warrior's own Mace 1 skill (id 14376,
  // already curated in the Warrior leg) — this id's page is "Mace Smash (mechanist)", found via its
  // own otheruses hatnote.
  63077: [{ factText: 'Damage', coefficient: 0.6, weapon: 'mace' }],
  // Engineer/Mechanist — Mace 1 (chain depth 2), Mace Blast. PvE/WvW+PvP split (1.4/1.0) — WvW value
  // used.
  63174: [{ factText: 'Damage', coefficient: 1, weapon: 'mace' }],
  // Engineer/Mechanist — Mace 2, Energizing Slam. PvE/WvW+PvP split (1.85/1.5) — WvW value used.
  63169: [{ factText: 'Damage', coefficient: 1.5, weapon: 'mace' }],
  // Engineer/Mechanist — Mace 3, Rocket Fist Prototype. PvE/WvW+PvP split (1.2/0.01) — steep
  // competitive nerf, WvW value used.
  63234: [{ factText: 'Damage', coefficient: 0.01, weapon: 'mace' }],
  // Engineer — Shortbow 1, Arc Detonator. Shortbow is unlocked by owning Secrets of the Obscure
  // (wiki's own `requires = SotO` infobox param, confirmed live) rather than gated to an elite spec —
  // NOT Amalgam-exclusive despite the "one iconic weapon per elite spec" pattern Hammer/Sword/Mace
  // follow elsewhere in this leg; `specializationId` is null on every Shortbow skill, matching that.
  // Two distinct facts, neither split by mode: Damage (0.3), Shock Damage (0.2).
  71873: [
    { factText: 'Damage', coefficient: 0.3, weapon: 'shortbow' },
    { factText: 'Shock Damage', coefficient: 0.2, weapon: 'shortbow' }
  ],
  // Engineer — Shortbow 2, Essence of Animated Sand. PvE+WvW grouped vs. lower PvP-only value
  // (1.0/0.6) — WvW value used, equals PvE here.
  72052: [{ factText: 'Damage', coefficient: 1, weapon: 'shortbow' }],
  // Engineer — Shortbow 3, Essence of Living Shadows. Same PvE+WvW-grouped shape as Essence of
  // Animated Sand above (1.0/0.6) — WvW value used.
  71882: [{ factText: 'Damage', coefficient: 1, weapon: 'shortbow' }],
  // Engineer — Shortbow 4, Essence of Liquid Wrath. 3-way PvE/WvW/PvP split (1.32/0.75/1.0) — WvW
  // value used.
  71870: [{ factText: 'Damage', coefficient: 0.75, weapon: 'shortbow' }],
  // Engineer — Shortbow 5, Essence of Borrowed Time. PvE/PvP+WvW split (1.5/0.01) — steep competitive
  // nerf, WvW value used.
  71888: [{ factText: 'Damage', coefficient: 0.01, weapon: 'shortbow' }],
  // Engineer — Spear 1 (land, chain depth 0), Puncturing Jab. No split (0.45).
  72944: [{ factText: 'Damage', coefficient: 0.45, weapon: 'spear' }],
  // Engineer — Spear 1 (land, chain depth 1), Rending Strike. PvE/WvW+PvP split (0.65/0.45) — WvW
  // value used.
  73109: [{ factText: 'Damage', coefficient: 0.45, weapon: 'spear' }],
  // Engineer — Spear 1 (land, chain depth 2), Amplifying Slice. PvE/WvW+PvP split (0.99/0.65) — WvW
  // value used.
  73001: [{ factText: 'Damage', coefficient: 0.65, weapon: 'spear' }],
  // Engineer — Spear 2 (land), Conduit Surge. Two distinct facts, neither split by mode despite the
  // infobox's own `split = pve, wvw, pvp` header (only affects the burning facts, not Damage):
  // Focused Target Damage (1.2), Unfocused Target Damage (1.0).
  73122: [
    { factText: 'Focused Target Damage', coefficient: 1.2, weapon: 'spear' },
    { factText: 'Unfocused Target Damage', coefficient: 1, weapon: 'spear' }
  ],
  // Engineer — Spear 3 (land, chain depth 0), Lightning Rod. Two distinct facts, both PvE/WvW+PvP
  // split: Focused Target Damage (0.3/0.175), plain Damage (0.17/0.125) — WvW values used for both.
  // Name collision: the bare "Lightning Rod" wiki title redirects straight to the Elementalist trait
  // (id 1672) with no disambiguation hatnote at all — found via `insource:"73002"` full-text search,
  // real title "Lightning Rod (engineer spear skill)".
  73002: [
    { factText: 'Focused Target Damage', coefficient: 0.175, weapon: 'spear' },
    { factText: 'Damage', coefficient: 0.125, weapon: 'spear' }
  ],
  // Engineer — Spear 3 (land, chain depth 1), Electric Artillery. Two distinct facts, neither split
  // by mode despite the infobox's own `split = pve, wvw pvp` header (only affects the
  // burning-duration facts, not Damage): Focused Target Damage (1.5), plain Damage (1.0).
  73143: [
    { factText: 'Focused Target Damage', coefficient: 1.5, weapon: 'spear' },
    { factText: 'Damage', coefficient: 1, weapon: 'spear' }
  ],
  // Engineer — Spear 4 (land), Roiling Skies. PvE/PvP+WvW split (2.0/0.01) — steep competitive nerf,
  // WvW value used.
  72977: [{ factText: 'Damage', coefficient: 0.01, weapon: 'spear' }],
  // Engineer — Spear 5 (land, chain depth 0), Devastator. No split (2.0).
  72974: [{ factText: 'Damage', coefficient: 2, weapon: 'spear' }],
  // Engineer — Spear 5 (land, chain depth 1), Focused Devastation. `strikes=6` present -> wiki
  // totaled. PvE/WvW+PvP split (1.2/0.6) — WvW value used.
  73064: [{ factText: 'Damage', coefficient: 0.6, weapon: 'spear' }],

  // --- Necromancer done: 66 raw candidate ids (50 raw `weapons` entries, expanded to 66 via full
  // `flipSkill` chain walks — Revenant/Thief's fuller convention). 1 already seeded (Ghastly Claws
  // id 10528, one-per-profession seed block above), 5 confirmed non-damage (Soul Grasp, Distress —
  // Isolate's flip target, Sinking Tomb, Wail of Doom, Locust Swarm), leaving 60 curated below, 0
  // exclusions/gaps this leg. New mechanics: (1) Spear's land/aquatic dual-chain split (land ids
  // added by 2025-08-19 Weaponmaster Training, sharing the `weapons.Spear` entry with the
  // pre-existing classic aquatic autoattack chain, same `NoUnderwater`-flag disambiguation as every
  // earlier leg's Spear) appears across all 5 slots this time, not just the autoattack chain; (2) 2
  // name collisions resolved via search rather than an otheruses hatnote on the colliding page
  // itself: Trident 2 "Feast" (id 10624) — bare title redirects straight to "Feast (food)" with NO
  // disambiguation hatnote, found via `insource:"10624"` full-text search to "Feast (necromancer
  // skill)"; Sword 5's flip target "Consume" (id 71926) — bare title is a Revenant/Herald
  // skill-*type* disambiguation page (not a skill itself), resolved via its own otheruses hatnote to
  // "Consume (necromancer)"; (3) Scepter 3's Feast of Corruption (10709) and its Lingering-Curse-
  // trait replacement Devouring Darkness (51647, reached via the same `flipSkill` field this app's
  // chain-walk already treats like any other follow-up — a trait-driven whole-skill swap rather than
  // a player-triggered flip, curated identically per this sweep's "every reachable id gets its own
  // line" rule) both carry 2 separate local-API facts sharing the identical text "Damage" (one at the
  // untagged PvE value, one at the WvW+PvP-reduced value) instead of the usual single-PvE-value shape
  // — harmless for this table's lookup, which only checks fact existence/`requires_trait`, never the
  // fact's own `dmg_multiplier`; (4) Trident 2 Feast's local `flipSkill` points at Crimson Tide's own
  // id (10623, Weapon_1) rather than a genuine follow-up skill — inert for `resolveSkillBarIds`,
  // whose flip-target-removal step only ever compares within one slot's own candidate list, and
  // Crimson Tide is never itself a Weapon_2 candidate; (5) Focus 5 Spinal Shivers carries 4
  // simultaneous alt-labeled Damage facts gated by the caster's own boon-stack count at cast time
  // (not a `requires_trait` gate — a pure boon-count check with no combat-state equivalent in this
  // app), all 4 curated as always-visible separate lines, same multi-fact-per-id shape this table
  // already supports elsewhere. No `requires_trait`-gated Damage fact found on any candidate this
  // leg.
  // Necromancer — Axe 1, Rending Claws. `strikes=2` present -> wiki totaled. PvE/WvW+PvP split
  // (1.4/0.666) — WvW value used.
  10561: [{ factText: 'Damage', coefficient: 0.666, weapon: 'axe' }],
  // Necromancer — Axe 3, Unholy Feast. 3-way PvE/WvW/PvP split (2.5/1.2/1.5) — WvW value used.
  10701: [{ factText: 'Damage', coefficient: 1.2, weapon: 'axe' }],
  // Necromancer — Dagger 1 (chain depth 0), Necrotic Slash. `strikes=2` present -> wiki totaled.
  // PvE/WvW+PvP split (0.9/0.6) — WvW value used.
  10702: [{ factText: 'Damage', coefficient: 0.6, weapon: 'dagger' }],
  // Necromancer — Dagger 1 (chain depth 1), Necrotic Stab (flip target). PvE/WvW+PvP split
  // (0.9/0.466) — WvW value used.
  10703: [{ factText: 'Damage', coefficient: 0.466, weapon: 'dagger' }],
  // Necromancer — Dagger 2, Life Siphon. `strikes=9` present -> wiki totaled. PvE/WvW+PvP split
  // (2.7/2.25) — WvW value used. Separate Percent-type "Damage Increased While Bleeding" fact
  // (50%/20% split), not weapon-strength-scaled, not modeled here.
  69302: [{ factText: 'Damage', coefficient: 2.25, weapon: 'dagger' }],
  // Necromancer — Dagger 3, Dark Pact. PvE/WvW+PvP split (2.4/1.2) — WvW value used.
  10529: [{ factText: 'Damage', coefficient: 1.2, weapon: 'dagger' }],
  // Necromancer — Dagger 4, Deathly Swarm. PvE/WvW+PvP split (1.2/0.1) — steep competitive nerf, WvW
  // value used.
  10705: [{ factText: 'Damage', coefficient: 0.1, weapon: 'dagger' }],
  // Necromancer — Dagger 5, Enfeebling Blood (GroundTargeted). PvE/WvW+PvP split (1.5/0.5) — WvW
  // value used.
  10706: [{ factText: 'Damage', coefficient: 0.5, weapon: 'dagger' }],
  // Necromancer — Focus 5, Spinal Shivers. 4 independently PvE/WvW+PvP-split alt-labeled facts (see
  // block comment above): Damage—Three Boons (4.0/2.625), Damage—Two Boons (3.5/1.875), Damage—One
  // Boon (3.0/1.125), Damage—No Boons (2.5/0.50) — WvW values used for all 4.
  10555: [
    { factText: 'Damage—Three Boons', coefficient: 2.625, weapon: 'focus' },
    { factText: 'Damage—Two Boons', coefficient: 1.875, weapon: 'focus' },
    { factText: 'Damage—One Boon', coefficient: 1.125, weapon: 'focus' },
    { factText: 'Damage—No Boons', coefficient: 0.5, weapon: 'focus' }
  ],
  // Necromancer/Reaper — Greatsword 1 (chain depth 0), Dusk Strike. PvE/WvW+PvP split (1.2/0.666) —
  // WvW value used.
  29705: [{ factText: 'Damage', coefficient: 0.666, weapon: 'greatsword' }],
  // Necromancer/Reaper — Greatsword 1 (chain depth 1), Fading Twilight (flip target). PvE/WvW+PvP
  // split (1.4/0.866) — WvW value used.
  30799: [{ factText: 'Damage', coefficient: 0.866, weapon: 'greatsword' }],
  // Necromancer/Reaper — Greatsword 1 (chain depth 2), Chilling Scythe (flip target). PvE/WvW+PvP
  // split (1.8/1.133) — WvW value used.
  29867: [{ factText: 'Damage', coefficient: 1.133, weapon: 'greatsword' }],
  // Necromancer/Reaper — Greatsword 2, Gravedigger. PvE/WvW+PvP split (3.6/1.82) — WvW value used.
  30163: [{ factText: 'Damage', coefficient: 1.82, weapon: 'greatsword' }],
  // Necromancer/Reaper — Greatsword 3, Death Spiral. PvE/WvW+PvP split (3.0/1.6) — WvW value used.
  30860: [{ factText: 'Damage', coefficient: 1.6, weapon: 'greatsword' }],
  // Necromancer/Reaper — Greatsword 4, Nightfall. PvE/WvW+PvP split (1.15/0.364) — WvW value used.
  29855: [{ factText: 'Damage', coefficient: 0.364, weapon: 'greatsword' }],
  // Necromancer/Reaper — Greatsword 5, Grasping Darkness. PvE/WvW+PvP split (1.3/0.01) — steep
  // competitive nerf, WvW value used.
  29740: [{ factText: 'Damage', coefficient: 0.01, weapon: 'greatsword' }],
  // Necromancer — Spear 1 (land, chain depth 0), Dark Slash. PvE/WvW+PvP split (1.2/0.6) — WvW value
  // used.
  73012: [{ factText: 'Damage', coefficient: 0.6, weapon: 'spear' }],
  // Necromancer — Spear 1 (land, chain depth 1), Deadly Slice (flip target). PvE/WvW+PvP split
  // (1.4/0.8) — WvW value used.
  73040: [{ factText: 'Damage', coefficient: 0.8, weapon: 'spear' }],
  // Necromancer — Spear 1 (land, chain depth 2), Sinister Stab (flip target). PvE/WvW+PvP split
  // (1.8/1.0) — WvW value used.
  73047: [{ factText: 'Damage', coefficient: 1, weapon: 'spear' }],
  // Necromancer — Spear 2 (land), Perforate. `strikes=7` present -> wiki totaled. PvE/WvW+PvP split
  // (3.5/1.2) — WvW value used. Separate Percent-type "damage increase" fact (20%), not modeled.
  73068: [{ factText: 'Damage', coefficient: 1.2, weapon: 'spear' }],
  // Necromancer — Spear 3 (land), Addle. PvE/WvW+PvP split (1.9/0.4) — WvW value used.
  73013: [{ factText: 'Damage', coefficient: 0.4, weapon: 'spear' }],
  // Necromancer — Spear 4 (land, chain depth 0), Isolate. PvE/WvW+PvP split (2.4/0.5) — WvW value
  // used. Its flip target, Distress (73116), carries no Damage fact of its own — reachable via the
  // stacked flip-icon treatment, same as this sweep's other flip-architecture-gap skills (e.g.
  // Revenant's Chaotic Release).
  73107: [{ factText: 'Damage', coefficient: 0.5, weapon: 'spear' }],
  // Necromancer — Spear 5 (land), Extirpate. 3-way PvE/PvP/WvW split (3.8/2.25/2.0) — WvW value used.
  73007: [{ factText: 'Damage', coefficient: 2, weapon: 'spear' }],
  // Necromancer — Spear 1 (aquatic, classic chain, chain depth 0), Cruel Strike. No split (1.1).
  10692: [{ factText: 'Damage', coefficient: 1.1, weapon: 'spear' }],
  // Necromancer — Spear 1 (aquatic, chain depth 1), Wicked Strike (flip target). No split (1.2).
  10693: [{ factText: 'Damage', coefficient: 1.2, weapon: 'spear' }],
  // Necromancer — Spear 1 (aquatic, chain depth 2), Reaper's Scythe (flip target). No split (1.3).
  10617: [{ factText: 'Damage', coefficient: 1.3, weapon: 'spear' }],
  // Necromancer — Spear 2 (aquatic), Wicked Spiral. `strikes=6` present -> wiki totaled. No split
  // (3.996).
  10694: [{ factText: 'Damage', coefficient: 3.996, weapon: 'spear' }],
  // Necromancer — Spear 3 (aquatic), Deadly Feast. Wiki's own "life siphon damage" fact template
  // (not the usual plain "damage" template), but the local API still tags it as a normal Damage-type
  // fact with text "Damage" — matched on that per this table's usual rule. No split (0.4).
  10619: [{ factText: 'Damage', coefficient: 0.4, weapon: 'spear' }],
  // Necromancer — Spear 4 (aquatic), Deadly Catch. No split (0.75).
  10695: [{ factText: 'Damage', coefficient: 0.75, weapon: 'spear' }],
  // Necromancer — Spear 5 (aquatic), Dark Spear. Two distinct facts, neither split by mode: Missile
  // Damage (1.25), plain Damage (1.0).
  10616: [
    { factText: 'Missile Damage', coefficient: 1.25, weapon: 'spear' },
    { factText: 'Damage', coefficient: 1, weapon: 'spear' }
  ],
  // Necromancer/Harbinger — Pistol 1, Vicious Shot. PvE/WvW+PvP split (0.65/0.233) — WvW value used.
  62517: [{ factText: 'Damage', coefficient: 0.233, weapon: 'pistol' }],
  // Necromancer/Harbinger — Pistol 2, Weeping Shots. `strikes=6` present -> wiki totaled. PvE/WvW+PvP
  // split (2.4/1.02) — WvW value used.
  62513: [{ factText: 'Damage', coefficient: 1.02, weapon: 'pistol' }],
  // Necromancer/Harbinger — Pistol 3, Vile Blast. PvE/WvW+PvP split (1.0/0.01) — steep competitive
  // nerf, WvW value used.
  62511: [{ factText: 'Damage', coefficient: 0.01, weapon: 'pistol' }],
  // Necromancer — Scepter 1 (chain depth 0), Blood Curse. PvE/WvW+PvP split (0.35/0.233) — WvW value
  // used.
  10698: [{ factText: 'Damage', coefficient: 0.233, weapon: 'scepter' }],
  // Necromancer — Scepter 1 (chain depth 1), Rending Curse (flip target). Same PvE/WvW+PvP split
  // shape as Blood Curse (0.35/0.233), identical numbers — WvW value used.
  10699: [{ factText: 'Damage', coefficient: 0.233, weapon: 'scepter' }],
  // Necromancer — Scepter 1 (chain depth 2), Putrid Curse (flip target). PvE/WvW+PvP split
  // (0.5/0.333) — WvW value used.
  10552: [{ factText: 'Damage', coefficient: 0.333, weapon: 'scepter' }],
  // Necromancer — Scepter 2, Grasping Dead (GroundTargeted). PvE/WvW+PvP split (0.8/0.6) — WvW value
  // used.
  10532: [{ factText: 'Damage', coefficient: 0.6, weapon: 'scepter' }],
  // Necromancer — Scepter 3 (chain depth 0), Feast of Corruption. PvE/WvW+PvP split (1.0/0.75) — WvW
  // value used. Local API carries 2 separate identically-labeled "Damage" facts (see block comment
  // above) — harmless, this table's lookup only checks existence/`requires_trait`.
  10709: [{ factText: 'Damage', coefficient: 0.75, weapon: 'scepter' }],
  // Necromancer — Scepter 3 (chain depth 1), Devouring Darkness — Lingering Curse's trait-driven
  // full replacement for Feast of Corruption, reached via the same `flipSkill` field (see block
  // comment above). PvE/WvW+PvP split (1.16/0.928) — WvW value used. Same dual-identical-"Damage"-
  // fact shape as Feast of Corruption above.
  51647: [{ factText: 'Damage', coefficient: 0.928, weapon: 'scepter' }],
  // Necromancer — Staff 1, Necrotic Grasp. PvE/WvW+PvP split (1.0/0.444) — WvW value used.
  10596: [{ factText: 'Damage', coefficient: 0.444, weapon: 'staff' }],
  // Necromancer — Staff 2, Mark of Blood (GroundTargeted). PvE/WvW+PvP split (1.5/0.33) — WvW value
  // used.
  19117: [{ factText: 'Damage', coefficient: 0.33, weapon: 'staff' }],
  // Necromancer — Staff 3, Chillblains (GroundTargeted). PvE/WvW+PvP split (1.8/0.55) — WvW value
  // used.
  10605: [{ factText: 'Damage', coefficient: 0.55, weapon: 'staff' }],
  // Necromancer — Staff 4, Putrid Mark (GroundTargeted). No split (1.32).
  19116: [{ factText: 'Damage', coefficient: 1.32, weapon: 'staff' }],
  // Necromancer — Staff 5, Reaper's Mark (GroundTargeted). PvE/WvW+PvP split (3.0/0.01) — steep
  // competitive nerf, WvW value used.
  19115: [{ factText: 'Damage', coefficient: 0.01, weapon: 'staff' }],
  // Necromancer — Sword 1 (chain depth 0), Enervation Blade. PvE/WvW+PvP split (1.1/0.6) — WvW value
  // used.
  71986: [{ factText: 'Damage', coefficient: 0.6, weapon: 'sword' }],
  // Necromancer — Sword 1 (chain depth 1), Enervation Echo (flip target). Same PvE/WvW+PvP split
  // shape as Enervation Blade (1.1/0.6), identical numbers — WvW value used.
  71850: [{ factText: 'Damage', coefficient: 0.6, weapon: 'sword' }],
  // Necromancer — Sword 2 (chain depth 0), Ravenous Wave. 3-way PvE/WvW/PvP split (2.0/1.0/1.2) —
  // WvW value used.
  71883: [{ factText: 'Damage', coefficient: 1, weapon: 'sword' }],
  // Necromancer — Sword 2 (chain depth 1), Satiate (flip target). 3-way PvE/WvW/PvP split
  // (2.0/0.9/1.2) — WvW value used. Separate Percent-type "damage increase" fact (50%/20% split), not
  // modeled.
  71914: [{ factText: 'Damage', coefficient: 0.9, weapon: 'sword' }],
  // Necromancer — Sword 3 (chain depth 0), Path of Gluttony. 3-way PvE/WvW/PvP split
  // (2.0/0.75/1.25) — WvW value used.
  71799: [{ factText: 'Damage', coefficient: 0.75, weapon: 'sword' }],
  // Necromancer — Sword 3 (chain depth 1), Gorge (flip target). Same 3-way split shape as Path of
  // Gluttony (2.0/0.75/1.25), identical numbers — WvW value used.
  71871: [{ factText: 'Damage', coefficient: 0.75, weapon: 'sword' }],
  // Necromancer — Sword 4 (chain depth 0), Hungering Maelstrom (GroundTargeted). 3-way PvE/WvW/PvP
  // split (2.75/0.8/1.0) — WvW value used.
  71813: [{ factText: 'Damage', coefficient: 0.8, weapon: 'sword' }],
  // Necromancer — Sword 4 (chain depth 1), Gormandize (flip target). 3-way PvE/WvW/PvP split
  // (2.5/1.0/1.33) — WvW value used.
  72068: [{ factText: 'Damage', coefficient: 1, weapon: 'sword' }],
  // Necromancer — Sword 5 (chain depth 0), Devouring Visage. PvE/WvW+PvP split (1.5/0.01) — steep
  // competitive nerf, WvW value used.
  71998: [{ factText: 'Damage', coefficient: 0.01, weapon: 'sword' }],
  // Necromancer — Sword 5 (chain depth 1), Consume (flip target). Name collision: the bare "Consume"
  // wiki title is a Revenant/Herald skill-*type* disambiguation page, not a skill itself — resolved
  // via its own otheruses hatnote to "Consume (necromancer)". `strikes=5` present -> wiki totaled. No
  // split (2.5).
  71926: [{ factText: 'Damage', coefficient: 2.5, weapon: 'sword' }],
  // Necromancer/Scourge — Torch 4, Harrowing Wave. No split (0.8).
  45846: [{ factText: 'Damage', coefficient: 0.8, weapon: 'torch' }],
  // Necromancer/Scourge — Torch 5, Oppressive Collapse. PvE/WvW+PvP split (1.2/0.01) — steep
  // competitive nerf, WvW value used.
  44296: [{ factText: 'Damage', coefficient: 0.01, weapon: 'torch' }],
  // Necromancer — Trident 1, Crimson Tide. `strikes=2` present -> wiki totaled. No split (0.5). Wiki
  // page also lists a second id (50471) sharing these values — not a raw candidate in this
  // profession's own `weapons.Trident` entry, so ignored.
  10623: [{ factText: 'Damage', coefficient: 0.5, weapon: 'trident' }],
  // Necromancer — Trident 2, Feast. Name collision: the bare "Feast" wiki title redirects straight to
  // "Feast (food)" with no disambiguation hatnote at all — resolved via an `insource:"10624"`
  // full-text search to "Feast (necromancer skill)". No split (0.7). Its local `flipSkill` field
  // points at Crimson Tide's own id (10623, Weapon_1) rather than a genuine follow-up skill — inert
  // for `resolveSkillBarIds` (see block comment above).
  10624: [{ factText: 'Damage', coefficient: 0.7, weapon: 'trident' }],
  // Necromancer — Trident 3, Foul Current. No split (1.75).
  10625: [{ factText: 'Damage', coefficient: 1.75, weapon: 'trident' }],
  // Necromancer — Trident 5, Frozen Abyss. No split (3.0).
  10629: [{ factText: 'Damage', coefficient: 3, weapon: 'trident' }],

  // Weapon-slot sweep: Warrior, Guardian, Revenant, Ranger, Thief, Engineer, Necromancer done (7 of 9).
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
    const fact = allFacts.find(
      (f) => f.type === 'Damage' && f.text === entry.factText && (f.requires_trait ?? null) === (entry.requiresTrait ?? null)
    )
    if (!fact) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    const weaponStrength = WEAPON_STRENGTH_MIDPOINTS[entry.weapon]
    lines.push({ label: entry.factText, value: Math.round((weaponStrength * entry.coefficient * power) / targetArmor) })
  }
  return lines
}
