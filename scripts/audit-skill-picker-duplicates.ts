/**
 * Full skill-picker duplicate-id audit — bumped ahead of the Weapon-slot Damage sweep per user
 * request 2026-08-04 (see TODO.md's "Next up" section). Supersedes
 * `fetch-skill-duplicate-resolutions.ts` for the Heal/Utility/Elite slots it covers: that script only
 * wiki-checks a same-name group when `visibleSkillsForSlot` still returns >1 id for it, but the
 * in-code signals in `src/shared/skill-calc/skill-variants.ts` (GroundTargeted collapse, attunement
 * collapse, specialization-match, flip-root) can already narrow a group to exactly 1 id *before* any
 * wiki cross-check ever runs — so a stale/defunct id can silently win with zero verification. This
 * script checks EVERY same-name group with >1 raw candidate id, regardless of how confidently the
 * in-code signals resolved it, and confirms whatever id(s) they landed on actually appear in that
 * skill's own wiki infobox `id=` field (the same authoritative source
 * `fetch-skill-duplicate-resolutions.ts` already uses).
 *
 * Runs every (profession, slot, elite-spec-state) combination — a spec-less baseline plus each of
 * the profession's 4 elite specs equipped individually, same methodology the Damage-sweep candidate
 * scans used — since `eliteSpecSkills` gating can change which raw ids even reach a given name-group,
 * and `specializationId`-match resolution can pick differently depending which spec is active. A
 * group is deduped by (name, sorted raw id set) across every run it appears in, and every distinct
 * resolved id seen across all those runs is checked against the wiki.
 *
 * For each group: fetches the skill name's wiki page once, parses its `{{Skill infobox}}` `id=`
 * field. An id the in-code signals resolved to that ISN'T in that set is a *candidate* bug — but the
 * 2026-08-04 audit session that first ran this script found the wiki-id=-absence signal alone throws
 * real false positives whenever a same-name group mixes a spec-less base id with a later
 * `specializationId`-gated rework (a base wiki page routinely documents only the base id and says
 * nothing about an elite-spec's own separately-numbered rework, e.g. Dragonhunter's Renewed Focus
 * `68666` or Conduit's Call to Anguish `78798` — both genuinely real, richer variants confirmed via a
 * live `/v2/skills` pull, not stale duplicates). So a flagged id is only ever auto-excluded when it's
 * corroborated by a second, independent signal:
 *   1. it shares the resolved-good id's own `specializationId` (both null, or both the same spec) —
 *      rules out the base/rework mixup above; AND
 *   2. it has no `flipSkill` relationship to (or from) another id in the same raw group — a same-name
 *      flip pair (e.g. `9154` -> `68666`) is a real, deliberately-linked pair, not a stray duplicate;
 *      AND
 *   3. it isn't currently a key in `CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS` — a
 *      human already pointed real curated data at this id, which needs a considered re-key (or to be
 *      left alone), not a silent auto-exclude that would strand that entry as unreachable dead data.
 * Anything failing one of these checks is logged as "needs manual review" instead of being excluded —
 * see the ids reverted/re-keyed in `damage-calc.ts`/`healing-calc.ts` by that first audit session for
 * exactly this shape of near-miss (Renewed Focus, Signet of Courage, Pain Absorption, Empowering
 * Misery, Banish Enchantment, Call to Anguish, Water Spirit's Vindicator-legend-swap-adjacent cousins
 * Tree Song/Scavenger Burst). A group's wiki id set and local id set must also share at least one id
 * before anything is excluded (confirms the right wiki page was found) — if not, or if the wiki page
 * has no `id=` field at all, the group is left untouched and logged, fail-safe rather than guessed.
 *
 * After computing the new exclusion set, re-runs the whole scan against it (no new wiki fetches,
 * using the already-cached wiki id sets) to verify every fix actually converges — every group flagged
 * as a bug should now resolve to only wiki-confirmed ids. Anything that doesn't converge is logged
 * for manual review rather than silently left wrong.
 *
 * Run manually via `npm run audit-skill-picker-duplicates`, after `npm run fetch-game-data`,
 * `npm run fetch-elite-spec-skills`, and `npm run fetch-glyph-forms` (needs all three already
 * fetched). Safe to re-run — starts from whatever's currently in skill-variant-exclusions.json rather
 * than from scratch, so a clean re-run should find zero new auto-excludable bugs (the "needs manual
 * review" log lines are expected to recur every run until a human resolves them one way or the other,
 * same as the "still unresolved" log lines from `fetch-skill-duplicate-resolutions.ts`).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { visibleSkillsForSlot } from '../src/shared/skill-calc/skill-variants'
import type {
  GlyphFormVariantMap,
  ProfessionId,
  Skill,
  SkillVariantExclusions,
  Specialization
} from '../src/shared/types/game-data'

const WIKI_INDEX = 'https://wiki.guildwars2.com/index.php'
const REQUEST_DELAY_MS = 150
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'
const SLOTS = ['Heal', 'Utility', 'Elite'] as const

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

/** Every numeric key in `CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS` — a lightweight
 *  regex scrape of the source rather than importing the (large, unrelated) modules, just to answer
 *  "would auto-excluding this id strand an already-curated entry as unreachable dead data?" */
