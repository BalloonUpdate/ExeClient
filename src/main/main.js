const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs/promises');
const { Updater } = require('./updater');
const { UpdaterIPC } = require('./UpdaterIPC');

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

    win.loadFile(path.join(__dirname, "../../src/render/index.html"))
    win.webContents.openDevTools()

    ipcMain.once('start-update', async (event, arg) => {
        new Updater(new UpdaterIPC(win)).main().then(() => {
            setTimeout(() => {
                // app.quit()
            }, 1500);
        }).catch((e) => {
            console.log(e)
        })
    })

    ipcMain.on('close', (event, arg) => {
        console.log('close event')
        app.quit()
    })

    win.once('ready-to-show', () => {
        win.webContents.send('updater-ready')
    })
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