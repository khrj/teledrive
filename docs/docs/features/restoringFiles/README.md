# Restoring files

## Restoring files using TeleDrive

![Restoring files](../../images/features.restoringFiles/restoreFiles.png)

- Click restore

This will download all files backed up previously via TeleDrive 
that are not present in the synced folder.
Existing files will not be re-downloaded

**For example:**

Device before restore:
```
TeleDriveSync ---- Folder1 ---- File1
```

Cloud before restore:
```
TeleDriveSync ---- Folder1 ---- File1
            |
            | ---- Folder2 ---- File2
```

Here, `Folder2` will be created and `File2` will be downloaded.

Device after restore:
```
TeleDriveSync ---- Folder1 ---- File1
            |
            | ---- Folder2 ---- File2
```

## Restoring individual files using Telegram's apps

In addition to restoring using TeleDrive, individual files can also be downloaded using Telegram's official apps
