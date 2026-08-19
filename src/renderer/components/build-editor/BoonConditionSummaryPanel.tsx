import { useMemo } from 'react'
import type { Build } from '@shared/types'
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
  type BoonConditionGroup,
  type ComboSource,
  type NamedFactGroup
} from '@shared/boon-calc/sources'
import { formatBoonDuration, formatTargetCount } from '@shared/boon-calc/format'
import { BOON_NAMES, CONDITION_NAMES, AURA_NAMES } from '@shared/boon-calc/constants'
import {
  BOON_CONDITION_ICONS,
  AURA_ICONS,
  CONTROL_ICONS,
  MISCELLANEOUS_ICONS,
  BOON_STRIP_CORRUPT_ICONS,
  COMBO_ICONS
} from '@shared/boon-calc/icons'
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
                <span className="tooltip-fact-label">
                  <img className="tooltip-fact-icon" src={s.sourceIcon} alt="" />
                  <span>{s.sourceName}</span>
                  {s.category === 'boon' && s.targetCount !== null && (
                    <span className="boon-source-target">{formatTargetCount(s.targetCount)}</span>
                  )}
                  {s.triggerNote && <span className="boon-source-trigger-note">{s.triggerNote}</span>}
                </span>
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
 *  `computeNamedFactSources`' output (Control/Miscellaneous/Strip/Corrupt/Cleanse) instead of
 *  `computeBoonConditionSources`'/`computeAuraSources`' — a different source shape (`detail` is a
 *  free-form magnitude string, not a scaled duration), so the tooltip line is built differently.
 *  `targetCount` (only ever populated for `Cleanse`, see `NamedFactSource.targetCount`'s doc
 *  comment) renders the same "Up to N" badge `iconItemsFor` shows for boons. */
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
                <span className="tooltip-fact-label">
                  <img className="tooltip-fact-icon" src={s.sourceIcon} alt="" />
                  <span>{s.sourceName}</span>
                  {s.targetCount !== null && <span className="boon-source-target">{formatTargetCount(s.targetCount)}</span>}
                </span>
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
                  <span className="tooltip-fact-label">
                    <img className="tooltip-fact-icon" src={s.sourceIcon} alt="" />
                    <span>{s.sourceName}</span>
                  </span>
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
 * (beside `StatsPanel`, in the build editor's right column — see `BuildEditorView`'s
 * `.stats-boons-row`) from the icon rows that used to sit inline in the Skills bar itself (see
 * COMPLETED.md), plus 1 row gw2skills doesn't have at all
 * ("Strips / Corrupts / Cleanses" — see `BOON_STRIP_CORRUPT_MATCHERS`; Cleanse folded into this
 * row rather than a separate one, per TODO.md's Condition Cleanse item). Healing/Damage briefly
 * lived here as their own aggregated rows (Sessions 54-55) but moved into each skill's own tooltip
 * instead (see `SkillsEditor.tsx`'s `skillTooltipContent`/`skillFactLines`) — a per-skill number
 * read in place, next to the skill it belongs to, was judged easier to read than a separate summary
 * icon once real numbers for many skills started landing.
 *
 * Laid out as a single stacked column of rows (Conditions, Boons, Auras, Control, Misc.,
 * Strips/Corrupts/Cleanses, Combo Fields, Combo Finishers) — briefly a 2-column grid pairing them
 * up to halve this panel's height (Sessions 2026-08-xx), reverted 2026-08-19 once this panel moved
 * beside `StatsPanel` (see `BuildEditorView`'s `.stats-boons-row`): the 2-column grid's per-row
 * `overflow-x: auto` needs real horizontal room to avoid becoming a permanent horizontal scrollbar,
 * which the narrower half-width column no longer has. A single column trades some height for
 * every row getting the full column width to itself. Combo Fields/Finishers is the one pair still
 * sharing a single generic icon each (see `comboIconItems`'s doc comment) rather than being broken
 * out per `field_type`/`finisher_type` like every other row here — a proper per-type split is
 * future work.
 */
export function BoonConditionSummaryPanel({ build }: Props) {
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
    () => groupNamedFactSources(computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS, NAMED_FACT_TARGET_COUNT_TABLES)),
    [build, gameData]
  )
  const comboSources = useMemo(() => computeComboSources(build, gameData), [build, gameData])
  const [comboFieldItem, comboFinisherItem] = useMemo(() => comboIconItems(comboSources), [comboSources])

  const rows: { label: string; items: BoonConditionIconItem[] }[] = [
    { label: 'Conditions', items: iconItemsFor(boonConditionGroups, CONDITION_NAMES, BOON_CONDITION_ICONS) },
    { label: 'Boons', items: iconItemsFor(boonConditionGroups, BOON_NAMES, BOON_CONDITION_ICONS) },
    { label: 'Auras', items: iconItemsFor(auraGroups, AURA_NAMES, AURA_ICONS) },
    { label: 'Control', items: namedFactIconItemsFor(controlGroups, Object.keys(CONTROL_MATCHERS), CONTROL_ICONS) },
    { label: 'Misc.', items: namedFactIconItemsFor(miscGroups, Object.keys(MISCELLANEOUS_MATCHERS), MISCELLANEOUS_ICONS) },
    {
      label: 'Strips / Corrupts / Cleanses',
      items: namedFactIconItemsFor(stripCorruptGroups, Object.keys(BOON_STRIP_CORRUPT_MATCHERS), BOON_STRIP_CORRUPT_ICONS)
    },
    { label: 'Combo Fields', items: [comboFieldItem] },
    { label: 'Combo Finishers', items: [comboFinisherItem] }
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
