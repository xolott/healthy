import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import '../core/config/app_identity.dart';
import '../shared/widgets/shell_scaffold.dart';

class HomeShellScreen extends StatelessWidget {
  const HomeShellScreen({super.key});

  Future<void> _signOut(BuildContext context) async {
    final base = await ApiBaseUrlStore.read();
    final token = await readSessionToken();
    if (base != null && token != null && token.isNotEmpty) {
      try {
        await postAuthLogout(base, bearerToken: token);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not sign out on the server: $e')),
          );
        }
        return;
      }
    }
    await clearSessionToken();
    if (context.mounted) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return ShellScaffold(
      title: AppIdentity.title,
      actions: [
        IconButton(
          icon: const Icon(Icons.logout),
          tooltip: 'Sign out',
          onPressed: () => _signOut(context),
        ),
      ],
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          'Welcome to ${AppIdentity.title}.\n\n'
          'This is a scaffold shell only.',
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ),
    );
  }
}
