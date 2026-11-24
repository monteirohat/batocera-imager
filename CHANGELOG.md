# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Three steps instead of four: the installer opens on the device, and the drive step lists every
  drive with its kind. The step that asked first for the kind of drive (USB key, SD card,
  external drive) only sorted that list, and the kind is the system's guess.
- macOS: the writing helper runs through `sudo` with the installer's own password dialog, as
  balenaEtcher does, so macOS can ask once for removable volumes; no Full Disk Access needed.
- The exact unpacked size of an image is read from its partition table before downloading
  (Batocera 44 is 9.13 GB on ARM boards and 11.28 GB on PCs), so a drive too small is refused
  before anything is erased; the writer also never writes past the end of a drive.
- Write progress counts the bytes that reached the drive, so the empty end of an image no longer
  stalls the bar at 99 %.
- If the image's size can't be read when the device is chosen (no answer from the server), it is
  asked again when the drive step opens, and the drive step says so while it is unknown.
- Windows: the drive list reads the bus however PowerShell prints it (name or number), and a
  refused write points to Controlled folder access. Linux: a missing polkit agent or a refusal by
  polkit is said in plain words.

### Added

- Device photos: the family tiles and the model cards show the photos of batocera.org/download,
  loaded from the site (`DEVICE_PHOTOS` in `src/shared/brand.ts`). Where the site shows its logo,
  a model's photo or the family's icon stands in, until the Batocera team agrees to the logo.
- The first version of the installer, with batocera.org's look (docs/STYLE.md):
  - **Device**: the families and models of batocera.org/download, read from the site, with search
    and makers; the list is kept for when the site can't be reached.
  - **Drive**: external and removable drives only, following what is plugged in; drives too small
    for the image are greyed out.
  - **Write**: the image is downloaded (resuming, checked against its MD5, kept for next time),
    written, read back and compared, then the drive is ejected.
- macOS, Linux (polkit) and Windows (administrator) ways to open a drive; see docs/ARCHITECTURE.md.
- Tests of the catalog reader, the drive filters, the download and the writer.
