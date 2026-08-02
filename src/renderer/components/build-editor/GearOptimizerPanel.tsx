import { useState } from 'react'
import type { Build } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { OPTIMIZER_METRICS, optimizeGear, type OptimizerFloor, type OptimizerMetricId, type OptimizerResult } from '@shared/gear-calc/gear-optimize'
import { formatBoonPercent } from '@shared/boon-calc/format'
import { useGameData } from '@renderer/state/game-data-store'

type FloorState = Partial<Record<OptimizerMetricId, number>>

const MAX_TIERS = 3

function formatMetricValue(value: number, unit: 'points' | 'percent'): string {
  return unit === 'percent' ? `${formatBoonPercent(value)}%` : `${Math.round(value)}`
}

function metricLabel(id: OptimizerMetricId): string {
  return OPTIMIZER_METRICS.find((m) => m.id === id)?.label ?? id
}

interface Props {
  build: Build
  combatState: CombatState
  onApply: (patch: Pick<Build, 'equipment' | 'foodId' | 'utilityId'>) => void
}

/**
 * Embedded in `BuildEditorView` (not a separate nav view — see TODO.md): works directly on the
 * build currently being edited, reusing its weapon types/runes/sigils/relic as fixed inputs and
 * the ambient `combatState` already shown in the Stats panel (so Fury there and here always
 * agree). "Apply" only patches the in-memory draft via `onApply` — it never saves on its own, same
 * as every other editor sub-panel; the user still hits the main Save button when happy.
 */
export function GearOptimizerPanel({ build, combatState, onApply }: Props) {
  const gameData = useGameData()
  const [open, setOpen] = useState(false)
  const [floors, setFloors] = useState<FloorState>({})
  const [targets, setTargets] = useState<OptimizerMetricId[]>(['Power'])
  const [optimizeFoodUtility, setOptimizeFoodUtility] = useState(false)
  const [result, setResult] = useState<OptimizerResult | null>(null)
  const [running, setRunning] = useState(false)
  const [applied, setApplied] = useState(false)

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
    setRunning(true)
    setApplied(false)
    const floorList: OptimizerFloor[] = OPTIMIZER_METRICS.filter((m) => floors[m.id] != null).map((m) => ({
      metric: m.id,
      value: floors[m.id] as number
    }))
    // Deferred to the next tick so "Optimizing…" actually paints before the (synchronous) search
    // runs — bounded (see gear-optimize.ts's NODE_LIMIT) but can still take a beat, especially with
    // 2-3 maximize tiers.
    setTimeout(() => {
      setResult(optimizeGear({ build, gameData, combatState, floors: floorList, targets, optimizeFoodUtility }))
      setRunning(false)
    }, 0)
  }

  function applyResult(): void {
    if (!result?.feasible) return
    onApply({ equipment: result.build.equipment, foodId: result.foodId, utilityId: result.utilityId })
    setApplied(true)
  }

  return (
    <div className="settings-panel optimizer-panel-wide">
      <button type="button" className="optimizer-toggle" onClick={() => setOpen((v) => !v)}>
        <h3>Gear Optimizer {open ? '▾' : '▸'}</h3>
      </button>

      {open && (
        <>
          <p className="muted">
            Satisfy stat floors, then maximize stats in priority order — weapon type, runes, sigils, and relic stay as
            you've set them here; Fury/Might/etc. use the Combat context toggles above.
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

          <div className="optimizer-run-row">
            <button onClick={runOptimize} disabled={running}>
              {running ? 'Optimizing…' : 'Optimize'}
            </button>
          </div>

          {result && (
            <div className="optimizer-result">
              {!result.feasible ? (
                <p className="empty-state">
                  {result.infeasibleFloors.length > 0
                    ? `Can't be satisfied even using every slot for it: ${result.infeasibleFloors.map(metricLabel).join(', ')}. Try lowering that floor.`
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

                  <h4>Gear</h4>
                  <ul className="optimizer-slot-list">
                    {result.slots.map((s) => (
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
        </>
      )}
    </div>
  )
}
