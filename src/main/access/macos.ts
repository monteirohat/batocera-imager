// Writing a drive on macOS.
//
// The raw device (/dev/rdiskN) belongs to root, and macOS does not let even
// root hand it to the person. So the writing helper (helper.ts, the app's own
// executable in Node mode) runs as root, started the way balenaEtcher starts
// its writer: through `sudo`, with the password asked by a small dialog of our
// own (SUDO_ASKPASS). sudo keeps the helper in the person's session and
// attributed to this app, so macOS can ask, once, whether Batocera Imager may
// use removable volumes, and remembers the answer. (macOS's own administrator
// prompt, osascript "with administrator privileges", runs the command in
// root's session instead, where macOS can't ask and refuses the drive unless
// the app was given Full Disk Access.)
//
// The helper talks to the installer over a Unix socket in a private folder: it
// says when it is ready, waits for "go", reports progress, and stops if the
// socket closes. The raw device has no cache, so the helper's reads after
// writing come from the drive itself.
//
// In development, a disk image that already belongs to the person (a RAM disk
// named in IMAGER_TEST_DRIVE) runs the same helper without the password.

import { spawn, type ChildProcess } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { DRIVE_PRIVACY_ERROR, type Drive } from "../../shared/types";
import { run } from "../run";
import { AccessRefused, type DriveAccess, type WriteJob } from "./types";

const DISKUTIL = "/usr/sbin/diskutil";

export interface MacOptions {
  /** The .img.gz to write: fixed now, on the helper's command line. */
  image: string;
  /** Development only: this drive is a test disk image. */
  testDrive?: boolean;
}

