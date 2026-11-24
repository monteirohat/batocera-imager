// The download page is read through its card attributes. The page below is
// written by hand with the same shape as batocera.org/download.

import { describe, expect, it } from "vitest";
import { decodeEntities, parseAttributes, parseDownloadPage } from "../src/main/catalog";

const PAGE = `
<h2 class="dl-step"><b>1</b> What will you play on?</h2>
<nav class="dl-fams" aria-label="Device family">
  <a href="?group=handheld" data-f="handheld" data-title="Handheld consoles">
    <span class="dl-fam-pic"><img src="/x.webp" alt=""></span>
    <span><strong>Handhelds</strong><em>2</em></span>
  </a>
  <a href="?group=pc" data-f="pc" data-title="PC and laptops" aria-current="true">
    <span><strong>PC</strong><em>1</em></span>
  </a>
  <a href="?group=raspberry-pi" data-f="raspberry-pi" data-title="Raspberry Pi boards">
    <span><strong>Raspberry Pi</strong><em>1</em></span>
  </a>
  <a href="?group=empty" data-f="empty" data-title="Nothing here"><span><strong>Empty</strong><em>0</em></span></a>
</nav>
<div class="dl-list">
  <a class="dl-dev" href="https://updates.example.org/x86-64-v3/stable/last/batocera-x86-64-v3-44-20261116.img.gz" data-id="pc-recent" data-gs="popular pc"
     data-vendor="PC" data-search="pc recent pc" data-name="Recent PC or laptop (Intel Haswell+, AMD Zen)" data-img="/assets/img/boards/medium/pc.webp"
     data-ver="44" data-date="November 16, 2026" data-torrent="/torrents/x.torrent" data-md5="https://mirror.example.org/x.img.gz.md5" data-doc="">
    <span class="dl-pic"><img src="/assets/img/boards/medium/pc.webp" alt=""></span>
    <span class="dl-info"><small>PC</small><strong>Recent PC</strong><span class="dl-meta">Faster on recent PCs (2013+)</span></span>
  </a>
  <a class="dl-dev" href="https://updates.example.org/bcm2711/stable/last/batocera-bcm2711-44-20261116.img.gz" data-id="raspberry-pi-pi-4-model-b" data-gs="raspberry-pi"
     data-vendor="Raspberry Pi" data-search="raspberry pi pi 4 model b" data-name="Pi 4 Model B" data-img="/assets/img/boards/medium/pi4.webp"
     data-ver="44" data-date="November 16, 2026" data-torrent="" data-md5="https://mirror.example.org/pi4.img.gz.md5" data-doc="" data-labeled hidden>
    <span class="dl-pic"><img src="/assets/img/boards/medium/pi4.webp" alt=""></span>
    <span class="dl-info"><small>Raspberry Pi<span class="dl-lab">Labeled</span></small><strong>Pi 4 Model B</strong><span class="dl-meta"><span class="dl-curver">Batocera 44</span></span></span>
  </a>
  <a class="dl-dev" href="https://updates.example.org/ace/stable/last/batocera-rk3588-ace-42-20251015.img.gz" data-id="ace" data-gs="handheld"
     data-vendor="GameForce" data-search="gameforce ace" data-name="Ace &amp; Friends&#039; edition" data-img="/assets/img/logo-128.webp"
     data-ver="42" data-date="October 15, 2025" data-md5="https://mirror.example.org/ace.img.gz.md5" data-doc="https://wiki.example.org/ace" data-old>
    <span class="dl-pic is-nopic"><img src="/assets/img/logo-128.webp" alt=""></span>
    <span class="dl-info"><small>GameForce</small><strong>Ace</strong><span class="dl-meta"><span class="dl-oldver">Batocera 42</span></span></span>
  </a>
  <a class="dl-dev" href="https://updates.example.org/ace/stable/last/duplicate.img.gz" data-id="ace" data-gs="handheld" data-name="Duplicate"></a>
  <a class="dl-dev" href="https://updates.example.org/notes.txt" data-id="not-an-image" data-gs="handheld" data-name="Not an image"></a>
</div>`;

describe("parseDownloadPage", () => {
  const { families, devices } = parseDownloadPage(PAGE, "https://batocera.org/download");

  it("reads the families, without the empty ones", () => {
    expect(families).toEqual([
      { id: "handheld", name: "Handhelds", title: "Handheld consoles" },
      { id: "pc", name: "PC", title: "PC and laptops" },
      { id: "raspberry-pi", name: "Raspberry Pi", title: "Raspberry Pi boards" },
    ]);
  });

  it("reads each model once, and only those with an .img.gz", () => {
    expect(devices.map(d => d.id)).toEqual(["pc-recent", "raspberry-pi-pi-4-model-b", "ace"]);
  });

  it("reads the line under the name and how it is colored", () => {
    const [pc, pi, ace] = devices;
    expect([pc.note, pc.noteKind]).toEqual(["Faster on recent PCs (2013+)", "plain"]);
    expect([pi.note, pi.noteKind]).toEqual(["Batocera 44", "current"]);
    expect([ace.note, ace.noteKind, ace.old]).toEqual(["Batocera 42", "old", true]);
  });

  it("reads flags, groups and absolute URLs", () => {
    const pi = devices[1];
    expect(pi.labeled).toBe(true);
    expect(pi.old).toBe(false);
    expect(pi.groups).toEqual(["raspberry-pi"]);
    expect(pi.photoUrl).toBe("https://batocera.org/assets/img/boards/medium/pi4.webp");
    expect(pi.md5Url).toBe("https://mirror.example.org/pi4.img.gz.md5");
    expect(devices[0].groups).toEqual(["popular", "pc"]);
  });

  it("drops the photo of a model the site shows without one, and decodes entities", () => {
    const ace = devices[2];
    expect(ace.photoUrl).toBe("");
    expect(ace.name).toBe("Ace & Friends' edition");
    expect(ace.docUrl).toBe("https://wiki.example.org/ace");
  });

  it("refuses a page without models", () => {
    expect(() => parseDownloadPage("<html><body>Maintenance</body></html>")).toThrow(/no longer lists devices/);
  });
});

describe("HTML helpers", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("a &amp; b &#039;c&#39; &#x41; &hellip; &unknown;")).toBe("a & b 'c' A … &unknown;");
  });

  it("reads bare, quoted and unquoted attributes", () => {
    expect(parseAttributes('<a href="x" data-old data-n=3 data-q=\'y\'>')).toEqual({ href: "x", "data-old": "", "data-n": "3", "data-q": "y" });
  });
});
