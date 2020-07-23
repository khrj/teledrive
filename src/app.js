const {app, BrowserWindow, shell, ipcMain, dialog} = require('electron');
const path = require('path');
const {authenticate, create, updateInfo} = require(path.join(__dirname, 'telegram-binder', 'index.js'))

let mainWindow
const createWindow = async () => {
    mainWindow = new Promise(async resolve => {
        let window = new BrowserWindow({
            width: 425,
            height: 750,
            minWidth: 400,
            minHeight: 700,
            titleBarStyle: 'hiddenInset',
            webPreferences: {
                nodeIntegration: true
            }
        })

        window.removeMenu()

        await window.loadFile(path.join(__dirname, 'window', 'index.html'));
        // window.webContents.openDevTools();
        window.webContents.on('new-window', function (event, url) {
            event.preventDefault()
            // noinspection JSIgnoredPromiseFromCall
            shell.openExternal(url)
        })

        window.on('close', (event) => {
            if (app.quitting || process.platform !== 'darwin') { 
                window = null
                app.quit()
            } else { // Only for darwin //TODO
                event.preventDefault()
                window.hide()
            }
        })

        resolve(window)
    })
};

app.on('ready', async () => {
    const osMap = {
        "Linux": "linux",
        "Windows_NT": "win",
        "Darwin": "mac"
    }
    const client = create(app.getPath('userData'), app.getAppPath(), osMap[require('os').type()])
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

app.on('window-all-closed', _ => {}) // Prevent default
app.on('before-quit', () => app.quitting = true)
