# Style

What the installer should look like, and why. The look is batocera.org's (read on 2026-11-24,
when the site wore the colors of Batocera 44, "malachite and turquoise"): someone who just came
from the download page should feel they are still in the same place.

All the values below live as tokens in `src/renderer/styles/tokens.css`, created with the app's
first screen. A component never writes a color, a radius or a shadow: it names a token, and a new
need gets a new token there. The token
names are the site's own (`--bg`, `--surface`, `--btn-grad`...), so a value can be checked against
batocera.org's `site.css` when the site changes.

## The brand is Batocera's

Batocera's name, its logo, the butterfly of the Batocera 44 splash screen and the device photos
belong to the Batocera team, and the site's CSS, icons and images are its author's work. This
file takes the look (colors, type, shapes, the way things move) and rebuilds it with our own CSS.

- **Copy no file from batocera.org** into the repository: no CSS, no `icons.svg`, no image.
- **Device photos are shown, loaded from batocera.org** when a screen needs them (decided on
  2026-11-24, to show the Batocera team how the installer looks with them). The app never bundles
  them; screenshots of the app in the repository may show them, as the README's device screen
  does. The switch is `DEVICE_PHOTOS` in `src/shared/brand.ts`.
- **Logo and butterfly only once the Batocera team agrees** (`OFFICIAL_LOGO`). Until then the
  header shows the product name without the logo; where the site shows its logo instead of a
  photo, a family takes a photo of one of its models and a model keeps the "no picture" look (see
  [Model card](#model-card)). The README and the About screen say "Unofficial installer for
  Batocera".
- Colors, the system font stack and the general layout are not anyone's property; those we use
  freely.

## The idea

Night over a retro horizon: a deep blue-green background with a few stars, a teal glow at the
top, and a neon grid running toward the horizon on the opening and closing screens. On it, dark
teal surfaces with thin borders, near-white type, and two kinds of color:

- **Coral-to-magenta** for the action: the one button that moves you forward.
- **Orange** for attention: what is selected, what has focus, a label that matters.

Teal and lime-green gradients are light, not paint: a thin neon line, a glow, a progress bar.
They never fill a large surface.

The site is dark only (`color-scheme: dark`), and so is the installer.

## Color

### Backgrounds and surfaces

| Token | Value | Use |
|---|---|---|
| `--bg` | `#051012` | the window's background |
| `--bg-2` | `#08171a` | an alternate band; the inside of inputs |
| `--surface` | `#0c1f22` | cards, tiles, notices, buttons at rest |
| `--surface-2` | `#12292c` | a surface on a surface: inline code, a progress track, a future step |
| `--dialog` | `#0a1d20` | dialogs and dropdowns |
| `--header` | `rgba(5, 16, 18, .55)` + `backdrop-filter: blur(14px) saturate(1.3)` | the top bar; `rgba(4, 12, 14, .9)` once the content scrolls under it |
| `--pic` | `linear-gradient(160deg, #f4fbfb, #d8ecec)` | behind a device photo (photos have white backgrounds; see [Model card](#model-card)) |
| `--border` | `#1b3a3d` | every border at rest, separators |
| `--border-strong` | `#2a5458` | input borders, secondary buttons, dashed boxes, the scrollbar thumb |

### Text

| Token | Value | Use | Contrast on `--surface` |
|---|---|---|---|
| `--text` | `#eefafa` | titles, names, values | 15.9 |
| `--muted` | `#a6c3c4` | descriptions, supporting lines, inactive menu items | 9.1 |
| `--faint` | `#86a6a8` | small labels, section titles in capitals, counts. The lightest grey that stays readable everywhere: nothing goes below it | 6.5 |
| `--link` | `#ffc46b` | links; white with an underline on hover | 10.8 |

### Accents and states

| Token | Value | Use |
|---|---|---|
| `--orange` | `#fbb03b` | selection border, focus ring, kickers, the current family's count, the "Labeled" badge, an older Batocera version |
| `--teal` | `#2dd4bf` | the current Batocera version, neon lines and glows, info icons in hints |
| `--pink` | `#e8146f` | the end of the action gradient, its glow, the donate heart. Below 4.5:1 on dark: never small text |
| `--coral` | `#f2604a` | the start of the action gradient, the download icon |
| `--cyan` | `#4fd8ff` | the icon of a neutral notice |
| `--green` | `#4ade80` | success: written and verified |
| `--red` | `#ff5a6e` | errors, and the warning that a drive will be erased |

### Gradients

| Token | Value | Use |
|---|---|---|
| `--btn-grad` | `linear-gradient(135deg, #f3683f 0%, #e8146f 100%)` | the primary button, the current step's number |
| `--btn-grad-hover` | `linear-gradient(135deg, #f67a50 0%, #ef2d7f 100%)` | the same, hovered |
| `--grad` | `linear-gradient(135deg, #c4f27a 0%, #4be08a 50%, #2dd4bf 100%)` | neon lines, the progress fill, the kicker's square, gradient text in a title. Text on it is `#1a0612` |
| `--neon-line` | `linear-gradient(90deg, transparent, rgba(45,212,191,.7), rgba(251,176,59,.7), transparent)` | the 1 px line on top of a band or the footer |
| `--chrome` | `linear-gradient(180deg, #f2fffd 0%, #9ff0d6 30%, #4be08a 62%, #1fb7b0 100%)` | the end of a big title ("retro console."), with a teal drop shadow |

### Icon colors

The site gives each kind of thing its own icon color; the text stays `--muted` or `--text`.

| What | Icon | Lighter text, if colored |
|---|---|---|
| download, write | `#f2604a` | `#ff9a7a` |
| changelog, lists, files | `#a855f7` | `#c99bfa` |
| devices, hardware | `#2dd4bf` | |
| guides, docs | `#fbb03b` | |
| community, people, maps | `#60a5fa` | |
| donate, heart | `#ff5a6e` | `#ff8a97` |
| GitHub | `#c9d1d9` | |
| Discord | `#5865f2` (`#7d89f7` in the header) | |

An icon in a square chip sits on its own color at 15 % (`color-mix(in srgb, var(--c) 15%, transparent)`).

## Type

The site loads no web font: it uses the system's.

```css
--font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--mono: ui-monospace, "Cascadia Mono", "SFMono-Regular", Menlo, Consolas, monospace;
```

So the installer is SF Pro on a Mac, Segoe UI on Windows and the desktop's font on Linux, like
the site in the same browser. Don't bundle a font.

| Role | Size / line height | Weight | Notes |
|---|---|---|---|
| Screen title | 2rem / 1.15 | 850 | letter-spacing -.02em; `text-wrap: balance` |
| Section title | 1.5rem / 1.15 | 800 | -.02em |
| Step header | 1.15rem / 1.3 | 700 | after its number square |
| Card title | .95rem / 1.25 | 700 | |
| Body | 1rem / 1.6 | 400 | prose, descriptions |
| UI text | .93rem / 1.2 | 500-600 | menus, chips, labels |
| Small, meta | .74-.85rem | 400-600 | in `--muted` |
| Kicker | .75rem / 1, mono | 700 | capitals, letter-spacing .16em, `--orange`, after an 8 px square of `--grad` with a coral glow |
| Label in capitals | .7-.75rem, mono or font | 600-700 | letter-spacing .08-.14em, `--faint` |
| Count, version, size, speed | .7-.8rem, mono | 700 | never in prose |

- **Weights are heavy.** Titles are 800-850 and tightly spaced; on a system without that weight
  the heaviest one shows, which is fine.
- **Capitals only in small labels**, always with letter spacing. Titles and buttons are in
  sentence case.
- **Figures that change** (percent, MB/s, time left, sizes) are in `--mono` with
  `font-variant-numeric: tabular-nums`, so they don't jump.

## Shape

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | inputs, the number square in a dialog |
| — | 9px | header buttons, icon chips, step numbers |
| — | 12px | family tiles, drive rows, the download buttons of a dialog |
| `--radius` | 14px | cards, notices, dashed boxes |
| — | 16px | model cards, dropdowns |
| — | 20px | dialogs |
| — | 999px | chips, secondary buttons (`.btn`) |

- **The bigger the surface, the rounder.** Pick from the table; don't invent a radius.
- **1 px borders everywhere** at rest, in `--border`. A surface has a border or nothing; never a
  border plus a fill of another color.
- **Shadows are deep and soft**, with a negative spread: `--shadow: 0 10px 30px -12px rgba(0,0,0,.6)`;
  a dialog: `0 40px 90px -20px rgba(0,0,0,.95), 0 0 70px -35px rgba(251,176,59,.7)` (a hint of
  orange light behind it).
- **Glows carry the color of what makes them**: the primary button glows pink
  (`inset 0 1px 0 rgba(255,255,255,.22), 0 8px 22px -12px rgba(232,20,111,.9)`), a selection
  glows orange, a neon line glows teal.
- **The neon line**: 2 px of `--grad`, 14 px in from each side, on the top edge of a card, with
  `0 0 12px rgba(45,212,191,.7)`. On the site it appears on hover; in the installer, on the card
  being hovered or focused.

## Components

### Buttons

- **Primary** (one per screen, the step forward): `--btn-grad`, white bold text with
  `text-shadow: 0 1px 1px rgba(90,0,40,.35)`, the pink glow, radius 12-13px, height 44-52px.
  Hover: `--btn-grad-hover`, a stronger glow, up 1-2 px. White on the coral end is about 3:1, so
  the label is always bold and at least 16px.
- **With a value**: the site's "Get Batocera **44**" puts the version in a small box inside the
  button (`rgba(0,0,0,.24)`, radius 6-8px, 600). Use it for "Write **44**".
- **Secondary**: `--surface`, 1 px `--border-strong`, pill (999px), bold `--text`. Hover: border
  `--orange`, up 1 px.
- **Ghost**: the secondary without the fill. Back, Cancel.
- **Icon button**: 33-38px square, radius 9px, no border; hover: `rgba(255,255,255,.06)` and
  `brightness(1.25)`.
- **Grouped actions** sit in a capsule: 4-5 px padding, radius 12-18px,
  `rgba(255,255,255,.035)` with a 1 px `rgba(255,255,255,.06)` border, a 1 px `--border-strong`
  separator between groups.

### Step header

"**1** What will you play on?": a 30px square, radius 9px, `--btn-grad`, number in mono 800
white, then the question in 1.15rem 700. The part of the question that names the current choice
is `--orange` ("Choose your model in **Raspberry Pi boards**"), and a count follows in mono
.8rem `--muted` ("23 models").

### Family tile

A row of equal tiles (the site has eight: Handhelds, PC, Raspberry Pi, Odroid, Anbernic, AYN,
Orange Pi, Others): `--surface`, 1 px `--border`, radius 12px, .45rem padding; a 52px picture
box on `--pic`; under it the name (.86rem bold, ellipsis) and the count on the right (mono .74rem
`--muted`).

- Hover: border `--border-strong`, up 2 px.
- **Selected**: border `--orange`, `0 0 0 1px var(--orange), 0 14px 34px -20px var(--orange)`;
  its count turns orange.

### Maker chips and search

- **Search**: an input with a search icon inside on the left, placeholder "Search in this
  family…". Escape clears it.
- **Chips**: pill buttons, `rgba(255,255,255,.04)` with a `rgba(255,255,255,.09)` border, .86rem
  600, count in a small mono pill. Pressed: border `--orange`, fill `rgba(251,176,59,.12)`, the
  count orange. First chip is "All". At most eight makers, the ones with most models first.
- No search or chips when a family has four models or fewer.

### Model card

A grid of cards, min 210px wide: `--surface`, 1 px `--border`, radius 16px.

- **Picture**: a 120px box inset .55rem, radius 11px, on `--pic`; the photo is
  `mix-blend-mode: multiply; filter: contrast(1.08) brightness(1.04)`, so a white photo background
  takes the box's color. Max 85 % wide and 100px high, `object-fit: contain`.
- **No picture**: the box shows a placeholder at 56px, 35 % opacity, grayscale, no blending.
- **Text**: the maker (.74rem `--muted`, with an optional "★ Labeled" badge), the model's name
  (.95rem bold), then the Batocera version: `--teal` when it is the current one, `--orange` when the
  device stayed on an older one, or a short note in `--muted` (.76rem).
- Hover or focus: border `rgba(251,176,59,.55)`, up 2 px, `0 16px 36px -22px rgba(251,176,59,.8)`.
- **Selected** (the installer's addition: the site opens a dialog instead): the family tile's
  selected look, orange border and ring.

### Badge

"★ Labeled": a pill, .62rem 700, `--orange` on `rgba(251,176,59,.1)` with a
`rgba(251,176,59,.35)` border. The general badge has a 6px glowing dot before its text.

### Dialog

`--dialog`, 1 px `rgba(255,255,255,.1)`, radius 20px, at most 760px wide; the window behind is
`rgba(2,8,9,.78)` with `blur(3px)`. It pops in (see [Motion](#motion)). A close button in the
top right corner (36px, radius 10px, border turns orange on hover). The site's layout fits the
confirmation: device picture on the left (260px), on the right a mono orange family label, the
name (1.45rem), the meta line in `--muted` with " · " between parts, the actions; under a
`rgba(255,255,255,.07)` line, a band in `rgba(255,255,255,.02)` with numbered "what happens next"
boxes.

### Notice

A row with an icon: `--surface`, 1 px `--border`, radius 14px, padding 1rem 1.2rem, icon in
`--cyan`.

- **OK**: border `rgba(74,222,128,.5)`, fill `rgba(74,222,128,.08)`, icon `--green`.
- **Error** and **erase warning**: border `rgba(255,90,110,.5)`, fill `rgba(255,90,110,.08)`,
  icon `--red`.
- **Hint** (one line under a choice): .88rem `--muted`, a 15px `--teal` info icon, the link bold.

### Inputs

`--bg-2`, 1 px `--border-strong`, radius 8px, padding .7rem .9rem. Focus: border `--orange` and
`0 0 0 3px rgba(251,176,59,.25)`, no outline. Invalid: border `--red`. Selects get the site's
chevron in `#a6c3c4`.

### Progress (the installer's addition)

The site has no progress bar; this one is built from its parts: an 8px track in `--surface-2`
(radius 999px) with a 1 px `--border`, filled with `--grad` and a
`0 0 12px rgba(45,212,191,.6)` glow. Above it, the phase in a kicker ("WRITING", "VERIFYING"),
the percent large in mono; under it, speed and time left in mono `--muted`. Failed: the fill turns
`--red` and stops. Done: `--green`.

### Drive row (the installer's addition)

One row per drive, like a family tile laid flat: a 40px icon chip (USB key, SD card, disk), the
name (.95rem bold), the size in mono and the mount points in `--muted`. Selected: the orange
border and ring.

## Screens

The installer's path, and the part of the site each screen borrows from:

1. **Device** — the download page, almost as it is: "**1** What will you play on?" with the
   family tiles, the hint "Not sure? Any computer from the last 15 years runs the PC image.",
   then "Choose your model in …" with search, maker chips and the model cards. The installer
   opens on it.
2. **Drive** — "**2** Which drive?": the drive rows, each with the icon of its kind (USB key,
   SD card, external drive). Only removable drives; those too small for the image are greyed out
   with the size it needs, after the others. An empty list says what to plug in, in a dashed
   `--border` box. (There is no step to choose the kind of drive first: the list already shows
   every drive, and the kind is only the system's guess.)
3. **Confirm** — the dialog: device picture, "Batocera 44 · November 16, 2026", the drive, an
   erase warning notice ("Everything on SanDisk Ultra 32 GB will be erased."), primary "Write",
   ghost "Back".
4. **Writing** — "**3** Writing Batocera 44": the progress, phase by phase (download, write,
   verify). The only action is a ghost "Cancel".
5. **Done** — the sky (see [Background](#background)), a big title, the three steps of the
   site's dialog: remove the key, boot your device, add your games.

**Across all screens:**

- A top bar 56px high in `--header`, the product name (bold 1.15rem, -.02em) on the left, icon
  buttons in a capsule on the right (settings, help). On macOS the traffic lights sit inside it.
- A step indicator: the step header's squares in a row. The current step `--btn-grad`, a done step
  `--teal` with a check, a future one `--surface-2` with its number in `--faint`.
- A bottom bar with the choice so far on the left ("Pi 4 Model B · Batocera 44", in `--muted`
  with the name in `--text`) and Back / the primary button on the right.
- Content in a column at most 1180px wide with 24px of margin. Window: 1120 × 760 by default,
  960 × 640 at least, so five model cards fit in a row.

## Background

- **Everywhere**: `--bg` with a few one-pixel stars (white, one orange, one teal, at 25-35 %
  opacity) and a teal glow at the top:
  `radial-gradient(120% 60% at 50% -10%, rgba(38,198,218,.12), transparent 60%)`.
- **The sky**, on Done only (the batocera.org headers, after Batocera 44's splash
  screen): stars, a horizon line of teal light, and under it a grid of thin teal lines
  (`rgba(45,212,191,.1)`) that slowly runs toward you. It sits under the text and never behind a
  grid of cards.
- **A band** that needs to stand apart: `--bg-2` with the `--neon-line` on top.

## Icons

Stroke icons on a 24 × 24 grid, stroke 2, round caps and joins, drawn in `currentColor`: the
site's set has the same drawing as [Lucide](https://lucide.dev) (ISC license), so use Lucide.
1.15em inline with text (`vertical-align: -.2em`), 17-20px in buttons, 22px in the top bar.
Their colors follow [Icon colors](#icon-colors).

## Motion

- **Hover**: up 1-2 px (`translateY`) and a stronger glow, in .15-.2 s. Press: back to 0.
- **Dialog**: from `translateY(12px) scale(.98)` and transparent, .22 s ease-out. Dropdown: down
  6 px, .16 s.
- **The sky's grid**: one line takes 50 s from the horizon to the bottom, faster as it comes.
- **Nothing else moves.** No spinner if a progress bar can say how far it is.
- With `prefers-reduced-motion: reduce`, nothing moves at all: animations and transitions off.

## Focus and keyboard

- Focus: a 3px `--orange` outline 2px outside, radius 4px; on the primary button, 2px white.
- Selected text: white on `rgba(45,212,191,.55)`.
- Every choice works with the keyboard: arrows move in a grid, Enter picks, Escape closes a
  dialog or clears the search.

## Words

The site speaks short, plain and to the reader: "Free, no account needed. Pick your device,
flash the image on a USB key or an SD card, boot and play."

- **Questions as step titles**: "What will you play on?", "Which drive?".
- **"USB key" and "SD card"**, never "pendrive" or "storage device". "Image" for what is
  written, "Batocera 44" for the version.
- **Sentence case**, "…" (the character) at the end of a placeholder, " · " between parts of a
  meta line.
- **Say what will happen**, then what to do: "Everything on this USB key will be erased." /
  "Plug in a USB key or an SD card of 8 GB or more."
- English first, like the site.

## Before a screen is done

- [ ] Every value comes from `tokens.css`; no color, radius or shadow written in a component.
- [ ] One primary button on the screen, and it is the step forward.
- [ ] Selected things are orange (border and ring), not teal and not pink.
- [ ] No text below `--faint`; nothing small in `--pink`.
- [ ] Changing figures in mono with tabular numbers.
- [ ] Tested with the keyboard alone, and with reduced motion on.
- [ ] Checked at 960 × 640 and at the default size, on Windows (Segoe UI) as well as macOS.
- [ ] No logo or butterfly from batocera.org unless the Batocera team has agreed; device photos only through `DEVICE_PHOTOS`, loaded from the site, never bundled in the app.

## Source

batocera.org, read on 2026-11-24: `site.css` (header, buttons, notices, forms, sky, footer),
`download.css` (families, chips, model cards, dialog), `home.css` (hero, gradient title, the
neon frame). The site's CSS says its colors are Batocera 44's, so they may change with the next
version; when the site changes, compare its `:root` with `tokens.css` and update both this file
and the tokens.
