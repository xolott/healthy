import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import 'login_screen.dart';
import 'meals/meals_main_shell.dart';
import 'meals/pantry_catalog_screen.dart';
import 'meals/meals_placeholder_screens.dart';
import 'onboarding_screen.dart';
import 'startup_gate.dart';

FutureOr<String?> _mealsAuthRedirect(BuildContext context, GoRouterState state) async {
  final path = state.uri.path;
  if (path == '/' || path == '/login' || path == '/onboarding' || path.startsWith('/setup')) {
    return null;
  }
  if (path == '/home' ||
      path == '/food-log' ||
      path == '/pantry' ||
      path == '/progress' ||
      path.startsWith('/home/') ||
      path.startsWith('/food-log/') ||
      path.startsWith('/pantry/') ||
      path.startsWith('/progress/')) {
    final token = await readSessionToken();
    if (token == null || token.isEmpty) {
      return '/login';
    }
  }
  return null;
}

final mealsRouter = GoRouter(
  initialLocation: '/',
  redirect: _mealsAuthRedirect,
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const StartupGate(),
    ),
    GoRoute(
      path: '/setup',
      builder: (context, state) {
        final reconnect = state.uri.queryParameters['reconnect'] == '1';
        return ServerUrlSetupScreen(
          routes: const HealthyAuthRoutes(),
          navigate: (location) => context.go(location),
          showReconnectBanner: reconnect,
          onDismissReconnect: () => context.go('/setup'),
        );
      },
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const FirstOwnerOnboardingScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const OwnerLoginScreen(),
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return MealsMainShell(navigationShell: navigationShell);
      },
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              pageBuilder: (context, state) => const NoTransitionPage<void>(
                child: MealsHomePlaceholder(),
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/food-log',
              pageBuilder: (context, state) => const NoTransitionPage<void>(
                child: MealsFoodLogPlaceholder(),
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/pantry',
              pageBuilder: (context, state) => const NoTransitionPage<void>(
                child: MealsPantryCatalogScreen(),
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/progress',
              pageBuilder: (context, state) => const NoTransitionPage<void>(
                child: MealsProgressPlaceholder(),
              ),
            ),
          ],
        ),
      ],
    ),
  ],
);
