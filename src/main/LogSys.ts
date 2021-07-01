import { ConsoleHandler } from "./logging/Handlers/ConsoleHandler";
import { FileHandler } from "./logging/Handlers/FileHandler";
import { Logger } from "./logging/Logger";
import { FileObject } from "./utils/FileObject";

export class LogSys
{
    static logger: Logger

    static async init(logFile: FileObject)
    {
        logFile.makeParentDirs()
        
        this.logger = new Logger()

        let fh = new FileHandler(this.logger, logFile, true)
        let ch = new ConsoleHandler(this.logger)

        ch.filter = 'info'

        await this.logger.addHandler('file', fh)
        await this.logger.addHandler('console', ch)
    }

    static debug(message: any)
    {
        this.log('debug', message)
    }

    static info(message: any)
    {
        this.log('info', message)
    }

    static warn(message: any)
    {
        this.log('warn', message)
    }

    static error(message: any)
    {
        this.log('error', message)
    }

    static log(level: string, message: any)
    {
        if(typeof message == 'object')
            message = JSON.stringify(message, undefined, 4)
        this.logger.log(level, message.toString())
    }
}