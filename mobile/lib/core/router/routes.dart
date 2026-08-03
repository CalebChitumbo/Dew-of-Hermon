import 'package:go_router/go_router.dart';

/// Feature routes, added phase by phase.
///
/// Every path is identical to the web URL it ports, so a push-notification
/// `link` payload deep-links for free — `router.go(data['link'])` lands on the
/// same screen the email would.
final List<RouteBase> featureRoutes = [];
