/**
 * Placeholder for the boon/condition uptime calculator (see TODO.md). Planned shape,
 * per-build: for each boon/condition the build can produce, list every source
 * (skill/trait) with its computed duration (base duration scaled by concentration/boon
 * duration stat and food/utility consumables, once those are modeled). A later
 * squad-view mode extends this to all 5 party sources at once with an estimated
 * combined uptime.
 */
export function BoonUptimePanel() {
  return (
    <div className="boon-uptime-panel">
      <h3>Boon &amp; Condition Uptime</h3>
      <p className="empty-state">
        Coming soon — will list every boon/condition source this build provides (skills and
        traits), with duration computed from base values, boon duration/concentration, and
        consumables.
      </p>
    </div>
  )
}
