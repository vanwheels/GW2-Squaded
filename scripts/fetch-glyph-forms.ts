/**
 * Resolves Druid's 6 duplicate-named Glyph skills (Heal/Utility/Elite) down to their one
 * actually-equippable id, and writes data/game-data/glyph-form-variants.json.
 *
 * Confirmed live 2026-07-30: every Ranger skill tagged `categories: ["Glyph"]` that shares a name
 * with 2+ other ids (Glyph of Rejuvenation/the Tides/Alignment/Equality/Burgeoning/the Stars — all
 * gated behind Druid, `specializationId === 5` on every one of their ids, so that existing
 * disambiguation signal can't tell them apart either — see skill-variants.ts) has this shape: one
 * "parent" wiki page whose own `{{Skill infobox}}` `id=` is the id a player actually binds to a
 * Heal/Utility/Elite slot (its effect changes automatically with current Celestial Avatar form,
 * the same "one id, context-dependent effect" shape `Skill.attunement` already models for
 * Elementalist glyphs), plus two purely-descriptive child pages — "<name> (non-celestial)" and
 * "<name> (Celestial Avatar)" — that exist only so the wiki can document each form's effect
 * separately and whose ids are never independently equippable. No API field distinguishes these
 * (unlike `Skill.attunement`), so this is wiki-sourced, same shape of effort as
 * `fetch-elite-spec-skills.ts`.
 *
 * Each candidate group is verified end-to-end before being trusted: the parent page's `id=` must
 * be a member of the local same-name id group, the parent page's "Skills" section must list
 * exactly 2 child page titles, and fetching those children must resolve ids that, together with
 * the parent id, exactly account for every id in the local group — any mismatch is logged and the
 * whole group is left unresolved (fail-safe, not guessed), same posture as every other fetch
 * script in this project.
 *
 * Run manually via `npm run fetch-glyph-forms`, after `npm run fetch-game-data` (matches wiki page
 * titles against the already-fetched data/game-data/skills.json by name).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GlyphFormVariantMap, Skill } from '../src/shared/types/game-data'

const WIKI_INDEX = 'https://wiki.guildwars2.com/index.php'
const REQUEST_DELAY_MS = 150
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

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

function parseInfoboxId(text: string): number | undefined {
  const match = /\|\s*id\s*=\s*(\d+)/.exec(text)
  return match ? Number(match[1]) : undefined
}

/** Child page titles from the parent's own "== Skills ==" table, e.g.
 *  `{{Slot skill table row|Glyph of Equality (non-celestial)}}`. */
function parseChildTitles(parentWikitext: string): string[] {
  const re = /\{\{Slot skill table row\|([^}|]+)/g
  const titles: string[] = []
  for (const match of parentWikitext.matchAll(re)) titles.push(match[1].trim())
  return titles
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]

  const glyphGroups = new Map<string, Skill[]>()
  for (const skill of skills) {
    if (!skill.professions.includes('Ranger') || !skill.categories.includes('Glyph')) continue
    if (!glyphGroups.has(skill.name)) glyphGroups.set(skill.name, [])
    glyphGroups.get(skill.name)!.push(skill)
  }
  const duplicateGroups = Array.from(glyphGroups.entries()).filter(([, members]) => members.length > 1)
  console.log(`Found ${duplicateGroups.length} duplicate-named Ranger Glyph groups in local data.`)

  const result: GlyphFormVariantMap = {}
  const log: string[] = []
  let resolvedGroups = 0

  for (const [name, members] of duplicateGroups) {
    const localIds = new Set(members.map((m) => m.id))

    let parentText: string
    try {
      parentText = await fetchRawWikitext(name.replace(/ /g, '_'))
    } catch (err) {
      log.push(`skip (parent fetch error): "${name}" — ${(err as Error).message}`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }
    await sleep(REQUEST_DELAY_MS)

    const parentId = parseInfoboxId(parentText)
    if (parentId === undefined || !localIds.has(parentId)) {
      log.push(`skip (parent id ${parentId ?? 'missing'} not in local group [${[...localIds].join(', ')}]): "${name}"`)
      continue
    }

    const childTitles = parseChildTitles(parentText)
    if (childTitles.length !== localIds.size - 1) {
      log.push(
        `skip (expected ${localIds.size - 1} child pages, found ${childTitles.length}): "${name}" — ${childTitles.join(', ')}`
      )
      continue
    }

    const childIds: number[] = []
    let childFetchFailed = false
    for (const childTitle of childTitles) {
      let childText: string
      try {
        childText = await fetchRawWikitext(childTitle.replace(/ /g, '_'))
      } catch (err) {
        log.push(`skip (child fetch error): "${name}" / "${childTitle}" — ${(err as Error).message}`)
        childFetchFailed = true
        await sleep(REQUEST_DELAY_MS)
        continue
      }
      await sleep(REQUEST_DELAY_MS)
      const childId = parseInfoboxId(childText)
      if (childId === undefined) {
        log.push(`skip (no id= found): "${name}" / "${childTitle}"`)
        childFetchFailed = true
        continue
      }
      childIds.push(childId)
    }
    if (childFetchFailed) continue

    const resolvedIds = new Set([parentId, ...childIds])
    const setsMatch = resolvedIds.size === localIds.size && [...resolvedIds].every((id) => localIds.has(id))
    if (!setsMatch) {
      log.push(
        `skip (resolved ids [${[...resolvedIds].join(', ')}] don't exactly match local group [${[...localIds].join(', ')}]): "${name}"`
      )
      continue
    }

    for (const childId of childIds) result[childId] = parentId
    resolvedGroups++
    console.log(`  "${name}": canonical id ${parentId}, variants [${childIds.join(', ')}] dropped`)
  }

  await writeFile(join(DATA_DIR, 'glyph-form-variants.json'), JSON.stringify(result, null, 2))

  console.log(
    `\nDone. ${resolvedGroups}/${duplicateGroups.length} groups resolved, ` +
      `${Object.keys(result).length} variant -> canonical id mappings written to glyph-form-variants.json.`
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
