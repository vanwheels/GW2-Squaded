/** Written by `scripts/fetch-game-data.ts`, read by both the local loader and the update check. */
export interface GameDataMeta {
  fetchedAt: string
  /** The GW2 API's own `/v2/build` id at fetch time — the freshness signal an update check
   *  compares, since it only changes on a real game update (unlike `fetchedAt`, which bumps on
   *  every pipeline re-run, even a curation-only tweak touching no `data/game-data/*.json`
   *  content). `null` for `meta.json` files written before this field existed. */
  gw2Build: number | null
}

/**
 * Mirrors `updater-provider.ts`'s `UpdateStatus` shape/reasoning for electron-updater's
 * app-binary flow — same states, but for refreshing `data/game-data/*.json` in place instead of
 * the app binary. See TODO.md's "Automatic game-data refresh mechanism" for the design history
 * and `docs/game-data.md` for the publish/consume contract.
 */
export type DataUpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; remoteMeta: GameDataMeta }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  // Files are written to a userData override directory but the already-loaded in-memory
  // GameData (and every renderer store built from it) stays stale until the app restarts — same
  // "downloaded, needs a restart to apply" contract as the app-binary updater.
  | { state: 'downloaded' }
  | { state: 'error'; message: string }

/**
 * The renderer's only way to drive an in-app game-data refresh — reached via the preload-exposed
 * `window.gw2DataUpdate` bridge (see `src/preload/index.ts`). Backed by static JSON published at
 * the public repo's raw GitHub content URL (see `src/main/game-data/data-update.ts`) — no server
 * logic of its own, works on every platform (unlike the Windows-only app-binary updater, this has
 * no code-signing/NSIS dependency).
 */
export interface DataUpdateProvider {
  getLocalMeta(): Promise<GameDataMeta>
  checkForUpdate(): Promise<void>
  downloadUpdate(): Promise<void>
  restartAndApply(): Promise<void>
  /** Subscribes to status pushes from the main process; returns an unsubscribe function. */
  onStatus(listener: (status: DataUpdateStatus) => void): () => void
}
