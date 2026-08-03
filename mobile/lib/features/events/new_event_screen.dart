import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/service_repository.dart';
import '../calendar/calendar_screen.dart' show eventIcon, eventTone;
import 'event_approvals_screen.dart';

/// Create an event, in three steps.
///
/// Step 3 is where the real work is: an event says up front what it needs —
/// transport, media, food, money — and dispatching turns each of those into a
/// request to the right coordinator. Getting them stated here is what makes
/// the rest of the chain work.
class NewEventScreen extends ConsumerStatefulWidget {
  const NewEventScreen({super.key});

  @override
  ConsumerState<NewEventScreen> createState() => _NewEventScreenState();
}

class _NewEventScreenState extends ConsumerState<NewEventScreen> {
  final _pageKey = GlobalKey<FormState>();
  int _step = 0;

  // Step 1 — what and when
  final _title = TextEditingController();
  final _venue = TextEditingController();
  final _description = TextEditingController();
  final _speaker = TextEditingController();
  final _objective = TextEditingController();
  EventType _type = EventType.specialEvent;
  DateTime _start = DateTime.now().add(const Duration(days: 14));
  TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  DateTime? _end;

  // Step 2 — who it is for
  String? _lifeGroupTarget;
  String? _departmentId;
  final _fee = TextEditingController();
  bool _isPaid = false;

  // Step 3 — what it needs
  bool _transport = false;
  final _transportNeeds = TextEditingController();
  bool _media = false;
  final _mediaNeeds = TextEditingController();
  bool _food = false;
  final _foodNeeds = TextEditingController();
  bool _budget = false;
  final _budgetAmount = TextEditingController();
  final _budgetPurpose = TextEditingController();

  bool _busy = false;

