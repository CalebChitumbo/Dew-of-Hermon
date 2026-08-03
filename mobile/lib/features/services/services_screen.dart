import 'package:cloud_firestore/cloud_firestore.dart';
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
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/event.dart';
import '../../data/repositories/service_repository.dart';

/// A service joined to its event and assignment counts — enough for a row.
class ServiceSummary {
  const ServiceSummary({
    required this.service,
    this.event,
    this.assigned = 0,
    this.confirmed = 0,
  });

  final Service service;
  final AppEvent? event;
  final int assigned;
  final int confirmed;

  DateTime? get date => event?.startDate;
  String get title => service.theme?.isNotEmpty == true
      ? service.theme!
      : event?.title ?? "Potter's Wheel service";

  bool get isUpcoming =>
      date == null || !date!.isBefore(D.startOfDay(DateTime.now()));
}

/// Services with their events and rota progress, live.
final servicesProvider = StreamProvider<List<ServiceSummary>>((ref) {
  return db
      .collection('services')
      .where('isArchived', isEqualTo: false)
      .snapshots()
      .asyncMap((snap) async {
    final services = mapDocs(snap, Service.fromMap);
    if (services.isEmpty) return const <ServiceSummary>[];

    final eventIds =
        services.map((s) => s.eventId).where((e) => e.isNotEmpty).toSet().toList();
    final events = <String, AppEvent>{};
    for (var i = 0; i < eventIds.length; i += 30) {
      final batch = eventIds.skip(i).take(30).toList();
      final eventSnap = await db
          .collection('events')
          .where(FieldPath.documentId, whereIn: batch)
          .get();
      for (final doc in eventSnap.docs) {
        events[doc.id] = AppEvent.fromMap({...doc.data(), 'id': doc.id});
      }
    }

    // Assignment counts, in one read rather than one per service.
    final assignmentSnap =
        await db.collection('serviceAssignments').get();
    final assigned = <String, int>{};
    final confirmed = <String, int>{};
    for (final doc in assignmentSnap.docs) {
      final data = doc.data();
      final serviceId = '${data['serviceId'] ?? ''}';
      if (serviceId.isEmpty) continue;
      assigned[serviceId] = (assigned[serviceId] ?? 0) + 1;
      if (data['status'] == 'CONFIRMED') {
        confirmed[serviceId] = (confirmed[serviceId] ?? 0) + 1;
      }
    }

    final summaries = services
        .map((s) => ServiceSummary(
              service: s,
              event: events[s.eventId],
              assigned: assigned[s.id] ?? 0,
              confirmed: confirmed[s.id] ?? 0,
            ))
        .toList()
      ..sort((a, b) {
        if (a.date == null) return 1;
        if (b.date == null) return -1;
        return b.date!.compareTo(a.date!);
      });

    return summaries;
  }).handleError((_) => <ServiceSummary>[]);
});

/// Services and rotas — the weekly rhythm of the Potter's Wheel.
class ServicesScreen extends ConsumerStatefulWidget {
  const ServicesScreen({super.key});

  @override
  ConsumerState<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    final async = ref.watch(servicesProvider);
    final canEdit = access.canEdit('services') || access.can('create_service');

    return AppScaffold(
      title: 'Services & rotas',
      onRefresh: () async => ref.invalidate(servicesProvider),
      floatingActionButton: canEdit
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/manage/services/new'),
              icon: const Icon(AppIcons.plus, size: 19),
              label: const Text('Open a rota'),
            )
          : null,
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(servicesProvider),
        ),
        data: (all) {
          final upcoming = all.where((s) => s.isUpcoming).toList().reversed
              .toList();
          final past = all.where((s) => !s.isUpcoming).toList();
          final shown = _tab == 0 ? upcoming : past;

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              SegmentedTabs(
                tabs: const ['Upcoming', 'Past'],
                selected: _tab,
                counts: {0: upcoming.length},
                onSelect: (i) => setState(() => _tab = i),
              ),
              const SizedBox(height: 18),

              if (shown.isEmpty)
                EmptyStateLux(
                  icon: AppIcons.church,
                  tone: IconTone.gold,
                  title: _tab == 0 ? 'No rota open' : 'Nothing past yet',
                  description: _tab == 0
                      ? "Open a rota for the coming Sunday and department "
                          'leads can start assigning.'
                      : 'Services that have happened are kept here.',
                  action: _tab == 0 && canEdit
                      ? PrimaryButton(
                          label: 'Open a rota',
                          expand: false,
                          icon: AppIcons.plus,
                          onPressed: () =>
                              context.push('/manage/services/new'),
                        )
                      : null,
                )
              else
                for (final summary in shown)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ServiceCard(summary: summary),
                  ),
            ],
          );
        },
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.summary});

  final ServiceSummary summary;

  @override
  Widget build(BuildContext context) {
    final fraction = summary.assigned == 0
        ? 0.0
        : (summary.confirmed / summary.assigned).clamp(0.0, 1.0);

    return LuxCard(
      onTap: () => context.push('/manage/services/${summary.service.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(AppIcons.church, tone: IconTone.gold, size: 46),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      summary.title,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 18,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        if (summary.date != null) D.dayMedium(summary.date),
                        summary.service.serviceTime,
                        if (summary.event != null) summary.event!.venue,
                      ].where((s) => s.isNotEmpty).join(' · '),
                      style: const TextStyle(
                          fontSize: 12.5, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              if (summary.service.autoProvisioned)
                const StatusBadge('Auto',
                    tone: IconTone.periwinkle, dense: true),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 6,
              backgroundColor: AppColors.clay100,
              valueColor: AlwaysStoppedAnimation<Color>(
                fraction >= 1 && summary.assigned > 0
                    ? AppColors.teal
                    : AppColors.gold,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            summary.assigned == 0
                ? 'Nobody assigned yet'
                : '${summary.confirmed} of ${summary.assigned} confirmed',
            style: const TextStyle(fontSize: 12, color: AppColors.clay400),
          ),
        ],
      ),
    );
  }
}

