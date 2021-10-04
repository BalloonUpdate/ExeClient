import { ConsoleHandler } from "./Handlers/ConsoleHandler";
import { FileHandler } from "./Handlers/FileHandler";
import { Logger } from "./Logger";
import { FileObject } from "../utils/FileObject";
const util = require('util')
const yaml = require('js-yaml')

export class LogSys
{
    static logger = null as unknown as Logger

    static async init(logFile: FileObject): Promise<void>
    {
        this.logger = new Logger()

        let fh = new FileHandler(this.logger, logFile, true)
        let ch = new ConsoleHandler(this.logger)

        ch.filter = 'info'

        await this.logger.addHandler('file', fh)
        await this.logger.addHandler('console', ch)
    }

    static debug(message: any): void
    {
        this.log('debug', message)
    }

    static info(message: any): void
    {
        this.log('info', message)
    }

    static warn(message: any): void
    {
        this.log('warn', message)
    }

    static error(message: any): void
    {
        this.log('error', message)
    }

    static log(level: string, message: any): void
    {
        if(LogSys.logger)
        {
            if(typeof message == 'object' && !(message instanceof Error))
                message = yaml.dump(message, undefined, 4)
            this.logger.log(level, message.toString())
        } else {
            console.error('LogSys is not initialized!!: ', message)
        }
    }

    static serialize(obj: any): any
    {
        return util.inspect(obj, {
            showHidden: true,
            depth: 10,
        })
    }
}