// Step 2: the device Batocera will run on, as on batocera.org/download: a
// family, then a model. The model decides which image is written.

import { CloudOff, Info, LoaderCircle, RotateCcw, Search, Star } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { DEVICE_PHOTOS } from "../../shared/brand";
import { DOWNLOAD_PAGE, type Catalog, type Device, type Family } from "../../shared/types";
import { api } from "../api";
import { familyIcon } from "../components/Icons";
import { onGridKeys } from "../components/gridKeys";

export type CatalogState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; catalog: Catalog };

interface Props {
  state: CatalogState;
  family: string | null;
  device: Device | null;
  onFamily(id: string): void;
  onDevice(device: Device): void;
  onNext(): void;
  onRetry(): void;
}

/** A photo from batocera.org on the light picture box, or the family's icon (no photo, photos off, or it failed to load). */
export function Picture({ url, family, className }: { url: string; family: string; className: string }) {
  const [failed, setFailed] = useState("");
  const Icon = familyIcon(family);
  const show = DEVICE_PHOTOS && url && failed !== url;
  let content: ReactNode = <Icon className="icon" />;
  if (show) content = <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(url)} />;
  return <span className={className}>{content}</span>;
}

export function DevicePicture({ device, family, className }: { device: Device; family: string; className: string }) {
  return <Picture url={device.photoUrl} family={family} className={className} />;
}

export function DeviceScreen({ state, family, device, onFamily, onDevice, onNext, onRetry }: Props) {
  if (state.status === "loading") {
    return (
      <div className="wrap">
        <h2 className="step-head"><b>1</b> What will you play on?</h2>
        <div className="loading"><LoaderCircle className="icon" /> Reading the list of devices from batocera.org…</div>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="wrap">
        <h2 className="step-head"><b>1</b> What will you play on?</h2>
        <div className="notice err" role="alert">
          <CloudOff className="icon" />
          <div>
            <strong>The list of devices could not be read.</strong>
            <p>{state.error}</p>
            <button type="button" className="btn" onClick={onRetry}><RotateCcw className="icon" /> Try again</button>
          </div>
        </div>
      </div>
    );
  }
  return <Picker catalog={state.catalog} family={family} device={device} onFamily={onFamily} onDevice={onDevice} onNext={onNext} />;
}

function Picker({ catalog, family, device, onFamily, onDevice, onNext }: Omit<Props, "state" | "onRetry"> & { catalog: Catalog }) {
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("");
  const current: Family = catalog.families.find(f => f.id === family) ?? catalog.families[0];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of catalog.devices) for (const g of d.groups) c[g] = (c[g] ?? 0) + 1;
    return c;
  }, [catalog]);

  const inFamily = useMemo(() => catalog.devices.filter(d => d.groups.includes(current?.id ?? "")), [catalog, current]);

  // The family's makers, those with most models first; at most eight.
  const makers = useMemo(() => {
    const c = new Map<string, number>();
    for (const d of inFamily) c.set(d.vendor, (c.get(d.vendor) ?? 0) + 1);
    const list = [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return list.length < 2 ? [] : list.slice(0, 8);
  }, [inFamily]);

  const q = query.trim().toLowerCase();
  const shown = inFamily.filter(d => (!maker || d.vendor === maker) && (!q || d.search.includes(q)));

  const pickFamily = (id: string) => {
    setQuery("");
    setMaker("");
    onFamily(id);
  };

  return (
    <div className="wrap">
      <h2 className="step-head"><b>1</b> What will you play on?</h2>
      {catalog.offline && (
        <div className="notice" style={{ marginBottom: "1rem" }}>
          <CloudOff className="icon" />
          <div>
            <strong>batocera.org can't be reached right now.</strong>
            <p>This is the list saved on {new Date(catalog.fetchedAt).toLocaleDateString()}. A newer image may exist.</p>
          </div>
        </div>
      )}
      <div className="fam-grid" role="radiogroup" aria-label="Device family" onKeyDown={onGridKeys}>
        {catalog.families.map(f => {
          return (
            <button
              key={f.id}
              type="button"
              className="tile fam-tile"
              role="radio"
              aria-checked={f.id === current?.id}
              aria-pressed={f.id === current?.id}
              data-nav
              onClick={() => pickFamily(f.id)}
            >
              <Picture url={f.photoUrl} family={f.id} className="fam-pic" />
              <span className="fam-name"><strong>{f.name}</strong><em>{counts[f.id] ?? 0}</em></span>
            </button>
          );
        })}
      </div>
      <p className="hint">
        <Info className="icon" />
        Not sure? Any computer from the last 15 years runs the{" "}
        <a onClick={() => pickFamily("pc")} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter") pickFamily("pc"); }}>PC image</a>.
      </p>

      <h3 className="sub-head">
        <span>Choose your model in <em>{current?.title}</em></span>
        <i>{shown.length} {shown.length === 1 ? "model" : "models"}</i>
      </h3>

      {inFamily.length > 4 && (
        <div className="tools">
          <label className="search">
            <Search className="icon" />
            <span className="sr-only">Search a device</span>
            <input
              type="search"
              placeholder="Search in this family…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") setQuery(""); }}
            />
          </label>
          {makers.length > 0 && (
            <div className="chips" aria-label="Makers">
              <button type="button" aria-pressed={maker === ""} onClick={() => setMaker("")}>All</button>
              {makers.map(([name, n]) => (
                <button key={name} type="button" aria-pressed={maker === name} onClick={() => setMaker(name)}>
                  {name} <em>{n}</em>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="empty"><Search className="icon" /><strong>No model matches.</strong>Try another word, or look in another family.</div>
      ) : (
        <div className="model-grid" role="radiogroup" aria-label="Model" onKeyDown={onGridKeys}>
          {shown.map(d => (
            <button
              key={d.id}
              type="button"
              className="tile model-card"
              role="radio"
              aria-checked={device?.id === d.id}
              aria-pressed={device?.id === d.id}
              data-nav
              onClick={() => onDevice(d)}
              onDoubleClick={() => { onDevice(d); onNext(); }}
            >
              <DevicePicture device={d} family={current.id} className="pic" />
              <span className="info">
                <small>
                  {d.vendor}
                  {d.labeled && <span className="lab" title="Tested and approved by the Batocera team"><Star className="icon" /> Labeled</span>}
                </small>
                <strong>{d.name}</strong>
                <span className={`meta ${d.noteKind}`}>{d.note || `Batocera ${d.version}`}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="hint">
        <Info className="icon" />
        Images and the list of devices come from <a onClick={() => void api.openExternal(DOWNLOAD_PAGE)}>batocera.org/download</a>.
      </p>
    </div>
  );
}
