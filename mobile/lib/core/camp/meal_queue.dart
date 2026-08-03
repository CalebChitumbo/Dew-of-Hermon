import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'camp_meals.dart';

/// Offline scan queue for the meal serving line. Direct port of
/// `src/lib/camp-meal-queue.ts`, keys and all.
///
/// Camp runs at a venue whose network comes and goes, and a queue of eighty
/// hungry teenagers cannot wait on a round trip. So the scanner validates
/// against a cached roster and shows its answer immediately, while the write
/// goes into this queue and is flushed whenever there's signal.
///
/// Replay is safe because the server keys each scan on
/// `${sittingId}_${registrationId}` and creates rather than sets — flushing
/// the same item twice cannot serve a camper twice. That means this queue
/// never has to reason about what already landed; it just retries until each
/// item comes back either created or already-served.

const String _queueKey = 'rops-meal-queue-v1';
const String _rosterKeyPrefix = 'rops-meal-roster-v1:';

class QueuedMealScan {
  const QueuedMealScan({
    required this.key,
    required this.sittingId,
    required this.registrationId,
    required this.code,
    required this.camperName,
    required this.servedAt,
    required this.offline,
    this.attempts = 0,
  });

  factory QueuedMealScan.fromMap(Map<String, dynamic> map) => QueuedMealScan(
        key: (map['key'] ?? '').toString(),
        sittingId: (map['sittingId'] ?? '').toString(),
        registrationId: (map['registrationId'] ?? '').toString(),
        code: (map['code'] ?? '').toString(),
        camperName: (map['camperName'] ?? '').toString(),
        servedAt: (map['servedAt'] ?? '').toString(),
        offline: map['offline'] == true,
        attempts: (map['attempts'] is num) ? (map['attempts'] as num).toInt() : 0,
      );

  /// Same key the server derives — makes the queue self-deduplicating.
  final String key;
  final String sittingId;
  final String registrationId;
  final String code;
  final String camperName;

  /// When the camper was actually served, not when the write succeeded.
  final String servedAt;

  /// Whether the device had no connectivity at the moment of the scan. Every
  /// scan goes through this queue, so this — not the mere fact of being
  /// queued — is what marks a scan as genuinely taken offline.
  final bool offline;

  final int attempts;

  QueuedMealScan withAttempt() => QueuedMealScan(
        key: key,
        sittingId: sittingId,
        registrationId: registrationId,
        code: code,
        camperName: camperName,
        servedAt: servedAt,
        offline: offline,
        attempts: attempts + 1,
      );

  Map<String, dynamic> toMap() => {
        'key': key,
        'sittingId': sittingId,
        'registrationId': registrationId,
        'code': code,
        'camperName': camperName,
        'servedAt': servedAt,
        'offline': offline,
        'attempts': attempts,
      };
}

/// A camper as the serving line needs them: who they are, whether anything
/// about their food matters, and whether the manager should be told about
/// their payment. Deliberately excludes contact details and medical notes —
/// a meal queue is not the place for either.
class CachedCamper {
  const CachedCamper({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.gender,
    this.churchOrSchool,
    this.checkInCode,
    this.paymentStatus = 'UNPAID',
    this.sponsorshipId,
    this.sponsorName,
    this.dietaryPreference,
    this.allergies,
    this.checkedIn = false,
    this.onPass = false,
  });

  factory CachedCamper.fromMap(Map<String, dynamic> map) => CachedCamper(
        id: (map['id'] ?? '').toString(),
        firstName: (map['firstName'] ?? '').toString(),
        lastName: (map['lastName'] ?? '').toString(),
        gender: map['gender']?.toString(),
        churchOrSchool: map['churchOrSchool']?.toString(),
        checkInCode: map['checkInCode']?.toString(),
        paymentStatus: (map['paymentStatus'] ?? 'UNPAID').toString(),
        sponsorshipId: map['sponsorshipId']?.toString(),
        sponsorName: map['sponsorName']?.toString(),
        dietaryPreference: map['dietaryPreference']?.toString(),
        allergies: map['allergies']?.toString(),
        checkedIn: map['checkedIn'] == true,
        onPass: map['onPass'] == true,
      );

  final String id;
  final String firstName;
  final String lastName;
  final String? gender;
  final String? churchOrSchool;
  final String? checkInCode;
  final String paymentStatus;
  final String? sponsorshipId;
  final String? sponsorName;
  final String? dietaryPreference;
  final String? allergies;
  final bool checkedIn;
  final bool onPass;

  String get fullName => '$firstName $lastName'.trim();

  /// Nobody has covered this camper's fee — flagged for the manager, never a
  /// reason to refuse food.
  bool get isPaymentFlagged =>
      paymentStatus != 'PAID' && (sponsorshipId ?? '').isEmpty;

  /// Anything the kitchen must know at the moment of serving.
  bool get hasFoodNote =>
      (dietaryPreference ?? '').isNotEmpty || (allergies ?? '').isNotEmpty;

