/**
 * Fetches skill/trait Recharge (cooldown) WvW-vs-PvE overrides from the wiki, writing
 * data/game-data/recharge-wvw-overrides.json.
 *
 * `/v2/skills` and `/v2/traits` each expose exactly one `Recharge`-type `Fact` per id (confirmed
 * live: never more than one, never split into a duplicate pve/wvw pair the way `Buff` facts
 * sometimes are — see `fetch-wvw-splits.ts`), and its `value` is always the PvE-reference-build
 * number. The wiki's own `{{Skill infobox}}`/`{{Trait infobox}}` templates carry a separate
 * `recharge wvw=` field on top of the base `recharge=` field for skills/traits whose cooldown
 * actually differs in WvW (confirmed live via `insource:"recharge_wvw"`: 649 pages) — e.g.
 * Warrior's Full Counter is `recharge = 8` (PvE) vs. `recharge wvw = 12`, a 50% difference this app
 * was showing wrong for one of the most commonly-played WvW Warrior skills before this script
 * existed.
 *
 * This is the exact same shape TODO.md flagged as "already solved for relics, never generalized":
 * `scripts/fetch-relic-effects.ts`'s `parseRechargeSeconds` already prefers a relic's own
 * `recharge wvw=` field over its `recharge=` field (see `RelicEffect.rechargeSeconds`,
 * `docs/game-data.md`'s "Relic numeric effects" section) — this script is that same parse applied
 * to skills/traits instead, with the same wiki/API cross-validation discipline
 * `fetch-wvw-splits.ts` uses for Buff-fact splits (never trust a parsed wiki value that doesn't
 * independently match the already-fetched API data first, to catch a wrong-page match rather than
 * silently writing a corrupted override).
 *
 * **Ambiguous names are skipped outright, not guessed at** — same fail-safe convention
 * `fetch-wvw-splits.ts` uses: a name shared by 2+ player-equippable ids (e.g. a same-named skill
 * duplicated across an elite-spec rework, a flip-skill/underwater variant, ...) has no reliable way
 * to know which wiki infobox (there's normally only one per page) belongs to which id, so those are
 * logged and left for a future hand-added entry in `MANUAL_OVERRIDES` rather than risked.
 *
 * Run manually via `npm run fetch-recharge-wvw-overrides`, after `npm run fetch-game-data`.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Skill, Trait } from '../src/shared/types/game-data'
import { fetchWikiPage, flushWikiCache } from './lib/wiki-cache'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

const EPSILON = 0.01

/** Wiki article titles for shout-style skills keep surrounding quote marks the API's skill.name
 *  drops (or vice versa) — try both forms, same helper as fetch-wvw-splits.ts/fetch-elite-spec-skills.ts. */
function titleVariants(title: string): string[] {
  const unquoted = title.replace(/^"(.*)"$/, '$1')
  return unquoted === title ? [title, `"${title}"`] : [title, unquoted]
}

interface Candidate {
  kind: 'skill' | 'trait'
  id: number
  name: string
  apiRecharge: number
}

/** Player-equippable skills (`professions.length > 0`, same filter `audit-data-completeness.ts`
 *  uses to exclude NPC/monster-only ids) carrying exactly one `Recharge` fact — confirmed live
 *  (2026-08-22) that every skill/trait with a `Recharge` fact has exactly one, always in `facts`
 *  (never `traitedFacts`), so no dedup/multi-fact handling is needed here unlike `Buff` facts. */
function collectSkillCandidates(skills: Skill[]): Candidate[] {
  const out: Candidate[] = []
  for (const skill of skills) {
    if (skill.professions.length === 0) continue
    const fact = skill.facts.find((f) => f.type === 'Recharge')
    if (fact && typeof fact.value === 'number') out.push({ kind: 'skill', id: skill.id, name: skill.name, apiRecharge: fact.value })
  }
  return out
}

function collectTraitCandidates(traits: Trait[]): Candidate[] {
  const out: Candidate[] = []
  for (const trait of traits) {
    const fact = trait.facts.find((f) => f.type === 'Recharge')
    if (fact && typeof fact.value === 'number') out.push({ kind: 'trait', id: trait.id, name: trait.name, apiRecharge: fact.value })
  }
  return out
}

function groupByName(candidates: Candidate[]): Map<string, Candidate[]> {
  const byName = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const list = byName.get(c.name) ?? []
    list.push(c)
    byName.set(c.name, list)
  }
  return byName
}

/** Reads `recharge=`/`recharge wvw=` straight off an infobox block — same anchored-line regex as
 *  `fetch-relic-effects.ts`'s `parseRechargeSeconds` (the `recharge\s*=` pattern naturally skips
 *  past a `recharge wvw =` line since "wvw" sits between "recharge" and "=" there, not whitespace). */
