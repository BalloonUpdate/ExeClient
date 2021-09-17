import { FileObject } from "./FileObject";

export function inArray<T>(el: T, array: T[]): boolean
{
    return array.indexOf(el) != -1
}

export async function countFiles(dir: FileObject): Promise<number>
{
    let c = 0
    for (let d of await dir.files())
        c += (await d.isDir())? await countFiles(d) : 1
    return c
}