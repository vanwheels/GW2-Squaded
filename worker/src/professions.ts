/** The 9 profession ids, in the same fixed order as `data/game-data/professions.json` in the
 *  main app (`ProfessionId` in `src/shared/types/game-data.ts`) — duplicated as a plain string
 *  list rather than importing that data file, since this Worker never needs anything else about
 *  a profession (icons, skills, specializations) and bundling the full game-data JSON just for 9
 *  names would be wasteful. This IS the list `/buildBoardSetup` uses to create the 9 per-
 *  profession board sections, and the list slash-command `profession` options choose from, so
 *  keep it in sync by hand if a 10th profession is ever added to the game. */
export const PROFESSIONS = [
  'Guardian',
  'Warrior',
  'Engineer',
  'Ranger',
  'Thief',
  'Elementalist',
  'Mesmer',
  'Necromancer',
  'Revenant'
] as const

export type Profession = (typeof PROFESSIONS)[number]

export function isProfession(value: string): value is Profession {
  return (PROFESSIONS as readonly string[]).includes(value)
}

/** `board_messages.category` for the single squad-board message — squads have no natural fixed
 *  taxonomy the way professions do (see docs/discord-bot.md), so there's exactly one category
 *  rather than one per profession. Not a real profession name, just a stable D1 key. */
export const SQUAD_BOARD_CATEGORY = 'squads'