async function loadCuratedKeys(): Promise<Set<number>> {
  const files = ['src/shared/skill-calc/damage-calc.ts', 'src/shared/skill-calc/healing-calc.ts']
  const keys = new Set<number>()
  for (const file of files) {
    const text = await readFile(join(__dirname, '..', file), 'utf-8')
    const re = /^\s*(\d+):\s*\[/gm
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) keys.add(Number(m[1]))
  }
  return keys
}

interface GroupInfo {
  name: string
  rawIds: number[]
  resolvedIdsSeen: Set<number>
}

/**
 * Scans every (profession, slot, elite-spec-state) combination and returns every same-name group
 * with >1 raw candidate id, deduped by (name, sorted raw ids), with the union of every id the real
 * `visibleSkillsForSlot` resolved that group to across all the runs it appeared in.
 */
function scanGroups(
  skills: Skill[],
  professions: ProfessionId[],
  eliteSpecsByProfession: Map<ProfessionId, Specialization[]>,
  eliteSpecSkills: Record<string, number>,
  glyphFormVariants: GlyphFormVariantMap,
  exclusions: ReadonlySet<number>
): Map<string, GroupInfo> {
  const groups = new Map<string, GroupInfo>()

  for (const profession of professions) {
    const eliteSpecs = eliteSpecsByProfession.get(profession) ?? []
    const specRuns: (number | null)[] = [null, ...eliteSpecs.map((s) => s.id)]

    for (const specId of specRuns) {
      const equipped = specId === null ? new Set<number>() : new Set([specId])

      for (const slot of SLOTS) {
        const candidates = skills.filter((s) => {
          if (s.slot !== slot || !s.professions.includes(profession)) return false
          const requiredSpecId = eliteSpecSkills[String(s.id)]
          return requiredSpecId === undefined || equipped.has(requiredSpecId)
        })
        if (candidates.length === 0) continue

        const byName = new Map<string, Skill[]>()
        for (const s of candidates) {
          if (!byName.has(s.name)) byName.set(s.name, [])
          byName.get(s.name)!.push(s)
        }
        const rawGroups = [...byName.entries()].filter(([, g]) => g.length > 1)
        if (rawGroups.length === 0) continue

        const visible = visibleSkillsForSlot(candidates, equipped, glyphFormVariants, exclusions)
        const visibleIds = new Set(visible.map((s) => s.id))

        for (const [name, group] of rawGroups) {
          const ids = group.map((s) => s.id).sort((a, b) => a - b)
          const key = `${name}::${ids.join(',')}`
          if (!groups.has(key)) groups.set(key, { name, rawIds: ids, resolvedIdsSeen: new Set() })
          const entry = groups.get(key)!
          for (const id of ids) if (visibleIds.has(id)) entry.resolvedIdsSeen.add(id)
        }
      }
    }
  }

  return groups
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const glyphFormVariants = JSON.parse(
    await readFile(join(DATA_DIR, 'glyph-form-variants.json'), 'utf-8')
  ) as GlyphFormVariantMap
  const eliteSpecSkills = JSON.parse(
    await readFile(join(DATA_DIR, 'elite-spec-skills.json'), 'utf-8')
  ) as Record<string, number>
  const specializations = JSON.parse(
    await readFile(join(DATA_DIR, 'specializations.json'), 'utf-8')
  ) as Specialization[]
  const baselineExclusions = JSON.parse(
    await readFile(join(DATA_DIR, 'skill-variant-exclusions.json'), 'utf-8')
  ) as SkillVariantExclusions
  const baselineExclusionSet = new Set(baselineExclusions)

  const professions = [...new Set(skills.flatMap((s) => s.professions))]
  const eliteSpecsByProfession = new Map<ProfessionId, Specialization[]>()
  for (const p of professions) eliteSpecsByProfession.set(p, specializations.filter((s) => s.elite && s.profession === p))

  const groups = scanGroups(skills, professions, eliteSpecsByProfession, eliteSpecSkills, glyphFormVariants, baselineExclusionSet)
  console.log(`Found ${groups.size} distinct duplicate-name groups across Heal/Utility/Elite (all professions, all elite-spec states).`)

  const byId = new Map(skills.map((s) => [s.id, s]))
  const curatedKeys = await loadCuratedKeys()

  const wikiIdsByName = new Map<string, Set<number> | null>()
  const excludeIds = new Set(baselineExclusionSet)
  const log: string[] = []
  let bugsFound = 0
  let alreadyCorrect = 0
  let skippedNoResolution = 0
  let stillUnresolved = 0
  let needsManualReview = 0
  const attemptedGroupNames = new Set<string>()

  for (const { name, rawIds, resolvedIdsSeen } of groups.values()) {
    if (resolvedIdsSeen.size === 0) {
      // Whole raw group got stripped before resolution ever ran (sub-ability/flip-target/glyph-form
      // pre-pass) — nothing under this name reaches the picker at all, so there's nothing to verify.
      skippedNoResolution++
      continue
    }

    let wikiIds = wikiIdsByName.get(name)
    if (wikiIds === undefined) {
      try {
        const text = await fetchRawWikitext(name.replace(/ /g, '_'))
        wikiIds = new Set(parseInfoboxIds(text))
      } catch (err) {
        log.push(`skip (fetch error): "${name}" [${rawIds.join(', ')}] resolved-to=[${[...resolvedIdsSeen].join(',')}] — ${(err as Error).message}`)
        wikiIds = null
      }
      wikiIdsByName.set(name, wikiIds)
      await sleep(REQUEST_DELAY_MS)
    }

    if (wikiIds === null) continue // fetch error already logged above

    if (wikiIds.size === 0) {
      log.push(`skip (no id= found on wiki page): "${name}" [${rawIds.join(', ')}] resolved-to=[${[...resolvedIdsSeen].join(',')}]`)
      stillUnresolved++
      continue
    }
    const overlap = rawIds.some((id) => wikiIds!.has(id))
    if (!overlap) {
      log.push(`skip (wiki ids [${[...wikiIds].join(', ')}] share nothing with local group [${rawIds.join(', ')}]): "${name}"`)
      stillUnresolved++
      continue
    }

    const badResolvedIds = [...resolvedIdsSeen].filter((id) => !wikiIds!.has(id))
    if (badResolvedIds.length === 0) {
      alreadyCorrect++
      continue
    }

    // A resolved-good id (in wikiIds) to compare each bad id's specializationId against — corroboration
    // signal 1 below. Any one of them will do; a mixed-spec group is exactly what this guards against.
    const goodId = rawIds.find((id) => wikiIds!.has(id))
    const goodSpec = goodId !== undefined ? (byId.get(goodId)?.specializationId ?? null) : null

    const toExclude: number[] = []
    for (const id of badResolvedIds) {
      const skill = byId.get(id)
      const sameSpec = (skill?.specializationId ?? null) === goodSpec
      const flipLinked = rawIds.some((otherId) => {
        if (otherId === id) return false
        const other = byId.get(otherId)
        return other?.flipSkill === id || skill?.flipSkill === otherId
      })
      const curated = curatedKeys.has(id)

      if (sameSpec && !flipLinked && !curated) {
        toExclude.push(id)
      } else {
        needsManualReview++
        log.push(
          `NEEDS MANUAL REVIEW (not auto-excluded): "${name}" id ${id} not in wiki id=[${[...wikiIds].join(', ')}] but ` +
            `${!sameSpec ? `specializationId (${skill?.specializationId ?? null}) differs from resolved-good id ${goodId}'s (${goodSpec}) ` : ''}` +
            `${flipLinked ? 'shares a flipSkill link with another id in the group ' : ''}` +
            `${curated ? 'is a CURATED_DAMAGE/HEALING_COEFFICIENTS key ' : ''}` +
            `— group [${rawIds.join(', ')}], resolved-to=[${[...resolvedIdsSeen].join(',')}]`
        )
      }
    }
    if (toExclude.length === 0) continue
    attemptedGroupNames.add(name)

    for (const id of toExclude) excludeIds.add(id)
    bugsFound++
    console.log(
      `  BUG: "${name}" [${rawIds.join(', ')}] resolved-to=[${[...resolvedIdsSeen].join(',')}], ` +
        `wiki id=[${[...wikiIds].join(', ')}] -> excluding [${toExclude.join(', ')}]`
    )
  }

  // Verification pass: re-scan with the new exclusion set (no new wiki fetches, reuse the cache) and
  // confirm every group an exclusion was actually applied for now resolves to only wiki-confirmed ids.
  // Scoped to `attemptedGroupNames` — groups left alone for "needs manual review" reasons are expected
  // to still show a non-wiki-confirmed id and shouldn't be re-flagged here as if the fix failed.
  const verifyGroups = scanGroups(skills, professions, eliteSpecsByProfession, eliteSpecSkills, glyphFormVariants, excludeIds)
  let unconverged = 0
  for (const { name, rawIds, resolvedIdsSeen } of verifyGroups.values()) {
    if (!attemptedGroupNames.has(name)) continue
    const wikiIds = wikiIdsByName.get(name)
    if (!wikiIds || wikiIds.size === 0) continue
    const stillBad = [...resolvedIdsSeen].filter((id) => !wikiIds.has(id))
    if (stillBad.length > 0) {
      unconverged++
      log.push(
        `NOT CONVERGED after fix: "${name}" [${rawIds.join(', ')}] still resolves to [${stillBad.join(', ')}], ` +
          `not in wiki id=[${[...wikiIds].join(', ')}] — needs manual review`
      )
    }
  }

  const result: SkillVariantExclusions = [...excludeIds].sort((a, b) => a - b)
  await writeFile(join(DATA_DIR, 'skill-variant-exclusions.json'), JSON.stringify(result, null, 2) + '\n')

  console.log(
    `\nDone. ${groups.size} groups checked: ${bugsFound} bugs found and fixed, ${alreadyCorrect} already correct, ` +
      `${skippedNoResolution} fully stripped pre-resolution (nothing to verify), ${stillUnresolved} left unresolved ` +
      `(no wiki signal), ${needsManualReview} flagged but NOT auto-excluded (mixed-spec/flip-linked/curated — see log). ` +
      `${unconverged} group(s) did not converge after the fix — see log. ` +
      `${result.length} ids now in skill-variant-exclusions.json (was ${baselineExclusionSet.size}).`
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
