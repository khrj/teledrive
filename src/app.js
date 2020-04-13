// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const Store = require('electron-store')
const store = new Store()
const chokidar = require('chokidar')
const fs = require('fs')
const { Airgram, Auth, toObject } = require('airgram')
const { EventEmitter } = require('events')
const status = new EventEmitter()
const appStorage = app.getPath('userData')
let myInfo

// TelePath
let teleDir = new Promise(resolve => {
    status.on('authSuccess', () => {
        let stored = store.get('teleDir')
        if (stored) {
            resolve(stored)
        }
        ipcMain.on('openFileDialog', () => {
            dialog.showOpenDialog({ properties: ['openDirectory'] }).then((value) => {
                if (!value.canceled) {
                    let toResolve = value.filePaths[0] + '/TeleDriveSync/'
                    store.set('teleDir', toResolve)
                    resolve(toResolve)
                }
            })
        })
    })
})

// Login Window
let mainWindow

// Electron
{
    app.on('ready', openWindow)
    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin' || !myInfo) app.quit()
    })

    app.on('activate', function () {
        if (mainWindow === null) openWindow()
    })

    function openWindow () {
        mainWindow = new BrowserWindow({
            width: 425,
            height: 750,
            minWidth: 425,
            minHeight: 750,
            titleBarStyle: 'hiddenInset',
            webPreferences: {
                nodeIntegration: true
            }
        })

        mainWindow.webContentsReady = new Promise(resolve => {
            status.on('ready', () => {
                resolve()
            })
        })

        mainWindow.loadFile('src/signin/index.html').then(() => {
            status.emit('ready')
            if (myInfo) {
                mainWindow.webContents.send('authSuccess')
                mainWindow.webContents.send('updateMyInfo', myInfo)
            }
            teleDir.then((selectedDir) => {
                mainWindow.webContents.send('selectedDir', selectedDir)
            })
        })

        mainWindow.webContents.on('new-window', function (event, url) {
            event.preventDefault()
            // noinspection JSIgnoredPromiseFromCall
            shell.openExternal(url)
        })

        //mainWindow.webContents.openDevTools()

        mainWindow.on('closed', function () {
            mainWindow = null
        })
    }
}

