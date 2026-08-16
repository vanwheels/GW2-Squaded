/**
 * Fetches WvW-relevant gear-upgrade and consumable game data (Superior runes, Superior sigils,
 * WvW infusions, relics, food, utility consumables) from the public GW2 API v2 `/v2/items`
 * endpoint and writes normalized JSON to data/game-data/.
 *
 * Unlike scripts/fetch-game-data.ts's endpoints, `/v2/items` has ~74,000 entries and no
 * server-side filter by item subtype — the only way to find "every Superior rune" etc. is to
 * bulk-fetch the full item catalog and filter client-side. Run manually via
 * `npm run fetch-gear-upgrades` (after `fetch-game-data`, no ordering dependency in practice but
 * matches the existing script sequence). See docs/game-data.md.
 *
 * Raw API response shapes are typed loosely and locally in this file only — the normalized,
 * app-facing types live in src/shared/types/game-data.ts and are what gets written to disk.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AttributeBonusText, Consumable, ConsumableKind, Infusion, Relic, Rune, Sigil } from '../src/shared/types/game-data'

const API_BASE = 'https://api.guildwars2.com/v2'
const BATCH_SIZE = 200
const MAX_RETRIES = 5
const BATCH_DELAY_MS = 150

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'data', 'game-data')
// Raw /v2/items dump is ~74k records with no server-side subtype filter, so every tweak to the
// bucketing/normalization logic below would otherwise cost a full multi-minute refetch. Cached
// here (gitignored — see .gitignore) and reused unless --refresh is passed.
const CACHE_FILE = join(__dirname, '..', '.cache', 'items-raw.json')
const FORCE_REFRESH = process.argv.includes('--refresh')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJsonWithRetry<T>(url: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url)
      if (response.status === 429 || response.status >= 500) {
        const backoffMs = 500 * 2 ** attempt
        console.warn(`  [retry] ${response.status} from ${url} — backing off ${backoffMs}ms`)
        await sleep(backoffMs)
        continue
      }
      if (!response.ok) {
        throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`)
      }
      return (await response.json()) as T
    } catch (err) {
      lastError = err
      const backoffMs = 500 * 2 ** attempt
      console.warn(`  [retry] ${String(err)} — backing off ${backoffMs}ms`)
      await sleep(backoffMs)
    }
  }
  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts: ${String(lastError)}`)
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

// --- Raw API shapes (trimmed to the fields we actually consume) -----------------------------

interface RawItem {
  id: number
  name: string
  description?: string
  icon?: string
  type: string
  rarity: string
  /** Top-level acquisition/tradeability flags (e.g. "SoulbindOnAcquire", "NoSell") — distinct from
   *  `details.flags` (upgrade-slot compatibility flags on runes/sigils). Used to disambiguate the
   *  reward-track-bound relic duplicates handled in `dedupeRelicsByName` below. */
  flags?: string[]
  details?: {
    type?: string
    flags?: string[]
    bonuses?: string[]
    infix_upgrade?: {
      buff?: { description?: string }
      attributes?: { attribute: string; modifier: number }[]
    }
    infusion_upgrade_flags?: string[]
    duration_ms?: number
    apply_count?: number
    name?: string
    description?: string
    stat_choices?: number[]
  }
}

async function fetchAllItemsRaw(): Promise<RawItem[]> {
  if (!FORCE_REFRESH) {
    try {
      const cached = JSON.parse(await readFile(CACHE_FILE, 'utf-8')) as RawItem[]
      console.log(`Using cached raw item dump (${cached.length} items) from ${CACHE_FILE} — pass --refresh to refetch.`)
      return cached
    } catch {
      // No cache yet — fall through to a real fetch.
    }
  }

  console.log('Fetching item ids...')
  const ids = await fetchJsonWithRetry<number[]>(`${API_BASE}/items`)
  console.log(`  items: ${ids.length} ids`)

  const batches = chunk(ids, BATCH_SIZE)
  const allItems: RawItem[] = []
  for (const [index, batch] of batches.entries()) {
    const idsParam = batch.join(',')
    const batchItems = await fetchJsonWithRetry<RawItem[]>(`${API_BASE}/items?ids=${idsParam}`)
    allItems.push(...batchItems)
    if (index % 20 === 0 || index === batches.length - 1) {
      console.log(`  items: batch ${index + 1}/${batches.length}`)
    }
    if (index < batches.length - 1) await sleep(BATCH_DELAY_MS)
  }

  await mkdir(dirname(CACHE_FILE), { recursive: true })
  await writeFile(CACHE_FILE, JSON.stringify(allItems))
  console.log(`Cached raw item dump to ${CACHE_FILE}`)
  return allItems
}

// --- Bucket accumulators, filled in as batches stream in --------------------------------------

const runeItems: RawItem[] = []
const sigilItems: RawItem[] = []
const infusionItems: RawItem[] = []
const relicItems: RawItem[] = []
const foodItems: RawItem[] = []
const utilityItems: RawItem[] = []
/** Anything whose name looks like a relic ("Relic of ...") but didn't match the relic filter —
 *  logged so a wrong assumption about the `type`/`details.type` field gets caught, not silently
 *  missed. */
const suspectedRelicMisses: RawItem[] = []
const typeFrequency = new Map<string, number>()
const detailsTypeFrequency = new Map<string, number>()

