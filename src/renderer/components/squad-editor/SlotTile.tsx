import { useState } from 'react'
import type { Build, GhostPick, SquadSlot } from '@shared/types'
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
  onAssignGhost: (ghostPick: GhostPick | null) => void
  onLabelChange: (label: string | null) => void
  onDropBuild: (payload: BuildDragPayload) => void
}

const GHOST_PREFIX = 'ghost:'
const GHOST_PLACEHOLDER_DESCRIPTION = 'Placeholder — no build saved yet'

function encodeGhostId(pick: GhostPick): string {
  return `${GHOST_PREFIX}${pick.profession}:${pick.specializationId ?? ''}`
}

function decodeGhostId(id: string): GhostPick {
  const rest = id.slice(GHOST_PREFIX.length)
  const separatorIndex = rest.lastIndexOf(':')
  const profession = rest.slice(0, separatorIndex)
  const specStr = rest.slice(separatorIndex + 1)
  return { profession, specializationId: specStr.length > 0 ? Number(specStr) : null }
}

/**
 * One roster slot: the profession-icon assignment control (reuses the generic `UpgradePicker`,
 * widened to accept string build ids, exactly like the rune/sigil/relic pickers) plus, when empty,
 * an editable free-text role label (`SquadSlot.placeholderLabel`) and, when a build is assigned and
 * the party row's toggle is expanded, that build's boon/condition icon summary.
 *
 * The same picker also offers `GhostPick` options (one per profession, plus one per elite spec) —
 * a "just the icon" stand-in for when no real Build is ready yet. These are encoded into the same
 * string-id option list as the real builds (`ghost:<profession>:<specializationId>`), decoded back
 * in `handleChoose` — deliberately not a separate second picker, to avoid building a whole parallel
 * UI for what's otherwise the exact same "pick one icon" interaction.
 */
export function SlotTile({
  slot,
  build,
  builds,
  showSummary,
  partyIndex,
  slotIndex,
  onAssign,
  onAssignGhost,
  onLabelChange,
  onDropBuild
}: Props) {
  const gameData = useGameData()
  const [dragOver, setDragOver] = useState(false)

  function eliteSpecIconFor(build: Build): string | undefined {
    // Show the equipped elite spec's own icon (matches the in-game/gw2skills convention of
    // identifying a character by its elite spec, not its base profession) when one's chosen.
    const eliteSpecId = build.specializations[2]?.specializationId
    const eliteSpec = eliteSpecId != null ? gameData.specializationsById.get(eliteSpecId) : undefined
    return eliteSpec?.elite ? eliteSpec.icon : undefined
  }

  const buildOptions: UpgradeOption<string>[] = builds.map((b) => {
    const profession = gameData.professions.find((p) => p.id === b.profession)
    return { id: b.id, name: b.name, icon: eliteSpecIconFor(b) ?? profession?.icon ?? '', description: profession?.name ?? b.profession }
  })

  const ghostOptions: UpgradeOption<string>[] = gameData.professions.flatMap((p) => {
    const coreOption: UpgradeOption<string> = {
      id: encodeGhostId({ profession: p.id, specializationId: null }),
      name: `${p.name} (Core)`,
      icon: p.icon,
      description: GHOST_PLACEHOLDER_DESCRIPTION
    }
    const eliteOptions: UpgradeOption<string>[] = gameData
      .specializationsForProfession(p.id)
      .filter((s) => s.elite)
      .map((s) => ({
        id: encodeGhostId({ profession: p.id, specializationId: s.id }),
        name: s.name,
        icon: s.icon,
        description: GHOST_PLACEHOLDER_DESCRIPTION
      }))
    return [coreOption, ...eliteOptions]
  })

  const options = [...buildOptions, ...ghostOptions]

  const chosenId = slot.buildId ?? (slot.ghostPick ? encodeGhostId(slot.ghostPick) : null)

  function handleChoose(id: string | null): void {
    if (id !== null && id.startsWith(GHOST_PREFIX)) {
      onAssignGhost(decodeGhostId(id))
    } else {
      onAssign(id)
    }
  }

  const ghostProfession = slot.ghostPick ? gameData.professions.find((p) => p.id === slot.ghostPick?.profession) : undefined
  const ghostSpec =
    slot.ghostPick?.specializationId != null ? gameData.specializationsById.get(slot.ghostPick.specializationId) : undefined
  const ghostName = ghostSpec ? ghostSpec.name : ghostProfession ? `${ghostProfession.name} (Core)` : undefined

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
        chosenId={chosenId}
        onChoose={handleChoose}
        variant="slot"
      />
      {build ? (
        <div className="slot-tile-name">{build.name}</div>
      ) : ghostName ? (
        <div className="slot-tile-name slot-tile-ghost-name">{ghostName}</div>
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
