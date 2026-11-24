// Runs in an isolated, sandboxed context and exposes a small typed API to the
// interface as window.imager. The interface has no direct access to Node.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { FlashProgress, ImagerApi } from "../shared/types";

const api: ImagerApi = {
  catalog: refresh => ipcRenderer.invoke("catalog", refresh),
  imageInfo: device => ipcRenderer.invoke("image:info", device),
  drives: () => ipcRenderer.invoke("drives"),
  flash: request => ipcRenderer.invoke("flash", request),
  cancel: () => ipcRenderer.invoke("flash:cancel"),
  onProgress: callback => {
    const listener = (_event: IpcRendererEvent, progress: FlashProgress) => callback(progress);
    ipcRenderer.on("flash:progress", listener);
    return () => { ipcRenderer.removeListener("flash:progress", listener); };
  },
  clearCache: () => ipcRenderer.invoke("cache:clear"),
  openExternal: url => ipcRenderer.invoke("app:open-external", url),
  openPrivacySettings: () => ipcRenderer.invoke("app:privacy-settings"),
  appInfo: () => ipcRenderer.invoke("app:info"),
};

contextBridge.exposeInMainWorld("imager", api);
