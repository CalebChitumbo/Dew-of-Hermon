import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/requests.dart';
import '../../data/repositories/request_repository.dart';
import 'request_queue_screen.dart' show transportQueueProvider;

final transportRequestProvider =
    FutureProvider.family<TransportRequest?, String>((ref, id) async {
  final data =
      await ref.watch(apiClientProvider).getMap('/api/transport-requests/$id');
  final request = data['request'];
  if (request is Map) {
    return TransportRequest.fromMap(Map<String, dynamic>.from(request));
  }
  return data.isEmpty ? null : TransportRequest.fromMap(data);
});

/// One transport request: what was asked for, what it will cost, and the
/// Treasurer's answer. Mirrors `/manage/transport/requests/[id]`.
///
/// The coordinator prices the job here; submitting sends it to the Treasurer.
class TransportDetailScreen extends ConsumerStatefulWidget {
  const TransportDetailScreen({super.key, required this.requestId});

  final String requestId;

  @override
  ConsumerState<TransportDetailScreen> createState() =>
      _TransportDetailScreenState();
}

class _TransportDetailScreenState
    extends ConsumerState<TransportDetailScreen> {
  final _vehicleType = TextEditingController();
  final _vehicleCount = TextEditingController(text: '1');
  final _cost = TextEditingController();
  final _currency = TextEditingController(text: Money.defaultCurrency);
  final _pickup = TextEditingController();
  final _dropoff = TextEditingController();
  final _notes = TextEditingController();
  DateTime? _pickupTime;
  DateTime? _returnTime;

  bool _seeded = false;
  bool _busy = false;

  @override
  void dispose() {
    _vehicleType.dispose();
    _vehicleCount.dispose();
    _cost.dispose();
    _currency.dispose();
    _pickup.dispose();
    _dropoff.dispose();
    _notes.dispose();
    super.dispose();
  }

  /// Fill the form from whatever was submitted last, so a change requested by
  /// the Treasurer is an edit rather than a retype.
  void _seed(TransportRequest request) {
    if (_seeded) return;
    _seeded = true;
    _vehicleType.text = request.vehicleType ?? '';
    _vehicleCount.text = '${request.vehicleCount ?? 1}';
    _cost.text = request.estimatedCost == null
        ? ''
        : Money.plain(request.estimatedCost);
    _currency.text = request.currency ?? Money.defaultCurrency;
    _pickup.text = request.pickupLocation ?? '';
    _dropoff.text = request.dropoffLocation ?? '';
    _notes.text = request.coordinatorNotes ?? '';
    _pickupTime = request.pickupTime;
    _returnTime = request.returnTime;
  }

  Future<void> _pickTime({required bool isPickup}) async {
    final now = DateTime.now();
    final current = isPickup ? _pickupTime : _returnTime;
    final date = await showDatePicker(
      context: context,
      initialDate: current ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current ?? now),
    );
    if (!mounted) return;
    final combined = DateTime(
      date.year,
      date.month,
      date.day,
      time?.hour ?? 0,
      time?.minute ?? 0,
    );
    setState(() {
      if (isPickup) {
        _pickupTime = combined;
      } else {
        _returnTime = combined;
      }
    });
  }

  Future<void> _submit() async {
    if (_vehicleType.text.trim().isEmpty) {
      context.showError('Say what vehicle — Hiace, Coaster, and so on.');
      return;
    }
    final count = int.tryParse(_vehicleCount.text.trim());
    final cost = double.tryParse(_cost.text.trim());
    if (count == null || count < 1) {
      context.showError('How many vehicles?');
      return;
    }
    if (cost == null || cost < 0) {
      context.showError('Give the estimated cost.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(requestRepositoryProvider).submitTransportDetails(
            widget.requestId,
            vehicleType: _vehicleType.text.trim(),
            vehicleCount: count,
            estimatedCost: cost,
            currency: _currency.text.trim().isEmpty
                ? Money.defaultCurrency
                : _currency.text.trim().toUpperCase(),
            pickupLocation: _pickup.text.trim(),
            dropoffLocation: _dropoff.text.trim(),
            pickupTime: _pickupTime,
            returnTime: _returnTime,
            coordinatorNotes: _notes.text.trim(),
          );
      ref.invalidate(transportRequestProvider(widget.requestId));
      ref.invalidate(transportQueueProvider);
      if (mounted) {
        setState(() => _busy = false);
        context.showSuccess('Sent to the Treasurer to confirm the funds.');
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
    final async = ref.watch(transportRequestProvider(widget.requestId));

    if (!access.canView('transport_requests')) {
      return const DetailScaffold(
        title: 'Transport request',
        body: NoAccessView(),
      );
    }

    return DetailScaffold(
      title: 'Transport request',
      onRefresh: () async =>
          ref.invalidate(transportRequestProvider(widget.requestId)),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () =>
              ref.invalidate(transportRequestProvider(widget.requestId)),
        ),
        data: (request) {
          if (request == null) {
            return const EmptyStateLux(
              icon: AppIcons.alert,
              tone: IconTone.rose,
              title: 'Request not found',
              description: 'It may have been cancelled.',
            );
          }
          _seed(request);

          // Only the coordinator's own stage is editable; once it is with the
          // Treasurer the plan is read-only.
          final editable =
              request.status == TransportRequestStatus.pendingDetails &&
                  access.canEdit('transport_requests');

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              LuxCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const IconChip(AppIcons.transport,
                            tone: IconTone.blue, size: 44),
                        const SizedBox(width: 13),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                request.eventTitle,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.clay700,
                                ),
                              ),
                              const SizedBox(height: 4),
                              StatusBadge.forStatus(request.status.wire,
                                  label: request.status.label, dense: true),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    DetailRow(
                      label: 'Event',
                      value: D.dateTime(request.eventStartDate),
                      icon: AppIcons.calendar,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),
              const SectionHeading(
                title: 'What was asked for',
                icon: AppIcons.clipboard,
                tone: IconTone.periwinkle,
              ),
              const SizedBox(height: 12),
              LuxCard(
                child: Text(
                  (request.needsDescription ?? '').isEmpty
                      ? 'No details were given.'
                      : request.needsDescription!,
                  style: const TextStyle(
                      fontSize: 13.5, height: 1.7, color: AppColors.clay600),
                ),
              ),

              if (request.status == TransportRequestStatus.pendingDetails &&
                  (request.treasurerComments ?? '').isNotEmpty) ...[
                const SizedBox(height: 16),
                NoticeCard(
                  tone: IconTone.amber,
                  icon: AppIcons.alert,
                  title: 'The Treasurer asked for changes',
                  message: request.treasurerComments!,
                ),
              ],

              const SizedBox(height: 22),
              SectionHeading(
                title: editable ? 'Cost and schedule' : 'The submitted plan',
                icon: AppIcons.money,
                tone: IconTone.gold,
              ),
              const SizedBox(height: 12),

              if (editable) ...[
                AppTextField(
                  label: 'Vehicle type',
                  controller: _vehicleType,
                  required: true,
                  hint: 'e.g. Hiace, Coaster',
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
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(3),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: AppTextField(
                        label: 'Estimated cost',
                        controller: _cost,
                        required: true,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9.]')),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    SizedBox(
                      width: 84,
                      child: AppTextField(
                        label: 'Currency',
                        controller: _currency,
                        textCapitalization: TextCapitalization.characters,
                        inputFormatters: [
                          LengthLimitingTextInputFormatter(3),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'Pick-up point (optional)',
                  controller: _pickup,
                  hint: 'e.g. UNZA Main Gate',
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'Drop-off point (optional)',
                  controller: _dropoff,
                ),
                const SizedBox(height: 14),
                const FieldLabel('Pick-up time (optional)'),
                LuxTile(
                  title: _pickupTime == null
                      ? 'Set a time'
                      : D.dateTime(_pickupTime),
                  icon: AppIcons.clock,
                  dense: true,
                  onTap: () => _pickTime(isPickup: true),
                  trailing: _pickupTime == null
                      ? null
                      : IconButton(
                          icon: const Icon(AppIcons.close, size: 16),
                          color: AppColors.clay400,
                          onPressed: () => setState(() => _pickupTime = null),
                        ),
                ),
                const SizedBox(height: 12),
                const FieldLabel('Return time (optional)'),
                LuxTile(
                  title: _returnTime == null
                      ? 'Set a time'
                      : D.dateTime(_returnTime),
                  icon: AppIcons.clock,
                  dense: true,
                  onTap: () => _pickTime(isPickup: false),
                  trailing: _returnTime == null
                      ? null
                      : IconButton(
                          icon: const Icon(AppIcons.close, size: 16),
                          color: AppColors.clay400,
                          onPressed: () => setState(() => _returnTime = null),
                        ),
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'Notes for the Treasurer (optional)',
                  controller: _notes,
                  minLines: 2,
                  maxLines: 5,
                ),
                const SizedBox(height: 22),
                PrimaryButton(
                  label: 'Send to the Treasurer',
                  icon: AppIcons.send,
                  loading: _busy,
                  onPressed: _submit,
                ),
              ] else
                LuxCard(
                  child: Column(
                    children: [
                      DetailRow(
                        label: 'Vehicle',
                        value: [
                          if (request.vehicleCount != null)
                            '${request.vehicleCount}×',
                          request.vehicleType ?? '—',
                        ].join(' '),
                        icon: AppIcons.transport,
                      ),
                      DetailRow(
                        label: 'Estimated cost',
                        value: Money.format(
                            request.estimatedCost, request.currency),
                        icon: AppIcons.money,
                      ),
                      if ((request.pickupLocation ?? '').isNotEmpty)
                        DetailRow(
                          label: 'Pick-up',
                          value: request.pickupLocation!,
                          icon: AppIcons.mapPin,
                        ),
                      if ((request.dropoffLocation ?? '').isNotEmpty)
                        DetailRow(
                          label: 'Drop-off',
                          value: request.dropoffLocation!,
                          icon: AppIcons.mapPin,
                        ),
                      if (request.pickupTime != null)
                        DetailRow(
                          label: 'Leaves',
                          value: D.dateTime(request.pickupTime),
                          icon: AppIcons.clock,
                        ),
                      if (request.returnTime != null)
                        DetailRow(
                          label: 'Returns',
                          value: D.dateTime(request.returnTime),
                          icon: AppIcons.clock,
                        ),
                      if ((request.coordinatorNotes ?? '').isNotEmpty)
                        DetailRow(
                          label: 'Notes',
                          value: request.coordinatorNotes!,
                          icon: AppIcons.fileText,
                        ),
                    ],
                  ),
                ),

              if ((request.treasurerName ?? '').isNotEmpty) ...[
                const SizedBox(height: 22),
                const SectionHeading(
                  title: 'The Treasurer',
                  icon: AppIcons.wallet,
                  tone: IconTone.emerald,
                ),
                const SizedBox(height: 12),
                LuxCard(
                  child: Column(
                    children: [
                      DetailRow(
                        label: 'Decided by',
                        value: request.treasurerName!,
                        icon: AppIcons.user,
                      ),
                      if (request.treasurerDecidedAt != null)
                        DetailRow(
                          label: 'When',
                          value: D.dateTime(request.treasurerDecidedAt),
                          icon: AppIcons.clock,
                        ),
                      if ((request.treasurerComments ?? '').isNotEmpty)
                        DetailRow(
                          label: 'Note',
                          value: request.treasurerComments!,
                          icon: AppIcons.fileText,
                        ),
                    ],
                  ),
                ),
              ],

              if (request.statusHistory.isNotEmpty) ...[
                const SizedBox(height: 22),
                const SectionHeading(
                  title: 'History',
                  icon: AppIcons.history,
                  tone: IconTone.clay,
                ),
                const SizedBox(height: 12),
                LuxCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final entry in request.statusHistory)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                margin: const EdgeInsets.only(top: 5),
                                decoration: const BoxDecoration(
                                  color: AppColors.clay300,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      StatusBadge.humanise(entry.status),
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.clay600,
                                      ),
                                    ),
                                    Text(
                                      [
                                        entry.changedByName,
                                        D.relative(entry.changedAt),
                                      ].where((s) => s.isNotEmpty).join(' · '),
                                      style: const TextStyle(
                                          fontSize: 11.5,
                                          color: AppColors.clay400),
                                    ),
                                    if ((entry.comments ?? '').isNotEmpty)
                                      Text(
                                        '“${entry.comments}”',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          height: 1.5,
                                          fontStyle: FontStyle.italic,
                                          color: AppColors.clay500,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
