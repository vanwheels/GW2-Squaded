import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { GAME_DATA_FILE_NAMES } from '../src/shared/game-data/data-files'

/**
 * Serves `data/game-data/*.json` (the same files Electron's `loadGameData()` reads via
 * `fs.readFileSync`, and the same whitelist `scripts/sync-web-preview-game-data.ts` copies from)
 * under `/game-data/*.json` — the path `load-game-data-web.ts`'s `webGameDataProvider` fetches.
 * In dev, reads straight from the single committed source directory. In a production build, the
 * `writeBundle` hook below copies the same files into `outDir/game-data` — which is now
 * `worker/public/game-data`, the same destination `scripts/sync-web-preview-game-data.ts` stages
 * for the Discord-bot preview build. Both copy the same whitelist from the same source, so running
 * either build (or both) leaves identical content there.
 */
function serveGameData(): Plugin {
  const sourceDir = resolve(__dirname, '../data/game-data')
  const fileNames: readonly string[] = GAME_DATA_FILE_NAMES

  return {
    name: 'serve-game-data',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/game-data\/([^/]+\.json)$/)
        if (!match || !fileNames.includes(match[1])) {
          next()
          return
        }
        try {
          const data = await readFile(resolve(sourceDir, match[1]))
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
        } catch {
          next()
        }
      })
    },
    async writeBundle(options) {
      const outDir = options.dir ?? 'dist/web'
      const { mkdir, copyFile } = await import('node:fs/promises')
      const destDir = resolve(outDir, 'game-data')
      await mkdir(destDir, { recursive: true })
      for (const fileName of fileNames) {
        await copyFile(resolve(sourceDir, fileName), resolve(destDir, fileName))
      }
    }
  }
}

export default defineConfig({
  root: __dirname,
  publicDir: resolve(__dirname, '../src/renderer/public'),
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, '../src/renderer'),
      '@shared': resolve(__dirname, '../src/shared')
    }
  },
  build: {
    // Same `worker/public` the Discord-bot preview build (`vite.web-preview.config.ts`) writes
    // to, served by the Worker's single `[assets]` config — one deployable, not a second
    // Cloudflare product. `emptyOutDir: false` so this build doesn't wipe that other build's
    // `build-preview.html`/`squad-preview.html`/assets (or vice versa); filenames don't collide
    // (`index.html` here vs. those two) and hashed chunk names avoid collisions in `assets/`.
    outDir: resolve(__dirname, '../worker/public'),
    emptyOutDir: false
  },
  plugins: [react(), serveGameData()]
})
