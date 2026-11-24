// Downloads an image into the cache, resuming where it stopped, and checks it
// against the MD5 published next to it before anything touches a drive.
//
// Only the last image is kept: starting another download deletes the others.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { get, getText, HttpError } from "./http";

export interface ImageFile {
  path: string;
  /** It was already in the cache and checked. */
  cached: boolean;
}

export interface DownloadProgress {
  phase: "download" | "check";
  done: number;
  total: number;
}

const ATTEMPTS = 5;
/** A download that receives nothing for this long is restarted (and resumed). */
const STALL_MS = 60_000;
/** Kept free on the disk on top of the image. */
const SPARE = 256 * 1024 * 1024;

export function imageName(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  if (!/^[\w.+-]+\.img\.gz$/.test(name)) throw new Error(`Unexpected image name: ${name || url}`);
  return name;
}

async function fileSize(file: string): Promise<number> {
  return fs.stat(file).then(s => s.size, () => -1);
}

export async function md5File(file: string, signal: AbortSignal, onBytes: (done: number) => void): Promise<string> {
  const hash = createHash("md5");
  let done = 0;
  await pipeline(
    createReadStream(file, { highWaterMark: 4 * 1024 * 1024 }),
    new Transform({
      transform(chunk: Buffer, _enc, cb) {
        hash.update(chunk);
        done += chunk.length;
        onBytes(done);
        cb();
      },
    }),
    { signal },
  );
  return hash.digest("hex");
}

async function expectedMd5(url: string, signal: AbortSignal): Promise<string> {
  const text = await getText(url, signal);
  const m = /\b([a-f0-9]{32})\b/i.exec(text);
  if (!m) throw new Error("The MD5 file next to the image is empty or unreadable.");
  return m[1].toLowerCase();
}

/** Deletes every file of the cache except those of `keep`. */
async function pruneCache(dir: string, keep: string): Promise<void> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    names
      .filter(n => n !== keep && n !== `${keep}.part` && n !== `${keep}.md5`)
      .map(n => fs.rm(path.join(dir, n), { force: true, recursive: true })),
  );
}

export async function cacheSize(dir: string): Promise<number> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const sizes = await Promise.all(names.map(n => fileSize(path.join(dir, n))));
  return sizes.reduce((sum, s) => sum + Math.max(0, s), 0);
}

