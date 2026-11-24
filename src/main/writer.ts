// Writes an .img.gz to an open drive and reads it back.
//
// The image is unpacked on the fly and written in 4 MiB blocks; while one
// block is being written the next is filled. A SHA-256 of what was written is
// compared with one of what the drive gives back, so a damaged or fake drive
// (one that is smaller than it claims) is caught before the person boots it.
//
// The order protects the drive's partition table:
// - first, the start and the end of the drive are cleared, so the system
//   finds no old partitions to mount while the drive is written, and no old
//   backup GPT survives at the end;
// - the first block of the image (with the new partition table) is written
//   last, so a drive that was interrupted has no partitions at all rather than
//   half an image that looks valid.
//
// Writes are always whole 4 KiB units (drives with 4K sectors refuse less):
// the last block is padded with zeros, past the end of the image.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { Transform } from "node:stream";
import { createGunzip } from "node:zlib";
import { fsyncFd, readFd, writeFd } from "./fd";

export const BLOCK = 4 * 1024 * 1024;
const ALIGN = 4096;
/** Cleared at both ends of the drive before writing. */
const CLEAR = 1024 * 1024;

export interface WriteResult {
  bytes: number;
  sha256: string;
}

export class VerifyError extends Error {
  constructor(public offset: number | null) {
    super("The drive did not give back what was written. It may be damaged, or smaller than it claims. Try another drive.");
  }
}

function roundUp(n: number, to: number): number {
  return Math.ceil(n / to) * to;
}

/** Turns errors of the drive into sentences. */
export function driveError(err: unknown): Error {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "ENOSPC" || code === "EFBIG") {
    return new Error("The drive ended before the image did: it is too small, or it is not what it claims to be.");
  }
  if (code === "EIO" || code === "ENXIO" || code === "ENODEV" || code === "ENOENT") {
    return new Error("The drive stopped answering. Was it removed? If not, it may be damaged.");
  }
  if (code === "EPERM" || code === "EACCES") {
    return new Error("The system refused to let the installer write to the drive.");
  }
  return err instanceof Error ? err : new Error(String(err));
}

/** Writes `length` bytes of `buffer` at `at`, looping over short writes. */
async function writeAll(fd: number, buffer: Buffer, length: number, at: number): Promise<void> {
  let done = 0;
  while (done < length) {
    const n = await writeFd(fd, buffer.subarray(done), length - done, at + done);
    if (n <= 0) throw Object.assign(new Error("short write"), { code: "ENOSPC" });
    done += n;
  }
}

export interface WriteOptions {
  /** Size of the drive: its last MiB is cleared. 0 skips that. */
  driveSize: number;
  signal: AbortSignal;
  onProgress: (compressedDone: number, written: number) => void;
}

