/**
 * TODO.md's "Wiki-sourced data pipeline" step 4 — "Curation-side change detection": how *we* learn
 * a balance patch changed a coefficient this app has already hand-curated, so
 * `CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS` don't
 * silently go stale. Direction chosen 2026-08-04 (see TODO.md): the wiki's `Category:Balance
 * updates` gives a small, bounded, dated list of patch pages (59 found live, back to 2022) whose
 * "Profession Skills" sections use a diffable `"<field> from <A> to <B>[ in <mode>[ only]]"` prose
 * shape next to a `{{game update icon|<exact wiki title>|<display>}}` (or `{{skill icon|...}}`/
 * `{{simple icon|...}}`/`{{trait icon|...}}`) marker — unlike the skill-page sweep
 * (`fetch-skill-coefficients.ts`), this gives the OLD value too, not just the current one, so it can
 * tell "curated table already reflects this patch" (match) apart from "curated table still has the
 * pre-patch number" (stale) instead of just "disagrees with today's wiki" either way.
 *
 * **Known limitation, called out in TODO.md**: prose-only reworks (moving a bonus between traits,
 * changing a trait's own flat %, anything not phrased as "<field> from A to B") produce no diffable
 * signal here — still needs a periodic human read, same as the Renegade-trait-rework case that
 * originally prompted this scoping.
 *
 * Scope of this pass (surveyed live against all 59 patch pages before writing the parser — see
 * `KNOWN_LABELS` below for the exact 3 curated tables/2 field shapes covered): "power coefficient"
 * (damage), "heal(ing) coefficient"/"heal(ing) attribute scaling" (healing), "barrier
 * coefficient"/"barrier attribute scaling" (barrier), "base heal(ing)" (healing baseValue), "base
 * barrier" (barrier baseValue). Deliberately NOT covered this pass, despite being the same "from A
 * to B" shape and already having their own curated tables (`TARGET_COUNT_OVERRIDES`,
 * `CONDITION_CLEANSE_TARGETS` in `sources.ts`): "targets from"/"allied targets from"/"conditions
 * removed from" — same regex skeleton would work, just not built here, see TODO.md.
 *
 * Curated tables store the WvW-verified value (see each table's own doc comment) — a patch line
 * tagged "in PvE only" or "in PvP only" (no WvW) therefore can't move the curated value at all and
 * is deliberately excluded from comparison, not treated as a mismatch. A line with no mode suffix
 * applies everywhere (including WvW); a line explicitly naming WvW is obviously relevant too.
 *
 * Because this scans the FULL 2022-2026 patch history in one pass (not just "since last check" —
 * there's no persisted watermark, the whole category is small/cache-backed and re-scanning it is
 * cheap), only the MOST RECENT patch touching a given (skill, table, field) is actually compared
 * against today's curated value — an older patch's "new" value being neither today's curated value
 * nor that old patch's own numbers is completely expected once a later patch has changed the same
 * field again, not a red flag. Earlier patches in the same group are kept in the output only as
 * `priorPatches` context.
 *
 * Skill resolution deliberately skips `fetch-skill-coefficients.ts`'s whole name-collision search-API
 * machinery: `{{game update icon|X}}`'s first param IS the exact current wiki page title already (no
 * guessing needed), so this only ever does one direct `| id = N` fetch per resolved title. A page
 * whose `id=` lists more than one id (the same multi-id-page shape `fetch-skill-coefficients.ts`
 * documents) is resolved only if exactly one of those ids has ANY curated entry in the relevant
 * table — otherwise left an honest `ambiguous-multiple-ids` skip.
 *
 * Run manually via `npm run fetch-balance-patch-changes`, after `npm run fetch-game-data`. Writes
 * `data/game-data/balance-patch-verification.json` (same "audit trail only, not consumed by the
 * app" contract as `skill-coefficient-verification.json`/`target-count-verification.json` — see
 * `docs/game-data.md`'s "Wiki-verification audit trail" section).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Skill } from '../src/shared/types/game-data'
import { CURATED_DAMAGE_COEFFICIENTS } from '../src/shared/skill-calc/damage-calc'
import { CURATED_HEALING_COEFFICIENTS } from '../src/shared/skill-calc/healing-calc'
import { CURATED_BARRIER_COEFFICIENTS } from '../src/shared/skill-calc/barrier-calc'
import { fetchWikiPage, flushWikiCache } from './lib/wiki-cache'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
// Same gotcha as every other fetch-*.ts script: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'
const REQUEST_DELAY_MS = 150

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Every dated patch page under `Category:Balance updates`, paginated the same way
 *  `fetch-elite-spec-skills.ts`'s `fetchSpecSkillPages` handles `continue` tokens. Sorted
 *  chronologically — `Game updates/YYYY-MM-DD` titles sort correctly as plain strings. */
