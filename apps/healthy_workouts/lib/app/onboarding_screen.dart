import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import '../core/config/app_identity.dart';

class FirstOwnerOnboardingScreen extends StatelessWidget {
  const FirstOwnerOnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthFirstOwnerOnboardingScreen(
      routes: const HealthyAuthRoutes(),
      navigate: (location) => context.go(location),
      appProductTitle: AppIdentity.title,
    );
  }
}
