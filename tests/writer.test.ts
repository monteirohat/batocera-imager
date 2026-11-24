// Writing and reading back, with a regular file standing for the drive.

import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeFd, openFd } from "../src/main/fd";
import { minUnpackedSize, probeFile } from "../src/main/image";
import { BLOCK, VerifyError, verifyDrive, writeImage, type WriteOptions } from "../src/main/writer";

let dir: string;

beforeAll(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), "imager-test-")); });
afterAll(async () => { await fs.rm(dir, { recursive: true, force: true }); });

async function image(name: string, size: number): Promise<{ file: string; data: Buffer }> {
  // Half random, half zeros: like a disk image, it compresses a little.
  const data = Buffer.concat([randomBytes(Math.floor(size / 2)), Buffer.alloc(size - Math.floor(size / 2))]);
  const file = path.join(dir, `${name}.img.gz`);
  await fs.writeFile(file, gzipSync(data));
  return { file, data };
}

function opts(o: Partial<WriteOptions> = {}): WriteOptions {
  return { driveSize: 0, signal: new AbortController().signal, onProgress: () => undefined, ...o };
}

async function drive(name: string): Promise<number> {
  return openFd(path.join(dir, name), "w+");
}

describe("writeImage and verifyDrive", () => {
  it("writes an image of several blocks and reads it back", async () => {
    const { file, data } = await image("a", 2 * BLOCK + 3 * 512);
    const fd = await drive("a.drive");
    let lastCompressed = 0;
    const result = await writeImage(file, fd, opts({ onProgress: c => { lastCompressed = c; } }));
    expect(result.bytes).toBe(data.length);
    expect(lastCompressed).toBe((await fs.stat(file)).size);
    await verifyDrive(fd, result.bytes, result.sha256, new AbortController().signal, () => undefined);
    await closeFd(fd);
    const written = await fs.readFile(path.join(dir, "a.drive"));
    expect(written.subarray(0, data.length).equals(data)).toBe(true);
    expect(written.length % 4096).toBe(0);
  });

  it("pads the last block to whole 4 KiB units", async () => {
    const { file, data } = await image("b", BLOCK + 1000);
    const fd = await drive("b.drive");
    const result = await writeImage(file, fd, opts());
    await verifyDrive(fd, result.bytes, result.sha256, new AbortController().signal, () => undefined);
    await closeFd(fd);
    const written = await fs.readFile(path.join(dir, "b.drive"));
    expect(written.length).toBe(BLOCK + 4096);
    expect(written.subarray(0, data.length).equals(data)).toBe(true);
    expect(written.subarray(data.length).every(b => b === 0)).toBe(true);
  });

  it("notices a drive that does not give back what was written", async () => {
    const { file } = await image("c", BLOCK + 512);
    const fd = await drive("c.drive");
    const result = await writeImage(file, fd, opts());
    await closeFd(fd);
    const handle = await fs.open(path.join(dir, "c.drive"), "r+");
    await handle.write(Buffer.from([0xff, 0x00, 0xff]), 0, 3, BLOCK + 7);
    await handle.close();
    const again = await openFd(path.join(dir, "c.drive"), "r");
    await expect(verifyDrive(again, result.bytes, result.sha256, new AbortController().signal, () => undefined)).rejects.toBeInstanceOf(VerifyError);
    await closeFd(again);
  });

  it("notices a drive that ends too early", async () => {
    const fd = await drive("d.drive");
    await expect(verifyDrive(fd, 3 * BLOCK, "0".repeat(64), new AbortController().signal, () => undefined)).rejects.toBeInstanceOf(VerifyError);
    await closeFd(fd);
  });

  it("stops when cancelled, leaving no partition table behind", async () => {
    const { file } = await image("e", 8 * BLOCK);
    const target = path.join(dir, "e.drive");
    await fs.writeFile(target, Buffer.alloc(16 * BLOCK, 0xaa)); // an old drive's content
    const fd = await openFd(target, "r+");
    const ctrl = new AbortController();
    const reason = new Error("Cancelled.");
    const p = writeImage(file, fd, opts({ driveSize: 16 * BLOCK, signal: ctrl.signal, onProgress: (_c, written) => { if (written > 2 * BLOCK) ctrl.abort(reason); } }));
    await expect(p).rejects.toBe(reason);
    await closeFd(fd);
    const after = await fs.readFile(target);
    // The first block is written last: here it never was, and the old partition table was cleared.
    expect(after.subarray(0, 1024 * 1024).every(b => b === 0)).toBe(true);
    // The end of the drive (where a backup GPT lives) was cleared too.
    expect(after.subarray(after.length - 1024 * 1024).every(b => b === 0)).toBe(true);
  });

  it("writes the first block last, over a cleared start", async () => {
    const { file, data } = await image("h", 3 * BLOCK);
    const target = path.join(dir, "h.drive");
    await fs.writeFile(target, Buffer.alloc(8 * BLOCK, 0xaa));
    const fd = await openFd(target, "r+");
    const result = await writeImage(file, fd, opts({ driveSize: 8 * BLOCK }));
    await verifyDrive(fd, result.bytes, result.sha256, new AbortController().signal, () => undefined);
    await closeFd(fd);
    const after = await fs.readFile(target);
    expect(after.subarray(0, data.length).equals(data)).toBe(true);
    expect(after.subarray(after.length - 1024 * 1024).every(b => b === 0)).toBe(true);
  });

  it("stops verifying when cancelled, with no read left behind", async () => {
    const { file } = await image("i", 4 * BLOCK);
    const fd = await drive("i.drive");
    const result = await writeImage(file, fd, opts());
    const ctrl = new AbortController();
    const reason = new Error("Cancelled.");
    await expect(verifyDrive(fd, result.bytes, result.sha256, ctrl.signal, done => { if (done >= BLOCK) ctrl.abort(reason); })).rejects.toBe(reason);
    await closeFd(fd);
  });

  it("says a damaged download is damaged", async () => {
    const { file } = await image("f", BLOCK);
    const bytes = await fs.readFile(file);
    bytes[Math.floor(bytes.length / 2)] ^= 0xff;
    await fs.writeFile(file, bytes);
    const fd = await drive("f.drive");
    await expect(writeImage(file, fd, opts())).rejects.toThrow(/damaged/);
    await closeFd(fd);
  });
});

describe("image size", () => {
  it("finds the smallest unpacked size from gzip's size modulo 4 GiB", () => {
    // Batocera 44 for the Pi 4: 2.3 GB to download.
    expect(minUnpackedSize(2_308_840_368, 537_919_488)).toBe(537_919_488 + 2 ** 32);
    expect(minUnpackedSize(4_371_000_334, 2_685_423_616)).toBe(2_685_423_616 + 2 ** 32);
    expect(minUnpackedSize(1000, 5000)).toBe(5000);
  });

  it("reads it from a downloaded file", async () => {
    const { file, data } = await image("g", 3000);
    expect((await probeFile(file)).minSize).toBe(data.length);
  });
});
