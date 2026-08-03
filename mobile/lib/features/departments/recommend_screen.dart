import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart' show FirebaseException;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/firestore_parse.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/event.dart';
import '../../data/models/user.dart';
import '../../data/repositories/member_repository.dart';
import '../services/service_detail_screen.dart' show serviceRolesProvider;
import '../services/services_screen.dart' show ServiceSummary, servicesProvider;

/// The next few Sundays, for the "which service?" picker. A service carries
/// its date on the linked event, so this reuses the joined summary the
/// services screen already builds.
final upcomingServicesProvider = Provider<List<ServiceSummary>>((ref) {
  final all = ref.watch(servicesProvider).valueOrNull ?? const [];
  return all.where((s) => s.isUpcoming).toList().reversed.take(8).toList();
});

/// Recommend Members — a department lead suggests someone from their own
/// department for a role on an upcoming service. Mirrors
/// `/department/recommend`.
class RecommendScreen extends ConsumerStatefulWidget {
  const RecommendScreen({super.key});

  @override
  ConsumerState<RecommendScreen> createState() => _RecommendScreenState();
}

class _RecommendScreenState extends ConsumerState<RecommendScreen> {
  String? _memberId;
  String? _roleId;
  String? _serviceId;
  final _notes = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit(List<AppUser> members, List<ServiceRole> roles) async {
    final me = ref.read(userOrNullProvider);
    if (me == null) return;
    if (_memberId == null || _roleId == null || _serviceId == null) {
      context.showError('Pick a member, a role and a service.');
      return;
    }

    final member = firstWhereOrNull(members, (m) => m.id == _memberId);
    final role = firstWhereOrNull(roles, (r) => r.id == _roleId);
    if (member == null || role == null) return;

    setState(() => _busy = true);
    try {
      // Written straight to Firestore, exactly as the web page does.
      await db.collection('recommendations').add({
        'userId': member.id,
        'userName': member.name,
        'roleId': role.id,
        'roleName': role.name,
        'serviceId': _serviceId,
        'recommendedBy': me.id,
        'recommendedByName': me.name,
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'createdAt': Timestamp.now(),
      });
      if (!mounted) return;
      setState(() {
        _memberId = null;
        _roleId = null;
        _serviceId = null;
        _notes.clear();
        _busy = false;
      });
      context.showSuccess('Recommendation sent. An admin will review it.');
    } on FirebaseException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.code == 'permission-denied'
            // `recommendations` has no rule in firestore.rules, so this is
            // denied for everyone until one is added — the same on the web.
            ? 'Recommendations are not writable yet. Ask your Chairperson to '
                'add a `recommendations` rule to firestore.rules.'
            : (e.message ?? "Couldn't send that recommendation."));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(userOrNullProvider);
    final access = ref.watch(accessProvider);
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];
    final allMembers = ref.watch(membersProvider).valueOrNull ?? const [];
    final roles = ref.watch(serviceRolesProvider).valueOrNull ?? const [];
    final services = ref.watch(upcomingServicesProvider);

    if (!access.role.atLeast(UserRole.departmentLead)) {
      return const DetailScaffold(
        title: 'Recommend Members',
        body: NoAccessView(
          message: 'Only a department lead can put someone forward.',
        ),
      );
    }

    // Only people from the departments this person actually leads.
    final leads = me?.leadsDepartmentIds ?? const <String>[];
    final members = allMembers
        .where((m) =>
            m.isActive && m.departmentIds.any((id) => leads.contains(id)))
        .toList();

    // Likewise, only roles belonging to those departments.
    final myRoles =
        roles.where((r) => leads.contains(r.departmentId)).toList();

    return DetailScaffold(
      title: 'Recommend Members',
      subtitle: 'Suggest someone for an upcoming service role',
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          if (leads.isEmpty)
            const NoticeCard(
              tone: IconTone.amber,
              icon: AppIcons.alert,
              title: 'You do not lead a department',
              message: 'Recommendations come from the department you lead. '
                  'Ask your Chairperson to assign you one.',
            )
          else ...[
            const SectionHeading(
              title: 'New recommendation',
              icon: AppIcons.star,
              tone: IconTone.gold,
              subtitle: 'From your department, for a role on an upcoming '
                  'service.',
            ),
            const SizedBox(height: 16),

            AppDropdown<String>(
              label: 'Member',
              required: true,
              value: _memberId,
              hint: members.isEmpty
                  ? 'Nobody in your department yet'
                  : 'Pick someone',
              items: [
                for (final member in members)
                  DropdownMenuItem(value: member.id, child: Text(member.name)),
              ],
              onChanged: (v) => setState(() => _memberId = v),
            ),
            const SizedBox(height: 14),
            AppDropdown<String>(
              label: 'Role',
              required: true,
              value: _roleId,
              hint: myRoles.isEmpty ? 'No roles for your department' : 'Pick a role',
              items: [
                for (final role in myRoles)
                  DropdownMenuItem(value: role.id, child: Text(role.name)),
              ],
              onChanged: (v) => setState(() => _roleId = v),
            ),
            const SizedBox(height: 14),
            AppDropdown<String>(
              label: 'Service',
              required: true,
              value: _serviceId,
              hint: services.isEmpty ? 'No upcoming services' : 'Which Sunday?',
              items: [
                for (final summary in services)
                  DropdownMenuItem(
                    value: summary.service.id,
                    child: Text(
                      '${D.dayMedium(summary.date)} · ${summary.title}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (v) => setState(() => _serviceId = v),
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Why them? (optional)',
              controller: _notes,
              minLines: 2,
              maxLines: 5,
              hint: 'What makes them right for this role?',
            ),

            const SizedBox(height: 22),
            PrimaryButton(
              label: 'Send recommendation',
              icon: AppIcons.send,
              loading: _busy,
              onPressed: () => _submit(members, myRoles),
            ),

            const SizedBox(height: 22),
            NoticeCard(
              icon: AppIcons.info,
              message: 'Recommendations go to the admins, who decide whether '
                  'to make the assignment. You lead '
                  '${_departmentNames(departments, leads)}.',
            ),
          ],
        ],
      ),
    );
  }

  static String _departmentNames(
      List<Department> departments, List<String> ids) {
    final names = [
      for (final id in ids)
        for (final d in departments)
          if (d.id == id) d.name,
    ];
    if (names.isEmpty) return 'no departments';
    if (names.length == 1) return names.first;
    return '${names.sublist(0, names.length - 1).join(', ')} and ${names.last}';
  }
}
