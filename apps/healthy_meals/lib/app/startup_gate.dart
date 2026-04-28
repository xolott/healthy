import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

/// Thin shell: delegates startup routing to [AuthStartupGate].
class StartupGate extends StatefulWidget {
  const StartupGate({super.key});

  @override
  State<StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<StartupGate> {
  @override
  Widget build(BuildContext context) {
    return AuthStartupGate(
      routes: const HealthyAuthRoutes(),
      navigate: (location) {
        if (!mounted) return;
        GoRouter.of(context).go(location);
      },
    );
  }
}
