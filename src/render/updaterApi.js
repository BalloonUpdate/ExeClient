const { ipcRenderer } = require('electron')

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
        document.querySelector('title').innerText
    }

    close() {
        ipcRenderer.send('close')
    }

    execute(command) {
        if(!this.inDev)
            this.getWorkDirectory().then(wd => pywebview.api.execute('cd /D "'+wd+'" && '+command))
        else
            console.log('execute: '+command)
    }

    async getWorkDirectory() {
        if(!this.inDev)
            return pywebview.api.getWorkDirectory()
        else
            return ''
    }

    async getUrl() {
        if(!this.inDev)
            return pywebview.api.getUrl()
        else
            return location.pathname
    }

    loadUrl(url) {
        if(!this.inDev)
            pywebview.api.loadUrl(url)
        else
            window.open(url)
    }

    start()  {
        if(!this.inDev)
            pywebview.api.startUpdate()
        else
            console.log('startUpdate!')
    }

}

var updaterApi = new UpdaterApi();

ipcRenderer.once('updater-ready', (event, message) => {

})

ocument.querySelector('title').innerText