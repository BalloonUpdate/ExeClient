export class Message
{
    level: string
    message: string
    timestamp: number
    multiLineIndent: boolean

    constructor(level: string, message: string, multiLineIndent=true)
    {
        this.level = level
        this.message = message
        this.timestamp = new Date().getTime()
        this.multiLineIndent = multiLineIndent
    }
}