async function fetchBalanceUpdateTitles(): Promise<string[]> {
  const titles: string[] = []
  let continueParams: Record<string, string> = {}
  for (;;) {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: 'Category:Balance updates',
      cmlimit: '500',
      format: 'json',
      formatversion: '2',
      ...continueParams
    })
    const response = await fetch(`${WIKI_API}?${params.toString()}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`categorymembers fetch failed: ${response.status} ${response.statusText}`)
    const json = (await response.json()) as {
      query?: { categorymembers?: { title: string }[] }
      continue?: Record<string, string>
    }
    for (const member of json.query?.categorymembers ?? []) {
      if (member.title.startsWith('Game updates/')) titles.push(member.title)
    }
    if (json.continue) {
      continueParams = json.continue
      await sleep(REQUEST_DELAY_MS)
    } else {
      break
    }
  }
  return titles.sort()
}

/** Extracts a `{{Skill infobox}}`/`{{Trait infobox}}`'s `| id = N` field — same shape as
 *  `fetch-skill-coefficients.ts`'s `parseInfoboxSkillIds` (several pages list a comma-separated id
 *  LIST, not a single number, e.g. a land+underwater or base+elite-spec-gated pair sharing one
 *  page). Not imported from there — every fetch-*.ts script owns its small parse helpers, same
 *  precedent as `titleVariants` being duplicated per-script rather than shared. */
function parseInfoboxIds(wikitext: string): number[] {
  const match = /\|\s*id\s*=\s*([^\n|}]+)/.exec(wikitext)
  if (!match) return []
  return match[1]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
}

/** Finds the first `{{game update icon|X}}`/`{{skill icon|X}}`/`{{simple icon|X}}`/`{{trait
 *  icon|X}}` marker on a line (all four share the "first positional param = exact wiki page
 *  title" convention, live-verified across the patch pages surveyed) and returns that title plus
 *  the rest of the line as the description text to scan for "from A to B" clauses. A line with more
 *  than one marker (rare — a change note mentioning a second skill/trait by name) only ever
 *  attributes to the FIRST one; accepted as a known simplification, not chased further. Returns null
 *  for a line with no marker at all (most lines — general prose, not a per-skill change). */
function extractTitleAndDescription(line: string): { title: string; description: string } | null {
  const iconRe = /\{\{\s*(?:game update icon|skill icon|simple icon|trait icon)\s*\|([^}]*)\}\}/i
  const m = iconRe.exec(line)
  if (!m) return null
  const title = m[1].split('|')[0].trim()
  if (!title) return null
  return { title, description: line.slice(m.index + m[0].length) }
}

/** Mode suffix right after "to B", e.g. " in WvW only", " in PvP and WvW", "" (no suffix = applies
 *  everywhere). Returns null for "no suffix" (universal change), else the uppercased mode token
 *  list. */
function parseModeTokens(tail: string): string[] | null {
  const modeMatch = /\bin\s+((?:PvE|PvP|WvW)(?:\s*,?\s*(?:and|&)\s*(?:PvE|PvP|WvW))*)/i.exec(tail)
  if (!modeMatch) return null
  const tokens = modeMatch[1].match(/PvE|PvP|WvW/gi) ?? []
  return tokens.map((t) => t.toUpperCase())
}

type TableKind = 'damage' | 'healing' | 'barrier'
type FieldKind = 'coefficient' | 'baseValue'

const TABLE_NAMES: Record<TableKind, string> = {
  damage: 'CURATED_DAMAGE_COEFFICIENTS',
  healing: 'CURATED_HEALING_COEFFICIENTS',
  barrier: 'CURATED_BARRIER_COEFFICIENTS'
}

/** Live-surveyed label phrasings (2026-08-08, against all 59 `Category:Balance updates` pages —
 *  see this file's own doc comment for the ones deliberately left out). Order doesn't matter; the 3
 *  healing-table labels are mutually exclusive shapes on the wiki (never seen combined on one line
 *  for the same clause) and so are the 2 barrier-table ones. The damage label's negative lookbehind
 *  is load-bearing: "healing power coefficient" (Healing-Power-scaling barrier/healing skills like
 *  Effulgent Stance use this exact phrase, 25 live occurrences across the corpus) contains "power
 *  coefficient" as a literal substring — without excluding a preceding "healing ", this mislabels a
 *  healing-table clause as a damage-table one. */
const KNOWN_LABELS: { source: string; table: TableKind; field: FieldKind }[] = [
  { source: '(?<!healing )power coefficient', table: 'damage', field: 'coefficient' },
  { source: 'heal(?:ing)? coefficient', table: 'healing', field: 'coefficient' },
  { source: 'heal(?:ing)? attribute scaling', table: 'healing', field: 'coefficient' },
  { source: 'barrier coefficient', table: 'barrier', field: 'coefficient' },
  { source: 'barrier attribute scaling', table: 'barrier', field: 'coefficient' },
  { source: 'base heal(?:ing)?', table: 'healing', field: 'baseValue' },
  { source: 'base barrier', table: 'barrier', field: 'baseValue' }
]

interface RawChange {
  patchDate: string
  patchTitle: string
  wikiTitle: string
  table: TableKind
  field: FieldKind
  oldValue: number
  newValue: number
  modeTokens: string[] | null
  /** True when the clause is phrased "pulse <label> from..." or "<label> per <word> from..." — a
   *  PER-HIT value, not the totaled-across-hits value `CURATED_DAMAGE_COEFFICIENTS.coefficient`
   *  itself stores (see that type's own doc comment; `fetch-skill-coefficients.ts`'s
   *  `parseDamageFactLines`/main loop does this exact same strikes-multiplication when reading the
   *  wiki's structured `{{skill fact|damage}}` template — this is the same fact, reached via prose
   *  instead). Live-verified motivating case (2026-08-08): Ice Shards' 2020-02-25 patch states
   *  "Reduced power coefficient per strike from 0.24 to 0.16" — curated value is 0.48 (0.16 * 3
   *  strikes), which raw string comparison would otherwise flag as a false MISMATCH. */
  perHit: boolean
}

/** Every `<label> from A to B` clause in a description, for every known label — a line can carry
 *  several, either as separate sentences ("Reduced base heal from 372 to 223. Reduced heal
 *  coefficient from 0.25 to 0.15.") or joined by "and" within ONE sentence ("Reduced the base
 *  barrier from 3,973 to 2,245 and increased the healing power coefficient from 0.2 to 1.0 in PvE
 *  only."). The optional leading "pulse " and trailing "per \w+" both mark a per-hit value (see
 *  `RawChange.perHit`'s own doc comment); the trailing capture group is where `parseModeTokens`
 *  looks for a mode suffix — it has to tolerate embedded decimal points ("0.2", "1.0") without
 *  treating them as the sentence-ending period, only a period NOT followed by a digit really ends
 *  the clause (live bug found + fixed 2026-08-08: a naive `[^.]*` stopped at the "0." inside "0.2"
 *  and truncated the tail before the trailing "in PvE only" it needed to see). */
function parseChangeClauses(description: string): Omit<RawChange, 'patchDate' | 'patchTitle' | 'wikiTitle'>[] {
  const out: Omit<RawChange, 'patchDate' | 'patchTitle' | 'wikiTitle'>[] = []
  for (const spec of KNOWN_LABELS) {
    const re = new RegExp(`(pulse\\s+)?${spec.source}(?:\\s+per\\s+(\\w+))?\\s+from\\s+([\\d,]+(?:\\.\\d+)?)\\s+to\\s+([\\d,]+(?:\\.\\d+)?)((?:[^.]|\\.(?=\\d))*)\\.(?!\\d)`, 'gi')
    for (const m of description.matchAll(re)) {
      const oldValue = Number(m[3].replace(/,/g, ''))
      const newValue = Number(m[4].replace(/,/g, ''))
      if (Number.isNaN(oldValue) || Number.isNaN(newValue)) continue
      out.push({ table: spec.table, field: spec.field, oldValue, newValue, modeTokens: parseModeTokens(m[5]), perHit: Boolean(m[1] || m[2]) })
    }
  }
  return out
}

/** Same normalization `fetch-skill-coefficients.ts`'s `byFactText` map uses — not shared, same
 *  per-script-owns-its-helpers precedent as `parseInfoboxIds` above. Used both to look up a
 *  multi-hit skill's own `hit_count` (for `perHit` clauses) and to key into the existing
 *  `skill-coefficient-verification.json` audit trail for corroboration. */
function normalizeFactText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** For a `perHit`-phrased damage clause, the local API's own `hit_count` on the matching Damage fact
 *  — same lookup `fetch-skill-coefficients.ts`'s main loop does before comparing a non-`strikes=`
 *  wiki line to the curated (totaled) value. Falls back to 1 (no-op multiplier) when no matching
 *  fact/hit_count is found, so an unresolvable lookup never silently suppresses a real mismatch. */
function damageHitCount(skill: Skill, factText: string): number {
  const norm = normalizeFactText(factText)
  const fact = skill.facts.find((f) => f.type === 'Damage' && normalizeFactText(f.text ?? '') === norm)
  return typeof fact?.hit_count === 'number' && fact.hit_count > 0 ? fact.hit_count : 1
}

interface LiveWikiLookupEntry {
  status: string
  wikiValue?: number | string
}

/** Cross-corroboration against `fetch-skill-coefficients.ts`'s own already-written audit trail
 *  (`data/game-data/skill-coefficient-verification.json`, damage table only — Healing/Barrier have
 *  no equivalent live-wiki sweep yet). A `stale`/`mismatch` outcome here whose (id, factText) is a
 *  `match` in that file means TODAY's live wiki page already agrees with the curated value — the
 *  patch this script flagged was likely reverted or superseded by a later patch outside `Category:
 *  Balance updates` (that category isn't guaranteed complete, just the wiki's own best list of major
 *  patches — live-verified 2026-08-08: Swoop's curated value 1 is corroborated `match` there despite
 *  a 2020-02-25 patch note saying "1.0 to 0.91" with no later Balance-updates-category patch
 *  reverting it), not a real gap in curation. Returns an empty map (corroboration simply
 *  unavailable, not fatal) if that file hasn't been generated yet. */
async function loadLiveDamageVerification(): Promise<Map<string, LiveWikiLookupEntry>> {
  const map = new Map<string, LiveWikiLookupEntry>()
  try {
    const raw = JSON.parse(await readFile(join(DATA_DIR, 'skill-coefficient-verification.json'), 'utf-8')) as {
      entries: { id: number; factText?: string; status: string; wikiValue?: number | string }[]
    }
    for (const e of raw.entries) {
      if (e.factText === undefined) continue
      map.set(`${e.id}|${normalizeFactText(e.factText)}`, { status: e.status, wikiValue: e.wikiValue })
    }
  } catch {
    // not generated yet (or unreadable) — corroboration simply unavailable this run
  }
  return map
}

/** Normalized curated-entry shape across all 3 tables — `DamageCoefficient` has no `baseValue` at
 *  all (damage has no wiki "base damage" concept, purely coefficient*Power), so it's optional here
 *  and only ever read when `field === 'baseValue'` (never true for the damage table, see
 *  `KNOWN_LABELS`). */
interface CuratedEntryLike {
  factText: string
  requiresTrait?: number
  coefficient: number
  baseValue?: number
}
function getCuratedEntries(table: TableKind, id: number): CuratedEntryLike[] {
  if (table === 'damage') return CURATED_DAMAGE_COEFFICIENTS[id] ?? []
  if (table === 'healing') return CURATED_HEALING_COEFFICIENTS[id] ?? []
  return CURATED_BARRIER_COEFFICIENTS[id] ?? []
}

type Outcome =
  | 'match' // curated value already reflects this (latest) patch's new value
  | 'stale' // curated value is still this patch's OLD value — needs re-curation
  | 'mismatch' // curated value is neither old nor new — needs a human look (could be a later, unlisted change)
  | 'not-curated' // resolved to a real skill, but it has no entry in the relevant curated table
  | 'not-a-skill' // id resolved, but isn't in local skills.json (a trait, or a since-removed skill)
  | 'ambiguous-multiple-entries' // >1 non-trait-gated curated entry for this id; patch note doesn't say which factText
  | 'ambiguous-multiple-ids' // page's own id= lists >1 id, and not exactly one has curated entries to disambiguate with
  | 'title-not-found' // no wiki page (or no id=) at this exact title

interface OutcomeEntry {
  wikiTitle: string
  table: TableKind
  field: FieldKind
  skillId?: number
  skillName?: string
  latestPatchDate: string
  patchTitle: string
  oldValue: number
  newValue: number
  priorPatches: number // earlier patches also touching this (wikiTitle, table, field) — context only, not compared
  curatedFactText?: string
  curatedValue?: number
  /** Set only when `perHit` was true and a >1 hit_count was actually applied — the old/new values
   *  actually compared are `oldValue`/`newValue` times this, not the raw patch-note numbers (see
   *  `RawChange.perHit`'s doc comment). */
  hitCountApplied?: number
  outcome: Outcome
  /** For a damage-table `stale`/`mismatch` outcome only: what `skill-coefficient-verification.json`
   *  (today's live-wiki value) says about this same (id, factText) — see
   *  `loadLiveDamageVerification`'s doc comment. Absent when no corroboration data exists (Healing/
   *  Barrier tables, or the id/factText wasn't in that file). */
  liveWikiCorroboration?: string
  detail?: string
}

const EPS_COEFFICIENT = 0.005
const EPS_BASE_VALUE = 0.5

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const skillsById = new Map(skills.map((s) => [s.id, s]))
  const liveDamageVerification = await loadLiveDamageVerification()

  console.log('Fetching Category:Balance updates page list...')
  const patchTitles = await fetchBalanceUpdateTitles()
  console.log(`Found ${patchTitles.length} dated balance-update patch pages (2022-present).`)

  const rawChanges: RawChange[] = []
  let scanned = 0
  for (const patchTitle of patchTitles) {
    const text = await fetchWikiPage(patchTitle)
    scanned++
    if (!text) {
      console.log(`  WARNING: no wikitext for "${patchTitle}" (skipped)`)
      continue
    }
    const patchDate = patchTitle.replace(/^Game updates\//, '')
    for (const line of text.split('\n')) {
      const extracted = extractTitleAndDescription(line)
      if (!extracted) continue
      for (const clause of parseChangeClauses(extracted.description)) {
        rawChanges.push({ patchDate, patchTitle, wikiTitle: extracted.title, ...clause })
      }
    }
    if (scanned % 10 === 0) console.log(`  [${scanned}/${patchTitles.length}] patch pages scanned...`)
  }

  console.log(`\nParsed ${rawChanges.length} coefficient/base-value change clauses across ${patchTitles.length} patches.`)
  const wvwRelevant = rawChanges.filter((c) => c.modeTokens === null || c.modeTokens.includes('WVW'))
  console.log(`  ${wvwRelevant.length} WvW-relevant (no mode suffix, or explicitly names WvW) — only these can move a curated value.`)
  console.log(`  ${rawChanges.length - wvwRelevant.length} PvE-only/PvP-only — can't affect the WvW-verified curated value, not compared.`)

  // Group by (wikiTitle, table, field); only the chronologically LATEST clause per group is worth
  // comparing against today's curated value (see module doc comment).
  const groups = new Map<string, RawChange[]>()
  for (const c of wvwRelevant) {
    const key = `${c.wikiTitle} ${c.table} ${c.field}`
    const list = groups.get(key) ?? []
    list.push(c)
    groups.set(key, list)
  }
  console.log(`  ${groups.size} distinct (skill, table, field) groups — comparing each group's most recent patch only.\n`)

  const outcomes: OutcomeEntry[] = []
  let groupsProcessed = 0
  for (const list of groups.values()) {
    groupsProcessed++
    list.sort((a, b) => a.patchDate.localeCompare(b.patchDate))
    const latest = list[list.length - 1]
    const priorPatches = list.length - 1
    const base = { wikiTitle: latest.wikiTitle, table: latest.table, field: latest.field, latestPatchDate: latest.patchDate, patchTitle: latest.patchTitle, oldValue: latest.oldValue, newValue: latest.newValue, priorPatches }

    const text = await fetchWikiPage(latest.wikiTitle)
    if (!text) {
      outcomes.push({ ...base, outcome: 'title-not-found', detail: 'no wiki page at this exact title (patch-icon title may have since been renamed/merged)' })
      continue
    }
    const ids = parseInfoboxIds(text)
    let resolvedId: number | undefined
    if (ids.length === 1) {
      resolvedId = ids[0]
    } else if (ids.length > 1) {
      const withEntries = ids.filter((id) => getCuratedEntries(latest.table, id).length > 0)
      if (withEntries.length === 1) resolvedId = withEntries[0]
    }
    if (resolvedId === undefined) {
      outcomes.push({
        ...base,
        outcome: ids.length === 0 ? 'title-not-found' : 'ambiguous-multiple-ids',
        detail: ids.length === 0 ? 'page has no id= field' : `page id= lists [${ids.join(', ')}], not exactly one has curated entries`
      })
      continue
    }

    const skill = skillsById.get(resolvedId)
    if (!skill) {
      outcomes.push({ ...base, skillId: resolvedId, outcome: 'not-a-skill', detail: `id ${resolvedId} not in local skills.json — likely a trait or a since-removed skill` })
      continue
    }

    const entries = getCuratedEntries(latest.table, resolvedId).filter((e) => e.requiresTrait === undefined)
    if (entries.length === 0) {
      outcomes.push({ ...base, skillId: resolvedId, skillName: skill.name, outcome: 'not-curated', detail: `not present in ${TABLE_NAMES[latest.table]}` })
      continue
    }
    if (entries.length > 1) {
      outcomes.push({
        ...base, skillId: resolvedId, skillName: skill.name, outcome: 'ambiguous-multiple-entries',
        detail: `${entries.length} curated entries (factTexts: ${entries.map((e) => e.factText).join(', ')}) — patch note doesn't say which`
      })
      continue
    }

    const entry = entries[0]
    const curatedValue = latest.field === 'coefficient' ? entry.coefficient : (entry.baseValue as number)
    const eps = latest.field === 'coefficient' ? EPS_COEFFICIENT : EPS_BASE_VALUE

    // A perHit-phrased damage clause states the PER-STRIKE value; the curated table stores the
    // totaled-across-hits value (same convention `fetch-skill-coefficients.ts` already handles) —
    // see `RawChange.perHit`'s doc comment.
    let compareOld = latest.oldValue
    let compareNew = latest.newValue
    let hitCountApplied: number | undefined
    if (latest.table === 'damage' && latest.field === 'coefficient' && latest.perHit) {
      const hitCount = damageHitCount(skill, entry.factText)
      if (hitCount > 1) {
        compareOld = latest.oldValue * hitCount
        compareNew = latest.newValue * hitCount
        hitCountApplied = hitCount
      }
    }

    let outcome: Outcome
    if (Math.abs(curatedValue - compareNew) <= eps) outcome = 'match'
    else if (Math.abs(curatedValue - compareOld) <= eps) outcome = 'stale'
    else outcome = 'mismatch'

    let liveWikiCorroboration: string | undefined
    if (latest.table === 'damage' && (outcome === 'stale' || outcome === 'mismatch')) {
      liveWikiCorroboration = liveDamageVerification.get(`${resolvedId}|${normalizeFactText(entry.factText)}`)?.status
    }

    outcomes.push({
      ...base, skillId: resolvedId, skillName: skill.name, curatedFactText: entry.factText, curatedValue,
      hitCountApplied, outcome, liveWikiCorroboration
    })

    if (groupsProcessed % 50 === 0) console.log(`  [${groupsProcessed}/${groups.size}] groups resolved...`)
  }

  const counts: Partial<Record<Outcome, number>> = {}
  for (const o of outcomes) counts[o.outcome] = (counts[o.outcome] ?? 0) + 1

  console.log(`\nDone. ${outcomes.length} (skill, table, field) groups checked against their most recent patch.`)
  console.log(`  MATCH:                       ${counts.match ?? 0}`)
  console.log(`  STALE (needs re-curation!):  ${counts.stale ?? 0}`)
  console.log(`  MISMATCH (neither old/new):  ${counts.mismatch ?? 0}`)
  console.log(`  not-curated:                 ${counts['not-curated'] ?? 0}`)
  console.log(`  not-a-skill:                 ${counts['not-a-skill'] ?? 0}`)
  console.log(`  ambiguous-multiple-entries:  ${counts['ambiguous-multiple-entries'] ?? 0}`)
  console.log(`  ambiguous-multiple-ids:      ${counts['ambiguous-multiple-ids'] ?? 0}`)
  console.log(`  title-not-found:             ${counts['title-not-found'] ?? 0}`)

  const stale = outcomes.filter((o) => o.outcome === 'stale')
  if (stale.length > 0) {
    const staleGenuine = stale.filter((o) => o.liveWikiCorroboration !== 'match')
    const staleCorroboratedCurrent = stale.filter((o) => o.liveWikiCorroboration === 'match')
    console.log(`\n--- STALE, likely genuine (curated value = this patch's OLD value; today's live wiki doesn't contradict it) ---`)
    for (const o of staleGenuine) {
      const hitNote = o.hitCountApplied ? ` (x${o.hitCountApplied} hit_count applied)` : ''
      console.log(`  - ${o.skillName} (id ${o.skillId}) / ${TABLE_NAMES[o.table]} "${o.curatedFactText}": curated=${o.curatedValue}, patch ${o.latestPatchDate} changed ${o.oldValue} -> ${o.newValue}${hitNote}`)
    }
    if (staleCorroboratedCurrent.length > 0) {
      console.log(`\n--- STALE, but likely a FALSE POSITIVE (today's live-wiki sweep already says curated=match — this patch's change was probably reverted/superseded by a later patch outside Category:Balance updates) ---`)
      for (const o of staleCorroboratedCurrent) {
        console.log(`  - ${o.skillName} (id ${o.skillId}) / ${TABLE_NAMES[o.table]} "${o.curatedFactText}": curated=${o.curatedValue}, patch ${o.latestPatchDate} changed ${o.oldValue} -> ${o.newValue}`)
      }
    }
  }
  const mismatch = outcomes.filter((o) => o.outcome === 'mismatch')
  if (mismatch.length > 0) {
    console.log(`\n--- MISMATCH (curated value is neither this patch's old nor new value — see module doc comment: this bucket is`)
    console.log(`    dominated by real-but-unmodeled shapes, not necessarily curation errors — spot-check before trusting) ---`)
    for (const o of mismatch) {
      const hitNote = o.hitCountApplied ? ` (x${o.hitCountApplied} hit_count applied)` : ''
      const corrobNote = o.liveWikiCorroboration ? ` [live-wiki today: ${o.liveWikiCorroboration}]` : ''
      console.log(`  - ${o.skillName} (id ${o.skillId}) / ${TABLE_NAMES[o.table]} "${o.curatedFactText}": curated=${o.curatedValue}, patch ${o.latestPatchDate} changed ${o.oldValue} -> ${o.newValue}${hitNote}${corrobNote}`)
    }
  }
  const ambiguous = outcomes.filter((o) => o.outcome === 'ambiguous-multiple-entries' || o.outcome === 'ambiguous-multiple-ids')
  if (ambiguous.length > 0) {
    console.log(`\n--- AMBIGUOUS (couldn't pick a single curated entry/id automatically) ---`)
    for (const o of ambiguous) console.log(`  - "${o.wikiTitle}" / ${TABLE_NAMES[o.table]}.${o.field}, patch ${o.latestPatchDate}: ${o.detail}`)
  }
  const notFound = outcomes.filter((o) => o.outcome === 'title-not-found')
  if (notFound.length > 0) {
    console.log(`\n--- TITLE NOT FOUND ---`)
    for (const o of notFound) console.log(`  - "${o.wikiTitle}" (patch ${o.latestPatchDate}): ${o.detail}`)
  }

  await flushWikiCache()

  const file = {
    script: 'fetch-balance-patch-changes.ts',
    sourceCategory: 'Category:Balance updates',
    generatedAt: new Date().toISOString(),
    patchPagesScanned: patchTitles.length,
    totalChangeClausesParsed: rawChanges.length,
    wvwRelevantClauses: wvwRelevant.length,
    groupsCompared: outcomes.length,
    summary: counts,
    entries: outcomes
  }
  await writeFile(join(DATA_DIR, 'balance-patch-verification.json'), JSON.stringify(file, null, 2))
  console.log(`\nWrote ${outcomes.length} verification records to data/game-data/balance-patch-verification.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
