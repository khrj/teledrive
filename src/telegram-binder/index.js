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
    return new Promise(async resolve => {
        const fsPromise = require('fs').promises
        let stored = store.get('teleDir')
        if (stored) {
            try {
                await fsPromise.access(stored)
            } catch (e) {
                await fsPromise.mkdir(stored, {recursive: true})
            } finally {
                resolve(stored)
            }
        } else {
            ipcMain.on('openFileDialog', async () => {
                let response = await dialog.showOpenDialog({properties: ['openDirectory']})
                if (!response.canceled) {
                    let teleDir = join(response.filePaths[0], 'TeleDriveSync');
                    store.set('teleDir', teleDir)
                    try {
                        await fsPromise.access(teleDir)
                    } catch (e) {
                        await fsPromise.mkdir(teleDir, {recursive: true})
                    } finally {
                        resolve(teleDir)
                    }
                }
            })
        }
    })
}

/**
 * @param {Airgram} client
 * @param {BrowserWindow} mainWindow
 * */
module.exports.authenticate = async (client, mainWindow) => {
    console.log("[AUTH] Starting...")

    await client

    client.on('updateAuthorizationState', async (ctx, next) => {
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
        console.log("[AUTH] Prompting for " + what);
        (await mainWindow).webContents.send('auth', {_: what, isRetry: isRetry})

        return new Promise(resolve => {
            ipcMain.on(what, (event, message) => {
                console.log("[AUTH] Received: " + what)
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
    console.log("[SETUP] App storage:")
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

        /**
         * @type {string}
         */
        let teleDir = await getTeleDir();

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
    ipcMain.on('syncAll', async () => {
        const fsPromise = require('fs').promises
        let myID = toObject(await (await client).api.getMe()).id
        let teleDir = await getTeleDir()

        console.log("[SYNC] Starting...")
        const downloadRelative = (relativePath) => {
            return new Promise(async resolve => {
                console.log("NOW DOWNLOADING " + relativePath)
                // Split path into useful chunks
                let path = parse(join(teleDir, relativePath))

                await fsPromise.mkdir(path.dir, {recursive: true})
                let searchResults = await client.api.searchChatMessages({
                        chatId: myID,
                        query: "#TeleDrive " + relativePath,
                        fromMessageId: 0,
                        limit: 100,
                })

                await client.api.downloadFile({
                        fileId: searchResults.response.messages[0].content.document.document.id,
                        priority: 32
                })

                client.on('updateFile', async (ctx, next) => {
                        if (ctx.update.file.local.isDownloadingCompleted &&
                            ctx.update.file.remote.id === searchResults.response.messages[0].content.document.document.remote.id) {
                            console.log("MOVING FILE:")
                            console.log(ctx.update.file.local)

                            try {
                                await fsPromise.copyFile(ctx.update.file.local.path, join(teleDir, relativePath))
                                console.log('Successfully moved')
                                await client.api.deleteFile({fileId: ctx.update.file.id})
                                return resolve()
                            } catch (e) {
                                // This happens because for some reason ctx.update.file.local.isDownloadingCompleted is
                                // true even when the downloading hasn't completed... ¯\_(ツ)_/¯
                                console.log("Not an error, suppressing ahahahahahahaha")
                            }
                        }
                        return next()
                    })

            })
        }

        let masterData = JSON.parse(await fsPromise.readFile(join(appFilesPath, 'TeleDriveMaster.json'), {encoding: "utf8"}))
        const {createHash} = require('crypto');

        for (const item in masterData.files) {
            await new Promise(async resolve => {
                try { // Check if file already exists on device
                    await fsPromise.access(join(teleDir, item)) // If file already exists on device, then go on else throw
                    let sha = createHash("sha256")
                    sha.update(await fsPromise.readFile(join(teleDir, item)))
                    let hash = sha.digest('hex')
                    console.log("[SYNC] Hash for local file " + join(teleDir, item) + " is: " + hash)

                    if (masterData.files[item].slice(0, -1).indexOf(hash) !== -1) { // If old version
                        console.log("[SYNC] Old version of file " + item + " found locally, Overwriting...")
                        await downloadRelative(item) // Same as non-existent
                        resolve()
                    } else if (masterData.files[item].slice(-1)[0] === hash) { // If exact duplicate
                        console.log("[SYNC] Exact duplicate of " + item + " found locally, Skipping...")
                        resolve() // Don't need to do anything
                    } else { // If conflicting
                        //TODO
                        console.log("[SYNC] [CONFLICT] Newer version of " + item + " found locally, Skipping...")
                        resolve()
                    }
                } catch (e) {
                    await downloadRelative(item)
                    resolve()
                }
            })
        }
        console.log("[SYNC] Complete.")
        (await mainWindow).webContents.send("syncOver")
    })
}
