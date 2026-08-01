import { useMemo } from 'react'
import type { Build } from '@shared/types'
import {
  computeBoonConditionSources,
  computeComboSources,
  computeControlAuraSources,
  groupBoonConditionSources,
  type BoonConditionGroup,
  type ComboSource
} from '@shared/boon-calc/sources'
import { formatBoonDuration } from '@shared/boon-calc/format'
import { BOON_NAMES, CONDITION_NAMES, CONTROL_NAMES, AURA_NAMES } from '@shared/boon-calc/constants'
import { BOON_CONDITION_ICONS, CONTROL_AURA_ICONS, COMBO_ICONS } from '@shared/boon-calc/icons'
import { useGameData } from '@renderer/state/game-data-store'
import { TooltipBody } from '@renderer/components/common/Tooltip'
import { BoonConditionIconRow, type BoonConditionIconItem } from '@renderer/components/squad-editor/BoonConditionIconRow'

interface Props {
  build: Build
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

/**
 * gw2skills.net-style "Conditions / Boons / Control / Auras / Combo" summary, relocated here
 * (beneath `StatsPanel`, in the build editor's right column) from the icon rows that used to sit
 * inline in the Skills bar itself (see COMPLETED.md) — same underlying data, just given its own
 * section with room for the 2 new categories. Miscellaneous (Healing/Execute in gw2skills' own bar)
 * is deliberately left out: unlike Control/Auras/Combo, it has no equivalent structural fact shape
 * anywhere in this app's data to build a real fixed icon list from — see TODO.md.
 */
export function BoonConditionSummaryPanel({ build }: Props) {
  const gameData = useGameData()

  const boonConditionGroups = useMemo(() => groupBoonConditionSources(computeBoonConditionSources(build, gameData)), [build, gameData])
  const controlAuraGroups = useMemo(() => groupBoonConditionSources(computeControlAuraSources(build, gameData)), [build, gameData])
  const comboSources = useMemo(() => computeComboSources(build, gameData), [build, gameData])

  const rows: { label: string; items: BoonConditionIconItem[] }[] = [
    { label: 'Conditions', items: iconItemsFor(boonConditionGroups, CONDITION_NAMES, BOON_CONDITION_ICONS) },
    { label: 'Boons', items: iconItemsFor(boonConditionGroups, BOON_NAMES, BOON_CONDITION_ICONS) },
    { label: 'Control', items: iconItemsFor(controlAuraGroups, CONTROL_NAMES, CONTROL_AURA_ICONS) },
    { label: 'Auras', items: iconItemsFor(controlAuraGroups, AURA_NAMES, CONTROL_AURA_ICONS) },
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
