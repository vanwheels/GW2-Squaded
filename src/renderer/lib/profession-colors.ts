import type { ProfessionId } from '@shared/types'

/**
 * Real GW2 profession accent colors — curated 2026-08-18 from the wiki's own "Profession template
 * colors" table (https://wiki.guildwars2.com/wiki/Guild_Wars_2_Wiki:Color_schemes), the same 4-shade
 * set used site-wide for that wiki's own profession-colored infoboxes/templates (`{{g-color}}`,
 * `{{w-color}}`, etc.) — deliberately NOT an invented palette, per the user's explicit request
 * (TODO.md "UI/UX polish", flagged 2026-08-16). `lighter`/`light` are pale tints meant for large fill
 * areas, `medium` is the wiki's primary/most-saturated shade (best default for a small accent like a
 * card outline or a squad-mosaic dot), `dark` is a deeper shade meant for text-on-light-fill use.
 *
 * This intentionally lives in the renderer, not `data/game-data/`: `professions.json` is fully
 * regenerated from the GW2 API by `scripts/fetch-game-data.ts` on every fetch (see that script's
 * `normalizeProfession`), so a hand-curated field added there would get silently wiped the next time
 * it runs — the same failure shape already hit once with `itemstat-icons.json` (see memory). These
 * colors never change with a game patch, so there's no need to route them through the
 * data-update/refresh pipeline (`GAME_DATA_FILE_NAMES`) either — a plain static module is enough.
 */
export interface ProfessionColorSet {
  lighter: string
  light: string
  medium: string
  dark: string
}

export const PROFESSION_COLORS: Record<ProfessionId, ProfessionColorSet> = {
  Guardian: { lighter: '#CFEEFD', light: '#BCE8FD', medium: '#72C1D9', dark: '#186885' },
  Revenant: { lighter: '#EBC9C2', light: '#E4AEA3', medium: '#D16E5A', dark: '#A66356' },
  Warrior: { lighter: '#FFF5BB', light: '#FFF2A4', medium: '#FFD166', dark: '#CAAA2A' },
  Engineer: { lighter: '#E8C89F', light: '#E8BC84', medium: '#D09C59', dark: '#87581D' },
  Ranger: { lighter: '#E2F6D1', light: '#D2F6BC', medium: '#8CDC82', dark: '#67A833' },
  Thief: { lighter: '#E6D5D7', light: '#DEC6C9', medium: '#C08F95', dark: '#974550' },
  Elementalist: { lighter: '#F6D2D1', light: '#F6BEBC', medium: '#F68A87', dark: '#DC423E' },
  Mesmer: { lighter: '#D7B2EA', light: '#D09EEA', medium: '#B679D5', dark: '#69278A' },
  Necromancer: { lighter: '#D5EDE1', light: '#BFE6D0', medium: '#52A76F', dark: '#2C9D5D' }
}

/** The wiki's "Medium" shade — the best default single accent color for a given profession id. */
export function professionAccentColor(id: ProfessionId): string | undefined {
  return PROFESSION_COLORS[id]?.medium
}

/** Full 4-shade set for a given profession id, or `undefined` for an unrecognized id. */
export function professionColorSet(id: ProfessionId): ProfessionColorSet | undefined {
  return PROFESSION_COLORS[id]
}