function bucketItem(item: RawItem): void {
  typeFrequency.set(item.type, (typeFrequency.get(item.type) ?? 0) + 1)
  const detailsType = item.details?.type
  if (detailsType) detailsTypeFrequency.set(detailsType, (detailsTypeFrequency.get(detailsType) ?? 0) + 1)

  // Runes/sigils/relics each exist as a Legendary-rarity duplicate (same name, same effect,
  // reforgeable via legendary crafting) of their Exotic-tier id — confirmed live against the raw
  // item dump (e.g. "Superior Rune of the Afflicted" ids 24687 Exotic / 91460 Legendary). These
  // add no new choice for a theorycraft build, so they're dropped here rather than deduped
  // downstream. Runes/sigils turn out to be exact 1:1 Exotic/Legendary pairs (dropping Legendary
  // leaves zero duplicate names); relics keep ~10 duplicate-name Exotic pairs even after this
  // filter (reward-track-bound variants of the same relic, a separate/preexisting wrinkle, not
  // Legendary-related) — resolved downstream by `dedupeRelicsByName`, since unlike the
  // rune/sigil case both members of a relic pair are Exotic (no rarity field to filter on here).
  if (item.rarity === 'Legendary') return

  if (item.type === 'UpgradeComponent' && detailsType === 'Rune' && item.name.startsWith('Superior Rune of')) {
    runeItems.push(item)
  } else if (item.type === 'UpgradeComponent' && detailsType === 'Sigil' && item.name.startsWith('Superior Sigil of')) {
    sigilItems.push(item)
  } else if (
    item.type === 'UpgradeComponent' &&
    (item.details?.infusion_upgrade_flags?.includes('Infusion') ?? false) &&
    item.name.includes('WvW Infusion')
  ) {
    // Confirmed live 2026-07-29: WvW infusions do NOT have `details.type === 'Infusion'` — that
    // field is `'Default'` for every infusion (WvW and Agony alike, verified against a live
    // Agony infusion item too). `infusion_upgrade_flags` containing `'Infusion'` is what actually
    // marks an item as infusion-slot-compatible; there's no API field distinguishing WvW
    // infusions from Agony ones at all, so the name suffix ("... WvW Infusion") is the only
    // reliable filter — matches the wiki's own naming convention for this item family.
    infusionItems.push(item)
  } else if (item.type === 'Relic' || detailsType === 'Relic') {
    relicItems.push(item)
  } else if (item.type === 'Consumable' && detailsType === 'Food') {
    foodItems.push(item)
  } else if (item.type === 'Consumable' && detailsType === 'Utility') {
    utilityItems.push(item)
  } else if (
    item.type === 'Consumable' &&
    detailsType === 'Generic' &&
    item.name.endsWith('Station') &&
    (item.description ?? '').startsWith('Utility Station:')
  ) {
    // "Sharpening Stone Station" / "Tuning Crystal Station" / "Maintenance Oil Station" etc — the
    // WvW zerg-shared equivalent of the individual Utility items above (place one, anyone nearby
    // can interact for the same buff — the Utility-slot analog of a Food "Feast"). Per the user
    // 2026-08-06: these (not the individually-carried items) are what a majority of WvW players
    // actually use for Food/Utility, since one placed item benefits the whole group. Filed under
    // `details.type: 'Generic'`, not `'Utility'`, for reasons the API doesn't explain — confirmed
    // live against the raw item dump that they otherwise carry the exact same
    // `details.{name,duration_ms,apply_count,description}` shape as an ordinary Utility item, so
    // `normalizeConsumable(item, 'Utility')` handles them identically once bucketed here. Guarded
    // on both the name suffix AND the top-level description prefix (not `detailsType ===
    // 'Generic'` alone) since that bucket also holds ~125 unrelated items — Guild bank boosts,
    // Fractal potions, Mist-attunement potions — that aren't a per-character equipment-slot pick.
    utilityItems.push(item)
  } else if (/^Relic of /.test(item.name)) {
    suspectedRelicMisses.push(item)
  }
}

/**
 * Parses one line of flat attribute-bonus text (e.g. "+25 Power", "+5% Boon Duration") into a
 * structured value. Not every line is a flat attribute bonus — some are unique proc/flavor text
 * with no attribute (e.g. a rune's 6th stage "Gain protection (3s) when you gain fury", or a
 * food's "+10% Experience from Kills") — those fail to parse and keep `raw` only, fail-safe
 * rather than guessed, same philosophy as scripts/fetch-wvw-splits.ts.
 *
 * A second recognized shape (added 2026-08-06): "Gain <target> Equal to N% of Your <source>" —
 * the Superior Sharpening Stone / Tuning Crystal formula, confirmed to be the dominant WvW
 * Utility-consumable shape (~43% of `utility.json`'s catalog; Food has a handful too, mostly
 * seasonal). Parsed into `{attribute: target, value: percent, sourceAttribute: source}` rather
 * than the flat/percent shape above — see `AttributeBonusText`'s doc comment in
 * `src/shared/types/game-data.ts` for how this is resolved (needs the source attribute's *final*
 * value, so it can't be applied in a single pass like an ordinary flat bonus).
 */
function parseAttributeBonusText(raw: string): AttributeBonusText {
  const trimmed = raw.trim()
  const conversionMatch = /^Gain (.+?) Equal to (\d+(?:\.\d+)?)% of Your (.+?)\.?$/.exec(trimmed)
  if (conversionMatch) {
    const [, targetRaw, percentStr, sourceRaw] = conversionMatch
    return { raw, attribute: targetRaw, value: Number(percentStr), isPercent: false, sourceAttribute: sourceRaw }
  }
  const match = /^\+(\d+(?:\.\d+)?)(%?)\s+(.+)$/.exec(trimmed)
  if (!match) return { raw, attribute: null, value: null, isPercent: false, sourceAttribute: null }
  const [, valueStr, percentSign, attributeRaw] = match
  // Trailing period observed live on at least one sigil description (Superior Sigil of Malice:
  // "+10% condition duration.", lowercase and punctuated unlike every sibling sigil's "+10% Boon
  // Duration" style) — stripped so the attribute-name lookup in attribute-totals.ts's `addBonus`
  // still matches its alias table exactly.
  const attribute = attributeRaw.replace(/\.$/, '')
  return { raw, attribute, value: Number(valueStr), isPercent: percentSign === '%', sourceAttribute: null }
}

