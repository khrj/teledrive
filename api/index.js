const { getRelease } = require("get-release")
module.exports = async (req, res) => {
    try {
        let url = await getRelease(
            {
                provider: "github",
                user: "khrj",
                repo: "TeleDrive",
                part: req.query.type
            }
        )

        res.writeHead(302, {
            'Location': url
        })
        res.end()
    } catch (e) {
        console.log("Error: " + e)
        res.end("Error: " + e)
    }
}
