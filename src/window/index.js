const {ipcRenderer} = require('electron')

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

    const ensureVisible = () => {
        description.style.display = '' // Setting display to '' resets display to initial state
        button.style.display = ''
        input.style.display = ''
        input.type = ''
        title.innerHTML = 'Sign in to TeleDrive'
    }

    ipcRenderer.on('auth', async (event, message) => {
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
        input.style.display = 'none'
    })

    ipcRenderer.on('selectedDir', (event, path) => {
        console.log('selectedDir', path)
        title.innerHTML = 'Setup Successfully'
        description.innerHTML = 'Currently syncing <br>' + path
        button.innerHTML = 'CHANGE (WIP)'
        syncButton.style.display = ''
        const syncAll = () => {
            syncButton.removeEventListener("click", syncAll)
            syncButton.innerHTML = 'SYNCING'
            ipcRenderer.send('syncAll')
        }
        syncButton.addEventListener('click', syncAll)
    })

    ipcRenderer.on('syncOver', _ => {
        syncButton.innerHTML =
            `<svg xmlns='http://www.w3.org/2000/svg' style="width: 30px; height: 30px" viewBox='0 0 512 512'>
                     <path d='M320,336h76c55,0,100-21.21,100-75.6s-53-73.47-96-75.6C391.11,99.74,329,48,256,48c-69,0-113.44,45.79-128,91.2-60,5.7-112,35.88-112,98.4S70,336,136,336h56'
                           style='fill:none;stroke:#000;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px'/>
                     <polyline points='192 400.1 256 464 320 400.1'
                               style='fill:none;stroke:#000;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px'/>
                     <line x1='256' y1='224' x2='256' y2='448.03'
                           style='fill:none;stroke:#000;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px'/>
                 </svg>
                 <div>SYNC AGAIN</div>`

        // Add new listener
        const syncAll = () => {
            syncButton.removeEventListener("click", syncAll)
            syncButton.innerHTML = 'SYNCING'
            ipcRenderer.send('syncAll')
        }
        syncButton.addEventListener('click', syncAll)
    })

})
