# Dew of Hermon — Flutter Mobile Port

This folder contains the native mobile port of the Dew of Hermon Youth Ministry web app
(Next.js 14 + Firebase, in the repository root). The mobile app is a **client of the same
backend** — same Firebase project, same deployed API — so both apps always see the same data
and the same business rules. Updating a feature server-side updates both apps.

## Architecture

The web app is hybrid: pages read Firestore directly for realtime lists, and call
Next.js API routes (session-cookie authenticated) for anything with business logic.
The Flutter app mirrors this exactly:

| Concern              | Web app                                  | Flutter app                                       |
|----------------------|------------------------------------------|---------------------------------------------------|
| Sign in              | `firebase/auth` (email/password, Google) | `firebase_auth` + `google_sign_in`                |
| Session              | ID token → `POST /api/auth/login` → `session` cookie | Same flow via `ApiClient` (Dio + persistent cookie jar) |
| 401 recovery         | `fetchWithAuth` refreshes cookie & retries | `ApiClient` interceptor does the identical dance |
| Business actions     | `fetch("/api/...")`                      | `ApiClient.get/post/patch/delete("/api/...")`     |
| Realtime lists       | `onSnapshot(collection(...))`            | `cloud_firestore` snapshots via `FirestoreService` |
| Access control       | `lib/access-control.ts` + AccessControlContext | 1:1 Dart port in `core/access/`             |
| Push                 | FCM web + `/api/fcm-tokens`              | `firebase_messaging` + same endpoint              |
| Bible text           | bolls.life REST                          | Same endpoints via `BibleApi`                     |
| PDFs (Latreuo, reports, QR tags) | jspdf in browser             | `pdf` + `printing` packages                       |
| QR scanning (gate/meals/check-in) | jsQR + getUserMedia         | `mobile_scanner`                                  |
| QR rendering (passes/tags)        | `qrcode` lib                | `qr_flutter`                                      |

The API base URL defaults to the production deployment and can be overridden at build time:
`--dart-define=API_BASE_URL=https://dew-of-hermon-xy9h.vercel.app`

## Design system (ported from `src/app/globals.css`, `tailwind.config.ts`, `lux.tsx`)

- **Palette**: cream background `#FFF8F0`; clay scale 50→900 (`#FFF8F0`, `#FAEBD7`, `#F0D0A8`,
  `#DEB887`, `#C8963E`, `#A0784A`, `#7D5A3C`, `#5B3A29`, `#3E2518`, `#2A180F`); gold
  `#C8963E` (light `#E0B872`, dark `#9A7230`); teal `#4A9B8E` (light `#6DB8AB`, dark `#357A6F`).
- **Icon tones** (chip bg/fg): sage `#E6EDE4`/`#6E8A6C`, periwinkle `#E6E8F6`/`#6E74B8`,
  lavender `#EEE6F5`/`#8A6CB0`, blush `#F6E6EA`/`#BC7488`, plus gold/teal/blue/clay/emerald/amber/rose.
- **Type**: DM Serif Display for headings/values ("display"), DM Sans for body, via `google_fonts`.
- **Shape**: base radius 12 (`--radius: 0.75rem`); lux cards radius 24 (`rounded-3xl`) with
  hairline clay border (`#FAEBD7` at 80%) on warm white (`white/80`) and a soft warm shadow
  (`rgba(91,58,41,…)`), uppercase-tracked micro labels, serif display values.
- **Shell**: mobile header (logo + "Dew of Hermon" + notification bell) and a slide-out drawer
  with grouped, collapsible nav (groups: Potter's Wheel, Events, Ministries, Requests, Admin;
  standalone: Dashboard, My Schedule, Bible, Members, ROPs Camp, Camp Status, Fundraising,
  Affirmations, Talent Showcase), red pending-count pills, user card + sign-out in the footer.
  Nav visibility mirrors `nav-config.ts` + `access-control.ts` exactly.

## Folder layout

