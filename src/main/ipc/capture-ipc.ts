import { ipcMain, clipboard, nativeImage, type IpcMainInvokeEvent } from 'electron'
import { CaptureIpcChannel } from '@shared/capture/ipc-channels'
import type { CaptureRect } from '@shared/capture/capture-provider'

export function registerCaptureIpc(): void {
  ipcMain.handle(CaptureIpcChannel.captureRegion, async (event: IpcMainInvokeEvent, rect: CaptureRect) => {
    const image = await event.sender.capturePage(rect)
    clipboard.writeImage(image)
  })

  ipcMain.handle(CaptureIpcChannel.captureRegionToDataUrl, async (event: IpcMainInvokeEvent, rect: CaptureRect) => {
    const image = await event.sender.capturePage(rect)
    return image.toDataURL()
  })

  ipcMain.handle(CaptureIpcChannel.writeImageDataUrl, async (_event: IpcMainInvokeEvent, dataUrl: string) => {
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl))
  })
}
