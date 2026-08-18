import { useState } from 'react'
import type { Build, GhostPick, SquadSlot } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { useBuildsStore } from '@renderer/state/builds-store'
import { TooltipBody } from '@renderer/components/common/Tooltip'
import { UpgradePicker, type UpgradeOption } from '@renderer/components/build-editor/UpgradePicker'
import {
  BOON_STRIP_CORRUPT_MATCHERS,
  CONTROL_MATCHERS,
  MISCELLANEOUS_MATCHERS,
  NAMED_FACT_TARGET_COUNT_TABLES,
  computeAuraSources,
  computeBoonConditionSources,
  computeComboSources,
  computeNamedFactSources,
  groupBoonConditionSources,
  groupNamedFactSources,
  type ComboSource
} from '@shared/boon-calc/sources'
import {
  AURA_ICONS,
  BOON_CONDITION_ICONS,
  BOON_STRIP_CORRUPT_ICONS,
  COMBO_ICONS,
  CONTROL_ICONS,
  MISCELLANEOUS_ICONS
} from '@shared/boon-calc/icons'
import { formatBoonDuration, formatTargetCount } from '@shared/boon-calc/format'
import type { AuraName, BoonName, ConditionName } from '@shared/boon-calc/constants'
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
 * the party row's toggle is expanded, that build's Boons/Conditions/Control/Auras/Miscellaneous/
 * Strips-Corrupts-Cleanses/Combo icon summary (same categories as the build editor's `BoonConditionSummaryPanel`,
 * but only showing icons this build actually produces — no "always render every name, grey out
 * unproduced ones" treatment, since a slot tile is too narrow for that).
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
  const { updateBuild } = useBuildsStore()
  const [dragOver, setDragOver] = useState(false)

  function eliteSpecIconFor(build: Build): string | undefined {
    // Show the equipped elite spec's own icon (matches the in-game/gw2skills convention of
    // identifying a character by its elite spec, not its base profession) when one's chosen.
    const eliteSpecId = build.specializations[2]?.specializationId
    const eliteSpec = eliteSpecId != null ? gameData.specializationsById.get(eliteSpecId) : undefined
    return eliteSpec?.elite ? eliteSpec.tangoIcon : undefined
  }

  const buildOptions: UpgradeOption<string>[] = builds.map((b) => {
    const profession = gameData.professions.find((p) => p.id === b.profession)
    return { id: b.id, name: b.name, icon: eliteSpecIconFor(b) ?? profession?.tangoIcon ?? '', description: profession?.name ?? b.profession }
  })

  const ghostOptions: UpgradeOption<string>[] = gameData.professions.flatMap((p) => {
    const coreOption: UpgradeOption<string> = {
      id: encodeGhostId({ profession: p.id, specializationId: null }),
      name: `${p.name} (Core)`,
      icon: p.tangoIcon,
      description: GHOST_PLACEHOLDER_DESCRIPTION
    }
    const eliteOptions: UpgradeOption<string>[] = gameData
      .specializationsForProfession(p.id)
      .filter((s) => s.elite)
      .map((s) => ({
        id: encodeGhostId({ profession: p.id, specializationId: s.id }),
        name: s.name,
        icon: s.tangoIcon ?? p.tangoIcon,
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

  /** Favorite status for this picker reuses `Build.favorite` directly (the same field the
   *  Builds/Squads card grids toggle) rather than a separate per-install store like the
   *  Food/Utility pickers' `useFavoriteConsumables` — a build's favorite status is build data,
   *  already persisted and already visible elsewhere, so there's nothing install-specific to add.
   *  Ghost options (ids starting with `GHOST_PREFIX`) aren't real builds and can't be favorited. */
  function isBuildFavorite(id: string): boolean {
    return !id.startsWith(GHOST_PREFIX) && (builds.find((b) => b.id === id)?.favorite ?? false)
  }

  function toggleBuildFavorite(id: string): void {
    if (id.startsWith(GHOST_PREFIX)) return
    const b = builds.find((b) => b.id === id)
    if (b) void updateBuild({ ...b, favorite: !b.favorite })
  }

  const ghostProfession = slot.ghostPick ? gameData.professions.find((p) => p.id === slot.ghostPick?.profession) : undefined
  const ghostSpec =
    slot.ghostPick?.specializationId != null ? gameData.specializationsById.get(slot.ghostPick.specializationId) : undefined
  const ghostName = ghostSpec ? ghostSpec.name : ghostProfession ? `${ghostProfession.name} (Core)` : undefined

  const groups = build ? groupBoonConditionSources(computeBoonConditionSources(build, gameData)) : []
  const auraGroups = build ? groupBoonConditionSources(computeAuraSources(build, gameData)) : []
  const controlGroups = build ? groupNamedFactSources(computeNamedFactSources(build, gameData, CONTROL_MATCHERS)) : []
  const miscGroups = build ? groupNamedFactSources(computeNamedFactSources(build, gameData, MISCELLANEOUS_MATCHERS)) : []
  const stripCorruptGroups = build
    ? groupNamedFactSources(computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS, NAMED_FACT_TARGET_COUNT_TABLES))
    : []
  const comboSources = build ? computeComboSources(build, gameData) : []

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
              .map((s) => {
                const target = s.category === 'boon' ? formatTargetCount(s.targetCount) : null
                const trigger = s.triggerNote ? ` [${s.triggerNote}]` : ''
                return `${s.sourceName}: ${formatBoonDuration(s.scaledDurationSeconds)}s${target ? ` (${target})` : ''}${trigger}`
              })
              .join('\n')}
          />
        )
      }))
  }

  const auraItems: BoonConditionIconItem[] = auraGroups.map((g) => ({
    key: g.name,
    icon: AURA_ICONS[g.name as AuraName],
    tooltip: (
      <TooltipBody
        title={g.name}
        description={g.sources.map((s) => `${s.sourceName}: ${formatBoonDuration(s.scaledDurationSeconds)}s`).join('\n')}
      />
    )
  }))

  function namedFactItems(namedGroups: typeof controlGroups, icons: Record<string, string>): BoonConditionIconItem[] {
    return namedGroups.map((g) => ({
      key: g.name,
      icon: icons[g.name],
      tooltip: (
        <TooltipBody
          title={g.name}
          description={g.sources
            .map((s) => {
              const target = formatTargetCount(s.targetCount)
              return `${s.sourceName}${s.detail ? `: ${s.detail}` : ''}${target ? ` (${target})` : ''}`
            })
            .join('\n')}
        />
      )
    }))
  }

  function comboItems(sources: ComboSource[]): BoonConditionIconItem[] {
    const fields = sources.filter((s) => s.kind === 'field')
    const finishers = sources.filter((s) => s.kind === 'finisher')
    function item(kind: 'field' | 'finisher', label: string, entries: ComboSource[]): BoonConditionIconItem | null {
      if (entries.length === 0) return null
      return {
        key: kind,
        icon: COMBO_ICONS[kind],
        tooltip: (
          <TooltipBody
            title={`Combo ${label}`}
            description={entries.map((s) => `${s.sourceName}: ${s.fieldType ?? s.finisherType}`).join('\n')}
          />
        )
      }
    }
    return [item('field', 'Field', fields), item('finisher', 'Finisher', finishers)].filter(
      (i): i is BoonConditionIconItem => i !== null
    )
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
        isFavorite={isBuildFavorite}
        onToggleFavorite={toggleBuildFavorite}
      />
      {build ? (
        <div className="slot-tile-name">{build.name}</div>
      ) : ghostName ? (
        <div className="slot-tile-name slot-tile-ghost-name">{ghostName}</div>
      ) : (
        <input
          type="text"
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
          <BoonConditionIconRow items={namedFactItems(controlGroups, CONTROL_ICONS)} />
          <BoonConditionIconRow items={auraItems} />
          <BoonConditionIconRow items={namedFactItems(miscGroups, MISCELLANEOUS_ICONS)} />
          <BoonConditionIconRow items={namedFactItems(stripCorruptGroups, BOON_STRIP_CORRUPT_ICONS)} />
          <BoonConditionIconRow items={comboItems(comboSources)} />
        </div>
      )}
    </div>
  )
}
