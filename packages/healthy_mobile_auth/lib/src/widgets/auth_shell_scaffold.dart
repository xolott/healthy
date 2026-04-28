import 'package:flutter/material.dart';

/// App-agnostic shell for auth flows (apps supply branding via [title]).
class AuthShellScaffold extends StatelessWidget {
  const AuthShellScaffold({
    super.key,
    required this.title,
    required this.child,
    this.actions,
  });

  final String title;
  final Widget child;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      body: child,
    );
  }
}
