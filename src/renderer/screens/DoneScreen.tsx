// The end: what to do with the drive now.

import { BookOpen, RotateCcw } from "lucide-react";
import type { Device, Drive, FlashResult } from "../../shared/types";
import { api } from "../api";
import { Sky } from "../components/Sky";
import { mediaNoun } from "../media";

const GUIDE = "https://wiki.batocera.org/";

interface Props {
  device: Device;
  drive: Drive;
  result: FlashResult;
  onAnother(): void;
}

export function DoneScreen({ device, drive, result, onAnother }: Props) {
  const what = mediaNoun(drive.kind);
  return (
    <>
      <div className="wrap done-view">
        <div className="kicker">Written and verified</div>
        <h1>Batocera {device.version} is ready.<br /><span className="chrome">Time to play.</span></h1>
        <p className="lead">
          {drive.name} holds Batocera for {device.name}.{" "}
          {result.ejected ? `It was ejected: you can remove it.` : `Eject it from your system before you remove it.`}
        </p>
        <ol className="how">
          <li><b>Plug it into your device</b>Put the {what} in {device.name}. Your computer is never modified: remove the {what} to get it back.</li>
          <li><b>Boot from it</b>Turn the device on. A PC may need its boot menu (often F12, F11 or Esc) to start from the {what}.</li>
          <li><b>Add your games</b>Through the network, or on the {what} itself. The installation guide shows how.</li>
        </ol>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onAnother} data-autofocus>
            <RotateCcw className="icon" /> Write another
          </button>
          <button type="button" className="btn" onClick={() => void api.openExternal(GUIDE)}>
            <BookOpen className="icon" /> Installation guide
          </button>
        </div>
      </div>
      <Sky />
    </>
  );
}
