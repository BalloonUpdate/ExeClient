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
import path = require('path')
import fs = require('fs/promises')
import os = require('os')
const yaml = require('js-yaml')
const nodefetch = require('node-fetch');
const packagejson = require('../../package.json')

export class Updater
{
    workdir: FileObject
    uwin: UpdaterWindow
    updateObj = null as unknown as Update

    constructor()
    {
        this.workdir = (new FileObject(process.cwd())).append('debug-directory')
        this.uwin = new UpdaterWindow(this)
    }

    async main()
    {
        await this.printEnvironment()
        await this.workdir.mkdirs()

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
            configErr = error
        }

        // 初始化窗口
        await this.uwin.create(winWidth, winHeight)
        this.uwin.setWindowIcon(new FileObject(path.join(__dirname, "../../src/render/icon.png")))
        this.uwin.openDevTools()
        await this.uwin.loadFile(new FileObject(path.join(__dirname, "../../src/render/index.html")))
        
        // 延迟抛出异常
        if(configErr != null)
            throw configErr

        let firstInfo = await this.fetchInfo(config)
        let updateInfo = this.simpleFileObjectFromList(await this.httpGet(firstInfo.updateUrl))
        
        this.updateObj = new Update(this, config, firstInfo, updateInfo)
        this.dispatchEvent('init', {...config})
    }

    async startUpdate()
    {
        this.dispatchEvent('check_for_upgrade')
        this.dispatchEvent('whether_upgrade', false)
        this.dispatchEvent('check_for_update')
        await this.updateObj.update()
    }

    simpleFileObjectFromList(list: any)
    {
        let result = []
        for (const obj of list)
            result.push(SimpleFileObject.FromObject(obj))
        return result
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
        this.uwin.win.webContents.send('updater-event', eventName, ...argv)
    }

    async printEnvironment()
    {
        await LogSys.init(this.workdir.append('.minecraft/logs/updater.log'))
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