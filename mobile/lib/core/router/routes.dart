import 'package:go_router/go_router.dart';

import '../../features/camp_ops/announcements_screen.dart';
import '../../features/camp_ops/camp_hub_screen.dart';
import '../../features/camp_ops/camp_status_screen.dart';
import '../../features/camp_ops/camper_detail_screen.dart';
import '../../features/camp_ops/check_in_screen.dart';
import '../../features/camp_ops/gate_screen.dart';
import '../../features/camp_ops/meal_scanner_screen.dart';
import '../../features/camp_ops/passes_screen.dart';
import '../../features/camp_ops/sponsorships_screen.dart';
import '../../features/camp_public/camp_landing_screen.dart';
import '../../features/camp_public/camp_register_screen.dart';
import '../../features/camp_public/camp_sponsor_screen.dart';
import '../../features/camp_public/camp_track_screen.dart';
import '../../features/camp_public/my_registrations_screen.dart';
import '../../features/calendar/calendar_screen.dart';
import '../../features/events/event_approvals_screen.dart';
import '../../features/events/event_reports_screen.dart';
import '../../features/events/event_roles_screen.dart';
import '../../features/events/new_event_screen.dart';
import '../../features/requests/department_requests_screen.dart';
import '../../features/requests/request_queue_screen.dart';
import '../../features/schedule/availability_screen.dart';
import '../../features/schedule/my_schedule_screen.dart';
import '../../features/services/service_detail_screen.dart';
import '../../features/services/services_screen.dart';

/// Feature routes.
///
/// Every path is identical to the web URL it ports, so a push-notification
/// `link` payload deep-links for free — `router.go(data['link'])` lands on the
/// same screen the email would.
final List<RouteBase> featureRoutes = [
  // ── ROPs Camp operations ──
  GoRoute(
    path: '/manage/rops-camp',
    builder: (c, s) => const CampHubScreen(),
    routes: [
      GoRoute(
        path: 'status',
        builder: (c, s) => const CampStatusScreen(),
      ),
      GoRoute(
        path: 'check-in',
        builder: (c, s) => const CampCheckInScreen(),
      ),
      GoRoute(
        path: 'meals',
        builder: (c, s) => const MealScannerScreen(),
      ),
      GoRoute(
        path: 'gate',
        builder: (c, s) => const CampGateScreen(),
      ),
      GoRoute(
        path: 'passes',
        builder: (c, s) => const CampPassesScreen(),
      ),
      GoRoute(
        path: 'sponsorships',
        builder: (c, s) => const SponsorshipsScreen(),
      ),
      GoRoute(
        path: 'announcements',
        builder: (c, s) => const CampAnnouncementsScreen(),
      ),
      GoRoute(
        path: 'campers/:id',
        builder: (c, s) =>
            CamperDetailScreen(registrationId: s.pathParameters['id']!),
      ),
    ],
  ),

  // ── ROPs Camp, public ──
  // No account needed: a parent lands here from a WhatsApp link to register a
  // camper, a sponsor to pledge, anyone to track a registration.
  GoRoute(
    path: '/rops-camp',
    builder: (c, s) => const CampLandingScreen(),
    routes: [
      GoRoute(
        path: 'register',
        builder: (c, s) => const CampRegisterScreen(),
      ),
      GoRoute(
        path: 'sponsor',
        builder: (c, s) => const CampSponsorScreen(),
      ),
      GoRoute(
        path: 'track',
        // The badge QR encodes ?code=…, so a scanned link lands here filled in.
        builder: (c, s) =>
            CampTrackScreen(initialCode: s.uri.queryParameters['code']),
      ),
      GoRoute(
        path: 'my-registrations',
        builder: (c, s) => const MyRegistrationsScreen(),
      ),
    ],
  ),

  // ── The weekly rhythm ──
  GoRoute(
    path: '/calendar',
    builder: (c, s) => const CalendarScreen(),
  ),
  GoRoute(
    path: '/my-schedule',
    builder: (c, s) => const MyScheduleScreen(),
    routes: [
      GoRoute(
        path: 'availability',
        builder: (c, s) => const AvailabilityScreen(),
      ),
      GoRoute(
        path: 'history',
        builder: (c, s) => const ScheduleHistoryScreen(),
      ),
    ],
  ),
  GoRoute(
    path: '/manage/services',
    builder: (c, s) => const ServicesScreen(),
    routes: [
      GoRoute(
        path: 'new',
        builder: (c, s) => const NewServiceScreen(),
      ),
      GoRoute(
        path: ':id',
        builder: (c, s) =>
            ServiceDetailScreen(serviceId: s.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'checklist',
            builder: (c, s) =>
                ServiceChecklistScreen(serviceId: s.pathParameters['id']!),
          ),
        ],
      ),
    ],
  ),

  // ── Events pipeline ──
  GoRoute(
    path: '/manage/events/new',
    builder: (c, s) => const NewEventScreen(),
  ),
  GoRoute(
    path: '/manage/events/approvals',
    builder: (c, s) => const EventApprovalsScreen(),
  ),
  GoRoute(
    path: '/manage/events/:id/roles',
    builder: (c, s) => EventRolesScreen(eventId: s.pathParameters['id']!),
  ),
  GoRoute(
    path: '/manage/events/reports',
    builder: (c, s) => const EventReportsScreen(),
    routes: [
      // Declared before ':eventId' so the review paths win the match.
      GoRoute(
        path: 'review',
        builder: (c, s) => const EventReportReviewScreen(),
        routes: [
          GoRoute(
            path: ':eventId',
            builder: (c, s) => EventReportFormScreen(
              eventId: s.pathParameters['eventId']!,
              reviewMode: true,
            ),
          ),
        ],
      ),
      GoRoute(
        path: ':eventId',
        builder: (c, s) =>
            EventReportFormScreen(eventId: s.pathParameters['eventId']!),
      ),
    ],
  ),

  // ── Stakeholder queues ──
  GoRoute(
    path: '/manage/transport/requests',
    builder: (c, s) => const TransportQueueScreen(),
  ),
  GoRoute(
    path: '/manage/media/requests',
    builder: (c, s) => const MediaQueueScreen(),
  ),
  GoRoute(
    path: '/manage/food/requests',
    builder: (c, s) => const FoodQueueScreen(),
  ),
  GoRoute(
    path: '/manage/finance/approvals',
    builder: (c, s) => const AccountsQueueScreen(),
  ),
  GoRoute(
    path: '/manage/department-requests',
    builder: (c, s) => const DepartmentRequestsScreen(),
  ),
];
