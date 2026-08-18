/**
 * Fetches wiki-sourced "Tango icon" URLs for every profession and elite specialization, writing
 * data/game-data/tango-icons.json.
 *
 * Why a separate wiki-sourced file at all: the GW2 wiki's official profession/elite-spec icon
 * art (`Category:Profession_icons` — the "overhead icon"/"highres" families) is tagged
 * `{{ArenaNet image}}` — "used with permission. The terms of the permission do not include third
 * party use." Confirmed 2026-08-18 by reading the raw wikitext of a sample file page
 * (`File:Guardian_(overhead_icon).png`) — same restriction that ruled out the wiki's
 * `Category:Equipment_slot_icons` for the gw2skills.net icon work (see
 * docs/game-data.md / TODO.md history). NOT usable here.
 *
 * "Tango icons" (`[Name] tango icon [20|48|200]px.png`, `Category:Profession tango icons`) are a
 * different, community-drawn icon set tagged `{{GFDL image}}` instead — the GNU Free Documentation
 * License, which (unlike the ArenaNet template) does permit third-party reuse. Verified per-file
 * below by fetching each file page's raw wikitext and requiring the literal `{{GFDL image}}`
 * template to be present — if the wiki ever reclassifies one of these, this script fails loudly
 * instead of silently shipping an unlicensed asset. Coverage confirmed live 2026-08-18: all 9 base
 * professions and all 36 current elite specs (including the newest expansion's) have a 48px file.
 *
 * Only the 48px size is stored — nothing in the app currently renders a profession/elite-spec icon
 * above 36px (`.spec-icon-button`), so a "highres" variant would be dead data; add one later if a
 * bigger-icon redesign ever needs it. One exception: Thief's `48px`/`20px` file variants are missing
 * the `{{GFDL image}}` tag entirely (confirmed 2026-08-18) even though the sibling `200px` variant
 * (same upload, same categories) has it — almost certainly a tagging omission on the smaller
 * duplicate, not an actual license difference, but this script doesn't assume that: for any name
 * whose 48px file fails the license check, it falls back to the 200px file instead (same real,
 * explicitly-tagged asset, just a higher-resolution source — downscales fine via the existing CSS).
 *
 * Run manually via `npm run fetch-tango-icons`, after `npm run fetch-game-data` (reads
 * professions.json/specializations.json for the id lists this keys off of).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Profession, Specialization } from '../src/shared/types/game-data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'
const BATCH_SIZE = 40

interface TangoIcons {
  professions: Record<string, string>
  specializations: Record<string, string>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

interface ImageInfoResponse {
  query?: {
    pages?: Record<string, { title: string; missing?: boolean; imageinfo?: { url: string }[] }>
  }
}

/** Direct file URLs for a batch of `File:...` titles, via the MediaWiki imageinfo API — a
 *  different query shape than `fetchWikiPage`'s revisions lookup, so not routed through the shared
 *  wiki-page cache (this is a handful of batched calls, not hundreds of individual page fetches). */
async function fetchImageUrls(titles: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()
  for (const batch of chunk(titles, BATCH_SIZE)) {
    const url =
      `${WIKI_API}?action=query&titles=${encodeURIComponent(batch.join('|'))}` +
      `&prop=imageinfo&iiprop=url&format=json&formatversion=2`
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`imageinfo fetch failed: ${response.status} ${response.statusText}`)
    const json = (await response.json()) as ImageInfoResponse
    for (const page of Object.values(json.query?.pages ?? {})) {
      result.set(page.title, page.missing || !page.imageinfo?.length ? null : page.imageinfo[0].url)
    }
    await sleep(150)
  }
  return result
}

/** Confirms a Tango icon file page is actually GFDL-licensed (not ArenaNet-restricted or anything
 *  else) by checking its raw wikitext for the literal template — see module doc comment. Uses
 *  `action=raw` directly (not the shared `fetchWikiPage` cache) because several of the 9 base
 *  profession Tango files (e.g. "Guardian tango icon 48px.png") are old uploads whose page body is
 *  a `#redirect [[Guardian]]` soft-redirect to the profession's own article, used purely for wiki
 *  categorization — `fetchWikiPage`'s `redirects=1` query follows that straight to the article page
 *  and loses the license template entirely. `action=raw` never follows redirects, so it always
 *  returns the file page's own literal content. */
async function isGfdlLicensed(title: string): Promise<boolean> {
  const url = `https://wiki.guildwars2.com/index.php?title=${encodeURIComponent(title)}&action=raw`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`raw fetch failed for "${title}": ${response.status} ${response.statusText}`)
  const wikitext = await response.text()
  await sleep(150)
  return /\{\{\s*GFDL image\s*\}\}/i.test(wikitext)
}

/** Tries the 48px file first, falling back to 200px (see module doc comment for why) — returns
 *  undefined only if neither size resolves to a licensed, existing file. */
async function resolveTangoIcon(
  name: string,
  urlsByTitle: Map<string, string | null>,
  log: string[]
): Promise<string | undefined> {
  for (const size of ['48px', '200px']) {
    const title = `File:${name} tango icon ${size}.png`
    const url = urlsByTitle.get(title)
    if (!url) {
      log.push(`MISSING file: "${title}"`)
      continue
    }
    if (!(await isGfdlLicensed(title))) {
      log.push(`NOT GFDL-licensed, skipping: "${title}"`)
      continue
    }
    if (size !== '48px') log.push(`fell back to ${size} for "${name}" (48px wasn't usable)`)
    return url
  }
  return undefined
}

async function main(): Promise<void> {
  const professions = JSON.parse(await readFile(join(DATA_DIR, 'professions.json'), 'utf-8')) as Profession[]
  const specializations = JSON.parse(
    await readFile(join(DATA_DIR, 'specializations.json'), 'utf-8')
  ) as Specialization[]
  const eliteSpecs = specializations.filter((s) => s.elite)

  const names = [...professions.map((p) => p.name), ...eliteSpecs.map((s) => s.name)]
  const titles = names.flatMap((name) => [
    `File:${name} tango icon 48px.png`,
    `File:${name} tango icon 200px.png`
  ])
  console.log(`Resolving ${titles.length} Tango icon file URLs...`)
  const urlsByTitle = await fetchImageUrls(titles)

  const log: string[] = []
  const result: TangoIcons = { professions: {}, specializations: {} }

  for (const p of professions) {
    const url = await resolveTangoIcon(p.name, urlsByTitle, log)
    if (url) result.professions[p.id] = url
  }
  for (const s of eliteSpecs) {
    const url = await resolveTangoIcon(s.name, urlsByTitle, log)
    if (url) result.specializations[String(s.id)] = url
  }

  if (log.length > 0) {
    console.log(`\n${log.length} log line(s):`)
    for (const line of log) console.log(`  - ${line}`)
  }

  const missingProfessions = professions.filter((p) => !result.professions[p.id])
  const missingSpecs = eliteSpecs.filter((s) => !result.specializations[String(s.id)])
  if (missingProfessions.length > 0 || missingSpecs.length > 0) {
    throw new Error(
      `${missingProfessions.length} profession(s) and ${missingSpecs.length} elite spec(s) have no usable ` +
        `Tango icon — fix or explicitly accept the gap before writing tango-icons.json.`
    )
  }

  await writeFile(join(DATA_DIR, 'tango-icons.json'), JSON.stringify(result, null, 2))
  console.log(
    `\nDone. tango-icons.json written: ${Object.keys(result.professions).length} professions, ` +
      `${Object.keys(result.specializations).length} elite specs.`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
