// Placeholder Firebase configuration.
//
// Replace this file by running the FlutterFire CLI from the mobile/ folder:
//
//   dart pub global activate flutterfire_cli
//   flutterfire configure --project=<your-firebase-project-id>
//
// That command registers Android + iOS apps in the SAME Firebase project the
// website uses, downloads their config, and regenerates this file (plus
// android/app/google-services.json and ios/Runner/GoogleService-Info.plist).
//
// Until then the app boots into a "setup required" screen.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    throw UnsupportedError(
      'Firebase is not configured yet. Run `flutterfire configure` inside '
      'the mobile/ folder against the same Firebase project as the website '
      '(see mobile/README.md).',
    );
  }
}
