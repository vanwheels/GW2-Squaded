import { contextBridge, ipcRenderer } from 'electron'
import type { Build, SquadComp } from '@shared/types'
import type { StorageAdapter } from '@shared/storage/storage-interface'
import { StorageIpcChannel } from '@shared/storage/ipc-channels'

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

contextBridge.exposeInMainWorld('gw2Storage', storage)
