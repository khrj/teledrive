const {ipcMain, dialog, app} = require('electron')
const {Airgram, toObject} = require('airgram')
const {join} = require('path')
const Store = require('electron-store')
const store = new Store()
const {addWatches, breakQueue} = require(join(__dirname, '..', 'watcher', 'index.js'))
const log = require('electron-log');

/**
 * @return {Promise<string>}
 * */
const getTeleDir = mainWindow => {
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
                } else {
                    mainWindow.webContents.send('dialogCancelled')
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
    log.info("[AUTH] Starting...")

    await client

    client.on('updateAuthorizationState', async (ctx, next) => {
        if (ctx.update.authorizationState._ === "authorizationStateWaitPhoneNumber") {
            let attempt = async isRetry => {
                 return await client.api.setAuthenticationPhoneNumber({
                    phoneNumber: await get('phoneNumber', isRetry),
                    settings: {
                        allowFlashCall: false,
                        isCurrentPhoneNumber: false,
                        allowSmsRetrieverApi: false
                    }
                })
            }

            let correct = false

            let response = await attempt(false)
            if (response.response._ === "ok") {
                correct = true
            }

            while (!correct) {
                log.info("[AUTH] FAIL: phoneNumber")
                let response = await attempt(true)
                if (response.response._ === "ok") {
                    correct = true
                }
            }
        } else if (ctx.update.authorizationState._ === "authorizationStateWaitCode") {
            let attempt = async isRetry => {
                return await client.api.checkAuthenticationCode({
                    code: await get('authCode', isRetry),
                })
            }

            let correct = false

            let response = await attempt(false)
            if (response.response._ === "ok") {
                correct = true
            }

            while (!correct) {
                let response = await attempt(true)
                if (response.response._ === "ok") {
                    correct = true
                }
            }
        } else if (ctx.update.authorizationState._ === "authorizationStateWaitPassword") {
            let attempt = async isRetry => {
                return await client.api.checkAuthenticationPassword({
                    password: await get('password', isRetry),
                })
            }

            let correct = false

            let response = await attempt(false)
            if (response.response._ === "ok") {
                correct = true
            }

            while (!correct) {
                let response = await attempt(true)
                if (response.response._ === "ok") {
                    correct = true
                }
            }
        }
        return next()
    })

    /**
     * @param {String} what
     * @param {boolean} isRetry
     * @returns {Promise<{String}>}
     */
    const get = async (what, isRetry) => {
        log.info("[AUTH] Prompting for " + what);
        (await mainWindow).webContents.send('auth', {_: what, isRetry: isRetry})

        return new Promise(resolve => {
            ipcMain.on(what, function listen (event, message) {
                log.info("[AUTH] Received: " + what)
                resolve(message)
                ipcMain.removeListener(what, listen)
            })
        })
    }
}

/**
 * @param {string} appStorage
 * @param {string} appPath
 * @param {string} OS
 * */
module.exports.create = (appStorage, appPath, OS) => {
    log.info("[SETUP] App storage:")
    log.info(appStorage)
    // noinspection JSCheckFunctionSignatures
    return new Airgram({
        apiId: '1013617',
        apiHash: 'f5837e894e244b9b5ca1b4ad7c48fddb',
        command: join(appPath, 'tdlib', OS, 'libtdjson').replace('app.asar', ''),
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
        let teleDir = await getTeleDir(await mainWindow)
        ipcMain.on('changeTeleDir', async () => {
            const fsPromise = require('fs').promises
            let oldDir = store.get('teleDir')
            let response = await dialog.showOpenDialog({properties: ['openDirectory']})
            if (!response.canceled) {
                let teleDir = join(response.filePaths[0], 'TeleDriveSync');
                store.set('teleDir', teleDir)
                try {
                    await fsPromise.access(teleDir)
                } catch (e) {
                    await fsPromise.mkdir(teleDir, {recursive: true})
                } finally {
                    (await mainWindow).webContents.send("movingFiles")
                    const { ncp } = require('ncp')
                    const fsPromise = require('fs').promises
                    ncp(oldDir, teleDir, async err => {
                        if (err) {
                            return console.error(err)
                        }
                        await fsPromise.rmdir(oldDir, { recursive: true });
                        (await mainWindow).webContents.send("restarting")
                        setTimeout(_ => {
                            app.relaunch()
                            app.quit()
                        }, 5000)
                    })
                }
            }
        });

        (await mainWindow).webContents.send('selectedDir', teleDir)
        addWatches(teleDir, me.id, client, appFilesPath, appVersion, mainWindow)
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

module.exports.cleanQuit = async _ => {
    await breakQueue()
}
