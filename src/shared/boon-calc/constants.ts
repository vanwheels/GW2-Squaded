/**
 * The fixed set of boon/condition names as they appear in the GW2 API's
 * `Fact.status` field (type: 'Buff'). This is a stable game constant (new
 * boons/conditions are very rare additions), not fetched data.
 */
export const BOON_NAMES = [
  'Aegis',
  'Alacrity',
  'Fury',
  'Might',
  'Protection',
  'Quickness',
  'Regeneration',
  'Resistance',
  'Resolution',
  'Stability',
  'Swiftness',
  'Vigor'
] as const

export const CONDITION_NAMES = [
  'Bleeding',
  'Blinded',
  'Burning',
  'Chilled',
  'Confusion',
  'Crippled',
  'Fear',
  'Immobile',
  'Poisoned',
  'Slow',
  'Taunt',
  'Torment',
  'Vulnerability',
  'Weakness'
] as const

/**
 * Hard-CC `Buff` facts with a real `duration` (unlike instant-effect knockback/launch/pull/float/
 * sink, which the API represents as `Fact.type: 'Distance'` with no duration at all — structurally
 * incompatible with the boon/condition/control/aura "Buff-with-duration" extraction this app uses,
 * so those are out of scope here). Confirmed exhaustive via a full scan of every `Buff`-type fact's
 * `status` across data/game-data/{skills,traits}.json this session — Stun and Daze are the only 2
 * that appear. Not affected by Concentration/Expertise (those only scale boons/conditions).
 */
export const CONTROL_NAMES = ['Daze', 'Stun'] as const

/**
 * All 7 auras, confirmed present as real `Buff` facts (with `status`/`duration`) via the same full
 * scan as `CONTROL_NAMES`. Not affected by Concentration/Expertise either — aura duration is fixed.
 */
export const AURA_NAMES = [
  'Chaos Aura',
  'Dark Aura',
  'Fire Aura',
  'Frost Aura',
  'Light Aura',
  'Magnetic Aura',
  'Shocking Aura'
] as const

export type BoonName = (typeof BOON_NAMES)[number]
export type ConditionName = (typeof CONDITION_NAMES)[number]
export type ControlName = (typeof CONTROL_NAMES)[number]
export type AuraName = (typeof AURA_NAMES)[number]

const BOON_SET = new Set<string>(BOON_NAMES)
const CONDITION_SET = new Set<string>(CONDITION_NAMES)
const CONTROL_SET = new Set<string>(CONTROL_NAMES)
const AURA_SET = new Set<string>(AURA_NAMES)

export function isBoonName(status: string): status is BoonName {
  return BOON_SET.has(status)
}

export function isConditionName(status: string): status is ConditionName {
  return CONDITION_SET.has(status)
}

export function isControlName(status: string): status is ControlName {
  return CONTROL_SET.has(status)
}

export function isAuraName(status: string): status is AuraName {
  return AURA_SET.has(status)
}