function normalizeRune(item: RawItem): Rune {
  return {
    id: item.id,
    name: item.name,
    icon: item.icon ?? '',
    bonuses: (item.details?.bonuses ?? []).map(parseAttributeBonusText)
  }
}

function normalizeSigil(item: RawItem): Sigil {
  const description = item.details?.infix_upgrade?.buff?.description ?? ''
  return {
    id: item.id,
    name: item.name,
    icon: item.icon ?? '',
    description,
    weaponTypes: item.details?.flags ?? [],
    // Same line-by-line parse as normalizeConsumable below: most sigil effects are procs/flavor
    // text with no attribute (fail safely to `{attribute: null}`, kept display-only), but a
    // handful of "stat sigils" (e.g. Superior Sigil of Concentration: "+10% Boon Duration") are a
    // flat/percent attribute bonus in the exact same "+N[%] Attribute" shape Rune/Consumable
    // bonus lines use, so they parse the same way with no extra modeling.
    bonuses: description ? description.split('\n').map(parseAttributeBonusText) : []
  }
}

function normalizeInfusion(item: RawItem): Infusion {
  const attr = item.details?.infix_upgrade?.attributes?.[0]
  return {
    id: item.id,
    name: item.name,
    icon: item.icon ?? '',
    description: item.description ?? '',
    attribute: attr?.attribute ?? null,
    value: attr?.modifier ?? null
  }
}

function normalizeRelic(item: RawItem): Relic {
  return {
    id: item.id,
    name: item.name,
    icon: item.icon ?? '',
    description: item.description ?? ''
  }
}

/**
 * Collapses the ~10 duplicate-name relic pairs (see the `bucketItem` comment above) down to one
 * item id per relic name. Confirmed live 2026-08-16 against every pair: same icon/description
 * (mechanically identical), differing only in top-level acquisition flags — one member carries
 * just `SoulBindOnUse` (openly tradeable/craftable), the other adds `SoulbindOnAcquire`,
 * `NoSell`, `NoMysticForge`, `NoSalvage` (a reward-track/vendor-bound copy of the same relic).
 * Keeps the more openly-obtainable member (no `SoulbindOnAcquire`) so the picker shows each relic
 * exactly once; falls back to the lowest id if neither/both members match (keeps the function safe
 * against a future pair that doesn't follow this exact flag pattern).
 */
function dedupeRelicsByName(items: RawItem[]): RawItem[] {
  const byName = new Map<string, RawItem[]>()
  for (const item of items) {
    const group = byName.get(item.name)
    if (group) group.push(item)
    else byName.set(item.name, [item])
  }
  return [...byName.values()].map((group) => {
    if (group.length === 1) return group[0]
    const openlyObtainable = group.filter((i) => !(i.flags ?? []).includes('SoulbindOnAcquire'))
    const candidates = openlyObtainable.length === 1 ? openlyObtainable : group
    return candidates.reduce((lowest, i) => (i.id < lowest.id ? i : lowest))
  })
}

function normalizeConsumable(item: RawItem, kind: ConsumableKind): Consumable {
  // A consumable's actual buff (if it grants one at all — some Food entries are "Feast" reagents
  // with no direct-use buff) lives at details.{name,duration_ms,apply_count,description}, not the
  // item's own top-level `description` (that's flavor/usage text, e.g. "Double-click to serve...").
  const effectText = item.details?.description
  return {
    id: item.id,
    name: item.name,
    icon: item.icon ?? '',
    kind,
    rarity: item.rarity,
    effectName: item.details?.name ?? null,
    durationMs: item.details?.duration_ms ?? null,
    applyCount: item.details?.apply_count ?? null,
    description: effectText ?? item.description ?? '',
    bonuses: effectText ? effectText.split('\n').map(parseAttributeBonusText) : [],
    sharedBuffSource: null
  }
}

/**
 * Container word a shared Food item's own buff-less name is prefixed with — "Feast of X(s)",
 * "Tray of X(s)", "Pot of X", "Giant X Cake", etc. Order doesn't matter (a name starts with at
 * most one of these). See `Consumable.sharedBuffSource`'s doc comment for why this exists.
 */
const SHARED_CONTAINER_PREFIXES = ['Feast of ', 'Tray of ', 'Pot of ', 'Plate of ', 'Pile of ', 'Giant ', 'Complete ', 'Bottle of ']

/** Container word the matching *individually-eaten* item might itself be prefixed with — tried in
 *  this priority order (empty string, i.e. no prefix at all, first) alongside the bare de-prefixed
 *  name when resolving a shared item's match. `Filet of `/`Loaf of ` added 2026-08-15: confirmed
 *  live that 9 "Feast of .../Tray of ..." items DO have a real buffed sibling under one of these
 *  two prefixes (e.g. "Filet of Rosemary-Roasted Meat", "Loaf of Banana Bread") that the original
 *  list simply didn't try — 0 new ambiguous matches introduced across the rest of the catalog. */
const INDIVIDUAL_CONTAINER_PREFIXES = [
  '',
  'Bowl of ',
  'Plate of ',
  'Cup of ',
  'Mug of ',
  'Demitasse of ',
  'Slice of ',
  'Piece of ',
  'Filet of ',
  'Loaf of '
]

