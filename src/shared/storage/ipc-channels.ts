/** IPC channel names shared between the main-process handlers and the preload bridge. */
export const StorageIpcChannel = {
  buildsList: 'storage:builds:list',
  buildsGet: 'storage:builds:get',
  buildsCreate: 'storage:builds:create',
  buildsUpdate: 'storage:builds:update',
  buildsRemove: 'storage:builds:remove',
  buildsListTombstones: 'storage:builds:listTombstones',
  buildsClearTombstones: 'storage:builds:clearTombstones',
  buildsReplaceAll: 'storage:builds:replaceAll',
  squadCompsList: 'storage:squadComps:list',
  squadCompsGet: 'storage:squadComps:get',
  squadCompsCreate: 'storage:squadComps:create',
  squadCompsUpdate: 'storage:squadComps:update',
  squadCompsRemove: 'storage:squadComps:remove',
  squadCompsListTombstones: 'storage:squadComps:listTombstones',
  squadCompsClearTombstones: 'storage:squadComps:clearTombstones',
  squadCompsReplaceAll: 'storage:squadComps:replaceAll'
} as const
