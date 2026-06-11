// Firebase configuration for the same project the website uses
// (dew-of-hermon-96f43). Android values come from the registered Android
// app's google-services.json.
//
// iOS isn't registered yet — when you're ready for the iPhone build, run
// `flutterfire configure` from mobile/ (see README.md) and it will extend
// this file and add ios/Runner/GoogleService-Info.plist.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('This app targets Android and iOS, not web.');
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        throw UnsupportedError(
          'The iOS app is not registered in Firebase yet. Run '
          '`flutterfire configure` inside mobile/ (see mobile/README.md).',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCnr-EvxO1nP6_UBLntNW6a68bQ-x2QlU0',
    appId: '1:845155172503:android:131c797e8caad5d07b69d2',
    messagingSenderId: '845155172503',
    projectId: 'dew-of-hermon-96f43',
    storageBucket: 'dew-of-hermon-96f43.firebasestorage.app',
  );
}
