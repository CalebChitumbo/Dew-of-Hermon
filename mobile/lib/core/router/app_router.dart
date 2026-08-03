import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/forgot_password_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/register_screen.dart';
import '../../features/auth/splash_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../access/access_control.dart';
import '../access/access_providers.dart';
import '../auth/auth_providers.dart';
import '../widgets/app_scaffold.dart';
import 'routes.dart';

/// Paths that never require a signed-in user — the auth screens plus the
/// public ROPs Camp and fundraising pages, which exist precisely so someone
/// without an account can register, sponsor or order.
const Set<String> _publicPrefixes = {
  '/login',
  '/register',
  '/forgot-password',
  '/rops-camp',
  '/fundraising/order',
};

bool _isPublic(String path) {
  if (path == '/') return true;
  for (final prefix in _publicPrefixes) {
    if (path == prefix || path.startsWith('$prefix/')) return true;
  }
  return false;
}

/// Notifies go_router when auth or access-control state changes, so a guard
/// re-runs the moment a role is granted or a session ends.
class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(this._ref) {
    _ref.listen(authReadyProvider, (_, __) => notifyListeners());
    _ref.listen(userOrNullProvider, (_, __) => notifyListeners());
    _ref.listen(accessConfigProvider, (_, __) => notifyListeners());
  }

  // Held so the listeners stay alive for the router's lifetime.
  // ignore: unused_field
  final Ref _ref;
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: refresh,
    redirect: (context, state) {
      final path = state.uri.path;

      // Hold on the splash until we know who (if anyone) is signed in, rather
      // than flashing the login screen at a signed-in user on cold start.
      if (!ref.read(authReadyProvider)) {
        return path == '/splash' ? null : '/splash';
      }

      final signedIn = ref.read(userOrNullProvider) != null;
      final onAuthScreen = path == '/login' ||
          path == '/register' ||
          path == '/forgot-password' ||
          path == '/splash';

      if (!signedIn) {
        return _isPublic(path) && path != '/splash' ? null : '/login';
      }

      if (onAuthScreen) return '/dashboard';

      // Page-level access control, using the same page keys and route
      // matching as the web (`getPageKeyFromRoute`).
      final pageKey = getPageKeyFromRoute(path);
      if (pageKey != null && !ref.read(accessProvider).canView(pageKey)) {
        return '/no-access?page=$pageKey';
      }

      return null;
    },
    errorBuilder: (context, state) => DetailScaffold(
      title: 'Page not found',
      body: NoAccessView(
        message: 'We could not find ${state.uri.path}.',
      ),
    ),
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/no-access',
        builder: (context, state) => DetailScaffold(
          title: 'No access',
          body: NoAccessView(
            message: _noAccessMessage(state.uri.queryParameters['page']),
          ),
        ),
      ),

      // ── Auth ──
      GoRoute(path: '/login', builder: (c, s) => const LoginScreen()),
      GoRoute(path: '/register', builder: (c, s) => const RegisterScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (c, s) => const ForgotPasswordScreen(),
      ),

      // ── Core ──
      GoRoute(path: '/dashboard', builder: (c, s) => const DashboardScreen()),
      GoRoute(path: '/profile', builder: (c, s) => const ProfileScreen()),
      GoRoute(
        path: '/notifications',
        builder: (c, s) => const NotificationsScreen(),
      ),

      ...featureRoutes,
    ],
  );
});

String _noAccessMessage(String? pageKey) {
  if (pageKey == null) {
    return 'Ask the Chairperson if you need access to this page.';
  }
  for (final page in kPageDefinitions) {
    if (page.key == pageKey) {
      return '${page.label} is not available to your role. '
          'Ask the Chairperson if you need access.';
    }
  }
  return 'Ask the Chairperson if you need access to this page.';
}
