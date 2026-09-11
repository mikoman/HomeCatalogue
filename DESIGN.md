---
name: "Home Catalogue — Folio"
description: "An editorial home archive with warm ivory, forest green, and a shared dark mode."
colors:
  primary-300: "rgb(47 80 58)"
  primary-400: "rgb(30 66 52)"
  primary-500: "rgb(39 75 62)"
  primary-900: "rgb(226 234 218)"
  surface-100: "rgb(31 40 33)"
  surface-200: "rgb(49 60 50)"
  surface-300: "rgb(71 81 70)"
  surface-400: "rgb(91 101 87)"
  surface-500: "rgb(100 109 94)"
  surface-700: "rgb(188 196 177)"
  surface-800: "rgb(221 224 210)"
  surface-900: "rgb(252 250 245)"
  surface-950: "rgb(245 242 235)"
  error-text: "rgb(145 47 43)"
  error-border: "rgb(190 128 117)"
  error-surface: "rgb(240 205 193)"
  success-text: "rgb(36 91 54)"
  success-border: "rgb(113 151 110)"
  success-surface: "rgb(192 217 182)"
  sidebar: "rgb(35 68 54)"
  sidebar-text: "rgb(246 244 234)"
  sidebar-muted: "rgb(205 218 202)"
  sidebar-line: "rgb(95 121 100)"
  sidebar-selected: "rgb(74 103 80)"
  primary-300-dark: "rgb(201 223 192)"
  primary-400-dark: "rgb(206 226 196)"
  primary-500-dark: "rgb(184 211 175)"
  primary-900-dark: "rgb(35 59 42)"
  surface-100-dark: "rgb(243 241 231)"
  surface-200-dark: "rgb(226 230 219)"
  surface-300-dark: "rgb(207 213 199)"
  surface-400-dark: "rgb(176 189 175)"
  surface-500-dark: "rgb(164 180 166)"
  surface-700-dark: "rgb(65 86 71)"
  surface-800-dark: "rgb(43 59 49)"
  surface-900-dark: "rgb(27 40 33)"
  surface-950-dark: "rgb(19 30 25)"
  error-text-dark: "rgb(244 169 150)"
  error-border-dark: "rgb(131 76 65)"
  error-surface-dark: "rgb(84 39 34)"
  success-text-dark: "rgb(187 221 164)"
  success-border-dark: "rgb(87 130 78)"
  success-surface-dark: "rgb(38 67 40)"
  sidebar-dark: "rgb(15 37 27)"
  sidebar-line-dark: "rgb(67 94 73)"
  sidebar-selected-dark: "rgb(47 78 56)"
  danger: "#912f2b"
  danger-hover: "#a63b36"
  white: "#fff"
typography:
  display:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: "2.5rem"
    letterSpacing: "-0.025em"
  display-wide:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 500
    lineHeight: "1"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: "2rem"
  page-title:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: "2.25rem"
    letterSpacing: "-0.025em"
  item-title:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "Source Sans 3, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  label:
    fontFamily: "Source Sans 3, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  supporting:
    fontFamily: "Source Sans 3, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  sm: "0.125rem"
  md: "0.375rem"
  lg: "0.5rem"
  full: "9999px"
spacing:
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary-500}"
    textColor: "{colors.surface-950}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-400}"
  button-primary-dark:
    backgroundColor: "{colors.primary-500-dark}"
    textColor: "{colors.surface-950-dark}"
  button-secondary:
    backgroundColor: "{colors.surface-900}"
    textColor: "{colors.surface-200}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
  input:
    backgroundColor: "{colors.surface-900}"
    textColor: "{colors.surface-100}"
    rounded: "{rounded.md}"
    padding: "0.625rem 0.875rem"
  card:
    backgroundColor: "{colors.surface-900}"
    rounded: "{rounded.lg}"
    padding: "{spacing.4}"
  tag:
    backgroundColor: "{colors.surface-800}"
    textColor: "{colors.surface-300}"
    padding: "0.25rem 0.5rem"
  location-tab:
    textColor: "{colors.surface-400}"
    padding: "0.5rem 0.75rem"
  location-tab-selected:
    textColor: "{colors.primary-400}"
  sidebar-link:
    textColor: "{colors.sidebar-text}"
    rounded: "{rounded.md}"
    padding: "0.75rem"
  sidebar-link-selected:
    backgroundColor: "{colors.sidebar-selected}"
  theme-toggle:
    textColor: "{colors.surface-300}"
    rounded: "{rounded.md}"
    padding: "0 0.5rem"
