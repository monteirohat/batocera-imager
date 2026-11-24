// About: what this is (and that it is unofficial), where it comes from, and
// the images kept for next time.

import { ExternalLink, Github, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { UNOFFICIAL_NOTE } from "../../shared/brand";
import type { AppInfo } from "../../shared/types";
import { api, errorMessage } from "../api";
import { Dialog } from "../components/Dialog";
import { formatSize } from "../format";

export function AboutDialog({ busy, onClose }: { busy: boolean; onClose(): void }) {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void api.appInfo().then(setInfo, () => undefined);
  }, []);

  const clear = async () => {
    try {
      await api.clearCache();
      setInfo(await api.appInfo());
      setMessage("The downloaded images were deleted.");
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <Dialog label="About" onClose={onClose}>
      <div className="dialog-body">
        <div className="kicker">About</div>
        <h2>Batocera Imager {info ? <span className="muted mono" style={{ fontSize: ".9rem" }}>{info.version}</span> : null}</h2>
        <p>{UNOFFICIAL_NOTE} Batocera and its images come from batocera.org; this program finds the right image for your device and writes it.</p>
        <ul className="about-list">
          <li>
            <span>Downloaded images, kept for next time</span>
            <button type="button" className="btn btn-ghost" onClick={clear} disabled={busy || !info || info.cacheSize === 0}>
              <Trash2 className="icon" /> {info ? (info.cacheSize ? `Delete ${formatSize(info.cacheSize)}` : "None") : "…"}
            </button>
          </li>
          <li>
            <span>Batocera</span>
            <button type="button" className="btn btn-ghost" onClick={() => void api.openExternal("https://batocera.org")}>
              <ExternalLink className="icon" /> batocera.org
            </button>
          </li>
          <li>
            <span>Source code (MIT)</span>
            <button type="button" className="btn btn-ghost" onClick={() => info && void api.openExternal(info.repo)}>
              <Github className="icon" /> GitHub
            </button>
          </li>
        </ul>
        {message && <p style={{ marginTop: "1rem" }}>{message}</p>}
      </div>
    </Dialog>
  );
}
