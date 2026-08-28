import { ipcMain, clipboard, nativeImage, type IpcMainInvokeEvent } from 'electron'
import { CaptureIpcChannel } from '@shared/capture/ipc-channels'
import type { BuildScreenshotPayload, SquadScreenshotPayload } from '@shared/capture/capture-provider'
import { captureBuildScreenshot, captureSquadScreenshot, getPendingPayload, signalReady } from '../capture/offscreen-capture'

/** Wires the `CaptureProvider` IPC surface to `offscreen-capture.ts` — see that module's doc
 *  comment for the actual "render offscreen, then screenshot it" mechanics. */
export function registerCaptureIpc(): void {
  ipcMain.handle(CaptureIpcChannel.buildScreenshot, async (_event: IpcMainInvokeEvent, { build, combatState }: BuildScreenshotPayload) => {
    const png = await captureBuildScreenshot(build, combatState)
    clipboard.writeImage(nativeImage.createFromBuffer(png))
  })

  ipcMain.handle(CaptureIpcChannel.squadScreenshot, async (_event: IpcMainInvokeEvent, { squadComp }: SquadScreenshotPayload) => {
    const png = await captureSquadScreenshot(squadComp)
    clipboard.writeImage(nativeImage.createFromBuffer(png))
  })

  ipcMain.handle(CaptureIpcChannel.getPayload, (_event: IpcMainInvokeEvent, token: string) => {
    return getPendingPayload(token)
  })

  ipcMain.handle(CaptureIpcChannel.signalReady, (_event: IpcMainInvokeEvent, token: string) => {
    signalReady(token)
  })
}
