/**
 * Red-flag scan for TODO.md's "Some skills' real effects live entirely outside the GW2 API's
 * `facts` array" bug (flagged 2026-08-07, concrete example: Revenant Scepter 3 "Otherworldly
 * Bond") and step 3 of the "Wiki-sourced data pipeline" plan ("a 'does this page even carry the
 * template we need' check for the empty-API-facts problem"). Does NOT write any data file —
 * console report only, same shape as `fetch-skill-coefficients.ts`'s pilot.
 *
 * Two passes:
 * 1. **Local candidate selection** (no network): a skill is a candidate if it's actually
 *    equippable by a player profession (`professions.length > 0` — excludes the ~2200 monster/NPC/
 *    environment-hazard skills the raw API also returns, e.g. raid-boss mechanics, which this app
 *    never shows a player), its own `facts`/`traitedFacts` carry NO fact type beyond the purely
 *    positional/timing ones (`Range`/`Recharge`/`Distance`/`Radius` — real numbers, but numbers
 *    that don't describe what the skill actually DOES), and its `description` is long enough
 *    (`MIN_DESCRIPTION_LENGTH`, stripped of wiki-style `<c=...>` markup) to plausibly be describing
 *    a real mechanic rather than a one-line flavor label. This over-selects on purpose — see below.
 * 2. **Wiki structured-template check** (the actual "does this page carry the template we need"
 *    ask): for each local candidate, resolve its wiki page (same direct-title +
 *    MediaWiki-search-with-`id=`-verification skeleton as `fetch-skill-coefficients.ts`'s
 *    `resolveSkillPage`, simplified — no sibling-attribution tier, this script doesn't need one)
 *    and check whether the page's own `{{skill fact|LABEL|...}}` invocations include any LABEL
 *    beyond the same meta set. A skill with a substantive description AND zero non-meta wiki
 *    templates either either genuinely has no further numeric effect to model (most of pass 1's
 *    candidates turn out to be this — see below) or is a genuine "wiki only has prose" case; a
 *    skill where the wiki DOES carry non-meta templates the local API omits is the real,
 *    actionable Otherworldly-Bond-shaped finding this scan exists to surface.
 *
 * Why pass 1 alone isn't the report: manually spot-checking its raw output found it's dominated by
 * a large, well-understood, NOT-a-bug pattern — toggle/mode-swap skills (kit equip/unequip,
 * legend-stance swap, shroud enter/exit, attunement swap, "release <pet form>") whose own
 * description is a real, sometimes long sentence, but which genuinely carry no further numeric
 * effect (their sub-skills, not the toggle itself, carry the facts). Pass 2 filters almost all of
 * these out automatically: a live check confirmed the wiki page for skills in this pattern (e.g.
 * "Legendary Dwarf Stance", "End Death Shroud") also carries nothing beyond Range/Recharge —
 * the wiki agrees with the API that there's nothing more to model, which is a materially different,
 * much stronger signal than description length alone. This is also why this script doesn't try to
 * hand-pattern-match description text ("starts with 'Leave'/'Release'/...") to exclude the toggle
 * pattern up front — the wiki check already does that filtering, authoritatively, for free.
 *
 * `{{skill fact|otherworldly bond}}`'s own live wikitext (fetched while building this, 2026-08-08)
 * is exactly the validating case: 15+ `{{skill fact|...}}` invocations (vulnerability/crippled/
 * slow/might/fury/duration/interval/allied-targets lines) fully describing the tether mechanic the
 * TODO.md bug entry says the API omits entirely — confirming the wiki genuinely does carry
 * structured data the API's `facts` array doesn't, for at least this one seed case, and that a
 * scripted presence check (not prose-parsing) is enough to surface it.
 *
 * Run manually via `npm run scan-empty-effect-facts`, after `npm run fetch-game-data`.
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Fact, Skill } from '../src/shared/types/game-data'
import { fetchWikiPage, flushWikiCache } from './lib/wiki-cache'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
// Same gotcha as every other fetch-*.ts script: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

/** Fact types that describe positioning/timing overhead, not what a skill actually DOES — see
 *  module doc comment. Kept deliberately small and conservative: every other type this app's local
 *  data carries (Damage, Number, Buff, PrefixedBuff, AttributeAdjust, HealingAdjust, Percent,
 *  StunBreak, ComboField, ComboFinisher, NoData, Unblockable, BuffArray, Time — confirmed via a
 *  full-file type-frequency scan while building this script) contributes real information about
 *  the skill's effect, even ones with an unhelpful-sounding name (`NoData`'s own `text` field is
 *  itself the content, e.g. "Pierces"/"Unblockable"/"Reflects Missiles" — not literally "no data"). */
