import { useState } from 'react'
import type { Build, EquipmentSlot, EquipmentSlotKey, ItemStat, ProfessionId, ProfessionWeapon } from '@shared/types'
import { armorTrinketInfusionCapacity, resizeUpgradeIds, RUNE_SLOT_KEYS, weaponUpgradeCapacity } from '@shared/gear-calc/upgrade-slots'
import { formatItemStatName } from '@shared/gear-calc/format-description'
import { formatRelicDescription } from '@shared/gear-calc/relic-effects-format'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { UpgradePicker, type UpgradeOption } from './UpgradePicker'
import { SlotTypeIcon, type SlotIconKind } from './SlotTypeIcon'
import { SkillBarIcon } from './SkillBarIcon'

type Consumables = Pick<Build, 'relicId' | 'foodId' | 'utilityId'>

interface Props {
  value: Partial<Record<EquipmentSlotKey, EquipmentSlot>>
  onChange: (value: Partial<Record<EquipmentSlotKey, EquipmentSlot>>) => void
  profession: ProfessionId
  consumables: Consumables
  onConsumablesChange: (value: Consumables) => void
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

const WEAPON_SLOT_KEYS: EquipmentSlotKey[] = ['weaponA1', 'weaponA2', 'weaponB1', 'weaponB2', 'weaponU1', 'weaponU2']

/** Maps each armor/trinket slot to the generic silhouette shown in place of its text label. */
const SLOT_ICON_KIND: Partial<Record<EquipmentSlotKey, SlotIconKind>> = {
  helm: 'helm',
  shoulders: 'shoulders',
  chest: 'chest',
  gloves: 'gloves',
  leggings: 'leggings',
  boots: 'boots',
  backpiece: 'back',
  accessory1: 'accessory',
  accessory2: 'accessory',
  ring1: 'ring',
  ring2: 'ring',
  amulet: 'amulet'
}

function byName(a: UpgradeOption, b: UpgradeOption): number {
  return a.name.localeCompare(b.name)
}

interface CopyPasteTemplates {
  stat: number | null
  rune: number | null
  sigil: number | null
  infusion: number | null
}

const BLANK_TEMPLATES: CopyPasteTemplates = { stat: null, rune: null, sigil: null, infusion: null }

export function EquipmentEditor({
  value,
  onChange,
  profession: professionId,
  consumables,
  onConsumablesChange
}: Props) {
  const { itemStats, itemStatIcons, professions, skillsById, runes, sigils, infusions, relics, relicEffects, food, utility } =
    useGameData()
  const sortedStats = dedupedStats(itemStats).sort((a, b) => a.name.localeCompare(b.name))
  const profession = professions.find((p) => p.id === professionId)
  // Weapon panel toggle (2026-07-31): land Set A/B and the underwater sets share screen real
  // estate poorly side by side, so only one is shown at a time — defaults to land since that's
  // relevant to every build, unlike underwater gear which many builds never touch.
  const [weaponMode, setWeaponMode] = useState<'land' | 'underwater'>('land')
  // Copy/paste (2026-07-30): a template value per category, held only in local UI state (not part
  // of the build) — pick a value here, then drag it onto any matching slot, or use "Apply to All"
  // to fill every eligible slot at once. See `applyStatToAll`/`applyRuneToAll`/`applySigilToAll`/
  // `applyInfusionToAll` below for what "eligible" means per category.
  const [templates, setTemplates] = useState<CopyPasteTemplates>(BLANK_TEMPLATES)

  // Real per-stat-combo icons (see `itemStatIcons`'s doc comment on `GameData` for where these
  // come from) replace the old plain `<select>` of stat names — a small number of legacy/WvW-only
  // combos have no matching icon and fall back to `UpgradePicker`'s generic "?" glyph.
  const statOptions: UpgradeOption[] = sortedStats.map((stat) => ({
    id: stat.id,
    name: formatItemStatName(stat.name),
    icon: itemStatIcons[stat.name] ?? '',
    description: stat.attributes.map((a) => a.attribute).join(' / ')
  }))

  const runeOptions: UpgradeOption[] = runes
    .map((r) => ({ id: r.id, name: r.name, icon: r.icon, description: r.bonuses.map((b) => b.raw).join('\n') }))
    .sort(byName)
  const sigilOptions: UpgradeOption[] = sigils
    .map((s) => ({ id: s.id, name: s.name, icon: s.icon, description: s.description }))
    .sort(byName)
  const infusionOptions: UpgradeOption[] = infusions
    .map((i) => ({
      id: i.id,
      name: i.name,
      icon: i.icon,
      description: i.attribute && i.value !== null ? `+${i.value} ${i.attribute}` : i.description
    }))
    .sort(byName)

  // Build-level (not per-slot) picks: exactly 1 relic, plus at most 1 food and 1 utility
  // consumable — unlike runes/sigils/infusions, these aren't tied to a specific equipment slot.
  // Food/utility intentionally list the FULL catalog, not a pre-filtered subset (see TODO.md).
  const relicOptions: UpgradeOption[] = relics
    .map((r) => ({ id: r.id, name: r.name, icon: r.icon, description: formatRelicDescription(r, relicEffects[r.id]) }))
    .sort(byName)
  const foodOptions: UpgradeOption[] = food
    .map((f) => ({ id: f.id, name: f.name, icon: f.icon, description: f.description }))
    .sort(byName)
  const utilityOptions: UpgradeOption[] = utility
    .map((u) => ({ id: u.id, name: u.name, icon: u.icon, description: u.description }))
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

  /** A weapon slot's current sigil/infusion capacity — same rule `renderWeaponPair`/
   *  `renderUnderwaterSlot` use locally, exposed here too for the "apply to all" bulk-fill below. */
  function weaponSlotCapacity(key: EquipmentSlotKey): number {
    const slot = value[key]
    if (!slot?.weaponType) return 0
    const isTwoHanded = profession?.weapons[slot.weaponType]?.flags.includes('TwoHand') ?? false
    return weaponUpgradeCapacity(true, isTwoHanded)
  }

  /**
   * Copy/paste (2026-07-30): fills every eligible slot in a category with one chosen value, for
   * when a build's gear genuinely matches across every piece and clicking each slot individually
   * would be pure repetition. A stat prefix applies to every armor/trinket/weapon slot (they all
   * share the same `itemStatId` field); a rune only to the 6 armor slots; sigils/infusions to
   * every weapon slot (sigils) or every armor/trinket/weapon slot (infusions) at their own
   * capacity. Two-handed mirroring isn't a concern here since both mirrored slots end up with the
   * identical id anyway.
   */
  function applyStatToAll(itemStatId: number | null): void {
    const next = { ...value }
    for (const key of [...ARMOR_SLOTS, ...TRINKET_SLOTS].map((s) => s.key)) {
      next[key] = { ...(next[key] ?? {}), itemStatId }
    }
    for (const key of WEAPON_SLOT_KEYS) {
      if (!next[key]?.weaponType) continue
      next[key] = { ...next[key], itemStatId }
    }
    onChange(next)
  }

  function applyRuneToAll(runeId: number | null): void {
    const next = { ...value }
    for (const key of RUNE_SLOT_KEYS) {
      next[key] = { ...(next[key] ?? { itemStatId: null }), runeId }
    }
    onChange(next)
  }

  function applySigilToAll(sigilId: number | null): void {
    const next = { ...value }
    for (const key of WEAPON_SLOT_KEYS) {
      const capacity = weaponSlotCapacity(key)
      if (capacity === 0) continue
      next[key] = { ...(next[key] ?? { itemStatId: null }), sigilIds: new Array(capacity).fill(sigilId) }
    }
    onChange(next)
  }

  function applyInfusionToAll(infusionId: number | null): void {
    const next = { ...value }
    for (const key of [...ARMOR_SLOTS, ...TRINKET_SLOTS].map((s) => s.key)) {
      const capacity = armorTrinketInfusionCapacity(key)
      if (capacity === 0) continue
      next[key] = { ...(next[key] ?? { itemStatId: null }), infusionIds: new Array(capacity).fill(infusionId) }
    }
    for (const key of WEAPON_SLOT_KEYS) {
      const capacity = weaponSlotCapacity(key)
      if (capacity === 0) continue
      next[key] = { ...(next[key] ?? { itemStatId: null }), infusionIds: new Array(capacity).fill(infusionId) }
    }
    onChange(next)
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
            rarity="fine"
            dragCategory="infusion"
            size="md"
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
            dragCategory="sigil"
            size="lg"
          />
        ))}
      </div>
    )
  }

  function renderSlot(key: EquipmentSlotKey, label: string) {
    const isRuneSlot = RUNE_SLOT_KEYS.includes(key)
    const infusionCapacity = armorTrinketInfusionCapacity(key)
    return (
      <div className="gear-slot" key={key}>
        <UpgradePicker
          label={label}
          options={statOptions}
          chosenId={value[key]?.itemStatId ?? null}
          onChoose={(id) => setItemStat(key, id)}
          variant="slot"
          rarity="ascended"
          dragCategory="stat"
        />
        <Tooltip content={<TooltipBody title={label} />}>
          <span className="gear-slot-type-icon-wrap">
            <SlotTypeIcon kind={SLOT_ICON_KIND[key] ?? 'amulet'} />
          </span>
        </Tooltip>
        {isRuneSlot && (
          <div className="upgrade-row">
            <UpgradePicker
              label="Rune"
              options={runeOptions}
              chosenId={value[key]?.runeId ?? null}
              onChoose={(id) => setRune(key, id)}
              dragCategory="rune"
              size="lg"
            />
          </div>
        )}
        {infusionRow(key, infusionCapacity)}
      </div>
    )
  }

  /** Weapon types this profession can use in a given hand context. Not gated by equipped elite
   *  specs — Weaponmaster Training makes every weapon type an elite spec unlocks for this
   *  profession permanently available, regardless of which spec is currently equipped. */
  function weaponOptions(filter: (w: ProfessionWeapon) => boolean): [string, ProfessionWeapon][] {
    if (!profession) return []
    return Object.entries(profession.weapons).filter(([, w]) => filter(w))
  }

  function weaponIcon(weapon: ProfessionWeapon): string {
    const firstSkillId = weapon.skills[0]?.id
    return (firstSkillId !== undefined ? skillsById.get(firstSkillId)?.icon : undefined) ?? ''
  }

  /** Weapon-type choice, like the trait specialization picker, is a single button showing the
   *  current pick that opens a small overlay of the available types on click — not an always-
   *  visible row of every weapon-type icon (confirmed 2026-07-30, same "selection button" tech). */
  function weaponTypeRow(
    options: [string, ProfessionWeapon][],
    chosen: string | null,
    onChoose: (weaponType: string | null) => void
  ) {
    const weaponOptions: UpgradeOption<string>[] = options.map(([name, weapon]) => ({
      id: name,
      name,
      icon: weaponIcon(weapon)
    }))
    return <UpgradePicker label="Weapon" options={weaponOptions} chosenId={chosen} onChoose={onChoose} variant="slot" />
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
          </label>
          <UpgradePicker
            label={mainLabel}
            options={statOptions}
            chosenId={mainSlot?.itemStatId ?? null}
            onChoose={setMainItemStat}
            variant="slot"
            rarity="ascended"
            dragCategory="stat"
          />
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
              </label>
              <UpgradePicker
                label={offLabel}
                options={statOptions}
                chosenId={value[offKey]?.itemStatId ?? null}
                onChoose={setOffItemStat}
                variant="slot"
                rarity="ascended"
                dragCategory="stat"
              />
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
        </label>
        <UpgradePicker
          label={label}
          options={statOptions}
          chosenId={slot?.itemStatId ?? null}
          onChoose={setStat}
          variant="slot"
          rarity="ascended"
          dragCategory="stat"
        />
        {sigilRow(key, capacity)}
        {infusionRow(key, capacity)}
      </div>
    )
  }

  function copyPasteSlot(
    categoryLabel: string,
    dragCategory: 'stat' | 'rune' | 'sigil' | 'infusion',
    options: UpgradeOption[],
    applyToAll: (id: number | null) => void
  ) {
    const chosenId = templates[dragCategory]
    return (
      <div className="gear-copy-paste-item" key={dragCategory}>
        <UpgradePicker
          label={categoryLabel}
          options={options}
          chosenId={chosenId}
          onChoose={(id) => setTemplates((t) => ({ ...t, [dragCategory]: id }))}
          variant="slot"
          dragCategory={dragCategory}
        />
        <span className="gear-copy-paste-label">{categoryLabel}</span>
        <button
          type="button"
          className="skill-bar-icon-button"
          title="Apply to All"
          disabled={chosenId === null}
          onClick={() => applyToAll(chosenId)}
        >
          <SkillBarIcon kind="applyAll" />
        </button>
      </div>
    )
  }

  /** A build-level pick (relic/food/utility) rendered like a gear slot — the picker button plus
   *  a text label, matching the weapon-type slot's `gear-slot-body`/`gear-slot-label` treatment
   *  since these have no per-slot silhouette glyph the way armor/trinkets do. */
  function renderOtherSlot(
    label: string,
    options: UpgradeOption[],
    chosenId: number | null,
    onChoose: (id: number | null) => void,
    rarity?: 'fine'
  ) {
    return (
      <div className="gear-slot" key={label}>
        <UpgradePicker label={label} options={options} chosenId={chosenId} onChoose={onChoose} variant="slot" rarity={rarity} />
        <label className="gear-slot-body">
          <span className="gear-slot-label">{label}</span>
        </label>
      </div>
    )
  }

  return (
    <div className="equipment-editor">
      <div className="gear-copy-paste-bar">
        {copyPasteSlot('Stat Prefix', 'stat', statOptions, applyStatToAll)}
        {copyPasteSlot('Rune', 'rune', runeOptions, applyRuneToAll)}
        {copyPasteSlot('Sigil', 'sigil', sigilOptions, applySigilToAll)}
        {copyPasteSlot('Infusion', 'infusion', infusionOptions, applyInfusionToAll)}
      </div>
      <div className="gear-panels">
        <div className="gear-panels-top">
          <div className="gear-panel gear-panel-armor">
            <h4 className="gear-panel-title">Armor</h4>
            {ARMOR_SLOTS.map((s) => renderSlot(s.key, s.label))}
          </div>
          <div className="gear-panel gear-panel-accessories">
            <h4 className="gear-panel-title">Accessories</h4>
            {TRINKET_SLOTS.map((s) => renderSlot(s.key, s.label))}
          </div>
          <div className="gear-panel gear-panel-other">
            <h4 className="gear-panel-title">Other</h4>
            {renderOtherSlot('Relic', relicOptions, consumables.relicId, (id) => onConsumablesChange({ ...consumables, relicId: id }), 'fine')}
            {renderOtherSlot('Food', foodOptions, consumables.foodId, (id) => onConsumablesChange({ ...consumables, foodId: id }))}
            {renderOtherSlot('Utility', utilityOptions, consumables.utilityId, (id) => onConsumablesChange({ ...consumables, utilityId: id }))}
          </div>
        </div>
        <div className="gear-panel gear-panel-weapon">
          <div className="gear-panel-weapon-header">
            <h4 className="gear-panel-title">Weapon</h4>
            <div className="weapon-mode-toggle">
              <button
                type="button"
                className={weaponMode === 'land' ? 'skill-bar-icon-button env-land active' : 'skill-bar-icon-button env-water active'}
                title={weaponMode === 'land' ? 'Switch to Underwater' : 'Switch to Land'}
                onClick={() => setWeaponMode(weaponMode === 'land' ? 'underwater' : 'land')}
              >
                <SkillBarIcon kind={weaponMode === 'land' ? 'land' : 'water'} />
              </button>
            </div>
          </div>
          {weaponMode === 'land' ? (
            <div className="gear-weapon-row">
              <div className="gear-weapon-set">
                <h5>Weapon I</h5>
                {renderWeaponPair('weaponA1', 'weaponA2', 'Main hand', 'Off hand')}
              </div>
              <div className="gear-weapon-divider" />
              <div className="gear-weapon-set">
                <h5>Weapon II</h5>
                {renderWeaponPair('weaponB1', 'weaponB2', 'Main hand', 'Off hand')}
              </div>
            </div>
          ) : (
            <div className="gear-weapon-row">
              {renderUnderwaterSlot('weaponU1', 'Set 1')}
              {renderUnderwaterSlot('weaponU2', 'Set 2')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
