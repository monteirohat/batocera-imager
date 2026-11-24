// The list of devices and their images, read from batocera.org/download.
//
// The page has no API: each model is a card whose data-* attributes hold
// everything the installer needs (image URL, MD5 URL, version, families).
// parseDownloadPage reads them; if the page changes shape it throws rather
// than showing a half-empty list. The last good list is kept on disk and shown
// when the site can't be reached.

import { promises as fs } from "node:fs";
import { OFFICIAL_LOGO } from "../shared/brand";
import { DOWNLOAD_PAGE, type Catalog, type Device, type Family } from "../shared/types";
import { getText } from "./http";

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", hellip: "…" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Attributes of one start tag, decoded. A bare attribute (data-old) is "". */
export function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  // Skip the tag name.
  const body = tag.replace(/^<\s*[\w-]+/, "").replace(/\/?>$/, "");
  for (const m of body.matchAll(re)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function absolute(url: string, base: string): string {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

/** batocera.org shows its logo where it has no photo (/assets/img/logo-128.webp). */
function isLogo(url: string): boolean {
  try {
    return /\/logo[\w-]*\.\w+$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function parseDownloadPage(html: string, base = DOWNLOAD_PAGE, allowLogo = OFFICIAL_LOGO): { families: Family[]; devices: Device[] } {
  const families: Family[] = [];
  const nav = /<nav[^>]*class="[^"]*\bdl-fams\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/i.exec(html);
  if (nav) {
    for (const m of nav[1].matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
      const attrs = parseAttributes(m[1]);
      const id = attrs["data-f"];
      if (!id) continue;
      const name = /<strong[^>]*>([\s\S]*?)<\/strong>/i.exec(m[2]);
      const img = /<img\b[^>]*>/i.exec(m[2]);
      const photo = img ? absolute(parseAttributes(img[0]).src ?? "", base) : "";
      families.push({
        id,
        name: name ? stripTags(name[1]) : id,
        title: attrs["data-title"] || id,
        photoUrl: photo && (allowLogo || !isLogo(photo)) ? photo : "",
      });
    }
  }

  const devices: Device[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/(<a\b[^>]*class="[^"]*\bdl-dev\b[^"]*"[^>]*>)([\s\S]*?)<\/a>/gi)) {
    const a = parseAttributes(m[1]);
    const body = m[2];
    const id = a["data-id"];
    const imageUrl = absolute(a["href"] ?? "", base);
    if (!id || seen.has(id) || !/\.img\.gz$/i.test(new URL(imageUrl || "x:/").pathname)) continue;
    seen.add(id);

    const meta = /<span class="dl-meta">\s*(?:<span class="dl-(curver|oldver)">([^<]*)<\/span>|([^<]*))/i.exec(body);
    const note = meta ? decodeEntities((meta[2] ?? meta[3] ?? "").trim()) : "";
    const noteKind = meta?.[1] === "curver" ? "current" : meta?.[1] === "oldver" ? "old" : "plain";
    const photo = absolute(a["data-img"] ?? "", base);
    const noPhoto = /class="dl-pic[^"]*\bis-nopic\b/i.test(body) || (isLogo(photo) && !allowLogo);

    devices.push({
      id,
      name: a["data-name"] || id,
      vendor: a["data-vendor"] || "",
      groups: (a["data-gs"] || "").split(/\s+/).filter(Boolean),
      version: a["data-ver"] || "",
      date: a["data-date"] || "",
      note,
      noteKind,
      old: "data-old" in a,
      labeled: "data-labeled" in a,
      imageUrl,
      md5Url: absolute(a["data-md5"] ?? "", base),
      photoUrl: noPhoto ? "" : photo,
      docUrl: absolute(a["data-doc"] ?? "", base),
      search: (a["data-search"] || `${a["data-vendor"] ?? ""} ${a["data-name"] ?? ""}`).toLowerCase(),
    });
  }

  if (devices.length === 0) {
    throw new Error("batocera.org/download no longer lists devices in a way this version understands. Look for an update of the installer.");
  }
  // A family without any model would show an empty grid.
  const used = families.filter(f => devices.some(d => d.groups.includes(f.id)));
  // A family without its own picture (the site shows its logo there) takes the
  // photo of one of its models: one that belongs to as few other tiles as
  // possible (a handheld that is not an Anbernic for "Handhelds") and that no
  // other tile shows yet.
  const ids = new Set(used.map(f => f.id));
  const tiles = (d: Device) => d.groups.filter(g => ids.has(g)).length;
  const taken = new Set(used.map(f => f.photoUrl).filter(Boolean));
  for (const f of used) {
    if (f.photoUrl) continue;
    const mine = devices.filter(d => d.groups.includes(f.id) && d.photoUrl).sort((a, b) => tiles(a) - tiles(b));
    f.photoUrl = (mine.find(d => !taken.has(d.photoUrl)) ?? mine[0])?.photoUrl ?? "";
    if (f.photoUrl) taken.add(f.photoUrl);
  }
  return { families: used, devices };
}

/** Reads the page, or the saved copy when the site can't be reached. */
export async function loadCatalog(cacheFile: string, signal?: AbortSignal): Promise<Catalog> {
  try {
    const html = await getText(DOWNLOAD_PAGE, signal);
    const parsed = parseDownloadPage(html);
    const catalog: Catalog = { ...parsed, fetchedAt: new Date().toISOString(), offline: false };
    await fs.writeFile(cacheFile, JSON.stringify(catalog)).catch(() => undefined);
    return catalog;
  } catch (err) {
    const saved = await fs.readFile(cacheFile, "utf8").catch(() => null);
    if (saved) {
      try {
        const catalog = JSON.parse(saved) as Catalog;
        if (Array.isArray(catalog.devices) && catalog.devices.length > 0) return { ...catalog, offline: true };
      } catch {
        // A damaged copy: report the original error.
      }
    }
    throw err;
  }
}
