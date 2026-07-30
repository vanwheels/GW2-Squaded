import { useState } from 'react'
import { NavBar, type ViewKey } from '@renderer/components/NavBar'
import { BuildsView } from '@renderer/views/BuildsView'
import { SquadsView } from '@renderer/views/SquadsView'
import { BuildsStoreProvider } from '@renderer/state/builds-store'
import { SquadCompsStoreProvider } from '@renderer/state/squad-comps-store'
import { GameDataStoreProvider } from '@renderer/state/game-data-store'

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>('builds')

  return (
    <GameDataStoreProvider>
      <BuildsStoreProvider>
        <SquadCompsStoreProvider>
          <NavBar active={activeView} onChange={setActiveView} />
          <main className="app-content">
            {activeView === 'builds' ? <BuildsView /> : <SquadsView />}
          </main>
        </SquadCompsStoreProvider>
      </BuildsStoreProvider>
    </GameDataStoreProvider>
  )
}
