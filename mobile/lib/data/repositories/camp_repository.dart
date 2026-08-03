import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/camp/camp_meals.dart';
import '../models/camp.dart';
import '../models/enums.dart';

/// Every camp write, in one place. Reads that need server-side joins or
/// permission filtering (the meal roster, the pass queue) also live here;
/// plain live lists come from Firestore streams instead.
class CampRepository {
  CampRepository(this._api);

  final ApiClient _api;

  // ── Registrations ──

  /// Full register — camp admins only.
  Future<List<CampRegistration>> listRegistrations({
    String campId = kDefaultCampId,
  }) async {
    final rows = await _api.getList('/api/camp-registrations',
        query: {'campId': campId}, key: 'registrations');
    return rows.map(CampRegistration.fromMap).toList();
  }

  /// Read-only camp numbers for department leads — no medical or contact
  /// details. Backs the Camp Status screen.
  Future<CampStatus> status({String campId = kDefaultCampId}) async {
    final data = await _api
        .getMap('/api/camp-registrations/status', query: {'campId': campId});
    return CampStatus.fromMap(data);
  }

  /// Registrations linked to the signed-in user, for the public
  /// "my registrations" screen.
  Future<List<CampRegistration>> myRegistrations() async {
    final rows = await _api.getList('/api/camp-registrations/mine',
        key: 'registrations');
    return rows.map(CampRegistration.fromMap).toList();
  }

  /// Public registration. Anonymous submission is allowed — a parent
  /// registering a camper often has no account.
  Future<Map<String, dynamic>> register(Map<String, dynamic> body) async {
    final data = await _api.post('/api/camp-registrations',
        body: body, requireAuth: false);
    return data is Map ? Map<String, dynamic>.from(data) : {};
  }

  /// Spots left, for the public landing and registration screens.
  Future<CampCapacity> capacity({String campId = kDefaultCampId}) async {
    final data = await _api.getMap('/api/camp-registrations/capacity',
        query: {'campId': campId}, requireAuth: false);
    return CampCapacity.fromMap(data);
  }

  /// Raise or lower the cap live — camp admins only.
  Future<void> setCapacity(int capacity,
          {String campId = kDefaultCampId}) async =>
      _api.patch('/api/camp-registrations/capacity',
          body: {'campId': campId, 'capacity': capacity});

  /// Resolve a scanned badge code to its registration.
  Future<CampLookup> lookupRegistration(String code) async {
    final data = await _api
        .getMap('/api/camp-registrations/lookup', query: {'code': code});
    return CampLookup.fromMap(data);
  }

  Future<CampRegistration> setCheckedIn(String id, bool checkedIn) async {
    final data = await _api.patch('/api/camp-registrations/$id/check-in',
        body: {'checkedIn': checkedIn});
    final map = data is Map ? Map<String, dynamic>.from(data) : {};
    final reg = map['registration'];
    return CampRegistration.fromMap(
        reg is Map ? Map<String, dynamic>.from(reg) : map.cast<String, dynamic>());
  }

  Future<void> updateRegistration(
          String id, Map<String, dynamic> updates) async =>
      _api.patch('/api/camp-registrations/$id', body: updates);

  Future<void> deleteRegistration(String id) async =>
      _api.delete('/api/camp-registrations/$id');

  /// Email the camper their details and QR badge.
  Future<void> sendQrEmail(String registrationId, {String? to}) async =>
      _api.post('/api/camp-registrations/send-qr-email', body: {
        'registrationId': registrationId,
        if (to != null && to.isNotEmpty) 'to': to,
      });

  /// Link an anonymous registration to the signed-in account.
  Future<void> claimRegistration(String id, String claimToken) async =>
      _api.post('/api/camp-registrations/$id/claim',
          body: {'claimToken': claimToken});

  // ── Meals ──

  /// The full serving-line roster for a sitting, plus who has already eaten.
  Future<MealRoster> mealRoster({
    String campId = kDefaultCampId,
    String? sittingId,
  }) async {
    final data = await _api.getMap('/api/camp-meals/roster', query: {
      'campId': campId,
      if (sittingId != null) 'sittingId': sittingId,
    });
    return MealRoster.fromMap(data);
  }

