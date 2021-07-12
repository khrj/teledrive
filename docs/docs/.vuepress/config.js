const {description} = require('../../package')

module.exports = {
    title: 'TeleDrive Documentation',
    description: description,
    head: [
        ['meta', {name: 'theme-color', content: '#3eaf7c'}],
        ['meta', {name: 'apple-mobile-web-app-capable', content: 'yes'}],
        ['meta', {name: 'apple-mobile-web-app-status-bar-style', content: 'black'}]
    ],
    themeConfig: {
        repo: 'khrj/teledrive',
        editLinks: true,
        docsDir: 'vuepress-documentation/docs',
        editLinkText: 'Help us improve this page',
        docsBranch: 'main',
        nav: [
            {
                text: 'Installation Guide',
                link: '/guide/',
            },
            {
                text: 'Features',
                link: '/features/'
            },
            {
                text: 'Download',
                link: 'https://teledrive.khushrajrathod.me/'
            }
        ],
        sidebar: {
            '/guide/': [
                {
                    title: 'Installation Guide',
                    collapsable: false,
                    children: [
                        'windows/',
                        'macOS/',
                        'linux/'
                    ]
                }
            ],
            '/features/': [
                {
                    title: "Features",
                    collapsable: false,
                    children: [
                        'signingIn/',
                        'syncedDir/',
                        'uploadingFiles/',
                        'restoringFiles/',
                        'conflictResolver/'
                    ]
                }
            ]
        },
        sidebarDepth: 2
    },
    plugins: [
        '@vuepress/plugin-back-to-top',
        '@vuepress/plugin-medium-zoom',
    ],
    dest: '../website-build/docs/',
    base: '/docs/'
}
