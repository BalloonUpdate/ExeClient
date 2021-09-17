import { FileObject } from "../utils/FileObject";
import { SimpleFileObject } from "../utils/SimpleFileObject";
import { AbstractMode } from "./AbstractMode";

/** 默认只同步存在于服务器的上的文件，服务器没有的文件不做任何变动
    如果指定了正则表达式，则会使用正则表达式进行删除
    匹配的文件会直接被删除，即使是存在于服务器的上的文件也是如此(高优先级)
    不匹配的文件会被忽略掉，并按第一行的规则进行处理
 */
export class ExistMode extends AbstractMode
{
    async _compare(onScan: (file: FileObject) => Promise<void>): Promise<void> 
    {
        await this.walk(this.local, this.remote, this.local, onScan)
    }

    async walk(local: FileObject, remote: SimpleFileObject[], base: FileObject, onScan: (file: FileObject) => Promise<void>): Promise<void>
    {
        // 计算出要删除的文件
        for (const l of await local.files())
        {
            if(this.test(await l.relativePath(base)))
                await this.markAsOld(l)
        }

        // 计算出要更新的文件
        for (const r of remote)
        {
            let l = local.append(r.name)

            // 如果是属于要删除的文件就不进行下载了
            if(this.test(await l.relativePath(base)))
                continue

            if (onScan != null)
                await onScan(l)
            
            if(await l.exists())
            {
                if(r.isFile()) // 远端是一个文件
                {
                    if(await l.sha1() != r.hash)
                    {
                        await this.markAsOld(l)
                        await this.markAsNew(r, l)
                    }
                } else {
                    await this.walk(l, r.children as SimpleFileObject[], base, onScan)
                }
            } else {
                await this.markAsNew(r, l)
            }
        }
    }
    
}