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
 * All 7 auras, confirmed present as real `Buff` facts (with `status`/`duration`) via a full scan of
 * every `Buff`-type fact's `status` across data/game-data/{skills,traits}.json. Not affected by
 * Concentration/Expertise either — aura duration is fixed. (Control/Hard-CC — Stun, Daze,
 * Knockdown, Knockback, Launch, Pull — turned out NOT to fit this same `Buff`-status shape; see
 * `CONTROL_MATCHERS` in sources.ts.)
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
export type AuraName = (typeof AURA_NAMES)[number]

const BOON_SET = new Set<string>(BOON_NAMES)
const CONDITION_SET = new Set<string>(CONDITION_NAMES)
const AURA_SET = new Set<string>(AURA_NAMES)

export function isBoonName(status: string): status is BoonName {
  return BOON_SET.has(status)
}

export function isConditionName(status: string): status is ConditionName {
  return CONDITION_SET.has(status)
}

export function isAuraName(status: string): status is AuraName {
  return AURA_SET.has(status)
}
