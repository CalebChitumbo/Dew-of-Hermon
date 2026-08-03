import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../access/access_provider.dart';
import '../auth/auth_provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import 'lux.dart';

/// Standard page header — back affordance, optional icon chip, editorial
/// display title, muted description, and actions.
/// Port of `src/components/shared/PageHeader.tsx`.
class PageHeader extends StatelessWidget {
  final String title;
  final String? description;
  final String? backTo;
  final IconData? icon;
  final IconTone tone;
  final List<Widget> actions;

  const PageHeader({
    super.key,
    required this.title,
    this.description,
    this.backTo,
    this.icon,
    this.tone = IconTone.gold,
    this.actions = const [],
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (backTo != null)
              Padding(
                padding: const EdgeInsets.only(right: 4, top: 2),
                child: IconButton(
                  onPressed: () => context.go(backTo!),
                  icon: const Icon(Icons.arrow_back, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            if (icon != null)
              Padding(
                padding: const EdgeInsets.only(right: 12, top: 2),
                child: IconChip(icon: icon!, tone: tone, radius: 16),
              ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppText.display(size: 24, height: 1.15)),
                  if (description != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        description!,
                        style: AppText.body(
                            size: 14, color: AppColors.clay500, height: 1.5),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
        if (actions.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Wrap(spacing: 8, runSpacing: 8, children: actions),
          ),
      ],
    );
  }
}

/// Flat, airy metric tile — port of `StatTile` ("Ministry Pulse" style).
class StatTile extends StatelessWidget {
  final IconData icon;
  final IconTone tone;
  final String label;
  final String value;
  final String? hint;
  final VoidCallback? onTap;
  final bool highlight;

  const StatTile({
    super.key,
    required this.icon,
    this.tone = IconTone.gold,
    required this.label,
    required this.value,
    this.hint,
    this.onTap,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    final body = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.clay100.withValues(alpha: 0.7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconChip(icon: icon, tone: tone, size: 40, radius: 12),
              if (highlight) const AttentionDot(size: 8),
            ],
          ),
          const SizedBox(height: 16),
          Text(label.toUpperCase(), style: AppText.microLabel()),
          const SizedBox(height: 4),
          Text(value, style: AppText.display(size: 24, height: 1.0)),
          if (hint != null) ...[
            const SizedBox(height: 8),
            Text(
              hint!,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(size: 12, color: AppColors.clay400),
            ),
          ],
        ],
      ),
    );
    if (onTap == null) return body;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: body,
    );
  }
}

/// Calm, editorial empty state — port of `EmptyState`.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? description;
  final IconTone tone;
  final Widget? action;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.description,
    this.tone = IconTone.clay,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 64),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconChip(icon: icon, tone: tone, size: 56, iconSize: 28, radius: 16),
          const SizedBox(height: 16),
          Text(title,
              textAlign: TextAlign.center,
              style: AppText.display(
                  size: 18, weight: FontWeight.w600, color: AppColors.clay600)),
          if (description != null) ...[
            const SizedBox(height: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 384),
              child: Text(
                description!,
                textAlign: TextAlign.center,
                style: AppText.body(size: 13, color: AppColors.clay400),
              ),
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: 20),
            action!,
          ],
        ],
      ),
    );
  }
}

/// Spinning loader — a gold-topped ring on clay, port of `LoadingSpinner`.
class LoadingSpinner extends StatelessWidget {
  final double size;
  const LoadingSpinner({super.key, this.size = 32});

  const LoadingSpinner.small({super.key}) : size = 16;
  const LoadingSpinner.large({super.key}) : size = 48;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: size,
        height: size,
        child: const CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.gold,
          backgroundColor: AppColors.clay200,
        ),
      ),
    );
  }
}

/// Full-height loader with the "Loading..." caption — port of `PageLoader`.
class PageLoader extends StatelessWidget {
  const PageLoader({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const LoadingSpinner.large(),
          const SizedBox(height: 16),
          Text('Loading...',
              style: AppText.body(size: 13, color: AppColors.clay500)),
        ],
      ),
    );
  }
}

/// Uppercase letter-spaced section label with a fading hairline rule —
/// port of `SectionHeading`.
class SectionHeading extends StatelessWidget {
  final String title;
  final Widget? actions;

  const SectionHeading({super.key, required this.title, this.actions});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title.toUpperCase(),
          style: AppText.body(
            size: 13,
            weight: FontWeight.w500,
            color: AppColors.clay500,
          ).copyWith(letterSpacing: 2.08),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Container(
            height: 1,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.clay200, Colors.transparent],
              ),
            ),
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

/// Controlled expandable section divider — port of `CollapsibleSection`.
class CollapsibleSection extends StatelessWidget {
  final String title;
  final int? count;
  final bool open;
  final VoidCallback onToggle;
  final Widget child;

  const CollapsibleSection({
    super.key,
    required this.title,
    this.count,
    required this.open,
    required this.onToggle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: onToggle,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                AnimatedRotation(
                  turns: open ? 0.25 : 0,
                  duration: const Duration(milliseconds: 150),
                  child: const Icon(Icons.chevron_right,
                      size: 16, color: AppColors.clay400),
                ),
                const SizedBox(width: 12),
                Text(
                  title.toUpperCase(),
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w500,
                    color: AppColors.clay500,
                  ).copyWith(letterSpacing: 2.08),
                ),
                if (count != null && count! > 0) ...[
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.clay100,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text('$count',
                        style: AppText.body(
                            size: 12,
                            weight: FontWeight.w500,
                            color: AppColors.clay500)),
                  ),
                ],
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    height: 1,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.clay200, Colors.transparent],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (open)
          Padding(padding: const EdgeInsets.only(top: 16), child: child),
      ],
    );
  }
}