  @override
  void dispose() {
    for (final c in [
      _title,
      _venue,
      _description,
      _speaker,
      _objective,
      _fee,
      _transportNeeds,
      _mediaNeeds,
      _foodNeeds,
      _budgetAmount,
      _budgetPurpose,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  DateTime get _startWithTime => DateTime(
        _start.year,
        _start.month,
        _start.day,
        _startTime.hour,
        _startTime.minute,
      );

  bool get _step1Valid =>
      _title.text.trim().isNotEmpty && _venue.text.trim().isNotEmpty;

  Future<void> _submit() async {
    if (!_step1Valid) {
      setState(() => _step = 0);
      context.showError('A title and a venue are both needed.');
      return;
    }
    if (_budget) {
      final amount =
          double.tryParse(_budgetAmount.text.trim().replaceAll(',', ''));
      if (amount == null || amount <= 0) {
        context.showError('Enter how much this event needs.');
        return;
      }
    }

    setState(() => _busy = true);
    try {
      final result = await ref.read(eventRepositoryProvider).create({
        'title': _title.text.trim(),
        'type': _type.wire,
        'startDate': _startWithTime.toUtc().toIso8601String(),
        if (_end != null) 'endDate': _end!.toUtc().toIso8601String(),
        'venue': _venue.text.trim(),
        if (_description.text.trim().isNotEmpty)
          'description': _description.text.trim(),
        if (_speaker.text.trim().isNotEmpty) 'speaker': _speaker.text.trim(),
        if (_objective.text.trim().isNotEmpty)
          'objective': _objective.text.trim(),
        if (_lifeGroupTarget != null) 'lifeGroupTarget': _lifeGroupTarget,
        if (_departmentId != null) 'createdByDepartmentId': _departmentId,
        'isPaid': _isPaid,
        if (_isPaid) 'attendanceFee': double.tryParse(_fee.text.trim()),
        if (_isPaid) 'attendanceFeeCurrency': 'ZMW',
        'transportRequired': _transport,
        if (_transport) 'transportNeeds': _transportNeeds.text.trim(),
        'mediaRequired': _media,
        if (_media) 'mediaNeeds': _mediaNeeds.text.trim(),
        'foodRequired': _food,
        if (_food) 'foodNeeds': _foodNeeds.text.trim(),
        'budgetRequested': _budget,
        if (_budget)
          'budgetAmount':
              double.tryParse(_budgetAmount.text.trim().replaceAll(',', '')),
        if (_budget) 'budgetCurrency': 'ZMW',
        if (_budget) 'budgetPurpose': _budgetPurpose.text.trim(),
      });

      if (!mounted) return;
      ref.invalidate(pendingEventsProvider);

      final event = result['event'];
      final approved = event is Map &&
          '${event['approvalStatus'] ?? ''}' == 'APPROVED';

      context.showSuccess(approved
          ? 'Event created and published to the calendar.'
          : 'Event created — it now goes through the approval chain.');

      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/manage/events/approvals');
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
    if (!access.can('create_events')) {
      return const AppScaffold(
        title: 'New event',
        body: NoAccessView(
          message: 'Creating events needs the Create Events permission.',
        ),
      );
    }

    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];

    return DetailScaffold(
      title: 'New event',
      subtitle: 'Step ${_step + 1} of 3',
      body: Form(
        key: _pageKey,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            _StepBar(step: _step, onSelect: (i) => setState(() => _step = i)),
            const SizedBox(height: 20),
            if (_step == 0) ..._whatAndWhen(),
            if (_step == 1) ..._whoFor(departments),
            if (_step == 2) ..._whatItNeeds(),
          ],
        ),
      ),
      bottomBar: Row(
        children: [
          if (_step > 0)
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() => _step -= 1),
                child: const Text('Back'),
              ),
            ),
          if (_step > 0) const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: _step < 2
                ? PrimaryButton(
                    label: 'Continue',
                    icon: AppIcons.forward,
                    onPressed: () {
                      if (_step == 0 && !_step1Valid) {
                        context.showError(
                            'A title and a venue are both needed.');
                        return;
                      }
                      setState(() => _step += 1);
                    },
                  )
                : PrimaryButton(
                    label: 'Create event',
                    icon: AppIcons.check,
                    loading: _busy,
                    onPressed: _submit,
                  ),
          ),
        ],
      ),
    );
  }

  List<Widget> _whatAndWhen() => [
        const SectionHeading(
          title: 'What and when',
          icon: AppIcons.calendar,
          tone: IconTone.gold,
        ),
        const SizedBox(height: 12),
        LuxCard(
          child: Column(
            children: [
              AppTextField(
                label: 'Title',
                controller: _title,
                required: true,
                textCapitalization: TextCapitalization.words,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              const FieldLabel('Kind of event', required: true),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final type in EventType.values)
                    _TypeChip(
                      type: type,
                      selected: _type == type,
                      onTap: () => setState(() => _type = type),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              _DateField(
                label: 'Starts',
                required: true,
                value: _start,
                time: _startTime,
                onPickDate: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _start,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 730)),
                  );
                  if (picked != null) setState(() => _start = picked);
                },
                onPickTime: () async {
                  final picked = await showTimePicker(
                      context: context, initialTime: _startTime);
                  if (picked != null) setState(() => _startTime = picked);
                },
              ),
              const SizedBox(height: 14),
              _DateField(
                label: 'Ends',
                value: _end,
                hint: 'Only for a multi-day event',
                onPickDate: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _end ?? _start,
                    firstDate: _start,
                    lastDate: _start.add(const Duration(days: 60)),
                  );
                  if (picked != null) setState(() => _end = picked);
                },
                onClear: _end == null ? null : () => setState(() => _end = null),
              ),
              const SizedBox(height: 14),
              AppTextField(
                label: 'Venue',
                controller: _venue,
                required: true,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              AppTextField(
                label: 'Speaker',
                controller: _speaker,
                hint: 'Who is ministering, if anyone',
                textCapitalization: TextCapitalization.words,
              ),
            ],
          ),
        ),
      ];

  List<Widget> _whoFor(List<dynamic> departments) => [
        const SectionHeading(
          title: 'Who it is for',
          icon: AppIcons.usersRound,
          tone: IconTone.periwinkle,
        ),
        const SizedBox(height: 12),
        LuxCard(
          child: Column(
            children: [
              AppTextField(
                label: 'Why we are doing this',
                controller: _objective,
                maxLines: 3,
                hint: 'The objective — this appears on the report afterwards',
              ),
              const SizedBox(height: 14),
              AppTextField(
                label: 'Details',
                controller: _description,
                maxLines: 4,
                hint: 'What members should know',
              ),
              const SizedBox(height: 14),
              AppDropdown<String>(
                label: 'Life Group',
                hint: 'Everyone',
                value: _lifeGroupTarget,
                items: [
                  const DropdownMenuItem(value: null, child: Text('Everyone')),
                  for (final g in LifeGroup.values)
                    DropdownMenuItem(value: g.wire, child: Text(g.label)),
                ],
                onChanged: (v) => setState(() => _lifeGroupTarget = v),
              ),
              const SizedBox(height: 14),
              AppDropdown<String>(
                label: 'Raised by',
                hint: 'Which department',
                value: _departmentId,
                items: [
                  for (final d in departments)
                    DropdownMenuItem(
                        value: d.id as String, child: Text(d.name as String)),
                ],
                onChanged: (v) => setState(() => _departmentId = v),
              ),
              const SizedBox(height: 18),
              _Toggle(
                label: 'There is an attendance fee',
                icon: AppIcons.money,
                tone: IconTone.emerald,
                value: _isPaid,
                onChanged: (v) => setState(() => _isPaid = v),
              ),
              if (_isPaid) ...[
                const SizedBox(height: 14),
                AppTextField(
                  label: 'Fee per person (ZMW)',
                  controller: _fee,
                  keyboardType: TextInputType.number,
                ),
              ],
            ],
          ),
        ),
      ];

  List<Widget> _whatItNeeds() => [
        const SectionHeading(
          title: 'What it needs',
          icon: AppIcons.inbox,
          tone: IconTone.amber,
        ),
        const SizedBox(height: 8),
        const NoticeCard(
          tone: IconTone.gold,
          icon: AppIcons.info,
          message: 'Each need becomes a request to the right coordinator when '
              'the Events Lead dispatches. State them now — adding one later '
              'means going back through the chain.',
        ),
        const SizedBox(height: 16),
        _NeedCard(
          label: 'Transport',
          icon: AppIcons.transport,
          tone: IconTone.blue,
          value: _transport,
          controller: _transportNeeds,
          hint: 'How many people, from where',
          onChanged: (v) => setState(() => _transport = v),
        ),
        const SizedBox(height: 12),
        _NeedCard(
          label: 'Media',
          icon: AppIcons.media,
          tone: IconTone.lavender,
          value: _media,
          controller: _mediaNeeds,
          hint: 'Sound, publicity, photos, livestream…',
          onChanged: (v) => setState(() => _media = v),
        ),
        const SizedBox(height: 12),
        _NeedCard(
          label: 'Food',
          icon: AppIcons.food,
          tone: IconTone.amber,
          value: _food,
          controller: _foodNeeds,
          hint: 'How many meals, and any dietary needs',
          onChanged: (v) => setState(() => _food = v),
        ),
        const SizedBox(height: 12),
        _NeedCard(
          label: 'A budget',
          icon: AppIcons.money,
          tone: IconTone.emerald,
          value: _budget,
          controller: _budgetPurpose,
          hint: 'What the money is for',
          onChanged: (v) => setState(() => _budget = v),
          extra: _budget
              ? AppTextField(
                  label: 'Amount (ZMW)',
                  controller: _budgetAmount,
                  required: true,
                  keyboardType: TextInputType.number,
                )
              : null,
        ),
        const SizedBox(height: 20),
        _Summary(
          title: _title.text.trim(),
          type: _type,
          start: _startWithTime,
          end: _end,
          venue: _venue.text.trim(),
          needs: [
            if (_transport) 'Transport',
            if (_media) 'Media',
            if (_food) 'Food',
            if (_budget) 'Budget',
          ],
          fee: _isPaid ? double.tryParse(_fee.text.trim()) : null,
        ),
      ];
}

