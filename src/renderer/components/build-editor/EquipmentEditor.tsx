import { useState } from 'react'
import type { Build, EquipmentSlot, EquipmentSlotKey, ItemStat, ProfessionId, ProfessionWeapon } from '@shared/types'
import { armorTrinketInfusionCapacity, resizeUpgradeIds, RUNE_SLOT_KEYS, weaponUpgradeCapacity } from '@shared/gear-calc/upgrade-slots'
import {
  ATTRIBUTE_DISPLAY_NAME,
  itemStatCategoryForSlot,
  resolveItemStatId,
  SLOT_ADJUSTMENT_KEY,
  statComboContribution,
  weaponAdjustmentKey,
  type AdjustmentKey
} from '@shared/gear-calc/attribute-totals'
import { formatConsumableDescription, formatItemStatName } from '@shared/gear-calc/format-description'
import { formatRelicDescription } from '@shared/gear-calc/relic-effects-format'
import { useGameData } from '@renderer/state/game-data-store'
import { UpgradePicker, type UpgradeOption } from './UpgradePicker'
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
 * The GW2 API's /v2/itemstats returns multiple ids for the same display name within a single
 * category (e.g. duplicate identical rows, or a legacy 2-attribute combo sharing a name with the
 * modern 4-attribute one, like "Giver's"). Picking the entry with the most attributes, then
 * preferring one where every attribute has both a nonzero multiplier AND value, resolves to a
 * single sensible id per name.
 *
 * **Must only ever be called with ids already filtered to one category** (armor/weapon xor
 * trinket) — see `dedupedStatsForCategory`'s doc comment for why merging categories here was a
 * real, previously-shipped bug.
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

/**
 * Restricts the picker to stat combos actually selectable on a current item, for one
 * `ItemStatLegalIds` category at a time. **Never merge `armorWeapon` and `trinket` ids before
 * deduping** — confirmed live 2026-08-02 (user cross-check against gw2skills.net's own item
 * tooltips) that a combo with both an armor/weapon and a trinket variant (e.g. Minstrel's) is two
 * genuinely different API entries: the trinket entry carries an extra flat `value` bonus on top of
 * the same `multiplier` (e.g. Minstrel's Toughness is `adjustment * 0.3` on a helm/weapon but
 * `adjustment * 0.3 + 25` on a ring/amulet/accessory/back). The previous implementation deduped
 * both categories together under one shared id per name, and `pickCanonicalStat`'s "prefer fully
 * specified" tiebreak (a nonzero `value` scores higher) consistently picked the trinket entry —
 * silently inflating Toughness/Vitality/Concentration/Healing Power (and any other combo with this
 * shape) on every armor and weapon slot in the app. See `resolveItemStatId` in
 * `attribute-totals.ts` for how already-saved builds self-heal from this without a data migration.
 */