  Map<String, dynamic> toMap() => {
        'id': id,
        'firstName': firstName,
        'lastName': lastName,
        'gender': gender,
        'churchOrSchool': churchOrSchool,
        'checkInCode': checkInCode,
        'paymentStatus': paymentStatus,
        'sponsorshipId': sponsorshipId,
        'sponsorName': sponsorName,
        'dietaryPreference': dietaryPreference,
        'allergies': allergies,
        'checkedIn': checkedIn,
        'onPass': onPass,
      };
}

class CachedRoster {
  const CachedRoster({
    required this.sittingId,
    required this.campers,
    required this.servedIds,
    required this.cachedAt,
  });

  factory CachedRoster.fromMap(Map<String, dynamic> map) => CachedRoster(
        sittingId: (map['sittingId'] ?? '').toString(),
        campers: (map['campers'] is List)
            ? (map['campers'] as List)
                .whereType<Map>()
                .map((m) => CachedCamper.fromMap(Map<String, dynamic>.from(m)))
                .toList()
            : const [],
        servedIds: (map['servedIds'] is List)
            ? (map['servedIds'] as List).map((e) => e.toString()).toList()
            : const [],
        cachedAt: (map['cachedAt'] ?? '').toString(),
      );

  final String sittingId;
  final List<CachedCamper> campers;

  /// Registration ids already served at this sitting.
  final List<String> servedIds;
  final String cachedAt;

  Map<String, dynamic> toMap() => {
        'sittingId': sittingId,
        'campers': campers.map((c) => c.toMap()).toList(),
        'servedIds': servedIds,
        'cachedAt': cachedAt,
      };

  CachedRoster withServed(String registrationId) {
    if (servedIds.contains(registrationId)) return this;
    return CachedRoster(
      sittingId: sittingId,
      campers: campers,
      servedIds: [...servedIds, registrationId],
      cachedAt: cachedAt,
    );
  }

  CachedRoster withoutServed(String registrationId) => CachedRoster(
        sittingId: sittingId,
        campers: campers,
        servedIds: servedIds.where((id) => id != registrationId).toList(),
        cachedAt: cachedAt,
      );

  /// Find a camper by their badge code — the lookup the scanner does offline.
  CachedCamper? byCode(String normalizedCode) {
    if (normalizedCode.isEmpty) return null;
    for (final c in campers) {
      final code = c.checkInCode;
      if (code != null && code.toUpperCase() == normalizedCode) return c;
    }
    return null;
  }
}

/// Persistent storage for the queue and roster cache. Uses the same keys as
/// the web's localStorage, so the two are conceptually one design even though
/// they never share a device.
class MealQueueStore {
  MealQueueStore(this._prefs);

  final SharedPreferences _prefs;

  static Future<MealQueueStore> open() async =>
      MealQueueStore(await SharedPreferences.getInstance());

  List<QueuedMealScan> loadQueue() {
    final raw = _prefs.getString(_queueKey);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map>()
          .map((m) => QueuedMealScan.fromMap(Map<String, dynamic>.from(m)))
          .toList();
    } catch (_) {
      // A corrupt queue must not brick the scanner.
      return const [];
    }
  }

  Future<void> saveQueue(List<QueuedMealScan> queue) async {
    try {
      await _prefs.setString(
        _queueKey,
        jsonEncode(queue.map((q) => q.toMap()).toList()),
      );
    } catch (_) {
      // Storage full or blocked. The in-memory state still works for this
      // session — losing the cache is survivable, losing the scan is not, so
      // we never throw from here.
    }
  }

  /// Add a scan to the queue, ignoring it if the same camper/sitting is
  /// already waiting — a double tap at the line must not become two pending
  /// writes.
  Future<List<QueuedMealScan>> enqueue(
    List<QueuedMealScan> queue, {
    required String sittingId,
    required String registrationId,
    required String code,
    required String camperName,
    required DateTime servedAt,
    required bool offline,
  }) async {
    final key = buildMealScanId(sittingId, registrationId);
    if (queue.any((q) => q.key == key)) return queue;
    final next = [
      ...queue,
      QueuedMealScan(
        key: key,
        sittingId: sittingId,
        registrationId: registrationId,
        code: code,
        camperName: camperName,
        servedAt: servedAt.toUtc().toIso8601String(),
        offline: offline,
      ),
    ];
    await saveQueue(next);
    return next;
  }

  Future<List<QueuedMealScan>> remove(
      List<QueuedMealScan> queue, String key) async {
    final next = queue.where((q) => q.key != key).toList();
    await saveQueue(next);
    return next;
  }

  Future<List<QueuedMealScan>> bumpAttempts(
      List<QueuedMealScan> queue, String key) async {
    final next = [
      for (final q in queue) q.key == key ? q.withAttempt() : q,
    ];
    await saveQueue(next);
    return next;
  }

  CachedRoster? loadRoster(String sittingId) {
    final raw = _prefs.getString('$_rosterKeyPrefix$sittingId');
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return CachedRoster.fromMap(Map<String, dynamic>.from(decoded));
    } catch (_) {
      return null;
    }
  }

  Future<void> saveRoster(CachedRoster roster) async {
    try {
      await _prefs.setString(
        '$_rosterKeyPrefix${roster.sittingId}',
        jsonEncode(roster.toMap()),
      );
    } catch (_) {
      // See saveQueue.
    }
  }
}
