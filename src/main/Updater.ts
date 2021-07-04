import { ConfigFileNotFoundException } from "./exceptions/ConfigFileNotFoundException";
import { ConfigStructure } from "./interfaces/ConfigStructure";
import { Update } from "./Update";
import { FileObject } from "./utils/FileObject";
import { LogSys } from "./LogSys";
import { UpdaterWindow } from "./UpdaterWindow";
import { Upgrade } from "./Upgrade";
import { app, dialog } from "electron";
import { MCDirectoryNotFoundException } from "./MCDirectoryNotFoundException";
import { FileNotExistException } from "./exceptions/FileNotExistException";
import path = require('path')
import fs = require('fs/promises')
import os = require('os')
const yaml = require('js-yaml')
const packagejson = require('../../package.json')

export class Updater
{
    workdir = null as unknown as FileObject
    uwin = null as unknown as UpdaterWindow
    updateObj = null as unknown as Update
    upgradeObj = null as unknown as Upgrade
    exitcode = 0

    async main()
    {
        try {
            try {
                this.workdir = await this.getWirkDirectory() as FileObject
            } catch (error) {
                throw new MCDirectoryNotFoundException('The .minecraft directory not found.')
            }
            this.uwin = new UpdaterWindow(this)
            
            // 初始化日志系统 / 输出系统环境
            await LogSys.init(this.workdir.append('.minecraft/logs/updater.log'))
            this.printEnvironment()

            let config = null as unknown as ConfigStructure
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
            this.uwin.setWindowIcon(new FileObject(path.join(__dirname, "../../src/render/icon.png")))
            if(config != null && 'dev_tools' in config && config.dev_tools)
                this.uwin.openDevTools()
            this.uwin.onAllClosed = () => {
                LogSys.info('close event with code: '+this.exitcode)
                setTimeout(() => app.exit(this.exitcode), 100);
            }

            // 加载界面资源
            let internal = path.join(__dirname, "../../src/render/index.html")
            let iscustom = config != null && 'assets' in config
            let indexhtml = new FileObject(iscustom? this.workdir.append('.minecraft/updater').append(config.assets as string).path:internal)
            if(! await indexhtml.exists())
                throw new FileNotExistException('The interface assets not found: '+indexhtml.path)
            await this.uwin.loadFile(indexhtml)

            this.updateObj = new Update(this, config)
            this.dispatchEvent('init', {...config})
            
            // 延迟抛出异常
            if(delayToThrow != null)
                this.dispatchEvent('on_error', delayToThrow.name, delayToThrow.message, delayToThrow.stack)
        } catch (error) {
            dialog.showErrorBox('error', error.stack)
            app.exit(1)
        } finally {

        }
    }

    async startUpdate()
    {
        await this.updateObj.update()
    }
    async getWirkDirectory()
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
    
    async getConfig(path='.minecraft/updater/updater.yml'): Promise<ConfigStructure>
    {
        let file = this.workdir.append(path).path

        try {
            return yaml.load(await fs.readFile(file, 'utf-8'))
        } catch(e) {
            throw new ConfigFileNotFoundException(file)
        }
    }

    dispatchEvent(eventName: any, ...argv: any[])
    {
        try {
            this.uwin.win.webContents.send('updater-event', eventName, ...argv)
        } catch (error) {
            LogSys.error(error.stack)
        }
    }

    printEnvironment()
    {
        LogSys.debug('-------Env------')
        LogSys.info('workdir: '+this.workdir)
        LogSys.debug('ApplicationVersion: '+packagejson.version)
        LogSys.debug('process.argv: ')
        LogSys.debug(process.argv)
        LogSys.debug('process.execArgv: ')
        LogSys.debug(process.execArgv)
        LogSys.debug('Architecture: ' + os.arch())
        LogSys.debug('Platform: ' + os.platform())
        LogSys.debug('OpratingSystem: ' + os.type())
        LogSys.debug('OpratingSystemRelease: ' + os.release())
        LogSys.debug('OpratingSystemVersion: ' + os.version())
        LogSys.debug('Memory: ' + os.freemem() + ' / ' + os.totalmem())
        LogSys.debug('CPUs: ')
        LogSys.debug(os.cpus())
        LogSys.debug('')
        LogSys.debug('-------EnvEnd------')
    }
}