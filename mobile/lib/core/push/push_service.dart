import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';

/// Push notifications.
///
/// The server already sends to every device registered under a user
/// (`sendPushToUser` in `src/lib/push.ts`), carrying `data.link` — the same
/// in-app path the notification row holds. Because the Flutter routes use the
/// web's URLs verbatim, tapping a push is just `router.go(link)`.
class PushService {
  PushService(this._api);

  final ApiClient _api;

  final _messaging = FirebaseMessaging.instance;
  final _local = FlutterLocalNotificationsPlugin();

  /// Emits the `link` of a notification the user tapped.
  final _taps = StreamController<String>.broadcast();
  Stream<String> get taps => _taps.stream;

  bool _initialised = false;

  static const _channel = AndroidNotificationChannel(
    'dew_of_hermon_default',
    'Dew of Hermon',
    description: 'Rota reminders, approvals and camp announcements.',
    importance: Importance.high,
  );

  /// Wire up listeners. Safe to call more than once.
  Future<void> initialise() async {
    if (_initialised) return;
    _initialised = true;

    await _local.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (response) {
        final link = response.payload;
        if (link != null && link.isNotEmpty) _taps.add(link);
      },
    );

    await _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    // Foreground: FCM does not draw a banner itself on Android, so we do.
    FirebaseMessaging.onMessage.listen(_showLocal);

    // Background tap.
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final link = message.data['link'];
      if (link is String && link.isNotEmpty) _taps.add(link);
    });

    // Cold start from a notification tap.
    final initial = await _messaging.getInitialMessage();
    final initialLink = initial?.data['link'];
    if (initialLink is String && initialLink.isNotEmpty) {
      // Deferred so the router exists by the time we push.
      scheduleMicrotask(() => _taps.add(initialLink));
    }

    // A rotated token must replace the stored one or pushes stop arriving.
    _messaging.onTokenRefresh.listen((token) async {
      final userId = _registeredUserId;
      if (userId != null) await _saveToken(userId, token);
    });
  }

  String? _registeredUserId;

  Future<void> _showLocal(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    await _local.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: message.data['link'] as String?,
    );
  }

  /// Ask for permission and register this device. Returns false when the user
  /// declined — the caller then points them at their phone settings.
  Future<bool> requestPermissionAndRegister(String userId) async {
    await initialise();

    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    final granted =
        settings.authorizationStatus == AuthorizationStatus.authorized ||
            settings.authorizationStatus == AuthorizationStatus.provisional;
    if (!granted) return false;

    final token = await _messaging.getToken();
    if (token == null) return false;

    await _saveToken(userId, token);
    return true;
  }

  /// Register silently at sign-in, but only when the user already granted
  /// permission — never prompt from a cold start.
  Future<void> registerIfAlreadyPermitted(String userId) async {
    await initialise();
    final settings = await _messaging.getNotificationSettings();
    if (settings.authorizationStatus != AuthorizationStatus.authorized &&
        settings.authorizationStatus != AuthorizationStatus.provisional) {
      return;
    }
    final token = await _messaging.getToken();
    if (token != null) await _saveToken(userId, token);
  }

  Future<void> _saveToken(String userId, String token) async {
    _registeredUserId = userId;
    try {
      await _api.post('/api/fcm-tokens',
          body: {'token': token, 'userId': userId});
    } catch (e) {
      debugPrint('Could not register push token: $e');
    }
  }

  /// Remove this device's token — on opt-out and on sign-out, so someone who
  /// hands their phone on does not keep receiving another member's rota.
  Future<void> unregister(String userId) async {
    _registeredUserId = null;
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await _api.delete('/api/fcm-tokens',
            body: {'token': token, 'userId': userId});
      }
      await _messaging.deleteToken();
    } catch (e) {
      debugPrint('Could not remove push token: $e');
    }
  }

  void dispose() => _taps.close();
}

final pushServiceProvider = Provider<PushService>((ref) {
  final service = PushService(ref.watch(apiClientProvider));
  ref.onDispose(service.dispose);
  return service;
});
