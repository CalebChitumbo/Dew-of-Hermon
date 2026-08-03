import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// "Lux" — the premium layer ported from `src/components/shared/lux.tsx`.
/// Warm, spacious cards with soft shadows, rounded corners, icon tone chips
/// and serif display values, shared by every redesigned page.

/// Warm-white card surface with a beige hairline border and a low warm shadow.
class LuxSurface extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final Clip clipBehavior;

  const LuxSurface({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.clipBehavior = Clip.antiAlias,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(AppTheme.radiusLux),
        border: Border.all(color: AppColors.clay100.withValues(alpha: 0.8)),
        boxShadow: [
          BoxShadow(
            color: AppColors.luxShadow(0.16),
            blurRadius: 45,
            offset: const Offset(0, 18),
            spreadRadius: -32,
          ),
        ],
      ),
      clipBehavior: clipBehavior,
      child: padding != null ? Padding(padding: padding!, child: child) : child,
    );

    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusLux),
        child: card,
      ),
    );
  }
}

/// A small rounded square tinted with an [IconTone], holding an icon.
class IconChip extends StatelessWidget {
  final IconData icon;
  final IconTone tone;
  final double size;
  final double iconSize;
  final double radius;

  const IconChip({
    super.key,
    required this.icon,
    this.tone = IconTone.gold,
    this.size = 44,
    this.iconSize = 20,
    this.radius = 16,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: tone.bg,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: Colors.white.withValues(alpha: 0.5)),
      ),
      child: Icon(icon, size: iconSize, color: tone.fg),
    );
  }
}

/// The pulsing red attention dot used on stat cards with pending items.
class AttentionDot extends StatelessWidget {
  final double size;
  const AttentionDot({super.key, this.size = 10});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
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
    );
  }
}

/// Large soft stat card — port of `StatCardLux`.
class StatCardLux extends StatelessWidget {
  final IconData icon;
  final IconTone tone;
  final String label;
  final String value;
  final String? hint;
  final Color? accent;
  final VoidCallback? onTap;
  final bool highlight;

  const StatCardLux({
    super.key,
    required this.icon,
    this.tone = IconTone.gold,
    required this.label,
    required this.value,
    this.hint,
    this.accent,
    this.onTap,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return LuxSurface(
      onTap: onTap,
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconChip(icon: icon, tone: tone, size: 48, radius: 16),
                    if (highlight) const AttentionDot(),
                  ],
                ),
                const SizedBox(height: 20),
                Text(label.toUpperCase(), style: AppText.microLabel()),
                const SizedBox(height: 6),
                Text(
                  value,
                  style: AppText.display(size: 30, height: 1.0),
                ),
                if (hint != null) ...[
                  const SizedBox(height: 10),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          hint!,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                              size: 12, color: AppColors.clay400),
                        ),
                      ),
                      if (onTap != null) ...[
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_forward,
                            size: 12, color: AppColors.goldDark),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (accent != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(height: 6, color: accent),
            ),
        ],
      ),
    );
  }
}

class StripItem {
  final IconData icon;
  final IconTone tone;
  final String label;
  final String value;
  final String? hint;
  final VoidCallback? onTap;
  final bool highlight;

  const StripItem({
    required this.icon,
    this.tone = IconTone.gold,
    required this.label,
    required this.value,
    this.hint,
    this.onTap,
    this.highlight = false,
  });
}

/// Connected stat strip — one rounded card, divided. Port of `StatStripLux`.
/// On phones the items stack vertically with hairline dividers.
class StatStripLux extends StatelessWidget {
  final List<StripItem> items;
  const StatStripLux({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    final wide = MediaQuery.of(context).size.width >= 640;

    if (!wide) {
      return LuxSurface(
        child: Column(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0)
                Divider(
                    height: 1,
                    color: AppColors.clay100.withValues(alpha: 0.8)),
              _StripCell(item: items[i]),
            ],
          ],
        ),
      );
    }

    return LuxSurface(
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0)
                VerticalDivider(
                    width: 1,
                    color: AppColors.clay100.withValues(alpha: 0.8)),
              Expanded(child: _StripCell(item: items[i])),
            ],
          ],
        ),
      ),
    );
  }
}

class _StripCell extends StatelessWidget {
  final StripItem item;
  const _StripCell({required this.item});

  @override
  Widget build(BuildContext context) {
    final cell = Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconChip(icon: item.icon, tone: item.tone),
              if (item.highlight) const AttentionDot(size: 8),
            ],
          ),
          const SizedBox(height: 16),
          Text(item.label.toUpperCase(), style: AppText.microLabel()),
          const SizedBox(height: 4),
          Text(item.value, style: AppText.display(size: 27, height: 1.0)),
          if (item.hint != null) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    item.hint!,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(size: 12, color: AppColors.clay400),
                  ),
                ),
                if (item.onTap != null) ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.arrow_forward,
                      size: 12, color: AppColors.goldDark),
                ],
              ],
            ),
          ],
        ],
      ),
    );

    if (item.onTap == null) return cell;
    return InkWell(
      onTap: item.onTap,
      child: cell,
    );
  }
}

