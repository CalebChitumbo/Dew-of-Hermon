import 'package:cloud_firestore/cloud_firestore.dart';

/// Parse a date that may come from the REST API (ISO-8601 string), from a
/// direct Firestore read (`Timestamp`), or already be a `DateTime`.
DateTime? parseDateOrNull(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is Timestamp) return value.toDate();
  if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
  if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
  if (value is Map) {
    // Serialized Firestore timestamp shapes: {_seconds, _nanoseconds} / {seconds, ...}
    final seconds = value['_seconds'] ?? value['seconds'];
    if (seconds is num) {
      return DateTime.fromMillisecondsSinceEpoch(seconds.toInt() * 1000);
    }
  }
  return null;
}

/// Like [parseDateOrNull] but falls back to "now" — mirrors the web app's
/// `data.createdAt?.toDate?.() || new Date()` pattern.
DateTime parseDate(dynamic value) => parseDateOrNull(value) ?? DateTime.now();

String? asStringOrNull(dynamic value) =>
    value == null ? null : value.toString();

String asString(dynamic value, [String fallback = '']) =>
    value?.toString() ?? fallback;

int? asIntOrNull(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}

int asInt(dynamic value, [int fallback = 0]) =>
    asIntOrNull(value) ?? fallback;

double? asDoubleOrNull(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

double asDouble(dynamic value, [double fallback = 0]) =>
    asDoubleOrNull(value) ?? fallback;

bool asBool(dynamic value, [bool fallback = false]) {
  if (value is bool) return value;
  if (value is String) return value == 'true';
  return fallback;
}

List<String> asStringList(dynamic value) =>
    value is List ? value.map((e) => e.toString()).toList() : <String>[];

List<Map<String, dynamic>> asMapList(dynamic value) => value is List
    ? value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
    : <Map<String, dynamic>>[];

/// Data of a Firestore snapshot merged with its id — the shape every model's
/// `fromMap` expects (matches the web app's `{ id: doc.id, ...doc.data() }`).
Map<String, dynamic> docData(DocumentSnapshot doc) {
  final data = (doc.data() as Map<String, dynamic>?) ?? <String, dynamic>{};
  return {'id': doc.id, ...data};
}
