# Dew of Hermon — Mobile App (Flutter)

The native mobile port of the Dew of Hermon Youth Ministry platform. It is a client of the
**same backend as the web app** — same Firebase project (auth, Firestore, FCM) and the same
deployed API on Vercel — so both apps always see the same data, permissions, and workflows.

- `PORT_PLAN.md` — architecture of the port and how modules map to the web app.
- `lib/core/` — theme, models, API client, access control, navigation shell.
- `lib/features/` — one folder per feature area, each mirroring its web pages.

## Prerequisites

- Flutter SDK **3.27 or newer** (`flutter --version`)
- A machine with Android Studio (for Android) and/or Xcode (for iOS)
- Access to the Firebase project the web app uses (`potterswheel`)

## One-time setup

```bash
cd flutter_app

# 1) Generate the platform folders (android/ and ios/ are not committed —
#    this creates them to match YOUR Flutter version, which avoids Gradle drift):
flutter create --platforms=android,ios --org com.dewofhermon --project-name dew_of_hermon .

# 2) Fetch dependencies
flutter pub get

# 3) Connect Firebase (recommended): generates real firebase_options.dart
#    and registers the Android/iOS apps in the same project as the web app.
dart pub global activate flutterfire_cli
flutterfire configure --project=potterswheel
```

After `flutter create`, make these small edits to the generated Android project:

1. `android/app/build.gradle(.kts)` → set `minSdk = 23` (Firebase Auth requires it).
2. `android/app/src/main/AndroidManifest.xml` → inside `<manifest>` add:
   `<uses-permission android:name="android.permission.INTERNET"/>`
   (the camera permission for QR scanning is contributed automatically by `mobile_scanner`).
3. Set the app label: `android:label="Dew of Hermon"` on the `<application>` tag.

### Google Sign-In (optional but recommended)

Email/password works with no extra setup. For the "Continue with Google" button:

1. In Firebase Console → Project settings → your Android app, add your debug/release
   **SHA-1 fingerprints** (`cd android && ./gradlew signingReport`).
2. Pass the **web client id** of the project at build time:
   `--dart-define=GOOGLE_SERVER_CLIENT_ID=<...>.apps.googleusercontent.com`
   (Firebase Console → Authentication → Sign-in method → Google → Web client ID.)

### If you skip `flutterfire configure`

The committed `lib/firebase_options.dart` reads config from `--dart-define`. Use the same
values as the web app's `.env.local` (`NEXT_PUBLIC_FIREBASE_*`):

```bash
flutter run \
  --dart-define=FIREBASE_API_KEY=... \
  --dart-define=FIREBASE_APP_ID=... \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=... \
  --dart-define=FIREBASE_PROJECT_ID=potterswheel \
  --dart-define=FIREBASE_STORAGE_BUCKET=potterswheel.appspot.com \
  --dart-define=FIREBASE_AUTH_DOMAIN=potterswheel.firebaseapp.com
```

## Running

```bash
flutter run                     # debug on a connected device/emulator
flutter build apk --release     # Android APK
flutter build appbundle         # Play Store bundle
flutter build ipa               # iOS (on macOS)
```

The API base URL defaults to the production deployment
(`https://dew-of-hermon-xy9h.vercel.app`). Point it elsewhere with:
`--dart-define=API_BASE_URL=https://your-deployment.vercel.app`

## How it stays in sync with the web app

Business logic lives server-side (Next.js API routes + Firestore rules), so most product
changes reach the mobile app with **no mobile release**. When you change the web app:

| Change in web app                          | What to do here                                      |
|--------------------------------------------|------------------------------------------------------|
| API route behavior, emails, workflows      | Nothing — picked up automatically                    |
| New fields in `src/types/index.ts`         | Mirror in `lib/core/models/`                         |
| Access rules in `src/lib/access-control.ts`| Mirror in `lib/core/access/access_control.dart`      |
| Nav items in `nav-config.ts`               | Mirror in `lib/core/nav/nav_config.dart`             |
| A page's UI/flow                           | Update the matching screen in `lib/features/<module>`|
| New page/route                             | Add screen + route in `lib/core/router/app_router.dart` |

## Feature map

| Web route(s)                       | Flutter module               |
|------------------------------------|------------------------------|
| /login, /register, /forgot-password| `features/auth`              |
| /dashboard                         | `features/dashboard`         |
| /manage/services, /my-schedule     | `features/services`          |
| /calendar, /manage/events/**       | `features/events`            |
| /departments, /manage/members, /manage/department-requests | `features/departments` |
| /department/* (campus, discipleship, life groups) | `features/ministries` |
| /rops-camp (public, track, sponsor, my-registrations) | `features/camp` |
| /manage/rops-camp/** (register, passes, gate, check-in, meals, sponsorships, announcements, status) | `features/camp_admin` |
| /manage/fundraising/**, /fundraising/order | `features/fundraising` |
| /manage/transport|media|food/requests, /manage/finance/approvals | `features/requests` |
| /latreou                           | `features/latreou`           |
| /bible                             | `features/bible`             |
| /affirmations, /talents, /notifications, /profile | `features/misc` |
| /manage/settings/**, /manage/templates, /manage/reports | `features/admin` |

## Notes

- **QR scanning** (camp gate, meals, check-in) uses the device camera via `mobile_scanner`.
- **PDFs** (Latreuo document, event reports, camp QR tags) are generated on-device with the
  `pdf` package and shared via the system share sheet.
- **Push notifications** register the device with the same `/api/fcm-tokens` endpoint the
  web uses; server pushes reach both platforms.
- The web app's `/seed` developer page is intentionally not ported.
