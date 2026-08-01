import type { ReactNode } from 'react'
import { Tooltip } from '@renderer/components/common/Tooltip'

export interface BoonConditionIconItem {
  key: string
  icon: string
  tooltip: ReactNode
  /** Extra class appended to this item's icon only — e.g. greying out a boon/condition the
   *  current build doesn't produce, while still showing its icon and a name-only tooltip. */
  className?: string
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
          <img
            className={item.className ? `boon-icon-row-icon ${item.className}` : 'boon-icon-row-icon'}
            src={item.icon}
            alt=""
          />
        </Tooltip>
      ))}
    </div>
  )
}