/** `word` re-singularized, every plausible way — "Cookies" -> "Cookie"/"Cooky" (only one is ever a
 *  real word; whichever one is an existing item's name wins), "Pizzas" -> "Pizza", "Salad" (already
 *  singular, e.g. an uncountable dish name) -> unchanged. Deliberately over-generates rather than
 *  picking one rule, since English pluralization is ambiguous from the suffix alone (a plain
 *  "s"-strip is right far more often than the "-ies"->"-y" pattern, but both are tried and the
 *  candidate-matching in `borrowSharedContainerBonuses` below is what actually decides). */
function singularCandidates(word: string): Set<string> {
  const out = new Set([word])
  if (/s$/.test(word)) out.add(word.slice(0, -1))
  if (/ies$/.test(word)) out.add(`${word.slice(0, -3)}y`)
  return out
}

/**
 * For a shared Food item's name (e.g. "Feast of Rare Veggie Pizzas"), every plausible name for the
 * individually-eaten item it might share a buff with ("Rare Veggie Pizza", "Bowl of Rare Veggie
 * Pizzas", "Bowl of Rare Veggie Pizza", ... — every `INDIVIDUAL_CONTAINER_PREFIXES` entry crossed
 * with every `singularCandidates` form of the last word). Over-generation is intentional and safe:
 * `borrowSharedContainerBonuses` only actually borrows when EXACTLY ONE candidate matches a real
 * buffed item's name — any candidate that doesn't exist in the catalog is simply never looked up.
 */
function candidateSourceNames(sharedName: string): Set<string> {
  const candidates = new Set<string>()
  for (const prefix of SHARED_CONTAINER_PREFIXES) {
    if (!sharedName.startsWith(prefix)) continue
    const rest = sharedName.slice(prefix.length)
    const words = rest.split(' ')
    const last = words[words.length - 1]
    for (const lastSingular of singularCandidates(last)) {
      const restSingular = [...words.slice(0, -1), lastSingular].join(' ')
      for (const individualPrefix of INDIVIDUAL_CONTAINER_PREFIXES) candidates.add(individualPrefix + restSingular)
    }
  }
  return candidates
}

/**
 * Resolves `Consumable.sharedBuffSource` for every buff-less Food item by borrowing a matching
 * individually-eaten item's `bonuses` (see that field's doc comment for why this is correct, not
 * guessed — confirmed via the wiki's own "provides same effect as X" phrasing on several sampled
 * items 2026-08-06). Only applied on an UNAMBIGUOUS match (exactly one `candidateSourceNames`
 * candidate exists as a real buffed item's name) — confirmed live this session that all 174 actual
 * matches in the current catalog are unambiguous (zero collisions), so "leave unmatched rather than
 * guess between 2+ candidates" costs nothing here, but is kept as a safety rail against a future
 * patch introducing a genuine naming collision. ~144 Food entries stay unmatched after this — a mix
 * of Mastery-point currency items, achievement/collection rewards, and a distinct "Ascended Gourmet
 * Feast" tier (e.g. Cilantro Lime Sous-Vide Steak) that IS a real stat-granting shared item but has
 * no separate individually-eaten sibling to borrow from at all — see TODO.md.
 */
function borrowSharedContainerBonuses(items: Consumable[]): void {
  const buffedByName = new Map(items.filter((i) => i.effectName !== null).map((i) => [i.name, i]))
  for (const item of items) {
    if (item.effectName !== null) continue
    const matches = [...candidateSourceNames(item.name)].filter((name) => buffedByName.has(name))
    if (matches.length !== 1) continue
    const source = buffedByName.get(matches[0])!
    item.effectName = source.effectName
    item.bonuses = source.bonuses
    item.sharedBuffSource = source.name
  }
}

/**
 * "Ascended Gourmet Feast" tier consumables (Chef rank 500 + the Gourmet Training collection) — the
 * one Food family `borrowSharedContainerBonuses` above can't resolve, because unlike "Feast of X"/
 * "Tray of X" it has no individually-eaten sibling to borrow from at all: confirmed live 2026-08-06
 * that even a sampled "same stats as" item named on the wiki (e.g. "Bowl of Mists-Infused Fruit
 * Salad with Mint Garnish") comes back with an equally empty `details: {type: 'Food'}` in the raw
 * item dump. Every one of the 68 confirmed live follows a fixed formula per the wiki's "Ascended
 * feast" page, cross-checked against several individual items' own raw wikitext (not a rendered/
 * summarized table, per [[healing_damage_coefficient_curation]]'s lesson): a "food type" (from the
 * recipe's base ingredient, e.g. "Sous-Vide Steak") fixes a major/minor attribute pair, and a
 * "herb" (from the recipe's cultivated herb, e.g. "Mint") fixes one more bonus effect — both
 * reliably identifiable from the item's own name. End of Dragons added 5 more that swap the herb
 * slot for a flat "+150 Fishing Power" bonus instead. A few names don't spell out their food-type/
 * herb word literally ("Salsa" = Cilantro, "Spiced"/"Peppered" = Peppercorn) — each confirmed via
 * that specific item's own raw wikitext bonus list matching the herb's known effect (not guessed
 * from the name alone). Gated on the item's own `Gourmet Feast:` flavor-text prefix (verified to
 * match all and only these 68) so this can never misfire on an unrelated item that happens to share
 * a food-type/herb keyword.
 */
const ASCENDED_FEAST_TYPE_LINES: Record<string, string[]> = {
  'Beef Carpaccio': ['+100 Concentration', '+70 Power'],
  'Coq Au Vin': ['+100 Power', '+70 Precision'],
  'Creme Brulee': ['+100 Concentration', '+70 Healing'],
  'Cured Meat Flatbread': ['+100 Condition Damage', '+70 Expertise'],
  'Eggs Benedict': ['+100 Concentration', '+70 Expertise'],
  'Fruit Salad': ['+100 Healing', '+70 Concentration'],
  'Poultry Aspic': ['+100 Concentration', '+70 Toughness'],
  'Sous-Vide Steak': ['+100 Power', '+70 Ferocity'],
  'Veggie Flatbread': ['+100 Expertise', '+70 Condition Damage']
}

