// Types shared by the main process, the preload script and the interface.
// They describe the small API the interface uses to talk to the system.

/** What the person will write Batocera to. */
export type MediaKind = "usb" | "sd" | "disk";

/** A device family, as the tiles at the top of batocera.org/download. */
export interface Family {
  id: string;
  /** Short name on the tile ("Raspberry Pi"). */
  name: string;
  /** Long name in the model heading ("Raspberry Pi boards"). */
  title: string;
  /** The tile's picture on batocera.org, or "" (shown when DEVICE_PHOTOS is on, see brand.ts). */
  photoUrl: string;
}

/** A model, as one card of batocera.org/download. */
export interface Device {
  id: string;
  name: string;
  vendor: string;
  /** Families the model belongs to (a handheld PC is in "handheld" and "pc"). */
  groups: string[];
  /** Batocera version of its image ("44"). */
  version: string;
  /** Release date as the site writes it ("November 16, 2026"). */
  date: string;
  /** The line under the name on the site: a version or a short note. */
  note: string;
  /** How the site colors that line: the current version, an older one, or plain text. */
  noteKind: "current" | "old" | "plain";
  /** The device stayed on an older Batocera version. */
  old: boolean;
  /** Tested and labeled by the Batocera team. */
  labeled: boolean;
  imageUrl: string;
  md5Url: string;
  /** Photo on batocera.org, or "" when the site has none (shown when DEVICE_PHOTOS is on, see brand.ts). */
  photoUrl: string;
  docUrl: string;
  /** Lower-case words to search in. */
  search: string;
}

export interface Catalog {
  families: Family[];
  devices: Device[];
  /** When it was read from batocera.org (ISO date). */
  fetchedAt: string;
  /** True when batocera.org could not be reached and a saved copy is shown. */
  offline: boolean;
}

/** A drive the image can be written to. Internal and system disks never appear. */
export interface Drive {
  /** Stable id for the interface: the device path. */
  id: string;
  /** /dev/disk4, /dev/sdb or \\.\PhysicalDrive2. */
  path: string;
  name: string;
  size: number;
  /** Our best guess of what it is; the interface sorts by it. */
  kind: MediaKind;
  /** Where its volumes are mounted ("/Volumes/UNTITLED", "E:"). */
  mountpoints: string[];
  /** The hardware's serial number, where the system tells it (Linux, Windows). */
  serial?: string;
}

/** What the image needs, known before downloading it (see src/main/image.ts). */
export interface ImageInfo {
  /** Size of the .img.gz file. */
  compressedSize: number;
  /** Size of the unpacked image: what the drive must hold. */
  size: number;
  /**
   * True when `size` comes from the image's partition table. False when it
   * could not be read: `size` is then only the smallest the image can be.
   */
  exact: boolean;
}

export type Phase = "download" | "check" | "access" | "write" | "verify" | "finish";

export interface FlashProgress {
  phase: Phase;
  /** 0-1 inside the phase, or null when it can't be measured. */
  fraction: number | null;
  done: number;
  total: number;
  /** Bytes per second, averaged; 0 when unknown. */
  speed: number;
  /** The image was already downloaded: the download phase was skipped. */
  cached?: boolean;
}

export interface FlashRequest {
  device: Device;
  drive: Drive;
}

export interface FlashResult {
  /** Bytes written to the drive. */
  written: number;
  /** The drive was ejected and can be removed. */
  ejected: boolean;
}

export interface AppInfo {
  version: string;
  repo: string;
  /** process.platform: "darwin", "linux" or "win32". */
  platform: string;
  /** Size of the images kept for next time. */
  cacheSize: number;
}

/** Exposed to the interface as window.imager by the preload script. */
export interface ImagerApi {
  catalog(refresh?: boolean): Promise<Catalog>;
  imageInfo(device: Device): Promise<ImageInfo>;
  drives(): Promise<Drive[]>;
  flash(request: FlashRequest): Promise<FlashResult>;
  cancel(): Promise<void>;
  /** Subscribes to flash progress; returns a function that unsubscribes. */
  onProgress(callback: (progress: FlashProgress) => void): () => void;
  clearCache(): Promise<void>;
  openExternal(url: string): Promise<void>;
  /** macOS: opens System Settings at Privacy & Security > Files and Folders. */
  openPrivacySettings(): Promise<void>;
  appInfo(): Promise<AppInfo>;
}

export const REPO_URL = "https://github.com/monteirohat/batocera-imager";

/**
 * The start of the error shown when macOS refused the drive because the person
 * did not allow removable volumes: the interface recognizes it and offers to
 * open the settings.
 */
export const DRIVE_PRIVACY_ERROR = "macOS did not let Batocera Imager use the drive.";
export const DOWNLOAD_PAGE = "https://batocera.org/download";
