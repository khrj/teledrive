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
        repo: 'KhushrajRathod/TeleDrive',
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
                link: 'https://www.khushrajrathod.me/TeleDrive'
            }
        ],
        sidebar: {
            '/guide/': [
                {
                    title: 'Guide',
                    collapsable: false,
                    children: [
                        '',
                        'using-vue',
                    ]
                }
            ],
        }
    },

    /**
     * Apply plugins，ref：https://v1.vuepress.vuejs.org/zh/plugin/
     */
    plugins: [
        '@vuepress/plugin-back-to-top',
        '@vuepress/plugin-medium-zoom',
    ],
    dest: '../docs/docs/',
    base: '/TeleDrive/docs/'
}
