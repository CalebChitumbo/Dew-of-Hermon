# Potter's Wheel — Mobile App (Flutter)

The native Android + iOS companion to the Dew of Hermon web app, built with
Flutter. **It is a second client for the exact same backend** — nothing about
the website changes:

| Layer | What the app uses | Shared with the web? |
|---|---|---|
| Identity | Firebase Auth (email/password) | ✅ same users, same passwords |
| Data | Cloud Firestore (real-time listeners) | ✅ same database, same security rules |
| Actions | The Next.js REST API on Vercel (`/api/*`) | ✅ same endpoints, same session cookie auth |
| Push | Firebase Cloud Messaging | ✅ same `/api/fcm-tokens` + `sendPushToUser` pipeline |

Anything done in the app appears on the website instantly, and vice versa.

## What's implemented

**Member features** — sign in / register / forgot password (same accounts
as the website), home dashboard (greeting, My Next assignment, weekly
devotional reader, quick actions, upcoming events, recent activity),
calendar with per-day agenda, My Schedule (service + braai assignments
with confirm/decline, unavailability dates), real-time notifications with
unread badge, ROPs Camp registration with payment instructions, braai
food ordering, affirmations feed, profile with push enrolment.

**Leadership features** (Manage tab, permission-gated with the same
access-control system as the web — including the saved
settings/accessControl overrides):

- **Events** — full approval chain (dispatch stakeholders → Events Lead →
  Vice Chair → Chairperson) with live stakeholder status chips; create
  event form incl. transport/budget/media/food needs; all-events list
  with status filters
- **Services & rotas** — create services, assign roles from a member
  picker, unassign, send reminders, preparation checklist
- **Members** — directory with filters, add/edit roles, departments,
  leadership, active flag, super-admin delete
- **Coordination queues** — Finance (treasurer budget decisions),
  Transport (costing + treasurer decision), Media (confirm + assign
  Sound/Publicity/Coverage), Food (catering plan + optional budget)
- **Programs** — braai planning with the 12-responsibility roster and
  the live kitchen/order queue (mark paid, prep status); ROPs Camp
  admin (registrations, payment marking, capacity)
- **Community** — follow-up pipeline (submit/approve/assign/progress),
  weekly devotionals for both scopes, affirmations management,
  departments with member lists and task boards
- **Reports** — post-event questionnaires (draft/submit) and the
  reviewer queue (mark reviewed / request changes)
- **Settings** — institutions list

**Deliberately web-only** (rarely used, config-heavy, or PDF-export
based — the app fully *respects* their effects): the access-control
permissions editor, service role/email template editor, the Latreou
worship planner, the analytics/PDF reports dashboard, editing an event
after submission, and per-event department role generation.

## One-time setup

### 1. Install Flutter

https://docs.flutter.dev/get-started/install (stable channel, 3.44+).

### 2. Connect Firebase (the same project the website uses)

```bash
cd mobile
dart pub global activate flutterfire_cli
flutterfire configure
```

Sign in with the Google account that owns the website's Firebase project and
select that project. This registers Android + iOS apps in it and writes:

- `lib/firebase_options.dart` (replaces the placeholder)
- `android/app/google-services.json`
- `ios/Runner/GoogleService-Info.plist`

That's it — the app now signs into the same user pool and reads the same
Firestore as the website.

### 3. Run it

```bash
flutter run            # on a connected device/emulator
```

Until step 2 is done the app boots into a friendly "Almost there" setup
screen instead of crashing.

The REST API base URL defaults to the production website. Point a build at a
different deployment with:

```bash
flutter run --dart-define=BACKEND_BASE_URL=https://your-preview.vercel.app
```

## Push notifications

The backend already sends FCM `notification` payloads, which Android and iOS
display natively — no server changes needed.

- **Android:** works as soon as `google-services.json` is present.
- **iOS:** additionally requires (one-time, in this order):
  1. An Apple Developer membership.
  2. In Xcode (`ios/Runner.xcworkspace`): add the *Push Notifications*
     capability to the Runner target.
  3. In Apple Developer → Keys: create an APNs key and upload it to
     Firebase Console → Project settings → Cloud Messaging → Apple apps.

Users opt in from **Profile → Enable push**.

## Shipping to the stores

### Google Play (Android)

> **Note:** test builds are signed with the committed `test-signing.jks`
> (public, throwaway — it only exists so sideloaded builds can update each
> other). Before uploading to Play, enroll in **Play App Signing** and
> generate a private upload key per the Flutter docs; never reuse the test
> keystore.

1. One-time: create a Play Console developer account ($25 once).
2. Create an upload keystore and configure signing
   (https://docs.flutter.dev/deployment/android#sign-the-app).
3. Build: `flutter build appbundle` → upload `build/app/outputs/bundle/release/app-release.aab`.
4. Note: new personal Play accounts must run a closed test (12 testers for
   14 days) before production access — start this early.

### App Store (iOS)

1. One-time: Apple Developer Program ($99/year).
2. iOS builds require a Mac (or a macOS CI service such as Codemagic or
   GitHub Actions macOS runners — no Mac needed at all with Codemagic).
3. Build & upload: `flutter build ipa`, then upload via Xcode/Transporter,
   test in TestFlight, submit for review.

App identifiers are `com.potterswheel.potters_wheel` — change them in
`android/app/build.gradle.kts` and the Xcode project *before* first store
upload if you want different ones (they're permanent once published).

## Architecture notes (for future sessions)

- `lib/core/api_client.dart` — Dio client with a persistent cookie jar.
  Sign-in POSTs the Firebase ID token to `/api/auth/login`, which sets the
  same `session` cookie the website uses; every request also sends
  `Authorization: Bearer <idToken>`; 401s trigger one session-refresh retry
  (the mobile twin of `src/lib/fetchWithAuth.ts`).
- `lib/services/auth_service.dart` — mirror of `src/contexts/AuthContext.tsx`
  (auth state + live `users/{uid}` profile listener).
- `lib/models/models.dart` — Dart ports of `src/types/index.ts` (same string
  enums, defensive date parsing like the web's `toDate()`).
- Reads use Firestore listeners (same queries/indexes as the web pages);
  writes go through the REST API where the website does the same.
- Adding a feature? Find the web page under `src/app/`, reuse its Firestore
  queries and API calls 1:1, and keep the clay/gold/teal theme
  (`lib/theme/app_theme.dart`).
