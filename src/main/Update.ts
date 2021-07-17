import { FirstResponseInfo } from "./interfaces/FirstResponseInfo"
import { Updater } from "./Updater"
import { FileObject } from "./utils/FileObject"
import { CommonMode } from "./workmode/CommonMode"
import { ExistMode } from "./workmode/ExistMode"
import { UnknownWorkModeException } from "./exceptions/UnknownWorkModeException"
import { SimpleFileObject } from "./utils/SimpleFileObject"
import { ConfigStructure } from "./interfaces/ConfigStructure"
import { UnexpectedHttpCodeExcepetion } from "./exceptions/UnexpectedHttpCodeExcepetion"
import { LogSys } from "./LogSys"
import { ConnectionClosedException } from "./exceptions/ConnectionClosedException"
import { httpGetFile } from "./utils/httpGetFile"
import { httpFetch } from "./utils/httpFetch"

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
    updater: Updater
    workdir: FileObject
    config: ConfigStructure

    constructor(updater: Updater, config: ConfigStructure)
    {
        this.updater = updater
        this.workdir = updater.workdir
        this.config = config
    }

    async update()
    {
        let firstInfo = await this.fetchInfo(this.config)
        let updateInfo = this.simpleFileObjectFromList(await httpFetch(firstInfo.updateUrl))
        
        this.updater.dispatchEvent('check_for_update')

        await this.workdir.mkdirs()

        LogSys.debug('-----Info(firstInfo)-----');
        LogSys.debug(firstInfo)
        LogSys.debug('-----Info(updateInfo)-----');
        LogSys.debug(updateInfo)
        LogSys.debug('-----InfoEnd-----');

        this.updater.dispatchEvent('check_for_update', '')

        let workmodeClass = this.getWorkMode(firstInfo.mode)
        LogSys.info('workmode: '+workmodeClass.name)

        let workmode = new workmodeClass(this.workdir, firstInfo.paths)
        await workmode.scan(this.workdir, updateInfo)
        let deleteList = workmode.deleteList
        let downloadList = workmode.downloadList

        // 输出差异信息
        LogSys.debug('----------DelList----------')
        for (const f of deleteList)
            LogSys.info('deleteTask: ' + f)
        for (const f of downloadList.entries())
            LogSys.info('downloadTask: ' + f[0] + ' : ' + f[1])
        LogSys.debug('----------DownList----------')

        // 触发回调函数
        this.updater.dispatchEvent('updating_new_files', [...downloadList.entries()])

        // 删除旧文件/目录
        for (const f of deleteList)
            await this.workdir.append(f).delete()
        
        // 下载新文件
        await this.download(this.workdir, downloadList, firstInfo.updateSource)

        this.updater.dispatchEvent('cleanup')
    }

    async download(dir: FileObject, downloadList: Map<string, number>, updateSource: string)
    {
        // 建立下载任务
        let dq = new Array<DownloadTask>()
        for (const dl of downloadList.entries())
        {
            let path = dl[0]
            let length = dl[1]
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

            LogSys.info('Download: '+r_path)
            this.updater.dispatchEvent('updating_downloading', r_path, 0, 0, e_length)

            await httpGetFile(url, new FileObject(path), e_length, (bytesReceived: number, totalReceived: number) => {
                this.updater.dispatchEvent('updating_downloading', r_path, bytesReceived, totalReceived, e_length)
            })
        }
    }
    
    getWorkMode(workmode: string)
    {
        switch(workmode)
        {
            case 'common':
                return CommonMode
            case 'exits':
                return ExistMode
            default:
                throw new UnknownWorkModeException('Unknown workmode: '+workmode)
        }
    }

    async fetchInfo(config: ConfigStructure): Promise<FirstResponseInfo>
    {
        LogSys.info(config);
        
        let baseurl = config.api.substring(0, config.api.lastIndexOf('/') + 1)
        let api = config.api

        let resp = await httpFetch(api)
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
        let updateUrl = baseurl + (update.indexOf('?') != -1? update:update + '.yml')
        let updateSource = baseurl + findSource(update, update) + '/'

        return { serverVersion, serverType, mode, paths, updateUrl, updateSource }
    }

    useDefaultValue()
    {

    }

    simpleFileObjectFromList(list: any)
    {
        let result = []
        for (const obj of list)
            result.push(SimpleFileObject.FromObject(obj))
        return result
    }
}