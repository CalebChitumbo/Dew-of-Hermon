# Dashboard decorative assets

Optional imagery for the dashboard. The UI references these by path and
**fails gracefully** — if a file is missing, a soft gradient / no-op is shown
instead, so the dashboard never looks broken. Drop the files in with these
exact names to light them up:

| File               | Where it shows                                                  | Notes                                                                          |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `welcome-hero.png` | Left panel of the "Good evening" greeting hero                  | The cross/altar/olive scene. Portrait-ish or square; `object-cover` crops it.  |
| `leaf-accent.png`  | Bottom-right of "Today's devotional" + the "Next service" panel | Transparent PNG botanical sprig. Purely decorative.                            |

> **Must be a true transparent PNG.** If an image shows a gray checkerboard,
> that grid is baked into the pixels (usually from screenshotting a transparent
> image instead of saving the original), and it will render on the page. Save
> the original transparent export, not a screenshot.

The calendar chip ("16 JUN") and the Active Members trend chart are drawn in
**code** (real current date, real member growth), so they need no image files.
