import 'package:intl/intl.dart';

/// Money formatting. The ministry works in ZMW; the currency travels with
/// each record so a pledge in another currency still renders correctly.
abstract final class Money {
  static const String defaultCurrency = 'ZMW';

  /// "ZMW 400" — no decimals when the amount is whole, two when it isn't.
  static String format(num? amount, [String? currency]) {
    if (amount == null) return '—';
    final code = (currency == null || currency.isEmpty)
        ? defaultCurrency
        : currency.toUpperCase();
    final whole = amount == amount.roundToDouble();
    final pattern = whole ? '#,##0' : '#,##0.00';
    return '$code ${NumberFormat(pattern).format(amount)}';
  }

  /// Just the number, for tight table cells where the currency is in a header.
  static String plain(num? amount) {
    if (amount == null) return '—';
    final whole = amount == amount.roundToDouble();
    return NumberFormat(whole ? '#,##0' : '#,##0.00').format(amount);
  }

  /// "1.2k" / "34" — for stat tiles where space is scarce.
  static String compact(num? amount) {
    if (amount == null) return '—';
    return NumberFormat.compact().format(amount);
  }
}

/// Phone helpers — Zambian numbers are typed in a handful of shapes and the
/// app should treat "0979 414 477", "0979414477" and "+260979414477" alike.
abstract final class Phone {
  static String digitsOnly(String raw) => raw.replaceAll(RegExp(r'[^0-9+]'), '');

  /// A tel: URI for launching the dialler.
  static Uri dialUri(String raw) => Uri(scheme: 'tel', path: digitsOnly(raw));

  /// "0979 414 477" — grouped for reading aloud.
  static String pretty(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.length == 10 && digits.startsWith('0')) {
      return '${digits.substring(0, 4)} ${digits.substring(4, 7)} ${digits.substring(7)}';
    }
    return raw;
  }
}
