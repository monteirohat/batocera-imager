// The unpacked size of an image, from its partition table and gzip's ISIZE.

import { randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { HEAD_BYTES, partitionsEnd, unpackedSize } from "../src/main/image";

/** The first MiB of a disk image with an MBR: Batocera 44 for the Pi 4 has these two partitions. */
function mbrImage(parts: [type: number, startLba: number, sectors: number][]): Buffer {
  const head = Buffer.concat([Buffer.alloc(512), randomBytes(1024 * 1024 - 512)]);
  parts.forEach(([type, start, count], i) => {
    const e = 446 + 16 * i;
    head[e + 4] = type;
    head.writeUInt32LE(start, e + 8);
    head.writeUInt32LE(count, e + 12);
  });
  head.writeUInt16LE(0xaa55, 510);
  return head;
}

const PI4 = mbrImage([[0x0c, 2048, 16777216], [0x83, 16779264, 1048576]]);
const PI4_SIZE = 9_127_854_080;

describe("partitionsEnd", () => {
  it("reads where the last MBR partition ends", () => {
    expect(partitionsEnd(PI4)).toBe(PI4_SIZE);
  });

  it("reads a GPT image's disk size from its header", () => {
    const head = mbrImage([[0xee, 1, 0xffffffff]]);
    head.write("EFI PART", 512, "latin1");
    head.writeBigUInt64LE(BigInt(PI4_SIZE / 512 - 1), 512 + 32);
    expect(partitionsEnd(head)).toBe(PI4_SIZE);
  });

  it("gives up on anything else", () => {
    expect(partitionsEnd(randomBytes(4096))).toBeNull();
    expect(partitionsEnd(Buffer.alloc(100))).toBeNull();
  });
});

describe("unpackedSize", () => {
  // Batocera 44 for the Pi 4: 2.31 GB to download, 9.13 GB unpacked, ISIZE 537 919 488.
  const compressed = 2_308_840_368;
  const isize = PI4_SIZE % 2 ** 32;

  it("takes the ISIZE candidate that reaches the end of the last partition", () => {
    const head = gzipSync(PI4).subarray(0, HEAD_BYTES); // only the start of the .img.gz
    expect(unpackedSize(compressed, isize, head)).toEqual({ compressedSize: compressed, size: PI4_SIZE, exact: true });
  });

  it("falls back to the smallest candidate, marked as not exact", () => {
    expect(unpackedSize(compressed, isize, null)).toEqual({ compressedSize: compressed, size: 4_832_886_784, exact: false });
    expect(unpackedSize(compressed, isize, Buffer.from("not gzip"))).toMatchObject({ size: 4_832_886_784, exact: false });
  });
});
