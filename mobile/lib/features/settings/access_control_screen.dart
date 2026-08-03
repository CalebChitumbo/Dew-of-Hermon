import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/access/access_tables.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/user.dart';
import '../../data/repositories/member_repository.dart';
import '../../data/repositories/ministry_repository.dart';

/// The roles an editor may actually change. The Chairperson is fixed at full
/// edit on every page, so there is nothing to show for them.
const List<UserRole> configurableRoles = [
  UserRole.viceChairperson,
  UserRole.admin,
  UserRole.departmentLead,
  UserRole.youthLeader,
  UserRole.member,
];

/// Tapping a level cycles edit → view → none → edit, as on the web.
AccessLevel nextLevel(AccessLevel level) => switch (level) {
      AccessLevel.edit => AccessLevel.view,
      AccessLevel.view => AccessLevel.none,
      AccessLevel.none => AccessLevel.edit,
    };

String levelLabel(AccessLevel level) => switch (level) {
      AccessLevel.edit => 'Edit',
      AccessLevel.view => 'View only',
      AccessLevel.none => 'No access',
    };

IconTone levelTone(AccessLevel level) => switch (level) {
      AccessLevel.edit => IconTone.emerald,
      AccessLevel.view => IconTone.blue,
      AccessLevel.none => IconTone.rose,
    };

IconData levelIcon(AccessLevel level) => switch (level) {
      AccessLevel.edit => AppIcons.edit,
      AccessLevel.view => AppIcons.eye,
      AccessLevel.none => AppIcons.eyeOff,
    };

/// Access Control — page permissions, feature minimum roles, and the
/// department rules that let someone below the bar in anyway.
/// Mirrors `/manage/settings/access-control`. Chairperson only, both here and
/// on the server.
class AccessControlScreen extends ConsumerStatefulWidget {
  const AccessControlScreen({super.key});

  @override
  ConsumerState<AccessControlScreen> createState() =>
      _AccessControlScreenState();
}

class _AccessControlScreenState extends ConsumerState<AccessControlScreen> {
  PagePermissions? _pages;
  FeatureMinRoles? _features;
  List<DepartmentAccessRule>? _rules;

  int _tab = 0;
  bool _busy = false;

  /// Seed the drafts from the live config the first time it arrives, then
  /// leave them alone so an in-progress edit is not overwritten by a snapshot.
  void _seed(AccessConfig config) {
    _pages ??= {
      for (final entry in config.pagePermissions.entries)
        entry.key: Map<UserRole, AccessLevel>.from(entry.value),
    };
    _features ??= Map<String, UserRole>.from(config.featureMinRoles);
    _rules ??= [...config.departmentAccessRules];
  }

