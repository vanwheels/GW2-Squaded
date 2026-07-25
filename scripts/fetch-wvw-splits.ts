/**
 * Fetches WvW-vs-PvE game-mode splits for boon/condition Buff facts, from the wiki, and writes
 * data/game-data/wvw-fact-overrides.json.
 *
 * The public GW2 API has no field for this: `/v2/skills` and `/v2/traits` facts are a single
 * flat list with no `game mode` tag, and appear to merge in whichever variant exists (verified:
 * for skills/traits with NO split, the API value is simply the one value; for split ones, cross-
 * checking against the wiki shows the API's `duration` matches the PvE-tagged wikitext value
 * when a PvE variant exists at all, and the sole tagged value otherwise — see docs/game-data.md).
 * So this is sourced from the wiki instead, same pattern as fetch-elite-spec-skills.ts:
 * `Category:Split skills` (1664 pages) / `Category:Split traits` (545 pages) are real, maintained
 * lists of which pages have a `{{skill fact|...|game mode=...}}` / `{{trait fact|...}}` split
 * somewhere on them. This script narrows that to the ~1100 pages that are BOTH in one of those
 * categories AND correspond to a skill/trait with a boon/condition Buff fact locally (the only
 * ones the boon/condition calculator cares about), fetches each page's raw wikitext, and parses
 * out the split.
 *
 * Wikitext fact-template parsing is inherently a bit fragile (naive `|`-splitting can misparse a
 * `[[Link|text]]` pipe embedded in a later field), so every parsed value is cross-validated
 * against the already-fetched API duration before being trusted — see `validateAndBuildOverride`.
 * Anything ambiguous (multiple Buff facts sharing a status on one id, multiple same-game-mode
 * fact lines for one boon on one page, a parsed PvE value that doesn't match the API's) is
 * skipped and logged rather than guessed, same fail-safe philosophy as
 * scripts/fetch-elite-spec-skills.ts.
 *
 * Run manually via `npm run fetch-wvw-splits`, after `npm run fetch-game-data` (matches wiki page
 * titles against the already-fetched data/game-data/{skills,traits}.json by name).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Skill, Trait, WvwFactOverride, WvwFactOverrides } from '../src/shared/types/game-data'
import { BOON_NAMES, CONDITION_NAMES } from '../src/shared/boon-calc/constants'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
const WIKI_INDEX = 'https://wiki.guildwars2.com/index.php'
const REQUEST_DELAY_MS = 150
// Same gotcha as fetch-elite-spec-skills.ts: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const NAME_BY_LOWER = new Map<string, string>([...BOON_NAMES, ...CONDITION_NAMES].map((n) => [n.toLowerCase(), n]))

/** Wiki article titles for shout-style skills keep surrounding quote marks the API's skill.name
 *  drops (or vice versa) — try both forms, same helper as fetch-elite-spec-skills.ts. */
function titleVariants(title: string): string[] {
  const unquoted = title.replace(/^"(.*)"$/, '$1')
  return unquoted === title ? [title, `"${title}"`] : [title, unquoted]
}

async function fetchCategoryMembers(category: string): Promise<Set<string>> {
  const titles = new Set<string>()
  let continueParams: Record<string, string> = {}
  for (;;) {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmlimit: '500',
      format: 'json',
      ...continueParams
    })
    const response = await fetch(`${WIKI_API}?${params.toString()}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`Wiki API request failed: ${response.status} ${response.statusText}`)
    const data = (await response.json()) as {
      query?: { categorymembers?: { title: string }[] }
      continue?: Record<string, string>
    }
    for (const member of data.query?.categorymembers ?? []) titles.add(member.title)
    if (data.continue) {
      continueParams = data.continue
      await sleep(REQUEST_DELAY_MS)
    } else {
      break
    }
  }
  return titles
}

async function fetchRawWikitext(title: string): Promise<string> {
  const url = `${WIKI_INDEX}?title=${encodeURIComponent(title)}&action=raw`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Wiki raw fetch failed for "${title}": ${response.status} ${response.statusText}`)
  return response.text()
}

interface ParsedFactLine {
  name: string // properly-cased boon/condition name
  duration: number
  gameModeTokens: string[] | null // null = no `game mode=` param (applies everywhere)
}

/** Extracts every `{{skill fact|...}}` / `{{trait fact|...}}` invocation's boon/condition-name,
 *  first bare numeric positional value, and `game mode=` param (if any). Naive `|`-splitting can
 *  misparse a `[[Link|text]]` pipe embedded in a later field (e.g. a `desc=` param) — this mostly
 *  affects non-boon fact types (which are discarded below), and any resulting corruption on a
 *  boon fact is caught by the API-duration cross-check in validateAndBuildOverride. */
