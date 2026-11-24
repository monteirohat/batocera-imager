// Step 1: what Batocera will be written to.

import { Info } from "lucide-react";
import type { MediaKind } from "../../shared/types";
import { MEDIA_ICON } from "../components/Icons";
import { Sky } from "../components/Sky";
import { onGridKeys } from "../components/gridKeys";

/** `noun` is the name inside a sentence ("Which USB key?"). */
export const MEDIA: { kind: MediaKind; name: string; noun: string; text: string }[] = [
  { kind: "usb", name: "USB key", noun: "USB key", text: "For PCs, laptops and most handhelds." },
  { kind: "sd", name: "SD card", noun: "SD card", text: "For Raspberry Pi, Odroid, Anbernic and most boards." },
  { kind: "disk", name: "External drive", noun: "external drive", text: "An SSD or a hard drive in a USB case." },
];

export function mediaName(kind: MediaKind | null): string {
  return MEDIA.find(m => m.kind === kind)?.name ?? "Drive";
}

export function mediaNoun(kind: MediaKind | null): string {
  return MEDIA.find(m => m.kind === kind)?.noun ?? "drive";
}

interface Props {
  media: MediaKind | null;
  onSelect(kind: MediaKind): void;
  onNext(): void;
}

export function MediaScreen({ media, onSelect, onNext }: Props) {
  return (
    <>
      <div className="wrap">
        <div className="kicker">Free, open-source retro gaming</div>
        <h2 className="step-head"><b>1</b> Where will you install Batocera?</h2>
        <p className="lead">
          Batocera starts from it, and your computer's own disk is never touched. Pick the kind of drive; the next steps
          find the right image for your device.
        </p>
        <div className="media-grid" role="radiogroup" aria-label="Media" onKeyDown={onGridKeys}>
          {MEDIA.map(m => {
            const Icon = MEDIA_ICON[m.kind];
            return (
              <button
                key={m.kind}
                type="button"
                className="tile media-tile"
                role="radio"
                aria-checked={media === m.kind}
                data-nav
                onClick={() => onSelect(m.kind)}
                onDoubleClick={() => { onSelect(m.kind); onNext(); }}
              >
                <span className={`chip-ico c-${m.kind}`}><Icon className="icon" /></span>
                <span>
                  <strong>{m.name}</strong>
                  <small>{m.text}</small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="hint">
          <Info className="icon" />
          Everything on it will be erased. How large it must be depends on the device: the drive step tells you.
        </p>
      </div>
      <Sky />
    </>
  );
}
