// The macOS writing helper. It runs as root, started through the system's
// password prompt (see access/macos.ts) by the app's own executable in Node
// mode, and does only this:
//
//   node helper.js <socket> </dev/rdiskN> <image.img.gz> <drive size> [--test-drive]
//
// 1. connects to the installer's Unix socket and says it is ready;
// 2. waits for "go" (the installer first checks once more that the drive is
//    the one the person chose);
// 3. checks, as root, that the drive is an external or removable physical
//    disk and not the one the Mac runs from; unmounts it; writes the image;
//    reads it back and compares; reports progress as JSON lines;
// 4. stops at once on "abort" or when the socket closes (the installer quit).
//
// The drive and the image are fixed on its command line, which the password
// prompt covered: nothing that arrives on the socket can point it elsewhere.

import { constants, promises as fs } from "node:fs";
import net from "node:net";
import { closeQuietly, openFd } from "./fd";
import { isCandidate, systemDisks } from "./drives/macos";
import { parsePlist, type PlistValue } from "./drives/plist";
import { run } from "./run";
import { verifyDrive, writeImage } from "./writer";

const DISKUTIL = "/usr/sbin/diskutil";

type Message =
  | { t: "ready" }
  | { t: "start" }
  | { t: "write"; c: number; w: number }
  | { t: "verify"; d: number; n: number }
  | { t: "done"; n: number }
  | { t: "error"; m: string };

async function checkDrive(disk: string, testDrive: boolean): Promise<void> {
  const info = parsePlist(await run(DISKUTIL, ["info", "-plist", disk])) as Record<string, PlistValue>;
  if (info.WholeDisk !== true) throw new Error(`${disk} is not a whole disk.`);
  const virtualTest = testDrive && info.VirtualOrPhysical === "Virtual";
  if (!virtualTest && !isCandidate(info)) throw new Error(`${disk} is not an external or removable drive; it was not touched.`);
  if ((await systemDisks()).has(disk)) throw new Error(`${disk} holds the system this Mac runs from; it was not touched.`);
}

async function main(): Promise<void> {
  const [socketPath, rdisk, image, sizeText, flag] = process.argv.slice(2);
  const id = /^\/dev\/r(disk\d+)$/.exec(rdisk ?? "")?.[1];
  const driveSize = Number(sizeText);
  if (!socketPath || !id || !image?.endsWith(".img.gz") || !Number.isSafeInteger(driveSize)) {
    throw new Error("usage: helper.js <socket> </dev/rdiskN> <image.img.gz> <drive size> [--test-drive]");
  }
  const testDrive = flag === "--test-drive";

  const socket = net.createConnection(socketPath);
  await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("error", reject); });
  let last = 0;
  const send = (m: Message, force = true) => {
    const now = Date.now();
    if (!force && now - last < 200) return;
    last = now;
    if (!socket.destroyed) socket.write(`${JSON.stringify(m)}\n`);
  };

  const abort = new AbortController();
  let go: () => void;
  const started = new Promise<void>(resolve => { go = resolve; });
  let input = "";
  socket.on("data", chunk => {
    input += chunk.toString();
    const lines = input.split("\n");
    input = lines.pop() ?? "";
    for (const line of lines) {
      if (line === "go") go();
      if (line === "abort") abort.abort(new Error("Cancelled."));
    }
  });
  socket.on("close", () => abort.abort(new Error("Cancelled.")));
  socket.on("error", () => abort.abort(new Error("Cancelled.")));
  send({ t: "ready" });

  await Promise.race([started, new Promise((_, reject) => abort.signal.addEventListener("abort", () => reject(abort.signal.reason), { once: true }))]);

  try {
    await fs.stat(image);
    await checkDrive(id, testDrive);
    await run(DISKUTIL, ["unmountDisk", "force", `/dev/${id}`], { timeoutMs: 60_000 });
    let fd: number;
    try {
      fd = await openFd(rdisk, constants.O_RDWR);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EBUSY") throw err;
      // A volume was mounted again in the meantime.
      await run(DISKUTIL, ["unmountDisk", "force", `/dev/${id}`], { timeoutMs: 60_000 });
      fd = await openFd(rdisk, constants.O_RDWR);
    }
    send({ t: "start" });
    try {
      const result = await writeImage(image, fd, { driveSize, signal: abort.signal, onProgress: (c, w) => send({ t: "write", c, w }, false) });
      send({ t: "verify", d: 0, n: result.bytes });
      // The raw device has no cache: the reads come from the drive.
      await verifyDrive(fd, result.bytes, result.sha256, abort.signal, d => send({ t: "verify", d, n: result.bytes }, false));
      send({ t: "done", n: result.bytes });
    } finally {
      await closeQuietly(fd);
    }
  } catch (err) {
    send({ t: "error", m: err instanceof Error ? err.message : String(err) });
    socket.end();
    process.exitCode = 1;
    return;
  }
  socket.end();
}

main().catch(err => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
