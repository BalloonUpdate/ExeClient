export class Difference 
{
    public oldFolders: string[] = []
    public oldFiles: string[] = []
    public newFolders: string[] = []
    public newFiles: { [key: string]: NewFile } = {}
}

export interface NewFile {
    len: number,
    mtime?: number
}