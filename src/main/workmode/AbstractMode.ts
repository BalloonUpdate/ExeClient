import { FileObject } from "../utils/FileObject";
import { SimpleFileObject } from "../utils/SimpleFileObject";
import { Difference } from "./Difference";
const minimatch = require("minimatch")

export abstract class AbstractMode
{
    protected regexes: string[]
    protected base: FileObject
    protected local: FileObject
    protected remote: Array<SimpleFileObject>
    protected result: Difference = new Difference()

    /**
     * @param regexes 要比较的路径
     * @param local 要比较的本地文件
     * @param remote 要比较的远程文件
     */
    constructor(regexes: string[], local: FileObject, remote: Array<SimpleFileObject>)
    {
        this.regexes = regexes
        this.base = local
        this.local = local
        this.remote = remote
    }

    /**
     * 将一个文件文件或者目录标记为旧文件
     */
    protected async markAsOld(file: FileObject): Promise<void>
    {
        if(await file.isDir())
        {
            for (const f of await file.files())
            {
                if(await f.isDir())
                    await this.markAsOld(f)
                else
                    this.result.oldFiles.push(await f.relativePath(this.base))
            }
            this.result.oldFolders.push(await file.relativePath(this.base))
        } else {
            this.result.oldFiles.push(await file.relativePath(this.base))
        }
    }

    /**
     * 将一个文件文件或者目录标记为新文件
     */
    protected async markAsNew(node: SimpleFileObject, dir: FileObject): Promise<void>
    {
        if(node.isDir())
        {
            this.result.newFolders.push(await dir.relativePath(this.base))

            for (const n of node.children as SimpleFileObject[])
                await this.markAsNew(n, dir.append(n.name))
        } else {
            let rp = await dir.relativePath(this.base)
            this.result.newFiles[rp] = node.length as number
        }
    }

    /** 测试指定的目录是否能通过路径匹配
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
            {
                result = result || minimatch(path, regx, { dot: true, nocase: true, matchBase: true })
                // result = result || path.startsWith(regx)
            }
            else
                result = result || new RegExp(regx, 'g').test(path)
        }
        return result
    }

    public async compare(onScan: (file: FileObject) => Promise<void> = async (f: FileObject) => {}): Promise<Difference>
    {
        await this._compare(onScan)
        return this.result
    }

    protected abstract _compare(onScan: (file: FileObject) => Promise<void>): Promise<void>
}