/// Segmented control — port of `SegmentedTabsList` / `SegmentedTab`.
/// A cream inset track holding equal-width tabs; the active tab is a white
/// card with a gold hairline.
class SegmentedTabs extends StatelessWidget {
  final List<SegmentedTabItem> tabs;
  final String value;
  final ValueChanged<String> onChanged;
  final bool scrollable;

  const SegmentedTabs({
    super.key,
    required this.tabs,
    required this.value,
    required this.onChanged,
    this.scrollable = false,
  });

  @override
  Widget build(BuildContext context) {
    final track = Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: AppColors.cream.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.clay100.withValues(alpha: 0.8)),
      ),
      child: scrollable
          ? SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [for (final t in tabs) _tab(t, expand: false)],
              ),
            )
          : Row(
              children: [for (final t in tabs) _tab(t, expand: true)],
            ),
    );
    return track;
  }

  Widget _tab(SegmentedTabItem t, {required bool expand}) {
    final active = t.value == value;
    final child = AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      margin: const EdgeInsets.symmetric(horizontal: 1.5),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: active ? Colors.white : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: active
              ? AppColors.gold.withValues(alpha: 0.35)
              : Colors.transparent,
        ),
        boxShadow: active
            ? [
                BoxShadow(
                  color: AppColors.luxShadow(0.20),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                  spreadRadius: -18,
                ),
              ]
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (t.icon != null) ...[
            Icon(t.icon,
                size: 16,
                color: active ? AppColors.clay700 : AppColors.clay500),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              t.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 13,
                weight: FontWeight.w500,
                color: active ? AppColors.clay700 : AppColors.clay500,
              ),
            ),
          ),
          if (t.count != null && t.count! > 0) ...[
            const SizedBox(width: 4),
            Container(
              constraints: const BoxConstraints(minWidth: 20),
              height: 20,
              padding: const EdgeInsets.symmetric(horizontal: 6),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active
                    ? AppColors.gold.withValues(alpha: 0.15)
                    : AppColors.clay100,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${t.count}',
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w600,
                  color: active ? AppColors.goldDark : AppColors.clay500,
                ),
              ),
            ),
          ],
        ],
      ),
    );

    final tappable = GestureDetector(
      onTap: () => onChanged(t.value),
      behavior: HitTestBehavior.opaque,
      child: child,
    );
    return expand ? Expanded(child: tappable) : tappable;
  }
}

class SegmentedTabItem {
  final String value;
  final String label;
  final IconData? icon;
  final int? count;

  const SegmentedTabItem({
    required this.value,
    required this.label,
    this.icon,
    this.count,
  });
}

/// Premium empty state with a soft tonal glow — port of `EmptyStateLux`.
class EmptyStateLux extends StatelessWidget {
  final IconData icon;
  final IconTone tone;
  final String title;
  final String? description;
  final Widget? action;
  final Widget? note;

  const EmptyStateLux({
    super.key,
    required this.icon,
    this.tone = IconTone.sage,
    required this.title,
    this.description,
    this.action,
    this.note,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 56),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 160,
            height: 130,
            child: Stack(
              alignment: Alignment.center,
              children: [
                ImageFiltered(
                  imageFilter: ImageFilter.blur(sigmaX: 40, sigmaY: 40),
                  child: Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      color: tone.glow.withValues(alpha: 0.14),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                IconChip(
                    icon: icon, tone: tone, size: 80, iconSize: 36, radius: 24),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: AppText.display(size: 21),
          ),
          if (description != null) ...[
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Text(
                description!,
                textAlign: TextAlign.center,
                style: AppText.body(
                    size: 13.5, color: AppColors.clay500, height: 1.5),
              ),
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: 24),
            action!,
          ],
          if (note != null) ...[
            const SizedBox(height: 28),
            Container(
              constraints: const BoxConstraints(maxWidth: 420),
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.cream.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: AppColors.clay100.withValues(alpha: 0.8)),
              ),
              child: DefaultTextStyle(
                style: AppText.body(
                    size: 12, color: AppColors.clay500, height: 1.5),
                child: note!,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Section heading with an icon chip and a fading rule — `SectionHeadingLux`.
class SectionHeadingLux extends StatelessWidget {
  final IconData? icon;
  final IconTone tone;
  final String title;
  final String? subtitle;
  final Widget? actions;

  const SectionHeadingLux({
    super.key,
    this.icon,
    this.tone = IconTone.gold,
    required this.title,
    this.subtitle,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (icon != null) ...[
          IconChip(icon: icon!, tone: tone, size: 40, radius: 14),
          const SizedBox(width: 12),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: AppText.display(size: 18, height: 1.2),
                  overflow: TextOverflow.ellipsis),
              if (subtitle != null)
                Text(subtitle!,
                    style: AppText.body(size: 13, color: AppColors.clay400),
                    overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
        if (actions != null) ...[
          const SizedBox(width: 8),
          actions!,
        ],
      ],
    );
  }
}

/// Decorative image loaded from the deployed web app; hides itself if the
/// asset is missing — port of `DecorImage`.
class DecorImage extends StatelessWidget {
  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double opacity;

  const DecorImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.opacity = 1,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: opacity,
      child: Image.network(
        url,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
      ),
    );
  }
}
