import { ipcMain, clipboard, type IpcMainInvokeEvent } from 'electron'
import { CaptureIpcChannel } from '@shared/capture/ipc-channels'
import type { CaptureRect } from '@shared/capture/capture-provider'

export function registerCaptureIpc(): void {
  ipcMain.handle(CaptureIpcChannel.captureRegion, async (event: IpcMainInvokeEvent, rect: CaptureRect) => {
    const image = await event.sender.capturePage(rect)
    clipboard.writeImage(image)
  })
}
