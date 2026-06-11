import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/models.dart';
import '../../../services/access_service.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// View/edit one member (or add a new one when [member] is null).
/// Writes go through the same /api/members endpoints as the web.
class MemberDetailScreen extends StatefulWidget {
  const MemberDetailScreen({super.key, required this.member});

  final UserProfile? member;

  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name =
      TextEditingController(text: widget.member?.name ?? '');
  late final TextEditingController _email =
      TextEditingController(text: widget.member?.email ?? '');
  late final TextEditingController _phone =
      TextEditingController(text: widget.member?.phone ?? '');
  late String _role = widget.member?.role ?? 'MEMBER';
  late String? _lifeGroup = widget.member?.lifeGroup;
  late bool _isStudent = widget.member?.isStudent ?? false;
  late bool _isActive = widget.member?.isActive ?? true;
  late final Set<String> _departmentIds = {...?widget.member?.departmentIds};
  late final Set<String> _leadsIds = {...?widget.member?.leadsDepartmentIds};
  bool _saving = false;

  bool get isNew => widget.member == null;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final api = context.read<ApiClient>();
    setState(() => _saving = true);
    try {
      final payload = {
        'name': _name.text.trim(),
        'email': _email.text.trim(),
        'phone':
            _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'role': _role,
        'departmentIds': _departmentIds.toList(),
        'lifeGroup': _lifeGroup,
        'isStudent': _isStudent,
      };
      if (isNew) {
        await api.postJson('/api/members', payload);
      } else {
        await api.putJson('/api/members/${widget.member!.id}', {
          ...payload,
          'leadsDepartmentIds': _leadsIds.toList(),
          'isActive': _isActive,
        });
      }
      if (mounted) {
        showAppSnackBar(
            context, isNew ? 'Member added.' : 'Member updated.');
        Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text('Delete ${widget.member!.name}?',
            style: Theme.of(dialogContext).textTheme.titleLarge),
        content: const Text(
            'This permanently removes the member. Consider deactivating '
            'instead — that keeps their history.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel')),
          FilledButton(
            style:
                FilledButton.styleFrom(backgroundColor: PWColors.destructive),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final api = context.read<ApiClient>();
    try {
      await api.deleteJson('/api/members/${widget.member!.id}');
      if (mounted) {
        showAppSnackBar(context, 'Member deleted.');
        Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = context.watch<AccessService>();
    final me = context.watch<AuthService>().profile;
    final myLevel = roleHierarchy[me?.role ?? 'MEMBER'] ?? 1;
    final assignableRoles = roleHierarchy.entries
        .where((e) => e.value <= myLevel)
        .map((e) => e.key)
        .toList();
    final canDelete = access.checkFeature(me, 'delete_members') && !isNew;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(isNew ? 'Add member' : widget.member!.name),
        actions: [
          if (canDelete)
            IconButton(
              tooltip: 'Delete member',
              onPressed: _delete,
              icon:
                  const Icon(Icons.delete_outline, color: PWColors.destructive),
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            const SectionHeader('Details'),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Full name *'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email *'),
              validator: (v) =>
                  (v == null || !v.contains('@')) ? 'Valid email needed' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _role,
              decoration: const InputDecoration(labelText: 'Role'),
              items: assignableRoles
                  .map((r) => DropdownMenuItem(
                      value: r, child: Text(roleLabels[r] ?? r)))
                  .toList(),
              onChanged: (v) => setState(() => _role = v ?? 'MEMBER'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _lifeGroup,
              decoration: const InputDecoration(labelText: 'Life group'),
              items: [
                const DropdownMenuItem<String>(
                    value: null, child: Text('None')),
                ...lifeGroups.map((g) => DropdownMenuItem(
                    value: g,
                    child:
                        Text('${g[0]}${g.substring(1).toLowerCase()}'))),
              ],
              onChanged: (v) => setState(() => _lifeGroup = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: PWColors.gold,
              title: Text('Student', style: textTheme.bodyMedium),
              value: _isStudent,
              onChanged: (v) => setState(() => _isStudent = v),
            ),
            if (!isNew)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeThumbColor: PWColors.teal,
                title: Text('Active account', style: textTheme.bodyMedium),
                subtitle: Text(
                  'Deactivated members cannot sign in.',
                  style:
                      textTheme.bodySmall?.copyWith(color: PWColors.clay400),
                ),
                value: _isActive,
                onChanged: (v) => setState(() => _isActive = v),
              ),
            const SizedBox(height: 16),
            const SectionHeader('Departments'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final dept in access.departments)
                  FilterChip(
                    label: Text(dept.name),
                    selected: _departmentIds.contains(dept.id),
                    selectedColor: PWColors.gold.withValues(alpha: 0.25),
                    onSelected: (v) => setState(() {
                      if (v) {
                        _departmentIds.add(dept.id);
                      } else {
                        _departmentIds.remove(dept.id);
                        _leadsIds.remove(dept.id);
                      }
                    }),
                  ),
              ],
            ),
            if (!isNew && _departmentIds.isNotEmpty) ...[
              const SizedBox(height: 16),
              const SectionHeader('Leads which departments?'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final dept in access.departments
                      .where((d) => _departmentIds.contains(d.id)))
                    FilterChip(
                      label: Text(dept.name),
                      selected: _leadsIds.contains(dept.id),
                      selectedColor: PWColors.teal.withValues(alpha: 0.25),
                      onSelected: (v) => setState(() {
                        if (v) {
                          _leadsIds.add(dept.id);
                        } else {
                          _leadsIds.remove(dept.id);
                        }
                      }),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: PWColors.cream),
                    )
                  : Text(isNew ? 'Add member' : 'Save changes'),
            ),
            if (isNew) ...[
              const SizedBox(height: 8),
              Text(
                'Adding a member creates their profile; they register '
                'their own login with this email later.',
                textAlign: TextAlign.center,
                style: textTheme.bodySmall?.copyWith(color: PWColors.clay400),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
