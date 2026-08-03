import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/common.dart';
import '../../data/models/requests.dart';
import '../../data/models/user.dart';
import '../../data/repositories/request_repository.dart';
import '../services/service_detail_screen.dart' show activeMembersProvider;

/// The coordinator prices a transport job, which sends it to the Treasurer.
class TransportDetailsSheet extends ConsumerStatefulWidget {
  const TransportDetailsSheet({super.key, required this.request});

  final TransportRequest request;

  @override
  ConsumerState<TransportDetailsSheet> createState() =>
      _TransportDetailsSheetState();
}

class _TransportDetailsSheetState
    extends ConsumerState<TransportDetailsSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _vehicleType =
      TextEditingController(text: widget.request.vehicleType);
  late final _vehicleCount = TextEditingController(
      text: '${widget.request.vehicleCount ?? 1}');
  late final _cost = TextEditingController(
      text: widget.request.estimatedCost?.toStringAsFixed(0));
  late final _pickup =
      TextEditingController(text: widget.request.pickupLocation);
  late final _dropoff =
      TextEditingController(text: widget.request.dropoffLocation);
  late final _notes =
      TextEditingController(text: widget.request.coordinatorNotes);

  DateTime? _pickupTime;
  DateTime? _returnTime;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _pickupTime = widget.request.pickupTime;
    _returnTime = widget.request.returnTime;
  }

  @override
  void dispose() {
    _vehicleType.dispose();
    _vehicleCount.dispose();
    _cost.dispose();
    _pickup.dispose();
    _dropoff.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<DateTime?> _pickDateTime(DateTime? initial) async {
    final base = initial ?? widget.request.eventStartDate;
    final date = await showDatePicker(
      context: context,
      initialDate: base,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(base),
    );
    if (time == null) return null;
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final count = int.tryParse(_vehicleCount.text.trim()) ?? 0;
    final cost = double.tryParse(_cost.text.trim().replaceAll(',', ''));
    if (count < 1) {
      context.showError('At least one vehicle is needed.');
      return;
    }
    if (cost == null || cost < 0) {
      context.showError('Enter the estimated cost.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(requestRepositoryProvider).submitTransportDetails(
            widget.request.id,
            vehicleType: _vehicleType.text.trim(),
            vehicleCount: count,
            estimatedCost: cost,
            currency: widget.request.currency ?? 'ZMW',
            pickupLocation: _pickup.text.trim(),
            dropoffLocation: _dropoff.text.trim(),
            pickupTime: _pickupTime,
            returnTime: _returnTime,
            coordinatorNotes: _notes.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess('Costed — the Treasurer has it now.');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetShell(
      title: 'Price this job',
      subtitle: '${widget.request.eventTitle} · '
          '${D.dayMedium(widget.request.eventStartDate)}',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            AppTextField(
              label: 'Vehicle type',
              controller: _vehicleType,
              required: true,
              hint: 'Coaster, minibus, hired van…',
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: AppTextField(
                    label: 'How many',
                    controller: _vehicleCount,
                    required: true,
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: AppTextField(
                    label: 'Estimated cost '
                        '(${widget.request.currency ?? 'ZMW'})',
                    controller: _cost,
                    required: true,
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            AppTextField(label: 'Pick up from', controller: _pickup),
            const SizedBox(height: 14),
            _TimeField(
              label: 'Pick up at',
              value: _pickupTime,
              onTap: () async {
                final picked = await _pickDateTime(_pickupTime);
                if (picked != null) setState(() => _pickupTime = picked);
              },
            ),
            const SizedBox(height: 14),
            AppTextField(label: 'Drop off at', controller: _dropoff),
            const SizedBox(height: 14),
            _TimeField(
              label: 'Back by',
              value: _returnTime,
              onTap: () async {
                final picked = await _pickDateTime(_returnTime);
                if (picked != null) setState(() => _returnTime = picked);
              },
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Notes for the Treasurer',
              controller: _notes,
              maxLines: 3,
            ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: 'Send to the Treasurer',
              icon: AppIcons.send,
              loading: _busy,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

/// Media confirmation: all three roles, or none. The server enforces this, so
/// the sheet does too rather than letting someone find out on submit.
class MediaAssignSheet extends ConsumerStatefulWidget {
  const MediaAssignSheet({super.key, required this.request});

  final MediaRequest request;

  @override
  ConsumerState<MediaAssignSheet> createState() => _MediaAssignSheetState();
}

class _MediaAssignSheetState extends ConsumerState<MediaAssignSheet> {
  AppUser? _sound;
  AppUser? _publicity;
  AppUser? _coverage;
  final _notes = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_sound == null || _publicity == null || _coverage == null) {
      context.showError('All three roles need someone — coverage that is '
          'half arranged is worse than none.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(requestRepositoryProvider).confirmMedia(
            widget.request.id,
            soundUserId: _sound!.id,
            soundUserName: _sound!.name,
            publicityUserId: _publicity!.id,
            publicityUserName: _publicity!.name,
            coverageUserId: _coverage!.id,
            coverageUserName: _coverage!.name,
            comments: _notes.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess('Media confirmed and the team told.');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final members = ref.watch(activeMembersProvider).valueOrNull ?? const [];

    return _SheetShell(
      title: 'Assign the media team',
      subtitle: '${widget.request.eventTitle} · '
          '${D.dayMedium(widget.request.eventStartDate)}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _MemberSlot(
            label: 'Sound',
            icon: AppIcons.mic,
            tone: IconTone.periwinkle,
            selected: _sound,
            members: members,
            onSelect: (m) => setState(() => _sound = m),
          ),
          const SizedBox(height: 12),
          _MemberSlot(
            label: 'Publicity',
            icon: AppIcons.megaphone,
            tone: IconTone.lavender,
            selected: _publicity,
            members: members,
            onSelect: (m) => setState(() => _publicity = m),
          ),
          const SizedBox(height: 12),
          _MemberSlot(
            label: 'Coverage',
            icon: AppIcons.camera,
            tone: IconTone.blue,
            selected: _coverage,
            members: members,
            onSelect: (m) => setState(() => _coverage = m),
          ),
          const SizedBox(height: 16),
          AppTextField(
            label: 'Notes',
            controller: _notes,
            maxLines: 3,
            hint: 'Anything the team needs to know',
          ),
          const SizedBox(height: 22),
          PrimaryButton(
            label: 'Confirm media',
            icon: AppIcons.check,
            loading: _busy,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}

/// Food Logistics plans the catering, and can raise the budget request for it
/// in the same step.
class FoodPlanSheet extends ConsumerStatefulWidget {
  const FoodPlanSheet({super.key, required this.request});

  final FoodRequest request;

  @override
  ConsumerState<FoodPlanSheet> createState() => _FoodPlanSheetState();
}

class _FoodPlanSheetState extends ConsumerState<FoodPlanSheet> {
  late final _headcount =
      TextEditingController(text: widget.request.headcount?.toString());
  late final _menu = TextEditingController(text: widget.request.menuPlan);
  final _notes = TextEditingController();
  final _budgetAmount = TextEditingController();
  final _budgetPurpose = TextEditingController(text: 'Catering');
  bool _raiseBudget = false;
  bool _busy = false;

  @override
  void dispose() {
    _headcount.dispose();
    _menu.dispose();
    _notes.dispose();
    _budgetAmount.dispose();
    _budgetPurpose.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = _raiseBudget
        ? double.tryParse(_budgetAmount.text.trim().replaceAll(',', ''))
        : null;
    if (_raiseBudget && (amount == null || amount <= 0)) {
      context.showError('Enter how much catering will cost.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(requestRepositoryProvider).confirmFood(
            widget.request.id,
            headcount: int.tryParse(_headcount.text.trim()),
            menuPlan: _menu.text.trim(),
            comments: _notes.text.trim(),
            budgetAmount: amount,
            budgetPurpose: _budgetPurpose.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess(_raiseBudget
          ? 'Confirmed, and the catering budget is with the Treasurer.'
          : 'Food confirmed.');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetShell(
      title: 'Plan the catering',
      subtitle: '${widget.request.eventTitle} · '
          '${D.dayMedium(widget.request.eventStartDate)}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          AppTextField(
            label: 'Headcount',
            controller: _headcount,
            keyboardType: TextInputType.number,
            hint: 'How many people are eating',
          ),
          const SizedBox(height: 14),
          AppTextField(
            label: 'Menu plan',
            controller: _menu,
            maxLines: 4,
            hint: 'What is being served',
          ),
          const SizedBox(height: 14),
          AppTextField(
            label: 'Notes',
            controller: _notes,
            maxLines: 2,
          ),
          const SizedBox(height: 18),
          InkWell(
            onTap: () => setState(() => _raiseBudget = !_raiseBudget),
            borderRadius: BorderRadius.circular(AppRadius.card),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _raiseBudget
                    ? AppColors.emerald50
                    : Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(
                  color: _raiseBudget
                      ? AppColors.emerald600.withValues(alpha: 0.35)
                      : AppColors.border,
                ),
              ),
              child: Row(
                children: [
                  Icon(AppIcons.money,
                      size: 18,
                      color: _raiseBudget
                          ? AppColors.emerald600
                          : AppColors.clay400),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Ask the Treasurer for catering funds',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.clay700,
                      ),
                    ),
                  ),
                  Switch(
                    value: _raiseBudget,
                    onChanged: (v) => setState(() => _raiseBudget = v),
                  ),
                ],
              ),
            ),
          ),
          if (_raiseBudget) ...[
            const SizedBox(height: 14),
            AppTextField(
              label: 'Amount (ZMW)',
              controller: _budgetAmount,
              required: true,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'What for',
              controller: _budgetPurpose,
              required: true,
            ),
          ],
          const SizedBox(height: 22),
          PrimaryButton(
            label: 'Confirm food',
            icon: AppIcons.check,
            loading: _busy,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}

// ─── Shared sheet pieces ───

class _SheetShell extends StatelessWidget {
  const _SheetShell({
    required this.title,
    required this.child,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: AppFonts.display(
                  const TextStyle(fontSize: 21, color: AppColors.clay700)),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 3),
              Text(
                subtitle!,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.clay400),
              ),
            ],
            const SizedBox(height: 20),
            child,
          ],
        ),
      ),
    );
  }
}

class _TimeField extends StatelessWidget {
  const _TimeField({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final DateTime? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FieldLabel(label),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.base),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.base),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(AppIcons.clock, size: 16, color: AppColors.clay300),
                const SizedBox(width: 11),
                Text(
                  value == null ? 'Not set' : D.dateTime(value),
                  style: TextStyle(
                    fontSize: 14.5,
                    color:
                        value == null ? AppColors.clay400 : AppColors.clay700,
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

class _MemberSlot extends StatelessWidget {
  const _MemberSlot({
    required this.label,
    required this.icon,
    required this.tone,
    required this.selected,
    required this.members,
    required this.onSelect,
  });

  final String label;
  final IconData icon;
  final IconTone tone;
  final AppUser? selected;
  final List<AppUser> members;
  final ValueChanged<AppUser> onSelect;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final chosen = await showModalBottomSheet<AppUser>(
          context: context,
          isScrollControlled: true,
          builder: (_) => _MemberList(members: members, roleName: label),
        );
        if (chosen != null) onSelect(chosen);
      },
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(
            color: selected == null
                ? AppColors.border
                : toneColors(tone).foreground.withValues(alpha: 0.35),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: toneColors(tone).foreground),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.clay400,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    selected?.name ?? 'Choose someone',
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: selected == null
                          ? AppColors.clay400
                          : AppColors.clay700,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(AppIcons.chevronRight,
                size: 16, color: AppColors.clay300),
          ],
        ),
      ),
    );
  }
}

class _MemberList extends StatefulWidget {
  const _MemberList({required this.members, required this.roleName});

  final List<AppUser> members;
  final String roleName;

  @override
  State<_MemberList> createState() => _MemberListState();
}

class _MemberListState extends State<_MemberList> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    final shown = q.isEmpty
        ? widget.members
        : widget.members
            .where((m) => m.name.toLowerCase().contains(q))
            .toList();

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 4,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Who is on ${widget.roleName}?',
            style: AppFonts.display(
                const TextStyle(fontSize: 20, color: AppColors.clay700)),
          ),
          const SizedBox(height: 14),
          TextField(
            autofocus: true,
            onChanged: (v) => setState(() => _query = v),
            decoration: const InputDecoration(
              hintText: 'Search members',
              prefixIcon:
                  Icon(AppIcons.search, size: 18, color: AppColors.clay300),
            ),
          ),
          const SizedBox(height: 12),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: shown.length,
              separatorBuilder: (_, __) => const LuxDivider(indent: 0),
              itemBuilder: (context, i) => LuxTile(
                title: shown[i].name,
                subtitle: shown[i].role.label,
                leading: MemberAvatar(
                  initials: shown[i].initials,
                  imageUrl: shown[i].profileImage,
                  size: 36,
                ),
                dense: true,
                onTap: () => Navigator.of(context).pop(shown[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
