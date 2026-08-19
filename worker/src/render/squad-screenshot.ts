import puppeteer from '@cloudflare/puppeteer'
import type { Env } from '../env'
import { UserError } from '../discord/errors'

/** Same reasoning as `build-screenshot.ts`'s own constant — comfortably above a normal render
 *  (fetch game-data + decode icons for however many builds the roster references) without tying
 *  up the browser binding indefinitely on a genuinely hung page. */
const READY_TIMEOUT_MS = 20_000

/** Matches `src/renderer/components/squad-editor/SquadCompScreenshotGrid.tsx`'s own root
 *  `className` — the same element `SquadCompEditorView`'s `ScreenshotButton` captures, reached
 *  here via a CSS selector instead of a React ref since this runs outside the page's own process. */
const GRID_SELECTOR = '.party-rows'

/**
 * Drives Cloudflare Browser Rendering (`env.MYBROWSER`, `@cloudflare/puppeteer`) to
 * `/squad-preview.html?share=<id>` and screenshots the rendered party-rows grid once
 * `SquadPreviewPage.tsx`'s `data-render-state` signal says every icon has finished decoding.
 * Mirrors `renderBuildScreenshot` closely — see that function's doc comment for the shared
 * "fresh browser session per call, no pooling" reasoning, not re-explained here.
 */
export async function renderSquadScreenshot(env: Env, shareId: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch(env.MYBROWSER)
  try {
    const page = await browser.newPage()
    // Same live-debugging tap `build-screenshot.ts` added after its own leg-2 live-verify pass
    // caught silent render-tree crashes — kept permanently, not removed after use.
    page.on('console', (msg) => console.log(`[render page console] ${msg.type()}: ${msg.text()}`))
    page.on('pageerror', (err) => console.error('[render page uncaught error]', err))
    // Same 1800 width as `build-screenshot.ts` — the squad grid's own columns (`.party-slots`,
    // `.party-summary-column`) are all fixed/min-content sized, not a `1fr` column that could
    // collapse under a narrower viewport the way the build grid's did, so this is a safety margin
    // rather than a fix for an observed bug. `grid.screenshot()` below captures the element's full
    // rendered height regardless of viewport (a roster can run up to 10 lines deep), same as the
    // build grid's boon/condition panel can run taller than one screen.
    await page.setViewport({ width: 1800, height: 1000 })
    await page.goto(`${env.PUBLIC_ORIGIN}/squad-preview.html?share=${encodeURIComponent(shareId)}`, {
      waitUntil: 'domcontentloaded'
    })
    await page.waitForSelector('body[data-render-state]', { timeout: READY_TIMEOUT_MS })

    const state = await page.$eval('body', (el) => el.dataset.renderState)
    if (state !== 'ready') {
      throw new UserError("That link wasn't found, or isn't a valid squad composition — check it was copied correctly.")
    }

    const grid = await page.$(GRID_SELECTOR)
    if (!grid) {
      // The page reported 'ready' but the grid itself is missing — a bug in the render page, not a
      // bad share link, so this is an unexpected error, not a `UserError`.
      throw new Error(`render page reported ready but ${GRID_SELECTOR} was never found`)
    }

    return await grid.screenshot({ type: 'png' })
  } finally {
    await browser.close()
  }
}
