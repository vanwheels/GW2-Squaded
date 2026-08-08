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
 * rather than guess. Differences from that script:
 *  - No `Category:...` membership fetch needed for candidate selection — the candidate set here
 *    is simply every id already a key in `CURATED_DAMAGE_COEFFICIENTS`, since the point is
 *    diffing against that table, not discovering new ground yet (that's step 3 in TODO.md's plan).
 *  - Cross-validation target is a *coefficient total*, not a single duration: a wiki `strikes=N`
 *    param means the parsed `coefficient=` is already totaled across N hits (matches the API's
 *    `hit_count`); without `strikes=`, a `hit_count > 1` fact is a pulsing effect and the wiki
 *    coefficient is PER-HIT, so this script multiplies by the API's own `hit_count` before
 *    comparing — see `damage-calc.ts`'s own `DamageCoefficient` doc comment, this mirrors it.
 *  - **Name-collision resolution** (built 2026-08-08, TODO.md step 2a): many skill names collide
 *    with an unrelated page of the same title (e.g. bare "Crippling Shot" resolves to a Ranger
 *    short-bow skill; the Thief harpoon-gun skill this app actually curated lives at "Crippling
 *    Shot (thief harpoon gun skill)") or land on a `{{disambig}}` list page (e.g. "Maul", 6+
 *    same-named skills across professions/pets). Rather than a hand-maintained exception list
 *    (`fetch-relic-effects.ts`'s approach, viable there because relics only ever needed a fixed
 *    "(relic)" suffix retry), this verifies every fetched page against the `| id = N` field every
 *    `{{Skill infobox}}` carries: a match confirms the page is really the target skill; a mismatch
 *    (or missing `id=`, or a `{{disambig}}` page) triggers a MediaWiki search-API fallback that
 *    tries every returned candidate title until one's own `id=` matches. This generalizes past any
 *    single fixed suffix pattern (candidates found live: "(thief harpoon gun skill)", "(ranger
 *    greatsword skill)", "(warrior rampage skill)", ...) and self-verifies rather than trusting a
 *    guessed title. Falls back to an honest `unresolved-collision` skip (not a silent wrong-page
 *    parse) if no candidate's `id=` matches.
 *  - **`requiresTrait` disambiguation** (built 2026-08-08, TODO.md step 2a): a curated skill can
 *    carry two entries sharing one `factText` — an ungated base value and a value gated behind a
 *    specific trait (`DamageCoefficient.requiresTrait`, see that type's own doc comment) — which
 *    the wiki's skill page itself never documents as a second fact line (the bonus lives on the
 *    *trait's* page, not restated per affected skill). Comparing both curated entries against the
 *    same single wiki-parsed line therefore always false-MISMATCHes the trait-gated one. Since
 *    `CURATED_DAMAGE_COEFFICIENTS`'s own value is WvW-verified (deliberately NOT the API's PvE-only
 *    `dmg_multiplier`, per that type's doc comment), the API can't directly re-verify it either —
 *    but where the trait's own data carries exactly one unambiguous `type: 'Percent', text:
 *    'Damage Increase'` fact (confirmed live for Deadly Aim/1299 "+10%" and Empowered
 *    Illusions/682 "+15%|"), the curated table's own convention documented inline (e.g. id 13084's
 *    comment: "0.383*1.10=0.4213") is `requiresTrait entry = sibling base entry * (1 + percent/100)`
 *    — self-consistent within the curated table, checkable without the wiki at all. Other
 *    `requiresTrait` ids found live (2206 has two competing Damage Increase facts; 1329/1338 have
 *    none, an Attribute/Might-proc shape instead) don't fit this one clean pattern — rather than
 *    guess which applies, those are left as an honest, separately-bucketed skip.
 *  - **Multi-id wiki pages + sibling attribution** (built 2026-08-08, investigating the initial
 *    UNRESOLVED COLLISION list; see `resolveSkillPage`'s own doc comment for a live false-positive
 *    this went through and the fix): a skill page's own `| id = N` field can be a comma-separated
 *    LIST (e.g. "Jade Winds" -> `28406,31294`, land+Herald-gated pair) — `parseInfoboxSkillIds`
 *    always returns a list now, not a single number. Some pairs go further: the wiki's own id= field
 *    lists only ONE of two ids the curated table deliberately gives identical values to (e.g.
 *    Grenade Kit's land id 5882 vs. its underwater sibling 6171 — the page only lists 5882) — a
 *    last-resort `sibling` tier trusts `CURATED_DAMAGE_COEFFICIENTS`'s own already-human-verified
 *    equality between two same-named ids for this, deliberately NOT the local API's `dmg_multiplier`
 *    (a PvE-only value two genuinely different abilities can coincidentally share while differing in
 *    WvW). Logged as a separate `sibling` resolution method, never silently folded into
 *    `direct`/`disambiguated`.
 *  - **Case/whitespace-normalized factText matching** (built 2026-08-08): the wiki's own `alt=` text
 *    and the curated table's factText occasionally differ only by casing (e.g. wiki "Final strike
 *    damage" vs. curated "Final Strike Damage") — `byFactText` now keys on a normalized
 *    (trim+lowercase+collapsed-whitespace) form so this alone doesn't produce a false MISSING; every
 *    log line still shows the curated entry's original casing.
 *
 * Run manually via `npm run fetch-skill-coefficients`, after `npm run fetch-game-data`.
 *
 * Raw wikitext fetching is delegated to `scripts/lib/wiki-cache.ts` (TODO.md's wiki-extraction
 * pipeline step 2, 2026-08-08) — a shared on-disk cache keyed by title + revision id, so a page
 * this script already fetched isn't re-fetched from scratch by the next gap-type sweep touching
 * the same page. See that module's doc comment for the caching contract.
 *
 * Writes `data/game-data/skill-coefficient-verification.json` at the end of every run (TODO.md's
 * "wire output to data/game-data/" step, 2026-08-08) via `scripts/lib/wiki-verification.ts` — one
 * record per curated coefficient entry, capturing its outcome bucket + the wiki title/revision it
 * was checked against. This is an audit trail only: `CURATED_DAMAGE_COEFFICIENTS` itself remains
 * the sole source of truth the running app computes from, this file changes no app behavior. See
 * that module's own doc comment for why it lives in `data/game-data/` despite not being
 * app-runtime data.
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Fact, Skill, Trait } from '../src/shared/types/game-data'
import { CURATED_DAMAGE_COEFFICIENTS, type DamageCoefficient } from '../src/shared/skill-calc/damage-calc'
import { fetchWikiPage, flushWikiCache, getWikiRevisionId } from './lib/wiki-cache'
import { writeVerificationFile, type WikiVerificationEntry } from './lib/wiki-verification'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
// Same gotcha as every other fetch-*.ts script: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

/** Wiki article titles for shout-style skills keep surrounding quote marks the API's skill.name
 *  drops (or vice versa) — try both forms, same helper as fetch-wvw-splits.ts. */
function titleVariants(title: string): string[] {
  const unquoted = title.replace(/^"(.*)"$/, '$1')
  return unquoted === title ? [title, `"${title}"`] : [title, unquoted]
}

/** MediaWiki full-text search — used only as a name-collision fallback (see module doc comment),
 *  not for primary candidate discovery (that's still `CURATED_DAMAGE_COEFFICIENTS`'s own ids). */
async function searchCandidateTitles(query: string): Promise<string[]> {
  const url = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=20`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) return []
  const json = (await response.json()) as { query?: { search?: { title: string }[] } }
  return (json.query?.search ?? []).map((s) => s.title)
}

