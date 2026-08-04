import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_theme.dart';

/// Parchment sub-theme for the public fundraising storefront — warm paper,
/// deep ink, ember accents. Scoped by wrapping a subtree.
class ParchmentThemeScope extends StatelessWidget {
  const ParchmentThemeScope({super.key, required this.child});

  final Widget child;

  static ThemeData themeOf(BuildContext context) {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: ParchmentColors.ember,
      onPrimary: Colors.white,
      secondary: ParchmentColors.ink,
      onSecondary: ParchmentColors.paper,
      error: AppColors.destructive,
      onError: Colors.white,
      surface: ParchmentColors.paper,
      onSurface: ParchmentColors.ink,
      surfaceContainerHighest: ParchmentColors.paperDeep,
      onSurfaceVariant: ParchmentColors.inkSoft,
      outline: ParchmentColors.border,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: ParchmentColors.paper,
    );

    TextStyle heading(double size) => AppFonts.display(TextStyle(
          fontSize: size,
          height: 1.15,
          color: ParchmentColors.ink,
        ));

    TextStyle bodyStyle(double size,
            {FontWeight weight = FontWeight.w400, Color? color}) =>
        AppFonts.body(TextStyle(
          fontSize: size,
          fontWeight: weight,
          height: 1.5,
          color: color ?? ParchmentColors.ink,
        ));

    return base.copyWith(
      textTheme: base.textTheme.copyWith(
        displaySmall: heading(30),
        headlineMedium: heading(24),
        headlineSmall: heading(20),
        titleLarge: heading(18),
        titleMedium: bodyStyle(15, weight: FontWeight.w600),
        bodyLarge: bodyStyle(15),
        bodyMedium: bodyStyle(14),
        bodySmall: bodyStyle(12, color: ParchmentColors.inkSoft),
        labelLarge: bodyStyle(14, weight: FontWeight.w600),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: ParchmentColors.paper,
        surfaceTintColor: Colors.transparent,
        foregroundColor: ParchmentColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleTextStyle: heading(19),
      ),
      dividerTheme: const DividerThemeData(
        color: ParchmentColors.border,
        thickness: 1,
        space: 1,
      ),
      cardTheme: CardThemeData(
        color: const Color(0xFFFBF5E9),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: const BorderSide(color: ParchmentColors.border),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ParchmentColors.ember,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 50),
          textStyle: AppFonts.body(const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          )),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.base),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ParchmentColors.ink,
          side: const BorderSide(color: ParchmentColors.border),
          minimumSize: const Size(0, 50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.base),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFFBF5E9),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        hintStyle: bodyStyle(14, color: ParchmentColors.inkSoft),
        labelStyle: bodyStyle(14, color: ParchmentColors.inkSoft),
        border: _border(ParchmentColors.border),
        enabledBorder: _border(ParchmentColors.border),
        focusedBorder: _border(ParchmentColors.ember, width: 1.6),
        errorBorder: _border(AppColors.destructive),
        focusedErrorBorder: _border(AppColors.destructive, width: 1.6),
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
