import { FileObject } from "../utils/FileObject";
import { SimpleFileObject } from "../utils/SimpleFileObject";
import { BaseWorkMode } from "./BaseWorkMode";

/** 默认只同步存在于服务器的上的文件，服务器没有的文件不做任何变动
    如果指定了正则表达式，则会使用正则表达式进行删除
    匹配的文件会直接被删除，即使是存在于服务器的上的文件也是如此(高优先级)
    不匹配的文件会被忽略掉，并按第一行的规则进行处理
 */
export class ExistMode extends BaseWorkMode
{
    async scan(dir: FileObject, tree: SimpleFileObject[]): Promise<void> 
    {
        await this.walk(dir, tree, dir)
    }

    async walk(dir: FileObject, tree: SimpleFileObject[], base: FileObject)
    {
        // 计算出要删除的文件
        for (const d of await dir.files())
        {
            if(this.test(await d.relativePath(base)))
                await this.delete(d)
        }

        // 计算出要更新的文件
        for (const t of tree)
        {
            let d = dir.append(t.name)
            let dPath = await d.relativePath(base)

            // 如果是属于要删除的文件就不进行下载了
            if(this.test(dPath))
                continue
            
            if(await d.exists())
            {
                if(t.isFile()) // 远端是一个文件
                {
                    if(await d.sha1() != t.hash)
                    {
                        await this.delete(d)
                        await this.download(t, d)
                    }
                } else {
                    await this.walk(d, t.children as SimpleFileObject[], base)
                }
            } else {
                await this.download(t, d)
            }
        }
    }
    
}