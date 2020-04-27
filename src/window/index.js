const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
    const title = document.getElementById('title')
    const name = document.getElementById('name')
    const number = document.getElementById('number')
    const description = document.getElementById('description')
    const button = document.getElementById('next')
    const profile = document.getElementById('profile')
    const input = document.getElementById('input')
    const profilePicture = document.getElementById('profilePicture')
    const syncButton = document.getElementById('reDownload')

    const ensureVisible  = () => {
        description.style.display = '' // Setting display to '' resets display to initial state
        button.style.display = ''
        input.style.display = ''
        input.type = ''
        title.innerHTML = 'Sign in to TeleDrive'
    }

    // Leave as async non-arrow function, required for bytenode successful compilation
    // https://github.com/OsamaAbbas/bytenode/issues/47 #wontfix
    // noinspection JSFunctionExpressionToArrowFunction
    ipcRenderer.on('auth', async function (event, message) {
        console.log(message)

        const getInput = () => {
            const modifyUI = () => {
                let value = input.value
                input.value = ''
                title.innerHTML = 'Working...'
                description.innerHTML = ''
                return value
            }

            return new Promise(resolve => {
                const clicked = () => {
                    button.removeEventListener('click', clicked)
                    input.removeEventListener('keydown', pressed)
                    resolve(modifyUI())
                }

                const pressed = event => {
                    if (event.keyCode === 13) {
                        button.removeEventListener('click', clicked)
                        input.removeEventListener('keydown', pressed)
                        resolve(modifyUI())
                    }
                }

                button.addEventListener('click', clicked)
                input.addEventListener('keydown', pressed)
            })
        }

        if (message._ === 'phoneNumber') {
            ensureVisible()
            description.innerHTML = 'Please enter your phone number<br>in international format.'
            input.placeholder = 'Phone Number'
            ipcRenderer.send('phoneNumber', await getInput())
        } else if (message._ === 'authCode') {
            ensureVisible()
            description.innerHTML = 'Please enter OTP'
            input.placeholder = 'One time password'
            ipcRenderer.send('authCode', await getInput())
        } else if (message._ === 'password') {
            ensureVisible()
            description.innerHTML = 'Please enter your 2FA Password'
            input.placeholder = '2 Factor Auth Password'
            input.type = 'password'
            ipcRenderer.send('password', await getInput())
        }
    })

    ipcRenderer.on('updateMyInfo', (event, myInfo) => {
        console.log("Updating info,")
        console.log(myInfo)
        name.innerHTML = myInfo.name
        number.innerHTML = myInfo.number
        if (myInfo.photo) {
            profilePicture.src = myInfo.photo
        }
    })

    ipcRenderer.on('authSuccess', () => {
        title.innerHTML = 'Login Successful'
        profile.style.display = ''

        description.innerHTML = 'Select the location for <br> your synced folder'
        description.style.display = ''
        button.innerHTML = 'Open'

        button.addEventListener('click', () => {
            ipcRenderer.send('openFileDialog')
        })

        button.style.display = ''
        input.style.display='none'
    })

    ipcRenderer.on('selectedDir', (event, path) => {
        console.log('selectedDir', path)
        title.innerHTML = 'Setup Successfully'
        description.innerHTML = 'Currently syncing <br>' + path
        button.innerHTML = 'CHANGE (WIP)'
        syncButton.style.display = ''
        syncButton.addEventListener('click', () => {
            ipcRenderer.send('syncAll')
            syncButton.innerHTML = 'SYNCING'
        })
    })
})
