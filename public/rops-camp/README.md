# ROPs Camp Photos

Drop the camp photos in this folder. They'll be served at
`https://<yourdomain>/rops-camp/<filename>` and referenced from
`src/app/rops-camp/page.tsx`.

## Expected filenames

The registration page slots map to these filenames (case-sensitive on
production servers):

| Filename          | Slot                                              |
| ----------------- | ------------------------------------------------- |
| `hero.jpg`        | Hero portrait — "Out of the shadows" (top right)  |
| `gallery-01.jpg`  | Full-width — Mornings, the mountain rises early   |
| `gallery-02.jpg`  | Triptych 1 — Brotherhood over nshima              |
| `gallery-03.jpg`  | Triptych 2 — Open palms (worship)                 |
| `gallery-04.jpg`  | Triptych 3 — Sitting under elders                 |
| `gallery-05.jpg`  | Vertical — The team behind the fire               |
| `gallery-06.jpg`  | Wide — When the room becomes holy                 |
| `gallery-07.jpg`  | Closing portrait — Joy is part of the journey     |

## Sizing tips

Optimise before uploading so the public page loads fast:

- **Hero**: ~1600 px wide, JPG quality ~80, target ≤ 400 KB
- **Gallery**: ~1200 px wide, JPG quality ~80, target ≤ 300 KB

`.jpg` is preferred. `.webp` also works — if you use webp instead, just
let me know and I'll update the references.

If a slot is missing, the page falls back to the placeholder gradient
that's currently there.
