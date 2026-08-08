/**
 * Shared on-disk raw-wikitext cache for every `fetch-*.ts` wiki-extraction script (TODO.md's
 * "Wiki-sourced data pipeline" step 2, 2026-08-08). Before this, each script defined its own
 * `fetchRawWikitext` hitting `action=raw` fresh on every run — a page visited by one sweep (e.g.
 * `fetch-skill-coefficients.ts`) got re-fetched from scratch by the next sweep touching the same
 * page (e.g. the still-queued target-count/Condition-Cleanse sweep), even though most GW2 wiki
 * pages don't change between sweeps run days or weeks apart.
 *
 * Keyed by the exact title string a caller passes in (callers already handle their own title
 * variants/candidates, same as before — this cache doesn't second-guess that) + MediaWiki's own
 * revision id for that title, fetched together in one `action=query` call (`prop=revisions`,
 * `rvprop=ids|content`) rather than the old two-call shape (`action=raw` for content has no way to
 * ask for the revision id in the same request). A cache hit skips the network call entirely; a
 * caller wanting to confirm nothing changed since a stale-looking hit can pass `forceRefresh` to
 * re-fetch and overwrite. The stored `revisionId` isn't consulted automatically today (that's
 * TODO.md step 4 — wiring this to the Game_updates-page change-detection mechanism, not yet
 * built); for now it's just persisted so that later step has something to diff against.
 *
 * `flushWikiCache()` must be called once at the end of a script's `main()` — writes are batched in
 * memory and only persisted then, so a run that fetches 500 pages does one disk write, not 500.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
const REQUEST_DELAY_MS = 150
// Same gotcha as every fetch-*.ts script: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = join(__dirname, '..', '..', '.cache', 'wiki-pages.json')

interface CacheEntry {
  revisionId: number
  wikitext: string
  fetchedAt: string
}
type CacheFile = Record<string, CacheEntry>

let cache: CacheFile | null = null
let dirty = false

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadCache(): Promise<CacheFile> {
  if (cache) return cache
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, 'utf-8')) as CacheFile
  } catch {
    cache = {} // no cache file yet, or unreadable — start fresh rather than fail the run
  }
  return cache
}

/** Persists any pages fetched since the last flush. Call once at the end of a script's `main()`. */
export async function flushWikiCache(): Promise<void> {
  if (!dirty || !cache) return
  await mkdir(dirname(CACHE_FILE), { recursive: true })
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
  dirty = false
}

interface WikiQueryResponse {
  query?: {
    pages?: {
      missing?: boolean
      revisions?: { revid: number; slots: { main: { content: string } } }[]
    }[]
  }
}

/**
 * Returns a wiki page's raw wikitext, transparently caching across every script that calls it
 * (see module doc comment). Returns null for a nonexistent page — same contract every prior
 * per-script `fetchRawWikitext` used for its 404 case, so callers don't need to change.
 */
export async function fetchWikiPage(title: string, opts?: { forceRefresh?: boolean }): Promise<string | null> {
  const c = await loadCache()
  const cached = c[title]
  if (cached && !opts?.forceRefresh) return cached.wikitext

  const url =
    `${WIKI_API}?action=query&titles=${encodeURIComponent(title)}&prop=revisions` +
    `&rvprop=ids|content&rvslots=main&redirects=1&format=json&formatversion=2`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  await sleep(REQUEST_DELAY_MS) // rate-limit real network calls only — cache hits above never wait
  if (!response.ok) throw new Error(`Wiki API fetch failed for "${title}": ${response.status} ${response.statusText}`)
  const json = (await response.json()) as WikiQueryResponse
  const page = json.query?.pages?.[0]
  if (!page || page.missing || !page.revisions?.length) {
    return null // page doesn't exist — deliberately not cached, so a later real page at this title isn't shadowed
  }
  const rev = page.revisions[0]
  const wikitext = rev.slots.main.content
  c[title] = { revisionId: rev.revid, wikitext, fetchedAt: new Date().toISOString() }
  dirty = true
  return wikitext
}