  /// Record a serving. The server keys the document on
  /// `${sittingId}_${registrationId}` and uses `create()`, so replaying an
  /// offline scan cannot double-serve — a collision comes back as 409 with
  /// `alreadyServed: true`, which the caller should treat as done.
  Future<MealScanResult> scanMeal({
    required String code,
    required String sittingId,
    DateTime? servedAt,
    bool queuedOffline = false,
  }) async {
    try {
      final data = await _api.post('/api/camp-meals/scan', body: {
        'code': code,
        'sittingId': sittingId,
        if (servedAt != null) 'servedAt': servedAt.toUtc().toIso8601String(),
        if (queuedOffline) 'queuedOffline': true,
      });
      return MealScanResult.fromMap(
          data is Map ? Map<String, dynamic>.from(data) : {});
    } on ApiException catch (e) {
      if (e.isConflict && e.data is Map) {
        final map = Map<String, dynamic>.from(e.data as Map);
        if (map['alreadyServed'] == true) {
          return MealScanResult.fromMap(map)..noteMessage(e.message);
        }
      }
      rethrow;
    }
  }

  /// Undo a serving — for the camper who was ticked off by mistake.
  Future<void> undoMeal({
    required String sittingId,
    required String registrationId,
  }) async =>
      _api.post('/api/camp-meals/undo',
          body: {'sittingId': sittingId, 'registrationId': registrationId});

  /// Per-sitting totals for the kitchen.
  Future<Map<String, dynamic>> mealSummary({
    String campId = kDefaultCampId,
  }) =>
      _api.getMap('/api/camp-meals/summary', query: {'campId': campId});

  // ── Exit passes ──

  /// The staff queue (`scope: queue`) or the caller's own passes
  /// (`scope: mine`).
  Future<PassQueue> listPasses({
    String scope = 'queue',
    String campId = kDefaultCampId,
    CampPassStatus? status,
  }) async {
    final data = await _api.getMap('/api/camp-passes', query: {
      'scope': scope,
      'campId': campId,
      if (status != null) 'status': status.wire,
    });
    return PassQueue.fromMap(data);
  }

  Future<void> requestPass({
    required String registrationId,
    required String reason,
    required DateTime expectedReturnAt,
    String? destination,
    String? escortName,
    String? escortPhone,
  }) async =>
      _api.post('/api/camp-passes', body: {
        'registrationId': registrationId,
        'reason': reason,
        'expectedReturnAt': expectedReturnAt.toUtc().toIso8601String(),
        if (destination != null && destination.isNotEmpty)
          'destination': destination,
        if (escortName != null && escortName.isNotEmpty)
          'escortName': escortName,
        if (escortPhone != null && escortPhone.isNotEmpty)
          'escortPhone': escortPhone,
      });

  /// Sign off (or turn down) the stage the pass is currently waiting on. The
  /// server derives the stage from the pass's status and checks the caller
  /// holds that stage's permission, so the chain cannot be short-cut.
  Future<void> decidePass(
    String passId, {
    required String action, // APPROVE | REJECT | CANCEL
    String? comments,
  }) async =>
      _api.patch('/api/camp-passes/$passId/decision', body: {
        'action': action,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
      });

  Future<void> resendPassEmail(String passId, {String? to}) async =>
      _api.post('/api/camp-passes/$passId/resend', body: {
        if (to != null && to.isNotEmpty) 'to': to,
      });

  /// Resolve a scanned gate ticket without acting on it, so the guard sees
  /// who they are looking at before they commit.
  Future<PassLookup> lookupPass(String code) async {
    final data =
        await _api.getMap('/api/camp-passes/lookup', query: {'code': code});
    return PassLookup.fromMap(data);
  }

  /// Record the gate scan. `expect` guards against a guard tapping the wrong
  /// direction: pass CHECK_OUT or CHECK_IN, or omit it to let the server
  /// infer from the pass's state.
  Future<PassScanResult> scanPass({
    required String code,
    String? expect,
  }) async {
    final data = await _api.post('/api/camp-passes/scan', body: {
      'code': code,
      if (expect != null) 'expect': expect,
    });
    return PassScanResult.fromMap(
        data is Map ? Map<String, dynamic>.from(data) : {});
  }

