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
 * preload-exposed `window.gw2Capture` bridge (see src/preload/index.ts). `captureRegion` copies
 * straight to the OS clipboard (main-process-side, via Electron's `clipboard` module) rather than
 * returning image data to the renderer, since that's the actual end use (paste into Discord, etc.)
 * and avoids shipping a PNG buffer back across the IPC boundary for no reason — the single-shot
 * fast path `ScreenshotButton` uses whenever the target already fits on-screen. The other two
 * methods exist only to support that same button's multi-slice stitch for taller-than-viewport
 * targets (see its doc comment): `capturePage` only ever renders the currently on-screen portion of
 * the page, so content scrolled out of view can't be captured in one shot at all.
 *
 * Desktop-only concept (screenshotting your own window) — a future Capacitor build has no
 * equivalent, unlike `StorageAdapter`/`GameDataProvider` which both have a real mobile-native
 * implementation path.
 */
export interface CaptureProvider {
  captureRegion(rect: CaptureRect): Promise<void>
  /** Captures `rect` like `captureRegion`, but returns the PNG as a data URL rather than writing it
   *  to the clipboard — a tile for `ScreenshotButton`'s multi-slice stitch (see its doc comment on
   *  why one on-screen capture isn't always enough). */
  captureRegionToDataUrl(rect: CaptureRect): Promise<string>
  /** Writes an already-composited PNG data URL straight to the clipboard — the stitch's final step. */
  writeImageDataUrl(dataUrl: string): Promise<void>
}
