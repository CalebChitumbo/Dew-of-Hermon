import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/config.dart';
import '../../services/auth_service.dart';
import '../../services/push_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _busyPush = false;

  Future<void> _enablePush() async {
    final auth = context.read<AuthService>();
    final push = context.read<PushService>();
    final uid = auth.profile?.id;
    if (uid == null) return;
    setState(() => _busyPush = true);
    final ok = await push.register(uid);
    if (mounted) {
      setState(() => _busyPush = false);
      showAppSnackBar(
        context,
        ok
            ? 'Push notifications enabled on this device.'
            : 'Could not enable push on this device.',
        isError: !ok,
      );
    }
  }

  Future<void> _signOut() async {
    final auth = context.read<AuthService>();
    final push = context.read<PushService>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text('Sign out?',
            style: Theme.of(dialogContext).textTheme.titleLarge),
        content: const Text(
            'You can sign back in anytime with the same account.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final uid = auth.profile?.id;
    if (uid != null) await push.unregister(uid);
    await auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<AuthService>().profile;
    if (profile == null) return const SizedBox.shrink();
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  InitialsAvatar(name: profile.name, radius: 28),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(profile.name, style: textTheme.titleLarge),
                        const SizedBox(height: 2),
                        Text(
                          profile.email,
                          style: textTheme.bodySmall
                              ?.copyWith(color: PWColors.clay400),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            _chip(context, profile.roleLabel,
                                gold: true),
                            if (profile.lifeGroup != null)
                              _chip(context,
                                  '${profile.lifeGroup} life group'),
                            if (profile.isStudent)
                              _chip(context, 'Student'),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const SectionHeader('Notifications'),
          Card(
            child: ListTile(
              leading: const Icon(Icons.notifications_active_outlined,
                  color: PWColors.goldDark),
              title: Text(
                'Push notifications',
                style: textTheme.bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              subtitle: Text(
                profile.pushEnabled
                    ? 'Enabled for your account'
                    : 'Get reminders and assignment alerts on this phone',
                style:
                    textTheme.bodySmall?.copyWith(color: PWColors.clay400),
              ),
              trailing: _busyPush
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : TextButton(
                      onPressed: _enablePush,
                      child: Text(
                          profile.pushEnabled ? 'Re-enable' : 'Enable'),
                    ),
            ),
          ),
          const SizedBox(height: 20),
          const SectionHeader('About'),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading:
                      const Icon(Icons.language, color: PWColors.teal),
                  title: Text('Connected to',
                      style: textTheme.bodySmall
                          ?.copyWith(color: PWColors.clay400)),
                  subtitle: Text(
                    AppConfig.backendBaseUrl
                        .replaceFirst(RegExp(r'^https?://'), ''),
                    style: textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w500),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.sync_outlined,
                      color: PWColors.teal),
                  title: Text(
                    'Everything here syncs live with the website — same '
                    'account, same data.',
                    style: textTheme.bodySmall
                        ?.copyWith(color: PWColors.clay500, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: _signOut,
            style: OutlinedButton.styleFrom(
              foregroundColor: PWColors.destructive,
              side: const BorderSide(color: Color(0xFFFECACA)),
            ),
            icon: const Icon(Icons.logout, size: 18),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }

  Widget _chip(BuildContext context, String label, {bool gold = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: gold ? PWColors.gold.withValues(alpha: 0.15) : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border:
            gold ? null : Border.all(color: PWColors.clay200),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: gold ? PWColors.goldDark : PWColors.clay600,
              fontWeight: gold ? FontWeight.w700 : FontWeight.w500,
            ),
      ),
    );
  }
}
