import { app, BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import { FileObject } from "./utils/FileObject";

export class UpdaterWindow
{
    win = null as unknown as BrowserWindow

    constructor()
    {
        
    }

    async create()
    {
        await new Promise((a, b) => {
            if(app.isReady())
            {
                this.createWindow()
                a(undefined)
            } else {
                app.on('ready', () => {
                    this.createWindow()
                    a(undefined)
                })
            }
            
            app.on('window-all-closed', function () {
                if (process.platform !== 'darwin') app.quit()
            })
        })
    }

    private createWindow()
    {
        this.win = new BrowserWindow({
            width: 900,
            height: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        })
    }

    on(eventName: string, callback: (event: IpcMainEvent, ...args: any[]) => void)
    {
        ipcMain.on(eventName, callback)
    }

    send(channel: string, ...args: any[])
    {
        this.win.webContents.send(channel, ...args)
    }

    loadFile(indexhtml: FileObject)
    {
        this.win.loadFile(indexhtml.path)
    }

    setWindowIcon(icon: FileObject)
    {
        // 设置窗口图标
        (async (a, b) => {
            if(await icon.exists() && await icon.isFile())
                this.win.setIcon(icon.path)
        })()
    }

    openDevTools()
    {
        this.win.webContents.openDevTools()
    }

    quit()
    {
        app.quit()
    }
    
}