import 'package:flutter/material.dart';

/// Generic shell used by placeholder routes in this scaffold iteration.
class ShellScaffold extends StatelessWidget {
  const ShellScaffold({
    super.key,
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: child,
    );
  }
}
