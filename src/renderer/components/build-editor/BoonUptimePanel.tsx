import { useMemo } from 'react'
import type { Build } from '@shared/types'
import { computeBoonConditionSources, groupBoonConditionSources, type BoonConditionGroup } from '@shared/boon-calc/sources'
import { formatBoonDuration } from '@shared/boon-calc/format'
import { BOON_CONDITION_ICONS } from '@shared/boon-calc/icons'
import type { BoonName, ConditionName } from '@shared/boon-calc/constants'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  build: Build
}

/**
 * Per-build boon/condition source list (gw2skills.net-style): every skill/trait
 * that grants a boon or condition, grouped by boon/condition name. Durations use
 * WvW-specific values where available (see gameData.wvwFactOverrides /
 * scripts/fetch-wvw-splits.ts) and are then scaled by the build's gear-derived
 * boon/condition duration % (Concentration/Expertise on equipped armor/
 * trinkets/back) — see TODO.md for what's still open (food/utility
 * consumables, full WvW-split coverage). Squad-view mode (5
 * players' sources per boon) is a later addition.
 */
export function BoonUptimePanel({ build }: Props) {
  const gameData = useGameData()

  const groups = useMemo(
    () => groupBoonConditionSources(computeBoonConditionSources(build, gameData)),
    [build, gameData]
  )
  const boonGroups = groups.filter((g) => !g.isCondition)
  const conditionGroups = groups.filter((g) => g.isCondition)

  return (
    <div className="boon-uptime-panel">
      <h3>Boon &amp; condition uptime</h3>
      {groups.length === 0 ? (
        <p className="empty-state">
          No boon/condition sources yet — pick skills and traits to see them here.
        </p>
      ) : (
        <div className="boon-uptime-columns">
          <div>
            <h4>Boons</h4>
            {boonGroups.length > 0 ? (
              <BoonGroupList groups={boonGroups} />
            ) : (
              <p className="empty-state">No boon sources yet.</p>
            )}
          </div>
          <div>
            <h4>Conditions</h4>
            {conditionGroups.length > 0 ? (
              <BoonGroupList groups={conditionGroups} />
            ) : (
              <p className="empty-state">No condition sources yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BoonGroupList({ groups }: { groups: BoonConditionGroup[] }) {
  return (
    <div className="boon-groups">
      {groups.map((group) => (
        <div className="boon-group" key={group.name}>
          <div className="boon-group-name">
            <img
              className="boon-group-icon"
              src={BOON_CONDITION_ICONS[group.name as BoonName | ConditionName]}
              alt=""
            />
            <span>{group.name}</span>
          </div>
          <ul className="boon-source-list">
            {group.sources.map((source, index) => (
              <li key={`${source.sourceKind}-${source.sourceId}-${index}`}>
                <span className="boon-source-name">
                  <img className="boon-source-icon" src={source.sourceIcon} alt="" />
                  {source.sourceName}
                </span>
                <span className="boon-source-duration">
                  {formatBoonDuration(source.scaledDurationSeconds)}s
                  {source.applyCount > 1 ? ` × ${source.applyCount}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
