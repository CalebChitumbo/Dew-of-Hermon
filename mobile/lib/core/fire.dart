import 'package:cloud_firestore/cloud_firestore.dart';

/// Defensive converters for Firestore values, mirroring the web app's
/// `toDate()` helper — documents written at different times store dates as
/// Timestamps, ISO strings, or millis.
DateTime asDate(dynamic value) {
  final parsed = asDateOrNull(value);
  return parsed ?? DateTime.now();
}

DateTime? asDateOrNull(dynamic value) {
  if (value == null) return null;
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value);
  if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
  return null;
}

String? asStringOrNull(dynamic value) => value is String ? value : null;

String asString(dynamic value, [String fallback = '']) =>
    value is String ? value : fallback;

bool asBool(dynamic value, [bool fallback = false]) =>
    value is bool ? value : fallback;

num? asNumOrNull(dynamic value) => value is num ? value : null;

List<String> asStringList(dynamic value) =>
    value is List ? value.whereType<String>().toList() : const [];
