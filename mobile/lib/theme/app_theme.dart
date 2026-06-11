import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand palette mirroring the web app's Tailwind config
/// (clay / gold / teal / cream pottery theme).
class PWColors {
  PWColors._();

  static const cream = Color(0xFFFFF8F0);

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

  static const gold = Color(0xFFC8963E);
  static const goldLight = Color(0xFFE0B872);
  static const goldDark = Color(0xFF9A7230);

  static const teal = Color(0xFF4A9B8E);
  static const tealLight = Color(0xFF6DB8AB);
  static const tealDark = Color(0xFF357A6F);

  static const destructive = Color(0xFFEF4444);
}

ThemeData buildAppTheme() {
  final colorScheme = ColorScheme.light(
    primary: PWColors.clay700,
    onPrimary: PWColors.cream,
    secondary: PWColors.gold,
    onSecondary: Colors.white,
    tertiary: PWColors.teal,
    onTertiary: Colors.white,
    error: PWColors.destructive,
    onError: Colors.white,
    surface: Colors.white,
    onSurface: PWColors.clay800,
    surfaceContainerHighest: PWColors.clay100,
    outline: PWColors.clay200,
    outlineVariant: PWColors.clay100,
  );

  final baseText = GoogleFonts.dmSansTextTheme();
  TextStyle serif(TextStyle? base, {double? size, FontWeight? weight}) =>
      GoogleFonts.dmSerifDisplay(
        textStyle: base,
        fontSize: size,
        fontWeight: weight,
        color: PWColors.clay700,
      );

  final textTheme = baseText.copyWith(
    displaySmall: serif(baseText.displaySmall),
    headlineLarge: serif(baseText.headlineLarge),
    headlineMedium: serif(baseText.headlineMedium),
    headlineSmall: serif(baseText.headlineSmall),
    titleLarge: serif(baseText.titleLarge),
    bodyLarge: baseText.bodyLarge?.copyWith(color: PWColors.clay800),
    bodyMedium: baseText.bodyMedium?.copyWith(color: PWColors.clay800),
  );

  const radius = 12.0;

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: PWColors.cream,
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: PWColors.cream,
      foregroundColor: PWColors.clay700,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: serif(baseText.titleLarge, size: 24),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: PWColors.clay200.withValues(alpha: 0.7)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: PWColors.clay700,
        foregroundColor: PWColors.cream,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
        ),
        textStyle: baseText.labelLarge?.copyWith(fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: PWColors.clay700,
        side: const BorderSide(color: PWColors.clay200),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: PWColors.goldDark),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: const BorderSide(color: PWColors.clay200),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: const BorderSide(color: PWColors.clay200),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: const BorderSide(color: PWColors.gold, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: const BorderSide(color: PWColors.destructive),
      ),
      labelStyle: baseText.bodyMedium?.copyWith(color: PWColors.clay500),
      hintStyle: baseText.bodyMedium?.copyWith(color: PWColors.clay300),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: PWColors.gold.withValues(alpha: 0.18),
      surfaceTintColor: Colors.transparent,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? PWColors.goldDark
              : PWColors.clay400,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => baseText.labelSmall!.copyWith(
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected)
              ? PWColors.clay700
              : PWColors.clay500,
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: PWColors.clay100,
      labelStyle: baseText.labelSmall?.copyWith(color: PWColors.clay600),
      side: BorderSide.none,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    dividerTheme: const DividerThemeData(
      color: PWColors.clay100,
      thickness: 1,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: PWColors.clay800,
      contentTextStyle: baseText.bodyMedium?.copyWith(color: PWColors.cream),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(radius),
      ),
    ),
    progressIndicatorTheme:
        const ProgressIndicatorThemeData(color: PWColors.gold),
  );
}