```
flutter_app/
  pubspec.yaml
  lib/
    main.dart                  # Firebase init, providers, runApp
    app.dart                   # MaterialApp.router + theme
    core/
      config.dart              # API base URL, camp id, app constants
      theme/                   # colors, tones, text styles, ThemeData
      api/api_client.dart      # Dio + cookie jar + 401-refresh interceptor
      auth/                    # AuthService (Firebase) + AuthProvider (user doc stream)
      access/                  # access_control.dart (1:1 port), AccessControlProvider,
                               # FeatureAccess (dept-map cache), page guards
      firestore/               # safe converters: parseDate (ISO string | Timestamp), helpers
      models/                  # every interface from src/types/index.ts, same field names
      nav/nav_config.dart      # NavEntry/NavGroup tree, getVisibleNavEntries port
      router/app_router.dart   # go_router, same paths as the web app
      shell/                   # AppShell scaffold, drawer (SidebarNav port), header
      widgets/                 # lux widgets (StatCardLux, StatStripLux, SegmentedTabs,
                               # EmptyStateLux, SectionHeadingLux), PageHeader, StatusBadge,
                               # LoadingSpinner, CollapsibleSection, NotificationBell, toasts
      services/                # NotificationsService, PendingCountsService, PushService (FCM),
                               # BibleApi, department map cache
    features/
      auth/          # login, register, forgot-password
      dashboard/     # role-aware dashboard (hero, lux stat cards, feeds)
      services/      # Services & Rotas admin + My Schedule (+availability, history)
      events/        # calendar, create event, approvals, roles, reports (+review, PDF)
      departments/   # departments, dept detail, join/recommend, members admin, join requests
      ministries/    # campus ministry, discipleship, life groups (follow-ups, devotionals)
      camp/          # public: landing, track, sponsor; user: my-registrations
      camp_admin/    # register, passes, gate scan, check-in scan, meals scan, sponsorships,
                     # announcements, status, QR tag PDFs
      fundraising/   # braai planning, orders board, menu settings, public order page
      requests/      # transport, media, food, finance (treasurer) queues
      latreou/       # worship cycle wizard + PDF export
      bible/         # reader, search, saved verses (bookmarks + highlights)
      misc/          # affirmations (+manage), talents (+manage), notifications, profile
      admin/         # settings, access control matrix, institutions, templates, reports
```

## Conventions (all feature code must follow)

1. **API JSON**: envelopes are named (`{ events: [...] }`, `{ error: "..." }`); dates are
   ISO-8601 strings or null. Model `fromMap` accepts both ISO strings and Firestore
   `Timestamp` (use `parseDate`/`parseDateOrNull` from `core/firestore/converters.dart`).
2. **Screens** are `StatefulWidget`s named exactly as stubbed (e.g. `RopsCampGateScreen`);
   files stay where stubbed. Feature agents own only their `features/<x>/` folder.
3. **Access gating**: wrap admin screens in `RoleProtected(pageKey: ...)` /
   feature checks via `context.watch<FeatureAccessProvider>().can('feature_key')` —
   same keys as the web app.
4. **Navigation**: `context.go('/path')` / `context.push('/path')` with the web app's paths.
5. **Visual language**: use the core lux widgets + theme tokens; no ad-hoc colors/fonts.
6. **Firestore parity**: where the web page uses `onSnapshot`, use a `StreamBuilder` on the
   equivalent query (`FirestoreService` exposes typed streams); where the web page calls an
   API route, call the same route via `ApiClient`.

## Execution plan

- Fable 5 (this session): recon, this plan, the entire `core/` layer, every screen stub,
  route table, pubspec, Android scaffold, README.
- Opus 5 agents: one per feature module (14), each implementing its screens by porting the
  matching `src/app/**` pages 1:1 (they read the TSX source directly).
- Final pass: cross-file consistency review (imports, model fields, routes), fixes, docs.

## Updating the app later

The web app remains the source of truth for business logic. When a web feature changes:
1. If it's server-side only (API behavior), the mobile app picks it up automatically.
2. If it's a UI/flow change, update the matching `features/<module>` screen here.
3. Keep `core/models` in sync with `src/types/index.ts` and `core/access` in sync with
   `src/lib/access-control.ts` — they are line-for-line ports.
