// Sizes, speeds and durations as the interface writes them.

/** Decimal units, like drive makers and macOS: a "32 GB" key shows 31.9 GB. */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }
  return `${i === 0 ? n : n >= 100 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

/** Below 1 KB/s a speed means nothing to show (a stall, or the start of a phase). */
export function formatSpeed(bytesPerSecond: number): string {
  return bytesPerSecond >= 1000 ? `${formatSize(bytesPerSecond)}/s` : "";
}

/** Empty when it can't be trusted: unknown, or more than two days. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 48 * 3600) return "";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