function dedupedStatsForCategory(itemStats: ItemStat[], legalIds: number[]): ItemStat[] {
  const legal = new Set(legalIds)
  const byName = new Map<string, ItemStat[]>()
  for (const stat of itemStats) {
    if (stat.name.trim() === '' || !legal.has(stat.id)) continue
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

/** Maps each armor/trinket slot to its gw2skills mini-icon name, overlaid in the corner of the
 *  slot's stat-prefix picker (see UpgradePicker's `cornerIcon` prop). */
const SLOT_ICON_KIND: Partial<Record<EquipmentSlotKey, string>> = {
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

/** GW2 API weapon-type key (`ProfessionWeapon`'s key in `profession.weapons`) to gw2skills icon
 *  filename slug — both `weapon-mini/` (corner overlay) and `weapon-placeholder/` (large empty-
 *  slot art) use the same slugs, except `Spear` on land: the gw2skills source sprite has a
 *  distinct land-Spear mini icon (`spear-land`, no wave decoration) but no separate large-render
 *  placeholder for it, so `weaponMiniIcon` special-cases `Spear` by `isAquatic` while
 *  `weaponPlaceholderIcon` always uses this table's plain `spear` (the underwater art) for both.
 *  `Speargun` is the Harpoon Gun. */
const WEAPON_ICON_SLUG: Record<string, string> = {
  Axe: 'axe',
  Dagger: 'dagger',
  Focus: 'focus',
  Greatsword: 'greatsword',
  Hammer: 'hammer',
  Longbow: 'longbow',
  Mace: 'mace',
  Pistol: 'pistol',
  Rifle: 'rifle',
  Scepter: 'scepter',
  Shield: 'shield',
  Shortbow: 'shortbow',
  Spear: 'spear',
  Speargun: 'harpoon-gun',
  Staff: 'staff',
  Sword: 'sword',
  Torch: 'torch',
  Trident: 'trident',
  Warhorn: 'warhorn'
}

/** `Trident`/`Speargun` are `Aquatic`-flagged and never usable on land. `Spear` is also
 *  `Aquatic`-flagged but, as of the Janthir Wilds expansion, usable on land too (with its own
 *  `NoUnderwater`-flagged land skill ids — see `profession-mechanic.ts`/`weapon-skills.ts`) — so
 *  it can't be excluded from land weapon options by the `Aquatic` flag alone. */
const AQUATIC_ONLY_WEAPON_NAMES = new Set(['Trident', 'Speargun'])

function weaponMiniIcon(weaponType: string | null | undefined, isAquatic: boolean): string | undefined {
  const slug = weaponType === 'Spear' && !isAquatic ? 'spear-land' : weaponType ? WEAPON_ICON_SLUG[weaponType] : undefined
  // Relative (no leading slash): the packaged app loads index.html via `file://`, where a
  // root-absolute path resolves against the OS filesystem root, not the app's own directory —
  // broke every local icon in production (see COMPLETED.md/git history, discovered post-release).
  return slug ? `icons/weapon-mini/${slug}.png` : undefined
}

function weaponPlaceholderIcon(weaponType: string | null | undefined): string | undefined {
  const slug = weaponType ? WEAPON_ICON_SLUG[weaponType] : undefined
  return slug ? `icons/weapon-placeholder/${slug}.png` : undefined
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
  const { itemStats, itemStatIcons, itemStatLegalIds, professions, runes, sigils, infusions, relics, relicEffects, food, utility } =
    useGameData()
  // Two entirely separate deduped lists, never merged — see `dedupedStatsForCategory`'s doc
  // comment on why mixing armor/weapon and trinket combos here was a real bug.
  const armorWeaponStats = dedupedStatsForCategory(itemStats, itemStatLegalIds.armorWeapon).sort((a, b) => a.name.localeCompare(b.name))
  const trinketStats = dedupedStatsForCategory(itemStats, itemStatLegalIds.trinket).sort((a, b) => a.name.localeCompare(b.name))
  const itemStatsById = new Map(itemStats.map((s) => [s.id, s]))
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
  //
  // The hover tooltip shows the actual point value each attribute contributes *in this slot*
  // (e.g. "+108 Toughness"), matching gw2skills.net's item tooltips — added after a user cross-
  // check against gw2skills flagged that this app had no way to see per-item numbers at all, only
  // attribute names. Contribution is slot-dependent (a helm and a two-handed weapon apply the same
  // stat combo's multiplier/value against different `ATTRIBUTE_ADJUSTMENT` constants), so this is
  // a function of the slot's category+adjustment tier, not a single shared list — see
  // `statComboContribution`/`dedupedStatsForCategory`.
  //
  // `adjustmentKeyOverride` (2026-08-02): only ever passed for a two-handed weapon's main-hand
  // slot. `weaponAdjustmentKey(slotKey)` always resolves land weapon slots to `weaponOneHanded` —
  // correct for `computeGearAttributeTotals`'s *totals*, since mirroring the one-handed constant
  // across both mirrored slots and summing the raw (unrounded) floats is exactly equal to using
  // the two-handed constant once (`weaponOneHanded.ascended * 2 === weaponTwoHanded.ascended`
  // exactly). But this tooltip only renders on the main-hand slot for a 2H weapon (the off-hand
  // slot shows "(2-handed)", no picker at all), so it must show gw2skills' single "whole item"
  // number — the real two-handed constant applied once — not the halved one-handed number. Those
  // two differ after rounding (e.g. Minstrel's: `round(358.512*0.3)*2 = 216` vs. the real
  // `round(717.024*0.3) = 215`), confirmed by the user cross-checking against gw2skills.net.
  function statOptionsFor(slotKey: EquipmentSlotKey, adjustmentKeyOverride?: AdjustmentKey): UpgradeOption[] {
    const adjustmentKey = adjustmentKeyOverride ?? SLOT_ADJUSTMENT_KEY[slotKey] ?? weaponAdjustmentKey(slotKey)
    const source = itemStatCategoryForSlot(slotKey) === 'trinket' ? trinketStats : armorWeaponStats
    return source.map((stat) => {
      const contribution = statComboContribution(stat, adjustmentKey)
      const description = stat.attributes
        .map((a) => `+${Math.round(contribution.points[a.attribute] ?? 0)} ${ATTRIBUTE_DISPLAY_NAME[a.attribute] ?? a.attribute}`)
        .join('\n')
      return { id: stat.id, name: formatItemStatName(stat.name), icon: itemStatIcons[stat.name] ?? '', description }
    })
  }

  /** A slot's *displayed* selected id — resolves an already-saved build's `itemStatId` to
   *  whichever id is actually legal for this slot's category before comparing it against
   *  `statOptionsFor`'s (category-scoped) option list, so a pre-fix build's stat prefix still
   *  shows as selected instead of appearing blank. See `resolveItemStatId`'s doc comment. */
  function displayedItemStatId(slotKey: EquipmentSlotKey, rawId: number | null): number | null {
    if (rawId === null) return null
    return resolveItemStatId(rawId, itemStatsById, itemStatLegalIds, itemStatCategoryForSlot(slotKey))
  }

  // The copy/paste template picker broadcasts one stat prefix *name* across every armor/trinket/
  // weapon slot at once (see `applyStatToAll`) — armor/weapon and trinket slots need different ids
  // for the same name (see `dedupedStatsForCategory`), so this list (deduped by name across both
  // categories, id is just a representative token `applyStatToAll` resolves back to a name) has no
  // single slot context to compute a numeric breakdown against, so it lists attribute names only.
  const templateStatOptions: UpgradeOption[] = Array.from(new Map([...armorWeaponStats, ...trinketStats].map((s) => [s.name, s])).values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((stat) => ({
      id: stat.id,
      name: formatItemStatName(stat.name),
      icon: itemStatIcons[stat.name] ?? '',
      description: stat.attributes.map((a) => ATTRIBUTE_DISPLAY_NAME[a.attribute] ?? a.attribute).join(' / ')
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
  // Food/utility intentionally list the FULL catalog, not a pre-filtered "WvW meta" subset (see
  // TODO.md) — but `effectName === null` entries (confirmed 2026-08-06 to be exactly the ~318
  // food / 10 utility catalog items with no Nourishment/Enhancement buff at all: "Feast" reagents
  // meant to be placed down for a group rather than eaten directly, plus a handful of cosmetic
  // transformation tonics — see `Consumable`'s doc comment in game-data.ts) are excluded here, not
  // a "meta" judgment call: picking one of these does nothing (no buff to apply) and their
  // `description` falls back to the item's own flavor/usage text ("Double-click to set out..."),
  // which read like a broken tooltip rather than a legitimate zero-effect choice.
  const relicOptions: UpgradeOption[] = relics
    .map((r) => ({ id: r.id, name: r.name, icon: r.icon, description: formatRelicDescription(r, relicEffects[r.id]) }))
    .sort(byName)
  const foodOptions: UpgradeOption[] = food
    .filter((f) => f.effectName !== null)
    .map((f) => ({ id: f.id, name: f.name, icon: f.icon, description: formatConsumableDescription(f) }))
    .sort(byName)
  const utilityOptions: UpgradeOption[] = utility
    .filter((u) => u.effectName !== null)
    .map((u) => ({ id: u.id, name: u.name, icon: u.icon, description: formatConsumableDescription(u) }))
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
   * would be pure repetition. A rune applies only to the 6 armor slots; sigils/infusions to every
   * weapon slot (sigils) or every armor/trinket/weapon slot (infusions) at their own capacity.
   * Two-handed mirroring isn't a concern here since both mirrored slots end up with the identical
   * id anyway.
   *
   * A stat prefix is the one category with a wrinkle: `templateStatOptions`' `itemStatId` is just
   * a representative id for the chosen *name* (armor/weapon and trinket slots need different ids
   * for the same name — see `dedupedStatsForCategory`), so this resolves the name once and looks
   * up each category's own correct id before applying — never broadcasts the raw template id
   * as-is.
   */
  function applyStatToAll(itemStatId: number | null): void {
    const name = itemStatId !== null ? itemStatsById.get(itemStatId)?.name : null
    const armorWeaponId = name ? (armorWeaponStats.find((s) => s.name === name)?.id ?? null) : null
    const trinketId = name ? (trinketStats.find((s) => s.name === name)?.id ?? null) : null
    const next = { ...value }
    for (const { key } of ARMOR_SLOTS) {
      next[key] = { ...(next[key] ?? {}), itemStatId: armorWeaponId }
    }
    for (const { key } of TRINKET_SLOTS) {
      next[key] = { ...(next[key] ?? {}), itemStatId: trinketId }
    }
    for (const key of WEAPON_SLOT_KEYS) {
      if (!next[key]?.weaponType) continue
      next[key] = { ...next[key], itemStatId: armorWeaponId }
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
          options={statOptionsFor(key)}
          chosenId={displayedItemStatId(key, value[key]?.itemStatId ?? null)}
          onChoose={(id) => setItemStat(key, id)}
          variant="slot"
          rarity="ascended"
          dragCategory="stat"
          cornerIcon={`icons/slot-mini/${SLOT_ICON_KIND[key] ?? 'amulet'}.png`}
          emptyIcon={`icons/equip-slot/${SLOT_ICON_KIND[key] ?? 'amulet'}.png`}
        />
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
  function weaponOptions(filter: (name: string, w: ProfessionWeapon) => boolean): [string, ProfessionWeapon][] {
    if (!profession) return []
    return Object.entries(profession.weapons).filter(([name, w]) => filter(name, w))
  }

  /** Weapon-type choice, like the trait specialization picker, is a single button showing the
   *  current pick that opens a small overlay of the available types on click — not an always-
   *  visible row of every weapon-type icon (confirmed 2026-07-30, same "selection button" tech).
   *  Icons are the gw2skills placeholder renders (not the profession's own skill-1 icon) so every
   *  profession's weapon-type picker looks the same regardless of which class is selected. */
  function weaponTypeRow(
    options: [string, ProfessionWeapon][],
    chosen: string | null,
    onChoose: (weaponType: string | null) => void
  ) {
    const weaponOptions: UpgradeOption<string>[] = options.map(([name]) => ({
      id: name,
      name,
      icon: weaponPlaceholderIcon(name) ?? ''
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

    const mainOptions = weaponOptions(
      (name, w) => (w.flags.includes('Mainhand') || w.flags.includes('TwoHand')) && !AQUATIC_ONLY_WEAPON_NAMES.has(name)
    )
    const offOptions = weaponOptions((_name, w) => w.flags.includes('Offhand'))

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
            options={statOptionsFor(mainKey, isTwoHanded ? 'weaponTwoHanded' : undefined)}
            chosenId={displayedItemStatId(mainKey, mainSlot?.itemStatId ?? null)}
            onChoose={setMainItemStat}
            variant="slot"
            rarity="ascended"
            dragCategory="stat"
            cornerIcon={weaponMiniIcon(mainSlot?.weaponType, false)}
            emptyIcon={weaponPlaceholderIcon(mainSlot?.weaponType)}
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
                options={statOptionsFor(offKey)}
                chosenId={displayedItemStatId(offKey, value[offKey]?.itemStatId ?? null)}
                onChoose={setOffItemStat}
                variant="slot"
                rarity="ascended"
                dragCategory="stat"
                cornerIcon={weaponMiniIcon(value[offKey]?.weaponType, false)}
                emptyIcon={weaponPlaceholderIcon(value[offKey]?.weaponType)}
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
    const options = weaponOptions((_name, w) => w.flags.includes('Aquatic'))
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
          options={statOptionsFor(key)}
          chosenId={displayedItemStatId(key, slot?.itemStatId ?? null)}
          onChoose={setStat}
          variant="slot"
          rarity="ascended"
          dragCategory="stat"
          cornerIcon={weaponMiniIcon(slot?.weaponType, true)}
          emptyIcon={weaponPlaceholderIcon(slot?.weaponType)}
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
    rarity?: 'fine',
    emptyIcon?: string
  ) {
    return (
      <div className="gear-slot" key={label}>
        <UpgradePicker
          label={label}
          options={options}
          chosenId={chosenId}
          onChoose={onChoose}
          variant="slot"
          rarity={rarity}
          emptyIcon={emptyIcon}
        />
        <label className="gear-slot-body">
          <span className="gear-slot-label">{label}</span>
        </label>
      </div>
    )
  }

  return (
    <div className="equipment-editor">
      <div className="gear-copy-paste-bar">
        {copyPasteSlot('Stat Prefix', 'stat', templateStatOptions, applyStatToAll)}
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
            {renderOtherSlot(
              'Relic',
              relicOptions,
              consumables.relicId,
              (id) => onConsumablesChange({ ...consumables, relicId: id }),
              'fine',
              'icons/weapon-placeholder/relic.png'
            )}
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
