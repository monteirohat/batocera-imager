// The switches for Batocera's own assets.
//
// This installer is unofficial. It uses batocera.org's look (colors, type,
// shapes) and, since 2026-11-24, its device photos, to show the Batocera team
// how the installer looks with them (see docs/STYLE.md, "The brand is
// Batocera's"). The photos are loaded from batocera.org when a screen shows
// them; none is copied into this repository.

/** Device and family photos, loaded from batocera.org. False shows a drawn icon instead. */
export const DEVICE_PHOTOS = true;

/**
 * Batocera's logo and the butterfly: only once the team agrees. The logo then
 * goes in the top bar (src/renderer/components/TopBar.tsx), with the file they
 * provide. Until then a family whose tile on the site shows the logo takes the
 * photo of one of its models instead.
 */
export const OFFICIAL_LOGO = false;

/** Said in the About dialog and the README while the project is unofficial. */
export const UNOFFICIAL_NOTE = "Unofficial installer for Batocera. It is not made by the Batocera team.";
