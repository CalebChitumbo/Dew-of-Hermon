import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin/access_control_screen.dart';
import '../../features/admin/institutions_screen.dart';
import '../../features/admin/reports_screen.dart';
import '../../features/admin/settings_screen.dart';
import '../../features/admin/templates_screen.dart';
import '../../features/auth/forgot_password_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/register_screen.dart';
import '../../features/bible/bible_screen.dart';
import '../../features/camp/camp_sponsor_screen.dart';
import '../../features/camp/camp_track_screen.dart';
import '../../features/camp/my_registrations_screen.dart';
import '../../features/camp/rops_camp_landing_screen.dart';
import '../../features/camp_admin/camp_announcements_screen.dart';
import '../../features/camp_admin/camp_check_in_screen.dart';
import '../../features/camp_admin/camp_gate_screen.dart';
import '../../features/camp_admin/camp_meals_screen.dart';
import '../../features/camp_admin/camp_passes_screen.dart';
import '../../features/camp_admin/camp_sponsorships_screen.dart';
import '../../features/camp_admin/camp_status_screen.dart';
import '../../features/camp_admin/rops_camp_admin_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/departments/department_detail_screen.dart';
import '../../features/departments/department_join_screen.dart';
import '../../features/departments/department_recommend_screen.dart';
import '../../features/departments/department_requests_screen.dart';
import '../../features/departments/departments_screen.dart';
import '../../features/departments/member_detail_screen.dart';
import '../../features/departments/member_new_screen.dart';
import '../../features/departments/members_screen.dart';
import '../../features/events/calendar_screen.dart';
import '../../features/events/event_approvals_screen.dart';
import '../../features/events/event_new_screen.dart';
import '../../features/events/event_report_form_screen.dart';
import '../../features/events/event_report_review_detail_screen.dart';
import '../../features/events/event_reports_review_screen.dart';
import '../../features/events/event_reports_screen.dart';
import '../../features/events/event_roles_screen.dart';
import '../../features/fundraising/braai_detail_screen.dart';
import '../../features/fundraising/fundraising_screen.dart';
import '../../features/fundraising/fundraising_settings_screen.dart';
import '../../features/fundraising/public_order_screen.dart';
import '../../features/latreou/latreou_screen.dart';
import '../../features/ministries/campus_ministry_screen.dart';
import '../../features/ministries/department_home_screen.dart';
import '../../features/ministries/discipleship_screen.dart';
import '../../features/ministries/life_groups_screen.dart';
import '../../features/misc/affirmation_edit_screen.dart';
import '../../features/misc/affirmation_new_screen.dart';
import '../../features/misc/affirmations_screen.dart';
import '../../features/misc/manage_affirmations_screen.dart';
import '../../features/misc/manage_talents_screen.dart';
import '../../features/misc/notifications_screen.dart';
import '../../features/misc/profile_screen.dart';
import '../../features/misc/talents_screen.dart';
import '../../features/requests/finance_approvals_screen.dart';
import '../../features/requests/food_requests_screen.dart';
import '../../features/requests/media_requests_screen.dart';
import '../../features/requests/transport_request_detail_screen.dart';
import '../../features/requests/transport_requests_screen.dart';
import '../../features/services/my_availability_screen.dart';
import '../../features/services/my_history_screen.dart';
import '../../features/services/my_schedule_screen.dart';
import '../../features/services/service_checklist_screen.dart';
import '../../features/services/service_detail_screen.dart';
import '../../features/services/service_new_screen.dart';
import '../../features/services/services_screen.dart';
import '../auth/auth_provider.dart';
import '../shell/app_shell.dart';

