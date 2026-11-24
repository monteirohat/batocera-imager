// Opening a drive on Windows.
//
// The installer runs as administrator (its manifest asks for it). Before
// writing, diskpart removes the drive's partitions so that Windows lets go of
// its volumes; then the whole disk is opened as \\.\PhysicalDriveN. Reads from
// a physical drive are not cached.

import { constants, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Drive } from "../../shared/types";
import { closeQuietly, openFd } from "../fd";
import { run } from "../run";
import type { DriveAccess } from "./types";

async function clean(diskNumber: number): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "batocera-imager-"));
  const script = path.join(dir, "clean.txt");
  await fs.writeFile(script, `select disk ${diskNumber}\r\nattributes disk clear readonly noerr\r\nonline disk noerr\r\nclean\r\nrescan\r\nexit\r\n`);
  try {
    let last: unknown;
    // Windows sometimes holds the disk for a moment after a volume is closed.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await run("diskpart.exe", ["/s", script], { timeoutMs: 120_000 });
        return;
      } catch (err) {
        last = err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    const detail = last instanceof Error ? last.message : String(last);
    throw new Error(`Windows did not let go of the drive (diskpart). Close any window showing it and try again. ${detail}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function openDrive(drive: Drive, signal: AbortSignal): Promise<DriveAccess> {
  const n = /^\\\\\.\\PhysicalDrive(\d+)$/.exec(drive.path)?.[1];
  if (n === undefined) throw new Error(`Unexpected drive path: ${drive.path}`);
  await clean(Number(n));
  if (signal.aborted) throw signal.reason;

  let fd: number;
  try {
    fd = await openFd(drive.path, constants.O_RDWR);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EACCES") {
      throw new Error("Windows refused to open the drive. Start the installer as administrator.");
    }
    throw err;
  }

  return {
    fd,
    async beforeVerify() {
      // Physical drives are read without a cache.
    },
    async close(_success) {
      await closeQuietly(fd);
      // Windows mounts the new partitions by itself; the person ejects from the taskbar.
      return false;
    },
  };
}
