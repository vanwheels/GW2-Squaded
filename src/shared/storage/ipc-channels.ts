/** IPC channel names shared between the main-process handlers and the preload bridge. */
export const StorageIpcChannel = {
  buildsList: 'storage:builds:list',
  buildsGet: 'storage:builds:get',
  buildsCreate: 'storage:builds:create',
  buildsUpdate: 'storage:builds:update',
  buildsRemove: 'storage:builds:remove',
  squadCompsList: 'storage:squadComps:list',
  squadCompsGet: 'storage:squadComps:get',
  squadCompsCreate: 'storage:squadComps:create',
  squadCompsUpdate: 'storage:squadComps:update',
  squadCompsRemove: 'storage:squadComps:remove'
} as const
