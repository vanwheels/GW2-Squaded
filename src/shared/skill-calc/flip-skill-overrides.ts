import type { Skill } from '../types'

/**
 * Hand-verified `flipSkill` corrections for the live API — most entries here fill in a link the API
 * never provides at all (`flipSkill: null`), but an entry can also REPLACE a present-but-wrong link
 * (see Shadow Bolt below) — `resolvedFlipSkillId` checks this map first for exactly that reason.
 *
 * - Facet of Elements (27014): every other Revenant Facet (Strength/Light/Chaos/Darkness) carries a
 *   real `flipSkill` pointer from its "place" cast to its own "Consume" skill, but this one comes
 *   back with `flipSkill: null`, flagged 2026-08-19 by the user ("facet of elements doesn't display
 *   its flip"). The wiki confirms the same mechanic exists here too — "this is a sequence skill that
 *   transforms into Elemental Blast when activated a second time" — so this is a genuine API data
 *   gap, not a real design difference. Elemental Blast exists as 2 ids sharing one name (27162
 *   `GroundTargeted`/240 radius/12s recharge, 51698 not-ground-targeted/360 radius/15s recharge) —
 *   the same "fast-cast keybind" duplicate shape `skill-variants.ts`'s `resolveGroup` already
 *   resolves generically for the skill PICKER (its `autoTarget`/`groundTarget` split, preferring the
 *   sole auto-target id when grouped by name). 51698 is used here too, for consistency with whichever
 *   id the rest of the app already treats as "the real skill" once both share a name-group.
 * - Shadow Bolt (63066, Specter Scepter mainhand skill 1): the live API's `flipSkill` points this at
 *   Shadowsquall (63314, this weapon slot's Stealth Attack replacement) instead of Double Bolt
 *   (63182), the real next autoattack-chain step — confirmed by all 3 chain skills' own wiki infobox
 *   `chain1 = Shadow Bolt | chain2 = Double Bolt | chain3 = Triple Bolt` fields, flagged 2026-09-20
 *   (TODO.md "Specter Scepter Auto Chain Display"). Every other weapon-1 autoattack's `flipSkill` in
 *   this app's data either walks a real further chain step (e.g. Dagger's Double Strike -> Wild
 *   Strike) or, when the chain is only 1 hit long, the Stealth Attack instead (e.g. Pistol's Vital
 *   Shot -> Sneak Attack, correct and left alone) — Scepter is the one case where the API chose the
 *   Stealth Attack over a real further chain step that does exist. Double Bolt's own `flipSkill`
 *   already correctly points at Triple Bolt, so only Shadow Bolt needs an entry here.
 *
 * Consulted anywhere a `Skill.flipSkill` walk needs this app's actual belief about a skill's flip
 * target, not just the API's own possibly-incomplete/wrong field — `resolvedFlipSkillId` below is
 * the one helper every such site (`multi-effect.ts`'s `flipTargetSkills`, `boon-calc/sources.ts`'s
 * `withFlipChain`, `skill-variants.ts`'s `stripFlipTargets`) should call instead of reading
 * `.flipSkill` directly, so a future gap or wrong link like these only needs an entry here rather
 * than a matching patch at every consuming site.
 */
export const FLIP_SKILL_OVERRIDES: ReadonlyMap<number, number> = new Map([
  [27014, 51698], // Facet of Elements -> Elemental Blast
  [63066, 63182] // Shadow Bolt -> Double Bolt (real chain step; API wrongly links to Shadowsquall)
])

/** `FLIP_SKILL_OVERRIDES` first (an explicit override always wins, even over a present-but-wrong
 *  `skill.flipSkill` — see Shadow Bolt above), falling back to `skill.flipSkill` for every other id. */
export function resolvedFlipSkillId(skill: Skill): number | null {
  return FLIP_SKILL_OVERRIDES.get(skill.id) ?? skill.flipSkill ?? null
}