function parseFactLines(wikitext: string): ParsedFactLine[] {
  const out: ParsedFactLine[] = []
  const templateRe = /\{\{\s*(?:skill|trait)\s*fact\s*\|(.*?)\}\}/gis
  for (const match of wikitext.matchAll(templateRe)) {
    const segments = match[1].split('|').map((s) => s.trim())
    const rawName = segments[0]?.toLowerCase()
    if (!rawName) continue
    const name = NAME_BY_LOWER.get(rawName)
    if (!name) continue // not a boon/condition fact (damage, healing, radius, ...)

    let duration: number | null = null
    let gameModeTokens: string[] | null = null
    for (const seg of segments.slice(1)) {
      const modeMatch = /^game\s*mode\s*=\s*(.+)$/i.exec(seg)
      if (modeMatch) {
        gameModeTokens = modeMatch[1].toLowerCase().split(/[\s,]+/).filter(Boolean)
        continue
      }
      if (duration === null && /^\d+(\.\d+)?$/.test(seg)) {
        duration = Number(seg)
      }
    }
    if (duration === null) continue // no bare numeric value found — not a duration-bearing fact
    out.push({ name, duration, gameModeTokens })
  }
  return out
}

interface CandidateObject {
  kind: 'skill' | 'trait'
  id: number
  name: string
  statusCounts: Map<string, number> // boon/condition name -> count of Buff facts with that status
  statusDuration: Map<string, number> // boon/condition name -> that fact's API duration (only set when count===1)
}

function collectCandidates(objects: (Skill | Trait)[], kind: 'skill' | 'trait'): Map<string, CandidateObject[]> {
  const byName = new Map<string, CandidateObject[]>()
  for (const obj of objects) {
    const statusCounts = new Map<string, number>()
    const statusDuration = new Map<string, number>()
    for (const fact of [...obj.facts, ...obj.traitedFacts]) {
      if (fact.type !== 'Buff' || typeof fact.status !== 'string' || typeof fact.duration !== 'number') continue
      if (!NAME_BY_LOWER.has(fact.status.toLowerCase())) continue
      statusCounts.set(fact.status, (statusCounts.get(fact.status) ?? 0) + 1)
      statusDuration.set(fact.status, fact.duration)
    }
    if (statusCounts.size === 0) continue
    const candidate: CandidateObject = { kind, id: obj.id, name: obj.name, statusCounts, statusDuration }
    const list = byName.get(obj.name) ?? []
    list.push(candidate)
    byName.set(obj.name, list)
  }
  return byName
}

const EPSILON = 0.01

/** Given all parsed wiki fact-lines for one boon/condition name on one page, decides whether
 *  there's a clean, unambiguous game-mode split and what the WvW override should be. Returns
 *  `undefined` (with a log line) for anything not confidently resolvable. */
