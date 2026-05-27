// Placeholder file. Generate the real one by running:
//
//   dart pub global activate flutterfire_cli
//   flutterfire configure --project=potterswheel
//
// from the flutter_app/ directory. That command writes the actual Firebase
// project keys for each platform and overwrites this file. Until you run it,
// the app will throw UnsupportedError on startup.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'Web is not configured. Run `flutterfire configure` to generate '
        'firebase_options.dart.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'Platform ${defaultTargetPlatform.name} is not configured. '
          'Run `flutterfire configure`.',
        );
    }
  }

  // The values below are placeholders. Run `flutterfire configure` to replace
  // them with the keys for the `potterswheel` Firebase project.
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'REPLACE_WITH_ANDROID_API_KEY',
    appId: 'REPLACE_WITH_ANDROID_APP_ID',
    messagingSenderId: 'REPLACE_WITH_SENDER_ID',
    projectId: 'potterswheel',
    storageBucket: 'potterswheel.appspot.com',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'REPLACE_WITH_IOS_API_KEY',
    appId: 'REPLACE_WITH_IOS_APP_ID',
    messagingSenderId: 'REPLACE_WITH_SENDER_ID',
    projectId: 'potterswheel',
    storageBucket: 'potterswheel.appspot.com',
    iosBundleId: 'com.tabernacledavid.dewofhermon',
  );
}
