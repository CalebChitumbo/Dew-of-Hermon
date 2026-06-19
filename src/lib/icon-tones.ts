// Soft, editorial accent tones for icon "chips" — a small coloured circle/square
// behind a lucide icon. These mirror the palette used on the redesigned
// dashboard (sage, periwinkle, lavender, blush) plus the brand gold/teal.
//
// Usage: <span className={`... ${iconTones.sage}`}><Icon /></span>

export const iconTones = {
  sage: "bg-[#E6EDE4] text-[#6E8A6C]",
  periwinkle: "bg-[#E6E8F6] text-[#6E74B8]",
  lavender: "bg-[#EEE6F5] text-[#8A6CB0]",
  blush: "bg-[#F6E6EA] text-[#BC7488]",
  gold: "bg-gold/15 text-gold-dark",
  teal: "bg-teal/10 text-teal",
  blue: "bg-blue-50 text-blue-600",
  clay: "bg-clay-100 text-clay-500",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-500",
} as const;

export type IconTone = keyof typeof iconTones;

/** Resolve a tone name to its classes, defaulting to gold. */
export function toneClass(tone: IconTone = "gold"): string {
  return iconTones[tone];
}

/**
 * Soft glow colours (solid bg, used blurred at low opacity) that pair with each
 * tone — for the circular halos behind premium empty-state illustrations.
 */
export const toneGlow: Record<IconTone, string> = {
  sage: "bg-[#6E8A6C]",
  periwinkle: "bg-[#6E74B8]",
  lavender: "bg-[#8A6CB0]",
  blush: "bg-[#BC7488]",
  gold: "bg-gold",
  teal: "bg-teal",
  blue: "bg-blue-400",
  clay: "bg-clay-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
};
