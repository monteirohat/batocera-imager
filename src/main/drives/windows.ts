// Drives on Windows, from PowerShell's storage cmdlets.
//
// Only disks on a USB or SD bus are listed, never the boot or system disk.

import type { Drive, MediaKind } from "../../shared/types";
import { run } from "../run";

export interface WinDisk {
  Number: number;
  FriendlyName?: string | null;
  Size?: number;
  /** A name ("USB") or the number behind it (7). */
  BusType?: string | number;
  IsBoot?: boolean;
  IsSystem?: boolean;
  IsReadOnly?: boolean;
  IsOffline?: boolean;
  SerialNumber?: string | null;
}

export interface WinPartition {
  DiskNumber: number;
  DriveLetter?: string | null;
}

/** STORAGE_BUS_TYPE numbers, for PowerShell versions that print them. */
const BUS_NAMES: Record<number, string> = { 7: "USB", 12: "SD", 13: "MMC" };

function bus(disk: WinDisk): string {
  const b = String(disk.BusType ?? "").trim();
  return (/^\d+$/.test(b) ? BUS_NAMES[Number(b)] ?? b : b).toUpperCase();
}

export function kindOf(disk: WinDisk): MediaKind {
  const b = bus(disk);
  if (b === "SD" || b === "MMC" || /\bSD\b|card|reader|MMC/i.test(disk.FriendlyName ?? "")) return "sd";
  return "usb";
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

export function drivesFromPowerShell(json: { disks?: WinDisk | WinDisk[]; parts?: WinPartition | WinPartition[] }): Drive[] {
  const parts = asArray(json.parts);
  const drives: Drive[] = [];
  for (const disk of asArray(json.disks)) {
    if (!Number.isInteger(disk.Number)) continue;
    if (!["USB", "SD", "MMC"].includes(bus(disk))) continue;
    if (disk.IsBoot || disk.IsSystem || disk.IsReadOnly) continue;
    const size = Number(disk.Size);
    if (!(size > 0)) continue;
    const path = `\\\\.\\PhysicalDrive${disk.Number}`;
    const mountpoints = parts
      .filter(p => p.DiskNumber === disk.Number && p.DriveLetter && /^[A-Z]$/i.test(String(p.DriveLetter)))
      .map(p => `${String(p.DriveLetter).toUpperCase()}:`);
    const serial = (disk.SerialNumber ?? "").trim();
    drives.push({
      id: path,
      path,
      name: (disk.FriendlyName ?? "").trim() || `Disk ${disk.Number}`,
      size,
      kind: kindOf(disk),
      mountpoints,
      ...(serial ? { serial } : {}),
    });
  }
  return drives;
}

const SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "$d = @(Get-Disk | Select-Object Number, FriendlyName, Size, @{n='BusType';e={[string]$_.BusType}}, IsBoot, IsSystem, IsReadOnly, IsOffline, @{n='SerialNumber';e={[string]$_.SerialNumber}})",
  "$p = @(Get-Partition -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter } | Select-Object DiskNumber, @{n='DriveLetter';e={[string]$_.DriveLetter}})",
  "[pscustomobject]@{ disks = $d; parts = $p } | ConvertTo-Json -Depth 4 -Compress",
].join("; ");

export function powershell(script: string, timeoutMs = 60_000): Promise<string> {
  return run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { timeoutMs });
}

export async function listDrives(): Promise<Drive[]> {
  const out = await powershell(SCRIPT);
  return drivesFromPowerShell(JSON.parse(out));
}
