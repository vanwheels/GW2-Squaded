import { useMemo } from 'react'
import type { Build } from '@shared/types'
import {
  BOON_STRIP_CORRUPT_MATCHERS,
  CONTROL_MATCHERS,
  MISCELLANEOUS_MATCHERS,
  computeAuraSources,
  computeBoonConditionSources,
  computeComboSources,
  computeHealingSources,
  computeNamedFactSources,
  groupBoonConditionSources,
  groupNamedFactSources,
  type BoonConditionGroup,
  type ComboSource,
  type HealingSource,
  type NamedFactGroup
} from '@shared/boon-calc/sources'
import { formatBoonDuration } from '@shared/boon-calc/format'
import { BOON_NAMES, CONDITION_NAMES, AURA_NAMES } from '@shared/boon-calc/constants'
import { BOON_CONDITION_ICONS, AURA_ICONS, CONTROL_ICONS, MISCELLANEOUS_ICONS, BOON_STRIP_CORRUPT_ICONS, COMBO_ICONS, HEALING_ICON } from '@shared/boon-calc/icons'
import { computeCharacterStats } from '@shared/gear-calc/derived-stats'
import { DEFAULT_COMBAT_STATE, type CombatState } from '@shared/gear-calc/combat-state'
import { useGameData } from '@renderer/state/game-data-store'
import { TooltipBody } from '@renderer/components/common/Tooltip'
import { BoonConditionIconRow, type BoonConditionIconItem } from '@renderer/components/squad-editor/BoonConditionIconRow'

interface Props {
  build: Build
  combatState?: CombatState
}

/** Every name in `names` always renders (greyed out via `boon-icon-row-icon-inactive` when this
 *  build doesn't produce it), same "fixed grid, never reflows" treatment `SkillsEditor`'s old
 *  in-bar rows used. */
