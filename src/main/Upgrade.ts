import { Updater } from "./Updater";
import { FileObject } from "./utils/FileObject";
import { DownloadableFile, FileCompare } from "./utils/FileCompare";
import { SimpleFileObject } from "./utils/SimpleFileObject";
import os = require('os');
import { app } from "electron";
import { LogSys } from "./LogSys";
import { DownloadTask } from "./Update";
import { FirstResponseInfo } from "./interfaces/FirstResponseInfo";
import { httpGetFile } from "./utils/httpGetFile";

export class Upgrade
{
    updater: Updater
    workdir: FileObject
    tempdir: FileObject
    progdir: FileObject
    firstInfo: FirstResponseInfo
    upgradeInfo: SimpleFileObject[]

    fc = null as unknown as FileCompare

    constructor(updater: Updater, firstInfo: FirstResponseInfo, upgradeInfo: SimpleFileObject[])
    {
        this.updater = updater
        this.workdir = this.updater.workdir
        this.tempdir = new FileObject(os.tmpdir()).append('updater-temp')
        this.tempdir.mkdirs()
        this.tempdir.clear()
        this.progdir = new FileObject(process.argv[0]).parent
        this.firstInfo = firstInfo
        this.upgradeInfo = upgradeInfo
    }

    async checkForUpgrade()
    {
        let hupath = this.getHuPath()
        await hupath.mkdirs()

        // 对比文件
        this.fc = new FileCompare(hupath.path)
        await this.fc.compareWithSFOs(hupath, this.upgradeInfo)

        // 输出升级相关的信息
        LogSys.debug('hupath: '+hupath.path)
        LogSys.debug('-----UpgradeInfo-----')
        LogSys.debug(this.upgradeInfo)
        LogSys.debug('-----UpgradeInfoEnd-----')
        LogSys.debug('-----UpgradeOverview-----')
        LogSys.debug(LogSys.serialize(this.fc))
        LogSys.debug('-----UpgradeOverviewEnd-----')

        return this.fc.hasDiff()
    }

    async upgrade()
    {
        let hupath = this.getHuPath()

        // 开始更新
        if(this.fc.hasDiff())
        {
            // 触发回调函数
            let newFiles = []
            for (const f of this.fc.newFiles.entries())
                newFiles.push([ f[0], f[1].length, f[1].hash ]) // filename, length, hash
            this.updater.dispatchEvent('upgrading_new_files', newFiles)
            
            // 建立缺失的文件夹
            for (const f of this.fc.newDirs)
                await hupath.append(f).mkdirs()

            // 删除旧文件
            for (const f of this.fc.oldFiles)
                await hupath.append(f).delete()
            
            // 删除旧目录
            for (const f of this.fc.oldDirs)
                await hupath.append(f).delete()
             
            // 下载新文件
            await this.download(hupath, this.fc.newFiles)

            this.updater.dispatchEvent('upgrading_before_installing')
        }
    }

    private getHuPath()
    {
        return app.isPackaged? this.progdir.append('resources/app'):this.workdir.append('hotupdatetest')
    }

    private async download(dir: FileObject, downloadList: Map<string, DownloadableFile>)
    {
        // 建立下载任务
        let dq = new Array<DownloadTask>()
        for (const dl of downloadList.entries())
        {
            let path = dl[0]
            let length = dl[1].length
            let hash = dl[1].hash
            let file = dir.append(path)
            let url = this.firstInfo.upgradeSource + path

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
            this.updater.dispatchEvent('upgrading_downloading', r_path, 0, 0, e_length)

            await httpGetFile(url, new FileObject(path), e_length, (bytesReceived: number, totalReceived: number) => {
                this.updater.dispatchEvent('upgrading_downloading', r_path, bytesReceived, totalReceived, e_length)
            })
        }
    }
}
