import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import '../theme/icon_tones.dart';

/// "Lux" — the premium layer on top of the flat editorial primitives. Warm,
/// spacious cards with soft shadows, icon badges and gentle ornaments. Port of
/// `src/components/shared/lux.tsx`, so Services, Calendar, Departments, the
/// request queues, ROPs Camp and Fundraising all share one visual language
/// with the dashboard.

/// Warm-white card surface with a beige hairline border and a low, warm
/// shadow — `rounded-3xl border-clay-100/80 bg-white/80 shadow-[...]`.
class LuxCard extends StatelessWidget {
  const LuxCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
    this.radius = AppRadius.lux,
    this.color,
    this.border,
    this.accent,
    this.margin,
    this.clip = true,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double radius;
  final Color? color;
  final Color? border;

  /// A coloured bar along the bottom edge, as the web's `accent` prop does.
  final Color? accent;
  final EdgeInsetsGeometry? margin;
  final bool clip;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);

    Widget content = Padding(padding: padding, child: child);
    if (accent != null) {
      content = Stack(
        children: [
          content,
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(height: 5, color: accent),
          ),
        ],
      );
    }

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: color ?? Colors.white,
        borderRadius: shape,
        border: Border.all(color: border ?? AppColors.clay100),
        boxShadow: AppColors.luxShadow,
      ),
      clipBehavior: clip ? Clip.antiAlias : Clip.none,
      child: Material(
        color: Colors.transparent,
        child: onTap == null
            ? content
            : InkWell(
                onTap: onTap,
                borderRadius: shape,
                splashColor: AppColors.gold.withValues(alpha: 0.06),
                highlightColor: AppColors.cream.withValues(alpha: 0.5),
                child: content,
              ),
      ),
    );
  }
}

/// A small coloured square holding an icon — the "chip" the whole app uses to
/// tag a section, stat or list row.
class IconChip extends StatelessWidget {
  const IconChip(
    this.icon, {
    super.key,
    this.tone = IconTone.gold,
    this.size = 44,
    this.iconSize,
    this.radius,
  });

  final IconData icon;
  final IconTone tone;
  final double size;
  final double? iconSize;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final colors = toneColors(tone);
    return Container(
      height: size,
      width: size,
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(radius ?? size * 0.36),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: iconSize ?? size * 0.44, color: colors.foreground),
    );
  }
}

/// Large soft stat card — `StatCardLux`.
class StatCardLux extends StatelessWidget {
  const StatCardLux({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.tone = IconTone.gold,
    this.hint,
    this.accent,
    this.onTap,
    this.highlight = false,
  });

  final IconData icon;
  final IconTone tone;
  final String label;
  final String value;
  final String? hint;
  final Color? accent;
  final VoidCallback? onTap;

  /// A pulsing dot, for a queue that needs attention.
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      onTap: onTap,
      accent: accent,
      padding: EdgeInsets.fromLTRB(18, 18, 18, accent != null ? 22 : 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconChip(icon, tone: tone, size: 46),
              if (highlight) const _PulseDot(),
            ],
          ),
          const SizedBox(height: 18),
          Text(label.toUpperCase(),
              style: context.eyebrow,
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 6),
          Text(
            value,
            style: AppFonts.display(const TextStyle(
              fontSize: 30,
              height: 1,
              color: AppColors.clay700,
            )),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (hint != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Flexible(
                  child: Text(
                    hint!,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.clay400),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (onTap != null) ...[
                  const SizedBox(width: 4),
                  const Icon(AppIcons.forward,
                      size: 12, color: AppColors.clay400),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot();

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.45, end: 1.0).animate(_c),
      child: Container(
        height: 10,
        width: 10,
        decoration: BoxDecoration(
          color: const Color(0xFFF87171),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFF87171).withValues(alpha: 0.18),
              spreadRadius: 5,
            ),
          ],
        ),
      ),
    );
  }
}

/// One entry in a [StatStripLux].
class StripItem {
  const StripItem({
    required this.icon,
    required this.label,
    required this.value,
    this.tone = IconTone.gold,
    this.hint,
    this.onTap,
    this.highlight = false,
  });

  final IconData icon;
  final IconTone tone;
  final String label;
  final String value;
  final String? hint;
  final VoidCallback? onTap;
  final bool highlight;
}

/// Connected stat strip — one rounded card, divided. On a phone the web's
/// `lg:flex-row` never applies, so this is the two-column grid variant.
class StatStripLux extends StatelessWidget {
  const StatStripLux({super.key, required this.items, this.columns = 2});