---

# Design System: Home Catalogue

## Overview

**Creative North Star: "Folio: a personal editorial archive"**

Folio makes household photographs and storage locations the main content. Warm ivory, forest green, serif headings, and open galleries give the collection a clear reading order. Fine dividers separate controls without enclosing every object.

Dark mode preserves the same composition. Deep green replaces the ivory canvas, while warm text and pale sage controls retain the hierarchy. Phone scanning and desktop browsing share the same visual system.

The user approved Folio and requested a dark mode switch on 11 September 2026.
The current stylesheet and components define the implemented system. The approved comp supplies visual direction, not exact implementation values.
The source contract is in `frontend/index.html`.

**Key Characteristics:**

- Open photo galleries with names and written storage locations.
- Lora headings paired with Source Sans 3 controls.
- Flat surfaces, fine dividers, and small corner radii.
- One shared theme choice across navigation, Settings, and scan review.

The archive mark is the only bundled identity artwork. Control icons use inline SVG.
Catalogue photographs are user data. Generated comps and browser fixtures remain test or reference material.
`frontend/public/fonts/SOURCES.md` records font provenance and SIL licences.

## Colors

The palette combines warm paper, forest green, and muted sage.
The frontmatter records resolved RGB values from `frontend/src/index.css`.
Unsuffixed tokens describe light mode. The `-dark` suffix records a dark-mode override for the same CSS variable.
Sidebar text and muted text keep their light-mode values in both themes.
Tailwind maps these variables into semantic color utilities.

### Primary

Forest green marks primary actions, focus, and selected controls in light mode.
Pale sage performs those roles in dark mode. Hover uses the adjacent primary treatment.
The action text uses the current canvas color.

### Neutral

Warm ivory forms the light canvas. Near-white paper forms fields and enclosed panels.
The dark canvas uses deep green, with a lighter green panel layer.
Heading, body, supporting, and placeholder tones retain distinct roles in both themes.

The forest sidebar remains dark in both themes. Its text and focus outline use warm ivory.
The selected navigation surface becomes a lighter forest tone.

### Status

Error and success tokens change with the theme.
Destructive buttons retain brick red and white text in both themes.
Written messages identify errors, success, uncertainty, and unsaved changes.

**The Shared Theme Rule.** Use the shared theme variables on every surface, including modal review.

## Typography

**Display Font:** Lora, with Georgia and serif fallbacks.
**Body Font:** Source Sans 3, with system sans-serif fallbacks.
**Data Font:** ui-monospace, with SFMono-Regular and monospace fallbacks.

Lora gives room names and item captions a book-like character.
Source Sans 3 keeps fields, controls, and location labels readable.
Both fonts load from local WOFF2 files with `font-display: swap`.
The upright Lora file supports weights 400–700. Source Sans 3 supports weights 200–900.
Both files use the SIL Open Font License, version 1.1.

### Hierarchy

- **Display:** Room headings use the display role, then the display-wide role from 640px.
- **Headline:** Scan review uses the headline role.
- **Page title:** Settings uses the page-title role, then a 2.25rem size and 2.5rem line height from 640px.
- **Item title:** Gallery names use the item-title role and allow wrapping.
- **Body:** General text and editable names use the body role.
- **Label:** Locations, filters, and secondary controls use the label size. Their weights depend on state.
- **Supporting:** Counts and compact navigation labels use the supporting size.

Form controls use a 16px font through the mobile rule at widths of 640px or less.
Data text uses monospace where alignment or technical values require it.

## Layout

The application fills the dynamic viewport height. Its main content scrolls inside the shell.
A fixed forest sidebar occupies 224px from 1024px. Smaller viewports use a menu and bottom navigation.
The content container has a maximum width of 1152px.
Horizontal padding changes from 16px to 32px at 640px.
Vertical content padding changes from 20px to 28px at the same breakpoint.

The room gallery uses two columns below 1024px and three columns from 1024px.
Horizontal gaps change from 16px to 24px at 640px. Vertical gaps remain 24px.
Photo frames use a 4:3 ratio below 1024px and 16:9 above that breakpoint.
The image keeps its own proportions inside the frame.

