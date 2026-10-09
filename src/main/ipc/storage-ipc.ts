import { ipcMain } from 'electron'
import type { Build, SquadComp } from '@shared/types'
import type { StorageAdapter, SyncTombstone } from '@shared/storage/storage-interface'
import { StorageIpcChannel } from '@shared/storage/ipc-channels'

export function registerStorageIpc(storage: StorageAdapter): void {
  ipcMain.handle(StorageIpcChannel.buildsList, () => storage.builds.list())
  ipcMain.handle(StorageIpcChannel.buildsGet, (_event, id: string) => storage.builds.get(id))
  ipcMain.handle(StorageIpcChannel.buildsCreate, (_event, build: Build) => storage.builds.create(build))
  ipcMain.handle(StorageIpcChannel.buildsUpdate, (_event, build: Build) => storage.builds.update(build))
  ipcMain.handle(StorageIpcChannel.buildsRemove, (_event, id: string) => storage.builds.remove(id))
  ipcMain.handle(StorageIpcChannel.buildsListTombstones, () => storage.builds.listTombstones())
  ipcMain.handle(StorageIpcChannel.buildsClearTombstones, (_event, ids: string[]) =>
    storage.builds.clearTombstones(ids)
  )
  ipcMain.handle(StorageIpcChannel.buildsReplaceAll, (_event, records: Build[], tombstones: SyncTombstone[]) =>
    storage.builds.replaceAll(records, tombstones)
  )

  ipcMain.handle(StorageIpcChannel.squadCompsList, () => storage.squadComps.list())
  ipcMain.handle(StorageIpcChannel.squadCompsGet, (_event, id: string) => storage.squadComps.get(id))
  ipcMain.handle(StorageIpcChannel.squadCompsCreate, (_event, squadComp: SquadComp) =>
    storage.squadComps.create(squadComp)
  )
  ipcMain.handle(StorageIpcChannel.squadCompsUpdate, (_event, squadComp: SquadComp) =>
    storage.squadComps.update(squadComp)
  )
  ipcMain.handle(StorageIpcChannel.squadCompsRemove, (_event, id: string) => storage.squadComps.remove(id))
  ipcMain.handle(StorageIpcChannel.squadCompsListTombstones, () => storage.squadComps.listTombstones())
  ipcMain.handle(StorageIpcChannel.squadCompsClearTombstones, (_event, ids: string[]) =>
    storage.squadComps.clearTombstones(ids)
  )
  ipcMain.handle(
    StorageIpcChannel.squadCompsReplaceAll,
    (_event, records: SquadComp[], tombstones: SyncTombstone[]) => storage.squadComps.replaceAll(records, tombstones)
  )
}
