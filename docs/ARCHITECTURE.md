# Architecture

How the installer finds the right image and writes it, and the rules that keep it from writing
to the wrong disk. What it should look like is in [STYLE.md](STYLE.md).

## Processes

An Electron app in three parts, as in BatoX Installer:

| Part | Where | What it does |
|---|---|---|
| Main process | `src/main/` | Reads batocera.org, downloads images, lists drives, opens and writes them |
| Preload | `src/preload/preload.ts` | Exposes a small typed API to the interface as `window.imager` |
| Interface | `src/renderer/` | React screens; no access to Node, files or drives |

The interface runs with context isolation and the sandbox. It can ask for the catalog, the
drives and a write, and that is all. Types shared by the three are in `src/shared/types.ts`.

## The device list

batocera.org has no API. Its download page lists every model as a card whose `data-*`
attributes hold what the installer needs: the image URL (`href`), the MD5 URL, the version, the
release date and the families the model belongs to (`data-gs`). `src/main/catalog.ts` reads
those attributes and the family tiles above them.

- If the page no longer has cards in that shape, the parser throws instead of showing a partial
  list: the person sees "look for an update of the installer".
- The last good list is saved in the app's data folder (`catalog.json`) and shown, with a notice,
  when batocera.org can't be reached.
- The family tiles' and the models' photos are read too, and the interface loads them from
  batocera.org (switch: `DEVICE_PHOTOS` in `src/shared/brand.ts`). Where the site shows its logo
  instead of a photo, a family takes the photo of its first model that has one, and a model shows
  its family's icon: the logo waits for the Batocera team's agreement (`OFFICIAL_LOGO`). A photo
  that fails to load also falls back to the icon.

## Images

`src/main/download.ts` downloads the `.img.gz` into the app's data folder (`images/`):

- **It resumes.** A stopped download continues with an HTTP range request, up to five attempts.
  A server error (5xx) is tried again; a connection that sends nothing for a minute is dropped
  and resumed. Only the wait for the server's answer has a time limit, not the download itself.
- **It is checked before anything touches a drive.** The MD5 published next to the image is
  compared with the downloaded file; a mismatch deletes it.
- **It is kept for next time.** A kept image is reused while its MD5 is still the published one,
  and it is checked again each time (a file that went bad on the computer is downloaded again).
  Only the last image is kept; About can delete it.
- **Free space** is checked before downloading.

