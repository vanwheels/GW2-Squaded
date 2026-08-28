import type { Build, SquadComp } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'

/** `ScreenshotButton`'s payload for a Build editor capture — everything `CaptureHost`'s build
 *  route needs to reproduce the exact same render `BuildEditorView` had on screen. Everything else
 *  (theme, `showUnderwater`/`partyWideOnly` settings, game data, the builds store) resolves
 *  identically inside the offscreen window for free — see `offscreen-capture.ts`'s doc comment. */
export interface BuildScreenshotPayload {
  build: Build
  combatState: CombatState
}

/** Same idea as `BuildScreenshotPayload`, for the Squad editor. `builds`/`buildsById` aren't part
 *  of this — every build a squad slot can reference is already persisted, so `CaptureHost`'s squad
 *  route just reads the same local builds store the real window would. */
export interface SquadScreenshotPayload {
  squadComp: SquadComp
}

/** What `CaptureHost` pulls via `getPayload` — tagged by which `captureXScreenshot` call spawned
 *  the offscreen window it's running in. */
export type CapturePayload =
  | { kind: 'build'; payload: BuildScreenshotPayload }
  | { kind: 'squad'; payload: SquadScreenshotPayload }

/**
 * The renderer's only way to produce a screenshot of a build/squad — reached via the
 * preload-exposed `window.gw2Capture` bridge (see `src/preload/index.ts`). `captureBuildScreenshot`/
 * `captureSquadScreenshot` are the only methods a normal editor window ever calls: each drives a
 * dedicated, fixed-size offscreen `BrowserWindow` main-process-side (see
 * `src/main/capture/offscreen-capture.ts`) through a fresh, non-interactive render of the exact
 * same `BuildScreenshotGrid`/`SquadCompScreenshotGrid` the editor itself uses, and writes the
 * resulting PNG straight to the OS clipboard — no image data ever crosses back into the calling
 * renderer, matching the previous on-screen-capture design's same "renderer never touches image
 * bytes" shape.
 *
 * `getPayload`/`signalReady` exist only for the *other* side of that round trip — `CaptureHost`,
 * running inside the spawned offscreen window itself, uses them to pull its payload and report
 * when its render is fully painted. A normal editor window never calls either.
 *
 * Desktop-only concept (screenshotting a build/squad to the clipboard) — a future Capacitor build
 * has no equivalent, unlike `StorageAdapter`/`GameDataProvider` which both have a real
 * mobile-native implementation path.
 */
export interface CaptureProvider {
  captureBuildScreenshot(payload: BuildScreenshotPayload): Promise<void>
  captureSquadScreenshot(payload: SquadScreenshotPayload): Promise<void>
  /** `CaptureHost`-only — see the interface doc comment. */
  getPayload(token: string): Promise<CapturePayload | null>
  /** `CaptureHost`-only — see the interface doc comment. */
  signalReady(token: string): Promise<void>
}
