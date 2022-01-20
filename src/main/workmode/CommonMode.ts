import { LogSys } from "../logging/LogSys";
import { FileObject } from "../utils/FileObject";
import { SimpleFileObject } from "../utils/SimpleFileObject";
import { AbstractMode } from "./AbstractMode";
import { Difference } from "./Difference";

/** 默认同步指定文件夹内的所有文件，
    如果指定了正则表达式，则会使用正则表达式进行进一步筛选
    不匹配的文件会被忽略掉(不做任何变动)
    匹配的文件会与服务器进行同步
 */
export class CommonMode extends AbstractMode
{
    async _compare(onScan: (file: FileObject) => Promise<void>): Promise<void> 
    {
        await this.findOutNews(this.local, this.remote, this.local, onScan)
        LogSys.debug('-------------------')
        await this.findOutOlds(this.local, this.remote, this.local, async (file: FileObject) => {})
    }

    /** 扫描需要下载的文件(不包括被删除的)
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

            if(!direct && !indirect)
                continue
            
            if(await l.exists()) // 文件存在的话要进行进一步判断
            {
                if(r.isDir()) // 远程文件是一个目录
                {
                    if(await l.isFile()) // 本地文件和远程文件的文件类型对不上
                    {
                        await this.markAsOld(l)
                        await this.markAsNew(r, l)
                    } else { // 本地文件和远程文件都是目录，则进行进一步判断
                        await this.findOutNews(l, r.children as SimpleFileObject[], base, onScan, indent + '    ')
                    }
                } else { // 远程文件是一个文件
                    if(await l.isFile()) // 本地文件和远程文件都是文件，则对比校验
                    {
                        // 调用回调函数
                        if (onScan != null)
                            await onScan(l)

                        let noModifiedWithinMTime = false

                        if(this.modifiedTimePrioritized)
                            noModifiedWithinMTime = r.modified == await l.modified() / 1000

                        if(!noModifiedWithinMTime)
                        {
                            let lsha1 = await l.sha1()
                            if(lsha1 != r.hash)
                            {
                                LogSys.debug('    '+indent+'Hash not matched: Local: ' + lsha1 + '   Remote: ' + r.hash)
                                await this.markAsOld(l)
                                await this.markAsNew(r, l)
                            } else if (this.modifiedTimePrioritized && r.modified != undefined) {
                                LogSys.info('更新文件mtime: ' + await l.relativePath(base) + ' => ' + r.modified)
                                // 更新修改时间
                                await l.update_time(undefined, r.modified)
                            }
                        }
                    } else { // 本地对象是一个目录
                        await this.markAsOld(l)
                        await this.markAsNew(r, l)
                    }
                }
                
            } else { // 如果文件不存在的话，就不用校验了，可以直接进行下载
                LogSys.debug('    '+indent+'Not found, download '+r.name)
                await this.markAsNew(r, l)
            }
        }
    }

    /** 扫描需要删除的文件
     * @param local 要拿来进行对比的本地目录
     * @param remote 要拿来进行对比的远程目录
     * @param base 基准目录，用于计算相对路径（一般等于local）
     * @param onScan 扫描回调，用于报告md5的计算进度
     */
    private async findOutOlds(
        local: FileObject,
        remote: Array<SimpleFileObject>, 
        base: FileObject, 
        onScan: (file: FileObject) => Promise<void>, 
        indent: string =''
    ) {
        let get = (name: string, list: SimpleFileObject[]) => {
            for (const n of list)
                if(n.name == name)
                    return n
            return null
        }

        for (const l of await local.files())
        {
            let r = get(l.name, remote) // 获取对应远程文件，可能会返回None
            let direct = this.test(await l.relativePath(base)) // direct=true时, indirect必定为true
            let indirect = await this.checkIndirectMatches2(l, await local.relativePath(base), indent)

            let flag = direct? '+' : (indirect? '-' : ' ')
            LogSys.debug('O:  '+flag+'   '+indent+l.name)
            if (onScan != null)
                await onScan(l)

            if(direct)
            {
                if(r!=null) // 如果远程文件也存在
                {
                    if(await l.isDir() && r.isDir())
                        // 如果 本地对象 和 远程对象 都是目录，递归调用进行进一步判断
                        await this.findOutOlds(l, r.children as SimpleFileObject[], base, onScan, indent + '    ')
                } else { // 没有这个远程文件，就直接删掉好了
                    await this.markAsOld(l)

                    LogSys.debug('    '+indent+'Delete: '+l.name)
                }
            } else if(indirect) { // 此时direct必定为false,且l一定是个目录
                if(r!=null) // 如果没有这个远程文件，则不需要进行进一步判断，直接跳过即可
                    await this.findOutOlds(l, r.children as SimpleFileObject[], base, onScan, indent + '    ')
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

    private async checkIndirectMatches2(file: FileObject, parent: string, indent=''): Promise<boolean>
    {
        parent = (parent == '.' || parent == './')? '' : parent
        let path = parent + (parent != ''? '/':'') + file.name

        let result = false
        if(await file.isDir())
        {
            for (const f of await file.files())
                result = result || await this.checkIndirectMatches2(f, path, indent + '    ')
        } else {
            result = this.test(path)
        }
        return result
    }

    
}