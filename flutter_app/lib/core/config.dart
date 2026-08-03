/// App-wide configuration.
///
/// The mobile app is a client of the deployed web app's API (same Firebase
/// project, same business rules). Override at build time with
/// `--dart-define=API_BASE_URL=https://your-deployment.vercel.app`.
class AppConfig {
  AppConfig._();

  static const String appName = 'Dew of Hermon';

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://dew-of-hermon-xy9h.vercel.app',
  );

  /// OAuth 2.0 web client id of the Firebase project, needed by Google
  /// Sign-In on Android/iOS. Leave empty to hide the Google button.
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '',
  );

  /// Absolute URL for an asset served by the web app (e.g. `/images/...`).
  static String assetUrl(String path) =>
      path.startsWith('http') ? path : '$apiBaseUrl$path';

  /// The bolls.life Bible service used by the web app's reader.
  static const String bibleBaseUrl = 'https://bolls.life';
}
