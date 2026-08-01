import type { ReactNode } from 'react'

export type SkillBarIconKind = 'cycle' | 'land' | 'water' | 'applyAll'

const PATHS: Record<SkillBarIconKind, ReactNode> = {
  cycle: (
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  land: (
    <>
      <path d="M2 8q3-4 6 0t6 0 6 0 6 0" />
      <path d="M2 13q3-4 6 0t6 0 6 0 6 0" />
      <path d="M2 18q3-4 6 0t6 0 6 0 6 0" />
    </>
  ),
  water: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  applyAll: (
    <>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </>
  )
}

interface Props {
  kind: SkillBarIconKind
}

/**
 * Small control icons for the in-game-style skill bar (see `SkillsEditor`) and, since 2026-08-01,
 * the Equipment panel's environment toggle and "Apply to All" buttons (same tiny-icon-button
 * treatment, reused rather than duplicated): a circular-arrows "cycle" glyph standing in for the
 * game's single weapon-swap key / active-legend toggle (this editor has no live swap key, just an
 * explicit two-state pick), Land/Underwater environment glyphs (rolling ground / a water drop)
 * colored via CSS (`--land-green`/`--water-blue`, applied by the caller's active-state class)
 * rather than a generic muted stroke, since which one is active is otherwise hard to scan at this
 * size, and a plain up-arrow ("applyAll") for bulk-filling every eligible gear slot from one
 * chosen value.
 */
export function SkillBarIcon({ kind }: Props) {
  return (
    <svg
      className="skill-bar-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[kind]}
    </svg>
  )
}
