# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The first version of the installer, with batocera.org's look (docs/STYLE.md):
  - **Media**: USB key, SD card or external drive.
  - **Device**: the families and models of batocera.org/download, read from the site, with search
    and makers; the list is kept for when the site can't be reached.
  - **Drive**: external and removable drives only, following what is plugged in; drives too small
    for the image are greyed out.
  - **Write**: the image is downloaded (resuming, checked against its MD5, kept for next time),
    written, read back and compared, then the drive is ejected.
- macOS, Linux (polkit) and Windows (administrator) ways to open a drive; see docs/ARCHITECTURE.md.
- Tests of the catalog reader, the drive filters, the download and the writer.
