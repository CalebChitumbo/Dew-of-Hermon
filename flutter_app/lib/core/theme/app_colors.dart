import 'package:flutter/material.dart';

/// The Dew of Hermon palette, ported 1:1 from `tailwind.config.ts` and
/// `globals.css` — warm cream, clay browns, brand gold and teal.
class AppColors {
  AppColors._();

  // Clay scale (tailwind `clay`)
  static const clay50 = Color(0xFFFFF8F0);
  static const clay100 = Color(0xFFFAEBD7);
  static const clay200 = Color(0xFFF0D0A8);
  static const clay300 = Color(0xFFDEB887);
  static const clay400 = Color(0xFFC8963E);
  static const clay500 = Color(0xFFA0784A);
  static const clay600 = Color(0xFF7D5A3C);
  static const clay700 = Color(0xFF5B3A29);
  static const clay800 = Color(0xFF3E2518);
  static const clay900 = Color(0xFF2A180F);

  // Brand accents
  static const gold = Color(0xFFC8963E);
  static const goldLight = Color(0xFFE0B872);
  static const goldDark = Color(0xFF9A7230);
  static const cream = Color(0xFFFFF8F0);
  static const teal = Color(0xFF4A9B8E);
  static const tealLight = Color(0xFF6DB8AB);
  static const tealDark = Color(0xFF357A6F);

  // Semantic (shadcn-style tokens from globals.css)
  static const background = cream;
  static const foreground = Color(0xFF322014); // hsl(20 30% 15%)
  static const card = Colors.white;
  static const mutedForeground = Color(0xFF7E6E64); // hsl(20 10% 45%)
  static const border = Color(0xFFEADDD0); // hsl(30 20% 88%)
  static const destructive = Color(0xFFEF4444);

  // Status hues used across badges (tailwind defaults the web relies on)
  static const green600 = Color(0xFF16A34A);
  static const green100 = Color(0xFFDCFCE7);
  static const green700 = Color(0xFF15803D);
  static const emerald600 = Color(0xFF059669);
  static const emerald50 = Color(0xFFECFDF5);
  static const amber600 = Color(0xFFD97706);
  static const amber50 = Color(0xFFFFFBEB);
  static const amber100 = Color(0xFFFEF3C7);
  static const amber700 = Color(0xFFB45309);
  static const red500 = Color(0xFFEF4444);
  static const red100 = Color(0xFFFEE2E2);
  static const red600 = Color(0xFFDC2626);
  static const red700 = Color(0xFFB91C1C);
  static const blue600 = Color(0xFF2563EB);
  static const blue50 = Color(0xFFEFF6FF);
  static const blue100 = Color(0xFFDBEAFE);
  static const blue700 = Color(0xFF1D4ED8);
  static const rose500 = Color(0xFFF43F5E);
  static const rose50 = Color(0xFFFFF1F2);

  /// The warm shadow under lux cards: `rgba(91,58,41, …)`.
  static Color luxShadow(double opacity) =>
      Color.fromRGBO(91, 58, 41, opacity);
}

/// Soft editorial accent tones for icon "chips" — ported from
/// `src/lib/icon-tones.ts`. `bg` tints the chip, `fg` colors the icon.
class IconTone {
  final Color bg;
  final Color fg;
  const IconTone(this.bg, this.fg);

  static const sage = IconTone(Color(0xFFE6EDE4), Color(0xFF6E8A6C));
  static const periwinkle = IconTone(Color(0xFFE6E8F6), Color(0xFF6E74B8));
  static const lavender = IconTone(Color(0xFFEEE6F5), Color(0xFF8A6CB0));
  static const blush = IconTone(Color(0xFFF6E6EA), Color(0xFFBC7488));
  static const gold = IconTone(Color(0x26C8963E), AppColors.goldDark);
  static const teal = IconTone(Color(0x1A4A9B8E), AppColors.teal);
  static const blue = IconTone(AppColors.blue50, AppColors.blue600);
  static const clay = IconTone(AppColors.clay100, AppColors.clay500);
  static const emerald = IconTone(AppColors.emerald50, AppColors.emerald600);
  static const amber = IconTone(AppColors.amber50, AppColors.amber600);
  static const rose = IconTone(AppColors.rose50, AppColors.rose500);

  /// Glow color paired with each tone (used blurred behind empty states).
  Color get glow => fg;
}
