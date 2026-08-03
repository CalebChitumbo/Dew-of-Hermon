import 'package:cloud_firestore/cloud_firestore.dart';

/// Defensive readers for Firestore documents and API JSON.
///
/// Firestore data is loose by nature: the same field arrives as a `Timestamp`
/// from a snapshot, an ISO string from an API route, and an epoch number from
/// an older write. Everything in `data/models` goes through these helpers so a
/// single odd document can never crash a screen.

/// Parse a date from a `Timestamp`, an ISO-8601 string, a `DateTime`, or an
/// epoch-milliseconds number. Returns null for anything unparseable.
DateTime? parseDate(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is Timestamp) return value.toDate();
  if (value is int) {
    // Epoch seconds vs milliseconds: anything below ~1e11 is seconds.
    return value.abs() < 100000000000
        ? DateTime.fromMillisecondsSinceEpoch(value * 1000)
        : DateTime.fromMillisecondsSinceEpoch(value);
  }
  if (value is double) return parseDate(value.round());
  if (value is String) {
    if (value.isEmpty) return null;
    return DateTime.tryParse(value);
  }
  // Serialized Firestore timestamps from the Admin SDK: { _seconds, ... }.
  if (value is Map) {
    final seconds = value['_seconds'] ?? value['seconds'];
    if (seconds is num) {
      return DateTime.fromMillisecondsSinceEpoch(seconds.round() * 1000);
    }
  }
  return null;
}

/// Same as [parseDate] but never null — falls back to the epoch so a
/// `createdAt`-style required field always has something to sort on.
DateTime parseDateOr(dynamic value, [DateTime? fallback]) =>
    parseDate(value) ?? fallback ?? DateTime.fromMillisecondsSinceEpoch(0);

String? parseString(dynamic value) {
  if (value == null) return null;
  if (value is String) return value.isEmpty ? null : value;
  return value.toString();
}

String parseStringOr(dynamic value, [String fallback = '']) =>
    parseString(value) ?? fallback;

int? parseInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value) ?? double.tryParse(value)?.round();
  return null;
}

int parseIntOr(dynamic value, [int fallback = 0]) =>
    parseInt(value) ?? fallback;

double? parseDouble(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

double parseDoubleOr(dynamic value, [double fallback = 0]) =>
    parseDouble(value) ?? fallback;

bool parseBool(dynamic value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) {
    final v = value.toLowerCase();
    if (v == 'true' || v == '1' || v == 'yes') return true;
    if (v == 'false' || v == '0' || v == 'no') return false;
  }
  return fallback;
}

List<String> parseStringList(dynamic value) {
  if (value is! List) return const [];
  return value
      .where((e) => e != null)
      .map((e) => e.toString())
      .where((e) => e.isNotEmpty)
      .toList();
}

Map<String, dynamic> parseMap(dynamic value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

List<Map<String, dynamic>> parseMapList(dynamic value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();
}

/// Resolve a string to one of an enum-like set of allowed values, falling
/// back when the stored value is unknown (an older document, a typo, a value
/// added by a newer web deploy).
T parseEnum<T>(
  dynamic value,
  Map<String, T> byName,
  T fallback,
) {
  if (value is String) {
    final match = byName[value];
    if (match != null) return match;
  }
  return fallback;
}

/// Same, but null rather than a fallback — for genuinely nullable enums.
T? parseEnumOrNull<T>(dynamic value, Map<String, T> byName) {
  if (value is String) return byName[value];
  return null;
}

/// Merge a document's id into its data, the shape every model expects.
Map<String, dynamic> withId(DocumentSnapshot<Map<String, dynamic>> doc) {
  return {...(doc.data() ?? const {}), 'id': doc.id};
}
