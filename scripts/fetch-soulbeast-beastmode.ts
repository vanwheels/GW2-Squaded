/**
 * Resolves Ranger Soulbeast's Beastmode F1/F2 (per pet *family*) and F3 (per pet *archetype*)
 * skills down to real skill ids, per `Pet.id`, and writes data/game-data/soulbeast-beastmode.json.
 *
 * No API field links a pet to a Beastmode skill at all — this is sourced entirely from the wiki's
 * "Soulbeast" page (`== Pet Family ==` / `== Pet Archetypes ==` sections), cross-checked against
 * `data/game-data/{skills,pets}.json` at every step rather than trusted blindly:
 *
 * 1. Parse the "Pet Family" table: each row is either a single-species family (a `[[Juvenile
 *    X|X]]` link, e.g. Phoenix/Warclaw/Wallow) or a shared multi-species family (a bare `[[Bear]]`/
 *    `[[Bird]]`/etc. link) giving that family's default F1/F2 skill titles, plus (Feline's row
 *    only, currently) an inline `<small>(...)</small>`-tagged per-species F2 override.
 * 2. Parse the "Pet Archetypes" table: the "Soulbeast Beast skill" row gives the 5 archetypes'
 *    F3 titles in a fixed Stout/Deadly/Versatile/Ferocious/Supportive column order; the family rows
 *    below it enumerate every individual pet species (as real `[[Juvenile X|X]]` links) under its
 *    family + archetype.
 * 3. Every parsed skill title is resolved to a real id by matching (name, slot) against the local
 *    Ranger Profession_1/2/3 candidate pool; only when 2+ local ids share both (a handful of
 *    same-name-same-slot collisions — "Bite"/"Tail Lash"/"Brutal Charge"/"Worldly Impact") is that
 *    specific title's own wiki page fetched for its `id=` to disambiguate.
 * 4. **Live-verified 2026-07-30 this table lags real game content**: 4 local Profession_1/2
 *    Soulbeast candidate ids are left unconsumed after step 3 — a brand-new pet (Juvenile River
 *    Otter, a whole new family not in either table) and an undocumented per-species override
 *    (Juvenile Raptor Swiftwing, sharing the Avian archetype family but NOT the shared "Bird" F1/F2
 *    — the table has no row for it). Rather than hand-pin these two, every leftover id is resolved
 *    generically: search the wiki for "<skill name> soulbeast", fetch the first hit whose own
 *    `{{Skill infobox}}` `id=` matches, and read its `pet=`/`mechanic slot=` fields directly (every
 *    Beastmode F1/F2 skill's own page carries these) — this is actually a *more* authoritative
 *    per-skill signal than the aggregate table, and resolves any future new-pet lag the same way
 *    without a code change.
 * 5. Any `data/game-data/pets.json` entry whose name matches no species found in step 2 (i.e. also
 *    not caught by step 4's leftover-id sweep) is genuinely new: its own `{{Pet infobox}}` page is
 *    fetched directly for `archetype=` (F1/F2 should already be filled by step 4, matched via that
 *    skill's own `pet=` field).
 *
 * Every step logs and skips (never guesses) anything that doesn't resolve cleanly — same fail-safe
 * posture as every other wiki-sourced fetch script in this project. Run manually via
 * `npm run fetch-soulbeast-beastmode`, after `npm run fetch-game-data`.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pet, Skill, SoulbeastBeastmodeMap } from '../src/shared/types/game-data'

const WIKI_INDEX = 'https://wiki.guildwars2.com/index.php'
const WIKI_API = 'https://wiki.guildwars2.com/api.php'
const REQUEST_DELAY_MS = 150
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

const ARCHETYPES = ['Stout', 'Deadly', 'Versatile', 'Ferocious', 'Supportive'] as const
type Archetype = (typeof ARCHETYPES)[number]

/** The 2 known naming mismatches between the Pet Family table's row names and the Pet Archetypes
 *  table's family row names for the same family (every other family name matches verbatim). */
