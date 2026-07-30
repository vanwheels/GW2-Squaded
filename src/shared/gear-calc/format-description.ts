/**
 * Strips GW2 API description markup down to plain, tooltip-displayable text. Only sigil
 * descriptions carry this (e.g. `"...<br><c=@reminder>(Cooldown: 5 Seconds)</c>"`) — rune/
 * relic/consumable text from the API is already plain, confirmed live when
 * `scripts/fetch-gear-upgrades.ts` was written (see docs/game-data.md).
 */
export function stripGw2Markup(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()
}
