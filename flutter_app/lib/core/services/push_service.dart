import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';

/// FCM registration — the mobile counterpart of
/// `src/components/shared/PushNotificationPrompt.tsx` + `public/firebase-messaging-sw.js`.
///
/// Requests permission, fetches the device token, and registers it with the
/// same `/api/fcm-tokens` endpoint the web app uses, so the server's
/// `sendPushToUser` reaches this device too.
class PushService {
  PushService(this._api);

  final ApiClient _api;
  String? _registeredForUid;

  Future<void> registerForUser(String uid) async {
    if (_registeredForUid == uid) return;
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      final token = await messaging.getToken();
      if (token == null) return;

      await _api.post('/api/fcm-tokens', body: {
        'token': token,
        'userId': uid,
      });
      _registeredForUid = uid;

      messaging.onTokenRefresh.listen((newToken) async {
        try {
          await _api.post('/api/fcm-tokens', body: {
            'token': newToken,
            'userId': uid,
          });
        } catch (e) {
          debugPrint('FCM token refresh registration failed: $e');
        }
      });
    } catch (e) {
      // Push is best-effort — the in-app notification bell still works.
      debugPrint('Push registration failed: $e');
    }
  }

  void reset() => _registeredForUid = null;
}
