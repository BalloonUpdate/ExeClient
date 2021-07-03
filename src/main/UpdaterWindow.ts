import { app, BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { FileObject } from "./utils/FileObject";
import { LogSys } from "./LogSys";
import { Updater } from "./Updater";
import child_process = require('child_process')
import iconv = require('iconv-lite');

export class UpdaterWindow
{
    updater: Updater
    win = null as unknown as BrowserWindow

    onAllClosed = () => { app.quit() }

    constructor(updater: Updater)
    {
        this.updater = updater
    }

    async create(width: number, height: number)
    {
        await new Promise((a, b) => {
            let cre = () => {
                this.createWindow(width, height)
                a(undefined)    
            }

            app.isReady()? cre():app.on('ready', () => cre())
            
            app.on('window-all-closed', () => {
                if (process.platform !== 'darwin') 
                    this.onAllClosed()
            })
        })

        // 处理事件/回调
        this.on('start-update', async (event, arg) => {
            LogSys.info('Start To Update')
            // 开始更新
            this.updater.startUpdate().catch((e) => {
                LogSys.info('+--+--+--+--+--+--+--+--+--+--+--+')
                // LogSys.error(e)
                LogSys.error(e.stack)
                this.updater.dispatchEvent('on_error', e.name, e.message, e.stack)
                this.updater.exitcode = 1
            })
        })
        this.on('set-fullscreen', (event, isFullscreen: boolean) => {
            LogSys.debug('Set-Fullscreen: ' + isFullscreen)
            this.win.setFullScreen(isFullscreen)
        })
        this.on('set-size', (event, width, height) => {
            this.win.setSize(width, height)
        })
        this.on('move-center', (event) => {
            this.win.center()
        })
        this.on('set-minimize', (event) => {
            this.win.minimize()
        })
        this.on('set-maximize', (event) => {
            this.win.maximize()
        })
        this.on('set-restore', (event) => {
            this.win.restore()
        })
        this.handle('run-shell', async (event, shell: string) => {
            return await new Promise((a, b) => {
                child_process.exec(shell, {
                    encoding: 'gbk' as any
                }, (err, stdout, stderr) => {
                    let std_out = iconv.decode(stdout, 'gbk')
                    let std_err = iconv.decode(stderr, 'gbk')
                    LogSys.info('----------')
                    LogSys.info('Execute: '+shell)
                    if (err)
                    {
                        LogSys.info('-----ERROR-----')
                        LogSys.error(err);
                    }
                    LogSys.info('-----STDOUT-----')
                    LogSys.info(std_out);
                    LogSys.info('-----STDERR-----')
                    LogSys.info(std_err);
                    a([ err, std_out, std_err ])
                })
            })
        })
        this.handle('get-work-dir', async (event) => {
            return this.updater.workdir.path
        })
    }

    private createWindow(width = 900, height = 600)
    {
        this.win = new BrowserWindow({
            width: width,
            height: height,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        })

        if(app.isPackaged)
            this.win.setMenuBarVisibility(false)
    }

    handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<void>|any)
    {
        ipcMain.handle(channel, listener)
    }

    on(eventName: string, callback: (event: IpcMainEvent, ...args: any[]) => void)
    {
        ipcMain.on(eventName, callback)
    }

    send(channel: string, ...args: any[])
    {
        this.win.webContents.send(channel, ...args)
    }

    async loadFile(indexhtml: FileObject)
    {
        this.win.loadFile(indexhtml.path)
        await new Promise((a, b) => {
            this.win.webContents.once('dom-ready', () => {
                a(undefined)
            })
        })
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

    close()
    {
        this.win.close()
    }
    
}