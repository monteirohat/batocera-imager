// Electron main process: creates the window and answers the interface's
// requests (device list, drives, writing).

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { REPO_URL, type Catalog, type Device, type FlashRequest } from "../shared/types";
import { AccessRefused } from "./access";
import { loadCatalog } from "./catalog";
import { cacheSize, clearCache } from "./download";
import { listDrives } from "./drives";
import { flash } from "./flash";
import { setAppVersion } from "./http";
import { probeImage } from "./image";

let win: BrowserWindow | null = null;
/** The write in progress: at most one, and quitting waits for it to stop. */
let job: { abort: AbortController; done: Promise<unknown> } | null = null;
let catalog: Catalog | null = null;

const cacheDir = () => path.join(app.getPath("userData"), "images");
const catalogFile = () => path.join(app.getPath("userData"), "catalog.json");

/** Development only: a macOS disk image offered as a drive (see docs/ARCHITECTURE.md). */
const testDrive = app.isPackaged ? undefined : process.env.IMAGER_TEST_DRIVE;

// On Linux the window icon must be set explicitly; Windows and macOS take it
// from the packaged app.
function windowIcon(): string | undefined {
  if (process.platform !== "linux") return undefined;
  return app.isPackaged ? path.join(process.resourcesPath, "icon.png") : path.join(__dirname, "../../build/icon.png");
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function createWindow(): void {
  const mac = process.platform === "darwin";
  win = new BrowserWindow({
    icon: windowIcon(),
    width: 1120,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "Batocera Imager",
    backgroundColor: "#051012",
    autoHideMenuBar: true,
    // On macOS the traffic lights sit inside the interface's top bar.
    titleBarStyle: mac ? "hiddenInset" : "default",
    trafficLightPosition: mac ? { x: 18, y: 20 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win?.show());
  // Closing the window during a write asks first, then quits (which stops the write).
  win.on("close", event => {
    if (!job || quitting) return;
    event.preventDefault();
    if (confirmStop()) {
      stopConfirmed = true;
      app.quit();
    }
  });
  win.on("closed", () => { win = null; });

  // Links open in the system browser, never inside the installer window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", event => event.preventDefault());

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) void win.loadURL(devServer);
  else void win.loadFile(path.join(__dirname, "../renderer/index.html"));
}

/** Only devices from the catalog the interface was given can be written. */
function knownDevice(device: Device): Device {
  const found = catalog?.devices.find(d => d.id === device?.id);
  if (!found) throw new Error("Unknown device: reload the list of devices.");
  return found;
}

function registerIpc(): void {
  ipcMain.handle("catalog", async (_event, refresh?: boolean) => {
    if (!catalog || refresh || catalog.offline) catalog = await loadCatalog(catalogFile());
    return catalog;
  });

  ipcMain.handle("image:info", (_event, device: Device) => probeImage(knownDevice(device).imageUrl));

  ipcMain.handle("drives", () => listDrives({ testDrive }));

  ipcMain.handle("flash", (event, request: FlashRequest) => {
    if (job) throw new Error("A drive is already being written.");
    const abort = new AbortController();
    const run = async () => {
      const device = knownDevice(request.device);
      // The drive must be one the system lists now; flash() checks it again before erasing.
      const drive = (await listDrives({ testDrive })).find(d => d.path === request.drive?.path);
      if (!drive) throw new Error("The drive is no longer connected.");
      try {
        return await flash({ device, drive: { ...drive, ...pickChosen(request, drive) } }, {
          cacheDir: cacheDir(),
          testDrive,
          signal: abort.signal,
          onProgress: p => { if (!event.sender.isDestroyed()) event.sender.send("flash:progress", p); },
        });
      } catch (err) {
        const ejected = (err as { ejected?: boolean }).ejected ? " The drive was ejected: plug it in again to try again." : "";
        if (abort.signal.aborted) throw new Error(`Cancelled.${ejected}`);
        if (err instanceof AccessRefused) throw new Error("Cancelled: the password was not given, so nothing was written.");
        throw new Error(`${err instanceof Error ? err.message : String(err)}${ejected}`);
      }
    };
    // Taken before the first await, so a second request is refused.
    const done = run();
    job = { abort, done };
    return done.finally(() => { job = null; });
  });
  ipcMain.handle("flash:cancel", () => job?.abort.abort(new Error("Cancelled.")));

  ipcMain.handle("cache:clear", async () => {
    if (job) throw new Error("Wait until the drive is written.");
    await clearCache(cacheDir());
  });

  ipcMain.handle("app:open-external", (_event, url: string) => {
    if (isWebUrl(url)) return shell.openExternal(url);
  });
  ipcMain.handle("app:info", async () => ({
    version: app.getVersion(),
    repo: REPO_URL,
    platform: process.platform,
    cacheSize: await cacheSize(cacheDir()),
  }));
}

/**
 * The size and name the person saw when choosing: confirmSameDrive compares
 * them with the drive as it is right before erasing.
 */
function pickChosen(request: FlashRequest, now: { size: number; name: string; serial?: string }) {
  const size = Number(request.drive?.size);
  const name = String(request.drive?.name ?? "");
  const serial = typeof request.drive?.serial === "string" ? request.drive.serial : now.serial;
  return { size: Number.isFinite(size) ? size : now.size, name: name || now.name, ...(serial ? { serial } : {}) };
}

app.whenReady().then(() => {
  setAppVersion(app.getVersion());
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quitting during a write asks first, then cancels it and waits until the
// drive is closed and given back, so nothing is left running in the background.
let quitting = false;
let stopConfirmed = false;

function confirmStop(): boolean {
  const options = {
    type: "warning" as const,
    buttons: ["Keep writing", "Stop and quit"],
    defaultId: 0,
    cancelId: 0,
    message: "A drive is being written.",
    detail: "If you quit now, the drive won't start until it is written again.",
  };
  return (win ? dialog.showMessageBoxSync(win, options) : dialog.showMessageBoxSync(options)) === 1;
}

app.on("before-quit", event => {
  if (!job || quitting) return;
  event.preventDefault();
  if (!stopConfirmed && !confirmStop()) return;
  quitting = true;
  const running = job;
  running.abort.abort(new Error("Cancelled."));
  void running.done.catch(() => undefined).finally(() => app.quit());
});

app.on("window-all-closed", () => app.quit());
