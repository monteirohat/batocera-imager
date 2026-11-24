// Demo data for the interface opened in a plain browser (npm run dev:web) and
// for screenshots: a few devices, two drives, and a write that takes about
// twenty seconds. Nothing here talks to the network or to a drive.

import type { Catalog, Device, Drive, FlashProgress, ImagerApi, Phase } from "../shared/types";

function device(id: string, vendor: string, name: string, groups: string[], extra: Partial<Device> = {}): Device {
  return {
    id, name, vendor, groups, version: "44", date: "November 16, 2026", note: "Batocera 44", noteKind: "current",
    old: false, labeled: false, imageUrl: `https://example.invalid/${id}.img.gz`, md5Url: "", photoUrl: "", docUrl: "",
    search: `${vendor} ${name}`.toLowerCase(), ...extra,
  };
}

const catalog: Catalog = {
  families: [
    { id: "handheld", name: "Handhelds", title: "Handheld consoles", photoUrl: "" },
    { id: "pc", name: "PC", title: "PC and laptops", photoUrl: "" },
    { id: "raspberry-pi", name: "Raspberry Pi", title: "Raspberry Pi boards", photoUrl: "" },
    { id: "hardkernel", name: "Odroid", title: "Hardkernel boards", photoUrl: "" },
    { id: "anbernic", name: "Anbernic", title: "Anbernic devices", photoUrl: "" },
    { id: "ayn", name: "AYN", title: "AYN devices", photoUrl: "" },
    { id: "xunlong", name: "Orange Pi", title: "Xunlong boards", photoUrl: "" },
    { id: "others", name: "Others", title: "Other boards", photoUrl: "" },
  ],
  devices: [
    device("pc-recent", "PC", "Recent PC or laptop (Intel Haswell+, AMD Zen)", ["pc"], { note: "Faster on recent PCs (2013+)", noteKind: "plain" }),
    device("pc-older", "PC", "Older PC or laptop, or if you're not sure", ["pc"], { note: "Works on any 64-bit PC", noteKind: "plain" }),
    device("ayn-loki-zero", "AYN", "Loki Zero", ["handheld", "pc", "ayn"], { labeled: true }),
    device("ayn-odin-2", "AYN", "Odin 2", ["handheld", "ayn"]),
    device("rpi-5", "Raspberry Pi", "Pi 5", ["raspberry-pi"], { labeled: true }),
    device("rpi-4", "Raspberry Pi", "Pi 4 Model B", ["raspberry-pi"], { labeled: true }),
    device("rpi-400", "Raspberry Pi", "Pi 400", ["raspberry-pi"]),
    device("rpi-3", "Raspberry Pi", "Pi 3 Model B+", ["raspberry-pi"]),
    device("rpi-zero-2", "Raspberry Pi", "Pi Zero 2 W", ["raspberry-pi"]),
    device("rpi-2", "Raspberry Pi", "Pi 2 Model B", ["raspberry-pi"], { version: "41", note: "Batocera 41", noteKind: "old", old: true }),
    device("odroid-n2", "Hardkernel", "ODROID-N2+", ["hardkernel"]),
    device("odroid-go", "Hardkernel", "ODROID-GO Advance", ["hardkernel", "handheld"], { version: "42", note: "Batocera 42", noteKind: "old", old: true }),
    device("rg35xx", "Anbernic", "RG35XX H", ["anbernic", "handheld"]),
    device("rg353", "Anbernic", "RG353V", ["anbernic", "handheld"]),
    device("opi-5", "Xunlong", "Orange Pi 5", ["xunlong"]),
    device("rock-5b", "Radxa", "Rock 5B", ["others"]),
  ],
  fetchedAt: new Date().toISOString(),
  offline: false,
};

const drives: Drive[] = [
  { id: "/dev/disk4", path: "/dev/disk4", name: "SanDisk Ultra", size: 31_914_983_424, kind: "usb", mountpoints: ["/Volumes/SANDISK"] },
  { id: "/dev/disk5", path: "/dev/disk5", name: "Generic SD Card Reader", size: 63_864_569_856, kind: "sd", mountpoints: ["/Volumes/NO NAME"] },
  { id: "/dev/disk6", path: "/dev/disk6", name: "Kingston DataTraveler", size: 4_009_754_624, kind: "usb", mountpoints: [] },
];

const listeners = new Set<(p: FlashProgress) => void>();
let cancel: (() => void) | null = null;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export const demoApi: ImagerApi = {
  async catalog() {
    await wait(400);
    return catalog;
  },
  async imageInfo() {
    return { compressedSize: 2_308_840_368, minSize: 4_832_886_784 };
  },
  async drives() {
    return drives;
  },
  async flash() {
    let cancelled = false;
    cancel = () => { cancelled = true; };
    const steps: [Phase, number, number][] = [["download", 2_308_840_368, 6000], ["check", 2_308_840_368, 1500], ["access", 0, 1200], ["write", 2_308_840_368, 7000], ["verify", 4_832_886_784, 4000]];
    for (const [phase, total, ms] of steps) {
      const start = Date.now();
      while (Date.now() - start < ms) {
        if (cancelled) throw new Error("Cancelled.");
        const f = Math.min(1, (Date.now() - start) / ms);
        const speed = total ? total / (ms / 1000) / 20 : 0;
        listeners.forEach(l => l({ phase, fraction: total ? f : null, done: f * total, total, speed }));
        await wait(150);
      }
    }
    listeners.forEach(l => l({ phase: "finish", fraction: null, done: 0, total: 0, speed: 0 }));
    await wait(600);
    return { written: 4_832_886_784, ejected: true };
  },
  async cancel() {
    cancel?.();
  },
  onProgress(callback) {
    listeners.add(callback);
    return () => { listeners.delete(callback); };
  },
  async clearCache() {},
  async openExternal(url) {
    window.open(url, "_blank", "noopener");
  },
  async appInfo() {
    return { version: "demo", repo: "https://github.com/monteirohat/batocera-imager", platform: "web", cacheSize: 2_308_840_368 };
  },
};
