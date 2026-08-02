import { useState } from 'react'
import { NavBar, type ViewKey } from '@renderer/components/NavBar'
import { BuildsView } from '@renderer/views/BuildsView'
import { SquadsView } from '@renderer/views/SquadsView'
import { SettingsView } from '@renderer/views/SettingsView'
import { BuildsStoreProvider } from '@renderer/state/builds-store'
import { SquadCompsStoreProvider } from '@renderer/state/squad-comps-store'
import { GameDataStoreProvider } from '@renderer/state/game-data-store'
import { PickerRegistryProvider } from '@renderer/state/picker-registry'

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>('builds')

  return (
    <GameDataStoreProvider>
      <BuildsStoreProvider>
        <SquadCompsStoreProvider>
          <NavBar active={activeView} onChange={setActiveView} />
          <main className="app-content">
            <PickerRegistryProvider>
              {activeView === 'builds' && <BuildsView />}
              {activeView === 'squads' && <SquadsView />}
              {activeView === 'settings' && <SettingsView />}
            </PickerRegistryProvider>
          </main>
        </SquadCompsStoreProvider>
      </BuildsStoreProvider>
    </GameDataStoreProvider>
  )
}
