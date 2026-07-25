import type { ItemStat, EquipmentSlotKey } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { SlotIcon, type SlotIconType } from './SlotIcon'

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

/**
 * Paperdoll positions mirror the in-game Hero > Equipment panel and gw2skills.net: armor down
 * the left column, trinkets down the right, weapon sets below as their own row.
 */
const ARMOR_SLOTS: { key: EquipmentSlotKey; label: string; icon: SlotIconType }[] = [
  { key: 'helm', label: 'Helm', icon: 'helm' },
  { key: 'shoulders', label: 'Shoulders', icon: 'shoulders' },
  { key: 'chest', label: 'Chest', icon: 'chest' },
  { key: 'gloves', label: 'Gloves', icon: 'gloves' },
  { key: 'leggings', label: 'Leggings', icon: 'leggings' },
  { key: 'boots', label: 'Boots', icon: 'boots' }
]

const TRINKET_SLOTS: { key: EquipmentSlotKey; label: string; icon: SlotIconType }[] = [
  { key: 'backpiece', label: 'Back', icon: 'backpiece' },
  { key: 'accessory1', label: 'Accessory 1', icon: 'accessory' },
  { key: 'accessory2', label: 'Accessory 2', icon: 'accessory' },
  { key: 'ring1', label: 'Ring 1', icon: 'ring' },
  { key: 'ring2', label: 'Ring 2', icon: 'ring' },
  { key: 'amulet', label: 'Amulet', icon: 'amulet' }
]

const WEAPON_SET_A: { key: EquipmentSlotKey; label: string }[] = [
  { key: 'weaponA1', label: 'Main hand' },
  { key: 'weaponA2', label: 'Off hand' }
]

const WEAPON_SET_B: { key: EquipmentSlotKey; label: string }[] = [
  { key: 'weaponB1', label: 'Main hand' },
  { key: 'weaponB2', label: 'Off hand' }
]

export function EquipmentEditor({ value, onChange }: Props) {
  const { itemStats } = useGameData()
  const sortedStats = dedupedStats(itemStats).sort((a, b) => a.name.localeCompare(b.name))

  function setSlot(key: EquipmentSlotKey, itemStatId: number | null): void {
    onChange({ ...value, [key]: { itemStatId } })
  }

  function renderSlot(key: EquipmentSlotKey, label: string, icon: SlotIconType) {
    return (
      <div className="gear-slot" key={key}>
        <div className="gear-slot-icon">
          <SlotIcon type={icon} />
        </div>
        <label className="gear-slot-body">
          <span className="gear-slot-label">{label}</span>
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
      </div>
    )
  }

  return (
    <div className="equipment-editor">
      <div className="gear-paperdoll">
        <div className="gear-column">{ARMOR_SLOTS.map((s) => renderSlot(s.key, s.label, s.icon))}</div>
        <div className="gear-column">{TRINKET_SLOTS.map((s) => renderSlot(s.key, s.label, s.icon))}</div>
      </div>
      <div className="gear-weapons">
        <div className="gear-weapon-set">
          <h4>Set A</h4>
          {WEAPON_SET_A.map((s) => renderSlot(s.key, s.label, 'weapon'))}
        </div>
        <div className="gear-weapon-set">
          <h4>Set B</h4>
          {WEAPON_SET_B.map((s) => renderSlot(s.key, s.label, 'weapon'))}
        </div>
      </div>
    </div>
  )
}