const ARCHETYPE_TABLE_TO_FAMILY_TABLE_NAME: Record<string, string> = { Ursine: 'Bear', Avian: 'Bird' }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchRawWikitext(title: string): Promise<string> {
  const url = `${WIKI_INDEX}?title=${encodeURIComponent(title.replace(/ /g, '_'))}&action=raw`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Wiki raw fetch failed for "${title}": ${response.status} ${response.statusText}`)
  return response.text()
}

async function searchWikiTitles(query: string): Promise<string[]> {
  const params = new URLSearchParams({ action: 'query', list: 'search', srsearch: query, srlimit: '5', format: 'json' })
  const response = await fetch(`${WIKI_API}?${params.toString()}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Wiki search failed for "${query}": ${response.status} ${response.statusText}`)
  const data = (await response.json()) as { query?: { search?: { title: string }[] } }
  return (data.query?.search ?? []).map((r) => r.title)
}

function parseInfoboxId(text: string): number | undefined {
  const match = /\|\s*id\s*=\s*(\d+)/.exec(text)
  return match ? Number(match[1]) : undefined
}
function parseInfoboxField(text: string, field: string): string | undefined {
  const match = new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|]+)`, 'i').exec(text)
  return match ? match[1].trim() : undefined
}

function section(text: string, startHeading: string, endHeading: string): string {
  const startIdx = text.indexOf(startHeading)
  const endIdx = text.indexOf(endHeading, startIdx)
  return text.slice(startIdx + startHeading.length, endIdx === -1 ? undefined : endIdx)
}

interface WikiLink {
  target: string
  display: string
}
function parseWikiLink(str: string): WikiLink | undefined {
  const match = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(str)
  if (!match) return undefined
  return { target: match[1].trim(), display: (match[2] ?? match[1]).trim() }
}

interface PetFamilyRow {
  target: string
  display: string
  f1Title: string
  f2Title: string
  f2Override?: { target: string | undefined; title: string }
}
/** Parses the `== Pet Family ==` table: one row per family, each giving F1/F2 wiki page titles
 *  (`{{skill icon|Title}}`), with Feline's row also carrying an inline White-Tiger-only F2
 *  override (`<small>(...)</small>`-tagged second `{{skill icon}}`). */
