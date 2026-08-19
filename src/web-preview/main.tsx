import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GameDataStoreProvider } from '@renderer/state/game-data-store'
import { BuildPreviewPage } from './BuildPreviewPage'
import { webGameDataProvider } from './load-game-data-web'
import '@renderer/styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameDataStoreProvider provider={webGameDataProvider}>
      <BuildPreviewPage />
    </GameDataStoreProvider>
  </StrictMode>
)
