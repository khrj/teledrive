const chokidar = require('chokidar')
const {createHash} = require('crypto');
const fsPromise = require('fs').promises
const {join, parse} = require('path')
const {ipcMain, dialog} = require('electron')
const log = require('electron-log')


// [{_: ChangeType, path: FilePath}]
const queue = []
let lock = false

const downloadRelative = (relativePath, client, teleDir, myID) => {
    return new Promise(async resolve => {
        log.info("[SYNC] NOW DOWNLOADING " + relativePath)
        // Split path into useful chunks
        let path = parse(join(teleDir, relativePath))

        await fsPromise.mkdir(path.dir, {recursive: true})
        let searchResults = await client.api.searchChatMessages ({
            chatId: myID,
            query: "#TeleDrive " + relativePath,
            fromMessageId: 0,
            limit: 100,
        })

        let file

        // Infer file type
        if (searchResults.response.messages[0].content.document) {
            log.info("[SYNC] File type: Document")
            file = searchResults.response.messages[0].content.document.document
        } else if (searchResults.response.messages[0].content.audio) {
            log.info("[SYNC] File type: Audio")
            file = searchResults.response.messages[0].content.audio.audio
        } else if (searchResults.response.messages[0].content.photo) {
            log.info("[SYNC] File type: Photo")
            file = searchResults.response.messages[0].content.photo.sizes[0].photo
        } else if (searchResults.response.messages[0].content.video) {
            log.info("[SYNC] File type: Video")
            file = searchResults.response.messages[0].content.video.video
        } else {
            dialog.showMessageBoxSync({type: "error", title: "Invalid file type", message: "Some files in your saved messages are causing problems!", detail: "This can be fixed. Please contact khushraj.rathod@gmail.com and provide the type of file you stored in Saved Messages"})
            process.exit(1)
        }

        const moveToSyncDir = async (file) => {
            await fsPromise.copyFile(file.local.path, join(teleDir, relativePath))
            await client.api.deleteFile({fileId: file.id})
        }

        let res = await client.api.downloadFile({fileId: file.id, priority: 32})
        if (res.response.local.isDownloadingCompleted) {
            await moveToSyncDir(res.response)
            return resolve()
        }

        client.on('updateFile', async (ctx, next) => {
            if (ctx.update.file.local.isDownloadingCompleted &&
                ctx.update.file.remote.id === file.remote.id) {
                log.info("[SYNC] MOVING FILE:")
                log.info(ctx.update.file.local)

                try {
                    await moveToSyncDir(ctx.update.file)
                    return resolve()
                } catch (e) {
                    // This happens because for some reason ctx.update.file.local.isDownloadingCompleted is
                    // true even when the downloading hasn't completed... ¯\_(ツ)_/¯
                    log.info("[SYNC] Not an error, suppressing ahahahahahahaha")
                }
            }
            return next()
        })

    })
}

