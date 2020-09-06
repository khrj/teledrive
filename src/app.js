const { app, BrowserWindow, shell, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('path');
const { authenticate, create, updateInfo, cleanQuit } = require(path.join(__dirname, 'telegram-binder', 'index.js'))

// Auto updates
const { autoUpdater } = require("electron-updater")
autoUpdater.checkForUpdatesAndNotify()

let mainWindow
const createWindow = async () => {
    mainWindow = new Promise(async resolve => {
        let window = new BrowserWindow({
            width: 400,
            height: 650,
            minWidth: 400,
            minHeight: 600,
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
            if (app.quitting) {
                window = null
                app.quit()
            } else {
                event.preventDefault()
                window.hide()
            }
        })

        resolve(window)
    })
};

let tray
let client
app.on('ready', async () => {
    if (process.platform === 'darwin') {
        tray = new Tray(path.join(app.getAppPath(), 'icon', 'trayTemplate.png'))
    } else if (process.platform === 'win32') {
        tray = new Tray(path.join(app.getAppPath(), 'icon', 'tray.ico'))
    } else {
        tray = new Tray(path.join(app.getAppPath(), 'icon', 'tray.png'))
    }

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show', click: async _ => { (await mainWindow).show() } },
        { label: 'Quit', click: app.quit }
    ])

    contextMenu.items[1].checked = false
    tray.setToolTip('TeleDrive')
    tray.setContextMenu(contextMenu)

    if (process.platform !== "darwin") {
        tray.on('click', async _ => {
            (await mainWindow).show()
        })
    }

    const osMap = {
        "Linux": "linux",
        "Windows_NT": "win",
        "Darwin": "mac"
    }
    client = create(app.getPath('userData'), app.getAppPath(), osMap[require('os').type()])
    // noinspection ES6MissingAwait
    createWindow()
    authenticate(client, mainWindow)
    updateInfo(client, mainWindow, app.getPath('userData'), app.getVersion())

    app.on('activate', async () => {
        (await mainWindow).show()
    })
})

app.on('window-all-closed', _ => {
}) // Prevent default

app.on('before-quit', async _ => {
    // We need to finish the queue, flush the tdlib ram, and make the window close instead of hide
    app.quitting = true
        ; (await mainWindow).show()
        ; (await mainWindow).webContents.send('quit')
    await cleanQuit()
    await client.api.close()
    require('electron-log').info("[AIRGRAM CLEAN]")
})
