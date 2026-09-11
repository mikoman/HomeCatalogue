---
version: 1
slug: "frontend-src-components-settings-jsx"
primary_target: "frontend/src/components/Settings.jsx"
related_targets: ["frontend/src/components/settings/ProviderSettings.jsx","frontend/src/components/settings/ScanSettings.jsx","frontend/src/components/settings/CatalogueSettings.jsx"]
---

# Settings surface

- Target: `frontend/src/components/Settings.jsx` and `frontend/src/components/settings/*.jsx`.
- Mode: Operate.
- Visual authority: the existing charcoal and safety-yellow interface.
- Reference sizes: desktop 1280 × 720 and phone 390 × 844.

The page shows the active provider before its three section controls.
Provider selection changes the form under edit. The Active label identifies the provider used for new scans.
Unsaved changes appear beside the provider and above the section content.

The outer workspace has a maximum width of 1024px.
At 1024px, providers occupy a 190px column beside the form.
Below that breakpoint, the provider list uses two columns above the form.
Scan and catalogue sections have a maximum width of 768px.
Cards use 20px padding, which increases to 24px at 640px.
Scan limits stack on phones. At 640px, each limit has a flexible description and a 170px field column.
Action groups wrap. Model lists scroll within a maximum height of 208px.

Yellow distinguishes save actions from secondary connection and model actions.
Written feedback follows the related action.
Catalogue deletion uses a separate red panel and a confirmation dialog.
The dialog requires the user to type DELETE before it enables deletion.

This record describes the current code. It adds no new visual assets or approved composition.
