import 'package:flutter/material.dart';

import '../core/config/app_identity.dart';

class OnboardingPlaceholderScreen extends StatelessWidget {
  const OnboardingPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Setup')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          '${AppIdentity.title}: first-owner onboarding will live here. '
          'You were routed here because the server reports setup is still required.',
        ),
      ),
    );
  }
}
