const MIME = 'application/x-gw2squaded-gear-upgrade'

/**
 * Drag payload for the copy/paste feature (2026-07-30): a category tag ("stat"/"rune"/"sigil"/
 * "infusion") plus the dragged item's id. Only same-category drops are accepted — see
 * `UpgradePicker`'s `dragCategory` prop, which is both the source (drag out the chosen value) and
 * the target (drop replaces the chosen value) for every gear-upgrade picker in `EquipmentEditor`.
 */
export interface GearDragPayload {
  category: string
  id: number
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