  bool get _dirty => _pages != null;

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).put(
        '/api/settings/access-control',
        body: {
          'pagePermissions': {
            for (final entry in _pages!.entries)
              entry.key: {
                for (final level in entry.value.entries)
                  level.key.wire: level.value.wire,
              },
          },
          'featureMinRoles': {
            for (final entry in _features!.entries) entry.key: entry.value.wire,
          },
          'departmentAccessRules': [
            for (final rule in _rules!)
              {
                'featureKey': rule.featureKey,
                'departmentName': rule.departmentName,
                'requiresLeadership': rule.requiresLeadership,
                'allowedRoles': [for (final r in rule.allowedRoles) r.wire],
              },
          ],
        },
      );
      if (mounted) {
        setState(() => _busy = false);
        context.showSuccess('Saved. Everyone picks this up immediately.');
      }
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
    if (access.role != UserRole.superAdmin) {
      return const AppScaffold(
        title: 'Access Control',
        showBottomNav: false,
        body: NoAccessView(
          message: 'Only the Chairperson can manage access control.',
        ),
      );
    }

    final configAsync = ref.watch(accessConfigProvider);

    return AppScaffold(
      title: 'Access Control',
      subtitle: 'Who can reach what',
      showBottomNav: false,
      body: configAsync.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (config) {
          _seed(config);

          return Column(
            children: [
              SegmentedTabs(
                tabs: const ['Pages', 'Features', 'Departments'],
                selected: _tab,
                onSelect: (i) => setState(() => _tab = i),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: switch (_tab) {
                  0 => _PagesTab(
                      permissions: _pages!,
                      onCycle: (pageKey, role) => setState(() {
                        final current =
                            _pages![pageKey]?[role] ?? AccessLevel.none;
                        _pages![pageKey] = {
                          ...?_pages![pageKey],
                          role: nextLevel(current),
                        };
                      }),
                    ),
                  1 => _FeaturesTab(
                      minRoles: _features!,
                      onChange: (key, role) =>
                          setState(() => _features![key] = role),
                    ),
                  _ => _RulesTab(
                      rules: _rules!,
                      onChange: (next) => setState(() => _rules = next),
                    ),
                },
              ),
              if (_dirty) ...[
                const SizedBox(height: 12),
                PrimaryButton(
                  label: 'Save changes',
                  icon: AppIcons.check,
                  loading: _busy,
                  onPressed: _save,
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

// ─── Pages ───

class _PagesTab extends StatelessWidget {
  const _PagesTab({required this.permissions, required this.onCycle});

  final PagePermissions permissions;
  final void Function(String pageKey, UserRole role) onCycle;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        const NoticeCard(
          icon: AppIcons.info,
          message: 'Tap a role to cycle it through Edit → View only → No '
              'access. The Chairperson always keeps full edit, so they are '
              'not shown.',
        ),
        const SizedBox(height: 16),
        for (final page in kPageDefinitions)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: LuxCard(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    page.label,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.clay700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    page.description,
                    style: const TextStyle(
                        fontSize: 12, height: 1.4, color: AppColors.clay400),
                  ),
                  const SizedBox(height: 12),
                  for (final role in configurableRoles)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 7),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              role.label,
                              style: const TextStyle(
                                  fontSize: 13, color: AppColors.clay600),
                            ),
                          ),
                          _LevelPill(
                            level: permissions[page.key]?[role] ??
                                AccessLevel.none,
                            locked: page.lockedRoles.containsKey(role),
                            onTap: () => onCycle(page.key, role),
                          ),
                        ],
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

class _LevelPill extends StatelessWidget {
  const _LevelPill({
    required this.level,
    required this.locked,
    required this.onTap,
  });

  final AccessLevel level;
  final bool locked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final badge = StatusBadge(
      levelLabel(level),
      tone: levelTone(level),
      icon: locked ? AppIcons.lock : levelIcon(level),
      dense: true,
    );
    if (locked) return Opacity(opacity: 0.6, child: badge);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: badge,
    );
  }
}

// ─── Features ───

class _FeaturesTab extends StatelessWidget {
  const _FeaturesTab({required this.minRoles, required this.onChange});

  final FeatureMinRoles minRoles;
  final void Function(String featureKey, UserRole role) onChange;

  @override
  Widget build(BuildContext context) {
    // Preserve the order the categories first appear in.
    final categories = <String>[];
    for (final feature in kFeatureDefinitions) {
      if (!categories.contains(feature.category)) {
        categories.add(feature.category);
      }
    }

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        const NoticeCard(
          icon: AppIcons.info,
          message: 'The minimum role for each action. Anyone at or above it '
              'can do the thing, whatever department they are in.',
        ),
        const SizedBox(height: 16),
        for (final category in categories) ...[
          SectionHeading(title: category, tone: IconTone.periwinkle),
          const SizedBox(height: 10),
          for (final feature
              in kFeatureDefinitions.where((f) => f.category == category))
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: LuxCard(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      feature.label,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.clay700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      feature.description,
                      style: const TextStyle(
                          fontSize: 12, height: 1.4, color: AppColors.clay400),
                    ),
                    const SizedBox(height: 10),
                    // manage_settings is pinned to the Chairperson server-side;
                    // offering to change it here would only mislead.
                    if (feature.key == 'manage_settings')
                      const StatusBadge('Chairperson only',
                          tone: IconTone.gold, icon: AppIcons.lock, dense: true)
                    else
                      AppDropdown<UserRole>(
                        label: '',
                        value: minRoles[feature.key] ?? UserRole.superAdmin,
                        items: [
                          for (final role in UserRole.values)
                            DropdownMenuItem(
                                value: role, child: Text(role.label)),
                        ],
                        onChanged: (v) {
                          if (v != null) onChange(feature.key, v);
                        },
                      ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

// ─── Department rules ───

class _RulesTab extends ConsumerWidget {
  const _RulesTab({required this.rules, required this.onChange});

  final List<DepartmentAccessRule> rules;
  final ValueChanged<List<DepartmentAccessRule>> onChange;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];

    // Group by department so a manager's whole remit reads in one place.
    final byDepartment = <String, List<DepartmentAccessRule>>{};
    for (final rule in rules) {
      byDepartment.putIfAbsent(rule.departmentName, () => []).add(rule);
    }
    final names = byDepartment.keys.toList()..sort();

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        const NoticeCard(
          icon: AppIcons.info,
          message: 'These let someone below the minimum role reach a feature '
              'because of the department they are in — the Food Logistics '
              'lead serving camp meals, say. Leadership-only rules need them '
              'to lead the department, not just belong to it.',
        ),
        const SizedBox(height: 16),
        for (final name in names) ...[
          SectionHeading(
            title: name,
            icon: AppIcons.department,
            tone: IconTone.teal,
            subtitle: departments.any((d) => d.name == name)
                ? null
                : 'No department by this name exists — the rule will never '
                    'match.',
          ),
          const SizedBox(height: 10),
          for (final rule in byDepartment[name]!)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RuleCard(
                rule: rule,
                onDelete: () =>
                    onChange([...rules]..removeWhere((r) => identical(r, rule))),
              ),
            ),
          const SizedBox(height: 10),
        ],
        if (rules.isEmpty)
          const EmptyStateLux(
            icon: AppIcons.department,
            tone: IconTone.teal,
            title: 'No department rules',
            description: 'Everyone reaches features by role alone.',
          ),
      ],
    );
  }
}

