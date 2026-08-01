import { Fragment, useMemo } from 'react'
import type { Build } from '@shared/types'
import { computeCharacterStats } from '@shared/gear-calc/derived-stats'
import { DEFAULT_COMBAT_STATE, type CombatState } from '@shared/gear-calc/combat-state'
import { formatBoonPercent } from '@shared/boon-calc/format'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  build: Build
  combatState?: CombatState
}

interface StatRow {
  leftLabel: string
  leftValue: string
  rightLabel?: string
  rightValue?: string
}

/**
 * gw2skills.net-style stats sidebar: left column = raw attribute totals (base character value +
 * every gear/rune/infusion/food/utility contribution), right column = derived/converted values,
 * paired by row where the attribute directly feeds the derived stat (e.g. Vitality/Health).
 * Design confirmed via reference screenshots in a prior session (see TODO.md); formulas are
 * quoted directly from the wiki (see src/shared/gear-calc/derived-stats.ts), not guessed.
 *
 * Rendered as a single flat grid (rather than two independent lists) so left/right rows share
 * the same grid row tracks and line up pixel-for-pixel.
 */
export function StatsPanel({ build, combatState = DEFAULT_COMBAT_STATE }: Props) {
  const gameData = useGameData()

  const stats = useMemo(
    () => computeCharacterStats(build, gameData, combatState),
    [build, gameData, combatState]
  )

  const round = (n: number): number => Math.round(n)

  const rows: StatRow[] = [
    { leftLabel: 'Power', leftValue: `${round(stats.attributes.power)}`, rightLabel: 'Condition Damage', rightValue: `${round(stats.attributes.conditionDamage)}` },
    { leftLabel: 'Vitality', leftValue: `${round(stats.attributes.vitality)}`, rightLabel: 'Health', rightValue: `${round(stats.derived.health)}` },
    { leftLabel: 'Toughness', leftValue: `${round(stats.attributes.toughness)}`, rightLabel: 'Armor', rightValue: `${round(stats.derived.armor)}` },
    { leftLabel: 'Precision', leftValue: `${round(stats.attributes.precision)}`, rightLabel: 'Critical Chance', rightValue: `${formatBoonPercent(stats.derived.criticalChance)}%` },
    { leftLabel: 'Ferocity', leftValue: `${round(stats.attributes.ferocity)}`, rightLabel: 'Critical Damage', rightValue: `${formatBoonPercent(stats.derived.criticalDamage)}%` },
    { leftLabel: 'Concentration', leftValue: `${round(stats.attributes.concentration)}`, rightLabel: 'Boon Duration', rightValue: `${formatBoonPercent(stats.derived.boonDuration)}%` },
    { leftLabel: 'Expertise', leftValue: `${round(stats.attributes.expertise)}`, rightLabel: 'Condition Duration', rightValue: `${formatBoonPercent(stats.derived.conditionDuration)}%` },
    { leftLabel: 'Healing Power', leftValue: `${round(stats.attributes.healingPower)}`, rightLabel: 'Magic Find', rightValue: `${formatBoonPercent(stats.derived.magicFind)}%` },
    { leftLabel: '', leftValue: '', rightLabel: 'Outgoing Damage', rightValue: `${formatBoonPercent(stats.derived.outgoingDamagePercent)}%` },
  ]

  return (
    <div className="stats-panel">
      <h3>Stats</h3>
      <div className="stats-panel-grid">
        {rows.map((row) => (
          <Fragment key={`${row.leftLabel}-${row.rightLabel}`}>
            <span className="stat-cell stat-label">{row.leftLabel}</span>
            <span className="stat-cell stat-value">{row.leftValue}</span>
            <span className="stat-gap" aria-hidden="true" />
            <span className="stat-cell stat-label">{row.rightLabel ?? ''}</span>
            <span className="stat-cell stat-value">{row.rightValue ?? ''}</span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
