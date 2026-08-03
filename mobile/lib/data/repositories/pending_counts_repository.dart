import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';

/// Badge counts for the drawer — how many items in each queue await this
/// user's attention. The server gates every queue by the same feature access
/// the pages enforce, so a count only appears where the user can act.
///
/// Keyed by nav page key: `events_approvals`, `event_reports_submit`,
/// `department_join_requests`, `campus_ministry`, `discipleship`,
/// `transport_requests`, `media_requests`, `food_requests`,
/// `accounts_approvals`, `rops_camp`, `manage_talents`.
class PendingCountsRepository {
  PendingCountsRepository(this._api);

  final ApiClient _api;

  Future<Map<String, int>> fetch() async {
    final data = await _api.getMap('/api/pending-counts');
    final counts = data['counts'];
    if (counts is! Map) return const {};
    return {
      for (final entry in counts.entries)
        if (entry.value is num) entry.key.toString(): (entry.value as num).toInt(),
    };
  }
}

final pendingCountsRepositoryProvider = Provider<PendingCountsRepository>(
  (ref) => PendingCountsRepository(ref.watch(apiClientProvider)),
);

/// Polls the queue counts while the app is open. Five minutes is frequent
/// enough for a badge and cheap enough to run on camp Wi-Fi.
final pendingCountsProvider = StreamProvider<Map<String, int>>((ref) {
  final user = ref.watch(userOrNullProvider);
  if (user == null) return Stream.value(const <String, int>{});

  final repo = ref.watch(pendingCountsRepositoryProvider);
  final controller = StreamController<Map<String, int>>();

  Future<void> tick() async {
    try {
      final counts = await repo.fetch();
      if (!controller.isClosed) controller.add(counts);
    } catch (_) {
      // A failed poll leaves the previous badges in place — a stale count is
      // far better than every badge vanishing when the signal drops.
    }
  }

  tick();
  final timer = Timer.periodic(const Duration(minutes: 5), (_) => tick());

  ref.onDispose(() {
    timer.cancel();
    controller.close();
  });

  return controller.stream;
});

/// Force a refresh after the user acts on a queue.
Future<void> refreshPendingCounts(WidgetRef ref) async {
  ref.invalidate(pendingCountsProvider);
}
