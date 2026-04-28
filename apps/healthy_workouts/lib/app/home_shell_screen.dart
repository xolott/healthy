import 'package:flutter/material.dart';

import '../core/config/app_identity.dart';
import '../shared/widgets/shell_scaffold.dart';

class HomeShellScreen extends StatelessWidget {
  const HomeShellScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ShellScaffold(
      title: AppIdentity.title,
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
