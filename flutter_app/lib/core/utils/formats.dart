import 'package:intl/intl.dart';

/// Date/text helpers — port of `src/lib/utils.ts` (minus `cn`).

/// "Sunday, 3 August 2026"
String formatDate(DateTime date) =>
    DateFormat('EEEE, d MMMM yyyy').format(date);

/// "3 Aug 2026"
String formatDateShort(DateTime date) =>
    DateFormat('d MMM yyyy').format(date);

/// "5:30 PM"
String formatTime(DateTime date) => DateFormat('h:mm a').format(date);

/// "3 Aug 2026, 5:30 PM"
String formatDateTimeShort(DateTime date) =>
    DateFormat('d MMM yyyy, h:mm a').format(date);

/// "Today" / "Tomorrow" / "in 3 days" / "2 days ago"
String getRelativeDate(DateTime date) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(date.year, date.month, date.day);
  final diff = day.difference(today).inDays;

  if (diff == 0) return 'Today';
  if (diff == 1) return 'Tomorrow';
  if (diff == -1) return 'Yesterday';

  final delta = date.difference(now);
  final abs = delta.abs();
  String unit;
  int n;
  if (abs.inDays >= 365) {
    n = (abs.inDays / 365).round();
    unit = n == 1 ? 'a year' : '$n years';
  } else if (abs.inDays >= 30) {
    n = (abs.inDays / 30).round();
    unit = n == 1 ? 'a month' : '$n months';
  } else if (abs.inDays >= 1) {
    n = abs.inDays;
    unit = n == 1 ? 'a day' : '$n days';
  } else if (abs.inHours >= 1) {
    n = abs.inHours;
    unit = n == 1 ? 'an hour' : '$n hours';
  } else {
    n = abs.inMinutes.clamp(1, 59);
    unit = n == 1 ? 'a minute' : '$n minutes';
  }
  return delta.isNegative ? '$unit ago' : 'in $unit';
}

/// Replace `{{key}}` placeholders — port of `replacePlaceholders`.
String replacePlaceholders(String template, Map<String, String> data) {
  var result = template;
  data.forEach((key, value) {
    result = result.split('{{$key}}').join(value);
  });
  return result;
}

/// "K 250.00" — money with the app's currency conventions.
String formatMoney(num amount, [String currency = 'K']) {
  final formatted = NumberFormat('#,##0.00').format(amount);
  return '$currency $formatted';
}

/// yyyy-MM-dd (the ISO date-only strings used across the API).
String isoDate(DateTime date) => DateFormat('yyyy-MM-dd').format(date);
