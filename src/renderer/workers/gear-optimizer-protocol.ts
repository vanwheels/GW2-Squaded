import type { OptimizerInput, OptimizerProgress, OptimizerResult } from '@shared/gear-calc/gear-optimize'

/**
 * Message protocol between `GearOptimizerPanel` (main thread) and `gear-optimizer.worker.ts` — see
 * that file's doc comment for why `optimizeGear` runs off the main thread at all. Kept in its own
 * file, separate from the worker itself, so `GearOptimizerPanel` can import these types without
 * pulling the worker's `self`/`postMessage` worker-global-scope code into the main thread's
 * DOM-lib type-check program (see `tsconfig.web.json`'s exclude comment) — this file has no
 * lib-sensitive code, just plain data shapes, so it type-checks fine under either program. The
 * panel never statically imports the worker file itself; it's loaded at runtime via Vite's native
 * `new Worker(new URL('./gear-optimizer.worker.ts', import.meta.url), { type: 'module' })` pattern.
 */
export interface GearOptimizerWorkerRequest {
  input: OptimizerInput
}

export type GearOptimizerWorkerResponse =
  | { type: 'progress'; progress: OptimizerProgress }
  | { type: 'result'; result: OptimizerResult }
