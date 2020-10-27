module.exports = {
    appId: 'me.khushrajrathod.teledrive',
    productName: 'TeleDrive',
    copyright: 'Copyright © 2020 Khushraj Rathod',
    artifactName: "${productName}-${version}-${arch}.${ext}",
    directories: {
        buildResources: 'icon'
    },
    extraResources: [
        {
            from: 'tdlib/${os}',
            to: 'tdlib/${os}',
            filter: [
                '**/*'
            ]
        }
    ],
    files: [
        'src/',
        'LICENSE',
        'icon/tray.png',
        'icon/trayTemplate.png',
        'icon/tray.ico'
    ],
    mac: {
        category: 'public.app-category.utilities',
        darkModeSupport: 'false',
        minimumSystemVersion: '10.13',
        hardenedRuntime: 'true'
    },
    win: {
        target: [
            'appx',
            'nsis'
        ]
    },
    snap: {
        confinement: 'strict',
        summary: 'An app that lets you automatically backup to Telegram Saved Messages',
        grade: 'devel',
        stagePackages: [
            'libc++1',
            'libssl1.0.0',
            'libasound2',
            'libgconf2-4',
            'libnotify4',
            'libnspr4',
            'libnss3',
            'libpcre3',
            'libpulse0',
            'libxss1',
            'libxtst6'
        ]
    },
    afterPack: './scripts/linuxDepends.js',
}