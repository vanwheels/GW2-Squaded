import { useRef } from 'react'
import type { ProfessionId, TraitLineSlots } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { FloatingPanel } from '@renderer/components/common/FloatingPanel'
import { usePickerOpen } from '@renderer/state/picker-registry'

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
 * Collapsed-by-default profession + elite-specialization picker (2026-08-19): the row of
 * profession portraits plus the full elite-spec grid below it used to be always-expanded, eating a
 * large fixed chunk of vertical space above Traits regardless of whether it was actually being
 * used — same problem `ProfessionTagPicker` solved for the Builds-page filter bar (2026-08-18),
 * reusing the identical `FloatingPanel`/`usePickerOpen` popover mechanism. Unlike that filter
 * (multi-select, stays open across picks, text-label trigger since "any number selected" has no
 * single icon to show), this is single-select: the trigger shows one icon for the current pick —
 * the elite spec's icon if one's equipped, else the Core profession's portrait, borderless/no text
 * label (2026-08-19 user feedback: a circle outline read as clunky next to the bare weapon-type
 * badges it now shares `editor-profession-weapon-bar` with) — and choosing any option closes the
 * popover immediately, matching every other "single button opens an overlay, picking closes it"
 * picker in this editor (see `WeaponTypeBar`).
 *
 * Still resolves a profession+elite-spec pick in one click same as before (see class doc comment
 * history): clicking any elite-spec icon switches to its owning profession AND equips that spec;
 * clicking a profession portrait switches to that profession at Core.
 */
export function ProfessionSpecPicker({ profession, specializations, onChoose }: Props) {
  const { professions, specializations: allSpecializations } = useGameData()
  const { open, openThis, close } = usePickerOpen()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const currentEliteSpecId = specializations[ELITE_LINE_INDEX]?.specializationId ?? null

  const eliteSpecsByProfession = new Map<ProfessionId, typeof allSpecializations>()
  for (const s of allSpecializations) {
    if (!s.elite) continue
    const list = eliteSpecsByProfession.get(s.profession) ?? []
    list.push(s)
    eliteSpecsByProfession.set(s.profession, list)
  }
  for (const list of eliteSpecsByProfession.values()) list.sort((a, b) => a.id - b.id)

  const currentSpec = currentEliteSpecId !== null ? allSpecializations.find((s) => s.id === currentEliteSpecId) : undefined
  const currentProfession = professions.find((p) => p.id === profession)
  const triggerIcon = currentSpec?.tangoIcon ?? currentProfession?.tangoIcon
  const triggerName = currentSpec?.name ?? currentProfession?.name ?? 'Profession'

  function choose(chosenProfession: ProfessionId, eliteSpecializationId: number | null): void {
    onChoose(chosenProfession, eliteSpecializationId)
    close()
  }

  return (
    <div className="profession-picker-root">
      <Tooltip content={<TooltipBody title={triggerName} description="Click to change profession or elite specialization" />}>
        <button
          ref={buttonRef}
          type="button"
          className={open ? 'profession-picker-trigger open' : 'profession-picker-trigger'}
          style={triggerIcon ? { backgroundImage: `url(${triggerIcon})` } : undefined}
          onClick={() => (open ? close() : openThis())}
        />
      </Tooltip>
      <FloatingPanel open={open} anchorRef={buttonRef} onClose={close} className="skill-picker">
        <div className="skill-picker-header">Profession</div>
        <div className="profession-picker-row">
          {professions.map((p) => (
            <Tooltip key={p.id} content={<TooltipBody title={p.name} description="Core (no elite specialization)" />}>
              <button
                type="button"
                className={p.id === profession && currentEliteSpecId === null ? 'spec-icon-button chosen' : 'spec-icon-button'}
                style={{ backgroundImage: `url(${p.tangoIcon})` }}
                onClick={() => choose(p.id, null)}
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
                  onClick={() => choose(s.profession, s.id)}
                />
              </Tooltip>
            ))
          )}
        </div>
      </FloatingPanel>
    </div>
  )
}
