/**
 * Wiki-extraction pilot for the target-count leg of TODO.md's "Wiki-sourced data pipeline" step 3
 * (the target-count/Condition-Cleanse self-vs-party wording gap, not started before this). Same
 * validation goal as `fetch-skill-coefficients.ts`'s damage pilot: re-derive, from live wiki
 * wikitext, the ally-reach number this app already hand-curated conversationally in
 * `TARGET_COUNT_OVERRIDES` (src/shared/boon-calc/sources.ts, the 2026-08-06/07 Group A sweep — see
 * that table's own doc comment for the sweep history), then diff the two and print a report. Does
 * NOT write any data file or touch `TARGET_COUNT_OVERRIDES` itself — like the damage pilot, this
 * only validates whether the scripted approach is trustworthy enough to lean on for future legs
 * (Condition Cleanse, and any future patch causing a curated value to drift).
 *
 * Same skeleton as `fetch-skill-coefficients.ts`: fetch raw wikitext per candidate page (skill OR
 * trait — `TARGET_COUNT_OVERRIDES` curates both), resolve name collisions by verifying the page's
 * own `| id = N` infobox field, regex-parse its `{{skill fact|...}}` invocations, fail safe into a
 * logged bucket on anything ambiguous rather than guess.
 *
 * The wiki shape this leg parses, confirmed live 2026-08-08 across several candidates already in
 * `TARGET_COUNT_OVERRIDES`:
 *  - The enemy-facing count uses `{{skill fact|targets|N}}` (renders "Number of Targets: N") — never
 *    trusted here, same reasoning `resolveTargetCount`'s own doc comment gives (ambiguous with the
 *    ally-facing case on skills that hit both, e.g. Elementalist's Grinding Stones).
 *  - The ally-facing count uses either a dedicated `{{skill fact|allied targets|N}}` template
 *    (confirmed on Water Arrow, Blood Is Power, Banner of Strength/Discipline), OR the same generic
 *    `targets` template with an `alt=` param naming it explicitly (confirmed on Ray of Judgment:
 *    `{{skill fact|targets|alt=Number of Allied Targets|5}}`) — only these two shapes are trusted as
 *    an ally count; a bare `targets` template with no `allied`-labeled `alt=` is always treated as
 *    the untrusted enemy-facing count instead, exactly like the app's own runtime logic.
 *  - **Trait pages add a third shape, TRAIT candidates only**: several `TARGET_COUNT_OVERRIDES`
 *    trait entries exist *because* the trait grants a boon to allies with no target-count fact the
 *    API surfaces at all — but the wiki page itself may still document the true count under the
 *    infobox's dedicated `| missing facts = {{skill fact|targets|N}}` field (confirmed live on
 *    Phalanx Strength, trait 1711, which the curated table's own comment already names as "the one
 *    with an explicit wiki count"). A bare `targets` template found specifically inside that field
 *    is trusted as an ally count without needing an `allied`-labeled `alt=` — but ONLY for trait
 *    candidates: every curated trait entry exists specifically because it grants an ally boon with
 *    nothing else on the page competing for what a stray `targets` fact could mean, so `missing
 *    facts=` there can only plausibly be that ally count. Live-tried the same trust for SKILL
 *    candidates first and found it produces false positives: Lightning Flash's `missing facts =
 *    {{skill fact|targets|1}}` (a value of 1 is actually consistent with its curated self-only
 *    reading, not evidence against it — "1 target" is just the caster) and "Guard!"'s `missing
 *    facts = {{skill fact|effect|"Guard!" (effect)}}{{skill fact|targets|5}}` (the 5 most likely
 *    describes the adjacent, unrelated effect template, not an ally count) both got misread as
 *    contradicting a curated `'self'` entry before this was restricted to traits. Every hit from
 *    this shape is still logged under its own informational bucket so it's easy to spot-check.
 *  - Phalanx Strength's own wiki wording is "applies to 4 OTHER targets" (the template's raw value)
 *    for a curated total of 5 (4 others + the caster) — the curated table's own comment states this
 *    conversion explicitly. Whether that +1 convention generalizes to every `missing facts=` hit is
 *    unverified beyond this one precedent, so a raw wiki value of `curated - 1` is bucketed
 *    separately (OFF-BY-ONE) rather than silently treated as a match or a mismatch.
 *
 * Run manually via `npm run fetch-target-counts`, after `npm run fetch-game-data`.
 *
 * Writes `data/game-data/target-count-verification.json` at the end of every run (TODO.md's
 * "wire output to data/game-data/" step, 2026-08-08) via `scripts/lib/wiki-verification.ts` — one
 * record per curated candidate, capturing its outcome bucket + the wiki title/revision it was
 * checked against. This is an audit trail only: `TARGET_COUNT_OVERRIDES` itself remains the sole
 * source of truth the running app computes from, this file changes no app behavior. See that
 * module's own doc comment for why it lives in `data/game-data/` despite not being app-runtime
 * data.
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Skill, Trait } from '../src/shared/types/game-data'
import { TARGET_COUNT_OVERRIDES, type TargetCountOverride } from '../src/shared/boon-calc/sources'
import { fetchWikiPage, flushWikiCache, getWikiRevisionId } from './lib/wiki-cache'
import { writeVerificationFile, type WikiVerificationEntry } from './lib/wiki-verification'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
// Same gotcha as every other fetch-*.ts script: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

type SourceKind = 'skill' | 'trait'

/** Wiki article titles for shout-style skills keep surrounding quote marks the API's name drops
 *  (or vice versa) — try both forms, same helper as fetch-skill-coefficients.ts. */
