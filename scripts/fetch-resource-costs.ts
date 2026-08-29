/**
 * Fetches skill resource costs (Revenant energy/upkeep, Thief initiative, Necromancer/Ranger
 * Untamed health-sacrifice cost) from the wiki, writing data/game-data/resource-costs.json.
 *
 * Confirmed live 2026-08-28: `/v2/skills` has NO cost field of any kind for any of these — not
 * even the "PvE-reference-build, un-adjusted for WvW" starting point `Recharge` facts give
 * `fetch-recharge-wvw-overrides.ts`. This data is 100% wiki-sourced, via the same `{{Skill
 * infobox}}` template's `energy=`/`initiative=`/`upkeep=`/`health cost=` fields (each with an
 * optional ` wvw=` sibling for a WvW-specific value, same shape as `recharge wvw=`).
 *
 * **Candidate discovery is search-based, not id-based** — unlike every other fetch-*.ts script,
 * which starts from `skills.json`'s own id list and looks up a wiki page by name. There's no API
 * field to filter skills.json down to "carries a cost" first, and blind-fetching all ~1400
 * player-equippable skill pages just to find the handful that do would be wasteful. Instead this
 * uses the wiki's own full-text search (`searchWikiTitles`, `insource:`) to find exactly the pages
 * that mention the field at all, scoped by profession category where the cost type is
 * profession-exclusive (confirmed live: `energy`/`upkeep` never appear outside
 * `incategory:"Revenant skills"`, `initiative` never outside `incategory:"Thief skills"` — a
 * global search returns hundreds of false positives, mostly Game_updates pages and lore text using
 * the plain English word). `health cost` has no single owning profession (seen on both Necromancer
 * and Ranger Untamed skills), so that one search is global — still only 6 real candidates in
 * practice (the rest are Game_updates pages, filtered out by the no-infobox check below).
 *
 * **Validated via the infobox's own `id=` field, not a value cross-check** — the recharge-override
 * script had an API-side `Recharge` fact value to compare its wiki parse against; there's no
 * equivalent here. But going search-title -> wiki page -> `id=` -> `skills.json` lookup (the
 * reverse of every other script's id -> name -> wiki-page direction) means the wiki page itself
 * names its own definitive skill id, which is validated against `skills.json` directly (must
 * exist, must be player-equippable) — a stronger, more direct correctness check than a name-match
 * ever gives, and it naturally handles same-name duplicate skills for free: each duplicate has its
 * OWN wiki page (e.g. "Disabling Shot (thief short bow skill)"), and that page's own `id=` field
 * says exactly which of the several same-named ids it documents — no name-grouping/ambiguous-skip
 * step needed at all.
 *
 * Run manually via `npm run fetch-resource-costs`, after `npm run fetch-game-data`.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ResourceCost, ResourceCostsById, Skill } from '../src/shared/types/game-data'
import { fetchWikiPage, flushWikiCache, searchWikiTitles } from './lib/wiki-cache'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

/** Pages a search hit is never worth fetching — overview/changelog/meta pages that happen to
 *  contain the search term in prose rather than a Skill infobox. Cheap to filter before spending a
 *  wiki fetch on them; the no-infobox/no-id checks below would also catch these, just after an
 *  unnecessary network round trip. */
function isObviouslyNotASkillPage(title: string): boolean {
  return title.startsWith('Game updates/') || title.startsWith('List of ') || title.endsWith('/history')
}

interface FieldSpec {
  /** Infobox field name, e.g. "energy" or "health cost" (space, not underscore — confirmed live). */
  field: string
  costKey: keyof ResourceCost
  wvwKey: keyof ResourceCost
}

const EPSILON = 0.01

const FIELD_SPECS: FieldSpec[] = [
  { field: 'energy', costKey: 'energy', wvwKey: 'energyWvw' },
  { field: 'initiative', costKey: 'initiative', wvwKey: 'initiativeWvw' },
  { field: 'upkeep', costKey: 'upkeep', wvwKey: 'upkeepWvw' },
  { field: 'health cost', costKey: 'healthCost', wvwKey: 'healthCostWvw' }
]

/** Reads every `FIELD_SPECS` field off one infobox block. A page can (and Revenant upkeep skills
 *  always do) carry more than one of these fields at once, so this returns every match found
 *  rather than stopping at the first — see `ResourceCost`'s own doc comment. The base field's regex
 *  naturally skips past its own ` wvw=` sibling line (same trick `fetch-recharge-wvw-overrides.ts`
 *  uses for `recharge=`/`recharge wvw=`): "energy" immediately followed by optional whitespace then
 *  "=" doesn't match "energy wvw =", since "wvw" sits in between, not more whitespace. A ` wvw=`
 *  field that merely repeats the base value (e.g. Impossible Odds' `upkeep wvw = -6`, identical to
 *  its own `upkeep = -6` — the wiki documents it explicitly even though it isn't a real override)
 *  is dropped, same "no real split, nothing to store" convention
 *  `fetch-recharge-wvw-overrides.ts` uses for `recharge wvw=`. */