const META_ONLY_FACT_TYPES = new Set(['Range', 'Recharge', 'Distance', 'Radius'])

/** Same set, but as the wiki template's own lowercase label vocabulary (confirmed live: `{{skill
 *  fact|range|900}}`, `{{skill fact|Radius|360}}` — casing varies, compared case-insensitively). */
const META_ONLY_WIKI_LABELS = new Set(['range', 'recharge', 'distance', 'radius'])

/** Chosen from a live look at the description-length distribution of every content-empty player
 *  skill (2026-08-08): below ~30 chars is reliably a one-line toggle label ("Release the Bear," 37
 *  chars); above 60 reliably reads as a real sentence describing a mechanic. 60 is a deliberately
 *  loose (over-inclusive) cut — pass 2's wiki check is what actually separates signal from the
 *  toggle-skill noise this alone lets through, see module doc comment. */
const MIN_DESCRIPTION_LENGTH = 60

function stripMarkup(description: string): string {
  return description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

/** Same helper as every other fetch-*.ts script — shout-style skill titles keep/drop surrounding
 *  quote marks inconsistently between the API and the wiki. */
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

function parseInfoboxSkillIds(wikitext: string): number[] {
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

/** Simplified two-tier version of `fetch-skill-coefficients.ts`'s `resolveSkillPage` — direct
 *  title match, then a MediaWiki-search fallback, each self-verified against the page's own
 *  `| id = N` infobox field. No sibling-attribution third tier here: that tier exists there to
 *  rescue a handful of ids sharing a page with a curated sibling, which this scan (a report for
 *  human review, not a value cross-check) doesn't need — an unresolved collision here just gets
 *  logged for a human to look at directly, same as any other unresolved case. */
async function resolveSkillPage(skill: Skill): Promise<PageResolution> {
  const triedTitles: string[] = []
  let anyPageFound = false

  for (const title of titleVariants(skill.name)) {
    triedTitles.push(title)
    const text = await fetchWikiPage(title)
    if (text === null) continue
    anyPageFound = true
    if (/\{\{\s*disambig/i.test(text)) continue
    if (parseInfoboxSkillIds(text).includes(skill.id)) return { status: 'ok', wikitext: text, title, method: 'direct' }
  }

  const candidates = await searchCandidateTitles(skill.name)
  for (const candidate of candidates) {
    if (triedTitles.includes(candidate)) continue
    const text = await fetchWikiPage(candidate)
    if (text === null) continue
    anyPageFound = true
    if (parseInfoboxSkillIds(text).includes(skill.id)) {
      return { status: 'ok', wikitext: text, title: candidate, method: 'disambiguated' }
    }
  }

  if (!anyPageFound) return { status: 'not-found' }
  return {
    status: 'unresolved-collision',
    note: `tried [${triedTitles.join(', ')}] and ${candidates.length} search candidate(s), none had id=${skill.id}`
  }
}

/** Every `{{skill fact|LABEL|...}}` invocation's LABEL (first pipe segment) — presence-only check,
 *  doesn't need the full param parse `fetch-skill-coefficients.ts`/`fetch-relic-effects.ts` do for
 *  actual value extraction. A label past the first `|` or `}}` is enough; nested-pipe corruption
 *  (the wrinkle those scripts guard against for value parsing) can't produce a false NEGATIVE here
 *  since the label itself is always the first segment, only affects params after it. */
function parseSkillFactLabels(wikitext: string): string[] {
  const re = /\{\{\s*skill fact\s*\|\s*([^|}]+)/gi
  const labels: string[] = []
  for (const match of wikitext.matchAll(re)) labels.push(match[1].trim())
  return labels
}

interface Candidate {
  skill: Skill
  descLen: number
}

function selectCandidates(skills: Skill[]): Candidate[] {
  const out: Candidate[] = []
  for (const skill of skills) {
    if (skill.professions.length === 0) continue
    const allFacts: Fact[] = [...skill.facts, ...skill.traitedFacts]
    const contentFacts = allFacts.filter((f) => !META_ONLY_FACT_TYPES.has(f.type))
    if (contentFacts.length > 0) continue
    const desc = stripMarkup(skill.description)
    if (desc.length < MIN_DESCRIPTION_LENGTH) continue
    out.push({ skill, descLen: desc.length })
  }
  return out
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]

  const candidates = selectCandidates(skills)
  console.log(
    `Pass 1 (local): ${candidates.length} player-equippable skills have a substantive description` +
      ` (>=${MIN_DESCRIPTION_LENGTH} chars) but zero non-meta facts, out of ${skills.length} total skills.`
  )
  console.log(`Pass 2 (wiki): checking each candidate's wiki page for a structured template covering it...\n`)

  const hasTemplate: string[] = []
  const noTemplate: string[] = []
  const unresolved: string[] = []
  let processed = 0

  for (const { skill, descLen } of candidates) {
    let resolution: PageResolution
    try {
      resolution = await resolveSkillPage(skill)
    } catch (err) {
      unresolved.push(`fetch error: skill ${skill.id} "${skill.name}" — ${(err as Error).message}`)
      processed++
      continue
    }

    if (resolution.status === 'not-found') {
      unresolved.push(`no wiki page found: skill ${skill.id} "${skill.name}" (tried: ${titleVariants(skill.name).join(', ')})`)
      processed++
      continue
    }
    if (resolution.status === 'unresolved-collision') {
      unresolved.push(`skill ${skill.id} "${skill.name}" — ${resolution.note}`)
      processed++
      continue
    }

    const labels = parseSkillFactLabels(resolution.wikitext)
    const contentLabels = [...new Set(labels.filter((l) => !META_ONLY_WIKI_LABELS.has(l.toLowerCase())))]

    const desc = stripMarkup(skill.description)
    const truncatedDesc = desc.length > 120 ? `${desc.slice(0, 117)}...` : desc

    if (contentLabels.length > 0) {
      hasTemplate.push(
        `skill ${skill.id} "${skill.name}" (${skill.type}/${skill.slot}, desc ${descLen} chars) — ` +
          `wiki page "${resolution.title}" has ${contentLabels.length} non-meta fact label(s): ` +
          `[${contentLabels.slice(0, 8).join(', ')}${contentLabels.length > 8 ? ', ...' : ''}] — desc: "${truncatedDesc}"`
      )
    } else {
      noTemplate.push(
        `skill ${skill.id} "${skill.name}" (${skill.type}/${skill.slot}, desc ${descLen} chars) — ` +
          `wiki page "${resolution.title}" also has no non-meta fact template — desc: "${truncatedDesc}"`
      )
    }

    processed++
    if (processed % 20 === 0) console.log(`  [${processed}/${candidates.length}] candidates checked...`)
  }

  console.log(`\nDone. ${processed}/${candidates.length} candidates checked.`)
  console.log(`  HAS STRUCTURED WIKI TEMPLATE (actionable — API omits data the wiki has): ${hasTemplate.length}`)
  console.log(`  NO TEMPLATE (wiki agrees with API — likely not a real gap):            ${noTemplate.length}`)
  console.log(`  UNRESOLVED (couldn't find/verify a wiki page — needs a human look):     ${unresolved.length}`)

  if (hasTemplate.length > 0) {
    console.log(`\n--- HAS STRUCTURED WIKI TEMPLATE (the actionable Otherworldly-Bond-shaped findings) ---`)
    for (const line of hasTemplate) console.log(`  - ${line}`)
  }
  if (noTemplate.length > 0) {
    console.log(`\n--- NO TEMPLATE (wiki also has nothing beyond Range/Recharge/Distance/Radius) ---`)
    for (const line of noTemplate) console.log(`  - ${line}`)
  }
  if (unresolved.length > 0) {
    console.log(`\n--- UNRESOLVED (no verified wiki page) ---`)
    for (const line of unresolved) console.log(`  - ${line}`)
  }

  await flushWikiCache()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
