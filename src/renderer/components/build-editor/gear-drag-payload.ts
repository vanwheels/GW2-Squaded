const MIME = 'application/x-gw2squaded-gear-upgrade'

/**
 * Drag payload for the copy/paste feature (2026-07-30): a category tag ("stat"/"rune"/"sigil"/
 * "infusion") plus the dragged item's id. Only same-category drops are accepted — see
 * `UpgradePicker`'s `dragCategory` prop, which is both the source (drag out the chosen value) and
 * the target (drop replaces the chosen value) for every gear-upgrade picker in `EquipmentEditor`.
 *
 * `name` (2026-08-02) exists because "stat" isn't a single flat id space: a stat-prefix combo's id
 * is category-specific (armor/weapon vs. trinket — see `itemStatCategoryForSlot`), so the same
 * combo name can legitimately mean two different ids depending on which slot it's dropped on. On
 * drop, the target `UpgradePicker` prefers finding this name in its *own* `options` list (which is
 * already scoped to the right category for that slot) over blindly reusing the dragged id — see
 * `UpgradePicker.handleDrop`. Other drag categories (rune/sigil/infusion) don't have this split;
 * `name` is harmless there too since dropping into a same-shaped list finds the identical id back.
 */
export interface GearDragPayload {
  category: string
  id: number
  name?: string
}

export function setGearDragData(e: React.DragEvent, payload: GearDragPayload): void {
  e.dataTransfer.setData(MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

export function readGearDragData(e: React.DragEvent): GearDragPayload | null {
  const raw = e.dataTransfer.getData(MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GearDragPayload
    return typeof parsed.category === 'string' && typeof parsed.id === 'number' ? parsed : null
  } catch {
    return null
  }
}
