// An open drive, ready to be written and read back.

import { verifyDrive, writeImage } from "../writer";
import { closeQuietly } from "../fd";

export interface WriteJob {
  /** The downloaded .img.gz. */
  image: string;
  driveSize: number;
  signal: AbortSignal;
  /** The drive is open and about to be written: from here on it is changed. */
  onStart(): void;
  /** Bytes of the .img.gz read so far, and bytes written to the drive so far. */
  onWrite(compressed: number, written: number): void;
  /** Bytes read back so far, of `total` written. */
  onVerify(done: number, total: number): void;
}

export interface DriveAccess {
  /** Writes the image, reads it back and compares; resolves with the bytes written. */
  writeAndVerify(job: WriteJob): Promise<number>;
  /**
   * Gives the drive back. `success` is true when the image was written and
   * verified: the drive is then ejected where the system allows it. Never
   * throws; true if the drive was ejected.
   */
  close(success: boolean): Promise<boolean>;
}

/** Thrown when the person dismisses the password prompt. */
export class AccessRefused extends Error {
  constructor() {
    super("Permission to write to the drive was not given.");
  }
}

/**
 * Access through a descriptor this process opened (Linux, Windows).
 * `beforeVerify` makes the reads after writing come from the drive, not from a cache.
 */
export function descriptorAccess(fd: number, beforeVerify: () => Promise<void>, release: (success: boolean) => Promise<boolean>): DriveAccess {
  return {
    async writeAndVerify(job) {
      job.onStart();
      const result = await writeImage(job.image, fd, { driveSize: job.driveSize, signal: job.signal, onProgress: (c, w) => job.onWrite(c, w) });
      job.onVerify(0, result.bytes);
      await beforeVerify();
      await verifyDrive(fd, result.bytes, result.sha256, job.signal, done => job.onVerify(done, result.bytes));
      return result.bytes;
    },
    async close(success) {
      await closeQuietly(fd);
      return release(success);
    },
  };
}
