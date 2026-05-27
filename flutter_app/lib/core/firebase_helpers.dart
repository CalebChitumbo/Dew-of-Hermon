import 'package:cloud_firestore/cloud_firestore.dart';

/// Read a Firestore Timestamp (or ISO string fallback) into a DateTime.
DateTime? readTimestamp(dynamic value) {
  if (value == null) return null;
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value);
  return null;
}

DateTime readTimestampOrNow(dynamic value) =>
    readTimestamp(value) ?? DateTime.now();

/// Read a possibly-missing string list.
List<String> readStringList(dynamic value) {
  if (value is List) {
    return value.whereType<String>().toList();
  }
  return const [];
}

/// Convert a typed enum to its string wire format (matching the TS string
/// union types used in Firestore).
String enumName<T extends Enum>(T value) => value.name;

/// Parse a string wire value into one of the given enum values.
/// Returns [fallback] when the value is null or unrecognised.
T parseEnum<T extends Enum>(dynamic value, List<T> values, T fallback) {
  if (value is String) {
    for (final v in values) {
      if (v.name == value) return v;
    }
  }
  return fallback;
}
