import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

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
            const Text(
              'Authentication is not implemented yet. Continue to open the app shell once the server reports setup is complete.',
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => context.go('/home'),
              child: const Text('Continue to app'),
            ),
          ],
        ),
      ),
    );
  }
}
