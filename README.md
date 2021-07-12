<img src="icon/vector/banner.svg" alt="TeleDrive logo" width="100%">

> TeleDrive lets you automatically backup ANY files to Telegram Saved Messages - this means **UNLIMITED** storage, as long as each file is under 2GB

<div align="center">
<a href="https://teledrive.khushrajrathod.me/api/?type=AppImage">
  <img alt="Download as an AppImage" src="icon/vector/download-appimage.svg" />
</a>

Download links: <br>
<a href="https://teledrive.khushrajrathod.me/api/?type=exe">Windows (NSIS)</a> --- <a href="https://teledrive.khushrajrathod.me/api/?type=dmg">macOS (DMG)</a>
</div>

---

Alternatively, for macOS, install using [homebrew](https://brew.sh/)
```bash
brew cask install --no-quarantine khushrajrathod/teledrive/teledrive
```
> See [code signing](https://github.com/khrj/TeleDrive/issues/10) for more info on why --no-quarantine is used

# Screenshots

<img src="images/auth/Auth-PhoneNumber.png" alt="Authentication - Phone Number" width="350px"> <img src="images/auth/Auth-selectdir.png" alt="Authentication - Select Dir" width="350px"> <img src="images/auth/Auth-success.png" alt="Authentication - Success" width="350px"> <img src="images/conflict/conflict.png" alt="Conflict" width="350px">

# How does it work?
TeleDrive watches a folder for changes and automatically uploads any files contained within that folder to Telegram's saved messages. TeleDrive tags sub folders with their names, so when you restore your files using TeleDrive, you automatically get your folder structure back. For e.x if a TeleDrive's synced folder contains two sub folders, each containing one file:

```
TeleDriveSync ---- ----- Folder1 ----- MyFile1.txt
                 |
                 |
                 |
                 | ----- Folder2 ----- MyFile2.txt

```

Then TeleDrive will upload your files with the following tags:

- #TeleDrive /Folder1/MyFile1.txt
- #TeleDrive /Folder2/MyFile2.txt

This preserves your folder structure, even in a chat like Telegram's saved messages - This means that when you restore your files, you get the exact same folder structure back.

```
TeleDriveSync ---- ----- Folder1 ----- MyFile1.txt
                 |
                 |
                 |
                 | ----- Folder2 ----- MyFile2.txt
```

# Features

- Watch a folder for changes and automatically reupload when files are changed
- Preserve folder structure when restoring using TeleDrive
- Uses a master file for quickly finding messages and file versioning
- SHA256 based file versioning
- Queue viewer for uploads
- Built in conflict resolver
  - When there's a newer file on Saved Messages but you're trying to backup

# Running from source
1. Clone repository:
```bash
git clone https://github.com/khrj/TeleDrive
cd TeleDrive
```

2. Get dependencies:
```bash
yarn
```

3. Run:
```bash
yarn start
```

# Built with:

- [Electron](https://www.electronjs.org/)
- [Electron Builder](https://www.electron.build/)
- [Airgram](https://airgram.io/)
- [Chokidar](https://github.com/paulmillr/chokidar)
- [Electron Store](https://github.com/sindresorhus/electron-store#readme)
- [ncp](https://github.com/AvianFlu/ncp)
- [Electron Log](https://github.com/megahertz/electron-log)

# License:
- TeleDrive is licensed under the GPLv3 license
