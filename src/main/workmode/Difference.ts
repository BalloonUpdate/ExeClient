export class Difference 
{
    public oldFolders: string[] = []
    public oldFiles: string[] = []
    public newFolders: string[] = []
    public newFiles: { [key: string]: number } = {}
}