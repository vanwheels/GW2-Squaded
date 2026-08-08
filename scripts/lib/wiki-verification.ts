/**
 * Shared audit-trail writer for wiki-extraction pilot scripts (TODO.md's "Wiki-sourced data
 * pipeline" section, "wire output to data/game-data/" step, 2026-08-08). Deliberately NOT app
 * runtime data: `docs/game-data.md` documents `data/game-data/*.json` as "the app reads only from
 * these local files at runtime" — every file this writes is the opposite of that, a diagnostic
 * record of what a fetch-*.ts script found the last time it ran, for a *future dev session* to
 * read instead of re-running the script and re-reading a console dump. The hand-curated tables
 * (`CURATED_DAMAGE_COEFFICIENTS`, `TARGET_COUNT_OVERRIDES`, ...) remain the sole source of truth
 * the running app actually computes from — this file changes nothing about that.
 *
 * Written to `data/game-data/` anyway (not `.cache/`, which is gitignored) specifically so this
 * audit trail is committed and visible across sessions, same as every other generated data file
 * in that directory — `docs/game-data.md` calls this distinction out explicitly.
 *
 * Every fetch-*.ts script that diffs a curated table against live wiki data should push one
 * `WikiVerificationEntry` per curated value it checks (not one per candidate id — a damage-
 * coefficient candidate can carry several factText entries, each independently verified) and call
 * `writeVerificationFile` once at the end of `main()`.
 */
import { writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data', 'game-data')

/**
 * Outcome bucket for one curated value's live-wiki re-derivation. Deliberately a flat union shared
 * across every fact type's script rather than a per-script enum — a future consumer (step 4's
 * change-detection wiring, or a human skimming the file) can filter on 'mismatch' across every
 * fact type at once without needing to know each script's own bucket names.
 */
export type WikiVerificationStatus =
  | 'match' // wiki-derived value agrees with the curated value
  | 'known-gap' // disagrees, but a previously-investigated & documented false positive (e.g. KNOWN_WIKI_GAPS)
  | 'mismatch' // disagrees, not yet explained — needs a human look
  | 'off-by-one' // wiki value = curated - 1 (the Phalanx Strength "N other targets" convention)
  | 'missing' // curated value exists, but no matching wiki fact line was found to check it against
  | 'ambiguous' // wiki has more than one conflicting candidate value — can't pick one automatically
  | 'skip' // wiki line found but its own shape can't be safely compared (e.g. no wvw tag on a split fact)
  | 'not-found' // no wiki page resolved at all for this id
  | 'unresolved-collision' // a wiki page was found but none of its own id= field(s) matched (name collision)

export interface WikiVerificationEntry {
  sourceKind: 'skill' | 'trait'
  id: number
  name: string
  /** Present only for fact types with more than one curated value per id (e.g. damage
   *  coefficients, keyed by factText); absent for one-value-per-id types (e.g. target counts). */
  factText?: string
  status: WikiVerificationStatus
  curatedValue: number | string
  wikiValue?: number | string
  wikiTitle?: string
  wikiRevisionId?: number
  /** Free-text context — why a mismatch/skip/collision landed where it did. Optional; the status
   *  bucket alone is often enough. */
  detail?: string
}

export interface WikiVerificationFile {
  /** Which curated table this run diffed against, e.g. 'CURATED_DAMAGE_COEFFICIENTS'. */
  sourceTable: string
  /** Which fetch-*.ts script produced this file, for a human tracing an entry back to its source. */
  script: string
  generatedAt: string
  /** Total curated values checked (== entries.length). */
  totalEntries: number
  /** status -> count, computed from `entries` — mirrors each script's own console summary so a
   *  reader doesn't need to re-count the array by hand. */
  summary: Partial<Record<WikiVerificationStatus, number>>
  entries: WikiVerificationEntry[]
}

/** Builds the `summary` counts from `entries` and writes the file to `data/game-data/<filename>`. */
export async function writeVerificationFile(
  filename: string,
  meta: { sourceTable: string; script: string },
  entries: WikiVerificationEntry[]
): Promise<void> {
  const summary: Partial<Record<WikiVerificationStatus, number>> = {}
  for (const e of entries) summary[e.status] = (summary[e.status] ?? 0) + 1

  const file: WikiVerificationFile = {
    sourceTable: meta.sourceTable,
    script: meta.script,
    generatedAt: new Date().toISOString(),
    totalEntries: entries.length,
    summary,
    entries
  }
  await writeFile(join(DATA_DIR, filename), JSON.stringify(file, null, 2))
}
