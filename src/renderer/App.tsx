// The installer's flow: media, device, drive, then writing. Choices are kept
// for the next time the installer opens.

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Device, Drive, FlashProgress, FlashResult, ImageInfo, MediaKind } from "../shared/types";
import { api, errorMessage } from "./api";
import { TopBar } from "./components/TopBar";
import { AboutDialog } from "./screens/AboutDialog";
import { ConfirmDialog } from "./screens/ConfirmDialog";
import { DeviceScreen, type CatalogState } from "./screens/DeviceScreen";
import { DoneScreen } from "./screens/DoneScreen";
import { DriveScreen, tooSmall } from "./screens/DriveScreen";
import { MediaScreen, mediaName } from "./screens/MediaScreen";
import { WriteScreen } from "./screens/WriteScreen";

type Stage = "media" | "device" | "drive" | "write" | "done";
const STAGE_INDEX: Record<Stage, number> = { media: 0, device: 1, drive: 2, write: 3, done: 4 };

/** A family to start from when none was chosen before. */
const FAMILY_FOR_MEDIA: Record<MediaKind, string> = { usb: "pc", sd: "raspberry-pi", disk: "pc" };

function saved<T extends string>(key: string): T | null {
  try {
    return (localStorage.getItem(key) as T | null) ?? null;
  } catch {
    return null;
  }
}

function save(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Private mode or full storage: the choice is simply not remembered.
  }
}

