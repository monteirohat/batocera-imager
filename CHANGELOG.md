# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-24

The first version. Unofficial: Batocera Imager is not made by the Batocera team.

### Added

- Three steps, with batocera.org's look ([docs/STYLE.md](docs/STYLE.md)):
  - **Device**: the families and models of [batocera.org/download](https://batocera.org/download),
    read from the site with their photos, with search and makers. The list is kept for when the
    site can't be reached.
  - **Drive**: external and removable drives only, following what is plugged in. The exact size
    of the image is read from its partition table before downloading, and drives too small for
    it are greyed out.
  - **Write**: the image is downloaded (resuming if the connection drops, checked against the MD5
    published by Batocera, kept for next time), written with its partition table last, read back
    and compared, then the drive is ejected.
- One password per write: on macOS through a `sudo` helper with the installer's own dialog, as
  balenaEtcher does (macOS also asks once to allow removable volumes); on Linux through polkit
  (`pkexec`); on Windows the installer runs as administrator.
- Safety: the computer's own disks are never listed, the drive is checked again right before it
  is erased, and nothing is written past its end.
- Installers for Windows (setup and portable), macOS (Apple silicon and Intel) and Linux
  (AppImage and .deb).

### Known issues

- Tested end to end on macOS (Apple silicon) with a real USB key. On Linux and Windows the tests
  and the build pass, but no drive has been written on them yet.
- The installers are not signed: macOS and Windows warn on first launch (see the README). On
  macOS, the removable-volumes permission is asked again after each update until the app is signed
  with a Developer ID.
- Batocera 44 needs a 16 GB drive (its image is 9.13 GB for ARM boards and 11.28 GB for PCs),
  although batocera.org says 8 GB.

[Unreleased]: https://github.com/monteirohat/batocera-imager/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/monteirohat/batocera-imager/releases/tag/v0.1.0
