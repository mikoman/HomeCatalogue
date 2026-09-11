---
version: 1
slug: "frontend-src-components-settings-jsx"
primary_target: "frontend/src/components/Settings.jsx"
related_targets: ["frontend/src/components/settings/ProviderSettings.jsx", "frontend/src/components/settings/ScanSettings.jsx", "frontend/src/components/settings/CatalogueSettings.jsx"]
---

# Settings surface

- Target: `frontend/src/components/Settings.jsx` and `frontend/src/components/settings/*.jsx`.
- Mode: Operate.
- Visual authority: the approved Folio direction and the current shared styles in `DESIGN.md`.
- Reference sizes: desktop 1280 × 800 and phone 390 × 844.

## Purpose and hierarchy

Settings configures the backend and model servers.
The page shows the active provider before its three section controls.
Provider selection changes the form under edit. The Active label identifies the provider used for new scans.
Unsaved changes appear beside the provider and above the section content.
The shared theme switch remains in the application header.

## Composition

The outer workspace has a maximum width of 1024px.
At 1024px, providers occupy a 190px column beside the form.
Below that breakpoint, the provider list uses two columns above the form.
Scan and catalogue sections have a maximum width of 768px.
Cards use 20px padding, which increases to 24px at 640px.
Scan limits stack on phones. From 640px, each limit has a flexible description and a 170px field column.
Action groups wrap. Model lists scroll within a maximum height of 208px.

Folio typography, surfaces, and controls apply in both themes.
The current theme’s primary color identifies save actions and selected sections.
Connection tests and model actions use secondary treatments.
Written feedback follows the related action.
Catalogue deletion uses a separate red panel and a confirmation dialog.
The dialog requires the user to type DELETE before it enables deletion.

## Evidence and limits

Current captures are `../review/settings-desktop-dark.png` and `../review/settings-mobile-light.png`.
The browser used complete synthetic provider settings. It did not change real credentials or catalogue data.
`../review/validation.md` records the checks and their limits.
