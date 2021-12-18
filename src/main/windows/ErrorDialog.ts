import { app, BrowserWindow } from "electron";

export class Window
{
    win = null as unknown as BrowserWindow

    static async Show(title: string, content: string)
    {
        let window = await new Promise((a, b) => {
            let create = () => a(new BrowserWindow())    
            app.isReady()? create() : app.on('ready', () => create())
        })


        return window
    }
}