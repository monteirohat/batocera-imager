// Icons: Lucide (ISC), the same drawing as batocera.org's set. Lucide has no
// SD card, so one is drawn here on its grid (24 x 24, stroke 2, round caps).

import {
  CircuitBoard, Cpu, Gamepad2, HardDrive, LayoutGrid, Monitor, Usb, type LucideIcon, type LucideProps,
} from "lucide-react";
import type { MediaKind } from "../../shared/types";

export function SdCard(props: LucideProps) {
  const { size = 24, strokeWidth = 2, className, ...rest } = props;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}
    >
      <path d="M7 2h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M9 6v3" />
      <path d="M12 6v3" />
      <path d="M15 7v2" />
    </svg>
  );
}

export const MEDIA_ICON: Record<MediaKind, LucideIcon | typeof SdCard> = {
  usb: Usb,
  sd: SdCard,
  disk: HardDrive,
};

/** Stands for a family (and its models) where there is no photo, or photos are off (see brand.ts). */
export function familyIcon(id: string): LucideIcon {
  switch (id) {
    case "handheld":
    case "anbernic":
    case "ayn":
      return Gamepad2;
    case "pc":
      return Monitor;
    case "raspberry-pi":
    case "hardkernel":
    case "xunlong":
      return CircuitBoard;
    case "others":
      return Cpu;
    default:
      return LayoutGrid;
  }
}
