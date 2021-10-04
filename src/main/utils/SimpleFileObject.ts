import { AmbiguousFileTypeException } from "../exceptions/AmbiguousFileTypeException"
import { IsAFileException } from "../exceptions/IsAFileException"
import { MissingParameterException } from "../exceptions/MissingParameterException"
import { FileObject } from "./FileObject"

export class SimpleFileObject
{
    name: string
    length: number|undefined
    hash: string|undefined
    children: SimpleFileObject[]|undefined

    constructor(name: string, length?: number, hash?: string, children?: SimpleFileObject[])
    {
        this.name = name
        this.length = length
        this.hash = hash
        this.children = children

        let isFile = this.isFile()
        let isDir = this.isDir()
        let isVaildFile = typeof this.length != 'undefined' && typeof this.hash != 'undefined'

        if((!isFile && !isDir) || isFile && isDir)
            throw new AmbiguousFileTypeException(name)
        
        if(isFile && !isVaildFile)
            throw new MissingParameterException('missing necessary parameter: \''+(typeof length=='undefined'? 'length':'hash')+'\' ('+name+')')
    }

    isDir(): boolean
    {
        return typeof this.children != 'undefined'
    }

    isFile(): boolean
    {
        return typeof this.length != 'undefined' || typeof this.hash != 'undefined'
    }

    files(): SimpleFileObject[]
    {
        if(this.isFile())
            throw new IsAFileException(this.name)

        return this.children as SimpleFileObject[]
    }

    getByName(name: string): SimpleFileObject | null
    {
        if(this.isFile())
            throw new IsAFileException(this.name)

        for (const child of this.children as SimpleFileObject[])
        {
            if(child.name == name)
                return child
        }

        return null
    }

    async contains(file: string): Promise<boolean>
    {
        return this.getByName(file) != null;
    }

    static FromFile(name: string, length: number, hash: string): SimpleFileObject
    {
        return new SimpleFileObject(name, length, hash)
    }

    static FromDirectory(name: string, children: SimpleFileObject[]): SimpleFileObject
    {
        return new SimpleFileObject(name, undefined, undefined, children)
    }

    /** 不要传数组进来！ */
    static FromObject(obj: any): SimpleFileObject
    {
        if('children' in obj)
        {
            let children = [] as SimpleFileObject[]
            for (const child of obj.children)
                children.push(SimpleFileObject.FromObject(child))
            return new SimpleFileObject(obj.name, undefined, undefined, children)
        } else {
            return new SimpleFileObject(obj.name, obj.length, obj.hash)
        }
    }

    static async FromFileObject(file: FileObject): Promise<SimpleFileObject>
    {
        if(await file.isDir())
        {
            let children = [] as SimpleFileObject[]
            for (const child of await file.files())
                children.push(await SimpleFileObject.FromFileObject(child))
            return new SimpleFileObject(file.name, undefined, undefined, children)
        } else {
            return new SimpleFileObject(file.name, await file.length(), await file.sha1())
        }
    }
}