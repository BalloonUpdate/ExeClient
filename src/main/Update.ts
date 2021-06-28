import { FirstResponseInfo } from "./interfaces/FirstResponseInfo"
import { Updater } from "./Updater"
import { FileObject } from "./utils/FileObject"
import { CommonMode } from "./workmode/CommonMode"
import { ExistMode } from "./workmode/ExistMode"
import { UnknownWorkModeException } from "./exceptions/UnknownWorkModeException"
import { SimpleFileObject } from "./utils/SimpleFileObject"
import { ConfigStructure } from "./interfaces/ConfigStructure"
import { UnexpectedHttpCodeExcepetion } from "./exceptions/UnexpectedHttpCodeExcepetion"
import fs = require('fs/promises')
import https = require('https')
import http = require('http')
import { UpdaterIPC } from "./UpdaterIPC"

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
    uipc: UpdaterIPC
    workdir: FileObject
    config: ConfigStructure
    firstInfo: FirstResponseInfo

    constructor(updater: Updater, config: ConfigStructure, firstInfo: FirstResponseInfo)
    {
        this.updater = updater
        this.uipc = updater.uipc
        this.workdir = updater.workdir
        this.config = config
        this.firstInfo = firstInfo
    }

    async update(updateInfo: SimpleFileObject[])
    {
        this.workdir.mkdirs()
        console.log(this.firstInfo)
        // console.log(updateInfo)
        console.log('-----------------------');

        this.uipc.dispatchEvent('check_for_update', '')

        let workmode = new (this.getWorkMode(this.firstInfo.mode))(this.workdir, this.firstInfo.paths)
        await workmode.scan(this.workdir, updateInfo)
        let deleteList = workmode.deleteList
        let downloadList = workmode.downloadList

        this.uipc.dispatchEvent('updating_new_files', [...downloadList.entries()])

        for (const f of deleteList)
            console.log('delete: ' + f)
        for (const f of downloadList.entries())
            console.log('download: ' + f[0] + ' : ' + f[1])
        
        await this.download(this.workdir, downloadList)

        this.uipc.dispatchEvent('cleanup')
    }

    async download(dir: FileObject, downloadList: Map<string, number>)
    {
        let dq = new Array<DownloadTask>()

        // 建立下载任务
        for (const dl of downloadList.entries())
        {
            let path = dl[0]
            let length = dl[1]
            let file = this.workdir.append(path)
            let url = this.firstInfo.updateSource + path

            dq.push({ path: file.path, url: url, _relative_path: path, _length: length })
        }
        
        while(dq.length > 0)
        {
            let task = dq.pop() as DownloadTask
            let path = task.path
            let url = task.url// + 'sad'
            let r_path = task._relative_path
            let e_length = task._length

            console.log('Download: '+r_path)
            this.uipc.dispatchEvent('updating_downloading', r_path, 0, 0, e_length)

            await this.httpGetFile(url, new FileObject(path), e_length, (bytesReceived: number, totalReceived: number) => {
                this.uipc.dispatchEvent('updating_downloading', r_path, bytesReceived, totalReceived, e_length)
            })
        }
    }
    
    async httpGetFile(url: string, file: FileObject, lengthExpected: number, callback: (bytesReceived: number, totalReceived: number) => void = () => {})
    {
        let fileOut = await fs.open(file.path, 'w')
        let wait = null as unknown as Promise<{ bytesWritten: number; buffer: any; }>

        await new Promise(((a) => {
            console.log('req: '+url)

            let req = (url.startsWith('https')? https:http).request(url, {
                timeout: this.config.timeout ?? 10
            })

            req.on('response', (response) => {
                // console.log('statusCode:', response.statusCode);
                // console.log('headers:', response.headers);
                
                let bytesReceived = 0
                let dataReturned = ''
                
                response.on('data', (data) => {
                    if(response.statusCode != 200)
                    {
                        dataReturned += data.toString()
                    } else {
                        fileOut.write(data, 0, data.length)
                        // console.log(data.length)
                        bytesReceived += data.length
                        callback(data.length, bytesReceived)
                    }
                })

                response.on('end', () => {
                    if(response.statusCode != 200)
                    {
                        let msg = 'Unexpected httpcode: '+response.statusCode + ' on '+url
                        throw new UnexpectedHttpCodeExcepetion(msg, dataReturned);
                    }

                    a(undefined)
                })

                response.on('error', (e) => { throw e })
            })
    
            req.on('error', (e) => {
                throw e
            })
    
            req.end();
        }))

        if(wait != null)
            await wait;
        
        fileOut.close()
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

    useDefaultValue()
    {

    }
}