/** `Truffle Ravioli`/`Oyster Soup`/`Cheesecake` food types don't reduce to a clean name substring
 *  (Ravioli names read "Clear Truffle and X Ravioli"; Cheesecake's minor slot is proc text, not a
 *  flat attribute; Oyster Soup has no minor slot at all) — handled ahead of the generic table. */
function ascendedFeastTypeLines(name: string): string[] | null {
  if (name.includes('Truffle') && name.includes('Ravioli')) return ['+100 Vitality', '+70 Toughness']
  if (name.includes('Oyster Soup')) return ['+45 to All Attributes']
  if (name.includes('Cheesecake')) return ['+100 Concentration', '33% Chance to Gain Might on Critical Hit']
  for (const [type, lines] of Object.entries(ASCENDED_FEAST_TYPE_LINES)) if (name.includes(type)) return lines
  return null
}

const ASCENDED_FEAST_HERB_LINES: Record<string, string> = {
  Cilantro: '66% Chance to Steal Life on Critical Hit',
  Clove: '-20% Incoming Condition Duration',
  Mint: '+10% Outgoing Healing',
  Peppercorn: '-10% Incoming Damage',
  Sesame: 'Gain Health Every Second'
}

function ascendedFeastHerbLine(name: string): string | null {
  for (const [herb, line] of Object.entries(ASCENDED_FEAST_HERB_LINES)) if (name.includes(herb)) return line
  if (name.includes('Salsa')) return ASCENDED_FEAST_HERB_LINES.Cilantro
  if (name.includes('Spiced') || name.includes('Peppered')) return ASCENDED_FEAST_HERB_LINES.Peppercorn
  return null
}

/** The 5 End of Dragons ascended feasts: same major/minor pair as their closest core food type
 *  (matching the dish each is themed after), with `+150 Fishing Power` in the herb bonus's place —
 *  confirmed individually via each item's own raw wikitext, not inferred from the food-type table. */
const ASCENDED_FEAST_EOD_LINES: Record<string, string[]> = {
  'Bowl of Echovald Hotpot': ['+150 Fishing Power', '+100 Condition Damage', '+70 Expertise'],
  'Bowl of Jade Sea Bounty': ['+150 Fishing Power', '+100 Power', '+70 Ferocity'],
  'Flight of Sushi': ['+150 Fishing Power', '+45 to All Attributes'],
  'Plate of Imperial Palace Special': ['+150 Fishing Power', '+100 Healing', '+70 Concentration'],
  'Plate of Crispy Fish Pancakes': ['+150 Fishing Power', '+100 Vitality', '+70 Toughness']
}

/** Every Ascended feast, core or End of Dragons, additionally grants these 5 — confirmed identical
 *  and in this exact order across every raw-wikitext sample fetched. */
const ASCENDED_FEAST_UNIVERSAL_LINES = ['+10% Karma', '+5% All Experience Gained', '+20% Magic Find', '+20% Gold Find', '+10% WXP Gained']

/** Fills in `bonuses`/`effectName`/`durationMs` for the 68 Ascended Gourmet Feast items described
 *  above. Must run after `borrowSharedContainerBonuses` (only touches items that fix left
 *  buffless) but doesn't depend on it. */
function applyAscendedFeastFormula(items: Consumable[]): void {
  for (const item of items) {
    if (item.effectName !== null) continue
    if (!item.description.startsWith('Gourmet Feast:')) continue
    const eodLines = ASCENDED_FEAST_EOD_LINES[item.name]
    const typeLines = eodLines ?? ascendedFeastTypeLines(item.name)
    const herbLine = eodLines ? null : ascendedFeastHerbLine(item.name)
    if (!typeLines || (!eodLines && !herbLine)) continue
    const lines = [...(herbLine ? [herbLine] : []), ...typeLines, ...ASCENDED_FEAST_UNIVERSAL_LINES]
    item.effectName = 'Nourishment'
    item.durationMs = 3_600_000
    item.applyCount = 1
    item.bonuses = lines.map(parseAttributeBonusText)
    item.description = lines.join('\n')
  }
}

/**
 * Individual buff data for real, purchasable/craftable Food items whose `details` object comes
 * back completely empty from the API — the same "buff data not exposed" shape as the Ascended
 * Gourmet Feast family above, just not gated behind a `Gourmet Feast:` prefix or a clean
 * type/herb formula, so each needed its own wiki lookup. Curated 2026-08-15 from each item's own
 * raw wikitext `{{nourishment|duration|bonus lines}}` template (not a rendered/summarized table,
 * per [[healing_damage_coefficient_curation]]'s lesson) — confirmed these are real Desert
 * Highlands (PoF)/Domain of Kourna (LWS5) recipes, not the ~48 karma/Mastery-currency/crafting-
 * material/tonic items also found buffless in the same sweep (see `EXCLUDED_FOOD_IDS` below,
 * which is the disjoint "genuinely not a food pick" half of this same investigation).
 *
 * A few borrow their line-for-line bonus text from a sibling instead of duplicating a wiki
 * lookup, per that sibling's own wiki Notes section: Pitcher of Desert-Spiced Coffee/Mocha of the
 * Mists Coffee Pitcher both explicitly "grant the same effect as Cup of Light-Roasted Coffee" (id
 * 82642) just for a shorter 20-minute duration (not the usual "shared version lasts longer"
 * pattern — confirmed via each item's own Notes, not assumed); Feast of Carne Khan Chili grants
 * Bowl of Carne Khan Chili's (id 91954) effect for 1 hour; Feast of Dill Meatball Dinners (whose
 * own in-game display name is actually "Feast of Krytan Meatball Dinners", see its `description`)
 * grants "Bowl of Krytan Meatball Dinner"'s effect (already resolved elsewhere in the catalog via
 * `borrowSharedContainerBonuses`, so reproduced here directly) for 1 hour.
 */