const addFile = async (filePath, myID, client, appFilesPath, mainWindow, teleDir) => {
    return new Promise(async resolve => {
        let tag = '#TeleDrive ' + filePath.split('TeleDriveSync').pop()
        log.info("[UPLOAD] ADDING/CHANGING FILE: " + filePath)
        log.info("[UPLOAD] TAG IS: " + tag)

        let masterData = JSON.parse((await fsPromise.readFile(join(appFilesPath, 'TeleDriveMaster.json'))))

        const writeCloud = async (newJSON, filePath, changeTypeAdd) => {
            // Overwrite Master File
            await fsPromise.writeFile(join(appFilesPath, 'TeleDriveMaster.json'), JSON.stringify(newJSON))
            log.info('Overwrote Master File');

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
                } )
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
        log.info("[UPLOAD] HASH FOR FILE " + filePath + " IS: " + hash)

        if (filePath.split('TeleDriveSync').pop() in masterData.files) {
            let existingFile = masterData.files[filePath.split('TeleDriveSync').pop()]
            if (existingFile.slice(-1)[0] === hash) { // Exact duplicate
                log.info("[UPLOAD] " + filePath + " is exact duplicate of " + filePath.split('TeleDriveSync').pop() + ", skipping...")
                resolve();
                (await mainWindow).webContents.send('shiftQueue')
            } else if (existingFile.slice(0, -1).indexOf(hash) >= 0) { // CONFLICT, FILE IS OLD VERSION OF NEW CLOUD VERSION
                log.info("[UPLOAD] [CONFLICT] Cloud has newer or unknown version of " + filePath + ", prompting...");
                (await mainWindow).focus();
                (await mainWindow).webContents.send("uploadConflict", filePath.split('TeleDriveSync').pop());
                ipcMain.once('conflictResolved', async (_, toOverwrite) => {
                    log.info("[RESOLVED]")
                    if (toOverwrite) {
                        masterData.files[filePath.split('TeleDriveSync').pop()].push(hash)
                        log.info("[UPLOAD] [FORCE] NEW JSON IS:")
                        log.info(masterData)
                        await writeCloud(masterData, filePath, false);
                        (await mainWindow).webContents.send('shiftQueue')
                        resolve()
                    } else {
                        await downloadRelative(filePath.split('TeleDriveSync').pop(), client, teleDir, myID)
                        log.info("[SYNC] [FORCE] FILE: " + filePath);
                        (await mainWindow).webContents.send('shiftQueue')
                        resolve()
                    }
                })
            } else { // File was changed now or when TeleDrive was not running
                masterData.files[filePath.split('TeleDriveSync').pop()].push(hash)

                log.info("[UPLOAD] [CHANGE] NEW JSON IS:")
                log.info(masterData)

                await writeCloud(masterData, filePath, false);
                (await mainWindow).webContents.send('shiftQueue')
                resolve()
            }
        } else { // New File
            masterData.files[filePath.split('TeleDriveSync').pop()] = [hash]
            log.info("[UPLOAD] [ADD] NEW JSON IS:")
            log.info(masterData)
            await writeCloud(masterData, filePath, true);
            (await mainWindow).webContents.send('shiftQueue')
            resolve()
        }
    })
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
        const fsPromise = require('fs').promises;

        // noinspection JSUnresolvedVariable
        (await mainWindow).webContents.send("syncStarting");

        let masterData = JSON.parse(await fsPromise.readFile(join(appFilesPath, 'TeleDriveMaster.json')))
        const {createHash} = require('crypto')

        for (const item in masterData.files) {
            await new Promise(async resolve => {
                try { // Check if file already exists on device
                    await fsPromise.access(join(teleDir, item)) // If file already exists on device, then go on else throw
                    let sha = createHash("sha256")
                    sha.update(await fsPromise.readFile(join(teleDir, item)))
                    let hash = sha.digest('hex')
                    log.info("[SYNC] Hash for local file " + join(teleDir, item) + " is: " + hash)

                    if (masterData.files[item].slice(0, -1).indexOf(hash) !== -1) { // If old version
                        log.info("[SYNC] Old version of file " + item + " found locally, Overwriting...")
                        await downloadRelative(item, client, teleDir, myID) // Same as non-existent
                        resolve()
                    } else if (masterData.files[item].slice(-1)[0] === hash) { // If exact duplicate
                        log.info("[SYNC] Exact duplicate of " + item + " found locally, Skipping...")
                        resolve() // Don't need to do anything
                    }
                } catch (e) { // Non-existent
                    await downloadRelative(item, client, teleDir, myID)
                    resolve()
                }
            })
        }

        // noinspection JSUnresolvedVariable
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
        log.info("[QUEUE] EVALUATING")
        const next = () => {
            new Promise(resolve => {
                let change = queue[0]
                switch (change._) {
                    case 'add':
                        addFile(change.path, myID, client, appFilesPath, mainWindow, teleDir).then(() => {
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
                    default:
                        log.info("[FATAL] WTF")
                        throw change
                }
            }).then(() => {
                if (queue.length > 0) {
                    next()
                } else {
                    lock = false
                    log.info("[QUEUE] COMPLETED EVALUATION")
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
            }
            else {
                await client.api.downloadFile({
                    fileId: results.response.messages[0].content.document.document.id,
                    priority: 32
                })

                client.on('updateFile', async (ctx, next) => {
                    if (ctx.update.file.local.isDownloadingCompleted &&
                        ctx.update.file.remote.id === results.response.messages[0].content.document.document.remote.id) {
                        try {
                            await fsPromise.copyFile(ctx.update.file.local.path, join(appFilesPath, 'TeleDriveMaster.json'))
                            log.info('[MASTER] [INITIAL FETCH] Successfully moved')
                            await client.api.deleteFile({fileId: ctx.update.file.id})
                            resolve()
                        } catch (e) {
                            log.info("[MASTER] [INITIAL FETCH] Airgram is stupid at times. Nothing to worry about") // This is because ctx.update.file.local.isDownloadingCompleted is true even when it hasn't completed
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
        .on('add', async path => {
            log.info('[WATCHER] File', path, 'has been added');
            // noinspection JSUnresolvedVariable
            (await mainWindow).webContents.send("pushQueue", {_: "add", relativePath: path.split("TeleDriveSync").pop()})
            queue.push({_: "add", path: path})
            if (!lock) {
                evalQueue()
            }
        })
        .on('change', async path => {
            // noinspection JSUnresolvedVariable
            (await mainWindow).webContents.send("pushQueue", {_: "change", relativePath: path.split("TeleDriveSync").pop()})
            log.info('[WATCHER] File', path, 'has been changed')
            queue.push({_: "add", path: path})
            if (!lock) {
                evalQueue()
            }
        })
        .on('error', error => {
            console.error('[WATCHER] [ERROR] Error occurred', error)
        })

    const {ipcMain} = require('electron')
    ipcMain.on('syncAll', async () => {
        // noinspection JSUnresolvedVariable
        (await mainWindow).webContents.send("pushQueue", {_: "sync"})
        queue.push({_: "sync"})
        if (!lock) {
            evalQueue()
        }
    })
}

module.exports.breakQueue = async _ => {
    queue.length = 1
    const awaitLock = _ => {
        if (lock) {
            window.setTimeout(awaitLock, 100) /* this checks the flag every 100 milliseconds*/
        }
        log.info("[QUEUE CLEAN]")
    }
    awaitLock()
}
