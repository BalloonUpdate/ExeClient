const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

function createWindow () 
{
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    win.loadFile(path.join(__dirname, "../src/render/index.html"))
    win.webContents.openDevTools()

    ipcMain.once('start-update', (event: any, arg: any) => {
        console.log('sssssssssss')
    })

    ipcMain.on('close', (event: any, arg: any) => {
        console.log('close event')
    })

    win.webContents.send('updater-ready')
}

app.on('ready', () => {
    createWindow()
})

app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) 
        createWindow()
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})