import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/auth/auth_provider.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class DewOfHermonApp extends StatefulWidget {
  const DewOfHermonApp({super.key});

  @override
  State<DewOfHermonApp> createState() => _DewOfHermonAppState();
}

class _DewOfHermonAppState extends State<DewOfHermonApp> {
  GoRouter? _router;

  @override
  Widget build(BuildContext context) {
    _router ??= createRouter(context.read<AuthProvider>());

    return MaterialApp.router(
      title: 'Dew of Hermon',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: _router,
    );
  }
}
