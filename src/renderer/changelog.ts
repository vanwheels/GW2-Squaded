import raw from '../../CHANGELOG.md?raw'

/** CHANGELOG.md's content minus its repo-facing H1 title and intro line (which references
 *  `COMPLETED.md`, an internal dev-log file with no meaning to end users) — just the `## `
 *  version sections, newest first, for in-app display via `ReleaseNotesModal`. */
export const changelogBody: string = (() => {
  const idx = raw.indexOf('\n## ')
  return idx === -1 ? raw : raw.slice(idx + 1)
})()
