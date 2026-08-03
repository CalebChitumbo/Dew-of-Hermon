# Dew of Hermon — mobile

The Flutter port of the Dew of Hermon web app, living in the same repository so
one change lands in one place.

## How it fits together

The mobile app is not a second backend — it is a second client for the one that
already exists.

| Concern | Where it happens |
| --- | --- |
| Sign-in | `firebase_auth` (email/password + Google) against the same Firebase project |
| Reads | `cloud_firestore` `snapshots()` — the same live pattern the web's `onSnapshot` uses, guarded by the deployed `firestore.rules` |
| Writes | The existing Next.js API routes at `https://dew-of-hermon-xy9h.vercel.app`, with `Authorization: Bearer <Firebase ID token>` |
| Access control | A line-for-line Dart port of `src/lib/access-control.ts`, combined with a live stream of `settings/accessControl` |

Because writes go through the same routes the web posts to, every validation,
notification, email and audit-trail rule stays in exactly one place. The one
web-side change this required is in `src/lib/server-auth.ts`: `getCallerToken()`
tries the session cookie first and falls back to verifying a Bearer ID token, so
the API accepts both clients. `getSessionCaller()` keeps its signature, so the
~90 routes that use it gained mobile support without being touched.

## Getting started

### 1. Install Flutter

Flutter 3.19 or newer (Dart 3.3+). Check with `flutter doctor`.

### 2. Fetch packages

```bash
cd mobile
flutter pub get
```

### 3. Generate the platform projects

This repository carries the platform *configuration* (permissions, minSdk, the
iOS deployment target, the launch theme) but not the generated Xcode project or
Gradle wrapper binaries. Generate them once:

```bash
cd mobile
flutter create --platforms=android,ios --org zm.tabernacleofdavid --project-name dew_of_hermon .
```

`flutter create` leaves existing files alone. Afterwards, confirm these four
settings survived — they are the ones the app actually depends on:

| File | Setting | Why |
| --- | --- | --- |
| `android/app/build.gradle` | `minSdk = 23` | `mobile_scanner` and the Firebase SDKs require it |
| `android/app/src/main/AndroidManifest.xml` | `CAMERA`, `POST_NOTIFICATIONS` | QR scanning and push |
| `ios/Podfile` | `platform :ios, '13.0'` | Firebase Auth and Firestore require iOS 13+ |
| `ios/Runner/Info.plist` | `NSCameraUsageDescription` | iOS refuses camera access without it |

### 4. Configure Firebase

`lib/firebase_options.dart` ships as a placeholder that **throws at startup**,
so an unconfigured build fails loudly instead of misbehaving later. Replace it:

```bash
dart pub global activate flutterfire_cli
cd mobile
flutterfire configure \
  --project=potterswheel \
  --platforms=android,ios \
  --out=lib/firebase_options.dart
```

That registers the Android and iOS apps in the Firebase console and writes
`android/app/google-services.json` and `ios/Runner/GoogleService-Info.plist`.
Both are gitignored — they are per-developer artefacts, not source.

Then two things FlutterFire cannot do for you:

- **Google Sign-In (Android)** — add your debug and release **SHA-1**
  fingerprints under Firebase console → Project settings → your Android app.
  Without them Google sign-in fails with `ApiException: 10`.
  ```bash
  cd mobile/android && ./gradlew signingReport
  ```
- **Push (iOS)** — upload an **APNs auth key** (`.p8`) under Firebase console →
  Project settings → Cloud Messaging, and enable the Push Notifications and
  Background Modes → Remote notifications capabilities in Xcode.

### 5. Run

```bash
flutter run
```

