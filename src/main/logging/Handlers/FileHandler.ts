import { FileObject } from "../../utils/FileObject";
import { Handler } from "../Handler";
import { Message } from "../Message";
import { string_format } from "../../utils/string-format";
import { Logger } from "../Logger";
import moment = require('moment')
import fs = require('fs/promises')

export class FileHandler extends Handler
{
    eol = '\n'
    clean: boolean
    file: FileObject
    fileHandle = null as unknown as fs.FileHandle
    
    constructor(logger: Logger, file: FileObject, clean: boolean)
    {
        super(logger)
        this.file = file
        this.clean = clean
    }

    async initialize(): Promise<void> 
    {
        await this.file.makeParentDirs()
        this.fileHandle = await fs.open(this.file.path, this.clean?'w':'a')
    }

    async deinitialize(): Promise<void> 
    {
        await this.fileHandle.close()
    }

    async writeLine(message: string): Promise<void>
    {
        await this.fileHandle.write(message)
    }

    async onMessage(message: Message): Promise<void> 
    {
        let template = '[ %s %-5s ] '
        let datetime = moment(message.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS Z')
        let level = message.level
        
        let prefix = string_format(template, datetime, level.toUpperCase())
        let text = prefix + message.message
        
        if(message.multiLineIndent)
            text = text.replace(/\n/g, '\n'+prefix)

        await this.writeLine(text + this.eol)
    }
}