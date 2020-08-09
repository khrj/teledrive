exports.default = async context => {
    if (context.electronPlatformName === "linux") {
        const { copyFile } = require("fs").promises
        const { join } = require("path")
        await copyFile("/usr/lib/x86_64-linux-gnu/libc++.so.1", join(context.appOutDir, "libc++.so.1"))
        await copyFile("/usr/lib/x86_64-linux-gnu/libssl.so.1.0.0", join(context.appOutDir, "libssl.so.1.0.0"))
        await copyFile("/usr/lib/x86_64-linux-gnu/libcrypto.so.1.0.0", join(context.appOutDir, "libcrypto.so.1.0.0"))
    }
}
