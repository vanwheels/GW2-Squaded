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
 * against the already-fetched API duration before being trusted — see `resolveOverride`.
 * Anything ambiguous (multiple same-game-mode fact lines for one boon on one page, a parsed PvE
 * value that doesn't match any of the API's) is skipped and logged rather than guessed, same
 * fail-safe philosophy as scripts/fetch-elite-spec-skills.ts.
 *
 * **Multiple Buff facts sharing one status on one id** (`statusCounts.get(boonName) > 1`): live-
 * verified 2026-08-06 while investigating Firebrand Mantra final-charge skills (Overwhelming
 * Celerity, Flame Surge/Rush, ...) — most of the time this is a genuine multi-hit/multi-pulse
 * mechanic (a 4-shot volley applying Bleeding on each hit; ~550 skills/traits in the local data fit
 * this shape) where showing every application separately is correct and this script must NOT touch
 * it. But a handful are actually one PvE/PvP/WvW-specific value per raw fact with no discriminator
 * at all (confirmed via raw wikitext, e.g. Overwhelming Celerity's Might: `{{skill fact|might|10|
 * game mode=pve}}{{skill fact|might|6|game mode=pvp wvw}}` maps 1:1 onto its 2 raw API Might
 * facts). `resolveOverride` only resolves this shape when the wiki's PvE-tagged AND WvW-tagged
 * values can BOTH be found among that status's actual raw API durations (not just one of the two,
 * unlike the single-fact case below) — this catches cases where the locally-cached API data has
 * drifted from the wiki's current numbers (e.g. Potent Haste's Quickness: wiki says pve=2.5/
 * wvw=1, but the cached API facts are {3, 1} — 2.5 doesn't appear anywhere in that set, so it's
 * skipped rather than trusting the coincidental wvw-side match). `sources.ts`'s `extractFromFacts`
 * is what actually collapses the raw duplicate facts down to the single overridden row at read
 * time — this script only decides which value that row should show.
 *
 * Run manually via `npm run fetch-wvw-splits`, after `npm run fetch-game-data` (matches wiki page
 * titles against the already-fetched data/game-data/{skills,traits}.json by name).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Skill, Trait, WvwFactOverride, WvwFactOverrides } from '../src/shared/types/game-data'
import { BOON_NAMES, CONDITION_NAMES } from '../src/shared/boon-calc/constants'
import { fetchWikiPage, flushWikiCache } from './lib/wiki-cache'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
const REQUEST_DELAY_MS = 150
// Same gotcha as fetch-elite-spec-skills.ts: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const NAME_BY_LOWER = new Map<string, string>([...BOON_NAMES, ...CONDITION_NAMES].map((n) => [n.toLowerCase(), n]))
/** Shorthand/alternate names the wiki's `{{skill fact|...}}`/`{{trait fact|...}}` templates use
 *  for a boon/condition instead of its canonical API `Fact.status` string (found live 2026-08-06 on
 *  Firebrand Mantra pages — "Blind" for Blinded, "immobilized" for Immobile). Without these, a
 *  wikitext line using the alt name is silently dropped by `parseFactLines` (not in `NAME_BY_LOWER`
 *  at all) rather than logged, so the boon/condition it splits ends up looking simply unsplit —
 *  add more here if a future page turns up another alias, rather than guessing at others upfront. */
const WIKI_NAME_ALIASES: Record<string, string> = { blind: 'Blinded', immobilized: 'Immobile' }
for (const [alias, canonical] of Object.entries(WIKI_NAME_ALIASES)) NAME_BY_LOWER.set(alias, canonical)

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
  statusDurations: Map<string, number[]> // boon/condition name -> every one of those facts' own API durations, in order
}

function collectCandidates(objects: (Skill | Trait)[], kind: 'skill' | 'trait'): Map<string, CandidateObject[]> {
  const byName = new Map<string, CandidateObject[]>()
  for (const obj of objects) {
    const statusCounts = new Map<string, number>()
    const statusDurations = new Map<string, number[]>()
    for (const fact of [...obj.facts, ...obj.traitedFacts]) {
      if (fact.type !== 'Buff' || typeof fact.status !== 'string' || typeof fact.duration !== 'number') continue
      if (!NAME_BY_LOWER.has(fact.status.toLowerCase())) continue
      statusCounts.set(fact.status, (statusCounts.get(fact.status) ?? 0) + 1)
      const durations = statusDurations.get(fact.status) ?? []
      durations.push(fact.duration)
      statusDurations.set(fact.status, durations)
    }
    if (statusCounts.size === 0) continue
    const candidate: CandidateObject = { kind, id: obj.id, name: obj.name, statusCounts, statusDurations }
    const list = byName.get(obj.name) ?? []
    list.push(candidate)
    byName.set(obj.name, list)
  }
  return byName
}

const EPSILON = 0.01

function containsWithinEpsilon(durations: number[], target: number): boolean {
  return durations.some((d) => Math.abs(d - target) <= EPSILON)
}

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
  const factCount = candidate.statusCounts.get(boonName) ?? 0
  const apiDurations = candidate.statusDurations.get(boonName) ?? []

  const withMode = lines.filter((l) => l.gameModeTokens !== null)
  const withoutMode = lines.filter((l) => l.gameModeTokens === null)
  if (withMode.length === 0) return undefined // not actually split for this boon, nothing to do

  if (withoutMode.length > 0) {
    log.push(`skip (mixed modal/non-modal): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
    return undefined
  }

  // Bucket by explicit 'pve'/'wvw' token, not "wvw" vs "everything else" — a genuine 3-way split
  // (pve/wvw/pvp each their own separate {{skill fact}} line, e.g. Echo of Truth's Crippled: pve=4,
  // wvw=2, pvp=1) was previously miscounted as 2 "PvE-side" lines (the pve AND the pvp-only lines
  // both fell into the "not wvw" bucket), always tripping this ambiguity check even though it's
  // perfectly resolvable — live-verified 2026-08-06, ~80 pages hit this across the full dataset. A
  // pvp-only line (tagged neither 'pve' nor 'wvw') is outside this app's PvE-default/WvW-override
  // model and is simply ignored, not counted toward either bucket.
  const wvwLines = withMode.filter((l) => l.gameModeTokens!.includes('wvw'))
  const pveLines = withMode.filter((l) => l.gameModeTokens!.includes('pve'))
  if (wvwLines.length > 1 || pveLines.length > 1) {
    log.push(`skip (ambiguous multi-entry): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
    return undefined
  }

  if (factCount > 1) {
    // Multiple raw Buff facts share this status with no discriminator — see this file's own top
    // comment ("Multiple Buff facts sharing one status on one id"). Only resolvable when BOTH the
    // wiki's PvE-tagged AND WvW-tagged values can be found among the actual raw API durations
    // (not just one of the two) — requiring both catches locally-cached API data that's drifted
    // from the wiki's current numbers, where trusting a single coincidental match would silently
    // apply the wrong override. `sources.ts`'s `extractFromFacts` collapses every raw fact for
    // this status down to one row using this override at read time, once it exists.
    if (pveLines.length !== 1) {
      log.push(`skip (cardinality ${factCount}, no clean single pve line): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
      return undefined
    }
    if (!containsWithinEpsilon(apiDurations, pveLines[0].duration)) {
      log.push(
        `skip (cardinality ${factCount}, validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=[${apiDurations.join(', ')}], parsed PvE=${pveLines[0].duration}`
      )
      return undefined
    }
    if (wvwLines.length === 0) return 'omit'
    if (!containsWithinEpsilon(apiDurations, wvwLines[0].duration)) {
      log.push(
        `skip (cardinality ${factCount}, validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=[${apiDurations.join(', ')}], parsed WvW=${wvwLines[0].duration}`
      )
      return undefined
    }
    return wvwLines[0].duration
  }

  if (factCount === 0) {
    log.push(`skip (no matching Buff fact on object): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
    return undefined
  }

  const apiDuration = apiDurations[0]

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

  // Every game-mode-tagged line exists, but none of them is 'pve' or 'wvw' — i.e. every line is
  // pvp-only (or some other mode this app doesn't model). Symmetric with the pve-only/no-wvw-line
  // case above (factCount===1, pveLines===1, wvwLines===0 -> 'omit'): this app only ever displays
  // PvE-baseline-plus-WvW-override, never PvP, so a fact documented as applying in NEITHER of those
  // two modes doesn't apply here either. Live-verified 2026-08-06 on Martial Cadence (trait 1667,
  // Quickness tagged `pvp` only — its own version history confirms the WvW variant swapped to
  // Stability instead as of the 2025-04-15 patch, a different Buff entirely, not "omit"'s usual
  // "doesn't apply outside PvE") and Kinetic Accelerators (trait 2052, Fury tagged `pvp` only, no
  // pve/wvw counterpart at all).
  if (pveLines.length === 0 && wvwLines.length === 0) {
    return 'omit'
  }

  log.push(`skip (unhandled combination): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
  return undefined
}

/**
 * Hand-curated exceptions merged in after the automated sweep, for cases the wiki-vs-API
 * cross-validation can never confidently pass on its own. Currently just one root cause:
 *
 * **The GW2 API rounds a half-second (X.5s) Buff duration up to the next whole second**,
 * live-reconfirmed 2026-08-06 on two Firebrand Mantra of Potence skills with unrelated patch
 * histories (so not a shared one-off drift, but a real API quirk): Potent Haste's PvE Quickness
 * has been wiki-documented as 2.5s since 2018-12-11 (untouched since), yet `/v2/skills` returns
 * {3, 1} for its Quickness facts — `3` standing in for that `2.5`, `1` matching the wiki's WvW/PvP
 * value exactly. Overwhelming Celerity's WvW Quickness was nerfed from 4s to 2.5s by the
 * 2025-04-15 patch (wiki version history), yet `/v2/skills` returns {5, 4, 3} — again `3` standing
 * in for the `2.5`, with the PvE (5) and PvP (4, unused by this app) values matching exactly. Since
 * `resolveOverride`'s whole design is "only trust a wiki value that's independently confirmed
 * present in the raw API set" (see this file's top comment), neither skill's WvW value can ever
 * pass that check — the API itself has never carried a literal `2.5` for either. Curated here
 * instead of loosening the general validation (which exists to catch genuine wiki/API drift, not
 * to paper over this specific rounding quirk).
 */
const MANUAL_OVERRIDES: { skill: Record<number, Record<string, WvwFactOverride>>; trait: Record<number, Record<string, WvwFactOverride>> } = {
  skill: {
    41988: { Quickness: 2.5 }, // Overwhelming Celerity — WvW value per 2025-04-15 patch notes
    42983: { Quickness: 1 }, // Potent Haste — WvW value unchanged since 2020-02-25; entry exists to
    // collapse the {3, 1} duplicate-fact pair down to one row (see extractFromFacts in sources.ts)

    // Elixir of ___ cluster (Necromancer/Harbinger, empty-effect-facts curation, see
    // synthetic-facts.json): these skills have zero real API Buff facts, so this script's own
    // candidate discovery (which starts from an existing Buff fact's status) never considers them
    // — a different root cause than the rounding quirk above, but the same "can't pass the
    // automated cross-validation" outcome. Both members of each GroundTargeted/non-GroundTargeted
    // duplicate pair get an entry since the wiki page (and its `id=` list) covers both ids
    // identically. Wiki-confirmed pve-vs-wvw split; every other boon this cluster grants shares one
    // value across pve+wvw (only pvp differs, which this app doesn't model — see WvwFactOverrides'
    // doc comment).
    62530: { Might: 6 }, // Elixir of Risk (GroundTargeted id) — PvE 10s, WvW/PvP 6s
    68105: { Might: 6 }, // Elixir of Risk (canonical id)
    62662: { Quickness: 4 }, // Elixir of Anguish (GroundTargeted id) — PvE 5s, WvW/PvP 4s
    68113: { Quickness: 4 } // Elixir of Anguish (canonical id)
  },
  trait: {}
}

function applyManualOverrides(result: WvwFactOverrides, log: string[]): void {
  for (const kind of ['skill', 'trait'] as const) {
    for (const [idStr, overrides] of Object.entries(MANUAL_OVERRIDES[kind])) {
      const id = Number(idStr)
      const existing = result[kind][id] ?? {}
      for (const [boonName, value] of Object.entries(overrides)) {
        if (existing[boonName] !== undefined && existing[boonName] !== value) {
          log.push(`manual override REPLACES automated result: ${kind} ${id} / ${boonName} — automated=${existing[boonName]}, manual=${value}`)
        }
        existing[boonName] = value
      }
      result[kind][id] = existing
    }
  }
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

    let wikitext: string | null
    try {
      wikitext = await fetchWikiPage(name)
    } catch (err) {
      log.push(`skip (fetch error): ${candidate.kind} ${candidate.id} "${name}" — ${(err as Error).message}`)
      return
    }
    if (wikitext === null) {
      log.push(`skip (page not found): ${candidate.kind} ${candidate.id} "${name}"`)
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
  }
  for (const name of traitPages) {
    await processPage(name, traitsByName, result.trait)
    fetched++
    if (fetched % 50 === 0) console.log(`  [${fetched}/${totalPages}] pages fetched...`)
  }

  applyManualOverrides(result, log)
  await flushWikiCache()

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
