import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'core/access/access_provider.dart';
import 'core/api/api_client.dart';
import 'core/auth/auth_provider.dart';
import 'core/services/pending_counts_provider.dart';
import 'core/services/push_service.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // `flutterfire configure` replaces firebase_options.dart with generated
  // options; the dart-define fallback covers ad-hoc builds. With neither, we
  // still boot (Firebase reads google-services.json / GoogleService-Info.plist
  // when present).
  if (DefaultFirebaseOptions.isConfigured) {
    await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform);
  } else {
    await Firebase.initializeApp();
  }

  final api = await ApiClient.create();

  runApp(DewOfHermonRoot(api: api));
}

class DewOfHermonRoot extends StatelessWidget {
  final ApiClient api;
  const DewOfHermonRoot({super.key, required this.api});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        Provider<PushService>(create: (_) => PushService(api)),
        ChangeNotifierProvider<AuthProvider>(
          create: (_) => AuthProvider(api),
        ),
        ChangeNotifierProvider<AccessControlProvider>(
          create: (_) => AccessControlProvider(),
        ),
        ChangeNotifierProxyProvider2<AuthProvider, AccessControlProvider,
            FeatureAccessProvider>(
          create: (context) => FeatureAccessProvider(
            context.read<AuthProvider>(),
            context.read<AccessControlProvider>(),
          ),
          update: (_, __, ___, previous) => previous!,
        ),
        ChangeNotifierProvider<PendingCountsProvider>(
          create: (context) => PendingCountsProvider(
            api,
            context.read<AuthProvider>(),
          ),
        ),
      ],
      child: const _PushRegistrar(child: DewOfHermonApp()),
    );
  }
}

/// Registers the FCM device token with the API once the user is signed in —
/// the mobile counterpart of the web push prompt.
class _PushRegistrar extends StatefulWidget {
  final Widget child;
  const _PushRegistrar({required this.child});

  @override
  State<_PushRegistrar> createState() => _PushRegistrarState();
}

class _PushRegistrarState extends State<_PushRegistrar> {
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final uid = auth.firebaseUser?.uid;
    if (uid != null) {
      // Fire-and-forget; PushService de-dupes per uid.
      context.read<PushService>().registerForUser(uid);
    } else {
      context.read<PushService>().reset();
    }
    return widget.child;
  }
}
