/**
 * Resolves whatever duplicate-name Heal/Utility/Elite skill groups the in-code signals in
 * `src/shared/skill-calc/skill-variants.ts` (attunement/specialization/flip-root/ground-target/
 * glyph-form/turret-sub-ability) still can't collapse, and writes
 * data/game-data/skill-variant-exclusions.json.
 *
 * Re-derives "still ambiguous today" by importing and calling the real `visibleSkillsForSlot`
 * (not a reimplementation) across every (profession, slot) combination in the already-fetched
 * data/game-data/skills.json, with no spec equipped (matching how this project has re-counted
 * ambiguous groups in every prior session) and the already-resolved glyph-form-variants.json
 * applied. For every group still >1 after that, fetches the skill name's own wiki page and treats
 * its `{{Skill infobox}}` `id=` field (a bare id or a comma-separated list, e.g.
 * `id = 5910, 29522`) as authoritative for "what a player can currently bind" — any local group id
 * NOT listed there is excluded (e.g. a legacy id the current page no longer documents, or a
 * dedicated "(underwater)"/other-context sibling page's own id, since this app has no per-skill
 * environment toggle outside the weapon bar). A group's wiki id set and local id set must share at
 * least one id before anything is excluded (confirms the right page was found) — if the wiki page
 * doesn't confirm even one local id, or lists every local id already, the group is left untouched
 * and logged, fail-safe rather than guessed. See docs/game-data.md for the full per-group writeup
 * from the session this was built in.
 *
 * Run manually via `npm run fetch-skill-duplicate-resolutions`, after `npm run fetch-game-data` and
 * `npm run fetch-glyph-forms` (needs both already-fetched).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { visibleSkillsForSlot } from '../src/shared/skill-calc/skill-variants'
import type { GlyphFormVariantMap, ProfessionId, Skill, SkillVariantExclusions } from '../src/shared/types/game-data'
import { fetchWikiPage, flushWikiCache } from './lib/wiki-cache'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

/** Parses a `{{Skill infobox}}` `id=` field into every listed id, e.g.
 *  `5910, 29522` -> [5910, 29522], `79323 <!-- fire -->,  76634 <!-- water-->` -> [79323, 76634]. */
function parseInfoboxIds(text: string): number[] {
  const match = /\|\s*id\s*=\s*([^\n]+)/.exec(text)
  if (!match) return []
  const withoutComments = match[1].replace(/<!--.*?-->/g, '')
  return withoutComments
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n))
}

/** Every (profession, slot) bucket present in the local data, mirroring how
 *  `game-data-store.tsx`'s `skillsForProfessionAndSlot` scopes candidates. */
function allBuckets(skills: Skill[]): { profession: ProfessionId; slot: 'Heal' | 'Utility' | 'Elite'; bucket: Skill[] }[] {
  const professions = new Set<ProfessionId>()
  for (const s of skills) for (const p of s.professions) professions.add(p)

  const buckets: { profession: ProfessionId; slot: 'Heal' | 'Utility' | 'Elite'; bucket: Skill[] }[] = []
  for (const profession of professions) {
    for (const slot of ['Heal', 'Utility', 'Elite'] as const) {
      const bucket = skills.filter((s) => s.slot === slot && s.professions.includes(profession))
      if (bucket.length > 0) buckets.push({ profession, slot, bucket })
    }
  }
  return buckets
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const glyphFormVariants = JSON.parse(
    await readFile(join(DATA_DIR, 'glyph-form-variants.json'), 'utf-8')
  ) as GlyphFormVariantMap

  // Discover every still-ambiguous same-name group (no spec equipped, matching how this project has
  // re-counted ambiguous groups every prior session), deduped by its exact id set — a multi-
  // profession skill (e.g. a shared Mistfire Wolf-style Elite) would otherwise repeat once per
  // profession bucket.
  const seenGroupKeys = new Set<string>()
  const ambiguousGroups: { name: string; ids: number[] }[] = []
  for (const { bucket } of allBuckets(skills)) {
    const visible = visibleSkillsForSlot(bucket, new Set(), glyphFormVariants)
    const byName = new Map<string, Skill[]>()
    for (const s of visible) {
      if (!byName.has(s.name)) byName.set(s.name, [])
      byName.get(s.name)!.push(s)
    }
    for (const [name, group] of byName) {
      if (group.length <= 1) continue
      const ids = group.map((s) => s.id).sort((a, b) => a - b)
      const key = `${name}::${ids.join(',')}`
      if (seenGroupKeys.has(key)) continue
      seenGroupKeys.add(key)
      ambiguousGroups.push({ name, ids })
    }
  }
  console.log(`Found ${ambiguousGroups.length} still-ambiguous duplicate-name groups.`)

  const excludeIds = new Set<number>()
  const log: string[] = []
  let resolvedGroups = 0
  let partiallyResolvedGroups = 0

  for (const { name, ids } of ambiguousGroups) {
    let text: string | null
    try {
      text = await fetchWikiPage(name.replace(/ /g, '_'))
    } catch (err) {
      log.push(`skip (fetch error): "${name}" [${ids.join(', ')}] — ${(err as Error).message}`)
      continue
    }
    if (text === null) {
      log.push(`skip (page not found): "${name}" [${ids.join(', ')}]`)
      continue
    }

    const wikiIds = new Set(parseInfoboxIds(text))
    if (wikiIds.size === 0) {
      log.push(`skip (no id= found on wiki page): "${name}" [${ids.join(', ')}]`)
      continue
    }
    const overlap = ids.some((id) => wikiIds.has(id))
    if (!overlap) {
      log.push(`skip (wiki ids [${[...wikiIds].join(', ')}] share nothing with local group): "${name}" [${ids.join(', ')}]`)
      continue
    }

    const toExclude = ids.filter((id) => !wikiIds.has(id))
    if (toExclude.length === 0) {
      log.push(`no change (wiki lists every local id, still ambiguous): "${name}" [${ids.join(', ')}]`)
      continue
    }

    for (const id of toExclude) excludeIds.add(id)
    const remaining = ids.filter((id) => !toExclude.includes(id))
    if (remaining.length === 1) {
      resolvedGroups++
      console.log(`  "${name}": resolved to ${remaining[0]}, excluded [${toExclude.join(', ')}]`)
    } else {
      partiallyResolvedGroups++
      console.log(`  "${name}": narrowed to [${remaining.join(', ')}], excluded [${toExclude.join(', ')}]`)
    }
  }

  const result: SkillVariantExclusions = [...excludeIds].sort((a, b) => a - b)
  await flushWikiCache()
  await writeFile(join(DATA_DIR, 'skill-variant-exclusions.json'), JSON.stringify(result, null, 2))

  console.log(
    `\nDone. ${resolvedGroups} groups fully resolved, ${partiallyResolvedGroups} narrowed but still ambiguous, ` +
      `${ambiguousGroups.length - resolvedGroups - partiallyResolvedGroups} unchanged. ` +
      `${result.length} ids written to skill-variant-exclusions.json.`
  )
  if (log.length > 0) {
    console.warn(`\n${log.length} log lines:`)
    for (const line of log) console.warn(`  - ${line}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
