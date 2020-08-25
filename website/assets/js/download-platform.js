window.addEventListener('DOMContentLoaded', (event) => {
    const getOS = () => {
        let userAgent = window.navigator.userAgent,
            platform = window.navigator.platform,
            macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
            windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
            os = null
        
        if (macosPlatforms.indexOf(platform) !== -1) {
            os = 'macOS'
        } else if (windowsPlatforms.indexOf(platform) !== -1) {
            os = 'Windows'
        } else if (/Linux/.test(platform)) {
            os = 'Linux'
        } else {
            os = "Windows"
        }
    
        return os
    }
    const button = document.getElementById('download')
    button.children[0].children[0].innerHTML = `Download for ${getOS()}`
    button.children[1].style.display = "flex"
    document.getElementById('quick-download').setAttribute('onclick',`location.href = "latest/${getOS()}"`)
})