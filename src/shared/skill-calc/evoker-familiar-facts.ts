import type { Skill } from '../types'

/**
 * Elementalist Evoker's 4 Meditation Utility skills (Fox's Fury/Otter's Compassion/Toad's
 * Fortitude/Hare's Agility) — the family `additive-flip-pairs.ts` deliberately excluded from
 * `ADDITIVE_FLIP_PAIRS` (see that file's own doc comment for why the live target-minus-base diff
 * `additiveEnhancementFacts` uses would be wrong here). Resolved instead by this file, wiki-fetched
 * fresh 2026-08-15 (raw `{{skill fact}}` templates, `action=parse&prop=wikitext` for all 4 pages).
 *
 * Each skill shares one shape, confirmed per-skill against its own infobox: the equippable/visible
 * id (`skills.json`'s picker entry) carries almost no combat facts (Range/Recharge/a stray Radius or
 * Number-of-Targets duplicate only) — the real content (Damage, conditions, boons, StunBreak) all
 * lives on its `flipSkill` target instead, the same "flip-architecture gap" `damage-calc.ts`'s Evoker
 * comment already documents for these 4 skills' Damage facts specifically. Unlike a normal flip pair
 * though, the target's content isn't a 2nd *action* — it's the skill's own real, always-cast effect,
 * wrongly split across 2 ids by the API. So this is a **swap** (show the target's facts as if they
 * were the base's own, gw2skills.net shows these single-icon), not a diff.
 *
 * Within that always-shown content, exactly one further wrinkle: each skill's own description ends
 * "If [element] is your specialized element, this skill breaks stun[, ...]" — a real conditional gate
 * on `Build.familiarId` (choosing a familiar via the Evoker's F5 *is* choosing your specialized
 * element — wiki's own `Evoker` page: "Specializing into an element grants the familiar companion and
 * a familiar passive of the corresponding element", i.e. one build-time choice, not two). Of that
 * conditional text, only the StunBreak fact is actually present as a discrete API fact
 * (`type: 'StunBreak'`) on every one of the 4 targets — confirmed by direct comparison against each
 * skill's raw wikitext below. The wiki's other 2 gated bonuses (Fox's extra Might stacks, Toad's
 * Resistance, Hare's Blur) have NO matching API fact on either id at all, a 2nd, larger gap than the
 * "wrong id" one above — not just misplaced, genuinely absent — so they're not represented anywhere
 * in this app, same "API gives nothing to render" posture as Gunsaber's undocumented facts. Only
 * StunBreak is split out into its own gated divider; the rest of each target's facts always show,
 * regardless of the build's current familiar.
 *
 * - **Fox's Fury** (76711 -> 77282, Fire): description "Grant boons to nearby allies, then inflict
 *   burning on your target based on the amount of might you have. If fire is your specialized
 *   element, this skill breaks stun, grants additional boons, and strikes enemies around your
 *   target." Base/always-on: Damage x3 might-tiers, Burning x3 might-tiers (both already curated,
 *   `damage-calc.ts`), 2x Fury facts. Fire-gated (StunBreak only representable): breaks stun; the
 *   extra Might stacks/AoE Targets+Radius aren't in the API at all.
 * - **Otter's Compassion** (77190 -> 76563, Water): description "Remove conditions from nearby
 *   allies while granting them boons and increasing their incoming healing for a duration. If water
 *   is your specialized element, this skill breaks stun for nearby allies." Base/always-on:
 *   Conditions Removed, Resolution, Vigor, its own "+20% Heal Effectiveness" buff, Radius, Targets.
 *   Water-gated: breaks stun (the wiki's *only* gated bonus for this skill — no missing-fact gap
 *   here, StunBreak is the entire conditional text).
 * - **Toad's Fortitude** (77320 -> 77247, Earth): description "Block incoming attacks, then strike
 *   nearby enemies with shattering rocks. Grant protection to nearby allies if this skill completes
 *   successfully. If earth is your specialized element, this skill grants resistance to allies and
 *   breaks stun." Base/always-on: Damage (curated), Protection, Bleeding, block Duration, Radius,
 *   Targets. Earth-gated (StunBreak only representable): breaks stun; the Resistance grant isn't in
 *   the API.
 * - **Hare's Agility** (77038 -> 76583, Air): description "Gain endurance and swiftness. Your next
 *   few strikes create an arc of chain lightning. If air is your specialized element, this skill
 *   breaks stun and grants blur." Base/always-on: Damage (curated), Electric Enchantment, Swiftness,
 *   Endurance Gained, Range, Targets. Air-gated (StunBreak only representable): breaks stun; the Blur
 *   grant isn't in the API.
 */
export const EVOKER_FAMILIAR_BASE_TO_TARGET_ID: ReadonlyMap<number, number> = new Map([
  [76711, 77282], // Fox's Fury
  [77190, 76563], // Otter's Compassion
  [77320, 77247], // Toad's Fortitude
  [77038, 76583] // Hare's Agility
])

/** Stop-set for `multi-effect.ts`'s `flipTargetSkills` — same purpose as `ADDITIVE_FLIP_PAIR_TARGET_
 *  IDS`, kept as its own set since this family isn't in `ADDITIVE_FLIP_PAIRS` (a swap, not a diff). */
export const EVOKER_FAMILIAR_TARGET_IDS: ReadonlySet<number> = new Set(EVOKER_FAMILIAR_BASE_TO_TARGET_ID.values())

/** The `Familiar.element` (`Build.familiarId`, resolved by the caller) that must be the build's
 *  current specialized element for a target id's own StunBreak fact to actually apply. */
export const EVOKER_FAMILIAR_SPECIALIZED_ELEMENT: ReadonlyMap<number, string> = new Map([
  [77282, 'Fire'],
  [76563, 'Water'],
  [77247, 'Earth'],
  [76583, 'Air']
])

/** `skill`'s flip target if it's one of the 4 Evoker Meditation base ids above, else `null` — see
 *  this file's doc comment for why the target's facts should always be shown as the base's own,
 *  swap-not-stack, the same shape `activeAttunementVariantSkill`/`glyphFormFactSourceSkill` use. */
export function evokerFamiliarFactSourceSkill(skill: Skill, skillsById: Map<number, Skill>): Skill | null {
  const targetId = EVOKER_FAMILIAR_BASE_TO_TARGET_ID.get(skill.id)
  if (targetId === undefined) return null
  return skillsById.get(targetId) ?? null
}
