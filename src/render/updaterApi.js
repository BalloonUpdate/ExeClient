const ipcRenderer = typeof require != 'undefined'? require('electron').ipcRenderer:null

class UpdaterApi
{
    dispatchEvent(eventName, ...args)
    {
        let event = new CustomEvent(eventName, { 
            detail: {
                args: args
            }
        })
        document.dispatchEvent(event)
    }

    on(eventName, callback)
    {
        document.addEventListener(eventName, (e) => {
            callback.bind(this)(...e.detail.args)
        })
    }

    setTitle(title) {
        document.querySelector('title').innerText = title
    }

    close() {
        // if(ipcRenderer)
        //     ipcRenderer.send('close')
        if(ipcRenderer)
            window.close()
        else 
            console.log('window close')
    }

    async execute(command, callback) {
        if(ipcRenderer)
        {
            if(callback)
            {
                ipcRenderer.invoke('run-shell', command).then((outputs) => callback(outputs))
            } else {
                return await ipcRenderer.invoke('run-shell', command)
            }
        }
    }

    async getWorkDir()
    {
        if(ipcRenderer)
            return await ipcRenderer.invoke('get-work-dir')
    }

    minimize()
    {
        if(ipcRenderer)
            ipcRenderer.send('set-minimize')
    }

    maximize()
    {
        if(ipcRenderer)
            ipcRenderer.send('set-maximize')
    }

    restore()
    {
        if(ipcRenderer)
            ipcRenderer.send('set-restore')
    }

    center()
    {
        if(ipcRenderer)
            ipcRenderer.send('move-center')
    }

    setSize(width, height)
    {
        if(ipcRenderer)
            ipcRenderer.send('set-size', width, height)
    }

    setFullscreen(isFullscreen)
    {
        if(ipcRenderer)
            ipcRenderer.send('set-fullscreen', isFullscreen)
    }

    start()  {
        if(ipcRenderer)
            ipcRenderer.send('start-update', null)
    }
}

var updaterApi = new UpdaterApi();

if(ipcRenderer)
    ipcRenderer.on('updater-event', (event, eventName, ...argv) => {
        updaterApi.dispatchEvent(eventName, ...argv)
    })