function resolveOverride(
  boonName: string,
  lines: ParsedFactLine[],
  candidate: CandidateObject,
  pageTitle: string,
  log: string[]
): WvwFactOverride | undefined {
  if ((candidate.statusCounts.get(boonName) ?? 0) !== 1) {
    log.push(`skip (cardinality): ${candidate.kind} ${candidate.id} "${pageTitle}" has ${candidate.statusCounts.get(boonName)} "${boonName}" Buff facts, not 1`)
    return undefined
  }
  const withMode = lines.filter((l) => l.gameModeTokens !== null)
  const withoutMode = lines.filter((l) => l.gameModeTokens === null)
  if (withMode.length === 0) return undefined // not actually split for this boon, nothing to do

  if (withoutMode.length > 0) {
    log.push(`skip (mixed modal/non-modal): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
    return undefined
  }

  const wvwLines = withMode.filter((l) => l.gameModeTokens!.includes('wvw'))
  const pveLines = withMode.filter((l) => !l.gameModeTokens!.includes('wvw'))
  if (wvwLines.length > 1 || pveLines.length > 1) {
    log.push(`skip (ambiguous multi-entry): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
    return undefined
  }

  const apiDuration = candidate.statusDuration.get(boonName)!

  if (pveLines.length === 1 && wvwLines.length === 1) {
    if (Math.abs(apiDuration - pveLines[0].duration) > EPSILON) {
      log.push(
        `skip (validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=${apiDuration}, parsed PvE=${pveLines[0].duration}`
      )
      return undefined
    }
    return wvwLines[0].duration
  }

  if (pveLines.length === 1 && wvwLines.length === 0) {
    if (Math.abs(apiDuration - pveLines[0].duration) > EPSILON) {
      log.push(
        `skip (validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=${apiDuration}, parsed PvE=${pveLines[0].duration}`
      )
      return undefined
    }
    return 'omit'
  }

  if (pveLines.length === 0 && wvwLines.length === 1) {
    if (Math.abs(apiDuration - wvwLines[0].duration) > EPSILON) {
      log.push(
        `skip (validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=${apiDuration}, parsed WvW-only=${wvwLines[0].duration}`
      )
      return undefined
    }
    return undefined // API already reflects the sole (WvW-tagged) value — nothing to override
  }

  log.push(`skip (unhandled combination): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
  return undefined
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const traits = JSON.parse(await readFile(join(DATA_DIR, 'traits.json'), 'utf-8')) as Trait[]

  const skillsByName = collectCandidates(skills, 'skill')
  const traitsByName = collectCandidates(traits, 'trait')

  console.log('Fetching Category:Split skills / Category:Split traits member lists...')
  const [splitSkillTitles, splitTraitTitles] = await Promise.all([
    fetchCategoryMembers('Category:Split skills'),
    fetchCategoryMembers('Category:Split traits')
  ])
  console.log(`  Split skills: ${splitSkillTitles.size}, split traits: ${splitTraitTitles.size}`)

  function inSplitCategory(name: string, titles: Set<string>): boolean {
    return titleVariants(name).some((v) => titles.has(v))
  }

  const skillPages = [...skillsByName.keys()].filter((n) => inSplitCategory(n, splitSkillTitles))
  const traitPages = [...traitsByName.keys()].filter((n) => inSplitCategory(n, splitTraitTitles))
  const skippedAmbiguousName: string[] = []
  for (const [name, list] of skillsByName) {
    if (list.length > 1 && inSplitCategory(name, splitSkillTitles)) {
      skippedAmbiguousName.push(`skill "${name}" -> ids [${list.map((c) => c.id).join(', ')}]`)
    }
  }
  for (const [name, list] of traitsByName) {
    if (list.length > 1 && inSplitCategory(name, splitTraitTitles)) {
      skippedAmbiguousName.push(`trait "${name}" -> ids [${list.map((c) => c.id).join(', ')}]`)
    }
  }

  console.log(
    `Candidate pages to fetch: ${skillPages.length} skills + ${traitPages.length} traits` +
      ` (${skippedAmbiguousName.length} excluded — name maps to multiple ids)`
  )

  const result: WvwFactOverrides = { skill: {}, trait: {} }
  const log: string[] = []
  let fetched = 0
  const totalPages = skillPages.length + traitPages.length

  async function processPage(name: string, byName: Map<string, CandidateObject[]>, bucket: Record<number, Record<string, WvwFactOverride>>) {
    const candidates = byName.get(name)
    if (!candidates || candidates.length !== 1) return // ambiguous name, already logged above
    const candidate = candidates[0]

    let wikitext: string
    try {
      wikitext = await fetchRawWikitext(name)
    } catch (err) {
      log.push(`skip (fetch error): ${candidate.kind} ${candidate.id} "${name}" — ${(err as Error).message}`)
      return
    }

    const lines = parseFactLines(wikitext)
    const linesByBoon = new Map<string, ParsedFactLine[]>()
    for (const line of lines) {
      const list = linesByBoon.get(line.name) ?? []
      list.push(line)
      linesByBoon.set(line.name, list)
    }

    const overrides: Record<string, WvwFactOverride> = {}
    for (const boonName of candidate.statusCounts.keys()) {
      const boonLines = linesByBoon.get(boonName)
      if (!boonLines) continue
      const override = resolveOverride(boonName, boonLines, candidate, name, log)
      if (override !== undefined) overrides[boonName] = override
    }

    if (Object.keys(overrides).length > 0) bucket[candidate.id] = overrides
  }

  for (const name of skillPages) {
    await processPage(name, skillsByName, result.skill)
    fetched++
    if (fetched % 50 === 0) console.log(`  [${fetched}/${totalPages}] pages fetched...`)
    await sleep(REQUEST_DELAY_MS)
  }
  for (const name of traitPages) {
    await processPage(name, traitsByName, result.trait)
    fetched++
    if (fetched % 50 === 0) console.log(`  [${fetched}/${totalPages}] pages fetched...`)
    await sleep(REQUEST_DELAY_MS)
  }

  await writeFile(join(DATA_DIR, 'wvw-fact-overrides.json'), JSON.stringify(result, null, 2))

  const skillOverrideCount = Object.keys(result.skill).length
  const traitOverrideCount = Object.keys(result.trait).length
  console.log(
    `\nDone. WvW overrides written for ${skillOverrideCount} skills + ${traitOverrideCount} traits` +
      ` to wvw-fact-overrides.json.`
  )
  console.log(`\n${log.length} lines skipped (ambiguous/unvalidated) — see below:`)
  for (const line of log) console.warn(`  - ${line}`)
  if (skippedAmbiguousName.length > 0) {
    console.warn(`\n${skippedAmbiguousName.length} pages excluded outright (name maps to multiple ids):`)
    for (const line of skippedAmbiguousName) console.warn(`  - ${line}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