function parseRechargeFields(infobox: string): { base: number | null; wvw: number | null } {
  const baseMatch = /^\|\s*recharge\s*=\s*([\d.]+)/im.exec(infobox)
  const wvwMatch = /^\|\s*recharge\s+wvw\s*=\s*([\d.]+)/im.exec(infobox)
  return { base: baseMatch ? Number(baseMatch[1]) : null, wvw: wvwMatch ? Number(wvwMatch[1]) : null }
}

/**
 * Hand-curated exceptions for cases the automated sweep can't confidently resolve on its own —
 * same role as `fetch-wvw-splits.ts`'s own `MANUAL_OVERRIDES`. Empty until a first run's log
 * surfaces something worth adding by hand (an ambiguous-name skip whose real per-id split was
 * confirmed manually, an API-rounding quirk, etc.).
 */
const MANUAL_OVERRIDES: { skill: Record<number, number>; trait: Record<number, number> } = {
  skill: {},
  trait: {}
}

function applyManualOverrides(result: { skill: Record<number, number>; trait: Record<number, number> }): void {
  Object.assign(result.skill, MANUAL_OVERRIDES.skill)
  Object.assign(result.trait, MANUAL_OVERRIDES.trait)
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const traits = JSON.parse(await readFile(join(DATA_DIR, 'traits.json'), 'utf-8')) as Trait[]

  const skillsByName = groupByName(collectSkillCandidates(skills))
  const traitsByName = groupByName(collectTraitCandidates(traits))

  const skippedAmbiguous: string[] = []
  const log: string[] = []
  const result: { skill: Record<number, number>; trait: Record<number, number> } = { skill: {}, trait: {} }

  async function processName(name: string, candidates: Candidate[], bucket: Record<number, number>): Promise<void> {
    if (candidates.length !== 1) {
      skippedAmbiguous.push(`${candidates[0].kind} "${name}" -> ids [${candidates.map((c) => c.id).join(', ')}]`)
      return
    }
    const candidate = candidates[0]

    let wikitext: string | null = null
    for (const title of titleVariants(name)) {
      try {
        wikitext = await fetchWikiPage(title)
      } catch (err) {
        log.push(`skip (fetch error): ${candidate.kind} ${candidate.id} "${title}" — ${(err as Error).message}`)
        return
      }
      if (wikitext !== null) break
    }
    if (wikitext === null) {
      log.push(`skip (page not found): ${candidate.kind} ${candidate.id} "${name}"`)
      return
    }

    const templateName = candidate.kind === 'skill' ? 'Skill' : 'Trait'
    const infoboxMatch = new RegExp(`\\{\\{\\s*${templateName}\\s+infobox([\\s\\S]*?)\\n\\}\\}`, 'i').exec(wikitext)
    if (!infoboxMatch) {
      log.push(`skip (no ${templateName} infobox found): ${candidate.kind} ${candidate.id} "${name}"`)
      return
    }

    const { base, wvw } = parseRechargeFields(infoboxMatch[1])
    if (base === null) {
      log.push(`skip (no recharge= field in infobox): ${candidate.kind} ${candidate.id} "${name}"`)
      return
    }
    if (Math.abs(base - candidate.apiRecharge) > EPSILON) {
      log.push(`skip (validation mismatch): ${candidate.kind} ${candidate.id} "${name}" — API=${candidate.apiRecharge}, parsed base=${base}`)
      return
    }
    if (wvw === null) return // not split, nothing to do
    if (Math.abs(wvw - base) <= EPSILON) return // wiki lists a wvw field but it matches the base value — no real override

    bucket[candidate.id] = wvw
  }

  const skillNames = [...skillsByName.keys()]
  const traitNames = [...traitsByName.keys()]
  const totalNames = skillNames.length + traitNames.length
  console.log(`Processing ${skillNames.length} skill names + ${traitNames.length} trait names...`)

  let processed = 0
  for (const name of skillNames) {
    await processName(name, skillsByName.get(name)!, result.skill)
    processed++
    if (processed % 50 === 0) console.log(`  [${processed}/${totalNames}] names processed...`)
  }
  for (const name of traitNames) {
    await processName(name, traitsByName.get(name)!, result.trait)
    processed++
    if (processed % 50 === 0) console.log(`  [${processed}/${totalNames}] names processed...`)
  }

  applyManualOverrides(result)
  await flushWikiCache()
  await writeFile(join(DATA_DIR, 'recharge-wvw-overrides.json'), JSON.stringify(result, null, 2))

  const skillCount = Object.keys(result.skill).length
  const traitCount = Object.keys(result.trait).length
  console.log(`\nDone. Recharge WvW overrides written for ${skillCount} skills + ${traitCount} traits to recharge-wvw-overrides.json.`)
  console.log(`\n${log.length} log lines (skipped/unvalidated):`)
  for (const line of log) console.warn(`  - ${line}`)
  if (skippedAmbiguous.length > 0) {
    console.warn(`\n${skippedAmbiguous.length} names excluded outright (maps to 2+ player-equippable ids):`)
    for (const line of skippedAmbiguous) console.warn(`  - ${line}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
