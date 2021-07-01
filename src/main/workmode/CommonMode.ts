import { LogSys } from "../LogSys";
import { FileObject } from "../utils/FileObject";
import { SimpleFileObject } from "../utils/SimpleFileObject";
import { BaseWorkMode } from "./BaseWorkMode";

/** 默认同步指定文件夹内的所有文件，
    如果指定了正则表达式，则会使用正则表达式进行进一步筛选
    不匹配的文件会被忽略掉(不做任何变动)
    匹配的文件会与服务器进行同步
 */
export class CommonMode extends BaseWorkMode
{
    async scan(dir: FileObject, tree: SimpleFileObject[]): Promise<void> 
    {
        await this.lookupNewFiles(dir, tree, dir)
        LogSys.debug('-------------------')
        await this.lookupOldFiles(dir, tree, dir)
    }

    private getNameInList(_name: string, _list: SimpleFileObject[])
    {
        for (const n of _list)
        {
            if(n.name == _name)
                return n
        }
        return null
    }

    /** 检查指定路径是否有 路径可匹配的 子目录 */
    private checkSub(t: SimpleFileObject, parent: string, indent=''): boolean
    {
        if(parent == '.' || parent == './')
            parent = ''
        let thisPath = parent + (parent != ''? '/':'') + t.name
        let logtext = 'N:Check:  ' + indent + t['name']

        let result = false

        if(t.isDir())
        {
            LogSys.debug(logtext + '/')

            result = false
            for (const tt of t.children as SimpleFileObject[])
                result = result || this.checkSub(tt, thisPath, indent + '    ')
        } else {
            result = this.test(thisPath)
            LogSys.debug(logtext + '  ' + result)
        }

        return result
    }

    /** 检查指定路径是否有 路径可匹配的 子目录 */
    private async checkSub2(d: FileObject, parent: string, indent=''): Promise<boolean>
    {
        if(parent == '.' || parent == './')
            parent = ''
        let thisPath = parent + (parent != ''? '/':'') + d.name
        let logtext = 'O:Check:  ' + indent + d['name']

        let result = false

        if(await d.isDir())
        {
            LogSys.debug(logtext + '/')

            result = false
            for (const dd of await d.files())
                result = result || await this.checkSub2(dd, thisPath, indent + '    ')
        } else {
            result = this.test(thisPath)
            LogSys.debug(logtext + '  ' + result)
        }

        return result
    }

    /** 只扫描需要下载的文件(不包括被删除的)
     * @param dir 对应的本地目录对象
     * @param tree 与本地目录对应的远程目录
     * @param base 工作目录(更新根目录)，用于计算相对路径
     */
    private async lookupNewFiles(dir: FileObject, tree: SimpleFileObject[], base: FileObject, indent='')
    {
        for (const t of tree)
        {
            let dd = dir.append(t.name)
            let dPath = await dd.relativePath(base)

            let resultA = this.test(dPath)
            let resultB = this.checkSub(t, await dir.relativePath(base), indent)

            LogSys.debug('N:Result: ' + indent + '(' + dPath + '  direct: ' + resultA + '  indirect: ' + resultB + ')')
            // LogSys.debug('')

            // 文件自身无法匹配 且 没有子目录/子文件被匹配 时，对其进行忽略
            if(!resultA && !resultB)
                continue
            
            if(! await dd.exists()) // 文件不存在的话就不用校验直接进行下载
            {
                await this.download(t, dd)
            } else { // 文件存在的话要进行进一步判断
                if(t.isDir()) // 远程对象是一个目录
                {
                    if(await dd.isFile()) // 本地对象是一个文件
                    {
                        // 先删除本地的 文件 再下载远程端的 目录
                        await this.delete(dd)
                        await this.download(t, dd)
                    } else { // 远程对象 和 本地对象 都是目录
                        // 递归调用，进行进一步判断
                        await this.lookupNewFiles(dd, t.children as SimpleFileObject[], base, indent + '    ')
                    }
                } else {
                    // 远程对象是一个文件
                    if(await dd.isFile()) // 远程对象 和 本地对象 都是文件
                    {
                        // 校验hash
                        if(await dd.sha1() != t.hash)
                        {
                            LogSys.debug('hash  '+dd.name + ' / '+t.name)
                            LogSys.debug(await dd.sha1() + '   :   ' + t.hash)
                            
                            // 如果hash对不上，删除后进行下载
                            await this.delete(dd)
                            await this.download(t, dd)
                        }
                    } else { // 本地对象是一个目录
                        // 先删除本地的 目录 再下载远程端的 文件
                        await this.delete(dd)
                        await this.download(t, dd)
                    }
                }
            }
        }
    }

    /** 只扫描需要删除的文件
     * @param dir 对应的本地目录对象
     * @param tree 与本地目录对应的远程目录
     * @param base 工作目录(更新根目录)，用于计算相对路径
     */
    private async lookupOldFiles(dir: FileObject, tree: SimpleFileObject[], base: FileObject, indent='')
    {
        for (const d of await dir.files())
        {
            let t = this.getNameInList(d.name, tree) // 参数获取远程端的对应对象，可能会返回None
            let dPath = await d.relativePath(base)

            // A=true时,b必定为true
            let resultA = this.test(dPath)
            let resultB = await this.checkSub2(d, await dir.relativePath(base), indent)
            LogSys.debug('O:Result: ' + indent + '(' + dPath + "  direct: " + resultA + "   indirect: " + resultB + ')');
            // LogSys.debug('')

            if(resultA)
            {
                if(t!=null) // 如果远程端也有这个文件
                {
                    if(await d.isDir() && t.isDir())
                        // 如果 本地对象 和 远程对象 都是目录，递归调用进行进一步判断
                        await this.lookupOldFiles(d, t.children as SimpleFileObject[], base, indent + '    ')
                } else { // 远程端没有有这个文件，就直接删掉好了
                    await this.delete(d)

                    LogSys.debug('delete: '+d.name)
                }
            } else if(resultB) { // 此时A必定为false,且d一定是个目录
                if(t!=null) // 如果远程端也有这个文件。如果没有，则不需要进行进一步判断，直接跳过即可
                    await this.lookupOldFiles(d, t.children as SimpleFileObject[], base, indent + '    ')
            }
        }
    }

    
}