/** Extracts a `{{Skill infobox}}`'s `| id = N` field. Same shape as `fetch-relic-effects.ts`'s own
 *  `parseListedIds` — several skill pages document a comma-separated LIST of ids sharing one page
 *  (e.g. "Jade Winds" -> `28406,31294`, land+Herald-gated id pair), not always a single number, so
 *  this always returns a list (length 1 for the common case). */
function parseInfoboxSkillIds(wikitext: string): number[] {
  const match = /\|\s*id\s*=\s*([^\n|}]+)/.exec(wikitext)
  if (!match) return []
  return match[1]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
}

/** Two ids' curated `DamageCoefficient[]` arrays are byte-identical (order-independent) — the ONLY
 *  signal `resolveSkillPage`'s sibling-attribution fallback trusts (see its own doc comment for why
 *  a looser, API-only signal was tried and rejected). */
function curatedEntriesEqual(a: DamageCoefficient[], b: DamageCoefficient[]): boolean {
  if (a.length !== b.length) return false
  const norm = (e: DamageCoefficient) => `${e.factText}|${e.coefficient}|${e.weapon}|${e.requiresTrait ?? ''}`
  const bSet = new Set(b.map(norm))
  return a.every((e) => bSet.has(norm(e)))
}

type PageResolution =
  | { status: 'ok'; wikitext: string; title: string; method: 'direct' | 'disambiguated' | 'sibling' }
  | { status: 'not-found' }
  | { status: 'unresolved-collision'; note: string }

