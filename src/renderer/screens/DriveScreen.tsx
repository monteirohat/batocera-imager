// Step 3: the drive to erase. Only external and removable drives are listed
// (the main process never returns the computer's own disks), and the list
// follows what is plugged in. Drives of the kind chosen in step 1 come first.

import { LoaderCircle, Plug } from "lucide-react";
import type { Drive, ImageInfo, MediaKind } from "../../shared/types";
import { MEDIA_ICON } from "../components/Icons";
import { onGridKeys } from "../components/gridKeys";
import { formatSize } from "../format";
import { mediaNoun } from "./MediaScreen";

interface Props {
  media: MediaKind | null;
  drives: Drive[] | null;
  error: string | null;
  selected: Drive | null;
  image: ImageInfo | null;
  onSelect(drive: Drive): void;
  onNext(): void;
}

/** Why a drive can't take the image, or null. */
export function tooSmall(drive: Drive, image: ImageInfo | null): string | null {
  if (image && drive.size < image.minSize) return `Too small: this image needs ${formatSize(image.minSize)} or more.`;
  return null;
}

function DriveRow({ drive, selected, image, onSelect, onNext }: { drive: Drive } & Omit<Props, "media" | "drives" | "error">) {
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
  const { media, drives, error } = props;
  const name = mediaNoun(media);
  const matching = (drives ?? []).filter(d => d.kind === media);
  const others = (drives ?? []).filter(d => d.kind !== media);

  return (
    <div className="wrap">
      <h2 className="step-head"><b>3</b> Which {name}?</h2>
      <p className="lead">Everything on the drive you choose will be erased. Unplug the drives you want to keep safe.</p>

      {error && (
        <div className="notice err" role="alert" style={{ marginBottom: "1rem", maxWidth: 820 }}>
          <Plug className="icon" />
          <div><strong>The drives could not be listed.</strong><p>{error}</p></div>
        </div>
      )}

      {drives === null && !error ? (
        <div className="loading"><LoaderCircle className="icon" /> Looking for drives…</div>
      ) : drives && drives.length === 0 ? (
        <div className="empty">
          <Plug className="icon" />
          <strong>Plug in {name === "external drive" ? "an" : "a"} {name} of 8 GB or more.</strong>
          It shows up here as soon as it is connected.
        </div>
      ) : (
        <div onKeyDown={onGridKeys}>
          {matching.length > 0 && (
            <div className="drive-list" role="radiogroup" aria-label="Drives">
              {matching.map(d => <DriveRow key={d.id} drive={d} {...props} />)}
            </div>
          )}
          {others.length > 0 && (
            <>
              {matching.length > 0 && <div className="list-label">Other drives</div>}
              <div className="drive-list" role="radiogroup" aria-label="Other drives">
                {others.map(d => <DriveRow key={d.id} drive={d} {...props} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
