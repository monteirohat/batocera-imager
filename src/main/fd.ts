// Promise versions of the fs calls on a raw file descriptor. FileHandle is not
// used for drives: it closes its descriptor when garbage collected.

import fs from "node:fs";
import { promisify } from "node:util";

export const openFd = promisify(fs.open) as (path: string, flags: number | string) => Promise<number>;
export const closeFd = promisify(fs.close);
export const fsyncFd = promisify(fs.fsync);

export function writeFd(fd: number, buffer: Buffer, length: number, position: number): Promise<number> {
  return new Promise((resolve, reject) => {
    fs.write(fd, buffer, 0, length, position, (err, written) => (err ? reject(err) : resolve(written)));
  });
}

export function readFd(fd: number, buffer: Buffer, length: number, position: number): Promise<number> {
  return new Promise((resolve, reject) => {
    fs.read(fd, buffer, 0, length, position, (err, read) => (err ? reject(err) : resolve(read)));
  });
}

/** Closes and ignores errors: used on the way out. */
export async function closeQuietly(fd: number): Promise<void> {
  await closeFd(fd).catch(() => undefined);
}
