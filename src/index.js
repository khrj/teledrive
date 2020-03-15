// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const chokidar = require('chokidar')
const fs = require('fs')
const { Airgram, Auth, toObject } = require('airgram')
const { EventEmitter } = require('events')
const status = new EventEmitter()
let myInfo;

// TelePath
const teleDir = app.getPath('home') + '/TeleDriveSynced/'

// Login Window
let mainWindow

// Electron
{
    app.on('ready', openLoginWindow)
    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin' || !myInfo) app.quit()
    })

    app.on('activate', function () {
        if (mainWindow === null) openLoginWindow()
    })

    function openLoginWindow () {
        console.log('No window. Creating window.')
        mainWindow = new BrowserWindow({
            width: 700,
            height: 800,
            minWidth: 425,
            minHeight: 750,
            titleBarStyle: 'hiddenInset',
            webPreferences: {
                nodeIntegration: true
            }
        })

        mainWindow.loadFile('src/signin/index.html').then(() => {
            status.emit('ready')
            if (myInfo) {
                mainWindow.webContents.send('authSuccess', myInfo)
            }
        })

        mainWindow.webContents.openDevTools()

         mainWindow.on('closed', function () {
             mainWindow = null
         })
    }
}
// Watcher
{
    let watcher

    if (!fs.existsSync(teleDir)) {
        console.log('DIR DOESN\'T EXIST')
        fs.mkdir(teleDir, addWatches)
    } else {
        console.log('DIR ALREADY EXISTS')
        addWatches()
    }

    function addWatches () {
        watcher = chokidar.watch(teleDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true
        })

        console.log('Added Watches')
        watcher
             .on('add', function (path) {
                 console.log('File', path, 'has been added')
             })
             .on('change', function (path) {
                 console.log('File', path, 'has been changed')
             })
             .on('unlink', function (path) {
                 console.log('File', path, 'has been removed')
             })
             .on('error', function (error) {
                 console.error('Error occurred', error)
             })
    }
}

const client = new Airgram({
    apiId: '1013617',
    apiHash: 'f5837e894e244b9b5ca1b4ad7c48fddb',
    command: './tdlib/libtdjson',
    logVerbosityLevel: 2,
    deviceModel: process.platform
})

client.use(new Auth({
    phoneNumber: () => get('phoneNumber'),
    code: () => get('authCode'),
    password: () => get('password')
}))

let ready = new Promise(resolve => {
    status.on('ready', () => {
        console.log('ready')
        resolve()
    })
})

async function get(what) {
    console.log("Getting " + what)
    await ready.then(() => {
        mainWindow.webContents.send('auth', what)
    })
    return new Promise(resolve => {
        ipcMain.on(what, (event, message) => {
            resolve(message)
        })
    })
}

void (async function () {
    const me = toObject(await client.api.getMe())
    const fullName = me.lastName ? me.firstName + me.lastName : me.firstName
    myInfo = {
        name: fullName,
        number: '+' + me.phoneNumber,
        photo: me.profilePhoto.small
    }
    mainWindow.webContents.send('authSuccess', myInfo)
    console.log('[Me] ', me)

    const { response: chats } = await client.api.getChats({
        limit: 10,
        offsetChatId: 0,
        offsetOrder: '9223372036854775807'
    })
    console.log('[My chats] ', chats)
})()

// Getting all updates
client.use((ctx, next) => {
    if ('update' in ctx) {
        console.log(`[all updates][${ctx._}]`, JSON.stringify(ctx.update))
    }
    return next()
})

// Getting new messages
client.on('updateNewMessage', async ({ update }) => {
    const { message } = update
    console.log('[new message]', message)
})

ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog({
        properties: ['openFile', 'openDirectory']
    }, (files) => {
        if (files) {
            event.sender.send('selected-directory', files)
            console.log('FILES:')
            console.log(files)
        }
    })
})
