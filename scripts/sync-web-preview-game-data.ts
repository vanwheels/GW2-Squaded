/**
 * Stages the game-data JSON the Discord bot's `/builddisplay` web-preview page needs
 * (`src/web-preview/load-game-data-web.ts`) into `worker/public/game-data/`, so
 * `vite build --config vite.web-preview.config.ts` (run together via `npm run build:web-preview`)
 * can serve them as static assets alongside the rendered page — same worker deployable, no
 * separate hosting.
 *
 * Copies the SAME whitelist `src/main/game-data/load-game-data.ts` reads for the Electron app
 * (`GAME_DATA_FILE_NAMES`, already the single source of truth used by the in-app data-update
 * downloader too) — an explicit whitelist rather than "everything in data/game-data/", so a
 * future dev/audit-only file added there (e.g. a `*-verification.json` scan output) never
 * accidentally ships. `worker/public/` is gitignored: `data/game-data/` stays the only committed
 * copy, this is purely a build artifact regenerated on every `build:web-preview`.
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GAME_DATA_FILE_NAMES } from '../src/shared/game-data/data-files'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptDir, '..')
const sourceDir = join(projectRoot, 'data', 'game-data')
const destDir = join(projectRoot, 'worker', 'public', 'game-data')

async function main(): Promise<void> {
  await mkdir(destDir, { recursive: true })

  for (const fileName of GAME_DATA_FILE_NAMES) {
    await copyFile(join(sourceDir, fileName), join(destDir, fileName))
  }

  console.log(`Synced ${GAME_DATA_FILE_NAMES.length} game-data file(s) to ${destDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
