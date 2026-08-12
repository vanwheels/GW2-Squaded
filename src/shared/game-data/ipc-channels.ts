/** IPC channel names shared between the main-process handler and the preload bridge. */
export const GameDataIpcChannel = {
  getAll: 'game-data:getAll'
} as const

/** IPC channel names for the in-app game-data refresh flow — see `data-update-provider.ts`. */
export const DataUpdateIpcChannel = {
  getLocalMeta: 'data-update:get-local-meta',
  check: 'data-update:check',
  download: 'data-update:download',
  restartAndApply: 'data-update:restart-and-apply',
  /** Main -> renderer push event carrying the latest `DataUpdateStatus`. */
  status: 'data-update:status'
} as const
