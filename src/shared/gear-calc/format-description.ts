import type { Consumable } from '@shared/types'

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

function formatDurationMs(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}

/**
 * Combines a food/utility consumable's flat attribute bonuses with its buff duration into one
 * tooltip-ready string, mirroring `formatRelicDescription`'s pattern (`relic-effects-format.ts`) —
 * `.tooltip-description` already renders `white-space: pre-line`. Falls back to the raw
 * `description` for consumables with no buff at all (e.g. "Feast" reagents meant to be served to a
 * group rather than eaten directly — see `Consumable`'s doc comment), since `bonuses` is empty and
 * `durationMs` is null for those.
 */
export function formatConsumableDescription(c: Consumable): string {
  if (c.bonuses.length === 0) return c.description
  const lines = c.bonuses.map((b) => b.raw)
  if (c.durationMs !== null) {
    const applySuffix = c.applyCount !== null && c.applyCount > 1 ? ` × ${c.applyCount}` : ''
    lines.push(`Duration: ${formatDurationMs(c.durationMs)}${applySuffix}`)
  }
  return lines.join('\n')
}
