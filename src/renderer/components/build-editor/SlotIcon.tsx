import type { ReactNode } from 'react'

export type SlotIconType =
  | 'helm'
  | 'shoulders'
  | 'chest'
  | 'gloves'
  | 'leggings'
  | 'boots'
  | 'backpiece'
  | 'accessory'
  | 'ring'
  | 'amulet'
  | 'weapon'

interface Props {
  type: SlotIconType
}

/**
 * The GW2 API's itemstats endpoint (what equipment slots actually store — a stat combo, not a
 * real item) has no icon field, so there's no upstream art for gear slots the way there is for
 * skills/traits. These are small hand-drawn placeholder glyphs standing in for each slot
 * category, styled with currentColor so they follow the surrounding text color.
 */
export function SlotIcon({ type }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {PATHS[type]}
    </svg>
  )
}

const PATHS: Record<SlotIconType, ReactNode> = {
  helm: (
    <path d="M12 3C7.6 3 4 6.6 4 11v4a1 1 0 0 0 1 1h2v-4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4h2a1 1 0 0 0 1-1v-4c0-4.4-3.6-8-8-8Zm-3 13v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2H9Z" />
  ),
  shoulders: (
    <path d="M7 4a4 4 0 0 1 4 4v1H8v3a3 3 0 0 1-3 3H3a1 1 0 0 1-1-1v-2a8 8 0 0 1 5-7.4A4 4 0 0 1 7 4Zm10 0a4 4 0 0 0-4 4v1h3v3a3 3 0 0 0 3 3h2a1 1 0 0 0 1-1v-2a8 8 0 0 0-5-7.4A4 4 0 0 0 17 4Z" />
  ),
  chest: (
    <path d="M8.5 3 5 5.5 3 9l2.2 1.3V20a1 1 0 0 0 1 1h11.6a1 1 0 0 0 1-1v-9.7L21 9l-2-3.5L15.5 3 13 5h-2L8.5 3Z" />
  ),
  gloves: (
    <path d="M8.5 2a1.5 1.5 0 0 1 1.5 1.5V9h1V3a1.5 1.5 0 1 1 3 0v6h1V4.5a1.5 1.5 0 1 1 3 0V11h.5A2.5 2.5 0 0 1 21 13.5V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-4.8L5.4 9.5a1.4 1.4 0 0 1 1.9-2l1.2 1V3.5A1.5 1.5 0 0 1 8.5 2Z" />
  ),
  leggings: <path d="M6.5 2h11l1 8.5-2.2 11.3a1 1 0 0 1-1 .8h-2a1 1 0 0 1-1-.9L11 12l-1.3 9.7a1 1 0 0 1-1 .9h-2a1 1 0 0 1-1-.8L3.5 10.5 6.5 2Z" />,
  boots: (
    <path d="M9 2h5v8.3l4.4 2.6A3 3 0 0 1 20 15.5V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1Z" />
  ),
  backpiece: (
    <path d="M12 2C8.7 2 6 4 6 7v13a1 1 0 0 0 1.4.9L12 19l4.6 1.9A1 1 0 0 0 18 20V7c0-3-2.7-5-6-5Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
  ),
  accessory: <path d="M12 2 4.5 8.5 12 22l7.5-13.5L12 2Zm0 3.2 4.3 3.8h-8.6L12 5.2Z" />,
  ring: <path d="M12 6a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6ZM9 3h6l-1.3 4h-3.4L9 3Z" />,
  amulet: (
    <path d="M4 2.6 9.3 9a5.5 5.5 0 1 1-1.6 1.3L2.4 4Zm16 0-2.4 1.4-5.3 6.3A5.5 5.5 0 1 1 10.7 9L16 2.6ZM12 12a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
  ),
  weapon: (
    <path d="m14.7 2.6 6.7 6.7-2.1 2.1-1.4-1.4-7.6 7.6 1.4 1.4-2.1 2.1-2.8-2.8-2.1 2.1-1.4-1.4 2.1-2.1L2.6 14.3l2.1-2.1 1.4 1.4 7.6-7.6-1.4-1.4 2.1-2.1Z" />
  )
}