/// Route table mirroring the web app's paths (`src/app/**`), with the same
/// auth rules as `src/middleware.ts`: protected prefixes require a session,
/// and a signed-in user landing on /login or /register goes to /dashboard.
GoRouter createRouter(AuthProvider auth) {
  // Public paths that never require a session (the web app's unguarded pages).
  const publicPaths = <String>{
    '/login',
    '/register',
    '/forgot-password',
    '/rops-camp',
    '/rops-camp/track',
    '/rops-camp/sponsor',
    '/fundraising/order',
  };

  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: auth,
    redirect: (context, state) {
      final path = state.uri.path;
      final signedIn = auth.isSignedIn;

      if (path == '/') return signedIn ? '/dashboard' : '/login';

      final isPublic = publicPaths.contains(path);
      if (!signedIn && !isPublic) return '/login';
      if (signedIn && (path == '/login' || path == '/register')) {
        return '/dashboard';
      }
      return null;
    },
    routes: [
      // ── Public (outside the shell) ──
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/rops-camp',
        builder: (context, state) => const RopsCampLandingScreen(),
      ),
      GoRoute(
        path: '/rops-camp/track',
        builder: (context, state) => const CampTrackScreen(),
      ),
      GoRoute(
        path: '/rops-camp/sponsor',
        builder: (context, state) => const CampSponsorScreen(),
      ),
      GoRoute(
        path: '/fundraising/order',
        builder: (context, state) => const PublicOrderScreen(),
      ),

      // ── Signed-in area (inside the shell) ──
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/my-schedule',
            builder: (context, state) => const MyScheduleScreen(),
          ),
          GoRoute(
            path: '/my-schedule/availability',
            builder: (context, state) => const MyAvailabilityScreen(),
          ),
          GoRoute(
            path: '/my-schedule/history',
            builder: (context, state) => const MyHistoryScreen(),
          ),
          GoRoute(
            path: '/bible',
            builder: (context, state) => const BibleScreen(),
          ),
          GoRoute(
            path: '/calendar',
            builder: (context, state) => const CalendarScreen(),
          ),
          GoRoute(
            path: '/latreou',
            builder: (context, state) => const LatreouScreen(),
          ),
          GoRoute(
            path: '/notifications',
            builder: (context, state) => const NotificationsScreen(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfileScreen(),
          ),
          GoRoute(
            path: '/affirmations',
            builder: (context, state) => const AffirmationsScreen(),
          ),
          GoRoute(
            path: '/talents',
            builder: (context, state) => const TalentsScreen(),
          ),
          GoRoute(
            path: '/departments',
            builder: (context, state) => const DepartmentsScreen(),
          ),
          GoRoute(
            path: '/departments/:id',
            builder: (context, state) =>
                DepartmentDetailScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/department',
            builder: (context, state) => const DepartmentHomeScreen(),
          ),
          GoRoute(
            path: '/department/join',
            builder: (context, state) => const DepartmentJoinScreen(),
          ),
          GoRoute(
            path: '/department/recommend',
            builder: (context, state) => const DepartmentRecommendScreen(),
          ),
          GoRoute(
            path: '/department/campus-ministry',
            builder: (context, state) => const CampusMinistryScreen(),
          ),
          GoRoute(
            path: '/department/discipleship',
            builder: (context, state) => const DiscipleshipScreen(),
          ),
          GoRoute(
            path: '/department/life-groups',
            builder: (context, state) => const LifeGroupsScreen(),
          ),
          GoRoute(
            path: '/rops-camp/my-registrations',
            builder: (context, state) => const MyRegistrationsScreen(),
          ),

          // Manage — members
          GoRoute(
            path: '/manage/members',
            builder: (context, state) => const MembersScreen(),
          ),
          GoRoute(
            path: '/manage/members/new',
            builder: (context, state) => const MemberNewScreen(),
          ),
          GoRoute(
            path: '/manage/members/:id',
            builder: (context, state) =>
                MemberDetailScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/manage/department-requests',
            builder: (context, state) => const DepartmentRequestsScreen(),
          ),

          // Manage — services
          GoRoute(
            path: '/manage/services',
            builder: (context, state) => const ServicesScreen(),
          ),
          GoRoute(
            path: '/manage/services/new',
            builder: (context, state) => const ServiceNewScreen(),
          ),
          GoRoute(
            path: '/manage/services/:id',
            builder: (context, state) =>
                ServiceDetailScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/manage/services/:id/checklist',
            builder: (context, state) =>
                ServiceChecklistScreen(id: state.pathParameters['id']!),
          ),

          // Manage — events
          GoRoute(
            path: '/manage/events/new',
            builder: (context, state) => const EventNewScreen(),
          ),
          GoRoute(
            path: '/manage/events/approvals',
            builder: (context, state) => const EventApprovalsScreen(),
          ),
          GoRoute(
            path: '/manage/events/reports',
            builder: (context, state) => const EventReportsScreen(),
          ),
          GoRoute(
            path: '/manage/events/reports/review',
            builder: (context, state) => const EventReportsReviewScreen(),
          ),
          GoRoute(
            path: '/manage/events/reports/review/:eventId',
            builder: (context, state) => EventReportReviewDetailScreen(
                eventId: state.pathParameters['eventId']!),
          ),
          GoRoute(
            path: '/manage/events/reports/:eventId',
            builder: (context, state) => EventReportFormScreen(
                eventId: state.pathParameters['eventId']!),
          ),
          GoRoute(
            path: '/manage/events/:id/roles',
            builder: (context, state) =>
                EventRolesScreen(id: state.pathParameters['id']!),
          ),

          // Manage — request queues
          GoRoute(
            path: '/manage/transport/requests',
            builder: (context, state) => const TransportRequestsScreen(),
          ),
          GoRoute(
            path: '/manage/transport/requests/:id',
            builder: (context, state) =>
                TransportRequestDetailScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/manage/media/requests',
            builder: (context, state) => const MediaRequestsScreen(),
          ),
          GoRoute(
            path: '/manage/food/requests',
            builder: (context, state) => const FoodRequestsScreen(),
          ),
          GoRoute(
            path: '/manage/finance/approvals',
            builder: (context, state) => const FinanceApprovalsScreen(),
          ),
          GoRoute(
            path: '/manage/talents',
            builder: (context, state) => const ManageTalentsScreen(),
          ),

          // Manage — affirmations
          GoRoute(
            path: '/manage/affirmations',
            builder: (context, state) => const ManageAffirmationsScreen(),
          ),
          GoRoute(
            path: '/manage/affirmations/new',
            builder: (context, state) => const AffirmationNewScreen(),
          ),
          GoRoute(
            path: '/manage/affirmations/:id',
            builder: (context, state) =>
                AffirmationEditScreen(id: state.pathParameters['id']!),
          ),

          // Manage — ROPs Camp
          GoRoute(
            path: '/manage/rops-camp',
            builder: (context, state) => const RopsCampAdminScreen(),
          ),
          GoRoute(
            path: '/manage/rops-camp/passes',
            builder: (context, state) => const CampPassesScreen(),
          ),
          GoRoute(
            path: '/manage/rops-camp/gate',
            builder: (context, state) => const CampGateScreen(),
          ),
          GoRoute(
            path: '/manage/rops-camp/check-in',
            builder: (context, state) => const CampCheckInScreen(),
          ),
          GoRoute(
            path: '/manage/rops-camp/meals',
            builder: (context, state) => const CampMealsScreen(),
          ),
          GoRoute(
            path: '/manage/rops-camp/sponsorships',
            builder: (context, state) => const CampSponsorshipsScreen(),
          ),
          GoRoute(
            path: '/manage/rops-camp/announcements',
            builder: (context, state) => const CampAnnouncementsScreen(),
          ),
          GoRoute(
            path: '/manage/rops-camp/status',
            builder: (context, state) => const CampStatusScreen(),
          ),

          // Manage — fundraising
          GoRoute(
            path: '/manage/fundraising',
            builder: (context, state) => const FundraisingScreen(),
          ),
          GoRoute(
            path: '/manage/fundraising/settings',
            builder: (context, state) => const FundraisingSettingsScreen(),
          ),
          GoRoute(
            path: '/manage/fundraising/braai/:id',
            builder: (context, state) =>
                BraaiDetailScreen(id: state.pathParameters['id']!),
          ),

          // Manage — admin
          GoRoute(
            path: '/manage/templates',
            builder: (context, state) => const TemplatesScreen(),
          ),
          GoRoute(
            path: '/manage/reports',
            builder: (context, state) => const ReportsScreen(),
          ),
          GoRoute(
            path: '/manage/settings',
            builder: (context, state) => const SettingsScreen(),
          ),
          GoRoute(
            path: '/manage/settings/access-control',
            builder: (context, state) => const AccessControlScreen(),
          ),
          GoRoute(
            path: '/manage/settings/institutions',
            builder: (context, state) => const InstitutionsScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text('Page not found: ${state.uri.path}')),
    ),
  );
}
