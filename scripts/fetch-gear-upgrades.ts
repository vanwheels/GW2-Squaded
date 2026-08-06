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
  // Legendary-related) — left as-is, out of scope here.
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
 */
function parseAttributeBonusText(raw: string): AttributeBonusText {
  const match = /^\+(\d+(?:\.\d+)?)(%?)\s+(.+)$/.exec(raw.trim())
  if (!match) return { raw, attribute: null, value: null, isPercent: false }
  const [, valueStr, percentSign, attributeRaw] = match
  // Trailing period observed live on at least one sigil description (Superior Sigil of Malice:
  // "+10% condition duration.", lowercase and punctuated unlike every sibling sigil's "+10% Boon
  // Duration" style) — stripped so the attribute-name lookup in attribute-totals.ts's `addBonus`
  // still matches its alias table exactly.
  const attribute = attributeRaw.replace(/\.$/, '')
  return { raw, attribute, value: Number(valueStr), isPercent: percentSign === '%' }
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
    effectName: item.details?.name ?? null,
    durationMs: item.details?.duration_ms ?? null,
    applyCount: item.details?.apply_count ?? null,
    description: effectText ?? item.description ?? '',
    bonuses: effectText ? effectText.split('\n').map(parseAttributeBonusText) : []
  }
}

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
  const relics = relicItems.map(normalizeRelic)
  const food = foodItems.map((i) => normalizeConsumable(i, 'Food'))
  const utility = utilityItems.map((i) => normalizeConsumable(i, 'Utility'))

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
      `relics=${relics.length} food=${food.length} utility=${utility.length} ` +
      `itemStatIcons=${Object.keys(itemStatIcons).length}/${itemStatNames.length} ` +
      `itemStatLegalIds=${itemStatLegalIds.armorWeapon.length}armor/weapon+${itemStatLegalIds.trinket.length}trinket`
  )
  console.log(`Written to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
