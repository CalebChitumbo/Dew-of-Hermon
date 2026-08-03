// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER — replace this file by running FlutterFire.
//
//   dart pub global activate flutterfire_cli
//   flutterfire configure --project=potterswheel \
//     --platforms=android,ios \
//     --out=lib/firebase_options.dart
//
// That command registers the Android and iOS apps in the Firebase console and
// writes the real options here, alongside `android/app/google-services.json`
// and `ios/Runner/GoogleService-Info.plist`.
//
// Until then this throws loudly at startup rather than failing later with a
// confusing "no Firebase app" error deep inside a screen.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:firebase_core/firebase_core.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    throw UnsupportedError(
      'Firebase is not configured for this app yet.\n'
      '\n'
      'Run:\n'
      '  dart pub global activate flutterfire_cli\n'
      '  flutterfire configure --project=potterswheel '
      '--platforms=android,ios --out=lib/firebase_options.dart\n'
      '\n'
      'See mobile/README.md → "Firebase setup" for the full checklist '
      '(SHA-1 for Google Sign-In, APNs key for iOS push).',
    );
  }
}
