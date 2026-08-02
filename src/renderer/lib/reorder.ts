/** Anything with a stable id and a drag-orderable `Build.order`/`SquadComp.order`-shaped field. */
export interface Orderable {
  id: string
  order: number
}

export function sortByOrder<T extends Orderable>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order)
}

/**
 * A sort value that sits strictly between `before` and `after` (or just outside whichever one is
 * missing, for a drop at either end of the list). Picking a single midpoint value lets a drag
 * only ever touch the moved record's own `order` — every other record keeps its existing value,
 * so reordering one card never bumps anyone else's `updatedAt`.
 */
export function computeOrderBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 0
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

/**
 * The `order` value that places `draggedId` immediately before `beforeId` within `items`' current
 * order (or at the end, if `beforeId` is `null` — e.g. dropped past the last card).
 */
export function reorderBefore<T extends Orderable>(items: T[], draggedId: string, beforeId: string | null): number {
  const siblings = sortByOrder(items).filter((item) => item.id !== draggedId)
  const targetIndex = beforeId === null ? siblings.length : siblings.findIndex((item) => item.id === beforeId)
  const before = siblings[targetIndex - 1]?.order
  const after = beforeId === null ? undefined : siblings[targetIndex]?.order
  return computeOrderBetween(before, after)
}