function parsePetFamilyTable(sectionText: string): PetFamilyRow[] {
  const blocks = sectionText.split(/\n\|-\n/).slice(1)
  const rows: PetFamilyRow[] = []
  for (const block of blocks) {
    const headerLine = /^!.*$/m.exec(block)?.[0]
    const link = headerLine ? parseWikiLink(headerLine) : undefined
    if (!link) continue
    const cellLines = block.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|-'))
    if (cellLines.length < 2) continue
    const f1Icons = [...cellLines[0].matchAll(/\{\{skill icon\|([^}|]+)/g)].map((m) => m[1].trim())
    const f2Icons = [...cellLines[1].matchAll(/\{\{skill icon\|([^}|]+)/g)].map((m) => m[1].trim())
    let f2Override: PetFamilyRow['f2Override']
    if (f2Icons.length > 1) {
      const speciesMatch = /<small>\(([^)]+)\)<\/small>/.exec(cellLines[1])
      const speciesLink = speciesMatch ? parseWikiLink(speciesMatch[1]) : undefined
      f2Override = { target: speciesLink?.target, title: f2Icons[1] }
    }
    rows.push({ target: link.target, display: link.display, f1Title: f1Icons[0], f2Title: f2Icons[0], f2Override })
  }
  return rows
}

interface ArchetypeFamilyRow {
  familyName: string
  members: Record<Archetype, WikiLink[]>
}
/** Parses the `== Pet Archetypes ==` table: the "Soulbeast Beast skill" row gives the 5
 *  archetypes' F3 titles in fixed column order, and each family row below it enumerates every
 *  individual pet species (real `[[Juvenile X|X]]` links) per archetype column. */
function parseArchetypeTable(sectionText: string): { f3Titles: string[]; familyRows: ArchetypeFamilyRow[] } {
  const lines = sectionText.split('\n')
  const f3Titles: string[] = []
  const familyRows: ArchetypeFamilyRow[] = []
  let currentFamily: ArchetypeFamilyRow | null = null
  let cellIndex = -1
  let inBeastSkillRow = false

  for (const line of lines) {
    if (/class="line-right"\s*\|\s*Attribute Bonus/.test(line)) {
      // Not a species/family row (the archetypes' attribute-bonus row, above the F3-skill row) —
      // skip it so it isn't mistaken for a family header.
      currentFamily = null
      continue
    }
    if (/Soulbeast \[\[Beast\]\] skill|Soulbeast Beast skill/.test(line)) {
      inBeastSkillRow = true
      continue
    }
    if (inBeastSkillRow) {
      if (line.startsWith('|-')) {
        inBeastSkillRow = false
      } else if (line.startsWith('|')) {
        const m = /\{\{skill icon\|([^}|]+)/.exec(line)
        if (m) f3Titles.push(m[1].trim())
        continue
      }
    }
    const familyHeaderMatch = /^!\s*class="line-right"\s*\|\s*(.+)$/.exec(line)
    if (familyHeaderMatch) {
      const rest = familyHeaderMatch[1].trim()
      const familyName = rest === 'Unique' ? 'Unique' : (parseWikiLink(rest)?.display ?? rest)
      currentFamily = {
        familyName,
        members: { Stout: [], Deadly: [], Versatile: [], Ferocious: [], Supportive: [] }
      }
      familyRows.push(currentFamily)
      cellIndex = -1
      continue
    }
    if (line.startsWith('|-')) {
      cellIndex = -1
      continue
    }
    if (currentFamily && line.startsWith('|')) {
      cellIndex++
      const archetype = ARCHETYPES[cellIndex]
      if (!archetype) continue
      for (const m of line.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
        const target = m[1].trim()
        if (target.startsWith('File:')) continue
        currentFamily.members[archetype].push({ target, display: (m[2] ?? target).trim() })
      }
    }
  }
  return { f3Titles, familyRows }
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const pets = JSON.parse(await readFile(join(DATA_DIR, 'pets.json'), 'utf-8')) as Pet[]
  const log: string[] = []

  console.log('Fetching Soulbeast wiki page...')
  const raw = await fetchRawWikitext('Soulbeast')
  await sleep(REQUEST_DELAY_MS)

  const familyTable = parsePetFamilyTable(section(raw, '== Pet Family ==', '== Pet Archetypes =='))
  const { f3Titles, familyRows } = parseArchetypeTable(section(raw, '== Pet Archetypes ==', '== Lore =='))
  console.log(`Parsed ${familyTable.length} Pet Family rows, ${familyRows.length} Pet Archetype family rows.`)

  const mechanicSkills = skills.filter(
    (s) => s.professions.includes('Ranger') && (s.slot === 'Profession_1' || s.slot === 'Profession_2' || s.slot === 'Profession_3')
  )
  const titleIdCache = new Map<string, number | undefined>()
  async function resolveTitle(title: string | undefined, slot: 'Profession_1' | 'Profession_2' | 'Profession_3'): Promise<number | undefined> {
    if (!title) return undefined
    if (titleIdCache.has(`${title}|${slot}`)) return titleIdCache.get(`${title}|${slot}`)
    const bareName = title.replace(/\s*\(soulbeast[^)]*\)\s*$/i, '').trim()
    const candidates = mechanicSkills.filter((s) => s.name === bareName && s.slot === slot)
    let resolved: number | undefined
    if (candidates.length === 1) {
      resolved = candidates[0].id
    } else if (candidates.length === 0) {
      log.push(`no local candidate for "${title}" (bare "${bareName}") slot ${slot}`)
    } else {
      let text: string
      try {
        text = await fetchRawWikitext(title)
      } catch (err) {
        log.push(`fetch failed for ambiguous title "${title}": ${(err as Error).message}`)
        titleIdCache.set(`${title}|${slot}`, undefined)
        return undefined
      }
      await sleep(REQUEST_DELAY_MS)
      const pageId = parseInfoboxId(text)
      if (pageId === undefined || !candidates.some((c) => c.id === pageId)) {
        log.push(`ambiguous title "${title}" unresolved — page id ${pageId ?? 'missing'}, local candidates [${candidates.map((c) => c.id).join(', ')}]`)
      } else {
        resolved = pageId
      }
    }
    titleIdCache.set(`${title}|${slot}`, resolved)
    return resolved
  }

  console.log('Resolving F3 (archetype) skill ids...')
  const f3Ids: Partial<Record<Archetype, number>> = {}
  for (let i = 0; i < ARCHETYPES.length; i++) {
    f3Ids[ARCHETYPES[i]] = await resolveTitle(f3Titles[i], 'Profession_3')
  }

  console.log('Resolving Pet Family row (F1/F2) skill ids...')
  const familyDefaults = new Map<string, { f1Id: number | undefined; f2Id: number | undefined; display: string }>()
  const speciesOverrides = new Map<string, { f1Id?: number; f2Id?: number }>()
  for (const row of familyTable) {
    const f1Id = await resolveTitle(row.f1Title, 'Profession_1')
    const f2Id = await resolveTitle(row.f2Title, 'Profession_2')
    familyDefaults.set(row.target, { f1Id, f2Id, display: row.display })
    if (row.f2Override?.target) {
      const overrideF2Id = await resolveTitle(row.f2Override.title, 'Profession_2')
      if (overrideF2Id !== undefined) speciesOverrides.set(row.f2Override.target, { f2Id: overrideF2Id })
    }
  }

  // species target ("Juvenile X") -> resolution
  const speciesData = new Map<string, { f1Id?: number; f2Id?: number; archetype: Archetype; f3Id?: number }>()
  for (const familyRow of familyRows) {
    const familyTableDisplay = ARCHETYPE_TABLE_TO_FAMILY_TABLE_NAME[familyRow.familyName] ?? familyRow.familyName
    const genericRow = [...familyDefaults.values()].find((r) => r.display === familyTableDisplay)
    for (const archetype of ARCHETYPES) {
      for (const species of familyRow.members[archetype]) {
        const ownRow = familyDefaults.get(species.target)
        if (!ownRow && !genericRow) {
          log.push(`species "${species.display}" (${species.target}) has no own Pet Family row and no generic family match for "${familyRow.familyName}"`)
        }
        let f1Id = ownRow?.f1Id ?? genericRow?.f1Id
        let f2Id = ownRow?.f2Id ?? genericRow?.f2Id
        const override = speciesOverrides.get(species.target)
        if (override?.f1Id !== undefined) f1Id = override.f1Id
        if (override?.f2Id !== undefined) f2Id = override.f2Id
        speciesData.set(species.target, { f1Id, f2Id, archetype, f3Id: f3Ids[archetype] })
      }
    }
  }

  // Any local Profession_1/2 Ranger Soulbeast (specializationId 55) candidate id not consumed by
  // the table-driven resolution above is either a brand-new pet's kit or an undocumented
  // per-species override the wiki's Pet Family table hasn't been updated to list — resolve each
  // generically via its own wiki page's `pet=`/`mechanic slot=` fields (see doc comment).
  const consumedIds = new Set<number>()
  for (const v of familyDefaults.values()) {
    if (v.f1Id !== undefined) consumedIds.add(v.f1Id)
    if (v.f2Id !== undefined) consumedIds.add(v.f2Id)
  }
  for (const v of speciesOverrides.values()) {
    if (v.f1Id !== undefined) consumedIds.add(v.f1Id)
    if (v.f2Id !== undefined) consumedIds.add(v.f2Id)
  }
  const leftoverCandidates = skills.filter(
    (s) =>
      s.professions.includes('Ranger') &&
      s.specializationId === 55 &&
      (s.slot === 'Profession_1' || s.slot === 'Profession_2') &&
      !consumedIds.has(s.id)
  )
  console.log(`Resolving ${leftoverCandidates.length} leftover (table-unaccounted) skill ids via their own wiki pages...`)
  for (const skill of leftoverCandidates) {
    let titles: string[]
    try {
      titles = await searchWikiTitles(`"${skill.name}" soulbeast`)
    } catch (err) {
      log.push(`leftover id ${skill.id} "${skill.name}": wiki search failed — ${(err as Error).message}`)
      continue
    }
    await sleep(REQUEST_DELAY_MS)

    let matchedPet: string | undefined
    let matchedSlot: number | undefined
    for (const title of titles) {
      let text: string
      try {
        text = await fetchRawWikitext(title)
      } catch {
        continue
      }
      await sleep(REQUEST_DELAY_MS)
      if (parseInfoboxId(text) !== skill.id) continue
      const pet = parseInfoboxField(text, 'pet')
      const mechanicSlot = parseInfoboxField(text, 'mechanic slot')
      if (pet && mechanicSlot) {
        matchedPet = pet
        matchedSlot = Number(mechanicSlot)
        break
      }
    }
    if (!matchedPet || (matchedSlot !== 1 && matchedSlot !== 2)) {
      log.push(`leftover id ${skill.id} "${skill.name}": no wiki page found with matching id= and pet=/mechanic slot= fields`)
      continue
    }
    const target = matchedPet.startsWith('Juvenile ') ? matchedPet : `Juvenile ${matchedPet}`
    const existing = speciesData.get(target)
    if (existing) {
      if (matchedSlot === 1) existing.f1Id = skill.id
      else existing.f2Id = skill.id
    } else {
      // Species not seen in the archetype table at all yet (e.g. a brand-new pet) — archetype/F3
      // filled in below once we detect it as a new pet.
      speciesData.set(target, { [matchedSlot === 1 ? 'f1Id' : 'f2Id']: skill.id, archetype: undefined as unknown as Archetype })
    }
    console.log(`  resolved leftover: "${skill.name}" (${skill.id}) -> ${target}, F${matchedSlot}`)
  }

  // Pets with no archetype at all yet (new pets found only via the leftover sweep above) need
  // their own infobox page fetched directly for `archetype=`.
  for (const pet of pets) {
    const existing = speciesData.get(pet.name)
    if (existing && existing.archetype === undefined) {
      let text: string
      try {
        text = await fetchRawWikitext(pet.name)
      } catch (err) {
        log.push(`new pet "${pet.name}": infobox fetch failed — ${(err as Error).message}`)
        continue
      }
      await sleep(REQUEST_DELAY_MS)
      const archetypeField = parseInfoboxField(text, 'archetype')
      const archetype = ARCHETYPES.find((a) => a.toLowerCase() === archetypeField?.toLowerCase())
      if (!archetype) {
        log.push(`new pet "${pet.name}": no recognized archetype= field (got "${archetypeField}")`)
        continue
      }
      existing.archetype = archetype
      existing.f3Id = f3Ids[archetype]
      console.log(`  new pet "${pet.name}": archetype=${archetype}`)
    }
  }

  const result: SoulbeastBeastmodeMap = {}
  let resolvedCount = 0
  for (const pet of pets) {
    const data = speciesData.get(pet.name)
    if (!data || data.f1Id === undefined || data.f2Id === undefined || data.f3Id === undefined) {
      log.push(`pet "${pet.name}" (id ${pet.id}) left unresolved: ${JSON.stringify(data)}`)
      continue
    }
    result[pet.id] = { f1SkillId: data.f1Id, f2SkillId: data.f2Id, f3SkillId: data.f3Id }
    resolvedCount++
  }

  await writeFile(join(DATA_DIR, 'soulbeast-beastmode.json'), JSON.stringify(result, null, 2))
  console.log(`\nDone. ${resolvedCount}/${pets.length} pets resolved, written to soulbeast-beastmode.json.`)
  if (log.length > 0) {
    console.warn(`\n${log.length} log lines:`)
    for (const line of log) console.warn(`  - ${line}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