export async function writeImage(file: string, fd: number, options: WriteOptions): Promise<WriteResult> {
  const { driveSize, signal, onProgress } = options;
  const hash = createHash("sha256");
  const buffers = [Buffer.allocUnsafe(BLOCK), Buffer.allocUnsafe(BLOCK)];
  const head = Buffer.alloc(BLOCK);
  let headLength = -1; // the first block, kept until the end
  let current = 0;
  let filled = 0;
  let position = 0;
  let compressed = 0;
  let pending: Promise<void> = Promise.resolve();

  // Clear both ends of the drive.
  const zeros = Buffer.alloc(CLEAR);
  try {
    await writeAll(fd, zeros, CLEAR, 0);
    const end = Math.floor((driveSize - CLEAR) / ALIGN) * ALIGN;
    if (driveSize > 4 * CLEAR && end > CLEAR) await writeAll(fd, zeros, CLEAR, end);
  } catch (err) {
    throw driveError(err);
  }

  const flushBlock = async (length: number) => {
    const buffer = buffers[current];
    hash.update(buffer.subarray(0, length));
    if (headLength < 0) {
      // Kept, written last.
      buffer.copy(head, 0, 0, length);
      headLength = length;
      position += length;
      filled = 0;
      return;
    }
    const writeLength = roundUp(length, ALIGN);
    if (writeLength > length) buffer.fill(0, length, writeLength);
    // Wait for the previous block before starting this one.
    await pending;
    const at = position;
    position += length;
    pending = writeAll(fd, buffer, writeLength, at);
    // A failed write is reported by the next await of `pending`; avoid an unhandled rejection meanwhile.
    pending.catch(() => undefined);
    current = 1 - current;
    filled = 0;
  };

  const source = createReadStream(file, { highWaterMark: 1024 * 1024 });
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      compressed += chunk.length;
      cb(null, chunk);
    },
  });
  const gunzip = createGunzip({ chunkSize: 1024 * 1024 });
  source.on("error", err => gunzip.destroy(err));
  source.pipe(counter).pipe(gunzip);

  const onAbort = () => gunzip.destroy(signal.reason instanceof Error ? signal.reason : new Error("Cancelled"));
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    for await (const chunk of gunzip as AsyncIterable<Buffer>) {
      let offset = 0;
      while (offset < chunk.length) {
        const n = Math.min(chunk.length - offset, BLOCK - filled);
        chunk.copy(buffers[current], filled, offset, offset + n);
        filled += n;
        offset += n;
        if (filled === BLOCK) {
          await flushBlock(BLOCK).catch(err => { throw driveError(err); });
          onProgress(compressed, position);
        }
      }
    }
    if (signal.aborted) throw signal.reason;
    if (filled > 0) await flushBlock(filled).catch(err => { throw driveError(err); });
    await pending.catch(err => { throw driveError(err); });
    if (headLength > 0) {
      // Everything else is on the drive: now the partition table.
      const headWrite = roundUp(headLength, ALIGN);
      if (headWrite > headLength) head.fill(0, headLength, headWrite);
      await writeAll(fd, head, headWrite, 0).catch(err => { throw driveError(err); });
    }
    await fsyncFd(fd).catch(err => { throw driveError(err); });
    onProgress(compressed, position);
  } catch (err) {
    if (signal.aborted) throw signal.reason;
    if ((err as NodeJS.ErrnoException)?.code === "Z_DATA_ERROR" || (err as NodeJS.ErrnoException)?.code === "Z_BUF_ERROR") {
      throw new Error("The downloaded image can't be unpacked: it is damaged. Delete the downloaded images (About) and try again.");
    }
    throw err;
  } finally {
    signal.removeEventListener("abort", onAbort);
    source.destroy();
    // Never leave a block being written behind.
    await pending.catch(() => undefined);
  }
  return { bytes: position, sha256: hash.digest("hex") };
}

export async function verifyDrive(
  fd: number,
  bytes: number,
  expected: string,
  signal: AbortSignal,
  onProgress: (done: number) => void,
): Promise<void> {
  const hash = createHash("sha256");
  const buffers = [Buffer.allocUnsafe(BLOCK), Buffer.allocUnsafe(BLOCK)];

  const readBlock = async (buffer: Buffer, at: number): Promise<number> => {
    const want = Math.min(BLOCK, roundUp(bytes - at, ALIGN));
    let got = 0;
    while (got < want) {
      const n = await readFd(fd, buffer.subarray(got), want - got, at + got).catch(err => { throw driveError(err); });
      if (n === 0) break;
      got += n;
    }
    return got;
  };

  let at = 0;
  let index = 0;
  let next = bytes > 0 ? readBlock(buffers[0], 0) : Promise.resolve(0);
  next.catch(() => undefined);
  try {
    while (at < bytes) {
      if (signal.aborted) throw signal.reason;
      const got = await next;
      const useful = Math.min(got, bytes - at);
      if (useful <= 0) throw new VerifyError(at);
      const buffer = buffers[index];
      const following = at + useful;
      // Read the next block while this one is hashed.
      index = 1 - index;
      next = following < bytes ? readBlock(buffers[index], following) : Promise.resolve(0);
      next.catch(() => undefined);
      hash.update(buffer.subarray(0, useful));
      at = following;
      onProgress(at);
    }
  } finally {
    // Never leave a read behind: the caller closes the drive next.
    await next.catch(() => undefined);
  }
  if (hash.digest("hex") !== expected) throw new VerifyError(null);
}
