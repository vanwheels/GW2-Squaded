import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Standalone (plain Vite, not `electron-vite`) build for the Discord bot's `/builddisplay`
 * render page — a small public web page a headless browser (Cloudflare Browser Rendering,
 * `worker/src/render/build-screenshot.ts`) navigates to and screenshots. Sibling to
 * `electron.vite.config.ts`, not a replacement for it: this doesn't touch the Electron app's own
 * main/preload/renderer build at all, it's an entirely separate deployable's assets.
 *
 * Run via `npm run build:web-preview` (see root package.json — that script also runs
 * `scripts/sync-web-preview-game-data.ts` first, since `emptyOutDir: false` below deliberately
 * doesn't wipe the game-data JSON that step stages into `worker/public/game-data/`).
 */
export default defineConfig({
  root: 'src/web-preview',
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  build: {
    outDir: resolve(__dirname, 'worker/public'),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/web-preview/build-preview.html')
    }
  },
  plugins: [react()]
})
