const {ipcMain, dialog} = require('electron')
const {Airgram, toObject} = require('airgram')
const {join} = require('path')
const Store = require('electron-store')
const store = new Store()
const { addWatches } = require(join(__dirname, '..', 'watcher'))

/**
 * @param {Airgram} client
 * @param {BrowserWindow} mainWindow
 * */
module.exports.authenticate = async (client, mainWindow) => {
    console.log("Authing...")

    await client

    client.use(async (ctx, next) => {
        if (ctx._ === 'updateAuthorizationState') {
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
 * @param {Airgram} client
 * @param {BrowserWindow} mainWindow
 * */
module.exports.updateInfo = async (client, mainWindow) => {
    const update = async () => {
        let me = toObject(await (await client).api.getMe())

        // Fetch personal chat ASAP
        await client.api.getChats({
            limit: 1, // limit: 1 still fetches all chats from the server
            offsetChatId: 0,
            offsetOrder: '9223372036854775807'
        })

        // To increase speed, first send all info, then check if photo is download, if not, download, then update again
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
            client.use(async (ctx, next) => {
                if (ctx._ === "updateFile" && ctx.update.file.remote.id === me.profilePhoto.small.remote.id && ctx.update.file.local.isDownloadingCompleted) {
                    // Set photo and update again
                    myInfo.photo = ctx.update.file.local.path;
                    (await mainWindow).webContents.send('updateMyInfo', myInfo)
                }
                return next()
            })
        }

        let stored = store.get('teleDir')
        if (stored) {
            (await mainWindow).webContents.send('selectedDir', stored)
            addWatches(stored, me.id, client)
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
                (await mainWindow).webContents.send('selectedDir', teleDir)
                addWatches(teleDir, me.id, client)
            }
        })
    }
    if ((await client.api.getAuthorizationState()).response._ !== "authorizationStateReady") {
        client.use(async (response, next) => {
            if (response._ === 'updateAuthorizationState' && response.update.authorizationState._ === "authorizationStateReady") {
                await update();
            }
            return next()
        })
    } else await update()
}
