import { BaseException } from "./BaseException";

export class UnexpectedHttpCodeExcepetion extends BaseException
{
    rawdata: string

    constructor(message: string, rawdata: string)
    {
        super(message)
        this.rawdata = rawdata
    }
}