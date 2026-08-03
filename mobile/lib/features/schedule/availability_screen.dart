import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/event.dart';

/// The member's own unavailable dates, live.
///
/// This is one of the few things the app writes straight to Firestore rather
/// than through an API route: `firestore.rules` already scopes
/// `users/{uid}/availability/{date}` to its owner, so there is no server-side
/// rule for a route to add.
final myAvailabilityProvider =
    StreamProvider<List<UserAvailability>>((ref) {
  final user = ref.watch(userOrNullProvider);
  if (user == null) return Stream.value(const <UserAvailability>[]);
  return collectionStream(
    db.collection('users').doc(user.id).collection('availability'),
    UserAvailability.fromMap,
    sort: (a, b) => a.date.compareTo(b.date),
  ).handleError((_) => <UserAvailability>[]);
});

/// Mark the Sundays you cannot serve, so the rota never asks.
class AvailabilityScreen extends ConsumerStatefulWidget {
  const AvailabilityScreen({super.key});

  @override
  ConsumerState<AvailabilityScreen> createState() =>
      _AvailabilityScreenState();
}

class _AvailabilityScreenState extends ConsumerState<AvailabilityScreen> {
  DateTime? _start;
  DateTime? _end;
  final _reason = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: D.startOfDay(now),
      lastDate: DateTime(now.year + 1, now.month, now.day),
      helpText: 'When are you away?',
      saveText: 'Choose',
    );
    if (range != null) {
      setState(() {
        _start = range.start;
        _end = range.end;
      });
    }
  }

  Future<void> _save() async {
    final user = ref.read(userOrNullProvider);
    final start = _start;
    if (user == null || start == null) return;
    final end = _end ?? start;

    setState(() => _busy = true);
    try {
      final collection =
          db.collection('users').doc(user.id).collection('availability');
      final batch = db.batch();
      for (var day = D.startOfDay(start);
          !day.isAfter(D.startOfDay(end));
          day = day.add(const Duration(days: 1))) {
        final dateStr = D.iso(day);
        batch.set(collection.doc(dateStr), {
          'date': dateStr,
          'available': false,
          'reason':
              _reason.text.trim().isEmpty ? null : _reason.text.trim(),
        });
      }
      await batch.commit();

      if (mounted) {
        setState(() {
          _start = null;
          _end = null;
          _reason.clear();
          _busy = false;
        });
        context.showSuccess('Saved — the rota will skip those days.');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError('Could not save: $e');
      }
    }
  }

  Future<void> _remove(String date) async {
    final user = ref.read(userOrNullProvider);
    if (user == null) return;
    try {
      await db
          .collection('users')
          .doc(user.id)
          .collection('availability')
          .doc(date)
          .delete();
      if (mounted) context.showSuccess('Removed.');
    } catch (e) {
      if (mounted) context.showError('Could not remove: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(myAvailabilityProvider);
    final today = D.iso(D.startOfDay(DateTime.now()));

    return DetailScaffold(
      title: 'When you are away',
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          const NoticeCard(
            tone: IconTone.periwinkle,
            icon: AppIcons.info,
            message: 'Mark the days you cannot serve. Department leads see '
                'this when they build the rota, so you are not asked in the '
                'first place.',
          ),
          const SizedBox(height: 20),

          const SectionHeading(
            title: 'Add dates',
            icon: AppIcons.calendarPlus,
            tone: IconTone.gold,
          ),
          const SizedBox(height: 12),
          LuxCard(
            child: Column(
              children: [
                InkWell(
                  onTap: _pickRange,
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
                            _start == null
                                ? 'Choose a date, or a range'
                                : D.range(_start, _end),
                            style: TextStyle(
                              fontSize: 14.5,
                              color: _start == null
                                  ? AppColors.clay400
                                  : AppColors.clay700,
                            ),
                          ),
                        ),
                        const Icon(AppIcons.chevronRight,
                            size: 16, color: AppColors.clay300),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'Reason',
                  controller: _reason,
                  hint: 'Travelling, exams, family… (optional)',
                ),
                const SizedBox(height: 16),
                PrimaryButton(
                  label: 'Mark as unavailable',
                  icon: AppIcons.check,
                  loading: _busy,
                  onPressed: _start == null ? null : _save,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          const SectionHeading(
            title: 'Your dates',
            icon: AppIcons.calendarDays,
            tone: IconTone.clay,
          ),
          const SizedBox(height: 12),

          async.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(message: '$e'),
            data: (dates) {
              // Past dates are noise once they have gone by.
              final upcoming =
                  dates.where((d) => d.date.compareTo(today) >= 0).toList();
              if (upcoming.isEmpty) {
                return const LuxCard(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'You are available every day — nothing marked.',
                      style: TextStyle(
                          fontSize: 13.5, color: AppColors.clay400),
                    ),
                  ),
                );
              }
              return LuxCard(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(
                  children: [
                    for (var i = 0; i < upcoming.length; i++) ...[
                      if (i > 0) const LuxDivider(),
                      LuxTile(
                        title: D.long(D.fromIso(upcoming[i].date)),
                        subtitle: upcoming[i].reason,
                        icon: AppIcons.close,
                        tone: IconTone.rose,
                        dense: true,
                        trailing: IconButton(
                          icon: const Icon(AppIcons.trash, size: 16),
                          color: AppColors.clay400,
                          tooltip: 'Remove',
                          onPressed: () => _remove(upcoming[i].date),
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
