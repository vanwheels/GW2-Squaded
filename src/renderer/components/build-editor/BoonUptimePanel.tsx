import { useMemo } from 'react'
import type { Build } from '@shared/types'
import { computeBoonConditionSources, groupBoonConditionSources, type BoonConditionGroup } from '@shared/boon-calc/sources'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  build: Build
}

/**
 * Per-build boon/condition source list (gw2skills.net-style): every skill/trait
 * that grants a boon or condition, grouped by boon/condition name. Durations are
 * base (unscaled) values straight from the GW2 API facts — see the caveat note
 * below and TODO.md for why gear/food scaling and WvW-vs-PvE verification are
 * still open. Squad-view mode (5 players' sources per boon) is a later addition.
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
      <p className="muted boon-uptime-caveat">
        Base durations only — not yet scaled by boon/condition duration (gear) or food/utility.
        The public GW2 API also doesn't reliably distinguish WvW-specific balance from PvE, so
        cross-check anything high-stakes against the wiki.
      </p>
      {groups.length === 0 ? (
        <p className="empty-state">
          No boon/condition sources yet — pick skills and traits to see them here.
        </p>
      ) : (
        <>
          {boonGroups.length > 0 && (
            <>
              <h4>Boons</h4>
              <BoonGroupList groups={boonGroups} />
            </>
          )}
          {conditionGroups.length > 0 && (
            <>
              <h4>Conditions</h4>
              <BoonGroupList groups={conditionGroups} />
            </>
          )}
        </>
      )}
    </div>
  )
}

function BoonGroupList({ groups }: { groups: BoonConditionGroup[] }) {
  return (
    <div className="boon-groups">
      {groups.map((group) => (
        <div className="boon-group" key={group.name}>
          <div className="boon-group-name">{group.name}</div>
          <ul className="boon-source-list">
            {group.sources.map((source, index) => (
              <li key={`${source.sourceKind}-${source.sourceId}-${index}`}>
                <span className="boon-source-name">{source.sourceName}</span>
                <span className="boon-source-duration">
                  {source.baseDurationSeconds}s{source.applyCount > 1 ? ` × ${source.applyCount}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
