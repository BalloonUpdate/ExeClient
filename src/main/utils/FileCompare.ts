import { AmbiguousFileTypeException } from "../exceptions/AmbiguousFileTypeException"
import { IsADirectoryException } from "../exceptions/IsADirectoryException"
import { IsAFileException } from "../exceptions/IsAFileException"
import { MissingParameterException } from "../exceptions/MissingParameterException"
import { LogSys } from "../LogSys"
import { FileObject } from "./FileObject"
import { SimpleFileObject } from "./SimpleFileObject"
import { inArray } from "./utility"

export interface DownloadableFile
{
    length: number
    hash: string
}

export class FileCompare
{
    basePath: string
    oldFiles: string[]
    oldDirs: string[]
    newFiles: Map<string, DownloadableFile>
    newDirs: string[] 

    constructor(basePath: string)
    {
        this.basePath = basePath
        this.oldFiles = []
        this.oldDirs = []
        this.newFiles = new Map<string, DownloadableFile>()
        this.newDirs = []
    }

    /** 计算缺失的文件
     * @param lookupIn 对应的本地目录
     * @param template 对应目录的模板
     */
    private async lookupNew(lookupIn: FileObject, template: SimpleFileObject)
    {
        for (const t of template.files())
        {
            if(! await lookupIn.contains(t.name))
            {
                await this.addNewFile(lookupIn.append(t.name), t)
            } else { // 文件存在的话要进行进一步判断
                let corresponding = lookupIn.append(t.name)

                if(t.isDir())
                {
                    if(await corresponding.isFile())
                    {
                        // 先删除旧的再获取新的
                        await this.addOldFile(corresponding, await lookupIn.relativePath(this.basePath))
                        await this.addNewFile(corresponding, t)
                    } else {
                        await this.lookupNew(corresponding, t)
                    }
                } else {
                    if(await corresponding.isFile())
                    {
                        if(await corresponding.sha1() != t.hash)
                        {
                            // 先删除旧的再获取新的
                            await this.addOldFile(corresponding, await lookupIn.relativePath(this.basePath))
                            await this.addNewFile(corresponding, t)
                        }
                    } else {
                        // 先删除旧的再获取新的
                        await this.addOldFile(corresponding, await lookupIn.relativePath(this.basePath))
                        await this.addNewFile(corresponding, t)
                    }
                }
            }
        }
    }

    /** 只扫描需要删除的文件
     * @param lookupIn 远程文件结构(目录)
     * @param template 本地文件结构(目录)
     */
    private async lookupOld(lookupIn: FileObject, template: SimpleFileObject)
    {
        for (const c of await lookupIn.files())
        {
            if(await template.contains(c.name))
            {
                let corresponding = template.getByName(c.name) as SimpleFileObject

                // 如果两边都是目录，递归并进一步判断
                if(await c.isDir() && corresponding.isDir())
                    await this.lookupOld(c, corresponding)
                // 其它情况均由findMissingFiles进行处理了，这里不需要重复计算
            } else { // 如果远程端没有有这个文件，就直接删掉好了
                await this.addOldFile(c, await lookupIn.relativePath(this.basePath))
            }
        }
    }

    /** 添加缺失的新文件
     * @param missing 对应的本地文件
     * @param template 对应的模板文件
     */
    private async addNewFile(missing: FileObject, template: SimpleFileObject)
    {
        if(template.isDir())
        {
            // console.log('asdadsdasd: '+template.name+'|'+missing.name)
            let folder = await missing.relativePath(this.basePath)

            if(!inArray(folder, this.newDirs) && folder != '.')
                this.newDirs.push(folder)
            
            for (const t of template.files())
            {
                let mCorresponding = missing.append(t.name)
                if(t.isDir()){
                    this.addNewFile(mCorresponding, t)
                } else {
                    let key = await mCorresponding.relativePath(this.basePath)
                    let value = { length: t.length as number, hash: t.hash as string }
                    this.newFiles.set(key, value)
                }
            }
        } else {
            let key = await missing.relativePath(this.basePath)
            let value = { length: template.length as number, hash: template.hash as string }
            this.newFiles.set(key, value)
        }
    }

    /** 添加需要删除的文件/目录
     * @param file 删除的文件(文件/目录)
     * @param dir file所在的目录(文件/目录)
     */
    private async addOldFile(file: FileObject, dir: string)
    {
        let path = dir + '/' + file.name
        let pathNoDotSlash = path.startsWith('./')? path.substring(2):path

        if(await file.isDir())
        {
            for (const u of await file.files())
            {
                if(await u.isDir()) 
                {
                    await this.addOldFile(u, path)
                } else {
                    let newPath = path + '/' + u.name
                    this.oldFiles.push(newPath.startsWith('./')? newPath.substring(2):newPath)
                }
            }

            this.oldDirs.push(pathNoDotSlash)
        } else {
            this.oldFiles.push(pathNoDotSlash)
        }
    }

    /** 对比目录差异
     * @param file 本地目录
     * @param template 对应的模板目录(SimpleFileObject)
     */
    async compareWithSFO(file: FileObject, template: SimpleFileObject)
    {
        await this.lookupNew(file, template)
        await this.lookupOld(file, template)
    }

    /** 对比目录差异
     * @param file 本地目录
     * @param template 对应的模板目录(object)
     */
    async compareWithList(file: FileObject, template: any)
    {
        let template2 = {'name': '', 'tree': template}
        await this.lookupNew(file, SimpleFileObject.FromObject(template2))
        await this.lookupOld(file, SimpleFileObject.FromObject(template2))
    }

    /** 对比目录差异
     * @param file 本地目录
     * @param templateFiles 对应的模板目录下的所有文件(SimpleFileObject[])
     */
    async compareWithSFOs(file: FileObject, templateFiles: SimpleFileObject[])
    {
        await this.lookupNew(file, new SimpleFileObject('', undefined, undefined, templateFiles))
        await this.lookupOld(file, new SimpleFileObject('', undefined, undefined, templateFiles))
    }

    hasDiff()
    {
        let diff = false
        diff = diff || this.oldFiles.length > 0
        diff = diff || this.oldDirs.length > 0
        diff = diff || this.newFiles.size > 0
        diff = diff || this.newDirs.length > 0
        return diff
    }
}