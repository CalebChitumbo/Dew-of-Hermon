# Potter's Shockers Menu Photos

Drop the food photos in this folder. They're served at
`https://<yourdomain>/images/fundraising/<filename>` and picked up
automatically by `src/app/fundraising/order/page.tsx`.

## Expected filenames

Each filename must match the menu item's stable key exactly:

| Filename               | Menu item          | Price |
| ---------------------- | ------------------ | ----- |
| `chicken_piece.jpg`    | 1 Piece Chicken    | K30   |
| `sausage.jpg`          | Sausage            | K30   |
| `chicken_chips.jpg`    | Chicken & Chips    | K60   |
| `sausage_chips.jpg`    | Sausage & Chips    | K60   |

Every meal comes with complimentary coleslaw on the side, so you don't
need a separate photo for the salad — the public page mentions it
right under the menu heading.

## Sizing tips

Optimise before uploading so the order page loads fast on phones:

- ~800 px wide, JPG quality ~80, target ≤ 200 KB

`.jpg` is preferred. If you want to use `.webp` or `.png` instead,
update the `imagePath` field for that item in
`src/lib/fundraising-menu.ts`.

## Missing photos

If a file is missing the order page automatically falls back to the
item's emoji (🍗 🌭), so partial coverage is fine — add photos as you
have them.
