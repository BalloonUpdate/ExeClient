import { BrowserWindow } from "electron";

export class UpdaterIPC
{
    win: BrowserWindow

    constructor(win: BrowserWindow)
    {
        this.win = win
    }
    
    dispatchEvent(eventName: any, ...argv: any[])
    {
        this.win.webContents.send('updater-event', eventName, ...argv)
    }
}