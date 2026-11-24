// The one switch for Batocera's own assets.
//
// This installer is unofficial. Until the Batocera team agrees, it uses
// batocera.org's look (colors, type, shapes) but none of its assets: no logo,
// no butterfly, no device photos (see docs/STYLE.md, "The brand is Batocera's").
//
// When the team agrees, set OFFICIAL_ASSETS to true: device cards then load
// their photos from batocera.org. The logo goes in the top bar the same day
// (src/renderer/components/TopBar.tsx), with the file they provide.

export const OFFICIAL_ASSETS = false;

/** Said in the About dialog and the README while the project is unofficial. */
export const UNOFFICIAL_NOTE = "Unofficial installer for Batocera. It is not made by the Batocera team.";
