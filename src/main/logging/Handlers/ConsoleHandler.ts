import { string_format } from "../../utils/string-format";
import { Handler } from "../Handler";
import { Message } from "../Message";
import moment = require('moment')

export class ConsoleHandler extends Handler
{
    async onMessage(message: Message)
    {
        let template = '[ %s %-5s ] '
        let datetime = moment(message.timestamp).format('MM-DD HH:mm:ss.SSS')
        let level = message.level

        let prefix = string_format(template, datetime, level.toUpperCase())
        let text = prefix + message.message

        if(message.multiLineIndent)
            text = text.replace(/\n/g, '\n'+prefix)

        console.log(text)
    }
}