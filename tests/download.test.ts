// Downloading into the cache from a local server: resuming, checking the
// MD5, reusing a checked file, cleaning older images.

import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { obtainImage } from "../src/main/download";
import { get } from "../src/main/http";
import { probeImage } from "../src/main/image";

const body = randomBytes(3 * 1024 * 1024 + 123);
const md5 = createHash("md5").update(body).digest("hex");
let server: http.Server;
let base: string;
let dir: string;
let requests: { url: string; range?: string }[] = [];
let wrongMd5 = false;
let cutAfter = 0;
let failures = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    requests.push({ url: req.url ?? "", range: req.headers.range });
    if (req.url?.endsWith(".md5")) {
      res.end(`${wrongMd5 ? "0".repeat(32) : md5}  batocera-test-44.img.gz\n`);
      return;
    }
    if (req.url === "/slow") {
      // Headers at once, then the body over 1.2 s.
      res.setHeader("Content-Length", 3);
      res.write("a");
      setTimeout(() => res.write("b"), 600);
      setTimeout(() => res.end("c"), 1200);
      return;
    }
    if (failures > 0 && !req.url?.endsWith(".md5")) {
      failures--;
      res.statusCode = 503;
      res.end();
      return;
    }
    if (req.url === "/missing.img.gz") {
      res.statusCode = 404;
      res.end();
      return;
    }
    let start = 0;
    let end = body.length - 1;
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (m) {
      if (m[1] === "") {
        start = body.length - Number(m[2]);
      } else {
        start = Number(m[1]);
        if (m[2]) end = Number(m[2]);
      }
      if (start >= body.length) {
        res.statusCode = 416;
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${body.length}`);
    }
    const slice = body.subarray(start, end + 1);
    res.setHeader("Content-Length", slice.length);
    if (cutAfter > 0) {
      // Send part of the file and drop the connection.
      res.write(slice.subarray(0, cutAfter), () => res.destroy());
      cutAfter = 0;
      return;
    }
    res.end(slice);
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(r => server.close(r));
});

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "imager-dl-"));
  requests = [];
  wrongMd5 = false;
  cutAfter = 0;
  failures = 0;
});

const url = () => `${base}/x86/batocera-test-44.img.gz`;
const md5Url = () => `${url()}.md5`;

describe("obtainImage", () => {
  it("downloads, checks and keeps the image; the next time it is reused", async () => {
    const phases = new Set<string>();
    const first = await obtainImage(url(), md5Url(), dir, new AbortController().signal, p => phases.add(p.phase));
    expect(first.cached).toBe(false);
    expect((await fs.readFile(first.path)).equals(body)).toBe(true);
    expect([...phases]).toEqual(["download", "check"]);

    requests = [];
    const second = await obtainImage(url(), md5Url(), dir, new AbortController().signal, () => undefined);
    expect(second).toEqual({ path: first.path, cached: true });
    expect(requests.map(r => r.url)).toEqual(["/x86/batocera-test-44.img.gz.md5"]);
  });

  it("resumes a download that stopped", async () => {
    cutAfter = 1024 * 1024;
    const file = await obtainImage(url(), md5Url(), dir, new AbortController().signal, () => undefined);
    expect((await fs.readFile(file.path)).equals(body)).toBe(true);
    const ranges = requests.filter(r => !r.url.endsWith(".md5")).map(r => r.range);
    expect(ranges[0]).toBeUndefined();
    expect(ranges[1]).toMatch(/^bytes=\d+-$/);
  });

  it("refuses a download whose MD5 does not match, and keeps nothing", async () => {
    wrongMd5 = true;
    await expect(obtainImage(url(), md5Url(), dir, new AbortController().signal, () => undefined)).rejects.toThrow(/damaged/);
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it("deletes older images", async () => {
    await fs.writeFile(path.join(dir, "batocera-old-43.img.gz"), "old");
    await fs.writeFile(path.join(dir, "batocera-old-43.img.gz.md5"), "x");
    await obtainImage(url(), md5Url(), dir, new AbortController().signal, () => undefined);
    expect((await fs.readdir(dir)).sort()).toEqual(["batocera-test-44.img.gz", "batocera-test-44.img.gz.md5"]);
  });

  it("tries again after a server error", async () => {
    failures = 1;
    const file = await obtainImage(url(), md5Url(), dir, new AbortController().signal, () => undefined);
    expect((await fs.readFile(file.path)).equals(body)).toBe(true);
  });

  it("checks a kept image again, and downloads it again if it went bad", async () => {
    const first = await obtainImage(url(), md5Url(), dir, new AbortController().signal, () => undefined);
    const bytes = await fs.readFile(first.path);
    bytes[100] ^= 0xff;
    await fs.writeFile(first.path, bytes);
    const second = await obtainImage(url(), md5Url(), dir, new AbortController().signal, () => undefined);
    expect(second.cached).toBe(false);
    expect((await fs.readFile(second.path)).equals(body)).toBe(true);
  });

  it("reports a missing image", async () => {
    await expect(obtainImage(`${base}/missing.img.gz`, md5Url(), dir, new AbortController().signal, () => undefined)).rejects.toThrow(/404/);
  });
});

describe("get", () => {
  it("limits the wait for the answer, not the time to read it", async () => {
    const res = await get(`${base}/slow`, { timeoutMs: 300 });
    expect(await res.text()).toBe("abc");
  });
});

describe("probeImage", () => {
  it("asks for the size and the last four bytes", async () => {
    const info = await probeImage(url());
    expect(info.compressedSize).toBe(body.length);
    expect(info.minSize % 2 ** 32).toBe(body.readUInt32LE(body.length - 4));
    expect(info.minSize).toBeGreaterThanOrEqual(body.length);
  });
});