/** Resolves the correct wiki page for a candidate skill, self-verifying via `| id = N` rather than
 *  trusting title-string matching alone (see module doc comment). Three tiers, tried strictly in
 *  order — every exact-id check (direct title AND every search candidate) runs before the
 *  sibling-attribution fallback is ever consulted:
 *  1. A fetched page's own id list contains the candidate's id directly.
 *  2. (same, but via the MediaWiki search-API candidates instead of the direct title).
 *  3. **Sibling attribution** (last resort only): a page already fetched in tiers 1-2 lists a
 *     *sibling* id — same skill name, and `curatedEntriesEqual` confirms `CURATED_DAMAGE_COEFFICIENTS`
 *     already asserts byte-identical values for it (several pairs are deliberately "same wiki
 *     page/values as sibling id X," e.g. a `GroundTargeted` toggle pair or a land/underwater pair,
 *     where the wiki's own id= field lists only one of the two). **Built, then corrected, 2026-08-08**:
 *     an earlier version of this signal compared the *local API's* `dmg_multiplier` instead (a
 *     PvE-only value per `DamageCoefficient`'s own doc comment) — live-caught 2 false positives
 *     from it (Static Field 5732 vs. the unrelated core-Staff "Static Field," and Radiant Arc 69565
 *     vs. its Holosmith-gated sibling 69565... whose own curated comment literally warns "note the
 *     shared identical PvE side" is NOT the same WvW value) since two genuinely different abilities
 *     can coincidentally share one PvE coefficient while differing in WvW. Tier ordering also
 *     matters: consulting sibling-attribution inside the tier-1 loop let a coincidental match
 *     short-circuit before tier 2's search fallback ever ran, stealing a resolution that was
 *     otherwise findable exactly — fixed by deferring it to strictly after both exact tiers. */
