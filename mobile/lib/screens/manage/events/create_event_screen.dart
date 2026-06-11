import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/models.dart';
import '../../../services/access_service.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// Create-event form (POST /api/events). New events enter the approval
/// chain at PENDING_DISPATCH, exactly like the web form.
class CreateEventScreen extends StatefulWidget {
  const CreateEventScreen({super.key});

  @override
  State<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends State<CreateEventScreen> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  String _type = 'MEETING';
  DateTime? _start;
  DateTime? _end;
  final _venue = TextEditingController();
  final _speaker = TextEditingController();
  final _objective = TextEditingController();
  final _description = TextEditingController();
  String? _lifeGroupTarget;
  String? _departmentId;

  bool _isPaid = false;
  final _fee = TextEditingController();
  final _feeCurrency = TextEditingController(text: 'ZMW');

  bool _transport = false;
  final _transportNeeds = TextEditingController();
  bool _budget = false;
  final _budgetAmount = TextEditingController();
  final _budgetCurrency = TextEditingController(text: 'ZMW');
  final _budgetPurpose = TextEditingController();
  bool _media = false;
  final _mediaNeeds = TextEditingController();
  bool _food = false;
  final _foodNeeds = TextEditingController();

  bool _submitting = false;

  @override
  void dispose() {
    for (final c in [
      _title, _venue, _speaker, _objective, _description, _fee, _feeCurrency,
      _transportNeeds, _budgetAmount, _budgetCurrency, _budgetPurpose,
      _mediaNeeds, _foodNeeds,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<DateTime?> _pickDateTime(DateTime? initial) async {
    final date = await showDatePicker(
      context: context,
      initialDate: initial ?? DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (date == null || !mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: initial != null
          ? TimeOfDay.fromDateTime(initial)
          : const TimeOfDay(hour: 9, minute: 0),
    );
    if (time == null) return DateTime(date.year, date.month, date.day, 9);
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      showAppSnackBar(context, 'Please fill in the highlighted fields.',
          isError: true);
      return;
    }
    if (_start == null) {
      showAppSnackBar(context, 'Pick a start date and time.', isError: true);
      return;
    }

    setState(() => _submitting = true);
    final api = context.read<ApiClient>();
    String? text(TextEditingController c) =>
        c.text.trim().isEmpty ? null : c.text.trim();

    try {
      await api.postJson('/api/events', {
        'title': _title.text.trim(),
        'type': _type,
        'startDate': _start!.toIso8601String(),
        'endDate': ?_end?.toIso8601String(),
        'venue': _venue.text.trim(),
        'description': ?text(_description),
        'lifeGroupTarget': ?_lifeGroupTarget,
        'createdByDepartmentId': ?_departmentId,
        'speaker': ?text(_speaker),
        'objective': _objective.text.trim(),
        'isPaid': _isPaid,
        if (_isPaid) 'attendanceFee': num.tryParse(_fee.text.trim()),
        if (_isPaid) 'attendanceFeeCurrency': _feeCurrency.text.trim(),
        'transportRequired': _transport,
        if (_transport) 'transportNeeds': _transportNeeds.text.trim(),
        'budgetRequested': _budget,
        if (_budget) 'budgetAmount': num.tryParse(_budgetAmount.text.trim()),
        if (_budget) 'budgetCurrency': _budgetCurrency.text.trim(),
        if (_budget) 'budgetPurpose': _budgetPurpose.text.trim(),
        'mediaRequired': _media,
        if (_media) 'mediaNeeds': _mediaNeeds.text.trim(),
        'foodRequired': _food,
        if (_food) 'foodNeeds': _foodNeeds.text.trim(),
      });
      if (mounted) {
        showAppSnackBar(context,
            'Event submitted — it now enters the approval chain.');
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<AuthService>().profile;
    final access = context.watch<AccessService>();
    final myDepartments = access.departments
        .where((d) =>
            profile != null &&
            (profile.leadsDepartmentIds.contains(d.id) ||
                profile.departmentIds.contains(d.id)))
        .toList();
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('New Event')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            const SectionHeader('Basics'),
            TextFormField(
              controller: _title,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Event title *'),
              validator: _required,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(labelText: 'Type *'),
              items: eventTypeMeta.entries
                  .map((e) => DropdownMenuItem(
                      value: e.key, child: Text(e.value.label)))
                  .toList(),
              onChanged: (v) => setState(() => _type = v ?? 'MEETING'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _DateTimeField(
                    label: 'Starts *',
                    value: _start,
                    onTap: () async {
                      final picked = await _pickDateTime(_start);
                      if (picked != null) setState(() => _start = picked);
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _DateTimeField(
                    label: 'Ends (optional)',
                    value: _end,
                    onTap: () async {
                      final picked = await _pickDateTime(_end ?? _start);
                      if (picked != null) setState(() => _end = picked);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _venue,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Venue *'),
              validator: _required,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _objective,
              maxLines: 2,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Objective *',
                hintText: 'What should this event achieve?',
              ),
              validator: _required,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _speaker,
              textCapitalization: TextCapitalization.words,
              decoration:
                  const InputDecoration(labelText: 'Speaker (optional)'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _description,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration:
                  const InputDecoration(labelText: 'Description (optional)'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _lifeGroupTarget,
              decoration:
                  const InputDecoration(labelText: 'Audience (optional)'),
              items: [
                const DropdownMenuItem<String>(
                    value: null, child: Text('Everyone')),
                const DropdownMenuItem(
                    value: 'ALL', child: Text('All life groups')),
                ...lifeGroups.map((g) => DropdownMenuItem(
                    value: g,
                    child: Text('${g[0]}${g.substring(1).toLowerCase()} '
                        'life group'))),
              ],
              onChanged: (v) => setState(() => _lifeGroupTarget = v),
            ),
            if (myDepartments.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _departmentId,
                decoration: const InputDecoration(
                    labelText: 'Initiating department (optional)'),
                items: [
                  const DropdownMenuItem<String>(
                      value: null, child: Text('None / personal')),
                  ...myDepartments.map((d) =>
                      DropdownMenuItem(value: d.id, child: Text(d.name))),
                ],
                onChanged: (v) => setState(() => _departmentId = v),
              ),
            ],
            const SizedBox(height: 20),
            const SectionHeader('Attendance'),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: PWColors.gold,
              title: Text('Paid event', style: textTheme.bodyMedium),
              value: _isPaid,
              onChanged: (v) => setState(() => _isPaid = v),
            ),
            if (_isPaid)
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: TextFormField(
                      controller: _fee,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Fee amount *'),
                      validator: (v) => _isPaid &&
                              (num.tryParse(v?.trim() ?? '') ?? 0) <= 0
                          ? 'Enter a positive amount'
                          : null,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _feeCurrency,
                      decoration:
                          const InputDecoration(labelText: 'Currency'),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 20),
            const SectionHeader('Support needed'),
            Text(
              'Each toggle routes a request to that team during approval.',
              style: textTheme.bodySmall?.copyWith(color: PWColors.clay400),
            ),
            const SizedBox(height: 6),
            _NeedToggle(
              title: 'Transport',
              value: _transport,
              onChanged: (v) => setState(() => _transport = v),
              child: TextFormField(
                controller: _transportNeeds,
                maxLines: 2,
                decoration: const InputDecoration(
                    labelText: 'Transport needs *',
                    hintText: 'e.g. 2 minibuses to the campsite'),
                validator: (v) => _transport && (v?.trim().isEmpty ?? true)
                    ? 'Describe the transport needs'
                    : null,
              ),
            ),
            _NeedToggle(
              title: 'Budget / funds',
              value: _budget,
              onChanged: (v) => setState(() => _budget = v),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: TextFormField(
                          controller: _budgetAmount,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Amount *'),
                          validator: (v) => _budget &&
                                  (num.tryParse(v?.trim() ?? '') ?? 0) <= 0
                              ? 'Enter a positive amount'
                              : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _budgetCurrency,
                          decoration:
                              const InputDecoration(labelText: 'Currency'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _budgetPurpose,
                    decoration:
                        const InputDecoration(labelText: 'Purpose *'),
                    validator: (v) => _budget && (v?.trim().isEmpty ?? true)
                        ? 'What is the budget for?'
                        : null,
                  ),
                ],
              ),
            ),
            _NeedToggle(
              title: 'Media (sound / publicity / coverage)',
              value: _media,
              onChanged: (v) => setState(() => _media = v),
              child: TextFormField(
                controller: _mediaNeeds,
                maxLines: 2,
                decoration:
                    const InputDecoration(labelText: 'Media needs *'),
                validator: (v) => _media && (v?.trim().isEmpty ?? true)
                    ? 'Describe the media needs'
                    : null,
              ),
            ),
            _NeedToggle(
              title: 'Food / catering',
              value: _food,
              onChanged: (v) => setState(() => _food = v),
              child: TextFormField(
                controller: _foodNeeds,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Food needs *'),
                validator: (v) => _food && (v?.trim().isEmpty ?? true)
                    ? 'Describe the food needs'
                    : null,
              ),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: PWColors.cream),
                    )
                  : const Text('Submit for approval'),
            ),
          ],
        ),
      ),
    );
  }

  static String? _required(String? v) =>
      (v == null || v.trim().isEmpty) ? 'Required' : null;
}

class _DateTimeField extends StatelessWidget {
  const _DateTimeField({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final DateTime? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: InputDecorator(
        decoration: InputDecoration(labelText: label),
        child: Text(
          value == null
              ? 'Tap to pick'
              : DateFormat('MMM d · HH:mm').format(value!),
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: value == null ? PWColors.clay300 : PWColors.clay800,
              ),
        ),
      ),
    );
  }
}

class _NeedToggle extends StatelessWidget {
  const _NeedToggle({
    required this.title,
    required this.value,
    required this.onChanged,
    required this.child,
  });

  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeThumbColor: PWColors.gold,
          title:
              Text(title, style: Theme.of(context).textTheme.bodyMedium),
          value: value,
          onChanged: onChanged,
        ),
        if (value)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: child,
          ),
      ],
    );
  }
}
