import 'package:flutter/material.dart';

import '../core/api/first_owner_setup.dart';
import '../core/config/app_identity.dart';
import '../shared/widgets/shell_scaffold.dart';

class LoginPlaceholderScreen extends StatelessWidget {
  const LoginPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ShellScaffold(
      title: '${AppIdentity.title} — Sign in',
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Passwords must be at least $kPasswordMinLength characters (same rule as first-owner setup).',
            ),
            const SizedBox(height: 12),
            const Text(
              'Email and password login against the API is not implemented yet. Complete first-owner onboarding on a fresh server, or use a stored session from onboarding.',
            ),
          ],
        ),
      ),
    );
  }
}
