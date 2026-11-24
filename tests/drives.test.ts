// Which drives each system's description turns into, and above all which it
// never offers: the computer's own disks.

import { describe, expect, it } from "vitest";
import { drivesFromLsblk } from "../src/main/drives/linux";
import { driveFromInfo, isCandidate, kindOf, mountpointsFromList } from "../src/main/drives/macos";
import { parsePlist } from "../src/main/drives/plist";
import { drivesFromPowerShell } from "../src/main/drives/windows";

function plistDict(entries: Record<string, string>): string {
  const body = Object.entries(entries).map(([k, v]) => `<key>${k}</key>${v}`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>${body}</dict></plist>`;
}

describe("plist", () => {
  it("reads dicts, arrays and scalars", () => {
    const v = parsePlist(plistDict({
      Name: "<string>SanDisk &amp; Co</string>",
      Size: "<integer>31914983424</integer>",
      Internal: "<false/>",
      Removable: "<true/>",
      Empty: "<string/>",
      List: "<array><string>a</string><dict><key>b</key><real>1.5</real></dict></array>",
      None: "<array/>",
      Blob: "<data>\n  AAEC\n</data>",
    }));
    expect(v).toEqual({
      Name: "SanDisk & Co", Size: 31914983424, Internal: false, Removable: true, Empty: "",
      List: ["a", { b: 1.5 }], None: [], Blob: "AAEC",
    });
  });
});

describe("macOS drives", () => {
  const usb = {
    DeviceIdentifier: "disk4", MediaName: "SanDisk Ultra Media", Size: 31914983424, Internal: false, RemovableMedia: true,
    WholeDisk: true, WritableMedia: true, VirtualOrPhysical: "Physical", OSInternalMedia: false, BusProtocol: "USB",
  };

  it("offers external and removable disks", () => {
    expect(isCandidate(usb)).toBe(true);
    expect(driveFromInfo(usb, ["/Volumes/SANDISK"])).toEqual({
      id: "/dev/disk4", path: "/dev/disk4", name: "SanDisk Ultra", size: 31914983424, kind: "usb", mountpoints: ["/Volumes/SANDISK"],
    });
  });

  it("offers the built-in SD card slot, which reports Internal", () => {
    const sd = { ...usb, DeviceIdentifier: "disk5", Internal: true, BusProtocol: "Secure Digital", MediaName: "SDXC Reader" };
    expect(isCandidate(sd)).toBe(true);
    expect(kindOf(sd)).toBe("sd");
  });

  it("never offers the Mac's own disk, disk images, partitions or read-only media", () => {
    expect(isCandidate({ ...usb, Internal: true, RemovableMedia: false })).toBe(false);
    expect(isCandidate({ ...usb, OSInternalMedia: true })).toBe(false);
    expect(isCandidate({ ...usb, VirtualOrPhysical: "Virtual" })).toBe(false);
    expect(isCandidate({ ...usb, WholeDisk: false })).toBe(false);
    expect(isCandidate({ ...usb, WritableMedia: false })).toBe(false);
  });

  it("tells external disks from keys, and does not take an SSD for an SD card", () => {
    expect(kindOf({ ...usb, RemovableMedia: false, MediaName: "Samsung PSSD T7" })).toBe("disk");
    expect(kindOf({ ...usb, MediaName: "Samsung SSD T7" })).toBe("usb");
    expect(kindOf({ ...usb, MediaName: "Generic SD Card Reader" })).toBe("sd");
  });

  it("collects mount points from diskutil list", () => {
    const list = {
      AllDisksAndPartitions: [
        { DeviceIdentifier: "disk4", Partitions: [{ DeviceIdentifier: "disk4s1", MountPoint: "/Volumes/A" }, { DeviceIdentifier: "disk4s2" }] },
      ],
    };
    expect(mountpointsFromList(list, "disk4")).toEqual(["/Volumes/A"]);
    expect(mountpointsFromList(list, "disk9")).toEqual([]);
  });
});

describe("Linux drives", () => {
  const json = {
    blockdevices: [
      { name: "nvme0n1", path: "/dev/nvme0n1", size: 512110190592, type: "disk", rm: false, hotplug: false, ro: false, tran: "nvme", model: "Samsung 980", vendor: null, mountpoint: null,
        children: [{ name: "nvme0n1p2", path: "/dev/nvme0n1p2", type: "part", mountpoint: "/" }] },
      { name: "sda", path: "/dev/sda", size: "31914983424", type: "disk", rm: "1", hotplug: "1", ro: "0", tran: "usb", model: "Ultra", vendor: "SanDisk ", mountpoint: null,
        children: [{ name: "sda1", path: "/dev/sda1", type: "part", mountpoint: "/media/me/SANDISK" }] },
      { name: "mmcblk0", path: "/dev/mmcblk0", size: 63864569856, type: "disk", rm: false, hotplug: false, ro: false, tran: "mmc", model: null, vendor: null, mountpoint: null },
      { name: "mmcblk1", path: "/dev/mmcblk1", size: 128043712512, type: "disk", rm: false, hotplug: false, ro: false, tran: "mmc", model: "eMMC", vendor: null, mountpoint: null },
      { name: "sde", path: "/dev/sde", size: 31914983424, type: "disk", rm: true, hotplug: true, ro: false, tran: "usb", model: "Live stick", vendor: null, mountpoint: null,
        children: [{ name: "sde1", path: "/dev/sde1", type: "part", mountpoint: "/run/live/medium" }] },
      { name: "sdf", path: "/dev/sdf", size: 31914983424, type: "disk", rm: true, hotplug: true, ro: false, tran: "usb", model: "Data", vendor: null, mountpoint: null,
        children: [{ name: "sdf1", path: "/dev/sdf1", type: "part", mountpoint: "/srv/data" }] },
      { name: "sdg", path: "/dev/sdg", size: 31914983424, type: "disk", rm: true, hotplug: true, ro: false, tran: "usb", model: "Fedora key", vendor: null, serial: " 4C530001 ", mountpoint: null,
        children: [{ name: "sdg1", path: "/dev/sdg1", type: "part", mountpoint: "/run/media/me/KEY" }] },
      { name: "sdb", path: "/dev/sdb", size: 1000204886016, type: "disk", rm: false, hotplug: true, ro: false, tran: "usb", model: "Portable SSD", vendor: "Samsung", mountpoint: null,
        children: [{ name: "sdb1", path: "/dev/sdb1", type: "part", mountpoints: ["/boot/efi"] }] },
      { name: "sdc", path: "/dev/sdc", size: 1000204886016, type: "disk", rm: false, hotplug: true, ro: false, tran: "usb", model: "Expansion", vendor: "Seagate", mountpoint: null },
      { name: "loop0", path: "/dev/loop0", size: 1000, type: "loop", rm: false, hotplug: false, ro: true, tran: null },
      { name: "sr0", path: "/dev/sr0", size: 1000, type: "rom", rm: true, hotplug: true, ro: false, tran: "usb" },
      { name: "sdd", path: "/dev/sdd", size: 1000, type: "disk", rm: true, hotplug: true, ro: true, tran: "usb", model: "Locked" },
    ],
  };
  const drives = drivesFromLsblk(json, name => ({ mmcblk0: "SD", mmcblk1: "MMC" })[name]);

  it("offers USB keys, SD cards and external disks", () => {
    expect(drives.map(d => [d.path, d.kind])).toEqual([["/dev/sda", "usb"], ["/dev/mmcblk0", "sd"], ["/dev/sdg", "usb"], ["/dev/sdc", "disk"]]);
    expect(drives[0]).toMatchObject({ name: "SanDisk Ultra", size: 31914983424, mountpoints: ["/media/me/SANDISK"] });
    expect(drives[2]).toMatchObject({ serial: "4C530001", mountpoints: ["/run/media/me/KEY"] });
  });

  it("never offers built-in eMMC, nor an SD slot the kernel can't vouch for", () => {
    expect(drives.map(d => d.path)).not.toContain("/dev/mmcblk1");
    expect(drivesFromLsblk(json).map(d => d.path)).not.toContain("/dev/mmcblk0");
  });

  it("never offers a drive mounted outside the removable-media folders (a live system's stick, a data disk)", () => {
    const paths = drives.map(d => d.path);
    expect(paths).not.toContain("/dev/sde");
    expect(paths).not.toContain("/dev/sdf");
  });

  it("never offers a disk that holds the system, loops, optical or read-only drives", () => {
    const paths = drives.map(d => d.path);
    expect(paths).not.toContain("/dev/nvme0n1");
    expect(paths).not.toContain("/dev/sdb");
    expect(paths).not.toContain("/dev/loop0");
    expect(paths).not.toContain("/dev/sr0");
    expect(paths).not.toContain("/dev/sdd");
  });
});

describe("Windows drives", () => {
  it("offers USB and SD disks, never the boot or system disk", () => {
    const drives = drivesFromPowerShell({
      disks: [
        { Number: 0, FriendlyName: "NVMe Samsung", Size: 512110190592, BusType: "NVMe", IsBoot: true, IsSystem: true },
        { Number: 1, FriendlyName: "SanDisk Ultra USB Device", Size: 31914983424, BusType: "USB", IsBoot: false, IsSystem: false, SerialNumber: "  AA0102  " },
        { Number: 2, FriendlyName: "SD Card", Size: 63864569856, BusType: 12 },
        { Number: 3, FriendlyName: "Boot from USB", Size: 63864569856, BusType: "USB", IsBoot: true },
        { Number: 4, FriendlyName: "Locked", Size: 1000, BusType: "USB", IsReadOnly: true },
      ],
      parts: [{ DiskNumber: 1, DriveLetter: "e" }, { DiskNumber: 1, DriveLetter: "" }, { DiskNumber: 0, DriveLetter: "C" }],
    });
    expect(drives).toEqual([
      { id: "\\\\.\\PhysicalDrive1", path: "\\\\.\\PhysicalDrive1", name: "SanDisk Ultra USB Device", size: 31914983424, kind: "usb", mountpoints: ["E:"], serial: "AA0102" },
      { id: "\\\\.\\PhysicalDrive2", path: "\\\\.\\PhysicalDrive2", name: "SD Card", size: 63864569856, kind: "sd", mountpoints: [] },
    ]);
  });

  it("reads PowerShell's single objects as lists", () => {
    const drives = drivesFromPowerShell({ disks: { Number: 1, FriendlyName: "Key", Size: 8e9, BusType: "USB" }, parts: { DiskNumber: 1, DriveLetter: "F" } });
    expect(drives.map(d => d.mountpoints)).toEqual([["F:"]]);
  });
});
