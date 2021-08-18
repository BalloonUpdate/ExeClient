import { Logger } from "./Logger";
import { Message } from "./Message"

export abstract class Handler
{
    logger: Logger
    filter = 'all'

    constructor(logger: Logger)
    {
        this.logger = logger
    }

    async initialize()
    {

    }

    async deinitialize()
    {

    }

    abstract onMessage(message: Message): Promise<void>
}