class _StepBar extends StatelessWidget {
  const _StepBar({required this.step, required this.onSelect});

  final int step;
  final ValueChanged<int> onSelect;

  static const _labels = ['What & when', 'Who for', 'What it needs'];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < _labels.length; i++) ...[
          Expanded(
            child: GestureDetector(
              // Going back to review is always allowed; going forward is the
              // Continue button's job, so validation happens in one place.
              onTap: i < step ? () => onSelect(i) : null,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    height: 4,
                    decoration: BoxDecoration(
                      color: i <= step ? AppColors.gold : AppColors.clay100,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _labels[i],
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight:
                          i == step ? FontWeight.w700 : FontWeight.w500,
                      color: i == step
                          ? AppColors.goldDark
                          : AppColors.clay300,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (i != _labels.length - 1) const SizedBox(width: 6),
        ],
      ],
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({
    required this.type,
    required this.selected,
    required this.onTap,
  });

  final EventType type;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = toneColors(eventTone(type));
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? colors.background : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? colors.foreground : AppColors.border,
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(eventIcon(type),
                size: 14,
                color: selected ? colors.foreground : AppColors.clay400),
            const SizedBox(width: 7),
            Text(
              type.label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? colors.foreground : AppColors.clay500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onPickDate,
    this.time,
    this.onPickTime,
    this.required = false,
    this.hint,
    this.onClear,
  });

  final String label;
  final DateTime? value;
  final TimeOfDay? time;
  final VoidCallback onPickDate;
  final VoidCallback? onPickTime;
  final bool required;
  final String? hint;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FieldLabel(label, required: required),
        Row(
          children: [
            Expanded(
              flex: 2,
              child: InkWell(
                onTap: onPickDate,
                borderRadius: BorderRadius.circular(AppRadius.base),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 15),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.base),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(AppIcons.calendar,
                          size: 16, color: AppColors.clay300),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          value == null ? (hint ?? 'Choose') : D.medium(value),
                          style: TextStyle(
                            fontSize: 14,
                            color: value == null
                                ? AppColors.clay400
                                : AppColors.clay700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (onPickTime != null) ...[
              const SizedBox(width: 10),
              Expanded(
                child: InkWell(
                  onTap: onPickTime,
                  borderRadius: BorderRadius.circular(AppRadius.base),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 15),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(AppRadius.base),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(AppIcons.clock,
                            size: 15, color: AppColors.clay300),
                        const SizedBox(width: 7),
                        Text(
                          time == null
                              ? '--:--'
                              : '${time!.hour.toString().padLeft(2, '0')}:'
                                  '${time!.minute.toString().padLeft(2, '0')}',
                          style: const TextStyle(
                              fontSize: 14, color: AppColors.clay700),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
            if (onClear != null) ...[
              const SizedBox(width: 6),
              IconButton(
                icon: const Icon(AppIcons.close, size: 17),
                color: AppColors.clay300,
                onPressed: onClear,
                tooltip: 'Clear',
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _Toggle extends StatelessWidget {
  const _Toggle({
    required this.label,
    required this.icon,
    required this.tone,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final IconData icon;
  final IconTone tone;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = toneColors(tone);
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: value ? colors.background : Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(
            color: value
                ? colors.foreground.withValues(alpha: 0.35)
                : AppColors.border,
          ),
        ),
        child: Row(
          children: [
            Icon(icon,
                size: 18,
                color: value ? colors.foreground : AppColors.clay400),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.clay700,
                ),
              ),
            ),
            Switch(value: value, onChanged: onChanged),
          ],
        ),
      ),
    );
  }
}

class _NeedCard extends StatelessWidget {
  const _NeedCard({
    required this.label,
    required this.icon,
    required this.tone,
    required this.value,
    required this.controller,
    required this.onChanged,
    this.hint,
    this.extra,
  });

  final String label;
  final IconData icon;
  final IconTone tone;
  final bool value;
  final TextEditingController controller;
  final ValueChanged<bool> onChanged;
  final String? hint;
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          _Toggle(
            label: label,
            icon: icon,
            tone: tone,
            value: value,
            onChanged: onChanged,
          ),
          if (value) ...[
            const SizedBox(height: 14),
            if (extra != null) ...[extra!, const SizedBox(height: 14)],
            AppTextField(
              label: 'What is needed',
              controller: controller,
              maxLines: 3,
              hint: hint,
            ),
          ],
        ],
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({
    required this.title,
    required this.type,
    required this.start,
    required this.venue,
    required this.needs,
    this.end,
    this.fee,
  });

  final String title;
  final EventType type;
  final DateTime start;
  final DateTime? end;
  final String venue;
  final List<String> needs;
  final double? fee;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      color: AppColors.cream,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'BEFORE YOU CREATE IT',
            style: context.eyebrow,
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(eventIcon(type), tone: eventTone(type), size: 42),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title.isEmpty ? 'Untitled event' : title,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 18,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${end == null ? D.dateTime(start) : D.range(start, end)}'
                      '${venue.isEmpty ? '' : ' · $venue'}',
                      style: const TextStyle(
                          fontSize: 12.5, color: AppColors.clay500),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (needs.isNotEmpty || fee != null) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: [
                for (final need in needs)
                  StatusBadge(need, tone: IconTone.periwinkle, dense: true),
                if (fee != null)
                  StatusBadge(Money.format(fee, 'ZMW'),
                      tone: IconTone.emerald,
                      icon: AppIcons.money,
                      dense: true),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
