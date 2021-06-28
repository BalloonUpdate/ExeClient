import { ConfigFileNotFoundException } from "./exceptions/ConfigFileNotFoundException";
import { ConfigStructure } from "./interfaces/ConfigStructure";
import { FirstResponseInfo } from "./interfaces/FirstResponseInfo";
import { Update } from "./Update";
import { FileObject } from "./utils/FileObject";
import { SimpleFileObject } from "./utils/SimpleFileObject";
import path = require('path')
import fs = require('fs/promises')
import { HTTPResponseException } from "./exceptions/HTTPResponseException";
import { UpdaterIPC } from "./UpdaterIPC";
const yaml = require('js-yaml')
const nodefetch = require('node-fetch');

export class Updater
{
    workdir: FileObject
    uipc: UpdaterIPC

    constructor(uipc: UpdaterIPC)
    {
        this.uipc = uipc
        this.workdir = (new FileObject(process.cwd())).append('debug-directory')
        this.workdir.mkdirs()

        console.log('workdir: ', this.workdir);
    }

    async main()
    {
        this.uipc.dispatchEvent('init')

        let info = await this.fetchInfo()
        let updataInfo = this.simpleFileObjectFromList(await this.httpGet(info.updateUrl))

        // console.log(updataInfo);

        this.uipc.dispatchEvent('whether_upgrade', false)
        let update = new Update(this, await this.getConfig(), info)
        update.update(updataInfo)
    }

    simpleFileObjectFromList(list: any)
    {
        let result = []

        for (const obj of list)
            result.push(SimpleFileObject.FromObject(obj))

        return result
    }

    async fetchInfo(): Promise<FirstResponseInfo>
    {
        let config = await this.getConfig();

        console.log('---', config, '---');
        
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

    async getConfig(): Promise<ConfigStructure>
    {
        let file = path.join(this.workdir.path, 'updater.yml')

        try {
            return yaml.load(await fs.readFile(file, 'utf-8'))
        } catch(e) {
            throw new ConfigFileNotFoundException(file)
        }
    }

    async httpGet(url: string)
    {
        try {
            let response = await nodefetch(url)

            if (!response.ok) 
                throw new HTTPResponseException(`HTTP Error Response: ${response.status} ${response.statusText}`);

            // response.status >= 200 && response.status < 300
            return yaml.load(await response.text())
        } catch(e) {
            throw new HTTPResponseException(e.name + ': ' + e.message);
        }
    }
}