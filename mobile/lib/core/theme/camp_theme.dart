import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_theme.dart';

/// The ROPs public sub-theme — dark ink, cream type, ember accent, with
/// Fraunces headings over Manrope body. Applied by wrapping a subtree, never
/// app-wide, so only the four public camp screens carry it.
class RopsThemeScope extends StatelessWidget {
  const RopsThemeScope({super.key, required this.child});

  final Widget child;

  static ThemeData themeOf(BuildContext context) {
    const scheme = ColorScheme(
      brightness: Brightness.dark,
      primary: RopsColors.ember,
      onPrimary: Colors.white,
      secondary: RopsColors.sand,
      onSecondary: RopsColors.ink,
      error: Color(0xFFFF6B6B),
      onError: Colors.white,
      surface: RopsColors.ink,
      onSurface: RopsColors.cream,
      surfaceContainerHighest: RopsColors.inkSoft,
      onSurfaceVariant: RopsColors.sand,
      outline: RopsColors.border,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: RopsColors.ink,
    );

    TextStyle heading(double size, {FontWeight weight = FontWeight.w600}) =>
        AppFonts.fraunces(TextStyle(
          fontSize: size,
          fontWeight: weight,
          height: 1.12,
          color: RopsColors.cream,
        ));

    TextStyle bodyStyle(double size,
            {FontWeight weight = FontWeight.w400, Color? color}) =>
        AppFonts.manrope(TextStyle(
          fontSize: size,
          fontWeight: weight,
          height: 1.55,
          color: color ?? RopsColors.cream,
        ));

    return base.copyWith(
      textTheme: base.textTheme.copyWith(
        displayLarge: heading(40, weight: FontWeight.w700),
        displayMedium: heading(34, weight: FontWeight.w700),
        displaySmall: heading(28, weight: FontWeight.w700),
        headlineMedium: heading(24),
        headlineSmall: heading(20),
        titleLarge: heading(18),
        titleMedium: bodyStyle(15, weight: FontWeight.w600),
        bodyLarge: bodyStyle(15),
        bodyMedium: bodyStyle(14),
        bodySmall: bodyStyle(12, color: RopsColors.sand),
        labelLarge: bodyStyle(14, weight: FontWeight.w600),
        labelMedium: bodyStyle(12, weight: FontWeight.w600, color: RopsColors.sand),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: RopsColors.ink,
        surfaceTintColor: Colors.transparent,
        foregroundColor: RopsColors.cream,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleTextStyle: heading(19),
      ),
      dividerTheme: const DividerThemeData(
        color: RopsColors.border,
        thickness: 1,
        space: 1,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: RopsColors.ember,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 52),
          textStyle: AppFonts.manrope(const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          )),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.base),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: RopsColors.cream,
          side: const BorderSide(color: Color(0x33F4EEE3)),
          minimumSize: const Size(0, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.base),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: RopsColors.inkSoft,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        hintStyle: bodyStyle(14, color: RopsColors.sand.withValues(alpha: 0.7)),
        labelStyle: bodyStyle(14, color: RopsColors.sand),
        border: _border(RopsColors.border),
        enabledBorder: _border(RopsColors.border),
        focusedBorder: _border(RopsColors.ember, width: 1.6),
        errorBorder: _border(const Color(0xFFFF6B6B)),
        focusedErrorBorder: _border(const Color(0xFFFF6B6B), width: 1.6),
      ),
      cardTheme: CardThemeData(
        color: RopsColors.inkSoft,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: const BorderSide(color: RopsColors.border),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: RopsColors.ember,
        linearTrackColor: RopsColors.border,
      ),
    );
  }

  static OutlineInputBorder _border(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadius.base),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Theme(data: themeOf(context), child: child);
  }
}
