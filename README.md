<div align="center">
<img src="icon/vector/banner.svg" alt="TeleDrive logo" width="100%">
</div>

> TeleDrive lets you automatically backup ANY files to Telegram Saved Messages - this means **UNLIMITED** storage, as long as each file is under 2GB

<div align="center">
<a href="https://snapcraft.io/teledrive">
  <img alt="Get it from the Snap Store" src="https://snapcraft.io/static/images/badges/en/snap-store-black.svg" />
</a>
<a href="https://www.khushrajrathod.me/TeleDrive/latest/linux">
  <img alt="Download as an AppImage" src="icon/vector/download-appimage.svg" />
</a>
</div>

<div align="center">
Alternative download links: <br>
<a href="https://www.khushrajrathod.me/TeleDrive/latest/windows">Windows (NSIS)</a> --- <a href="https://www.khushrajrathod.me/TeleDrive/latest/macOS">macOS (DMG)</a>
</div>

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
- SHA252 based file versioning
- Queue viewer for uploads
- Built in conflict resolver
  - When there's an older file on Saved Messages and you're trying to restore
  - When there's a newer file on Saved Messages but you're trying to backup

# Screenshots

[Work in progress]

# Running from source
1. Clone repository:
```bash
git clone https://github.com/KhushrajRathod/TeleDrive
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
