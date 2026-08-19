/** IPC channel names shared between the main-process handler and the preload bridge. */
export const CaptureIpcChannel = {
  captureRegion: 'capture:region',
  /** Same capture as `captureRegion`, but returns the PNG as a data URL instead of writing it
   *  straight to the clipboard — used to gather tiles for `ScreenshotButton`'s multi-slice stitch
   *  (see its doc comment) rather than for a one-shot capture. */
  captureRegionToDataUrl: 'capture:region-to-data-url',
  /** Writes an already-composited PNG data URL to the clipboard — the stitch counterpart's final
   *  step, after `captureRegionToDataUrl` tiles have been assembled on a renderer-side canvas. */
  writeImageDataUrl: 'capture:write-image-data-url'
} as const
