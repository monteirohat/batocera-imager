// The whole job, in order: get the image (download and check), make sure the
// drive is still the chosen one and large enough, open it, write, read back,
// eject. Progress goes out as phases with a fraction and an averaged speed.

import type { FlashProgress, FlashRequest, FlashResult, Phase } from "../shared/types";
import { openDrive } from "./access";
import { obtainImage } from "./download";
import { confirmSameDrive, type ListOptions } from "./drives";
import { probeFile } from "./image";

export interface FlashOptions extends ListOptions {
  cacheDir: string;
  signal: AbortSignal;
  onProgress: (p: FlashProgress) => void;
}

/** Sends progress at most every 150 ms, with a speed averaged over a few seconds. */
function reporter(send: (p: FlashProgress) => void) {
  let phase: Phase | null = null;
  let lastSent = 0;
  let sample = { t: 0, done: 0 };
  let speed = 0;
  let cached = false;

  return {
    set cached(v: boolean) { cached = v; },
    report(next: Phase, done: number, total: number, force = false) {
      const now = Date.now();
      if (next !== phase) {
        phase = next;
        sample = { t: now, done };
        speed = 0;
        force = true;
      } else if (now - sample.t >= 1000) {
        const instant = ((done - sample.done) * 1000) / (now - sample.t);
        speed = speed ? speed * 0.7 + instant * 0.3 : instant;
        sample = { t: now, done };
      }
      if (!force && now - lastSent < 150) return;
      lastSent = now;
      send({ phase: next, fraction: total > 0 ? Math.min(1, done / total) : null, done, total, speed, cached });
    },
  };
}

export async function flash(request: FlashRequest, options: FlashOptions): Promise<FlashResult> {
  const { device, drive } = request;
  const { signal } = options;
  const progress = reporter(options.onProgress);

  progress.report("download", 0, 0, true);
  const image = await obtainImage(device.imageUrl, device.md5Url, options.cacheDir, signal, p => progress.report(p.phase, p.done, p.total));
  progress.cached = image.cached;

  const info = await probeFile(image.path);
  if (drive.size < info.size) {
    const gb = (n: number) => (n / 1e9).toFixed(1);
    throw new Error(
      `${drive.name} is too small for this image: it holds ${gb(drive.size)} GB and the image needs ${info.exact ? "" : "at least "}` +
      `${gb(info.size)} GB. Nothing was written to the drive.`,
    );
  }

  progress.report("access", 0, 0, true);
  await confirmSameDrive(drive, options);
  if (signal.aborted) throw signal.reason;
  const access = await openDrive(drive, signal, { image: image.path, testDrive: !!options.testDrive && options.testDrive === drive.path });

  let written = 0;
  try {
    // The password prompt may have stayed open for a while: check the drive
    // once more, now that access is given and before anything is erased.
    await confirmSameDrive(drive, options);
    if (signal.aborted) throw signal.reason;

    written = await access.writeAndVerify({
      image: image.path,
      driveSize: drive.size,
      signal,
      // The "write" phase starts when the drive is actually being changed.
      // Progress counts what reached the drive, against the unpacked size. (The
      // .img.gz is a poor measure: the empty end of an image takes almost no
      // room in it, so the last percent would take minutes.)
      onStart: () => progress.report("write", 0, info.size, true),
      onWrite: (_compressed, w) => progress.report("write", w, Math.max(info.size, w)),
      onVerify: (done, total) => progress.report("verify", done, total, done === 0),
    });
  } catch (err) {
    // Tells main.ts when the drive is gone from the list.
    if (await access.close(false)) throw Object.assign(err instanceof Error ? err : new Error(String(err)), { ejected: true });
    throw err;
  }
  progress.report("finish", 0, 0, true);
  const ejected = await access.close(true);
  return { written, ejected };
}
