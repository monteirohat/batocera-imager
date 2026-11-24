// What an image needs before it is downloaded: its size, and the smallest size
// it can have once unpacked.
//
// A gzip file ends with the unpacked size modulo 4 GiB (ISIZE). Images are
// larger than their download, so the first candidate above the download size
// is a safe lower bound: a drive smaller than it is certainly too small.

import { promises as fs } from "node:fs";
import type { ImageInfo } from "../shared/types";
import { get, HttpError } from "./http";

const FOUR_GIB = 2 ** 32;

export function minUnpackedSize(compressedSize: number, isize: number): number {
  let size = isize;
  while (size < compressedSize) size += FOUR_GIB;
  return size;
}

/** Asks the server for the size and the last four bytes of the file. */
export async function probeImage(url: string, signal?: AbortSignal): Promise<ImageInfo> {
  const res = await get(url, { signal, headers: { Range: "bytes=-4" } });
  if (res.status !== 206) {
    await res.body?.cancel();
    throw new HttpError(res.status, url);
  }
  // Content-Range: bytes 2308840364-2308840367/2308840368
  const total = Number(/\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "")?.[1]);
  const tail = Buffer.from(await res.arrayBuffer());
  if (!Number.isFinite(total) || tail.length !== 4) {
    throw new Error("The image server did not say how large the image is.");
  }
  return { compressedSize: total, minSize: minUnpackedSize(total, tail.readUInt32LE(0)) };
}

/** The same, from a downloaded file. */
export async function probeFile(path: string): Promise<ImageInfo> {
  const handle = await fs.open(path, "r");
  try {
    const { size } = await handle.stat();
    const tail = Buffer.alloc(4);
    await handle.read(tail, 0, 4, size - 4);
    return { compressedSize: size, minSize: minUnpackedSize(size, tail.readUInt32LE(0)) };
  } finally {
    await handle.close();
  }
}
