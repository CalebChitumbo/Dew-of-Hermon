import 'package:go_router/go_router.dart';

import '../../features/camp_ops/camp_hub_screen.dart';
import '../../features/camp_ops/camp_status_screen.dart';
import '../../features/camp_ops/camper_detail_screen.dart';
import '../../features/camp_ops/check_in_screen.dart';
import '../../features/camp_ops/gate_screen.dart';
import '../../features/camp_ops/meal_scanner_screen.dart';
import '../../features/camp_ops/passes_screen.dart';

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
        path: 'campers/:id',
        builder: (c, s) =>
            CamperDetailScreen(registrationId: s.pathParameters['id']!),
      ),
    ],
  ),
];
