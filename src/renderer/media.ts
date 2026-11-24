// How the interface names each kind of drive inside a sentence.

import type { MediaKind } from "../shared/types";

const NOUNS: Record<MediaKind, string> = { usb: "USB key", sd: "SD card", disk: "external drive" };

export function mediaNoun(kind: MediaKind): string {
  return NOUNS[kind] ?? "drive";
}
