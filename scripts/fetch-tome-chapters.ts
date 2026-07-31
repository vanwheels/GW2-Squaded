/**
 * Fetches wiki-sourced data for Firebrand's 3 Tomes' 15 chapter skills (5 per tome) and writes
 * data/game-data/tome-chapters.json.
 *
 * Confirmed live 2026-07-30: these chapter skills carry NO id anywhere in the public GW2 API — not
 * even under an unrelated slot — even though each chapter's own wiki page lists an `id=` field in
 * its `{{Skill infobox}}` (e.g. `id = 41258` for "Chapter 1: Searing Spell"); a direct
 * `/v2/skills?ids=41258` call returns `{"text": "all ids provided are invalid"}`. So unlike
 * Engineer's Kits (`Skill.bundleSkills`, real API ids resolved the same way weapon skills are —
 * see weapon-calc/weapon-skills.ts), this data is entirely wiki-sourced, reusing the exact
 * `{{skill fact|...}}` parsing `fetch-relic-effects.ts` already established for the same template.
 *
 * Each tome's own page lists its 5 chapters via `{{Weapon skill table row|<chapter name>}}` (in
 * slot order); each chapter has its own dedicated page with a `{{Skill infobox}}` carrying
 * `description`, `facts=`, and a `weapon slot=` field (1-5, used as the authoritative slot index
 * rather than array order, same defensive stance as `parseListedIds` in fetch-relic-effects.ts).
 * No icon field exists on a chapter's own infobox — every chapter falls back to its parent tome's
 * icon (already in skills.json), a documented simplification, not a guess at a real per-chapter
 * icon this app has no source for.
 *
 * Run manually via `npm run fetch-tome-chapters`, after `npm run fetch-game-data` (needs the 3
 * tome skill ids/icons already in data/game-data/skills.json).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RelicFactLine, Skill, TomeChapter, TomeChaptersByTomeId } from '../src/shared/types/game-data'

const WIKI_INDEX = 'https://wiki.guildwars2.com/index.php'
const REQUEST_DELAY_MS = 150
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

/** The 3 tomes, by their equippable skill name — matched against skills.json for id/icon rather
 *  than hardcoding either, so a name match failure surfaces as a loud error instead of silently
 *  using a stale id if a future balance patch ever renames one. */
