import { useState } from 'react'
import type { Build, GameData } from '@shared/types'
import { encodeBuildTemplate } from '@shared/chat-link/build-template-codec'

interface Props {
  build: Build
  gameData: GameData
}

type Status = 'idle' | 'done' | 'error'

/**
 * Copies the current build's official GW2 "Build Template" chat link (`[&D...]`, traits + skills
 * only — see `build-template-codec.ts`'s doc comment for exactly what is and isn't covered)
 * straight to the OS clipboard, mirroring `ScreenshotButton`/`SharePanel`'s "just do the one
 * thing, the label reports progress" pattern. Fully local/offline (no `worker/` backend involved,
 * unlike `SharePanel`) — encoding is synchronous, so there's no `busy` state.
 */
export function CopyBuildTemplateButton({ build, gameData }: Props) {
  const [status, setStatus] = useState<Status>('idle')

  async function handleClick(): Promise<void> {
    try {
      const { code } = encodeBuildTemplate(build, gameData)
      await navigator.clipboard.writeText(code)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2500)
    }
  }

  return (
    <button type="button" onClick={() => void handleClick()} title="Copy an official GW2 build-template chat link (traits + skills)">
      {status === 'done' ? 'Copied!' : status === 'error' ? 'Failed — try again' : 'Copy Build Template'}
    </button>
  )
}
