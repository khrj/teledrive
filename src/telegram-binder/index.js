const {ipcMain, dialog} = require('electron')
const {Airgram, toObject} = require('airgram')
const {join, parse} = require('path')
const Store = require('electron-store')
const store = new Store()
const {addWatches} = require(join(__dirname, '..', 'watcher', 'index.js'))

/**
 * @return {Promise<string>}
 * */
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
 * @param {string} appFilesPath
 * @param {Promise<BrowserWindow>} mainWindow
 */
module.exports.bindFetcher = (client, appFilesPath, mainWindow) => {
    const fs = require('fs')
    ipcMain.on('syncAll', async () => {
        let myID = toObject(await (await client).api.getMe()).id
        let teleDir = await getTeleDir()

        // Ensure teleDir is on disk
        await new Promise(resolve => {
            if (!fs.existsSync(teleDir)) {
                fs.mkdir(teleDir, {recursive: true}, () => {
                    resolve()
                })
            } else {
                resolve()
            }
        })

        console.log("SYNCING ALL")
        const downloadRelative = (relativePath) => {
            return new Promise(resolve => {
                console.log("NOW DOWNLOADING " + relativePath)
                // Split path into useful chunks
                let path = parse(join(teleDir, relativePath))

                fs.mkdir(path.dir, {recursive: true}, async (err) => {
                    if (err) throw err
                    let searchResults = await client.api.searchChatMessages({
                        chatId: myID,
                        query: "#TeleDrive " + relativePath,
                        fromMessageId: 0,
                        limit: 100,
                    })


                    let downloadResponse = client.api.downloadFile({
                        fileId: searchResults.response.messages[0].content.document.document.id,
                        priority: 32
                    })

                    console.log(await downloadResponse)

                    client.on('updateFile', async (ctx, next) => {
                        console.log("Done downloading?")
                        console.log(ctx.update.file.local.isDownloadingCompleted)

                        console.log("Remote ID:")
                        console.log(ctx.update.file.remote.id)

                        console.log("Local File's remote ID:")
                        console.log(searchResults.response.messages[0].content.document.document.remote.id)

                        if (ctx.update.file.local.isDownloadingCompleted &&
                            ctx.update.file.remote.id === searchResults.response.messages[0].content.document.document.remote.id) {
                            console.log("MOVING FILE:")
                            console.log(ctx.update.file.local)

                            fs.copyFile(ctx.update.file.local.path, join(teleDir, relativePath), (err) => {
                                if (err) {
                                    console.log("Not an error, suppressing ahahahahahahaha")
                                    // This happens because for some reason ctx.update.file.local.isDownloadingCompleted is
                                    // true even when the downloading hasn't completed... ¯\_(ツ)_/¯
                                }
                                console.log('Successfully moved')
                                client.api.deleteFile({fileId: ctx.update.file.id})
                                return resolve()
                            })
                        }
                        return next()
                    })
                })
            })
        }

        fs.readFile(join(appFilesPath, 'TeleDriveMaster.json'), async (err, data) => {
            if (err) throw err
            let masterData = JSON.parse(data.toString())
            const {createHash} = require('crypto');

            const wait = async () => {
                for (data of masterData.files) {
                    await new Promise(resolve => {
                        fs.access(join(teleDir, data._), fs.constants.F_OK, async (err) => {
                            if (err) { // If doesn't already exist
                                await downloadRelative(data._)
                                resolve()
                            } else { // If already exists
                                let sha = createHash("sha256")
                                let stream = fs.createReadStream(join(teleDir, data._))
                                stream.on('data', (part) => {
                                    sha.update(part)
                                })
                                stream.on('end', () => {
                                    let hash = sha.digest('hex')
                                    console.log("[SYNC] Hash for local file " + join(teleDir, data._) + " is: " + hash)

                                    if (hash === data.hash) { // If exact duplicate
                                        return resolve() // Don't need to do anything
                                    } else { // If conflict
                                        //TODO
                                    }
                                })
                            }
                        })
                    })
                }
            }

            await wait();

            (await mainWindow).webContents.send("syncOver")

        })
    })
}
