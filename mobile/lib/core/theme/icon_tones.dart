import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Soft, editorial accent tones for icon "chips" — a small coloured square
/// behind an icon. Port of `src/lib/icon-tones.ts`; the background/foreground
/// pairs and the glow colours are the same values the web uses.
enum IconTone {
  sage,
  periwinkle,
  lavender,
  blush,
  gold,
  teal,
  blue,
  clay,
  emerald,
  amber,
  rose,
}

class ToneColors {
  const ToneColors({
    required this.background,
    required this.foreground,
    required this.glow,
  });

  final Color background;
  final Color foreground;

  /// Solid colour used blurred at low opacity behind empty-state art.
  final Color glow;
}

const Map<IconTone, ToneColors> iconTones = {
  IconTone.sage: ToneColors(
    background: Color(0xFFE6EDE4),
    foreground: Color(0xFF6E8A6C),
    glow: Color(0xFF6E8A6C),
  ),
  IconTone.periwinkle: ToneColors(
    background: Color(0xFFE6E8F6),
    foreground: Color(0xFF6E74B8),
    glow: Color(0xFF6E74B8),
  ),
  IconTone.lavender: ToneColors(
    background: Color(0xFFEEE6F5),
    foreground: Color(0xFF8A6CB0),
    glow: Color(0xFF8A6CB0),
  ),
  IconTone.blush: ToneColors(
    background: Color(0xFFF6E6EA),
    foreground: Color(0xFFBC7488),
    glow: Color(0xFFBC7488),
  ),
  // bg-gold/15, text-gold-dark
  IconTone.gold: ToneColors(
    background: Color(0x26C8963E),
    foreground: AppColors.goldDark,
    glow: AppColors.gold,
  ),
  // bg-teal/10, text-teal
  IconTone.teal: ToneColors(
    background: Color(0x1A4A9B8E),
    foreground: AppColors.teal,
    glow: AppColors.teal,
  ),
  IconTone.blue: ToneColors(
    background: AppColors.blue50,
    foreground: AppColors.blue600,
    glow: Color(0xFF60A5FA),
  ),
  IconTone.clay: ToneColors(
    background: AppColors.clay100,
    foreground: AppColors.clay500,
    glow: AppColors.clay400,
  ),
  IconTone.emerald: ToneColors(
    background: AppColors.emerald50,
    foreground: AppColors.emerald600,
    glow: Color(0xFF34D399),
  ),
  IconTone.amber: ToneColors(
    background: AppColors.amber50,
    foreground: AppColors.amber600,
    glow: Color(0xFFFBBF24),
  ),
  IconTone.rose: ToneColors(
    background: AppColors.rose50,
    foreground: AppColors.rose500,
    glow: Color(0xFFFB7185),
  ),
};

/// Resolve a tone to its colours, defaulting to gold.
ToneColors toneColors([IconTone tone = IconTone.gold]) =>
    iconTones[tone] ?? iconTones[IconTone.gold]!;
