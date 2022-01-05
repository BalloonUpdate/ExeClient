import { HTTPResponseException } from "../exceptions/HTTPResponseException";
import { UnableToDecodeException } from "../exceptions/UnableToDecodeException";
import { LogSys } from "../logging/LogSys";
import { appendQueryParam } from "./utility";
const yaml = require('js-yaml')
const nodefetch = require('node-fetch');

export async function httpFetch(url: string, http_no_cache: string|undefined = undefined): Promise<any>
{
    let raw = null
    try {
        url = encodeURI(url)

        // 避免缓存
        if(http_no_cache != undefined)
            url = appendQueryParam(url, http_no_cache, new Date().getTime().toString())

        let response = await nodefetch(url)

        // response.status >= 200 && response.status < 300
        if (!response.ok) 
            throw new HTTPResponseException(`HTTP Error Response: ${response.status} ${response.statusText} on ${url}`);
        
            raw = await response.text()
    } catch(e) {
        throw new HTTPResponseException(e.name + ': ' + e.message);
    }

    try {
        return yaml.load(raw)
    } catch (error) {
        LogSys.error('\n\n-------------------- RAWDATA from '+url+' --------------------\n'+raw+'\n-------------------- RAWDATAEND from '+url+' --------------------')
        throw new UnableToDecodeException('RawUrl: '+url+'\n'+error)
    }
}