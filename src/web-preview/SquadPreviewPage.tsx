import { useEffect, useRef, useState } from 'react'
import type { Build, SquadComp } from '@shared/types'
import { withUnderwaterSetting } from '@shared/types/build'
import { isLikelySquadCompSharePayload } from '@shared/share/validate'
import { SquadCompScreenshotGrid } from '@renderer/components/squad-editor/SquadCompScreenshotGrid'
import { useGameData } from '@renderer/state/game-data-store'

type RenderState = 'loading' | 'ready' | 'error'

/**
 * The page `worker/src/render/squad-screenshot.ts` navigates a headless browser to
 * (`/squad-preview.html?share=<id>`), for the Discord bot's `/squaddisplay` — renders the exact
 * same `SquadCompScreenshotGrid` the desktop app's own `ScreenshotButton` captures (see
 * `SquadCompEditorView.tsx`'s identical `interactive={false}` invocation, which this mirrors) fed
 * from a fetched share instead of a locally-persisted `SquadComp`. Closely mirrors
 * `BuildPreviewPage.tsx` — see that file's doc comments for the reasoning behind the game-data
 * race gate and the `data-render-state` contract, not re-explained here.
 *
 * `buildsById` comes straight from the share payload's own `SquadCompSharePayload.builds` (every
 * build referenced by the roster, bundled in as a full snapshot at share time — see that type's
 * doc comment) rather than any store, so unlike `SlotTile`'s `builds` prop (only used for the
 * assign-dropdown, irrelevant to a read-only preview) there's no need to reach into
 * `useBuildsStore` for the roster's actual content.
 */
export function SquadPreviewPage() {
  const { loading: gameDataLoading } = useGameData()
  const [squadComp, setSquadComp] = useState<SquadComp | null>(null)
  const [buildsById, setBuildsById] = useState<Map<string, Build>>(new Map())
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
        if (share.kind !== 'squadComp' || !isLikelySquadCompSharePayload(share.data)) {
          setState('error')
          return
        }
        // `withUnderwaterSetting(b, false)` per build, same masking `PartyRow`'s own
        // `effectiveBuildsById` applies when the Settings toggle is off — this render page has no
        // settings UI at all, so it always renders as if the toggle were off, matching
        // `BuildPreviewPage`'s equivalent choice for `/builddisplay`.
        const map = new Map(Object.entries(share.data.builds).map(([id, b]) => [id, withUnderwaterSetting(b, false)]))
        setBuildsById(map)
        setSquadComp(share.data.squadComp)
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Same race/gate reasoning as `BuildPreviewPage.tsx` — the share fetch usually beats the much
  // larger game-data fetch, and mounting the grid before game data is ready throws on the first
  // undefined skill/trait/specialization lookup with no error boundary to catch it.
  const readyToMount = squadComp !== null && !gameDataLoading

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

  // Re-derived (not just `!readyToMount`) so TypeScript narrows `squadComp` to non-null below.
  if (!squadComp || gameDataLoading) return null

  return (
    <SquadCompScreenshotGrid
      parties={squadComp.parties}
      buildsById={buildsById}
      builds={[]}
      gridRef={gridRef}
      interactive={false}
      screenshotMode
    />
  )
}