const CURATED_FOOD_BUFFS: Record<number, { durationMs: number; bonuses: string[] }> = {
  // Feast of Dill Meatball Dinners
  12609: { durationMs: 3_600_000, bonuses: ['+50 Toughness', '+40 Precision', '+10% Experience from Kills'] },
  // Bowl of "Elon Red"
  82541: { durationMs: 1_800_000, bonuses: ['+100 Expertise', '+70 Toughness', '+1% All Experience Gained'] },
  // Cup of Light-Roasted Coffee
  82642: {
    durationMs: 1_800_000,
    bonuses: ['Gain 5 Seconds of Quickness on Dismount (Cooldown: 20 Seconds)', '+70 Precision', '+10% Karma', '+1% All Experience Gained']
  },
  // Red Lentil and Flatbread Feast
  82657: { durationMs: 3_600_000, bonuses: ['-15% Incoming Condition Duration', '+45 to All Attributes', '+1% All Experience Gained'] },
  // Bowl of Spiced Red Lentil Stew
  83345: {
    durationMs: 1_800_000,
    bonuses: ['Lose a Condition on Successful Evade (Cooldown: 10 Seconds)', '+70 Toughness', '+1% All Experience Gained']
  },
  // Pitcher of Desert-Spiced Coffee — see doc comment above
  83545: {
    durationMs: 1_200_000,
    bonuses: ['Gain 5 Seconds of Quickness on Dismount (Cooldown: 20 Seconds)', '+70 Precision', '+10% Karma', '+1% All Experience Gained']
  },
  // Plate of Sugar Rib Roast
  83622: {
    durationMs: 1_800_000,
    bonuses: [
      '25% Chance on Critical Hit to Inflict Chill (1 Second), Burning (2 Seconds), and Poison (3 Seconds) (Cooldown: 20 Seconds)',
      '+70 Condition Damage',
      '+1% All Experience Gained'
    ]
  },
  // Bowl of Red Lentil Soup
  83955: { durationMs: 1_800_000, bonuses: ['Gain Health Every Second', '+70 Condition Damage', '+1% All Experience Gained'] },
  // Red-Lentil Saobosa
  84550: { durationMs: 1_800_000, bonuses: ['+100 Expertise', '+70 Condition Damage', '+1% All Experience Gained'] },
  // Chef's Tasting Platter
  91689: {
    durationMs: 1_800_000,
    bonuses: ['+80 Power for 30 Seconds on Kill', '+50 Precision', '+50 Condition Damage', '+30% Magic Find', '+10% Experience from Kills']
  },
  // Plate of Eggs Benedict
  91842: { durationMs: 1_800_000, bonuses: ['+100 Concentration', '+70 Expertise', '+10% Experience from Kills'] },
  // Plate of Spicy Moa Wings
  91917: {
    durationMs: 1_800_000,
    bonuses: ['+100 Power', '+70 Ferocity', '+1% All Experience Gained', 'May Cause Intermittent Gastric Distress']
  },
  // Feast of Carne Khan Chili — see doc comment above
  91943: { durationMs: 3_600_000, bonuses: ['+100 Concentration', '+70 Expertise', '+1% All Experience Gained'] },
  // Bowl of Firebreather Chili
  91950: {
    durationMs: 1_800_000,
    bonuses: ['+100 Concentration', '+70 Expertise', '+1% All Experience Gained', 'May Cause Intermittent Gastric Distress']
  },
  // Bowl of Carne Khan Chili
  91954: { durationMs: 1_800_000, bonuses: ['+100 Concentration', '+70 Expertise', '+1% All Experience Gained'] },
  // Bowl of Green Chile Ice Cream
  92078: { durationMs: 1_800_000, bonuses: ['+100 Concentration', '+70 Expertise', '+10% Karma Gained'] },
  // Tray of Decade Desserts
  98924: {
    durationMs: 7_200_000,
    bonuses: ['+3% to All Attributes', '+10% Magic Find', '+10% Gold from Monsters', '+10% Karma', '+10% Experience from Kills']
  },
  // Mocha of the Mists Coffee Pitcher — see doc comment above
  99379: {
    durationMs: 1_200_000,
    bonuses: ['Gain 5 Seconds of Quickness on Dismount (Cooldown: 20 Seconds)', '+70 Precision', '+10% Karma', '+1% All Experience Gained']
  }
}

/** Fills in `bonuses`/`effectName`/`durationMs` from `CURATED_FOOD_BUFFS` above. Must run after
 *  `borrowSharedContainerBonuses`/`applyAscendedFeastFormula` (only touches items still buffless)
 *  but doesn't depend on either. */
function applyCuratedFoodBuffs(items: Consumable[]): void {
  for (const item of items) {
    if (item.effectName !== null) continue
    const curated = CURATED_FOOD_BUFFS[item.id]
    if (!curated) continue
    item.effectName = 'Nourishment'
    item.durationMs = curated.durationMs
    item.applyCount = 1
    item.bonuses = curated.bonuses.map(parseAttributeBonusText)
    item.description = curated.bonuses.join('\n')
  }
}

