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
        } else if (!os && /Linux/.test(platform)) {
            os = 'Linux'
        }
    
        return os
    }
    
    document.getElementById('download').innerHTML = `Download for ${getOS()}`
    document.getElementById('download').href = `latest/${getOS()}`

})