export function App() {
  const [stage, setStage] = useState<Stage>("media");
  const [media, setMedia] = useState<MediaKind | null>(() => saved<MediaKind>("media"));
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });
  const [familyId, setFamilyId] = useState<string | null>(() => saved("family"));
  const [deviceId, setDeviceId] = useState<string | null>(() => saved("device"));
  const [image, setImage] = useState<ImageInfo | null>(null);
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const [drivesError, setDrivesError] = useState<string | null>(null);
  const [driveId, setDriveId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<FlashProgress | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [result, setResult] = useState<FlashResult | null>(null);
  const [about, setAbout] = useState(false);
  const [mac, setMac] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void api.appInfo().then(info => setMac(info.platform === "darwin"), () => undefined);
  }, []);

  const loadCatalog = useCallback((refresh = false) => {
    setCatalog({ status: "loading" });
    api.catalog(refresh).then(
      c => setCatalog({ status: "ready", catalog: c }),
      err => setCatalog({ status: "error", error: errorMessage(err) }),
    );
  }, []);
  useEffect(() => loadCatalog(), [loadCatalog]);

  const ready = catalog.status === "ready" ? catalog.catalog : null;
  const device: Device | null = useMemo(() => ready?.devices.find(d => d.id === deviceId) ?? null, [ready, deviceId]);
  const family = useMemo(() => {
    if (!ready) return null;
    return ready.families.find(f => f.id === familyId)
      ?? ready.families.find(f => f.id === (media ? FAMILY_FOR_MEDIA[media] : "pc"))
      ?? ready.families[0] ?? null;
  }, [ready, familyId, media]);
  const drive = drives?.find(d => d.id === driveId) ?? null;

  // What the chosen image needs, to grey out drives that are too small.
  useEffect(() => {
    setImage(null);
    if (!device) return;
    let live = true;
    api.imageInfo(device).then(info => { if (live) setImage(info); }, () => undefined);
    return () => { live = false; };
  }, [device]);

  // The drive list follows what is plugged in while it is on screen.
  useEffect(() => {
    if (stage !== "drive") return;
    let live = true;
    const refresh = () => api.drives().then(
      list => {
        if (!live) return;
        setDrives(list);
        setDrivesError(null);
      },
      err => { if (live) setDrivesError(errorMessage(err)); },
    );
    void refresh();
    const timer = setInterval(refresh, 2000);
    return () => { live = false; clearInterval(timer); };
  }, [stage]);

  // A drive that was unplugged is no longer chosen; neither is one too small.
  useEffect(() => {
    if (driveId && drives && (!drive || tooSmall(drive, image))) setDriveId(null);
  }, [drives, driveId, drive, image]);

  useEffect(() => api.onProgress(setProgress), []);

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [stage]);

  const chooseMedia = (kind: MediaKind) => { setMedia(kind); save("media", kind); };
  const chooseFamily = (id: string) => { setFamilyId(id); save("family", id); };
  const chooseDevice = (d: Device) => { setDeviceId(d.id); save("device", d.id); };

  const start = async () => {
    if (!device || !drive) return;
    setConfirming(false);
    setStage("write");
    setProgress(null);
    setWriteError(null);
    setResult(null);
    setWriting(true);
    try {
      const r = await api.flash({ device, drive });
      setResult(r);
      setStage("done");
    } catch (err) {
      setWriteError(errorMessage(err));
    } finally {
      setWriting(false);
    }
  };

  const another = () => {
    setStage("drive");
    setDriveId(null);
    setProgress(null);
    setResult(null);
    setWriteError(null);
  };

  const canNext = stage === "media" ? !!media : stage === "device" ? !!device : stage === "drive" ? !!drive : false;
  const next = () => {
    if (!canNext) return;
    if (stage === "media") setStage("device");
    else if (stage === "device") setStage("drive");
    else if (stage === "drive") setConfirming(true);
  };
  const back = () => {
    if (stage === "device") setStage("media");
    else if (stage === "drive") setStage("device");
    else if (stage === "write") setStage("drive");
  };

  let content;
  switch (stage) {
    case "media":
      content = <MediaScreen media={media} onSelect={chooseMedia} onNext={() => setStage("device")} />;
      break;
    case "device":
      content = (
        <DeviceScreen
          state={catalog}
          family={family?.id ?? null}
          device={device}
          onFamily={chooseFamily}
          onDevice={chooseDevice}
          onNext={() => setStage("drive")}
          onRetry={() => loadCatalog(true)}
        />
      );
      break;
    case "drive":
      content = (
        <DriveScreen
          media={media}
          drives={drives}
          error={drivesError}
          selected={drive}
          image={image}
          onSelect={d => setDriveId(d.id)}
          onNext={() => setConfirming(true)}
        />
      );
      break;
    case "write":
      content = device && drive ? <WriteScreen device={device} drive={drive} progress={progress} error={writeError} /> : null;
      break;
    case "done":
      content = device && drive && result ? <DoneScreen device={device} drive={drive} result={result} onAnother={another} /> : null;
      break;
  }

  const summary = [
    media && <span key="m"><strong>{mediaName(media)}</strong></span>,
    stage !== "media" && device && <span key="d"><strong>{device.name}</strong> · Batocera {device.version}</span>,
    (stage === "drive" || stage === "write" || stage === "done") && drive && <span key="v"><strong>{drive.name}</strong></span>,
  ].filter(Boolean);

  return (
    <div className="app">
      <TopBar step={STAGE_INDEX[stage]} mac={mac} onAbout={() => setAbout(true)} />
      <main className="main" ref={mainRef}>{content}</main>
      <footer className="bottombar">
        <div className="summary">
          {summary.length > 0
            ? summary.map((s, i) => <span key={i}>{i > 0 && <span className="sep">→</span>}{s}</span>)
            : "Choose where Batocera will go."}
        </div>
        <div className="actions">
          {stage === "write" && writing && (
            <button type="button" className="btn btn-ghost" onClick={() => void api.cancel()}>
              <X className="icon" /> Cancel
            </button>
          )}
          {stage === "write" && !writing && writeError && (
            <>
              <button type="button" className="btn btn-ghost" onClick={back}><ArrowLeft className="icon" /> Back</button>
              <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)} disabled={!drive}>Try again</button>
            </>
          )}
          {(stage === "device" || stage === "drive") && (
            <button type="button" className="btn btn-ghost" onClick={back}><ArrowLeft className="icon" /> Back</button>
          )}
          {(stage === "media" || stage === "device" || stage === "drive") && (
            <button type="button" className="btn btn-primary" onClick={next} disabled={!canNext}>
              {stage === "drive" ? "Write" : "Next"} <ArrowRight className="icon" />
            </button>
          )}
        </div>
      </footer>
      {confirming && device && drive && (
        <ConfirmDialog device={device} family={family} drive={drive} image={image} onConfirm={start} onClose={() => setConfirming(false)} />
      )}
      {about && <AboutDialog busy={writing} onClose={() => setAbout(false)} />}
    </div>
  );
}
