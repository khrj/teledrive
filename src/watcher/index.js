const chokidar = require('chokidar')
const {createHash} = require('crypto');
const fsPromise = require('fs').promises
const {join} = require('path')

// [{_: ChangeType, path: FilePath}]
const queue = []
let lock = false

const addFile = async (filePath, myID, client, tag, appFilesPath) => {
    return new Promise(async resolve => {
        console.log("ADDING FILE: " + filePath)
        console.log("TAG IS: " + tag)

        let masterData = JSON.parse(await fsPromise.readFile(join(appFilesPath, 'TeleDriveMaster.json'), {encoding: "utf8"}))
        let existingFile = false
        masterData.files.forEach((file) => {
            if (file._ === filePath.split('TeleDriveSync').pop()) {
                existingFile = file
            }
        })

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
        console.log("HASH FOR FILE " + filePath + " IS: " + hash)

        if (existingFile) {
            if (existingFile.hashes.slice(-1)[0] === hash) { // Exact duplicate
                console.log(filePath + " is exact duplicate of " + existingFile._ + ", skipping...")
                resolve()
            } else if (existingFile.hashes.slice(0, -1).indexOf(hash) >= 0) { // CONFLICT, FILE IS OLD VERSION OF NEW CLOUD VERSION
                //TODO
                console.log("[UPLOAD CONFLICT] Cloud has newer version of " + filePath + ", skipping...")
                resolve()
            } else { // File was changed now or when TeleDrive was not running
                let index;
                for (let i = 0; i < masterData.files.length; i++) {
                    if (masterData.files[i]._ === filePath.split('TeleDriveSync').pop()) {
                        index = i
                        break
                    }
                }

                masterData.files[index].hashes.push(hash)

                console.log("[CHANGE FILE] NEW JSON IS:")
                console.log(masterData)

                await writeCloud(masterData, filePath, false)
                resolve()
            }
        } else { // New File
            masterData.files.push({_: filePath.split('TeleDriveSync').pop(), hashes: [hash]})
            console.log("[ADD FILE] NEW JSON IS:")
            console.log(masterData)
            await writeCloud(masterData, filePath, true)
            resolve()
        }
    })
}

const removeFile = async (filePath, myID, client, tag, appFilesPath) => {

}


/**
 * @param {string} teleDir
 * @param {string} myID
 * @param {Airgram} client
 * @param {string} appFilesPath
 * @param {*} appVersion
 */
module.exports.addWatches = async (teleDir, myID, client, appFilesPath, appVersion) => {
    const evalQueue = () => {
        lock = true
        console.log("EVALUATING")
        const next = () => {
            new Promise(resolve => {
                let change = queue[0]
                let tag = '#TeleDrive ' + change.path.split('TeleDriveSync').pop()
                switch (change._) {
                    case 'add':
                        addFile(change.path, myID, client, tag, appFilesPath).then(() => {
                            queue.shift()
                            resolve()
                        })
                        break
                    case 'remove':
                        removeFile(change.path, myID, client, tag, appFilesPath).then(() => {
                            queue.shift()
                            resolve()
                        })
                        break
                    case 'change':
                        addFile(change.path, myID, client, tag, appFilesPath).then(() => {
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
                    console.log("COMPLETED EVALUATION")
                }
            })
        }
        next()
    }

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
                    files: []
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
                            console.log('Successfully moved')
                            await client.api.deleteFile({fileId: ctx.update.file.id})
                            resolve()
                        } catch (e) {
                            console.log("Airgram is stupid at times. Nothing to worry about") // This is because ctx.update.file.local.isDownloadingCompleted is true even when it hasn't completed
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
            console.log('File', path, 'has been changed')
            queue.push({_: "change", path: path})
            if (!lock) {
                evalQueue()
            }
        })
        .on('unlink', path => {
            console.log('File', path, 'has been removed')
            queue.push({_: "remove", path: path})
            if (!lock) {
                evalQueue()
            }
        })
        .on('error', error => {
            console.error('Error occurred', error)
        })
}
