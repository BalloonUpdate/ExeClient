import { UpdaterApplication } from "./UpdaterApplication"
import { FileObject } from "./utils/FileObject"
import { CommonMode } from "./workmode/CommonMode"
import { ExistMode } from "./workmode/ExistMode"
import { UnknownWorkModeException } from "./exceptions/UnknownWorkModeException"
import { SimpleFileObject } from "./utils/SimpleFileObject"
import { LogSys } from "./logging/LogSys"
import { httpGetFile } from "./utils/httpGetFile"
import { httpFetch } from "./utils/httpFetch"
import { countFiles } from "./utils/utility"
import { OnceMode } from "./workmode/OnceMode"
import { AbstractMode } from "./workmode/AbstractMode"
import { readFile } from "original-fs"
import { NoServerAvailableException } from "./exceptions/NoServerAvailableException"
import { HTTPResponseException } from "./exceptions/HTTPResponseException"
const yaml = require('js-yaml')
const crypto = require('crypto')

export interface DownloadTask
{
    /** 文件对应的本地路径 */
    path: string

    /** 文件对应的URL */
    url: string

    /** 文件的相对路径 */
    _relative_path: string

    /** 文件的预期长度 */
    _length: number
}

export class Update
{
    updater: UpdaterApplication
    workdir: FileObject
    config: any

    constructor(updater: UpdaterApplication)
    {
        this.updater = updater
        this.workdir = updater.workdir
        this.config = updater.config
    }

    async update(): Promise<void>
    {
        let firstInfo = await this.fetchInfo(this.config)
        let temp = await httpFetch(firstInfo.updateUrl)
        let rawData = yaml.dump(temp)
        let remoteFiles = this.simpleFileObjectFromList(temp)
        
        this.updater.dispatchEvent('check_for_update')

        await this.workdir.mkdirs()

        // 输出调试信息
        LogSys.debug('-----服务端配置信息-----');
        try {
            LogSys.debug(yaml.dump(firstInfo))
        } catch (error) {
            LogSys.debug(firstInfo)
        }
        LogSys.debug('-----服务端最新文件参照-----');
        try {
            LogSys.debug(yaml.dump(remoteFiles))
        } catch (error) {
            LogSys.debug(remoteFiles)
        }
        LogSys.debug('');

        this.updater.dispatchEvent('check_for_update', '')

        // 使用版本缓存
        let progdir = this.updater.progdir
        let isVersionOutdate = true
        let versionCacheFile = this.updater.readField('version_cache', 'string')
        versionCacheFile = versionCacheFile ? progdir.append(versionCacheFile) : null
        if(versionCacheFile != null)
        {
            await versionCacheFile.makeParentDirs()
            if(await versionCacheFile.exists())
            {
                let versionCached = await versionCacheFile.read()
                let versionRecieved = crypto.createHash('sha1').update(rawData).digest("hex")
                isVersionOutdate = versionCached != versionRecieved

                LogSys.debug(isVersionOutdate ? '版本缓存文件已过期，需要更新':'版本缓存文件已读取，暂无更新');
                LogSys.debug('');
            }
        }

        if(isVersionOutdate)
        {
            // 检查文件差异
            let newFolders: string[] = []
            let deleteList: string[] = []
            let downloadList: { [key: string]: number } = {}

            let e = async (workMode: AbstractMode) => {
                let className = (workMode as any).constructor.name
                LogSys.debug('-----更新路径匹配信息('+className+')------')

                let fileCountTotal = await countFiles(this.workdir)
                let fileCountHashed = 0
                let result = await workMode.compare(async (f) => {
                    fileCountHashed += 1
                    this.updater.dispatchEvent('updating_hashing', await f.relativePath(this.workdir), fileCountHashed, fileCountTotal)
                })

                deleteList.push(...result.oldFiles.concat(result.oldFolders))
                downloadList = { ...downloadList, ...result.newFiles }
            }

            // 使用所有工作模式更新
            if(firstInfo.common_mode)
                await e(new CommonMode(firstInfo.common_mode, this.workdir, remoteFiles))
            if(firstInfo.once_mode)
                await e(new OnceMode(firstInfo.once_mode, this.workdir, remoteFiles))
            
            // 创建文件夹
            for (const f of newFolders)
                await new FileObject(f).mkdirs()
    
            // 输出差异信息
            LogSys.debug('-----本地与服务端的文件差异信息-----')
            for (const f of deleteList)
                LogSys.info('旧文件: ' + f)
            for (const k in downloadList)
                LogSys.info('新文件: ' + k)
            LogSys.debug('-----文件下载过程-----')
    
            // 触发回调函数
            let newfiles = []
            for (let k in downloadList)
                newfiles.push([k, downloadList[k]])
            this.updater.dispatchEvent('updating_new_files', [...newfiles])
            this.updater.dispatchEvent('updating_old_files', [...deleteList])
    
            // 删除旧文件/目录
            for (const f of deleteList)
                await this.workdir.append(f).delete()
            
            // 下载新文件
            await this.download(this.workdir, downloadList, firstInfo.updateSource)
        } else {
            this.updater.dispatchEvent('updating_new_files', [])
            this.updater.dispatchEvent('updating_old_files', [])
        }

        // 保存版本缓存
        if(versionCacheFile != null)
            await versionCacheFile.write(crypto.createHash('sha1').update(rawData).digest("hex"))

        this.updater.dispatchEvent('cleanup')
    }