/// Assignment status badge with the emoji dot — port of `StatusBadge`.
class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg, dot) = switch (status) {
      'CONFIRMED' => ('Confirmed', AppColors.green100, AppColors.green700, '🟢'),
      'PENDING' => ('Pending', AppColors.amber100, AppColors.amber700, '🟡'),
      'DECLINED' => ('Declined', AppColors.red100, AppColors.red700, '🔴'),
      'NO_RESPONSE' => (
          'No Response',
          AppColors.clay100,
          AppColors.clay600,
          null
        ),
      'UNASSIGNED' => ('Unassigned', Colors.white, AppColors.clay500, '🔴'),
      _ => (status, AppColors.clay100, AppColors.clay600, null),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: status == 'UNASSIGNED'
            ? Border.all(color: AppColors.border)
            : null,
      ),
      child: Text(
        dot != null ? '$dot $label' : label,
        style: AppText.body(size: 12, weight: FontWeight.w500, color: fg),
      ),
    );
  }
}

/// General-purpose tinted pill for arbitrary status strings.
class AppBadge extends StatelessWidget {
  final String label;
  final Color bg;
  final Color fg;

  const AppBadge({
    super.key,
    required this.label,
    this.bg = AppColors.clay100,
    this.fg = AppColors.clay600,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: AppText.body(size: 12, weight: FontWeight.w500, color: fg)),
    );
  }
}

/// Notification bell with a live unread badge — port of `NotificationBell`.
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = context.watch<AuthProvider>().firebaseUser?.uid;
    if (uid == null) return const SizedBox.shrink();

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('notifications')
          .where('userId', isEqualTo: uid)
          .where('isRead', isEqualTo: false)
          .snapshots(),
      builder: (context, snapshot) {
        final unread = snapshot.data?.size ?? 0;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            IconButton(
              onPressed: () => context.push('/notifications'),
              icon: const Icon(Icons.notifications_none, size: 22),
            ),
            if (unread > 0)
              Positioned(
                right: 4,
                top: 4,
                child: Container(
                  width: 18,
                  height: 18,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: AppColors.red500,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    unread > 9 ? '9+' : '$unread',
                    style: AppText.body(
                        size: 9, weight: FontWeight.w700, color: Colors.white),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Access gate — port of `RoleProtected`. Wrap a screen's body; shows the
/// loader while access resolves and an Access Denied panel when refused.
class RoleProtected extends StatelessWidget {
  final Widget child;
  final String? pageKey;
  final String? requiredRole;
  final bool requireEdit;
  final Widget? fallback;

  const RoleProtected({
    super.key,
    required this.child,
    this.pageKey,
    this.requiredRole,
    this.requireEdit = false,
    this.fallback,
  });

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final accessControl = context.watch<AccessControlProvider>();

    if (auth.loading || accessControl.loading) return const PageLoader();

    final user = auth.userData;
    if (user == null) return _denied();

    if (pageKey != null) {
      final hasAccess = requireEdit
          ? accessControl.canEditPage(pageKey!, user.role)
          : accessControl.canAccessPage(pageKey!, user.role);
      if (!hasAccess) return _denied();
    } else if (requiredRole != null) {
      const hierarchy = {
        'SUPER_ADMIN': 6,
        'VICE_CHAIRPERSON': 5,
        'ADMIN': 4,
        'DEPARTMENT_LEAD': 3,
        'YOUTH_LEADER': 2,
        'MEMBER': 1,
      };
      if ((hierarchy[user.role] ?? 0) < (hierarchy[requiredRole] ?? 7)) {
        return _denied();
      }
    }

    return child;
  }

  Widget _denied() {
    if (fallback != null) return fallback!;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Access Denied', style: AppText.display(size: 24)),
          const SizedBox(height: 8),
          Text(
            "You don't have permission to view this page.",
            style: AppText.body(color: AppColors.clay500),
          ),
        ],
      ),
    );
  }
}

/// Gate on a feature key (e.g. scan-only camp roles) rather than a page key.
class FeatureProtected extends StatelessWidget {
  final Widget child;
  final String featureKey;
  final Widget? fallback;

  const FeatureProtected({
    super.key,
    required this.child,
    required this.featureKey,
    this.fallback,
  });

  @override
  Widget build(BuildContext context) {
    final features = context.watch<FeatureAccessProvider>();
    if (features.loading) return const PageLoader();
    if (!features.can(featureKey)) {
      return fallback ??
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Access Denied', style: AppText.display(size: 24)),
                const SizedBox(height: 8),
                Text(
                  "You don't have permission to view this page.",
                  style: AppText.body(color: AppColors.clay500),
                ),
              ],
            ),
          );
    }
    return child;
  }
}

/// Toast helpers mirroring the web app's `useToast` calls.
void showToast(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: error ? AppColors.red600 : AppColors.clay800,
    ),
  );
}

/// The signed-in user avatar circle (initial on gold), used in the drawer.
class UserAvatar extends StatelessWidget {
  final String name;
  final double size;

  const UserAvatar({super.key, required this.name, this.size = 36});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: 0.2),
        shape: BoxShape.circle,
      ),
      child: Text(
        name.isEmpty ? '?' : name[0].toUpperCase(),
        style: AppText.body(
          size: size * 0.4,
          weight: FontWeight.w700,
          color: AppColors.goldDark,
        ),
      ),
    );
  }
}

/// A labelled fb.User-less guard: renders [child] only when signed in, else
/// redirects handled by the router. Utility for rare inline checks.
class SignedInOnly extends StatelessWidget {
  final Widget child;
  const SignedInOnly({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final user = fb.FirebaseAuth.instance.currentUser;
    return user == null ? const PageLoader() : child;
  }
}
