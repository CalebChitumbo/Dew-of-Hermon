# Dashboard decorative assets

Optional imagery for the dashboard. The UI references these by path and
**fails gracefully** — if a file is missing, a soft gradient/no-op is shown
instead, so the dashboard never looks broken. Drop the files in with these
exact names to light them up:

| File               | Where it shows                                  | Notes                                                                 |
| ------------------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| `welcome-hero.png` | Left panel of the "Good evening" greeting hero  | Portrait-ish or square works best (e.g. ~800×1000). `object-cover` crops it to fit. JPG also fine — if you use `.jpg`, update the path in `HeroArt` (src/app/dashboard/page.tsx). |
| `leaf-accent.png`  | Bottom-right of the "Today's devotional" card and the "Next service" panel | Transparent PNG botanical/leaf sprig. Fully optional — purely decorative. |

The calendar chip ("JUN 16") and the Active Members trend chart are drawn in
code (real current date, real member growth), so they need no image files.