  final List<StripItem> items;
  final int columns;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final rows = <Widget>[];
    for (var i = 0; i < items.length; i += columns) {
      final slice = items.sublist(
          i, (i + columns).clamp(0, items.length));
      rows.add(IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var j = 0; j < columns; j++)
              Expanded(
                child: j < slice.length
                    ? _cell(slice[j], showLeftBorder: j > 0)
                    : const SizedBox.shrink(),
              ),
          ],
        ),
      ));
      if (i + columns < items.length) {
        rows.add(const Divider(height: 1, color: AppColors.clay100));
      }
    }

    return LuxCard(
      padding: EdgeInsets.zero,
      child: Column(mainAxisSize: MainAxisSize.min, children: rows),
    );
  }

  Widget _cell(StripItem it, {required bool showLeftBorder}) {
    final content = Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconChip(it.icon, tone: it.tone, size: 40),
              if (it.highlight) const _PulseDot(),
            ],
          ),
          const SizedBox(height: 14),
          Builder(
            builder: (context) => Text(it.label.toUpperCase(),
                style: context.eyebrow,
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(height: 4),
          Text(
            it.value,
            style: AppFonts.display(const TextStyle(
              fontSize: 25,
              height: 1,
              color: AppColors.clay700,
            )),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (it.hint != null) ...[
            const SizedBox(height: 6),
            Text(it.hint!,
                style:
                    const TextStyle(fontSize: 11.5, color: AppColors.clay400),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ],
        ],
      ),
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        border: showLeftBorder
            ? const Border(left: BorderSide(color: AppColors.clay100))
            : null,
      ),
      child: it.onTap == null
          ? content
          : Material(
              color: Colors.transparent,
              child: InkWell(onTap: it.onTap, child: content),
            ),
    );
  }
}

/// Section heading with an icon badge and a fading rule — `SectionHeadingLux`.
class SectionHeading extends StatelessWidget {
  const SectionHeading({
    super.key,
    required this.title,
    this.icon,
    this.tone = IconTone.gold,
    this.subtitle,
    this.action,
    this.padding = EdgeInsets.zero,
  });

  final String title;
  final IconData? icon;
  final IconTone tone;
  final String? subtitle;
  final Widget? action;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (icon != null) ...[
            IconChip(icon!, tone: tone, size: 38),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: AppFonts.display(const TextStyle(
                    fontSize: 18,
                    height: 1.2,
                    color: AppColors.clay700,
                  )),
                ),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(subtitle!,
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.clay400)),
                  ),
              ],
            ),
          ),
          if (action != null) ...[const SizedBox(width: 8), action!],
        ],
      ),
    );
  }
}

/// Premium empty state with a soft glow behind the icon — `EmptyStateLux`.
class EmptyStateLux extends StatelessWidget {
  const EmptyStateLux({
    super.key,
    required this.title,
    this.icon,
    this.tone = IconTone.sage,
    this.description,
    this.action,
    this.note,
  });

  final String title;
  final IconData? icon;
  final IconTone tone;
  final String? description;
  final Widget? action;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final colors = toneColors(tone);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null)
              Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    height: 130,
                    width: 130,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(colors: [
                        colors.glow.withValues(alpha: 0.16),
                        colors.glow.withValues(alpha: 0),
                      ]),
                    ),
                  ),
                  IconChip(icon!, tone: tone, size: 74, radius: AppRadius.lux),
                ],
              ),
            const SizedBox(height: 22),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppFonts.display(const TextStyle(
                fontSize: 20,
                color: AppColors.clay700,
              )),
            ),
            if (description != null) ...[
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 340),
                child: Text(
                  description!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.55,
                    color: AppColors.clay500,
                  ),
                ),
              ),
            ],
            if (action != null) ...[const SizedBox(height: 22), action!],
            if (note != null) ...[
              const SizedBox(height: 26),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 360),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.cream.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: AppColors.clay100),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(AppIcons.info,
                          size: 15, color: AppColors.clay400),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          note!,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.55,
                            color: AppColors.clay500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A soft wave ornament, drawn in code so it always renders.
class SoftWaves extends StatelessWidget {
  const SoftWaves({super.key, this.color = AppColors.clay100, this.height = 90});

  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(painter: _WavePainter(color)),
    );
  }
}

class _WavePainter extends CustomPainter {
  const _WavePainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    void wave(double startY, double opacity) {
      final w = size.width;
      final h = size.height;
      final path = Path()
        ..moveTo(0, h * startY)
        ..cubicTo(w * 0.2, h * (startY - 0.25), w * 0.33, h * (startY + 0.25),
            w * 0.53, h * startY)
        ..cubicTo(w * 0.73, h * (startY - 0.25), w * 0.87, h * (startY - 0.25),
            w, h * startY)
        ..lineTo(w, h)
        ..lineTo(0, h)
        ..close();
      canvas.drawPath(path, Paint()..color = color.withValues(alpha: opacity));
    }

    wave(0.6, 0.5);
    wave(0.75, 0.7);
  }

  @override
  bool shouldRepaint(_WavePainter old) => old.color != color;
}
