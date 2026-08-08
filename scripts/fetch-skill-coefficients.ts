/**
 * PILOT script for the wiki-extraction pipeline (see TODO.md's "Wiki-sourced data pipeline
 * (infrastructure)" section) — does NOT write any data file. Its only job is to validate the
 * scripted approach against work this app already paid for conversationally: it re-derives, from
 * live wiki wikitext, the WvW-verified `coefficient` this app already hand-curated in
 * `CURATED_DAMAGE_COEFFICIENTS` (src/shared/skill-calc/damage-calc.ts), then diffs the two and
 * prints a report. A clean diff (few/no MISMATCH lines) validates that this fact type — and by
 * extension the still-queued Healing/Barrier/target-count/Condition-Cleanse ones with the same
 * "read one wiki template field by eye" shape — really is a scripting candidate, and any
 * MISMATCH lines are either a genuine manual-sweep mistake worth fixing or a wiki value that's
 * drifted since the sweep curated it (both worth a human look either way).
 *
 * Same skeleton as fetch-wvw-splits.ts: fetch raw wikitext per candidate page, regex-parse its
 * `{{skill fact|damage|...}}` invocations, cross-validate against locally-cached API data
 * (`Fact.dmg_multiplier`/`Fact.hit_count`), fail safe into a logged skip on anything ambiguous
 * rather than guess. Two differences from that script:
 *  - No `Category:...` membership fetch needed for candidate selection — the candidate set here
 *    is simply every id already a key in `CURATED_DAMAGE_COEFFICIENTS`, since the point is
 *    diffing against that table, not discovering new ground yet (that's step 3 in TODO.md's plan,
 *    once this pilot itself is validated).
 *  - Cross-validation target is a *coefficient total*, not a single duration: a wiki `strikes=N`
 *    param means the parsed `coefficient=` is already totaled across N hits (matches the API's
 *    `hit_count`); without `strikes=`, a `hit_count > 1` fact is a pulsing effect and the wiki
 *    coefficient is PER-HIT, so this script multiplies by the API's own `hit_count` before
 *    comparing — see `damage-calc.ts`'s own `DamageCoefficient` doc comment, this mirrors it.
 *
 * Run manually via `npm run fetch-skill-coefficients`, after `npm run fetch-game-data`.
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Skill } from '../src/shared/types/game-data'
import { CURATED_DAMAGE_COEFFICIENTS } from '../src/shared/skill-calc/damage-calc'

const WIKI_INDEX = 'https://wiki.guildwars2.com/index.php'
const REQUEST_DELAY_MS = 150
// Same gotcha as every other fetch-*.ts script: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Wiki article titles for shout-style skills keep surrounding quote marks the API's skill.name
 *  drops (or vice versa) — try both forms, same helper as fetch-wvw-splits.ts. */
function titleVariants(title: string): string[] {
  const unquoted = title.replace(/^"(.*)"$/, '$1')
  return unquoted === title ? [title, `"${title}"`] : [title, unquoted]
}

