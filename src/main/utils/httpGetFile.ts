import { FileObject } from "./FileObject"
import fs = require('fs/promises')
import https = require('https')
import http = require('http')
import { LogSys } from "../LogSys"
import { ConnectionClosedException } from "../exceptions/ConnectionClosedException"
import { UnexpectedHttpCodeExcepetion } from "../exceptions/UnexpectedHttpCodeExcepetion"
import { FileNotExistException } from "../exceptions/FileNotExistException"

export async function httpGetFile(url: string, 
    file: FileObject, lengthExpected: number, 
    callback: (bytesReceived: number, totalReceived: number) => void = () => {},
    timeout = 10
){
    if(! await file.parent.exists())
        throw new FileNotExistException('The file can not be opened, because it\'s parent do not exist: '+file.parent.path)

    let fileOut = await fs.open(file.path, 'w')

    try {
        await new Promise(((a, b) => {
            LogSys.info('req: '+url)
            url = url.replace(/\\+/g, '%2B')

            let req = (url.startsWith('https')? https:http).request(url, {
                timeout: timeout
            })

            req.on('response', (response) => {
                // LogSys.info('statusCode:', response.statusCode);
                // LogSys.info('headers:', response.headers);
                
                let bytesReceived = 0
                let dataReturned = ''
                
                response.on('data', (data) => {
                    if(response.statusCode != 200)
                    {
                        dataReturned += data.toString()
                    } else {
                        fileOut.write(data, 0, data.length)
                        // LogSys.info(data.length)
                        bytesReceived += data.length
                        callback(data.length, bytesReceived)
                    }
                })

                response.on('end', () => {
                    if(response.statusCode != 200)
                        b(new UnexpectedHttpCodeExcepetion('Unexpected httpcode: '+response.statusCode + ' on '+url, dataReturned))
                    else
                        a(undefined)
                })
            })
    
            req.on('error', (e) => {
                b(new ConnectionClosedException(e.message))
            })
    
            req.end();
        }))
    } finally {
        await fileOut.close()
    }
}