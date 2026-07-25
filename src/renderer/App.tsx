import { useState } from 'react'
import { NavBar, type ViewKey } from '@renderer/components/NavBar'
import { BuildsView } from '@renderer/views/BuildsView'
import { SquadsView } from '@renderer/views/SquadsView'
import { BuildsStoreProvider } from '@renderer/state/builds-store'

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>('builds')

  return (
    <BuildsStoreProvider>
      <NavBar active={activeView} onChange={setActiveView} />
      <main className="app-content">
        {activeView === 'builds' ? <BuildsView /> : <SquadsView />}
      </main>
    </BuildsStoreProvider>
  )
}
