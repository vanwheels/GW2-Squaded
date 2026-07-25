import type { StorageAdapter } from '@shared/storage/storage-interface'

declare global {
  interface Window {
    gw2Storage: StorageAdapter
  }
}
