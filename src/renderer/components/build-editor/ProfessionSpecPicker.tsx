import type { ProfessionId, TraitLineSlots } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'

interface Props {
  profession: ProfessionId
  specializations: TraitLineSlots
  /** `eliteSpecializationId: null` when a profession-row icon is clicked (switch to that
   *  profession at Core) or when the elite line is explicitly cleared. */
  onChoose: (profession: ProfessionId, eliteSpecializationId: number | null) => void
}

/** The elite spec line is always the 3rd trait line, by GW2 convention. */
const ELITE_LINE_INDEX = 2

/**
 * Single-click profession + elite-specialization picker (gw2skills.net reference layout): a row of
 * profession portraits, then every elite specialization across every profession in a grid below,
 * column-aligned under its owning profession's portrait (row = release order — HoT/PoF/EoD/Janthir
 * Wilds, ascending `Specialization.id` within a profession matches release order, confirmed via
 * data/game-data/specializations.json). Replaces the old 2-step `ProfessionSelect` +
 * `EliteSpecSelect` flow (pick profession, THEN separately pick its elite spec — 2 clicks to land on
 * a different profession's elite spec) — here, clicking any elite-spec icon switches to its owning
 * profession AND equips that spec in one click, since each elite spec icon uniquely identifies both.
 * Clicking a profession portrait instead switches to that profession at Core (no elite spec).
 */
export function ProfessionSpecPicker({ profession, specializations, onChoose }: Props) {
  const { professions, specializations: allSpecializations } = useGameData()
  const currentEliteSpecId = specializations[ELITE_LINE_INDEX]?.specializationId ?? null

  const eliteSpecsByProfession = new Map<ProfessionId, typeof allSpecializations>()
  for (const s of allSpecializations) {
    if (!s.elite) continue
    const list = eliteSpecsByProfession.get(s.profession) ?? []
    list.push(s)
    eliteSpecsByProfession.set(s.profession, list)
  }
  for (const list of eliteSpecsByProfession.values()) list.sort((a, b) => a.id - b.id)

  return (
    <div className="field">
      <span>Profession</span>
      <div className="profession-picker-row">
        {professions.map((p) => (
          <Tooltip key={p.id} content={<TooltipBody title={p.name} description="Core (no elite specialization)" />}>
            <button
              type="button"
              className={p.id === profession && currentEliteSpecId === null ? 'spec-icon-button chosen' : 'spec-icon-button'}
              style={{ backgroundImage: `url(${p.tangoIcon})` }}
              onClick={() => onChoose(p.id, null)}
            />
          </Tooltip>
        ))}
      </div>
      <div className="elite-spec-picker-grid" style={{ gridTemplateColumns: `repeat(${professions.length}, 36px)` }}>
        {professions.flatMap((p, colIndex) =>
          (eliteSpecsByProfession.get(p.id) ?? []).map((s, rowIndex) => (
            <Tooltip
              key={s.id}
              content={<TooltipBody title={s.name} />}
              style={{ gridColumn: colIndex + 1, gridRow: rowIndex + 1 }}
            >
              <button
                type="button"
                className={s.id === currentEliteSpecId ? 'spec-icon-button chosen' : 'spec-icon-button'}
                style={{ backgroundImage: `url(${s.tangoIcon})` }}
                onClick={() => onChoose(s.profession, s.id)}
              />
            </Tooltip>
          ))
        )}
      </div>
    </div>
  )
}
