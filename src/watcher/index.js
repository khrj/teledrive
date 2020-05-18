const chokidar = require('chokidar')
const {createHash} = require('crypto');
const fs = require('fs')
const {join} = require('path')

// [{_: ChangeType, path: FilePath}]
const queue = []
let lock = false

const addFile = async (filePath, myID, client, tag, appFilesPath) => {
    return new Promise(resolve => {
        console.log("ADDING FILE: " + filePath)
        console.log("TAG IS: " + tag)

        fs.readFile(join(appFilesPath, 'TeleDriveMaster.json'), async (err, data) => {
            if (err) throw err
            let masterData = JSON.parse(data.toString())
            let existingFile = false
            masterData.files.forEach((file) => {
                if (file._ === filePath.split('TeleDriveSync').pop()) {
                    existingFile = file
                }
            })

            let masterModification = new Promise(resolve => {
                let sha = createHash("sha256")
                let stream = fs.createReadStream(filePath)
                stream.on('data', (data) => {
                    sha.update(data)
                })
                stream.on('end', () => {
                    let hash = sha.digest('hex')

                    console.log("HASH FOR FILE " + filePath + " IS:")
                    console.log(hash)

                    if (existingFile) {
                        if (existingFile.hash === hash) {
                            console.log(filePath + " is exact duplicate of " + existingFile._ + ", exiting...")
                            resolve(false)
                        } else {
                            // FILE HAS CHANGED, TODO
                            resolve(false)
                        }
                    } else {
                        // Prepare json
                        masterData.files.push({_: filePath.split('TeleDriveSync').pop(), hash: hash})

                        console.log("NEW JSON IS:")
                        console.log(masterData)

                        // Overwrite Master File
                        fs.writeFile(join(appFilesPath, 'TeleDriveMaster.json'), JSON.stringify(masterData), async (err) => {
                            if (err) {
                                console.error("OVERWRITE ERROR")
                                console.error(err)
                            }
                            console.log('Overwrote Master File');

                            // Find Master Message Id
                            let results = await client.api.searchChatMessages({
                                chatId: myID,
                                query: "#TeleDriveMaster",
                                fromMessageId: 0,
                                limit: 100,
                            })

                            // Re-attach Master File
                            await client.api.editMessageMedia({
                                chatId: myID,
                                messageId: results.response.messages[0].id,
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

                            resolve(true)
                        })
                    }
                })
            })

            // If file is already not on server (exact duplicate)
            if ((await masterModification) === true) {
                // noinspection JSCheckFunctionSignatures
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
                resolve()
            } else {
                console.log("Looks like a duplicate to me")
                console.log("Because I got the value: ")
                console.log((await masterModification))
                resolve()
            }
        })
    })
}

const removeFile = async (filePath, myID, client, tag, appFilesPath) => {

}

const changeFile = async (filePath, myID, client, tag, appFilesPath) => {

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
                        changeFile(change.path, myID, client, tag, appFilesPath).then(() => {
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

    const verifyMasterFile = new Promise(async resolve => {
        // Check if the file already exists
        fs.access(join(appFilesPath, "TeleDriveMaster.json"), fs.constants.F_OK, async (err) => {
            // If not, then
            if (err) {
                let results = await client.api.searchChatMessages({
                    chatId: myID,
                    query: "#TeleDriveMaster",
                    fromMessageId: 0,
                    limit: 100,
                })

                if (results.response.totalCount === 0) { // If no master file yet
                    fs.writeFile(join(appFilesPath, "TeleDriveMaster.json"), JSON.stringify({
                        _: "TeleDriveMaster",
                        version: appVersion,
                        files: []
                    }), async err => {
                        if (err) {
                            console.error("MASTER WRITE ERROR")
                            console.error(err)
                        } else {
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
                            resolve(true)
                        }
                    })
                } else {
                    const moveFile = (file) => {
                        fs.copyFile(file.local.path, appFilesPath, (err) => {
                            if (err) {
                                throw err
                            } else {
                                console.log('Successfully moved')
                                client.api.deleteFile({fileId: file.id})
                            }
                        })
                    }

                    await client.api.downloadFile({
                        fileId: results.response.messages[0].content.document.document.id,
                        priority: 32
                    })

                    client.on('updateFile', async (ctx, next) => {
                        if (ctx.update.file.local.isDownloadingCompleted &&
                            ctx.update.file.remote.id === results.response.messages[0].content.document.document.remote.id) {
                            moveFile(ctx.update.file)
                            resolve()
                        }
                        return next()
                    })
                }
            } else resolve()
        });
    })
    await verifyMasterFile // after that's done, then

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