Control rows wrap. Location filters can scroll horizontally inside their own row.
Secondary management controls expand only when needed.
Review keeps its action footer outside the scrolling content and respects the phone’s safe area.
Surface briefs record page composition and exact workspace widths.

## Elevation & Depth

Shared buttons and cards have no box shadow.
Surface tones, thin borders, and empty space establish depth.
Selected photos use an outline. Flat location tabs use a lower border.
Modal backdrops dim the surrounding interface. The item detail dialog also blurs its backdrop.
The bulk action bar uses a translucent canvas layer with a slight backdrop blur.

## Shapes

Photo frames have small corners. Buttons and fields use the medium corner radius.
Enclosed cards use the larger corner radius. The theme switch uses a pill track and round thumb.
The archive mark repeats four small squares.

Gallery captions sit directly on the canvas. Enclosed cards support forms, errors, and expanded management states.
Use thin dividers between related review rows and navigation groups.

## Components

### Buttons

Primary, secondary, and destructive buttons have a minimum height of 44px.
Primary buttons use semibold text. Secondary and destructive buttons use medium text.
Their color transitions last 150ms. They do not add a shadow or scale change when pressed.
Disabled buttons reduce opacity and show a blocked cursor.

### Inputs / Fields

Fields use the panel surface, a muted border, and a minimum height of 44px.
A focused field receives a primary border and one-pixel ring.
Other keyboard targets receive a two-pixel outline with a three-pixel offset.
Review fields use the canvas surface to keep editable names within each row.
Labels and helper text remain readable when long values wrap.

### Cards / Containers

Shared cards use a panel surface, a thin border, and 16px padding.
Settings forms increase this padding through their surface layout.
Gallery items remain open until editing requires an enclosed form.

### Navigation and filters

Sidebar links use icons, written labels, and a filled selected state.
Phone navigation provides Catalogue, Scan, and Find beneath the scrolling content.
An open phone menu traps focus, supports Escape, and makes the main shell inert.
Navigation to another pathname resets the main scroll position.

Room filters use flat tabs with a two-pixel selected underline and `aria-pressed`.
Settings section controls use a filled selected state.
Provider selection remains separate from the written Active label.
The detector’s flat-tab warning is a false positive. It does not require a card border treatment.

### Theme switch

The switch uses `role="switch"`, the accessible name `Dark mode`, and `aria-checked`.
Its sun or moon icon and moving thumb show the current state.
The visible text hides below 640px. Its accessible name remains present.
The thumb moves 16px over 150ms with ease-out timing.

The bootstrap applies the theme before the first paint.
The interface follows the operating system until the user chooses a theme.
The choice persists under `homeCatalogue:theme` in local storage and synchronizes across browser tabs.
Blocked storage preserves the choice only for the current page.
The same switch remains available inside scan review.

### Item photographs and captions

Each gallery item shows a photograph, name, category when present, and written locations.
Grouped items retain their combined locations. Missing photographs show a box icon and a written fallback.
Management actions remain in an expandable section during ordinary browsing.

`ItemPhoto` preserves source proportions for gallery and review images.
A valid normalized box becomes an SVG viewBox and clipping rectangle based on the source image’s natural dimensions.
Without a valid box, the full image uses contain sizing.
This behavior does not remove backgrounds or create a separate photograph of each object.

**The Photo Proportion Rule.** Preserve object proportions when a gallery or review frame crops the source photograph.

**The Visible Location Rule.** Keep each item’s storage location beside its name or editable name field.

### Feedback and motion

Review rows expose selected state, editable names, destinations, and warnings.
Success messages use status semantics. Errors use alert semantics where the component reports an action failure.
Scan progress uses a 1.4-second opacity animation.
Reduced-motion preferences remove extended transitions and stop the scan animation.

## Do's and Don'ts

### Do:

- Do use the shared theme variables and local font files.
- Do show object photographs with written locations.
- Do preserve keyboard focus, touch targets, and reduced-motion support.
- Do keep status text visible beside its related action.
- Do retain review controls for uncertain items and missing destinations.

### Don't:

- Don't stretch objects to fill gallery or review frames.
- Don't use generated concept photographs as catalogue records.
- Don't add decorative grids, gradients, or button glows to Folio.
- Don't identify active providers or review warnings through color alone.
- Don't present synthetic browser checks as proof of physical camera capture or backend persistence.
