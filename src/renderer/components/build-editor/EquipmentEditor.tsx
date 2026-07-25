import type { ItemStat, EquipmentSlotKey } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  value: Partial<Record<EquipmentSlotKey, { itemStatId: number | null }>>
  onChange: (value: Partial<Record<EquipmentSlotKey, { itemStatId: number | null }>>) => void
}

/**
 * The GW2 API's /v2/itemstats returns multiple ids for the same display name (e.g. 5 different
 * "Berserker's" entries) — legacy pre-revamp combos, trinket-only (value-only) variants, and the
 * modern armor/weapon combo (multiplier+value) all coexist under one name. Picking the entry
 * with the most attributes, then preferring one where every attribute has both a nonzero
 * multiplier AND value (the fully-specified modern combo), gives a single sensible option per
 * name for display. Verified against all 43 duplicate-name groups in the live dataset — see
 * TODO.md for the one caveat (name collisions across genuinely different legacy combos, e.g.
 * "Giver's", still resolve correctly under this heuristic but aren't chosen for a documented
 * reason, just the best available signal).
 */
function pickCanonicalStat(entries: ItemStat[]): ItemStat {
  return entries.reduce((best, entry) => {
    const bestScore = scoreStat(best)
    const entryScore = scoreStat(entry)
    return entryScore > bestScore || (entryScore === bestScore && entry.id < best.id) ? entry : best
  })
}

function scoreStat(stat: ItemStat): number {
  const attrCount = stat.attributes.length
  const fullySpecified = stat.attributes.every((a) => a.multiplier > 0 && a.value > 0)
  return attrCount * 10 + (fullySpecified ? 1 : 0)
}

function dedupedStats(itemStats: ItemStat[]): ItemStat[] {
  const byName = new Map<string, ItemStat[]>()
  for (const stat of itemStats) {
    if (stat.name.trim() === '') continue
    const group = byName.get(stat.name)
    if (group) group.push(stat)
    else byName.set(stat.name, [stat])
  }
  return Array.from(byName.values(), pickCanonicalStat)
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
  const sortedStats = dedupedStats(itemStats).sort((a, b) => a.name.localeCompare(b.name))

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
