import { contextBridge, ipcRenderer } from 'electron'
import type { Build, SquadComp } from '@shared/types'
import type { StorageAdapter } from '@shared/storage/storage-interface'
import { StorageIpcChannel } from '@shared/storage/ipc-channels'
import type { GameDataProvider } from '@shared/game-data/game-data-provider'
import type { DataUpdateProvider, DataUpdateStatus } from '@shared/game-data/data-update-provider'
import { GameDataIpcChannel, DataUpdateIpcChannel } from '@shared/game-data/ipc-channels'
import type { CaptureProvider, CaptureRect } from '@shared/capture/capture-provider'
import { CaptureIpcChannel } from '@shared/capture/ipc-channels'
import type { UpdaterProvider, UpdateStatus } from '@shared/updater/updater-provider'
import { UpdaterIpcChannel } from '@shared/updater/ipc-channels'

/**
 * Implements the shared StorageAdapter interface over IPC. This is the Electron-specific
 * half of the storage seam — a future Capacitor build implements the same StorageAdapter
 * interface via a native plugin instead, and the renderer code doesn't change.
 */
const storage: StorageAdapter = {
  builds: {
    list: () => ipcRenderer.invoke(StorageIpcChannel.buildsList),
    get: (id: string) => ipcRenderer.invoke(StorageIpcChannel.buildsGet, id),
    create: (build: Build) => ipcRenderer.invoke(StorageIpcChannel.buildsCreate, build),
    update: (build: Build) => ipcRenderer.invoke(StorageIpcChannel.buildsUpdate, build),
    remove: (id: string) => ipcRenderer.invoke(StorageIpcChannel.buildsRemove, id)
  },
  squadComps: {
    list: () => ipcRenderer.invoke(StorageIpcChannel.squadCompsList),
    get: (id: string) => ipcRenderer.invoke(StorageIpcChannel.squadCompsGet, id),
    create: (squadComp: SquadComp) => ipcRenderer.invoke(StorageIpcChannel.squadCompsCreate, squadComp),
    update: (squadComp: SquadComp) => ipcRenderer.invoke(StorageIpcChannel.squadCompsUpdate, squadComp),
    remove: (id: string) => ipcRenderer.invoke(StorageIpcChannel.squadCompsRemove, id)
  }
}

const gameData: GameDataProvider = {
  getAll: () => ipcRenderer.invoke(GameDataIpcChannel.getAll)
}

const capture: CaptureProvider = {
  captureRegion: (rect: CaptureRect) => ipcRenderer.invoke(CaptureIpcChannel.captureRegion, rect),
  captureRegionToDataUrl: (rect: CaptureRect) => ipcRenderer.invoke(CaptureIpcChannel.captureRegionToDataUrl, rect),
  writeImageDataUrl: (dataUrl: string) => ipcRenderer.invoke(CaptureIpcChannel.writeImageDataUrl, dataUrl)
}

const updater: UpdaterProvider = {
  getAppVersion: () => ipcRenderer.invoke(UpdaterIpcChannel.getAppVersion),
  isSupported: () => ipcRenderer.invoke(UpdaterIpcChannel.isSupported),
  checkForUpdates: () => ipcRenderer.invoke(UpdaterIpcChannel.check),
  downloadUpdate: () => ipcRenderer.invoke(UpdaterIpcChannel.download),
  quitAndInstall: () => ipcRenderer.invoke(UpdaterIpcChannel.install),
  onStatus: (listener: (status: UpdateStatus) => void) => {
    const handler = (_event: unknown, status: UpdateStatus): void => listener(status)
    ipcRenderer.on(UpdaterIpcChannel.status, handler)
    return () => ipcRenderer.removeListener(UpdaterIpcChannel.status, handler)
  }
}

const dataUpdate: DataUpdateProvider = {
  getLocalMeta: () => ipcRenderer.invoke(DataUpdateIpcChannel.getLocalMeta),
  checkForUpdate: () => ipcRenderer.invoke(DataUpdateIpcChannel.check),
  downloadUpdate: () => ipcRenderer.invoke(DataUpdateIpcChannel.download),
  restartAndApply: () => ipcRenderer.invoke(DataUpdateIpcChannel.restartAndApply),
  onStatus: (listener: (status: DataUpdateStatus) => void) => {
    const handler = (_event: unknown, status: DataUpdateStatus): void => listener(status)
    ipcRenderer.on(DataUpdateIpcChannel.status, handler)
    return () => ipcRenderer.removeListener(DataUpdateIpcChannel.status, handler)
  }
}

contextBridge.exposeInMainWorld('gw2Storage', storage)
contextBridge.exposeInMainWorld('gw2GameData', gameData)
contextBridge.exposeInMainWorld('gw2Capture', capture)
contextBridge.exposeInMainWorld('gw2Updater', updater)
contextBridge.exposeInMainWorld('gw2DataUpdate', dataUpdate)