const TOME_NAMES = ['Tome of Justice', 'Tome of Resolve', 'Tome of Courage']

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchRawWikitext(title: string): Promise<string> {
  const url = `${WIKI_INDEX}?title=${encodeURIComponent(title)}&action=raw`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Wiki raw fetch failed for "${title}": ${response.status} ${response.statusText}`)
  return response.text()
}

// Same pipe-protection/balance-check approach as fetch-relic-effects.ts, duplicated rather than
// imported since these are standalone `tsx`-run scripts with no shared script-lib module today.
const PROTECTED_PIPE = ''
function protectPipes(s: string): string {
  let out = s.replace(/\[\[([^[\]|]*)\|([^[\]]*)\]\]/g, (_, a: string, b: string) => `[[${a}${PROTECTED_PIPE}${b}]]`)
  out = out.replace(/\{\{([^{}|]*)\|([^{}]*)\}\}/g, (_, a: string, b: string) => `{{${a}${PROTECTED_PIPE}${b}}}`)
  return out
}
function restorePipes(s: string): string {
  return s.split(PROTECTED_PIPE).join('|')
}
function isBalanced(s: string): boolean {
  const openLink = (s.match(/\[\[/g) ?? []).length
  const closeLink = (s.match(/\]\]/g) ?? []).length
  const openTpl = (s.match(/\{\{/g) ?? []).length
  const closeTpl = (s.match(/\}\}/g) ?? []).length
  return openLink === closeLink && openTpl === closeTpl
}

function parseFactLines(infobox: string): { facts: RelicFactLine[]; corrupted: string[] } {
  const factRe = /\{\{\s*skill fact\s*\|(.*?)\}\}/gis
  const facts: RelicFactLine[] = []
  const corrupted: string[] = []
  for (const match of infobox.matchAll(factRe)) {
    const protectedArgs = protectPipes(match[1])
    const rawSegments = protectedArgs.split('|').map((s) => restorePipes(s.trim()))
    if (rawSegments.some((s) => !isBalanced(s))) {
      corrupted.push(match[0])
      continue
    }
    const label = rawSegments[0]
    if (!label) continue

    const values: string[] = []
    const params: Record<string, string> = {}
    let gameModeTokens: string[] | null = null
    for (const seg of rawSegments.slice(1)) {
      const kv = /^([a-z][a-z ]*)\s*=\s*(.+)$/i.exec(seg)
      if (kv) {
        const key = kv[1].trim().toLowerCase()
        if (key === 'game mode') {
          gameModeTokens = kv[2].toLowerCase().split(/[\s,]+/).filter(Boolean)
        } else {
          params[key] = kv[2].trim()
        }
      } else if (seg) {
        values.push(seg)
      }
    }
    if (gameModeTokens !== null && !gameModeTokens.includes('wvw')) continue // PvE-only/PvP-only line — drop
    facts.push({ label, values, params })
  }
  return { facts, corrupted }
}

/** Strips the wiki markup found in chapter `description=` text (piped/plain wikilinks, bold/italic
 *  markers, `{{key|X|:}}`-style inline templates reduced to their last positional arg) down to
 *  plain display text. Not a general wikitext renderer — only handles the markup shapes actually
 *  seen across all 15 chapter pages (verified by inspecting every parsed description below). */
function cleanDescription(raw: string): string {
  return raw
    .replace(/\{\{skill type\|([^|}]+)\|([^}]*)\}\}/gi, (_, type: string) => `${type}:`)
    .replace(/\[\[([^[\]|]*)\|([^[\]]*)\]\]/g, (_, _target: string, display: string) => display)
    .replace(/\[\[([^[\]]*)\]\]/g, (_, target: string) => target)
    .replace(/'''?/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .trim()
}

function extractInfobox(text: string): string | undefined {
  const match = /\{\{Skill infobox([\s\S]*?)\n\}\}/.exec(text)
  return match ? match[1] : undefined
}

function parseChapterNames(tomeWikitext: string): string[] {
  const re = /\{\{Weapon skill table row\|([^}|]+)/g
  const names: string[] = []
  for (const match of tomeWikitext.matchAll(re)) names.push(match[1].trim())
  return names
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]

  const result: TomeChaptersByTomeId = {}
  const log: string[] = []
  let totalChapters = 0
  let chaptersWithFacts = 0

  for (const tomeName of TOME_NAMES) {
    // The tome name matches multiple ids (base + a "Stow Tome"/dormant flip-target duplicate, see
    // profession-mechanic.ts) — the entry-point id is the one with an outgoing flipSkill, same
    // resolution rule that resolver already uses.
    const candidates = skills.filter((s) => s.name === tomeName)
    const tomeSkill = candidates.find((s) => s.flipSkill !== null) ?? candidates[0]
    if (!tomeSkill) {
      log.push(`skip (no matching skill in skills.json): "${tomeName}"`)
      continue
    }

    const tomePage = await fetchRawWikitext(tomeName.replace(/ /g, '_'))
    await sleep(REQUEST_DELAY_MS)
    const chapterNames = parseChapterNames(tomePage)
    if (chapterNames.length !== 5) {
      log.push(`warn (expected 5 chapters, found ${chapterNames.length}): "${tomeName}" — ${chapterNames.join(', ')}`)
    }

    const chapters: TomeChapter[] = []
    for (const chapterName of chapterNames) {
      let text: string
      try {
        text = await fetchRawWikitext(chapterName.replace(/ /g, '_'))
      } catch (err) {
        log.push(`skip (fetch error): "${chapterName}" — ${(err as Error).message}`)
        await sleep(REQUEST_DELAY_MS)
        continue
      }
      const infobox = extractInfobox(text)
      if (!infobox) {
        log.push(`skip (no Skill infobox found): "${chapterName}"`)
        await sleep(REQUEST_DELAY_MS)
        continue
      }

      const parentMatch = /\|\s*parent\s*=\s*([^\n|]+)/.exec(infobox)
      const parent = parentMatch?.[1].trim()
      if (parent !== tomeName) {
        log.push(`warn (parent field "${parent}" doesn't match expected tome "${tomeName}"): "${chapterName}"`)
      }

      const slotMatch = /\|\s*weapon slot\s*=\s*(\d)/.exec(infobox)
      const slotIndex = slotMatch ? Number(slotMatch[1]) - 1 : chapters.length
      if (!slotMatch) log.push(`warn (no "weapon slot=" field, falling back to page order): "${chapterName}"`)

      const descMatch = /\|\s*description\s*=\s*([^\n]*(?:\n(?!\s*\|\s*[a-z])[^\n]*)*)/i.exec(infobox)
      const description = descMatch ? cleanDescription(descMatch[1]) : ''

      const factsMatch = /\|\s*facts\s*=([\s\S]*?)\n\|\s*[a-z]/i.exec(infobox + '\n| ')
      const { facts, corrupted } = factsMatch ? parseFactLines(factsMatch[1]) : { facts: [], corrupted: [] }
      for (const line of corrupted) log.push(`skip (unbalanced brackets): "${chapterName}" — ${line}`)
      if (facts.length > 0) chaptersWithFacts++

      chapters.push({
        tomeSkillId: tomeSkill.id,
        slotIndex,
        name: chapterName,
        description,
        icon: tomeSkill.icon,
        facts
      })
      totalChapters++
      await sleep(REQUEST_DELAY_MS)
    }

    chapters.sort((a, b) => a.slotIndex - b.slotIndex)
    result[tomeSkill.id] = chapters
    console.log(`${tomeName} (id ${tomeSkill.id}): ${chapters.length} chapters`)
  }

  await writeFile(join(DATA_DIR, 'tome-chapters.json'), JSON.stringify(result, null, 2))

  console.log(`\nDone. tome-chapters.json written: ${totalChapters} chapters total, ${chaptersWithFacts} with parsed facts.`)
  console.log(`\n${log.length} log lines:`)
  for (const line of log) console.warn(`  - ${line}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
