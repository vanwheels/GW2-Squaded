/**
 * Fetches the numeric ids the official GW2 Build Template chat-link format (type `0x0D`, see
 * `src/shared/chat-link/build-template-codec.ts` and `docs/game-data.md`) actually encodes —
 * `Profession.code`, `Profession.skillPalette`, and `Legend.code` — and writes
 * data/game-data/chat-link-ids.json.
 *
 * None of these are visible on the default `/v2/professions`/`/v2/legends` schema (confirmed live
 * 2026-08-28: a plain `GET /v2/professions/Guardian` has no `code`/`skills_by_palette` field at
 * all) — they only appear under the API's newer `?v=latest` schema version. Rather than switching
 * `fetch-game-data.ts`'s own professions/legends fetch to that schema wholesale (risking an
 * unrelated shape change to fields that script's normalizer already depends on), this is its own
 * narrow, additive fetch — same "separate file, merged at load time" pattern as
 * `fetch-tango-icons.ts`'s tango-icons.json, chosen for the identical reason that doc comment
 * gives: re-running `fetch-game-data.ts` for an unrelated reason must never silently blow this
 * away (the `itemstat-icons.json` landmine).
 *
 * Run manually via `npm run fetch-chat-link-ids`, after `npm run fetch-game-data` (reads
 * professions.json/legends.json for the id lists this keys off of).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Legend, Profession } from '../src/shared/types/game-data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')
const API_BASE = 'https://api.guildwars2.com/v2'

interface ChatLinkIds {
  professions: Record<string, { code: number; skillPalette: [number, number][] }>
  legends: Record<string, number>
}

interface RawProfessionLatest {
  code?: number
  skills_by_palette?: [number, number][]
}

interface RawLegendLatest {
  code?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchLatest<T>(endpoint: string, id: string): Promise<T> {
  const url = `${API_BASE}/${endpoint}/${encodeURIComponent(id)}?v=latest`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`)
  return (await response.json()) as T
}

async function main(): Promise<void> {
  const professions = JSON.parse(await readFile(join(DATA_DIR, 'professions.json'), 'utf-8')) as Profession[]
  const legends = JSON.parse(await readFile(join(DATA_DIR, 'legends.json'), 'utf-8')) as Legend[]

  const result: ChatLinkIds = { professions: {}, legends: {} }
  const missing: string[] = []

  for (const p of professions) {
    const raw = await fetchLatest<RawProfessionLatest>('professions', p.id)
    if (raw.code === undefined || raw.skills_by_palette === undefined) {
      missing.push(`profession ${p.id}`)
      continue
    }
    result.professions[p.id] = { code: raw.code, skillPalette: raw.skills_by_palette }
    console.log(`  profession ${p.id}: code=${raw.code}, ${raw.skills_by_palette.length} palette entries`)
    await sleep(150)
  }

  for (const l of legends) {
    const raw = await fetchLatest<RawLegendLatest>('legends', l.id)
    if (raw.code === undefined) {
      missing.push(`legend ${l.id}`)
      continue
    }
    result.legends[l.id] = raw.code
    console.log(`  legend ${l.id}: code=${raw.code}`)
    await sleep(150)
  }

  if (missing.length > 0) {
    throw new Error(
      `${missing.length} id(s) had no "code"/"skills_by_palette" under ?v=latest — fix or explicitly ` +
        `accept the gap before writing chat-link-ids.json: ${missing.join(', ')}`
    )
  }

  await writeFile(join(DATA_DIR, 'chat-link-ids.json'), JSON.stringify(result, null, 2))
  console.log(
    `\nDone. chat-link-ids.json written: ${Object.keys(result.professions).length} professions, ` +
      `${Object.keys(result.legends).length} legends.`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
