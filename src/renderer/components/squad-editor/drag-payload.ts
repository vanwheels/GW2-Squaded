import type { DragEvent } from 'react'

export interface BuildDragPayload {
  buildId: string
  /** `null` when the drag originated from the builds sidebar rather than another slot. */
  sourcePartyIndex: number | null
  sourceSlotIndex: number | null
}

const BUILD_DRAG_MIME = 'application/x-gw2-build-drag'

export function setBuildDragData(e: DragEvent, payload: BuildDragPayload): void {
  e.dataTransfer.setData(BUILD_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'move'
}

/** Returns `null` if the drop didn't carry a build-drag payload (e.g. an unrelated file drop). */
export function readBuildDragData(e: DragEvent): BuildDragPayload | null {
  const raw = e.dataTransfer.getData(BUILD_DRAG_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as BuildDragPayload
  } catch {
    return null
  }
}
