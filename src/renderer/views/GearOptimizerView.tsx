import { useMemo, useState } from 'react'
import { DEFAULT_COMBAT_STATE, type CombatState } from '@shared/gear-calc/combat-state'
import { computeCharacterStats } from '@shared/gear-calc/derived-stats'
import { OPTIMIZER_METRICS, optimizeGear, type OptimizerFloor, type OptimizerMetricId, type OptimizerResult } from '@shared/gear-calc/gear-optimize'
import { formatBoonPercent } from '@shared/boon-calc/format'
import { useBuildsStore } from '@renderer/state/builds-store'
import { useGameData } from '@renderer/state/game-data-store'
import { CombatStatePanel } from '@renderer/components/build-editor/CombatStatePanel'

type FloorState = Partial<Record<OptimizerMetricId, number>>

function formatMetricValue(value: number, unit: 'points' | 'percent'): string {
  return unit === 'percent' ? `${formatBoonPercent(value)}%` : `${Math.round(value)}`
}

/**
 * Net-new "Gear Optimizer" view (see TODO.md): pick one of your saved builds, set stat floors and
 * a secondary stat to maximize with whatever gear budget is left, and get a full per-slot stat-combo
 * assignment back — reusing the same attribute math `StatsPanel` uses (`gear-optimize.ts`) so the
 * preview here is exactly what applying the result would produce. Weapon types, runes, sigils, and
 * the relic are always treated as fixed (the build's current picks); food/utility are fixed unless
 * "Also optimize food & utility" is checked.
 */
export function GearOptimizerView() {
  const { builds, updateBuild } = useBuildsStore()
  const gameData = useGameData()
  const { professions } = gameData

  const [buildId, setBuildId] = useState<string | null>(null)
  const [floors, setFloors] = useState<FloorState>({})
  const [target, setTarget] = useState<OptimizerMetricId>('Power')
  const [optimizeFoodUtility, setOptimizeFoodUtility] = useState(false)
  const [combatState, setCombatState] = useState<CombatState>(DEFAULT_COMBAT_STATE)
  const [result, setResult] = useState<OptimizerResult | null>(null)
  const [running, setRunning] = useState(false)
  const [applied, setApplied] = useState(false)

  const build = builds.find((b) => b.id === buildId) ?? null

  function selectBuild(id: string): void {
    setBuildId(id || null)
    setResult(null)
    setApplied(false)
    setCombatState(DEFAULT_COMBAT_STATE)
  }

  function setFloor(metric: OptimizerMetricId, raw: string): void {
    setFloors((prev) => {
      const next = { ...prev }
      const value = raw.trim() === '' ? null : Number(raw)
      if (value === null || Number.isNaN(value)) delete next[metric]
      else next[metric] = value
      return next
    })
  }

  function runOptimize(): void {
    if (!build) return
    setRunning(true)
    setApplied(false)
    const floorList: OptimizerFloor[] = OPTIMIZER_METRICS.filter((m) => floors[m.id] != null).map((m) => ({
      metric: m.id,
      value: floors[m.id] as number
    }))
    // Deferred to the next tick so "Optimizing…" actually paints before the (synchronous) search
    // runs — the search is bounded (see gear-optimize.ts's NODE_LIMIT) but can still take a beat.
    setTimeout(() => {
      setResult(optimizeGear({ build, gameData, combatState, floors: floorList, target, optimizeFoodUtility }))
      setRunning(false)
    }, 0)
  }

  async function applyToBuild(): Promise<void> {
    if (!result?.feasible) return
    await updateBuild({ ...result.build, updatedAt: new Date().toISOString() })
    setApplied(true)
  }

  const previewStats = useMemo(() => {
    if (!result?.feasible) return null
    return computeCharacterStats(result.build, gameData, combatState)
  }, [result, gameData, combatState])

  return (
    <section>
      <div className="view-header">
        <h2>Gear Optimizer</h2>
      </div>

      <div className="settings-panel">
        <h3>Build</h3>
        {builds.length === 0 ? (
          <p className="empty-state">No saved builds yet — create one on the Builds tab first.</p>
        ) : (
          <select value={buildId ?? ''} onChange={(e) => selectBuild(e.target.value)}>
            <option value="">Choose a build…</option>
            {builds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({professions.find((p) => p.id === b.profession)?.name ?? b.profession})
              </option>
            ))}
          </select>
        )}
      </div>

      {build && (
        <>
          <div className="settings-panel settings-panel-spaced optimizer-panel-wide">
            <h3>Stat floors</h3>
            <p className="muted">
              Leave blank for no minimum. Values are in the same unit shown on the build's Stats panel (raw points, or %
              for Boon/Condition Duration, Magic Find, and Critical Chance).
            </p>
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
          </div>

          <div className="settings-panel settings-panel-spaced">
            <h3>Maximize</h3>
            <select value={target} onChange={(e) => setTarget(e.target.value as OptimizerMetricId)}>
              {OPTIMIZER_METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-panel settings-panel-spaced">
            <h3>Combat context</h3>
            <p className="muted">Affects Critical Chance (Fury) and any Might/stacking-sigil floors.</p>
            <CombatStatePanel build={build} value={combatState} onChange={setCombatState} />
          </div>

          <div className="settings-panel settings-panel-spaced">
            <label className="optimizer-checkbox-row">
              <input type="checkbox" checked={optimizeFoodUtility} onChange={(e) => setOptimizeFoodUtility(e.target.checked)} />
              Also optimize food &amp; utility choice
            </label>
          </div>

          <div className="optimizer-run-row">
            <button onClick={runOptimize} disabled={running}>
              {running ? 'Optimizing…' : 'Optimize'}
            </button>
          </div>

          {result && (
            <div className="settings-panel settings-panel-spaced optimizer-panel-wide">
              <h3>Result</h3>
              {!result.feasible ? (
                <p className="empty-state">
                  {result.infeasibleFloors.length > 0
                    ? `Can't be satisfied even using every slot for it: ${result.infeasibleFloors
                        .map((id) => OPTIMIZER_METRICS.find((m) => m.id === id)?.label ?? id)
                        .join(', ')}. Try lowering that floor.`
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
                          {m.id === target && ' (maximized)'}
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

                  {previewStats && (
                    <p className="muted">
                      Health {Math.round(previewStats.derived.health)} · Armor {Math.round(previewStats.derived.armor)} · Critical
                      Chance {formatBoonPercent(previewStats.derived.criticalChance)}%
                    </p>
                  )}

                  <div className="optimizer-run-row">
                    <button onClick={() => void applyToBuild()}>Apply to "{build.name}"</button>
                    {applied && <span className="muted">Applied.</span>}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