function appleScriptString(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** helper.js next to this file; in the packaged app, outside the asar archive. */
function helperPath(): string {
  return path.join(__dirname, "..", "helper.js").replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

type Message =
  | { t: "ready" }
  | { t: "start" }
  | { t: "write"; c: number; w: number }
  | { t: "verify"; d: number; n: number }
  | { t: "done"; n: number }
  | { t: "error"; m: string };

/** When macOS refused the drive: the person said no to "access files on a removable volume". */
export const DRIVE_PRIVACY_HELP =
  `${DRIVE_PRIVACY_ERROR} In System Settings > Privacy & Security > Files and Folders, turn on Removable Volumes ` +
  "for Batocera Imager, then try again. Nothing was written to the drive.";

/**
 * The password dialog sudo runs (SUDO_ASKPASS): it prints what the person
 * types, or fails on Cancel. Written into the private folder, readable only by
 * the person.
 */
export function askpassScript(driveName: string): string {
  const text = `Batocera Imager needs your password to write to ${driveName}.`;
  const icon = path.join(process.resourcesPath ?? "", "icon.icns");
  return [
    "#!/usr/bin/osascript",
    "on run argv",
    `  set theText to ${appleScriptString(text)} & return & return & "Type your password to allow this."`,
    "  try",
    `    set theIcon to POSIX file ${appleScriptString(icon)} as alias`,
    "  on error",
    "    set theIcon to caution",
    "  end try",
    '  set answer to display dialog theText default answer "" with hidden answer with title "Batocera Imager" buttons {"Cancel", "OK"} default button "OK" with icon theIcon',
    "  return text returned of answer",
    "end run",
    "",
  ].join("\n");
}

export async function openDrive(drive: Drive, signal: AbortSignal, options: MacOptions): Promise<DriveAccess> {
  const id = /^\/dev\/(disk\d+)$/.exec(drive.path)?.[1];
  if (!id) throw new Error(`Unexpected drive path: ${drive.path}`);
  const rdisk = `/dev/r${id}`;

  // A private folder for the socket (macOS limits socket paths to 104 bytes).
  let base = os.tmpdir();
  if (path.join(base, "batocera-imager-XXXXXX", "s").length > 100) base = "/tmp";
  const dir = await fs.mkdtemp(path.join(base, "batocera-imager-"));
  const socketPath = path.join(dir, "s");
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(socketPath, resolve); });

  const helper = [
    "/usr/bin/env",
    "ELECTRON_RUN_AS_NODE=1",
    process.execPath,
    helperPath(),
    socketPath,
    rdisk,
    options.image,
    String(drive.size),
    ...(options.testDrive ? ["--test-drive"] : []),
  ];

  // A disk image the person already owns (development) needs no password.
  const owned = await fs.access(rdisk, constants.R_OK | constants.W_OK).then(() => true, () => false);
  let child: ChildProcess;
  let stderr = "";
  if (owned && options.testDrive) {
    child = spawn(helper[0], helper.slice(1), { stdio: ["ignore", "ignore", "pipe"] });
  } else {
    const askpass = path.join(dir, "askpass");
    await fs.writeFile(askpass, askpassScript(drive.name), { mode: 0o700 });
    // -A: the password comes from the dialog; -k: always ask, never a cached sudo session.
    child = spawn("/usr/bin/sudo", ["-A", "-k", "--", ...helper], {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, SUDO_ASKPASS: askpass, ELECTRON_RUN_AS_NODE: undefined },
    });
  }
  child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  const ended = new Promise<number | null>(resolve => {
    if (child.exitCode !== null) resolve(child.exitCode);
    else child.once("close", code => resolve(code));
  });

  const cleanup = async () => {
    server.close();
    await Promise.race([ended, new Promise(r => setTimeout(r, 5000))]);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  };

  // Wait for the helper to connect and say it is ready: the password was given.
  let socket: net.Socket;
  let pending = "";
  const queue: Message[] = [];
  let notify: (() => void) | null = null;
  try {
    socket = await new Promise<net.Socket>((resolve, reject) => {
      const onAbort = () => { child.kill(); reject(signal.reason); };
      signal.addEventListener("abort", onAbort, { once: true });
      server.once("connection", s => { signal.removeEventListener("abort", onAbort); resolve(s); });
      void ended.then(code => {
        signal.removeEventListener("abort", onAbort);
        if (/no password was provided|-128/i.test(stderr)) reject(new AccessRefused());
        else if (/incorrect password/i.test(stderr)) reject(new Error("The password was not accepted. Nothing was written to the drive."));
        else if (/not in the sudoers|not allowed to run/i.test(stderr)) {
          reject(new Error("This account can't run commands as administrator. Use an administrator account. Nothing was written to the drive."));
        } else reject(new Error(`Could not get access to the drive: ${stderr.trim() || `exit code ${code}`}`));
      });
    });
  } catch (err) {
    await cleanup();
    throw err;
  }
  socket.on("data", chunk => {
    pending += chunk.toString();
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      try {
        queue.push(JSON.parse(line) as Message);
      } catch {
        // Not a message from the helper.
      }
    }
    notify?.();
  });
  socket.on("end", () => notify?.());
  socket.on("close", () => notify?.());
  socket.on("error", () => undefined);

  /** The next message, or null when the helper is gone. */
  const next = async (): Promise<Message | null> => {
    while (queue.length === 0) {
      if (socket.destroyed || socket.readableEnded) return null;
      await new Promise<void>(resolve => { notify = resolve; });
      notify = null;
    }
    return queue.shift() ?? null;
  };

  const first = await next();
  if (first?.t !== "ready") {
    socket.destroy();
    await cleanup();
    throw new Error(`The writing helper did not start: ${stderr.trim() || "no answer"}`);
  }

  return {
    async writeAndVerify(job: WriteJob) {
      const onAbort = () => { if (!socket.destroyed) socket.write("abort\n"); };
      job.signal.addEventListener("abort", onAbort, { once: true });
      try {
        socket.write("go\n");
        for (;;) {
          const m = await next();
          if (!m) throw new Error(`The writing helper stopped: ${stderr.trim() || "no answer"}`);
          if (m.t === "start") job.onStart();
          else if (m.t === "write") job.onWrite(m.c, m.w);
          else if (m.t === "verify") job.onVerify(m.d, m.n);
          else if (m.t === "done") return m.n;
          else if (m.t === "error") {
            if (job.signal.aborted) throw job.signal.reason;
            // Refused by macOS's privacy rules, even as root: removable volumes not allowed.
            if (/EPERM/.test(m.m) && /\/dev\/r?disk/.test(m.m)) throw new Error(DRIVE_PRIVACY_HELP);
            throw new Error(m.m);
          }
        }
      } finally {
        job.signal.removeEventListener("abort", onAbort);
      }
    },
    async close(success) {
      socket.end();
      await cleanup();
      if (!success) return false;
      return run(DISKUTIL, ["eject", `/dev/${id}`], { timeoutMs: 60_000 }).then(() => true, () => false);
    },
  };
}
