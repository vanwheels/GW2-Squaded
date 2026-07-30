/**
 * Fetches wiki-sourced numeric effect data for relics and writes data/game-data/relic-effects.json.
 *
 * Session 14 discovered relics carry NO `Fact`/`details` object at all via the public API — only
 * a plain-text `description` (see docs/game-data.md's "Gear upgrades and consumables" section).
 * The wiki fills this gap: every relic's page uses a `{{Relic infobox}}` template whose `facts=`
 * field is itself a list of `{{skill fact|...}}` invocations — the EXACT same template
 * skills/traits use, confirmed live 2026-07-30 (e.g. Relic of the Warrior's
 * `{{skill fact|Weapon Swap Recharge Reduction|25%}}`). So this script parses that, the same
 * general shape of approach as fetch-wvw-splits.ts, but there is no API-side numeric value to
 * cross-validate a parse against here (unlike that script) — the wiki IS the primary source for
 * these numbers, not a secondary check on one.
 *
 * Run manually via `npm run fetch-relic-effects`, after `npm run fetch-gear-upgrades` (matches
 * wiki page titles against the already-fetched data/game-data/relics.json by name).
 *
 * Two real wrinkles found while building this (both documented in docs/game-data.md):
 * - Many relic *names* map to multiple item ids in relics.json (106 of 113 unique names, e.g.
 *   re-releases/level-80-boost variants) but MediaWiki only allows one page per exact title, so
 *   one wiki page's parsed facts must be attributed to a set of ids, not a single one. Usually
 *   safe (same name -> identical API `description` across every id), but 7 names have ids whose
 *   description text actually differs (a relic reworked at some point, old/new versions coexisting
 *   under the same display name) — for those, facts are attributed ONLY to the ids the wiki page's
 *   own `id=` field explicitly lists, not every relics.json id sharing the name.
 * - Wikitext `|`-splitting breaks on a `[[Link|text]]` or `{{template|arg}}` pipe embedded inside a
 *   later field (e.g. a `desc=` value) — same class of problem fetch-wvw-splits.ts hit, but that
 *   script had an API duration to validate against; this one doesn't, so a bracket-balance check
 *   is used instead (see `isBalanced`) — any fact line that still isn't bracket-balanced after pipe
 *   protection is dropped and logged rather than stored possibly-corrupted.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Relic, RelicEffect, RelicEffectsById, RelicFactLine } from '../src/shared/types/game-data'

const WIKI_INDEX = 'https://wiki.guildwars2.com/index.php'
const REQUEST_DELAY_MS = 150
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchRawWikitext(title: string): Promise<string> {
  const url = `${WIKI_INDEX}?title=${encodeURIComponent(title)}&action=raw`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Wiki raw fetch failed for "${title}": ${response.status} ${response.statusText}`)
  return response.text()
}

/** A handful of relic names collide with an unrelated page (disambiguation pages, e.g. "Relic of
 *  Dwayna" also names a back item) — the actual relic article lives at "<name> (relic)" instead. */
