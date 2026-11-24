// The bar at the top: the product name, where the person is in the three
// steps, and the About button. While the project is unofficial there is no
// logo here (see src/shared/brand.ts).

import { Check, Info } from "lucide-react";

export const STEPS = ["Device", "Drive", "Write"] as const;

interface Props {
  /** 0-2, or 3 when everything is done. */
  step: number;
  mac: boolean;
  onAbout(): void;
}

export function TopBar({ step, mac, onAbout }: Props) {
  return (
    <header className={`topbar${mac ? " is-mac" : ""}`}>
      <div className="brand-name">
        Batocera <span>Imager</span>
      </div>
      <ol className="stepper" aria-label="Steps">
        {STEPS.map((label, i) => {
          const state = i < step ? "is-done" : i === step ? "is-current" : "";
          return (
            <li key={label} className={state} aria-current={i === step ? "step" : undefined}>
              <b>{i < step ? <Check className="icon" strokeWidth={3} /> : i + 1}</b>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
      <div className="capsule">
        <button type="button" className="icon-btn" onClick={onAbout} title="About" aria-label="About">
          <Info className="icon" />
        </button>
      </div>
    </header>
  );
}
