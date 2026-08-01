/** IPC channel names shared between the main-process handler and the preload bridge. */
export const UpdaterIpcChannel = {
  getAppVersion: 'updater:get-app-version',
  isSupported: 'updater:is-supported',
  check: 'updater:check',
  download: 'updater:download',
  install: 'updater:install',
  /** Main -> renderer push event carrying the latest `UpdateStatus`. */
  status: 'updater:status'
} as const