  /// Campers eligible for a new pass — used by the Admissions desk form.
  Future<List<Map<String, dynamic>>> passEligibleCampers({
    String campId = kDefaultCampId,
  }) =>
      _api.getList('/api/camp-passes/campers',
          query: {'campId': campId}, key: 'campers');

  // ── Sponsorships ──

  Future<List<CampSponsorship>> listSponsorships({
    String campId = kDefaultCampId,
  }) async {
    final rows = await _api.getList('/api/camp-sponsorships',
        query: {'campId': campId}, key: 'sponsorships');
    return rows.map(CampSponsorship.fromMap).toList();
  }

  /// Public pledge. Sponsors are often not app users, so this allows an
  /// anonymous submission.
  Future<void> pledgeSponsorship(Map<String, dynamic> body) async =>
      _api.post('/api/camp-sponsorships', body: body, requireAuth: false);

  Future<void> updateSponsorship(
          String id, Map<String, dynamic> updates) async =>
      _api.patch('/api/camp-sponsorships/$id', body: updates);

  Future<void> deleteSponsorship(String id) async =>
      _api.delete('/api/camp-sponsorships/$id');

  Future<void> assignSponsorship(String id, String registrationId) async =>
      _api.post('/api/camp-sponsorships/$id/assign',
          body: {'registrationId': registrationId});

  Future<void> unassignSponsorship(String id, String registrationId) async =>
      _api.post('/api/camp-sponsorships/$id/unassign',
          body: {'registrationId': registrationId});

  // ── Announcements ──

  Future<List<CampBroadcast>> listBroadcasts({
    String campId = kDefaultCampId,
  }) async {
    final rows = await _api.getList('/api/camp-broadcasts',
        query: {'campId': campId}, key: 'broadcasts');
    return rows.map(CampBroadcast.fromMap).toList();
  }

  Future<CampBroadcast> sendBroadcast({
    required String subject,
    required String body,
    required CampBroadcastAudience audience,
    List<String> selectedIds = const [],
    String? ctaLabel,
    String? ctaUrl,
    String? replyTo,
    String campId = kDefaultCampId,
  }) async {
    final data = await _api.post('/api/camp-broadcasts', body: {
      'campId': campId,
      'subject': subject,
      'body': body,
      'audience': audience.wire,
      if (audience == CampBroadcastAudience.selected)
        'selectedIds': selectedIds,
      if (ctaLabel != null && ctaLabel.isNotEmpty) 'ctaLabel': ctaLabel,
      if (ctaUrl != null && ctaUrl.isNotEmpty) 'ctaUrl': ctaUrl,
      if (replyTo != null && replyTo.isNotEmpty) 'replyTo': replyTo,
    });
    final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final broadcast = map['broadcast'];
    return CampBroadcast.fromMap(
        broadcast is Map ? Map<String, dynamic>.from(broadcast) : map);
  }
}

final campRepositoryProvider = Provider<CampRepository>(
  (ref) => CampRepository(ref.watch(apiClientProvider)),
);

// ─── Response shapes ───

/// Read-only camp numbers for a department lead.
class CampStatus {
  const CampStatus({
    required this.campName,
    required this.capacity,
    required this.registered,
    required this.spotsLeft,
    required this.paid,
    required this.unpaid,
    required this.refunded,
    required this.checkedIn,
    required this.campers,
    this.startDate,
    this.endDate,
    this.venue,
  });

  factory CampStatus.fromMap(Map<String, dynamic> map) {
    final camp = map['camp'] is Map
        ? Map<String, dynamic>.from(map['camp'] as Map)
        : const <String, dynamic>{};
    return CampStatus(
      campName: (camp['name'] ?? 'Camp').toString(),
      startDate: camp['startDate']?.toString(),
      endDate: camp['endDate']?.toString(),
      venue: camp['venue']?.toString(),
      capacity: _int(map['capacity']),
      registered: _int(map['registered']),
      spotsLeft: _int(map['spotsLeft']),
      paid: _int(map['paid']),
      unpaid: _int(map['unpaid']),
      refunded: _int(map['refunded']),
      checkedIn: _int(map['checkedIn']),
      campers: ApiClient.unwrapList(map['campers'])
          .map(CampStatusCamper.fromMap)
          .toList(),
    );
  }

