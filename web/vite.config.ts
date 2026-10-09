import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { GAME_DATA_FILE_NAMES } from '../src/shared/game-data/data-files'

/**
 * Serves `data/game-data/*.json` (the same files Electron's `loadGameData()` reads via
 * `fs.readFileSync`, and the same whitelist `scripts/sync-web-preview-game-data.ts` copies from)
 * under `/game-data/*.json` — the path `load-game-data-web.ts`'s `webGameDataProvider` fetches.
 * Reads straight from the single committed source directory rather than staging a build-time
 * copy: unlike the Discord-bot web-preview deployable (which shares an `outDir` with its own
 * worker's static assets), this build has no fixed deploy target yet (see TODO.md's "Deploy to
 * gw2squaded.vannyproductions.com" leg), so there's nothing to stage a copy into.
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
    outDir: resolve(__dirname, '../dist/web')
  },
  plugins: [react(), serveGameData()]
})
