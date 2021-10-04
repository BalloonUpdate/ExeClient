import { string_format } from "../../utils/string-format";
import { Handler } from "../Handler";
import { Message } from "../Message";
import moment = require('moment')

export class ConsoleHandler extends Handler
{
    async onMessage(message: Message): Promise<void>
    {
        let template = '%s %-1s | '
        let datetime = moment(message.timestamp).format('HH:mm:ss')
        let level = message.level

        let prefix = string_format(template, datetime, level.toUpperCase().substring(0, 1))
        let text = prefix + message.message

        if(message.multiLineIndent)
            text = text.replace(/\n/g, '\n'+prefix)

        console.log(text)
    }
}