import { FileObject } from "../utils/FileObject";
import { SimpleFileObject } from "../utils/SimpleFileObject";

export abstract class BaseWorkMode
{
    protected basePath: FileObject
    protected regexes: string[]
    deleteList: string[]
    downloadList: Map<string, number> // 文件名: 长度

    constructor(basePath: FileObject, regexes: string[])
    {
        this.basePath = basePath
        this.deleteList = []
        this.downloadList = new Map<string, number>()
        this.regexes = regexes
    }

    protected async delete(file: FileObject): Promise<void>
    {
        if(await file.isDir())
        {
            for (const f of await file.files())
            {
                if(await f.isDir())
                    await this.delete(f)
                else
                    this.deleteList.push(await f.relativePath(this.basePath))
            }
        }
        this.deleteList.push(await file.relativePath(this.basePath))
    }

    protected async download(node: SimpleFileObject, dir: FileObject): Promise<void>
    {
        if(node.isDir())
        {
            // 提前创建文件夹（即使是空文件夹）
            await dir.mkdirs()

            for (const n of node.children as SimpleFileObject[])
            {
                let dd = dir.append(n.name)
                await this.download(n, dd)
            }
        } else {
            let rp = await dir.relativePath(this.basePath)
            this.downloadList.set(rp, node.length as number)
        }
    }

    /** 测试指定的目录是否能通过正则表达式的匹配
     * @param path 需要测试的相对路径字符串
     * @returns 是否通过了匹配
     */
    protected test(path: string): boolean
    {
        if(this.regexes.length == 0)
            return false
        
        let result = false
        for (const reg of this.regexes)
        {
            let plain = !reg.startsWith('@')
            let regx = plain? reg:reg.substring(1)
            if(plain)
                result = result || path.startsWith(regx)
            else
                result = result || new RegExp(regx, 'g').test(path)
            // LogSys.info(plain)
        }
        return result
    }

    abstract scan(dir: FileObject, tree: SimpleFileObject[]): Promise<void>
}