    async download(dir: FileObject, downloadList: { [key: string]: number }, updateSource: string): Promise<void>
    {
        // 建立下载任务
        let dq = new Array<DownloadTask>()
        for (let k in downloadList)
        {
            let v = downloadList[k]
            let path = k
            let length = v
            let file = dir.append(path)
            let url = updateSource + path

            dq.push({ path: file.path, url: url, _relative_path: path, _length: length })
        }
        
        while(dq.length > 0)
        {
            let task = dq.pop() as DownloadTask
            let path = task.path
            let url = task.url
            let r_path = task._relative_path
            let e_length = task._length
            let file = new FileObject(path)

            LogSys.info('下载: '+r_path)
            this.updater.dispatchEvent('updating_downloading', r_path, 0, 0, e_length)

            await file.makeParentDirs()
            await httpGetFile(url, file, e_length, (bytesReceived: number, totalReceived: number) => {
                this.updater.dispatchEvent('updating_downloading', r_path, bytesReceived, totalReceived, e_length)
            })
        }
    }
    
    getWorkMode(workmode: string): typeof CommonMode | typeof ExistMode | typeof OnceMode
    {
        switch(workmode)
        {
            case 'common':
                return CommonMode
            case 'exits':
                return ExistMode
            case 'once':
                return OnceMode
            default:
                throw new UnknownWorkModeException('Unknown workmode: '+workmode)
        }
    }

    async fetchInfo(config: any): Promise<any>
    {
        LogSys.debug('-----配置文件内容-----')
        LogSys.debug(config);

        let servers = Array.isArray(config.api) ? config.api as Array<string> : [config.api as string]

        for(let i = 0; i < servers.length ; i++)
        {
            let server = servers[i];
            let baseurl = server.substring(0, server.lastIndexOf('/') + 1)
            let resp = null as any
            try {
                resp = await httpFetch(server)
            } catch (ex) {
                if(servers.length > 1 && // 有多个server源时
                    ex instanceof HTTPResponseException && // 是网络原因
                    i != servers.length - 1 // 不是最后一个server源失败，才会进行下次尝试
                ) {
                    LogSys.info('服务器不可用: '+server)
                    continue
                }
                throw ex
            }

            let update = (resp.update ?? 'res') as string

            let updateUrl = baseurl + (update.indexOf('?') != -1? update:update + '.yml')
            let updateSource = baseurl + findSource(update, update) + '/'
            return { ...resp, updateUrl, updateSource }
        }

        throw new NoServerAvailableException('No available server, or all servers specified were offline');

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
    }

    simpleFileObjectFromList(list: any): SimpleFileObject[]
    {
        let result = []
        for (const obj of list)
            result.push(SimpleFileObject.FromObject(obj))
        return result
    }
}