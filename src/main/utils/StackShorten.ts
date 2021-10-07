import { app } from "electron"
import strReplace from './StringReplace'
import path = require('path')

export default function(stack: string)
{
    stack = strReplace(stack, '\\', '/')
    if(app.isPackaged)
    {
        let progdir = strReplace(path.dirname(process.argv[0]), '\\', '/')+'/resources/app/'
        // let progdir = path.dirname(path.dirname(path.dirname(__filename)))
        stack = strReplace(stack, progdir, '')
    } else {
        let progdir = strReplace(process.cwd(), '\\', '/') + '/'
        stack = strReplace(stack, progdir, '')
    }
    return stack
}