Point the app at a local API instead of production with:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000   # Android emulator
flutter run --dart-define=API_BASE_URL=http://localhost:3000  # iOS simulator
```

## Project layout

```
lib/
├── main.dart, app.dart
├── firebase_options.dart          # placeholder — replaced by flutterfire configure
├── core/
│   ├── config/       API base URL, timeouts (all --dart-define overridable)
│   ├── api/          dio client, Bearer interceptor, 401 → refresh → retry
│   ├── auth/         AuthService + Riverpod providers
│   ├── access/       the access-control port + live config stream
│   ├── router/       go_router config; paths identical to the web's URLs
│   ├── theme/        Clay & Gold tokens, sub-themes, the icon vocabulary
│   ├── push/         FCM registration and notification tap → route
│   ├── widgets/      AppScaffold, drawer, bottom nav, the "lux" primitives
│   └── utils/        dates, money, defensive Firestore parsing
├── data/
│   ├── models/       plain Dart classes mirroring src/types/index.ts
│   ├── firestore/    StreamProviders per collection
│   └── repositories/ one per API domain
└── features/         one folder per screen group
```

### A few deliberate choices

**No code generation.** Models are hand-written `fromMap`/`toMap`. Firestore
data is loose — the same field arrives as a `Timestamp` from a snapshot, an ISO
string from an API route, and an epoch number from an older write — so every
read goes through the defensive helpers in `core/utils/firestore_parse.dart`. A
single odd document can never blank a screen. There is also no build_runner step
to keep in sync.

**Routes match the web's URLs exactly.** `/manage/rops-camp/meals` is the same
string in both apps. That means a push notification's `link` payload deep-links
for free: `router.go(data['link'])`.

**Icons live in one file.** `core/theme/app_icons.dart` is the single binding of
this app's glyph vocabulary to `lucide_icons_flutter`. If a future release of
that package renames a constant, that file is the only one to touch.

**Fonts load at runtime by default.** `google_fonts` downloads DM Sans, DM Serif
Display, Cinzel, Fraunces and Manrope once and caches them in app storage, so
camp works offline after a single online launch. For a build with no first-run
download at all, run `bash tool/fetch_fonts.sh`, uncomment the `fonts:` block in
`pubspec.yaml`, and set `kUseBundledFonts = true` in
`lib/core/theme/app_theme.dart`.

## Design system

Ported from `tailwind.config.ts` and `src/app/globals.css`:

- Cream `#FFF8F0` scaffold, clay ramp `#FAEBD7`…`#2A180F` with clay-700
  `#5B3A29` as primary, gold `#C8963E`, teal `#4A9B8E`, border `#E8DFD6`.
- 12px standard radius, 16px cards, 24px "lux" cards with the warm soft shadow.
- DM Serif Display for headings, DM Sans for body, Cinzel for the login hero.
- Two scoped sub-themes, applied by wrapping a subtree rather than app-wide:
  **ROPs public** (dark ink/ember, Fraunces + Manrope) on the four public camp
  screens, and **parchment** on the fundraising storefront.

The mobile IA mirrors the web's existing mobile layout: a 56px app bar, the
grouped drawer from `nav-config.ts` with live pending-count badges, and a
role-dependent five-item bottom bar (Admin: Dashboard/Members/Calendar/Bible/
Profile · Lead: Dashboard/Services/Calendar/Bible/Profile · Member: Schedule/
Bible/Calendar/Notes/Profile).

## Offline behaviour

Camp runs at a venue whose network comes and goes, so two things are built to
survive it:

- **The meal serving line.** Scans validate against a cached roster and answer
  immediately; the write goes into a `shared_preferences` queue and flushes on
  every connectivity change and on a 15-second timer. Replay is safe because the
  server keys each scan on `${sittingId}_${registrationId}` and uses `create()`
  rather than `set()` — a replayed scan collides instead of double-serving, so
  both a 2xx and a 409 "already served" dequeue the item.
- **Firestore's own cache.** Reads come from the local cache when offline, so
  registers and rosters still render.

## Verifying a build

```bash
cd mobile
flutter analyze
flutter test
```

Then on a device, walk the paths that matter:

1. Sign in as a MEMBER → dashboard, my-schedule, Bible.
2. Sign in as a camp admin → scan a test camper QR at check-in.
3. Turn the phone to airplane mode → scan a meal → turn it back on → confirm
   the queue flushes and the register updates.
4. Gate: scan a camper out, then back in; confirm the second scan closes the
   pass and a third is refused.
5. Approve a pass through the three-stage chain and confirm the QR ticket is
   issued only at the Chairperson step.
