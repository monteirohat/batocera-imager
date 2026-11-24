<p align="center">
  <img src="build/icon.png" alt="" width="128">
</p>

<h1 align="center">Batocera Imager</h1>

<p align="center">
  <strong>Unofficial installer for Batocera: pick your device and it writes the right image to a USB key or SD card.</strong>
</p>

<p align="center">
  <a href="https://github.com/monteirohat/batocera-imager/actions/workflows/ci.yml"><img src="https://github.com/monteirohat/batocera-imager/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/monteirohat/batocera-imager" alt="License"></a>
</p>

---

[Batocera](https://batocera.org) turns a computer, a board or a handheld into a retro console. To
install it, you pick the image made for your device on
[batocera.org/download](https://batocera.org/download), download it, and write it to a USB key or
an SD card with a separate tool. Batocera Imager does it in one place: choose your device and the
USB key or SD card, and it downloads the right image, checks it, writes it and reads it back.

> **This project is not made by the Batocera team.** It uses batocera.org's look, its list of
> devices and their photos (loaded from batocera.org), and the images come from Batocera's own
> servers. Batocera's logo is not used until the team agrees.

<p align="center">
  <img src="docs/assets/screenshots/device.png" alt="Choosing the device: families and models with their photos from batocera.org" width="820">
</p>

## How to use

1. **Device.** Choose the family (handhelds, PC, Raspberry Pi…) and your model, as on the
   download page. The model decides which image is written.
2. **Drive.** Plug in a USB key or an SD card and choose it. Only external and removable drives
   are listed; drives too small for the image are greyed out. Batocera 44 needs a 16 GB drive.
3. **Write.** Confirm. The installer asks for your password on macOS and Linux, then downloads,
   writes and verifies. On macOS, the first time, allow Batocera Imager to use removable volumes
   when macOS asks. At the end the drive is ejected.

<p align="center">
  <img src="docs/assets/screenshots/drive.png" alt="Choosing the drive: drives too small for the image are greyed out" width="820">
</p>

### A real installation

Batocera 44 for a Raspberry Pi 4 written to a 64 GB USB key by the macOS app: 9.13 GB written at
8 MB/s, read back and compared at 21 MB/s, then ejected.

<p align="center">
  <img src="docs/assets/screenshots/writing.png" alt="Writing" width="410">
  <img src="docs/assets/screenshots/verifying.png" alt="Verifying" width="410">
</p>
<p align="center">
  <img src="docs/assets/screenshots/done.png" alt="Written and verified" width="820">
</p>

## What it does

- **Reads batocera.org/download** for the families, the models and their images, and keeps the
  list for when the site can't be reached.
- **Downloads the image**, resuming if the connection drops, and **checks its MD5** before any
  drive is touched. The image is kept for next time (About deletes it).
- **Writes and reads back**: a SHA-256 of what was written is compared with what the drive gives
  back, which catches a damaged or fake drive.
- **Never offers the computer's own disks**, and checks again right before erasing that the drive
  is still the one you chose.

How it works on each system, and the safety rules: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Status

Early. The whole job works on macOS with a real USB key (above). On Linux and Windows the tests
and the build pass, and the drive filters were checked on real Linux output, but no drive has been
written on them yet: that is the next test before a first release. There is no release yet: build
it from source.

## Building from source

Requirements: [Node.js 20+](https://nodejs.org).

```bash
git clone https://github.com/monteirohat/batocera-imager.git
cd batocera-imager
npm install
npm run dev          # development, with live reload of the interface
npm test             # tests
npm run dist         # installers for the current system, in release/
```

On Linux, writing needs polkit's `pkexec` (installed on most desktops). On Windows the installer
runs as administrator.

## Contributing

The look follows [docs/STYLE.md](docs/STYLE.md), taken from batocera.org: read it before changing
a screen.

## License

[MIT](LICENSE). Batocera is a trademark of its authors; this project is not affiliated with them.
