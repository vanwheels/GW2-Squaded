import { useBuildsStore } from '@renderer/state/builds-store'

export function BuildsView() {
  const { builds, loading, createDummyBuild, removeBuild } = useBuildsStore()

  return (
    <section>
      <div className="view-header">
        <h2>Builds</h2>
        <button onClick={() => void createDummyBuild()}>+ Create dummy build</button>
      </div>

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : builds.length === 0 ? (
        <p className="empty-state">
          No saved builds yet. Click "Create dummy build" to verify the SQLite storage round trip.
        </p>
      ) : (
        <ul className="record-list">
          {builds.map((build) => (
            <li key={build.id}>
              <div>
                <strong>{build.name}</strong>
                <span className="muted"> — {build.profession}</span>
              </div>
              <button onClick={() => void removeBuild(build.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
