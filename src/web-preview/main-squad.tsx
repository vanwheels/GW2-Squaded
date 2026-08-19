import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GameDataStoreProvider } from '@renderer/state/game-data-store'
import { PickerRegistryProvider } from '@renderer/state/picker-registry'
import { AppSettingsProvider } from '@renderer/state/app-settings-store'
import { FavoriteConsumablesProvider } from '@renderer/state/favorite-consumables-store'
import { BuildsStoreProvider } from '@renderer/state/builds-store'
import { SquadPreviewPage } from './SquadPreviewPage'
import { webGameDataProvider } from './load-game-data-web'
import '@renderer/styles/global.css'

// Same provider-completeness reasoning as `main.tsx` (see its own doc comment) — one addition
// here: `SquadCompScreenshotGrid`'s tree reaches `PartyRow` → `SlotTile`, which calls
// `useBuildsStore()` unconditionally (for its favorite-toggle affordance, dead code with
// `interactive={false}`'s `pointer-events: none`, but the hook itself still throws without a
// provider — same "missing provider crashes the whole render tree silently" failure mode
// `BuildPreviewPage`'s own doc comment describes). `BuildsStoreProvider`'s `refresh()` calls
// `window.gw2Storage.builds.list()`, which is `undefined` in a plain browser tab and rejects — but
// that rejection is just an unhandled promise, not a mount-time throw, so the provider itself
// mounts fine with an empty, permanently-loading store; nothing here reads its `loading` flag.
// `SquadCompScreenshotGrid` is fed its actual roster content straight from the fetched share
// (`SquadPreviewPage`'s own `buildsById`), never from this store.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppSettingsProvider>
      <FavoriteConsumablesProvider>
        <BuildsStoreProvider>
          <GameDataStoreProvider provider={webGameDataProvider}>
            <PickerRegistryProvider>
              <SquadPreviewPage />
            </PickerRegistryProvider>
          </GameDataStoreProvider>
        </BuildsStoreProvider>
      </FavoriteConsumablesProvider>
    </AppSettingsProvider>
  </StrictMode>
)
