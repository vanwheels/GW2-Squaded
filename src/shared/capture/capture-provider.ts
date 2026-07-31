/** A region of the current window's content area, in CSS pixels (matches
 *  `Element.getBoundingClientRect()` — Electron's `webContents.capturePage` rect is specified in
 *  the same device-independent-pixel space). */
export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The renderer's only way to grab a screenshot of part of its own window — reached via the
 * preload-exposed `window.gw2Capture` bridge (see src/preload/index.ts). Copies straight to the
 * OS clipboard (main-process-side, via Electron's `clipboard` module) rather than returning image
 * data to the renderer, since that's the actual end use (paste into Discord, etc.) and avoids
 * shipping a PNG buffer back across the IPC boundary for no reason.
 *
 * Desktop-only concept (screenshotting your own window) — a future Capacitor build has no
 * equivalent, unlike `StorageAdapter`/`GameDataProvider` which both have a real mobile-native
 * implementation path.
 */
export interface CaptureProvider {
  captureRegion(rect: CaptureRect): Promise<void>
}