`src/main/image.ts` knows the unpacked size before the download, with two small range requests.
gzip keeps the size only modulo 4 GiB in its last four bytes (a 9.13 GB image and a 4.83 GB one
end the same way), so the installer also unpacks the first 64 KiB of the file: the image's own
partition table (MBR, or GPT's header) says where its last partition ends, and the right size is
the candidate that reaches that far. Drives smaller than it are greyed out, and flash() checks it
again on the downloaded file before anything is erased. If the partition table can't be read, the
smallest candidate is kept and shown as "or more".

Sizes measured on 2026-11-24: Batocera 44 is 9.13 GB for the ARM boards (Pi 4, Pi 5, Odroid…)
and 11.28 GB for PCs, so it needs a 16 GB drive; older images (v41, v42) are 7.00 GB.
batocera.org still says "8 GB or more".

## Drives

`src/main/drives/` lists the drives on each system. The rule is the same everywhere: **only
whole, external or removable, writable disks; never one the running system uses.**

| System | Source | Offered | Never offered |
|---|---|---|---|
| macOS | `diskutil list -plist physical`, then `diskutil info -plist` per disk | Not internal, or removable media (the built-in SD slot reports Internal) | The disk the Mac runs from, even an external one (found through the APFS physical store behind `/`), internal disks, disk images and APFS containers (virtual), partitions, read-only media |
| Linux | `lsblk --json --bytes`, and `/sys/block/mmcblkN/device/type` | Removable, hot-plugged, or on the USB or SD bus, and mounted only under `/media`, `/run/media` or `/mnt` | A disk with any other mount (`/`, `/boot`, swap, a live system's `/run/live/medium` or `/cdrom`…), built-in eMMC (an mmcblk device that is not an SD card), loops, optical drives, read-only disks |
| Windows | PowerShell `Get-Disk`, `Get-Partition` | On the USB, SD or MMC bus | The boot and the system disk, read-only disks |

Linux and Windows also give each drive's serial number, which the identity check below compares.

The kind (USB key, SD card, external drive) is a guess from the bus and the name; the drive
screen only sorts by it and never hides a drive because of it.

## Writing

`src/main/flash.ts` runs the job in this order:

1. Get the image: download and MD5 check, or the cached copy.
2. Refuse a drive smaller than the image.
3. **List the drives again and check that the chosen one is still there with the same name, size
   and serial number** (`confirmSameDrive`). A drive unplugged during the download and another
   one plugged in can take the same path.
4. Open the drive (below), which may wait for the password, then **check it again** before
   anything is erased.
5. Write, read back, close, eject.

One write runs at a time. Closing the window or quitting during a write asks first, then cancels
it and waits until the drive is closed and given back.

### Opening a drive

Only the step that needs privileges runs with them, and it asks once:

- **macOS** (`access/macos.ts`, `helper.ts`): macOS lets no one hand a raw drive to a normal
  user, root included, so the writing runs as root in a helper: the app's own executable in Node
  mode. It is started the way balenaEtcher starts its writer: through `sudo`, with the password
  asked by a small dialog of our own (`SUDO_ASKPASS`). sudo keeps the helper in the person's
  session and attributed to Batocera Imager, so macOS can ask once whether the app may use
  removable volumes, and remembers the answer. (macOS's own administrator prompt,
  `osascript … with administrator privileges`, runs the command in root's session instead,
  where macOS can't ask and refuses the drive unless the app has Full Disk Access; that was the
  first design, and it failed on a real USB key.) The helper connects to a Unix socket in a
  private folder, waits for "go", checks as root that the drive is an external physical disk
  and not the one the Mac runs from, unmounts it, writes, reads back through the raw device
  `/dev/rdiskN` (no cache) and reports progress; it stops if the socket closes. The drive and
  the image are fixed on its command line. Afterwards the app ejects the drive. If the person
  refused removable volumes, the app shows where to turn them on.
- **Linux** (`access/linux.ts`): `pkexec` (polkit) runs a short shell script as root
  (`ROOT_SCRIPT`). It checks the path, refuses a drive mounted where the system lives, unmounts
  the drive's partitions, gives the device file to the person and prints `ready`. The installer
  opens the drive with `O_EXCL` (refused if the system still uses it) and writes, then sends
  `flush` on the script's standard input: the script empties the kernel's buffers for the drive
  (`blockdev --flushbufs`) so that reading back reads the drive itself. If the pipe closes
  instead (cancel, quit, crash), the script stops at once. Either way it gives the device file
  back to its owner when it ends. Cancelling while the password prompt is open stops pkexec. At
  the end, `udisksctl power-off` makes the drive safe to remove.
- **Windows** (`access/windows.ts`): the app runs as administrator (the manifest asks for it).
  `diskpart` removes the drive's partitions so Windows lets go of its volumes, then
  `\\.\PhysicalDriveN` is opened. Windows mounts the new partitions after writing; the person
  ejects from the taskbar.

### What each system may still refuse

Reviewed on 2026-11-24, after macOS's privacy rules refused the first design:

- **macOS.** Besides the password, macOS asks once whether Batocera Imager may use removable
  volumes; a "no" is shown with the way to turn it on (System Settings > Privacy & Security >
  Files and Folders). macOS ties that answer to the app's signature: with an ad-hoc signature every
  build counts as a new app and asks again; a Developer ID signature keeps it across updates.
- **Linux.** No privacy layer like macOS's for drives: polkit decides, and udev gives the device
  back to root afterwards. It needs a polkit authentication agent, which every desktop runs; without
  one (a bare window manager) pkexec can't ask and the installer says so. pkexec's prompt names
  `/bin/sh`; a polkit policy file shipped in the .deb could give it the installer's own words.
  Still to test: the AppImage on Ubuntu 24.04 and later, where AppArmor restricts the user
  namespaces Electron's sandbox uses.
- **Windows.** The whole app runs as administrator, with the UAC prompt at launch (as Raspberry Pi
  Imager does; balenaEtcher elevates only its writer, which could be done here with the helper
  and a named pipe). Writing the partition table last keeps Windows from mounting the new
  partitions in the middle of the write, which would make it refuse the next writes. If
  Controlled folder access (Ransomware protection) is on, Windows blocks writes to disk sectors
  by apps it doesn't know: the error says where to allow the installer. Signing the installer
  (Authenticode) avoids the SmartScreen warning.

### Writing and verifying

`src/main/writer.ts` unpacks the image on the fly and writes it in 4 MiB blocks; while one block
is written the next one is filled. Writes are whole 4 KiB units, which drives with 4K sectors
require (the last block is padded with zeros, past the end of the image). The order protects the
partition table:

1. The first and the last MiB of the drive are cleared, so the system finds no old partitions to
   mount during the write, and no old backup GPT survives at the end.
2. The image is written from its second block on.
3. Its first block, with the new partition table, is written last. A drive that was interrupted
   has no partitions at all, rather than half an image that looks valid.

A SHA-256 of what was written is compared with a SHA-256 of what the drive gives back, so a
damaged drive, or a fake one that is smaller than it claims, is caught before the person tries to
boot from it.

## Safety rules

1. The interface never sends a path to open: it sends a drive it was given, and the main process
   looks it up again in the current list. Likewise, only a device from the catalog can be written.
2. The internal and system disks are filtered out where drives are listed, not in the interface.
3. Nothing touches a drive before the image passed its MD5 check.
4. The drive is checked again before it is opened and once more after, before anything is erased
   (steps 3 and 4 above).
5. The confirmation names the drive, its size and its volumes, and its focus starts on **Back**.
6. Drive paths are checked against a strict pattern before they reach a command, and the drive's
   name only reaches the macOS prompt as an escaped AppleScript string.

## Developing

```bash
npm install
npm run dev        # the app, with live reload of the interface
npm run dev:web    # the interface alone in a browser, on demo data (src/renderer/demo.ts)
npm test           # catalog, drives, download and writing tests (Vitest)
npm run typecheck
```

Run the app from a normal terminal. A terminal inside VS Code's extension host may set
`ELECTRON_RUN_AS_NODE=1`, which starts Electron as plain Node (`app` is then undefined).

### A test drive on macOS

To write for real without a USB key, use a RAM disk. It belongs to you, so no password is asked,
and the installer only offers it in development, when it is named:

```bash
hdiutil attach -nomount ram://16777216          # 8 GiB; prints /dev/diskN
IMAGER_TEST_DRIVE=/dev/diskN npm run dev
hdiutil detach /dev/diskN                        # when done, if the installer did not eject it
```

### What has been tested where

| | macOS | Linux | Windows |
|---|---|---|---|
| Drive list | On a Mac (internal disk refused, RAM disk offered when named) | Filter run on a real `lsblk` (Batocera's own SD card refused) and on samples | Samples only |
| Write and verify | End to end on a RAM disk, read back independently. On a real 62.9 GB USB key, from the packaged app: Batocera 44 for the Pi 4 (9.13 GB) written at 8 MB/s, verified at 21 MB/s, ejected (2026-11-24). Before that, a 7.75 GB key showed the image was larger than estimated, which led to the exact size check | Not yet | Not yet |
| Password prompt | sudo with our dialog, on a real USB key; the removable-volumes permission | The root script's protocol, with stub commands (write, cancel, system drive refused) | — (runs as administrator) |

A USB key on each system is the next test before a release.
