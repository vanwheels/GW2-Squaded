/**
 * Strips GW2 API description markup (`<c=@abilitytype>`/`<c=@reminder>` color tags, `<br>`) down
 * to plain, tooltip-displayable text. Present across skill/trait/sigil/relic/food/utility text —
 * broader than an earlier pass here assumed — so this is applied centrally in
 * `TooltipBody` (src/renderer/components/common/Tooltip.tsx) rather than per call site.
 */
export function stripGw2Markup(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()
}

/**
 * The API's `ItemStat.name` uses the possessive form ("Wanderer's", "Berserker's and Valkyrie")
 * matching the item's full in-game name (e.g. "Wanderer's Chestguard") — but this app only ever
 * shows the stat combo name on its own, where the possessive reads oddly ("Wanderer's" with
 * nothing after it). Strips every `'s` in the name (compound combos like "Rabid and Apothecary's"
 * have one per component), not just a trailing one.
 */
export function formatItemStatName(name: string): string {
  return name.replace(/'s\b/g, '')
}
