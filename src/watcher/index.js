const chokidar = require('chokidar')
const {createHash} = require('crypto');
const fsPromise = require('fs').promises
const {join, parse} = require('path')

// [{_: ChangeType, path: FilePath}]
const queue = []
let lock = false

const addFile = async (filePath, myID, client, appFilesPath) => {
    return new Promise(async resolve => {
        let tag = '#TeleDrive ' + filePath.split('TeleDriveSync').pop()
        console.log("[UPLOAD] ADDING/CHANGING FILE: " + filePath)
        console.log("[UPLOAD] TAG IS: " + tag)

        let masterData = JSON.parse(await fsPromise.readFile(join(appFilesPath, 'TeleDriveMaster.json'), {encoding: "utf8"}))

        const writeCloud = async (newJSON, filePath, changeTypeAdd) => {
            // Overwrite Master File
            await fsPromise.writeFile(join(appFilesPath, 'TeleDriveMaster.json'), JSON.stringify(newJSON))
            console.log('Overwrote Master File');

            // Re-attach Master File
            await client.api.editMessageMedia({
                chatId: myID,
                messageId: (await client.api.searchChatMessages({
                    chatId: myID,
                    query: "#TeleDriveMaster",
                    fromMessageId: 0,
                    limit: 100,
                })).response.messages[0].id,
                inputMessageContent: {
                    _: "inputMessageDocument",
                    document: {
                        _: "inputFileLocal",
                        path: join(appFilesPath, "TeleDriveMaster.json")
                    },
                    caption: {
                        text: "#TeleDriveMaster - This file contains your directory structure and file identification details. " +
                            "Deleting this file will make TeleDrive forget your existing files and will cause problems " +
                            "if you use TeleDrive again without deleting all TeleDrive files from your saved messages. " +
                            "Your files will still be backed up to telegram but you will have to manually restore them."
                    }
                }
            })

            if (changeTypeAdd) {
                await client.api.sendMessage({
                    chatId: myID,
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
            } else {
                let searchResults = await client.api.searchChatMessages({
                    chatId: myID,
                    query: "#TeleDrive " + filePath.split('TeleDriveSync').pop(),
                    fromMessageId: 0,
                    limit: 100,
                })

                // Re-attach the changed file
                // noinspection JSCheckFunctionSignatures
                await client.api.editMessageMedia({
                    chatId: myID,
                    messageId: searchResults.response.messages[0].id,
                    inputMessageContent: {
                        _: "inputMessageDocument",
                        document: {
                            _: "inputFileLocal",
                            path: filePath
                        },
                        caption: {
                            text: "#TeleDrive " + filePath.split('TeleDriveSync').pop()
                        }
                    }
                })
            }
        }

        let sha = createHash("sha256")
        sha.update(await fsPromise.readFile(filePath))
        let hash = sha.digest('hex')
        console.log("[UPLOAD] HASH FOR FILE " + filePath + " IS: " + hash)

        if (filePath.split('TeleDriveSync').pop() in masterData.files) {
            let existingFile = masterData.files[filePath.split('TeleDriveSync').pop()]
            if (existingFile.slice(-1)[0] === hash) { // Exact duplicate
                console.log("[UPLOAD] " + filePath + " is exact duplicate of " + existingFile + ", skipping...")
                resolve()
            } else if (existingFile.slice(0, -1).indexOf(hash) >= 0) { // CONFLICT, FILE IS OLD VERSION OF NEW CLOUD VERSION
                //TODO
                console.log("[UPLOAD] [CONFLICT] Cloud has newer version of " + filePath + ", skipping...")
                resolve()
            } else { // File was changed now or when TeleDrive was not running
                masterData.files[filePath.split('TeleDriveSync').pop()].push(hash)

                console.log("[UPLOAD] [CHANGE] NEW JSON IS:")
                console.log(masterData)

                await writeCloud(masterData, filePath, false)
                resolve()
            }
        } else { // New File
            masterData.files[filePath.split('TeleDriveSync').pop()] = [hash]
            console.log("[UPLOAD] [ADD] NEW JSON IS:")
            console.log(masterData)
            await writeCloud(masterData, filePath, true)
            resolve()
        }
    })
}

const removeFile = async (filePath, myID, client, tag, appFilesPath) => {

}

/**
 * @param {Airgram} client
 * @param {string} appFilesPath
 * @param {Promise<BrowserWindow>} mainWindow
 * @param {string} teleDir
 * @param {string} myID
 */
const syncAll = async (client, appFilesPath, mainWindow, teleDir, myID) => {
    return new Promise(async resolve => {
        const fsPromise = require('fs').promises

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

        (await mainWindow).webContents.send("syncOver")
        resolve()
    })
}

/**
 * @param {string} teleDir
 * @param {string} myID
 * @param {Airgram} client
 * @param {string} appFilesPath
 * @param {*} appVersion
 * @param {Promise<BrowserWindow>} mainWindow
 */
module.exports.addWatches = async (teleDir, myID, client, appFilesPath, appVersion, mainWindow) => {
    const evalQueue = () => {
        lock = true
        console.log("[QUEUE] EVALUATING")
        const next = () => {
            new Promise(resolve => {
                let change = queue[0]
                switch (change._) {
                    case 'add':
                        addFile(change.path, myID, client, appFilesPath).then(() => {
                            queue.shift()
                            resolve()
                        })
                        break
                    case 'remove':
                        removeFile(change.path, myID, client, appFilesPath).then(() => {
                            queue.shift()
                            resolve()
                        })
                        break
                    case 'sync':
                        syncAll(client, appFilesPath, mainWindow, teleDir, myID).then(() => {
                            queue.shift()
                            resolve()
                        })
                        break
                    case 'error':
                        throw change.path
                }
            }).then(() => {
                if (queue.length > 0) {
                    next()
                } else {
                    lock = false
                    console.log("[QUEUE] COMPLETED EVALUATION")
                }
            })
        }
        next()
    }

    // Verify Master File exits (VerifyMasterFile)
    await new Promise(async resolve => {
        try { // Check if the file already exists
            await fsPromise.access(join(appFilesPath, "TeleDriveMaster.json")) // Will throw err if file doesn't exist
            resolve() // If the file already exists
        } catch (err) { // If the file doesn't exist
            let results = await client.api.searchChatMessages({
                chatId: myID,
                query: "#TeleDriveMaster",
                fromMessageId: 0,
                limit: 100,
            })

            if (results.response.totalCount === 0) { // If no cloud masterFile yet
                await fsPromise.writeFile(join(appFilesPath, "TeleDriveMaster.json"), JSON.stringify({
                    _: "TeleDriveMaster",
                    version: appVersion,
                    files: {}
                }))

                await client.api.sendMessage({
                    chatId: myID,
                    replyToMessageId: 0,
                    options: {
                        disableNotification: true,
                        fromBackground: true
                    },
                    inputMessageContent: {
                        _: 'inputMessageDocument',
                        document: {
                            _: 'inputFileLocal',
                            path: join(appFilesPath, "TeleDriveMaster.json")
                        },
                        caption: {
                            text: "#TeleDriveMaster - This file contains your directory structure and file identification details. " +
                                "Deleting this file will make TeleDrive forget your existing files and will cause problems " +
                                "if you use TeleDrive again without deleting all TeleDrive files from your saved messages. " +
                                "Your files will still be backed up to telegram but you will have to manually restore them."
                        }
                    }
                })
                resolve()
            } else {
                await client.api.downloadFile({
                    fileId: results.response.messages[0].content.document.document.id,
                    priority: 32
                })

                client.on('updateFile', async (ctx, next) => {
                    if (ctx.update.file.local.isDownloadingCompleted &&
                        ctx.update.file.remote.id === results.response.messages[0].content.document.document.remote.id) {
                        try {
                            await fsPromise.copyFile(ctx.update.file.local.path, join(appFilesPath, 'TeleDriveMaster.json'))
                            console.log('[MASTER] [INITIAL FETCH] Successfully moved')
                            await client.api.deleteFile({fileId: ctx.update.file.id})
                            resolve()
                        } catch (e) {
                            console.log("[MASTER] [INITIAL FETCH] Airgram is stupid at times. Nothing to worry about") // This is because ctx.update.file.local.isDownloadingCompleted is true even when it hasn't completed
                        }
                    }
                    return next()
                })
            }
        }
    })

    const watcher = chokidar.watch(teleDir, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true
    })

    watcher
        .on('add', path => {
            queue.push({_: "add", path: path})
            if (!lock) {
                evalQueue()
            }
        })
        .on('change', path => {
            console.log('[WATCHER] File', path, 'has been changed')
            queue.push({_: "change", path: path})
            if (!lock) {
                evalQueue()
            }
        })
        .on('unlink', path => {
            console.log('[WATCHER] File', path, 'has been removed')
            queue.push({_: "remove", path: path})
            if (!lock) {
                evalQueue()
            }
        })
        .on('error', error => {
            console.error('[WATCHER] [ERROR] Error occurred', error)
        })

    const {ipcMain} = require('electron')
    ipcMain.on('syncAll', async () => {
        queue.push({_: "sync"})
        if (!lock) {
            evalQueue()
        }
    })
}
