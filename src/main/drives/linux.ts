// Drives on Linux, from lsblk.
//
// Only whole disks that are removable, hot-pluggable or on a USB or SD bus are
// listed, and never one that holds a mount of the running system: a drive is
// offered only if all its mounts are where the desktop mounts removable media
// (/media, /run/media, /mnt). That also leaves out the stick a live system runs
// from (/run/live/medium, /cdrom…). An SD slot's mmcblk device is offered only
// if the kernel says it holds an SD card, not built-in eMMC storage.

import { promises as fs } from "node:fs";

import type { Drive, MediaKind } from "../../shared/types";
import { run } from "../run";

export interface LsblkDevice {
  name?: string;
  path?: string;
  size?: number | string;
  type?: string;
  rm?: boolean | string | number;
  hotplug?: boolean | string | number;
  ro?: boolean | string | number;
  tran?: string | null;
  model?: string | null;
  vendor?: string | null;
  mountpoint?: string | null;
  mountpoints?: (string | null)[];
  serial?: string | null;
  children?: LsblkDevice[];
}

/** Where removable media are mounted; any other mount means the system uses the drive. */
const MEDIA_MOUNTS = /^\/(media|run\/media|mnt)(\/|$)/;

function flag(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

function mounts(dev: LsblkDevice): string[] {
  const own = [dev.mountpoint, ...(dev.mountpoints ?? [])].filter((m): m is string => !!m);
  return [...new Set([...own, ...(dev.children ?? []).flatMap(mounts)])];
}

export function kindOf(dev: LsblkDevice): MediaKind {
  const tran = (dev.tran ?? "").toLowerCase();
  const label = `${dev.vendor ?? ""} ${dev.model ?? ""}`;
  if (tran === "mmc" || /^mmcblk/.test(dev.name ?? "") || /\bSD\b|card|reader|MMC/i.test(label)) return "sd";
  return flag(dev.rm) ? "usb" : "disk";
}

/**
 * `mmcType` gives the kernel's type of an mmcblk device ("SD" or "MMC", from
 * /sys/block/<name>/device/type).
 */
export function drivesFromLsblk(json: { blockdevices?: LsblkDevice[] }, mmcType: (name: string) => string | undefined = () => undefined): Drive[] {
  const drives: Drive[] = [];
  for (const dev of json.blockdevices ?? []) {
    if (dev.type !== "disk" || flag(dev.ro)) continue;
    const path = dev.path ?? (dev.name ? `/dev/${dev.name}` : "");
    if (!/^\/dev\/(sd[a-z]+|mmcblk\d+|nvme\d+n\d+|vd[a-z]+)$/.test(path)) continue;
    const tran = (dev.tran ?? "").toLowerCase();
    const external = flag(dev.rm) || flag(dev.hotplug) || tran === "usb" || tran === "mmc";
    if (!external) continue;
    if (/^mmcblk/.test(dev.name ?? "") && mmcType(dev.name ?? "") !== "SD") continue;
    const mountpoints = mounts(dev);
    if (mountpoints.some(m => !MEDIA_MOUNTS.test(m))) continue;
    const size = Number(dev.size);
    if (!(size > 0)) continue;
    const name = [dev.vendor, dev.model].map(s => (s ?? "").trim()).filter(Boolean).join(" ") || path;
    const serial = (dev.serial ?? "").trim();
    drives.push({ id: path, path, name, size, kind: kindOf(dev), mountpoints, ...(serial ? { serial } : {}) });
  }
  return drives;
}

const COLUMNS = "NAME,PATH,SIZE,TYPE,RM,HOTPLUG,RO,TRAN,MODEL,VENDOR,SERIAL,MOUNTPOINT";

export async function listDrives(): Promise<Drive[]> {
  const json = JSON.parse(await run("lsblk", ["--json", "--bytes", "--output", COLUMNS])) as { blockdevices?: LsblkDevice[] };
  const types = new Map<string, string>();
  for (const dev of json.blockdevices ?? []) {
    const name = dev.name ?? "";
    if (!/^mmcblk\d+$/.test(name)) continue;
    const type = await fs.readFile(`/sys/block/${name}/device/type`, "utf8").catch(() => "");
    types.set(name, type.trim());
  }
  return drivesFromLsblk(json, name => types.get(name));
}
