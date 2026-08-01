import type { Build, EquipmentSlotKey } from '../types'
import { ALL_CORE_ATTRIBUTE_KEYS, isActiveWeaponSlot } from './attribute-totals'

/**
 * Ephemeral "what-if" combat inputs for the Stats panel — deliberately never persisted on `Build`
 * (resets on reload/build switch, unlike every other build-editor field). This models a snapshot
 * of buffs/stacks a player might have mid-fight, not a build choice like equipment/skills. See
 * TODO.md's "Combat state" design writeup for the reasoning behind each field.
 */
export interface CombatState {
  /** 0-25 stacks. */
  mightStacks: number
  /** Fury's effect on specific skills/traits ("while under the effect of Fury") is NOT modeled —
   *  no structural data exists anywhere in the app for conditional Fury-gated bonuses. */
  furyActive: boolean
  /** 0-25 stacks of whichever stacking sigil is equipped on the active weapon set, if any — see
   *  `detectActiveStackingSigil`. Meaningless when no stacking sigil is equipped. */
  stackingSigilStacks: number
  /** Only meaningful when the equipped relic has a curated entry in
   *  `CURATED_RELIC_DAMAGE_BONUSES` below. */
  relicActive: boolean
}

export const DEFAULT_COMBAT_STATE: CombatState = {
  mightStacks: 0,
  furyActive: false,
  stackingSigilStacks: 0,
  relicActive: false
}

// wiki-confirmed flat value at level 80, quoted directly (not derived from a per-level formula).
export const MIGHT_POWER_PER_STACK = 34
export const MIGHT_CONDITION_DAMAGE_PER_STACK = 34

export const FURY_CRITICAL_CHANCE_PERCENT = 20

const ALL_STATS = 'AllStats' as const

/**
 * The 8 sigils whose description matches "Gain a charge of +X <attribute> each time you kill a
 * foe... Max 25 stacks" — confirmed exhaustive via a full scan of data/game-data/sigils.json,
 * these are the only sigils with that text. Attribute keys match the `ItemStat`/API convention
 * used throughout gear-calc (see attribute-totals.ts), except `AllStats`, a sentinel this module
 * expands to all 9 core attributes (Superior Sigil of the Stars' "+2 to all stats" wording).
 */
export const STACKING_SIGILS: Record<number, { name: string; attribute: string | typeof ALL_STATS; perStack: number }> = {
  24575: { name: 'Superior Sigil of Bloodlust', attribute: 'Power', perStack: 10 },
  24578: { name: 'Superior Sigil of Corruption', attribute: 'ConditionDamage', perStack: 10 },
  24580: { name: 'Superior Sigil of Perception', attribute: 'Precision', perStack: 10 },
  24582: { name: 'Superior Sigil of Life', attribute: 'Healing', perStack: 10 },
  49457: { name: 'Superior Sigil of Momentum', attribute: 'Toughness', perStack: 5 },
  67341: { name: 'Superior Sigil of Cruelty', attribute: 'CritDamage', perStack: 10 },
  81045: { name: 'Superior Sigil of Bounty', attribute: 'BoonDuration', perStack: 9 },
  86170: { name: 'Superior Sigil of the Stars', attribute: ALL_STATS, perStack: 2 }
}

/**
 * Relic ids whose full proc is a flat, unconditional outgoing-strike-damage-% bonus — hand-curated
 * from data/game-data/relic-effects.json's "Damage Increase" facts, one manual wiki-verification
 * pass per relic (same process as `wvwFactOverrides`, see docs/game-data.md). Relic of Fireworks is
 * the only relic verified so far; most other "Damage Increase" relics carry conditions (target
 * health, weapon type, class) that need the same check before being added here. Both ids below are
 * "Relic of Fireworks" — relics.json lists the same relic twice under different ids — so either
 * pick in the equipment editor is recognized.
 */
export const CURATED_RELIC_DAMAGE_BONUSES: Record<number, number> = {
  100262: 7, // Relic of Fireworks
  100947: 7 // Relic of Fireworks (duplicate relics.json id, identical effect)
}

export interface ActiveStackingSigil {
  sigilId: number
  name: string
  attribute: string
  perStack: number
}

/**
 * Auto-detects the stacking sigil to show a stepper for, from whichever sigil is actually
 * equipped — no separate picker. Mirrors `isActiveWeaponSlot`'s "only the active weapon set
 * counts" gating so this matches the in-game rule that only one stacking sigil can be active at a
 * time; returns the first match found since a build should never legally have 2 different
 * stacking sigils equipped on the same active set anyway.
 */
export function detectActiveStackingSigil(build: Build): ActiveStackingSigil | null {
  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    if (!slotKey.startsWith('weapon') || !isActiveWeaponSlot(slotKey, build)) continue
    for (const sigilId of build.equipment[slotKey]?.sigilIds ?? []) {
      if (sigilId == null) continue
      const entry = STACKING_SIGILS[sigilId]
      if (entry) return { sigilId, name: entry.name, attribute: entry.attribute, perStack: entry.perStack }
    }
  }
  return null
}

/**
 * Raw core-attribute point deltas contributed by Might and an active stacking sigil, in the same
 * `points` shape `computeGearAttributeTotals` produces — merged into that total by
 * `computeCharacterStats` before deriving the stats-panel values. Fury and the relic bonus don't
 * go through this path since they apply directly to derived stats, not raw attribute points.
 */
export function combatStatePoints(build: Build, state: CombatState): Record<string, number> {
  const points: Record<string, number> = {}
  const add = (attribute: string, value: number): void => {
    points[attribute] = (points[attribute] ?? 0) + value
  }

  if (state.mightStacks > 0) {
    add('Power', state.mightStacks * MIGHT_POWER_PER_STACK)
    add('ConditionDamage', state.mightStacks * MIGHT_CONDITION_DAMAGE_PER_STACK)
  }

  const sigil = detectActiveStackingSigil(build)
  if (sigil && state.stackingSigilStacks > 0) {
    const value = sigil.perStack * state.stackingSigilStacks
    if (sigil.attribute === ALL_STATS) {
      for (const attribute of ALL_CORE_ATTRIBUTE_KEYS) add(attribute, value)
    } else {
      add(sigil.attribute, value)
    }
  }

  return points
}
