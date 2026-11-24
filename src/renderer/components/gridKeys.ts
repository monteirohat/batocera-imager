// Arrow keys move the focus in a grid of choices, by position on screen, so
// it works whatever the number of columns.

import type { KeyboardEvent } from "react";

export function onGridKeys(e: KeyboardEvent<HTMLElement>): void {
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!dir) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-nav]:not(:disabled)")];
  const current = document.activeElement as HTMLElement;
  const i = items.indexOf(current);
  if (i < 0) return;
  e.preventDefault();
  if (dir[1] === 0) {
    items[Math.max(0, Math.min(items.length - 1, i + dir[0]))]?.focus();
    return;
  }
  const from = current.getBoundingClientRect();
  const x = from.left + from.width / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const item of items) {
    const r = item.getBoundingClientRect();
    const dy = dir[1] > 0 ? r.top - from.bottom : from.top - r.bottom;
    if (dy < -1) continue;
    const score = dy * 4 + Math.abs(r.left + r.width / 2 - x);
    if (item !== current && score < bestScore) {
      best = item;
      bestScore = score;
    }
  }
  best?.focus();
  best?.scrollIntoView({ block: "nearest" });
}
