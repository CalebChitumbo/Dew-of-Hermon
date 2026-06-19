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

**Wired and live** (clean, full-bleed images):

| File                             | Where it shows                                                | Notes                                          |
| -------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `asset-camp-landscape-wide.png`  | Scenic banner on **ROPs X Camp 2026**                         | Wide; `object-cover`, fades into the cream.     |
| `asset-braai-photo-evening.png`  | Thumbnails on **Fundraising → Past Braais**                   | `object-cover`; falls back to a flame chip.     |
| `asset-church-interior-wide.png` | Faint atmosphere behind the **Departments** stats strip       | Rendered at ~10% under a white wash.            |

**Pending a clean re-export** — these were uploaded as screenshots of
transparent images, so the grey checkerboard is **baked into the pixels** (no
alpha channel) and would render on the page. Until they're re-exported as
**true transparent PNGs** (or flattened onto a solid cream background), the UI
deliberately uses its in-app vector/gradient art instead of these files:

| File                                 | Intended use                                          | Currently shows                 |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------- |
| `asset-chapel-minimal.png`           | Featured "Next service" card on **Services & Rotas**  | Gold gradient + chapel icon     |
| `asset-braai-grill-illustration.png` | "No braais planned" card on **Fundraising**           | In-app vector grill             |
| `asset-soft-waves.png`               | Empty-state backdrop on Transport / Media / Finance   | In-app SVG waves                |
| `asset-botanical-corner.png`         | Corner ornament on the **Create Event** summary panel | In-app SVG botanical sprig      |

> **Must be a true transparent PNG.** If an image shows a gray checkerboard,
> that grid is baked into the pixels (usually from screenshotting a transparent
> image instead of saving the original), and it will render on the page. Save
> the original transparent export. Once a clean version is dropped in with the
> same filename, re-wiring it is a one-line change per page.

The calendar chip ("16 JUN") and the Active Members trend chart are drawn in
**code** (real current date, real member growth), so they need no image files.
The empty-state scenes (tent, clapper, clipboard, approval seal, grill) are
also drawn in code as SVG — no image files required.
