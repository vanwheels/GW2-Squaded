import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import type { BrowserWindow } from 'electron'

/**
 * Navigates `win` to this app's own renderer bundle — the same dev-server URL / packaged
 * `index.html` `createWindow` (`src/main/index.ts`) has always used, just factored out so
 * `offscreen-capture.ts`'s dedicated capture window (2026-08-28) can reuse the exact same `is.dev`
 * branch instead of a second copy that could drift out of sync with it. `query`, when given, is
 * appended so the renderer can read it off `window.location.search` on load — `offscreen-capture.ts`
 * uses this for `?capture=build|squad&token=…`, `createWindow` never passes one.
 */
export function loadRenderer(win: BrowserWindow, query?: Record<string, string>): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const search = query ? `?${new URLSearchParams(query).toString()}` : ''
    return win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${search}`)
  }
  return win.loadFile(join(__dirname, '../renderer/index.html'), query ? { query } : undefined)
}
