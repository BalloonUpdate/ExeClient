import { Handler } from "./Handler";
import { Message } from "./Message";

export class Logger
{
    handlers: any
    levels: string[]
    linesBuffered: Message[]
    isWritting = false

    constructor()
    {
        this.handlers = {}
        this.linesBuffered = []
        this.levels = [
            'all',
            'debug',
            'info',
            'warn',
            'error',
            'none'
        ]
    }

    async addHandler(name: string, handler: Handler): Promise<void>
    {
        if(name in this.handlers)
        {
            let hld = this.handlers[name] as Handler
            await hld.deinitialize()
        }
        this.handlers[name] = handler
        await handler.initialize()
    }

    debug(message: string): void
    {
        this.log('debug', message)
    }

    info(message: string): void
    {
        this.log('info', message)
    }

    warn(message: string): void
    {
        this.log('warn', message)
    }

    error(message: string): void
    {
        this.log('error', message)
    }

    log(level: string, message: string): void
    {
        let msg = new Message(level, message)
        this.linesBuffered.push(msg)

        this.writeLine()
    }

    isFiltered(level: string, handler: Handler): boolean
    {
        let l1 = this.levels.indexOf(level)
        let l2 = this.levels.indexOf(handler.filter)
        return l1 >= l2
    }

    private async writeLine(): Promise<void>
    {
        if(this.isWritting)
            return

        this.isWritting = true
        while(this.linesBuffered.length > 0)
        {
            let line = this.linesBuffered.shift() as Message

            let promises = []
            for (const name in this.handlers)
            {
                let hld = this.handlers[name] as Handler
                if(this.isFiltered(line.level, hld))
                promises.push(hld.onMessage(line))
            }
            await Promise.all(promises)
        }
        this.isWritting = false
    }
}