import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import type { NativeImage } from 'electron'
import type { Build, SquadComp } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import type { CapturePayload } from '@shared/capture/capture-provider'
import { loadRenderer } from '../renderer-url'

/** Fixed capture width (2026-08-28) — the widest `.build-editor-grid`/`.party-rows` reflow tier
 *  (see `global.css`), so a screenshot always comes out at the same standardized layout regardless
 *  of the real editor window's current size. Height is NOT fixed — see `runCapture` below, it's
 *  measured from the actual rendered content and the offscreen window resized to match, so nothing
 *  ever gets cropped the way the old on-screen capture's viewport-bound fast path could. */
const CAPTURE_WIDTH = 1920

/** How long a `CaptureHost` render gets to call `signalReady` before this gives up — a render bug
 *  with no error boundary (same failure mode the Discord bot's `build-screenshot.ts` doc comment
 *  describes on its own Worker side) shouldn't hang "Copy screenshot" forever. */
const READY_TIMEOUT_MS = 15_000

/** Selector `CaptureHost` renders at its own root for each kind — matches
 *  `worker/src/render/build-screenshot.ts`'s `GRID_SELECTOR`/the equivalent squad selector, so
 *  this measures/captures the exact same element the Discord bot's headless render does, just via
 *  Electron's own offscreen `BrowserWindow` instead of a remote Puppeteer session. */
const CAPTURE_SELECTOR: Record<CapturePayload['kind'], string> = {
  build: '.build-editor-grid',
  squad: '.party-rows'
}

/** Payloads stashed by `captureBuildScreenshot`/`captureSquadScreenshot` below, keyed by the token
 *  each spawned `CaptureHost` window was navigated with — read once via `getPendingPayload` (the
 *  `capture:get-payload` IPC handler) and cleared when that capture finishes either way. */
const pendingPayloads = new Map<string, CapturePayload>()
const pendingReadyResolvers = new Map<string, () => void>()

/** `capture:get-payload` IPC handler body — see `CaptureIpcChannel.getPayload`'s doc comment. */
export function getPendingPayload(token: string): CapturePayload | null {
  return pendingPayloads.get(token) ?? null
}

/** `capture:signal-ready` IPC handler body — resolves the matching `waitForReady` below, if one is
 *  still pending (a repeat call, e.g. from React StrictMode's double-invoked effects in dev, is
 *  harmless: the resolver's already been removed by the first call). */
export function signalReady(token: string): void {
  pendingReadyResolvers.get(token)?.()
}

function waitForReady(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingReadyResolvers.delete(token)
      reject(new Error(`Capture route for token ${token} never signaled ready`))
    }, READY_TIMEOUT_MS)
    pendingReadyResolvers.set(token, () => {
      clearTimeout(timer)
      pendingReadyResolvers.delete(token)
      resolve()
    })
  })
}

/**
 * Waits for a `'paint'` frame at exactly `width`×`height` — the actual mechanism this reads
 * captured frames from (2026-08-28, replacing an initial `capturePage()` attempt that threw
 * `UnknownVizError` reliably whenever the real, on-screen editor window happened to be larger than
 * this offscreen one at the time). `capturePage()` reads from the same on-screen compositor
 * surface a real window paints to, which an `offscreen: true` `webContents` was never fully wired
 * into the same way — Electron's own offscreen-rendering docs call out the `'paint'` event as the
 * actual supported way to read frames from one, and its `image` argument is documented as "the
 * image data of the whole frame" (not just the changed `dirtyRect`), so no manual compositing is
 * needed here either. Filters by size rather than taking the very next paint unconditionally:
 * `setContentSize` below can still have one or two in-flight paints at the *old* size queued
 * before Chromium's finished relaying out at the new one. `invalidate()` forces a fresh paint to
 * be queued immediately rather than waiting for OSR's own next scheduled frame (up to ~16ms at the
 * default 60fps cap — cheap insurance, not required for correctness on its own). */
function waitForPaintAtSize(win: BrowserWindow, width: number, height: number): Promise<NativeImage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      win.webContents.removeListener('paint', onPaint)
      reject(new Error(`Timed out waiting for a ${width}x${height} offscreen paint`))
    }, READY_TIMEOUT_MS)
    function onPaint(_event: unknown, _dirtyRect: unknown, image: NativeImage): void {
      const size = image.getSize()
      if (size.width !== width || size.height !== height) return
      clearTimeout(timer)
      win.webContents.removeListener('paint', onPaint)
      resolve(image)
    }
    win.webContents.on('paint', onPaint)
    win.webContents.invalidate()
  })
}

/**
 * Drives a dedicated, never-shown offscreen `BrowserWindow` through one full "render this build/
 * squad, then screenshot it" round trip (2026-08-28, replacing `ScreenshotButton`'s old on-screen
 * `capturePage`/scroll-stitch approach — see that component's doc comment for why: on-screen
 * capture ties the result to whatever width the real window happens to be, and was cropping/
 * duplicating content once the below-1920 reflow made that width-dependence actually matter).
 * `webPreferences: { offscreen: true }` is the load-bearing part — Chromium paints into an
 * in-memory buffer that's never composited to a real screen surface at all, so this needs no
 * visible resize/flicker of anything the user can see, and isn't bounded by the actual display's
 * resolution the way a real window would be. Conceptually the same idea as the Discord bot's own
 * `build-screenshot.ts`/`squad-screenshot.ts` (a real, headless browser render of the target
 * component, captured whole) — just running inside this process via Electron's own offscreen mode
 * instead of a remote Puppeteer session, since it needs the currently-open editor's live draft
 * state rather than a saved/shared one.
 *
 * `token` round-trips through `CaptureHost` (`src/renderer/components/capture/CaptureHost.tsx`,
 * mounted by `App.tsx` whenever the window was opened with `?capture=…&token=…`): stash the
 * payload here, spawn the window, `CaptureHost` pulls it back via `getPendingPayload` and — once
 * every icon it rendered has decoded — reports back via `signalReady`. Only then is `.build-
 * editor-grid`/`.party-rows`'s real height measured and the window resized to match exactly, so
 * the frame `waitForPaintAtSize` below reads back is always the whole thing in one shot — no
 * cropping, no stitching. See that function's own doc comment for why it reads frames via the
 * `'paint'` event rather than `capturePage()`.
 */
async function runCapture(payload: CapturePayload): Promise<Buffer> {
  const token = randomUUID()
  pendingPayloads.set(token, payload)

  const win = new BrowserWindow({
    show: false,
    width: CAPTURE_WIDTH,
    height: 1080,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false
    }
  })

  try {
    await loadRenderer(win, { capture: payload.kind, token })
    await waitForReady(token)

    const selector = CAPTURE_SELECTOR[payload.kind]
    const height = Math.max(
      1,
      Math.ceil(
        (await win.webContents.executeJavaScript(
          `document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect().height ?? 0`
        )) as number
      )
    )
    win.setContentSize(CAPTURE_WIDTH, height)
    const image = await waitForPaintAtSize(win, CAPTURE_WIDTH, height)
    return image.toPNG()
  } finally {
    pendingPayloads.delete(token)
    win.destroy()
  }
}

export function captureBuildScreenshot(build: Build, combatState: CombatState): Promise<Buffer> {
  return runCapture({ kind: 'build', payload: { build, combatState } })
}

export function captureSquadScreenshot(squadComp: SquadComp): Promise<Buffer> {
  return runCapture({ kind: 'squad', payload: { squadComp } })
}
