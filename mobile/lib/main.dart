import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/config.dart';
import 'firebase_options.dart';
import 'screens/auth/login_screen.dart';
import 'screens/shell.dart';
import 'services/access_service.dart';
import 'services/auth_service.dart';
import 'services/push_service.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  Object? initError;
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    initError = e;
  }

  if (initError != null) {
    // Firebase isn't configured for this platform yet (see mobile/README.md).
    runApp(SetupRequiredApp(detail: initError.toString()));
    return;
  }

  final api = await ApiClient.create();
  runApp(PottersWheelApp(api: api));
}

class PottersWheelApp extends StatelessWidget {
  const PottersWheelApp({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        Provider<PushService>(create: (_) => PushService(api)),
        ChangeNotifierProvider<AuthService>(
          create: (_) => AuthService(api),
        ),
        ChangeNotifierProvider<AccessService>(
          create: (_) => AccessService(),
        ),
      ],
      child: MaterialApp(
        title: AppConfig.appName,
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        home: const AuthGate(),
      ),
    );
  }
}

/// Shows the right root screen for the auth state, like the web app's
/// ProtectedRoute: splash while loading, login when signed out, the tab
/// shell once the profile document is available.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    if (auth.loading) return const _Splash();
    if (auth.profile == null) return const LoginScreen();
    return const AppShell();
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              'assets/images/church-logo.png',
              height: 110,
              errorBuilder: (_, _, _) =>
                  const Icon(Icons.church, size: 80, color: PWColors.gold),
            ),
            const SizedBox(height: 24),
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ],
        ),
      ),
    );
  }
}

/// Friendly placeholder shown when Firebase platform config is missing,
/// so the project runs out of the box before `flutterfire configure`.
class SetupRequiredApp extends StatelessWidget {
  const SetupRequiredApp({super.key, required this.detail});

  final String detail;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Column(
                  children: [
                    const Icon(Icons.build_circle_outlined,
                        size: 64, color: PWColors.gold),
                    const SizedBox(height: 16),
                    Text(
                      'Almost there',
                      style: Theme.of(context).textTheme.headlineMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'This build isn\'t connected to Firebase yet. Run '
                      '`flutterfire configure` in the mobile/ folder against '
                      'the same Firebase project as the website, then '
                      'rebuild. Full steps are in mobile/README.md.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: PWColors.clay500,
                            height: 1.5,
                          ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      detail,
                      style: Theme.of(context)
                          .textTheme
                          .labelSmall
                          ?.copyWith(color: PWColors.clay300),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
