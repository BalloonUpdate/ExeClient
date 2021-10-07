import { app, BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { FileObject } from "./utils/FileObject";
import { LogSys } from "./logging/LogSys";
import { Updater } from "./Updater";
import child_process = require('child_process')
import iconv = require('iconv-lite');
import path = require('path')
import strReplace from './utils/StringReplace'
import StackShorten from "./utils/StackShorten";
const packagejson = require('../../package.json')

export class UpdaterWindow
{
    updater: Updater
    win = null as unknown as BrowserWindow

    onAllClosed = () => { app.quit() }

    private processes: child_process.ChildProcess[] = []

    constructor(updater: Updater)
    {
        this.updater = updater
    }

    private registerProcess(p: child_process.ChildProcess)
    {
        LogSys.info('New Process: pid('+p.pid+')')

        this.processes.push(p)
        p.on('close', (code, signal) => {
            let idx = this.processes.indexOf(p)
            if(idx != -1)
                this.processes.splice(idx, 1)

            LogSys.info(`ProcessEnd: pid(${p.pid}), active(${this.processes.length})`)

            // if(this.processes.length == 0)
            //     this.onAllClosed()
        })
    }

    async create(width: number, height: number): Promise<void>
    {
        await new Promise((a, b) => {
            let cre = () => {
                this.createWindow(width, height)
                a(undefined)    
            }

            app.isReady()? cre():app.on('ready', () => cre())
            
            app.on('window-all-closed', () => {
                if (process.platform !== 'darwin') 
                    if(this.processes.length == 0)
                        this.onAllClosed()
            })
        })

        // 处理事件/回调
        this.on('start-update', async (event, arg) => {
            LogSys.info('已收到更新信号')
            LogSys.info('')

            // 开始更新
            this.updater.startUpdate().catch((e) => {
                LogSys.info('+--+--+--+--+--+--+--+--+--+--+--+')
                let stack = StackShorten(e.stack)
                LogSys.error(stack)
                this.updater.dispatchEvent('on_error', e.name, e.message, stack)
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
            LogSys.info('shell-cwd: '+this.updater.workdir.path)
            return await new Promise((a, b) => {
                let process = child_process.exec(shell, {
                    encoding: 'gbk' as any,
                    cwd: this.updater.workdir.path
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
                this.registerProcess(process)
            })
        })
        this.on('get-work-dir', (event) => {
            event.returnValue = this.updater.workdir.path
        })
        this.on('get-app-version', (event) => {
            event.returnValue =  packagejson.version
        })
    }

    private createWindow(width: number, height: number)
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

    handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<void>|any): void
    {
        ipcMain.handle(channel, listener)
    }

    on(eventName: string, callback: (event: IpcMainEvent, ...args: any[]) => void): void
    {
        ipcMain.on(eventName, callback)
    }

    send(channel: string, ...args: any[]): void
    {
        this.win.webContents.send(channel, ...args)
    }

    async loadFile(indexhtml: FileObject): Promise<void>
    {
        this.win.loadFile(indexhtml.path)
        await new Promise((a, b) => {
            this.win.webContents.once('dom-ready', () => {
                a(undefined)
            })
        })
    }

    setWindowIcon(icon: FileObject): void
    {
        // 设置窗口图标
        (async (a, b) => {
            if(await icon.exists() && await icon.isFile())
                this.win.setIcon(icon.path)
        })()
    }

    openDevTools(): void
    {
        this.win.webContents.openDevTools()
    }

    close(): void
    {
        this.win.close()
    }
    
}