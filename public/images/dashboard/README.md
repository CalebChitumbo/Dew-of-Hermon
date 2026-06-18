# Dashboard decorative assets

Optional imagery for the dashboard. The UI references these by path and
**fails gracefully** — if a file is missing, a soft gradient / no-op is shown
instead, so the dashboard never looks broken. Drop the files in with these
exact names to light them up:

| File               | Where it shows                                                  | Notes                                                                          |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `welcome-hero.png` | Left panel of the "Good evening" greeting hero                  | The cross/altar/olive scene. Portrait-ish or square; `object-cover` crops it.  |
| `leaf-accent.png`  | Bottom-right of "Today's devotional" + the "Next service" panel | Transparent PNG botanical sprig. Purely decorative.                            |

## Redesign assets (admin pages)

Used as decorative layers / card illustrations / thumbnails across the
redesigned admin pages. Every reference uses the same graceful fallback (a soft
gradient or an in-app vector illustration), so pages look intentional and
premium **before** these files exist, and "light up" once they're dropped in.

| File                             | Where it shows                                                    | Notes                                                            |
| -------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `asset-chapel-minimal.png`       | Featured "Next service" card on **Services & Rotas**             | Side image panel; `object-cover`. Falls back to a gold gradient. |
| `asset-church-interior-wide.png` | Faint atmosphere behind the **Departments** stats strip          | Wide/landscape; rendered at ~10% under a white wash.            |
| `asset-camp-landscape-wide.png`  | Scenic banner on **ROPs X Camp 2026**                            | Wide/landscape; fades into the cream background.                |
| `asset-braai-grill-illustration.png` | "No braais planned" feature card on **Fundraising**         | Illustration; falls back to an in-app vector grill.            |
| `asset-braai-photo-evening.png`  | Thumbnails on **Fundraising → Past Braais**                      | Square-ish photo; `object-cover`. Falls back to a flame chip.   |
| `asset-soft-waves.png`           | Subtle background on Transport / Media / Finance empty states    | Wide; layered low-opacity over an inline SVG wave.             |
| `asset-botanical-corner.png`     | Corner ornament on the **Create Event** summary panel            | Transparent PNG sprig; layered over an inline SVG botanical.    |

> **Must be a true transparent PNG** (for the sprig/illustration assets). If an
> image shows a gray checkerboard, that grid is baked into the pixels (usually
> from screenshotting a transparent image instead of saving the original), and
> it will render on the page. Save the original transparent export.

The calendar chip ("16 JUN") and the Active Members trend chart are drawn in
**code** (real current date, real member growth), so they need no image files.
The empty-state scenes (tent, clapper, clipboard, approval seal, grill) are
also drawn in code as SVG — no image files required.
