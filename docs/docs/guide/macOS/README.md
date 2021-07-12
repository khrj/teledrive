# macOS
## DMG (recommended for most users)
::: danger
macOS DMG is unsigned. Right click > Open in Finder the first time to open. [Learn more](https://github.com/khrj/TeleDrive/issues/10#issue-672883960)
:::

- Go to the [homepage](https://teledrive.khushrajrathod.me)
- Select 'Download for macOS' (Or select the dropdown > macOS (DMG))

## Homebrew
### Prefer a video?
<br>
<iframe width="640" height="360" src="https://www.youtube-nocookie.com/embed/nt-L33EGi1k?rel=0" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

### Steps
- [Open a terminal](https://support.apple.com/en-in/guide/terminal/apd5265185d-f365-44cb-8b09-71a064a42125/mac)

If you don't already have homebrew, run
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
```

Then, run
```
brew cask install khushrajrathod/teledrive/teledrive --no-quarantine
```
