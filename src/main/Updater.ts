import { ConfigFileNotFoundException } from "./exceptions/ConfigFileNotFoundException";
import { ConfigStructure } from "./interfaces/ConfigStructure";
import { FirstResponseInfo } from "./interfaces/FirstResponseInfo";
import { Update } from "./Update";
import { FileObject } from "./utils/FileObject";
import { SimpleFileObject } from "./utils/SimpleFileObject";
import { HTTPResponseException } from "./exceptions/HTTPResponseException";
import { LogSys } from "./LogSys";
import { UnableToDecodeException } from "./exceptions/UnableToDecodeException";
import { UpdaterWindow } from "./UpdaterWindow";
import { Upgrade } from "./Upgrade";
import { app, dialog } from "electron";
import path = require('path')
import fs = require('fs/promises')
import os = require('os')
import { MCDirectoryNotFoundException } from "./MCDirectoryNotFoundException";
import { FileNotExistException } from "./exceptions/FileNotExistException";
const yaml = require('js-yaml')
const nodefetch = require('node-fetch');
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
            this.workdir = await this.getWirkDirectory() as FileObject
        } catch (error) {
            dialog.showErrorBox('error', 'The .minecraft directory not found.')
            app.exit(1)
            return
        }
        this.uwin = new UpdaterWindow(this)
        
        // 初始化日志系统 / 输出系统环境
        await LogSys.init(this.workdir.append('.minecraft/logs/updater.log'))
        this.printEnvironment()

        let config = null as unknown as ConfigStructure
        let configErr = null as unknown as Error
        let winWidth = 900
        let winHeight = 600

        // 加载配置
        try {
            config = await this.getConfig();
            if('window_width' in config)
                winWidth = config.window_width as number
            if('window_height' in config)
                winHeight = config.window_height as number
        } catch (error) {
            LogSys.warn('Exception captured: '+ error)
            configErr = error
            this.exitcode = 1
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
        {
            configErr = new FileNotExistException('The interface assets not found: '+indexhtml.path)
            this.exitcode = 1
            dialog.showErrorBox('error', 'The interface assets not found: '+indexhtml.path)
            app.exit(this.exitcode)
        } else {
            await this.uwin.loadFile(indexhtml)
        }
        
        // 延迟抛出异常
        if(configErr != null)
        {
            this.dispatchEvent('on_error', configErr.name, configErr.message, configErr.stack)
            throw configErr
        }

        let firstInfo = await this.fetchInfo(config)
        // let upgradeInfo = this.simpleFileObjectFromList(await this.httpGet(firstInfo.upgradeUrl))
        let updateInfo = this.simpleFileObjectFromList(await this.httpGet(firstInfo.updateUrl))
        
        // this.upgradeObj = new Upgrade(this, firstInfo, upgradeInfo)
        this.updateObj = new Update(this, config, firstInfo, updateInfo)
        this.dispatchEvent('init', {...config})
    }

    async startUpdate()
    {
        // this.dispatchEvent('check_for_upgrade')

        // let needUpgrade = await this.upgradeObj.checkForUpgrade()
        // let needUpgrade = false

        // 触发回调
        // this.dispatchEvent('whether_upgrade', needUpgrade)

        // if(needUpgrade)
        // {
            // this.exitcode = 2
            // let repackage = this.workdir.append('.minecraft/updater/repackage.txt')
            // repackage.write(this.upgradeObj.progdir.path)

            // await this.upgradeObj.upgrade()
        // } else {
            await this.updateObj.update()
        // }
    }

    simpleFileObjectFromList(list: any)
    {
        let result = []
        for (const obj of list)
            result.push(SimpleFileObject.FromObject(obj))
        return result
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

    async fetchInfo(config: ConfigStructure): Promise<FirstResponseInfo>
    {
        LogSys.info(config);
        
        let baseurl = config.api.substring(0, config.api.lastIndexOf('/') + 1)
        let api = config.api

        let resp = await this.httpGet(api)
        let upgrade = (resp.upgrade ?? 'upgrade') as string
        let update = (resp.update ?? 'res') as string

        function findSource(text: string, def: string)
        {
            if(text.indexOf('?') != -1)
            {
                let praramStr = text.split('?')
                if(praramStr[1] != '')
                {
                    for (const it of praramStr[1].split('&')) 
                    {
                        let pp = it.split('=')
                        if(pp.length == 2 && pp[0] == 'source' && pp[1] != '')
                            return pp[1]
                    }
                }
                return praramStr[0]
            }
            return def
        }

        let serverVersion = resp.version
        let serverType = resp.server_type
        let mode = resp.mode
        let paths = resp.paths
        let upgradeUrl = baseurl + (upgrade.indexOf('?') != -1? upgrade:upgrade + '.yml')
        let updateUrl = baseurl + (update.indexOf('?') != -1? update:update + '.yml')
        let upgradeSource = baseurl + findSource(upgrade, upgrade) + '/'
        let updateSource = baseurl + findSource(update, update) + '/'

        return { serverVersion, serverType, mode, paths, upgradeUrl, updateUrl, upgradeSource, updateSource }
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

    async httpGet(url: string)
    {
        let raw = null
        try {
            let response = await nodefetch(url)

            // response.status >= 200 && response.status < 300
            if (!response.ok) 
                throw new HTTPResponseException(`HTTP Error Response: ${response.status} ${response.statusText} on ${url}`);
            
                raw = await response.text()
        } catch(e) {
            throw new HTTPResponseException(e.name + ': ' + e.message);
        }

        try {
            return yaml.load(raw)
        } catch (error) {
            throw new UnableToDecodeException('RawUrl: '+url+'\n'+error)
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