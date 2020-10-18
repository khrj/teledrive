const { ipcRenderer, shell } = require('electron')
ipcRenderer.setMaxListeners(Infinity);

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
    const queueButton = document.getElementById('queueButton')

    let queue = [];
    const queueList = document.createElement('div')
    queueList.id = "queueList"
    queueList.style.lineHeight = "490px"
    queueList.innerHTML = "TeleDrive is Idle"

    const ensureVisible = () => {
        description.style.display = '' // Setting display to '' resets display to initial state
        button.style.display = ''
        input.style.display = ''
        input.type = ''
        input.classList.remove('shake-horizontal')
        input.offsetHeight // Triggers Reflow
        input.style.border = "1px solid #c4c4c4"
        title.innerHTML = 'Sign in to TeleDrive'
    }

    let retriedOnce = {
        phoneNumber: false,
        code: false,
        password: false
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
            // noinspection JSUnresolvedFunction
            let choice = await swal({
                title: "Welcome to TeleDrive",
                text: 'New here? Checkout the documentation',
                icon: "info",
                buttons: {
                    cancel: "Skip",
                    confirm: "View documentation",
                },
                closeOnClickOutside: false
            })

            if (choice) {
                await shell.openExternal('https://teledrive.khushrajrathod.me/docs/')
            }

            if (!message.isRetry) {
                ensureVisible()
                description.innerHTML = 'Please enter your phone number<br>in international format.'
                input.placeholder = 'Phone Number'
                ipcRenderer.send('phoneNumber', await getInput())
            } else {
                if (!retriedOnce.phoneNumber) {
                    ensureVisible()
                    retriedOnce.phoneNumber = true
                    description.innerHTML = 'Please enter your phone number<br>in international format.'
                    input.classList.add("shake-horizontal")
                    input.style.border = "2px solid #d93025"
                    ipcRenderer.send('phoneNumber', await getInput())
                } else {
                    ensureVisible()
                    description.innerHTML = 'Please enter your phone number<br>in international format.'
                    input.classList.remove('shake-horizontal')
                    input.offsetHeight // Triggers Reflow
                    input.classList.add("shake-horizontal")
                    input.style.border = "2px solid #d93025"
                    ipcRenderer.send('phoneNumber', await getInput())
                }
            }
        } else if (message._ === 'authCode') {
            if (!message.isRetry) {
                ensureVisible()
                description.innerHTML = 'Please enter OTP'
                input.placeholder = 'One time password'
                ipcRenderer.send('authCode', await getInput())
            } else {
                if (!retriedOnce.code) {
                    ensureVisible()
                    retriedOnce.code = true
                    description.innerHTML = 'Please enter OTP'
                    input.classList.add("shake-horizontal")
                    input.style.border = "2px solid #d93025"
                    ipcRenderer.send('authCode', await getInput())
                } else {
                    ensureVisible()
                    description.innerHTML = 'Please enter OTP'
                    input.classList.remove('shake-horizontal')
                    input.offsetHeight // Triggers Reflow
                    input.classList.add("shake-horizontal")
                    input.style.border = "2px solid #d93025"
                    ipcRenderer.send('authCode', await getInput())
                }
            }
        } else if (message._ === 'password') {
            if (!message.isRetry) {
                ensureVisible()
                description.innerHTML = 'Please enter your 2FA Password'
                input.placeholder = '2 Factor Auth Password'
                input.type = 'password'
                ipcRenderer.send('password', await getInput())
            } else {
                if (!retriedOnce.password) {
                    ensureVisible()
                    retriedOnce.password = true
                    description.innerHTML = 'Please enter your 2FA Password'
                    input.classList.add("shake-horizontal")
                    input.style.border = "2px solid #d93025"
                    input.type = 'password'
                    ipcRenderer.send('password', await getInput())
                } else {
                    ensureVisible()
                    description.innerHTML = 'Please enter your 2FA Password'
                    input.classList.remove('shake-horizontal')
                    input.offsetHeight // Triggers Reflow
                    input.classList.add("shake-horizontal")
                    input.style.border = "2px solid #d93025"
                    input.type = 'password'
                    ipcRenderer.send('password', await getInput())
                }
            }
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

        button.addEventListener('click', function f() {
            ipcRenderer.send('openFileDialog')
            button.removeEventListener('click', f)
        })

        button.style.display = ''
        input.style.display = 'none'
    })

    ipcRenderer.on('dialogCancelled', () => {
        button.addEventListener('click', function f() {
            ipcRenderer.send('openFileDialog')
            button.removeEventListener('click', f)
        })
    })


    ipcRenderer.on('selectedDir', (event, path) => {
        console.log('selectedDir', path)
        title.innerHTML = 'Setup Successfully'
        description.innerHTML = `Currently syncing <br> <u style="cursor: pointer"> ${path} <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" x="0px" y="0px" viewBox="0 0 100 100" width="15" height="15" style="color: #aaa"><path fill="currentColor" d="M18.8,85.1h56l0,0c2.2,0,4-1.8,4-4v-32h-8v28h-48v-48h28v-8h-32l0,0c-2.2,0-4,1.8-4,4v56C14.8,83.3,16.6,85.1,18.8,85.1z"></path> <polygon fill="currentColor" points="45.7,48.7 51.3,54.3 77.2,28.5 77.2,37.2 85.2,37.2 85.2,14.9 62.8,14.9 62.8,22.9 71.5,22.9"></polygon></svg></u>`
        description.addEventListener('click', _ => {
            shell.openPath(path)
        })
        button.innerHTML = 'CHANGE'

        button.addEventListener('click', function f() {
            ipcRenderer.send('changeTeleDir')
        })

        syncButton.style.display = ''
        queueButton.style.display = ''

        syncButton.addEventListener('click', function syncAll() {
            syncButton.removeEventListener("click", syncAll)
            syncButton.innerHTML = 'WAITING IN QUEUE'
            ipcRenderer.send('syncAll')
        })

        queueButton.addEventListener('click', () => {
            // Create swal style
            let swalStyle = document.createElement('style')
            swalStyle.innerHTML = `.swal-title {
                font-size: 16px !important;
                box-shadow: 0 1px 1px rgba(0, 0, 0, 0.21) !important;
                margin: 0 0 28px !important;
            }`

            // Set id so we can remove it later
            swalStyle.id = "swalStyle"

            // Get the first script tag
            let ref = document.querySelector('script')

            // Insert our new styles before the first script tag
            ref.parentNode.insertBefore(swalStyle, ref)

            // noinspection JSUnresolvedFunction
            swal({
                title: "Queue",
                content: queueList,
                button: "Close"
            }).then(_ => {
                document.getElementById("swalStyle").remove()
            })
        })
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
                 <div>RESTORE AGAIN</div>`

        // Add new listener
        const syncAll = () => {
            syncButton.removeEventListener("click", syncAll)
            syncButton.innerHTML = 'WAITING IN QUEUE'
            ipcRenderer.send('syncAll')
        }
        syncButton.addEventListener('click', syncAll)
    })

    ipcRenderer.on('syncStarting', _ => {
        syncButton.innerHTML = 'RESTORING...'
    })

    ipcRenderer.on('pushQueue', (event, action) => {
        queue.push(action)
        if (queue.length === 1) {
            queueList.style.lineHeight = ""
            queueList.innerHTML = ""
        }
        let thisAction = document.createElement('div')
        thisAction.innerHTML = "Add " + queue[queue.length - 1].relativePath
        queueList.appendChild(thisAction)
        ipcRenderer.once('shiftQueue', () => {
            console.log("SHIFTING QUEUE")
            queue.shift()

            if (queue.length === 0) {
                queueList.style.lineHeight = "440px"
                queueList.innerHTML = "TeleDrive is Idle"
            } else {
                queueList.removeChild(thisAction)
            }
        })
    })

    ipcRenderer.on('uploadConflict', async (event, conflictingFile) => {
        let msg = document.createElement("div");
        msg.innerHTML = `Newer / Unknown version of <br>${conflictingFile}</br> is already on Telegram`;

        // noinspection JSUnresolvedFunction
        let choice = await swal({
            title: "Upload Conflict",
            content: msg,
            icon: "warning",
            buttons: {
                cancel: "Fast-Forward Local",
                confirm: "Overwrite Cloud",
            },
            dangerMode: true,
            closeOnClickOutside: false
        })
        if (choice) { // Overwrite cloud
            // noinspection JSUnresolvedFunction
            swal("Conflict Resolved", "Syncing old version to cloud", "success");
            ipcRenderer.send('conflictResolved', true)
        } else { // Overwrite Local
            // noinspection JSUnresolvedFunction
            swal("Conflict Resolved", "Downloading new version from cloud", "success");
            ipcRenderer.send('conflictResolved', false)
        }
    })

    ipcRenderer.on('movingFiles', _ => {
        let loader = document.createElement("div")
        loader.style.display = "flex"
        loader.style.alignItems = "center"
        loader.style.justifyContent = "center"
        loader.innerHTML = `<div id="loader"></div>`

        // noinspection JSUnresolvedFunction
        swal({
            title: "Moving Files...",
            content: loader,
            closeOnClickOutside: false
        })
    })

    ipcRenderer.on('restarting', _ => {
        let timerElement = document.createElement("div")
        timerElement.innerHTML = `<h1>5</h1>`

        // noinspection JSUnresolvedFunction
        swal({
            title: "Relaunching App...",
            icon: "info",
            content: timerElement,
            closeOnClickOutside: false
        })

        let count = 5
        let timer = setInterval(_ => {
            if (count < 0) {
                clearInterval(timer)
            }
            count--
            timerElement.innerHTML = `<h1>${count.toString()}</h1>`
        }, 1000)
    })

    ipcRenderer.on('quit', _ => {
        // noinspection JSUnresolvedFunction
        swal({
            title: "Cleaning up...",
            icon: "info",
            closeOnClickOutside: false
        })
    })
})
