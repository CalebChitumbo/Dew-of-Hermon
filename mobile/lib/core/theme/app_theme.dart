import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Flip to `true` after running `tool/fetch_fonts.sh` and uncommenting the
/// `fonts:` block in pubspec.yaml. With bundled TTFs there is no first-run
/// download at all; with the default (`false`) `google_fonts` fetches each
/// family once and caches it in app storage, so camp still works offline
/// after a single online launch.
const bool kUseBundledFonts = false;

/// Standard corner radii, matching `--radius: 0.75rem` and the card/lux
/// radii the web layers on top of it.
abstract final class AppRadius {
  static const double sm = 8;
  static const double md = 10;
  static const double base = 12;
  static const double card = 16;
  static const double lux = 24;
  static const double pill = 999;
}

abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double page = 16;
}

/// Typography helpers. Every heading is DM Serif Display; body is DM Sans;
/// Cinzel is reserved for the login hero, matching the web.
abstract final class AppFonts {
  static TextStyle display(TextStyle base) => kUseBundledFonts
      ? base.copyWith(fontFamily: 'DM Serif Display')
      : GoogleFonts.dmSerifDisplay(textStyle: base);

  static TextStyle body(TextStyle base) => kUseBundledFonts
      ? base.copyWith(fontFamily: 'DM Sans')
      : GoogleFonts.dmSans(textStyle: base);

  static TextStyle cinzel(TextStyle base) => kUseBundledFonts
      ? base.copyWith(fontFamily: 'Cinzel')
      : GoogleFonts.cinzel(textStyle: base);

  static TextStyle fraunces(TextStyle base) => kUseBundledFonts
      ? base.copyWith(fontFamily: 'Fraunces')
      : GoogleFonts.fraunces(textStyle: base);

  static TextStyle manrope(TextStyle base) => kUseBundledFonts
      ? base.copyWith(fontFamily: 'Manrope')
      : GoogleFonts.manrope(textStyle: base);
}

abstract final class AppTheme {
  static ThemeData get light {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.clay700,
      onPrimary: AppColors.cream,
      primaryContainer: AppColors.clay100,
      onPrimaryContainer: AppColors.clay800,
      secondary: AppColors.gold,
      onSecondary: Colors.white,
      secondaryContainer: AppColors.clay100,
      onSecondaryContainer: AppColors.clay700,
      tertiary: AppColors.teal,
      onTertiary: Colors.white,
      error: AppColors.destructive,
      onError: Colors.white,
      surface: AppColors.card,
      onSurface: AppColors.foreground,
      surfaceContainerLowest: Colors.white,
      surfaceContainerLow: AppColors.cream,
      surfaceContainer: AppColors.muted,
      onSurfaceVariant: AppColors.mutedForeground,
      outline: AppColors.border,
      outlineVariant: AppColors.clay100,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.cream,
      splashFactory: InkSparkle.splashFactory,
    );

    final text = _textTheme(base.textTheme);

