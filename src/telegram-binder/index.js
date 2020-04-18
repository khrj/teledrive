const { ipcMain } = require('electron')
const { Airgram, toObject } = require('airgram')
const { join } = require('path')

/**
 * @param {Airgram} client
 * @param {BrowserWindow} mainWindow
 * */
module.exports.authenticate = async (client, mainWindow) => {
    console.log("Authing...")

    await client

    client.use(async (ctx, next) => {
        if ( ctx._ === 'updateAuthorizationState') {
            console.log(`[authState][${ctx._}]`, JSON.stringify(ctx.update))

            if (ctx.update.authorizationState._ === "authorizationStateWaitPhoneNumber") {
                await client.api.setAuthenticationPhoneNumber({
                    phoneNumber: await get('phoneNumber', false),
                    settings: {
                        allowFlashCall: false
                    }
                })
            } else if (ctx.update.authorizationState._ === "authorizationStateWaitCode") {
                await client.api.setAuthenticationPhoneNumber({
                    phoneNumber: await get('code', false),
                    settings: {
                        allowFlashCall: false
                    }
                })
            } else if (ctx.update.authorizationState._ === "authorizationStateWaitPassword") {
                await client.api.setAuthenticationPhoneNumber({
                    phoneNumber: await get('phoneNumber', false),
                    settings: {
                        allowFlashCall: false
                    }
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
    console.log("Waiting for auth...")
    let me = toObject(await client.api.getMe())

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

    (await mainWindow).webContents.send('updateMyInfo', myInfo)

    // If photo not already downloaded
    if (!myInfo.photo) {
        await client.api.downloadFile({
            fileId: me.profilePhoto.small.id,
            priority: 32
        })
        // Listen for completion of photo download
        client.use(async (ctx, next) => {
            if (ctx.update.file.remote.id === me.profilePhoto.small.remote.id && ctx.update.file.local.isDownloadingCompleted) {
                // Set photo and update again
                myInfo.photo = ctx.update.file.local.path;
                (await mainWindow).webContents.send('updateMyInfo', myInfo)
            }
            return next()
        })
    }
}
