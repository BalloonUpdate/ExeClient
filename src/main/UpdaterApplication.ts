import { ConfigFileNotFoundException } from "./exceptions/ConfigFileNotFoundException";
import { Update } from "./Update";
import { FileObject } from "./utils/FileObject";
import { LogSys } from "./logging/LogSys";
import { Window } from "./windows/Window";
import { app, dialog } from "electron";
import { FileNotExistException } from "./exceptions/FileNotExistException";
import path = require('path')
import fs = require('fs/promises')
import os = require('os')
import { YamlParseException } from "./exceptions/YamlParseException";
const yaml = require('js-yaml')
const packagejson = require('../../package.json')
import bytesConvert from './utils/ByteConvert'
import StackShorten from "./utils/StackShorten";

export class UpdaterApplication
{
    workdir = null as unknown as FileObject
    progdir = null as unknown as FileObject
    config = null as any
    uwin = null as unknown as Window
    updateObj = null as unknown as Update
    exitcode = 0

    async main(): Promise<void>
    {
        try {
            this.singleInstance()
            this.uwin = new Window(this)

            this.progdir = new FileObject(app.isPackaged && '_LW_EXEDIR' in process.env ? process.env['_LW_EXEDIR']!! : process.cwd())
            this.progdir = app.isPackaged ? this.progdir : this.progdir.append('debug-directory')

            // 加载配置
            this.config = await this.readConfig('updater.yml');

            // 初始化工作目录
            let startPath = this.readField('start_path', 'string')
            this.workdir = startPath ? this.progdir.append(startPath) : await this.getWirkDirectory(this.progdir)

            // 初始化日志系统
            let logFile = this.readField('log_file', 'string')
            await LogSys.init(logFile == '' ? undefined : this.progdir.append(logFile ? logFile : 'updater.log'))
            this.printEnvironment()

            // 初始化窗口
            await this.uwin.create({
                width: this.readField('window_width', 'number', 400), 
                height: this.readField('window_height', 'number', 300), 
                frame: !this.readField('frameless', 'boolean', false), 
                transparent: this.readField('transparent', 'boolean', false),
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                },
                ...this.readField('window_config', 'object', {})
            })

            // 加载图标
            let iconpath = this.readField('icon', 'string')
            let icon = iconpath ? this.progdir.append(iconpath)
                : new FileObject(path.join(__dirname, "../../src/render/icon.png"))
            this.uwin.setWindowIcon(icon)

            // 加载dev_tools开启状态
            if(this.readField('dev_tools', 'boolean', false))
                this.uwin.openDevTools()
            
            // 退出钩子
            this.uwin.onAllClosed = () => {
                LogSys.info('程序结束，退出码: '+this.exitcode)
                setTimeout(() => app.exit(this.exitcode), 100);
            }

            // 加载/保存cookies
            let persistent_cookies = this.readField('persistent_cookies', 'string')
            if(persistent_cookies)
            {
                let cookieFile = this.progdir.append(persistent_cookies)

                // 加载
                if(await cookieFile.exists())
                {
                    let cookieObj = yaml.load(await fs.readFile(cookieFile.path))
                    if(Array.isArray(cookieObj))
                    {
                        for (const cook of cookieObj) {
                            let { secure = false, domain = '', path = '' } = cook
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
            let customui = this.readField('ui', 'string')
            let indexhtml = new FileObject(customui ? this.progdir.append(customui).path : internal)
            if(! await indexhtml.exists())
                throw new FileNotExistException('The user interface assets not found: '+indexhtml.path)
            await this.uwin.loadFile(indexhtml)

            // 给前端发信号说已经准备好了
            this.updateObj = new Update(this)
            this.dispatchEvent('init', {...this.config, argv: process.argv})
        } catch (error) {
            let stack = StackShorten(error.stack)
            dialog.showErrorBox('发生错误 '+packagejson.version, stack)
            LogSys.error(stack)
            app.exit(1)
        }
    }

    async startUpdate(): Promise<void>
    {
        await this.updateObj.update()
    }

    readField(fieldName: string, typename: string, defaultValue:any = null) 
    {
        return fieldName in this.config && typeof this.config[fieldName] == typename ? this.config[fieldName] : defaultValue
    }
    
    async readConfig(path: string): Promise<any>
    {
        await this.progdir.mkdirs()
        let file = this.progdir.append(path).path
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
        LogSys.debug('-------环境信息------')
        LogSys.info('更新目录: '+this.workdir)
        LogSys.info('工作目录: '+new FileObject(process.cwd()))
        LogSys.debug('程序目录: '+this.progdir)
        LogSys.debug('应用版本: '+packagejson.version)
        LogSys.debug('操作系统: ' + os.version() + ' / ' + os.release())
        LogSys.debug('物理内存: ' + bytesConvert(os.freemem()) + ' / ' + bytesConvert(os.totalmem()))
        LogSys.debug('应用参数：'+process.argv)
        LogSys.debug('Node参数：'+process.execArgv)
        LogSys.debug('环境变量：')
        LogSys.debug(process.env)
        LogSys.debug('环境变量：结束')
        LogSys.debug('')
    }

    async getWirkDirectory(from: FileObject): Promise<FileObject>
    {
        // parent不会返回null或者undefined，不断调用parent最终只会不断返回顶层的盘符目录
        if(await from.contains('.minecraft'))
            return from
        if(await from.parent.contains('.minecraft'))
            return from.parent
        if(await from.parent.parent.contains('.minecraft'))
            return from.parent.parent
        if(await from.parent.parent.parent.contains('.minecraft'))
            return from.parent.parent.parent
        if(await from.parent.parent.parent.parent.contains('.minecraft'))
            return from.parent.parent.parent.parent
        if(await from.parent.parent.parent.parent.parent.contains('.minecraft'))
            return from.parent.parent.parent.parent.parent
        if(await from.parent.parent.parent.parent.parent.parent.contains('.minecraft'))
            return from.parent.parent.parent.parent.parent.parent
        
        throw new FileNotExistException('The .minecraft directory not found.')
    }

    singleInstance(): void
    {
        const lock = app.requestSingleInstanceLock()
        if(lock)
        {
            app.on('second-instance', (event, commandline, workingDirectory) => {
                // 当运行第二个实例时,将会聚焦到this.uwin.win这个窗口
                if(this.uwin != null && this.uwin.win != null)
                {
                    let win = this.uwin.win
                    if(!win.isDestroyed())
                    {
                        if (win.isMinimized())
                            win.restore()
                        win.focus()
                    }
                }
            })
        } else {
            app.exit(0)
        }
    }
}