function titleVariants(title: string): string[] {
  const unquoted = title.replace(/^"(.*)"$/, '$1')
  return unquoted === title ? [title, `"${title}"`] : [title, unquoted]
}

/** MediaWiki full-text search — used only as a name-collision fallback, not for primary candidate
 *  discovery (that's `TARGET_COUNT_OVERRIDES`'s own ids). */
async function searchCandidateTitles(query: string): Promise<string[]> {
  const url = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=20`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) return []
  const json = (await response.json()) as { query?: { search?: { title: string }[] } }
  return (json.query?.search ?? []).map((s) => s.title)
}

/** Extracts a `{{Skill infobox}}`/`{{Trait infobox}}`'s `| id = N` field — both infobox templates
 *  use the identical field name/shape, confirmed live on Phalanx Strength's Trait infobox. Some
 *  pages list a comma-separated LIST (land/underwater or similar variant pairs), same as
 *  fetch-skill-coefficients.ts's `parseInfoboxSkillIds` — always returns a list. */
function parseInfoboxIds(wikitext: string): number[] {
  const match = /\|\s*id\s*=\s*([^\n|}]+)/.exec(wikitext)
  if (!match) return []
  return match[1]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
}

type PageResolution =
  | { status: 'ok'; wikitext: string; title: string; method: 'direct' | 'disambiguated' | 'sibling' }
  | { status: 'not-found' }
  | { status: 'unresolved-collision'; note: string }

/** Resolves the correct wiki page for a candidate skill/trait, self-verifying via `| id = N` rather
 *  than trusting title-string matching alone — same three tiers as `fetch-skill-coefficients.ts`'s
 *  `resolveSkillPage` (direct title, then MediaWiki search-API fallback, then last-resort sibling-id
 *  attribution). The sibling tier turned out necessary here too: the initial two-tier version left
 *  44/379 candidates as an unresolved collision, and several are the EXACT same multi-id-page shape
 *  that script's own sibling tier exists for (`Deploy Jade Sphere`'s 20 element/tier variant ids
 *  sharing one wiki page that only lists a handful of them; Herald/Conduit's `Call to Anguish`
 *  land/underwater pair) — `curatedValuesEqual` mirrors that script's `curatedEntriesEqual`, just
 *  keyed on `TARGET_COUNT_OVERRIDES`' simpler `number | 'self'` value instead of a coefficient array. */
async function resolvePage(
  name: string,
  id: number,
  sourceKind: SourceKind,
  curated: TargetCountOverride,
  entityById: Map<number, { name: string }>,
  curatedTable: Record<number, TargetCountOverride>
): Promise<PageResolution> {
  const triedTitles: string[] = []
  const fetchedPages: { title: string; text: string; ids: number[] }[] = []
  let anyPageFound = false

  for (const title of titleVariants(name)) {
    triedTitles.push(title)
    const text = await fetchWikiPage(title)
    if (text === null) continue
    anyPageFound = true
    if (/\{\{\s*disambig/i.test(text)) continue // explicit disambiguation list page — needs search fallback
    const ids = parseInfoboxIds(text)
    fetchedPages.push({ title, text, ids })
    if (ids.includes(id)) return { status: 'ok', wikitext: text, title, method: 'direct' }
  }

  const candidates = await searchCandidateTitles(name)
  for (const candidate of candidates) {
    if (triedTitles.includes(candidate)) continue
    const text = await fetchWikiPage(candidate)
    if (text === null) continue
    anyPageFound = true
    const ids = parseInfoboxIds(text)
    fetchedPages.push({ title: candidate, text, ids })
    if (ids.includes(id)) return { status: 'ok', wikitext: text, title: candidate, method: 'disambiguated' }
  }

  // Last resort — see doc comment.
  for (const page of fetchedPages) {
    const siblingId = page.ids.find((pid) => {
      if (pid === id) return false
      const sib = entityById.get(pid)
      if (!sib || sib.name !== name) return false
      const sibCurated = curatedTable[pid]
      return sibCurated !== undefined && sibCurated === curated
    })
    if (siblingId !== undefined) return { status: 'ok', wikitext: page.text, title: page.title, method: 'sibling' }
  }

  if (!anyPageFound) return { status: 'not-found' }
  return {
    status: 'unresolved-collision',
    note: `tried [${triedTitles.join(', ')}] and ${candidates.length} search candidate(s), none had id=${id} (or an equivalent sibling)`
  }
}

/** Span of a named infobox field's value — from just after `| fieldName =` to the next `| key =`
 *  line or the infobox's own closing `}}`, whichever comes first. Used only to tell whether a
 *  `targets` template hit falls inside `| missing facts = ...` (see module doc comment's third
 *  bullet) — MediaWiki infobox fields aren't otherwise machine-delimited, so this is a heuristic,
 *  not a real parser; good enough for the one-line-per-field convention this wiki's infoboxes use
 *  in every page sampled so far. */
function fieldSpan(wikitext: string, fieldNameRegex: RegExp): [number, number] | null {
  const m = fieldNameRegex.exec(wikitext)
  if (!m) return null
  const start = m.index + m[0].length
  const rest = wikitext.slice(start)
  const endMatch = /\n\s*\|\s*[a-z][a-z0-9 _]*\s*=|\n\s*\}\}/i.exec(rest)
  const end = endMatch ? start + endMatch.index : wikitext.length
  return [start, end]
}

interface ParsedTargetFact {
  template: string // 'targets' or 'allied targets', as written
  value: number
  alliedLabeled: boolean // dedicated 'allied targets' template, or 'targets' with an allied-naming alt=
  inMissingFacts: boolean
}

/** Extracts every `{{skill fact|targets|...}}` / `{{skill fact|allied targets|...}}` invocation
 *  anywhere in the wikitext (works whether it's inside `facts=` or `missing facts=` — the regex
 *  doesn't care which field embeds it, same as every other fetch-*.ts script's template parsing).
 *  See module doc comment for which shapes count as a trustworthy ally count. */
function parseTargetFacts(wikitext: string): ParsedTargetFact[] {
  const out: ParsedTargetFact[] = []
  const missingSpan = fieldSpan(wikitext, /\|\s*missing facts\s*=/i)
  const templateRe = /\{\{\s*skill\s*fact\s*\|\s*(allied\s*targets|targets)\s*\|(.*?)\}\}/gis
  for (const match of wikitext.matchAll(templateRe)) {
    const template = match[1].toLowerCase().replace(/\s+/g, ' ').trim()
    const segments = match[2]
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
    let value: number | null = null
    let altIsAllied = false
    for (const seg of segments) {
      const kv = /^([a-z_ ]+?)\s*=\s*(.+)$/i.exec(seg)
      if (!kv) {
        const n = Number(seg)
        if (!Number.isNaN(n)) value = n // bare positional value
        continue
      }
      const key = kv[1].toLowerCase().replace(/\s+/g, '')
      if (key === 'alt' && /allied/i.test(kv[2])) altIsAllied = true
    }
    if (value === null) continue // no numeric value parsed — nothing to compare
    const idx = match.index ?? -1
    const inMissingFacts = missingSpan !== null && idx >= missingSpan[0] && idx < missingSpan[1]
    out.push({
      template,
      value,
      alliedLabeled: template === 'allied targets' || altIsAllied,
      inMissingFacts
    })
  }
  return out
}

interface CandidateResult {
  sourceKind: SourceKind
  id: number
  name: string
  curated: number | 'self'
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const traits = JSON.parse(await readFile(join(DATA_DIR, 'traits.json'), 'utf-8')) as Trait[]
  const skillsById = new Map(skills.map((s) => [s.id, s]))
  const traitsById = new Map(traits.map((t) => [t.id, t]))

  const candidates: CandidateResult[] = []
  for (const [idStr, curated] of Object.entries(TARGET_COUNT_OVERRIDES.skill)) {
    const id = Number(idStr)
    const skill = skillsById.get(id)
    candidates.push({ sourceKind: 'skill', id, name: skill?.name ?? `(unknown skill ${id})`, curated })
  }
  for (const [idStr, curated] of Object.entries(TARGET_COUNT_OVERRIDES.trait)) {
    const id = Number(idStr)
    const trait = traitsById.get(id)
    candidates.push({ sourceKind: 'trait', id, name: trait?.name ?? `(unknown trait ${id})`, curated })
  }

  console.log(
    `Pilot: re-deriving ${candidates.length} curated TARGET_COUNT_OVERRIDES entries` +
      ` (${Object.keys(TARGET_COUNT_OVERRIDES.skill).length} skill, ${Object.keys(TARGET_COUNT_OVERRIDES.trait).length} trait)` +
      ` from live wiki wikitext, diffing against the curated table...`
  )

  let matchNumber = 0
  let matchSelf = 0
  let offByOne = 0
  let disambiguatedCount = 0
  let siblingCount = 0
  const mismatches: string[] = []
  const offByOneLog: string[] = []
  const missing: string[] = []
  const ambiguous: string[] = []
  const selfButHasAllyFact: string[] = []
  const notFound: string[] = []
  const unresolvedCollisions: string[] = []
  const disambiguatedLog: string[] = []
  const siblingLog: string[] = []
  const missingFactsHits: string[] = []
  const records: WikiVerificationEntry[] = []

  let processed = 0
  for (const c of candidates) {
    const entity = c.sourceKind === 'skill' ? skillsById.get(c.id) : traitsById.get(c.id)
    if (!entity) {
      notFound.push(`${c.sourceKind} id ${c.id} not found in local game-data (curated=${c.curated})`)
      records.push({ sourceKind: c.sourceKind, id: c.id, name: c.name, status: 'not-found', curatedValue: c.curated, detail: 'not found in local game-data' })
      processed++
      continue
    }

    const entityById: Map<number, { name: string }> = c.sourceKind === 'skill' ? skillsById : traitsById
    const curatedTable = TARGET_COUNT_OVERRIDES[c.sourceKind]
    let resolution: PageResolution
    try {
      resolution = await resolvePage(entity.name, c.id, c.sourceKind, c.curated, entityById, curatedTable)
    } catch (err) {
      notFound.push(`fetch error: ${c.sourceKind} ${c.id} "${entity.name}" — ${(err as Error).message}`)
      records.push({ sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'not-found', curatedValue: c.curated, detail: `fetch error: ${(err as Error).message}` })
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${candidates.length}] checked...`)
      continue
    }

    if (resolution.status === 'not-found') {
      notFound.push(`no wiki page found for: ${c.sourceKind} ${c.id} "${entity.name}" (tried: ${titleVariants(entity.name).join(', ')})`)
      records.push({ sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'not-found', curatedValue: c.curated, detail: `no wiki page found (tried: ${titleVariants(entity.name).join(', ')})` })
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${candidates.length}] checked...`)
      continue
    }
    if (resolution.status === 'unresolved-collision') {
      unresolvedCollisions.push(`${c.sourceKind} ${c.id} "${entity.name}" — ${resolution.note}`)
      records.push({ sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'unresolved-collision', curatedValue: c.curated, detail: resolution.note })
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${candidates.length}] checked...`)
      continue
    }
    if (resolution.method === 'disambiguated') {
      disambiguatedCount++
      disambiguatedLog.push(`${c.sourceKind} ${c.id} "${entity.name}" — resolved via search to "${resolution.title}"`)
    } else if (resolution.method === 'sibling') {
      siblingCount++
      siblingLog.push(`${c.sourceKind} ${c.id} "${entity.name}" — attributed to "${resolution.title}" via a sibling id TARGET_COUNT_OVERRIDES already asserts an identical curated value for`)
    }
    const wikiTitle = resolution.title
    const wikiRevisionId = getWikiRevisionId(resolution.title)

    const parsed = parseTargetFacts(resolution.wikitext)
    // A bare (unlabeled) 'targets' template inside missing facts= is only trusted as an ally count
    // for TRAIT candidates — the one live precedent for this shape (Phalanx Strength) is a trait,
    // and a live spot-check of the two skill-candidate hits this heuristic originally also matched
    // (Lightning Flash: `targets|1`, sitting alongside no ally-boon evidence — a value of 1 is
    // actually consistent with the curated self-only reading, not evidence against it; "Guard!":
    // `targets|5` sitting next to an unrelated `{{skill fact|effect|"Guard!" (effect)}}` template,
    // most likely describing the pet's own effect targeting, not an ally count) showed it produces
    // false positives on skill pages, where `missing facts=` can describe unrelated foe/pet-facing
    // data the API also omits. Trait pages don't share that ambiguity for this candidate set: every
    // TARGET_COUNT_OVERRIDES trait entry exists specifically because the trait grants a boon to
    // allies with nothing else on the page competing for what a stray `targets` fact could mean.
    const allyFacts = parsed.filter((p) => p.alliedLabeled || (p.inMissingFacts && c.sourceKind === 'trait'))
    const distinctValues = [...new Set(allyFacts.map((p) => p.value))]
    if (allyFacts.some((p) => p.inMissingFacts && !p.alliedLabeled)) {
      missingFactsHits.push(
        `${c.sourceKind} ${c.id} "${entity.name}" — bare 'targets' template found inside missing facts=` +
          ` field, treated as an ally count (value(s): ${distinctValues.join(', ')})`
      )
    }

    if (c.curated === 'self') {
      if (distinctValues.length === 0) {
        matchSelf++
        records.push({ sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'match', curatedValue: 'self', wikiTitle, wikiRevisionId })
      } else {
        selfButHasAllyFact.push(
          `${c.sourceKind} ${c.id} "${entity.name}" — curated 'self' but wiki has an ally-labeled targets` +
            ` fact of ${distinctValues.join('/')} (may describe a DIFFERENT boon on the same multi-boon` +
            ` source, per this table's own documented per-buff-line-conflict exclusions — needs a human read,` +
            ` not auto-corrected here)`
        )
        records.push({
          sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'mismatch', curatedValue: 'self',
          wikiValue: distinctValues.join('/'), wikiTitle, wikiRevisionId,
          detail: 'may describe a different boon on the same multi-boon source — needs a human read'
        })
      }
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${candidates.length}] checked...`)
      continue
    }

    if (distinctValues.length === 0) {
      missing.push(`${c.sourceKind} ${c.id} "${entity.name}" — no ally-labeled targets fact found on wiki (curated=${c.curated})`)
      records.push({ sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'missing', curatedValue: c.curated, wikiTitle, wikiRevisionId })
    } else if (distinctValues.length > 1) {
      ambiguous.push(`${c.sourceKind} ${c.id} "${entity.name}" — multiple conflicting ally-count values found: ${distinctValues.join(', ')} (curated=${c.curated})`)
      records.push({ sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'ambiguous', curatedValue: c.curated, wikiValue: distinctValues.join(', '), wikiTitle, wikiRevisionId })
    } else {
      const wikiValue = distinctValues[0]
      if (wikiValue === c.curated) {
        matchNumber++
        records.push({ sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'match', curatedValue: c.curated, wikiValue, wikiTitle, wikiRevisionId })
      } else if (wikiValue === c.curated - 1) {
        offByOne++
        offByOneLog.push(`${c.sourceKind} ${c.id} "${entity.name}" — curated=${c.curated}, wiki-derived=${wikiValue} (curated - 1)`)
        records.push({ sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'off-by-one', curatedValue: c.curated, wikiValue, wikiTitle, wikiRevisionId })
      } else {
        mismatches.push(`${c.sourceKind} ${c.id} "${entity.name}" — curated=${c.curated}, wiki-derived=${wikiValue}`)
        records.push({ sourceKind: c.sourceKind, id: c.id, name: entity.name, status: 'mismatch', curatedValue: c.curated, wikiValue, wikiTitle, wikiRevisionId })
      }
    }

    processed++
    if (processed % 50 === 0) console.log(`  [${processed}/${candidates.length}] checked...`)
  }

  console.log(`\nDone. ${processed}/${candidates.length} candidates checked.`)
  console.log(`  MATCH (numeric):                 ${matchNumber}`)
  console.log(`  MATCH (self-only, no ally fact):  ${matchSelf}`)
  console.log(`  OFF-BY-ONE (wiki = curated - 1):  ${offByOne}`)
  console.log(`  MISMATCH:                         ${mismatches.length}`)
  console.log(`  AMBIGUOUS (conflicting values):   ${ambiguous.length}`)
  console.log(`  MISSING (no wiki evidence):       ${missing.length}`)
  console.log(`  SELF-CURATED BUT WIKI HAS FACT:   ${selfButHasAllyFact.length}`)
  console.log(`  NOT FOUND:                        ${notFound.length}`)
  console.log(`  UNRESOLVED COLLISION:             ${unresolvedCollisions.length}`)
  console.log(`  (of which resolved via search-API disambiguation: ${disambiguatedCount})`)
  console.log(`  (of which resolved via sibling-id attribution: ${siblingCount})`)
  console.log(`  (of which used a missing facts= bare 'targets' hit: ${missingFactsHits.length})`)

  const section = (title: string, lines: string[]): void => {
    if (lines.length === 0) return
    console.log(`\n--- ${title} ---`)
    for (const line of lines) console.log(`  - ${line}`)
  }

  section('MISMATCH (curated value disagrees with a re-derived wiki value)', mismatches)
  section('OFF-BY-ONE (wiki value = curated - 1 — possibly the Phalanx Strength "N other targets" convention)', offByOneLog)
  section('AMBIGUOUS (multiple conflicting ally-count values found)', ambiguous)
  section('SELF-CURATED BUT WIKI HAS AN ALLY-LABELED FACT (needs a human read)', selfButHasAllyFact)
  section('MISSING (curated relies on the default-5 assumption, or prose only — no wiki evidence either way)', missing)
  section('NOT FOUND', notFound)
  section('UNRESOLVED COLLISION (no candidate page\'s id= matched — needs a human read)', unresolvedCollisions)
  section('Resolved via search-API disambiguation (informational, not an error)', disambiguatedLog)
  section('Resolved via sibling-id attribution (informational, not an error)', siblingLog)
  section("Used a 'missing facts=' bare targets hit (informational — spot-check these)", missingFactsHits)

  await flushWikiCache()
  await writeVerificationFile(
    'target-count-verification.json',
    { sourceTable: 'TARGET_COUNT_OVERRIDES', script: 'fetch-target-counts.ts' },
    records
  )
  console.log(`\nWrote ${records.length} verification records to data/game-data/target-count-verification.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
