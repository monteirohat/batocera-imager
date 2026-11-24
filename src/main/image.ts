// How large an image is once unpacked, known before it is downloaded.
//
// A gzip file ends with the unpacked size modulo 4 GiB (ISIZE): a Batocera
// image of 9.13 GB and one of 4.83 GB end with the same four bytes. The image's
// own partition table, at its very start, tells where its last partition ends;
// the right size is the ISIZE candidate that reaches that far. So the first
// 64 KiB and the last 4 bytes of the .img.gz give the exact size, with two
// small range requests. If the partition table can't be read, the smallest
// candidate larger than the download is kept as a lower bound.

import { promises as fs } from "node:fs";
import { constants as zlibConstants, gunzipSync } from "node:zlib";
import type { ImageInfo } from "../shared/types";
import { get, HttpError } from "./http";

const FOUR_GIB = 2 ** 32;
const SECTOR = 512;
/** Enough of the .img.gz to unpack the partition tables. */
export const HEAD_BYTES = 64 * 1024;

export function minUnpackedSize(compressedSize: number, isize: number): number {
  let size = isize;
  while (size < compressedSize) size += FOUR_GIB;
  return size;
}

/**
 * Where the image's partitions end, from its first sectors: the end of the
 * last MBR partition, or for GPT the disk size its header was made for. Null
 * when there is no partition table this understands.
 */
export function partitionsEnd(head: Buffer): number | null {
  if (head.length < 2 * SECTOR || head.readUInt16LE(510) !== 0xaa55) return null;
  let end = 0;
  let gpt = false;
  for (let i = 0; i < 4; i++) {
    const entry = 446 + 16 * i;
    const type = head[entry + 4];
    if (type === 0) continue;
    if (type === 0xee) gpt = true;
    end = Math.max(end, (head.readUInt32LE(entry + 8) + head.readUInt32LE(entry + 12)) * SECTOR);
  }
  if (gpt && head.toString("latin1", SECTOR, SECTOR + 8) === "EFI PART") {
    // The backup header sits on the last sector of the disk the image was made for.
    const backup = Number(head.readBigUInt64LE(SECTOR + 32));
    if (backup > 0) return (backup + 1) * SECTOR;
  }
  return end > 0 ? end : null;
}

/** The unpacked size, from the size of the .img.gz, its ISIZE and its first bytes. */
export function unpackedSize(compressedSize: number, isize: number, compressedHead: Buffer | null): ImageInfo {
  const min = minUnpackedSize(compressedSize, isize);
  let head: Buffer | null = null;
  if (compressedHead) {
    try {
      // A cut stream: unpack what is there.
      head = gunzipSync(compressedHead, { finishFlush: zlibConstants.Z_SYNC_FLUSH });
    } catch {
      head = null;
    }
  }
  const end = head ? partitionsEnd(head) : null;
  if (end === null) return { compressedSize, size: min, exact: false };
  let size = min;
  while (size < end) size += FOUR_GIB;
  return { compressedSize, size, exact: true };
}

async function range(url: string, spec: string, signal?: AbortSignal): Promise<{ body: Buffer; total: number }> {
  const res = await get(url, { signal, headers: { Range: `bytes=${spec}` } });
  if (res.status !== 206) {
    await res.body?.cancel();
    throw new HttpError(res.status, url);
  }
  // Content-Range: bytes 2308840364-2308840367/2308840368
  const total = Number(/\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "")?.[1]);
  const body = Buffer.from(await res.arrayBuffer());
  if (!Number.isFinite(total)) throw new Error("The image server did not say how large the image is.");
  return { body, total };
}

/** Asks the server for the start and the last four bytes of the image. */
export async function probeImage(url: string, signal?: AbortSignal): Promise<ImageInfo> {
  const [tail, head] = await Promise.all([
    range(url, "-4", signal),
    range(url, `0-${HEAD_BYTES - 1}`, signal).catch(() => null),
  ]);
  if (tail.body.length !== 4) throw new Error("The image server did not say how large the image is.");
  return unpackedSize(tail.total, tail.body.readUInt32LE(0), head?.body ?? null);
}

/** The same, from a downloaded file. */
export async function probeFile(path: string): Promise<ImageInfo> {
  const handle = await fs.open(path, "r");
  try {
    const { size } = await handle.stat();
    const tail = Buffer.alloc(4);
    await handle.read(tail, 0, 4, size - 4);
    const head = Buffer.alloc(Math.min(HEAD_BYTES, size));
    await handle.read(head, 0, head.length, 0);
    return unpackedSize(size, tail.readUInt32LE(0), head);
  } finally {
    await handle.close();
  }
}
