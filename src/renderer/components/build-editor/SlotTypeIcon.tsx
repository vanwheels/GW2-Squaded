import type { ReactNode } from 'react'

export type SlotIconKind =
  | 'helm'
  | 'shoulders'
  | 'chest'
  | 'gloves'
  | 'leggings'
  | 'boots'
  | 'back'
  | 'accessory'
  | 'ring'
  | 'amulet'

const PATHS: Record<SlotIconKind, ReactNode> = {
  helm: <path d="M4 13a8 8 0 0 1 16 0v3a2 2 0 0 1-2 2h-1v-3h-2v3h-6v-3H7v3H6a2 2 0 0 1-2-2z" />,
  shoulders: (
    <path d="M2 14c0-3 2-6 5-6h2v3H7a2 2 0 0 0-2 2v3H2zm20 0c0-3-2-6-5-6h-2v3h2a2 2 0 0 1 2 2v3h3zM9 8h6v9H9z" />
  ),
  chest: <path d="M6 4l4 2h4l4-2 2 5-3 2v11H7V11L4 9z" />,
  gloves: (
    <path d="M7 12V5a1.5 1.5 0 0 1 3 0v4M10 9V4a1.5 1.5 0 0 1 3 0v5M13 9V5a1.5 1.5 0 0 1 3 0v6M16 11V8a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6H9a4 4 0 0 1-4-4v-4z" />
  ),
  leggings: <path d="M7 3h10l1 9-2 9h-3l-1-8-1 8H8l-2-9z" />,
  boots: <path d="M9 3h5v9l5 3v3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-4a3 3 0 0 1 3-3h1z" />,
  back: <path d="M12 3c-3 3-6 4-6 9s3 9 6 9 6-4 6-9-3-6-6-9z" />,
  accessory: <path d="M12 3l3 3-3 12-3-12z" />,
  ring: <circle cx="12" cy="12" r="6" />,
  amulet: <path d="M12 3l3 4-3 14-3-14z" />
}

interface Props {
  kind: SlotIconKind
}

/**
 * Small generic silhouette glyphs standing in for each armor/trinket slot type, replacing the
 * inline "Helm"/"Chest"/etc. text label (gw2skills.net convention: an icon reads faster than text
 * repeated down a column). Hand-drawn rather than sourced from the GW2 wiki's own equipment-panel
 * slot icons — the public API has no endpoint for those, and this project only links to wiki/API-
 * hosted image URLs it has directly verified (see docs/game-data.md) — so these are simple,
 * generic line icons instead, not an attempt at pixel-accurate GW2 art.
 */
export function SlotTypeIcon({ kind }: Props) {
  return (
    <svg
      className="gear-slot-type-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[kind]}
    </svg>
  )
}
