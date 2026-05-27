# Dew of Hermon — Flutter app

A Flutter port of the Next.js web app, sharing the same Firebase backend
(`potterswheel` project). The goal is a Play Store / App Store native
client for Tabernacle of David Assembly's youth ministry.

## What's in this scaffold

This is a foundation, not a finished port. It contains:

- **Architecture**: Riverpod for state, `go_router` for routing,
  FlutterFire for the backend. App theme matches the web (brown `#5B3A29`
  on cream `#FFF8F0`).
- **Auth**: email/password + Google sign-in, password reset, and an
  auto-bootstrap of `users/{uid}` Firestore docs to match the web app's
  `POST /api/auth/login` flow.
- **Models**: Dart equivalents of the TypeScript types in
  `../src/types/index.ts` — user, event, service, assignment, role,
  department, notification, affirmation, plus all the string-union enums.
  Field names match Firestore wire format exactly, so the Flutter and web
  clients read/write the same documents.
- **Screens (working)**: login, register, forgot password, dashboard
  (welcome card + upcoming events stream), my-schedule (with
  confirm/decline buttons that write to Firestore), calendar, departments
  list, affirmations feed, notifications, profile + sign out.
- **App shell**: bottom navigation across the 5 primary tabs, app bar
  with notifications shortcut.
- **Android config**: package id `com.tabernacledavid.dewofhermon`,
  release-signing wiring (reads from `android/key.properties`), notification
  permissions in the manifest.

## What's not done yet

These are intentionally left for follow-up so they can be designed
properly against the web app's flows:

- The `manage/*` admin screens (events, services, finance, members,
  fundraising, settings, access control, camp registration). The web app
  has ~20 admin pages — these need design decisions about mobile UX.
- Fundraising / Braai screens (orders, assignments, the public order
  form).
- ROPs Camp registration form and payment tracking.
- Follow-up pipeline cards.
- Devotionals viewer.
- Event reports (post-event reporting).
- Transport + budget request workflows (treasurer approvals).
- Department-task management.
- Access-control gating on the client (the role-based feature flags from
  `AccessControlContext.tsx`).
- Push notifications wiring (FCM is in pubspec, but the token-saving
  service isn't yet — needs the web app's `lib/push.ts` equivalent).
- Splash / launcher icons (placeholder).
- iOS config (the project compiles for iOS but `Runner.xcworkspace` hasn't
  been generated — run `flutter create . --platforms=ios` to add it).

## Setup

You need Flutter 3.19+ installed locally. The sandbox this was scaffolded
in did not have Flutter, so the commands below all need to be run on your
own machine.

```bash
cd flutter_app

# 1. Fetch dependencies
flutter pub get

# 2. Generate the platform scaffolding that comes from `flutter create`
#    (this writes android/build.gradle, MainActivity.kt, gradle wrapper,
#    ios/, web/ if needed). It will preserve the lib/ and pubspec we've
#    already written.
flutter create . --org com.tabernacledavid --project-name dew_of_hermon \
  --platforms=android,ios

# 3. Wire Firebase. This rewrites lib/firebase_options.dart with the real
#    project keys and drops android/app/google-services.json +
#    ios/Runner/GoogleService-Info.plist into place. Make sure you're
#    signed in to the Firebase account that owns `potterswheel`.
dart pub global activate flutterfire_cli
flutterfire configure --project=potterswheel

# 4. Run it on a connected device or emulator
flutter run
```

When you `flutter create` in step 2, accept the overwrite prompt for
`pubspec.yaml` only if you've changed nothing in it — otherwise pass
`--overwrite=false` and merge by hand.

## Building a Play Store release bundle

1. **Generate an upload keystore** (one-time):

   ```bash
   keytool -genkey -v -keystore ~/dew-of-hermon-upload.jks \
     -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

2. **Create `android/key.properties`** (do not commit; `.gitignore` excludes it):

   ```
   storePassword=<your-store-password>
   keyPassword=<your-key-password>
   keyAlias=upload
   storeFile=/Users/<you>/dew-of-hermon-upload.jks
   ```

3. **Build the App Bundle**:

   ```bash
   flutter build appbundle --release
   ```

   The signed `.aab` lands at
   `build/app/outputs/bundle/release/app-release.aab` — upload that to
   Play Console.

4. **Play Console housekeeping**: create the app entry, add the brown
   colorway/screenshots, set the privacy policy URL (the web app already
   has one — reuse it), declare data-collection (email + name + push
   token), and complete the Firebase Auth + Firestore data-safety form.

## Mapping web routes → Flutter screens

| Web route | Flutter screen | Status |
|---|---|---|
| `/login`, `/register`, `/forgot-password` | `screens/auth/*` | Done |
| `/dashboard` | `screens/dashboard/dashboard_screen.dart` | Done (basic) |
| `/calendar` | `screens/calendar/calendar_screen.dart` | Done (list view) |
| `/my-schedule` | `screens/schedule/my_schedule_screen.dart` | Done |
| `/notifications` | `screens/notifications/notifications_screen.dart` | Done |
| `/profile` | `screens/profile/profile_screen.dart` | Done |
| `/affirmations` | `screens/affirmations/affirmations_screen.dart` | Done |
| `/departments` | `screens/departments/departments_screen.dart` | Done |
| `/manage/*` | — | TODO |
| `/rops-camp/*` | — | TODO |
| `/fundraising/*` | — | TODO |
| `/latreou`, `/department/*` | — | TODO |

## Backend compatibility

The Flutter client talks to the **same Firestore database** as the web
app — same collections, same document shapes. The Firestore rules in
`../firestore.rules` already gate access by `request.auth.uid` and the
`users/{uid}.role` field, so they work for the Flutter client without
changes.

Anything the web app does server-side via Next.js API routes (admin SDK
mutations, the Trigger Email extension, etc.) is unchanged — the Flutter
app just reads/writes Firestore docs and lets Firebase extensions react.
