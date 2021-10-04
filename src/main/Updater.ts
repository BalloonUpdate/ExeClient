import { ConfigFileNotFoundException } from "./exceptions/ConfigFileNotFoundException";
import { Update } from "./Update";
import { FileObject } from "./utils/FileObject";
import { LogSys } from "./logging/LogSys";
import { UpdaterWindow } from "./UpdaterWindow";
import { app, dialog } from "electron";
import { FileNotExistException } from "./exceptions/FileNotExistException";
import { MCDirectoryNotFoundException } from "./exceptions/MCDirectoryNotFoundException";
import path = require('path')
import fs = require('fs/promises')
import os = require('os')
import { YamlParseException } from "./exceptions/YamlParseException";
const yaml = require('js-yaml')
const packagejson = require('../../package.json')
import bytesConvert from './utils/ByteConvert'

export class Updater
{
    workdir = null as unknown as FileObject
    uwin = null as unknown as UpdaterWindow
    updateObj = null as unknown as Update
    exitcode = 0

    async main(): Promise<void>
    {
        try {
            this.singleInstance()
            
            try {
                this.workdir = await this.getWirkDirectory() as FileObject
            } catch (error) {
                throw new MCDirectoryNotFoundException('The .minecraft directory not found.')
            }
            this.uwin = new UpdaterWindow(this)
            
            // 初始化日志系统 / 输出系统环境
            await LogSys.init(this.workdir.append('.minecraft/updater/updater.log'))
            this.printEnvironment()

            let config = null as any
            let winWidth = 900
            let winHeight = 600
            let delayToThrow = null as unknown as Error

            // 加载配置
            try {
                config = await this.getConfig();
                if('window_width' in config)
                    winWidth = config.window_width as number
                if('window_height' in config)
                    winHeight = config.window_height as number
            } catch (error) {
                delayToThrow = error
            }

            // 初始化窗口
            await this.uwin.create(winWidth, winHeight)
            let iconpath = config != null && 'icon' in config && config.icon != ''? this.workdir.append('.minecraft/updater').append(config.icon):new FileObject(path.join(__dirname, "../../src/render/icon.png"))
            this.uwin.setWindowIcon(iconpath)
            if(config != null && 'dev_tools' in config && config.dev_tools)
                this.uwin.openDevTools()
            this.uwin.onAllClosed = () => {
                LogSys.info('程序结束，退出码: '+this.exitcode)
                setTimeout(() => app.exit(this.exitcode), 100);
            }

            // 加载/保存cookies
            if(config !=null && 'persistent_cookies' in config && config.persistent_cookies != '')
            {
                let cookieFile = this.workdir.append(path.join('.minecraft/updater/', config.persistent_cookies))

                // 加载
                if(await cookieFile.exists())
                {
                    let cookieObj = yaml.load(await fs.readFile(cookieFile.path))
                    if(Array.isArray(cookieObj))
                    {
                        for (const cook of cookieObj) {
                            let {
                                secure = false,
                                domain = '',
                                path = ''
                            } = cook
        
                            let c = Object.assign(cook, {
                                url: (secure ? 'https://' : 'http://') + domain.replace(/^\./, '') + path
                            })
                            
                            await this.uwin.win.webContents.session.cookies.set(c)
                        }
                    }
                }

                // 保存
                this.uwin.win.webContents.session.cookies.on('changed', async (event, cookie, cause, removed) => {
                    let cookies = await this.uwin.win.webContents.session.cookies.get({})
                    await fs.writeFile(cookieFile.path, yaml.dump(cookies))
                })
            }

            // 加载界面资源
            let internal = path.join(__dirname, "../../src/render/index.html")
            let iscustom = config != null && 'assets' in config
            let indexhtml = new FileObject(iscustom? this.workdir.append('.minecraft/updater').append(config.assets as string).path:internal)
            if(! await indexhtml.exists())
                throw new FileNotExistException('The interface assets not found: '+indexhtml.path)
            await this.uwin.loadFile(indexhtml)

            // 延迟抛出异常
            if(delayToThrow != null)
            {
                this.dispatchEvent('on_error', delayToThrow.name, delayToThrow.message, delayToThrow.stack)
            } else {
                this.updateObj = new Update(this, config)
                this.dispatchEvent('init', {...config})
            }
        } catch (error) {
            dialog.showErrorBox('error!', error.stack)
            app.exit(1)
        } finally {

        }
    }

    async startUpdate(): Promise<void>
    {
        await this.updateObj.update()
    }

    async getWirkDirectory(): Promise<FileObject>
    {
        let cwd = new FileObject(process.cwd())
        
        if(!app.isPackaged)
        {
            cwd = cwd.append('debug-directory')
            await cwd.mkdirs()
        }

        if(await cwd.contains('.minecraft'))
            return cwd
        if(await cwd.parent.contains('.minecraft'))
            return cwd.parent
        if(await cwd.parent.parent.contains('.minecraft'))
            return cwd.parent.parent
        
        throw new MCDirectoryNotFoundException('The .minecraft directory not found.')
    }
    
    async getConfig(path='.minecraft/updater/updater.yml'): Promise<any>
    {
        let file = this.workdir.append(path).path

        try {
            return yaml.load(await fs.readFile(file, 'utf-8'))
        } catch(e) {
            if (e.name == 'YAMLException')
                throw new YamlParseException(e.message + '\n\nfile: '+file)
            throw new ConfigFileNotFoundException(file)
        }
    }

    dispatchEvent(eventName: any, ...argv: any[]): void
    {
        try {
            this.uwin.win.webContents.send('updater-event', eventName, ...argv)
        } catch (error) {
            LogSys.error(error.stack)
        }
    }

    printEnvironment(): void
    {
        function cpus()
        {
            let buf = ''
            for (const cpu of os.cpus())
            {
                buf += JSON.stringify(cpu) + '\n'
            }
            return buf
        }

        console.log(bytesConvert)

        LogSys.debug('-------环境信息------')
        LogSys.info('工作目录: '+this.workdir)
        LogSys.debug('应用版本: '+packagejson.version)
        LogSys.debug('操作系统: ' + os.version() + ' / ' + os.release())
        LogSys.debug('物理内存: ' + bytesConvert(os.freemem()) + ' / ' + bytesConvert(os.totalmem()))
        LogSys.debug('')
    }

    singleInstance(): void
    {
        const sil = app.requestSingleInstanceLock()
        if(sil)
        {
            app.on('second-instance', (event, commandline, workingDirectory) => {
                // 当运行第二个实例时,将会聚焦到this.uwin.win这个窗口
                if(this.uwin != null && this.uwin.win != null)
                {
                    let win = this.uwin.win
                    if (win.isMinimized())
                        win.restore()
                    win.focus()
                }
            })
        } else {
            app.exit(0)
        }
    }
}