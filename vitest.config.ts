import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Separate from electron.vite.config.ts on purpose — that config's 3 build targets
// (main/preload/renderer) each need Electron-specific plugins/output formats that have nothing to
// do with running plain unit tests, and electron-vite doesn't expose a `test` block itself. Only
// the `@shared` alias is duplicated from there since these tests live under src/shared.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
