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

  // --- Elite-slot skills (category sweep started 2026-08-04, see TODO.md/COMPLETED.md; done
  // profession-by-profession per user request rather than all at once — 48 raw candidates, larger
  // than Healing's equivalent 12). Sub-swept so far: Warrior, Guardian, Revenant.
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
  62942: [{ factText: 'Damage', coefficient: 2.67, weapon: 'unequipped' }]
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
