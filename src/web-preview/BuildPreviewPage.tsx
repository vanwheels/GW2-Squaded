import { useEffect, useRef, useState } from 'react'
import type { Build, TraitLineSelection } from '@shared/types'
import { withUnderwaterSetting } from '@shared/types/build'
import { isLikelyBuild } from '@shared/share/validate'
import { DEFAULT_COMBAT_STATE } from '@shared/gear-calc/combat-state'
import { BuildScreenshotGrid } from '@renderer/components/build-editor/BuildScreenshotGrid'
import { useGameData } from '@renderer/state/game-data-store'

type RenderState = 'loading' | 'ready' | 'error'

function equippedSpecializationIdsFor(build: Build): Set<number> {
  return new Set(build.specializations.filter((s): s is TraitLineSelection => s !== null).map((s) => s.specializationId))
}

/**
 * The page `worker/src/render/build-screenshot.ts` navigates a headless browser to
 * (`/build-preview.html?share=<id>`), for the Discord bot's `/builddisplay` — renders the exact
 * same `BuildScreenshotGrid` the desktop app's own screenshot button captures (see
 * `BuildPreviewModal.tsx`'s identical `interactive={false}` invocation, which this mirrors) fed
 * from a fetched share instead of a locally-persisted `Build`.
 *
 * `document.body.dataset.renderState` is the wait condition the headless browser polls for
 * (`page.waitForSelector('body[data-render-state]')`) — deliberately only ever set to `'ready'`
 * or `'error'`, NEVER `'loading'`: if the attribute existed during loading too, that selector
 * would resolve immediately on mount, before game-data/icons have actually loaded, defeating the
 * whole point of an explicit ready signal instead of a fixed timeout.
 */
export function BuildPreviewPage() {
  const { loading: gameDataLoading } = useGameData()
  const [build, setBuild] = useState<Build | null>(null)
  const [state, setState] = useState<RenderState>('loading')
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get('share')
    if (!shareId) {
      setState('error')
      return
    }

    let cancelled = false
    fetch(`/shares/${encodeURIComponent(shareId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ kind: string; data: unknown }>) : Promise.reject(new Error(`share fetch failed: ${res.status}`))))
      .then((share) => {
        if (cancelled) return
        if (share.kind !== 'build' || !isLikelyBuild(share.data)) {
          setState('error')
          return
        }
        setBuild(withUnderwaterSetting(share.data, false))
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Once the grid has actually mounted with a build, wait for every <img> it rendered to finish
  // decoding (or fail — a broken icon URL shouldn't hang this forever) before signaling ready.
  //
  // Gated on `gameDataLoading` too, not just `build`: unlike the Electron app (where game data
  // comes from a fast local IPC read that's always finished before a user could have a build
  // open), this page fetches ~8MB across 26 game-data files in parallel with the much smaller
  // share fetch, and the share fetch usually wins that race. Mounting `BuildScreenshotGrid` while
  // `useGameData()` still reports the empty placeholder catalog throws (every skill/trait/
  // specialization lookup inside it comes back `undefined`), and with no error boundary here that
  // silently kills the whole render tree — `data-render-state` then never gets set at all, and
  // `/builddisplay` just hangs until Browser Rendering's timeout instead of failing fast.
  const readyToMount = build !== null && !gameDataLoading

  useEffect(() => {
    if (!readyToMount || !gridRef.current) return
    let cancelled = false
    const images = Array.from(gridRef.current.querySelectorAll('img'))
    void Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
      if (!cancelled) setState('ready')
    })
    return () => {
      cancelled = true
    }
  }, [readyToMount])

  useEffect(() => {
    if (state === 'ready' || state === 'error') {
      document.body.dataset.renderState = state
    }
  }, [state])

  // Re-derived (not just `!readyToMount`) so TypeScript narrows `build` to non-null below.
  if (!build || gameDataLoading) return null

  return (
    <BuildScreenshotGrid
      build={build}
      combatState={DEFAULT_COMBAT_STATE}
      equippedSpecializationIds={equippedSpecializationIdsFor(build)}
      interactive={false}
      gridRef={gridRef}
    />
  )
}
