import puppeteer from '@cloudflare/puppeteer'
import type { Env } from '../env'
import { UserError } from '../discord/errors'

/** Caps how long a render page gets before `/builddisplay` gives up — comfortably above the
 *  couple of seconds a normal render takes (fetch game-data + decode a build's icons), so a
 *  genuinely hung page (not just a "no such share" one, which resolves fast via `renderState =
 *  'error'`) doesn't tie up the browser binding indefinitely. */
const READY_TIMEOUT_MS = 20_000

/** Matches `src/renderer/components/build-editor/BuildScreenshotGrid.tsx`'s own root
 *  `className` — the same element the desktop app's `ScreenshotButton` captures via Electron's
 *  `capturePage` IPC (`src/main/ipc/capture-ipc.ts`), just reached here via a CSS selector
 *  instead of a React ref since this runs outside the page's own process. */
const GRID_SELECTOR = '.build-editor-grid'

/**
 * Drives Cloudflare Browser Rendering (`env.MYBROWSER`, `@cloudflare/puppeteer`) to
 * `/build-preview.html?share=<id>` — the web-preview bundle `src/web-preview/` built for exactly
 * this (see that directory's own doc comments) — and screenshots the rendered build grid once
 * `BuildPreviewPage.tsx`'s `data-render-state` signal says every icon has finished decoding.
 *
 * Always launches and closes a fresh browser session per call — no pooling. `/builddisplay` is a
 * low-frequency command (at most a handful of calls per guild per day) and Browser Rendering's
 * free tier is capped per-day regardless, so there's no reuse win worth the added complexity of
 * keeping a session alive across requests here.
 */
export async function renderBuildScreenshot(env: Env, shareId: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch(env.MYBROWSER)
  try {
    const page = await browser.newPage()
    // The render page has no error boundary, so an uncaught render exception crashes it silently
    // — `data-render-state` never gets set at all, and the only symptom without this is a bare
    // `waitForSelector` timeout below with no clue why (see the leg-2 live-verify writeup in
    // TODO.md for two real examples this caught: a missing context provider, then a CSP block).
    // Piping the page's own console/uncaught-error output into this Worker's log means
    // `wrangler tail` shows the real client-side failure instead of just "timed out".
    page.on('console', (msg) => console.log(`[render page console] ${msg.type()}: ${msg.text()}`))
    page.on('pageerror', (err) => console.error('[render page uncaught error]', err))
    // 1800, not a narrower/more "portrait" width: `.build-editor-grid`'s first two columns
    // (Traits/Equipment) are `max-content`-sized (~376px + ~696px, fixed regardless of viewport)
    // and only the 3rd (Stats+Skills, `1fr`) absorbs extra width — at 1400 that column collapsed
    // to ~280px, forcing `BoonConditionSummaryPanel`'s icon rows to wrap onto dozens of lines and
    // blowing the screenshot's height out past 1800px of mostly dead space. 1800 gives that column
    // roughly the same breathing room a normally-sized desktop window would.
    await page.setViewport({ width: 1800, height: 1000 })
    await page.goto(`${env.PUBLIC_ORIGIN}/build-preview.html?share=${encodeURIComponent(shareId)}`, {
      waitUntil: 'domcontentloaded'
    })
    await page.waitForSelector('body[data-render-state]', { timeout: READY_TIMEOUT_MS })

    const state = await page.$eval('body', (el) => el.dataset.renderState)
    if (state !== 'ready') {
      throw new UserError("That link wasn't found, or isn't a valid build — check it was copied correctly.")
    }

    const grid = await page.$(GRID_SELECTOR)
    if (!grid) {
      // The page reported 'ready' (every <img> decoded) but the grid itself is missing — a bug in
      // the render page, not a bad share link, so this is an unexpected error, not a `UserError`.
      throw new Error(`render page reported ready but ${GRID_SELECTOR} was never found`)
    }

    return await grid.screenshot({ type: 'png' })
  } finally {
    await browser.close()
  }
}
