import { existsSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DataUpdateStatus, GameDataMeta } from '@shared/game-data/data-update-provider'
import { GAME_DATA_FILE_NAMES } from '@shared/game-data/data-files'
import { loadLocalMeta, OVERRIDE_DATA_DIR } from './load-game-data'

// Static-publish (TODO.md's chosen Option C): data/game-data/*.json is already committed to this
// public repo, so "publish a refreshed blob" needs no new server/worker — the repo's own raw
// GitHub content URL, on the same branch electron-builder.yml's `publish` config already points
// at for app-binary releases, IS the fetchable blob. No ops burden, no auth/rate-limit surface.
const REPO_OWNER = 'vanwheels'
const REPO_NAME = 'GW2-Squaded'
const BRANCH = 'main'
const RAW_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/data/game-data`

const TMP_DATA_DIR = `${OVERRIDE_DATA_DIR}-tmp`

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`)
  return (await response.json()) as T
}

async function fetchRemoteMeta(): Promise<GameDataMeta> {
  return fetchJson<GameDataMeta>(`${RAW_BASE_URL}/meta.json`)
}

/** Whether `remote` represents newer data than `local`. Compares `gw2Build` when both sides have
 *  one (the intended signal — see `GameDataMeta`'s doc comment for why it's preferred over
 *  `fetchedAt`); falls back to `fetchedAt` when either side predates that field (`null`), so an
 *  existing pre-`gw2Build` local copy still gets offered the first real refresh rather than being
 *  stuck comparing `null` to a number forever. */
function isNewer(remote: GameDataMeta, local: GameDataMeta): boolean {
  if (remote.gw2Build !== null && local.gw2Build !== null) return remote.gw2Build !== local.gw2Build
  return remote.fetchedAt > local.fetchedAt
}

export async function checkForUpdate(broadcast: (status: DataUpdateStatus) => void): Promise<void> {
  broadcast({ state: 'checking' })
  try {
    const [remoteMeta, localMeta] = await Promise.all([fetchRemoteMeta(), Promise.resolve(loadLocalMeta())])
    broadcast(isNewer(remoteMeta, localMeta) ? { state: 'available', remoteMeta } : { state: 'not-available' })
  } catch (err) {
    broadcast({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

/** Downloads every file in `GAME_DATA_FILE_NAMES` (plus `meta.json`, written last so a partial
 *  temp directory never looks complete to `resolveDataDir()`) into a temp directory, then swaps
 *  it in for `OVERRIDE_DATA_DIR` in one rm+rename — either the whole refresh lands, or none of it
 *  does; a failure partway through never leaves a mismatched mix of old/new files behind. */
export async function downloadUpdate(broadcast: (status: DataUpdateStatus) => void): Promise<void> {
  try {
    await rm(TMP_DATA_DIR, { recursive: true, force: true })
    await mkdir(TMP_DATA_DIR, { recursive: true })

    const total = GAME_DATA_FILE_NAMES.length
    for (let i = 0; i < total; i++) {
      const fileName = GAME_DATA_FILE_NAMES[i]
      const data = await fetchJson<unknown>(`${RAW_BASE_URL}/${fileName}`)
      await writeFile(join(TMP_DATA_DIR, fileName), JSON.stringify(data))
      broadcast({ state: 'downloading', percent: Math.round(((i + 1) / total) * 100) })
    }

    const remoteMeta = await fetchRemoteMeta()
    await writeFile(join(TMP_DATA_DIR, 'meta.json'), JSON.stringify(remoteMeta))

    await rm(OVERRIDE_DATA_DIR, { recursive: true, force: true })
    await rename(TMP_DATA_DIR, OVERRIDE_DATA_DIR)

    broadcast({ state: 'downloaded' })
  } catch (err) {
    await rm(TMP_DATA_DIR, { recursive: true, force: true }).catch(() => {})
    broadcast({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

export function hasDownloadedOverride(): boolean {
  return existsSync(join(OVERRIDE_DATA_DIR, 'meta.json'))
}
