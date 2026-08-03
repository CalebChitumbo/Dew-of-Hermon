import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_providers.dart';
import 'core/push/push_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class DewOfHermonApp extends ConsumerStatefulWidget {
  const DewOfHermonApp({super.key});

  @override
  ConsumerState<DewOfHermonApp> createState() => _DewOfHermonAppState();
}

class _DewOfHermonAppState extends ConsumerState<DewOfHermonApp> {
  StreamSubscription<String>? _pushTaps;
  String? _registeredFor;

  @override
  void initState() {
    super.initState();
    // Tapping a push carries the same in-app path the notification row holds,
    // and the Flutter routes use the web's URLs verbatim — so routing a tap is
    // just go(link), no mapping table to keep in step.
    final push = ref.read(pushServiceProvider);
    unawaited(push.initialise());
    _pushTaps = push.taps.listen((link) {
      if (link.startsWith('/')) ref.read(routerProvider).go(link);
    });
  }

  @override
  void dispose() {
    unawaited(_pushTaps?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Register this device's token once we know who is signed in — but only
    // when permission was already granted, so nobody is prompted on a cold
    // start. The opt-in prompt lives on the profile screen.
    ref.listen(userOrNullProvider, (previous, next) {
      final userId = next?.id;
      if (userId != null && userId != _registeredFor) {
        _registeredFor = userId;
        unawaited(
          ref.read(pushServiceProvider).registerIfAlreadyPermitted(userId),
        );
      } else if (userId == null && _registeredFor != null) {
        // Signed out: drop the token so someone who hands their phone on does
        // not keep receiving another member\'s rota.
        final previousId = _registeredFor!;
        _registeredFor = null;
        unawaited(ref.read(pushServiceProvider).unregister(previousId));
      }
    });

    return MaterialApp.router(
      title: 'Dew of Hermon',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: ref.watch(routerProvider),
      builder: (context, child) {
        // Honour the system text size but stop an extreme accessibility
        // setting from breaking the scanner and register layouts.
        final scale = MediaQuery.textScalerOf(context).clamp(
          minScaleFactor: 0.9,
          maxScaleFactor: 1.3,
        );
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: scale),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
