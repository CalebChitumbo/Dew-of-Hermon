import 'package:intl/intl.dart';

/// Date formatting that mirrors the `date-fns` calls scattered through the
/// web app, so the same value reads identically on both.
abstract final class D {
  /// "12 Mar 2026"
  static String medium(DateTime? d) =>
      d == null ? '—' : DateFormat('d MMM yyyy').format(d);

  /// "Thu 27 Aug"
  static String dayMedium(DateTime? d) =>
      d == null ? '—' : DateFormat('EEE d MMM').format(d);

  /// "Thursday, 27 August 2026"
  static String long(DateTime? d) =>
      d == null ? '—' : DateFormat('EEEE, d MMMM yyyy').format(d);

  /// "27 Aug 2026, 14:30"
  static String dateTime(DateTime? d) =>
      d == null ? '—' : DateFormat('d MMM yyyy, HH:mm').format(d);

  /// "14:30"
  static String time(DateTime? d) =>
      d == null ? '—' : DateFormat('HH:mm').format(d);

  /// "August 2026"
  static String monthYear(DateTime d) => DateFormat('MMMM yyyy').format(d);

  /// yyyy-MM-dd — the shape every date-only field is stored in.
  static String iso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  /// The device's own local day, never UTC's — camp runs on Zambian time
  /// whatever timezone the server thinks it is in.
  static String localDay(DateTime now) => iso(now);

  static DateTime? fromIso(String? value) {
    if (value == null || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }

  /// Midnight of the given day, in local time.
  static DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

  static DateTime endOfDay(DateTime d) =>
      DateTime(d.year, d.month, d.day, 23, 59, 59, 999);

  static bool isSameDay(DateTime? a, DateTime? b) =>
      a != null &&
      b != null &&
      a.year == b.year &&
      a.month == b.month &&
      a.day == b.day;

  static bool isToday(DateTime? d) => isSameDay(d, DateTime.now());

  static bool isPast(DateTime? d) =>
      d != null && d.isBefore(DateTime.now());

  /// "in 3 days" / "2 hours ago" / "just now"
  static String relative(DateTime? d) {
    if (d == null) return '—';
    final now = DateTime.now();
    final diff = d.difference(now);
    final abs = diff.abs();
    final future = diff.isNegative == false;

    String phrase(String unit, int n) {
      final label = n == 1 ? unit : '${unit}s';
      return future ? 'in $n $label' : '$n $label ago';
    }

    if (abs.inMinutes < 1) return 'just now';
    if (abs.inMinutes < 60) return phrase('minute', abs.inMinutes);
    if (abs.inHours < 24) return phrase('hour', abs.inHours);
    if (abs.inDays < 30) return phrase('day', abs.inDays);
    if (abs.inDays < 365) return phrase('month', (abs.inDays / 30).round());
    return phrase('year', (abs.inDays / 365).round());
  }

  /// Days until a date, counting whole calendar days.
  static int daysUntil(DateTime d) =>
      startOfDay(d).difference(startOfDay(DateTime.now())).inDays;

  /// "27–31 Aug 2026" for a camp/event window.
  static String range(DateTime? start, DateTime? end) {
    if (start == null) return '—';
    if (end == null || isSameDay(start, end)) return medium(start);
    if (start.year == end.year && start.month == end.month) {
      return '${start.day}–${DateFormat('d MMM yyyy').format(end)}';
    }
    if (start.year == end.year) {
      return '${DateFormat('d MMM').format(start)} – ${medium(end)}';
    }
    return '${medium(start)} – ${medium(end)}';
  }

  /// Monday of the week containing [d] — the week key devotionals use.
  static DateTime startOfWeek(DateTime d) =>
      startOfDay(d).subtract(Duration(days: d.weekday - DateTime.monday));

  /// The next Sunday on or after [d], for the weekly service rhythm.
  static DateTime nextSunday(DateTime d) {
    final delta = (DateTime.sunday - d.weekday) % 7;
    return startOfDay(d.add(Duration(days: delta)));
  }
}
