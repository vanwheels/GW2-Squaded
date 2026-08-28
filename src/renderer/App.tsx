import { useState } from 'react'
import { NavBar, type ViewKey } from '@renderer/components/NavBar'
import { BuildsView } from '@renderer/views/BuildsView'
import { SquadsView } from '@renderer/views/SquadsView'
import { SettingsView } from '@renderer/views/SettingsView'
import { CaptureHost } from '@renderer/components/capture/CaptureHost'
import { BuildsStoreProvider } from '@renderer/state/builds-store'
import { SquadCompsStoreProvider } from '@renderer/state/squad-comps-store'
import { GameDataStoreProvider } from '@renderer/state/game-data-store'
import { PickerRegistryProvider } from '@renderer/state/picker-registry'
import { AppSettingsProvider } from '@renderer/state/app-settings-store'
import { FavoriteConsumablesProvider } from '@renderer/state/favorite-consumables-store'
import { DataUpdateStoreProvider } from '@renderer/state/data-update-store'
import { ReleaseNotesProvider } from '@renderer/state/release-notes-store'

/** Set only on the dedicated offscreen window `offscreen-capture.ts` spawns for a screenshot
 *  (`?capture=build|squad&token=…`, see that module's doc comment) — never in a normal editor
 *  window. Read once at module-eval time (this is a `loadRenderer` navigation target, not a
 *  client-side route the same window ever changes), so there's no need for this to be reactive
 *  state. */
const captureParams: { kind: 'build' | 'squad'; token: string } | null = (() => {
  const params = new URLSearchParams(window.location.search)
  const kind = params.get('capture')
  const token = params.get('token')
  if ((kind !== 'build' && kind !== 'squad') || !token) return null
  return { kind, token }
})()

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>('builds')
  // Cross-tab "open this build in the editor" request — set by the Squads tab's right-click
  // "Edit" (see `BuildsSidebar`'s doc comment), consumed and cleared by `BuildsView` once it's
  // acted on it.
  const [requestedEditBuildId, setRequestedEditBuildId] = useState<string | null>(null)

  function editBuildFromSquads(buildId: string): void {
    setRequestedEditBuildId(buildId)
    setActiveView('builds')
  }

  return (
    <AppSettingsProvider>
      <ReleaseNotesProvider>
        <DataUpdateStoreProvider>
          <FavoriteConsumablesProvider>
            <GameDataStoreProvider provider={window.gw2GameData}>
              <BuildsStoreProvider>
                <SquadCompsStoreProvider>
                  {/* Same provider tree either way (theme/settings/game-data/builds-store all need
                      to resolve identically for a capture render to match the real editor) — only
                      what's rendered inside `PickerRegistryProvider` differs. A capture window never
                      shows `NavBar`/`.app-content`'s padding at all: `offscreen-capture.ts` captures
                      a `{ x: 0, y: 0, ... }` rect, so `CaptureHost`'s grid has to be the only thing
                      on the page, sitting flush at the top-left corner. */}
                  {captureParams ? (
                    <PickerRegistryProvider>
                      <CaptureHost kind={captureParams.kind} token={captureParams.token} />
                    </PickerRegistryProvider>
                  ) : (
                    <>
                      <NavBar active={activeView} onChange={setActiveView} />
                      <main className="app-content">
                        <PickerRegistryProvider>
                          {/* Builds/Squads stay mounted across tab switches (rather than unmounting like
                              Settings) so each tab's in-progress editor screen — and its scroll/filter/drag
                              state — is exactly as you left it when you switch back. */}
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
                    </>
                  )}
                </SquadCompsStoreProvider>
              </BuildsStoreProvider>
            </GameDataStoreProvider>
          </FavoriteConsumablesProvider>
        </DataUpdateStoreProvider>
      </ReleaseNotesProvider>
    </AppSettingsProvider>
  )
}
