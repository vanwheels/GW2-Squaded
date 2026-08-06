import type { MouseEvent as ReactMouseEvent } from 'react'

/**
 * Shared helpers for the Favorites feature (Builds/Squads card grids, food/utility pickers):
 * middle-click toggles favorite status, and favorited entries always sort to the top of their list
 * (ahead of any existing order/name sort, which is preserved within each of the two groups since
 * `Array.prototype.sort` is stable).
 */

/** Stable partition: every item `isFavorite` accepts sorts before every item it doesn't, otherwise
 *  preserving `items`' existing relative order. */
export function sortFavoritesFirst<T>(items: T[], isFavorite: (item: T) => boolean): T[] {
  return [...items].sort((a, b) => Number(isFavorite(b)) - Number(isFavorite(a)))
}

/**
 * Spread onto any clickable element to toggle a favorite via middle-click (mouse button 1).
 * `mousedown` preventDefault blocks Chromium's press-and-drag "autoscroll" cursor that a middle
 * button normally triggers; the actual toggle fires on `auxclick` (the DOM event middle/right
 * clicks dispatch — `click` only ever fires for the primary/left button, so it never fires this).
 */
export function middleClickToggle(onToggle: () => void): {
  onMouseDown: (e: ReactMouseEvent) => void
  onAuxClick: (e: ReactMouseEvent) => void
} {
  return {
    onMouseDown: (e) => {
      if (e.button === 1) e.preventDefault()
    },
    onAuxClick: (e) => {
      if (e.button === 1) {
        e.preventDefault()
        onToggle()
      }
    }
  }
}