function iconItemsFor(groups: BoonConditionGroup[], names: readonly string[], icons: Record<string, string>): BoonConditionIconItem[] {
  const groupByName = new Map(groups.map((g) => [g.name, g]))
  return names.map((name) => {
    const group = groupByName.get(name)
    return {
      key: name,
      icon: icons[name],
      className: group ? undefined : 'boon-icon-row-icon-inactive',
      tooltip: group ? (
        <>
          <TooltipBody title={group.name} />
          <ul className="tooltip-boon-facts">
            {group.sources.map((s, i) => (
              <li key={`${s.sourceKind}-${s.sourceId}-${i}`}>
                <span>{s.sourceName}</span>
                <span className="boon-source-duration">
                  {formatBoonDuration(s.scaledDurationSeconds)}s
                  {s.applyCount > 1 ? ` × ${s.applyCount}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <TooltipBody title={name} />
      )
    }
  })
}

/** Same "always show every name, grey out unproduced ones" treatment as `iconItemsFor`, for
 *  `computeNamedFactSources`' output (Control/Miscellaneous/Strip&Corrupt) instead of
 *  `computeBoonConditionSources`'/`computeAuraSources`' — a different source shape (`detail` is a
 *  free-form magnitude string, not a scaled duration), so the tooltip line is built differently. */
function namedFactIconItemsFor(groups: NamedFactGroup[], names: readonly string[], icons: Record<string, string>): BoonConditionIconItem[] {
  const groupByName = new Map(groups.map((g) => [g.name, g]))
  return names.map((name) => {
    const group = groupByName.get(name)
    return {
      key: name,
      icon: icons[name],
      className: group ? undefined : 'boon-icon-row-icon-inactive',
      tooltip: group ? (
        <>
          <TooltipBody title={name} />
          <ul className="tooltip-boon-facts">
            {group.sources.map((s, i) => (
              <li key={`${s.sourceKind}-${s.sourceId}-${i}`}>
                <span>{s.sourceName}</span>
                {s.detail && <span className="boon-source-duration">{s.detail}</span>}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <TooltipBody title={name} />
      )
    }
  })
}

/** The API gives one generic icon per Combo Field/Finisher fact (not per `field_type`/
 *  `finisher_type`, see `ComboSource`'s doc comment) — so unlike every other category here, this is
 *  always exactly 2 icons (Field, Finisher), with the specific types this build produces listed in
 *  the tooltip instead of shown as distinct icons. */
function comboIconItems(sources: ComboSource[]): BoonConditionIconItem[] {
  const fields = sources.filter((s) => s.kind === 'field')
  const finishers = sources.filter((s) => s.kind === 'finisher')

  function item(kind: 'field' | 'finisher', label: string, entries: ComboSource[]): BoonConditionIconItem {
    return {
      key: kind,
      icon: COMBO_ICONS[kind],
      className: entries.length > 0 ? undefined : 'boon-icon-row-icon-inactive',
      tooltip:
        entries.length > 0 ? (
          <>
            <TooltipBody title={`Combo ${label}`} />
            <ul className="tooltip-boon-facts">
              {entries.map((s, i) => (
                <li key={`${s.sourceKind}-${s.sourceId}-${i}`}>
                  <span>{s.sourceName}</span>
                  <span className="boon-source-duration">{s.fieldType ?? s.finisherType}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <TooltipBody title={`Combo ${label}`} />
        )
    }
  }

  return [item('field', 'Field', fields), item('finisher', 'Finisher', finishers)]
}

/** Single icon (no per-name grid — `computeHealingSources` produces one entry per skill+fact-label,
 *  not one per fixed name like boons/conditions) listing every heal-producing skill's real,
 *  current-Healing-Power-scaled magnitude. Empty/greyed-out whenever none of the build's equipped
 *  skills has a curated coefficient yet (see `CURATED_HEALING_COEFFICIENTS`'s doc comment) rather
 *  than when the build truly has no healing — this row under-reports until that table grows. */
function healingIconItem(sources: HealingSource[]): BoonConditionIconItem {
  return {
    key: 'healing',
    icon: HEALING_ICON,
    className: sources.length > 0 ? undefined : 'boon-icon-row-icon-inactive',
    tooltip:
      sources.length > 0 ? (
        <>
          <TooltipBody title="Healing" />
          <ul className="tooltip-boon-facts">
            {sources.map((s, i) => (
              <li key={`${s.sourceId}-${i}`}>
                <span>
                  {s.sourceName} — {s.label}
                </span>
                <span className="boon-source-duration">{s.value.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <TooltipBody title="Healing" />
      )
  }
}

/**
 * gw2skills.net-style "Conditions / Boons / Control / Auras / Combo" summary, relocated here
 * (beneath `StatsPanel`, in the build editor's right column) from the icon rows that used to sit
 * inline in the Skills bar itself (see COMPLETED.md), plus 2 rows gw2skills doesn't have at all
 * (Strip/Corrupt — see `BOON_STRIP_CORRUPT_MATCHERS`) and 1 gw2skills folds into Miscellaneous but
 * this app breaks out on its own (Healing — see `computeHealingSources`, since it's a computed
 * magnitude per skill rather than a boolean icon like everything in Miscellaneous).
 */
export function BoonConditionSummaryPanel({ build, combatState = DEFAULT_COMBAT_STATE }: Props) {
  const gameData = useGameData()

  const boonConditionGroups = useMemo(() => groupBoonConditionSources(computeBoonConditionSources(build, gameData)), [build, gameData])
  const auraGroups = useMemo(() => groupBoonConditionSources(computeAuraSources(build, gameData)), [build, gameData])
  const controlGroups = useMemo(
    () => groupNamedFactSources(computeNamedFactSources(build, gameData, CONTROL_MATCHERS)),
    [build, gameData]
  )
  const miscGroups = useMemo(
    () => groupNamedFactSources(computeNamedFactSources(build, gameData, MISCELLANEOUS_MATCHERS)),
    [build, gameData]
  )
  const stripCorruptGroups = useMemo(
    () => groupNamedFactSources(computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS)),
    [build, gameData]
  )
  const comboSources = useMemo(() => computeComboSources(build, gameData), [build, gameData])
  const healingPower = useMemo(() => computeCharacterStats(build, gameData, combatState).attributes.healingPower, [build, gameData, combatState])
  const healingSources = useMemo(() => computeHealingSources(build, gameData, healingPower), [build, gameData, healingPower])

  const rows: { label: string; items: BoonConditionIconItem[] }[] = [
    { label: 'Conditions', items: iconItemsFor(boonConditionGroups, CONDITION_NAMES, BOON_CONDITION_ICONS) },
    { label: 'Boons', items: iconItemsFor(boonConditionGroups, BOON_NAMES, BOON_CONDITION_ICONS) },
    { label: 'Control', items: namedFactIconItemsFor(controlGroups, Object.keys(CONTROL_MATCHERS), CONTROL_ICONS) },
    { label: 'Auras', items: iconItemsFor(auraGroups, AURA_NAMES, AURA_ICONS) },
    { label: 'Healing', items: [healingIconItem(healingSources)] },
    { label: 'Miscellaneous', items: namedFactIconItemsFor(miscGroups, Object.keys(MISCELLANEOUS_MATCHERS), MISCELLANEOUS_ICONS) },
    { label: 'Strip / Corrupt', items: namedFactIconItemsFor(stripCorruptGroups, Object.keys(BOON_STRIP_CORRUPT_MATCHERS), BOON_STRIP_CORRUPT_ICONS) },
    { label: 'Combo', items: comboIconItems(comboSources) }
  ]

  return (
    <div className="boon-summary-panel">
      {rows.map((row) => (
        <div className="boon-summary-row" key={row.label}>
          <span className="boon-summary-row-label">{row.label}</span>
          <BoonConditionIconRow items={row.items} />
        </div>
      ))}
    </div>
  )
}
