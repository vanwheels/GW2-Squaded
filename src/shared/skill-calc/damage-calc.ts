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
 * Seeded 2026-08-02 with one common WvW weapon skill per base profession — same "add entries
 * incrementally as specific builds get tested" policy as `CURATED_HEALING_COEFFICIENTS`, not a bulk
 * pass. Only skills confirmed to be the *actually-equippable* skill id (cross-checked against
 * `professions.json`'s own weapon-skill lists, not just matched by name — several skill names have
 * multiple near-duplicate ids in skills.json, e.g. Ranger's "Maul" has 6) are curated here.
 */
export const CURATED_DAMAGE_COEFFICIENTS: Record<number, DamageCoefficient[]> = {
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
  10220: [{ factText: 'Damage', coefficient: 0.01, weapon: 'greatsword' }]
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
