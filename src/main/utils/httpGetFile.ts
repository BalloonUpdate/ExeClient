import { FileObject } from "./FileObject"
import { LogSys } from "../logging/LogSys"
import { ConnectionClosedException } from "../exceptions/ConnectionClosedException"
import { UnexpectedHttpCodeExcepetion } from "../exceptions/UnexpectedHttpCodeExcepetion"
import { FileNotExistException } from "../exceptions/FileNotExistException"
import { RedirectionFailedException } from "../exceptions/RedirectionFailedException"
import { MaxRedirectionReachedException } from "../exceptions/MaxRedirectionReachedException"
import fs = require('fs/promises')
import https = require('https')
import http = require('http')
import { appendQueryParam } from "./utility"

export async function httpGetFile(url: string, 
    file: FileObject, lengthExpected: number, 
    callback: ((bytesReceived: number, totalReceived: number) => void)|undefined = undefined,
    http_no_cache: string|undefined = undefined,
    timeout = 10
):Promise<void> {
    if(! await file.parent.exists())
        throw new FileNotExistException('The file can not be opened, because it\'s parent do not exist: '+file.parent.path)

    let fileOut = await fs.open(file.path, 'w')
    let rawUrl = url
    url = encodeURI(url).replace(/\+/g, '%2B')

    try {
        let loopLimit = 10
        let sendRequest = async (url2: string) => {
            // 避免缓存
            if(http_no_cache != undefined)
                url2 = appendQueryParam(url2, http_no_cache, new Date().getTime().toString())
            
            if(loopLimit -- <=0)
                throw new MaxRedirectionReachedException()

            let bytesReceived = 0
            let dataReturned = ''
                
            let dl = new Promise(((a, b) => {
                LogSys.debug('发起请求: '+url2 + ' (' + rawUrl + ')')
    
                let module = url2.startsWith('https')? https:http
                let httpreq = module.request(url2, { timeout: timeout })
    
                httpreq.on('response', (response: http.IncomingMessage) => {
                    let statusCode = response.statusCode
    
                    if(statusCode && statusCode >= 300 && statusCode < 400)
                    {
                        LogSys.debug('HTTP重定向('+statusCode+'): '+url2)
                        if(response.headers.location)
                        {
                            sendRequest(response.headers.location).then(() => { a(undefined) })
                        } else {
                            b(new RedirectionFailedException('No \'Location\' presented in the HttpHeaders of a 3xx Response'))
                        }
                    } else {
                        
        
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

            let retries = 5
            while(true)
            {
                try {
                    await dl
                    break
                } catch (e) {
                    retries -= 1

                    if(retries <= 0)
                        throw e

                    continue
                }
            }
        }

        await sendRequest(url)
    } finally {
        await fileOut.close()
    }
}