async function resolveSkillPage(skill: Skill, skillsById: Map<number, Skill>): Promise<PageResolution> {
  const triedTitles: string[] = []
  const fetchedPages: { title: string; text: string; ids: number[] }[] = []
  let anyPageFound = false

  for (const title of titleVariants(skill.name)) {
    triedTitles.push(title)
    const text = await fetchWikiPage(title)
    if (text === null) continue
    anyPageFound = true
    if (/\{\{\s*disambig/i.test(text)) continue // explicit disambiguation list page — needs search fallback
    const ids = parseInfoboxSkillIds(text)
    fetchedPages.push({ title, text, ids })
    if (ids.includes(skill.id)) return { status: 'ok', wikitext: text, title, method: 'direct' }
  }

  // Search-API fallback: try every candidate MediaWiki's own search returns for this skill's name,
  // verifying each one's `| id = N` before accepting it.
  const candidates = await searchCandidateTitles(skill.name)
  for (const candidate of candidates) {
    if (triedTitles.includes(candidate)) continue
    const text = await fetchWikiPage(candidate)
    if (text === null) continue
    anyPageFound = true
    const ids = parseInfoboxSkillIds(text)
    fetchedPages.push({ title: candidate, text, ids })
    if (ids.includes(skill.id)) return { status: 'ok', wikitext: text, title: candidate, method: 'disambiguated' }
  }

  // Tier 3, last resort — see doc comment.
  const ownEntries = CURATED_DAMAGE_COEFFICIENTS[skill.id]
  for (const page of fetchedPages) {
    const siblingId = page.ids.find((pid) => {
      if (pid === skill.id) return false
      const sib = skillsById.get(pid)
      if (!sib || sib.name !== skill.name) return false
      const sibEntries = CURATED_DAMAGE_COEFFICIENTS[pid]
      return sibEntries !== undefined && curatedEntriesEqual(ownEntries, sibEntries)
    })
    if (siblingId !== undefined) return { status: 'ok', wikitext: page.text, title: page.title, method: 'sibling' }
  }

  if (!anyPageFound) return { status: 'not-found' }
  return {
    status: 'unresolved-collision',
    note: `tried [${triedTitles.join(', ')}] and ${candidates.length} search candidate(s), none had id=${skill.id} (or an equivalent sibling)`
  }
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

/**
 * Small hand-verified table (2026-08-08, all 3 entries — see COMPLETED.md's Session 112 for the
 * investigation) for the 3 cases the full run's own MISMATCH list surfaced, each traced to the
 * SAME shape: the id's own wiki page under-documents a real split/multiplier that a related source
 * — a sibling wiki page for the same ability under a different id, or the page's own free-text
 * Notes section — documents completely, and which the original curator had already correctly
 * cross-referenced. Not a parser bug or a curation error in any of the 3 — this exists purely to
 * suppress a known false-positive MISMATCH the general single-page parser can't resolve on its own.
 */
interface KnownWikiGap {
  factText: string
  reason: string
}
const KNOWN_WIKI_GAPS: Record<number, KnownWikiGap> = {
  // Herald — Elemental Blast. Own Damage fact line carries no `strikes=`, and the local API's own
  // `hit_count` is (incorrectly) 1, not 3 — but the wiki page's own Notes section states outright:
  // "This skill hits three times, for a total 4.5 coefficient in PvE and 2.67 in WvW and PvP,"
  // exactly matching the curated value (0.89 per-hit * 3 = 2.67). Free-text prose, not a
  // template field — not safe to regex-parse in general, hand-verified instead.
  27162: {
    factText: 'Damage',
    reason: 'wiki Notes section states "hits three times, for a total 4.5 coefficient in PvE and 2.67 in WvW and PvP" (2026-08-08); no strikes= param, and local API hit_count is 1'
  },
  // Legendary Demon — Call to Anguish, auto-target id (see damage-calc.ts's own block comment).
  // This id's own wiki page ("Call to Anguish (underwater)") documents only a single un-split
  // coefficient (1.2, the PvE value). `skill-variants.ts`'s own documented "signal 4" treats this
  // id as functionally identical to its GroundTargeted sibling (27917, same profession/slot/flags
  // pattern as the confirmed Grenade Kit land/underwater pair) for this app's purposes — that
  // sibling's own separate wiki page has the complete PvE/WvW+PvP split (1.2/0.01), which the
  // curated value already uses.
  31100: {
    factText: 'Damage',
    reason: 'own wiki page ("Call to Anguish (underwater)") has only a single un-split value (1.2); GroundTargeted sibling id 27917 (treated as functionally identical per skill-variants.ts signal 4) has the full split (1.2/0.01) on its own page'
  },
  // Conduit's rework of the same skill (see damage-calc.ts's own block comment: "both curated
  // identically") — same underlying page/gap as 31100 immediately above, just reached via this id's
  // own sibling-attribution resolution instead of a direct/search match.
  78798: {
    factText: 'Damage',
    reason: 'same page/gap as id 31100 above ("Call to Anguish (underwater)", reached here via sibling attribution) — single un-split value (1.2); GroundTargeted sibling 78203 has the full split (1.2/0.01)'
  },
  // Sword/Holosmith — Refraction Cutter. This id's own Holosmith-specific wiki page documents only
  // a single un-split "Projectile Damage" coefficient (0.4) — the page's own version history notes
  // a 2022-11-29 PvE-only buff apparently never re-split into 2 mode-tagged fact lines. Sibling
  // non-holosmith id 71121's separate wiki page has the full split (0.4/0.275), corroborated by the
  // local API's own traited `dmg_multiplier` (0.275) — see damage-calc.ts's own block comment.
  44110: {
    factText: 'Projectile Damage',
    reason: "own Holosmith-specific wiki page has only a single un-split value (0.4, a 2022-11-29 PvE-only buff never re-split); sibling non-holosmith id 71121's page has the full split (0.4/0.275), corroborated by local API dmg_multiplier"
  }
}

/** Validates a `requiresTrait`-gated curated entry against its sibling base entry (same factText,
 *  no `requiresTrait`) in the same skill's curated array, using the trait's own flat "Damage
 *  Increase" Percent fact where that shape is unambiguous — see module doc comment. Returns null
 *  (an honest "can't auto-validate this shape") rather than guessing when it isn't. */
function validateRequiresTraitEntry(
  entry: DamageCoefficient,
  siblingEntries: DamageCoefficient[],
  trait: Trait | undefined
): { expected: number; percent: number } | null {
  if (!trait) return null
  const baseEntry = siblingEntries.find((e) => e.factText === entry.factText && e.requiresTrait === undefined)
  if (!baseEntry) return null
  const damageIncreaseFacts = trait.facts.filter((f: Fact) => f.type === 'Percent' && f.text === 'Damage Increase')
  if (damageIncreaseFacts.length !== 1) return null // 0 = wrong shape, >1 = ambiguous which applies
  const percent = damageIncreaseFacts[0].percent as number
  if (typeof percent !== 'number') return null
  return { expected: baseEntry.coefficient * (1 + percent / 100), percent }
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const traits = JSON.parse(await readFile(join(DATA_DIR, 'traits.json'), 'utf-8')) as Trait[]
  const skillsById = new Map(skills.map((s) => [s.id, s]))
  const traitsById = new Map(traits.map((t) => [t.id, t]))

  const candidateIds = Object.keys(CURATED_DAMAGE_COEFFICIENTS).map(Number)
  const totalEntries = candidateIds.reduce((sum, id) => sum + CURATED_DAMAGE_COEFFICIENTS[id].length, 0)
  console.log(
    `Pilot: re-deriving ${totalEntries} curated coefficient entries across ${candidateIds.length} skills` +
      ` from live wiki wikitext, diffing against CURATED_DAMAGE_COEFFICIENTS...`
  )

  let matchCount = 0
  let disambiguatedCount = 0
  let siblingCount = 0
  let traitMatchCount = 0
  const mismatches: string[] = []
  const missing: string[] = []
  const skips: string[] = []
  const notFound: string[] = []
  const unresolvedCollisions: string[] = []
  const disambiguatedLog: string[] = []
  const siblingLog: string[] = []
  const traitMismatches: string[] = []
  const traitSkips: string[] = []
  let knownGapCount = 0
  const knownGapLog: string[] = []
  const records: WikiVerificationEntry[] = []

  let processed = 0
  for (const id of candidateIds) {
    const skill = skillsById.get(id)
    const curatedEntries = CURATED_DAMAGE_COEFFICIENTS[id]

    if (!skill) {
      notFound.push(`skill id ${id} not found in local skills.json (curated ${curatedEntries.length} entries)`)
      for (const entry of curatedEntries) {
        records.push({ sourceKind: 'skill', id, name: `(unknown skill ${id})`, factText: entry.factText, status: 'not-found', curatedValue: entry.coefficient, detail: 'not found in local skills.json' })
      }
      processed++
      continue
    }

    let resolution: PageResolution
    try {
      resolution = await resolveSkillPage(skill, skillsById)
    } catch (err) {
      notFound.push(`fetch error: skill ${id} "${skill.name}" — ${(err as Error).message}`)
      for (const entry of curatedEntries) {
        records.push({ sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'not-found', curatedValue: entry.coefficient, detail: `fetch error: ${(err as Error).message}` })
      }
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${candidateIds.length}] skills checked...`)
      continue
    }

    if (resolution.status === 'not-found') {
      notFound.push(`no wiki page found for: skill ${id} "${skill.name}" (tried: ${titleVariants(skill.name).join(', ')})`)
      for (const entry of curatedEntries) {
        records.push({ sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'not-found', curatedValue: entry.coefficient, detail: `no wiki page found (tried: ${titleVariants(skill.name).join(', ')})` })
      }
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${candidateIds.length}] skills checked...`)
      continue
    }
    if (resolution.status === 'unresolved-collision') {
      unresolvedCollisions.push(`skill ${id} "${skill.name}" — ${resolution.note}`)
      for (const entry of curatedEntries) {
        records.push({ sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'unresolved-collision', curatedValue: entry.coefficient, detail: resolution.note })
      }
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${candidateIds.length}] skills checked...`)
      continue
    }
    if (resolution.method === 'disambiguated') {
      disambiguatedCount++
      disambiguatedLog.push(`skill ${id} "${skill.name}" — resolved via search to "${resolution.title}"`)
    } else if (resolution.method === 'sibling') {
      siblingCount++
      siblingLog.push(`skill ${id} "${skill.name}" — attributed to "${resolution.title}" via a sibling id CURATED_DAMAGE_COEFFICIENTS already asserts identical values for (see curatedEntriesEqual)`)
    }
    const wikiTitle = resolution.title
    const wikiRevisionId = getWikiRevisionId(resolution.title)

    const parsed = parseDamageFactLines(resolution.wikitext)
    // Case/whitespace-normalized key: the wiki's own `alt=` text and the local API's curated
    // factText occasionally differ only by casing (e.g. "Final strike damage" vs the curated
    // table's "Final Strike Damage") — normalizing avoids a false MISSING over that alone, while
    // `entry.factText`'s original casing is still what's shown in every log line.
    const normalizeFactText = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')
    const byFactText = new Map<string, ParsedDamageFact[]>()
    for (const p of parsed) {
      const key = normalizeFactText(p.factText)
      const list = byFactText.get(key) ?? []
      list.push(p)
      byFactText.set(key, list)
    }

    for (const entry of curatedEntries) {
      if (entry.requiresTrait !== undefined) {
        // Trait-gated variant — the wiki skill page never restates this as its own fact line (the
        // bonus lives on the trait's page instead), so validate against the sibling base entry +
        // the trait's own data rather than a wiki-parsed line. See module doc comment.
        const trait = traitsById.get(entry.requiresTrait)
        const validated = validateRequiresTraitEntry(entry, curatedEntries, trait)
        if (!validated) {
          traitSkips.push(
            `SKIP (requiresTrait, unvalidatable shape): skill ${id} "${skill.name}" / "${entry.factText}"` +
              ` requiresTrait=${entry.requiresTrait} (${trait?.name ?? 'trait not found'})`
          )
          records.push({
            sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'skip',
            curatedValue: entry.coefficient, wikiTitle, wikiRevisionId,
            detail: `requiresTrait=${entry.requiresTrait} (${trait?.name ?? 'trait not found'}) — unvalidatable shape`
          })
          continue
        }
        if (Math.abs(validated.expected - entry.coefficient) <= EPSILON) {
          traitMatchCount++
          records.push({
            sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'match',
            curatedValue: entry.coefficient, wikiValue: validated.expected, wikiTitle, wikiRevisionId,
            detail: `requiresTrait=${entry.requiresTrait} (${trait?.name}), base*${1 + validated.percent / 100}`
          })
        } else {
          traitMismatches.push(
            `MISMATCH (requiresTrait): skill ${id} "${skill.name}" / "${entry.factText}" requiresTrait=${entry.requiresTrait}` +
              ` (${trait?.name}) — curated=${entry.coefficient}, expected(base*${1 + validated.percent / 100})=${validated.expected}`
          )
          records.push({
            sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'mismatch',
            curatedValue: entry.coefficient, wikiValue: validated.expected, wikiTitle, wikiRevisionId,
            detail: `requiresTrait=${entry.requiresTrait} (${trait?.name}), expected base*${1 + validated.percent / 100}`
          })
        }
        continue
      }

      const lines = byFactText.get(normalizeFactText(entry.factText))
      if (!lines || lines.length === 0) {
        missing.push(`MISSING: skill ${id} "${skill.name}" / "${entry.factText}" — no {{skill fact|damage}} line parsed for this factText`)
        records.push({
          sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'missing',
          curatedValue: entry.coefficient, wikiTitle, wikiRevisionId,
          detail: 'no {{skill fact|damage}} line parsed for this factText'
        })
        continue
      }

      const resolved = resolveWvwLine(lines)
      if (resolved.status !== 'ok') {
        skips.push(`SKIP (${resolved.status}): skill ${id} "${skill.name}" / "${entry.factText}"`)
        records.push({
          sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'skip',
          curatedValue: entry.coefficient, wikiTitle, wikiRevisionId, detail: resolved.status
        })
        continue
      }
      const line = resolved.line

      let total: number
      if (line.strikes !== null) {
        total = line.coefficient // wiki's own strikes= param means this is already the totaled value
      } else {
        // Restricted to the skill's base (non-traited) facts — a requiresTrait sibling sharing the
        // same factText could otherwise contribute the wrong hit_count to this ungated entry.
        const apiFact = skill.facts.find((f) => f.type === 'Damage' && f.text === entry.factText)
        const hitCount = typeof apiFact?.hit_count === 'number' ? apiFact.hit_count : 1
        total = line.coefficient * hitCount // pulsing effect, no strikes= — wiki value is per-hit
      }

      if (Math.abs(total - entry.coefficient) <= EPSILON) {
        matchCount++
        records.push({
          sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'match',
          curatedValue: entry.coefficient, wikiValue: total, wikiTitle, wikiRevisionId
        })
      } else {
        const knownGap = KNOWN_WIKI_GAPS[id]
        if (knownGap && knownGap.factText === entry.factText) {
          knownGapCount++
          knownGapLog.push(`skill ${id} "${skill.name}" / "${entry.factText}" — curated=${entry.coefficient} corroborated: ${knownGap.reason}`)
          records.push({
            sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'known-gap',
            curatedValue: entry.coefficient, wikiValue: total, wikiTitle, wikiRevisionId, detail: knownGap.reason
          })
        } else {
          mismatches.push(
            `MISMATCH: skill ${id} "${skill.name}" / "${entry.factText}" — curated=${entry.coefficient}, wiki-derived=${total}` +
              ` (raw wiki coefficient=${line.coefficient}, strikes=${line.strikes ?? 'n/a'})`
          )
          records.push({
            sourceKind: 'skill', id, name: skill.name, factText: entry.factText, status: 'mismatch',
            curatedValue: entry.coefficient, wikiValue: total, wikiTitle, wikiRevisionId,
            detail: `raw wiki coefficient=${line.coefficient}, strikes=${line.strikes ?? 'n/a'}`
          })
        }
      }
    }

    processed++
    if (processed % 50 === 0) console.log(`  [${processed}/${candidateIds.length}] skills checked...`)
  }

  console.log(`\nDone. ${processed}/${candidateIds.length} skills checked.`)
  console.log(`  MATCH (wiki):             ${matchCount}`)
  console.log(`  MATCH (requiresTrait):    ${traitMatchCount}`)
  console.log(`  MATCH (known wiki gap):   ${knownGapCount}`)
  console.log(`  MISMATCH (wiki):          ${mismatches.length}`)
  console.log(`  MISMATCH (requiresTrait): ${traitMismatches.length}`)
  console.log(`  MISSING:                  ${missing.length}`)
  console.log(`  SKIP (ambiguous wiki):    ${skips.length}`)
  console.log(`  SKIP (requiresTrait):     ${traitSkips.length}`)
  console.log(`  NOT FOUND:                ${notFound.length}`)
  console.log(`  UNRESOLVED COLLISION:     ${unresolvedCollisions.length}`)
  console.log(`  (of which resolved via search-API disambiguation: ${disambiguatedCount})`)
  console.log(`  (of which resolved via sibling-id attribution: ${siblingCount})`)

  if (mismatches.length > 0) {
    console.log(`\n--- MISMATCH (curated value disagrees with a re-derived wiki value) ---`)
    for (const line of mismatches) console.log(`  - ${line}`)
  }
  if (knownGapLog.length > 0) {
    console.log(`\n--- MATCH via known wiki gap (this page under-documents; corroborated elsewhere) ---`)
    for (const line of knownGapLog) console.log(`  - ${line}`)
  }
  if (traitMismatches.length > 0) {
    console.log(`\n--- MISMATCH (requiresTrait: curated value disagrees with base*trait% derivation) ---`)
    for (const line of traitMismatches) console.log(`  - ${line}`)
  }
  if (missing.length > 0) {
    console.log(`\n--- MISSING (wiki page had no matching damage line for this curated factText) ---`)
    for (const line of missing) console.log(`  - ${line}`)
  }
  if (skips.length > 0) {
    console.log(`\n--- SKIP (ambiguous wiki line — needs a human read) ---`)
    for (const line of skips) console.log(`  - ${line}`)
  }
  if (traitSkips.length > 0) {
    console.log(`\n--- SKIP (requiresTrait shape doesn't fit the base*trait% pattern — needs a human read) ---`)
    for (const line of traitSkips) console.log(`  - ${line}`)
  }
  if (notFound.length > 0) {
    console.log(`\n--- NOT FOUND ---`)
    for (const line of notFound) console.log(`  - ${line}`)
  }
  if (unresolvedCollisions.length > 0) {
    console.log(`\n--- UNRESOLVED COLLISION (no candidate page's id= matched — needs a human read) ---`)
    for (const line of unresolvedCollisions) console.log(`  - ${line}`)
  }
  if (disambiguatedLog.length > 0) {
    console.log(`\n--- Resolved via search-API disambiguation (informational, not an error) ---`)
    for (const line of disambiguatedLog) console.log(`  - ${line}`)
  }
  if (siblingLog.length > 0) {
    console.log(`\n--- Resolved via sibling-id attribution (informational, not an error) ---`)
    for (const line of siblingLog) console.log(`  - ${line}`)
  }

  await flushWikiCache()
  await writeVerificationFile(
    'skill-coefficient-verification.json',
    { sourceTable: 'CURATED_DAMAGE_COEFFICIENTS', script: 'fetch-skill-coefficients.ts' },
    records
  )
  console.log(`\nWrote ${records.length} verification records to data/game-data/skill-coefficient-verification.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
