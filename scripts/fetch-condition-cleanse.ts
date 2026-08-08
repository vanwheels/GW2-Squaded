/**
 * Wiki-extraction pass for TODO.md's Condition Cleanse self-vs-party item (folding a "Conditions
 * Removed"-family fact into the Strip/Corrupt row as "Strips / Corrupts / Cleanses" needs to know
 * WHO gets cleansed — a bare `type: "Number", text: "Conditions Removed"` fact never says).
 * Unlike `fetch-target-counts.ts` (which VALIDATES an already-hand-curated table), no curated
 * table exists yet for this one — this script BUILDS a first-draft classification from live wiki
 * wikitext, same skeleton (candidate resolution, `resolvePage`, wiki-cache) as that script and
 * `fetch-skill-coefficients.ts`, so a human only has to review/adjust its output rather than
 * research all ~226 candidates from scratch.
 *
 * Candidate selection (local, no network): every skill/trait carrying a `Number` fact whose `text`
 * matches /condition.*remov|remov.*condition/i (covers every label variant a live full-file scan
 * found: "Conditions Removed", "Active/Initial/Passive/Damaging Conditions Removed", "Conditions
 * Removed per Pulse/Second/Hit/Clone/10 Energy", "Conditions removed on hit.", etc.) — same
 * equippable+reachable filter as `scan-empty-effect-facts.ts` (skills need `professions.length > 0`
 * and, if `slot` starts with `Downed_`, need to be a real Shroud weapon-bar id per
 * `bundle-skills.ts`'s `SHROUD_SLOT_SKILLS`; traits have no equivalent gate, all are candidates).
 * A few label variants already self-declare the answer with no wiki lookup needed: "...from Self"/
 * "Self Condition Removal" -> definitively self-only; "...from Allies" -> definitively party. Both
 * are still routed through this script only to get bucketed as `LOCAL-SELF`/`LOCAL-ALLY` in the
 * summary (no page fetch), not silently dropped from the candidate count.
 *
 * Everything else needs the wiki. Live-checked shape (2026-08-08) across several skills AND traits
 * (`Mending`, `"Shake It Off!"`, `Purge Gyro`, `Cleansing Wave`, `Cleansing Water`, `Absolute
 * Resolve`, `Empathic Bond`) confirms the same two structured signals `fetch-target-counts.ts`
 * already trusts for boons apply here unchanged:
 *  - The infobox's own `description=` prose reliably states who's cleansed in plain English
 *    ("Remove conditions and heal YOURSELF" vs. "Cure conditions on YOURSELF AND NEARBY ALLIES") —
 *    this is the PRIMARY signal this script relies on, via keyword regexes, not the `facts=`
 *    template soup (which never itself says "self" or "allies" for a bare `conditions removed`
 *    line — only `description=` does).
 *  - A `{{skill fact|targets|N}}` (or dedicated `allied targets`) template alongside a
 *    `conditions removed` line gives the actual ally count for a PARTY verdict — same trust rules
 *    as `fetch-target-counts.ts`'s `parseTargetFacts`/`fieldSpan` (bare `targets` only trusted
 *    unlabeled for TRAIT candidates' `missing facts=` field, per that script's own hard-won
 *    false-positive history with Lightning Flash/"Guard!" — reused verbatim here).
 *
 * Genuine third shapes turned up spot-checking real pages that a clean self/party binary can't
 * safely swallow — bucketed as their own thing rather than force-fit:
 *  - "self + pet" (Ranger's Empathic Bond: "when you swap pets" — no ally wording, but also not a
 *    pure self-only cleanse in the sense the rest of this app's self/party split means).
 *  - PARTY description with NO accompanying targets/allied-targets fact anywhere on the page
 *    (Absolute Resolve: "removes conditions from nearby allies," only a `radius` fact, no `targets`
 *    template at all) — party is certain, the COUNT isn't; bucketed separately rather than silently
 *    assuming the default-5 convention `TARGET_COUNT_OVERRIDES` documents for boons.
 *  - A trait/skill that only modifies WHO an already-modeled skill/boon reaches (Cleansing Water:
 *    "cleanse conditions from allies you grant regeneration to" — party is certain but the count is
 *    whatever THAT boon's own source already resolves, not this trait's own page) — bucketed
 *    separately, needs a human read of which source it rides on, not a number this script can emit.
 *
 * Does NOT write any data file or touch `sources.ts` — console report only, same as every other
 * fetch-*.ts pilot so far. The intent is a human reviews the HIGH-CONFIDENCE buckets (self/party+
 * count) as a fast copy-paste starting point for a new `CONDITION_CLEANSE_TARGETS`-style curated
 * table, and the smaller AMBIGUOUS/PET/NO-COUNT/RIDES-ON-OTHER buckets get the same one-by-one
 * human/wiki read the Healing/Damage/target-count sweeps already used for their own residuals.
 *
 * Run manually via `npm run fetch-condition-cleanse`, after `npm run fetch-game-data`.
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Fact, Skill, Trait } from '../src/shared/types/game-data'
import { SHROUD_SLOT_SKILLS } from '../src/shared/skill-calc/bundle-skills'
import { fetchWikiPage, flushWikiCache } from './lib/wiki-cache'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
// Same gotcha as every other fetch-*.ts script: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

type SourceKind = 'skill' | 'trait'

const CLEANSE_FACT_RE = /condition.*remov|remov.*condition/i
const EXPLICIT_SELF_RE = /from self|self condition removal|self conditions removed/i
const EXPLICIT_ALLY_RE = /from allies/i

/** Same reachability gate as `scan-empty-effect-facts.ts` — see that script's own doc comment for
 *  why a raw `Downed_*` slot needs the Shroud carve-out. Traits have no equivalent gate. */
