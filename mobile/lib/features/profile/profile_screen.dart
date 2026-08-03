import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/access/access_providers.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/auth/auth_service.dart';
import '../../core/push/push_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/user.dart';

/// My profile — name and phone, password change, life group and department
/// memberships, and the push-notification switch.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _seeded = false;
  bool _savingProfile = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _seed(AppUser user) {
    if (_seeded) return;
    _name.text = user.name;
    _phone.text = user.phone ?? '';
    _seeded = true;
  }

  Future<void> _saveProfile(AppUser user) async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      context.showError('Your name cannot be empty.');
      return;
    }
    setState(() => _savingProfile = true);
    try {
      await ref.read(apiClientProvider).patch(
        '/api/members/${user.id}',
        body: {
          'name': name,
          'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        },
      );
      if (mounted) context.showSuccess('Profile updated.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(userOrNullProvider);
    final access = ref.watch(accessProvider);
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];

    if (user == null) {
      return const AppScaffold(title: 'Profile', body: LoadingView());
    }
    _seed(user);

    final myDepartments =
        departments.where((d) => user.departmentIds.contains(d.id)).toList();
    final ledDepartments = departments
        .where((d) => user.leadsDepartmentIds.contains(d.id))
        .toList();

    return AppScaffold(
      title: 'Profile',
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          _IdentityCard(user: user, roleLabel: access.role.label),
          const SizedBox(height: 18),

          const SectionHeading(
            title: 'Your details',
            icon: AppIcons.user,
            tone: IconTone.periwinkle,
          ),
          const SizedBox(height: 12),
          LuxCard(
            child: Column(
              children: [
                AppTextField(
                  label: 'Full name',
                  controller: _name,
                  required: true,
                  textCapitalization: TextCapitalization.words,
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'Phone',
                  controller: _phone,
                  hint: '097X XXX XXX',
                  keyboardType: TextInputType.phone,
                  textCapitalization: TextCapitalization.none,
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'Email',
                  initialValue: user.email,
                  enabled: false,
                ),
                const SizedBox(height: 6),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Your email is your sign-in and cannot be changed here.',
                    style: TextStyle(fontSize: 11.5, color: AppColors.clay400),
                  ),
                ),
                const SizedBox(height: 18),
                PrimaryButton(
                  label: 'Save changes',
                  loading: _savingProfile,
                  onPressed: () => _saveProfile(user),
                  icon: AppIcons.check,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          const SectionHeading(
            title: 'Departments',
            icon: AppIcons.department,
            tone: IconTone.sage,
          ),
          const SizedBox(height: 12),
          LuxCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                if (myDepartments.isEmpty && ledDepartments.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'You are not in a department yet. Ask a lead to add you, '
                      'or request to join from Ministries → Departments.',
                      style: TextStyle(
                          fontSize: 13,
                          height: 1.5,
                          color: AppColors.clay400),
                    ),
                  ),
                for (final d in ledDepartments)
                  LuxTile(
                    title: d.name,
                    subtitle: 'You lead this department',
                    icon: AppIcons.forName(d.icon),
                    tone: IconTone.gold,
                    dense: true,
                    trailing: const StatusBadge('Lead',
                        tone: IconTone.gold, dense: true),
                  ),
                for (final d in myDepartments)
                  if (!user.leadsDepartmentIds.contains(d.id))
                    LuxTile(
                      title: d.name,
                      subtitle: d.description,
                      icon: AppIcons.forName(d.icon),
                      tone: IconTone.sage,
                      dense: true,
                    ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          const SectionHeading(
            title: 'Membership',
            icon: AppIcons.usersRound,
            tone: IconTone.lavender,
          ),
          const SizedBox(height: 12),
          LuxCard(
            child: Column(
              children: [
                DetailRow(
                  label: 'Life Group',
                  value: user.lifeGroup?.label ?? 'Not set',
                  icon: AppIcons.usersRound,
                ),
                const LuxDivider(indent: 0),
                DetailRow(
                  label: 'Student',
                  value: user.isStudent ? 'Yes' : 'No',
                  icon: AppIcons.graduation,
                ),
                const LuxDivider(indent: 0),
                DetailRow(
                  label: 'Member since',
                  value: D.medium(user.createdAt),
                  icon: AppIcons.calendar,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          const SectionHeading(
            title: 'Notifications',
            icon: AppIcons.bell,
            tone: IconTone.amber,
          ),
          const SizedBox(height: 12),
          const PushNotificationCard(),
          const SizedBox(height: 24),

          const SectionHeading(
            title: 'Security',
            icon: AppIcons.lock,
            tone: IconTone.clay,
          ),
          const SizedBox(height: 12),
          const _PasswordCard(),
          const SizedBox(height: 24),

          OutlinedButton.icon(
            onPressed: () => _signOut(context),
            icon: const Icon(AppIcons.logout, size: 17),
            label: const Text('Sign out'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.destructive,
              side: BorderSide(
                  color: AppColors.destructive.withValues(alpha: 0.3)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _signOut(BuildContext context) async {
    final ok = await confirmAction(
      context,
      title: 'Sign out?',
      message: 'You will need to sign in again to use the app.',
      confirmLabel: 'Sign out',
      destructive: true,
    );
    if (!ok) return;
    await ref.read(authServiceProvider).signOut();
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.user, required this.roleLabel});

  final AppUser user;
  final String roleLabel;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          MemberAvatar(
            initials: user.initials,
            imageUrl: user.profileImage,
            size: 60,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  user.name,
                  style: AppFonts.display(const TextStyle(
                    fontSize: 21,
                    color: AppColors.clay700,
                  )),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  user.email,
                  style: const TextStyle(
                      fontSize: 12.5, color: AppColors.clay400),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 9),
                StatusBadge(roleLabel, tone: IconTone.gold),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The push-notification opt-in. Registers the device's FCM token with
/// `POST /api/fcm-tokens`, and deletes it on opt-out.
class PushNotificationCard extends ConsumerStatefulWidget {
  const PushNotificationCard({super.key});

  @override
  ConsumerState<PushNotificationCard> createState() =>
      _PushNotificationCardState();
}

class _PushNotificationCardState extends ConsumerState<PushNotificationCard> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(userOrNullProvider);
    final enabled = user?.pushEnabled ?? false;

    return LuxCard(
      child: Row(
        children: [
          IconChip(
            enabled ? AppIcons.bell : AppIcons.bell,
            tone: enabled ? IconTone.emerald : IconTone.clay,
          ),
          const SizedBox(width: 13),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Push notifications',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.clay700,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Rota reminders, approvals and camp announcements on this '
                  'device.',
                  style: TextStyle(
                      fontSize: 12, height: 1.4, color: AppColors.clay400),
                ),
              ],
            ),
          ),
          if (_busy)
            const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Switch(
              value: enabled,
              onChanged: (v) => _toggle(v, user?.id),
            ),
        ],
      ),
    );
  }

  Future<void> _toggle(bool value, String? userId) async {
    if (userId == null) return;
    setState(() => _busy = true);
    try {
      final push = ref.read(pushServiceProvider);
      if (value) {
        final granted = await push.requestPermissionAndRegister(userId);
        if (!granted && mounted) {
          context.showError(
            'Notifications are turned off for this app. Enable them in your '
            'phone settings, then try again.',
          );
        }
      } else {
        await push.unregister(userId);
      }
    } catch (e) {
      if (mounted) context.showError('$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _PasswordCard extends ConsumerStatefulWidget {
  const _PasswordCard();

  @override
  ConsumerState<_PasswordCard> createState() => _PasswordCardState();
}

class _PasswordCardState extends ConsumerState<_PasswordCard> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _expanded = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _change() async {
    if (_next.text.length < 6) {
      context.showError('Choose a password of at least 6 characters.');
      return;
    }
    if (_next.text != _confirm.text) {
      context.showError('The new passwords do not match.');
      return;
    }

    setState(() => _busy = true);
    try {
      final auth = FirebaseAuth.instance;
      final user = auth.currentUser;
      final email = user?.email;
      if (user == null || email == null) {
        throw FirebaseAuthException(
          code: 'no-user',
          message: 'You are signed out.',
        );
      }
      // Firebase requires a recent sign-in before a password change.
      await user.reauthenticateWithCredential(
        EmailAuthProvider.credential(
            email: email, password: _current.text),
      );
      await user.updatePassword(_next.text);
      if (mounted) {
        _current.clear();
        _next.clear();
        _confirm.clear();
        setState(() => _expanded = false);
        context.showSuccess('Password changed.');
      }
    } catch (e) {
      if (mounted) context.showError(AuthService.describeError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                const IconChip(AppIcons.lock, tone: IconTone.clay),
                const SizedBox(width: 13),
                const Expanded(
                  child: Text(
                    'Change password',
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.clay700,
                    ),
                  ),
                ),
                Icon(_expanded ? AppIcons.chevronUp : AppIcons.chevronDown,
                    size: 16, color: AppColors.clay400),
              ],
            ),
          ),
          if (_expanded) ...[
            const SizedBox(height: 18),
            AppTextField(
              label: 'Current password',
              controller: _current,
              obscureText: true,
              required: true,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'New password',
              controller: _next,
              obscureText: true,
              required: true,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Confirm new password',
              controller: _confirm,
              obscureText: true,
              required: true,
            ),
            const SizedBox(height: 18),
            PrimaryButton(
              label: 'Update password',
              loading: _busy,
              onPressed: _change,
            ),
          ],
        ],
      ),
    );
  }
}
