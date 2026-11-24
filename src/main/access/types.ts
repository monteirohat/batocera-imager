// An open drive, ready to be written and read back.

export interface DriveAccess {
  /** File descriptor open for reading and writing the whole drive. */
  fd: number;
  /**
   * Called after the image is written and flushed, before reading it back:
   * makes sure the reads come from the drive, not from a cache.
   */
  beforeVerify(): Promise<void>;
  /**
   * Closes the drive and gives it back. `success` is true when the image was
   * written and verified: the drive is then ejected where the system allows it
   * (and on macOS it is ejected in any case once access was given). Never
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
