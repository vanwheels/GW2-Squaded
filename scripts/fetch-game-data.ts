/**
 * Fetches static GW2 game data (professions, specializations, traits, skills, itemstats)
 * from the public GW2 API v2 and writes normalized JSON to data/game-data/.
 *
 * Run manually via `npm run fetch-game-data`. See docs/game-data.md for endpoint details,
 * pagination/batching, and rate-limit handling.
 *
 * Raw API response shapes are typed loosely and locally in this file only — the normalized,
 * app-facing types live in src/shared/types/game-data.ts and are what gets written to disk.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  Fact,
  GameData,
  ItemStat,
  Profession,
  Skill,
  Specialization,
  Trait,
  TraitSlot
} from '../src/shared/types/game-data'

const API_BASE = 'https://api.guildwars2.com/v2'
const BATCH_SIZE = 200
const MAX_RETRIES = 5
const BATCH_DELAY_MS = 150

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'data', 'game-data')

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

/** Fetches every id for a v2 endpoint, then bulk-fetches full records in batches of BATCH_SIZE. */
async function fetchAllRecords<TId extends string | number, TRaw>(endpoint: string): Promise<TRaw[]> {
  const ids = await fetchJsonWithRetry<TId[]>(`${API_BASE}/${endpoint}`)
  console.log(`  ${endpoint}: ${ids.length} ids`)

  const batches = chunk(ids, BATCH_SIZE)
  const records: TRaw[] = []
  for (const [index, batch] of batches.entries()) {
    const idsParam = batch.map((id) => encodeURIComponent(String(id))).join(',')
    const batchRecords = await fetchJsonWithRetry<TRaw[]>(`${API_BASE}/${endpoint}?ids=${idsParam}`)
    records.push(...batchRecords)
    console.log(`  ${endpoint}: batch ${index + 1}/${batches.length} (${records.length}/${ids.length})`)
    if (index < batches.length - 1) await sleep(BATCH_DELAY_MS)
  }
  return records
}

// --- Raw API shapes (trimmed to the fields we actually consume) -----------------------------

interface RawProfession {
  id: string
  name: string
  icon: string
  icon_big: string
  specializations: number[]
}

interface RawSpecialization {
  id: number
  name: string
  profession: string
  elite: boolean
  icon: string
  background: string
  minor_traits: number[]
  major_traits: number[]
}

interface RawTrait {
  id: number
  tier: number
  order: number
  name: string
  description?: string
  slot: string
  specialization: number
  icon: string
  facts?: Fact[]
  traited_facts?: Fact[]
}

interface RawSkill {
  id: number
  name: string
  description?: string
  icon?: string
  chat_link: string
  type?: string
  weapon_type?: string
  professions?: string[]
  slot?: string
  facts?: Fact[]
  traited_facts?: Fact[]
}

interface RawItemStatAttribute {
  attribute: string
  multiplier: number
  value: number
}

interface RawItemStat {
  id: number
  name: string
  attributes: RawItemStatAttribute[]
}

// --- Normalization ----------------------------------------------------------------------------

function normalizeProfession(raw: RawProfession): Profession {
  return {
    id: raw.id,
    name: raw.name,
    icon: raw.icon,
    iconBig: raw.icon_big,
    specializationIds: raw.specializations
  }
}

function normalizeSpecialization(raw: RawSpecialization): Specialization {
  return {
    id: raw.id,
    name: raw.name,
    profession: raw.profession,
    elite: raw.elite,
    icon: raw.icon,
    background: raw.background,
    minorTraitIds: raw.minor_traits,
    majorTraitIds: raw.major_traits
  }
}

function normalizeTrait(raw: RawTrait): Trait {
  return {
    id: raw.id,
    tier: raw.tier,
    order: raw.order,
    name: raw.name,
    description: raw.description ?? '',
    slot: raw.slot as TraitSlot,
    specializationId: raw.specialization,
    icon: raw.icon,
    facts: raw.facts ?? [],
    traitedFacts: raw.traited_facts ?? []
  }
}

function normalizeSkill(raw: RawSkill): Skill {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    icon: raw.icon ?? '',
    chatLink: raw.chat_link,
    type: raw.type ?? '',
    weaponType: raw.weapon_type ?? null,
    professions: raw.professions ?? [],
    slot: raw.slot ?? '',
    facts: raw.facts ?? [],
    traitedFacts: raw.traited_facts ?? []
  }
}

function normalizeItemStat(raw: RawItemStat): ItemStat {
  return {
    id: raw.id,
    name: raw.name,
    attributes: raw.attributes.map((attr) => ({
      attribute: attr.attribute,
      multiplier: attr.multiplier,
      value: attr.value
    }))
  }
}

// --- Main ---------------------------------------------------------------------------------------

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true })

  console.log('Fetching professions...')
  const professions = (await fetchAllRecords<string, RawProfession>('professions')).map(normalizeProfession)

  console.log('Fetching specializations...')
  const specializations = (
    await fetchAllRecords<number, RawSpecialization>('specializations')
  ).map(normalizeSpecialization)

  console.log('Fetching traits...')
  const traits = (await fetchAllRecords<number, RawTrait>('traits')).map(normalizeTrait)

  console.log('Fetching skills...')
  const skills = (await fetchAllRecords<number, RawSkill>('skills')).map(normalizeSkill)

  console.log('Fetching itemstats...')
  const itemStats = (await fetchAllRecords<number, RawItemStat>('itemstats')).map(normalizeItemStat)

  // eliteSpecSkills isn't produced here — it's sourced from the wiki by the separate
  // scripts/fetch-elite-spec-skills.ts, not the official GW2 API.
  const gameData: Omit<GameData, 'eliteSpecSkills'> = { professions, specializations, traits, skills, itemStats }

  await Promise.all([
    writeFile(join(OUTPUT_DIR, 'professions.json'), JSON.stringify(professions, null, 2)),
    writeFile(join(OUTPUT_DIR, 'specializations.json'), JSON.stringify(specializations, null, 2)),
    writeFile(join(OUTPUT_DIR, 'traits.json'), JSON.stringify(traits, null, 2)),
    writeFile(join(OUTPUT_DIR, 'skills.json'), JSON.stringify(skills, null, 2)),
    writeFile(join(OUTPUT_DIR, 'itemstats.json'), JSON.stringify(itemStats, null, 2)),
    writeFile(
      join(OUTPUT_DIR, 'meta.json'),
      JSON.stringify({ fetchedAt: new Date().toISOString() }, null, 2)
    )
  ])

  console.log(
    `\nDone. professions=${gameData.professions.length} specializations=${gameData.specializations.length} ` +
      `traits=${gameData.traits.length} skills=${gameData.skills.length} itemStats=${gameData.itemStats.length}`
  )
  console.log(`Written to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
