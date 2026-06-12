import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/access_service.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import 'camp/camp_admin_screen.dart';
import 'community/affirmations_manage_screen.dart';
import 'community/departments_screen.dart';
import 'community/devotionals_manage_screen.dart';
import 'community/followups_screen.dart';
import 'events/approvals_screen.dart';
import 'events/create_event_screen.dart';
import 'events/events_manage_screen.dart';
import 'fundraising/braai_manage_screen.dart';
import 'members/members_screen.dart';
import 'queues/finance_screen.dart';
import 'queues/food_screen.dart';
import 'queues/media_screen.dart';
import 'queues/transport_screen.dart';
import 'services/services_screen.dart';

class _Tool {
  const _Tool(this.label, this.hint, this.icon, this.color, this.builder);

  final String label;
  final String hint;
  final IconData icon;
  final Color color;
  final WidgetBuilder builder;
}

/// The leadership hub — mirrors the web sidebar's manage sections, showing
/// only the tools the signed-in person may use.
class ManageHub extends StatelessWidget {
  const ManageHub({super.key});

  /// Whether the hub tab should appear at all for this user.
  static bool anyAccess(AccessService access, UserProfile? profile) {
    if (profile == null) return false;
    return _sections(access, profile).isNotEmpty;
  }

  static List<(String, List<_Tool>)> _sections(
      AccessService access, UserProfile profile) {
    final role = profile.role;
    bool feature(String key) => access.checkFeature(profile, key);
    bool page(String key) => access.canAccessPage(key, role);
    bool pageEdit(String key) => access.canEditPage(key, role);

    final sections = <(String, List<_Tool>)>[];

    final events = <_Tool>[
      if (page('events_approvals') ||
          feature('approve_events') ||
          feature('vice_chair_approve_events') ||
          feature('chair_approve_events'))
        _Tool('Approvals', 'Event approval chain', Icons.fact_check_outlined,
            const Color(0xFF2563EB),
            (_) => const ApprovalsScreen()),
      if (feature('create_events'))
        _Tool('New event', 'Submit for approval', Icons.calendar_month,
            PWColors.goldDark, (_) => const CreateEventScreen()),
      if (hasMinRole(role, 'DEPARTMENT_LEAD'))
        _Tool('All events', 'Status of every event', Icons.event_note,
            PWColors.teal,
            (context) => EventsManageScreen(
                canCreate: access.checkFeature(profile, 'create_events'))),
    ];
    if (events.isNotEmpty) sections.add(('Events', events));

    final servicesTools = <_Tool>[
      if (page('services'))
        _Tool('Services & rotas', 'Assign and track roles',
            Icons.church_outlined, PWColors.goldDark,
            (context) =>
                ServicesScreen(canEdit: pageEdit('services'))),
    ];
    if (servicesTools.isNotEmpty) sections.add(('Services', servicesTools));

    final people = <_Tool>[
      if (page('members'))
        _Tool('Members', 'Directory, roles, departments',
            Icons.people_outline, PWColors.teal,
            (context) => MembersScreen(canEdit: pageEdit('members'))),
    ];
    if (people.isNotEmpty) sections.add(('People', people));

    final queues = <_Tool>[
      if (feature('approve_accounts') || page('accounts_approvals'))
        _Tool('Finance', 'Treasurer budget queue',
            Icons.account_balance_wallet_outlined, const Color(0xFF059669),
            (_) => const FinanceApprovalsScreen()),
      if (feature('manage_transport_logistics') ||
          feature('approve_accounts') ||
          page('transport_requests'))
        _Tool('Transport', 'Cost & approve transport',
            Icons.directions_bus_outlined, const Color(0xFF2563EB),
            (_) => const TransportQueueScreen()),
      if (feature('manage_media') || page('media_requests'))
        _Tool('Media', 'Confirm & assign roles', Icons.videocam_outlined,
            const Color(0xFF7C3AED), (_) => const MediaQueueScreen()),
      if (feature('confirm_food') || page('food_requests'))
        _Tool('Food', 'Catering confirmations', Icons.restaurant_outlined,
            const Color(0xFFEA580C), (_) => const FoodQueueScreen()),
    ];
    if (queues.isNotEmpty) sections.add(('Coordination queues', queues));

    final programs = <_Tool>[
      if (feature('plan_fundraising_braai') ||
          feature('manage_fundraising_orders'))
        _Tool('Braais', 'Roster & order queue', Icons.outdoor_grill_outlined,
            const Color(0xFFDC2626), (_) => const BraaiManageScreen()),
      if (feature('manage_camp_registrations'))
        _Tool('ROPs Camp', 'Registrations & payments',
            Icons.cabin_outlined, const Color(0xFFEA580C),
            (_) => const CampAdminScreen()),
    ];
    if (programs.isNotEmpty) sections.add(('Programs', programs));

    final community = <_Tool>[
      if (feature('submit_follow_up') ||
          feature('manage_follow_ups') ||
          feature('view_assigned_follow_ups') ||
          feature('approve_follow_up'))
        _Tool('Follow-ups', 'Discipleship pipeline', Icons.favorite_outline,
            const Color(0xFFE11D48), (_) => const FollowUpsScreen()),
      if (feature('manage_devotionals') ||
          feature('manage_life_group_devotionals'))
        _Tool('Devotionals', 'Post the weekly word',
            Icons.menu_book_outlined, const Color(0xFF7C3AED),
            (_) => const DevotionalsManageScreen()),
      if (feature('manage_affirmations'))
        _Tool('Affirmations', 'Encourage the team', Icons.auto_awesome,
            const Color(0xFFDB2777),
            (_) => const AffirmationsManageScreen()),
      if (page('departments'))
        _Tool('Departments', 'Members & task boards', Icons.groups_outlined,
            PWColors.teal, (_) => const DepartmentsScreen()),
    ];
    if (community.isNotEmpty) sections.add(('Community', community));

    return sections;
  }

  @override
  Widget build(BuildContext context) {
    final access = context.watch<AccessService>();
    final profile = context.watch<AuthService>().profile;
    if (profile == null) return const SizedBox.shrink();
    final sections = _sections(access, profile);
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Manage')),
      body: sections.isEmpty
          ? const EmptyState(
              icon: Icons.lock_outline,
              title: 'No management tools for your role',
              subtitle: 'Leaders and admins see their tools here.',
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
              children: [
                for (final (title, tools) in sections) ...[
                  SectionHeader(title),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.55,
                    children: [
                      for (final tool in tools)
                        Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: tool.builder),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 34,
                                    height: 34,
                                    decoration: BoxDecoration(
                                      color: tool.color
                                          .withValues(alpha: 0.12),
                                      borderRadius:
                                          BorderRadius.circular(11),
                                    ),
                                    child: Icon(tool.icon,
                                        size: 18, color: tool.color),
                                  ),
                                  const Spacer(),
                                  Text(
                                    tool.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: textTheme.labelLarge?.copyWith(
                                      color: PWColors.clay700,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    tool.hint,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: textTheme.labelSmall?.copyWith(
                                        color: PWColors.clay400),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 18),
                ],
              ],
            ),
    );
  }
}