/// Open a rota for a Sunday. The server provisions idempotently, so asking
/// twice for the same date opens the existing rota rather than duplicating it.
class NewServiceScreen extends ConsumerStatefulWidget {
  const NewServiceScreen({super.key});

  @override
  ConsumerState<NewServiceScreen> createState() => _NewServiceScreenState();
}

class _NewServiceScreenState extends ConsumerState<NewServiceScreen> {
  final _venue = TextEditingController(text: 'Tabernacle of David Assembly');
  final _theme = TextEditingController();
  late DateTime _date = D.nextSunday(DateTime.now());
  TimeOfDay _time = const TimeOfDay(hour: 9, minute: 0);
  bool _busy = false;

  @override
  void dispose() {
    _venue.dispose();
    _theme.dispose();
    super.dispose();
  }

  String get _serviceTime =>
      '${_time.hour.toString().padLeft(2, '0')}:'
      '${_time.minute.toString().padLeft(2, '0')}';

  Future<void> _submit() async {
    if (_venue.text.trim().isEmpty) {
      context.showError('A venue is needed.');
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await ref.read(serviceRepositoryProvider).create(
            date: _date,
            venue: _venue.text.trim(),
            serviceTime: _serviceTime,
            theme: _theme.text.trim(),
          );
      if (!mounted) return;
      ref.invalidate(servicesProvider);

      final service = result['service'];
      final serviceId = service is Map ? '${service['id'] ?? ''}' : '';
      final alreadyExisted = result['alreadyExisted'] == true;

      context.showSuccess(alreadyExisted
          ? 'A rota for that Sunday already exists — opening it.'
          : 'Rota opened. Department heads have been told.');

      if (serviceId.isNotEmpty) {
        context.pushReplacement('/manage/services/$serviceId');
      } else if (context.canPop()) {
        context.pop();
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
    final blocked = servicesGuard(ref, 'Open a rota');
    if (blocked != null) return blocked;

    return DetailScaffold(
      title: 'Open a rota',
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          const NoticeCard(
            tone: IconTone.gold,
            icon: AppIcons.info,
            message: 'Opening a rota tells every department head it is time '
                'to assign. If one already exists for that Sunday, this opens '
                'it rather than creating a second.',
          ),
          const SizedBox(height: 20),
          LuxCard(
            child: Column(
              children: [
                const FieldLabel('Sunday', required: true),
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _date,
                      firstDate:
                          DateTime.now().subtract(const Duration(days: 30)),
                      lastDate:
                          DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setState(() => _date = picked);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 15),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(AppIcons.calendar,
                            size: 17, color: AppColors.clay300),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            D.long(_date),
                            style: const TextStyle(
                                fontSize: 14.5, color: AppColors.clay700),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const FieldLabel('Service time', required: true),
                InkWell(
                  onTap: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: _time,
                    );
                    if (picked != null) setState(() => _time = picked);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 15),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(AppIcons.clock,
                            size: 17, color: AppColors.clay300),
                        const SizedBox(width: 12),
                        Text(
                          _serviceTime,
                          style: const TextStyle(
                              fontSize: 14.5, color: AppColors.clay700),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                AppTextField(
                  label: 'Venue',
                  controller: _venue,
                  required: true,
                ),
                const SizedBox(height: 16),
                AppTextField(
                  label: 'Theme',
                  controller: _theme,
                  hint: 'Optional — the Sunday theme',
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          PrimaryButton(
            label: 'Open the rota',
            icon: AppIcons.check,
            loading: _busy,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}

/// Every screen under /manage/services guards itself: the router only checks
/// exact page routes, so a deep link to a sub-path would otherwise slip past.
Widget? servicesGuard(WidgetRef ref, String title) {
  if (ref.watch(accessProvider).canView('services')) return null;
  return DetailScaffold(
    title: title,
    body: const NoAccessView(
      message: 'Services and rotas are not available to your role.',
    ),
  );
}
