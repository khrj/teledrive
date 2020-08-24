exports.default = async context => {
    if (context.electronPlatformName === "linux") {
        const { copyFile } = require("fs").promises
        const { join } = require("path")

        const storeLib = async lib => { await copyFile(`/usr/lib/x86_64-linux-gnu/${lib}`, join(context.appOutDir, `${lib}`)) }

        const libs = [
            'libc++.so.1',
            'libc++abi.so.1',
            'libssl.so.1.0.0',
            'libcrypto.so.1.0.0'
        ]

        libs.forEach(lib => storeLib(lib))
    }
}
