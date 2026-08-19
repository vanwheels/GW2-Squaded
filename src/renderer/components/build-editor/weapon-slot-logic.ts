import type { EquipmentSlot, EquipmentSlotKey, Profession, ProfessionWeapon } from '@shared/types'

export type EquipmentValue = Partial<Record<EquipmentSlotKey, EquipmentSlot>>

/** GW2 API weapon-type key (`ProfessionWeapon`'s key in `profession.weapons`) to gw2skills icon
 *  filename slug — both `weapon-mini/` (small badge art) and `weapon-placeholder/` (large empty-
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
export const AQUATIC_ONLY_WEAPON_NAMES = new Set(['Trident', 'Speargun'])

export function weaponMiniIcon(weaponType: string | null | undefined, isAquatic: boolean): string | undefined {
  const slug = weaponType === 'Spear' && !isAquatic ? 'spear-land' : weaponType ? WEAPON_ICON_SLUG[weaponType] : undefined
  // Relative (no leading slash): the packaged app loads index.html via `file://`, where a
  // root-absolute path resolves against the OS filesystem root, not the app's own directory —
  // broke every local icon in production (see COMPLETED.md/git history, discovered post-release).
  return slug ? `icons/weapon-mini/${slug}.png` : undefined
}

export function weaponPlaceholderIcon(weaponType: string | null | undefined): string | undefined {
  const slug = weaponType ? WEAPON_ICON_SLUG[weaponType] : undefined
  return slug ? `icons/weapon-placeholder/${slug}.png` : undefined
}

/** Weapon types this profession can use in a given hand context. Not gated by equipped elite
 *  specs — Weaponmaster Training makes every weapon type an elite spec unlocks for this
 *  profession permanently available, regardless of which spec is currently equipped. */
export function weaponOptionsFor(
  profession: Profession | undefined,
  filter: (name: string, w: ProfessionWeapon) => boolean
): [string, ProfessionWeapon][] {
  if (!profession) return []
  return Object.entries(profession.weapons).filter(([name, w]) => filter(name, w))
}

export function isTwoHandedWeapon(profession: Profession | undefined, weaponType: string | null | undefined): boolean {
  if (!weaponType) return false
  return profession?.weapons[weaponType]?.flags.includes('TwoHand') ?? false
}

/**
 * Weapon-*type* handlers for one main+off hand pair (land Set A/B) — shared between
 * `WeaponTypeBar`'s top-strip picker (2026-08-19: weapon type moved out of `EquipmentEditor`'s
 * own gear slots into this dedicated bar, gw2skills.net-style, after the earlier "corner badge on
 * the stat slot" attempt proved unintuitive) and `EquipmentEditor`'s stat-prefix slots, which still
 * need `mainSlot`/`isTwoHanded` to know their own legality (a two-handed weapon's off-hand stat
 * mirrors the main slot and is locked). A two-handed main-hand weapon mirrors its `weaponType`
 * (not `itemStatId` — that's `EquipmentEditor`'s own concern) onto the off-hand key and locks it,
 * matching the real game: a two-handed weapon occupies both slots as one item.
 */
export function weaponPairHandlers(
  profession: Profession | undefined,
  value: EquipmentValue,
  onChange: (value: EquipmentValue) => void,
  mainKey: EquipmentSlotKey,
  offKey: EquipmentSlotKey
) {
  const mainSlot = value[mainKey]
  const offSlot = value[offKey]
  const isTwoHanded = isTwoHandedWeapon(profession, mainSlot?.weaponType)

  function chooseMain(weaponType: string | null): void {
    const newIsTwoHanded = isTwoHandedWeapon(profession, weaponType)
    const itemStatId = mainSlot?.itemStatId ?? null
    const nextMain: EquipmentSlot = { itemStatId, weaponType }
    const nextOff: EquipmentSlot = newIsTwoHanded
      ? { itemStatId, weaponType }
      : isTwoHanded
        ? { itemStatId: null, weaponType: null }
        : (offSlot ?? { itemStatId: null, weaponType: null })
    onChange({ ...value, [mainKey]: nextMain, [offKey]: nextOff })
  }

  function chooseOff(weaponType: string | null): void {
    onChange({ ...value, [offKey]: { itemStatId: offSlot?.itemStatId ?? null, weaponType } })
  }

  return { mainSlot, offSlot, isTwoHanded, chooseMain, chooseOff }
}

/** A single (unpaired) weapon slot's weapon-type setter — underwater sets only, see
 *  `renderUnderwaterSlot`'s doc comment: no hand pairing, every aquatic weapon type is `TwoHand`
 *  but occupies just its own one slot, nothing to mirror. */
export function chooseSingleWeapon(
  value: EquipmentValue,
  onChange: (value: EquipmentValue) => void,
  key: EquipmentSlotKey
): (weaponType: string | null) => void {
  return (weaponType) => onChange({ ...value, [key]: { itemStatId: value[key]?.itemStatId ?? null, weaponType } })
}
