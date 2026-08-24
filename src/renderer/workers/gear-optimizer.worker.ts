/// <reference lib="webworker" />
import { optimizeGear } from '@shared/gear-calc/gear-optimize'
import type { GearOptimizerWorkerRequest, GearOptimizerWorkerResponse } from './gear-optimizer-protocol'

/**
 * Runs `optimizeGear` off the main thread (see TODO.md's "Move `optimizeGear` off the main thread
 * into a Web Worker" entry) — a 2-3 tier search can take several seconds, which used to freeze the
 * entire renderer (this window's UI, not just the modal) for its duration since `optimizeGear` is a
 * synchronous, CPU-bound recursive search with no natural yield points.
 *
 * `GearOptimizerPanel` creates one worker instance per run (via Vite's native
 * `new Worker(new URL(...), { type: 'module' })` — bundled locally like the rest of the renderer,
 * no network/quota concerns; unrelated to the Cloudflare `worker/` used for the Discord bot) and
 * terminates it on completion or cancel, rather than keeping one alive across runs: `terminate()`
 * (the cancel mechanism — there's no cooperative-cancellation path into the middle of a synchronous
 * DFS) kills the worker outright, so the next run always starts fresh anyway.
 */
declare const self: DedicatedWorkerGlobalScope

self.onmessage = (event: MessageEvent<GearOptimizerWorkerRequest>) => {
  const { input } = event.data
  const result = optimizeGear(input, {
    onProgress: (progress) => {
      const message: GearOptimizerWorkerResponse = { type: 'progress', progress }
      self.postMessage(message)
    }
  })
  const message: GearOptimizerWorkerResponse = { type: 'result', result }
  self.postMessage(message)
}
