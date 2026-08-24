import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { Build } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { OPTIMIZER_METRICS, type OptimizerFloor, type OptimizerInput, type OptimizerMetricId, type OptimizerProgress, type OptimizerResult } from '@shared/gear-calc/gear-optimize'
import { ATTRIBUTE_DISPLAY_NAME, computeGearAttributeTotals } from '@shared/gear-calc/attribute-totals'
import { formatBoonPercent } from '@shared/boon-calc/format'
import { useGameData } from '@renderer/state/game-data-store'
import { Modal } from '@renderer/components/common/Modal'
import type { GearOptimizerWorkerRequest, GearOptimizerWorkerResponse } from '@renderer/workers/gear-optimizer-protocol'

type FloorState = Partial<Record<OptimizerMetricId, number>>

const MAX_TIERS = 3

/** Row order for the "current vs proposed" gear comparison — same 9 core attributes the Stats
 *  panel's left column shows, in the same order, just keyed to `AttributeTotals.points` rather
 *  than `computeCharacterStats`'s richer (base+trait+gear) totals — see this file's own doc
 *  comment on why gear-only is the right comparison here. */
const COMPARE_ATTRIBUTES = Object.keys(ATTRIBUTE_DISPLAY_NAME)

function formatMetricValue(value: number, unit: 'points' | 'percent'): string {
  return unit === 'percent' ? `${formatBoonPercent(value)}%` : `${Math.round(value)}`
}

function metricLabel(id: OptimizerMetricId): string {
  return OPTIMIZER_METRICS.find((m) => m.id === id)?.label ?? id
}

/** "Tier 2/3: Critical Chance ≈ 47%" — shown while a search is running in place of a static
 *  "Optimizing…" spinner, from live incumbent updates the worker posts (see `OptimizerProgress`'s
 *  doc comment in gear-optimize.ts). The value is a live best-so-far, not necessarily final —
 *  hence "≈" rather than "=". */
function formatProgress(progress: OptimizerProgress): string {
  const unit = OPTIMIZER_METRICS.find((m) => m.id === progress.targetMetric)?.unit ?? 'points'
  const tierSuffix = progress.tierCount > 1 ? `Tier ${progress.tierIndex + 1}/${progress.tierCount}: ` : ''
  return `${tierSuffix}${metricLabel(progress.targetMetric)} ≈ ${formatMetricValue(progress.bestValue, unit)}`
}

interface Props {
  build: Build
  combatState: CombatState
  onApply: (patch: Pick<Build, 'equipment' | 'foodId' | 'utilityId'>) => void
  open: boolean
  onClose: () => void
}

/**
 * Opened from an inline button next to the Equipment column header (`BuildEditorView`, see
 * TODO.md) as a centered `Modal` rather than a nav view or an in-flow panel — it works directly
 * on the build currently being edited, reusing its weapon type/sigils/relic as fixed inputs (runes
 * and infusions become search variables too when their own toggle is on — otherwise they're fixed
 * inputs like sigils/relic always are) and the ambient `combatState` already shown in the Stats
 * panel (so Fury there and here always agree). "Apply" only patches the in-memory draft via
 * `onApply` — it never saves on its own, same as every other editor sub-panel; the user still hits
 * the main Save button when happy.
 *
 * Stays mounted (in `BuildEditorView`) even while `open` is false so its own controls/results
 * state survives being closed and reopened — only the `Modal` wrapper actually unmounts/hides.
 */
