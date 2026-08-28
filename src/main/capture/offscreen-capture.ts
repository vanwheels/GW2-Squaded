import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
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

/** One paint tick after `win.setContentSize` below, so the resize has actually been laid out and
 *  painted before `capturePage` reads the framebuffer — same "wait a frame after a DOM change,
 *  before measuring/capturing" precaution `ScreenshotButton`'s old on-screen capture used to take
 *  (see its git history), just running inside the offscreen window instead of the caller. */
function waitForFrame(win: BrowserWindow): Promise<void> {
  return win.webContents.executeJavaScript(
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  )
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
 * the final `capturePage` call is always a single shot that can't crop or need stitching.
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
    await waitForFrame(win)

    const image = await win.webContents.capturePage({ x: 0, y: 0, width: CAPTURE_WIDTH, height })
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
