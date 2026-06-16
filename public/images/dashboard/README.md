# Dashboard decorative assets

Optional imagery for the dashboard. The UI references these by path and
**fails gracefully** — if a file is missing, a soft gradient / no-op is shown
instead, so the dashboard never looks broken. Drop the files in with these
exact names to light them up:

| File                | Where it shows                                              | Notes                                                                                       |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `welcome-hero.png`  | Left panel of the "Good evening" greeting hero              | The cross/altar/olive scene. Portrait-ish or square; `object-cover` crops it to fit.        |
| `leaf-accent.png`   | Bottom-right of "Today's devotional" + the "Next service" panel | Transparent PNG botanical sprig (e.g. the green olive branch). Purely decorative.       |
| `hero-flourish.png` | Faint sweep along the bottom of the greeting hero panel     | Transparent PNG gold wave/lines. Rendered at low opacity. Purely decorative.                |

If you use a `.jpg` instead of `.png`, update the matching `src` path in
`src/app/dashboard/page.tsx`.

The calendar chip ("16 JUN") and the Active Members trend chart are drawn in
**code** (real current date, real member growth), so they need no image files.
