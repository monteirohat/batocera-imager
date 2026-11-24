// A modal dialog: a dimmed, blurred window behind, Escape or the X closes it,
// the focus stays inside while it is open.

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  label: string;
  onClose(): void;
  children: ReactNode;
}

export function Dialog({ label, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>("button");
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      } else if (e.key === "Tab" && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input")];
        if (items.length === 0) return;
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
        e.preventDefault();
        items[next].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <button type="button" className="dialog-x" onClick={onClose} aria-label="Close">
          <X className="icon" />
        </button>
        {children}
      </div>
    </div>
  );
}
