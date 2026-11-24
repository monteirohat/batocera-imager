// The API exposed by the preload script (see src/preload/preload.ts). Opened
// in a plain browser (npm run dev:web), the interface runs on demo data
// instead, which is also how its screenshots are taken.

import type { ImagerApi } from "../shared/types";
import { demoApi } from "./demo";

declare global {
  interface Window {
    imager?: ImagerApi;
  }
}

export const isDemo = !window.imager;
export const api: ImagerApi = window.imager ?? demoApi;

/** Electron prefixes errors from the main process; keep only the message. */
export function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}
