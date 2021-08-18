import { HTTPResponseException } from "../exceptions/HTTPResponseException";
import { UnableToDecodeException } from "../exceptions/UnableToDecodeException";
import { LogSys } from "../LogSys";
const yaml = require('js-yaml')
const nodefetch = require('node-fetch');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function httpFetch(url: string): Promise<any>
{
    let raw = null
    try {
        url = encodeURI(url)
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