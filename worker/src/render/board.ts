import type { DiscordMessagePayload } from '../discord/api'
import type { BuildRow, SquadRow } from '../db'

/** Same blue used for both board section kinds — this bot only ever posts board-section messages
 *  and command followups, no branding need for more than one accent color yet. */
const BOARD_EMBED_COLOR = 0x3ea6ff

/** Renders one profession's board section — the message `/buildBoardSetup`/`/buildBoardRebuild`
 *  create and every `/buildAdd`/`/buildEdit`/`/buildRemove`/`/buildMove` re-PATCHes in place.
 *  Builds are numbered by their `sort_order` position so `/buildMove [Build Name] [position]`'s
 *  numeric argument reads directly off what's displayed. */
export function renderBuildSection(profession: string, builds: BuildRow[]): DiscordMessagePayload {
  const description =
    builds.length === 0
      ? '*(no builds yet — add one with `/buildAdd`)*'
      : builds.map((b, i) => `${i + 1}. **${escapeMarkdown(b.name)}**`).join('\n')

  return {
    embeds: [{ title: profession, description, color: BOARD_EMBED_COLOR }]
  }
}

/** Renders the single squad-board message — squads have no per-category sections (see
 *  `SQUAD_BOARD_CATEGORY`'s doc comment), just one add-ordered list. */
export function renderSquadSection(squads: SquadRow[]): DiscordMessagePayload {
  const description =
    squads.length === 0
      ? '*(no squads yet — add one with `/squadAdd`)*'
      : squads.map((s, i) => `${i + 1}. **${escapeMarkdown(s.name)}**`).join('\n')

  return {
    embeds: [{ title: 'Squads', description, color: BOARD_EMBED_COLOR }]
  }
}

/** Discord markdown treats `*_~\`|` as formatting characters — escape them in user-supplied build/
 *  squad names so e.g. a build literally named "Power * Precision" doesn't render as italics. */
function escapeMarkdown(text: string): string {
  return text.replace(/[*_~`|\\]/g, (ch) => `\\${ch}`)
}