    return base.copyWith(
      textTheme: text,
      primaryTextTheme: text,
      appBarTheme: AppBarTheme(
        toolbarHeight: 56,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: AppColors.clay700,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: AppFonts.display(const TextStyle(
          fontSize: 19,
          color: AppColors.clay700,
          height: 1.2,
        )),
        iconTheme: const IconThemeData(color: AppColors.clay600, size: 22),
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        shape: const Border(
          bottom: BorderSide(color: AppColors.border, width: 1),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.clay700,
          foregroundColor: AppColors.cream,
          disabledBackgroundColor: AppColors.clay200,
          disabledForegroundColor: AppColors.clay500,
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          textStyle: AppFonts.body(const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          )),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.base),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.clay700,
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          side: const BorderSide(color: AppColors.border),
          textStyle: AppFonts.body(const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          )),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.base),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.goldDark,
          textStyle: AppFonts.body(const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          )),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        hintStyle: AppFonts.body(const TextStyle(
          fontSize: 14,
          color: AppColors.clay400,
        )),
        labelStyle: AppFonts.body(const TextStyle(
          fontSize: 14,
          color: AppColors.clay500,
        )),
        floatingLabelStyle: AppFonts.body(const TextStyle(
          fontSize: 13,
          color: AppColors.clay600,
          fontWeight: FontWeight.w600,
        )),
        border: _inputBorder(AppColors.border),
        enabledBorder: _inputBorder(AppColors.border),
        focusedBorder: _inputBorder(AppColors.gold, width: 1.6),
        errorBorder: _inputBorder(AppColors.destructive),
        focusedErrorBorder: _inputBorder(AppColors.destructive, width: 1.6),
        disabledBorder: _inputBorder(AppColors.border),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.clay100,
        selectedColor: AppColors.gold.withValues(alpha: 0.18),
        side: BorderSide.none,
        labelStyle: AppFonts.body(const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.clay600,
        )),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.goldDark,
        unselectedItemColor: AppColors.clay400,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        selectedLabelStyle: AppFonts.body(const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
        )),
        unselectedLabelStyle: AppFonts.body(const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w500,
        )),
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        width: 300,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lux),
        ),
        titleTextStyle: AppFonts.display(const TextStyle(
          fontSize: 20,
          color: AppColors.clay700,
        )),
        contentTextStyle: AppFonts.body(const TextStyle(
          fontSize: 14,
          color: AppColors.clay600,
          height: 1.5,
        )),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.lux),
          ),
        ),
        showDragHandle: true,
        dragHandleColor: AppColors.clay200,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.clay800,
        contentTextStyle: AppFonts.body(const TextStyle(
          fontSize: 14,
          color: AppColors.cream,
        )),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.base),
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? Colors.white : Colors.white,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? AppColors.gold
              : AppColors.clay200,
        ),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? AppColors.clay700
              : Colors.transparent,
        ),
        side: const BorderSide(color: AppColors.clay300, width: 1.5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(5),
        ),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? AppColors.clay700
              : AppColors.clay300,
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.gold,
        linearTrackColor: AppColors.clay100,
        circularTrackColor: Colors.transparent,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: AppColors.clay700,
        unselectedLabelColor: AppColors.clay400,
        indicatorColor: AppColors.gold,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: AppColors.border,
        labelStyle: AppFonts.body(const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        )),
        unselectedLabelStyle: AppFonts.body(const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
        )),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: AppColors.clay500,
        titleTextStyle: AppFonts.body(const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: AppColors.clay700,
        )),
        subtitleTextStyle: AppFonts.body(const TextStyle(
          fontSize: 13,
          color: AppColors.clay500,
        )),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.base),
        ),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: const BorderSide(color: AppColors.border),
        ),
        textStyle: AppFonts.body(const TextStyle(
          fontSize: 14,
          color: AppColors.clay600,
        )),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.clay700,
        foregroundColor: AppColors.cream,
      ),
    );
  }

  static OutlineInputBorder _inputBorder(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadius.base),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  static TextTheme _textTheme(TextTheme base) {
    TextStyle display(double size, {FontWeight? weight, double? height}) =>
        AppFonts.display(TextStyle(
          fontSize: size,
          fontWeight: weight,
          height: height ?? 1.15,
          color: AppColors.clay700,
        ));

    TextStyle body(double size, {FontWeight? weight, Color? color}) =>
        AppFonts.body(TextStyle(
          fontSize: size,
          fontWeight: weight ?? FontWeight.w400,
          height: 1.45,
          color: color ?? AppColors.foreground,
        ));

    return base.copyWith(
      displayLarge: display(38, weight: FontWeight.w400),
      displayMedium: display(32),
      displaySmall: display(28),
      headlineLarge: display(26),
      headlineMedium: display(22),
      headlineSmall: display(20),
      titleLarge: display(18),
      titleMedium: body(15, weight: FontWeight.w600, color: AppColors.clay700),
      titleSmall: body(13, weight: FontWeight.w600, color: AppColors.clay600),
      bodyLarge: body(15),
      bodyMedium: body(14),
      bodySmall: body(12, color: AppColors.mutedForeground),
      labelLarge: body(14, weight: FontWeight.w600),
      labelMedium: body(12, weight: FontWeight.w500, color: AppColors.clay500),
      labelSmall: body(11, weight: FontWeight.w500, color: AppColors.clay400),
    );
  }
}

/// Convenience accessors so screens read like the web's Tailwind classes.
extension AppTextStyles on BuildContext {
  TextTheme get t => Theme.of(this).textTheme;

  /// `text-[11px] uppercase tracking-[0.16em] text-clay-400` — the eyebrow
  /// label above every stat value.
  TextStyle get eyebrow => AppFonts.body(const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w500,
        letterSpacing: 1.6,
        color: AppColors.clay400,
      ));
}
