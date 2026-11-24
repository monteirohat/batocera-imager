// Prints the CHANGELOG.md section of a version, for the GitHub release:
//   node scripts/release-notes.mjs 0.1.0 > release-notes.md
// Fails when the section is missing, so a release is never published without notes.

import { readFileSync } from "node:fs";

const version = process.argv[2];
if (!version) {
  console.error("usage: node scripts/release-notes.mjs <version>");
  process.exit(2);
}
const lines = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").split("\n");
const start = lines.findIndex(l => l.startsWith(`## [${version}]`));
if (start < 0) {
  console.error(`CHANGELOG.md has no "## [${version}]" section.`);
  process.exit(1);
}
const rest = lines.slice(start + 1);
const end = rest.findIndex(l => l.startsWith("## ") || /^\[[^\]]+\]: /.test(l));
console.log(rest.slice(0, end < 0 ? undefined : end).join("\n").trim());
