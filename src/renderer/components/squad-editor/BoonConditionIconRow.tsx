import type { ReactNode } from 'react'
import { Tooltip } from '@renderer/components/common/Tooltip'

export interface BoonConditionIconItem {
  key: string
  icon: string
  tooltip: ReactNode
}

interface Props {
  items: BoonConditionIconItem[]
  emptyLabel?: string
}

/**
 * Shared compact icon-row renderer for boon/condition summaries — used both for a single slot's
 * per-build breakdown (`SlotTile`) and the party-wide aggregate (`PartyRow`). Each caller computes
 * its own data (`groupBoonConditionSources` for one build, `computePartyBoonConditionSummary` for
 * a whole party) and maps it into this minimal `{key, icon, tooltip}` shape — no calc logic lives
 * here, just the icon+hover view.
 */
export function BoonConditionIconRow({ items, emptyLabel }: Props) {
  if (items.length === 0) {
    return emptyLabel ? <span className="boon-icon-row-empty muted">{emptyLabel}</span> : null
  }
  return (
    <div className="boon-icon-row">
      {items.map((item) => (
        <Tooltip key={item.key} content={item.tooltip}>
          <img className="boon-icon-row-icon" src={item.icon} alt="" />
        </Tooltip>
      ))}
    </div>
  )
}
