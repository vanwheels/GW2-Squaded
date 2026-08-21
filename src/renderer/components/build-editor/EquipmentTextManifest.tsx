import type { Build, EquipmentSlotKey } from '@shared/types'
import { RUNE_SLOT_KEYS } from '@shared/gear-calc/upgrade-slots'
import { itemStatCategoryForSlot, resolveItemStatId } from '@shared/gear-calc/attribute-totals'
import { formatItemStatName } from '@shared/gear-calc/format-description'
import { useGameData } from '@renderer/state/game-data-store'
import { useAppSettings } from '@renderer/state/app-settings-store'

interface Props {
  build: Build
}

const ARMOR_SLOTS: { key: EquipmentSlotKey; label: string }[] = [
  { key: 'helm', label: 'Helm' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'chest', label: 'Chest' },
  { key: 'gloves', label: 'Gloves' },
  { key: 'leggings', label: 'Leggings' },
  { key: 'boots', label: 'Boots' }
]

const TRINKET_SLOTS: { key: EquipmentSlotKey; label: string }[] = [
  { key: 'backpiece', label: 'Back' },
  { key: 'accessory1', label: 'Accessory 1' },
  { key: 'accessory2', label: 'Accessory 2' },
  { key: 'ring1', label: 'Ring 1' },
  { key: 'ring2', label: 'Ring 2' },
  { key: 'amulet', label: 'Amulet' }
]

const EMPTY = '—'

/**
 * Read-only, screenshot-only "text manifest" of a build's full equipment loadout — plain names,
 * one line per slot, grouped into the same 4 sections as `EquipmentEditor`'s icon panels (Armor /
 * Accessories / Weapons / Other). Exists because `ScreenshotButton` captures whatever's actually
 * on-screen, and `EquipmentEditor` itself is an *editing* UI (icon-only pickers) rather than
 * something meant to be read at a glance — icons for visually-similar categories (runes/sigils/
 * relic/food/utility/infusions especially) aren't reliably recognizable out of context, and this
 * app's icon set isn't universally recognized in the first place. Toggled into view only via
 * `BuildEditorView`'s "Preview screenshot layout" button, never shown during normal editing.
 */