const REACHABLE_SHROUD_IDS = new Set(Object.values(SHROUD_SLOT_SKILLS).flat())

interface Candidate {
  sourceKind: SourceKind
  id: number
  name: string
  localHint: 'self' | 'ally' | null // from an explicit label, no wiki lookup needed
  /** True when EVERY cleanse fact on this source is gated behind `requires_trait` — the base
   *  skill's own wiki description almost never mentions a trait-conditional bonus (confirmed live:
   *  Arcing Slice/Whirling Strike's `Conditions Removed` both carry `requires_trait: 1649` and
   *  their wiki description says nothing about conditions at all), so this script can't trust that
   *  page's description for these — bucketed separately rather than silently misread. */
  traitGatedOnly: boolean
}

interface CleanseFact {
  text: string
  requiresTrait: boolean
}

function cleanseFacts(facts: Fact[], traitedFacts: Fact[]): CleanseFact[] {
  const out: CleanseFact[] = []
  for (const f of [...facts, ...traitedFacts]) {
    if (f.type === 'Number' && typeof f.text === 'string' && CLEANSE_FACT_RE.test(f.text)) {
      out.push({ text: f.text, requiresTrait: f.requires_trait !== undefined })
    }
  }
  return out
}

function selectCandidates(skills: Skill[], traits: Trait[]): Candidate[] {
  const out: Candidate[] = []
  for (const skill of skills) {
    if (skill.professions.length === 0) continue
    if (skill.slot.startsWith('Downed_') && !REACHABLE_SHROUD_IDS.has(skill.id)) continue
    const facts = cleanseFacts(skill.facts, skill.traitedFacts)
    if (facts.length === 0) continue
    const texts = facts.map((f) => f.text)
    const localHint = texts.some((t) => EXPLICIT_SELF_RE.test(t)) ? 'self' : texts.some((t) => EXPLICIT_ALLY_RE.test(t)) ? 'ally' : null
    const traitGatedOnly = facts.every((f) => f.requiresTrait)
    out.push({ sourceKind: 'skill', id: skill.id, name: skill.name, localHint, traitGatedOnly })
  }
  for (const trait of traits) {
    const facts = cleanseFacts(trait.facts, trait.traitedFacts)
    if (facts.length === 0) continue
    const texts = facts.map((f) => f.text)
    const localHint = texts.some((t) => EXPLICIT_SELF_RE.test(t)) ? 'self' : texts.some((t) => EXPLICIT_ALLY_RE.test(t)) ? 'ally' : null
    out.push({ sourceKind: 'trait', id: trait.id, name: trait.name, localHint, traitGatedOnly: false })
  }
  return out
}

/** Shout-style skill titles keep/drop surrounding quote marks inconsistently between the API and
 *  the wiki — same helper as every other fetch-*.ts script. */
function titleVariants(title: string): string[] {
  const unquoted = title.replace(/^"(.*)"$/, '$1')
  return unquoted === title ? [title, `"${title}"`] : [title, unquoted]
}