async function fetchRawWikitext(title: string): Promise<string | null> {
  const url = `${WIKI_INDEX}?title=${encodeURIComponent(title)}&action=raw`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Wiki raw fetch failed for "${title}": ${response.status} ${response.statusText}`)
  return response.text()
}

/** Tries every title spelling variant in turn, returning the first page that exists. */
async function fetchFirstAvailable(titles: string[]): Promise<string | null> {
  for (const title of titles) {
    const text = await fetchRawWikitext(title)
    if (text !== null) return text
  }
  return null
}

interface ParsedDamageFact {
  factText: string // `alt=` param value, or 'Damage' (the template's own default) if absent
  coefficient: number
  strikes: number | null // wiki's `strikes=N` param — present means `coefficient` is already totaled
  gameModeTokens: string[] | null // null = no `game mode=` param (applies everywhere)
}

/** Extracts every `{{skill fact|damage|...}}` invocation's `coefficient=`, `alt=` (factText),
 *  `strikes=`, and `game mode=` params. Live-verified wikitext shapes (2026-08-07):
 *  `{{skill fact|damage|strikes=15|weapon=axe|coefficient=8.388|game mode = pve}}` (Whirling Axe),
 *  `{{skill fact|damage|alt=Traveling Tornado Damage|coefficient=2.0|weapon=utility|game mode=pve}}`
 *  (Perfect Storm) — key spacing/ordering both vary, handled by trimming and matching on key name
 *  rather than position. A bare positional value with no `key=` (an unkeyed power-override number,
 *  e.g. Seed Turret's `{{skill fact|damage|318|coefficient=0.5}}`) is simply ignored here — none of
 *  this app's curated candidates use that shape (both examples found live are non-player-scaling
 *  turrets/vines the manual sweep deliberately excluded), but a future page using it shouldn't crash
 *  the parse, just contribute nothing beyond what real `key=` params on the same line give. */
function parseDamageFactLines(wikitext: string): ParsedDamageFact[] {
  const out: ParsedDamageFact[] = []
  const templateRe = /\{\{\s*skill\s*fact\s*\|\s*damage\s*\|(.*?)\}\}/gis
  for (const match of wikitext.matchAll(templateRe)) {
    const segments = match[1]
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
    let factText = 'Damage'
    let coefficient: number | null = null
    let strikes: number | null = null
    let gameModeTokens: string[] | null = null
    for (const seg of segments) {
      const kv = /^([a-z_ ]+?)\s*=\s*(.+)$/i.exec(seg)
      if (!kv) continue // bare positional value (see doc comment) — not needed for coefficient validation
      const key = kv[1].toLowerCase().replace(/\s+/g, '')
      const value = kv[2].trim()
      if (key === 'alt') factText = value
      else if (key === 'coefficient') coefficient = Number(value)
      else if (key === 'strikes') strikes = Number(value)
      else if (key === 'gamemode') gameModeTokens = value.toLowerCase().split(/[\s,]+/).filter(Boolean)
    }
    if (coefficient === null || Number.isNaN(coefficient)) continue // no valid coefficient param — nothing to compare
    out.push({ factText, coefficient, strikes, gameModeTokens })
  }
  return out
}

type ResolveResult =
  | { status: 'ok'; line: ParsedDamageFact }
  | { status: 'ambiguous' }
  | { status: 'no-wvw-tag' }

/** Same game-mode-bucket logic as fetch-wvw-splits.ts's `resolveOverride`: bucket by explicit
 *  'pve'/'wvw'/'pvp' token, pick the wvw-tagged line when the fact is split, the sole untagged line
 *  when it isn't. Anything with more than one candidate for the chosen bucket, or a mix of tagged
 *  and untagged lines for the same factText, is ambiguous and left for a human to look at rather
 *  than guessed. */
function resolveWvwLine(lines: ParsedDamageFact[]): ResolveResult {
  const withMode = lines.filter((l) => l.gameModeTokens !== null)
  const withoutMode = lines.filter((l) => l.gameModeTokens === null)
  if (withMode.length === 0) {
    if (withoutMode.length !== 1) return { status: 'ambiguous' }
    return { status: 'ok', line: withoutMode[0] }
  }
  if (withoutMode.length > 0) return { status: 'ambiguous' } // mixed modal/non-modal lines
  const wvwLines = withMode.filter((l) => l.gameModeTokens!.includes('wvw'))
  if (wvwLines.length === 1) return { status: 'ok', line: wvwLines[0] }
  if (wvwLines.length === 0) return { status: 'no-wvw-tag' } // split exists but no wvw-tagged line found
  return { status: 'ambiguous' } // multiple wvw-tagged lines for the same factText
}

const EPSILON = 0.005

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const skillsById = new Map(skills.map((s) => [s.id, s]))

  const candidateIds = Object.keys(CURATED_DAMAGE_COEFFICIENTS).map(Number)
  const totalEntries = candidateIds.reduce((sum, id) => sum + CURATED_DAMAGE_COEFFICIENTS[id].length, 0)
  console.log(
    `Pilot: re-deriving ${totalEntries} curated coefficient entries across ${candidateIds.length} skills` +
      ` from live wiki wikitext, diffing against CURATED_DAMAGE_COEFFICIENTS...`
  )

  let matchCount = 0
  const mismatches: string[] = []
  const missing: string[] = []
  const skips: string[] = []
  const notFound: string[] = []

  let processed = 0
  for (const id of candidateIds) {
    const skill = skillsById.get(id)
    const curatedEntries = CURATED_DAMAGE_COEFFICIENTS[id]

    if (!skill) {
      notFound.push(`skill id ${id} not found in local skills.json (curated ${curatedEntries.length} entries)`)
      processed++
      continue
    }

    let wikitext: string | null
    try {
      wikitext = await fetchFirstAvailable(titleVariants(skill.name))
    } catch (err) {
      notFound.push(`fetch error: skill ${id} "${skill.name}" — ${(err as Error).message}`)
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${candidateIds.length}] skills checked...`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }
    if (wikitext === null) {
      notFound.push(`no wiki page found for: skill ${id} "${skill.name}" (tried: ${titleVariants(skill.name).join(', ')})`)
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${candidateIds.length}] skills checked...`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }

    const parsed = parseDamageFactLines(wikitext)
    const byFactText = new Map<string, ParsedDamageFact[]>()
    for (const p of parsed) {
      const list = byFactText.get(p.factText) ?? []
      list.push(p)
      byFactText.set(p.factText, list)
    }

    for (const entry of curatedEntries) {
      const lines = byFactText.get(entry.factText)
      if (!lines || lines.length === 0) {
        missing.push(`MISSING: skill ${id} "${skill.name}" / "${entry.factText}" — no {{skill fact|damage}} line parsed for this factText`)
        continue
      }

      const resolved = resolveWvwLine(lines)
      if (resolved.status !== 'ok') {
        skips.push(`SKIP (${resolved.status}): skill ${id} "${skill.name}" / "${entry.factText}"`)
        continue
      }
      const line = resolved.line

      let total: number
      if (line.strikes !== null) {
        total = line.coefficient // wiki's own strikes= param means this is already the totaled value
      } else {
        const apiFact = [...skill.facts, ...skill.traitedFacts].find((f) => f.type === 'Damage' && f.text === entry.factText)
        const hitCount = typeof apiFact?.hit_count === 'number' ? apiFact.hit_count : 1
        total = line.coefficient * hitCount // pulsing effect, no strikes= — wiki value is per-hit
      }

      if (Math.abs(total - entry.coefficient) <= EPSILON) {
        matchCount++
      } else {
        mismatches.push(
          `MISMATCH: skill ${id} "${skill.name}" / "${entry.factText}" — curated=${entry.coefficient}, wiki-derived=${total}` +
            ` (raw wiki coefficient=${line.coefficient}, strikes=${line.strikes ?? 'n/a'})`
        )
      }
    }

    processed++
    if (processed % 50 === 0) console.log(`  [${processed}/${candidateIds.length}] skills checked...`)
    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`\nDone. ${processed}/${candidateIds.length} skills checked.`)
  console.log(`  MATCH:    ${matchCount}`)
  console.log(`  MISMATCH: ${mismatches.length}`)
  console.log(`  MISSING:  ${missing.length}`)
  console.log(`  SKIP:     ${skips.length}`)
  console.log(`  NOT FOUND (page/skill lookup failed): ${notFound.length}`)

  if (mismatches.length > 0) {
    console.log(`\n--- MISMATCH (curated value disagrees with a re-derived wiki value) ---`)
    for (const line of mismatches) console.log(`  - ${line}`)
  }
  if (missing.length > 0) {
    console.log(`\n--- MISSING (wiki page had no matching damage line for this curated factText) ---`)
    for (const line of missing) console.log(`  - ${line}`)
  }
  if (skips.length > 0) {
    console.log(`\n--- SKIP (ambiguous — needs a human read) ---`)
    for (const line of skips) console.log(`  - ${line}`)
  }
  if (notFound.length > 0) {
    console.log(`\n--- NOT FOUND ---`)
    for (const line of notFound) console.log(`  - ${line}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
