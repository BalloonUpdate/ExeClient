import { HTTPResponseException } from "../exceptions/HTTPResponseException";
import { UnableToDecodeException } from "../exceptions/UnableToDecodeException";
const yaml = require('js-yaml')

const nodefetch = require('node-fetch');

export async function httpFetch(url: string)
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
        throw new UnableToDecodeException('RawUrl: '+url+'\n'+error)
    }
}