async function fetchRelicPage(name: string): Promise<string | undefined> {
  const direct = await fetchRawWikitext(name)
  if (!/\{\{disambig/i.test(direct) && /\{\{Relic infobox/i.test(direct)) return direct
  await sleep(REQUEST_DELAY_MS)
  try {
    const disambiguated = await fetchRawWikitext(`${name} (relic)`)
    if (/\{\{Relic infobox/i.test(disambiguated)) return disambiguated
  } catch {
    // fall through to undefined below
  }
  return undefined
}

/** Protects one level of piped wikilinks/templates (`[[X|Y]]`, `{{X|Y}}`) from a naive `|`-split
 *  by swapping their inner pipe for a placeholder, restored per-segment after splitting. Handles
 *  every case found in a full scan of every relic's wikitext except one (a `{{sic|...}}` template
 *  nested inside a piped wikilink's own `desc=` value) — that remaining case is caught by
 *  `isBalanced` below and dropped, not silently mis-parsed. */
// Private-use-area placeholder for a "protected" pipe — vanishingly unlikely to appear in real
// wikitext, and (unlike a literal control character) doesn't trip ESLint's no-control-regex rule.
const PROTECTED_PIPE = ''

function protectPipes(s: string): string {
  let out = s.replace(/\[\[([^[\]|]*)\|([^[\]]*)\]\]/g, (_, a: string, b: string) => `[[${a}${PROTECTED_PIPE}${b}]]`)
  out = out.replace(/\{\{([^{}|]*)\|([^{}]*)\}\}/g, (_, a: string, b: string) => `{{${a}${PROTECTED_PIPE}${b}}}`)
  return out
}
function restorePipes(s: string): string {
  return s.split(PROTECTED_PIPE).join('|')
}
function isBalanced(s: string): boolean {
  const openLink = (s.match(/\[\[/g) ?? []).length
  const closeLink = (s.match(/\]\]/g) ?? []).length
  const openTpl = (s.match(/\{\{/g) ?? []).length
  const closeTpl = (s.match(/\}\}/g) ?? []).length
  return openLink === closeLink && openTpl === closeTpl
}

interface ParsedFacts {
  facts: RelicFactLine[]
  corrupted: string[]
}

/** Parses every `{{skill fact|...}}` invocation in a relic infobox, keeping only the WvW-relevant
 *  line wherever a fact is split by `game mode=` (drops a PvE-only or PvP-only alternate for the
 *  same label; keeps untagged lines, which apply in every mode). */
function parseFactLines(infobox: string): ParsedFacts {
  const factRe = /\{\{\s*skill fact\s*\|(.*?)\}\}/gis
  const facts: RelicFactLine[] = []
  const corrupted: string[] = []
  for (const match of infobox.matchAll(factRe)) {
    const protectedArgs = protectPipes(match[1])
    const rawSegments = protectedArgs.split('|').map((s) => restorePipes(s.trim()))
    if (rawSegments.some((s) => !isBalanced(s))) {
      corrupted.push(match[0])
      continue
    }
    const label = rawSegments[0]
    if (!label) continue

    const values: string[] = []
    const params: Record<string, string> = {}
    let gameModeTokens: string[] | null = null
    for (const seg of rawSegments.slice(1)) {
      const kv = /^([a-z][a-z ]*)\s*=\s*(.+)$/i.exec(seg)
      if (kv) {
        const key = kv[1].trim().toLowerCase()
        if (key === 'game mode') {
          gameModeTokens = kv[2].toLowerCase().split(/[\s,]+/).filter(Boolean)
        } else {
          params[key] = kv[2].trim()
        }
      } else if (seg) {
        values.push(seg)
      }
    }
    if (gameModeTokens !== null && !gameModeTokens.includes('wvw')) continue // PvE-only/PvP-only line for this label — drop
    facts.push({ label, values, params })
  }
  return { facts, corrupted }
}

/** `recharge wvw=`/`recharge pvp=` fields document a WvW/PvP-specific cooldown distinct from the
 *  base `recharge=` (confirmed live: 7 relics have a `recharge wvw` override, 5 have `recharge pvp`
 *  only — none have both). Prefers the WvW-tagged field; falls back to the untagged base field. */
function parseRechargeSeconds(infobox: string): number | null {
  const wvwMatch = /^\|\s*recharge\s+wvw\s*=\s*([\d.]+)/im.exec(infobox)
  if (wvwMatch) return Number(wvwMatch[1])
  const baseMatch = /^\|\s*recharge\s*=\s*([\d.]+)/im.exec(infobox)
  return baseMatch ? Number(baseMatch[1]) : null
}

function parseListedIds(infobox: string): number[] {
  const idFieldMatch = /\|\s*id\s*=\s*([^\n|]+)/.exec(infobox)
  if (!idFieldMatch) return []
  const cleaned = idFieldMatch[1].replace(/<!--.*?-->/g, '')
  return cleaned
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
}

async function main(): Promise<void> {
  const relics = JSON.parse(await readFile(join(DATA_DIR, 'relics.json'), 'utf-8')) as Relic[]

  const byName = new Map<string, Relic[]>()
  for (const relic of relics) {
    const list = byName.get(relic.name) ?? []
    list.push(relic)
    byName.set(relic.name, list)
  }
  const names = [...byName.keys()]

  const result: RelicEffectsById = {}
  const log: string[] = []
  let pagesWithFacts = 0
  let pagesWithNoFacts = 0
  let idSubsetResolutions = 0
  let corruptedLineCount = 0

  for (const [i, name] of names.entries()) {
    const relicsForName = byName.get(name)!

    let text: string | undefined
    try {
      text = await fetchRelicPage(name)
    } catch (err) {
      log.push(`skip (fetch error): "${name}" — ${(err as Error).message}`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }
    if (!text) {
      log.push(`skip (no Relic infobox found, incl. "(relic)" disambiguation retry): "${name}"`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }

    const infoboxMatch = /\{\{Relic infobox([\s\S]*?)\n\}\}/.exec(text)
    if (!infoboxMatch) {
      log.push(`skip (Relic infobox template not closed as expected): "${name}"`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }
    const infobox = infoboxMatch[1]

    // Decide which of this name's relics.json ids the parsed facts may be safely attributed to.
    let targetIds: number[]
    const distinctDescriptions = new Set(relicsForName.map((r) => r.description))
    if (distinctDescriptions.size === 1) {
      targetIds = relicsForName.map((r) => r.id) // identical effect across every id sharing this name
    } else {
      const listedIds = new Set(parseListedIds(infobox))
      targetIds = relicsForName.filter((r) => listedIds.has(r.id)).map((r) => r.id)
      if (targetIds.length === 0) {
        log.push(`skip (differing descriptions across ids, and none match the wiki's own id= list): "${name}"`)
        await sleep(REQUEST_DELAY_MS)
        continue
      }
      idSubsetResolutions++
      log.push(
        `note (subset attribution): "${name}" — applying facts only to id(s) [${targetIds.join(', ')}] of ` +
          `[${relicsForName.map((r) => r.id).join(', ')}], since the other id(s) have different API description text`
      )
    }

    const { facts, corrupted } = parseFactLines(infobox)
    corruptedLineCount += corrupted.length
    for (const line of corrupted) log.push(`skip (unbalanced brackets after pipe-protection): "${name}" — ${line}`)

    const rechargeSeconds = parseRechargeSeconds(infobox)
    if (facts.length > 0) pagesWithFacts++
    else pagesWithNoFacts++

    const effect: RelicEffect = { facts, rechargeSeconds }
    for (const id of targetIds) result[id] = effect

    if (i % 20 === 0) console.log(`[${i}/${names.length}] ${name}`)
    await sleep(REQUEST_DELAY_MS)
  }

  await writeFile(join(DATA_DIR, 'relic-effects.json'), JSON.stringify(result, null, 2))

  console.log(
    `\nDone. relic-effects.json written for ${Object.keys(result).length} ids ` +
      `(${pagesWithFacts} names with facts, ${pagesWithNoFacts} names with no {{skill fact}} lines, ` +
      `${idSubsetResolutions} names needed subset id attribution, ${corruptedLineCount} fact lines dropped as unparseable).`
  )
  console.log(`\n${log.length} log lines:`)
  for (const line of log) console.warn(`  - ${line}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
