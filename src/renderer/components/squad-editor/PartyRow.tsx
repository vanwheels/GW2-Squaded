import { useMemo, useState } from 'react'
import type { Build, GhostPick, Party } from '@shared/types'
import { withUnderwaterSetting } from '@shared/types/build'
import { useGameData } from '@renderer/state/game-data-store'
import { useAppSettings } from '@renderer/state/app-settings-store'
import { TooltipBody } from '@renderer/components/common/Tooltip'
import {
  computePartyAuraSummary,
  computePartyBoonConditionSummary,
  computePartyComboSummary,
  computePartyNamedFactSummary,
  type PartyAuraEntry,
  type PartyBoonConditionEntry,
  type PartyComboEntry,
  type PartyNamedFactEntry
} from '@shared/squad-calc/party-summary'
import {
  BOON_STRIP_CORRUPT_MATCHERS,
  CONTROL_MATCHERS,
  MISCELLANEOUS_MATCHERS,
  NAMED_FACT_TARGET_COUNT_TABLES
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
          .map((c) => {
            const target = !entry.isCondition ? formatTargetCount(c.targetCount) : null
            return `${contributionLabel(party, c.buildName, c.slotIndex)}: ${c.sourceName} — ${formatBoonDuration(c.scaledDurationSeconds)}s${target ? ` (${target})` : ''}`
          })
          .join('\n')}
      />
    )
  }))
}

function toAuraIconItems(entries: PartyAuraEntry[], party: Party): BoonConditionIconItem[] {
  return entries.map((entry) => ({
    key: entry.name,
    icon: AURA_ICONS[entry.name as AuraName],
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

function toNamedFactIconItems(entries: PartyNamedFactEntry[], party: Party, icons: Record<string, string>): BoonConditionIconItem[] {
  return entries.map((entry) => ({
    key: entry.name,
    icon: icons[entry.name],
    tooltip: (
      <TooltipBody
        title={entry.name}
        description={entry.contributions
          .map((c) => {
            const target = formatTargetCount(c.targetCount)
            return `${contributionLabel(party, c.buildName, c.slotIndex)}: ${c.sourceName}${c.detail ? ` — ${c.detail}` : ''}${target ? ` (${target})` : ''}`
          })
          .join('\n')}
      />
    )
  }))
}

function toComboIconItems(entries: PartyComboEntry[], party: Party): BoonConditionIconItem[] {
  return entries.map((entry) => ({
    key: entry.kind,
    icon: COMBO_ICONS[entry.kind],
    tooltip: (
      <TooltipBody
        title={`Combo ${entry.kind === 'field' ? 'Field' : 'Finisher'}`}
        description={entry.contributions
          .map((c) => `${contributionLabel(party, c.buildName, c.slotIndex)}: ${c.sourceName} — ${c.fieldType ?? c.finisherType}`)
          .join('\n')}
      />
    )
  }))
}

/**
 * One party ("Line") — 5 `SlotTile`s plus a party-wide Boons/Conditions/Control/Auras/
 * Miscellaneous/Strips-Corrupts-Cleanses/Combo presence summary (always visible, see
 * `computePartyBoonConditionSummary`'s doc comment for why it's presence-only, not a merged
 * uptime %). The expand/collapse toggle only affects each slot's own per-build summary rows
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
  const { showUnderwater } = useAppSettings()
  const [expanded, setExpanded] = useState(false)

  /** Display/calc-only view of `buildsById` — see `withUnderwaterSetting`'s doc comment. Feeds
   *  every `computePartyXSummary` call below AND each `SlotTile`'s own `build` prop, so the whole
   *  party summary (and every per-slot tooltip) treats underwater weapon skills as unequipped
   *  whenever the Settings toggle is off, matching the single-build editor's `displayBuild`. */
  const effectiveBuildsById = useMemo(
    () => (showUnderwater ? buildsById : new Map([...buildsById].map(([id, b]) => [id, withUnderwaterSetting(b, false)]))),
    [buildsById, showUnderwater]
  )

  const summary = useMemo(
    () => computePartyBoonConditionSummary(party, effectiveBuildsById, gameData),
    [party, effectiveBuildsById, gameData]
  )
  const boonItems = useMemo(() => toIconItems(summary.filter((e) => !e.isCondition), party), [summary, party])
  const conditionItems = useMemo(() => toIconItems(summary.filter((e) => e.isCondition), party), [summary, party])

  const auraSummary = useMemo(() => computePartyAuraSummary(party, effectiveBuildsById, gameData), [party, effectiveBuildsById, gameData])
  const auraItems = useMemo(() => toAuraIconItems(auraSummary, party), [auraSummary, party])

  const controlSummary = useMemo(
    () => computePartyNamedFactSummary(party, effectiveBuildsById, gameData, CONTROL_MATCHERS),
    [party, effectiveBuildsById, gameData]
  )
  const controlItems = useMemo(() => toNamedFactIconItems(controlSummary, party, CONTROL_ICONS), [controlSummary, party])

  const miscSummary = useMemo(
    () => computePartyNamedFactSummary(party, effectiveBuildsById, gameData, MISCELLANEOUS_MATCHERS),
    [party, effectiveBuildsById, gameData]
  )
  const miscItems = useMemo(() => toNamedFactIconItems(miscSummary, party, MISCELLANEOUS_ICONS), [miscSummary, party])

  const stripCorruptSummary = useMemo(
    () => computePartyNamedFactSummary(party, effectiveBuildsById, gameData, BOON_STRIP_CORRUPT_MATCHERS, NAMED_FACT_TARGET_COUNT_TABLES),
    [party, effectiveBuildsById, gameData]
  )
  const stripCorruptItems = useMemo(
    () => toNamedFactIconItems(stripCorruptSummary, party, BOON_STRIP_CORRUPT_ICONS),
    [stripCorruptSummary, party]
  )

  const comboSummary = useMemo(() => computePartyComboSummary(party, effectiveBuildsById, gameData), [party, effectiveBuildsById, gameData])
  const comboItems = useMemo(() => toComboIconItems(comboSummary, party), [comboSummary, party])

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
              build={slot.buildId !== null ? effectiveBuildsById.get(slot.buildId) : undefined}
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
          <div className="party-summary-row">
            <div className="party-summary-group">
              <span className="party-summary-label muted">Boons</span>
              <BoonConditionIconRow items={boonItems} emptyLabel="—" />
            </div>
            <div className="party-summary-group">
              <span className="party-summary-label muted">Control</span>
              <BoonConditionIconRow items={controlItems} emptyLabel="—" />
            </div>
            <div className="party-summary-group">
              <span className="party-summary-label muted">Strips / Corrupts / Cleanses</span>
              <BoonConditionIconRow items={stripCorruptItems} emptyLabel="—" />
            </div>
            <div className="party-summary-group">
              <span className="party-summary-label muted">Miscellaneous</span>
              <BoonConditionIconRow items={miscItems} emptyLabel="—" />
            </div>
          </div>
          <div className="party-summary-row">
            <div className="party-summary-group">
              <span className="party-summary-label muted">Conditions</span>
              <BoonConditionIconRow items={conditionItems} emptyLabel="—" />
            </div>
            <div className="party-summary-group">
              <span className="party-summary-label muted">Auras</span>
              <BoonConditionIconRow items={auraItems} emptyLabel="—" />
            </div>
            <div className="party-summary-group">
              <span className="party-summary-label muted">Combo</span>
              <BoonConditionIconRow items={comboItems} emptyLabel="—" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