export async function clearCache(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

async function ensureSpace(dir: string, needed: number): Promise<void> {
  const stats = await fs.statfs(dir).catch(() => null);
  if (!stats) return;
  const free = stats.bavail * stats.bsize;
  if (free < needed + SPARE) {
    const gb = (n: number) => (n / 1e9).toFixed(1);
    throw new Error(`Not enough free space to download the image: it needs ${gb(needed + SPARE)} GB and ${gb(free)} GB are free.`);
  }
}

/** One request, from `start` to the end. Returns the total size of the file. */
async function fetchFrom(url: string, part: string, start: number, signal: AbortSignal, dir: string,
  onBytes: (done: number, total: number) => void): Promise<number> {
  const res = await get(url, { signal, headers: start > 0 ? { Range: `bytes=${start}-` } : {} });

  if (res.status === 416) {
    // Nothing left after `start`: the part file is complete (or too long).
    await res.body?.cancel();
    return start;
  }
  if (!res.ok || !res.body) {
    await res.body?.cancel();
    throw new HttpError(res.status, url);
  }

  let offset = start;
  let total: number;
  if (res.status === 206) {
    const range = /^bytes\s+(\d+)-\d+\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "");
    if (!range || Number(range[1]) !== start) {
      // Not the part that was asked for: appending it would corrupt the file.
      await res.body.cancel();
      await fs.rm(part, { force: true });
      throw new Error("The server resumed the download at the wrong place; it starts again.");
    }
    total = Number(range[2]);
  } else {
    // The server ignored the range: start again from zero.
    offset = 0;
    total = Number(res.headers.get("content-length"));
  }
  if (!Number.isFinite(total) || total <= 0) total = 0;
  if (total) await ensureSpace(dir, total - offset);

  let done = offset;
  onBytes(done, total);
  // A connection that stays open but sends nothing is dropped, then resumed.
  const stall = new AbortController();
  let last = Date.now();
  const watch = setInterval(() => {
    if (Date.now() - last > STALL_MS) stall.abort(new Error("The download stalled."));
  }, 5000);
  try {
    await pipeline(
      Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>),
      new Transform({
        transform(chunk: Buffer, _enc, cb) {
          last = Date.now();
          done += chunk.length;
          onBytes(done, total);
          cb(null, chunk);
        },
      }),
      createWriteStream(part, { flags: offset > 0 ? "a" : "w" }),
      { signal: AbortSignal.any([signal, stall.signal]) },
    );
  } catch (err) {
    if (signal.aborted) throw signal.reason ?? err;
    throw stall.signal.aborted ? stall.signal.reason : err;
  } finally {
    clearInterval(watch);
  }
  return total || done;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function obtainImage(url: string, md5Url: string, dir: string, signal: AbortSignal,
  onProgress: (p: DownloadProgress) => void): Promise<ImageFile> {
  const name = imageName(url);
  const final = path.join(dir, name);
  const part = `${final}.part`;
  const marker = `${final}.md5`;
  await fs.mkdir(dir, { recursive: true });

  // The MD5 decides whether the cached file is still the right one.
  let md5: string;
  try {
    md5 = await expectedMd5(md5Url, signal);
  } catch (err) {
    if (signal.aborted) throw err;
    // Offline: a file that was checked before is still good, if it still matches.
    const saved = (await fs.readFile(marker, "utf8").catch(() => "")).trim();
    const size = await fileSize(final);
    if (saved && size > 0) {
      onProgress({ phase: "check", done: 0, total: size });
      const actual = await md5File(final, signal, done => onProgress({ phase: "check", done, total: size }));
      if (actual === saved) return { path: final, cached: true };
    }
    throw err;
  }

  // A kept image is checked again: the drive must not be erased for a file
  // that went bad on this disk since it was downloaded.
  const saved = await fs.readFile(marker, "utf8").catch(() => "");
  const keptSize = await fileSize(final);
  if (saved.trim() === md5 && keptSize > 0) {
    await pruneCache(dir, name);
    onProgress({ phase: "check", done: 0, total: keptSize });
    const actual = await md5File(final, signal, done => onProgress({ phase: "check", done, total: keptSize }));
    if (actual === md5) return { path: final, cached: true };
  }

  await pruneCache(dir, name);
  await fs.rm(final, { force: true });
  await fs.rm(marker, { force: true });

  let total = 0;
  for (let attempt = 1; ; attempt++) {
    const start = Math.max(0, await fileSize(part));
    try {
      total = await fetchFrom(url, part, start, signal, dir, (done, t) => onProgress({ phase: "download", done, total: t }));
      const size = await fileSize(part);
      if (total && size > total) {
        // Longer than the file on the server: it can't be trusted.
        await fs.rm(part, { force: true });
        throw new Error("The downloaded file is longer than the image.");
      }
      if (!total || size === total) break;
    } catch (err) {
      if (signal.aborted || attempt >= ATTEMPTS) throw err;
      if (err instanceof HttpError && !err.retryable) throw err;
      if (err instanceof Error && /enough free space/.test(err.message)) throw err;
    }
    if (attempt >= ATTEMPTS) {
      throw new Error("The download kept stopping. Check the internet connection and try again: it resumes where it stopped.");
    }
    await wait(Math.min(2000 * attempt, 10_000), signal);
  }

  const size = await fileSize(part);
  onProgress({ phase: "check", done: 0, total: size });
  const actual = await md5File(part, signal, done => onProgress({ phase: "check", done, total: size }));
  if (actual !== md5) {
    await fs.rm(part, { force: true });
    throw new Error("The downloaded image is damaged (its MD5 does not match). Try again: it will be downloaded from the start.");
  }
  await fs.rename(part, final);
  await fs.writeFile(marker, md5);
  return { path: final, cached: false };
}
