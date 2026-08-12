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

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>('builds')

  return (
    <AppSettingsProvider>
      <DataUpdateStoreProvider>
        <FavoriteConsumablesProvider>
          <GameDataStoreProvider>
            <BuildsStoreProvider>
              <SquadCompsStoreProvider>
                <NavBar active={activeView} onChange={setActiveView} />
                <main className="app-content">
                  <PickerRegistryProvider>
                    {/* Builds/Squads stay mounted across tab switches (rather than unmounting like
                        Settings) so each tab's in-progress editor screen — and its scroll/filter/drag
                        state — is exactly as you left it when you switch back. */}
                    <div style={{ display: activeView === 'builds' ? 'contents' : 'none' }}>
                      <BuildsView />
                    </div>
                    <div style={{ display: activeView === 'squads' ? 'contents' : 'none' }}>
                      <SquadsView />
                    </div>
                    {activeView === 'settings' && <SettingsView />}
                  </PickerRegistryProvider>
                </main>
              </SquadCompsStoreProvider>
            </BuildsStoreProvider>
          </GameDataStoreProvider>
        </FavoriteConsumablesProvider>
      </DataUpdateStoreProvider>
    </AppSettingsProvider>
  )
}
