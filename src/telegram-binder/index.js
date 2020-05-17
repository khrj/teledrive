const {ipcMain, dialog} = require('electron')
const {Airgram, toObject} = require('airgram')
const {join, parse} = require('path')
const Store = require('electron-store')
const store = new Store()
const {addWatches} = require(join(__dirname, '..', 'watcher', 'index.js'))

const getTeleDir = () => {
    return new Promise(resolve => {
        let stored = store.get('teleDir')
        if (stored) {
            resolve(stored)
        }

        ipcMain.on('openFileDialog', async () => {
            let response = await dialog.showOpenDialog({properties: ['openDirectory']})
            if (!response.canceled) {
                let teleDir = join(response.filePaths[0], 'TeleDriveSync');
                try {
                    store.set('teleDir', teleDir)
                } catch (e) {
                    console.error(e)
                }
                resolve(teleDir)
            }
        })
    })
}

/**
 * @param {Airgram} client
 * @param {BrowserWindow} mainWindow
 * */
module.exports.authenticate = async (client, mainWindow) => {
    console.log("Authing...")

    await client

    client.on('updateAuthorizationState', async (ctx, next) => {
        console.log(`[authState][${ctx._}]`, JSON.stringify(ctx.update))

        if (ctx.update.authorizationState._ === "authorizationStateWaitPhoneNumber") {
            await client.api.setAuthenticationPhoneNumber({
                phoneNumber: await get('phoneNumber', false),
                settings: {
                    allowFlashCall: false,
                    isCurrentPhoneNumber: false,
                    allowSmsRetrieverApi: false
                }
            })
        } else if (ctx.update.authorizationState._ === "authorizationStateWaitCode") {
            await client.api.checkAuthenticationCode({
                code: await get('authCode', false),
            })
        } else if (ctx.update.authorizationState._ === "authorizationStateWaitPassword") {
            await client.api.checkAuthenticationPassword({
                password: await get('password', false),
            })
        }
        return next()
    })

    /**
     * @param {String} what
     * @param {boolean} isRetry
     * @returns {Promise<{String}>}
     */
    const get = async (what, isRetry) => {
        console.log("Getting " + what);
        (await mainWindow).webContents.send('auth', {_: what, isRetry: isRetry})

        return new Promise(resolve => {
            ipcMain.on(what, (event, message) => {
                console.log("Received: " + what)
                console.log(message)
                resolve(message)
            })
        })
    }
}

/**
 * @param {string} appStorage
 * @param {string} appPath
 * */
module.exports.create = (appStorage, appPath) => {
    console.log("App storage:")
    console.log(appStorage)
    // noinspection JSCheckFunctionSignatures
    return new Airgram({
        apiId: '1013617',
        apiHash: 'f5837e894e244b9b5ca1b4ad7c48fddb',
        command: join(appPath, 'tdlib', 'libtdjson'),
        logVerbosityLevel: 2,
        databaseDirectory: join(appStorage, 'db'),
        filesDirectory: join(appStorage, 'files'),
        useFileDatabase: true
    });
}

/**
 * @ param {Airgram} client
 * @ param {BrowserWindow} mainWindow
 * */
module.exports.updateInfo = async (client, mainWindow, appFilesPath, appVersion) => {
    const update = async () => {
        let me = toObject(await (await client).api.getMe())

        // Fetch personal chat ASAP
        await client.api.getChats({
            limit: 1, // limit: 1 still fetches all chats from the server
            offsetChatId: 0,
            offsetOrder: '9223372036854775807'
        })

        // To increase speed, first send all info, then check if photo is downloaded, if not, download, then update again
        let myInfo = {
            name: me.lastName ? me.firstName + ' ' + me.lastName : me.firstName,
            number: '+' + me.phoneNumber,
            photo: me.profilePhoto.small.local.path
        };

        (await mainWindow).webContents.send('authSuccess');
        (await mainWindow).webContents.send('updateMyInfo', myInfo)

        // If photo not already downloaded
        if (!myInfo.photo) {
            await client.api.downloadFile({
                fileId: me.profilePhoto.small.id,
                priority: 32
            })
            // Listen for completion of photo download
            client.on('updateFile', async (ctx, next) => {
                if (ctx.update.file.remote.id === me.profilePhoto.small.remote.id && ctx.update.file.local.isDownloadingCompleted) {
                    // Set photo and update again
                    myInfo.photo = ctx.update.file.local.path;
                    (await mainWindow).webContents.send('updateMyInfo', myInfo)
                }
                return next()
            })
        }

        const fs = require('fs')

        /**
         * @type {string}
         */
        let teleDir = await getTeleDir();

        if (!fs.existsSync(teleDir)) {
            await fs.mkdir(teleDir, {}, () => {
            })
        }
        (await mainWindow).webContents.send('selectedDir', teleDir)
        addWatches(teleDir, me.id, client, appFilesPath, appVersion)
    }
    if ((await client.api.getAuthorizationState()).response._ !== "authorizationStateReady") {
        client.on('updateAuthorizationState', async (ctx, next) => {
            if (ctx.update.authorizationState._ === "authorizationStateReady") {
                await update();
            }
            return next()
        })
    } else await update()
}

/**
 * @param {Airgram} client
 */
module.exports.bindFetcher = (client) => {
    const fs = require('fs')
    ipcMain.on('syncAll', async () => {
        let myID = toObject(await (await client).api.getMe()).id
        let teleDir = await getTeleDir()
        if (!fs.existsSync(teleDir)) {
            await fs.mkdir(teleDir, {recursive: true}, () => {
            })
        }
        console.log("SYNCING ALL")
        const downloadIfNotExists = (message) => {
            // Add TeleDriveSync path to the message content, while removing #TeleDrive and the file name to get parent folder
            let path = parse(join(teleDir, message.content.caption.text.replace(/#TeleDrive \//g, '')))

            fs.mkdir(path.dir, {recursive: true}, (err) => {
                if (err) {
                    console.error(err)
                }

                // Check if the file exists in the current directory.
                fs.access(join(path.dir, path.base), fs.constants.F_OK, async (err) => {
                    if (err) { // If it doesn't exist
                        console.log(path.base + "Doesn't exist yet, d")
                        const moveFile = (file) => {
                            console.log("MOVING FILE:")
                            console.log(file.local)

                            fs.copyFile(file.local.path, join(path.dir, path.base), (err) => {
                                if (err) {
                                    throw err
                                } else {
                                    console.log('Successfully moved')
                                    client.api.deleteFile({fileId: file.id})
                                }
                            })
                        }

                        let response = client.api.downloadFile({
                            fileId: message.content.document.document.id,
                            priority: 32
                        })

                        console.log(await response)

                        client.on('updateFile', async (ctx, next) => {
                            console.log("Done downloading?")
                            console.log(ctx.update.file.local.isDownloadingCompleted)

                            console.log("Remote ID:")
                            console.log(ctx.update.file.remote.id)

                            console.log("Local ID:")
                            console.log(message.content.document.document.remote.id)

                            if (ctx.update.file.local.isDownloadingCompleted &&
                                ctx.update.file.remote.id === message.content.document.document.remote.id) {
                                moveFile(ctx.update.file)
                            }
                            return next()
                        })
                    }
                })
            })
        }

        let searchResults = await client.api.searchChatMessages({
            chatId: myID,
            query: '#TeleDrive',
            fromMessageId: 0,
            limit: 100,
        })

        searchResults.response.messages.forEach(downloadIfNotExists)
    })
}
