# Potter's Shockers Menu Photos

Drop the food photos in this folder. They're served at
`https://<yourdomain>/images/fundraising/<filename>` and picked up
automatically by `src/app/fundraising/order/page.tsx`.

## Expected filenames

Each filename must match the menu item's stable key exactly:

| Filename               | Menu item        |
| ---------------------- | ---------------- |
| `sausage_chips.jpg`    | Sausage & Chips  |
| `chicken_chips.jpg`    | Chicken & Chips  |
| `chips_only.jpg`       | Chips Only       |
| `cold_drink.jpg`       | Cold Drink       |
| `bottled_water.jpg`    | Bottled Water    |

## Sizing tips

Optimise before uploading so the order page loads fast on phones:

- ~800 px wide, JPG quality ~80, target ≤ 200 KB

`.jpg` is preferred. If you want to use `.webp` or `.png` instead,
update the `imagePath` field for that item in
`src/lib/fundraising-menu.ts`.

## Missing photos

If a file is missing the order page automatically falls back to the
item's emoji (🌭 🍗 🍟 🥤 💧), so partial coverage is fine — add photos
as you have them.
