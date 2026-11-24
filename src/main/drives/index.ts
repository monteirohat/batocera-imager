// The drives Batocera can be written to, on the current system.

import type { Drive } from "../../shared/types";
import * as linux from "./linux";
import * as macos from "./macos";
import * as windows from "./windows";

export interface ListOptions {
  /** Development only: a macOS disk image to offer as a drive. */
  testDrive?: string;
}

export async function listDrives(options: ListOptions = {}): Promise<Drive[]> {
  let drives: Drive[];
  switch (process.platform) {
    case "darwin": drives = await macos.listDrives(options.testDrive); break;
    case "linux": drives = await linux.listDrives(); break;
    case "win32": drives = await windows.listDrives(); break;
    default: throw new Error(`Writing drives is not supported on ${process.platform}.`);
  }
  return drives.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

/**
 * Checks that the drive is still the one the person chose: same path, size,
 * name and (where the system tells it) serial number. A drive unplugged and
 * another one plugged in can take the same path. flash() runs it before asking
 * for access and again once the drive is open, right before erasing it.
 */
export async function confirmSameDrive(chosen: Drive, options: ListOptions = {}): Promise<void> {
  const now = (await listDrives(options)).find(d => d.path === chosen.path);
  if (!now) throw new Error(`${chosen.name} is no longer connected.`);
  if (now.size !== chosen.size || now.name !== chosen.name || (chosen.serial ?? "") !== (now.serial ?? "")) {
    throw new Error(`The drive at ${chosen.path} changed since you chose it. Choose it again.`);
  }
}
