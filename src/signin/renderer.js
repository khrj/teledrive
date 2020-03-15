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

    ipcRenderer.on('auth', async (event, message) => {
        console.log(message)
        if (message === 'phoneNumber') {
            ensureVisible()
            ipcRenderer.send('phoneNumber', await getInput())
        } else if (message === 'authCode') {
            ensureVisible()
            description.innerHTML = 'Please enter OTP'
            input.placeholder = 'One time password'
            ipcRenderer.send('authCode', await getInput())
        } else if (message === 'password') {
            ensureVisible()
            description.innerHTML = 'Please enter your 2FA Password'
            input.placeholder = '2 Factor Auth Password'
            input.type = 'password'
            ipcRenderer.send('password', await getInput())
        }

        function ensureVisible () {
            description.style.display = '' // Setting display to '' resets display to initial state
            button.style.display = ''
            input.style.display = ''
            input.type = ''
            title.innerHTML = 'Sign in to TeleDrive'
        }

        function getInput () {
            function modifyUI () {
                let value = input.value
                input.value = ''
                title.innerHTML = 'Working...'
                description.innerHTML = ''
                return value
            }

            return new Promise(resolve => {
                function clicked () {
                    button.removeEventListener('click', clicked)
                    input.removeEventListener('keydown', pressed)
                    resolve(modifyUI())
                }

                function pressed (event) {
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
    })

    ipcRenderer.on('authSuccess', (event, myInfo) => {
        title.innerHTML = 'Login Successful'
        profile.style.display = ''
        name.innerHTML = myInfo.name
        number.innerHTML = myInfo.number

        description.innerHTML = 'Select the location for <br> your synced folder'
        description.style.display = ''
        button.innerHTML = 'Open'
        button.style.display = ''
        input.style.display='none'
    })

    ipcRenderer.on('photo', (event, path) => {
        console.log("PHOTO RECIEVED")
        console.log(path)
        profilePicture.src = path
    })
})
