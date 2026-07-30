import { useMemo } from 'react'
import type { Build } from '@shared/types'
import { computeCharacterStats } from '@shared/gear-calc/derived-stats'
import { formatBoonPercent } from '@shared/boon-calc/format'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  build: Build
}

/**
 * gw2skills.net-style stats sidebar: left column = raw attribute totals (base character value +
 * every gear/rune/infusion/food/utility contribution), right column = derived/converted values.
 * Design confirmed via reference screenshots in a prior session (see TODO.md); formulas are
 * quoted directly from the wiki (see src/shared/gear-calc/derived-stats.ts), not guessed.
 */
export function StatsPanel({ build }: Props) {
  const gameData = useGameData()

  const stats = useMemo(() => computeCharacterStats(build, gameData), [build, gameData])

  const round = (n: number): number => Math.round(n)

  return (
    <div className="stats-panel">
      <h3>Stats</h3>
      <div className="stats-panel-columns">
        <ul className="stats-list">
          <li>
            <span>Power</span>
            <span>{round(stats.attributes.power)}</span>
          </li>
          <li>
            <span>Toughness</span>
            <span>{round(stats.attributes.toughness)}</span>
          </li>
          <li>
            <span>Vitality</span>
            <span>{round(stats.attributes.vitality)}</span>
          </li>
          <li>
            <span>Precision</span>
            <span>{round(stats.attributes.precision)}</span>
          </li>
          <li>
            <span>Ferocity</span>
            <span>{round(stats.attributes.ferocity)}</span>
          </li>
          <li>
            <span>Healing Power</span>
            <span>{round(stats.attributes.healingPower)}</span>
          </li>
          <li>
            <span>Condition Damage</span>
            <span>{round(stats.attributes.conditionDamage)}</span>
          </li>
          <li>
            <span>Expertise</span>
            <span>{round(stats.attributes.expertise)}</span>
          </li>
          <li>
            <span>Concentration</span>
            <span>{round(stats.attributes.concentration)}</span>
          </li>
        </ul>
        <ul className="stats-list">
          <li>
            <span>Armor</span>
            <span>{round(stats.derived.armor)}</span>
          </li>
          <li>
            <span>Health</span>
            <span>{round(stats.derived.health)}</span>
          </li>
          <li>
            <span>Critical Chance</span>
            <span>{formatBoonPercent(stats.derived.criticalChance)}%</span>
          </li>
          <li>
            <span>Critical Damage</span>
            <span>{formatBoonPercent(stats.derived.criticalDamage)}%</span>
          </li>
          <li>
            <span>Boon Duration</span>
            <span>{formatBoonPercent(stats.derived.boonDuration)}%</span>
          </li>
          <li>
            <span>Condition Duration</span>
            <span>{formatBoonPercent(stats.derived.conditionDuration)}%</span>
          </li>
          <li>
            <span>Magic Find</span>
            <span>{formatBoonPercent(stats.derived.magicFind)}%</span>
          </li>
        </ul>
      </div>
      <p className="muted stats-panel-caveat">
        Assumes level-80 Ascended gear on every filled slot, and includes rune stage bonuses (by
        same-rune armor count), infusions, and the equipped food/utility consumable. Does not yet
        include relic effects (no numeric data exposed by the public API — see TODO.md) or the
        bottom Conditions/Boons/Control/Auras bar (see the Boon &amp; Condition Uptime panel below
        for boon/condition sources specifically).
      </p>
    </div>
  )
}