  final String campName;
  final String? startDate;
  final String? endDate;
  final String? venue;
  final int capacity;
  final int registered;
  final int spotsLeft;
  final int paid;
  final int unpaid;
  final int refunded;
  final int checkedIn;
  final List<CampStatusCamper> campers;
}

/// A camper as the status screen sees them — name and church/school only.
class CampStatusCamper {
  const CampStatusCamper({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.churchOrSchool,
    required this.paymentStatus,
    required this.checkedIn,
    this.gender,
  });

  factory CampStatusCamper.fromMap(Map<String, dynamic> map) =>
      CampStatusCamper(
        id: (map['id'] ?? '').toString(),
        firstName: (map['firstName'] ?? '').toString(),
        lastName: (map['lastName'] ?? '').toString(),
        churchOrSchool: (map['churchOrSchool'] ?? '').toString(),
        paymentStatus: CampPaymentStatus.fromWire(map['paymentStatus']),
        checkedIn: map['checkedIn'] == true,
        gender: CampGender.fromWireOrNull(map['gender']),
      );

  final String id;
  final String firstName;
  final String lastName;
  final String churchOrSchool;
  final CampPaymentStatus paymentStatus;
  final bool checkedIn;
  final CampGender? gender;

  String get fullName => '$firstName $lastName'.trim();
}

class CampCapacity {
  const CampCapacity({
    required this.capacity,
    required this.registered,
    required this.spotsLeft,
    this.isFull = false,
  });

  factory CampCapacity.fromMap(Map<String, dynamic> map) {
    final capacity = _int(map['capacity']);
    final registered = _int(map['registered']);
    final left = map['spotsLeft'] == null
        ? (capacity - registered)
        : _int(map['spotsLeft']);
    return CampCapacity(
      capacity: capacity,
      registered: registered,
      spotsLeft: left < 0 ? 0 : left,
      isFull: map['isFull'] == true || (capacity > 0 && left <= 0),
    );
  }

  final int capacity;
  final int registered;
  final int spotsLeft;
  final bool isFull;
}

class CampLookup {
  const CampLookup({required this.registration, this.campName});

  factory CampLookup.fromMap(Map<String, dynamic> map) {
    final camp = map['camp'];
    return CampLookup(
      registration: CampRegistration.fromMap(
          Map<String, dynamic>.from(map['registration'] as Map? ?? {})),
      campName: camp is Map ? camp['name']?.toString() : null,
    );
  }

  final CampRegistration registration;
  final String? campName;
}

class MealRoster {
  const MealRoster({
    required this.campers,
    required this.scans,
    required this.sittings,
    this.sitting,
  });

  factory MealRoster.fromMap(Map<String, dynamic> map) => MealRoster(
        campers: ApiClient.unwrapList(map['campers']),
        scans: ApiClient.unwrapList(map['scans'])
            .map(CampMealScan.fromMap)
            .toList(),
        sittings: ApiClient.unwrapList(map['sittings'])
            .map(CampMealSitting.fromMap)
            .toList(),
        sitting: map['sitting'] is Map
            ? CampMealSitting.fromMap(
                Map<String, dynamic>.from(map['sitting'] as Map))
            : null,
      );

  /// Raw camper rows — the caller converts to `CachedCamper` for the queue.
  final List<Map<String, dynamic>> campers;
  final List<CampMealScan> scans;
  final List<CampMealSitting> sittings;
  final CampMealSitting? sitting;

  List<String> get servedIds =>
      scans.map((s) => s.registrationId).toList();
}

class MealScanResult {
  MealScanResult({
    required this.success,
    required this.alreadyServed,
    this.camper,
    this.scan,
    this.sitting,
    this.message,
  });

  factory MealScanResult.fromMap(Map<String, dynamic> map) => MealScanResult(
        success: map['success'] == true,
        alreadyServed: map['alreadyServed'] == true,
        camper: map['camper'] is Map
            ? Map<String, dynamic>.from(map['camper'] as Map)
            : null,
        scan: map['scan'] is Map
            ? CampMealScan.fromMap(Map<String, dynamic>.from(map['scan'] as Map))
            : null,
        sitting: map['sitting'] is Map
            ? CampMealSitting.fromMap(
                Map<String, dynamic>.from(map['sitting'] as Map))
            : null,
        message: map['error']?.toString(),
      );

