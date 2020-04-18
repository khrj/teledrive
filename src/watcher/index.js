const chokidar = require('chokidar')

const changeFile = async (action, filePath, myID, client) => {
    let tag = '#TeleDrive ' + filePath.split('TeleDriveSync').pop()

    switch (action) {
        case 'add':
            let results = await client.api.searchChatMessages({
                chatId: myID,
                query: tag,
                fromMessageId: 0,
                limit: 100,
            })
            if (results.response.totalCount === 0) {
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
            }
            break
        case 'remove':
            //TODO
            break
        case 'change':
            //TODO
            break
        case 'error':
            throw filePath
    }
}

module.exports.addWatches = (teleDir, myID, client) => {
    const watcher = chokidar.watch(teleDir, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true
    })
    watcher
        .on('add', async path => {
            console.log('File', path, 'has been added')
            await changeFile('add', path, myID, client)
        })
        .on('change', async path => {
            console.log('File', path, 'has been changed')
            await changeFile('change', path, myID, client)
        })
        .on('unlink', async path => {
            console.log('File', path, 'has been removed')
            await changeFile('remove', path, myID, client)
        })
        .on('error', async error => {
            console.error('Error occurred', error)
            await changeFile('error', path, myID, client)
        })
}
