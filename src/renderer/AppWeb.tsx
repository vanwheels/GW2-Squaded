import { useState } from 'react'
import { NavBar, type ViewKey } from '@renderer/components/NavBar'
import { BuildsView } from '@renderer/views/BuildsView'
import { SquadsView } from '@renderer/views/SquadsView'
import { SettingsView } from '@renderer/views/SettingsView'
import { BuildsStoreProvider } from '@renderer/state/builds-store'
import { SquadCompsStoreProvider } from '@renderer/state/squad-comps-store'
import { GameDataStoreProvider } from '@renderer/state/game-data-store'
import { PickerRegistryProvider } from '@renderer/state/picker-registry'
import { AppSettingsProvider } from '@renderer/state/app-settings-store'
import { FavoriteConsumablesProvider } from '@renderer/state/favorite-consumables-store'
import { DataUpdateStoreProvider } from '@renderer/state/data-update-store'
import { UpdaterStoreProvider } from '@renderer/state/updater-store'
import { ReleaseNotesProvider } from '@renderer/state/release-notes-store'
import { webGameDataProvider } from '../web-preview/load-game-data-web'

/**
 * The web build's root component — sibling to `App.tsx`, not a conditional branch inside it (see
 * TODO.md's "Web Entry Point + AppWeb Shell" leg). Same provider tree and view switching as `App`,
 * with two differences: `GameDataStoreProvider` gets the `fetch`-based `webGameDataProvider`
 * (`game-data-store.tsx`'s own doc comment names this exact file as that seam's first other
 * caller) instead of `window.gw2GameData`, and there's no offscreen-capture branch at all — that's
 * an Electron-only concept (`CaptureHost`/`captureParams`, driven by a dedicated `BrowserWindow`
 * `src/main/capture/offscreen-capture.ts` spawns) with no browser equivalent yet. `window.gw2Storage`/
 * `gw2Capture`/`gw2Updater`/`gw2DataUpdate` are wired up by `web/main.tsx` before this ever mounts,
 * same pattern as `src/preload/index.ts` does for Electron.
 */
export function AppWeb() {
  const [activeView, setActiveView] = useState<ViewKey>('builds')
  const [requestedEditBuildId, setRequestedEditBuildId] = useState<string | null>(null)

  function editBuildFromSquads(buildId: string): void {
    setRequestedEditBuildId(buildId)
    setActiveView('builds')
  }

  return (
    <AppSettingsProvider>
      <ReleaseNotesProvider>
        <UpdaterStoreProvider>
          <DataUpdateStoreProvider>
            <FavoriteConsumablesProvider>
              <GameDataStoreProvider provider={webGameDataProvider}>
                <BuildsStoreProvider>
                  <SquadCompsStoreProvider>
                    <NavBar active={activeView} onChange={setActiveView} />
                    <main className="app-content">
                      <PickerRegistryProvider>
                        <div style={{ display: activeView === 'builds' ? 'contents' : 'none' }}>
                          <BuildsView
                            requestedEditBuildId={requestedEditBuildId}
                            onRequestedEditBuildHandled={() => setRequestedEditBuildId(null)}
                          />
                        </div>
                        <div style={{ display: activeView === 'squads' ? 'contents' : 'none' }}>
                          <SquadsView onEditBuild={editBuildFromSquads} />
                        </div>
                        {activeView === 'settings' && <SettingsView />}
                      </PickerRegistryProvider>
                    </main>
                  </SquadCompsStoreProvider>
                </BuildsStoreProvider>
              </GameDataStoreProvider>
            </FavoriteConsumablesProvider>
          </DataUpdateStoreProvider>
        </UpdaterStoreProvider>
      </ReleaseNotesProvider>
    </AppSettingsProvider>
  )
}
