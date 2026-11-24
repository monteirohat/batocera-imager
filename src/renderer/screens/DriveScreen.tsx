// Step 2: the drive to erase. Only external and removable drives are listed
// (the main process never returns the computer's own disks), and the list
// follows what is plugged in. Each shows its kind; those too small for the
// image are greyed out, after the others.

import { Info, LoaderCircle, Plug } from "lucide-react";
import type { Drive, ImageInfo } from "../../shared/types";
import { MEDIA_ICON } from "../components/Icons";
import { onGridKeys } from "../components/gridKeys";
import { formatSize } from "../format";

interface Props {
  drives: Drive[] | null;
  error: string | null;
  selected: Drive | null;
  image: ImageInfo | null;
  /** The image's size could not be read yet: drives can't be checked against it here. */
  imageUnknown?: boolean;
  onSelect(drive: Drive): void;
  onNext(): void;
}

/** Why a drive can't take the image, or null. */
export function tooSmall(drive: Drive, image: ImageInfo | null): string | null {
  if (image && drive.size < image.size) return `Too small: this image needs ${formatSize(image.size)}${image.exact ? "" : " or more"}.`;
  return null;
}

function DriveRow({ drive, selected, image, onSelect, onNext }: { drive: Drive } & Omit<Props, "drives" | "error" | "imageUnknown">) {
  const Icon = MEDIA_ICON[drive.kind];
  const problem = tooSmall(drive, image);
  const where = drive.mountpoints.length ? drive.mountpoints.join(", ") : "Not mounted";
  return (
    <button
      type="button"
      className="tile drive-row"
      role="radio"
      aria-checked={selected?.id === drive.id}
      aria-pressed={selected?.id === drive.id}
      disabled={!!problem}
      data-nav
      onClick={() => onSelect(drive)}
      onDoubleClick={() => { onSelect(drive); onNext(); }}
    >
      <span className={`chip-ico sm c-${drive.kind}`}><Icon className="icon" /></span>
      <span className="drive-main">
        <strong>{drive.name}</strong>
        {problem ? <small className="warn">{problem}</small> : <small>{where} · <span className="mono">{drive.path}</span></small>}
      </span>
      <span className="drive-size">{formatSize(drive.size)}</span>
    </button>
  );
}

export function DriveScreen(props: Props) {
  const { drives, error, image } = props;
  // Drives that can take the image first.
  const sorted = [...(drives ?? [])].sort((a, b) => Number(!!tooSmall(a, image)) - Number(!!tooSmall(b, image)));

  return (
    <div className="wrap">
      <h2 className="step-head"><b>2</b> Which drive?</h2>
      <p className="lead">Everything on the drive you choose will be erased. Unplug the drives you want to keep safe.</p>
      {props.imageUnknown && (
        <p className="hint" style={{ marginTop: "-.5rem", marginBottom: "1rem" }}>
          <Info className="icon" />
          The image's size could not be checked yet (no answer from the server). It is checked after the download, before
          anything is erased.
        </p>
      )}

      {error && (
        <div className="notice err" role="alert" style={{ marginBottom: "1rem", maxWidth: 820 }}>
          <Plug className="icon" />
          <div><strong>The drives could not be listed.</strong><p>{error}</p></div>
        </div>
      )}

      {drives === null && !error ? (
        <div className="loading"><LoaderCircle className="icon" /> Looking for drives…</div>
      ) : sorted.length === 0 ? (
        <div className="empty">
          <Plug className="icon" />
          <strong>Plug in a USB key or an SD card{image ? ` of ${formatSize(image.size)} or more` : ""}.</strong>
          It shows up here as soon as it is connected.
        </div>
      ) : (
        <div className="drive-list" role="radiogroup" aria-label="Drives" onKeyDown={onGridKeys}>
          {sorted.map(d => <DriveRow key={d.id} drive={d} {...props} />)}
        </div>
      )}
    </div>
  );
}
