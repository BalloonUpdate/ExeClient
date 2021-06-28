import { FileNotExistException } from "../exceptions/FileNotExistException"
import { IsADirectoryException } from "../exceptions/IsADirectoryException"
import { IsAFileException } from "../exceptions/IsAFileException"

import path = require('path')
import fs = require('fs/promises')
import crypto = require('crypto')

export class FileObject
{
    filePath: string

    constructor(filepath: string)
    {
        this.filePath = path.resolve(filepath)
    }
    
    async isDir()
    {
        return (await fs.stat(this.filePath)).isDirectory()
    }

    async isFile()
    {
        return (await fs.stat(this.filePath)).isFile()
    }

    async exists()
    {
        try {
            await fs.access(this.filePath)
            return true
        } catch(e) {
            return false
        }
    }

    async rename(oldPath: string, newPath: string)
    {
        return await fs.rename(oldPath, newPath)
    }

    async mkdirs()
    {
        if(! await this.exists())
            await fs.mkdir(this.filePath, { recursive: true })
    }

    async makeParentDirs()
    {
        if(! await this.parent.exists())
            await this.parent.mkdirs()
    }

    async create(content?: string)
    {
        if(! await this.exists())
        {
            await this.makeParentDirs()
            await this.write(content ?? '')
            return true
        }
        return false
    }

    async read()
    {
        if(! await this.exists())
            throw new FileNotExistException(this.filePath)
        if(await this.isDir())
            throw new IsADirectoryException(this.filePath)
        
        return await fs.readFile(this.filePath, 'utf-8')
    }

    async write(data: string)
    {
        if(await this.isDir())
            throw new IsADirectoryException(this.filePath)

        await fs.writeFile(this.filePath, data, 'utf-8')
    }

    async length()
    {
        if(this.isFile())
            return (await fs.stat(this.filePath)).size
        return (await this.files()).length;
    }

    async files()
    {
        if(! await this.exists())
            throw new FileNotExistException(this.filePath)
        if(await this.isFile())
            throw new IsAFileException(this.filePath)

        let result = []

        for await(const child of await fs.opendir(this.filePath))
            result.push(this.append(child.name))

        return result
    }

    async isDirty()
    {
        if(! await this.exists())
            throw new FileNotExistException(this.filePath)
        
        return await this.length();
    }

    async clear()
    {
        if(! await this.exists())
            return
        
        if(await this.isFile())
        {
            this.write('')
            return
        }

        for(const it of await this.files())
            it.delete()
    }

    // async copyTo(dist: string|File)
    // {
    //     let target = dist instanceof File? dist:new File(dist)

    //     if(! await this.exists())
    //         throw new FileNotExistException(this.filePath)
        
        
    // }

    async delete()
    {
        await fs.rm(this.filePath, {
            force: true,
            recursive: true
        })
    }

    async contains(file: string)
    {
        return await (this.append(file)).exists();
    }

    async relativePath(basePath?: string|FileObject): Promise<string>
    {
        if(!basePath)
            return path.relative(process.cwd(), this.filePath).replace(/\\/g, "/")
        
        let from = basePath instanceof FileObject? basePath:new FileObject(basePath)
        let to = this.filePath

        if(await from.isFile())
            throw new IsAFileException(from.path)
        
        return path.relative(from.path, to).replace(/\\/g, "/")
    }

    async sha1()
    {
        if(await this.isDir())
            throw new IsADirectoryException(this.filePath)
        
        let hash = crypto.createHash('sha1');
        let handle = await fs.open(this.filePath, 'r')
        let buf = Buffer.alloc(4 * 1024);
        let bytesRead = 0

        do {
            bytesRead = (await handle.read(buf, 0, buf.length, null)).bytesRead
            hash.update(Buffer.from(buf.buffer, 0, bytesRead))
        } while(bytesRead > 0);

        handle.close()
        return hash.digest('hex')
    }

    get path()
    {
        return this.filePath.replace(/\\/g, "/")
    }

    get name()
    {
        return path.basename(this.filePath)
    }

    get parent()
    {
        return new FileObject(path.dirname(this.filePath))
    }

    append(pathAppend: string)
    {
        return new FileObject(path.join(this.filePath, pathAppend))
    }

    toString()
    {
        return this.path;
    }
}