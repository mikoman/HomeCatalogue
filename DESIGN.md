---
name: Home Catalogue
description: Charcoal surfaces and safety-yellow controls for household inventory.
colors:
  primary-300: "#FFDE47"
  primary-400: "#FFD11F"
  primary-500: "#FFC700"
  surface-100: "#F4F4F5"
  surface-200: "#E4E4E7"
  surface-300: "#C7C7CD"
  surface-400: "#9A9AA3"
  surface-500: "#92929B"
  surface-600: "#46464D"
  surface-700: "#2C2C31"
  surface-800: "#1E1E22"
  surface-900: "#141416"
  surface-950: "#0A0A0B"
  danger: "#dc2626"
  danger-hover: "#ef4444"
  error-text: "#fca5a5"
  error-border: "#7f1d1d"
  error-background: "rgb(69 10 10 / 0.2)"
  success-text: "#86efac"
  success-border: "#14532d"
  success-background: "rgb(5 46 22 / 0.2)"
  white: "#fff"
typography:
  headline:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: "2.25rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  supporting:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  md: "0.375rem"
  lg: "0.5rem"
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
    backgroundColor: "{colors.surface-950}"
    textColor: "{colors.surface-100}"
    rounded: "{rounded.md}"
    padding: "0.625rem 0.875rem"
  card:
    backgroundColor: "{colors.surface-900}"
    rounded: "{rounded.lg}"
    padding: "{spacing.4}"
  section-selected:
    backgroundColor: "{colors.primary-500}"
    textColor: "{colors.surface-950}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
---

# Design System: Home Catalogue

## Overview

**Creative North Star: "Charcoal and safety yellow"**

The interface uses charcoal surfaces and a safety-yellow accent. A faint square grid sits behind solid panels. Space Grotesk headings and Inter controls give each page a clear reading order.

This name describes the existing interface. It does not introduce a new visual identity.
The sources are `frontend/tailwind.config.js`, `frontend/src/index.css`, and the Settings components.
The tokens describe the shared styles. Settings composition belongs in its surface brief.

**Key Characteristics:**

- Charcoal panels with quiet borders.
- Yellow actions and selected states.
- Rounded controls with visible keyboard focus.

## Colors

### Primary

Safety yellow marks primary actions, keyboard focus, selected controls, and unsaved changes.
The lighter yellow supports hover states and accent text.

### Neutral

The darkest charcoal forms the canvas and field backgrounds.
A lighter charcoal forms cards, with quiet borders and brighter hover surfaces.
Near-white identifies headings. The middle text tones distinguish body text, supporting text, and placeholders.

### Status

Red identifies destructive actions and errors. Green identifies successful results.
Status panels combine colored text, a border, a translucent background, and a written message.

**The Action Color Rule.** Yellow marks primary actions. Red marks destructive actions.

## Typography

Space Grotesk supplies headings. Inter supplies body text, fields, and buttons.
The shared stylesheet also provides Space Mono for code and data text.
Settings uses the headline, title, body, label, and supporting roles above.
Its headline increases to 2.25rem with a 2.5rem line height at the small breakpoint.
Numeric limits and response times use tabular numbers.
Phone fields use a 16px font size through the shared mobile rule.

## Layout

Spacing follows the existing quarter-rem scale.
Cards contain related controls. Dividers separate groups inside a form.
Control rows wrap within the available width. Fields fill their available width.
Settings uses a wide provider workspace and narrower scan and catalogue sections.
The Settings surface brief records its exact widths and responsive arrangement.

## Elevation & Depth

Tonal layers and borders provide most depth.
The canvas has a faint white grid with a 34px repeat.
Primary buttons have a small shadow at rest and a yellow glow on hover.
The sidecar records both shadow values.
Other shared buttons change their background and border without a raised surface.

## Shapes

Controls use the medium corner radius. Cards use the larger corner radius.
Borders remain thin and quiet, with yellow outlines for selected provider and detector choices.

## Components

### Buttons

Primary and secondary buttons use a minimum height of 44px.
Primary buttons use semibold text. Secondary and destructive buttons use medium text.
Buttons compress to 98% while pressed. Standard transitions last 150ms.
Disabled buttons show reduced opacity and a blocked cursor.

### Inputs / Fields

Fields use the canvas color, a charcoal border, and a minimum height of 44px.
Labels remain above fields. Supporting text follows its field.
Focused fields receive a yellow border and ring.
Other keyboard targets receive a yellow outline with a 2px offset.

### Cards / Containers

Shared cards use the panel color, a quiet border, and standard padding.
Settings forms increase their padding to give labels and help text more room.

### Navigation

Settings sections use wrapping buttons and a filled yellow selected state.
Provider choices use an outlined selected state and a separate Active label.
The selected provider can differ from the active provider.

### Feedback

Success panels use `role="status"`. Error panels use `role="alert"`.
Busy controls show an action label such as Saving or Testing connection.
The shared reduced-motion rule removes extended animation and transition durations.

## Do's and Don'ts

### Do:

- Do use the existing font families and color roles.
- Do pair status colors with readable text.
- Do let control groups wrap and long model names break.
- Do retain visible keyboard focus and reduced-motion support.

### Don't:

- Don't use the primary action style for catalogue deletion.
- Don't use selection color as the only indication of an active provider.
