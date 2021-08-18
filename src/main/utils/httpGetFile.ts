import { FileObject } from "./FileObject"
import { LogSys } from "../LogSys"
import { ConnectionClosedException } from "../exceptions/ConnectionClosedException"
import { UnexpectedHttpCodeExcepetion } from "../exceptions/UnexpectedHttpCodeExcepetion"
import { FileNotExistException } from "../exceptions/FileNotExistException"
import fs = require('fs/promises')
import https = require('https')
import http = require('http')

export async function httpGetFile(url: string, 
    file: FileObject, lengthExpected: number, 
    callback: ((bytesReceived: number, totalReceived: number) => void)|undefined = undefined,
    timeout = 10
):Promise<void>
{
    if(! await file.parent.exists())
        throw new FileNotExistException('The file can not be opened, because it\'s parent do not exist: '+file.parent.path)

    let fileOut = await fs.open(file.path, 'w')

    try {
        await new Promise(((a, b) => {
            url = encodeURI(url).replace(/\+/g, '%2B')
            LogSys.info('req: '+url)

            let module = url.startsWith('https')? https:http
            // module = https
            let httpreq = module.request(url, {
                timeout: timeout
            })

            httpreq.on('response', (response: http.IncomingMessage) => {
                // LogSys.info('statusCode:', response.statusCode);
                // LogSys.info('headers:', response.headers);
                let statusCode = response.statusCode

                let bytesReceived = 0
                let dataReturned = ''

                response.on('data', (data) => {
                    response.pause()
                    if(statusCode != 200)
                    {
                        dataReturned += data.toString()
                        response.resume()
                    } else {
                        fileOut.write(data, 0, data.length).then(() => response.resume())
                        bytesReceived += data.length
                        callback?.(data.length, bytesReceived)
                    }
                })

                response.on('end', () => {
                    if(statusCode != 200)
                        b(new UnexpectedHttpCodeExcepetion('Unexpected httpcode: '+statusCode + ' on '+url, dataReturned))
                    else
                        a(undefined)
                })
            })
    
            httpreq.on('error', (e) => {
                b(new ConnectionClosedException(e.message))
            })
    
            httpreq.end();
        }))
    } finally {
        await fileOut.close()
    }
}