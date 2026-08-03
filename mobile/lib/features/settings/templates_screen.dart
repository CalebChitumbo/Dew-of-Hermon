import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart' show FirebaseException;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/event.dart';
import '../services/service_detail_screen.dart' show serviceRolesProvider;

/// The tokens a template may use, and what each stands for.
const List<(String, String)> kTemplatePlaceholders = [
  ('{{memberName}}', "Member's full name"),
  ('{{roleName}}', 'Assigned role name'),
  ('{{serviceDate}}', 'Service date (formatted)'),
  ('{{serviceTime}}', 'Service time'),
  ('{{arrivalTime}}', 'Required arrival time'),
  ('{{venue}}', 'Service venue'),
  ('{{theme}}', 'Service theme'),
  ('{{eventTitle}}', 'Event title'),
  ('{{confirmLink}}', 'Confirmation link'),
];

/// Sample values, so a preview reads like a real email.
const Map<String, String> _previewValues = {
  '{{memberName}}': 'Jane Doe',
  '{{roleName}}': 'Worship Leader',
  '{{serviceDate}}': 'Sunday, March 15, 2026',
  '{{serviceTime}}': '9:00 AM',
  '{{arrivalTime}}': '8:00 AM',
  '{{venue}}': 'Main Auditorium',
  '{{theme}}': 'Walking in Faith',
  '{{eventTitle}}': "Potter's Wheel Sunday Service",
  '{{confirmLink}}': 'https://app.potterswheel.com/confirm/abc123',
};

String fillPlaceholders(String text) {
  var out = text;
  _previewValues.forEach((token, value) {
    out = out.replaceAll(token, value);
  });
  return out;
}

/// Email Templates — the reminder each service role's assignees receive.
/// Mirrors `/manage/templates`.
class TemplatesScreen extends ConsumerWidget {
  const TemplatesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(accessProvider);
    if (!access.role.atLeast(UserRole.admin)) {
      return const AppScaffold(title: 'Email Templates', body: NoAccessView());
    }

    final async = ref.watch(serviceRolesProvider);
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];

    return AppScaffold(
      title: 'Email Templates',
      subtitle: 'What each service role gets reminded with',
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (roles) {
          if (roles.isEmpty) {
            return const EmptyStateLux(
              icon: AppIcons.mail,
              tone: IconTone.periwinkle,
              title: 'No service roles',
              description: 'Create service roles first, then set up the email '
                  'each one sends.',
            );
          }

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              const _PlaceholderKey(),
              const SizedBox(height: 20),
              for (final role in roles)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _RoleTemplateCard(
                    role: role,
                    departmentName: _departmentName(departments, role),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  static String? _departmentName(List<Department> departments, ServiceRole r) {
    for (final d in departments) {
      if (d.id == r.departmentId) return d.name;
    }
    return null;
  }
}

class _PlaceholderKey extends StatelessWidget {
  const _PlaceholderKey();

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconChip(AppIcons.copy, tone: IconTone.gold, size: 34),
              const SizedBox(width: 11),
              Expanded(
                child: Text(
                  'Placeholders',
                  style: AppFonts.display(const TextStyle(
                      fontSize: 16, color: AppColors.clay700)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          const Text(
            'Tap one to copy it, then paste it into a subject or body. It is '
            'replaced with the real value when the email goes out.',
            style: TextStyle(
                fontSize: 12.5, height: 1.5, color: AppColors.clay400),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              for (final (token, description) in kTemplatePlaceholders)
                Tooltip(
                  message: description,
                  child: InkWell(
                    onTap: () async {
                      await Clipboard.setData(ClipboardData(text: token));
                      if (context.mounted) context.showInfo('$token copied.');
                    },
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.cream,
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        border: Border.all(color: AppColors.clay200),
                      ),
                      child: Text(
                        token,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontFamily: 'monospace',
                          color: AppColors.clay600,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RoleTemplateCard extends ConsumerStatefulWidget {
  const _RoleTemplateCard({required this.role, required this.departmentName});

  final ServiceRole role;
  final String? departmentName;

  @override
  ConsumerState<_RoleTemplateCard> createState() => _RoleTemplateCardState();
}

class _RoleTemplateCardState extends ConsumerState<_RoleTemplateCard> {
  bool _expanded = false;
  bool _preview = false;
  bool _busy = false;
  TextEditingController? _subject;
  TextEditingController? _body;

  @override
  void dispose() {
    _subject?.dispose();
    _body?.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() {
      _expanded = !_expanded;
      if (_expanded) {
        _subject = TextEditingController(text: widget.role.emailSubject);
        _body = TextEditingController(text: widget.role.emailBody);
        _preview = false;
      } else {
        _subject?.dispose();
        _body?.dispose();
        _subject = null;
        _body = null;
      }
    });
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await db.collection('serviceRoles').doc(widget.role.id).update({
        'emailSubject': _subject!.text,
        'emailBody': _body!.text,
        'updatedAt': Timestamp.now(),
      });
      if (mounted) {
        _toggle();
        context.showSuccess('Template saved.');
      }
    } on FirebaseException catch (e) {
      if (mounted) {
        context.showError(e.code == 'permission-denied'
            ? 'Only an admin can edit email templates.'
            : (e.message ?? "Couldn't save the template."));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.role;
    final hasTemplate =
        role.emailSubject.isNotEmpty || role.emailBody.isNotEmpty;

    return LuxCard(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: _toggle,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        role.name,
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.clay700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          if (widget.departmentName != null)
                            StatusBadge(widget.departmentName!,
                                tone: IconTone.teal, dense: true),
                          StatusBadge(
                            hasTemplate ? 'Template set' : 'Using the default',
                            tone: hasTemplate
                                ? IconTone.emerald
                                : IconTone.clay,
                            dense: true,
                          ),
                          for (final day in role.reminderSchedule)
                            StatusBadge(day.label,
                                tone: IconTone.gold,
                                icon: AppIcons.bell,
                                dense: true),
                        ],
                      ),
                    ],
                  ),
                ),
                Icon(_expanded ? AppIcons.chevronUp : AppIcons.chevronDown,
                    size: 18, color: AppColors.clay400),
              ],
            ),
          ),

          if (_expanded) ...[
            const SizedBox(height: 14),
            const LuxDivider(indent: 0),
            const SizedBox(height: 14),

            if (_preview) ...[
              const FieldLabel('Subject'),
              Text(
                fillPlaceholders(_subject!.text),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.clay700,
                ),
              ),
              const SizedBox(height: 14),
              const FieldLabel('Body'),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: AppColors.cream,
                  borderRadius: BorderRadius.circular(AppRadius.base),
                ),
                child: Text(
                  fillPlaceholders(_body!.text),
                  style: const TextStyle(
                      fontSize: 13.5, height: 1.7, color: AppColors.clay600),
                ),
              ),
            ] else ...[
              AppTextField(label: 'Subject', controller: _subject),
              const SizedBox(height: 12),
              AppTextField(
                label: 'Body',
                controller: _body,
                minLines: 6,
                maxLines: 14,
              ),
            ],

            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => setState(() => _preview = !_preview),
                    icon: Icon(_preview ? AppIcons.edit : AppIcons.eye,
                        size: 15),
                    label: Text(_preview ? 'Edit' : 'Preview'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.clay600,
                      minimumSize: const Size(0, 44),
                    ),
                  ),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: PrimaryButton(
                    label: 'Save',
                    icon: AppIcons.check,
                    loading: _busy,
                    onPressed: _save,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
