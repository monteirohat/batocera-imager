// Opening a drive on Linux.
//
// The drive belongs to root. The installer asks for the password once, through
// polkit (pkexec), and runs a short shell script as root. The script refuses a
// drive the system runs from, unmounts the drive's partitions and gives the
// device file to the person, then says "ready" and waits for one line on its
// standard input:
// - "flush", once the image is written: it empties the kernel's buffers for
//   the drive, so that reading it back reads the drive itself;
// - nothing (the pipe closes because the installer cancelled, quit or
//   crashed): it stops at once.
// Either way it gives the device file back to its owner when it ends. Writing
// and reading back run without privileges, on a descriptor opened while the
// file was the person's.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import type { Drive } from "../../shared/types";
import { closeQuietly, openFd } from "../fd";
import { run } from "../run";
import { AccessRefused, type DriveAccess } from "./types";

/** Runs as root: $1 device, $2:$3 the person's uid and gid. */
export const ROOT_SCRIPT = `
set -u
dev="$1"; owner="$2:$3"
case "$dev" in
  /dev/sd[a-z]*|/dev/mmcblk[0-9]*|/dev/nvme[0-9]*n[0-9]*|/dev/vd[a-z]*) ;;
  *) echo "Unexpected device: $dev" >&2; exit 2 ;;
esac
[ -b "$dev" ] || { echo "$dev is not a block device." >&2; exit 2; }
if lsblk -lnpo MOUNTPOINT "$dev" | grep -Eqx '/|/boot(/.*)?|/usr|/var|/home|/etc|/opt|/srv|/nix|\\[SWAP\\]|/cdrom|/run/live/.*|/lib/live/.*|/run/initramfs/.*|/run/archiso/.*|/isodevice'; then
  echo "$dev holds a part of the running system." >&2; exit 7
fi
for part in $(lsblk -lnpo NAME "$dev" | sort -r); do
  umount "$part" 2>/dev/null
done
if lsblk -lnpo MOUNTPOINT "$dev" | grep -q .; then
  echo "A partition of $dev is still in use and could not be unmounted." >&2; exit 3
fi
before=$(stat -c %u:%g "$dev") || exit 4
trap 'chown "$before" "$dev" 2>/dev/null' EXIT
trap 'exit 1' HUP INT TERM PIPE
chown "$owner" "$dev" || exit 4
echo ready
if read -r command && [ "$command" = flush ]; then
  sync
  blockdev --flushbufs "$dev" || exit 6
  echo flushed
fi
exit 0
`;

function exited(child: ChildProcessWithoutNullStreams): Promise<number | null> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(child.exitCode);
  return new Promise(resolve => child.once("close", code => resolve(code)));
}

async function findPkexec(): Promise<string> {
  for (const p of ["/usr/bin/pkexec", "/bin/pkexec", "/usr/local/bin/pkexec"]) {
    if (await fs.access(p).then(() => true, () => false)) return p;
  }
  throw new Error("pkexec was not found. Install polkit (the pkexec package) to let the installer write drives.");
}

/** Resolves when the script prints `word` on a line; rejects if it ends first. */
function waitFor(child: ChildProcessWithoutNullStreams, word: string, stderr: () => string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let out = "";
    const cleanup = () => {
      child.stdout.off("data", onData);
      child.off("close", onClose);
      signal?.removeEventListener("abort", onAbort);
    };
    const onData = (chunk: Buffer) => {
      out += chunk.toString();
      if (out.split("\n").includes(word)) { cleanup(); resolve(); }
    };
    const onClose = (code: number | null) => {
      cleanup();
      // pkexec: 126 when the prompt was dismissed, 127 when not authorized or no agent.
      if (code === 126) reject(new AccessRefused());
      else reject(new Error(`Could not get access to the drive: ${stderr().trim() || `exit code ${code}`}`));
    };
    const onAbort = () => {
      cleanup();
      // Before the password is given, pkexec still runs as the person and can be stopped;
      // after it, closing the pipe ends the script.
      child.kill();
      child.stdin.end();
      reject(signal?.reason);
    };
    child.stdout.on("data", onData);
    child.once("close", onClose);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function openDrive(drive: Drive, signal: AbortSignal): Promise<DriveAccess> {
  if (!/^\/dev\/(sd[a-z]+|mmcblk\d+|nvme\d+n\d+|vd[a-z]+)$/.test(drive.path)) {
    throw new Error(`Unexpected drive path: ${drive.path}`);
  }
  const pkexec = await findPkexec();
  let stderr = "";
  const child = spawn(
    pkexec,
    ["/bin/sh", "-c", ROOT_SCRIPT, "sh", drive.path, String(process.getuid?.() ?? 0), String(process.getgid?.() ?? 0)],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  child.stdin.on("error", () => undefined); // the script may end before reading

  const release = async () => {
    child.stdin.end();
    await Promise.race([exited(child), new Promise(r => setTimeout(r, 5000))]);
  };

  await waitFor(child, "ready", () => stderr, signal);

  let fd: number;
  try {
    // O_EXCL on a block device fails if the system still uses it (mounted).
    fd = await openFd(drive.path, constants.O_RDWR | constants.O_EXCL);
  } catch (err) {
    await release();
    if ((err as NodeJS.ErrnoException).code === "EBUSY") throw new Error(`${drive.name} is in use by the system and can't be written.`);
    throw err;
  }

  return {
    fd,
    async beforeVerify() {
      const flushed = waitFor(child, "flushed", () => stderr);
      child.stdin.write("flush\n");
      await Promise.race([
        flushed,
        new Promise((_, reject) => setTimeout(() => reject(new Error("The drive's buffers could not be emptied in time.")), 120_000)),
      ]);
    },
    async close(success) {
      await closeQuietly(fd);
      await release();
      if (!success) return false;
      // Unmounts what the desktop may have mounted meanwhile and powers the drive off.
      await new Promise(r => setTimeout(r, 1500));
      return run("udisksctl", ["power-off", "-b", drive.path], { timeoutMs: 30_000 }).then(() => true, () => false);
    },
  };
}
