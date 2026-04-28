import 'package:go_router/go_router.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import 'home_shell_screen.dart';
import 'login_screen.dart';
import 'onboarding_screen.dart';
import 'startup_gate.dart';

final mealsRouter = GoRouter(
  initialLocation: '/',
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
    GoRoute(
      path: '/home',
      builder: (context, state) => const HomeShellScreen(),
    ),
  ],
);