/**
 * Food-typed items confirmed, individually, to NOT be a real food buff pick — the disjoint
 * "genuinely not food" half of the same buffless-Food investigation `CURATED_FOOD_BUFFS` above
 * resolves the other half of. The GW2 API buckets all of these as `Consumable`/`details.type:
 * 'Food'` same as real food (so that field alone can't filter them), but each is confirmed via
 * its own wiki page and/or raw item `description` to be one of:
 *  - Mastery-point currency ("Elixir/Draught of X Mastery", "Threat Report: ...") or karma
 *    currency ("Snowglobe" and 4 siblings — Wintersday Gauntlet rewards, "Wish for
 *    Freedom"/"Wish For Truth", "Debbie's Cake") — the item's own `description` says "Grants ...
 *    karma"/"... Mastery experience" outright.
 *  - Home-instance/crafting material delivery ("Gift of Quartz" and its Candy Corn siblings,
 *    "Offering to Koda"/"Offering Basket", "Light of Deldrimor Plate" halves, "Ectoplasm-Infused
 *    Vision Crystal") — `description` says "Double-click to have/grow/upgrade/present/combine...".
 *  - Transformation tonics ("Golem Swarm Potion"/"Pulsating Crystal", both flagged `Tonic`;
 *    "Unstable Branded Awakened Wind-Up", confirmed via its own wiki page to be a `Bundle`-type
 *    toy, not a Nourishment food).
 *  - Achievement/collection-only fodder ("Jungle Wurm Omelet (Mossman Style)", whose own
 *    description says "This item only has value as part of a collection").
 *  - "Bottle of Spider Brew" — wiki confirms `type = alcohol` (Brewmaster collection), not food.
 *  - "Pile of Golden/Pink Sand" — wiki confirms outright: "Consuming/Using this item doesn't seem
 *    to do anything."
 *  - "Magic-Imbued Peach" — wiki confirms its "Blessing of the Harvest Forest" buff is removed on
 *    leaving the Lake Doric map, making it unusable as a general WvW/PvE build pick.
 *  - "Candy Cane" — wiki confirms a real "Minty Breath" effect, but it's explicitly NOT a
 *    Nourishment (stacks with real food rather than occupying the Food slot, per its own wiki
 *    Notes) and grants only a non-combat "+10% Karma Bonus" — outside this app's Food-slot model
 *    and not worth adding a one-off mechanic for.
 *  - The 8-item "Bloodstone" joke-food family (Bowl of Bloodstone Ice Cream and 7 siblings, all
 *    from the "Seimur Was Wrong"/Rata Sum vendor gag) — each individually confirmed via its own
 *    wiki page to deal real damage to the player on consumption before granting, at best, a
 *    trivial non-combat "+5% Karma"/"+5% Experience" for 30 minutes (one, Demitasse of Bloodstone
 *    Espresso, grants no lasting buff at all; another, Bowl of Bloodstone Bisque, has an entirely
 *    different achievement-puzzle-only mechanic) — none grant a combat-relevant attribute, so none
 *    belong in a build-planning Food picker.
 */
const EXCLUDED_FOOD_IDS = new Set<number>([
  8602, 43902, 48804, 68404, 68405, 68407, 68408, 68409, 68410, 68411, 70628, 71176, 74065, 77586, 77616, 77620, 77631, 77633, 77651,
  78005, 79646, 79729, 79848, 80272, 82531, 83171, 83389, 83591, 83613, 87631, 88101, 88330, 88573, 88973, 89692, 89828, 93992, 94454,
  94457, 94459, 95283, 95286, 95290, 95294, 98929, 106982, 107031, 107063
])

const INSIGNIA_SUFFIX = ' Insignia'

/**
 * A per-stat-combo icon for the equipment editor's stat picker (e.g. "Berserker's", "Wanderer's")
 * — `/v2/itemstats` itself has no icon field (it's an abstract attribute combo, not a real item),
 * but every stat name IS also the prefix of a real craftable "<Stat> <material> Insignia" light-
 * armor item, which does have an icon. Confirmed live 2026-07-30: 181 distinct icons across 199
 * non-recipe Insignia items — i.e. real per-stat art, not one generic icon reused everywhere.
 * Picks the Exotic-tier insignia when one exists (matching this app's existing ascended/exotic
 * assumption elsewhere), else the lowest-id match, for a single deterministic icon per stat name —
 * this is a stand-in glyph for the stat combo, not a claim that the build actually equips that
 * specific insignia (compound/legacy stat names with no matching insignia, e.g. "Dire and Rabid",
 * simply get no icon — fail-safe, not guessed).
 */
function deriveItemStatIcons(allItems: RawItem[], itemStatNames: string[]): Record<string, string> {
  const insignias = allItems.filter(
    (item) => item.rarity !== 'Legendary' && !item.name.startsWith('Recipe:') && item.name.endsWith(INSIGNIA_SUFFIX)
  )
  const icons: Record<string, string> = {}
  for (const name of itemStatNames) {
    if (name.trim() === '') continue
    const matches = insignias.filter((item) => item.name.startsWith(`${name} `))
    if (matches.length === 0) continue
    const preferred = matches.find((item) => item.rarity === 'Exotic') ?? [...matches].sort((a, b) => a.id - b.id)[0]
    if (preferred.icon) icons[name] = preferred.icon
  }
  return icons
}

/**
 * Which `ItemStat.id`s are actually current/obtainable, split by equipment category — `itemstats`
 * itself carries no such flag (see `ItemStatLegalIds` doc comment in game-data.ts), but every
 * Legendary item's `details.stat_choices` (the Legendary Armory stat-selector list) is exactly
 * that legality signal, straight from the API. Confirmed live 2026-08-01: every Legendary armor
 * item and every Legendary weapon share one identical 38-id list; every Legendary trinket (back/
 * ring/accessory/amulet) shares a separate, entirely disjoint 43-id list — so armor and weapons
 * pool together, trinkets pool separately, and taking the union across all Legendary items per
 * category (rather than trusting a single sample) guards against any category having a variant
 * item with a slightly different list.
 */
