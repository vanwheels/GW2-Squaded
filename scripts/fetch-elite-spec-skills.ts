/**
 * Fetches which Heal/Utility/Elite skills are gated behind a specific elite specialization.
 *
 * The public GW2 API has no field for this: `/v2/skills` objects carry no `specialization` id,
 * and `/v2/professions/:id`'s `training` array only groups CORE skill categories (Signet
 * Training, Well Training, ...), not elite-spec-specific unlocks. So this is sourced from the
 * wiki instead — every elite spec has a maintained `Category:<Name> skills` page, and each
 * member page carries a `Category:Healing skills` / `Category:Utility skills` / `Category:Elite
 * skills` tag identifying its slot. See docs/game-data.md for how this is verified/re-run.
 *
 * Run manually via `npm run fetch-elite-spec-skills`, after `npm run fetch-game-data` (this
 * script matches wiki page titles against the already-fetched data/game-data/skills.json by
 * name, so it needs that file to exist first).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Skill, Specialization } from '../src/shared/types/game-data'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
const REQUEST_DELAY_MS = 200
// The wiki returns 403 for Node's default fetch User-Agent — any identifiable, non-default UA
// clears it (verified: curl's default UA also passes; this isn't targeting Node specifically).
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface WikiCategoryPage {
  title: string
  categories: Set<string>
}

const SLOT_CATEGORY_MAP: Record<string, 'Heal' | 'Utility' | 'Elite'> = {
  'Category:Healing skills': 'Heal',
  'Category:Utility skills': 'Utility',
  'Category:Elite skills': 'Elite'
}

/** Pulls every member of Category:<specName> skills plus each member's own category tags, in one
 *  generator query (paginated via the standard MediaWiki `continue` token). */
async function fetchSpecSkillPages(specName: string): Promise<WikiCategoryPage[]> {
  const pages = new Map<string, WikiCategoryPage>()
  let continueParams: Record<string, string> = {}

  for (;;) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: `Category:${specName} skills`,
      gcmlimit: '100',
      prop: 'categories',
      cllimit: '100',
      format: 'json',
      ...continueParams
    })
    const response = await fetch(`${WIKI_API}?${params.toString()}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`Wiki API request failed: ${response.status} ${response.statusText}`)
    const data = (await response.json()) as {
      query?: { pages?: Record<string, { title: string; categories?: { title: string }[] }> }
      continue?: Record<string, string>
    }

    for (const page of Object.values(data.query?.pages ?? {})) {
      const existing = pages.get(page.title) ?? { title: page.title, categories: new Set<string>() }
      for (const cat of page.categories ?? []) existing.categories.add(cat.title)
      pages.set(page.title, existing)
    }

    if (data.continue) {
      continueParams = data.continue
      await sleep(REQUEST_DELAY_MS)
    } else {
      break
    }
  }

  return Array.from(pages.values())
}

/** Wiki article titles for shout-style skills sometimes drop the surrounding quote marks that
 *  the GW2 API's skill.name keeps (e.g. wiki "Your Soul Is Mine!" vs API `"Your Soul Is Mine!"`)
 *  — try the raw title first, then a quote-stripped-on-both-sides comparison. Titles also
 *  sometimes carry a MediaWiki disambiguation suffix not present in the API name at all (e.g.
 *  "Uppercut (Daredevil skill)" vs API `Uppercut`) — strip a trailing " (...)" too. */
function titleVariants(title: string): string[] {
  const unquoted = title.replace(/^"(.*)"$/, '$1')
  const withoutQuotes = unquoted === title ? [title, `"${title}"`] : [title, unquoted]
  const withoutSuffix = title.replace(/\s*\([^()]*\)$/, '')
  return withoutSuffix === title ? withoutQuotes : [...withoutQuotes, withoutSuffix]
}

async function main(): Promise<void> {
  const specializations = JSON.parse(
    await readFile(join(DATA_DIR, 'specializations.json'), 'utf-8')
  ) as Specialization[]
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]

  const eliteSpecs = specializations.filter((s) => s.elite)
  console.log(`Found ${eliteSpecs.length} elite specializations in local data.`)

  const result: Record<number, number> = {}
  const unmatched: string[] = []
  const ambiguous: string[] = []

  for (const [index, spec] of eliteSpecs.entries()) {
    const pages = await fetchSpecSkillPages(spec.name)
    let matchedCount = 0

    for (const page of pages) {
      let slot: 'Heal' | 'Utility' | 'Elite' | undefined
      for (const [category, mappedSlot] of Object.entries(SLOT_CATEGORY_MAP)) {
        if (page.categories.has(category)) {
          slot = mappedSlot
          break
        }
      }
      if (!slot) continue // weapon/shroud/trait-triggered skill page, not a Heal/Utility/Elite slot skill

      const candidates = titleVariants(page.title)
      const matches = skills.filter(
        (s) => s.slot === slot && s.professions.includes(spec.profession) && candidates.includes(s.name)
      )

      if (matches.length === 1) {
        result[matches[0].id] = spec.id
        matchedCount++
      } else if (matches.length === 0) {
        unmatched.push(`${spec.name} / ${slot} / "${page.title}"`)
      } else if (matches.every((m) => m.specializationId === spec.id)) {
        // Multiple wiki-matched ids for one title (e.g. ground-targeted/auto-target pairs, a
        // flip_skill chain, or same-name form variants) aren't a naming coincidence to guess at
        // here: `Skill.specializationId` is the API's own field, already fetched, and every one
        // of these candidates independently carries this exact spec's id on it. Gate all of them
        // — whichever one dedup (skill-variants.ts) surfaces in the picker is correctly gated
        // either way, rather than leaving all of them ungated because the name matched >1 id.
        for (const m of matches) result[m.id] = spec.id
        matchedCount += matches.length
      } else {
        ambiguous.push(`${spec.name} / ${slot} / "${page.title}" -> ids [${matches.map((m) => m.id).join(', ')}]`)
      }
    }

    console.log(`  [${index + 1}/${eliteSpecs.length}] ${spec.name} (${spec.profession}): matched ${matchedCount}`)
    await sleep(REQUEST_DELAY_MS)
  }

  if (unmatched.length > 0) {
    console.warn(`\nUnmatched wiki pages (no skills.json entry found — not included in output):`)
    for (const line of unmatched) console.warn(`  - ${line}`)
  }
  if (ambiguous.length > 0) {
    console.warn(`\nAmbiguous wiki pages (multiple skills.json matches — not included in output):`)
    for (const line of ambiguous) console.warn(`  - ${line}`)
  }

  await writeFile(join(DATA_DIR, 'elite-spec-skills.json'), JSON.stringify(result, null, 2))
  console.log(
    `\nDone. ${Object.keys(result).length} skill -> specialization mappings written to elite-spec-skills.json` +
      ` (${unmatched.length} unmatched, ${ambiguous.length} ambiguous — review warnings above).`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
