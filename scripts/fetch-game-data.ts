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
  Familiar,
  GameData,
  ItemStat,
  Legend,
  Pet,
  Profession,
  ProfessionWeapon,
  Skill,
  Specialization,
  Trait,
  TraitSlot,
  WeaponFlag
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

interface RawProfessionWeapon {
  specialization?: number
  flags: string[]
  skills: { id: number; slot: string }[]
}

interface RawProfessionSkill {
  id: number
  slot: string
  type: string
}

interface RawProfession {
  id: string
  name: string
  icon: string
  icon_big: string
  specializations: number[]
  weapons: Record<string, RawProfessionWeapon>
  skills: RawProfessionSkill[]
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
  flags?: string[]
  facts?: Fact[]
  traited_facts?: Fact[]
  attunement?: string
  specialization?: number
  flip_skill?: number
  categories?: string[]
  toolbelt_skill?: number
  bundle_skills?: number[]
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

interface RawLegend {
  id: string
  swap: number
  heal: number
  elite: number
  utilities: number[]
}

interface RawPet {
  id: number
  name: string
  icon: string
  skills: { id: number }[]
}

/**
 * Legend id -> elite specialization id required to unlock it, or `null` for the 4 core legends.
 * NOT derivable from the API — `/v2/legends` carries no specialization field, and
 * `/v2/professions/Revenant` has no `legends` field at all (confirmed by direct inspection). Hand-
 * verified 2026-07-29 by cross-referencing each legend's `swap` skill name (fetched live from
 * `/v2/skills`) against the wiki's "Legend" page, which lists Dwarf/Assassin/Centaur/Demon as core
 * and Dragon/Renegade/Alliance/Entity as gated behind Herald/Renegade/Vindicator/Conduit
 * respectively — matches exactly, 1:1, no ambiguity. Small and stable (new entries only arrive
 * with a new Revenant elite spec); re-verify the same way if one is ever added.
 */
const LEGEND_SPECIALIZATION_ID: Record<string, number | null> = {
  Legend1: 52, // Legendary Dragon Stance (Glint) — Herald
  Legend2: null, // Legendary Assassin Stance (Shiro) — core
  Legend3: null, // Legendary Dwarf Stance (Jalis) — core
  Legend4: null, // Legendary Demon Stance (Mallyx) — core
  Legend5: 63, // Legendary Renegade Stance (Kalla) — Renegade
  Legend6: null, // Legendary Centaur Stance (Ventari) — core
  Legend7: 69, // Legendary Alliance (Archemorus/Saint Viktor) — Vindicator
  Legend8: 79 // Legendary Entity Stance (Razah) — Conduit
}

/**
 * Elementalist Evoker's 4 familiars -> the Heal skill "Rejuvenate" id that's bound while that
 * familiar is active (icon-only difference — all 4 ids share identical facts/recharge/description,
 * confirmed live 2026-07-31). NOT derivable from `/v2/skills` alone (all 4 share the same
 * `specializationId: 80` with no other distinguishing field) — sourced from the skill's own wiki
 * infobox, which annotates each id with its element in an HTML comment:
 * `id = 79323 <!-- fire -->, 76634 <!-- water-->, 79315 <!-- air -->, 79314 <!-- earth -->`,
 * cross-referenced against the `Evoker` wiki page's Fox=Fire/Otter=Water/Hare=Air/Toad=Earth
 * familiar-to-element mapping. Small and stable (only changes if a new familiar element is ever
 * added); re-verify the same way if that happens.
 */
const FAMILIARS: { id: string; name: string; element: string; rejuvenateSkillId: number }[] = [
  { id: 'Fox', name: 'Fox', element: 'Fire', rejuvenateSkillId: 79323 },
  { id: 'Otter', name: 'Otter', element: 'Water', rejuvenateSkillId: 76634 },
  { id: 'Hare', name: 'Hare', element: 'Air', rejuvenateSkillId: 79315 },
  { id: 'Toad', name: 'Toad', element: 'Earth', rejuvenateSkillId: 79314 }
]

// --- Normalization ----------------------------------------------------------------------------

function normalizeWeapon(raw: RawProfessionWeapon): ProfessionWeapon {
  return {
    flags: raw.flags as WeaponFlag[],
    specializationId: raw.specialization ?? null,
    skills: raw.skills.map((s) => ({ id: s.id, slot: s.slot }))
  }
}

function normalizeProfession(raw: RawProfession): Profession {
  return {
    id: raw.id,
    name: raw.name,
    icon: raw.icon,
    iconBig: raw.icon_big,
    specializationIds: raw.specializations,
    weapons: Object.fromEntries(
      Object.entries(raw.weapons).map(([weaponType, w]) => [weaponType, normalizeWeapon(w)])
    ),
    professionSkills: raw.skills.filter((s) => s.type === 'Profession').map((s) => ({ id: s.id, slot: s.slot }))
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
    flags: raw.flags ?? [],
    facts: raw.facts ?? [],
    traitedFacts: raw.traited_facts ?? [],
    attunement: raw.attunement ?? null,
    specializationId: raw.specialization ?? null,
    flipSkill: raw.flip_skill ?? null,
    categories: raw.categories ?? [],
    toolbeltSkill: raw.toolbelt_skill ?? null,
    bundleSkills: raw.bundle_skills ?? null
  }
}

function normalizeLegend(raw: RawLegend, skillsById: Map<number, Skill>): Legend {
  const swapSkill = skillsById.get(raw.swap)
  if (!swapSkill) {
    throw new Error(`Legend ${raw.id}: swap skill ${raw.swap} not found in fetched skills — cannot resolve name/icon`)
  }
  if (!(raw.id in LEGEND_SPECIALIZATION_ID)) {
    console.warn(`  [legends] ${raw.id} is not in LEGEND_SPECIALIZATION_ID — treating as core (ungated). ` +
      'This likely means a new Revenant elite spec/legend was added; update the map in this script.')
  }
  return {
    id: raw.id,
    name: swapSkill.name,
    icon: swapSkill.icon,
    swap: raw.swap,
    heal: raw.heal,
    elite: raw.elite,
    utilities: raw.utilities as [number, number, number],
    specializationId: LEGEND_SPECIALIZATION_ID[raw.id] ?? null
  }
}

function buildFamiliars(skillsById: Map<number, Skill>): Familiar[] {
  return FAMILIARS.map((f) => {
    const rejuvenateSkill = skillsById.get(f.rejuvenateSkillId)
    if (!rejuvenateSkill) {
      throw new Error(
        `Familiar ${f.id}: Rejuvenate skill ${f.rejuvenateSkillId} not found in fetched skills — cannot resolve icon`
      )
    }
    return { id: f.id, name: f.name, element: f.element, icon: rejuvenateSkill.icon, rejuvenateSkillId: f.rejuvenateSkillId }
  })
}

function normalizePet(raw: RawPet): Pet {
  return {
    id: raw.id,
    name: raw.name,
    icon: raw.icon,
    skillId: raw.skills[0].id
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

  console.log('Fetching legends...')
  const skillsById = new Map(skills.map((s) => [s.id, s]))
  const legends = (await fetchAllRecords<string, RawLegend>('legends')).map((raw) => normalizeLegend(raw, skillsById))

  console.log('Fetching pets...')
  const pets = (await fetchAllRecords<number, RawPet>('pets')).map(normalizePet)

  console.log('Building familiars...')
  const familiars = buildFamiliars(skillsById)

  // eliteSpecSkills / glyphFormVariants / skillVariantExclusions / wvwFactOverrides /
  // relicEffects / tomeChapters / soulbeastBeastmode aren't produced here — they're sourced from
  // the wiki by the separate scripts/fetch-elite-spec-skills.ts, scripts/fetch-glyph-forms.ts,
  // scripts/fetch-skill-duplicate-resolutions.ts, scripts/fetch-wvw-splits.ts,
  // scripts/fetch-relic-effects.ts, scripts/fetch-tome-chapters.ts, and
  // scripts/fetch-soulbeast-beastmode.ts, not the official GW2 API.
  // runes/sigils/infusions/relics/food/utility/itemStatIcons are sourced
  // from the same official API but via the separate, much-heavier scripts/fetch-gear-upgrades.ts (a
  // full /v2/items scan) — not fetched here to keep this script's normal runtime fast.
  const gameData: Omit<
    GameData,
    | 'eliteSpecSkills'
    | 'glyphFormVariants'
    | 'skillVariantExclusions'
    | 'wvwFactOverrides'
    | 'relicEffects'
    | 'runes'
    | 'sigils'
    | 'infusions'
    | 'relics'
    | 'food'
    | 'utility'
    | 'itemStatIcons'
    | 'tomeChapters'
    | 'soulbeastBeastmode'
  > = {
    professions,
    specializations,
    traits,
    skills,
    itemStats,
    legends,
    pets,
    familiars
  }

  await Promise.all([
    writeFile(join(OUTPUT_DIR, 'professions.json'), JSON.stringify(professions, null, 2)),
    writeFile(join(OUTPUT_DIR, 'specializations.json'), JSON.stringify(specializations, null, 2)),
    writeFile(join(OUTPUT_DIR, 'traits.json'), JSON.stringify(traits, null, 2)),
    writeFile(join(OUTPUT_DIR, 'skills.json'), JSON.stringify(skills, null, 2)),
    writeFile(join(OUTPUT_DIR, 'itemstats.json'), JSON.stringify(itemStats, null, 2)),
    writeFile(join(OUTPUT_DIR, 'legends.json'), JSON.stringify(legends, null, 2)),
    writeFile(join(OUTPUT_DIR, 'pets.json'), JSON.stringify(pets, null, 2)),
    writeFile(join(OUTPUT_DIR, 'familiars.json'), JSON.stringify(familiars, null, 2)),
    writeFile(
      join(OUTPUT_DIR, 'meta.json'),
      JSON.stringify({ fetchedAt: new Date().toISOString() }, null, 2)
    )
  ])

  console.log(
    `\nDone. professions=${gameData.professions.length} specializations=${gameData.specializations.length} ` +
      `traits=${gameData.traits.length} skills=${gameData.skills.length} itemStats=${gameData.itemStats.length} ` +
      `legends=${gameData.legends.length} pets=${gameData.pets.length} familiars=${gameData.familiars.length}`
  )
  console.log(`Written to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
