// Opening a drive on macOS.
//
// The raw device (/dev/rdiskN) belongs to root. The installer asks for the
// administrator password once, through the system's own prompt, and gives the
// drive's device files to the person; that lasts until the drive is ejected.
// Everything else (unmounting, writing, reading back, ejecting) runs without
// privileges. The raw device has no cache, so reads after writing come from
// the drive itself.

import { spawn } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import type { Drive } from "../../shared/types";
import { closeQuietly, openFd } from "../fd";
import { run } from "../run";
import { AccessRefused, type DriveAccess } from "./types";

const DISKUTIL = "/usr/sbin/diskutil";

function appleScriptString(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function writable(path: string): Promise<boolean> {
  return fs.access(path, constants.R_OK | constants.W_OK).then(() => true, () => false);
}

function giveToUser(disk: string, rdisk: string, driveName: string, signal: AbortSignal): Promise<void> {
  const owner = `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`;
  const command = `/usr/sbin/chown ${owner} ${disk} ${rdisk}`;
  const prompt = `Batocera Imager needs an administrator password to write to ${driveName}.`;
  const script = `do shell script ${appleScriptString(command)} with prompt ${appleScriptString(prompt)} with administrator privileges`;
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/osascript", ["-e", script], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    const onAbort = () => child.kill();
    signal.addEventListener("abort", onAbort, { once: true });
    child.on("error", err => { signal.removeEventListener("abort", onAbort); reject(err); });
    child.on("close", code => {
      signal.removeEventListener("abort", onAbort);
      if (signal.aborted) reject(signal.reason);
      else if (code === 0) resolve();
      else if (/-128/.test(stderr)) reject(new AccessRefused());
      else reject(new Error(`Could not get access to the drive: ${stderr.trim() || `osascript exited with ${code}`}`));
    });
  });
}

async function unmount(disk: string): Promise<void> {
  await run(DISKUTIL, ["unmountDisk", "force", disk], { timeoutMs: 60_000 });
}

export async function openDrive(drive: Drive, signal: AbortSignal): Promise<DriveAccess> {
  const id = /^\/dev\/(disk\d+)$/.exec(drive.path)?.[1];
  if (!id) throw new Error(`Unexpected drive path: ${drive.path}`);
  const disk = `/dev/${id}`;
  const rdisk = `/dev/r${id}`;

  // Once the device files are the person's, they stay so until the drive is
  // ejected: so any way out after this point ejects it.
  let granted = false;
  if (!(await writable(rdisk))) {
    await giveToUser(disk, rdisk, drive.name, signal);
    granted = true;
  }
  const eject = () => run(DISKUTIL, ["eject", disk], { timeoutMs: 60_000 }).then(() => true, () => false);

  let fd: number;
  try {
    if (signal.aborted) throw signal.reason;
    await unmount(disk);
    try {
      fd = await openFd(rdisk, constants.O_RDWR);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EBUSY") throw err;
      // A volume was mounted again in the meantime.
      await unmount(disk);
      fd = await openFd(rdisk, constants.O_RDWR);
    }
  } catch (err) {
    if (granted) await eject();
    throw err;
  }

  return {
    fd,
    async beforeVerify() {
      // The raw device is not cached.
    },
    async close(success) {
      await closeQuietly(fd);
      return success || granted ? eject() : false;
    },
  };
}