function deriveLegalItemStatIds(allItems: RawItem[]): { armorWeapon: number[]; trinket: number[] } {
  const armorWeapon = new Set<number>()
  const trinket = new Set<number>()
  for (const item of allItems) {
    if (item.rarity !== 'Legendary' || !item.details?.stat_choices) continue
    const bucket = item.type === 'Armor' || item.type === 'Weapon' ? armorWeapon : item.type === 'Back' || item.type === 'Trinket' ? trinket : null
    if (!bucket) continue
    for (const id of item.details.stat_choices) bucket.add(id)
  }
  return { armorWeapon: [...armorWeapon].sort((a, b) => a - b), trinket: [...trinket].sort((a, b) => a - b) }
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true })

  const allItems = await fetchAllItemsRaw()
  for (const item of allItems) bucketItem(item)

  console.log('\nRaw type frequency (top-level `type`):')
  console.log([...typeFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15))
  console.log('\nRaw details.type frequency:')
  console.log([...detailsTypeFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20))

  if (suspectedRelicMisses.length > 0) {
    console.warn(
      `\n[warn] ${suspectedRelicMisses.length} items named "Relic of ..." did NOT match the relic filter — ` +
        'the relic type-detection assumption may be wrong. Sample:',
      suspectedRelicMisses.slice(0, 3).map((i) => ({ id: i.id, name: i.name, type: i.type, detailsType: i.details?.type }))
    )
  }

  const runes = runeItems.map(normalizeRune)
  const sigils = sigilItems.map(normalizeSigil)
  const infusions = infusionItems.map(normalizeInfusion)
  const relics = dedupeRelicsByName(relicItems).map(normalizeRelic)
  const utility = utilityItems.map((i) => normalizeConsumable(i, 'Utility'))
  // Utility "Station" items (bucketed into utilityItems above) already carry their own full buff
  // data — only Food's "Feast"/"Tray"/"Pot" items need bonus-borrowing (see
  // `Consumable.sharedBuffSource`'s doc comment).
  let food = foodItems.map((i) => normalizeConsumable(i, 'Food'))
  borrowSharedContainerBonuses(food)
  // Ascended Gourmet Feasts have no sibling to borrow from at all (see `applyAscendedFeastFormula`'s
  // doc comment) — resolved separately, after borrowing, since it only touches items still buffless.
  applyAscendedFeastFormula(food)
  // Individually wiki-curated real food (see `CURATED_FOOD_BUFFS` doc comment) — also only touches
  // items still buffless, so ordering relative to the two calls above doesn't matter.
  applyCuratedFoodBuffs(food)
  // Drop the disjoint "confirmed genuinely not food" half of the same investigation (see
  // `EXCLUDED_FOOD_IDS` doc comment) rather than leaving them in the catalog buffless.
  const foodBeforeExclusion = food.length
  food = food.filter((f) => !EXCLUDED_FOOD_IDS.has(f.id))
  const stillBuffless = food.filter((f) => f.effectName === null)
  if (stillBuffless.length > 0) {
    console.warn(
      `\n[warn] ${stillBuffless.length} Food entries are still buffless after borrowing+curation+exclusion — ` +
        'a future API patch may have added new ones; sample:',
      stillBuffless.slice(0, 10).map((f) => ({ id: f.id, name: f.name }))
    )
  }

  const itemStats = JSON.parse(await readFile(join(OUTPUT_DIR, 'itemstats.json'), 'utf-8')) as { name: string }[]
  const itemStatNames = [...new Set(itemStats.map((s) => s.name))]
  const itemStatIcons = deriveItemStatIcons(allItems, itemStatNames)
  const namesWithoutIcon = itemStatNames.filter((n) => n.trim() !== '' && !(n in itemStatIcons))
  if (namesWithoutIcon.length > 0) {
    console.warn(`\n[warn] ${namesWithoutIcon.length}/${itemStatNames.length} stat names got no insignia-derived icon:`, namesWithoutIcon)
  }

  const itemStatLegalIds = deriveLegalItemStatIds(allItems)
  if (itemStatLegalIds.armorWeapon.length === 0 || itemStatLegalIds.trinket.length === 0) {
    console.warn('\n[warn] found no Legendary-item stat_choices for one or both categories — legality data may be stale/wrong:', itemStatLegalIds)
  }

  await Promise.all([
    writeFile(join(OUTPUT_DIR, 'runes.json'), JSON.stringify(runes, null, 2)),
    writeFile(join(OUTPUT_DIR, 'sigils.json'), JSON.stringify(sigils, null, 2)),
    writeFile(join(OUTPUT_DIR, 'infusions.json'), JSON.stringify(infusions, null, 2)),
    writeFile(join(OUTPUT_DIR, 'relics.json'), JSON.stringify(relics, null, 2)),
    writeFile(join(OUTPUT_DIR, 'food.json'), JSON.stringify(food, null, 2)),
    writeFile(join(OUTPUT_DIR, 'utility.json'), JSON.stringify(utility, null, 2)),
    writeFile(join(OUTPUT_DIR, 'itemstat-icons.json'), JSON.stringify(itemStatIcons, null, 2)),
    writeFile(join(OUTPUT_DIR, 'itemstat-legal-ids.json'), JSON.stringify(itemStatLegalIds, null, 2))
  ])

  console.log(
    `\nDone. runes=${runes.length} sigils=${sigils.length} infusions=${infusions.length} ` +
      `relics=${relics.length} food=${food.length} (${foodBeforeExclusion - food.length} excluded non-food) utility=${utility.length} ` +
      `itemStatIcons=${Object.keys(itemStatIcons).length}/${itemStatNames.length} ` +
      `itemStatLegalIds=${itemStatLegalIds.armorWeapon.length}armor/weapon+${itemStatLegalIds.trinket.length}trinket`
  )
  console.log(`Written to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
