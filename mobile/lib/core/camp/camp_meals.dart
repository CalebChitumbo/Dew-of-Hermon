import '../../data/models/enums.dart';

/// ROPs Camp meal cards. Direct port of `src/lib/camp-meals.ts`.
///
/// Two rules make the whole thing safe:
///
///  1. A scan document's id is derived, not generated:
///     `${campId}_${date}_${slot}_${registrationId}`. The server writes with
///     `create()`, so a second scan of the same camper at the same sitting
///     collides instead of double-serving. That holds whether the collision
///     comes from two serving lines at once or from an offline scan replayed
///     on sync.
///  2. Sittings are derived from the static plan below, never stored. Every
///     device — including one that has been offline for an hour — agrees on
///     what the sittings are without talking to the server.

/// Feature key, configurable in Settings → Access Control.
const String kMealFeatureServe = 'serve_camp_meals';

/// The serving line scanner.
const String kMealScannerLink = '/manage/rops-camp/meals';

/// One serving of one meal on one day — the unit a camper is ticked off
/// against.
class CampMealSitting {
  const CampMealSitting({
    required this.id,
    required this.campId,
    required this.date,
    required this.slot,
    required this.label,
    required this.opensAt,
    required this.closesAt,
  });

  factory CampMealSitting.fromMap(Map<String, dynamic> map) {
    final slot = CampMealSlot.fromWire(map['slot']);
    return CampMealSitting(
      id: (map['id'] ?? '').toString(),
      campId: (map['campId'] ?? '').toString(),
      date: (map['date'] ?? '').toString(),
      slot: slot,
      label: (map['label'] ?? '').toString(),
      opensAt: (map['opensAt'] ?? slot.opensAt).toString(),
      closesAt: (map['closesAt'] ?? slot.closesAt).toString(),
    );
  }

  /// `${campId}_${date}_${slot}` — also the prefix of every scan doc id.
  final String id;
  final String campId;

  /// yyyy-MM-dd.
  final String date;
  final CampMealSlot slot;

  /// "Friday lunch" — what the server sees on the sitting picker.
  final String label;

  /// Local HH:mm window used to auto-select the sitting at the serving line.
  final String opensAt;
  final String closesAt;
}

/// Which meals are actually served on each camp day. Campers arrive Thursday
/// afternoon (supper only) and leave Monday after breakfast, so the plan is
/// not a plain 3-per-day grid.
const Map<String, List<(String, List<CampMealSlot>)>> _campMealPlan = {
  'rops-x-2026': [
    // Thursday — campers arrive through the afternoon.
    ('2026-08-27', [CampMealSlot.dinner]),
    // Friday, Saturday, Sunday — full days.
    ('2026-08-28',
        [CampMealSlot.breakfast, CampMealSlot.lunch, CampMealSlot.dinner]),
    ('2026-08-29',
        [CampMealSlot.breakfast, CampMealSlot.lunch, CampMealSlot.dinner]),
    ('2026-08-30',
        [CampMealSlot.breakfast, CampMealSlot.lunch, CampMealSlot.dinner]),
    // Monday — breakfast, then departure.
    ('2026-08-31', [CampMealSlot.breakfast]),
  ],
};

/// Slot order for sorting a day's sittings.
const List<CampMealSlot> _slotOrder = [
  CampMealSlot.breakfast,
  CampMealSlot.lunch,
  CampMealSlot.dinner,
];

const List<String> _weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/// Weekday name for a yyyy-MM-dd string, without timezone drift. Constructed
/// as UTC and read as UTC — a date-only value must not be shifted by the
/// reader's timezone.
String _weekdayOf(String date) {
  final parts = date.split('-');
  if (parts.length != 3) return '';
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return '';
  final utc = DateTime.utc(y, m, d);
  // Dart's weekday is 1=Monday..7=Sunday; the table is 0=Sunday..6=Saturday.
  return _weekdays[utc.weekday % 7];
}

String buildSittingId(String campId, String date, CampMealSlot slot) =>
    '${campId}_${date}_${slot.wire}';

/// The scan document id. Deterministic — this is what blocks double-serving.
String buildMealScanId(String sittingId, String registrationId) =>
    '${sittingId}_$registrationId';

/// Every sitting for a camp, in serving order.
List<CampMealSitting> getCampSittings(String campId) {
  final plan = _campMealPlan[campId];
  if (plan == null) return const [];

  final sittings = <CampMealSitting>[];
  for (final (date, slots) in plan) {
    for (final slot in _slotOrder.where(slots.contains)) {
      sittings.add(CampMealSitting(
        id: buildSittingId(campId, date, slot),
        campId: campId,
        date: date,
        slot: slot,
        label: '${_weekdayOf(date)} ${slot.label.toLowerCase()}',
        opensAt: slot.opensAt,
        closesAt: slot.closesAt,
      ));
    }
  }
  return sittings;
}

