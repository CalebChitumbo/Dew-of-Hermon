import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../core/api_client.dart';

/// Registers this device for push notifications with the same backend the
/// web app uses. The server (src/lib/push.ts) already sends standard FCM
/// `notification` payloads, which Android and iOS display natively — so the
/// existing notification pipeline reaches mobile with no server changes.
///
/// Everything here is best-effort: missing platform config (e.g. APNs not
/// set up yet) must never break sign-in.
class PushService {
  PushService(this.api);

  final ApiClient api;
  StreamSubscription<String>? _refreshSub;
  String? _currentToken;

  Future<bool> register(String userId) async {
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        return false;
      }

      final token = await messaging.getToken();
      if (token == null) return false;

      await _save(userId, token);
      _currentToken = token;

      _refreshSub ??= messaging.onTokenRefresh.listen((newToken) {
        _currentToken = newToken;
        _save(userId, newToken);
      });
      return true;
    } catch (e) {
      debugPrint('Push registration skipped: $e');
      return false;
    }
  }

  Future<void> _save(String userId, String token) async {
    try {
      await api.postJson('/api/fcm-tokens', {
        'token': token,
        'userId': userId,
      });
    } catch (e) {
      debugPrint('Saving FCM token failed: $e');
    }
  }

  /// Best-effort removal of this device's token (call before sign-out).
  Future<void> unregister(String userId) async {
    final token = _currentToken;
    if (token == null) return;
    try {
      await api.deleteJson(
        '/api/fcm-tokens',
        body: {'token': token, 'userId': userId},
      );
    } catch (_) {}
    _refreshSub?.cancel();
    _refreshSub = null;
    _currentToken = null;
  }
}
