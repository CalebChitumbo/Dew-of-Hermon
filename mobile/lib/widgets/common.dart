import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Pill badge for assignment statuses, matching the web StatusBadge colors.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (label, fg, bg) = switch (status) {
      'CONFIRMED' => ('Confirmed', PWColors.tealDark, const Color(0xFFE2F3F0)),
      'DECLINED' => ('Declined', const Color(0xFFB91C1C), const Color(0xFFFEE2E2)),
      'NO_RESPONSE' => ('No response', PWColors.clay500, PWColors.clay100),
      'PENDING' => ('Pending', PWColors.goldDark, const Color(0xFFFCF0DC)),
      _ => (status, PWColors.clay500, PWColors.clay100),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: fg,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

/// Small colored chip for an event type.
class EventTypeChip extends StatelessWidget {
  const EventTypeChip({super.key, required this.type, required this.label});

  final String type;
  final String label;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = switch (type) {
      'POTTERS_WHEEL_SERVICE' => (PWColors.goldDark, const Color(0xFFFCF0DC)),
      'ROPS_CAMP' => (PWColors.tealDark, const Color(0xFFE2F3F0)),
      'RETREAT' => (const Color(0xFF7C3AED), const Color(0xFFF3E8FF)),
      'SPECIAL_EVENT' => (const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
      'OUTREACH' => (const Color(0xFF059669), const Color(0xFFD1FAE5)),
      _ => (PWColors.clay600, PWColors.clay100),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: fg,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

/// Uppercase tracking section label, like the web's "MINISTRY PULSE".
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: PWColors.clay500,
                  letterSpacing: 1.8,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              height: 1,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [PWColors.clay200, Colors.transparent],
                ),
              ),
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar({super.key, required this.name, this.radius = 22});

  final String name;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+'));
    final initials = parts.take(2).map((p) => p.isEmpty ? '' : p[0]).join();
    return CircleAvatar(
      radius: radius,
      backgroundColor: PWColors.gold.withValues(alpha: 0.18),
      child: Text(
        initials.toUpperCase(),
        style: TextStyle(
          color: PWColors.goldDark,
          fontWeight: FontWeight.w700,
          fontSize: radius * 0.72,
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: PWColors.teal.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(icon, color: PWColors.teal, size: 28),
          ),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: textTheme.titleMedium?.copyWith(
              color: PWColors.clay700,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(
              subtitle!,
              textAlign: TextAlign.center,
              style: textTheme.bodySmall?.copyWith(color: PWColors.clay400),
            ),
          ],
        ],
      ),
    );
  }
}

void showAppSnackBar(BuildContext context, String message,
    {bool isError = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor:
            isError ? const Color(0xFFB91C1C) : PWColors.clay800,
      ),
    );
}