  final bool success;

  /// True when this camper was already ticked off — the safe, expected
  /// outcome of a replayed offline scan, not a failure.
  final bool alreadyServed;

  final Map<String, dynamic>? camper;
  final CampMealScan? scan;
  final CampMealSitting? sitting;
  String? message;

  void noteMessage(String value) => message = value;

  String get camperName {
    final c = camper;
    if (c == null) return scan?.camperName ?? 'Camper';
    return '${c['firstName'] ?? ''} ${c['lastName'] ?? ''}'.trim();
  }
}

class PassQueue {
  const PassQueue({required this.passes, required this.can});

  factory PassQueue.fromMap(Map<String, dynamic> map) => PassQueue(
        passes:
            ApiClient.unwrapList(map['passes']).map(CampPass.fromMap).toList(),
        can: PassCapabilities.fromMap(
            map['can'] is Map ? Map<String, dynamic>.from(map['can'] as Map) : {}),
      );

  final List<CampPass> passes;
  final PassCapabilities can;
}

/// What this caller may do in the pass workflow, as the server computed it.
/// Trusting the server here rather than re-deriving locally means the buttons
/// can never disagree with what the API will accept.
class PassCapabilities {
  const PassCapabilities({
    this.admissions = false,
    this.manager = false,
    this.chair = false,
    this.gate = false,
    this.campAdmin = false,
  });

  factory PassCapabilities.fromMap(Map<String, dynamic> map) =>
      PassCapabilities(
        admissions: map['admissions'] == true,
        manager: map['manager'] == true,
        chair: map['chair'] == true,
        gate: map['gate'] == true,
        campAdmin: map['campAdmin'] == true,
      );

  final bool admissions;
  final bool manager;
  final bool chair;
  final bool gate;
  final bool campAdmin;

  bool get anyStage => admissions || manager || chair;

  bool canAct(CampPassStage stage) => switch (stage) {
        CampPassStage.admissions => admissions,
        CampPassStage.manager => manager,
        CampPassStage.chair => chair,
      };
}

class PassLookup {
  const PassLookup({this.pass, this.verdict, this.registration});

  factory PassLookup.fromMap(Map<String, dynamic> map) => PassLookup(
        pass: map['pass'] is Map
            ? CampPass.fromMap(Map<String, dynamic>.from(map['pass'] as Map))
            : null,
        registration: map['registration'] is Map
            ? Map<String, dynamic>.from(map['registration'] as Map)
            : null,
        verdict: map['verdict'] is Map
            ? PassVerdict.fromMap(
                Map<String, dynamic>.from(map['verdict'] as Map))
            : null,
      );

  final CampPass? pass;
  final Map<String, dynamic>? registration;

  /// The server's own words for what the guard should do next — kept rather
  /// than re-derived so the gate and the API always say the same thing.
  final PassVerdict? verdict;
}

class PassVerdict {
  const PassVerdict({
    required this.ok,
    required this.title,
    required this.message,
    this.action,
  });

  factory PassVerdict.fromMap(Map<String, dynamic> map) => PassVerdict(
        ok: map['ok'] == true || map['valid'] == true,
        title: (map['title'] ?? map['headline'] ?? '').toString(),
        message: (map['message'] ?? map['detail'] ?? '').toString(),
        action: map['action']?.toString(),
      );

  final bool ok;
  final String title;
  final String message;

  /// CHECK_OUT | CHECK_IN | null.
  final String? action;
}

class PassScanResult {
  const PassScanResult({
    required this.success,
    this.action,
    this.late = false,
    this.pass,
  });

  factory PassScanResult.fromMap(Map<String, dynamic> map) => PassScanResult(
        success: map['success'] == true,
        action: map['action']?.toString(),
        late: map['late'] == true,
        pass: map['pass'] is Map
            ? CampPass.fromMap(Map<String, dynamic>.from(map['pass'] as Map))
            : null,
      );

  final bool success;

  /// CHECK_OUT or CHECK_IN — what the server actually recorded.
  final String? action;

  /// Set when the return scan happened after `expectedReturnAt`.
  final bool late;

  final CampPass? pass;
}

int _int(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}