/// Resolve a sitting id back to its sitting, or null if it isn't in the plan.
CampMealSitting? getSitting(String sittingId) {
  // The camp id itself may contain underscores, so match against the built
  // ids rather than splitting the string.
  for (final campId in _campMealPlan.keys) {
    if (!sittingId.startsWith('${campId}_')) continue;
    for (final sitting in getCampSittings(campId)) {
      if (sitting.id == sittingId) return sitting;
    }
  }
  return null;
}

/// True when [sittingId] is a real sitting of [campId].
bool sittingBelongsToCamp(String sittingId, String campId) {
  final sitting = getSitting(sittingId);
  return sitting != null && sitting.campId == campId;
}

String _localDateString(DateTime now) {
  final m = now.month.toString().padLeft(2, '0');
  final d = now.day.toString().padLeft(2, '0');
  return '${now.year}-$m-$d';
}

int _minutesOfDay(String hhmm) {
  final parts = hhmm.split(':');
  if (parts.length != 2) return 0;
  return (int.tryParse(parts[0]) ?? 0) * 60 + (int.tryParse(parts[1]) ?? 0);
}

/// The sitting to pre-select at the serving line, from the device's local
/// clock — so it reflects Zambian time regardless of what timezone the server
/// happens to run in.
///
/// Falls back to the nearest upcoming sitting (or the last one, once camp is
/// over) so the picker is never empty mid-camp.
CampMealSitting? resolveCurrentSitting(String campId, DateTime now) {
  final sittings = getCampSittings(campId);
  if (sittings.isEmpty) return null;

  final today = _localDateString(now);
  final minutes = now.hour * 60 + now.minute;

  for (final s in sittings) {
    if (s.date == today &&
        minutes >= _minutesOfDay(s.opensAt) &&
        minutes <= _minutesOfDay(s.closesAt)) {
      return s;
    }
  }

  for (final s in sittings) {
    if (s.date.compareTo(today) > 0 ||
        (s.date == today && minutes < _minutesOfDay(s.opensAt))) {
      return s;
    }
  }

  return sittings.last;
}

// ─── Codes ───

final _nonAlphanumeric = RegExp(r'[^a-zA-Z0-9]');

/// Reduce a scanned/typed/pasted payload to a stored check-in code.
///
/// Accepts the arrival QR URL (`?code=...`), a dashed code, or a bare code —
/// the same shapes the gate check-in accepts, because it is the same badge.
/// An exit-pass QR (`?pass=...`) is deliberately rejected: an approved pass to
/// leave camp is not a meal card, and quietly accepting it would tick the
/// wrong camper off the register.
String normalizeMealCode(String input) {
  final trimmed = input.trim();
  final url = Uri.tryParse(trimmed);
  if (url != null && url.hasScheme) {
    if ((url.queryParameters['pass'] ?? '').isNotEmpty) return '';
    final fromParam = url.queryParameters['code'];
    if (fromParam != null && fromParam.isNotEmpty) {
      return fromParam.replaceAll(_nonAlphanumeric, '').toUpperCase();
    }
  }
  return trimmed.replaceAll(_nonAlphanumeric, '').toUpperCase();
}

/// True when the payload is an exit-pass QR rather than a camper's badge.
bool looksLikeExitPassQr(String input) {
  final url = Uri.tryParse(input.trim());
  if (url == null || !url.hasScheme) return false;
  return (url.queryParameters['pass'] ?? '').isNotEmpty &&
      (url.queryParameters['code'] ?? '').isEmpty;
}

/// "ABCDEFGHJKMN" → "ABCD-EFGH-JKMN" for human display.
String formatMealCode(String code) {
  final buffer = StringBuffer();
  for (var i = 0; i < code.length; i++) {
    if (i > 0 && i % 4 == 0) buffer.write('-');
    buffer.write(code[i]);
  }
  return buffer.toString();
}

/// Pull the pass code out of an exit-pass QR payload (`?pass=...`), or an
/// empty string when the payload isn't one.
String normalizePassCode(String input) {
  final trimmed = input.trim();
  final url = Uri.tryParse(trimmed);
  if (url != null && url.hasScheme) {
    final fromParam = url.queryParameters['pass'];
    if (fromParam != null && fromParam.isNotEmpty) {
      return fromParam.replaceAll(_nonAlphanumeric, '').toUpperCase();
    }
    // A camper badge is not a gate pass.
    if ((url.queryParameters['code'] ?? '').isNotEmpty) return '';
  }
  return trimmed.replaceAll(_nonAlphanumeric, '').toUpperCase();
}
