import { FileObject } from "./FileObject"
import { LogSys } from "../LogSys"
import { ConnectionClosedException } from "../exceptions/ConnectionClosedException"
import { UnexpectedHttpCodeExcepetion } from "../exceptions/UnexpectedHttpCodeExcepetion"
import { FileNotExistException } from "../exceptions/FileNotExistException"
import { RedirectionFailedException } from "../exceptions/RedirectionFailedException"
import { MaxRedirectionReachedException } from "../exceptions/MaxRedirectionReachedException"
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
    url = encodeURI(url).replace(/\+/g, '%2B')

    try {
        let loopLimit = 10
        let sendRequest = async (url2: string) => {
            if(loopLimit -- <=0)
                throw new MaxRedirectionReachedException()
            await new Promise(((a, b) => {
                LogSys.debug('req: '+url2)
    
                let module = url2.startsWith('https')? https:http
                // module = https
                let httpreq = module.request(url2, {
                    timeout: timeout
                })
    
                httpreq.on('response', (response: http.IncomingMessage) => {
                    // LogSys.info('statusCode:', response.statusCode);
                    // LogSys.info('headers:', response.headers);
                    let statusCode = response.statusCode
    
                    if(statusCode && statusCode >= 300 && statusCode < 400)
                    {
                        LogSys.debug('redirect('+statusCode+'): '+url2)
                        if(response.headers.location)
                        {
                            sendRequest(response.headers.location).then(() => { a(undefined) })
                        } else {
                            b(new RedirectionFailedException('No \'Location\' presented in the HttpHeaders of a 3xx Response'))
                        }
                    } else {
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
                            if(!statusCode || statusCode < 200 || statusCode >= 300)
                                b(new UnexpectedHttpCodeExcepetion('Unexpected httpcode: '+statusCode + ' on '+url2, dataReturned))
                            else
                                a(undefined)
                        })
                    }
                })
        
                httpreq.on('error', (e) => {
                    b(new ConnectionClosedException(e.message))
                })
        
                httpreq.end()
            }))
        }
        await sendRequest(url)
    } finally {
        await fileOut.close()
    }
}