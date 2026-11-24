// Opens a drive for writing on the current system.

import type { Drive } from "../../shared/types";
import * as linux from "./linux";
import * as macos from "./macos";
import type { DriveAccess } from "./types";
import * as windows from "./windows";

export { AccessRefused, type DriveAccess } from "./types";

export function openDrive(drive: Drive, signal: AbortSignal): Promise<DriveAccess> {
  switch (process.platform) {
    case "darwin": return macos.openDrive(drive, signal);
    case "linux": return linux.openDrive(drive, signal);
    case "win32": return windows.openDrive(drive, signal);
    default: throw new Error(`Writing drives is not supported on ${process.platform}.`);
  }
}