teleDir.then(/** @param {string} selectedDir */ (selectedDir) => {
    // Watcher
    {
        let watcher
        if (!fs.existsSync(selectedDir)) {
            fs.mkdir(selectedDir, {}, addWatches)
        } else {
            addWatches()
        }

        function addWatches () {
            watcher = chokidar.watch(selectedDir, {
                ignored: /(^|[\/\\])\../, // ignore dotfiles
                persistent: true
            })
            watcher
                 .on('add', function (path) {
                     console.log('File', path, 'has been added')
                     changeFile('add', path)
                 })
                 .on('change', function (path) {
                     console.log('File', path, 'has been changed')
                     changeFile('change', path)
                 })
                 .on('unlink', function (path) {
                     console.log('File', path, 'has been removed')
                     changeFile('remove', path)
                 })
                 .on('error', function (error) {
                     console.error('Error occurred', error)
                     changeFile('error', path)
                 })
        }

        function changeFile (action, filePath) {
            let tag = '#TeleDrive ' + filePath.split('TeleDriveSync').pop()

            switch (action) {
                case 'add':
                    client.api.searchChatMessages({
                        chatId: me.id,
                        query: tag,
                        fromMessageId: 0,
                        limit: 100,
                    }).then((results) => {
                        if (results.response.totalCount === 0) {
                            doUpload()
                        }
                    })

                function doUpload () {
                    // noinspection JSIgnoredPromiseFromCall,JSCheckFunctionSignatures
                    client.api.sendMessage({
                        chatId: me.id,
                        replyToMessageId: 0,
                        options: {
                            disableNotification: true,
                            fromBackground: true
                        },
                        inputMessageContent: {
                            _: 'inputMessageDocument',
                            document: {
                                _: 'inputFileLocal',
                                path: filePath
                            },
                            caption: {
                                text: tag
                            }
                        }
                    })
                }

                    break
                case 'remove':
                    //TODO
                    break
                case 'change':
                    //TODO
                    break
                case 'error':
                    throw filePath
            }
        }
    }

    ipcMain.on('syncAll', () => {
        client.api.searchChatMessages({
            chatId: me.id,
            query: '#TeleDrive',
            fromMessageId: 0,
            limit: 100,
        }).then((results) => {
            console.log('GET-ALL')
            for (message of results.response.messages) {
                // Add TeleDriveSync path to the message content, while removing #TeleDrive and the file name
                let absoluteFile = selectedDir + message.content.caption.text.replace(/#TeleDrive \//g, '')
                let absolutePath = absoluteFile.split('/').slice(0, -1).join('/') + '/'

                fs.mkdir(absolutePath,
                     { recursive: true }, (err) => {
                         if (err) {
                             return console.error(err)
                         }
                })

                // Check if the file exists in the current directory.
                fs.access(absoluteFile, fs.constants.F_OK, (err) => {
                    if (err) {
                        client.api.downloadFile({
                            fileId: message.content.document.document.id,
                            priority: 32
                        })

                        status.on('downloadedFile', (file) => {
                            if (file.remote.id === message.content.document.document.remote.id) {
                                console.log("FILE DOWNLOADED NOW:")
                                console.log(file.local)

                                fs.copyFile(file.local.path, absoluteFile, (err) => {
                                    if (err) {
                                        throw err
                                    } else {
                                        console.log('Successfully moved')
                                        client.api.deleteFile({fileId: file.id})
                                    }
                                })
                            }
                        })
                    }
                });
            }
        })
    })

})

// noinspection JSCheckFunctionSignatures
const client = new Airgram({
    apiId: '1013617',
    apiHash: 'f5837e894e244b9b5ca1b4ad7c48fddb',
    command: app.getAppPath() + '/tdlib/libtdjson',
    logVerbosityLevel: 2,
    databaseDirectory: appStorage + '/db/',
    filesDirectory: appStorage + '/files/',
    useFileDatabase: true
})

// noinspection JSCheckFunctionSignatures
client.use(new Auth({
    phoneNumber: () => get('phoneNumber'),
    code: () => get('authCode'),
    password: () => get('password')
}))

function get (what) {
    mainWindow.webContentsReady.then(() => {
        mainWindow.webContents.send('auth', what)
    })
    return new Promise(resolve => {
        ipcMain.on(what, (event, message) => {
            resolve(message)
        })
    })
}

let me
void (async function () {
    me = toObject(await client.api.getMe())
    //console.log('[Me] ', me)

    myInfo = {
        name: me.lastName ? me.firstName + ' ' + me.lastName : me.firstName,
        number: '+' + me.phoneNumber,
        photo: me.profilePhoto.small.local.path
    }

    status.on('downloadedPhoto', (photoPath) => {
        myInfo.photo = photoPath
        mainWindow.webContents.send('updateMyInfo', myInfo)
    })

    if (!me.profilePhoto.small.local.path) {
        await client.api.downloadFile({
            fileId: me.profilePhoto.small.id,
            priority: 32
        })
    }

    await client.api.getChats({
        limit: 1, // limit: 1 still fetches all chats from the server
        offsetChatId: 0,
        offsetOrder: '9223372036854775807'
    })

    mainWindow.webContents.send('authSuccess')
    mainWindow.webContents.send('updateMyInfo', myInfo)
    status.emit('authSuccess')
    console.log('AuthSuccess')
})()

// Getting all updates
client.use((ctx, next) => {
    if ('update' in ctx) {
        //console.log(`[all updates][${ctx._}]`, JSON.stringify(ctx.update))

        if (ctx._ === 'updateFile') {
            // Listen for completed download of profile picture which was requested upon successful auth
            if (ctx.update.file.remote.id === me.profilePhoto.small.remote.id) {
                status.emit('downloadedPhoto', ctx.update.file.local.path)
            }
            if (ctx.update.file.remote.id !== me.profilePhoto.small.remote.id) {
                if (ctx.update.file.local.isDownloadingCompleted) {
                    status.emit('downloadedFile', ctx.update.file)
                }
            }
        }
    }
    return next()
})

// Getting new messages
client.on('updateNewMessage', async ({ update }) => {
    const { message } = update
    //console.log('[new message]', message)
})

