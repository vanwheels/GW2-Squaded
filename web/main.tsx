import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppWeb } from '@renderer/AppWeb'
import '@renderer/styles/global.css'
import { createIndexedDbStorage } from '@shared/storage/indexeddb-adapter'
import type { CaptureProvider } from '@shared/capture/capture-provider'
import type { UpdaterProvider } from '@shared/updater/updater-provider'
import type { DataUpdateProvider } from '@shared/game-data/data-update-provider'

/**
 * Stand-ins for the preload-exposed bridges `AppWeb`'s provider tree still reaches through
 * `window.gw2Capture`/`gw2Updater`/`gw2DataUpdate` (screenshot-to-clipboard, the app-binary
 * updater, the in-app game-data refresher) — none of these have a browser equivalent yet, and
 * none are needed by a local-only web build (see TODO.md's "Web Entry Point + AppWeb Shell" leg).
 * `isSupported`/`onStatus` resolving to `false`/a no-op unsubscribe is what keeps `SettingsView`'s
 * update UI and `NavBar`'s update badge quiet instead of showing broken controls.
 */
const noopCapture: CaptureProvider = {
  captureBuildScreenshot: () => Promise.resolve(),
  captureSquadScreenshot: () => Promise.resolve(),
  getPayload: () => Promise.resolve(null),
  signalReady: () => Promise.resolve()
}

const noopUpdater: UpdaterProvider = {
  getAppVersion: () => Promise.resolve(''),
  isSupported: () => Promise.resolve(false),
  checkForUpdates: () => Promise.resolve(),
  downloadUpdate: () => Promise.resolve(),
  quitAndInstall: () => Promise.resolve(),
  onStatus: () => () => {}
}

const noopDataUpdate: DataUpdateProvider = {
  getLocalMeta: () => Promise.resolve({ fetchedAt: '', gw2Build: null }),
  checkForUpdate: () => Promise.resolve(),
  downloadUpdate: () => Promise.resolve(),
  restartAndApply: () => Promise.resolve(),
  onStatus: () => () => {}
}

window.gw2Storage = createIndexedDbStorage()
window.gw2Capture = noopCapture
window.gw2Updater = noopUpdater
window.gw2DataUpdate = noopDataUpdate

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWeb />
  </StrictMode>
)
