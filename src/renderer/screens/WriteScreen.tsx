// Step 4: download, check, write, verify, with one bar and the phases below
// it. The only action while it runs is Cancel.

import { Check, CircleX } from "lucide-react";
import type { Device, Drive, FlashProgress, Phase } from "../../shared/types";
import { MEDIA_ICON } from "../components/Icons";
import { formatDuration, formatSize, formatSpeed } from "../format";

const PHASES: { id: Phase[]; label: string }[] = [
  { id: ["download", "check"], label: "Download" },
  { id: ["access"], label: "Permission" },
  { id: ["write"], label: "Write" },
  { id: ["verify", "finish"], label: "Verify" },
];

const KICKER: Record<Phase, string> = {
  download: "Downloading",
  check: "Checking the download",
  access: "Waiting for permission",
  write: "Writing",
  verify: "Verifying",
  finish: "Finishing",
};

const NOTE: Record<Phase, string> = {
  download: "The image is kept for next time, and a download that stops resumes where it was.",
  check: "Comparing the download with the MD5 published by Batocera, before the drive is touched.",
  access: "Your system may ask for your password: it is needed to write to the drive.",
  write: "Don't unplug the drive.",
  verify: "Reading the drive back to make sure it holds exactly the image. Don't unplug it.",
  finish: "Ejecting the drive.",
};

interface Props {
  device: Device;
  drive: Drive;
  progress: FlashProgress | null;
  error: string | null;
}

export function WriteScreen({ device, drive, progress, error }: Props) {
  const phase: Phase = progress?.phase ?? "download";
  const index = PHASES.findIndex(p => p.id.includes(phase));
  const fraction = progress?.fraction ?? null;
  const pct = fraction === null ? null : Math.floor(fraction * 100);
  const Icon = MEDIA_ICON[drive.kind];
  const remaining = progress && progress.speed > 0 && progress.total > 0 ? (progress.total - progress.done) / progress.speed : 0;

  return (
    <div className="wrap write-view">
      <h2 className="step-head"><b>4</b> {error ? "It did not work" : `Writing Batocera ${device.version}`}</h2>
      <div className="write-device">
        <span className={`chip-ico sm c-${drive.kind}`}><Icon className="icon" /></span>
        <span>
          <strong>{device.name} <span className="muted">on</span> {drive.name}</strong>
          <small>{formatSize(drive.size)} · <span className="mono">{drive.path}</span></small>
        </span>
      </div>

      {error ? (
        <div className="notice err" role="alert">
          <CircleX className="icon" />
          <div>
            <strong>{error}</strong>
            <p>{index >= 2 ? "The drive was partly written: it won't start until it is written again." : "Nothing was written to the drive."}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="kicker">{KICKER[phase]}</div>
          <div className="figure" aria-live="polite">
            <span className="pct">{pct === null ? "…" : <>{pct}<small>%</small></>}</span>
            <span className="rate">
              {progress && progress.total > 0 && (phase === "download" || phase === "write" || phase === "verify" || phase === "check") && (
                <>
                  {formatSpeed(progress.speed)}
                  {remaining > 0 && <><br />{formatDuration(remaining)} left</>}
                </>
              )}
            </span>
          </div>
          <div className={`progress${pct === null ? " is-indeterminate" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
            <span style={{ width: `${pct ?? 0}%` }} />
          </div>
          <p className="write-note">{NOTE[phase]}</p>
        </>
      )}

      <ol className="phases">
        {PHASES.map((p, i) => {
          const done = i < index || (i === 0 && !!progress?.cached && index > 0);
          const state = error ? (i < index ? "is-done" : "") : done ? "is-done" : i === index ? "is-current" : "";
          return (
            <li key={p.label} className={state}>
              <b>{i < index ? <Check className="icon" strokeWidth={3} /> : i + 1}</b>
              {p.label}
              {i === 0 && progress?.cached && index > 0 ? <span className="muted"> · saved</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
