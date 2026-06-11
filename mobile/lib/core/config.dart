/// App-wide configuration.
///
/// The mobile app talks to the exact same backend as the website:
///  - the same Firebase project (Auth + Firestore + FCM), and
///  - the same Next.js REST API hosted on Vercel.
class AppConfig {
  AppConfig._();

  static const String appName = "Potter's Wheel";

  /// Base URL of the deployed Next.js app (the website). All `/api/*`
  /// calls go here. Override at build time with:
  ///   flutter build apk --dart-define=BACKEND_BASE_URL=https://your-domain
  static const String backendBaseUrl = String.fromEnvironment(
    'BACKEND_BASE_URL',
    defaultValue: 'https://dew-of-hermon-xy9h.vercel.app',
  );
}
