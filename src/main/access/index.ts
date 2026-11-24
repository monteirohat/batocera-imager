// Opens a drive for writing on the current system.

import type { Drive } from "../../shared/types";
import * as linux from "./linux";
import * as macos from "./macos";
import type { DriveAccess } from "./types";
import * as windows from "./windows";

export { AccessRefused, type DriveAccess } from "./types";

export interface OpenOptions {
  /** The .img.gz that will be written (macOS fixes it on the helper's command line). */
  image: string;
  /** Development only: the drive is a test disk image. */
  testDrive?: boolean;
}

export function openDrive(drive: Drive, signal: AbortSignal, options: OpenOptions): Promise<DriveAccess> {
  switch (process.platform) {
    case "darwin": return macos.openDrive(drive, signal, options);
    case "linux": return linux.openDrive(drive, signal);
    case "win32": return windows.openDrive(drive, signal);
    default: throw new Error(`Writing drives is not supported on ${process.platform}.`);
  }
}
