import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GameDataStoreProvider } from '@renderer/state/game-data-store'
import { PickerRegistryProvider } from '@renderer/state/picker-registry'
import { AppSettingsProvider } from '@renderer/state/app-settings-store'
import { FavoriteConsumablesProvider } from '@renderer/state/favorite-consumables-store'
import { BuildPreviewPage } from './BuildPreviewPage'
import { webGameDataProvider } from './load-game-data-web'
import '@renderer/styles/global.css'

// BuildScreenshotGrid's tree calls several of App.tsx's context hooks unconditionally, even with
// interactive={false} here (WeaponTypeBar/WeaponSkillBar/EquipmentEditor/EquipmentTextManifest/
// SkillsEditor/BoonConditionSummaryPanel read useAppSettings; EquipmentEditor also reads
// useFavoriteConsumables; ProfessionSpecPicker/WeaponTypeBar/etc. read usePickerOpen) — each
// missing provider throws "must be used within a ___Provider", and with no error boundary here
// that crashes the whole render silently (see BuildPreviewPage's own doc comment on why that
// always looked like a bare timeout from the Discord bot side instead of a real error). Both
// AppSettingsProvider and FavoriteConsumablesProvider are plain-`localStorage`-backed like
// PickerRegistryProvider, safe to mount in a plain browser tab. Deliberately NOT included:
// DataUpdateStoreProvider (only NavBar/SettingsView, `window.gw2DataUpdate` Electron IPC,
// unavailable here) and BuildsStoreProvider/SquadCompsStoreProvider (`window.gw2Storage` IPC,
// also unavailable) — confirmed via a full grep that nothing in BuildScreenshotGrid's tree calls
// their hooks, so they're correctly omitted rather than needing a browser-side stub.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppSettingsProvider>
      <FavoriteConsumablesProvider>
        <GameDataStoreProvider provider={webGameDataProvider}>
          <PickerRegistryProvider>
            <BuildPreviewPage />
          </PickerRegistryProvider>
        </GameDataStoreProvider>
      </FavoriteConsumablesProvider>
    </AppSettingsProvider>
  </StrictMode>
)
