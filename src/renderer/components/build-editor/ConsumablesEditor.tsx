import type { Build } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { formatRelicDescription } from '@shared/gear-calc/relic-effects-format'
import { UpgradePicker, type UpgradeOption } from './UpgradePicker'

interface Props {
  value: Pick<Build, 'relicId' | 'foodId' | 'utilityId'>
  onChange: (value: Pick<Build, 'relicId' | 'foodId' | 'utilityId'>) => void
}

function byName(a: UpgradeOption, b: UpgradeOption): number {
  return a.name.localeCompare(b.name)
}

/**
 * Build-level (not per-slot) picks: exactly 1 relic, plus at most 1 food and 1 utility
 * consumable — unlike runes/sigils/infusions, these aren't tied to a specific equipment slot.
 * Food/utility intentionally list the FULL catalog (859/246 entries), not a pre-filtered "WvW
 * meta" subset — explicit user direction, see TODO.md — which is why `UpgradePicker` grows a
 * search box past 12 options.
 */
export function ConsumablesEditor({ value, onChange }: Props) {
  const { relics, relicEffects, food, utility } = useGameData()

  const relicOptions: UpgradeOption[] = relics
    .map((r) => ({ id: r.id, name: r.name, icon: r.icon, description: formatRelicDescription(r, relicEffects[r.id]) }))
    .sort(byName)
  const foodOptions: UpgradeOption[] = food.map(consumableOption).sort(byName)
  const utilityOptions: UpgradeOption[] = utility.map(consumableOption).sort(byName)

  return (
    <div className="consumables-editor">
      <div className="skill-bar">
        <div className="consumable-slot">
          <span className="legend-slot-label">Relic</span>
          <UpgradePicker
            label="Relic"
            options={relicOptions}
            chosenId={value.relicId}
            onChoose={(id) => onChange({ ...value, relicId: id })}
            variant="slot"
            rarity="fine"
          />
        </div>
        <div className="consumable-slot">
          <span className="legend-slot-label">Food</span>
          <UpgradePicker label="Food" options={foodOptions} chosenId={value.foodId} onChoose={(id) => onChange({ ...value, foodId: id })} variant="slot" />
        </div>
        <div className="consumable-slot">
          <span className="legend-slot-label">Utility</span>
          <UpgradePicker label="Utility" options={utilityOptions} chosenId={value.utilityId} onChoose={(id) => onChange({ ...value, utilityId: id })} variant="slot" />
        </div>
      </div>
    </div>
  )
}

function consumableOption(c: { id: number; name: string; icon: string; description: string }): UpgradeOption {
  return { id: c.id, name: c.name, icon: c.icon, description: c.description }
}
