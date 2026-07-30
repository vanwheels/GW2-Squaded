import type { EquipmentSlot, EquipmentSlotKey, ItemStat, ProfessionId, ProfessionWeapon } from '@shared/types'
import { armorTrinketInfusionCapacity, resizeUpgradeIds, RUNE_SLOT_KEYS, weaponUpgradeCapacity } from '@shared/gear-calc/upgrade-slots'
import { stripGw2Markup } from '@shared/gear-calc/format-description'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { UpgradePicker, type UpgradeOption } from './UpgradePicker'
import { SlotIcon, type SlotIconType } from './SlotIcon'

interface Props {
  value: Partial<Record<EquipmentSlotKey, EquipmentSlot>>
  onChange: (value: Partial<Record<EquipmentSlotKey, EquipmentSlot>>) => void
  profession: ProfessionId
  equippedSpecializationIds: ReadonlySet<number>
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

function byName(a: UpgradeOption, b: UpgradeOption): number {
  return a.name.localeCompare(b.name)
}

export function EquipmentEditor({ value, onChange, profession: professionId, equippedSpecializationIds }: Props) {
  const { itemStats, professions, skillsById, runes, sigils, infusions } = useGameData()
  const sortedStats = dedupedStats(itemStats).sort((a, b) => a.name.localeCompare(b.name))
  const profession = professions.find((p) => p.id === professionId)

  const runeOptions: UpgradeOption[] = runes
    .map((r) => ({ id: r.id, name: r.name, icon: r.icon, description: r.bonuses.map((b) => b.raw).join('\n') }))
    .sort(byName)
  const sigilOptions: UpgradeOption[] = sigils
    .map((s) => ({ id: s.id, name: s.name, icon: s.icon, description: stripGw2Markup(s.description) }))
    .sort(byName)
  const infusionOptions: UpgradeOption[] = infusions
    .map((i) => ({
      id: i.id,
      name: i.name,
      icon: i.icon,
      description: i.attribute && i.value !== null ? `+${i.value} ${i.attribute}` : i.description
    }))
    .sort(byName)

  function setItemStat(key: EquipmentSlotKey, itemStatId: number | null): void {
    onChange({ ...value, [key]: { ...(value[key] ?? {}), itemStatId } })
  }

  function setRune(key: EquipmentSlotKey, runeId: number | null): void {
    onChange({ ...value, [key]: { ...(value[key] ?? { itemStatId: null }), runeId } })
  }

  function setInfusion(key: EquipmentSlotKey, capacity: number, index: number, infusionId: number | null): void {
    const slot = value[key] ?? { itemStatId: null }
    const ids = resizeUpgradeIds(slot.infusionIds, capacity)
    ids[index] = infusionId
    onChange({ ...value, [key]: { ...slot, infusionIds: ids } })
  }

  function setSigil(key: EquipmentSlotKey, capacity: number, index: number, sigilId: number | null): void {
    const slot = value[key] ?? { itemStatId: null }
    const ids = resizeUpgradeIds(slot.sigilIds, capacity)
    ids[index] = sigilId
    onChange({ ...value, [key]: { ...slot, sigilIds: ids } })
  }

  function infusionRow(key: EquipmentSlotKey, capacity: number) {
    if (capacity === 0) return null
    const ids = resizeUpgradeIds(value[key]?.infusionIds, capacity)
    return (
      <div className="upgrade-row">
        {ids.map((id, i) => (
          <UpgradePicker
            key={i}
            label="Infusion"
            options={infusionOptions}
            chosenId={id}
            onChoose={(infusionId) => setInfusion(key, capacity, i, infusionId)}
          />
        ))}
      </div>
    )
  }

  function sigilRow(key: EquipmentSlotKey, capacity: number) {
    if (capacity === 0) return null
    const ids = resizeUpgradeIds(value[key]?.sigilIds, capacity)
    return (
      <div className="upgrade-row">
        {ids.map((id, i) => (
          <UpgradePicker
            key={i}
            label="Sigil"
            options={sigilOptions}
            chosenId={id}
            onChoose={(sigilId) => setSigil(key, capacity, i, sigilId)}
          />
        ))}
      </div>
    )
  }

  function renderSlot(key: EquipmentSlotKey, label: string, icon: SlotIconType) {
    const isRuneSlot = RUNE_SLOT_KEYS.includes(key)
    const infusionCapacity = armorTrinketInfusionCapacity(key)
    return (
      <div className="gear-slot" key={key}>
        <div className="gear-slot-icon">
          <SlotIcon type={icon} />
        </div>
        <label className="gear-slot-body">
          <span className="gear-slot-label">{label}</span>
          <select
            value={value[key]?.itemStatId ?? ''}
            onChange={(e) => setItemStat(key, e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— None —</option>
            {sortedStats.map((stat) => (
              <option key={stat.id} value={stat.id}>
                {stat.name}
              </option>
            ))}
          </select>
        </label>
        {isRuneSlot && (
          <div className="upgrade-row">
            <UpgradePicker label="Rune" options={runeOptions} chosenId={value[key]?.runeId ?? null} onChoose={(id) => setRune(key, id)} />
          </div>
        )}
        {infusionRow(key, infusionCapacity)}
      </div>
    )
  }

  /** Weapon types this profession can use in a given hand context, gated by equipped elite specs
   *  the same way `skillsForProfessionAndSlot`/`legendsForSpecializations` gate skills/legends. */
  function weaponOptions(filter: (w: ProfessionWeapon) => boolean): [string, ProfessionWeapon][] {
    if (!profession) return []
    return Object.entries(profession.weapons).filter(
      ([, w]) => filter(w) && (w.specializationId === null || equippedSpecializationIds.has(w.specializationId))
    )
  }

  function weaponIcon(weapon: ProfessionWeapon): string {
    const firstSkillId = weapon.skills[0]?.id
    return (firstSkillId !== undefined ? skillsById.get(firstSkillId)?.icon : undefined) ?? ''
  }

  function weaponTypeRow(
    options: [string, ProfessionWeapon][],
    chosen: string | null,
    onChoose: (weaponType: string | null) => void
  ) {
    return (
      <div className="profession-picker-row">
        <Tooltip content={<TooltipBody title="None" />}>
          <button
            type="button"
            className={chosen === null ? 'spec-icon-button core-spec-button chosen' : 'spec-icon-button core-spec-button'}
            onClick={() => onChoose(null)}
          >
            —
          </button>
        </Tooltip>
        {options.map(([name, weapon]) => (
          <Tooltip key={name} content={<TooltipBody title={name} />}>
            <button
              type="button"
              className={chosen === name ? 'spec-icon-button weapon-type-button chosen' : 'spec-icon-button weapon-type-button'}
              style={{ backgroundImage: `url(${weaponIcon(weapon)})` }}
              onClick={() => onChoose(name)}
            />
          </Tooltip>
        ))}
      </div>
    )
  }

  /**
   * A main+off hand pair (land Set A/B). A two-handed main-hand weapon mirrors its `weaponType`
   * and `itemStatId` onto the off-hand key and locks it (matches the real game: a two-handed
   * weapon occupies both slots as one item) — see `attribute-totals.ts` for why mirroring the
   * one-handed attribute constant onto both slots, rather than special-casing a two-handed
   * constant, already produces the correct total.
   */
  function renderWeaponPair(mainKey: EquipmentSlotKey, offKey: EquipmentSlotKey, mainLabel: string, offLabel: string) {
    const mainSlot = value[mainKey]
    const mainWeapon = mainSlot?.weaponType ? profession?.weapons[mainSlot.weaponType] : undefined
    const isTwoHanded = mainWeapon?.flags.includes('TwoHand') ?? false

    const mainOptions = weaponOptions((w) => w.flags.includes('Mainhand') || w.flags.includes('TwoHand'))
    const offOptions = weaponOptions((w) => w.flags.includes('Offhand'))

    const mainCapacity = weaponUpgradeCapacity(Boolean(mainSlot?.weaponType), isTwoHanded)
    const offCapacity = weaponUpgradeCapacity(Boolean(value[offKey]?.weaponType), false)

    function chooseMain(weaponType: string | null): void {
      const newWeapon = weaponType ? profession?.weapons[weaponType] : undefined
      const newIsTwoHanded = newWeapon?.flags.includes('TwoHand') ?? false
      const itemStatId = mainSlot?.itemStatId ?? null
      const nextMain: EquipmentSlot = { itemStatId, weaponType }
      const nextOff: EquipmentSlot = newIsTwoHanded
        ? { itemStatId, weaponType }
        : isTwoHanded
          ? { itemStatId: null, weaponType: null }
          : (value[offKey] ?? { itemStatId: null, weaponType: null })
      onChange({ ...value, [mainKey]: nextMain, [offKey]: nextOff })
    }

    function setMainItemStat(itemStatId: number | null): void {
      const nextMain: EquipmentSlot = { ...(mainSlot ?? {}), itemStatId, weaponType: mainSlot?.weaponType ?? null }
      onChange({
        ...value,
        [mainKey]: nextMain,
        // A two-handed weapon's itemStatId is mirrored onto the off-hand slot too (see class doc
        // comment), but its rune/sigil/infusion picks live independently per slot key — only the
        // stat combo mirrors, not the upgrades.
        ...(isTwoHanded ? { [offKey]: { ...(value[offKey] ?? {}), itemStatId, weaponType: mainSlot?.weaponType ?? null } } : {})
      })
    }

    function chooseOff(weaponType: string | null): void {
      onChange({ ...value, [offKey]: { itemStatId: value[offKey]?.itemStatId ?? null, weaponType } })
    }

    function setOffItemStat(itemStatId: number | null): void {
      onChange({ ...value, [offKey]: { ...(value[offKey] ?? {}), itemStatId, weaponType: value[offKey]?.weaponType ?? null } })
    }

    return (
      <div className="gear-weapon-pair" key={mainKey}>
        <div className="gear-slot weapon-slot">
          {weaponTypeRow(mainOptions, mainSlot?.weaponType ?? null, chooseMain)}
          <label className="gear-slot-body">
            <span className="gear-slot-label">{mainLabel}</span>
            <select value={mainSlot?.itemStatId ?? ''} onChange={(e) => setMainItemStat(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— None —</option>
              {sortedStats.map((stat) => (
                <option key={stat.id} value={stat.id}>
                  {stat.name}
                </option>
              ))}
            </select>
          </label>
          {sigilRow(mainKey, mainCapacity)}
          {infusionRow(mainKey, mainCapacity)}
        </div>
        <div className="gear-slot weapon-slot">
          {isTwoHanded ? (
            <div className="weapon-slot-locked">(2-handed)</div>
          ) : (
            <>
              {weaponTypeRow(offOptions, value[offKey]?.weaponType ?? null, chooseOff)}
              <label className="gear-slot-body">
                <span className="gear-slot-label">{offLabel}</span>
                <select
                  value={value[offKey]?.itemStatId ?? ''}
                  onChange={(e) => setOffItemStat(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— None —</option>
                  {sortedStats.map((stat) => (
                    <option key={stat.id} value={stat.id}>
                      {stat.name}
                    </option>
                  ))}
                </select>
              </label>
              {sigilRow(offKey, offCapacity)}
              {infusionRow(offKey, offCapacity)}
            </>
          )}
        </div>
      </div>
    )
  }

  /** A single underwater weapon slot — no hand pairing, since every aquatic weapon type is
   *  confirmed `TwoHand` (verified against the live API for every profession). */
  function renderUnderwaterSlot(key: EquipmentSlotKey, label: string) {
    const slot = value[key]
    const options = weaponOptions((w) => w.flags.includes('Aquatic'))
    // Every aquatic weapon type is confirmed TwoHand (see class doc comment on this function), so
    // an underwater slot always gets the 2-slot upgrade capacity once a weapon is equipped.
    const capacity = weaponUpgradeCapacity(Boolean(slot?.weaponType), true)

    function choose(weaponType: string | null): void {
      onChange({ ...value, [key]: { itemStatId: slot?.itemStatId ?? null, weaponType } })
    }

    function setStat(itemStatId: number | null): void {
      onChange({ ...value, [key]: { ...(slot ?? {}), itemStatId, weaponType: slot?.weaponType ?? null } })
    }

    return (
      <div className="gear-slot weapon-slot" key={key}>
        {weaponTypeRow(options, slot?.weaponType ?? null, choose)}
        <label className="gear-slot-body">
          <span className="gear-slot-label">{label}</span>
          <select value={slot?.itemStatId ?? ''} onChange={(e) => setStat(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— None —</option>
            {sortedStats.map((stat) => (
              <option key={stat.id} value={stat.id}>
                {stat.name}
              </option>
            ))}
          </select>
        </label>
        {sigilRow(key, capacity)}
        {infusionRow(key, capacity)}
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
          <h4>Weapon I</h4>
          {renderWeaponPair('weaponA1', 'weaponA2', 'Main hand', 'Off hand')}
        </div>
        <div className="gear-weapon-set">
          <h4>Weapon II</h4>
          {renderWeaponPair('weaponB1', 'weaponB2', 'Main hand', 'Off hand')}
        </div>
        <div className="gear-weapon-set">
          <h4>Underwater</h4>
          {renderUnderwaterSlot('weaponU1', 'Set 1')}
          {renderUnderwaterSlot('weaponU2', 'Set 2')}
        </div>
      </div>
    </div>
  )
}
