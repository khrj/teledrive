const {app, BrowserWindow, shell, ipcMain, dialog} = require('electron');
const path = require('path');
const {authenticate, create, updateInfo} = require(path.join(__dirname, 'telegram-binder', 'index.js'))

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
    app.quit();
}

let mainWindow
const createWindow = async () => {
    mainWindow = new Promise(async resolve => {
        let window = new BrowserWindow({
            width: 425,
            height: 750,
            minWidth: 425,
            minHeight: 750,
            titleBarStyle: 'hiddenInset',
            webPreferences: {
                nodeIntegration: true
            }
        })

        await window.loadFile(path.join(__dirname, 'window', 'index.html'));
        // window.webContents.openDevTools();
        window.webContents.on('new-window', function (event, url) {
            event.preventDefault()
            // noinspection JSIgnoredPromiseFromCall
            shell.openExternal(url)
        })

        window.on('close', (event) => {
            if (app.quitting) {
                window = null
            } else {
                event.preventDefault()
                window.hide()
            }
        })

        resolve(window)
    })
};

app.on('ready', async () => {
    const client = create(app.getPath('userData'), app.getAppPath())
    // noinspection ES6MissingAwait
    createWindow()
    authenticate(client, mainWindow)
    updateInfo(client, mainWindow, app.getPath('userData'), app.getVersion())

    app.on('activate', async () => {
        (await mainWindow).show()
    })

    ipcMain.on("discredit", () => {
        dialog.showMessageBoxSync({type: "error", title: "Oh no you don't", message: "Don't you discredit me", detail: "This incident will be reported"})
        process.exit(1)
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => app.quitting = true)
