import { useState } from 'react'
import type { Build, SquadSlot } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { TooltipBody } from '@renderer/components/common/Tooltip'
import { UpgradePicker, type UpgradeOption } from '@renderer/components/build-editor/UpgradePicker'
import { computeBoonConditionSources, groupBoonConditionSources } from '@shared/boon-calc/sources'
import { BOON_CONDITION_ICONS } from '@shared/boon-calc/icons'
import { formatBoonDuration } from '@shared/boon-calc/format'
import type { BoonName, ConditionName } from '@shared/boon-calc/constants'
import { BoonConditionIconRow, type BoonConditionIconItem } from './BoonConditionIconRow'
import { readBuildDragData, setBuildDragData, type BuildDragPayload } from './drag-payload'

interface Props {
  slot: SquadSlot
  build: Build | undefined
  builds: Build[]
  showSummary: boolean
  partyIndex: number
  slotIndex: number
  onAssign: (buildId: string | null) => void
  onLabelChange: (label: string | null) => void
  onDropBuild: (payload: BuildDragPayload) => void
}

/**
 * One roster slot: the profession-icon assignment control (reuses the generic `UpgradePicker`,
 * widened to accept string build ids, exactly like the rune/sigil/relic pickers) plus, when empty,
 * an editable free-text role label (`SquadSlot.placeholderLabel`) and, when a build is assigned and
 * the party row's toggle is expanded, that build's boon/condition icon summary.
 */
export function SlotTile({
  slot,
  build,
  builds,
  showSummary,
  partyIndex,
  slotIndex,
  onAssign,
  onLabelChange,
  onDropBuild
}: Props) {
  const gameData = useGameData()
  const [dragOver, setDragOver] = useState(false)

  const options: UpgradeOption<string>[] = builds.map((b) => {
    const profession = gameData.professions.find((p) => p.id === b.profession)
    return { id: b.id, name: b.name, icon: profession?.icon ?? '', description: profession?.name ?? b.profession }
  })

  const groups = build ? groupBoonConditionSources(computeBoonConditionSources(build, gameData)) : []

  function iconItems(isCondition: boolean): BoonConditionIconItem[] {
    return groups
      .filter((g) => g.isCondition === isCondition)
      .map((g) => ({
        key: g.name,
        icon: BOON_CONDITION_ICONS[g.name as BoonName | ConditionName],
        tooltip: (
          <TooltipBody
            title={g.name}
            description={g.sources
              .map((s) => `${s.sourceName}: ${formatBoonDuration(s.scaledDurationSeconds)}s`)
              .join('\n')}
          />
        )
      }))
  }

  return (
    <div
      className={dragOver ? 'slot-tile drag-over' : 'slot-tile'}
      draggable={build !== undefined}
      onDragStart={(e) => {
        if (build) setBuildDragData(e, { buildId: build.id, sourcePartyIndex: partyIndex, sourceSlotIndex: slotIndex })
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const payload = readBuildDragData(e)
        if (payload) onDropBuild(payload)
      }}
    >
      <UpgradePicker
        label={slot.placeholderLabel && slot.placeholderLabel.length > 0 ? slot.placeholderLabel : 'Build'}
        options={options}
        chosenId={slot.buildId}
        onChoose={onAssign}
        variant="slot"
      />
      {build ? (
        <div className="slot-tile-name">{build.name}</div>
      ) : (
        <input
          className="slot-tile-label-input"
          placeholder="Role (optional)"
          value={slot.placeholderLabel ?? ''}
          onChange={(e) => onLabelChange(e.target.value.length > 0 ? e.target.value : null)}
        />
      )}
      {showSummary && build && (
        <div className="slot-tile-summary">
          <BoonConditionIconRow items={iconItems(false)} />
          <BoonConditionIconRow items={iconItems(true)} />
        </div>
      )}
    </div>
  )
}
