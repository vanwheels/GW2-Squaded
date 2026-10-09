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
 * `writeBundle` hook below copies the same files into `outDir/game-data` (`dist/web/game-data`)
 * since GitHub Pages serves this build standalone — it isn't staged into the Worker's
 * `worker/public` the way the Discord-bot preview build's game-data is.
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
  // Relative base, not '/': GitHub Pages' custom-domain root still works with either, but this
  // matches ChoiceBuds' web/vite.config.ts (same deploy shape, same vannyproductions.com zone).
  base: './',
  build: {
    // outDir resolves outside this config's own `root` (`web/`), so Vite won't empty it by
    // default without this — see ChoiceBuds' identical web/vite.config.ts.
    outDir: resolve(__dirname, '../dist/web'),
    emptyOutDir: true
  },
  plugins: [react(), serveGameData()]
})
