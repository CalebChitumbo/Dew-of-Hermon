import 'package:flutter/material.dart';

/// "Clay & Gold" — the palette the web app defines in `tailwind.config.ts`
/// and `src/app/globals.css`. Kept token-for-token so a screen ported from
/// the web lands on exactly the same colours.
abstract final class AppColors {
  // ── Clay ramp ──
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

  // ── Gold ──
  static const gold = Color(0xFFC8963E);
  static const goldLight = Color(0xFFE0B872);
  static const goldDark = Color(0xFF9A7230);

  // ── Teal ──
  static const teal = Color(0xFF4A9B8E);
  static const tealLight = Color(0xFF6DB8AB);
  static const tealDark = Color(0xFF357A6F);

  // ── Surfaces ──
  static const cream = Color(0xFFFFF8F0);
  static const card = Color(0xFFFFFFFF);

  /// `--foreground: 20 30% 15%`
  static const foreground = Color(0xFF31221A);

  /// `--muted-foreground: 20 10% 45%`
  static const mutedForeground = Color(0xFF7F6E67);

  /// `--muted: 30 20% 94%`
  static const muted = Color(0xFFF4F0EB);

  /// `--secondary: 30 30% 90%`
  static const secondary = Color(0xFFEFE5DB);

  /// `--border: 30 20% 88%`
  static const border = Color(0xFFE8DFD6);

  // ── Semantic ──
  static const destructive = Color(0xFFEF4444);
  static const success = Color(0xFF10B981);
  static const warning = Color(0xFFF59E0B);
  static const info = Color(0xFF3B82F6);

  // ── Status ramps used by badges across the app ──
  static const emerald50 = Color(0xFFECFDF5);
  static const emerald600 = Color(0xFF059669);
  static const amber50 = Color(0xFFFFFBEB);
  static const amber600 = Color(0xFFD97706);
  static const rose50 = Color(0xFFFFF1F2);
  static const rose500 = Color(0xFFF43F5E);
  static const blue50 = Color(0xFFEFF6FF);
  static const blue600 = Color(0xFF2563EB);
  static const slate50 = Color(0xFFF8FAFC);
  static const slate500 = Color(0xFF64748B);

  /// The warm, low shadow every "lux" surface carries.
  /// `0 18px 45px -32px rgba(91,58,41,0.40)`
  static List<BoxShadow> get luxShadow => const [
        BoxShadow(
          color: Color(0x2B5B3A29),
          blurRadius: 24,
          offset: Offset(0, 10),
          spreadRadius: -8,
        ),
      ];

  /// A slightly deeper lift, for pressed/elevated cards.
  static List<BoxShadow> get luxShadowRaised => const [
        BoxShadow(
          color: Color(0x385B3A29),
          blurRadius: 34,
          offset: Offset(0, 16),
          spreadRadius: -10,
        ),
      ];
}

/// The ROPs public sub-theme — dark ink and ember, used on the four public
/// camp screens only. Scoped by a wrapper widget, never applied app-wide.
abstract final class RopsColors {
  static const ink = Color(0xFF16110D);
  static const inkSoft = Color(0xFF221A14);
  static const cream = Color(0xFFF4EEE3);
  static const ember = Color(0xFFD14A1F);
  static const emberSoft = Color(0xFFE8703F);
  static const sand = Color(0xFFC9B79C);
  static const border = Color(0x1AF4EEE3);
}

/// The parchment sub-theme used by the fundraising storefront.
abstract final class ParchmentColors {
  static const paper = Color(0xFFF4EBD9);
  static const paperDeep = Color(0xFFE9DCC3);
  static const ink = Color(0xFF2B1810);
  static const inkSoft = Color(0xFF6B5545);
  static const ember = Color(0xFFB4531F);
  static const border = Color(0xFFD8C6A8);
}
