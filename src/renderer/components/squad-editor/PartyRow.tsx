import { useMemo, useState } from 'react'
import type { Build, GhostPick, Party } from '@shared/types'
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
  onAssignBuild: (slotIndex: number, buildId: string | null) => void
  onAssignGhost: (slotIndex: number, ghostPick: GhostPick | null) => void
  onLabelChange: (slotIndex: number, label: string | null) => void
  onDropBuild: (slotIndex: number, payload: BuildDragPayload) => void
  onRemove: () => void
  canRemove: boolean
}

/** Disambiguates contributions from identical/duplicate builds in different slots — without this,
 *  two "DPS Vindi Test" builds in one party render as two byte-for-byte identical lines with no
 *  way to tell which slot each came from. Prefers the slot's own placeholder/role label (e.g.
 *  "Heal") when the user set one, since that's more meaningful than a bare slot number. */
function contributionLabel(party: Party, buildName: string, slotIndex: number): string {
  const roleLabel = party.slots[slotIndex]?.placeholderLabel
  return roleLabel ? `${buildName} (${roleLabel})` : `${buildName} (Slot ${slotIndex + 1})`
}

function toIconItems(entries: PartyBoonConditionEntry[], party: Party): BoonConditionIconItem[] {
  return entries.map((entry) => ({
    key: entry.name,
    icon: BOON_CONDITION_ICONS[entry.name as BoonName | ConditionName],
    tooltip: (
      <TooltipBody
        title={entry.name}
        description={entry.contributions
          .map((c) => `${contributionLabel(party, c.buildName, c.slotIndex)}: ${c.sourceName} — ${formatBoonDuration(c.scaledDurationSeconds)}s`)
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
  onAssignBuild,
  onAssignGhost,
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
  const boonItems = useMemo(() => toIconItems(summary.filter((e) => !e.isCondition), party), [summary, party])
  const conditionItems = useMemo(() => toIconItems(summary.filter((e) => e.isCondition), party), [summary, party])

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
        <span className="party-row-label">Line {partyIndex + 1}</span>
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
              onAssignGhost={(ghostPick) => onAssignGhost(slotIndex, ghostPick)}
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