class _RuleCard extends StatelessWidget {
  const _RuleCard({required this.rule, required this.onDelete});

  final DepartmentAccessRule rule;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final feature = _featureLabel(rule.featureKey);

    return LuxCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  feature,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.clay700,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    StatusBadge(
                      rule.requiresLeadership ? 'Leads it' : 'Belongs to it',
                      tone: rule.requiresLeadership
                          ? IconTone.gold
                          : IconTone.teal,
                      dense: true,
                    ),
                    for (final role in rule.allowedRoles)
                      StatusBadge(role.label,
                          tone: IconTone.clay, dense: true),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(AppIcons.trash, size: 17),
            color: AppColors.destructive,
            tooltip: 'Remove this rule',
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }

  static String _featureLabel(String key) {
    for (final feature in kFeatureDefinitions) {
      if (feature.key == key) return feature.label;
    }
    return key;
  }
}

/// Manage Institutions — the schools students come from.
/// Mirrors `/manage/settings/institutions`.
class InstitutionsScreen extends ConsumerStatefulWidget {
  const InstitutionsScreen({super.key});

  @override
  ConsumerState<InstitutionsScreen> createState() => _InstitutionsScreenState();
}

class _InstitutionsScreenState extends ConsumerState<InstitutionsScreen> {
  final _name = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      context.showError('Give the institution a name.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(ministryRepositoryProvider).createInstitution(name);
      if (mounted) {
        _name.clear();
        setState(() => _busy = false);
        context.showSuccess('Added.');
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  Future<void> _setActive(Institution inst, bool isActive) async {
    try {
      await ref
          .read(ministryRepositoryProvider)
          .updateInstitution(inst.id, {'isActive': isActive});
      if (mounted) {
        context.showSuccess(isActive ? 'Reactivated.' : 'Deactivated.');
      }
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    }
  }

  Future<void> _rename(Institution inst) async {
    final name = await promptForText(
      context,
      title: 'Rename ${inst.name}',
      hint: 'Institution name',
      confirmLabel: 'Rename',
      required: true,
      maxLines: 1,
    );
    if (name == null || name.isEmpty) return;
    try {
      await ref
          .read(ministryRepositoryProvider)
          .updateInstitution(inst.id, {'name': name});
      if (mounted) context.showSuccess('Renamed.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    if (!access.can('manage_settings')) {
      return const AppScaffold(
        title: 'Institutions',
        showBottomNav: false,
        body: NoAccessView(),
      );
    }

    final async = ref.watch(institutionsProvider);

    return AppScaffold(
      title: 'Institutions',
      subtitle: 'The schools and colleges students come from',
      showBottomNav: false,
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (list) => ListView(
          padding: EdgeInsets.zero,
          children: [
            AppTextField(
              label: 'Add an institution',
              controller: _name,
              hint: 'e.g. University of Zambia',
              onFieldSubmitted: (_) => _add(),
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'Add',
              icon: AppIcons.plus,
              loading: _busy,
              onPressed: _add,
            ),
            const SizedBox(height: 24),
            if (list.isEmpty)
              const EmptyStateLux(
                icon: AppIcons.graduation,
                tone: IconTone.gold,
                title: 'No institutions yet',
                description: 'Add one above to get started.',
              )
            else
              for (final inst in list)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: LuxCard(
                    padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              Flexible(
                                child: Text(
                                  inst.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: inst.isActive
                                        ? AppColors.clay700
                                        : AppColors.clay400,
                                  ),
                                ),
                              ),
                              if (!inst.isActive) ...[
                                const SizedBox(width: 8),
                                const StatusBadge('Inactive',
                                    tone: IconTone.clay, dense: true),
                              ],
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(AppIcons.edit, size: 17),
                          color: AppColors.clay400,
                          tooltip: 'Rename',
                          onPressed: () => _rename(inst),
                        ),
                        TextButton(
                          onPressed: () => _setActive(inst, !inst.isActive),
                          child: Text(inst.isActive ? 'Deactivate' : 'Activate'),
                        ),
                      ],
                    ),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}
