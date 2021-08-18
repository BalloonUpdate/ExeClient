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

    async initialize(): Promise<void>
    {

    }

    async deinitialize(): Promise<void>
    {

    }

    abstract onMessage(message: Message): Promise<void>
}