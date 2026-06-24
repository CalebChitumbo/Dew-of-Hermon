import type { BibleHighlightColor } from "@/types";

/** The highlight palette offered in the reader, in swatch order. */
export const HIGHLIGHT_COLORS: BibleHighlightColor[] = [
  "gold",
  "sage",
  "blue",
  "rose",
  "lavender",
];

/** Soft page-tint applied to a highlighted verse. */
export const highlightTint: Record<BibleHighlightColor, string> = {
  gold: "bg-gold/15",
  sage: "bg-[#E6EDE4]",
  blue: "bg-blue-50",
  rose: "bg-rose-50",
  lavender: "bg-[#EEE6F5]",
};

/** Solid swatch used in the colour picker. */
export const highlightSwatch: Record<BibleHighlightColor, string> = {
  gold: "bg-gold",
  sage: "bg-[#6E8A6C]",
  blue: "bg-blue-400",
  rose: "bg-rose-400",
  lavender: "bg-[#8A6CB0]",
};
