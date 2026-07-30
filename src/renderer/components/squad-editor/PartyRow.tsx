import { useMemo, useState } from 'react'
import type { Build, Party } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { TooltipBody } from '@renderer/components/common/Tooltip'
import { computePartyBoonConditionSummary, type PartyBoonConditionEntry } from '@shared/squad-calc/party-summary'
import { BOON_CONDITION_ICONS } from '@shared/boon-calc/icons'
import { formatBoonDuration } from '@shared/boon-calc/format'
import type { BoonName, ConditionName } from '@shared/boon-calc/constants'
import { SlotTile } from './SlotTile'
import { BoonConditionIconRow, type BoonConditionIconItem } from './BoonConditionIconRow'
import type { BuildDragPayload } from './drag-payload'

interface Props {
  party: Party
  partyIndex: number
  builds: Build[]
  buildsById: Map<string, Build>
  onNameChange: (name: string) => void
  onAssignBuild: (slotIndex: number, buildId: string | null) => void
  onLabelChange: (slotIndex: number, label: string | null) => void
  onDropBuild: (slotIndex: number, payload: BuildDragPayload) => void
  onRemove: () => void
  canRemove: boolean
}

function toIconItems(entries: PartyBoonConditionEntry[]): BoonConditionIconItem[] {
  return entries.map((entry) => ({
    key: entry.name,
    icon: BOON_CONDITION_ICONS[entry.name as BoonName | ConditionName],
    tooltip: (
      <TooltipBody
        title={entry.name}
        description={entry.contributions
          .map((c) => `${c.buildName}: ${c.sourceName} — ${formatBoonDuration(c.scaledDurationSeconds)}s`)
          .join('\n')}
      />
    )
  }))
}

/**
 * One party ("Line") — 5 `SlotTile`s plus a party-wide boon/condition presence summary (always
 * visible, see `computePartyBoonConditionSummary`'s doc comment for why it's presence-only, not a
 * merged uptime %). The expand/collapse toggle only affects each slot's own per-build summary rows
 * (`SlotTile`'s `showSummary`) — it's ephemeral UI state, not persisted on the squad comp.
 */
export function PartyRow({
  party,
  partyIndex,
  builds,
  buildsById,
  onNameChange,
  onAssignBuild,
  onLabelChange,
  onDropBuild,
  onRemove,
  canRemove
}: Props) {
  const gameData = useGameData()
  const [expanded, setExpanded] = useState(false)

  const summary = useMemo(
    () => computePartyBoonConditionSummary(party, buildsById, gameData),
    [party, buildsById, gameData]
  )
  const boonItems = useMemo(() => toIconItems(summary.filter((e) => !e.isCondition)), [summary])
  const conditionItems = useMemo(() => toIconItems(summary.filter((e) => e.isCondition)), [summary])

  return (
    <div className="party-row">
      <div className="party-row-header">
        <button
          type="button"
          className="party-row-toggle"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Collapse boon/condition summary' : 'Expand boon/condition summary'}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <input
          className="party-row-name-input"
          value={party.name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        {canRemove && (
          <button type="button" onClick={onRemove}>
            Remove line
          </button>
        )}
      </div>
      <div className="party-row-body">
        <div className="party-slots">
          {party.slots.map((slot, slotIndex) => (
            <SlotTile
              key={slotIndex}
              slot={slot}
              build={slot.buildId !== null ? buildsById.get(slot.buildId) : undefined}
              builds={builds}
              showSummary={expanded}
              partyIndex={partyIndex}
              slotIndex={slotIndex}
              onAssign={(buildId) => onAssignBuild(slotIndex, buildId)}
              onLabelChange={(label) => onLabelChange(slotIndex, label)}
              onDropBuild={(payload) => onDropBuild(slotIndex, payload)}
            />
          ))}
        </div>
        <div className="party-summary-column">
          <div className="party-summary-group">
            <span className="party-summary-label muted">Boons</span>
            <BoonConditionIconRow items={boonItems} emptyLabel="—" />
          </div>
          <div className="party-summary-group">
            <span className="party-summary-label muted">Conditions</span>
            <BoonConditionIconRow items={conditionItems} emptyLabel="—" />
          </div>
        </div>
      </div>
    </div>
  )
}
