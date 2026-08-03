import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/user.dart';
import '../../data/repositories/member_repository.dart';

/// The roles a caller may hand out — their own and everything below it.
/// Mirrors `getAssignableRoles` in `src/lib/permissions.ts`.
List<UserRole> assignableRoles(UserRole callerRole) =>
    UserRole.values.where((r) => r.rank <= callerRole.rank).toList();

/// One member: who they are, what they hold, and the admin edits.
/// Mirrors `/manage/members/[id]`.
class MemberDetailScreen extends ConsumerWidget {
  const MemberDetailScreen({super.key, required this.memberId});

  final String memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(accessProvider);
    final async = ref.watch(memberProvider(memberId));
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];
    final institutions = ref.watch(institutionNamesProvider);
    final me = ref.watch(userOrNullProvider);

    if (!access.canView('members')) {
      return const DetailScaffold(title: 'Member', body: NoAccessView());
    }

    return async.when(
      loading: () => const DetailScaffold(title: 'Member', body: LoadingView()),
      error: (e, _) =>
          DetailScaffold(title: 'Member', body: ErrorView(message: '$e')),
      data: (member) {
        if (member == null) {
          return const DetailScaffold(
            title: 'Member',
            body: EmptyStateLux(
              icon: AppIcons.alert,
              tone: IconTone.rose,
              title: 'Member not found',
              description: 'This account may have been removed.',
            ),
          );
        }

        // The server enforces this too; the app just avoids offering an edit
        // that would come back 403.
        final isSelf = me?.id == member.id;
        final canEdit = access.canEdit('members') &&
            (isSelf || assignableRoles(access.role).contains(member.role));

        final memberOf = [
          for (final id in member.departmentIds)
            for (final d in departments)
              if (d.id == id) d.name,
        ];
        final leads = [
          for (final id in member.leadsDepartmentIds)
            for (final d in departments)
              if (d.id == id) d.name,
        ];

        return DetailScaffold(
          title: member.name,
          subtitle: member.role.label,
          actions: [
            if (canEdit)
              IconButton(
                icon: const Icon(AppIcons.edit, size: 19),
                color: AppColors.clay500,
                tooltip: 'Edit',
                onPressed: () => _edit(context, ref, member),
              ),
            if (access.role == UserRole.superAdmin && !isSelf)
              IconButton(
                icon: const Icon(AppIcons.trash, size: 19),
                color: AppColors.destructive,
                tooltip: 'Remove',
                onPressed: () => _remove(context, ref, member),
              ),
          ],
          body: ListView(
            padding: EdgeInsets.zero,
            children: [
              LuxCard(
                child: Column(
                  children: [
                    Row(
                      children: [
                        MemberAvatar(
                          initials: member.initials,
                          imageUrl: member.profileImage,
                          size: 56,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                member.name,
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.clay700,
                                ),
                              ),
                              const SizedBox(height: 5),
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                children: [
                                  StatusBadge(member.role.label,
                                      tone: IconTone.gold, dense: true),
                                  StatusBadge(
                                    member.isActive ? 'Active' : 'Inactive',
                                    tone: member.isActive
                                        ? IconTone.emerald
                                        : IconTone.clay,
                                    dense: true,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const LuxDivider(),
                    const SizedBox(height: 6),
                    DetailRow(
                      label: 'Email',
                      value: member.email,
                      icon: AppIcons.mail,
                      onTap: () => _open(
                          context, Uri(scheme: 'mailto', path: member.email)),
                    ),
                    if ((member.phone ?? '').isNotEmpty)
                      DetailRow(
                        label: 'Phone',
                        value: Phone.pretty(member.phone!),
                        icon: AppIcons.phone,
                        onTap: () =>
                            _open(context, Phone.dialUri(member.phone!)),
                      ),
                    if (member.lifeGroup != null)
                      DetailRow(
                        label: 'Life group',
                        value: member.lifeGroup!.label,
                        icon: AppIcons.usersRound,
                      ),
                    if (member.isStudent)
                      DetailRow(
                        label: 'Institution',
                        value: institutions[member.institutionId ?? ''] ??
                            'Student',
                        icon: AppIcons.graduation,
                      ),
                    DetailRow(
                      label: 'Joined',
                      value: D.medium(member.createdAt),
                      icon: AppIcons.calendar,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 22),
              const SectionHeading(
                title: 'Departments',
                icon: AppIcons.department,
                tone: IconTone.teal,
              ),
              const SizedBox(height: 12),
              if (memberOf.isEmpty && leads.isEmpty)
                const NoticeCard(
                  icon: AppIcons.info,
                  message: 'Not in any department yet.',
                )
              else ...[
                if (leads.isNotEmpty) ...[
                  const FieldLabel('Leads'),
                  Wrap(
                    spacing: 7,
                    runSpacing: 7,
                    children: [
                      for (final name in leads)
                        StatusBadge(name,
                            tone: IconTone.gold, icon: AppIcons.shield),
                    ],
                  ),
                  const SizedBox(height: 14),
                ],
                if (memberOf.isNotEmpty) ...[
                  const FieldLabel('Member of'),
                  Wrap(
                    spacing: 7,
                    runSpacing: 7,
                    children: [
                      for (final name in memberOf)
                        StatusBadge(name, tone: IconTone.teal),
                    ],
                  ),
                ],
              ],

              if (canEdit) ...[
                const SizedBox(height: 26),
                PrimaryButton(
                  label: 'Edit this member',
                  icon: AppIcons.edit,
                  onPressed: () => _edit(context, ref, member),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Future<void> _open(BuildContext context, Uri uri) async {
    if (!await launchUrl(uri) && context.mounted) {
      context.showError("Couldn't open that.");
    }
  }

  Future<void> _edit(
      BuildContext context, WidgetRef ref, AppUser member) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.92,
        maxChildSize: 0.95,
        builder: (context, controller) => MemberForm(
          existing: member,
          scrollController: controller,
        ),
      ),
    );
  }

  Future<void> _remove(
      BuildContext context, WidgetRef ref, AppUser member) async {
    final ok = await confirmAction(
      context,
      title: 'Remove ${member.name}?',
      message: 'Their account and sign-in are removed. Assignments already '
          'recorded against them are kept.',
      confirmLabel: 'Remove',
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref.read(memberRepositoryProvider).remove(member.id);
      if (context.mounted) {
        Navigator.of(context).pop();
        context.showSuccess('${member.name} has been removed.');
      }
    } on ApiException catch (e) {
      if (context.mounted) context.showError(e.message);
    }
  }
}

/// Add or edit a member. Used by both `/manage/members/new` and the edit
/// sheet, because the fields and the rules are the same either way.
class MemberForm extends ConsumerStatefulWidget {
  const MemberForm({super.key, this.existing, this.scrollController});

  final AppUser? existing;
  final ScrollController? scrollController;

  @override
  ConsumerState<MemberForm> createState() => _MemberFormState();
}

class _MemberFormState extends ConsumerState<MemberForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late final _email = TextEditingController(text: widget.existing?.email ?? '');
  late final _phone =
      TextEditingController(text: widget.existing?.phone ?? '');

  late UserRole _role = widget.existing?.role ?? UserRole.member;
  late Set<String> _departmentIds = {...?widget.existing?.departmentIds};
  late Set<String> _leadsDepartmentIds = {
    ...?widget.existing?.leadsDepartmentIds
  };
  late bool _isActive = widget.existing?.isActive ?? true;
  late bool _isStudent = widget.existing?.isStudent ?? false;
  late String? _institutionId = widget.existing?.institutionId;
  late LifeGroup? _lifeGroup = widget.existing?.lifeGroup;

  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _busy = true);
    try {
      final repo = ref.read(memberRepositoryProvider);
      final existing = widget.existing;
      if (existing == null) {
        await repo.create(
          name: _name.text.trim(),
          email: _email.text.trim(),
          role: _role,
          phone: _phone.text.trim(),
          departmentIds: _departmentIds.toList(),
          isStudent: _isStudent,
          institutionId: _isStudent ? _institutionId : null,
          lifeGroup: _lifeGroup,
        );
      } else {
        await repo.update(
          existing.id,
          name: _name.text.trim(),
          email: _email.text.trim(),
          role: _role,
          phone: _phone.text.trim(),
          departmentIds: _departmentIds.toList(),
          leadsDepartmentIds: _leadsDepartmentIds.toList(),
          isActive: _isActive,
          isStudent: _isStudent,
          institutionId: _isStudent ? _institutionId : null,
          lifeGroup: _lifeGroup,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop();
      context.showSuccess(existing == null
          ? '${_name.text.trim()} has been added. They will get an email to '
              'set a password.'
          : 'Saved.');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];
    final institutions = ref.watch(activeInstitutionsProvider);
    final roles = assignableRoles(access.role);
    final isNew = widget.existing == null;

    return Form(
      key: _formKey,
      child: ListView(
        controller: widget.scrollController,
        padding: EdgeInsets.fromLTRB(
            20, 10, 20, MediaQuery.of(context).viewInsets.bottom + 28),
        children: [
          SectionHeading(
            title: isNew ? 'Add a member' : 'Edit ${widget.existing!.name}',
            icon: AppIcons.userPlus,
            tone: IconTone.periwinkle,
            subtitle: isNew
                ? 'They get an email to set their own password.'
                : null,
          ),
          const SizedBox(height: 18),

          AppTextField(label: 'Full name', controller: _name, required: true),
          const SizedBox(height: 14),
          AppTextField(
            label: 'Email',
            controller: _email,
            required: true,
            keyboardType: TextInputType.emailAddress,
            textCapitalization: TextCapitalization.none,
            validator: (v) {
              final value = (v ?? '').trim();
              if (value.isEmpty) return 'Email is required';
              if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value)) {
                return 'That does not look like an email address';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),
          AppTextField(
            label: 'Phone (optional)',
            controller: _phone,
            keyboardType: TextInputType.phone,
            textCapitalization: TextCapitalization.none,
          ),

          const SizedBox(height: 14),
          AppDropdown<UserRole>(
            label: 'Role',
            required: true,
            value: roles.contains(_role) ? _role : roles.last,
            items: [
              for (final role in roles)
                DropdownMenuItem(value: role, child: Text(role.label)),
            ],
            onChanged: (v) => setState(() => _role = v ?? UserRole.member),
          ),
          if (roles.length < UserRole.values.length) ...[
            const SizedBox(height: 6),
            const Text(
              'You can only assign roles at or below your own.',
              style: TextStyle(fontSize: 11.5, color: AppColors.clay400),
            ),
          ],

          const SizedBox(height: 20),
          const FieldLabel('Departments'),
          _DeptPicker(
            departments: departments,
            selected: _departmentIds,
            onToggle: (id) => setState(() {
              if (!_departmentIds.remove(id)) _departmentIds.add(id);
              // Leading a department you are not in makes no sense.
              if (!_departmentIds.contains(id)) _leadsDepartmentIds.remove(id);
            }),
          ),

          if (!isNew && _departmentIds.isNotEmpty) ...[
            const SizedBox(height: 18),
            const FieldLabel('Leads which of them?'),
            _DeptPicker(
              departments: departments
                  .where((d) => _departmentIds.contains(d.id))
                  .toList(),
              selected: _leadsDepartmentIds,
              tone: IconTone.gold,
              onToggle: (id) => setState(() {
                if (!_leadsDepartmentIds.remove(id)) {
                  _leadsDepartmentIds.add(id);
                }
              }),
            ),
          ],

          const SizedBox(height: 20),
          AppDropdown<LifeGroup?>(
            label: 'Life group (optional)',
            value: _lifeGroup,
            hint: 'Not in one',
            items: [
              const DropdownMenuItem<LifeGroup?>(
                  value: null, child: Text('Not in one')),
              for (final group in LifeGroup.values)
                DropdownMenuItem<LifeGroup?>(
                    value: group, child: Text(group.label)),
            ],
            onChanged: (v) => setState(() => _lifeGroup = v),
          ),

          const SizedBox(height: 16),
          SwitchListTile.adaptive(
            value: _isStudent,
            onChanged: (v) => setState(() => _isStudent = v),
            title: const Text('Student', style: TextStyle(fontSize: 14.5)),
            subtitle: const Text(
              'Shows their institution on camp and outreach lists.',
              style: TextStyle(fontSize: 12, color: AppColors.clay400),
            ),
            contentPadding: EdgeInsets.zero,
          ),
          if (_isStudent) ...[
            const SizedBox(height: 8),
            AppDropdown<String?>(
              label: 'Institution',
              value: _institutionId,
              hint: 'Pick one',
              items: [
                const DropdownMenuItem<String?>(
                    value: null, child: Text('Not set')),
                for (final inst in institutions)
                  DropdownMenuItem<String?>(
                      value: inst.id, child: Text(inst.name)),
              ],
              onChanged: (v) => setState(() => _institutionId = v),
            ),
          ],

          if (!isNew) ...[
            const SizedBox(height: 8),
            SwitchListTile.adaptive(
              value: _isActive,
              onChanged: (v) => setState(() => _isActive = v),
              title: const Text('Active', style: TextStyle(fontSize: 14.5)),
              subtitle: const Text(
                'An inactive member cannot sign in and drops off the rotas.',
                style: TextStyle(fontSize: 12, color: AppColors.clay400),
              ),
              contentPadding: EdgeInsets.zero,
            ),
          ],

          const SizedBox(height: 24),
          PrimaryButton(
            label: isNew ? 'Add member' : 'Save changes',
            icon: AppIcons.check,
            loading: _busy,
            onPressed: _save,
          ),
        ],
      ),
    );
  }
}

class _DeptPicker extends StatelessWidget {
  const _DeptPicker({
    required this.departments,
    required this.selected,
    required this.onToggle,
    this.tone = IconTone.teal,
  });

  final List<Department> departments;
  final Set<String> selected;
  final ValueChanged<String> onToggle;
  final IconTone tone;

  @override
  Widget build(BuildContext context) {
    if (departments.isEmpty) {
      return const Text(
        'No departments yet.',
        style: TextStyle(fontSize: 13, color: AppColors.clay400),
      );
    }
    final colors = toneColors(tone);
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final dept in departments)
          InkWell(
            onTap: () => onToggle(dept.id),
            borderRadius: BorderRadius.circular(999),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
              decoration: BoxDecoration(
                color: selected.contains(dept.id)
                    ? colors.background
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: selected.contains(dept.id)
                      ? colors.foreground.withValues(alpha: 0.35)
                      : AppColors.clay200,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (selected.contains(dept.id)) ...[
                    Icon(AppIcons.check, size: 13, color: colors.foreground),
                    const SizedBox(width: 5),
                  ],
                  Text(
                    dept.name,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: selected.contains(dept.id)
                          ? colors.foreground
                          : AppColors.clay500,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// `/manage/members/new` — the same form on its own screen.
class NewMemberScreen extends ConsumerWidget {
  const NewMemberScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(accessProvider).canEdit('members')) {
      return const DetailScaffold(title: 'Add member', body: NoAccessView());
    }
    return const DetailScaffold(
      title: 'Add member',
      padded: false,
      body: MemberForm(),
    );
  }
}
