import { useEffect, useRef, useState } from 'react'
import type { Build, SquadComp, TraitLineSelection } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { withUnderwaterSetting } from '@shared/types/build'
import { useGameData } from '@renderer/state/game-data-store'
import { useAppSettings } from '@renderer/state/app-settings-store'
import { useBuildsStore } from '@renderer/state/builds-store'
import { BuildScreenshotGrid } from '@renderer/components/build-editor/BuildScreenshotGrid'
import { SquadCompScreenshotGrid } from '@renderer/components/squad-editor/SquadCompScreenshotGrid'

function equippedSpecializationIdsFor(build: Build): Set<number> {
  return new Set(build.specializations.filter((s): s is TraitLineSelection => s !== null).map((s) => s.specializationId))
}

/**
 * Build-editor half of `CaptureHost` — pulls its payload via `getPayload(token)` instead of
 * `BuildPreviewPage.tsx`'s `fetch`, everything else about the "wait for every rendered `<img>` to
 * decode, then signal ready" contract is the same, just reporting over
 * `window.gw2Capture.signalReady` instead of `document.body.dataset.renderState`. `withUnderwaterSetting`
 * applied here (not by the caller) matches `BuildPreviewModal.tsx`'s same "raw build in, masked
 * build out" shape — `showUnderwater` resolves correctly on its own since this window shares the
 * same `localStorage`-backed `AppSettingsProvider` as the real editor window (same `file://`
 * origin, see `offscreen-capture.ts`'s doc comment).
 */
function BuildCaptureHost({ token }: { token: string }) {
  const { loading: gameDataLoading } = useGameData()
  const { showUnderwater } = useAppSettings()
  const [build, setBuild] = useState<Build | null>(null)
  const [combatState, setCombatState] = useState<CombatState | null>(null)
  const [signaled, setSignaled] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void window.gw2Capture.getPayload(token).then((result) => {
      if (cancelled || !result || result.kind !== 'build') return
      setBuild(result.payload.build)
      setCombatState(result.payload.combatState)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const readyToMount = build !== null && combatState !== null && !gameDataLoading

  useEffect(() => {
    if (!readyToMount || signaled || !gridRef.current) return
    let cancelled = false
    const images = Array.from(gridRef.current.querySelectorAll('img'))
    void Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
      if (cancelled) return
      setSignaled(true)
      void window.gw2Capture.signalReady(token)
    })
    return () => {
      cancelled = true
    }
  }, [readyToMount, signaled, token])

  // Re-derived (not just `!readyToMount`) so TypeScript narrows `build`/`combatState` below.
  if (!build || !combatState || gameDataLoading) return null

  return (
    <BuildScreenshotGrid
      build={withUnderwaterSetting(build, showUnderwater)}
      combatState={combatState}
      equippedSpecializationIds={equippedSpecializationIdsFor(build)}
      interactive={false}
      gridRef={gridRef}
    />
  )
}

/** Squad-editor half of `CaptureHost` — see `BuildCaptureHost`'s doc comment for the shared
 *  reasoning. `buildsById`/`builds` come straight from this window's own `useBuildsStore()` rather
 *  than the payload — see `SquadScreenshotPayload`'s doc comment for why that's safe (every build
 *  a squad slot can reference is already persisted). `screenshotMode` is hardcoded on: this tree
 *  is never interactive, so there's no live pre/post-capture toggle to mirror
 *  `SquadCompEditorView`'s own (that toggle only ever existed to hide editing chrome from an
 *  on-screen capture, which no longer applies here). */
function SquadCaptureHost({ token }: { token: string }) {
  const { builds } = useBuildsStore()
  const [squadComp, setSquadComp] = useState<SquadComp | null>(null)
  const [signaled, setSignaled] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void window.gw2Capture.getPayload(token).then((result) => {
      if (cancelled || !result || result.kind !== 'squad') return
      setSquadComp(result.payload.squadComp)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!squadComp || signaled || !gridRef.current) return
    let cancelled = false
    const images = Array.from(gridRef.current.querySelectorAll('img'))
    void Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
      if (cancelled) return
      setSignaled(true)
      void window.gw2Capture.signalReady(token)
    })
    return () => {
      cancelled = true
    }
  }, [squadComp, signaled, token])

  if (!squadComp) return null

  const buildsById = new Map(builds.map((b) => [b.id, b]))

  return (
    <SquadCompScreenshotGrid
      parties={squadComp.parties}
      buildsById={buildsById}
      builds={builds}
      gridRef={gridRef}
      interactive={false}
      screenshotMode
    />
  )
}

/**
 * Dedicated headless render route for `offscreen-capture.ts`'s "Copy screenshot" pipeline
 * (2026-08-28, replacing the old on-screen `capturePage`/scroll-stitch approach — see
 * `ScreenshotButton.tsx`'s doc comment for why). `App.tsx` mounts this in place of the normal
 * nav/tabs UI whenever the window was opened with a `?capture=build|squad&token=…` query string —
 * `token` identifies which payload (stashed main-process-side by whichever `captureBuildScreenshot`/
 * `captureSquadScreenshot` call spawned this offscreen window) to pull via `getPayload`.
 *
 * Renders `BuildScreenshotGrid`/`SquadCompScreenshotGrid` directly as its only output — no
 * wrapping div, no `.app-content` padding around it — so `.build-editor-grid`/`.party-rows` sits
 * flush at `(0, 0)` under `<body>` (which has zero margin, see `global.css`), matching
 * `offscreen-capture.ts`'s `x: 0, y: 0` capture rect exactly. Closely mirrors
 * `BuildPreviewPage.tsx`/`SquadPreviewPage.tsx`, the Discord bot's equivalent render pages for
 * `/builddisplay`/`/squaddisplay` — same "wait for every `<img>` to decode, then signal ready"
 * contract, just fed from a locally-persisted/live-draft payload over IPC instead of a fetched
 * public share.
 */
export function CaptureHost({ kind, token }: { kind: 'build' | 'squad'; token: string }) {
  return kind === 'build' ? <BuildCaptureHost token={token} /> : <SquadCaptureHost token={token} />
}
