import { useState } from 'react'
import type { UseSyncReturn } from '@renderer/hooks/useSync'

interface Props {
  syncState: UseSyncReturn
}

const STATUS_LABEL: Record<UseSyncReturn['status'], string> = {
  'signed-out': 'Not signed in',
  idle: 'Up to date',
  syncing: 'Syncing…',
  error: "Couldn't reach the sync server"
}

/**
 * Sign-up/sign-in/sign-out UI for `SettingsView`, mirroring ChoiceBuds'
 * `src/renderer/components/SyncSection.tsx` (same form shape, this app's plain-CSS conventions
 * instead of Tailwind). Account stays optional — `useSync`'s own triggers already run in the
 * background from launch regardless of whether this panel is ever opened; this is just the
 * sign-up/log-in surface and a manual "Sync Now" fallback. Renders nothing when no sync Worker is
 * configured for this build (see `UseSyncReturn.configured`'s doc comment).
 */
export function SyncSection({ syncState }: Props) {
  const { configured, syncUsername, lastSyncedAt, status, error, signUp, logIn, logOut, syncNow } = syncState

  const [signupUsername, setSignupUsername] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (!configured) return null

  async function handleSignUp(): Promise<void> {
    setFormError(null)
    if (signupPassword !== signupPasswordConfirm) {
      setFormError('Passwords do not match')
      return
    }
    const result = await signUp(signupUsername, signupPassword)
    if (!result.ok) {
      setFormError(result.message)
      return
    }
    setSignupUsername('')
    setSignupPassword('')
    setSignupPasswordConfirm('')
  }

  async function handleLogIn(): Promise<void> {
    setFormError(null)
    const result = await logIn(loginUsername, loginPassword)
    if (!result.ok) {
      setFormError(result.message)
      return
    }
    setLoginUsername('')
    setLoginPassword('')
  }

  return (
    <div className="settings-panel">
      <h3>Cross-Device Sync</h3>
      <p className="muted">
        Your builds and squad comps sync automatically to your own sync server in the background.
        "Sync Now" below is a manual fallback.
      </p>

      {!syncUsername ? (
        <div className="sync-forms">
          <div className="sync-form">
            <h4>Sign up</h4>
            <div className="field">
              <span>Username</span>
              <input type="text" value={signupUsername} onChange={(e) => setSignupUsername(e.target.value)} />
            </div>
            <div className="field">
              <span>Password (min 8 characters)</span>
              <input
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <span>Confirm password</span>
              <input
                type="password"
                value={signupPasswordConfirm}
                onChange={(e) => setSignupPasswordConfirm(e.target.value)}
              />
            </div>
            <button type="button" onClick={() => void handleSignUp()} disabled={!signupUsername.trim() || !signupPassword}>
              Sign up
            </button>
          </div>

          <div className="sync-form">
            <h4>Or log in on this device</h4>
            <div className="field">
              <span>Username</span>
              <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
            </div>
            <div className="field">
              <span>Password</span>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </div>
            <button type="button" onClick={() => void handleLogIn()} disabled={!loginUsername.trim() || !loginPassword}>
              Log in
            </button>
          </div>
        </div>
      ) : (
        <div className="sync-signed-in">
          <div className="settings-update-row">
            <p>
              Signed in as <strong>{syncUsername}</strong>
            </p>
            <button type="button" onClick={() => void logOut()}>
              Log out
            </button>
          </div>

          <p className={status === 'idle' ? 'sync-status-ok' : status === 'error' ? 'error-text' : 'muted'}>
            {STATUS_LABEL[status]}
          </p>

          <button type="button" onClick={() => void syncNow()} disabled={status === 'syncing'}>
            {status === 'syncing' ? 'Syncing…' : 'Sync Now'}
          </button>

          {lastSyncedAt && <p className="muted">Last synced: {new Date(lastSyncedAt).toLocaleString()}</p>}
        </div>
      )}

      {(formError || error) && <p className="error-text">{formError ?? error}</p>}
    </div>
  )
}
