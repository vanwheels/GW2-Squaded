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
  const [, valueStr, percentSign, attribute] = match
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
  return {
    id: item.id,
    name: item.name,
    icon: item.icon ?? '',
    description: item.details?.infix_upgrade?.buff?.description ?? '',
    weaponTypes: item.details?.flags ?? []
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

  await Promise.all([
    writeFile(join(OUTPUT_DIR, 'runes.json'), JSON.stringify(runes, null, 2)),
    writeFile(join(OUTPUT_DIR, 'sigils.json'), JSON.stringify(sigils, null, 2)),
    writeFile(join(OUTPUT_DIR, 'infusions.json'), JSON.stringify(infusions, null, 2)),
    writeFile(join(OUTPUT_DIR, 'relics.json'), JSON.stringify(relics, null, 2)),
    writeFile(join(OUTPUT_DIR, 'food.json'), JSON.stringify(food, null, 2)),
    writeFile(join(OUTPUT_DIR, 'utility.json'), JSON.stringify(utility, null, 2))
  ])

  console.log(
    `\nDone. runes=${runes.length} sigils=${sigils.length} infusions=${infusions.length} ` +
      `relics=${relics.length} food=${food.length} utility=${utility.length}`
  )
  console.log(`Written to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