export function GearOptimizerPanel({ build, combatState, onApply, open, onClose }: Props) {
  const gameData = useGameData()
  const [floors, setFloors] = useState<FloorState>({})
  const [targets, setTargets] = useState<OptimizerMetricId[]>(['Power'])
  const [optimizeFoodUtility, setOptimizeFoodUtility] = useState(false)
  const [optimizeRunesInfusions, setOptimizeRunesInfusions] = useState(false)
  const [result, setResult] = useState<OptimizerResult | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<OptimizerProgress | null>(null)
  const [applied, setApplied] = useState(false)
  // Set on a worker startup/runtime failure (e.g. the worker script failing to load) — without
  // this, such a failure left `running` stuck `true` forever with no feedback at all: worker
  // construction failures fire an async 'error' event rather than throwing synchronously, and
  // nothing was listening for it before this.
  const [workerError, setWorkerError] = useState<string | null>(null)
  // The in-flight search's Web Worker (see gear-optimizer.worker.ts) — one instance per run, not
  // reused across runs, since `terminate()` (the cancel button's mechanism) kills it outright and
  // there's no cooperative-cancellation path into the middle of a synchronous DFS. Terminated on
  // completion, on cancel, and on unmount (below) so a closed-mid-search panel can't leak a worker
  // still burning CPU in the background.
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    return () => workerRef.current?.terminate()
  }, [])

  // Currently-equipped gear totals, recomputed whenever the draft or game data actually changes —
  // this is the "Current" column of the comparison table below, always live regardless of whether
  // a search has run yet.
  const currentTotals = useMemo(() => computeGearAttributeTotals(build, gameData), [build, gameData])
  // The proposed build's own totals — `result.build` is the source build with the result's picks
  // already applied (see `OptimizerResult.build`'s doc comment), so this is exactly what Apply
  // would produce. Only meaningful once a feasible result exists.
  const proposedTotals = useMemo(
    () => (result?.feasible ? computeGearAttributeTotals(result.build, gameData) : null),
    [result, gameData]
  )

  function setFloor(metric: OptimizerMetricId, raw: string): void {
    setFloors((prev) => {
      const next = { ...prev }
      const value = raw.trim() === '' ? null : Number(raw)
      if (value === null || Number.isNaN(value)) delete next[metric]
      else next[metric] = value
      return next
    })
  }

  function setTier(index: number, metric: OptimizerMetricId): void {
    setTargets((prev) => prev.map((t, i) => (i === index ? metric : t)))
  }

  function addTier(): void {
    const unused = OPTIMIZER_METRICS.map((m) => m.id).find((id) => !targets.includes(id))
    if (unused) setTargets((prev) => [...prev, unused])
  }

  function removeTier(index: number): void {
    setTargets((prev) => prev.filter((_, i) => i !== index))
  }

  function runOptimize(): void {
    // A previous run's worker should already be gone by the time a new one can start (the button
    // is disabled while `running`), but terminate defensively rather than leak two workers if that
    // ever stops being true.
    workerRef.current?.terminate()
    setRunning(true)
    setApplied(false)
    setProgress(null)
    setWorkerError(null)
    const floorList: OptimizerFloor[] = OPTIMIZER_METRICS.filter((m) => floors[m.id] != null).map((m) => ({
      metric: m.id,
      value: floors[m.id] as number
    }))
    const worker = new Worker(new URL('../../workers/gear-optimizer.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    // A failed/crashed worker (e.g. the script 404s, or optimizeGear throws) otherwise leaves
    // `running` stuck true forever with the panel silently doing nothing — surface it instead.
    function onWorkerFailure(detail: string): void {
      console.error('Gear Optimizer worker failed:', detail)
      setWorkerError(detail)
      setRunning(false)
      setProgress(null)
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
    }
    worker.onerror = (e) => onWorkerFailure(e.message || 'Worker error')
    worker.onmessageerror = () => onWorkerFailure('Worker sent an unclonable message')
    worker.onmessage = (e: MessageEvent<GearOptimizerWorkerResponse>) => {
      if (e.data.type === 'progress') {
        setProgress(e.data.progress)
        return
      }
      setResult(e.data.result)
      setRunning(false)
      setProgress(null)
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
    }
    // `useGameData()` returns the full `GameDataStore` — plain `GameData` fields plus several
    // `*ById` Maps and closures (`skillsForProfessionAndSlot` etc., see game-data-store.tsx).
    // `postMessage`'s structured clone can't serialize a function: passing `gameData` through
    // whole (as an earlier version of this code did) throws a synchronous `DataCloneError` right
    // here, before the worker ever receives anything — no progress, no error surfaced (that throw
    // happens on the sending side, not inside the worker, so `onerror`/`onmessageerror` above never
    // fire either), leaving `running` stuck `true` forever. Pulled down to exactly the plain-data
    // slice `OptimizerInput` declares instead.
    const optimizerGameData: OptimizerInput['gameData'] = {
      itemStats: gameData.itemStats,
      itemStatLegalIds: gameData.itemStatLegalIds,
      professions: gameData.professions,
      infusions: gameData.infusions,
      runes: gameData.runes,
      sigils: gameData.sigils,
      food: gameData.food,
      utility: gameData.utility,
      traits: gameData.traits,
      legends: gameData.legends
    }
    const request: GearOptimizerWorkerRequest = {
      input: { build, gameData: optimizerGameData, combatState, floors: floorList, targets, optimizeFoodUtility, optimizeRunesInfusions }
    }
    try {
      worker.postMessage(request)
    } catch (err) {
      // Safety net for any future case shaped like the one above (an unclonable value smuggled
      // into the payload) — without this, the same throw-before-any-handler-fires failure mode
      // would strike again with no visible symptom beyond a stuck spinner.
      onWorkerFailure(err instanceof Error ? err.message : String(err))
    }
  }

  function cancelOptimize(): void {
    workerRef.current?.terminate()
    workerRef.current = null
    setRunning(false)
    setProgress(null)
  }

  function applyResult(): void {
    if (!result?.feasible) return
    onApply({ equipment: result.build.equipment, foodId: result.foodId, utilityId: result.utilityId })
    setApplied(true)
  }

  return (
    <Modal open={open} onClose={onClose} className="optimizer-modal">
      <div className="modal-header">
        <h3>Gear Optimizer</h3>
        <button type="button" className="modal-close" onClick={onClose} title="Close">
          ×
        </button>
      </div>

      <p className="muted">
        Satisfy stat floors, then maximize stats in priority order — weapon type, sigils, and relic stay as you've
        set them here; Fury/Might/etc. use the Combat context toggles above.
      </p>

      <h4>Stat floors</h4>
      <p className="muted">Leave blank for no minimum.</p>
      <div className="optimizer-metric-grid">
        {OPTIMIZER_METRICS.map((m) => (
          <div className="optimizer-metric-row" key={m.id}>
            <label htmlFor={`floor-${m.id}`}>{m.label}</label>
            <input
              id={`floor-${m.id}`}
              type="number"
              value={floors[m.id] ?? ''}
              onChange={(e) => setFloor(m.id, e.target.value)}
              placeholder={m.unit === 'percent' ? '%' : 'pts'}
            />
          </div>
        ))}
      </div>

      <h4>Maximize (in priority order)</h4>
      <div className="optimizer-tier-list">
        {targets.map((t, i) => (
          <div className="optimizer-tier-row" key={i}>
            <span className="muted">#{i + 1}</span>
            <select value={t} onChange={(e) => setTier(i, e.target.value as OptimizerMetricId)}>
              {OPTIMIZER_METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {targets.length > 1 && (
              <button type="button" onClick={() => removeTier(i)} title="Remove tier">
                ×
              </button>
            )}
          </div>
        ))}
        {targets.length < MAX_TIERS && (
          <button type="button" onClick={addTier}>
            + Add tier
          </button>
        )}
      </div>

      <label className="optimizer-checkbox-row">
        <input type="checkbox" checked={optimizeFoodUtility} onChange={(e) => setOptimizeFoodUtility(e.target.checked)} />
        Also optimize food &amp; utility choice
      </label>

      <label className="optimizer-checkbox-row">
        <input
          type="checkbox"
          checked={optimizeRunesInfusions}
          onChange={(e) => setOptimizeRunesInfusions(e.target.checked)}
        />
        Also optimize rune &amp; infusion choice
      </label>

      <div className="optimizer-run-row">
        <button onClick={runOptimize} disabled={running}>
          {running ? 'Optimizing…' : 'Optimize'}
        </button>
        {running && (
          <button type="button" onClick={cancelOptimize}>
            Cancel
          </button>
        )}
        {running && progress && <span className="muted">{formatProgress(progress)}</span>}
      </div>

      {workerError && <p className="empty-state">Optimizer failed to run: {workerError}</p>}

      {result && (
        <div className="optimizer-result">
          {!result.feasible ? (
            <p className="empty-state">
              {result.infeasibleFloors.length > 0
                ? `Can't be satisfied even using every slot for it: ${result.infeasibleFloors.map(metricLabel).join(', ')}. Try lowering that floor.`
                : result.truncated
                  ? "Search ran out of time before finding a combination that satisfies every floor — that doesn't mean none exists. Try again (results aren't cached) or narrow the search (fewer floors, or turn off rune/infusion optimization) to let it finish."
                  : "Couldn't find a combination that satisfies every floor. Try lowering one or more floors."}
            </p>
          ) : (
            <>
              {result.truncated && (
                <p className="muted">Search was cut off before proving optimality — this is the best found so far.</p>
              )}
              <div className="optimizer-metric-grid">
                {OPTIMIZER_METRICS.filter((m) => result.metricValues[m.id] !== undefined).map((m) => (
                  <div className="optimizer-metric-row" key={m.id}>
                    <span>
                      {m.label}
                      {targets.includes(m.id) && ` (#${targets.indexOf(m.id) + 1} priority)`}
                      {floors[m.id] != null && ` (floor ${formatMetricValue(floors[m.id] as number, m.unit)})`}
                    </span>
                    <strong>{formatMetricValue(result.metricValues[m.id] as number, m.unit)}</strong>
                  </div>
                ))}
              </div>

              {proposedTotals && (
                <div className="optimizer-compare">
                  <h4>Current vs. proposed</h4>
                  <div className="optimizer-compare-grid">
                    <span className="optimizer-compare-head">Stat</span>
                    <span className="optimizer-compare-head optimizer-compare-num">Current</span>
                    <span className="optimizer-compare-head optimizer-compare-num">Proposed</span>
                    <span className="optimizer-compare-head optimizer-compare-num">Δ</span>
                    {COMPARE_ATTRIBUTES.map((attr) => {
                      const current = Math.round(currentTotals.points[attr] ?? 0)
                      const proposed = Math.round(proposedTotals.points[attr] ?? 0)
                      const delta = proposed - current
                      const deltaClass =
                        delta > 0 ? 'optimizer-compare-num optimizer-compare-delta-up'
                        : delta < 0 ? 'optimizer-compare-num optimizer-compare-delta-down'
                        : 'optimizer-compare-num'
                      return (
                        <Fragment key={attr}>
                          <span>{ATTRIBUTE_DISPLAY_NAME[attr]}</span>
                          <span className="optimizer-compare-num">{current}</span>
                          <span className="optimizer-compare-num">{proposed}</span>
                          <span className={deltaClass}>{delta > 0 ? `+${delta}` : delta}</span>
                        </Fragment>
                      )
                    })}
                  </div>
                </div>
              )}

              <h4>Gear</h4>
              <ul className="optimizer-slot-list">
                {result.slots
                  // An empty infusion slot (chosen "None") isn't worth a row of its own — up to
                  // ~18 individual infusion slots get searched when optimizeRunesInfusions is
                  // on, and most builds only fill a handful of them.
                  .filter((s) => s.kind !== 'infusion' || s.chosenId !== null)
                  .map((s) => (
                    <li key={s.label}>
                      <span className="muted">{s.label}</span>
                      <span>{s.chosenLabel}</span>
                    </li>
                  ))}
              </ul>

              <div className="optimizer-run-row">
                <button onClick={applyResult}>Apply to build</button>
                {applied && <span className="muted">Applied — remember to Save.</span>}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
