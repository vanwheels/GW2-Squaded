/** IPC channel names shared between the main-process handler and the preload bridge. */
export const CaptureIpcChannel = {
  /** Real-window renderer → main: renders `build`/`combatState` in a dedicated offscreen window
   *  (see `src/main/capture/offscreen-capture.ts`) and writes the resulting PNG to the clipboard. */
  buildScreenshot: 'capture:build-screenshot',
  /** Same as `buildScreenshot`, for a `squadComp`. */
  squadScreenshot: 'capture:squad-screenshot',
  /** Capture-route renderer (running inside the offscreen window `buildScreenshot`/
   *  `squadScreenshot` spawned) → main: pulls the payload that spawned it, keyed by the `token`
   *  query param `CaptureHost` was navigated with. */
  getPayload: 'capture:get-payload',
  /** Capture-route renderer → main: signals that its render is fully painted (every icon decoded)
   *  and ready to be captured — resolves the corresponding `buildScreenshot`/`squadScreenshot`
   *  call's wait. */
  signalReady: 'capture:signal-ready'
} as const
