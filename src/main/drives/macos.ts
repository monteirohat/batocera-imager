// Drives on macOS, from diskutil.
//
// Only whole physical disks that are external or removable are listed; the
// Mac's own disk, disk images and APFS containers never are. Nor is the disk
// the Mac started from, even when it is an external one: its APFS volumes
// live on a synthesized disk, so the physical disk behind them is looked up.

import type { Drive, MediaKind } from "../../shared/types";
import { run } from "../run";
import { parsePlist, type PlistValue } from "./plist";

type Dict = Record<string, PlistValue>;

const DISKUTIL = "/usr/sbin/diskutil";

export function kindOf(info: Dict): MediaKind {
  const bus = String(info.BusProtocol ?? "");
  const name = `${info.MediaName ?? ""} ${info.IORegistryEntryName ?? ""}`;
  if (/secure digital|sdxc|sdhc/i.test(bus) || /\bSD\b|card|reader|MMC/i.test(name)) return "sd";
  return info.RemovableMedia === true ? "usb" : "disk";
}

/** Whether diskutil's description is a drive we may offer. */
export function isCandidate(info: Dict): boolean {
  if (info.WholeDisk !== true) return false;
  if (info.OSInternalMedia === true) return false;
  if (info.WritableMedia === false) return false;
  if (info.VirtualOrPhysical === "Virtual") return false;
  if (!(Number(info.Size) > 0)) return false;
  // Built-in SD card slots report Internal but removable media.
  return info.Internal === false || info.RemovableMedia === true;
}

export function mountpointsFromList(list: Dict, id: string): string[] {
  const all = (list.AllDisksAndPartitions as Dict[] | undefined) ?? [];
  const disk = all.find(d => d.DeviceIdentifier === id);
  if (!disk) return [];
  const parts = [disk, ...(((disk.Partitions as Dict[] | undefined) ?? []))];
  return parts.map(p => p.MountPoint).filter((m): m is string => typeof m === "string" && m !== "");
}

export function driveFromInfo(info: Dict, mountpoints: string[]): Drive {
  const id = String(info.DeviceIdentifier);
  const name = String(info.MediaName || info.IORegistryEntryName || id).replace(/\s+Media$/, "").trim();
  return {
    id: `/dev/${id}`,
    path: `/dev/${id}`,
    name,
    size: Number(info.Size ?? info.TotalSize ?? 0),
    kind: kindOf(info),
    mountpoints,
  };
}

async function info(id: string): Promise<Dict> {
  return parsePlist(await run(DISKUTIL, ["info", "-plist", id])) as Dict;
}

/** The whole physical disks behind the running system's volumes. */
export async function systemDisks(): Promise<Set<string>> {
  const disks = new Set<string>();
  for (const volume of ["/", "/System/Volumes/Data"]) {
    const v = await info(volume).catch(() => null);
    if (!v) continue;
    if (typeof v.ParentWholeDisk === "string") disks.add(v.ParentWholeDisk);
    const stores = (v.APFSPhysicalStores as Dict[] | undefined) ?? [];
    for (const s of stores) {
      const store = s.APFSPhysicalStore;
      if (typeof store !== "string") continue;
      const p = await info(store).catch(() => null);
      disks.add(typeof p?.ParentWholeDisk === "string" ? p.ParentWholeDisk : store.replace(/s\d+$/, ""));
    }
  }
  if (disks.size === 0) throw new Error("Could not tell which disk this Mac runs from, so no drive is offered.");
  return disks;
}

export async function listDrives(testDrive?: string): Promise<Drive[]> {
  const list = parsePlist(await run(DISKUTIL, ["list", "-plist", "physical"])) as Dict;
  const ids = ((list.WholeDisks as string[] | undefined) ?? []).filter(id => /^disk\d+$/.test(id));
  const system = await systemDisks();
  const drives: Drive[] = [];
  for (const id of ids) {
    if (system.has(id)) continue;
    const d = await info(id).catch(() => null);
    if (d && isCandidate(d)) drives.push(driveFromInfo(d, mountpointsFromList(list, id)));
  }

  // Development only: a disk image to write to, named in IMAGER_TEST_DRIVE.
  const test = testDrive && /^\/dev\/disk\d+$/.exec(testDrive)?.[0];
  if (test && !drives.some(d => d.path === test)) {
    const d = await info(test.slice(5)).catch(() => null);
    if (d && d.VirtualOrPhysical === "Virtual" && d.WholeDisk === true) {
      drives.push({ ...driveFromInfo(d, []), name: `Test drive (${test})`, kind: "usb" });
    }
  }
  return drives;
}
