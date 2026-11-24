// The last word before erasing: the device, its image, the drive, and a clear
// warning. The primary button carries the Batocera version it writes.

import { Star, TriangleAlert } from "lucide-react";
import type { Device, Drive, Family, ImageInfo } from "../../shared/types";
import { Dialog } from "../components/Dialog";
import { MEDIA_ICON } from "../components/Icons";
import { formatSize } from "../format";
import { DevicePicture } from "./DeviceScreen";

interface Props {
  device: Device;
  family: Family | null;
  drive: Drive;
  image: ImageInfo | null;
  onConfirm(): void;
  onClose(): void;
}

export function ConfirmDialog({ device, family, drive, image, onConfirm, onClose }: Props) {
  const Icon = MEDIA_ICON[drive.kind];
  return (
    <Dialog label="Write Batocera" onClose={onClose}>
      <div className="dialog-top">
        <DevicePicture device={device} family={family?.id ?? ""} className="dialog-pic" />
        <div className="dialog-id">
          <small>
            {device.vendor}
            {device.labeled && <span className="lab"><Star className="icon" /> Labeled</span>}
          </small>
          <h2>{device.name}</h2>
          <p className="meta-line">
            <span className={device.old ? "meta old" : "meta current"}>Batocera {device.version}</span>
            {device.date && <span>{device.date}</span>}
            {image && <span>{formatSize(image.compressedSize)} to download</span>}
          </p>
          <div className="drive-line">
            <span className={`chip-ico sm c-${drive.kind}`}><Icon className="icon" /></span>
            <span>
              <strong>{drive.name}</strong>
              <small>{formatSize(drive.size)} · <span className="mono">{drive.path}</span></small>
            </span>
          </div>
        </div>
      </div>
      <div className="dialog-band">
        <div className="notice err" role="alert">
          <TriangleAlert className="icon" />
          <div>
            <strong>Everything on {drive.name} will be erased.</strong>
            <p>
              {drive.mountpoints.length > 0 ? `That includes ${drive.mountpoints.join(", ")}. ` : ""}
              This can't be undone.
            </p>
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} data-autofocus>Back</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Erase and write <span className="val">{device.version}</span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