function parseResourceFields(infobox: string): ResourceCost {
  const out: ResourceCost = {}
  for (const spec of FIELD_SPECS) {
    const escaped = spec.field.replace(/ /g, '\\s+')
    const baseMatch = new RegExp(`^\\|\\s*${escaped}\\s*=\\s*(-?[\\d.]+)`, 'im').exec(infobox)
    const wvwMatch = new RegExp(`^\\|\\s*${escaped}\\s+wvw\\s*=\\s*(-?[\\d.]+)`, 'im').exec(infobox)
    const base = baseMatch ? Number(baseMatch[1]) : null
    const wvw = wvwMatch ? Number(wvwMatch[1]) : null
    if (base !== null) out[spec.costKey] = base
    if (wvw !== null && (base === null || Math.abs(wvw - base) > EPSILON)) out[spec.wvwKey] = wvw
  }
  return out
}

async function processTitle(
  title: string,
  skillsById: Map<number, Skill>,
  result: ResourceCostsById,
  log: string[]
): Promise<void> {
  if (isObviouslyNotASkillPage(title)) return

  const wikitext = await fetchWikiPage(title)
  if (wikitext === null) {
    log.push(`skip (page not found): "${title}"`)
    return
  }

  const infoboxMatch = /\{\{\s*Skill infobox([\s\S]*?)\n\}\}/i.exec(wikitext)
  if (!infoboxMatch) {
    log.push(`skip (no Skill infobox — likely a disambiguation/overview page): "${title}"`)
    return
  }
  const infobox = infoboxMatch[1]

  const idMatch = /^\|\s*id\s*=\s*(\d+)/im.exec(infobox)
  if (!idMatch) {
    log.push(`skip (no id= field in infobox): "${title}"`)
    return
  }
  const id = Number(idMatch[1])

  const skill = skillsById.get(id)
  if (!skill) {
    log.push(`skip (id ${id} not found in skills.json): "${title}"`)
    return
  }
  if (skill.professions.length === 0) {
    log.push(`skip (id ${id} "${skill.name}" is not player-equippable): "${title}"`)
    return
  }

  const fields = parseResourceFields(infobox)
  if (Object.keys(fields).length === 0) {
    log.push(`skip (matched search but no cost field parsed from infobox): "${title}" -> id ${id} "${skill.name}"`)
    return
  }

  if (result[id]) {
    log.push(`note (id ${id} "${skill.name}" seen via 2+ search titles, merging): "${title}"`)
    Object.assign(result[id], fields)
  } else {
    result[id] = fields
  }
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const skillsById = new Map(skills.map((s) => [s.id, s]))

  console.log('Searching the wiki for candidate pages...')
  const energyTitles = await searchWikiTitles('insource:"energy" incategory:"Revenant skills"')
  const initiativeTitles = await searchWikiTitles('insource:"initiative" incategory:"Thief skills"')
  const healthCostTitles = await searchWikiTitles('insource:"health cost"')

  // Dedup: a title can surface from more than one search in principle (it won't in practice today,
  // since energy/initiative/health-cost searches don't overlap — kept for robustness against a
  // future balance patch adding overlap rather than assumed).
  const allTitles = [...new Set([...energyTitles, ...initiativeTitles, ...healthCostTitles])]
  console.log(
    `Found ${energyTitles.length} energy/upkeep candidates, ${initiativeTitles.length} initiative candidates, ` +
      `${healthCostTitles.length} health-cost candidates (${allTitles.length} unique titles total).`
  )

  const result: ResourceCostsById = {}
  const log: string[] = []

  let processed = 0
  for (const title of allTitles) {
    await processTitle(title, skillsById, result, log)
    processed++
    if (processed % 25 === 0) console.log(`  [${processed}/${allTitles.length}] titles processed...`)
  }

  await flushWikiCache()
  await writeFile(join(DATA_DIR, 'resource-costs.json'), JSON.stringify(result, null, 2))

  console.log(`\nDone. Resource costs written for ${Object.keys(result).length} skills to resource-costs.json.`)
  console.log(`\n${log.length} log lines (skipped/merged):`)
  for (const line of log) console.warn(`  - ${line}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
