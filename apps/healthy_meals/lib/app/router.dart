import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/config/app_identity.dart';
import '../shared/widgets/shell_scaffold.dart';

final mealsRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      name: 'shell',
      builder: (context, state) => ShellScaffold(
        title: AppIdentity.title,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Welcome to ${AppIdentity.title}.\n\n'
            'This is a scaffold shell only.',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
      ),
    ),
  ],
);
