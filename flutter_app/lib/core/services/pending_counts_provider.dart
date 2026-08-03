import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';

/// Port of `src/hooks/usePendingCounts.ts` — per-area "pending attention"
/// counts keyed by sidebar pageKey, from `/api/pending-counts`.
///
/// Refreshes on sign-in, on demand (call [refresh] after navigation or acting
/// on a queue), and on a slow 60s background poll while signed in.
class PendingCountsProvider extends ChangeNotifier {
  PendingCountsProvider(this._api, this._auth) {
    _auth.addListener(_onAuthChanged);
    _onAuthChanged();
  }

  final ApiClient _api;
  final AuthProvider _auth;

  Map<String, int> counts = {};
  Timer? _timer;
  bool _wasSignedIn = false;

  void _onAuthChanged() {
    final signedIn = _auth.isSignedIn;
    if (signedIn && !_wasSignedIn) {
      refresh();
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 60), (_) => refresh());
    } else if (!signedIn && _wasSignedIn) {
      _timer?.cancel();
      _timer = null;
      counts = {};
      notifyListeners();
    }
    _wasSignedIn = signedIn;
  }

  Future<void> refresh() async {
    if (!_auth.isSignedIn) return;
    try {
      final data = await _api.get('/api/pending-counts');
      final raw = data['counts'];
      final next = <String, int>{};
      if (raw is Map) {
        raw.forEach((key, value) {
          if (value is num) next[key.toString()] = value.toInt();
        });
      }
      counts = next;
      notifyListeners();
    } catch (_) {
      // network hiccup — keep the last known counts
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _auth.removeListener(_onAuthChanged);
    super.dispose();
  }
}