export function EquipmentTextManifest({ build }: Props) {
  const { itemStats, itemStatLegalIds, professions, runes, sigils, infusions, relics, food, utility, pets } = useGameData()
  const { showUnderwater } = useAppSettings()
  const equipment = build.equipment
  const profession = professions.find((p) => p.id === build.profession)
  const petsById = new Map(pets.map((p) => [p.id, p.name]))
  /** Ranger-only: the manifest is a screenshot-only text readout of what `EquipmentEditor`'s icons
   *  can't reliably convey (see this component's own doc comment) — a Ranger's 2 equipped pets are
   *  exactly that same "icon alone doesn't read at a glance" case, so they get a line here too,
   *  right under Utility since both are consumable-adjacent loadout choices. */
  const petText =
    build.profession === 'Ranger'
      ? build.equippedPetIds.map((id) => (id != null ? (petsById.get(id) ?? EMPTY) : EMPTY)).join(' / ')
      : null

  const itemStatsById = new Map(itemStats.map((s) => [s.id, s]))
  const runesById = new Map(runes.map((r) => [r.id, r.name]))
  const sigilsById = new Map(sigils.map((s) => [s.id, s.name]))
  const infusionsById = new Map(infusions.map((i) => [i.id, i.name]))
  const relicsById = new Map(relics.map((r) => [r.id, r.name]))
  const foodById = new Map(food.map((f) => [f.id, f.name]))
  const utilityById = new Map(utility.map((u) => [u.id, u.name]))

  /** Same category-aware resolution `EquipmentEditor`'s picker uses (see `resolveItemStatId`'s
   *  doc comment) — a legacy build's stat prefix reads correctly here too, not just in the editor. */
  function statName(key: EquipmentSlotKey, rawId: number | null | undefined): string {
    if (rawId == null) return EMPTY
    const resolved = resolveItemStatId(rawId, itemStatsById, itemStatLegalIds, itemStatCategoryForSlot(key))
    const stat = itemStatsById.get(resolved)
    return stat ? formatItemStatName(stat.name) : EMPTY
  }

  /** Groups a set of chosen upgrade ids by resolved name with a count — used for Rune (usually
   *  uniform across all 6 armor pieces for its 6-piece bonus) and Infusion (often the same type
   *  in every socketed slot), so the manifest reads "Scholar ×6" instead of repeating one name 6
   *  times or, worse, one line per infusion slot (up to ~16 across armor/trinkets alone). */
  function groupedCounts(ids: (number | null | undefined)[], namesById: Map<number, string>): string[] {
    const counts = new Map<string, number>()
    for (const id of ids) {
      if (id == null) continue
      const name = namesById.get(id) ?? '?'
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => `${name} ×${count}`)
  }

  const runeText = groupedCounts(RUNE_SLOT_KEYS.map((k) => equipment[k]?.runeId), runesById).join(', ') || EMPTY
  const allSlotKeys = Object.keys(equipment) as EquipmentSlotKey[]
  const infusionText =
    groupedCounts(
      allSlotKeys.flatMap((k) => equipment[k]?.infusionIds ?? []),
      infusionsById
    ).join(', ') || EMPTY

  function weaponLine(label: string, key: EquipmentSlotKey): string {
    const slot = equipment[key]
    const weaponType = slot?.weaponType
    if (!weaponType) return `${label}: ${EMPTY}`
    const sigilNames = (slot?.sigilIds ?? []).filter((id): id is number => id != null).map((id) => sigilsById.get(id) ?? '?')
    const sigilSuffix = sigilNames.length > 0 ? ` [${sigilNames.join(' / ')}]` : ''
    return `${label}: ${weaponType} — ${statName(key, slot?.itemStatId)}${sigilSuffix}`
  }

  /** A main+off hand pair — the off-hand line is omitted entirely (not shown as "(2-handed)")
   *  when a two-handed weapon mirrors onto it, same reasoning as everywhere else being compact:
   *  the Main line's weapon type already implies it. */
  function weaponSet(title: string, mainKey: EquipmentSlotKey, offKey: EquipmentSlotKey) {
    const mainSlot = equipment[mainKey]
    const mainWeapon = mainSlot?.weaponType ? profession?.weapons[mainSlot.weaponType] : undefined
    const isTwoHanded = mainWeapon?.flags.includes('TwoHand') ?? false
    return (
      <div className="equip-manifest-block" key={title}>
        <div className="equip-manifest-subtitle">{title}</div>
        <div>{weaponLine('Main', mainKey)}</div>
        {!isTwoHanded && <div>{weaponLine('Off', offKey)}</div>}
      </div>
    )
  }

  const hasUnderwaterGear = equipment.weaponU1?.weaponType != null || equipment.weaponU2?.weaponType != null

  return (
    <div className="equipment-text-manifest">
      <div className="equip-manifest-col">
        <div className="equip-manifest-title">Armor</div>
        {ARMOR_SLOTS.map((s) => (
          <div key={s.key}>
            {s.label}: {statName(s.key, equipment[s.key]?.itemStatId)}
          </div>
        ))}
        <div>Rune: {runeText}</div>
      </div>
      <div className="equip-manifest-col">
        <div className="equip-manifest-title">Accessories</div>
        {TRINKET_SLOTS.map((s) => (
          <div key={s.key}>
            {s.label}: {statName(s.key, equipment[s.key]?.itemStatId)}
          </div>
        ))}
        <div>Infusion: {infusionText}</div>
      </div>
      <div className="equip-manifest-col">
        <div className="equip-manifest-title">Weapons</div>
        {weaponSet('Set I', 'weaponA1', 'weaponA2')}
        {weaponSet('Set II', 'weaponB1', 'weaponB2')}
        {showUnderwater && hasUnderwaterGear && (
          <div className="equip-manifest-block">
            <div className="equip-manifest-subtitle">Underwater</div>
            <div>{weaponLine('Set 1', 'weaponU1')}</div>
            <div>{weaponLine('Set 2', 'weaponU2')}</div>
          </div>
        )}
      </div>
      <div className="equip-manifest-col">
        <div className="equip-manifest-title">Other</div>
        <div>Relic: {build.relicId != null ? (relicsById.get(build.relicId) ?? EMPTY) : EMPTY}</div>
        <div>Food: {build.foodId != null ? (foodById.get(build.foodId) ?? EMPTY) : EMPTY}</div>
        <div>Utility: {build.utilityId != null ? (utilityById.get(build.utilityId) ?? EMPTY) : EMPTY}</div>
        {petText != null && <div>Pets: {petText}</div>}
      </div>
    </div>
  )
}
