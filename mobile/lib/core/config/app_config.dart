/// Build-time configuration.
///
/// Everything here is overridable with `--dart-define`, so a staging build is
/// a flag away:
///
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
abstract final class AppConfig {
  /// Where the Next.js API routes live. Every write in the app goes through
  /// these — the mobile client reads Firestore directly but never writes to
  /// it, so all the server-side validation stays in one place.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://dew-of-hermon-xy9h.vercel.app',
  );

  /// Base for links the web sends out (QR payloads, email deep links). Same
  /// host as the API in production, but kept separate so a local API build
  /// still produces scannable production QR codes.
  static const String webBaseUrl = String.fromEnvironment(
    'WEB_BASE_URL',
    defaultValue: 'https://dew-of-hermon-xy9h.vercel.app',
  );

  static const Duration connectTimeout = Duration(seconds: 20);
  static const Duration receiveTimeout = Duration(seconds: 40);

  /// How often the offline meal queue retries while the scanner is open.
  static const Duration mealQueueFlushInterval = Duration(seconds: 15);
}
