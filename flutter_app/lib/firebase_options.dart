import 'package:firebase_core/firebase_core.dart';

/// Firebase configuration for the same project the web app uses.
///
/// Preferred setup: run `flutterfire configure` in `flutter_app/` — it
/// overwrites this file with generated per-platform options. Until then,
/// values can be supplied at build time with --dart-define using the web
/// app's `NEXT_PUBLIC_FIREBASE_*` values from `.env.local`:
///
/// ```
/// flutter run \
///   --dart-define=FIREBASE_API_KEY=AIza... \
///   --dart-define=FIREBASE_APP_ID=1:1234:android:abc \
///   --dart-define=FIREBASE_MESSAGING_SENDER_ID=1234 \
///   --dart-define=FIREBASE_PROJECT_ID=potterswheel \
///   --dart-define=FIREBASE_STORAGE_BUCKET=potterswheel.appspot.com \
///   --dart-define=FIREBASE_AUTH_DOMAIN=potterswheel.firebaseapp.com
/// ```
class DefaultFirebaseOptions {
  DefaultFirebaseOptions._();

  static const FirebaseOptions currentPlatform = FirebaseOptions(
    apiKey: String.fromEnvironment('FIREBASE_API_KEY'),
    appId: String.fromEnvironment('FIREBASE_APP_ID'),
    messagingSenderId:
        String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID'),
    projectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
    storageBucket: String.fromEnvironment('FIREBASE_STORAGE_BUCKET'),
    authDomain: String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
  );

  static bool get isConfigured =>
      const String.fromEnvironment('FIREBASE_API_KEY').isNotEmpty;
}
