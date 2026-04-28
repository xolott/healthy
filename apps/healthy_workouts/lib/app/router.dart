import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'home_shell_screen.dart';
import 'login_screen.dart';
import 'onboarding_screen.dart';
import 'setup_screen.dart';
import 'startup_gate.dart';

final workoutsRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const StartupGate(),
    ),
    GoRoute(
      path: '/setup',
      builder: (context, state) => const SetupScreen(),
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingPlaceholderScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginPlaceholderScreen(),
    ),
    GoRoute(
      path: '/home',
      builder: (context, state) => const HomeShellScreen(),
    ),
  ],
);