async function searchCandidateTitles(query: string): Promise<string[]> {
  const url = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=20`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) return []
  const json = (await response.json()) as { query?: { search?: { title: string }[] } }
  return (json.query?.search ?? []).map((s) => s.title)
}

function parseInfoboxIds(wikitext: string): number[] {
  const match = /\|\s*id\s*=\s*([^\n|}]+)/.exec(wikitext)
  if (!match) return []
  return match[1]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
}

type PageResolution =
  | { status: 'ok'; wikitext: string; title: string; method: 'direct' | 'disambiguated' }
  | { status: 'not-found' }
  | { status: 'unresolved-collision'; note: string }

/** Same two-tier resolution as `fetch-target-counts.ts`'s `resolvePage`, minus its third
 *  (curated-sibling-value) tier — there's no curated table yet for this script to lean on. A
 *  genuine multi-id collision this script can't resolve just falls into UNRESOLVED COLLISION for a
 *  human to sort out, same as that script's own residual bucket. */
async function resolvePage(name: string, id: number): Promise<PageResolution> {
  const triedTitles: string[] = []
  const fetchedPages: { title: string; text: string; ids: number[] }[] = []
  let anyPageFound = false

  for (const title of titleVariants(name)) {
    triedTitles.push(title)
    const text = await fetchWikiPage(title)
    if (text === null) continue
    anyPageFound = true
    if (/\{\{\s*disambig/i.test(text)) continue
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

  if (!anyPageFound) return { status: 'not-found' }
  return {
    status: 'unresolved-collision',
    note: `tried [${triedTitles.join(', ')}] and ${candidates.length} search candidate(s), none had id=${id}`
  }
}

/** Span of a named infobox field's value — see `fetch-target-counts.ts`'s identical helper. Used
 *  here for both `description=` (single field, whole value) and `missing facts=` (targets-fact
 *  trust gate, trait pages only). */
function fieldSpan(wikitext: string, fieldNameRegex: RegExp): [number, number] | null {
  const m = fieldNameRegex.exec(wikitext)
  if (!m) return null
  const start = m.index + m[0].length
  const rest = wikitext.slice(start)
  const endMatch = /\n\s*\|\s*[a-z][a-z0-9 _]*\s*=|\n\s*\}\}/i.exec(rest)
  const end = endMatch ? start + endMatch.index : wikitext.length
  return [start, end]
}

function parseDescription(wikitext: string): string | null {
  const span = fieldSpan(wikitext, /\|\s*description\s*=/i)
  if (!span) return null
  return wikitext
    .slice(span[0], span[1])
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1') // [[link|text]] or [[link]] -> text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Wording classification of a skill/trait's own `description=` prose — the primary signal this
 *  script relies on (see module doc comment). "Self + pet" is deliberately its own outcome, not
 *  folded into either self or party — see module doc comment's Empathic Bond example.
 *  `no-condition-mention` is its own outcome too, NOT folded into 'unclear': a live check (Arcing
 *  Slice, Whirling Strike, Med Pack Drop) found the description frequently doesn't mention
 *  conditions at all (the cleanse is a `requires_trait`-gated bonus the base description never
 *  states, or documented only in a Notes section / a separate `Number of Allied Targets` fact) —
 *  an earlier version of this function fell back to reading unrelated "you"/"yourself" mentions
 *  elsewhere in the description as self-only evidence in that case, which produced confirmed WRONG
 *  verdicts (Med Pack Drop misread as self-only despite its own `Number of Allied Targets: 5`
 *  fact). Only classify off the SENTENCE(S) that actually mention "condition" — no such sentence
 *  means no real evidence either way, not "assume self." */
type DescriptionVerdict = 'self' | 'party' | 'self-plus-pet' | 'no-condition-mention' | 'unclear'

function classifyDescription(desc: string | null): DescriptionVerdict {
  if (desc === null) return 'unclear'
  const sentences = desc.split(/(?<=[.!?])\s+/).filter((s) => /condition/i.test(s))
  if (sentences.length === 0) return 'no-condition-mention'
  const relevant = sentences.join(' ')
  const hasAllyWord = /\b(allies|ally|party|squad|nearby)\b/i.test(relevant)
  const hasPetWord = /\bpet\b/i.test(relevant)
  const hasSelfWord = /\byourself\b|\byou\b/i.test(relevant)
  if (hasAllyWord) return 'party'
  if (hasPetWord && !hasAllyWord) return 'self-plus-pet'
  if (hasSelfWord) return 'self'
  return 'unclear'
}

interface ParsedTargetFact {
  value: number
  alliedLabeled: boolean
  inMissingFacts: boolean
}

/** Same template shape/trust rules as `fetch-target-counts.ts`'s `parseTargetFacts` — see that
 *  script's own doc comment for the Lightning Flash/"Guard!" false-positive history behind
 *  restricting a bare, unlabeled `missing facts=` `targets` hit to trait candidates only. */
function parseTargetFacts(wikitext: string, sourceKind: SourceKind): ParsedTargetFact[] {
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
        if (!Number.isNaN(n)) value = n
        continue
      }
      const key = kv[1].toLowerCase().replace(/\s+/g, '')
      if (key === 'alt' && /allied/i.test(kv[2])) altIsAllied = true
    }
    if (value === null) continue
    const idx = match.index ?? -1
    const inMissingFacts = missingSpan !== null && idx >= missingSpan[0] && idx < missingSpan[1]
    const alliedLabeled = template === 'allied targets' || altIsAllied
    if (!alliedLabeled && !(inMissingFacts && sourceKind === 'trait')) continue // untrusted enemy-facing count
    out.push({ value, alliedLabeled, inMissingFacts })
  }
  return out
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const traits = JSON.parse(await readFile(join(DATA_DIR, 'traits.json'), 'utf-8')) as Trait[]

  const candidates = selectCandidates(skills, traits)
  const localSelf = candidates.filter((c) => c.localHint === 'self')
  const localAlly = candidates.filter((c) => c.localHint === 'ally')
  const needsWiki = candidates.filter((c) => c.localHint === null)

  console.log(
    `Found ${candidates.length} candidates (${candidates.filter((c) => c.sourceKind === 'skill').length} skill,` +
      ` ${candidates.filter((c) => c.sourceKind === 'trait').length} trait) carrying a Conditions-Removed-family` +
      ` fact. ${localSelf.length} already self-declared self-only, ${localAlly.length} already self-declared` +
      ` party-wide via their fact label. ${needsWiki.length} need a wiki lookup.`
  )

  const highConfidenceSelf: string[] = [...localSelf.map((c) => `${c.sourceKind} ${c.id} "${c.name}" — LOCAL-SELF (explicit fact label)`)]
  const highConfidenceParty: string[] = []
  const localAllyNoCount: string[] = []
  const selfPlusPet: string[] = []
  const partyNoCount: string[] = []
  const noConditionMention: string[] = []
  const traitGated: string[] = []
  const unclear: string[] = []
  const notFound: string[] = []
  const unresolvedCollisions: string[] = []
  const disambiguatedLog: string[] = []

  for (const c of localAlly) {
    // Explicit "from Allies" label — still want a count if the wiki has one, otherwise flag it.
    highConfidenceParty.push(`${c.sourceKind} ${c.id} "${c.name}" — LOCAL-ALLY (explicit fact label), count unresolved (needs wiki/manual)`)
    localAllyNoCount.push(`${c.sourceKind} ${c.id} "${c.name}"`)
  }

  let processed = 0
  for (const c of needsWiki) {
    let resolution: PageResolution
    try {
      resolution = await resolvePage(c.name, c.id)
    } catch (err) {
      notFound.push(`fetch error: ${c.sourceKind} ${c.id} "${c.name}" — ${(err as Error).message}`)
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${needsWiki.length}] checked...`)
      continue
    }

    if (resolution.status === 'not-found') {
      notFound.push(`no wiki page found for: ${c.sourceKind} ${c.id} "${c.name}" (tried: ${titleVariants(c.name).join(', ')})`)
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${needsWiki.length}] checked...`)
      continue
    }
    if (resolution.status === 'unresolved-collision') {
      unresolvedCollisions.push(`${c.sourceKind} ${c.id} "${c.name}" — ${resolution.note}`)
      processed++
      if (processed % 50 === 0) console.log(`  [${processed}/${needsWiki.length}] checked...`)
      continue
    }
    if (resolution.method === 'disambiguated') {
      disambiguatedLog.push(`${c.sourceKind} ${c.id} "${c.name}" — resolved via search to "${resolution.title}"`)
    }

    const desc = parseDescription(resolution.wikitext)
    const verdict = classifyDescription(desc)
    const targetFacts = parseTargetFacts(resolution.wikitext, c.sourceKind)
    const distinctCounts = [...new Set(targetFacts.map((f) => f.value))]

    if (c.traitGatedOnly) {
      // Every cleanse fact on this source only fires under a specific chosen trait — the base
      // skill's own description prose can't be trusted for this (see module doc comment's Arcing
      // Slice/Whirling Strike example: description mentions neither conditions nor self/allies at
      // all). Bucketed on its own regardless of what classifyDescription found, so a human checks
      // the GRANTING trait's own page instead, not this skill's.
      traitGated.push(`${c.sourceKind} ${c.id} "${c.name}" — cleanse fact is requires_trait-gated; base description verdict was '${verdict}' ("${desc ?? 'n/a'}") — check the granting trait's own page instead`)
    } else if (verdict === 'self') {
      highConfidenceSelf.push(`${c.sourceKind} ${c.id} "${c.name}" — WIKI-SELF ("${desc}")`)
    } else if (verdict === 'party') {
      if (distinctCounts.length === 1) {
        highConfidenceParty.push(`${c.sourceKind} ${c.id} "${c.name}" — WIKI-PARTY, count=${distinctCounts[0]} ("${desc}")`)
      } else if (distinctCounts.length > 1) {
        unclear.push(`${c.sourceKind} ${c.id} "${c.name}" — party, but conflicting target counts [${distinctCounts.join(', ')}] ("${desc}")`)
      } else {
        partyNoCount.push(`${c.sourceKind} ${c.id} "${c.name}" — party, no targets/allied-targets fact found on page ("${desc}")`)
      }
    } else if (verdict === 'self-plus-pet') {
      selfPlusPet.push(`${c.sourceKind} ${c.id} "${c.name}" — self+pet, not a clean self/party fit ("${desc}")`)
    } else if (verdict === 'no-condition-mention') {
      noConditionMention.push(`${c.sourceKind} ${c.id} "${c.name}" — description never mentions conditions at all ("${desc ?? '(no description field found)'}")`)
    } else {
      unclear.push(`${c.sourceKind} ${c.id} "${c.name}" — condition-mentioning sentence didn't classify as self/ally ("${desc}")`)
    }

    processed++
    if (processed % 50 === 0) console.log(`  [${processed}/${needsWiki.length}] checked...`)
  }

  console.log(`\nDone. ${processed}/${needsWiki.length} wiki lookups attempted.`)
  console.log(`  HIGH-CONFIDENCE SELF:              ${highConfidenceSelf.length}`)
  console.log(`  HIGH-CONFIDENCE PARTY (with count): ${highConfidenceParty.length - localAllyNoCount.length}`)
  console.log(`  LOCAL-ALLY, count unresolved:       ${localAllyNoCount.length}`)
  console.log(`  PARTY, no count on page:            ${partyNoCount.length}`)
  console.log(`  SELF + PET (not a clean fit):       ${selfPlusPet.length}`)
  console.log(`  TRAIT-GATED (check granting trait): ${traitGated.length}`)
  console.log(`  NO CONDITION MENTION IN DESCRIPTION:${noConditionMention.length}`)
  console.log(`  UNCLEAR:                            ${unclear.length}`)
  console.log(`  NOT FOUND:                          ${notFound.length}`)
  console.log(`  UNRESOLVED COLLISION:               ${unresolvedCollisions.length}`)
  console.log(`  (of which resolved via search-API disambiguation: ${disambiguatedLog.length})`)

  const section = (title: string, lines: string[]): void => {
    if (lines.length === 0) return
    console.log(`\n--- ${title} ---`)
    for (const line of lines) console.log(`  - ${line}`)
  }

  section('HIGH-CONFIDENCE SELF (proposed self-only)', highConfidenceSelf)
  section('HIGH-CONFIDENCE PARTY (proposed party, with count)', highConfidenceParty)
  section('PARTY, NO COUNT ON PAGE (party certain, needs a count — default-5 convention or manual)', partyNoCount)
  section('SELF + PET (not a clean self/party fit, needs a human decision)', selfPlusPet)
  section('TRAIT-GATED (base description untrustworthy — check the granting trait\'s own page)', traitGated)
  section('NO CONDITION MENTION (description says nothing about conditions at all — needs Notes/manual read)', noConditionMention)
  section('UNCLEAR (condition-mentioning sentence did not classify)', unclear)
  section('NOT FOUND', notFound)
  section("UNRESOLVED COLLISION (no candidate page's id= matched)", unresolvedCollisions)
  section('Resolved via search-API disambiguation (informational, not an error)', disambiguatedLog)

  await flushWikiCache()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
