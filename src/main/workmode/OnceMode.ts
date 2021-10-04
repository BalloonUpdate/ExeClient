import { LogSys } from "../logging/LogSys";
import { FileObject } from "../utils/FileObject";
import { SimpleFileObject } from "../utils/SimpleFileObject";
import { AbstractMode } from "./AbstractMode";

/**
 * 仅下载不存在的文件，如果文件存在，会直接跳过，不会做任何变动
 * 此模式不具有删除文件的功能，因此任何情况下不会删除任何文件
 * 如果本地和远程的文件类型不同，也不会作任何文件变动
 * 如果规则指向一个文件夹，则仅在第一次不存在时下载这个文件夹及其子目录
 * 之后除非这个文件夹被删除，否则不会再进行下载任何相关文件
 * 顺便，此模式也不具有创建空文件夹的功能
 */
export class OnceMode extends AbstractMode
{
    async _compare(onScan: (file: FileObject) => Promise<void>): Promise<void> 
    {
        await this.findOutNews(this.local, this.remote, this.local, onScan)
    }

    /** 扫描需要下载的文件
     * @param local 要拿来进行对比的本地目录
     * @param remote 要拿来进行对比的远程目录
     * @param base 基准目录，用于计算相对路径（一般等于local）
     * @param onScan 扫描回调，用于报告md5的计算进度
     */
    private async findOutNews(
        local: FileObject,
        remote: Array<SimpleFileObject>, 
        base: FileObject, 
        onScan: (file: FileObject) => Promise<void>, 
        indent: string =''
    ) {
        for (const r of remote)
        {
            let l = local.append(r.name)

            let direct = this.test(await l.relativePath(base))
            let indirect = this.checkIndirectMatches1(r, await local.relativePath(base), indent)

            let flag = direct? '+' : (indirect? '-' : ' ')
            LogSys.debug('N:  '+flag+'   '+indent+r.name)
            if (onScan != null)
                await onScan(l)

            if(!direct && !indirect)
                continue

            if(!await l.exists()) // 文件存在的话要进行进一步判断
            {
                LogSys.debug('    '+indent+'Not found, download '+r.name)
                await this.markAsNew(r, l)
            }
        }
    }

    private checkIndirectMatches1(file: SimpleFileObject, parent: string, indent=''): boolean
    {
        parent = (parent == '.' || parent == './')? '' : parent
        let path = parent + (parent != ''? '/':'') + file.name

        let result = false
        if(file.isDir())
        {
            for (const f of file.children as SimpleFileObject[])
                result = result || this.checkIndirectMatches1(f, path, indent + '    ')
        } else {
            result = this.test(path)
        }
        return result
    }

}