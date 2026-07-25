import type { EquipmentSlotKey } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  value: Partial<Record<EquipmentSlotKey, { itemStatId: number | null }>>
  onChange: (value: Partial<Record<EquipmentSlotKey, { itemStatId: number | null }>>) => void
}

const SLOTS: { key: EquipmentSlotKey; label: string }[] = [
  { key: 'helm', label: 'Helm' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'chest', label: 'Chest' },
  { key: 'gloves', label: 'Gloves' },
  { key: 'leggings', label: 'Leggings' },
  { key: 'boots', label: 'Boots' },
  { key: 'backpiece', label: 'Backpiece' },
  { key: 'accessory1', label: 'Accessory 1' },
  { key: 'accessory2', label: 'Accessory 2' },
  { key: 'ring1', label: 'Ring 1' },
  { key: 'ring2', label: 'Ring 2' },
  { key: 'amulet', label: 'Amulet' },
  { key: 'weaponA1', label: 'Weapon A1' },
  { key: 'weaponA2', label: 'Weapon A2' },
  { key: 'weaponB1', label: 'Weapon B1' },
  { key: 'weaponB2', label: 'Weapon B2' }
]

export function EquipmentEditor({ value, onChange }: Props) {
  const { itemStats } = useGameData()
  const sortedStats = itemStats.filter((s) => s.name.trim() !== '').sort((a, b) => a.name.localeCompare(b.name))

  function setSlot(key: EquipmentSlotKey, itemStatId: number | null): void {
    onChange({ ...value, [key]: { itemStatId } })
  }

  return (
    <div className="equipment-editor">
      {SLOTS.map(({ key, label }) => (
        <label className="field" key={key}>
          <span>{label}</span>
          <select
            value={value[key]?.itemStatId ?? ''}
            onChange={(e) => setSlot(key, e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— None —</option>
            {sortedStats.map((stat) => (
              <option key={stat.id} value={stat.id}>
                {stat.name}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}
